// עדכון עצמי לאיש צוות (קישור ציבורי שההנהלה שולחת). כניסה בת"ז, בלי קוד במייל:
// ממלאים מייל, טלפון וקבוצות, והבקשה נשלחת לאישור ההנהלה. שום דבר לא נכתב למאגר עד שמאשרים.
import {AUTH_API, DEMO, DEFAULT_GROUPS} from "./config.js";
import {$, esc, ls, uidOf, validId, validMail, normPhone} from "./util.js";
import {idHash} from "./hash.js";
import {seed} from "./demo.js";

const el = $("view");
let st = {s: "id"};   // id -> form -> done
const render = () => { el.innerHTML = view(); bind(); };
const err = m => '<div class="err" role="alert">' + esc(m) + "</div>";
const LOGO = '<div class="biglogo"><img src="logo.png" alt="סמל בית חינוך א.ד. גורדון" onerror="this.parentNode.remove()"></div>';

function view() {
  if (st.s === "done") return '<div class="card form"><div class="bigico ok"><i class="fa-solid fa-paper-plane"></i></div><h2>הפרטים נשלחו</h2>' +
    "<p>תודה " + esc(st.name) + "! הפרטים שמילאת ממתינים לאישור ההנהלה. אחרי האישור תוכל/י להיכנס לאפליקציות עם תעודת הזהות וקוד שיישלח למייל שעדכנת.</p>" +
    '<button type="button" class="btn ghost" id="again">עדכון פרטים של מישהו אחר</button></div>';
  if (st.s === "form") {
    const gs = st.all && st.all.length ? st.all : DEFAULT_GROUPS;
    return '<form class="card form wide" id="f" novalidate><h2>שלום ' + esc(st.name) + "</h2>" +
      '<p>כאן מעדכנים את פרטיך. הפרטים נשלחים לאישור ההנהלה.</p>' + (st.e ? err(st.e) : "") +
      '<label class="field"><span>מייל (לקבלת קוד הכניסה)</span><input name="email" type="email" dir="ltr" maxlength="80" required value="' + esc(st.email || "") + '"></label>' +
      '<label class="field"><span>טלפון נייד</span><input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="20" value="' + esc(st.phone || "") + '"></label>' +
      '<fieldset class="aud"><legend>לאילו קבוצות אני משתייך/ת (אפשר לסמן כמה)</legend>' +
      gs.map(g => '<label class="pill"><input type="checkbox" name="grp" value="' + esc(g.id) + '"' + ((st.groups || []).includes(g.id) ? " checked" : "") + "><span>" + esc(g.label) + "</span></label>").join("") + "</fieldset>" +
      '<button class="btn"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "שולח…" : "שליחה לאישור") + "</button></form>";
  }
  return '<form class="card form" id="f" novalidate>' + LOGO + "<h2>עדכון פרטים</h2>" +
    "<p>מזדהים בתעודת זהות, וממלאים מייל, טלפון וקבוצות. ההנהלה מאשרת, ואז אפשר להיכנס לאפליקציות.</p>" + (st.e ? err(st.e) : "") +
    '<label class="field code"><span>תעודת זהות</span><input id="lin" inputmode="numeric" autocomplete="off" maxlength="9" required value="' + esc(st.id || "") + '"></label>' +
    '<button class="btn"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "בודק…" : "המשך") + "</button>" +
    '<p class="hint">תעודת הזהות לא יוצאת מהמכשיר: נשלח רק קוד חד־כיווני שמחושב ממנה.</p></form>';
}

function bind() {
  const f = $("f");
  if (st.s === "done") { $("again").onclick = () => { st = {s: "id"}; render(); }; return; }
  f.onsubmit = st.s === "id" ? checkId : submit;
  const inp = $("lin"); if (inp && !st.busy) inp.focus();
}

async function checkId(e) {
  e.preventDefault();
  const id = String(new FormData(e.target).get("tz") || $("lin").value || "").replace(/\D/g, "");
  if (!validId(id)) { st.e = "מספר תעודת הזהות לא תקין. לבדוק את ההקלדה."; st.id = id; render(); return; }
  st = {s: "id", id, busy: true}; render();
  try {
    const h = await idHash(id), r = await call({a: "onboard", h});
    if (r.ok) st = {s: "form", id, h, name: r.name, email: r.email || "", phone: r.phone || "", groups: r.groups || [], all: r.all || []};
    else st = {s: "id", id, e: r.error};
  } catch (x) { st = {s: "id", id, e: "אין חיבור לשרת. לבדוק את האינטרנט ולנסות שוב."}; }
  render();
}

async function submit(e) {
  e.preventDefault();
  const fd = new FormData(e.target), email = String(fd.get("email") || "").trim(), phone = normPhone(String(fd.get("phone") || "").trim());
  if (!validMail(email)) { st.e = "צריך למלא כתובת מייל תקינה."; st.email = email; st.phone = phone; st.groups = fd.getAll("grp").map(String); render(); return; }
  st.busy = true; st.e = ""; st.email = email; st.phone = phone; st.groups = fd.getAll("grp").map(String); render();
  try {
    const r = await call({a: "onboard", save: true, h: st.h, email, phone, groups: st.groups});
    if (r.ok) st = {s: "done", name: st.name}; else { st.busy = false; st.e = r.error; }
  } catch (x) { st.busy = false; st.e = "השליחה נכשלה. לבדוק את האינטרנט ולנסות שוב."; }
  render();
}

async function call(body) {
  if (DEMO) return demo(body);
  const r = await fetch(AUTH_API, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(body)});
  return r.json();
}
// במצב הדגמה: מדמה את השרת מול נתוני הדוגמה ב-localStorage.
function demo(body) {
  const db = ls("guDemoData") || seed(), staff = db.staff || [], auth = db.staffAuth || [];
  const all = ((db.meta || []).find(x => x.id === "groups") || {}).list || DEFAULT_GROUPS;
  let a = auth.find(x => (x.h || []).includes(body.h));
  if (!a) a = auth.find(x => !x.email && x.id !== uidOf("אסיף")) || auth[1];   // הדגמה: נופל לאיש צוות בלי מייל
  if (!a) return {ok: false, error: "תעודת הזהות לא נמצאה ברשימת הצוות. לפנות לאסיף."};
  const p = staff.find(x => x.id === a.id) || {};
  if (!body.save) return {ok: true, name: a.name, email: a.email || "", phone: p.phone || "", groups: p.groups || [], all};
  db.pending = (db.pending || []).filter(x => x.id !== a.id);
  db.pending.push({id: a.id, uid: a.id, name: a.name, email: body.email, phone: body.phone, groups: (body.groups || []).filter(g => all.some(x => x.id === g)), at: Date.now()});
  ls("guDemoData", db);
  return {ok: true};
}
render();
