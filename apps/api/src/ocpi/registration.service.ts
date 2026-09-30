import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Credentials,
  findEndpoint,
  OCPI_VERSION,
  ocpiRequest,
  Version,
  VersionDetails,
} from '@super-cables/ocpi';
import { APP_CONFIG, AppConfig } from '../config';
import { randomToken, sha256 } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OcpiUrls } from './ocpi-urls';
import { PendingRegistrations } from './pending-registrations';

/**
 * Runs the OCPI credentials handshake with a CPO, with us as the initiating party:
 *
 *   1. discover the CPO's 2.2.1 endpoints using token A (handed to us out of band)
 *   2. POST our credentials, containing a fresh token B, to the CPO
 *   3. the CPO discovers our endpoints using token B, then answers with token C
 *   4. we store token C (to call them) and the hash of token B (to authenticate them)
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly urls: OcpiUrls,
    private readonly pending: PendingRegistrations,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  ourCredentials(token: string): Credentials {
    return {
      token,
      url: this.urls.versions,
      roles: [
        {
          role: 'EMSP',
          country_code: this.config.OCPI_COUNTRY_CODE,
          party_id: this.config.OCPI_PARTY_ID,
          business_details: { name: 'Super Cables' },
        },
      ],
    };
  }

  async register(versionsUrl: string, tokenA: string) {
    const details = await this.discover(versionsUrl, tokenA);
    const credentialsUrl =
      findEndpoint(details.endpoints, 'credentials', 'RECEIVER') ??
      findEndpoint(details.endpoints, 'credentials', 'SENDER');
    if (!credentialsUrl) throw new Error('CPO does not expose a credentials endpoint');

    const tokenB = randomToken();
    const tokenBHash = sha256(tokenB);
    this.pending.add(tokenBHash);
    try {
      const theirs = await ocpiRequest<Credentials>(credentialsUrl, {
        method: 'POST',
        token: tokenA,
        body: this.ourCredentials(tokenB),
      });
      const cpoRole = theirs.roles.find((r) => r.role === 'CPO');
      if (!cpoRole) throw new Error('Peer did not present a CPO role');

      // Re-discover with token C: token A is single-use and endpoints may differ per token.
      const finalDetails = await this.discover(theirs.url, theirs.token);
      const party = await this.prisma.ocpiParty.upsert({
        where: {
          countryCode_partyId: { countryCode: cpoRole.country_code, partyId: cpoRole.party_id },
        },
        create: {
          countryCode: cpoRole.country_code,
          partyId: cpoRole.party_id,
          role: 'CPO',
          name: cpoRole.business_details.name,
          versionsUrl: theirs.url,
          endpoints: finalDetails.endpoints as object[],
          outgoingToken: theirs.token,
          incomingTokenHash: tokenBHash,
        },
        update: {
          name: cpoRole.business_details.name,
          versionsUrl: theirs.url,
          endpoints: finalDetails.endpoints as object[],
          outgoingToken: theirs.token,
          incomingTokenHash: tokenBHash,
          status: 'CONNECTED',
        },
      });
      this.logger.log(`Registered with CPO ${party.countryCode}*${party.partyId} (${party.name})`);
      return party;
    } finally {
      this.pending.remove(tokenBHash);
    }
  }

  private async discover(versionsUrl: string, token: string): Promise<VersionDetails> {
    const versions = await ocpiRequest<Version[]>(versionsUrl, { token });
    const match = versions.find((v) => v.version === OCPI_VERSION);
    if (!match) throw new Error(`Peer does not support OCPI ${OCPI_VERSION}`);
    return ocpiRequest<VersionDetails>(match.url, { token });
  }
}
