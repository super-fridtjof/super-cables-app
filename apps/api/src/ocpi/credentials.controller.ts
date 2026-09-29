import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { OcpiParty } from '@prisma/client';
import { decodeTokenHeader, OcpiStatus, ocpiSuccess } from '@super-cables/ocpi';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentParty, OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiException, OcpiExceptionFilter } from './ocpi.errors';
import { OCPI_VERSION_BASE } from './ocpi-urls';
import { RegistrationService } from './registration.service';

@Controller(`${OCPI_VERSION_BASE}/credentials`)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
export class CredentialsController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  get(@CurrentParty() _party: OcpiParty, @Headers('authorization') auth: string) {
    // We only keep a hash of the token the party uses, which is the one it just presented.
    return ocpiSuccess(this.registration.ourCredentials(decodeTokenHeader(auth)!));
  }

  @Post()
  register() {
    throw new OcpiException(
      OcpiStatus.CLIENT_ERROR,
      'Registration is initiated by Super Cables; ask us for a connection instead',
      HttpStatus.METHOD_NOT_ALLOWED,
    );
  }

  @Put()
  update() {
    throw new OcpiException(
      OcpiStatus.CLIENT_ERROR,
      'Credentials rotation is not supported yet',
      HttpStatus.METHOD_NOT_ALLOWED,
    );
  }

  @Delete()
  async unregister(@CurrentParty() party: OcpiParty) {
    await this.prisma.ocpiParty.update({ where: { id: party.id }, data: { status: 'SUSPENDED' } });
    return ocpiSuccess();
  }
}
