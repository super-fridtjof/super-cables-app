import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { OcpiParty, Prisma } from '@prisma/client';
import { OcpiStatus, ocpiSuccess, Session } from '@super-cables/ocpi';
import { PrismaService } from '../prisma/prisma.service';
import { assertOwnsObject, CurrentParty, OcpiAuthGuard } from './ocpi-auth.guard';
import { invalidParams, OcpiException, OcpiExceptionFilter } from './ocpi.errors';
import { OcpiEvents } from './ocpi-events';
import { OCPI_VERSION_BASE } from './ocpi-urls';

const SESSION = ':countryCode/:partyId/:sessionId';

/** Sessions receiver interface: the CPO pushes session state while a car charges. */
@Controller(`${OCPI_VERSION_BASE}/sessions`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class SessionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OcpiEvents,
  ) {}

  @Get(SESSION)
  async get(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') countryCode: string,
    @Param('partyId') partyId: string,
    @Param('sessionId') id: string,
  ) {
    assertOwnsObject(party, countryCode, partyId);
    return ocpiSuccess(await this.load(countryCode, partyId, id));
  }

  @Put(SESSION)
  async put(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') countryCode: string,
    @Param('partyId') partyId: string,
    @Param('sessionId') id: string,
    @Body() session: Session,
  ) {
    assertOwnsObject(party, countryCode, partyId);
    if (session.id !== id) throw invalidParams('Session id does not match the URL');
    await this.save(party, session);
    return ocpiSuccess();
  }

  @Patch(SESSION)
  async patch(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') countryCode: string,
    @Param('partyId') partyId: string,
    @Param('sessionId') id: string,
    @Body() patch: Partial<Session>,
  ) {
    assertOwnsObject(party, countryCode, partyId);
    const current = await this.load(countryCode, partyId, id);
    await this.save(party, { ...current, ...patch, id });
    return ocpiSuccess();
  }

  private async load(countryCode: string, partyId: string, id: string): Promise<Session> {
    const row = await this.prisma.ocpiSession.findUnique({
      where: { countryCode_partyId_id: { countryCode, partyId, id } },
    });
    if (!row) {
      throw new OcpiException(
        OcpiStatus.CLIENT_ERROR,
        `Unknown session ${id}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return row.data as unknown as Session;
  }

  private async save(party: OcpiParty, session: Session) {
    const fields = {
      status: session.status,
      kwh: session.kwh,
      authorizationReference: session.authorization_reference ?? null,
      data: session as unknown as Prisma.InputJsonValue,
      lastUpdated: new Date(session.last_updated),
    };
    await this.prisma.ocpiSession.upsert({
      where: {
        countryCode_partyId_id: {
          countryCode: session.country_code,
          partyId: session.party_id,
          id: session.id,
        },
      },
      create: {
        countryCode: session.country_code,
        partyId: session.party_id,
        id: session.id,
        ...fields,
      },
      update: fields,
    });
    this.events.emit({ type: 'session', party, session });
  }
}
