import { Inject, Injectable } from '@nestjs/common';
import { Endpoint, OCPI_VERSION } from '@super-cables/ocpi';
import { APP_CONFIG, AppConfig } from '../config';

export const OCPI_BASE = 'ocpi/emsp';
export const OCPI_VERSION_BASE = `${OCPI_BASE}/${OCPI_VERSION}`;

@Injectable()
export class OcpiUrls {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get versions() {
    return `${this.config.PUBLIC_URL}/${OCPI_BASE}/versions`;
  }

  get versionDetails() {
    return `${this.config.PUBLIC_URL}/${OCPI_VERSION_BASE}`;
  }

  module(path: string) {
    return `${this.versionDetails}/${path}`;
  }

  /** Endpoints we expose to CPOs as an eMSP. */
  endpoints(): Endpoint[] {
    return [
      { identifier: 'credentials', role: 'RECEIVER', url: this.module('credentials') },
      { identifier: 'locations', role: 'RECEIVER', url: this.module('locations') },
      { identifier: 'sessions', role: 'RECEIVER', url: this.module('sessions') },
      { identifier: 'cdrs', role: 'RECEIVER', url: this.module('cdrs') },
      { identifier: 'tokens', role: 'SENDER', url: this.module('tokens') },
      { identifier: 'commands', role: 'SENDER', url: this.module('commands') },
    ];
  }
}
