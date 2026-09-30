import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Device } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const DEVICE_TOKEN_TTL_SECONDS = 15 * 60;

type DeviceRequest = Request & { device?: Device };

/** Authenticates a Super Cables handle by its short-lived access token. */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<DeviceRequest>();
    const match = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '');
    if (!match) throw new UnauthorizedException();
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(match[1]);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'device') throw new UnauthorizedException();
    const device = await this.prisma.device.findUnique({ where: { id: payload.sub } });
    if (!device || device.status !== 'ACTIVE') throw new UnauthorizedException();
    req.device = device;
    return true;
  }
}

export const CurrentDevice = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<DeviceRequest>().device!,
);
