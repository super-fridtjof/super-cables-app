import { MockCpoState } from '@super-cables/mock-cpo';
import { encodeTokenHeader } from '@super-cables/ocpi';
import { Harness, startHarness, waitFor } from './harness';

jest.setTimeout(30_000);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response | Promise<Response>): Promise<any> => (await res).json();

describe('charging journey against the mock CPO', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  const admin = (path: string, body?: unknown) =>
    fetch(`${h.apiUrl}/admin/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'x-admin-key': h.config.ADMIN_API_KEY, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let partyRef: string;
  let deviceToken: string;

  const device = (path: string, method = 'GET') =>
    fetch(`${h.apiUrl}/device/v1/${path}`, {
      method,
      headers: { authorization: `Bearer ${deviceToken}` },
    });

  it('rejects admin calls without the key', async () => {
    const res = await fetch(`${h.apiUrl}/admin/ocpi/parties`);
    expect(res.status).toBe(401);
  });

  it('registers with the CPO via the credentials handshake and imports locations', async () => {
    const res = await admin('ocpi/parties', {
      versionsUrl: `${h.cpoUrl}/ocpi/cpo/versions`,
      tokenA: h.cpoConfig.tokenA,
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.party).toMatchObject({ countryCode: 'NO', partyId: 'MCK', status: 'CONNECTED' });
    // Mock pages locations one at a time, so this also proves pagination is followed.
    expect(body.locationsImported).toBe(2);
    partyRef = body.party.id;
  });

  it('rejects OCPI calls with an unknown token', async () => {
    const res = await fetch(`${h.apiUrl}/ocpi/emsp/2.2.1/tokens`, {
      headers: { authorization: encodeTokenHeader('not-a-real-token') },
    });
    expect(res.status).toBe(401);
    expect((await json(res)).status_code).toBe(2000);
  });

  it('provisions a device and exchanges its secret for an access token', async () => {
    const res = await admin('devices', {
      name: 'Handle #1',
      partyRef,
      locationId: 'LOC-OSLO-1',
      evseUid: 'EVSE-OSLO-1-1',
      connectorId: '1',
    });
    expect(res.status).toBe(201);
    const { id, secret } = await json(res);

    const bad = await fetch(`${h.apiUrl}/device/v1/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: id, secret: 'wrong' }),
    });
    expect(bad.status).toBe(401);

    const ok = await fetch(`${h.apiUrl}/device/v1/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: id, secret }),
    });
    expect(ok.status).toBe(200);
    deviceToken = (await json(ok)).accessToken;

    const me = await json(device('me'));
    expect(me.evse).toMatchObject({ uid: 'EVSE-OSLO-1-1', status: 'AVAILABLE' });
    expect(me.connector).toMatchObject({ standard: 'IEC_62196_T2_COMBO', powerType: 'DC' });
  });

  it('starts a charge, streams energy, stops, and settles from the CDR', async () => {
    const started = await device('charges', 'POST');
    expect(started.status).toBe(201);
    const { id } = await json(started);

    const active = await waitFor(
      async () => json(device(`charges/${id}`)),
      (c) => c.status === 'ACTIVE' && c.kwh > 0,
    );
    expect(active.sessionId).toBeTruthy();

    const me = await json(device('me'));
    expect(me.evse.status).toBe('CHARGING');
    expect(me.currentCharge.id).toBe(id);

    const second = await device('charges', 'POST');
    expect(second.status).toBe(409);

    const stopped = await device(`charges/${id}/stop`, 'POST');
    expect(stopped.status).toBe(200);

    const done = await waitFor(
      async () => json(device(`charges/${id}`)),
      (c) => c.status === 'COMPLETED',
    );
    expect(done.kwh).toBeGreaterThan(0);
    expect(done.totalCost.currency).toBe('NOK');
    expect(done.totalCost.exclVat).toBeCloseTo(done.kwh * 4, 1);

    const cdr = await h.prisma.cdr.findFirst({ where: { sessionId: done.sessionId } });
    expect(cdr?.totalEnergy).toBe(done.kwh);

    const after = await json(device('me'));
    expect(after.evse.status).toBe('AVAILABLE');
    expect(after.currentCharge).toBeNull();
  });

  it('lets the CPO list and authorize the tokens we issued', async () => {
    const [emsp] = h.cpo.get(MockCpoState).registeredEmsps();
    const auth = { authorization: encodeTokenHeader(emsp.token) };

    const list = await fetch(`${h.apiUrl}/ocpi/emsp/2.2.1/tokens?limit=10`, { headers: auth });
    expect(list.status).toBe(200);
    expect(list.headers.get('x-total-count')).toBe('1');
    const [token] = (await json(list)).data;
    expect(token).toMatchObject({ type: 'AD_HOC_USER', party_id: 'SCB', valid: true });

    const authorized = await fetch(`${h.apiUrl}/ocpi/emsp/2.2.1/tokens/${token.uid}/authorize`, {
      method: 'POST',
      headers: auth,
    });
    expect((await json(authorized)).data.allowed).toBe('ALLOWED');

    const unknown = await fetch(`${h.apiUrl}/ocpi/emsp/2.2.1/tokens/NOPE/authorize`, {
      method: 'POST',
      headers: auth,
    });
    expect(unknown.status).toBe(404);
    expect((await json(unknown)).status_code).toBe(2004);
  });

  it("stops a CPO from writing another party's objects", async () => {
    const [emsp] = h.cpo.get(MockCpoState).registeredEmsps();
    const res = await fetch(`${h.apiUrl}/ocpi/emsp/2.2.1/sessions/DE/XYZ/abc`, {
      method: 'PATCH',
      headers: { authorization: encodeTokenHeader(emsp.token), 'content-type': 'application/json' },
      body: JSON.stringify({ kwh: 1 }),
    });
    expect(res.status).toBe(403);
  });
});
