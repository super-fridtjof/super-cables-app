import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { MockCpoConfig } from './config';
import {
  CommandsController,
  CredentialsController,
  DebugController,
  LocationsController,
  VersionsController,
} from './controllers';
import { MOCK_CONFIG } from './di';
import { MockCpoState } from './state';

/** Builds the mock CPO. Used by main.ts and by the API's end-to-end tests. */
export async function createMockCpo(
  config: MockCpoConfig,
  options: { logger?: false } = {},
): Promise<INestApplication> {
  @Module({
    controllers: [
      VersionsController,
      CredentialsController,
      LocationsController,
      CommandsController,
      DebugController,
    ],
    providers: [{ provide: MOCK_CONFIG, useValue: config }, MockCpoState],
  })
  class MockCpoModule {}

  const app = await NestFactory.create(MockCpoModule, options);
  app.enableShutdownHooks();
  return app;
}
