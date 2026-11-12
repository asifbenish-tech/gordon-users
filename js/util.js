export const $ = id => document.getElementById(id);
export const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
// localStorage בטוח: ls(k) קורא, ls(k, v) כותב, ls(k, null) מוחק
export const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
// מזהה משתמש = t_ + hex של השם הקצר ב-UTF-8 (כמו בשרת הכניסה ובכל האפליקציות)
export const uidOf = name => "t_" + [...new TextEncoder().encode(name)].map(b => b.toString(16).padStart(2, "0")).join("");
export const nameOf = uid => { try { return new TextDecoder().decode(new Uint8Array(uid.slice(2).match(/../g).map(h => parseInt(h, 16)))); } catch (e) { return ""; } };
export const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const heSort = (a, b) => a.localeCompare(b, "he");
export const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
export const norm = s => String(s || "").replace(/[-־'׳"״.]/g, "").replace(/\s+/g, " ").trim();
// ספרת הביקורת של תעודת זהות ישראלית - תופס טעויות הקלדה
export const validId = raw => { const id = String(raw).replace(/\D/g, ""); if (id.length < 5 || id.length > 9) return false; return [...id.padStart(9, "0")].reduce((sum, ch, i) => { const n = +ch * (i % 2 + 1); return sum + (n > 9 ? n - 9 : n); }, 0) % 10 === 0; };
export const validMail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
// אקסל מוחק את ה-0 בתחילת מספר טלפון: 9 ספרות בלי 0 מקבלות אותו בחזרה
export const normPhone = raw => { const s = String(raw || "").trim(); return /^[1-9]\d{7,8}$/.test(s) ? "0" + s : s; };
