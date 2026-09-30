import { parseNextLink } from './client';
import { decodeTokenHeader, encodeTokenHeader } from './auth';

describe('OCPI token header', () => {
  it('round-trips a token through base64', () => {
    expect(decodeTokenHeader(encodeTokenHeader('ebd3a3f1-token'))).toBe('ebd3a3f1-token');
  });

  it('accepts a raw 2.1.1-style token', () => {
    expect(decodeTokenHeader('Token my-raw-token')).toBe('my-raw-token');
  });

  it('rejects missing or malformed headers', () => {
    expect(decodeTokenHeader(undefined)).toBeUndefined();
    expect(decodeTokenHeader('Bearer abc')).toBeUndefined();
  });
});

describe('parseNextLink', () => {
  it('extracts the next page url', () => {
    expect(parseNextLink('<https://x.test/locations?offset=10&limit=10>; rel="next"')).toBe(
      'https://x.test/locations?offset=10&limit=10',
    );
    expect(parseNextLink(null)).toBeUndefined();
  });
});
