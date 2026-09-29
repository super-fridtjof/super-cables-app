/**
 * OCPI 2.2.1 object model (subset used by Super Cables).
 * Field names follow the spec exactly so payloads can be passed through unchanged.
 * https://github.com/ocpi/ocpi/tree/2.2.1
 */

export const OCPI_VERSION = '2.2.1' as const;

export type Role = 'CPO' | 'EMSP' | 'HUB' | 'NAP' | 'NSP' | 'OTHER' | 'SCSP';
export type InterfaceRole = 'SENDER' | 'RECEIVER';

export type ModuleID =
  | 'cdrs'
  | 'chargingprofiles'
  | 'commands'
  | 'credentials'
  | 'hubclientinfo'
  | 'locations'
  | 'sessions'
  | 'tariffs'
  | 'tokens';

export interface Version {
  version: string;
  url: string;
}

export interface Endpoint {
  identifier: ModuleID;
  role: InterfaceRole;
  url: string;
}

export interface VersionDetails {
  version: string;
  endpoints: Endpoint[];
}

export interface BusinessDetails {
  name: string;
  website?: string;
}

export interface CredentialsRole {
  role: Role;
  business_details: BusinessDetails;
  party_id: string;
  country_code: string;
}

export interface Credentials {
  token: string;
  url: string;
  roles: CredentialsRole[];
}

// --- Locations ---------------------------------------------------------------

export type Status =
  | 'AVAILABLE'
  | 'BLOCKED'
  | 'CHARGING'
  | 'INOPERATIVE'
  | 'OUTOFORDER'
  | 'PLANNED'
  | 'REMOVED'
  | 'RESERVED'
  | 'UNKNOWN';

export type ConnectorType =
  'IEC_62196_T2' | 'IEC_62196_T2_COMBO' | 'CHADEMO' | 'IEC_62196_T1' | 'IEC_62196_T1_COMBO';

export type PowerType = 'AC_1_PHASE' | 'AC_2_PHASE' | 'AC_3_PHASE' | 'DC';

export interface GeoLocation {
  latitude: string;
  longitude: string;
}

export interface Connector {
  id: string;
  standard: ConnectorType;
  format: 'SOCKET' | 'CABLE';
  power_type: PowerType;
  max_voltage: number;
  max_amperage: number;
  max_electric_power?: number;
  tariff_ids?: string[];
  last_updated: string;
}

export type Capability =
  | 'CHARGING_PROFILE_CAPABLE'
  | 'CREDIT_CARD_PAYABLE'
  | 'DEBIT_CARD_PAYABLE'
  | 'REMOTE_START_STOP_CAPABLE'
  | 'RESERVABLE'
  | 'RFID_READER'
  | 'CONTACTLESS_CARD_SUPPORT'
  | 'UNLOCK_CAPABLE';

export interface EVSE {
  uid: string;
  evse_id?: string;
  status: Status;
  capabilities?: Capability[];
  connectors: Connector[];
  physical_reference?: string;
  last_updated: string;
}

export interface Location {
  country_code: string;
  party_id: string;
  id: string;
  publish: boolean;
  name?: string;
  address: string;
  city: string;
  postal_code?: string;
  country: string;
  coordinates: GeoLocation;
  evses?: EVSE[];
  time_zone: string;
  last_updated: string;
}

// --- Tokens ------------------------------------------------------------------

export type TokenType = 'AD_HOC_USER' | 'APP_USER' | 'OTHER' | 'RFID';
export type WhitelistType = 'ALWAYS' | 'ALLOWED' | 'ALLOWED_OFFLINE' | 'NEVER';

export interface Token {
  country_code: string;
  party_id: string;
  uid: string;
  type: TokenType;
  contract_id: string;
  issuer: string;
  valid: boolean;
  whitelist: WhitelistType;
  last_updated: string;
}

export type AllowedType = 'ALLOWED' | 'BLOCKED' | 'EXPIRED' | 'NO_CREDIT' | 'NOT_ALLOWED';

export interface AuthorizationInfo {
  allowed: AllowedType;
  token: Token;
  authorization_reference?: string;
}

// --- Sessions & CDRs ---------------------------------------------------------

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'INVALID' | 'PENDING' | 'RESERVATION';
export type AuthMethod = 'AUTH_REQUEST' | 'COMMAND' | 'WHITELIST';

export interface CdrToken {
  country_code: string;
  party_id: string;
  uid: string;
  type: TokenType;
  contract_id: string;
}

export interface Price {
  excl_vat: number;
  incl_vat?: number;
}

export interface Session {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time?: string;
  kwh: number;
  cdr_token: CdrToken;
  auth_method: AuthMethod;
  authorization_reference?: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
  currency: string;
  total_cost?: Price;
  status: SessionStatus;
  last_updated: string;
}

export interface CdrLocation {
  id: string;
  address: string;
  city: string;
  country: string;
  coordinates: GeoLocation;
  evse_uid: string;
  evse_id: string;
  connector_id: string;
  connector_standard: ConnectorType;
  connector_format: 'SOCKET' | 'CABLE';
  connector_power_type: PowerType;
}

export interface ChargingPeriod {
  start_date_time: string;
  dimensions: { type: 'ENERGY' | 'TIME' | 'PARKING_TIME' | 'MAX_CURRENT'; volume: number }[];
}

export interface CDR {
  country_code: string;
  party_id: string;
  id: string;
  start_date_time: string;
  end_date_time: string;
  session_id?: string;
  cdr_token: CdrToken;
  auth_method: AuthMethod;
  authorization_reference?: string;
  cdr_location: CdrLocation;
  currency: string;
  charging_periods: ChargingPeriod[];
  total_cost: Price;
  total_energy: number;
  total_time: number;
  last_updated: string;
}

// --- Commands ----------------------------------------------------------------

export type CommandType =
  'CANCEL_RESERVATION' | 'RESERVE_NOW' | 'START_SESSION' | 'STOP_SESSION' | 'UNLOCK_CONNECTOR';

export interface StartSession {
  response_url: string;
  token: Token;
  location_id: string;
  evse_uid?: string;
  connector_id?: string;
  authorization_reference?: string;
}

export interface StopSession {
  response_url: string;
  session_id: string;
}

export type CommandResponseType = 'NOT_SUPPORTED' | 'REJECTED' | 'ACCEPTED' | 'UNKNOWN_SESSION';

export interface CommandResponse {
  result: CommandResponseType;
  timeout: number;
  message?: { language: string; text: string }[];
}

export type CommandResultType =
  | 'ACCEPTED'
  | 'CANCELED_RESERVATION'
  | 'EVSE_OCCUPIED'
  | 'EVSE_INOPERATIVE'
  | 'FAILED'
  | 'NOT_SUPPORTED'
  | 'REJECTED'
  | 'TIMEOUT'
  | 'UNKNOWN_RESERVATION';

export interface CommandResult {
  result: CommandResultType;
  message?: { language: string; text: string }[];
}
