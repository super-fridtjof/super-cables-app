import { encodeTokenHeader } from './auth';
import { OcpiResponse, OcpiStatus } from './envelope';

export class OcpiClientError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly ocpiStatus?: number,
  ) {
    super(message);
  }
}

export interface OcpiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Credentials token used to call the peer (sent base64-encoded). */
  token: string;
}

export interface OcpiResult<T> {
  data: T;
  headers: Headers;
}

/** Minimal OCPI HTTP client: sends the auth header, unwraps the envelope, throws on errors. */
export async function ocpiFetch<T>(url: string, opts: OcpiRequestOptions): Promise<OcpiResult<T>> {
  const method = opts.method ?? 'GET';
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: encodeTokenHeader(opts.token),
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
      'X-Correlation-ID': crypto.randomUUID(),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let payload: OcpiResponse<T> | undefined;
  try {
    payload = (await res.json()) as OcpiResponse<T>;
  } catch {
    payload = undefined;
  }
  if (!res.ok || !payload || payload.status_code !== OcpiStatus.SUCCESS) {
    throw new OcpiClientError(
      `OCPI ${method} ${url} failed: HTTP ${res.status}` +
        (payload ? ` / ${payload.status_code} ${payload.status_message ?? ''}` : ''),
      res.status,
      payload?.status_code,
    );
  }
  return { data: payload.data as T, headers: res.headers };
}

export async function ocpiRequest<T>(url: string, opts: OcpiRequestOptions): Promise<T> {
  return (await ocpiFetch<T>(url, opts)).data;
}

/** Follows OCPI pagination (`Link: <url>; rel="next"`) and returns every item. */
export async function ocpiFetchAll<T>(url: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = url;
  while (next) {
    const { data, headers } = await ocpiFetch<T[]>(next, { token });
    items.push(...(data ?? []));
    next = parseNextLink(headers.get('link'));
  }
  return items;
}

export function parseNextLink(link: string | null): string | undefined {
  if (!link) return undefined;
  const match = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(link);
  return match?.[1];
}

/** Finds a module endpoint for a given interface role in a party's endpoint list. */
export function findEndpoint(
  endpoints: { identifier: string; role: string; url: string }[],
  identifier: string,
  role: 'SENDER' | 'RECEIVER',
): string | undefined {
  return endpoints.find((e) => e.identifier === identifier && e.role === role)?.url;
}
