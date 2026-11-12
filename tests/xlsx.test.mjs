// node tests/xlsx.test.mjs [קובץ xlsx חיצוני לבדיקת הקריאה]  - כתיבה וקריאה חוזרת של xlsx ו-CSV
import assert from "node:assert/strict";
import {readFileSync, writeFileSync} from "node:fs";
import {writeXlsx, readXlsx, readCsv, writeCsv, readTable} from "../js/xlsx.js";

const rows = [["שם (מזהה)", "טלפון", "מייל", "הערה"], ["רותי", "0501234567", "r@example.com", 'מרכאות " ופסיק, וגם <תג> & עוד'], ["דנה", "", "", "שורה\nשנייה"], ["יוסי", "012345678", "", ""]];
const x = writeXlsx(rows, "צוות");
assert.deepEqual(await readXlsx(x), rows);
assert.deepEqual(await readTable(x.buffer), rows);
assert.deepEqual(readCsv(writeCsv(rows)), rows);
assert.deepEqual(readCsv("a;b\r\n1;\"x;y\"\r\n"), [["a", "b"], ["1", "x;y"]]);
assert.deepEqual(await readTable(new TextEncoder().encode("שם,טלפון\nרותי,050\n").buffer), [["שם", "טלפון"], ["רותי", "050"]]);
if (process.argv[2]) console.log(JSON.stringify(await readTable(readFileSync(process.argv[2]).buffer)));
if (process.argv[3]) writeFileSync(process.argv[3], x);
console.log("xlsx/csv: ok");
