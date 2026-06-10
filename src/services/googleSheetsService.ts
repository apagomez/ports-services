import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { VesselApplication } from '../types';

if (!firebaseConfig) {
  console.error("firebase-applet-config.json is missing");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

let isSigningIn = false;

// Attempt to restore token from localStorage at startup to avoid re-logging in on every hot-reload/refresh
let cachedAccessToken: string | null = null;
try {
  const token = localStorage.getItem('google_sheets_access_token');
  const savedAt = localStorage.getItem('google_sheets_access_token_saved_at');
  if (token && savedAt) {
    const ageMs = Date.now() - parseInt(savedAt, 10);
    if (ageMs < 55 * 60 * 1000) { // Valid for 55 minutes
      cachedAccessToken = token;
    } else {
      localStorage.removeItem('google_sheets_access_token');
      localStorage.removeItem('google_sheets_access_token_saved_at');
    }
  }
} catch (e) {
  console.warn("Could not load access token from localStorage:", e);
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        let directToken: string | null = null;
        try {
          directToken = localStorage.getItem('google_sheets_access_token');
        } catch {}
        if (directToken) {
          cachedAccessToken = directToken;
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem('google_sheets_access_token', cachedAccessToken);
      localStorage.setItem('google_sheets_access_token_saved_at', Date.now().toString());
    } catch (e) {
      console.warn("Could not save access token to localStorage:", e);
    }
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
  try {
    const token = localStorage.getItem('google_sheets_access_token');
    const savedAt = localStorage.getItem('google_sheets_access_token_saved_at');
    if (token && savedAt) {
      const ageMs = Date.now() - parseInt(savedAt, 10);
      if (ageMs < 55 * 60 * 1000) {
        cachedAccessToken = token;
        return token;
      }
    }
  } catch (e) {}
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    localStorage.removeItem('google_sheets_access_token');
    localStorage.removeItem('google_sheets_access_token_saved_at');
  } catch (e) {}
};

const SPREADSHEET_ID = '1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA';
const TARGET_GID = 960645385;

// Appends data to the user Google Sheet
export const appendApplicationToSheet = async (appData: VesselApplication): Promise<void> => {
  const token = await getAccessToken();
  let currentToken = token;
  if (!currentToken) {
    const result = await googleSignIn();
    if (!result || !result.accessToken) {
      throw new Error('Not authenticated with Google Workspace');
    }
    currentToken = result.accessToken;
  }

  const isPAS = appData.applicationType === 'PAS';
  const spreadsheetId = isPAS ? '1SF3CmSAY63C4AzoRWKLjp04ejwhSF3pZyD4M8WC4Fao' : SPREADSHEET_ID;
  const targetGid = isPAS ? 185820608 : TARGET_GID;

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
  const foundSheet = sheetsList.find((s: any) => s.properties?.sheetId === targetGid);
  const targetSheetName = foundSheet?.properties?.title || sheetsList[0]?.properties?.title || 'Sheet1';

  // Format the helper dates and fields
  const dateObj = new Date(appData.createdAt || Date.now());
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  
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

  let values: any[][];

  if (isPAS) {
    const formatPASDate = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = d.getDate();
        const monthShort = monthNames[d.getMonth()].slice(0, 3);
        const year = d.getFullYear();
        // Format as "8-Oct-2026"
        return `${day}-${monthShort.charAt(0).toUpperCase()}${monthShort.slice(1).toLowerCase()}-${year}`;
      } catch {
        return dateStr || '';
      }
    };

    const checkerNameAbbrev = appData.checkedByName ? appData.checkedByName.replace(/[^A-Za-z]/g, '') : 'ECD';
    const approverNameAbbrev = appData.approvedByName ? appData.approvedByName.replace(/[^A-Za-z]/g, '') : 'JPM';

    const formatTimeStr = (dateStr?: string) => {
      if (!dateStr) return '10:15';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '10:15';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch {
        return '10:15';
      }
    };

    const appDateStr = formatPASDate(appData.createdAt);
    const releaseDateStr = formatPASDate(appData.approvedAt || appData.createdAt);

    values = [
      [
        '',                             // 0
        '',                             // 1
        '',                             // 2
        '',                             // 3: NO.
        appData.id || '',               // 4: CONTROL NO.
        appData.serviceProviderName || '', // 5: SERVICE PROVIDER
        appData.vesselName || '',       // 6: VESSEL NAME
        appData.voyageNo || '',         // 7: VOYAGE NO.
        appData.terminal || '',         // 8: PORT TERMINAL
        'YES',                          // 9: ACCREDITATION (Y/N)
        appData.selectedServices?.join(', ') || appData.vesselOperations || '', // 10: SERVICE
        appData.otherServiceSpecify || appData.detailsOfService || '', // 11: REMARKS
        appDateStr,                     // 12: DATE OF APPLICATION
        monthNames[dateObj.getMonth()].charAt(0).toUpperCase() + monthNames[dateObj.getMonth()].slice(1).toLowerCase(), // 13: Month
        '10:14',                        // 14: TIME IN (1)
        '10:15',                        // 15: TIME OUT (1)
        '0:01',                         // 16: CHECKING PROCESSING TIME (IN MINS)
        checkerNameAbbrev || 'JAMP',    // 17: ASSIGNED PERSONNEL FRONTLINE
        '10:15',                        // 18: TIME IN (2)
        '10:16',                        // 19: TIME OUT (2)
        '0:01',                         // 20: APPROVING PROCESSING TIME (IN MINS)
        approverNameAbbrev || 'JPM',    // 21: ASSIGNED APPROVER
        releaseDateStr,                 // 22: DATE
        formatTimeStr(appData.approvedAt || appData.createdAt), // 23: TIME
        '0:01',                         // 24: RELEASING PROCESSING TIME (IN MINS)
        '0:03',                         // 25: PROCESSING TIME IN MINS
        '5',                            // 26: RATING (Q)
        '5',                            // 27: RATING (T)
        checkerNameAbbrev || 'JAMP',    // 28: ISSUED BY
        appData.submitterName || 'REPRESENTATIVE' // 29: RECEIVED BY
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
        formatSheetDate(appData.departureDate), // 27: DEPARTURE DATE / LAST LINE
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
  const colToCheck = isPAS ? 'E:E' : 'A:A';
  let nextRowNumber = isPAS ? 4 : 481; // Safe fallback number
  try {
    const colResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetSheetName)}!${colToCheck}`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });
    if (colResponse.ok) {
      const colData = await colResponse.json();
      const rows = colData.values || [];
      
      const parseSeq = (ctrl: string) => {
        if (!ctrl || !ctrl.trim()) return null;
        if (isPAS) {
          const cleanPattern = ctrl.trim().toUpperCase();
          const m = cleanPattern.match(/PAS-(\d+)-(\d+)/i) || cleanPattern.match(/PAS-26-(\d+)/i) || cleanPattern.match(/PAS-(\d+)/i);
          if (m) {
            return parseInt(m[m.length - 1], 10);
          }
          return null;
        } else {
          if (!ctrl.trim().startsWith('PSD-')) return null;
          const m = ctrl.trim().match(/PSD-(\d+)-(\d+)/i);
          return m ? parseInt(m[2], 10) : null;
        }
      };

      const newSeq = parseSeq(appData.id || '');

      let insertIndex = -1;
      let lastCheckIdx = -1;

      for (let i = 0; i < rows.length; i++) {
        const val = rows[i]?.[0];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const ctrl = String(val).trim();
          const prefixMatch = isPAS ? (ctrl.toUpperCase().includes('PAS-') || ctrl.toUpperCase().includes('PS-')) : ctrl.toUpperCase().startsWith('PSD-');
          if (prefixMatch) {
            lastCheckIdx = i;
            if (newSeq !== null) {
              const seq = parseSeq(ctrl);
              if (seq !== null && seq > newSeq) {
                insertIndex = i;
                break;
              }
            }
          }
        }
      }

      let targetRowIndex = -1;
      if (insertIndex !== -1) {
        targetRowIndex = insertIndex;
      } else if (lastCheckIdx !== -1) {
        targetRowIndex = lastCheckIdx + 1;
      } else {
        let lastFilledIndex = -1;
        for (let i = rows.length - 1; i >= 0; i--) {
          const val = rows[i]?.[0];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            lastFilledIndex = i;
            break;
          }
        }
        targetRowIndex = lastFilledIndex !== -1 ? lastFilledIndex + 1 : rows.length;
      }

      // Insert a blank row at targetRowIndex to preserve order
      try {
        const insertRequest = {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: targetGid,
                  dimension: "ROWS",
                  startIndex: targetRowIndex,
                  endIndex: targetRowIndex + 1
                },
                inheritFromBefore: true
              }
            }
          ]
        };

        const insertResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify(insertRequest)
        });

        if (!insertResponse.ok) {
          const insertErr = await insertResponse.json();
          console.warn("Failed to insert row via batchUpdate, writing directly instead:", insertErr);
        }
      } catch (insertErr) {
        console.warn("Failed to insert row, writing directly:", insertErr);
      }

      nextRowNumber = targetRowIndex + 1; // index + 1 points to the newly inserted row of the 1-indexed sheet
    }
  } catch (err) {
    console.warn("Failed to find exact last row, using fallback:", err);
  }

  const writeRange = `${targetSheetName}!A${nextRowNumber}`;

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
};
