import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Charge, Device } from '@prisma/client';
import { z } from 'zod';
import { safeEqual, sha256 } from '../common/crypto';
import { ZodPipe } from '../common/zod.pipe';
import { LocationsService } from '../ocpi/locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChargingService } from './charging.service';
import { CurrentDevice, DEVICE_TOKEN_TTL_SECONDS, DeviceGuard } from './device-auth';

const tokenSchema = z.object({ deviceId: z.string().uuid(), secret: z.string().min(1) });

function chargeView(c: Charge) {
  return {
    id: c.id,
    status: c.status,
    kwh: c.kwh,
    sessionId: c.sessionId,
    totalCost:
      c.totalCostExclVat === null
        ? null
        : { exclVat: c.totalCostExclVat, inclVat: c.totalCostInclVat, currency: c.currency },
    failureReason: c.failureReason,
    startedAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** API used by the app running on the Super Cables handle. */
@Controller('device/v1')
export class DeviceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly charging: ChargingService,
    private readonly locations: LocationsService,
  ) {}

  /** Exchange the provisioned device secret for a short-lived access token. */
  @Post('auth/token')
  @HttpCode(200)
  async token(@Body(new ZodPipe(tokenSchema)) body: z.infer<typeof tokenSchema>) {
    const device = await this.prisma.device.findUnique({ where: { id: body.deviceId } });
    if (
      !device ||
      device.status !== 'ACTIVE' ||
      !safeEqual(device.secretHash, sha256(body.secret))
    ) {
      throw new UnauthorizedException();
    }
    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    const accessToken = await this.jwt.signAsync(
      { sub: device.id, typ: 'device' },
      { expiresIn: DEVICE_TOKEN_TTL_SECONDS },
    );
    return { accessToken, expiresIn: DEVICE_TOKEN_TTL_SECONDS };
  }

  /** What the handle is plugged into, its live status, and any charge in progress. */
  @Get('me')
  @UseGuards(DeviceGuard)
  async me(@CurrentDevice() device: Device) {
    const party = await this.prisma.ocpiParty.findUniqueOrThrow({ where: { id: device.partyRef } });
    const location = await this.locations.find({
      countryCode: party.countryCode,
      partyId: party.partyId,
      id: device.locationId,
    });
    const evse = location?.evses?.find((e) => e.uid === device.evseUid);
    const connector = evse?.connectors.find((c) => c.id === device.connectorId);
    const current = await this.charging.current(device);
    return {
      device: { id: device.id, name: device.name },
      operator: { name: party.name, countryCode: party.countryCode, partyId: party.partyId },
      location: location && {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
      },
      evse: evse && { uid: evse.uid, evseId: evse.evse_id, status: evse.status },
      connector: connector && {
        id: connector.id,
        standard: connector.standard,
        powerType: connector.power_type,
        maxPowerW: connector.max_electric_power,
      },
      currentCharge: current && chargeView(current),
    };
  }

  @Post('charges')
  @UseGuards(DeviceGuard)
  async start(@CurrentDevice() device: Device) {
    return chargeView(await this.charging.start(device));
  }

  @Get('charges/:id')
  @UseGuards(DeviceGuard)
  async get(@CurrentDevice() device: Device, @Param('id') id: string) {
    return chargeView(await this.charging.get(device, id));
  }

  @Post('charges/:id/stop')
  @HttpCode(200)
  @UseGuards(DeviceGuard)
  async stop(@CurrentDevice() device: Device, @Param('id') id: string) {
    return chargeView(await this.charging.stop(device, id));
  }
}
