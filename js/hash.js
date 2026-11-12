// גיבוב תעודת הזהות (PBKDF2-SHA256, 100 אלף איטרציות) - זהה ללוח המערכות ולאפליקציית הצוות.
// מודול נפרד כדי שגם עמוד העדכון העצמי (onboard) ישתמש בו בלי לטעון את כל מנגנון הכניסה.
import {ID_SALT, DEMO} from "./config.js";
export async function idHash(raw) {
  const id = String(raw).replace(/\D/g, "").padStart(9, "0"), enc = new TextEncoder();
  if (DEMO) return "demo-" + id;
  const key = await crypto.subtle.importKey("raw", enc.encode(id), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: enc.encode(ID_SALT), iterations: 100000}, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// הכתובת של עמוד העדכון העצמי (לשליחה לצוות)
export const onboardUrl = () => new URL("onboard.html", location.href).href;
