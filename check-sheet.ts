import fs from "fs";

async function run() {
  try {
    const res = await fetch("https://docs.google.com/spreadsheets/d/1-uW1UBucCT4VondGmlTo7hcgHVtbBPA_JE49qp-yntA/export?format=csv&gid=960645385");
    const text = await res.text();
    fs.writeFileSync("test.csv", text);
    console.log("Written length:", text.length);
    console.log("Lines 0-5:", text.split("\\n").slice(0, 5).join("\\n"));
  } catch(e) {
    console.error(e);
  }
}
run();
