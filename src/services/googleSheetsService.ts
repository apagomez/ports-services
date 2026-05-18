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
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
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
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

const SPREADSHEET_ID = '1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA';
const RANGE = 'Sheet1!A1'; // The exact name depends on the sheet, assuming 'Sheet1' or we can just append to unstructured. Usually "Sheet1!A1" works for append.

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

  // The specified document has specific columns. We must map application data to the correct sheet columns.
  // 0: controlNo, 1: aveNumber, 2: month, 3: terminal, 4: voyageType, 5: vesselName, 6: voyageNo, 7: status,
  // 8: remarks, 9: purpose, 10: operation, 11: vesselType, 12: agent, 13: shippingLine, 14: consignee, 15: origin
  const dateObj = new Date(appData.createdAt);
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  
  const values = [
    [
      appData.id,                         // 0: controlNo
      '',                                 // 1: aveNumber
      monthNames[dateObj.getMonth()],     // 2: month
      appData.terminal || '',             // 3: terminal
      appData.voyageType || 'DOMESTIC',   // 4: voyageType
      appData.vesselName || '',           // 5: vesselName
      appData.voyageNo || '',             // 6: voyageNo
      appData.status || 'PENDING',        // 7: status
      '',                                 // 8: remarks
      '',                                 // 9: purpose
      '',                                 // 10: operation
      appData.vesselType || 'CARGO',      // 11: vesselType
      appData.agent || '',                // 12: agent
      '',                                 // 13: shippingLine
      '',                                 // 14: consignee
      appData.origin || '',               // 15: origin
      '',                                 // 16: nextPort
      '',                                 // 17: shipmentKind
      '0',                                // 18: passengers
      '',                                 // 19: registry
      '0',                                // 20: gt
      '',                                 // 21: motorized
      `${dateObj.getDate()}-${monthNames[dateObj.getMonth()].slice(0,3)}-${dateObj.getFullYear().toString().slice(-2)}`, // 22: arrivalDate
      '',                                 // 23: cargoDescription
      '0'                                 // 24: cargoVolumeMT
    ]
  ];

  const body = {
    values: values,
  };

  // 1. Get Spreadsheet metadata to find the name of the first sheet
  const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`, {
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });

  if (!metaResponse.ok) {
    const metaError = await metaResponse.json();
    throw new Error(`Google Sheets API Error (getting metadata): ${metaError.error?.message || metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const firstSheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';

  // 2. Append to the first sheet
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(firstSheetTitle)}!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
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
