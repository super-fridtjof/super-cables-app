import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Charge, ChargeStatus, Device, OcpiParty } from '@prisma/client';
import { CDR, CommandResult, CommandType, Session } from '@super-cables/ocpi';
import { Subscription } from 'rxjs';
import { CommandsService } from '../ocpi/commands.service';
import { OcpiEvents } from '../ocpi/ocpi-events';
import { TokensService } from '../ocpi/tokens.service';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES: ChargeStatus[] = ['STARTING', 'ACTIVE', 'STOPPING'];

/**
 * The charging journey on a device: start, live progress, stop and final cost.
 * The CPO drives state through OCPI command results, session pushes and the CDR.
 */
@Injectable()
export class ChargingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChargingService.name);
  private subscription?: Subscription;
  /** Events are applied one at a time so session updates cannot overtake each other. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: CommandsService,
    private readonly tokens: TokensService,
    private readonly events: OcpiEvents,
  ) {}

  onModuleInit() {
    this.subscription = this.events.stream.subscribe((event) => {
      this.queue = this.queue
        .then(() =>
          event.type === 'session'
            ? this.onSession(event.party, event.session)
            : event.type === 'cdr'
              ? this.onCdr(event.party, event.cdr)
              : this.onCommandResult(event.command, event.uid, event.result),
        )
        .catch((err) => this.logger.error(`Failed to handle OCPI ${event.type} event`, err));
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  async start(device: Device): Promise<Charge> {
    const open = await this.prisma.charge.findFirst({
      where: { deviceId: device.id, status: { in: OPEN_STATUSES } },
    });
    if (open)
      throw new ConflictException({ message: 'A charge is already running', chargeId: open.id });

    const party = await this.prisma.ocpiParty.findUniqueOrThrow({ where: { id: device.partyRef } });
    const token = await this.tokens.issueAdHoc();
    const charge = await this.prisma.charge.create({
      data: { deviceId: device.id, partyRef: party.id, tokenUid: token.uid },
    });
    try {
      const response = await this.commands.startSession(party, charge.id, {
        token: this.tokens.toOcpi(token),
        locationId: device.locationId,
        evseUid: device.evseUid,
        connectorId: device.connectorId,
      });
      if (response.result !== 'ACCEPTED') {
        return this.fail(charge.id, `Operator rejected start: ${response.result}`);
      }
    } catch (err) {
      this.logger.error('START_SESSION failed', err);
      return this.fail(charge.id, 'Operator unreachable');
    }
    return charge;
  }

  async stop(device: Device, chargeId: string): Promise<Charge> {
    const charge = await this.get(device, chargeId);
    if (charge.status !== 'ACTIVE' || !charge.sessionId) {
      throw new ConflictException(`Charge is ${charge.status}, not ACTIVE`);
    }
    const party = await this.prisma.ocpiParty.findUniqueOrThrow({ where: { id: charge.partyRef } });
    const updated = await this.prisma.charge.update({
      where: { id: charge.id },
      data: { status: 'STOPPING' },
    });
    try {
      const response = await this.commands.stopSession(party, charge.id, charge.sessionId);
      if (response.result !== 'ACCEPTED') {
        return this.prisma.charge.update({
          where: { id: charge.id },
          data: { status: 'ACTIVE', failureReason: `Operator rejected stop: ${response.result}` },
        });
      }
    } catch (err) {
      this.logger.error('STOP_SESSION failed', err);
      return this.prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'ACTIVE', failureReason: 'Operator unreachable' },
      });
    }
    return updated;
  }

  async get(device: Device, chargeId: string): Promise<Charge> {
    const charge = await this.prisma.charge.findFirst({
      where: { id: chargeId, deviceId: device.id },
    });
    if (!charge) throw new NotFoundException();
    return charge;
  }

  current(device: Device): Promise<Charge | null> {
    return this.prisma.charge.findFirst({
      where: { deviceId: device.id, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async onCommandResult(command: CommandType, uid: string, result: CommandResult) {
    if (result.result === 'ACCEPTED') return;
    const charge = await this.prisma.charge.findUnique({ where: { id: uid } });
    if (!charge) return;
    const reason = `${command} ${result.result}`;
    if (command === 'START_SESSION' && charge.status === 'STARTING') {
      await this.fail(charge.id, reason);
    } else if (command === 'STOP_SESSION' && charge.status === 'STOPPING') {
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'ACTIVE', failureReason: reason },
      });
    }
  }

  private async onSession(party: OcpiParty, session: Session) {
    const charge = await this.findForSession(party, session.id, session.authorization_reference);
    if (!charge || charge.status === 'COMPLETED' || charge.status === 'FAILED') return;

    let status: ChargeStatus = charge.status;
    if (session.status === 'ACTIVE' && charge.status === 'STARTING') status = 'ACTIVE';
    // A completed session still waits for its CDR before the charge is final.
    if (session.status === 'COMPLETED') status = 'STOPPING';
    if (session.status === 'INVALID') status = 'FAILED';

    await this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        sessionId: session.id,
        kwh: session.kwh,
        status,
        ...(session.total_cost
          ? {
              totalCostExclVat: session.total_cost.excl_vat,
              totalCostInclVat: session.total_cost.incl_vat ?? null,
              currency: session.currency,
            }
          : {}),
      },
    });
  }

  private async onCdr(party: OcpiParty, cdr: CDR) {
    const charge = await this.findForSession(party, cdr.session_id, cdr.authorization_reference);
    if (!charge) return;
    await this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: 'COMPLETED',
        cdrId: cdr.id,
        kwh: cdr.total_energy,
        totalCostExclVat: cdr.total_cost.excl_vat,
        totalCostInclVat: cdr.total_cost.incl_vat ?? null,
        currency: cdr.currency,
      },
    });
  }

  /** Matches CPO objects to our charge: authorization_reference is our charge id. */
  private async findForSession(party: OcpiParty, sessionId?: string, authRef?: string) {
    if (authRef) {
      const byRef = await this.prisma.charge.findFirst({
        where: { id: authRef, partyRef: party.id },
      });
      if (byRef) return byRef;
    }
    if (sessionId) {
      return this.prisma.charge.findFirst({ where: { sessionId, partyRef: party.id } });
    }
    return null;
  }

  private fail(chargeId: string, reason: string) {
    return this.prisma.charge.update({
      where: { id: chargeId },
      data: { status: 'FAILED', failureReason: reason },
    });
  }
}
