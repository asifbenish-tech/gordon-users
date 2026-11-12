// מאגר הצוות: ההאזנות והפעולות. אותם מסמכים ואותה התנהגות כמו ב-adgordon/js/data.js.
// המבנה מתועד ב-INTEGRATION.md; ההרשאות ב-adgordon/firestore.rules.
import {S, changed} from "./state.js";
import {watch, put, del} from "./store.js";
import {DEFAULT_GROUPS, TT_URL, DUTY_URL, DEMO} from "./config.js";
import {DEMO_TT, DEMO_DUTY} from "./demo.js";
import {uidOf, nameOf, heSort, norm} from "./util.js";

const HOUSE = {A: "hA", B: "hB", C: "hC"};
export const ROLES = [["teacher", "צוות הוראה"], ["classes", "צוות (לא הוראה)"], ["coordinator", "ריכוז בית"], ["admin", "הנהלה"]];
export const roleLabel = r => (ROLES.find(x => x[0] === r) || ["", ""])[1];
let started = false, adminOn = false;

// התפקיד: מה שמוגדר במאגר הצוות; עד שמוגדר - מה שהשרת חתם בכניסה
export const roleOf = () => { const d = (S.staff || []).find(x => x.id === S.user.uid); return (d && d.role) || S.user.role; };
export const isAdmin = () => !!S.user && roleOf() === "admin";
export const fullName = n => (S.T && S.T.full && S.T.full[n]) || n;
export const groups = () => (S.groupsDoc && Array.isArray(S.groupsDoc.list) ? S.groupsDoc.list : DEFAULT_GROUPS);
export const groupLabel = id => (groups().find(g => g.id === id) || {}).label || "";
// פרטי הכניסה מנוהלים כאן רק אחרי שהרשימה הישנה יובאה: כל עוד staffAuth ריק השרת עובד מול רשימת לוח המערכות,
// ואדם אחד במאגר היה נועל את כל השאר בחוץ.
export const authOn = () => !!S.auth && Object.keys(S.auth).length > 0;
export const authOf = uid => (S.auth && S.auth[uid]) || {};
// למי שייך גיבוב ת"ז (כדי לא לשייך אותה תעודה לשני אנשים)
export const hashOwner = h => { for (const [uid, a] of Object.entries(S.auth || {})) if ((a.h || []).includes(h)) return uid; return ""; };
export function loginState(p) {
  const a = authOf(p.uid), n = (a.h || []).length;
  if (p.off) return {ok: false, text: "חסום/ה"};
  if (!n) return {ok: false, text: "חסרה תעודת זהות"};
  if (!a.email) return {ok: false, text: "חסר מייל"};
  return {ok: true, text: "יכול/ה להיכנס"};
}

// כל אנשי הצוות: מי שמוגדר במאגר + כל מי שמופיע במערכת השעות
export function people() {
  const m = new Map();
  for (const n of Object.keys((S.T && S.T.teachers) || {})) m.set(uidOf(n), {uid: uidOf(n), name: n, groups: [], off: false});
  for (const d of S.staff || []) if (d.removed) m.delete(d.id); else m.set(d.id, {uid: d.id, name: d.name || nameOf(d.id), groups: (d.groups || []).filter(groupLabel), off: !!d.off, fullSet: d.full || "", aliases: d.aliases || [], role: d.role || "", phone: d.phone || ""});
  return [...m.values()].map(p => Object.assign({aliases: [], fullSet: "", role: "", phone: ""}, p, {full: p.fullSet || fullName(p.name)})).sort((a, b) => heSort(a.full, b.full));
}
export const person = uid => people().find(p => p.uid === uid) || {uid, name: nameOf(uid), full: fullName(nameOf(uid)), groups: [], aliases: [], role: "", phone: ""};

// ---- התאמת שם חופשי (כמו שנכתב בגיליון של אפליקציה אחרת) לאיש צוות ----
// סדר: כינוי שההנהלה הגדירה > שם קצר / שם מלא > שם פרטי + תחילת שם משפחה > שם פרטי יחיד. לא מנחש כששם המשפחה סותר.
export function resolver() {
  const ps = people(), exact = new Map();
  for (const p of ps) { exact.set(norm(p.name), p); exact.set(norm(p.full), p); }
  for (const p of ps) for (const a of p.aliases) exact.set(norm(a), p);
  const toks = p => norm(p.full).split(" "), cache = new Map();
  return raw => {
    const k = norm(raw); if (cache.has(k)) return cache.get(k);
    let hit = exact.get(k) || null;
    if (!hit) {
      const [first, ...rest] = k.split(" "), cands = ps.filter(p => toks(p)[0] === first || norm(p.name).split(" ")[0] === first);
      const loose = t => t.replace(/[יו]/g, ""), sur = p => toks(p).slice(1);   // כתיב חסר/מלא לא מפריד בין שמות משפחה
      const fit = rest.length ? cands.filter(p => rest.every(r => sur(p).some(t => loose(t).startsWith(loose(r))))) : cands.filter(p => norm(p.name) === first);
      hit = fit.length === 1 ? fit[0] : cands.length === 1 && (!rest.length || !sur(cands[0]).length) ? cands[0] : null;
    }
    cache.set(k, hit); return hit;
  };
}
// שמות מלוח השמירות שלא זוהו כאיש צוות
export function dutyUnmatched() {
  const res = resolver(), out = new Set();
  for (const r of (S.duty && S.duty.rows) || []) for (const names of r.days || []) for (const raw of names) if (!res(raw)) out.add(raw);
  return [...out].sort(heSort);
}
// ההנהלה קובעת ששם מהגיליון הוא איש צוות מסוים: נשמר ככינוי אצלו (ומוסר מאחרים)
export async function setAlias(raw, uid) {
  for (const p of people()) if (p.uid !== uid && p.aliases.some(a => norm(a) === norm(raw))) await saveStaff(p, {aliases: p.aliases.filter(a => norm(a) !== norm(raw))});
  const p = person(uid); await saveStaff(p, {aliases: [...p.aliases.filter(a => norm(a) !== norm(raw)), raw]});
}

export function loadSources() {
  if (DEMO) { S.T = DEMO_TT; S.duty = DEMO_DUTY; return; }
  fetch(TT_URL, {cache: "no-cache"}).then(r => r.json()).then(j => {
    const homes = {};   // מחנכ/ת -> {cls, house}: בסיס להצעת שיוך אוטומטית
    for (const lvl of [j.elementary || {}, j.junior || {}]) for (const [cls, v] of Object.entries(lvl)) if (v.home) homes[v.home] = {cls};
    for (const x of j.index || []) if (x.type === "house") for (const h of Object.values(homes)) if (x.classes.includes(h.cls)) h.house = x.id.split(":")[1];
    S.T = {teachers: j.teachers, full: j.full_names, homes}; changed();
  }).catch(() => {});
  fetch(DUTY_URL, {cache: "no-cache"}).then(r => r.json()).then(j => { S.duty = j; changed(); }).catch(() => {});
}

export function startData() {
  if (started) return; started = true;
  watch("staff", (list, err) => {
    if (err) { if (S.staff == null) S.denied = true; else S.err = "הקשר למאגר נותק. לבדוק את האינטרנט ולרענן את הדף."; changed(); return; }
    S.err = ""; S.staff = list;
    // פרטי הכניסה והקבוצות נטענים רק אצל הנהלה (הכללים חוסמים את staffAuth לכל השאר)
    if (isAdmin() && !adminOn) {
      adminOn = true;
      watch("staffAuth", l => { if (!l) return; S.auth = {}; for (const x of l) S.auth[x.id] = x; changed(); });
      watch("meta", l => { S.groupsDoc = (l || []).find(x => x.id === "groups") || {}; changed(); });
      watch("pending", l => { S.pending = (l || []).sort((a, b) => (a.at || 0) - (b.at || 0)); changed(); });
      loadSources();
    }
    changed();
  });
}

// ---- הפעולות ----
export const saveStaff = (p, patch) => put("staff", p.uid, Object.assign({name: p.name}, patch), true);
// פרטי כניסה: patch = {email?, role?, h?: [גיבובים]}. התפקיד נשמר גם ב-staff (שם כל האפליקציות קוראות אותו).
export async function saveAuth(p, patch) {
  const cur = authOf(p.uid);
  await put("staffAuth", p.uid, Object.assign({name: p.name, h: cur.h || [], email: cur.email || "", role: cur.role || p.role || "teacher"}, patch), true);
  if (patch.role) await saveStaff(p, {role: patch.role});
}
// הסרה מהצוות: המסמך נשאר כ"מצבה" חסומה (off + removed), כדי שמכשיר שעדיין מחובר ייחסם מיד ולא יירשם מחדש
export const removePerson = p => Promise.all([put("staff", p.uid, {name: p.name, groups: [], off: true, removed: true}), del("staffAuth", p.uid), del("photos", p.uid), del("push", p.uid)]);
export const saveGroups = list => put("meta", "groups", {list});
// בקשת עדכון עצמי: אישור כותב את המייל (staffAuth) ואת הטלפון והקבוצות (staff), ומוחק את הבקשה. דחייה רק מוחקת.
export const pendingList = () => S.pending || [];
export async function approvePending(req) {
  const p = person(req.uid);
  await saveStaff(p, Object.assign({phone: req.phone || "", groups: (req.groups || []).filter(groupLabel)}, req.full ? {full: req.full} : {}));
  if (req.email) await saveAuth(p, {email: req.email});
  await del("pending", req.uid);
}
export const rejectPending = req => del("pending", req.uid);
// הצעה ממערכת השעות: מחנכים -> "מחנכים" + הבית של הכיתה. רק מוסיף, לא מסיר.
export function suggestGroups() {
  const out = [];
  for (const p of people()) {
    const h = S.T && S.T.homes && S.T.homes[p.name]; if (!h) continue;
    const add = ["home", HOUSE[h.house]].filter(g => g && groupLabel(g) && !p.groups.includes(g));
    if (add.length) out.push({p, groups: [...p.groups, ...add]});
  }
  return out;
}
