import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OcpiParty } from '@prisma/client';
import { decodeTokenHeader, OcpiStatus } from '@super-cables/ocpi';
import type { Request } from 'express';
import { sha256 } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OcpiException } from './ocpi.errors';
import { PendingRegistrations } from './pending-registrations';

const ALLOW_PENDING = 'ocpi:allowPending';

/**
 * Lets a party that is mid-registration (holding a token B we just generated, before the
 * credentials exchange completes) call this route. Only versions discovery needs it.
 */
export const AllowPendingRegistration = () => SetMetadata(ALLOW_PENDING, true);

export type OcpiRequest = Request & { ocpiParty?: OcpiParty };

/** Authenticates OCPI peers by the credentials token they present (our token B). */
@Injectable()
export class OcpiAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pending: PendingRegistrations,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OcpiRequest>();
    const token = decodeTokenHeader(req.headers.authorization);
    if (!token) throw this.unauthorized();

    const hash = sha256(token);
    const party = await this.prisma.ocpiParty.findUnique({ where: { incomingTokenHash: hash } });
    if (party && party.status === 'CONNECTED') {
      req.ocpiParty = party;
      return true;
    }
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowPending && this.pending.has(hash)) return true;
    throw this.unauthorized();
  }

  private unauthorized() {
    return new OcpiException(
      OcpiStatus.CLIENT_ERROR,
      'Invalid or missing token',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export const CurrentParty = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const party = ctx.switchToHttp().getRequest<OcpiRequest>().ocpiParty;
  if (!party) {
    throw new OcpiException(
      OcpiStatus.CLIENT_ERROR,
      'Party not registered',
      HttpStatus.UNAUTHORIZED,
    );
  }
  return party;
});

/** A CPO may only write objects it owns (country_code/party_id in the URL). */
export function assertOwnsObject(party: OcpiParty, countryCode: string, partyId: string) {
  if (party.countryCode !== countryCode || party.partyId !== partyId) {
    throw new OcpiException(
      OcpiStatus.INVALID_PARAMETERS,
      `Party ${party.countryCode}*${party.partyId} cannot modify objects of ${countryCode}*${partyId}`,
      HttpStatus.FORBIDDEN,
    );
  }
}
