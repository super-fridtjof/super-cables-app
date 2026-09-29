import { EVSE, Location } from '@super-cables/ocpi';

function evse(uid: string, evseId: string, kw: number, now: string): EVSE {
  const dc = kw > 22;
  return {
    uid,
    evse_id: evseId,
    status: 'AVAILABLE',
    capabilities: ['REMOTE_START_STOP_CAPABLE', 'CREDIT_CARD_PAYABLE'],
    connectors: [
      {
        id: '1',
        standard: dc ? 'IEC_62196_T2_COMBO' : 'IEC_62196_T2',
        format: 'CABLE',
        power_type: dc ? 'DC' : 'AC_3_PHASE',
        max_voltage: dc ? 920 : 400,
        max_amperage: dc ? 400 : 32,
        max_electric_power: kw * 1000,
        last_updated: now,
      },
    ],
    last_updated: now,
  };
}

/** A few fake Norwegian sites so the eMSP has something to show. */
export function seedLocations(countryCode: string, partyId: string): Location[] {
  const now = new Date().toISOString();
  const base = {
    country_code: countryCode,
    party_id: partyId,
    publish: true,
    country: 'NOR',
    time_zone: 'Europe/Oslo',
  };
  return [
    {
      ...base,
      id: 'LOC-OSLO-1',
      name: 'Aker Brygge P-hus',
      address: 'Stranden 1',
      city: 'Oslo',
      postal_code: '0250',
      coordinates: { latitude: '59.910210', longitude: '10.727530' },
      evses: [
        evse('EVSE-OSLO-1-1', `${countryCode}*${partyId}*E1001`, 150, now),
        evse('EVSE-OSLO-1-2', `${countryCode}*${partyId}*E1002`, 150, now),
      ],
      last_updated: now,
    },
    {
      ...base,
      id: 'LOC-BERGEN-1',
      name: 'Bryggen Lading',
      address: 'Bryggen 15',
      city: 'Bergen',
      postal_code: '5003',
      coordinates: { latitude: '60.397076', longitude: '5.324383' },
      evses: [evse('EVSE-BERGEN-1-1', `${countryCode}*${partyId}*E2001`, 22, now)],
      last_updated: now,
    },
  ];
}
