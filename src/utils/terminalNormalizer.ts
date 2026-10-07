export const FAB_PORT_TERMINALS = [
  'SEAFRONT (SSTC)',
  'GNPOWER DINGININ',
  'GNPOWER MARIVELES',
  'HERMOSA',
  'BATAAN 2020',
  'PETRON BSRF',
  'SMEC',
  'ANCHORAGE'
];

export function normalizeTerminal(terminal?: string | null): string {
  if (!terminal) return 'ANCHORAGE';
  const trimmed = terminal.trim();
  if (!trimmed || trimmed.toUpperCase() === 'UNKNOWN' || trimmed === '-') {
    return 'ANCHORAGE';
  }
  return trimmed;
}

export function matchesTerminalFilter(vesselTerminal?: string | null, filterTerminal?: string): boolean {
  if (!filterTerminal || filterTerminal === 'All') return true;
  const normalizedVessel = normalizeTerminal(vesselTerminal).toUpperCase();
  const normalizedFilter = filterTerminal.trim().toUpperCase();
  return normalizedVessel === normalizedFilter || normalizedVessel.includes(normalizedFilter);
}
