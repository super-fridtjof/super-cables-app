import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(3000),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  OCPI_COUNTRY_CODE: z.string().length(2).default('NO'),
  OCPI_PARTY_ID: z.string().length(3).default('SCB'),
  ADMIN_API_KEY: z.string().min(12),
  DEVICE_JWT_SECRET: z.string().min(16),
});

export type AppConfig = z.infer<typeof schema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return parsed.data;
}
