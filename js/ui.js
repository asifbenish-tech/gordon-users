// חלקי תצוגה משותפים + חלון הדו-שיח היחיד של האפליקציה.
import {$, esc, hue} from "./util.js";
import {groupLabel} from "./data.js";

export const empty = (b, t) => '<div class="empty"><b>' + b + "</b>" + (t ? "<span>" + t + "</span>" : "") + "</div>";
export const field = (label, input, hint) => '<label class="field"><span>' + label + "</span>" + input + (hint ? "<small>" + hint + "</small>" : "") + "</label>";
export const tags = ids => ids.map(g => '<span class="tag g-' + esc(g) + '">' + esc(groupLabel(g)) + "</span>").join("");
export const avatar = p => '<span class="av" style="--h:' + hue(p.name) + '">' + esc(String(p.full || p.name || "?").charAt(0)) + "</span>";
// fn שזורק מחרוזת = הודעה למשתמש כמו שהיא
export async function tryDo(fn, failMsg) { try { await fn(); return true; } catch (e) { if (typeof e !== "string") console.error(e); alert(typeof e === "string" ? e : failMsg || "הפעולה נכשלה. לבדוק את האינטרנט ולנסות שוב."); return false; } }

// חלון אחד: נפתח עם כותרת ותוכן, נסגר ב-X / Esc / כפתור עם data-close. לא נסגר בלחיצה בחוץ, כדי לא לאבד הקלדה.
export function openDlg(title, html, bind, wide) {
  const d = $("dlg");
  d.className = wide ? "wide" : "";
  d.innerHTML = '<div class="dhead"><h2 id="dlgt">' + esc(title) + '</h2><button type="button" class="x" data-close aria-label="סגירה"><i class="fa-solid fa-xmark"></i></button></div><div class="dbody">' + html + "</div>";
  d.onclick = e => { if (e.target.closest("[data-close]")) d.close(); };
  if (!d.open) d.showModal();
  if (bind) bind(d);
}
export const closeDlg = () => { const d = $("dlg"); if (d.open) d.close(); };
