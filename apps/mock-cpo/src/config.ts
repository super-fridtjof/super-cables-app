export interface MockCpoConfig {
  port: number;
  /** Base URL the eMSP uses to reach this mock. */
  publicUrl: string;
  /** Token A handed to the eMSP out of band to start the credentials handshake. */
  tokenA: string;
  countryCode: string;
  partyId: string;
  /** How often a running session reports progress. */
  tickMs: number;
  /** Simulated charging power. */
  powerKw: number;
  /** Multiplies simulated time, so tests and demos do not wait for real kWh. */
  speedup: number;
  pricePerKwhExclVat: number;
  vatRate: number;
  currency: string;
}

export function mockCpoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MockCpoConfig {
  const port = Number(env.PORT ?? 3100);
  return {
    port,
    publicUrl: env.PUBLIC_URL ?? `http://localhost:${port}`,
    tokenA: env.TOKEN_A ?? 'mock-cpo-token-a',
    countryCode: env.COUNTRY_CODE ?? 'NO',
    partyId: env.PARTY_ID ?? 'MCK',
    tickMs: Number(env.TICK_MS ?? 2000),
    powerKw: Number(env.POWER_KW ?? 50),
    speedup: Number(env.SPEEDUP ?? 1),
    pricePerKwhExclVat: Number(env.PRICE_PER_KWH ?? 3.6),
    vatRate: Number(env.VAT_RATE ?? 0.25),
    currency: env.CURRENCY ?? 'NOK',
  };
}
