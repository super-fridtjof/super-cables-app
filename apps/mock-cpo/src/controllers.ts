import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  CommandResponse,
  Credentials,
  decodeTokenHeader,
  OCPI_VERSION,
  ocpiError,
  OcpiStatus,
  ocpiSuccess,
  StartSession,
  StopSession,
} from '@super-cables/ocpi';
import type { Request, Response } from 'express';
import { MockCpoState } from './state';

type AuthedRequest = Request & { ocpiToken?: string };

const BASE = 'ocpi/cpo';
const VERSION_BASE = `${BASE}/${OCPI_VERSION}`;

function reject(status: number, ocpiStatus: number, message: string): never {
  throw new HttpException(ocpiError(ocpiStatus, message), status);
}

/** Accepts token A (registration only) or a token C issued to a registered eMSP. */
@Injectable()
class TokenGuard implements CanActivate {
  constructor(private readonly state: MockCpoState) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = decodeTokenHeader(req.headers.authorization);
    if (!token) reject(401, OcpiStatus.CLIENT_ERROR, 'Missing token');
    const isTokenA = token === this.state.config.tokenA;
    if (!isTokenA && !this.state.emspForToken(token)) {
      reject(401, OcpiStatus.CLIENT_ERROR, 'Unknown token');
    }
    req.ocpiToken = token;
    return true;
  }
}

function registeredEmsp(state: MockCpoState, req: AuthedRequest) {
  const emsp = state.emspForToken(req.ocpiToken!);
  if (!emsp) reject(401, OcpiStatus.CLIENT_ERROR, 'Register first');
  return emsp;
}

@Controller(BASE)
@UseGuards(TokenGuard)
export class VersionsController {
  constructor(private readonly state: MockCpoState) {}

  @Get('versions')
  versions() {
    return ocpiSuccess([
      { version: OCPI_VERSION, url: `${this.state.config.publicUrl}/${VERSION_BASE}` },
    ]);
  }

  @Get(OCPI_VERSION)
  details() {
    const url = (m: string) => `${this.state.config.publicUrl}/${VERSION_BASE}/${m}`;
    return ocpiSuccess({
      version: OCPI_VERSION,
      endpoints: [
        { identifier: 'credentials', role: 'RECEIVER', url: url('credentials') },
        { identifier: 'locations', role: 'SENDER', url: url('locations') },
        { identifier: 'commands', role: 'RECEIVER', url: url('commands') },
      ],
    });
  }
}

@Controller(`${VERSION_BASE}/credentials`)
@UseGuards(TokenGuard)
export class CredentialsController {
  constructor(private readonly state: MockCpoState) {}

  @Get()
  get(@Req() req: AuthedRequest) {
    registeredEmsp(this.state, req);
    return ocpiSuccess(this.state.ourCredentials(req.ocpiToken!));
  }

  @Post()
  async register(@Body() body: Credentials) {
    try {
      return ocpiSuccess(await this.state.register(body));
    } catch (err) {
      reject(400, OcpiStatus.UNABLE_TO_USE_CLIENT_API, (err as Error).message);
    }
  }
}

@Controller(`${VERSION_BASE}/locations`)
@UseGuards(TokenGuard)
export class LocationsController {
  constructor(private readonly state: MockCpoState) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    registeredEmsp(this.state, req);
    const offset = Number(offsetParam ?? 0) || 0;
    const limit = Math.min(Number(limitParam ?? 1) || 1, 50); // small default page to exercise paging
    const page = this.state.locations.slice(offset, offset + limit);
    res.setHeader('X-Total-Count', String(this.state.locations.length));
    res.setHeader('X-Limit', String(limit));
    if (offset + limit < this.state.locations.length) {
      const next = `${this.state.config.publicUrl}/${VERSION_BASE}/locations?offset=${offset + limit}&limit=${limit}`;
      res.setHeader('Link', `<${next}>; rel="next"`);
    }
    return ocpiSuccess(page);
  }

  @Get(':locationId')
  one(@Req() req: AuthedRequest, @Param('locationId') id: string) {
    registeredEmsp(this.state, req);
    const location = this.state.locations.find((l) => l.id === id);
    if (!location) reject(404, OcpiStatus.UNKNOWN_LOCATION, 'Unknown location');
    return ocpiSuccess(location);
  }
}

@Controller(`${VERSION_BASE}/commands`)
@UseGuards(TokenGuard)
export class CommandsController {
  constructor(private readonly state: MockCpoState) {}

  @Post(':command')
  @HttpCode(200)
  command(@Req() req: AuthedRequest, @Param('command') command: string, @Body() body: unknown) {
    const emsp = registeredEmsp(this.state, req);
    const accepted: CommandResponse = { result: 'ACCEPTED', timeout: 30 };

    if (command === 'START_SESSION') {
      const cmd = body as StartSession;
      const problem = this.state.canStart(cmd);
      if (problem)
        return ocpiSuccess<CommandResponse>({
          result: 'REJECTED',
          timeout: 0,
          message: [{ language: 'en', text: problem }],
        });
      // Answer first, then act: OCPI commands are asynchronous.
      setImmediate(() => void this.state.startSession(emsp, cmd).catch(logError));
      return ocpiSuccess(accepted);
    }
    if (command === 'STOP_SESSION') {
      const cmd = body as StopSession;
      if (!this.state.hasSession(cmd.session_id)) {
        return ocpiSuccess<CommandResponse>({ result: 'UNKNOWN_SESSION', timeout: 0 });
      }
      setImmediate(
        () => void this.state.stopSession(emsp, cmd.session_id, cmd.response_url).catch(logError),
      );
      return ocpiSuccess(accepted);
    }
    return ocpiSuccess<CommandResponse>({ result: 'NOT_SUPPORTED', timeout: 0 });
  }
}

/** Unauthenticated peek at the simulator, for local debugging only. */
@Controller('debug')
export class DebugController {
  constructor(private readonly state: MockCpoState) {}

  @Get('locations')
  locations() {
    return this.state.locations;
  }
}

function logError(err: unknown) {
  console.error('[MockCPO]', err);
}
