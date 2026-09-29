import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { OCPI_VERSION, ocpiSuccess, Version, VersionDetails } from '@super-cables/ocpi';
import { AllowPendingRegistration, OcpiAuthGuard } from './ocpi-auth.guard';
import { OcpiExceptionFilter } from './ocpi.errors';
import { OCPI_BASE, OcpiUrls } from './ocpi-urls';

@Controller(OCPI_BASE)
@UseGuards(OcpiAuthGuard)
@UseFilters(OcpiExceptionFilter)
@AllowPendingRegistration()
export class VersionsController {
  constructor(private readonly urls: OcpiUrls) {}

  @Get('versions')
  versions() {
    return ocpiSuccess<Version[]>([{ version: OCPI_VERSION, url: this.urls.versionDetails }]);
  }

  @Get(OCPI_VERSION)
  details() {
    return ocpiSuccess<VersionDetails>({ version: OCPI_VERSION, endpoints: this.urls.endpoints() });
  }
}
