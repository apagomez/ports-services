/**
 * Compares two vessel control numbers using natural numeric ordering.
 * 
 * Handles patterns such as:
 * - PSD-26-001-F
 * - PSD-26-999-F
 * - PSD-26-1000-D
 * - PSD-26-1204-D
 * - Case-insensitive and arbitrary year prefixes
 */
export function compareControlNumbers(
  a: string | undefined | null, 
  b: string | undefined | null
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const strA = String(a).trim().toUpperCase();
  const strB = String(b).trim().toUpperCase();

  const matchA = strA.match(/^PSD-(\d+)-(\d+)(?:-([A-Z0-9]+))?/i);
  const matchB = strB.match(/^PSD-(\d+)-(\d+)(?:-([A-Z0-9]+))?/i);

  if (matchA && matchB) {
    const yearA = parseInt(matchA[1], 10);
    const yearB = parseInt(matchB[1], 10);
    if (yearA !== yearB) return yearA - yearB;

    const seqA = parseInt(matchA[2], 10);
    const seqB = parseInt(matchB[2], 10);
    if (seqA !== seqB) return seqA - seqB;

    const suffixA = matchA[3] || '';
    const suffixB = matchB[3] || '';
    return suffixA.localeCompare(suffixB);
  }

  // Fallback for non-standard or alternative control IDs
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

export function parseControlSequence(controlNo: string | undefined | null): number {
  if (!controlNo) return 0;
  const match = String(controlNo).match(/^PSD-\d+-(\d+)/i) || String(controlNo).match(/-(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10) || 0;
  }
  const digits = String(controlNo).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
