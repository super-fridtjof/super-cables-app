import { Module } from '@nestjs/common';
import { CdrsController } from './cdrs.controller';
import { CommandsController } from './commands.controller';
import { CommandsService } from './commands.service';
import { CredentialsController } from './credentials.controller';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiEvents } from './ocpi-events';
import { OcpiUrls } from './ocpi-urls';
import { PendingRegistrations } from './pending-registrations';
import { RegistrationService } from './registration.service';
import { SessionsController } from './sessions.controller';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { VersionsController } from './versions.controller';

@Module({
  controllers: [
    VersionsController,
    CredentialsController,
    LocationsController,
    SessionsController,
    CdrsController,
    TokensController,
    CommandsController,
  ],
  providers: [
    OcpiAuthGuard,
    OcpiEvents,
    OcpiUrls,
    PendingRegistrations,
    RegistrationService,
    LocationsService,
    TokensService,
    CommandsService,
  ],
  exports: [OcpiEvents, RegistrationService, LocationsService, TokensService, CommandsService],
})
export class OcpiModule {}
