import { loadConfig } from './config';

describe('loadConfig', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    ADMIN_API_KEY: 'admin-key-12345',
    DEVICE_JWT_SECRET: 'device-secret-123456',
  };

  it('applies defaults', () => {
    expect(loadConfig(base)).toMatchObject({
      PORT: 3000,
      OCPI_COUNTRY_CODE: 'NO',
      OCPI_PARTY_ID: 'SCB',
    });
  });

  it('refuses weak secrets', () => {
    expect(() => loadConfig({ ...base, ADMIN_API_KEY: 'short' })).toThrow(/ADMIN_API_KEY/);
  });
});
