import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import type { OcpiParty } from '@prisma/client';
import { z } from 'zod';
import { randomToken, sha256 } from '../common/crypto';
import { ZodPipe } from '../common/zod.pipe';
import { LocationsService } from '../ocpi/locations.service';
import { RegistrationService } from '../ocpi/registration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';

const registerSchema = z.object({
  versionsUrl: z.string().url(),
  tokenA: z.string().min(1),
});

const deviceSchema = z.object({
  name: z.string().min(1),
  partyRef: z.string().uuid(),
  locationId: z.string().min(1),
  evseUid: z.string().min(1),
  connectorId: z.string().min(1),
});

function partySummary(p: OcpiParty) {
  return {
    id: p.id,
    countryCode: p.countryCode,
    partyId: p.partyId,
    name: p.name,
    role: p.role,
    status: p.status,
    versionsUrl: p.versionsUrl,
  };
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registration: RegistrationService,
    private readonly locations: LocationsService,
  ) {}

  /** Connect to a CPO with the token A they gave us, then import their locations. */
  @Post('ocpi/parties')
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>) {
    const party = await this.registration.register(body.versionsUrl, body.tokenA);
    const locations = await this.locations.pullFrom(party);
    return { party: partySummary(party), locationsImported: locations };
  }

  @Get('ocpi/parties')
  async parties() {
    return (await this.prisma.ocpiParty.findMany({ orderBy: { createdAt: 'asc' } })).map(
      partySummary,
    );
  }

  @Post('ocpi/parties/:id/locations/sync')
  async syncLocations(@Param('id') id: string) {
    const party = await this.prisma.ocpiParty.findUnique({ where: { id } });
    if (!party) throw new NotFoundException();
    return { locationsImported: await this.locations.pullFrom(party) };
  }

  @Get('locations')
  locationsList() {
    return this.locations.list();
  }

  /** Provision a device bound to one connector. The secret is only returned here, once. */
  @Post('devices')
  async createDevice(@Body(new ZodPipe(deviceSchema)) body: z.infer<typeof deviceSchema>) {
    const party = await this.prisma.ocpiParty.findUnique({ where: { id: body.partyRef } });
    if (!party) throw new NotFoundException('Unknown party');
    const location = await this.locations.get({
      countryCode: party.countryCode,
      partyId: party.partyId,
      id: body.locationId,
    });
    this.locations.connector(this.locations.evse(location, body.evseUid), body.connectorId);

    const secret = randomToken();
    const device = await this.prisma.device.create({
      data: { ...body, secretHash: sha256(secret) },
    });
    return { id: device.id, secret };
  }

  @Get('charges')
  charges() {
    return this.prisma.charge.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
