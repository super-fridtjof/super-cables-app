import { Injectable } from '@nestjs/common';
import type { OcpiParty } from '@prisma/client';
import {
  CommandResponse,
  CommandType,
  findEndpoint,
  ocpiRequest,
  StartSession,
  StopSession,
  Token,
} from '@super-cables/ocpi';
import { OcpiUrls } from './ocpi-urls';

/** Sends commands to a CPO. Results arrive asynchronously on CommandsController. */
@Injectable()
export class CommandsService {
  constructor(private readonly urls: OcpiUrls) {}

  startSession(
    party: OcpiParty,
    uid: string,
    args: { token: Token; locationId: string; evseUid: string; connectorId: string },
  ): Promise<CommandResponse> {
    const body: StartSession = {
      response_url: this.responseUrl('START_SESSION', uid),
      token: args.token,
      location_id: args.locationId,
      evse_uid: args.evseUid,
      connector_id: args.connectorId,
      // The CPO copies this onto the Session and CDR, which is how we match them to our charge.
      authorization_reference: uid,
    };
    return this.send(party, 'START_SESSION', body);
  }

  stopSession(party: OcpiParty, uid: string, sessionId: string): Promise<CommandResponse> {
    const body: StopSession = {
      response_url: this.responseUrl('STOP_SESSION', uid),
      session_id: sessionId,
    };
    return this.send(party, 'STOP_SESSION', body);
  }

  private responseUrl(command: CommandType, uid: string) {
    return this.urls.module(`commands/${command}/${uid}`);
  }

  private send(party: OcpiParty, command: CommandType, body: unknown) {
    const base = findEndpoint(party.endpoints as never, 'commands', 'RECEIVER');
    if (!base) throw new Error(`CPO ${party.partyId} has no commands receiver endpoint`);
    return ocpiRequest<CommandResponse>(`${base}/${command}`, {
      method: 'POST',
      token: party.outgoingToken,
      body,
    });
  }
}
