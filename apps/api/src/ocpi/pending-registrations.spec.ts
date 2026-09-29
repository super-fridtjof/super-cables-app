import { PendingRegistrations } from './pending-registrations';

describe('PendingRegistrations', () => {
  afterEach(() => jest.useRealTimers());

  it('accepts a pending token until it expires', () => {
    jest.useFakeTimers();
    const pending = new PendingRegistrations();
    pending.add('hash');
    expect(pending.has('hash')).toBe(true);
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(pending.has('hash')).toBe(false);
  });

  it('forgets removed tokens', () => {
    const pending = new PendingRegistrations();
    pending.add('hash');
    pending.remove('hash');
    expect(pending.has('hash')).toBe(false);
  });
});
