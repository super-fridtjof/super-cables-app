import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { OcpiParty, Prisma } from '@prisma/client';
import { CDR, OcpiStatus, ocpiSuccess } from '@super-cables/ocpi';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnsObject, CurrentParty, OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiException, OcpiExceptionFilter } from './ocpi.errors';
import { OcpiEvents } from './ocpi-events';
import { OCPI_VERSION_BASE, OcpiUrls } from './ocpi-urls';

/** CDRs receiver interface: the CPO posts the final charge detail record after a session. */
@Controller(`${OCPI_VERSION_BASE}/cdrs`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class CdrsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OcpiEvents,
    private readonly urls: OcpiUrls,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentParty() party: OcpiParty,
    @Body() cdr: CDR,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOwnsObject(party, cdr.country_code, cdr.party_id);
    const key = { countryCode: cdr.country_code, partyId: cdr.party_id, id: cdr.id };
    // CDRs are immutable in OCPI; a repeated POST of the same id is treated as a retry.
    const existing = await this.prisma.cdr.findUnique({ where: { countryCode_partyId_id: key } });
    if (!existing) {
      await this.prisma.cdr.create({
        data: {
          ...key,
          sessionId: cdr.session_id ?? null,
          totalEnergy: cdr.total_energy,
          totalCost: cdr.total_cost as unknown as Prisma.InputJsonValue,
          currency: cdr.currency,
          data: cdr as unknown as Prisma.InputJsonValue,
        },
      });
      this.events.emit({ type: 'cdr', party, cdr });
    }
    res.setHeader('Location', this.urls.module(`cdrs/${key.countryCode}/${key.partyId}/${key.id}`));
    return ocpiSuccess();
  }

  @Get(':countryCode/:partyId/:cdrId')
  async get(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') countryCode: string,
    @Param('partyId') partyId: string,
    @Param('cdrId') id: string,
  ) {
    assertOwnsObject(party, countryCode, partyId);
    const row = await this.prisma.cdr.findUnique({
      where: { countryCode_partyId_id: { countryCode, partyId, id } },
    });
    if (!row)
      throw new OcpiException(OcpiStatus.CLIENT_ERROR, `Unknown CDR ${id}`, HttpStatus.NOT_FOUND);
    return ocpiSuccess(row.data);
  }
}
