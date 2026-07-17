import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { VesselApplication } from '../types';
import { safeStorage } from '../utils/safeStorage';

if (!firebaseConfig) {
  console.error("firebase-applet-config.json is missing");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
let _auth: any = null;
const getAuthInstance = () => {
  if (!_auth) {
    _auth = getAuth(app);
  }
  return _auth;
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = safeStorage.getItem('google_access_token');

export function getColLetter(colIdx: number): string {
  let temp = colIdx;
  let letter = '';
  while (temp > 0) {
    let modulo = (temp - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    temp = Math.floor((temp - modulo) / 26);
  }
  return letter;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(getAuthInstance(), async (user: User | null) => {
    const token = cachedAccessToken || safeStorage.getItem('google_access_token');
    if (user && token) {
      cachedAccessToken = token;
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      safeStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(getAuthInstance(), provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    safeStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || safeStorage.getItem('google_access_token');
};

export const logout = async () => {
  await getAuthInstance().signOut();
  cachedAccessToken = null;
  safeStorage.removeItem('google_access_token');
};

const SPREADSHEET_ID = '1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA';
const TARGET_GID = 960645385;

export const getVesselMasterSpreadsheetId = (): string => {
  return safeStorage.getItem('vessel_master_spreadsheet_id') || SPREADSHEET_ID;
};

export const setVesselMasterSpreadsheetId = (id: string) => {
  safeStorage.setItem('vessel_master_spreadsheet_id', id.trim());
};

export const getProcessMonitoringSpreadsheetId = (): string => {
  return safeStorage.getItem('process_monitoring_spreadsheet_id') || '1SF3CmSAY63C4AzoRWKLjp04ejwhSF3pZyD4M8WC4Fao';
};

export const setProcessMonitoringSpreadsheetId = (id: string) => {
  safeStorage.setItem('process_monitoring_spreadsheet_id', id.trim());
};

export const getPaymentsSpreadsheetId = (): string => {
  return safeStorage.getItem('payments_spreadsheet_id') || '1QnPzWoe9DsSv8JtoAo6OUiCIW-TFACiaXtxjgZEegV0';
};

export const setPaymentsSpreadsheetId = (id: string) => {
  safeStorage.setItem('payments_spreadsheet_id', id.trim());
};

// Appends data to the user Google Sheet
export const appendApplicationToSheet = async (appData: VesselApplication): Promise<{ finalControlNo: string } | undefined> => {
  const currentToken = await getAccessToken();
  if (!currentToken) {
    throw new Error('No active Google Sheets connection. Connect your Google account first to sync records.');
  }

  const isPAS = appData.applicationType === 'PAS' || (typeof appData.id === 'string' && appData.id.toUpperCase().startsWith('PAS-'));
  const isPGP = appData.applicationType === 'PGP' || (typeof appData.id === 'string' && appData.id.toUpperCase().startsWith('PGP-'));
  const spreadsheetId = (isPAS || isPGP) ? getProcessMonitoringSpreadsheetId() : getVesselMasterSpreadsheetId();
  const targetGid = isPAS ? 185820608 : (isPGP ? 1459766226 : TARGET_GID);

  // 1. Get Spreadsheet metadata to find the name of the sheet with targetGid
  const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`, {
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });

  if (!metaResponse.ok) {
    const metaError = await metaResponse.json();
    throw new Error(`Google Sheets API Error (getting metadata): ${metaError.error?.message || metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const sheetsList = metaData.sheets || [];
  const foundSheet = sheetsList.find((s: any) => Number(s.properties?.sheetId) === Number(targetGid));
  const defaultFallback = isPAS ? 'PORT ANCILLARY SERVICES' : (isPGP ? 'GATE PASS' : (sheetsList[0]?.properties?.title || 'Sheet1'));
  const targetSheetName = foundSheet?.properties?.title || defaultFallback;

  // Format the helper dates and fields
  const dateObj = new Date(appData.createdAt || Date.now());
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const formatSheetDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const monthShort = monthNames[d.getMonth()].slice(0, 3);
      const yearTwoDigit = d.getFullYear().toString().slice(-2);
      // Format like "13-Jan-26"
      return `${day}-${monthShort.charAt(0).toUpperCase()}${monthShort.slice(1).toLowerCase()}-${yearTwoDigit}`;
    } catch {
      return dateStr || '';
    }
  };

  const formatPASDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const monthFull = monthNames[d.getMonth()].charAt(0).toUpperCase() + monthNames[d.getMonth()].slice(1).toLowerCase();
      const year = d.getFullYear();
      // Format as "January 09, 2026" to exactly match the database
      return `${monthFull} ${day}, ${year}`;
    } catch {
      return dateStr || '';
    }
  };

  const getInitials = (name?: string, defaultVal = 'ECD') => {
    if (!name) return defaultVal;
    const cleanName = name.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
    } else if (parts.length === 2) {
      return (parts[0][0] + parts[1][0] + parts[1].slice(1, 2)).toUpperCase();
    } else if (parts.length === 1) {
      return parts[0].slice(0, 3).toUpperCase();
    }
    return defaultVal;
  };

  const formatTimeStr = (dateStr?: string) => {
    if (!dateStr) return '16:30';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '16:30';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '16:30';
    }
  };

  const formatDuration = (startIso?: string, endIso?: string): string => {
    if (!startIso || !endIso) return '0:01';
    try {
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      if (isNaN(start) || isNaN(end)) return '0:01';
      const diffMs = end - start;
      const totalMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hours}:${String(mins).padStart(2, '0')}`;
    } catch {
      return '0:01';
    }
  };

  let values: any[][];
  let finalControlNo = appData.id || '';

  if (isPAS) {
    const submissionDateObj = new Date(appData.submittedAt || appData.createdAt || Date.now());
    const appDateStr = formatSheetDate(appData.submittedAt || appData.createdAt);
    const releaseDateStr = formatSheetDate(appData.approvedAt || appData.createdAt);

    values = [
      [
        `=ROW()-3`,                                 // 0: Column A (NO.)
        appData.id || '',                           // 1: Column B (CONTROL NO.)
        appData.serviceProviderName || '',           // 2: Column C (SERVICE PROVIDER)
        appData.vesselName || '',                   // 3: Column D (VESSEL NAME)
        appData.voyageNo || '',                     // 4: Column E (VOYAGE NO.)
        appData.terminal || '',                     // 5: Column F (PORT TERMINAL)
        '',                                         // 6: Column G (ACCREDITATION (Y/N))
        (Array.isArray(appData.selectedServices) ? appData.selectedServices.join(', ') : (appData.selectedServices || appData.vesselOperations || '')), // 7: Column H (SERVICE)
        '',                                         // 8: Column I (REMARKS)
        appDateStr,                                 // 9: Column J (DATE OF APPLICATION)
        monthNames[submissionDateObj.getMonth()].charAt(0).toUpperCase() + monthNames[submissionDateObj.getMonth()].slice(1).toLowerCase(), // 10: Column K (Month)
        formatTimeStr(appData.submittedAt || appData.createdAt), // 11: Column L (TIME IN (1))
        formatTimeStr(appData.checkedAt || appData.submittedAt || appData.createdAt), // 12: Column M (TIME OUT (1))
        formatDuration(appData.submittedAt || appData.createdAt, appData.checkedAt || appData.submittedAt || appData.createdAt), // 13: Column N (CHECKING PROCESSING TIME)
        getInitials(appData.checkedByName || 'ECD'), // 14: Column O (ASSIGNED PERSONNEL FRONTLINE)
        formatTimeStr(appData.checkedAt || appData.submittedAt || appData.createdAt), // 15: Column P (TIME IN (2))
        formatTimeStr(appData.approvedAt || appData.checkedAt || appData.createdAt), // 16: Column Q (TIME OUT (2))
        formatDuration(appData.checkedAt || appData.submittedAt || appData.createdAt, appData.approvedAt || appData.checkedAt || appData.createdAt), // 17: Column R (APPROVAL PROCESSING TIME)
        getInitials(appData.approvedByName || 'AMD'), // 18: Column S (ASSIGNED APPROVER)
        releaseDateStr,                             // 19: Column T (DATE of Releasing)
        formatTimeStr(appData.approvedAt || appData.createdAt), // 20: Column U (TIME of Releasing)
        '0:01',                                     // 21: Column V (RELEASING PROCESSING TIME)
        formatDuration(appData.submittedAt || appData.createdAt, appData.approvedAt || appData.createdAt), // 22: Column W (TOTAL PROCESS TIME)
        '5',                                        // 23: Column X (RATING QUALITY)
        '5',                                        // 24: Column Y (RATING TIMELINESS)
        getInitials(appData.checkedByName || 'ECD'), // 25: Column Z (ISSUED BY)
        appData.nameOfRepresentative || appData.submitterName || 'REPRESENTATIVE' // 26: Column AA (RECEIVED BY)
      ]
    ];
  } else if (isPGP) {
    const checkerNameAbbrev = appData.checkedByName ? appData.checkedByName.replace(/[^A-Za-z]/g, '') : 'JUP';
    const approverNameAbbrev = appData.approvedByName ? appData.approvedByName.replace(/[^A-Za-z]/g, '') : 'CMC';

    const submissionDateObj = new Date(appData.submittedAt || appData.createdAt || Date.now());
    const appDateStr = formatSheetDate(appData.submittedAt || appData.createdAt);
    const releaseDateStr = formatSheetDate(appData.approvedAt || appData.createdAt);

    values = [
      [
        `=ROW()-4`,                             // 0: Column A (#NO - will put formula "=ROW()-4")
        '',                                     // 1: Column B (empty)
        '',                                     // 2: Column C (empty)
        `=ROW()-4`,                             // 3: Column D (NO.)
        appData.id || '',                       // 4: Column E (CONTROL NO.)
        appData.vesselName || '',               // 5: Column F (VESSEL NAME)
        appData.company || '',                  // 6: Column G (CLIENT)
        monthNamesShort[submissionDateObj.getMonth()], // 7: Column H (Month)
        appDateStr,                             // 8: Column I (DATE OF APPLICATION)
        formatTimeStr(appData.submittedAt || appData.createdAt), // 9: Column J (TIME IN (1))
        formatTimeStr(appData.checkedAt || appData.submittedAt || appData.createdAt), // 10: Column K (TIME OUT (1))
        formatDuration(appData.submittedAt || appData.createdAt, appData.checkedAt || appData.submittedAt || appData.createdAt), // 11: Column L (CHECKING PROCESSING TIME)
        checkerNameAbbrev || 'JUP',             // 12: Column M (ASSIGNED PERSONNEL)
        formatTimeStr(appData.checkedAt || appData.submittedAt || appData.createdAt), // 13: Column N (TIME IN (2))
        formatTimeStr(appData.approvedAt || appData.checkedAt || appData.createdAt), // 14: Column O (TIME OUT (2))
        formatDuration(appData.checkedAt || appData.submittedAt || appData.createdAt, appData.approvedAt || appData.checkedAt || appData.createdAt), // 15: Column P (APPROVAL PROCESSING TIME)
        '',                                     // 16: Column Q (DATE OF ISSUANCE)
        approverNameAbbrev || 'CMC',            // 17: Column R (ASSIGNED PERSONNEL APPROVER)
        releaseDateStr,                         // 18: Column S (DATE)
        formatTimeStr(appData.approvedAt || appData.createdAt), // 19: Column T (TIME)
        '0:01',                                 // 20: Column U (RELEASING PROCESSING TIME)
        formatDuration(appData.submittedAt || appData.createdAt, appData.approvedAt || appData.createdAt), // 21: Column V (TOTAL PROCESS TIME)
        '5',                                    // 22: Column W (RATING QUALITY)
        '5',                                    // 23: Column X (RATING TIMELINESS)
        checkerNameAbbrev || 'JUP',             // 24: Column Y (ISSUED BY)
        appData.nameOfRepresentative || appData.submitterName || 'REPRESENTATIVE' // 25: Column Z (RECEIVED BY)
      ]
    ];
  } else {
    const aveMatch = (appData.id || '').match(/-(\d{3})-?/);
    const aveNumber = aveMatch ? aveMatch[1] : '';

    const remarksText = [
      appData.checkedByName ? `Checked by: ${appData.checkedByName}` : '',
      appData.approvedByName ? `Approved by: ${appData.approvedByName}` : '',
      appData.submitterName ? `Submitted by: ${appData.submitterName}` : ''
    ].filter(Boolean).join(' | ');

    values = [
      [
        appData.id || '',                   // 0: FORMS CONTROL NO.
        aveNumber,                          // 1: AVE Number
        monthNames[dateObj.getMonth()],     // 2: MONTH
        appData.terminal || '',             // 3: PORT TERMINAL
        appData.voyageType || 'DOMESTIC',   // 4: VOYAGE TYPE
        appData.vesselName || '',           // 5: NAME OF VESSEL
        appData.voyageNo || '',             // 6: VOY NO.
        'APPROVED',                         // 7: VESSEL STATUS
        remarksText || 'APPROVED',          // 8: REMARKS
        appData.purpose || '',              // 9: PURPOSE OF CALL
        appData.vesselOperations || '',     // 10: VESSEL OPERATION
        appData.vesselType || 'CARGO',      // 11: TYPE OF VESSEL
        appData.agent || '',                // 12: SHIP AGENT
        appData.shippingLine || '',         // 13: SHIPPING LINE
        '',                                 // 14: CONSIGNEE
        appData.origin || '',               // 15: PORT OF ORIGIN
        appData.nextPort || '',             // 16: NEXT PORT OF CALL
        '',                                 // 17: KIND OF SHIPMENT
        '0',                                // 18: No. OF PASSENGERS
        appData.registry || '',             // 19: VESSEL REGISTRY
        appData.grossTonnage || '0',        // 20: GT
        '',                                 // 21: MOTORIZED
        formatSheetDate(appData.arrivalDate), // 22: ARRIVAL DATE AT FAB TERRITORY
        '',                                 // 23: ANCHORAGE DATE
        '',                                 // 24: ATA - ANCHORAGE (DATE AND TIME)
        '',                                 // 25: BERTHING DATE / FIRST LINE
        '',                                 // 26: ATA - BERTH (DATE AND TIME)
        '',                                 // 27: DEPARTURE DATE / LAST LINE (Do not input on column AB when appending as requested)
        '',                                 // 28: ATD - BERTH (DATE AND TIME)
        '',                                 // 29: ANCHORAGE DATE
        '',                                 // 30: ATA - ANCHORAGE (DATE AND TIME)
        '',                                 // 31: ATD - ANCHORAGE (BEFORE ATD)
        '',                                 // 32: DEPARTURE DATE AT FAB TERRITORY
        '',                                 // 33: Month Departure
        appData.cargoDescription || '',     // 34: CARGO DESCRIPTION
        '0'                                 // 35: LOAD VOLUME MT
      ]
    ];
  }

  // 2. Fetch specific column to find the last populated row dynamically
  const colToCheck = isPAS ? 'A:AA' : (isPGP ? 'A:Z' : 'A:A');
  let nextRowNumber = isPAS ? 4 : (isPGP ? 5 : 481); // Safe fallback number
  const rangeParam = `'${targetSheetName}'!${colToCheck}`;
  
  console.log(`[Google Sheets Sync] Attempting to read range '${colToCheck}' from sheet '${targetSheetName}' inside spreadsheet ${spreadsheetId}`);
  
  try {
    const colResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });
    
    if (!colResponse.ok) {
      const errBody = await colResponse.json().catch(() => ({}));
      const errMsg = errBody.error?.message || colResponse.statusText;
      console.error(`[Google Sheets Sync] Failed reading range ${rangeParam}: ${errMsg}`);
      throw new Error(`Google Sheets API Error (getting column values): ${errMsg}`);
    }
 
    const colData = await colResponse.json();
    const rows = colData.values || [];
    console.log(`[Google Sheets Sync] Read ${rows.length} rows from range ${rangeParam}`);
    
    const parseSeq = (ctrl: string) => {
      if (!ctrl || !ctrl.trim()) return null;
      const cleanPattern = ctrl.trim().toUpperCase();
      // Remove any alphabetical prefixes and leading hyphens (e.g. PSD-26-561-D -> 26-561-D)
      const cleanWithoutLetters = cleanPattern.replace(/^[A-Z]+/g, '').replace(/^-/g, '');
      const m = cleanWithoutLetters.match(/^(?:\d+-)?(\d+)/) || cleanWithoutLetters.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    };
 
    const searchId = (appData.id || '').trim().toUpperCase();
    const newSeq = parseSeq(appData.id || '');
    console.log(`[Google Sheets Sync] Target ID for sync: '${searchId}', Parsed sequence: ${newSeq}`);
 
    let existingEmptyRowIndex = -1;
 
    // First check if a record with the exact same ID or matching sequence number already exists in the sheet to avoid duplicate rows
    for (let i = 0; i < rows.length; i++) {
      const val = isPAS ? rows[i]?.[1] : (isPGP ? rows[i]?.[4] : rows[i]?.[0]);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const ctrl = String(val).trim().toUpperCase();
        
        let isMatch = (ctrl === searchId);
        
        // Fallback to sequence number matching to handle edits where suffixes/prefixes (e.g. -D, -F, -P) might have changed
        if (!isMatch && newSeq !== null) {
          const rowSeq = parseSeq(ctrl);
          if (rowSeq !== null && rowSeq === newSeq) {
            isMatch = true;
          }
        }
        
        if (isMatch) {
          // If PAS or PGP, verify if it's actually the same record (provider & vessel matching) to avoid false-positive overwrites
          let isSameRecord = true;
          if (isPAS) {
            const existingRow = rows[i];
            const existingProvider = String(existingRow?.[2] || '').trim().toUpperCase();
            const existingVessel = String(existingRow?.[3] || '').trim().toUpperCase();
            const currentProvider = String(appData.serviceProviderName || '').trim().toUpperCase();
            const currentVessel = String(appData.vesselName || '').trim().toUpperCase();
            isSameRecord = existingProvider === currentProvider && existingVessel === currentVessel;
          } else if (isPGP) {
            const existingRow = rows[i];
            const existingClient = String(existingRow?.[6] || '').trim().toUpperCase();
            const existingVessel = String(existingRow?.[5] || '').trim().toUpperCase();
            const currentClient = String(appData.company || '').trim().toUpperCase();
            const currentVessel = String(appData.vesselName || '').trim().toUpperCase();
            isSameRecord = existingClient === currentClient && existingVessel === currentVessel;
          }
          
          if (isSameRecord) {
            existingEmptyRowIndex = i;
            break;
          }
        }
      }
    }
 
    finalControlNo = appData.id || '';
 
    if (existingEmptyRowIndex !== -1) {
      nextRowNumber = existingEmptyRowIndex + 1;
      console.log(`[Google Sheets Sync] Found existing matching control number at row index ${existingEmptyRowIndex}. Overwriting row ${nextRowNumber}`);
    } else {
      // Find the absolute last filled row in the sheet
      let lastFilledIndex = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row && row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
          lastFilledIndex = i;
          break;
        }
      }
      const fallbackFloor = isPAS ? 4 : (isPGP ? 5 : 481);
      nextRowNumber = Math.max(fallbackFloor, lastFilledIndex + 2);
      console.log(`[Google Sheets Sync] Append row number (absolute end of sheet): ${nextRowNumber}`);
    }
  } catch (err) {
    console.error("[Google Sheets Sync] Error in calculating target row index:", err);
    throw err; // Propagate the error so the caller knows the sheet update failed
  }
 
  const endCol = getColLetter(values && values[0] ? values[0].length : 1);
  const writeRange = `'${targetSheetName}'!A${nextRowNumber}:${endCol}${nextRowNumber}`;
 
  // When the vessel entry permit is approved, append the custom dynamic formula to the Vessel Status column (index 7).
  if (!isPAS && !isPGP && values && values[0] && values[0].length > 7) {
    values[0][7] = `=IF(D${nextRowNumber}="ANCHORAGE", IF(AND(AG${nextRowNumber}<>"",W${nextRowNumber}<=TODAY()),"DEPARTED","AT ANCHORAGE"), IF(W${nextRowNumber}>TODAY(),"ARRIVING", IF(AND(AG${nextRowNumber}<>"",W${nextRowNumber}<=TODAY()),"DEPARTED","BERTHED") ) )`;
  }
 
  // Update formulas with the dynamically calculated nextRowNumber
  if (isPAS && values && values[0]) {
    if (values[0].length > 0) values[0][0] = `=ROW()-3`;
  }
  if (isPGP && values && values[0]) {
    if (values[0].length > 0) values[0][0] = `=ROW()-4`;
    if (values[0].length > 3) values[0][3] = `=ROW()-4`;
  }
 
  // Ensure all string values are uppercase (allcaps), keeping formulas starting with '=' intact
  if (values && values.length > 0) {
    values = values.map(row =>
      row.map((cell, colIdx) => {
        if (typeof cell === 'string') {
          if (cell.startsWith('=')) {
            return cell;
          }
          // Preserve proper case for month/date columns in PAS and PGP
          if (isPAS && (colIdx === 9 || colIdx === 10 || colIdx === 19)) {
            return cell;
          }
          if (isPGP && (colIdx === 7 || colIdx === 8 || colIdx === 18)) {
            return cell;
          }
          return cell.toUpperCase();
        }
        return cell;
      })
    );
  }

  const body = {
    range: writeRange,
    majorDimension: 'ROWS',
    values: values,
  };

  // 3. Write specifically to that next row
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Sheets API Error: ${errorData.error?.message || response.statusText}`);
  }

  return { finalControlNo };
};

// Deletes an application record from the Google Sheet when it is reverted
export const deleteApplicationFromSheet = async (appData: VesselApplication): Promise<void> => {
  const currentToken = await getAccessToken();
  if (!currentToken) {
    throw new Error('No active Google Sheets connection. Connect your Google account first to sync records.');
  }

  const isPAS = appData.applicationType === 'PAS' || (typeof appData.id === 'string' && appData.id.toUpperCase().startsWith('PAS-'));
  const isPGP = appData.applicationType === 'PGP' || (typeof appData.id === 'string' && appData.id.toUpperCase().startsWith('PGP-'));
  const spreadsheetId = (isPAS || isPGP) ? getProcessMonitoringSpreadsheetId() : getVesselMasterSpreadsheetId();
  const targetGid = isPAS ? 185820608 : (isPGP ? 1459766226 : TARGET_GID);

  // 1. Get Spreadsheet metadata to find the sheet name
  const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`, {
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });

  if (!metaResponse.ok) {
    const metaError = await metaResponse.json();
    throw new Error(`Google Sheets API Error (getting metadata for deletion): ${metaError.error?.message || metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const sheetsList = metaData.sheets || [];
  const foundSheet = sheetsList.find((s: any) => Number(s.properties?.sheetId) === Number(targetGid));
  const defaultFallback = isPAS ? 'PORT ANCILLARY SERVICES' : (isPGP ? 'GATE PASS' : (sheetsList[0]?.properties?.title || 'Sheet1'));
  const targetSheetName = foundSheet?.properties?.title || defaultFallback;

  // 2. Read the key column (B:B for PAS, E:E for PGP, A:A for VEP/Others)
  const colToCheck = isPAS ? 'B:B' : (isPGP ? 'E:E' : 'A:A');
  const rangeParam = `'${targetSheetName}'!${colToCheck}`;
  const colResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`, {
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });

  if (!colResponse.ok) {
    const errorData = await colResponse.json();
    throw new Error(`Google Sheets API Error (reading column for deletion): ${errorData.error?.message || colResponse.statusText}`);
  }

  const colData = await colResponse.json();
  const rows = colData.values || [];

  const parseSeq = (ctrl: string) => {
    if (!ctrl || !ctrl.trim()) return null;
    const cleanPattern = ctrl.trim().toUpperCase();
    // Remove any alphabetical prefixes and leading hyphens (e.g. PSD-26-561-D -> 26-561-D)
    const cleanWithoutLetters = cleanPattern.replace(/^[A-Z]+/g, '').replace(/^-/g, '');
    const m = cleanWithoutLetters.match(/^(?:\d+-)?(\d+)/) || cleanWithoutLetters.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };

  const searchId = (appData.id || '').trim().toUpperCase();
  if (!searchId) {
    throw new Error('Application does not have a valid ID / Control Number needed to target the Google Sheets record');
  }
  const newSeq = parseSeq(appData.id || '');

  let foundRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const cellVal = String(rows[i]?.[0] || '').trim().toUpperCase();
    let isMatch = (cellVal === searchId);
    if (!isMatch && newSeq !== null) {
      const rowSeq = parseSeq(cellVal);
      if (rowSeq !== null && rowSeq === newSeq) {
        isMatch = true;
      }
    }
    if (isMatch) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) {
    console.warn(`Record with control number ${appData.id} was not found on the Google Sheet.`);
    return;
  }

  // 3. Delete the specific row using batchUpdate
  const deleteRequest = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: targetGid,
            dimension: "ROWS",
            startIndex: foundRowIndex,
            endIndex: foundRowIndex + 1
          }
        }
      }
    ]
  };

  const deleteResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    },
    body: JSON.stringify(deleteRequest)
  });

  if (!deleteResponse.ok) {
    const deleteErr = await deleteResponse.json();
    throw new Error(`Failed to delete row from Google Sheet: ${deleteErr.error?.message || deleteResponse.statusText}`);
  }
};

