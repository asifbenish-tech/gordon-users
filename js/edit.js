// חלונות העריכה: איש צוות (קיים / חדש) ורשימת הקבוצות.
import {S} from "./state.js";
import {esc, uidOf, rid, validId, validMail, normPhone} from "./util.js";
import {groups, people, person, authOn, authOf, hashOwner, loginState, ROLES, saveStaff, saveAuth, saveGroups, removePerson} from "./data.js";
import {idHash} from "./auth.js";
import {field, openDlg, closeDlg, tryDo} from "./ui.js";

const roleSel = cur => '<select name="role">' + ROLES.map(r => '<option value="' + r[0] + '"' + (r[0] === (cur || "teacher") ? " selected" : "") + ">" + r[1] + "</option>").join("") + "</select>";

// uid ריק = איש צוות חדש
export function editPerson(uid) {
  const isNew = !uid, p = isNew ? {uid: "", name: "", full: "", phone: "", groups: [], aliases: [], role: ""} : person(uid), me = !isNew && p.uid === S.user.uid;
  const a = authOf(p.uid), n = (a.h || []).length, st = loginState(p);
  const login = !authOn() ? '<p class="hint"><i class="fa-solid fa-circle-info"></i> מייל, תעודת זהות ותפקיד מוגדרים כאן אחרי "ייבוא רשימת הצוות" (בראש המסך).</p>' :
    "<h3>כניסה לאפליקציות</h3>" + (isNew ? "" : '<p class="state' + (st.ok ? "" : " bad") + '">' + esc(st.text) + (n > 1 ? " · " + n + " תעודות" : "") + "</p>") +
    '<div class="two">' + field("מייל לקבלת קוד הכניסה", '<input name="email" type="email" dir="ltr" maxlength="80" value="' + esc(a.email || "") + '">') +
    field(n ? "החלפת תעודת הזהות" : "תעודת זהות", '<input name="tz" inputmode="numeric" dir="ltr" maxlength="9" autocomplete="off"' + (n ? ' placeholder="ריק = בלי שינוי"' : "") + ">") + "</div>" +
    (me ? "" : field("תפקיד", roleSel(a.role || p.role), "רק \"הנהלה\" רואה את האפליקציה הזו ומנהל את הצוות.")) +
    '<p class="hint">תעודת הזהות לא נשמרת: הדפדפן הופך אותה לקוד חד־כיווני, ורק הוא נשמר. לכן אי אפשר להציג ת"ז קיימת, רק להחליף.</p>';
  const html = '<form id="pf" novalidate>' +
    (isNew ? field("שם קצר (המזהה)", '<input name="name" required maxlength="40" placeholder="למשל: רותי">', "השם שמזהה את האדם בכל האפליקציות. אם הוא מופיע בלוח המערכות - אותו שם בדיוק. אי אפשר לשנות אחר כך.")
      : '<p class="hint">המזהה (השם בלוח המערכות): <b>' + esc(p.name) + "</b></p>") +
    '<div class="two">' + field("שם מלא", '<input name="full" maxlength="50" value="' + esc(p.full) + '">') +
    field("טלפון נייד", '<input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="20" value="' + esc(p.phone) + '">') + "</div>" +
    '<fieldset class="aud"><legend>שיוך (אפשר לסמן כמה)</legend>' + groups().map(g => '<label class="pill"><input type="checkbox" name="grp" value="' + esc(g.id) + '"' + (p.groups.includes(g.id) ? " checked" : "") + "><span>" + esc(g.label) + "</span></label>").join("") + "</fieldset>" +
    field("כינויים באפליקציות אחרות (מופרדים בפסיק)", '<input name="aliases" maxlength="200" value="' + esc(p.aliases.join(", ")) + '" placeholder="למשל: רותי כ, רות כהן">') +
    login +
    (isNew || me ? "" : '<label class="check"><input type="checkbox" name="off"' + (p.off ? " checked" : "") + "> חסימת כניסה (מיידית, גם במכשיר שכבר מחובר)</label>") +
    '<div class="dfoot">' + (isNew || me ? "" : '<button type="button" class="btn danger" id="prm">הסרה מהצוות</button>') + '<span class="grow"></span><button type="button" class="btn ghost" data-close>ביטול</button><button class="btn" id="psave">' + (isNew ? "הוספה" : "שמירה") + "</button></div></form>";

  openDlg(isNew ? "איש צוות חדש" : p.full, html, d => {
    const f = d.querySelector("#pf"), btn = d.querySelector("#psave");
    f.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(f), v = k => String(fd.get(k) || "").trim(), tz = v("tz"), email = v("email");
      const t = isNew ? {uid: uidOf(v("name")), name: v("name"), role: ""} : p;
      if (isNew && !t.name) return alert("צריך למלא שם קצר.");
      if (isNew && people().some(x => x.name === t.name)) return alert("השם הזה כבר ברשימה.");
      if (email && !validMail(email)) return alert("כתובת המייל לא תקינה.");
      if (tz && !validId(tz)) return alert("מספר תעודת הזהות לא תקין. לבדוק את ההקלדה.");
      const off = fd.has("off");
      if (off && !p.off && !confirm("לחסום את הכניסה של " + p.full + "?\nהחסימה מיידית, גם במכשיר שכבר מחובר.")) return;
      btn.disabled = true;
      const ok = await tryDo(async () => {
        const h = tz ? await idHash(tz) : "", owner = h && hashOwner(h);
        if (owner && owner !== t.uid) throw "תעודת הזהות הזו כבר רשומה אצל " + person(owner).full + ".";
        const patch = {full: v("full"), phone: normPhone(v("phone")), groups: fd.getAll("grp").map(String), aliases: v("aliases").split(",").map(x => x.trim()).filter(Boolean)};
        if (isNew) Object.assign(patch, {off: false, removed: false}); else if (!me) patch.off = off;
        await saveStaff(t, patch);
        if (authOn()) await saveAuth(t, Object.assign({email}, fd.has("role") ? {role: v("role")} : {}, h ? {h: [h]} : {}));
      });
      if (ok) closeDlg(); else btn.disabled = false;
    };
    const rm = d.querySelector("#prm");
    if (rm) rm.onclick = async () => { if (confirm("להסיר את " + p.full + " מהצוות?\nהכניסה תיחסם והפרטים יימחקו. הודעות שכתב/ה יישארו.") && await tryDo(() => removePerson(p))) closeDlg(); };
    if (isNew) f.elements.name.focus();
  });
}

export function editGroups() {
  const ps = people(), count = id => ps.filter(p => p.groups.includes(id)).length;
  const html = '<form id="gf"><p class="hint">שינוי שם קבוצה לא משנה את השיוכים. מחיקת קבוצה מסירה אותה מכל האפליקציות (הודעות שנשלחו אליה לא יוצגו יותר).</p><div class="glist">' +
    groups().map(g => '<div class="grow1" data-id="' + esc(g.id) + '"><input name="label" required maxlength="30" value="' + esc(g.label) + '" aria-label="שם הקבוצה"><span class="none">' + count(g.id) + ' אנשי צוות</span><button type="button" class="del" data-delg aria-label="מחיקת הקבוצה"><i class="fa-solid fa-trash-can"></i></button></div>').join("") +
    '</div><div class="grow1 newg"><input id="gnew" maxlength="30" placeholder="קבוצה חדשה, למשל: רכזי מקצוע" aria-label="שם קבוצה חדשה"><button type="button" class="btn ghost small" id="gadd"><i class="fa-solid fa-plus"></i> הוספה</button></div>' +
    '<div class="dfoot"><span class="grow"></span><button type="button" class="btn ghost" data-close>סגירה</button><button class="btn">שמירת השמות</button></div></form>';
  openDlg("קבוצות", html, d => {
    const cur = () => [...d.querySelectorAll(".glist .grow1")].map(r => ({id: r.dataset.id, label: r.querySelector("input").value.trim()}));
    const save = async list => { if (list.some(g => !g.label)) return alert("לקבוצה חייב להיות שם."); if (new Set(list.map(g => g.label)).size < list.length) return alert("יש שתי קבוצות באותו שם."); if (await tryDo(() => saveGroups(list))) { S.groupsDoc = {list}; editGroups(); } };
    d.querySelector("#gf").onsubmit = e => { e.preventDefault(); save(cur()); };
    d.querySelector("#gadd").onclick = () => { const label = d.querySelector("#gnew").value.trim(); if (label) save([...cur(), {id: "g" + rid(), label}]); };
    d.querySelector("#gnew").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); d.querySelector("#gadd").click(); } };
    for (const b of d.querySelectorAll("[data-delg]")) b.onclick = () => { const id = b.closest(".grow1").dataset.id, g = groups().find(x => x.id === id); if (confirm("למחוק את הקבוצה \"" + g.label + "\"? (" + count(id) + " אנשי צוות משויכים)")) save(cur().filter(x => x.id !== id)); };
  });
}
