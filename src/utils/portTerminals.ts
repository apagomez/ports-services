export interface PortTerminalDefinition {
  code: string;              // Standard terminal code / acronym
  displayName: string;       // Clean display name
  fullName: string;          // Official complete facility name
  facilityType: string;      // Facility type & operational description
  aliases: string[];         // Aliases, historical names, and spreadsheet variants
}

export const PORT_TERMINALS: PortTerminalDefinition[] = [
  {
    code: 'GNPD',
    displayName: 'GNPD',
    fullName: 'GNPower Dinginin Ltd. Co.',
    facilityType: 'Coal-Fired Thermal Power Plant Pier',
    aliases: ['GNPD', 'GN POWER', 'GNPOWER', 'GNPOWER DINGININ']
  },
  {
    code: 'MPGC',
    displayName: 'MPGC',
    fullName: 'Mariveles Power Generation Corporation',
    facilityType: 'Thermal Power Plant Port Facility',
    aliases: ['MPGC', 'MARIVELES POWER', 'MARIVELES POWER GENERATION']
  },
  {
    code: 'PHILCEMENT',
    displayName: 'PHILCEMENT',
    fullName: 'Philcement Corporation (PCC)',
    facilityType: 'Bulk Cement Deep-Water Harbor Terminal',
    aliases: ['PHILCEMENT', 'PCC', 'PHILCEMENT CORP', 'PHILCEMENT CORP.', 'PHILCEMENT CORPORATION', 'PHILCEMENTCORPORATION', 'PHIL CEMENT']
  },
  {
    code: 'STC',
    displayName: 'STC',
    fullName: 'Seafront Terminal Complex',
    facilityType: 'Seafront Shipyard & Port Terminal Services',
    aliases: ['STC', 'SEAFRONT', 'SEAFRONT TERMINAL', 'SEAFRONT SHIPYARD', 'SEAFRONT TERMINAL COMPLEX']
  },
  {
    code: 'CAMAYA COAST',
    displayName: 'CAMAYA COAST',
    fullName: 'Camaya Coast Port & Ferry Terminal',
    facilityType: 'Passenger Ferry & Commercial Harbor',
    aliases: ['CAMAYA COAST', 'CAMAYA', 'CAMAYA FERRY', 'CAMAYA COAST FERRY']
  },
  {
    code: 'E-FARE',
    displayName: 'E-FARE',
    fullName: 'East FAB Ferry Terminal (E-Fare)',
    facilityType: 'Fast Craft Ferry & Terminal Operations',
    aliases: ['E-FARE', 'EFARE', 'E FARE', 'EAST FAB']
  },
  {
    code: 'SMBI',
    displayName: 'SMBI',
    fullName: 'San Miguel Bataan Inc.',
    facilityType: 'Lucanin Malt & Feed Port Facility',
    aliases: ['SMBI', 'SAN MIGUEL', 'SAN MIGUEL BATAAN', 'SAN MIGUEL BREWERY', 'SMB']
  },
  {
    code: 'SISIMAN',
    displayName: 'SISIMAN',
    fullName: 'Sisiman Bay Port Terminal',
    facilityType: 'Domestic Cargo & Sisiman Bay Pier',
    aliases: ['SISIMAN', 'SISIMAN BAY', 'SISIMAN PORT']
  },
  {
    code: 'RRYD',
    displayName: 'RRYD',
    fullName: 'Rouvia Road Yacht Development (RRYD)',
    facilityType: 'Yacht Design, Slipway & Marine Services',
    aliases: ['RRYD', 'ROUVIA ROAD', 'ROUVIA', 'ROUVIA ROAD YACHT', 'ROUVIA ROAD YACHT DEVELOPMENT']
  },
  {
    code: 'MGC',
    displayName: 'MGC',
    fullName: 'Mariveles Grain Corporation (MGC)',
    facilityType: 'Bulk Grains & Agribulk Terminal',
    aliases: ['MGC', 'MARIVELES GRAIN', 'MARIVELES GRAINS', 'MARIVELES GRAIN CORP']
  },
  {
    code: 'MHC',
    displayName: 'MHC',
    fullName: 'Mariveles Harbor Corporation (MHC)',
    facilityType: 'Harbor Services & General Cargo Pier',
    aliases: ['MHC', 'MARIVELES HARBOR', 'MARIVELES HARBOR CORP']
  },
  {
    code: 'ANCHORAGE',
    displayName: 'ANCHORAGE',
    fullName: 'Mariveles Port Anchorage Ground',
    facilityType: 'Designated Waiting & Quarantine Anchorage',
    aliases: ['ANCHORAGE', 'MARIVELES ANCHORAGE', 'PORT ANCHORAGE', 'AT ANCHORAGE']
  }
];

export const PORT_TERMINAL_MAP: Record<string, PortTerminalDefinition> = PORT_TERMINALS.reduce(
  (acc, t) => {
    acc[t.code] = t;
    return acc;
  },
  {} as Record<string, PortTerminalDefinition>
);

/**
 * Normalizes any raw terminal string (including spreadsheet aliases and variations)
 * into a verified canonical terminal code.
 */
export function normalizeTerminalCode(raw?: string): string {
  if (!raw) return '';
  const clean = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!clean || clean === 'UNKNOWN' || clean === 'PORT TERMINAL' || clean === 'TERMINAL' || clean.startsWith('#')) {
    return '';
  }

  // Exact code check
  if (PORT_TERMINAL_MAP[clean]) {
    return PORT_TERMINAL_MAP[clean].code;
  }

  // Alias lookup
  for (const t of PORT_TERMINALS) {
    if (t.code === clean || t.aliases.some(a => a === clean || clean === a || clean.includes(a))) {
      return t.code;
    }
  }

  return clean;
}

/**
 * Checks if a record's terminal matches the selected filter value.
 */
export function isTerminalMatch(recordTerm?: string, targetFilter?: string): boolean {
  if (!targetFilter || targetFilter === 'All') return true;
  if (!recordTerm) return false;
  const normRecord = normalizeTerminalCode(recordTerm);
  const normTarget = normalizeTerminalCode(targetFilter);
  return normRecord === normTarget;
}

/**
 * Retrieves the full metadata definition for a terminal code or raw terminal string.
 */
export function getPortTerminalMeta(codeOrRaw?: string): PortTerminalDefinition | undefined {
  if (!codeOrRaw) return undefined;
  const code = normalizeTerminalCode(codeOrRaw);
  return PORT_TERMINAL_MAP[code];
}
