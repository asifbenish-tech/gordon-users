// המסך הראשי: רשימת אנשי הצוות (טבלה למחשב / כרטיסים לטלפון), חיפוש, סינון וכפתורי הפעולה.
import {S, onChange, changed} from "./state.js";
import {DEMO, STAFF_APP} from "./config.js";
import {$, esc} from "./util.js";
import {initAuth, loginHtml, bindLogin, signOut, api, idToken} from "./auth.js";
import {isAdmin, groups, people, person, authOn, authOf, loginState, roleLabel, saveStaff, saveAuth, suggestGroups, dutyUnmatched, setAlias} from "./data.js";
import {empty, tags, avatar, tryDo} from "./ui.js";
import {editPerson, editGroups} from "./edit.js";
import {exportFile, importFile} from "./excel.js";

const V = {q: "", flt: "", mode: window.innerWidth >= 900 ? "table" : "cards"};
const el = $("view");

function shown() {
  const s = V.q.trim().toLowerCase();
  return people().filter(p => {
    if (V.flt === "!none" ? p.groups.length : V.flt === "!login" ? loginState(p).ok : V.flt && !p.groups.includes(V.flt)) return false;
    return !s || [p.full, p.name, p.phone, authOf(p.uid).email || "", ...p.aliases].some(t => t.toLowerCase().includes(s));
  });
}
const pressed = (attr, list, cur) => list.map(x => '<button type="button" data-act="' + attr + '" data-v="' + esc(x.id) + '" aria-pressed="' + (x.id === cur) + '">' + esc(x.label) + "</button>").join("");

function topHtml() {
  const sug = suggestGroups();
  return (DEMO ? '<div class="demo"><b>מצב הדגמה.</b> שמות בדויים שנשמרים רק בדפדפן הזה.</div>' : "") +
    (S.err ? '<div class="err" role="alert">' + esc(S.err) + "</div>" : "") +
    (S.auth && !authOn() ? '<div class="card note warn"><b><i class="fa-solid fa-right-left"></i> להעביר את ניהול הכניסה לכאן</b><p>כרגע רשימת תעודות הזהות והמיילים מנוהלת בלוח המערכות ובגיליון המיילים. לחיצה אחת מעתיקה אותה לכאן, ומאותו רגע מוסיפים, מעדכנים ומסירים אנשי צוות רק מהמסך הזה. לוח המערכות עצמו לא משתנה.</p><div><button type="button" class="btn" data-act="ttimport">ייבוא רשימת הצוות</button></div></div>' : "") +
    (sug.length ? '<div class="card note"><b><i class="fa-solid fa-wand-magic-sparkles"></i> ' + sug.length + ' מחנכים עוד לא משויכים לפי מערכת השעות</b><p>שיוך לקבוצת "מחנכים" ולבית של הכיתה שלהם. הפעולה רק מוסיפה שיוכים.</p><div><button type="button" class="btn ghost" data-act="suggest">שיוך אוטומטי</button></div></div>' : "");
}
function chipsHtml() {
  const ps = people(), n = f => ps.filter(f).length;
  return pressed("flt", [{id: "", label: "הכל " + ps.length}, ...groups().map(g => ({id: g.id, label: g.label + " " + n(p => p.groups.includes(g.id))})),
    {id: "!none", label: "בלי שיוך " + n(p => !p.groups.length)}, ...(authOn() ? [{id: "!login", label: "לא יכולים להיכנס " + n(p => !loginState(p).ok)}] : [])], V.flt);
}
function listHtml() {
  const list = shown(), gs = groups(), on = authOn();
  if (!list.length) return empty("לא נמצאו אנשי צוות", V.q || V.flt ? "לנסות חיפוש או סינון אחר." : "");
  const st = p => { const s = loginState(p); return on || p.off ? '<span class="st' + (s.ok ? " ok" : "") + '"><i class="fa-solid ' + (s.ok ? "fa-circle-check" : p.off ? "fa-ban" : "fa-circle-exclamation") + '"></i> ' + esc(s.text) + "</span>" : ""; };
  const role = p => roleLabel(authOf(p.uid).role || p.role) || "";
  if (V.mode === "table") return '<div class="tablewrap"><table class="grid"><thead><tr><th>שם</th><th>טלפון</th>' + (on ? "<th>מייל</th>" : "") + "<th>תפקיד</th>" + (on ? "<th>כניסה</th>" : "") + gs.map(g => '<th class="g">' + esc(g.label) + "</th>").join("") + "</tr></thead><tbody>" +
    list.map(p => '<tr data-uid="' + esc(p.uid) + '"' + (p.off ? ' class="off"' : "") + '><th><button type="button" class="name" data-act="edit" title="עריכת הפרטים">' + esc(p.full) + "</button></th>" +
      '<td dir="ltr">' + esc(p.phone) + "</td>" + (on ? '<td dir="ltr">' + esc(authOf(p.uid).email || "") + "</td>" : "") + "<td>" + esc(role(p)) + "</td>" + (on ? "<td>" + st(p) + "</td>" : "") +
      gs.map(g => '<td class="g"><input type="checkbox" data-grp="' + esc(g.id) + '" aria-label="' + esc(p.full + " - " + g.label) + '"' + (p.groups.includes(g.id) ? " checked" : "") + "></td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  return '<div class="cards">' + list.map(p => '<button type="button" class="item' + (p.off ? " off" : "") + '" data-uid="' + esc(p.uid) + '" data-act="edit">' + avatar(p) + "<div><b>" + esc(p.full) + '</b><div class="tags">' + (tags(p.groups) || '<span class="none">בלי שיוך</span>') + "</div>" +
    '<span dir="ltr">' + esc([p.phone, authOf(p.uid).email].filter(Boolean).join(" · ")) + "</span>" + st(p) + '</div><i class="fa-solid fa-pen go"></i></button>').join("") + "</div>";
}
function extraHtml() {
  const un = S.duty ? dutyUnmatched() : [], ps = people();
  return un.length ? '<h3 class="month">שמות מלוח השמירות שלא זוהו</h3><p class="hint">בוחרים למי השם שייך, והוא נשמר ככינוי אצל איש הצוות. מי שעוד לא ברשימה: קודם מוסיפים אותו ב"איש צוות חדש".</p><div class="unlist">' + un.map(raw =>
    '<div class="item slim"><div><b>' + esc(raw) + '</b></div><select data-alias="' + esc(raw) + '" aria-label="שיוך של ' + esc(raw) + '"><option value="">לבחור איש צוות…</option>' + ps.map(p => '<option value="' + esc(p.uid) + '">' + esc(p.full) + "</option>").join("") + "</select></div>").join("") + "</div>" : "";
}

function refresh() {
  const a = document.activeElement, inList = $("list").contains(a), key = inList && a.dataset.grp ? [a.closest("[data-uid]").dataset.uid, a.dataset.grp] : null;
  $("top").innerHTML = topHtml();
  $("chips").innerHTML = chipsHtml();
  $("mode").innerHTML = pressed("mode", [{id: "table", label: "טבלה"}, {id: "cards", label: "כרטיסים"}], V.mode);
  const n = shown().length, all = people().length;
  $("count").textContent = n === all ? all + " אנשי צוות" : n + " מתוך " + all + " אנשי צוות";
  $("list").innerHTML = listHtml();
  if (key) { const c = $("list").querySelector('[data-uid="' + key[0] + '"] [data-grp="' + key[1] + '"]'); if (c) c.focus(); }
  if (!$("extra").contains(a)) $("extra").innerHTML = extraHtml();
}

function render() {
  const admin = !!S.user && S.staff != null && isAdmin();
  document.body.classList.toggle("in", admin);
  $("who").hidden = !S.user;
  if (S.user) $("whoname").textContent = S.staff ? person(S.user.uid).full : S.user.name;
  const msg = (icon, h, p) => '<div class="card form"><div class="bigico"><i class="fa-solid ' + icon + '"></i></div><h2>' + h + "</h2><p>" + p + '</p><a class="btn ghost" href="' + STAFF_APP + '">לאפליקציית הצוות</a></div>';
  if (!S.ready) el.innerHTML = '<p class="lead">טוען…</p>';
  else if (!S.user) { el.innerHTML = (S.err ? '<div class="err" role="alert">' + esc(S.err) + "</div>" : "") + loginHtml(); bindLogin(); }
  else if (S.denied) el.innerHTML = msg("fa-ban", "אין גישה", "הכניסה שלך למאגר הצוות חסומה. לפנות להנהלה.");
  else if (S.staff == null) el.innerHTML = (S.err ? '<div class="err" role="alert">' + esc(S.err) + "</div>" : "") + '<p class="lead">טוען…</p>';
  else if (!admin) el.innerHTML = msg("fa-user-lock", "להנהלה בלבד", "שלום " + esc(person(S.user.uid).full) + ". ניהול הצוות פתוח רק למי שתפקידו הנהלה.");
  else {
    if (!$("list")) el.innerHTML = '<div id="top" class="stack"></div><div class="tools"><input class="search" id="sq" type="search" placeholder="חיפוש לפי שם, טלפון או מייל" autocomplete="off">' +
      '<div class="seg" id="mode" role="group" aria-label="תצוגה"></div><span class="grow"></span>' +
      '<details class="menu"><summary class="btn ghost"><i class="fa-solid fa-file-excel"></i> אקסל</summary><div><button type="button" data-act="xlsx"><i class="fa-solid fa-download"></i> ייצוא לאקסל (xlsx)</button><button type="button" data-act="csv"><i class="fa-solid fa-download"></i> ייצוא ל-CSV</button><button type="button" data-act="pick"><i class="fa-solid fa-upload"></i> ייבוא מקובץ…</button>' +
      '<p class="hint">מייצאים, ממלאים טלפונים ומיילים באקסל, ומייבאים חזרה. לפני השמירה מוצגת רשימת השינויים.</p></div></details>' +
      '<button type="button" class="btn ghost" data-act="groups"><i class="fa-solid fa-layer-group"></i> קבוצות</button><button type="button" class="btn" data-act="new"><i class="fa-solid fa-user-plus"></i> איש צוות חדש</button></div>' +
      '<div class="chips" id="chips" role="group" aria-label="סינון"></div><p class="hint" id="count"></p><div id="list"></div><div id="extra" class="stack"></div><input type="file" id="file" accept=".xlsx,.csv,text/csv" hidden>';
    refresh();
  }
}

// ---- אירועים: האזנה אחת על כל המסך ----
el.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, menu = b.closest("details.menu"); if (menu) menu.open = false;
  if (act === "flt") { V.flt = b.dataset.v; refresh(); }
  else if (act === "mode") { V.mode = b.dataset.v; refresh(); }
  else if (act === "edit") editPerson(b.closest("[data-uid]").dataset.uid);
  else if (act === "new") editPerson("");
  else if (act === "groups") editGroups();
  else if (act === "xlsx" || act === "csv") exportFile(act);
  else if (act === "pick") $("file").click();
  else if (act === "suggest") {
    const list = suggestGroups();
    if (confirm("לשייך " + list.length + " מחנכים לקבוצת \"מחנכים\" ולבית של הכיתה שלהם?\nהפעולה רק מוסיפה שיוכים, ואפשר לשנות כל אחד אחר כך.")) tryDo(() => Promise.all(list.map(x => saveStaff(x.p, {groups: x.groups}))));
  } else if (act === "ttimport") {
    if (!confirm("לייבא את רשימת הצוות מלוח המערכות ומגיליון המיילים?\nמאותו רגע הכניסה לכל האפליקציות מנוהלת מכאן.")) return;
    b.disabled = true; b.textContent = "מייבא…";
    let r;
    if (DEMO) { await Promise.all(people().map(p => saveAuth(p, {h: ["demo-" + p.uid], email: ""}))); r = {ok: true, added: people().length}; }
    else try { r = await api({a: "import", t: await idToken()}); } catch (err) { r = {ok: false, error: "אין חיבור לשרת הכניסה. לבדוק את האינטרנט ולנסות שוב."}; }
    alert(r.ok ? "יובאו " + r.added + " אנשי צוות. מעכשיו הכניסה מנוהלת מהמסך הזה." : r.error);
    changed();
  }
});
el.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.grp) { const tr = t.closest("[data-uid]"), ok = await tryDo(() => saveStaff(person(tr.dataset.uid), {groups: [...tr.querySelectorAll("[data-grp]")].filter(x => x.checked).map(x => x.dataset.grp)})); if (!ok) refresh(); }
  else if (t.dataset.alias && t.value) { await tryDo(() => setAlias(t.dataset.alias, t.value)); t.blur(); refresh(); }
  else if (t.id === "file" && t.files[0]) { const f = t.files[0]; t.value = ""; importFile(f); }
});
el.addEventListener("input", e => { if (e.target.id === "sq") { V.q = e.target.value; refresh(); } });
document.addEventListener("click", e => { for (const m of document.querySelectorAll("details.menu[open]")) if (!m.contains(e.target)) m.open = false; });
$("out").onclick = signOut;
onChange(render);
render();
initAuth();
