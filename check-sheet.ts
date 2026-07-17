import fs from "fs";
import Papa from "papaparse";

async function run() {
  try {
    const res = await fetch("https://docs.google.com/spreadsheets/d/1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA/export?format=csv&gid=960645385");
    const text = await res.text();
    const parsed = Papa.parse(text, { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    
    console.log("--- Rows from index 550 to end ---");
    for (let i = 550; i < rows.length; i++) {
      const colA = rows[i][0] !== undefined ? `'${rows[i][0]}'` : 'undefined';
      const colF = rows[i][5] !== undefined ? `'${rows[i][5]}'` : 'undefined';
      console.log(`Row ${i + 1}: Col A (0): ${colA} | Col F (5): ${colF}`);
    }
  } catch(e) {
    console.error(e);
  }
}
run();
