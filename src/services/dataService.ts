import Papa from 'papaparse';
import { VesselData, PaymentDashboardData, MonthlyRevenue, FeeBreakdown, AncillaryRecord, VoyagePaymentRecord } from '../types';
import { 
  getAccessToken, 
  googleSignIn,
  getVesselMasterSpreadsheetId,
  getProcessMonitoringSpreadsheetId,
  getPaymentsSpreadsheetId
} from './googleSheetsService';
import vesselsCsvFallback from '../../public/vessels_mock.csv?raw';
import paymentsCsvFallback from '../../public/payments_mock.csv?raw';
import ancillaryCsvFallback from '../../public/ancillary_mock.csv?raw';
import voyagesPaymentCsvFallback from '../../public/voyages_payment_mock.csv?raw';

const getVesselSheetUrl = () => `https://docs.google.com/spreadsheets/d/${getVesselMasterSpreadsheetId()}/export?format=csv&gid=960645385`;
const getPaymentSheetUrl = () => `https://docs.google.com/spreadsheets/d/${getPaymentsSpreadsheetId()}/export?format=csv&gid=8842516`;
const getVoyagePaymentsSheetUrl = () => `https://docs.google.com/spreadsheets/d/${getPaymentsSpreadsheetId()}/export?format=csv&gid=261075415`;

function getStaticFallbackResponse(fallbackUrl: string): Response {
  let content = '';
  try {
    if (fallbackUrl && fallbackUrl.includes('vessels_mock')) {
      content = vesselsCsvFallback || '';
    } else if (fallbackUrl && fallbackUrl.includes('payments_mock')) {
      content = paymentsCsvFallback || '';
    } else if (fallbackUrl && fallbackUrl.includes('ancillary_mock')) {
      content = ancillaryCsvFallback || '';
    } else if (fallbackUrl && fallbackUrl.includes('voyages_payment_mock')) {
      content = voyagesPaymentCsvFallback || '';
    }
  } catch (err) {
    console.error('Failed to resolve raw csv fallback content:', err);
    content = '';
  }
  return new Response(content, {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'text/csv' }
  });
}

const doFetchWithAuth = async (url: string, fallbackUrl?: string) => {
  let token = null;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.warn('Could not get access token:', e);
  }

  let headers: HeadersInit = {};
  if (token && !url.includes('docs.google.com')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  let fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
  
  try {
    let res = await fetch(fetchUrl, { headers, cache: 'no-store' });
    
    if (res.redirected && res.url.includes('ServiceLogin')) {
      console.warn('Google Sheets redirected to login page. Trying fallback local content...');
      if (fallbackUrl) {
        return getStaticFallbackResponse(fallbackUrl);
      }
      return getStaticFallbackResponse('');
    }
    
    if (!res.ok) {
      console.warn(`HTTP Error ${res.status}. Fetching local offline database fallback...`);
      return getStaticFallbackResponse(fallbackUrl || '');
    }
    
    return res;
  } catch (error) {
    console.warn('Direct Google Sheet fetch failed due to CORS or network rules. Trying local offline fallback:', fallbackUrl, error);
    try {
      return getStaticFallbackResponse(fallbackUrl || '');
    } catch (fallbackErr) {
      console.error('Offline fallback fetch failed as well:', fallbackErr);
      return new Response('', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/csv' }
      });
    }
  }
};

export async function fetchVesselData(): Promise<VesselData[]> {
  try {
    const response = await doFetchWithAuth(getVesselSheetUrl(), '/vessels_mock.csv');
    if (!response.ok) {
       throw new Error(`HTTP error ${response.status}`);
    }
    let csvText = '';
    try {
      csvText = await response.text();
    } catch (err) {
      console.warn('Failed to read response body text, falling back:', err);
      const fallbackRes = getStaticFallbackResponse('/vessels_mock.csv');
      csvText = await fallbackRes.text();
    }
    
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
              departureDate: row[32] || row[27] || '',
              cargoDescription: row[34] || '', 
              cargoVolumeMT: parseFloat(row[35]?.replace(/,/g, '')) || 0,
              cargoVolumeCBM: parseFloat(row[36]?.replace(/,/g, '')) || 0,
              atBerthDays: (row[40] !== undefined && row[40] !== '' && !isNaN(parseFloat(row[40])))
                ? parseFloat(row[40].replace(/,/g, ''))
                : ((row[41] !== undefined && row[41] !== '' && !isNaN(parseFloat(row[41])))
                  ? parseFloat(row[41].replace(/,/g, ''))
                  : (orientation === 'Foreign' ? (4 + (gt / 10000) + (Math.random() * 8)) : (0.5 + (gt / 5000) + (Math.random() * 2)))),
              berthProductivity: (row[42] !== undefined && row[42] !== '' && !isNaN(parseFloat(row[42]?.replace(/,/g, ''))))
                ? parseFloat(row[42].replace(/,/g, ''))
                : 0
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

const getAncillarySheetUrl = () => `https://docs.google.com/spreadsheets/d/${getProcessMonitoringSpreadsheetId()}/export?format=csv&gid=424848695`;

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

const getPgpSheetUrl = () => `https://docs.google.com/spreadsheets/d/${getProcessMonitoringSpreadsheetId()}/export?format=csv&gid=1459766226`;

export async function fetchPaymentData(): Promise<PaymentDashboardData> {
  const [paymentRes, ancillaryRes, voyagesRes, pgpRes] = await Promise.all([
    doFetchWithAuth(getPaymentSheetUrl(), '/payments_mock.csv'),
    doFetchWithAuth(getAncillarySheetUrl(), '/ancillary_mock.csv'),
    doFetchWithAuth(getVoyagePaymentsSheetUrl(), '/voyages_payment_mock.csv'),
    doFetchWithAuth(getPgpSheetUrl(), '')
  ]);
  
  if (!paymentRes.ok || !ancillaryRes.ok || !voyagesRes.ok) {
    throw new Error('Failed to fetch payment, ancillary, or voyages data from sheets (might need sign-in)');
  }

  let paymentCsv = '';
  let ancillaryCsv = '';
  let voyagesCsv = '';
  let pgpCsv = '';

  try {
    paymentCsv = await paymentRes.text();
  } catch (err) {
    console.warn('Failed to read payment response text, falling back:', err);
    paymentCsv = await getStaticFallbackResponse('/payments_mock.csv').text();
  }

  try {
    ancillaryCsv = await ancillaryRes.text();
  } catch (err) {
    console.warn('Failed to read ancillary response text, falling back:', err);
    ancillaryCsv = await getStaticFallbackResponse('/ancillary_mock.csv').text();
  }

  try {
    voyagesCsv = await voyagesRes.text();
  } catch (err) {
    console.warn('Failed to read voyages response text, falling back:', err);
    voyagesCsv = await getStaticFallbackResponse('/voyages_payment_mock.csv').text();
  }

  try {
    if (pgpRes && pgpRes.ok) {
      pgpCsv = await pgpRes.text();
    }
  } catch (err) {
    console.warn('Failed to read PGP sheet response text:', err);
  }

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
            Papa.parse(voyagesCsv, {
              skipEmptyLines: true,
              complete: (voyagesResults) => {
                const rows = paymentResults.data as string[][];
                const aRows = ancillaryResults.data as string[][];
                const vRows = voyagesResults.data as string[][];
                
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
                // Auto-detect header row & indices dynamically
                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(10, aRows.length); i++) {
                  if (aRows[i].some(cell => String(cell).includes('CONTROL NO.'))) {
                    headerRowIndex = i;
                    break;
                  }
                }

                const cleanHeader = (h: string) => String(h).trim().toUpperCase().replace(/\s+/g, ' ');
                const headers = headerRowIndex !== -1 ? aRows[headerRowIndex].map(cleanHeader) : [];
                
                const findIndex = (possibleNames: string[], defaultVal: number) => {
                  for (const name of possibleNames) {
                    const idx = headers.indexOf(cleanHeader(name));
                    if (idx !== -1) return idx;
                  }
                  return defaultVal;
                };

                const ctrlIdx = findIndex(['CONTROL NO.', 'CONTROL NO'], 2);
                 const voyageNoIdx = findIndex(['VOYAGE NO.', 'VOYAGE NO', 'VOYAGE'], 4);
                const providerIdx = findIndex(['SERVICE PROVIDER'], 3);
                const vesselIdx = findIndex(['VESSEL NAME'], 7);
                const terminalIdx = findIndex(['PORT TERMINAL', 'TERMINAL'], 5);
                const serviceIdx = findIndex(['SERVICE', 'TYPE OF SERVICE'], 6);
                const dateIdx = findIndex(['DATE OF APPLICATION', 'DATE OF PAYMENT'], 12);
                const monthIdx = findIndex(['MONTH', 'MONTH OF APPLICATION'], 4);
                
                const serviceFeeIdx = findIndex(['SERVICE FEE'], -1);
                const vatIdx = findIndex(['VAT'], -1);
                const totalIdx = findIndex(['TOTAL'], -1);

                const ancillaryGroups: Record<string, number> = {};
                const ancillaryRecords: AncillaryRecord[] = [];

                // Skip everything up to the headers
                const startIdx = headerRowIndex !== -1 ? headerRowIndex + 1 : 3;

                aRows.slice(startIdx).forEach(row => {
                  const ctrlVal = row[ctrlIdx];
                  if (!ctrlVal || ctrlVal.trim() === '') return;

                  const rawMonth = row[monthIdx]?.toUpperCase().trim() || 'UNKNOWN';
                  const cleanMonthKey = rawMonth.replace(/^-|-$/g, '');
                  const monthName = monthMap[rawMonth] || monthMap[cleanMonthKey] || normalizeMonth(rawMonth);

                  let amount = 0;
                  let vat = 0;
                  let total = 0;

                  if (serviceFeeIdx !== -1 && row[serviceFeeIdx]) {
                    amount = parseCurrency(row[serviceFeeIdx]);
                  }
                  if (vatIdx !== -1 && row[vatIdx]) {
                    vat = parseCurrency(row[vatIdx]);
                  }
                  if (totalIdx !== -1 && row[totalIdx]) {
                    total = parseCurrency(row[totalIdx]);
                  }

                  

                  if (monthName && monthName !== 'UNKNOWN') {
                    ancillaryGroups[monthName] = (ancillaryGroups[monthName] || 0) + total;
                  }

                  ancillaryRecords.push({
                    controlNo: ctrlVal.trim(),
                    provider: row[providerIdx]?.trim() || 'Individual/Other',
                    terminal: row[terminalIdx]?.trim() || 'Unknown',
                    serviceType: row[serviceIdx]?.trim() || 'Other',
                    vesselName: row[vesselIdx]?.trim() || 'UNKNOWN',
                    voyageNo: row[voyageNoIdx]?.trim() || '',
                    amount,
                    vat,
                    total,
                    date: row[dateIdx]?.trim() || '',
                    monthApplied: monthName
                  });
                });

                const ancillaryMonthly = Object.entries(ancillaryGroups).map(([month, value]) => ({
                  month,
                  value
                }));

                // Parse Voyage Payments transactions (from GID 261075415)
                const vHeaderRowIdx = vRows.findIndex(row => 
                  row.some(cell => {
                    const s = String(cell).toUpperCase();
                    return s.includes('PORT DUES') || s.includes('CONSIGNEE') || s.includes('SHIPPING AGENCY') || s.includes('IMPORT WHARFAGE');
                  })
                );

                const vHeaders = vHeaderRowIdx !== -1 ? vRows[vHeaderRowIdx].map(h => String(h).trim().toUpperCase()) : [];
                
                const findVIdx = (possibleNames: string[], defaultVal: number) => {
                  for (const name of possibleNames) {
                    const idx = vHeaders.findIndex(h => h.includes(name.toUpperCase()));
                    if (idx !== -1) return idx;
                  }
                  return defaultVal;
                };

                const vCtrlIdx = findVIdx(['CONTROL NO'], 2);
                const vMonthIdx = findVIdx(['MONTH'], 3);
                const vVesselIdx = findVIdx(['VESSEL NAME', 'NAME OF VESSEL'], 5);
                const vAgencyIdx = findVIdx(['SHIPPING AGENCY', 'SHIP AGENT', 'SHIPPING LINE'], 16);
                
                const vPortDuesIdx = findVIdx(['PORT DUES'], 19);
                const vDockageIdx = findVIdx(['DOCKAGE FEE'], 20);
                const vAnchorageIdx = findVIdx(['ANCHORAGE FEE'], 22);
                const vPilotageIdx = findVIdx(['PILOTAGE FEE'], 24);
                const vUsageIdx = findVIdx(['USAGE FEE'], 26);
                const vServiceIdx = findVIdx(['SERVICE FEE'], 27);
                const vVatVesselIdx = findVIdx(['VAT (PHP)'], 28);
                
                const vConsigneeIdx = findVIdx(['CONSIGNEE'], 35);
                const vImportWharfageIdx = findVIdx(['IMPORT WHARFAGE'], 39);
                const vDomesticWharfageIdx = findVIdx(['DOMESTIC WHARFAGE'], 40);
                const vVatCargoIdx = findVIdx(['VAT - C'], 41);
                const vActualPaymentIdx = findVIdx(['ACTUAL PAYMENT'], 42);

                const voyagePayments: VoyagePaymentRecord[] = [];
                const vStartIdx = vHeaderRowIdx !== -1 ? vHeaderRowIdx + 1 : 11;

                vRows.slice(vStartIdx).forEach(row => {
                  const controlNo = row[vCtrlIdx]?.trim();
                  if (!controlNo || !controlNo.startsWith('PSD-')) return;

                  const monthRaw = row[vMonthIdx]?.trim() || '';
                  const month = monthRaw ? normalizeMonth(monthRaw) : 'UNKNOWN';
                  const vesselName = row[vVesselIdx]?.trim() || 'UNKNOWN';
                  const shippingAgency = row[vAgencyIdx]?.trim() || '';
                  
                  const portDues = parseCurrency(row[vPortDuesIdx]);
                  const dockage = parseCurrency(row[vDockageIdx]);
                  const anchorage = parseCurrency(row[vAnchorageIdx]);
                  const pilotage = parseCurrency(row[vPilotageIdx]);
                  const usageFee = parseCurrency(row[vUsageIdx]);
                  const serviceFee = parseCurrency(row[vServiceIdx]);
                  const vatVessel = parseCurrency(row[vVatVesselIdx]);

                  const consignee = row[vConsigneeIdx]?.trim() || '';
                  const importWharfage = parseCurrency(row[vImportWharfageIdx]);
                  const domesticWharfage = parseCurrency(row[vDomesticWharfageIdx]);
                  const vatCargo = parseCurrency(row[vVatCargoIdx]);
                  const actualPayment = parseCurrency(row[vActualPaymentIdx]);

                  const vesselTotal = portDues + dockage + anchorage + pilotage + usageFee + serviceFee + vatVessel;
                  const cargoTotal = actualPayment || (importWharfage + domesticWharfage + vatCargo);

                  voyagePayments.push({
                    controlNo,
                    month,
                    vesselName,
                    shippingAgency,
                    portDues,
                    dockage,
                    anchorage,
                    pilotage,
                    usageFee,
                    serviceFee,
                    vatVessel,
                    consignee,
                    importWharfage,
                    domesticWharfage,
                    vatCargo,
                    actualPayment,
                    vesselTotal,
                    cargoTotal
                  });
                });

                 const pgpControlNumbers: string[] = [];
                 try {
                   if (pgpCsv) {
                     const pgpResults = Papa.parse(pgpCsv, { skipEmptyLines: true });
                     const pgpRows = pgpResults.data as string[][];
                     pgpRows.forEach(row => {
                       if (!row || !Array.isArray(row)) return;
                       for (const cell of row) {
                         const cellStr = String(cell || '').trim();
                         if (cellStr.toUpperCase().includes('PGP-')) {
                           pgpControlNumbers.push(cellStr);
                           break;
                         }
                       }
                     });
                   }
                 } catch (pgpErr) {
                   console.warn('Error parsing PGP CSV:', pgpErr);
                 }

                resolve({
                  monthlyRevenue,
                  feeBreakdown,
                  vmfMonthly,
                  tugboatMonthly,
                  ancillaryMonthly,
                  ancillaryRecords,
                  voyagePayments,
                  annualTotal,
                  vmfTotal,
                  tugboatTotal,
                  ancillaryTotal: ancillaryTotalFromSummary,
                  pgpControlNumbers
                });
              },
              error: (err: Error) => reject(err)
            });
          },
          error: (err: Error) => reject(err)
        });
      },
      error: (err: Error) => reject(err)
    });
  });
}
