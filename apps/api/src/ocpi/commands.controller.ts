import { Body, Controller, Param, Post, UseFilters, UseGuards } from '@nestjs/common';
import { CommandResult, CommandType, ocpiSuccess } from '@super-cables/ocpi';
import { OcpiAuthGuard } from './ocpi-auth.guard';
import { invalidParams, OcpiExceptionFilter } from './ocpi.errors';
import { OcpiEvents } from './ocpi-events';
import { OCPI_VERSION_BASE } from './ocpi-urls';

const COMMANDS: CommandType[] = [
  'CANCEL_RESERVATION',
  'RESERVE_NOW',
  'START_SESSION',
  'STOP_SESSION',
  'UNLOCK_CONNECTOR',
];

/** Commands sender interface: receives the asynchronous CommandResult for commands we sent. */
@Controller(`${OCPI_VERSION_BASE}/commands`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class CommandsController {
  constructor(private readonly events: OcpiEvents) {}

  @Post(':command/:uid')
  result(
    @Param('command') command: string,
    @Param('uid') uid: string,
    @Body() result: CommandResult,
  ) {
    if (!COMMANDS.includes(command as CommandType))
      throw invalidParams(`Unknown command ${command}`);
    this.events.emit({ type: 'commandResult', command: command as CommandType, uid, result });
    return ocpiSuccess();
  }
}
