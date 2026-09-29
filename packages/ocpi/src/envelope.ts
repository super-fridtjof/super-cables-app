/** OCPI response envelope and status codes (OCPI 2.2.1, part "Transport and format"). */

export const OcpiStatus = {
  SUCCESS: 1000,
  CLIENT_ERROR: 2000,
  INVALID_PARAMETERS: 2001,
  NOT_ENOUGH_INFORMATION: 2002,
  UNKNOWN_LOCATION: 2003,
  UNKNOWN_TOKEN: 2004,
  SERVER_ERROR: 3000,
  UNABLE_TO_USE_CLIENT_API: 3001,
  UNSUPPORTED_VERSION: 3002,
  NO_MATCHING_ENDPOINTS: 3003,
} as const;

export interface OcpiResponse<T> {
  data?: T;
  status_code: number;
  status_message?: string;
  timestamp: string;
}

export function ocpiSuccess<T>(data?: T): OcpiResponse<T> {
  return {
    ...(data === undefined ? {} : { data }),
    status_code: OcpiStatus.SUCCESS,
    timestamp: new Date().toISOString(),
  };
}

export function ocpiError(statusCode: number, message: string): OcpiResponse<never> {
  return { status_code: statusCode, status_message: message, timestamp: new Date().toISOString() };
}
