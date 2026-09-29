import { Inject, Injectable } from '@nestjs/common';
import type { Token as TokenRow } from '@prisma/client';
import { Token, TokenType, WhitelistType } from '@super-cables/ocpi';
import { randomBytes } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

/** Tokens Super Cables issues to identify a driver (or an ad-hoc payer) to CPOs. */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** One-off token for a tap-to-pay charge: the card payment is the authorization. */
  async issueAdHoc(): Promise<TokenRow> {
    const uid = randomBytes(8).toString('hex').toUpperCase();
    // eMA-ID style contract id: <country><party>C<id>
    const contractId = `${this.config.OCPI_COUNTRY_CODE}-${this.config.OCPI_PARTY_ID}-C${uid}`;
    return this.prisma.token.create({
      data: { uid, type: 'AD_HOC_USER', contractId, whitelist: 'NEVER' },
    });
  }

  toOcpi(row: TokenRow): Token {
    return {
      country_code: this.config.OCPI_COUNTRY_CODE,
      party_id: this.config.OCPI_PARTY_ID,
      uid: row.uid,
      type: row.type as TokenType,
      contract_id: row.contractId,
      issuer: 'Super Cables',
      valid: row.valid,
      whitelist: row.whitelist as WhitelistType,
      last_updated: row.lastUpdated.toISOString(),
    };
  }
}
