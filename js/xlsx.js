// קריאה וכתיבה של טבלה פשוטה בקובץ xlsx או CSV, בלי ספריות חיצוניות.
// טבלה = מערך של שורות, כל שורה מערך של מחרוזות. עובד בדפדפן וב-Node (לבדיקות).
const enc = new TextEncoder(), dec = new TextDecoder();
const xesc = t => String(t).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const xdec = t => t.replace(/&(lt|gt|quot|apos|amp|#x[0-9a-f]+|#\d+);/gi, (m, e) => ({lt: "<", gt: ">", quot: '"', apos: "'", amp: "&"}[e.toLowerCase()] || String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))));
const col = i => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
const colNum = s => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const join = parts => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

let crcT;
function crc32(u8) {
  if (!crcT) { crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// ZIP בלי דחיסה (store) - מספיק לקבצים קטנים
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data), n = data.length;
    const h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, nm.length, true);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nm, data); central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + n;
  }
  const cd = join(central), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cd.length, true); e.setUint32(16, off, true);
  return join([...parts, cd, new Uint8Array(e.buffer)]);
}

// כל התאים בפורמט "טקסט", כדי שאקסל לא ימחק 0 בתחילת טלפון או ת"ז. שורה ראשונה = כותרת מודגשת וקפואה.
export function writeXlsx(rows, sheetName) {
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const n = Math.max(1, ...rows.map(r => r.length));
  const widths = Array.from({length: n}, (_, i) => Math.min(40, Math.max(10, ...rows.map(r => String(r[i] || "").length + 3))));
  const sheet = X + '<worksheet xmlns="' + M + '"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>' +
    widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" style="1" customWidth="1"/>').join("") + "</cols><sheetData>" +
    rows.map((r, y) => '<row r="' + (y + 1) + '">' + Array.from({length: n}, (_, x) => { const v = r[x] == null ? "" : String(r[x]), a = ' r="' + col(x) + (y + 1) + '" s="' + (y ? 1 : 2) + '"';
      return v ? "<c" + a + ' t="inlineStr"><is><t xml:space="preserve">' + xesc(v) + "</t></is></c>" : "<c" + a + "/>"; }).join("") + "</row>").join("") + "</sheetData></worksheet>";
  return zip([
    ["[Content_Types].xml", X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ["_rels/.rels", X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", X + '<workbook xmlns="' + M + '" xmlns:r="' + R + '"><sheets><sheet name="' + xesc(sheetName || "גיליון1") + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + '/styles" Target="styles.xml"/></Relationships>'],
    ["xl/styles.xml", X + '<styleSheet xmlns="' + M + '"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ["xl/worksheets/sheet1.xml", sheet]
  ]);
}

async function inflate(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); }
// מחזיר פונקציה שקוראת קובץ מתוך ה-ZIP כטקסט (או "" אם אינו קיים)
function unzip(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), files = new Map();
  let e = u8.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip");
  let p = v.getUint32(e + 16, true);
  for (let i = v.getUint16(e + 10, true); i > 0 && v.getUint32(p, true) === 0x02014b50; i--) {
    const nl = v.getUint16(p + 28, true);
    files.set(dec.decode(u8.subarray(p + 46, p + 46 + nl)), {m: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), at: v.getUint32(p + 42, true)});
    p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return async name => {
    const f = files.get(name); if (!f) return "";
    const s = f.at + 30 + v.getUint16(f.at + 26, true) + v.getUint16(f.at + 28, true), raw = u8.subarray(s, s + f.size);
    return dec.decode(f.m === 8 ? await inflate(raw) : raw);
  };
}

export async function readXlsx(u8) {
  const get = unzip(u8), texts = x => [...x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => xdec(m[1])).join("");
  const shared = [...(await get("xl/sharedStrings.xml")).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
  // הגיליון הראשון לפי סדר הלשוניות
  const rid = ((await get("xl/workbook.xml")).match(/<sheet\b[^>]*?r:id="([^"]+)"/) || [])[1];
  const rel = [...(await get("xl/_rels/workbook.xml.rels")).matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => t.includes('Id="' + rid + '"'));
  const target = rel ? rel.match(/Target="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, "xl/") : "xl/worksheets/sheet1.xml";
  const xml = await get(target) || await get("xl/worksheets/sheet1.xml");
  if (!xml) throw new Error("sheet");
  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const y = +((rm[1].match(/\br="(\d+)"/) || [])[1] || rows.length + 1) - 1, row = rows[y] = rows[y] || []; let x = 0;
    for (const cm of (rm[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cm[1].match(/\br="([A-Z]+)\d+"/), t = (cm[1].match(/\bt="(\w+)"/) || [])[1], body = cm[2] || "";
      if (ref) x = colNum(ref[1]);
      const raw = xdec((body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || ["", ""])[1]);
      row[x++] = t === "s" ? shared[+raw] || "" : t === "inlineStr" ? texts(body) : /^-?[\d.]+E[+-]?\d+$/i.test(raw) ? String(Number(raw)) : raw;
    }
  }
  return tidy(rows);
}

export function readCsv(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0], d = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && !cell) q = true;
    else if (c === d) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return tidy(rows);
}
// BOM בתחילת הקובץ כדי שאקסל יזהה עברית
export const writeCsv = rows => "﻿" + rows.map(r => r.map(v => { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",")).join("\r\n") + "\r\n";

const tidy = rows => Array.from(rows, r => Array.from(r || [], v => String(v == null ? "" : v).trim())).filter(r => r.some(Boolean));

// קובץ שהמשתמש בחר -> טבלה. xlsx לפי החתימה "PK"; אחרת CSV (UTF-8, ואם אינו תקין - קידוד העברית הישן של אקסל).
export async function readTable(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0x50 && u8[1] === 0x4b) return readXlsx(u8);
  let text; try { text = new TextDecoder("utf-8", {fatal: true}).decode(u8); } catch (e) { text = new TextDecoder("windows-1255").decode(u8); }
  return readCsv(text);
}
