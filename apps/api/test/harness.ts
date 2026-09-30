import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createMockCpo, MockCpoConfig } from '@super-cables/mock-cpo';
import { createServer } from 'node:net';
import { AppModule } from '../src/app.module';
import { AppConfig } from '../src/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE_URL } from './global-setup';

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export interface Harness {
  api: INestApplication;
  cpo: INestApplication;
  apiUrl: string;
  cpoUrl: string;
  config: AppConfig;
  cpoConfig: MockCpoConfig;
  prisma: PrismaService;
  close(): Promise<void>;
}

/** Boots the API and the mock CPO on real ports so OCPI traffic goes over HTTP. */
export async function startHarness(): Promise<Harness> {
  const [apiPort, cpoPort] = [await freePort(), await freePort()];
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const cpoUrl = `http://127.0.0.1:${cpoPort}`;

  const config: AppConfig = {
    DATABASE_URL: TEST_DATABASE_URL,
    PORT: apiPort,
    PUBLIC_URL: apiUrl,
    OCPI_COUNTRY_CODE: 'NO',
    OCPI_PARTY_ID: 'SCB',
    ADMIN_API_KEY: 'test-admin-key-123',
    DEVICE_JWT_SECRET: 'test-device-jwt-secret-123',
  };
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  const cpoConfig: MockCpoConfig = {
    port: cpoPort,
    publicUrl: cpoUrl,
    tokenA: 'test-token-a',
    countryCode: 'NO',
    partyId: 'MCK',
    tickMs: 50,
    powerKw: 50,
    speedup: 600,
    pricePerKwhExclVat: 4,
    vatRate: 0.25,
    currency: 'NOK',
  };

  const api = await NestFactory.create(AppModule.forRoot(config), { logger: false });
  const prisma = api.get(PrismaService);
  await resetDatabase(prisma);
  await api.listen(apiPort, '127.0.0.1');

  const cpo = await createMockCpo(cpoConfig, { logger: false });
  await cpo.listen(cpoPort, '127.0.0.1');

  return {
    api,
    cpo,
    apiUrl,
    cpoUrl,
    config,
    cpoConfig,
    prisma,
    async close() {
      await cpo.close();
      await api.close();
    },
  };
}

async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Charge", "Device", "Token", "Cdr", "OcpiSession", "Location", "OcpiParty" CASCADE',
  );
}

export async function waitFor<T>(
  fn: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await fn();
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, 50));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting; last value: ${JSON.stringify(last)}`);
}
