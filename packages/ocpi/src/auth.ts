/**
 * OCPI 2.2 sends credentials tokens base64-encoded: `Authorization: Token <base64(token)>`.
 * Older (2.1.1) peers send the raw token, so decoding falls back to the raw value when the
 * header is not valid base64 of printable ASCII.
 */

export function encodeTokenHeader(token: string): string {
  return `Token ${Buffer.from(token, 'utf8').toString('base64')}`;
}

export function decodeTokenHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Token\s+(\S+)$/i.exec(header.trim());
  if (!match) return undefined;
  const raw = match[1];
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && raw.length % 4 === 0) {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (/^[\x21-\x7e]+$/.test(decoded) && Buffer.from(decoded, 'utf8').toString('base64') === raw) {
      return decoded;
    }
  }
  return raw;
}
