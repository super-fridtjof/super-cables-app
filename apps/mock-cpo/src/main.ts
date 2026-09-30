import { createMockCpo } from './app';
import { mockCpoConfigFromEnv } from './config';

async function main() {
  const config = mockCpoConfigFromEnv();
  const app = await createMockCpo(config);
  await app.listen(config.port);
  console.log(`Mock CPO listening on ${config.publicUrl}`);
  console.log(
    `Register from the API with versionsUrl=${config.publicUrl}/ocpi/cpo/versions tokenA=${config.tokenA}`,
  );
}

void main();
