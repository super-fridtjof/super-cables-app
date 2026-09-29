import { Injectable } from '@nestjs/common';

const TTL_MS = 5 * 60 * 1000;

/**
 * Token B hashes handed out during an in-flight credentials exchange. The CPO uses token B to
 * discover our versions before the exchange returns. In-memory is fine while the API runs as a
 * single instance; move to Postgres or Redis before scaling out.
 */
@Injectable()
export class PendingRegistrations {
  private readonly tokens = new Map<string, number>();

  add(tokenHash: string) {
    this.tokens.set(tokenHash, Date.now() + TTL_MS);
  }

  has(tokenHash: string): boolean {
    const expires = this.tokens.get(tokenHash);
    if (expires === undefined) return false;
    if (expires < Date.now()) {
      this.tokens.delete(tokenHash);
      return false;
    }
    return true;
  }

  remove(tokenHash: string) {
    this.tokens.delete(tokenHash);
  }
}
