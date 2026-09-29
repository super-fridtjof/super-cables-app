import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  CDR,
  CommandResult,
  Credentials,
  EVSE,
  Endpoint,
  findEndpoint,
  Location,
  OCPI_VERSION,
  ocpiRequest,
  Session,
  StartSession,
  Version,
  VersionDetails,
} from '@super-cables/ocpi';
import { randomBytes, randomUUID } from 'node:crypto';
import { MOCK_CONFIG } from './di';
import type { MockCpoConfig } from './config';
import { seedLocations } from './seed';

interface Emsp {
  countryCode: string;
  partyId: string;
  /** Token B: what we present when calling the eMSP. */
  token: string;
  endpoints: Endpoint[];
}

interface RunningSession {
  session: Session;
  location: Location;
  evse: EVSE;
  timer?: NodeJS.Timeout;
}

/** Everything the mock operator knows. In memory: restart the process to reset. */
@Injectable()
export class MockCpoState implements OnModuleDestroy {
  private readonly logger = new Logger('MockCPO');
  readonly locations: Location[];
  /** Token C values we issued, mapped to the eMSP holding them. */
  private readonly issued = new Map<string, Emsp>();
  private readonly sessions = new Map<string, RunningSession>();

  constructor(@Inject(MOCK_CONFIG) readonly config: MockCpoConfig) {
    this.locations = seedLocations(config.countryCode, config.partyId);
  }

  onModuleDestroy() {
    for (const s of this.sessions.values()) clearInterval(s.timer);
  }

  // --- Credentials -----------------------------------------------------------

  registeredEmsps(): Emsp[] {
    return [...this.issued.values()];
  }

  emspForToken(token: string): Emsp | undefined {
    return this.issued.get(token);
  }

  /** Handles POST /credentials from an eMSP holding token A. Returns our credentials (token C). */
  async register(theirs: Credentials): Promise<Credentials> {
    const role = theirs.roles.find((r) => r.role === 'EMSP');
    if (!role) throw new Error('Only eMSPs can register with this mock');
    const versions = await ocpiRequest<Version[]>(theirs.url, { token: theirs.token });
    const version = versions.find((v) => v.version === OCPI_VERSION);
    if (!version) throw new Error(`eMSP does not support ${OCPI_VERSION}`);
    const details = await ocpiRequest<VersionDetails>(version.url, { token: theirs.token });

    // One registration per eMSP party: re-registering replaces the old token C.
    for (const [token, emsp] of this.issued) {
      if (emsp.countryCode === role.country_code && emsp.partyId === role.party_id) {
        this.issued.delete(token);
      }
    }
    const tokenC = randomBytes(24).toString('base64url');
    this.issued.set(tokenC, {
      countryCode: role.country_code,
      partyId: role.party_id,
      token: theirs.token,
      endpoints: details.endpoints,
    });
    this.logger.log(`Registered eMSP ${role.country_code}*${role.party_id}`);
    return this.ourCredentials(tokenC);
  }

  ourCredentials(token: string): Credentials {
    return {
      token,
      url: `${this.config.publicUrl}/ocpi/cpo/versions`,
      roles: [
        {
          role: 'CPO',
          country_code: this.config.countryCode,
          party_id: this.config.partyId,
          business_details: { name: 'Mock Charge Point Operator' },
        },
      ],
    };
  }

  // --- Locations -------------------------------------------------------------

  findEvse(locationId: string, evseUid?: string) {
    const location = this.locations.find((l) => l.id === locationId);
    const evse = location?.evses?.find((e) => e.uid === evseUid);
    return { location, evse };
  }

  // --- Commands --------------------------------------------------------------

  /** Validates a START_SESSION synchronously; the session itself starts shortly after. */
  canStart(cmd: StartSession): string | undefined {
    const { location, evse } = this.findEvse(cmd.location_id, cmd.evse_uid);
    if (!location || !evse) return 'Unknown location or EVSE';
    if (evse.status !== 'AVAILABLE') return `EVSE is ${evse.status}`;
    if (cmd.connector_id && !evse.connectors.some((c) => c.id === cmd.connector_id)) {
      return 'Unknown connector';
    }
    return undefined;
  }

  async startSession(emsp: Emsp, cmd: StartSession) {
    const { location, evse } = this.findEvse(cmd.location_id, cmd.evse_uid);
    if (!location || !evse || evse.status !== 'AVAILABLE') {
      await this.sendResult(emsp, cmd.response_url, { result: 'EVSE_OCCUPIED' });
      return;
    }
    await this.sendResult(emsp, cmd.response_url, { result: 'ACCEPTED' });

    const now = new Date().toISOString();
    const session: Session = {
      country_code: this.config.countryCode,
      party_id: this.config.partyId,
      id: randomUUID(),
      start_date_time: now,
      kwh: 0,
      cdr_token: {
        country_code: cmd.token.country_code,
        party_id: cmd.token.party_id,
        uid: cmd.token.uid,
        type: cmd.token.type,
        contract_id: cmd.token.contract_id,
      },
      auth_method: 'COMMAND',
      authorization_reference: cmd.authorization_reference,
      location_id: location.id,
      evse_uid: evse.uid,
      connector_id: cmd.connector_id ?? evse.connectors[0].id,
      currency: this.config.currency,
      total_cost: { excl_vat: 0, incl_vat: 0 },
      status: 'ACTIVE',
      last_updated: now,
    };
    const running: RunningSession = { session, location, evse };
    this.sessions.set(session.id, running);

    await this.setEvseStatus(emsp, location, evse, 'CHARGING');
    await this.pushSession(emsp, session);
    running.timer = setInterval(() => {
      this.tick(emsp, running).catch((err) => this.logger.error('Tick failed', err));
    }, this.config.tickMs);
    this.logger.log(`Session ${session.id} started on ${evse.uid}`);
  }

  hasSession(id: string) {
    return this.sessions.has(id);
  }

  async stopSession(emsp: Emsp, sessionId: string, responseUrl: string) {
    const running = this.sessions.get(sessionId);
    if (!running) {
      await this.sendResult(emsp, responseUrl, { result: 'FAILED' });
      return;
    }
    clearInterval(running.timer);
    this.sessions.delete(sessionId);
    await this.sendResult(emsp, responseUrl, { result: 'ACCEPTED' });

    const end = new Date().toISOString();
    const session: Session = {
      ...running.session,
      ...this.costFor(running.session.kwh),
      end_date_time: end,
      status: 'COMPLETED',
      last_updated: end,
    };
    await this.pushSession(emsp, session);
    await this.setEvseStatus(emsp, running.location, running.evse, 'AVAILABLE');
    await this.postCdr(emsp, session, running);
    this.logger.log(`Session ${session.id} completed, ${session.kwh.toFixed(3)} kWh`);
  }

  // --- Simulation ------------------------------------------------------------

  private async tick(emsp: Emsp, running: RunningSession) {
    const hours = (this.config.tickMs * this.config.speedup) / 3_600_000;
    const kwh = round(running.session.kwh + this.config.powerKw * hours, 3);
    const now = new Date().toISOString();
    running.session = { ...running.session, kwh, ...this.costFor(kwh), last_updated: now };
    await this.send(emsp, 'sessions', 'PATCH', this.objectPath(running.session.id), {
      kwh,
      total_cost: running.session.total_cost,
      last_updated: now,
    });
  }

  private costFor(kwh: number) {
    const excl = round(kwh * this.config.pricePerKwhExclVat, 2);
    return { total_cost: { excl_vat: excl, incl_vat: round(excl * (1 + this.config.vatRate), 2) } };
  }

  private async postCdr(emsp: Emsp, session: Session, running: RunningSession) {
    const connector = running.evse.connectors.find((c) => c.id === session.connector_id)!;
    const totalTime =
      (new Date(session.end_date_time!).getTime() - new Date(session.start_date_time).getTime()) /
      3_600_000;
    const cdr: CDR = {
      country_code: this.config.countryCode,
      party_id: this.config.partyId,
      id: `CDR-${session.id}`,
      start_date_time: session.start_date_time,
      end_date_time: session.end_date_time!,
      session_id: session.id,
      cdr_token: session.cdr_token,
      auth_method: session.auth_method,
      authorization_reference: session.authorization_reference,
      cdr_location: {
        id: running.location.id,
        address: running.location.address,
        city: running.location.city,
        country: running.location.country,
        coordinates: running.location.coordinates,
        evse_uid: running.evse.uid,
        evse_id: running.evse.evse_id ?? running.evse.uid,
        connector_id: connector.id,
        connector_standard: connector.standard,
        connector_format: connector.format,
        connector_power_type: connector.power_type,
      },
      currency: session.currency,
      charging_periods: [
        {
          start_date_time: session.start_date_time,
          dimensions: [{ type: 'ENERGY', volume: session.kwh }],
        },
      ],
      total_cost: session.total_cost!,
      total_energy: session.kwh,
      total_time: round(totalTime * this.config.speedup, 4),
      last_updated: session.last_updated,
    };
    await this.send(emsp, 'cdrs', 'POST', '', cdr);
  }

  // --- Outbound OCPI ---------------------------------------------------------

  private objectPath(id: string) {
    return `/${this.config.countryCode}/${this.config.partyId}/${id}`;
  }

  private async setEvseStatus(emsp: Emsp, location: Location, evse: EVSE, status: EVSE['status']) {
    const now = new Date().toISOString();
    evse.status = status;
    evse.last_updated = now;
    location.last_updated = now;
    await this.send(emsp, 'locations', 'PATCH', `${this.objectPath(location.id)}/${evse.uid}`, {
      status,
      last_updated: now,
    });
  }

  private pushSession(emsp: Emsp, session: Session) {
    return this.send(emsp, 'sessions', 'PUT', this.objectPath(session.id), session);
  }

  private sendResult(emsp: Emsp, url: string, result: CommandResult) {
    return ocpiRequest(url, { method: 'POST', token: emsp.token, body: result });
  }

  private async send(
    emsp: Emsp,
    module: 'locations' | 'sessions' | 'cdrs',
    method: 'PUT' | 'PATCH' | 'POST',
    path: string,
    body: unknown,
  ) {
    const base = findEndpoint(emsp.endpoints, module, 'RECEIVER');
    if (!base) {
      this.logger.warn(`eMSP has no ${module} receiver; skipping push`);
      return;
    }
    await ocpiRequest(`${base}${path}`, { method, token: emsp.token, body });
  }
}

function round(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
