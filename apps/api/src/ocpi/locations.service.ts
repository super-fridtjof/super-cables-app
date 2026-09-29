import { Injectable } from '@nestjs/common';
import type { OcpiParty, Prisma } from '@prisma/client';
import { Connector, EVSE, findEndpoint, Location, ocpiFetchAll } from '@super-cables/ocpi';
import { PrismaService } from '../prisma/prisma.service';
import { invalidParams, unknownLocation } from './ocpi.errors';

type Key = { countryCode: string; partyId: string; id: string };

/** Stores CPO locations. EVSEs and connectors are kept nested inside the location document. */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: Key): Promise<Location> {
    const row = await this.prisma.location.findUnique({
      where: { countryCode_partyId_id: key },
    });
    if (!row) throw unknownLocation(key.id);
    return row.data as unknown as Location;
  }

  async find(key: Key): Promise<Location | undefined> {
    const row = await this.prisma.location.findUnique({ where: { countryCode_partyId_id: key } });
    return (row?.data as unknown as Location) ?? undefined;
  }

  async list(): Promise<Location[]> {
    const rows = await this.prisma.location.findMany({ orderBy: { id: 'asc' } });
    return rows.map((r) => r.data as unknown as Location);
  }

  async putLocation(key: Key, location: Location) {
    if (location.id !== key.id) throw invalidParams('Location id does not match the URL');
    await this.save(key, location);
  }

  async patchLocation(key: Key, patch: Partial<Location>) {
    const current = await this.get(key);
    await this.save(key, { ...current, ...patch, id: key.id });
  }

  async putEvse(key: Key, evse: EVSE) {
    const location = await this.get(key);
    const evses = (location.evses ?? []).filter((e) => e.uid !== evse.uid);
    await this.save(key, { ...location, evses: [...evses, evse], last_updated: evse.last_updated });
  }

  async patchEvse(key: Key, evseUid: string, patch: Partial<EVSE>) {
    const location = await this.get(key);
    const evse = this.evse(location, evseUid);
    Object.assign(evse, patch, { uid: evseUid });
    await this.save(key, {
      ...location,
      last_updated: patch.last_updated ?? location.last_updated,
    });
  }

  async putConnector(key: Key, evseUid: string, connector: Connector) {
    const location = await this.get(key);
    const evse = this.evse(location, evseUid);
    evse.connectors = [...evse.connectors.filter((c) => c.id !== connector.id), connector];
    await this.save(key, location);
  }

  async patchConnector(key: Key, evseUid: string, connectorId: string, patch: Partial<Connector>) {
    const location = await this.get(key);
    const connector = this.connector(this.evse(location, evseUid), connectorId);
    Object.assign(connector, patch, { id: connectorId });
    await this.save(key, location);
  }

  evse(location: Location, uid: string): EVSE {
    const evse = location.evses?.find((e) => e.uid === uid);
    if (!evse) throw unknownLocation(`${location.id}/${uid}`);
    return evse;
  }

  connector(evse: EVSE, id: string): Connector {
    const connector = evse.connectors.find((c) => c.id === id);
    if (!connector) throw unknownLocation(`${evse.uid}/${id}`);
    return connector;
  }

  /** Pulls every location from the CPO's locations sender interface. */
  async pullFrom(party: OcpiParty): Promise<number> {
    const url = findEndpoint(party.endpoints as never, 'locations', 'SENDER');
    if (!url) throw new Error(`CPO ${party.partyId} has no locations sender endpoint`);
    const locations = await ocpiFetchAll<Location>(url, party.outgoingToken);
    for (const location of locations) {
      await this.save(
        { countryCode: location.country_code, partyId: location.party_id, id: location.id },
        location,
      );
    }
    return locations.length;
  }

  private async save(key: Key, location: Location) {
    const data = location as unknown as Prisma.InputJsonValue;
    const lastUpdated = new Date(location.last_updated);
    await this.prisma.location.upsert({
      where: { countryCode_partyId_id: key },
      create: { ...key, data, lastUpdated },
      update: { data, lastUpdated },
    });
  }
}
