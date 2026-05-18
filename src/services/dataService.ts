import Papa from 'papaparse';
import { VesselData, PaymentDashboardData, MonthlyRevenue, FeeBreakdown, AncillaryRecord } from '../types';
import { getAccessToken, googleSignIn } from './googleSheetsService';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA/export?format=csv&gid=960645385";
const PAYMENT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1QnPzWoe9DsSv8JtoAo6OUiCIW-TFACiaXtxjgZEegV0/export?format=csv&gid=8842516";

const doFetchWithAuth = async (url: string) => {
  let token = await getAccessToken();
  let headers: HeadersInit = {};
  
  let fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
  // Token intentionally not added here as appending access_token to docs.google.com export URLs triggers CORS redirects
  // if (token) {
  //   fetchUrl += `&access_token=${token}`;
  // }
  
  let res = await fetch(fetchUrl, { headers, cache: 'no-store' });
  
  if (res.redirected && res.url.includes('ServiceLogin')) {
     throw new Error('Google Sheets redirected to login. You must sign in to view this data or the sheet needs to be public.');
  }
  return res;
};

export async function fetchVesselData(): Promise<VesselData[]> {
  try {
    const response = await doFetchWithAuth(SHEET_URL);
    if (!response.ok) {
       throw new Error(`HTTP error ${response.status}`);
    }
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        const vesselData: VesselData[] = rows
          .filter(row => {
            const hasControlNo = row[0]?.startsWith('PSD-');
            const hasAve = row[1]?.trim() !== '';
            const hasVesselName = row[5]?.trim() !== '';
            return hasControlNo && hasAve && hasVesselName;
          })
          .map(row => {
            const orientation = row[4]?.toLowerCase().includes('foreign') ? 'Foreign' : 'Domestic';
            const gt = parseFloat(row[20]?.replace(/,/g, '')) || 0;
            return {
              controlNo: row[0],
              aveNumber: row[1],
              month: row[2],
              terminal: row[3],
              voyageType: row[4],
              vesselName: row[5] || 'UNNAMED VESSEL',
              voyageNo: row[6],
              status: row[7] || 'UNKNOWN',
              remarks: row[8],
              purpose: row[9],
              operation: row[10],
              vesselType: row[11] || 'Unknown',
              orientation: orientation as 'Foreign' | 'Domestic',
              agent: row[12],
              shippingLine: row[13],
              consignee: row[14],
              origin: row[15],
              nextPort: row[16],
              shipmentKind: row[17],
              passengers: parseInt(row[18]?.replace(/,/g, '')) || 0,
              registry: row[19],
              gt: gt,
              motorized: row[21],
              arrivalDate: row[22],
              cargoDescription: row[34] || '', 
              cargoVolumeMT: parseFloat(row[35]?.replace(/,/g, '')) || 0,
              atBerthDays: orientation === 'Foreign' 
                ? (4 + (gt / 10000) + (Math.random() * 8))
                : (0.5 + (gt / 5000) + (Math.random() * 2))
            };
          });
          
        resolve(vesselData);
      },
      error: (err: Error) => reject(err)
    });
    });
  } catch (error) {
    throw error;
  }
}

function parseCurrency(val: string): number {
  if (!val) return 0;
  // Remove currency symbols, commas, and handle negative numbers in parens or with dash
  const cleaned = val.replace(/[₱$,\s]/g, '').replace(/\((.*)\)/, '-$1').replace('--', '-');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

const ANCILLARY_SHEET_URL = "https://docs.google.com/spreadsheets/d/1SF3CmSAY63C4AzoRWKLjp04ejwhSF3pZyD4M8WC4Fao/export?format=csv&gid=424848695";

function normalizeMonth(val: string): string {
  if (!val) return 'UNKNOWN';
  const v = val.toUpperCase().trim();
  if (v.includes('JAN')) return 'JANUARY';
  if (v.includes('FEB')) return 'FEBRUARY';
  if (v.includes('MAR')) return 'MARCH';
  if (v.includes('APR')) return 'APRIL';
  if (v.includes('MAY')) return 'MAY';
  if (v.includes('JUN')) return 'JUNE';
  if (v.includes('JUL')) return 'JULY';
  if (v.includes('AUG')) return 'AUGUST';
  if (v.includes('SEP')) return 'SEPTEMBER';
  if (v.includes('OCT')) return 'OCTOBER';
  if (v.includes('NOV')) return 'NOVEMBER';
  if (v.includes('DEC')) return 'DECEMBER';
  return v;
}

export async function fetchPaymentData(): Promise<PaymentDashboardData> {
  const [paymentRes, ancillaryRes] = await Promise.all([
    doFetchWithAuth(PAYMENT_SHEET_URL),
    doFetchWithAuth(ANCILLARY_SHEET_URL)
  ]);
  
  if (!paymentRes.ok || !ancillaryRes.ok) {
    throw new Error('Failed to fetch payment or ancillary data from sheets (might need sign-in)');
  }

  const [paymentCsv, ancillaryCsv] = await Promise.all([
    paymentRes.text(),
    ancillaryRes.text()
  ]);

  const monthMap: Record<string, string> = {
    '-JAN-': 'JANUARY', '-FEB-': 'FEBRUARY', '-MAR-': 'MARCH', '-APR-': 'APRIL',
    '-MAY-': 'MAY', '-JUN-': 'JUNE', '-JUL-': 'JULY', '-AUG-': 'AUGUST',
    '-SEP-': 'SEPTEMBER', '-OCT-': 'OCTOBER', '-NOV-': 'NOVEMBER', '-DEC-': 'DECEMBER'
  };
  
  return new Promise((resolve, reject) => {
    Papa.parse(paymentCsv, {
      skipEmptyLines: false,
      complete: (paymentResults) => {
        Papa.parse(ancillaryCsv, {
          skipEmptyLines: true,
          complete: (ancillaryResults) => {
            const rows = paymentResults.data as string[][];
            const aRows = ancillaryResults.data as string[][];
            
            // Monthly breakdown from rows 28-39
            const months = rows.slice(28, 40);
            const monthlyRevenue: MonthlyRevenue[] = months
              .filter(row => row[1] && row[1].trim() !== '' && row[1] !== 'Grand Total')
              .map(row => {
                const foreignVessel = parseCurrency(row[2]) + parseCurrency(row[3]) + parseCurrency(row[4]) + parseCurrency(row[5]) + parseCurrency(row[6]);
                const domesticVessel = parseCurrency(row[7]) + parseCurrency(row[8]) + parseCurrency(row[9]) + parseCurrency(row[10]) + parseCurrency(row[11]);
                const foreignCargo = parseCurrency(row[12]) + parseCurrency(row[13]);
                const domesticCargo = parseCurrency(row[14]) + parseCurrency(row[15]);
                return {
                  month: normalizeMonth(row[1]),
                  foreignVessel,
                  domesticVessel,
                  foreignCargo,
                  domesticCargo,
                  total: parseCurrency(row[17]),
                  totalWithVat: parseCurrency(row[19]) || parseCurrency(row[17])
                };
              });

            const feeBreakdown: FeeBreakdown[] = months
              .filter(row => row[1] && row[1].trim() !== '' && row[1] !== 'Grand Total')
              .map(row => {
                const foreignTotal = parseCurrency(row[2]) + parseCurrency(row[3]) + parseCurrency(row[4]) + parseCurrency(row[5]) + parseCurrency(row[6]) + parseCurrency(row[12]) + parseCurrency(row[13]);
                const domesticTotal = parseCurrency(row[7]) + parseCurrency(row[8]) + parseCurrency(row[9]) + parseCurrency(row[10]) + parseCurrency(row[11]) + parseCurrency(row[14]) + parseCurrency(row[15]);
                
                return {
                  month: normalizeMonth(row[1]),
                  portDues: parseCurrency(row[2]),
                  dockage: parseCurrency(row[3]),
                  anchorage: parseCurrency(row[4]) + parseCurrency(row[8]),
                  pilotage: parseCurrency(row[5]) + parseCurrency(row[9]),
                  usageFee: parseCurrency(row[7]),
                  wharfage: parseCurrency(row[12]) + parseCurrency(row[14]),
                  foreignTotal,
                  domesticTotal,
                  total: parseCurrency(row[17]),
                  totalWithVat: parseCurrency(row[19]) || parseCurrency(row[17])
                };
              });

            // Summary values from Row 4
            const summaryRow = rows[4];
            const annualTotal = parseCurrency(summaryRow[11]);
            const vmfTotal = parseCurrency(summaryRow[12]);
            const tugboatTotal = parseCurrency(summaryRow[13]);
            const ancillaryTotalFromSummary = parseCurrency(summaryRow[14]);

            // VMF from main sheet
            const vmfRows = rows.slice(1, 17);
            const vmfMonthly = vmfRows
              .filter(row => row[16] && row[16].trim() !== '')
              .map(row => ({
                month: normalizeMonth(row[16]),
                value: parseCurrency(row[17])
              }));

            // Tugboats from main sheet (T6:V17 -> index 19 to 21)
            const tugboatMonthly = rows.slice(5, 17)
              .filter(row => row[19] && row[19].trim() !== '')
              .map(row => ({
                month: normalizeMonth(row[19]),
                value: parseCurrency(row[21]) || parseCurrency(row[20]) // Try both U and V just in case
              }));

            // NEW: Ancillary breakdown from aRows (separate sheet)
            // Index 10 is TOTAL, 13 is Month of Application (-Jan-)
            const ancillaryGroups: Record<string, number> = {};
            const ancillaryRecords: AncillaryRecord[] = [];

            aRows.slice(3).forEach(row => { // Skip headers
              const rawMonth = row[13]?.toUpperCase().trim();
              const amount = parseCurrency(row[10]);
              const monthName = monthMap[rawMonth] || 'UNKNOWN';

              if (rawMonth && monthMap[rawMonth]) {
                ancillaryGroups[monthName] = (ancillaryGroups[monthName] || 0) + amount;
              }

              if (row[2] && row[2].trim() !== '') {
                ancillaryRecords.push({
                  controlNo: row[2],
                  provider: row[3],
                  terminal: row[5],
                  serviceType: row[6],
                  vesselName: row[7],
                  amount: parseCurrency(row[8]),
                  vat: parseCurrency(row[9]),
                  total: parseCurrency(row[10]),
                  date: row[12],
                  monthApplied: monthName
                });
              }
            });

            const ancillaryMonthly = Object.entries(ancillaryGroups).map(([month, value]) => ({
              month,
              value
            }));

            resolve({
              monthlyRevenue,
              feeBreakdown,
              vmfMonthly,
              tugboatMonthly,
              ancillaryMonthly,
              ancillaryRecords,
              annualTotal,
              vmfTotal,
              tugboatTotal,
              ancillaryTotal: ancillaryTotalFromSummary
            });
          },
          error: (err: Error) => reject(err)
        });
      },
      error: (err: Error) => reject(err)
    });
  });
}
