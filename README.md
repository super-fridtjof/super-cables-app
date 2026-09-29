# Super Cables

Super Cables is an all-in-one charging connector: a CCS handle with a touchscreen that runs the
driver's whole journey, from plug-in to payment and receipt. In OCPI terms we are the **eMSP**,
the driver-facing party. The charger itself belongs to a charge point operator (**CPO**) that we
talk to over **OCPI 2.2.1**.

This repository is the prototype monorepo.

| Path            | What it is                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| `apps/api`      | NestJS backend: OCPI 2.2.1 eMSP interfaces, device API, admin API. PostgreSQL via Prisma. |
| `apps/mock-cpo` | A fake CPO with simulated chargers, for local development and tests.                      |
| `packages/ocpi` | OCPI 2.2.1 types and protocol helpers shared by both apps.                                |

Coming next: `apps/device` (Expo app for the handle's Android screen), Stripe Terminal tap-to-pay,
and driver accounts with Better Auth.

## How a charge works

```
Handle (device app)          Super Cables API (eMSP)                 CPO (mock-cpo)
  POST /device/v1/charges ──▶ issue AD_HOC_USER token
                              POST commands/START_SESSION ──────────▶ ACCEPTED
                              ◀── POST CommandResult (ACCEPTED) ─────
                              ◀── PATCH locations/.../EVSE CHARGING ──
                              ◀── PUT sessions/... ACTIVE ────────────
  GET /device/v1/charges/:id  ◀── PATCH sessions/... kwh, cost (every tick)
  POST .../stop ────────────▶ POST commands/STOP_SESSION ───────────▶ ACCEPTED
                              ◀── PUT sessions/... COMPLETED ─────────
                              ◀── POST cdrs (final energy and cost) ──
  charge COMPLETED, receipt
```

We match the CPO's session and CDR to our charge through `authorization_reference`, which we set
to our charge id in `START_SESSION`.

## Security model

- **OCPI peers** authenticate with credentials tokens (`Authorization: Token <base64>`). We run
  the credentials handshake as the initiating party. We store the hash of the token a CPO uses to
  call us, and the token we use to call them. A CPO can only write objects under its own
  `country_code`/`party_id`.
- **Devices** are provisioned by an admin and bound to one EVSE connector. A device trades its
  one-time secret (stored hashed) for a 15-minute HS256 access token.
- **Admin endpoints** take a shared `X-Admin-Key` until staff login exists.

## Running it locally

Requirements: Node 22, pnpm 10, Docker (or a local PostgreSQL 16).

```sh
pnpm install
pnpm db:up                                  # PostgreSQL in Docker
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm build
pnpm dev                                    # API on :3000, mock CPO on :3100
```

Connect the API to the mock CPO, then provision a device:

```sh
curl -X POST localhost:3000/admin/ocpi/parties \
  -H 'x-admin-key: change-me-admin' -H 'content-type: application/json' \
  -d '{"versionsUrl":"http://localhost:3100/ocpi/cpo/versions","tokenA":"mock-cpo-token-a"}'
# => { "party": { "id": "<partyRef>", ... }, "locationsImported": 2 }

curl -X POST localhost:3000/admin/devices \
  -H 'x-admin-key: change-me-admin' -H 'content-type: application/json' \
  -d '{"name":"Handle #1","partyRef":"<partyRef>","locationId":"LOC-OSLO-1","evseUid":"EVSE-OSLO-1-1","connectorId":"1"}'
# => { "id": "<deviceId>", "secret": "<shown once>" }
```

Then act as the handle:

```sh
TOKEN=$(curl -s -X POST localhost:3000/device/v1/auth/token -H 'content-type: application/json' \
  -d '{"deviceId":"<deviceId>","secret":"<secret>"}' | jq -r .accessToken)
curl -X POST localhost:3000/device/v1/charges -H "authorization: Bearer $TOKEN"
curl localhost:3000/device/v1/me -H "authorization: Bearer $TOKEN"
curl -X POST localhost:3000/device/v1/charges/<chargeId>/stop -H "authorization: Bearer $TOKEN"
```

The mock CPO charges at `POWER_KW` (default 50) and reports every `TICK_MS`. Set `SPEEDUP=60`
to make a minute of charging pass every second.

## Tests

```sh
pnpm test        # unit tests
pnpm test:e2e    # boots the API and the mock CPO, runs a full charge over real HTTP
```

The end-to-end suite needs PostgreSQL. It uses `TEST_DATABASE_URL`, which defaults to
`postgresql://supercables:supercables@localhost:5432/supercables_test`, and truncates it on start.

## Known gaps in this prototype

- Only eMSP-initiated registration is supported. Credentials rotation (`PUT /credentials`) is not
  supported yet.
- Tariffs are not modelled yet. Cost comes from the CPO's session and CDR.
- OCPI events are handled in-process. BullMQ and Redis come in when pushes need retries.
- The token we use to call a CPO is stored in plain text and needs encryption at rest before
  production.
