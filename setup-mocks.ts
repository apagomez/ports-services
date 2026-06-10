import fs from "fs";
import path from "path";

// 1. Copy test.csv to local public folder as fallback
const testCsvExists = fs.existsSync("test.csv");
if (testCsvExists) {
  fs.mkdirSync("public", { recursive: true });
  fs.copyFileSync("test.csv", "public/vessels_mock.csv");
  console.log("Successfully copied test.csv to public/vessels_mock.csv");
} else {
  console.error("Warning: test.csv not found, cannot copy");
}

// 2. Generate public/payments_mock.csv
const months = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

const monthsShort = [
  "-Jan-", "-Feb-", "-Mar-", "-Apr-", "-May-", "-Jun-",
  "-Jul-", "-Aug-", "-Sep-", "-Oct-", "-Nov-", "-Dec-"
];

// Initialize empty grid of cells (50 rows, 25 columns)
const paymentGrid: string[][] = Array.from({ length: 50 }, () => Array(25).fill(""));

// Row 4: Summary totals
// Index 11: annualTotal, Index 12: vmfTotal, Index 13: tugboatTotal, Index 14: ancillaryTotalFromSummary
paymentGrid[4][11] = "₱115,483,920.00";
paymentGrid[4][12] = "₱3,842,500.00";
paymentGrid[4][13] = "₱2,985,000.00";
paymentGrid[4][14] = "₱1,654,000.00";

// Rows 1 to 12 (VMF): month index 16, value index 17
// Rows 5 to 16 (Tugboats): month index 19, value index 21
for (let i = 0; i < 12; i++) {
  // VMF
  paymentGrid[i + 1][16] = months[i];
  paymentGrid[i + 1][17] = `\u20b1${(300000 + i * 15000).toLocaleString()}.00`;

  // Tugboats
  paymentGrid[i + 5][19] = months[i];
  paymentGrid[i + 5][21] = `\u20b1${(220000 + i * 12000).toLocaleString()}.00`;
}

// Rows 28 to 39: Monthly breakdown
// Indices:
// 1: month, 2: portDues, 3: dockage, 4: anchorage, 5: pilotage, 7: usageFee, 8: anchorage_dom, 9: pilotage_dom
// 12: wharfage_foreign, 13: wharfage_foreign2, 14: wharfage_domestic, 15: wharfage_domestic2
// 17: total, 19: totalWithVat
for (let i = 0; i < 12; i++) {
  const r = 28 + i;
  paymentGrid[r][1] = months[i];
  
  // Port Dues, Dockage, Anchorage, Pilotage
  paymentGrid[r][2] = "420,000.00"; // portDues
  paymentGrid[r][3] = "310,000.00"; // dockage
  paymentGrid[r][4] = "150,000.00"; // anchorage
  paymentGrid[r][5] = "80,000.00";  // pilotage
  paymentGrid[r][6] = "0.00";
  
  // Domestic
  paymentGrid[r][7] = "290,000.00"; // usageFee
  paymentGrid[r][8] = "120,000.00"; // anchorage_dom
  paymentGrid[r][9] = "45,000.00";  // pilotage_dom
  paymentGrid[r][10] = "0.00";
  paymentGrid[r][11] = "0.00";
  
  // Wharfage
  paymentGrid[r][12] = "1,850,000.00"; // wharfage foreign 1
  paymentGrid[r][13] = "1,200,000.00"; // wharfage foreign 2
  paymentGrid[r][14] = "850,000.00";   // wharfage domestic 1
  paymentGrid[r][15] = "350,000.00";   // wharfage domestic 2
  
  const total = 420000 + 310000 + 150000 + 80000 + 290000 + 120000 + 45000 + 1850000 + 1200000 + 850000 + 350000;
  paymentGrid[r][17] = total.toFixed(2);
  paymentGrid[r][19] = (total * 1.12).toFixed(2);
}

const paymentCsvContent = paymentGrid.map(row => row.map(cell => {
  if (cell.includes(",") || cell.includes("\"") || cell.includes("\n") || cell.includes("₱")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}).join(",")).join("\n");

fs.writeFileSync("public/payments_mock.csv", paymentCsvContent);
console.log("Successfully created public/payments_mock.csv");

// 3. Generate public/ancillary_mock.csv
// Headers: skip 3 rows, so start from row 4
const ancillaryRows: string[][] = [
  ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  // Header names for documentation
  ["ID", "DATE", "CONTROL NO.", "PROVIDER", "PERMIT NO.", "PORT TERMINAL", "SERVICE TYPE", "VESSEL NAME", "AMOUNT", "VAT", "TOTAL", "STATUS", "APPLIED DATE", "MONTH OF APPLICATION"]
];

const mockProviders = ["FOSS MARITIME", "SMIT LAMNALCO", "HARBOR STAR", "MALAYAN TOWAGE", "SOLUTIONS PROVIDER"];
const mockTerminals = ["GNPD", "MPGC", "STC", "PCC", "MHC", "STC"];
const mockServices = ["TUGBOAT ASSISTANCE", "PILOTAGE SERVICES", "WATER SUPPLY", "GARBAGE COLLECTION", "SHORE POWER CONNECTION"];
const mockVessels = ["MV KATERINA III", "MV SL ROSE", "BARGE ATIRAJIA I", "MV RUI NING 20", "MV BONETTI", "MV SWEET LYDIA"];

for (let i = 0; i < 40; i++) {
  const monthIdx = i % 12;
  const amt = 15000 + (i * 2500);
  const vat = amt * 0.12;
  const total = amt + vat;
  const dateStr = `2026-05-${String((i % 28) + 1).padStart(2, '0')}`;
  
  ancillaryRows.push([
    String(1001 + i),                      // 0: ID
    dateStr,                              // 1: DATE
    `PSD-26-${String(i + 1).padStart(3, '0')}-D`, // 2: CONTROL NO.
    mockProviders[i % mockProviders.length], // 3: PROVIDER
    `PMT-55-${String(300 + i)}`,          // 4: PERMIT NO.
    mockTerminals[i % mockTerminals.length], // 5: PORT TERMINAL
    mockServices[i % mockServices.length],   // 6: SERVICE TYPE
    mockVessels[i % mockVessels.length],     // 7: VESSEL NAME
    amt.toString(),                       // 8: AMOUNT
    vat.toString(),                       // 9: VAT
    total.toString(),                     // 10: TOTAL
    "PAID",                               // 11: STATUS
    dateStr,                              // 12: APPLIED DATE
    monthsShort[monthIdx]                 // 13: MONTH OF APPLICATION
  ]);
}

const ancillaryCsvContent = ancillaryRows.map(row => row.map(cell => {
  if (cell.includes(",") || cell.includes("\"") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}).join(",")).join("\n");

fs.writeFileSync("public/ancillary_mock.csv", ancillaryCsvContent);
console.log("Successfully created public/ancillary_mock.csv");
