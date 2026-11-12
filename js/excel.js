// ייצוא רשימת הצוות לקובץ (xlsx / CSV) וייבוא חזרה, עם תצוגה מקדימה של השינויים לפני שמשהו נשמר.
// כלל הייבוא: תא ריק = בלי שינוי. יוצא מן הכלל: עמודות הקבוצות, שם "כן" = משויך וריק = לא משויך.
import {S} from "./state.js";
import {esc, uidOf, validId, validMail, normPhone, norm} from "./util.js";
import {groups, people, authOn, authOf, hashOwner, ROLES, roleLabel, saveStaff, saveAuth} from "./data.js";
import {idHash} from "./auth.js";
import {writeXlsx, writeCsv, readTable} from "./xlsx.js";
import {openDlg, closeDlg} from "./ui.js";

const H = {name: "שם קצר (מזהה)", full: "שם מלא", phone: "טלפון", email: "מייל", role: "תפקיד", aliases: "כינויים", tz: "תעודת זהות (רק לחדש או להחלפה)"};
const YES = /^(כן|v|x|✓|✔|1|true|\+)$/i;

function table() {
  const gs = groups(), on = authOn();
  return [[H.name, H.full, H.phone, ...(on ? [H.email, H.role] : []), ...gs.map(g => g.label), H.aliases, ...(on ? [H.tz] : [])],
    ...people().map(p => { const a = authOf(p.uid); return [p.name, p.full, p.phone, ...(on ? [a.email || "", roleLabel(a.role || p.role || "teacher")] : []), ...gs.map(g => p.groups.includes(g.id) ? "כן" : ""), p.aliases.join(", "), ...(on ? [""] : [])]; })];
}
export function exportFile(kind) {
  const blob = kind === "csv" ? new Blob([writeCsv(table())], {type: "text/csv;charset=utf-8"}) : new Blob([writeXlsx(table(), "צוות")], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a = document.createElement("a"), d = new Date();
  a.href = URL.createObjectURL(blob); a.download = "gordon-staff-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "." + kind;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// טבלה מהקובץ -> תוכנית שינויים: {items: [{p, isNew, staff: {}, auth: {}, notes: []}], warns: []}
async function plan(rows) {
  const head = rows[0].map(norm), find = f => head.findIndex(f), warns = [], items = [], seen = new Set(), on = authOn(), ps = people(), gs = groups();
  const ci = {
    name: find(h => /מזהה|שם קצר/.test(h)), full: find(h => h.includes("שם מלא")), phone: find(h => /טלפון|נייד/.test(h)), email: find(h => /מייל|דוא"?ל|mail/i.test(h)),
    role: find(h => h.includes("תפקיד")), aliases: find(h => h.includes("כינוי")), tz: find(h => /זהות|^תז/.test(h))
  };
  if (ci.name < 0) ci.name = find(h => h === "שם");
  if (ci.name < 0 && ci.full < 0) return {items, warns: ["לא נמצאה עמודת שם. השורה הראשונה בקובץ צריכה להיות שורת הכותרות, כמו בקובץ שמיוצא מכאן."]};
  const gcols = gs.map(g => ({g, i: head.indexOf(norm(g.label))})).filter(x => x.i >= 0);
  if (!on && (ci.email >= 0 || ci.tz >= 0 || ci.role >= 0)) warns.push('מייל, תעודת זהות ותפקיד לא ייובאו: קודם צריך ללחוץ "ייבוא רשימת הצוות" בראש המסך.');
  for (let y = 1; y < rows.length; y++) {
    const r = rows[y], v = k => ci[k] >= 0 ? r[ci[k]] || "" : "", line = "שורה " + (y + 1), name = v("name");
    let p = name ? ps.find(x => x.name === name) : ps.find(x => x.full === v("full"));
    if (!p && !name) { warns.push(line + ": חסר שם קצר (מזהה) - דילגנו."); continue; }
    const isNew = !p; if (isNew) p = {uid: uidOf(name), name, full: name, phone: "", groups: [], aliases: [], role: ""};
    if (seen.has(p.uid)) { warns.push(line + ": " + p.name + " מופיע/ה פעמיים - השורה השנייה לא נקראה."); continue; }
    seen.add(p.uid);
    const it = {p, isNew, staff: {}, auth: {}, notes: []}, a = authOf(p.uid), who = line + " (" + (v("full") || p.name) + "): ";
    if (v("full") && v("full") !== p.full) { it.staff.full = v("full"); it.notes.push("שם מלא: " + v("full")); }
    const phone = normPhone(v("phone")); if (phone && phone !== p.phone) { it.staff.phone = phone; it.notes.push("טלפון: " + phone); }
    const al = v("aliases").split(",").map(x => x.trim()).filter(Boolean); if (al.length && al.join() !== p.aliases.join()) { it.staff.aliases = al; it.notes.push("כינויים: " + al.join(", ")); }
    if (gcols.length) {
      const want = new Set(p.groups); for (const c of gcols) YES.test(r[c.i] || "") ? want.add(c.g.id) : want.delete(c.g.id);
      const list = gs.map(g => g.id).filter(id => want.has(id));
      for (const c of gcols) { const was = p.groups.includes(c.g.id), now = want.has(c.g.id); if (was !== now) it.notes.push((now ? "+ " : "− ") + c.g.label); }
      if (list.length !== p.groups.length || list.some(id => !p.groups.includes(id))) it.staff.groups = list;
    }
    if (on) {
      const email = v("email"); if (email && !validMail(email)) warns.push(who + "המייל \"" + email + "\" לא תקין - לא ייובא."); else if (email && email !== (a.email || "")) { it.auth.email = email; it.notes.push("מייל: " + email); }
      const rt = v("role"), role = rt && (ROLES.find(x => x[1] === rt || x[0] === rt) || [])[0];
      if (rt && !role) warns.push(who + "התפקיד \"" + rt + "\" לא מוכר - לא ייובא. האפשרויות: " + ROLES.map(x => x[1]).join(" / ") + ".");
      else if (role && role !== (a.role || p.role || "teacher")) { if (p.uid === S.user.uid) warns.push(who + "את התפקיד של עצמך אי אפשר לשנות מקובץ."); else { it.auth.role = role; it.notes.push("תפקיד: " + roleLabel(role)); } }
      const tz = v("tz").replace(/\D/g, "");
      if (tz && !validId(tz)) warns.push(who + "מספר תעודת הזהות לא תקין - לא ייובא.");
      else if (tz) { const h = await idHash(tz), owner = hashOwner(h) || (items.find(x => x.auth.h && x.auth.h[0] === h) || {p: {}}).p.uid;
        if (owner && owner !== p.uid) warns.push(who + "תעודת הזהות כבר רשומה אצל מישהו אחר - לא תיובא."); else if (!owner) { it.auth.h = [h]; it.notes.push((a.h || []).length ? "תעודת זהות: מוחלפת" : "תעודת זהות: נוספת"); } }
    }
    if (isNew || it.notes.length) items.push(it);
  }
  return {items, warns};
}

async function apply(items, onStep) {
  let done = 0;
  for (const it of items) {
    if (it.isNew) await saveStaff(it.p, Object.assign({groups: [], off: false, removed: false}, it.staff)); else if (Object.keys(it.staff).length) await saveStaff(it.p, it.staff);
    if (authOn() && (it.isNew || Object.keys(it.auth).length)) await saveAuth(it.p, it.auth);
    onStep(++done);
  }
}

export async function importFile(file) {
  let pl;
  try { const rows = await readTable(await file.arrayBuffer()); if (rows.length < 2) throw 0; pl = await plan(rows); }
  catch (e) { console.error(e); alert("לא הצלחנו לקרוא את הקובץ. צריך קובץ אקסל (xlsx) או CSV עם שורת כותרות, כמו הקובץ שמיוצא מכאן."); return; }
  const {items, warns} = pl, nNew = items.filter(x => x.isNew).length;
  const html = (warns.length ? '<div class="card note warn"><b><i class="fa-solid fa-triangle-exclamation"></i> לתשומת לב</b><ul>' + warns.map(w => "<li>" + esc(w) + "</li>").join("") + "</ul></div>" : "") +
    (items.length ? '<p class="hint">' + items.length + " אנשי צוות ישתנו" + (nNew ? ", מהם " + nNew + " חדשים" : "") + '. שום דבר עוד לא נשמר.</p><div class="tablewrap short"><table class="grid plan"><tbody>' +
      items.map(it => "<tr><th>" + esc(it.staff.full || it.p.full) + (it.isNew ? ' <span class="tag g-hA">חדש/ה</span>' : "") + "</th><td>" + (it.notes.map(esc).join(" · ") || "בלי פרטים נוספים") + "</td></tr>").join("") + "</tbody></table></div>"
      : '<div class="empty"><b>אין שינויים לייבא</b><span>הקובץ זהה למה שכבר שמור.</span></div>') +
    '<div class="dfoot"><span class="grow"></span><button type="button" class="btn ghost" data-close>' + (items.length ? "ביטול" : "סגירה") + "</button>" + (items.length ? '<button type="button" class="btn" id="igo">שמירת ' + items.length + " השינויים</button>" : "") + "</div>";
  openDlg("ייבוא מקובץ: " + file.name, html, d => {
    const go = d.querySelector("#igo"); if (!go) return;
    go.onclick = async () => {
      go.disabled = true;
      try { await apply(items, n => { go.textContent = "שומר… " + n + "/" + items.length; }); closeDlg(); }
      catch (e) { console.error(e); alert("הייבוא נעצר באמצע. לבדוק את האינטרנט ולייבא שוב את אותו קובץ - מה שכבר נשמר לא ייפגע."); closeDlg(); }
    };
  }, true);
}
