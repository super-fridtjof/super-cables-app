import { Injectable } from '@nestjs/common';
import type { OcpiParty } from '@prisma/client';
import { CDR, CommandResult, CommandType, Session } from '@super-cables/ocpi';
import { Subject } from 'rxjs';

export type OcpiEvent =
  | { type: 'session'; party: OcpiParty; session: Session }
  | { type: 'cdr'; party: OcpiParty; cdr: CDR }
  | { type: 'commandResult'; command: CommandType; uid: string; result: CommandResult };

/**
 * In-process bus from the OCPI receivers to the rest of the app, so the OCPI module does not
 * depend on the charging domain. Swap for a queue (BullMQ) once work needs retries.
 */
@Injectable()
export class OcpiEvents {
  readonly stream = new Subject<OcpiEvent>();

  emit(event: OcpiEvent) {
    this.stream.next(event);
  }
}
