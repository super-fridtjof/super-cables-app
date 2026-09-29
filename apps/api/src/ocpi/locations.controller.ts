import { Body, Controller, Get, Param, Patch, Put, UseFilters, UseGuards } from '@nestjs/common';
import type { OcpiParty } from '@prisma/client';
import { Connector, EVSE, Location, ocpiSuccess } from '@super-cables/ocpi';
import { assertOwnsObject, CurrentParty, OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiExceptionFilter } from './ocpi.errors';
import { OCPI_VERSION_BASE } from './ocpi-urls';
import { LocationsService } from './locations.service';

const LOC = ':countryCode/:partyId/:locationId';

/** Locations receiver interface: the CPO pushes location, EVSE and connector changes to us. */
@Controller(`${OCPI_VERSION_BASE}/locations`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  private key(party: OcpiParty, countryCode: string, partyId: string, id: string) {
    assertOwnsObject(party, countryCode, partyId);
    return { countryCode, partyId, id };
  }

  @Get(LOC)
  async getLocation(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
  ) {
    return ocpiSuccess(await this.locations.get(this.key(party, cc, pid, id)));
  }

  @Get(`${LOC}/:evseUid`)
  async getEvse(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Param('evseUid') evseUid: string,
  ) {
    const location = await this.locations.get(this.key(party, cc, pid, id));
    return ocpiSuccess(this.locations.evse(location, evseUid));
  }

  @Get(`${LOC}/:evseUid/:connectorId`)
  async getConnector(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Param('evseUid') evseUid: string,
    @Param('connectorId') connectorId: string,
  ) {
    const location = await this.locations.get(this.key(party, cc, pid, id));
    return ocpiSuccess(
      this.locations.connector(this.locations.evse(location, evseUid), connectorId),
    );
  }

  @Put(LOC)
  async putLocation(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Body() body: Location,
  ) {
    await this.locations.putLocation(this.key(party, cc, pid, id), body);
    return ocpiSuccess();
  }

  @Patch(LOC)
  async patchLocation(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Body() body: Partial<Location>,
  ) {
    await this.locations.patchLocation(this.key(party, cc, pid, id), body);
    return ocpiSuccess();
  }

  @Put(`${LOC}/:evseUid`)
  async putEvse(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Body() body: EVSE,
  ) {
    await this.locations.putEvse(this.key(party, cc, pid, id), body);
    return ocpiSuccess();
  }

  @Patch(`${LOC}/:evseUid`)
  async patchEvse(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Param('evseUid') evseUid: string,
    @Body() body: Partial<EVSE>,
  ) {
    await this.locations.patchEvse(this.key(party, cc, pid, id), evseUid, body);
    return ocpiSuccess();
  }

  @Put(`${LOC}/:evseUid/:connectorId`)
  async putConnector(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Param('evseUid') evseUid: string,
    @Body() body: Connector,
  ) {
    await this.locations.putConnector(this.key(party, cc, pid, id), evseUid, body);
    return ocpiSuccess();
  }

  @Patch(`${LOC}/:evseUid/:connectorId`)
  async patchConnector(
    @CurrentParty() party: OcpiParty,
    @Param('countryCode') cc: string,
    @Param('partyId') pid: string,
    @Param('locationId') id: string,
    @Param('evseUid') evseUid: string,
    @Param('connectorId') connectorId: string,
    @Body() body: Partial<Connector>,
  ) {
    await this.locations.patchConnector(this.key(party, cc, pid, id), evseUid, connectorId, body);
    return ocpiSuccess();
  }
}
