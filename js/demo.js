// נתוני הדוגמה של מצב ההדגמה (שמות בדויים). נשמרים רק ב-localStorage של הדפדפן.
import {DEMO} from "./config.js";
import {uidOf} from "./util.js";

const P = [["אסיף", "אסיף בניש", "admin", ["mgmt"]], ["רותי", "רותי כהן", "teacher", ["hA", "home"]], ["דנה", "דנה לוי", "teacher", ["hA"]],
  ["יוסי", "יוסי מזרחי", "coordinator", ["hB", "mgmt"]], ["מיכל", "מיכל אברהם", "teacher", []], ["נועה", "נועה פרץ", "teacher", ["hC", "home"]],
  ["אבי", "אבי שושן", "classes", []], ["תמר", "", "teacher", ["hB"]]];
export const DEMO_TT = {teachers: Object.fromEntries(P.map(p => [p[0], {}]).concat([["גלעד", {}]])), full: {"תמר": "תמר גולן", "גלעד": "גלעד שרון"}, homes: {"מיכל": {cls: "ה מיכל", house: "B"}}};
export const DEMO_DUTY = {rows: [{from: "09:40", to: "10:00", place: "חצר", days: [["רותי כהן", "דנה ל"], ["שלמה השומר"], ["יוסי"], [], [], []]}]};
export const DEMO_USERS = {admin: {uid: uidOf("אסיף"), name: "אסיף", role: "admin"}, teacher: {uid: uidOf("רותי"), name: "רותי", role: "teacher"}};

export function seed() {
  const empty = DEMO === "empty";
  return {
    staff: P.map((p, i) => Object.assign({id: uidOf(p[0]), name: p[0], groups: p[3], role: p[2]}, p[1] ? {full: p[1]} : {}, i % 2 ? {phone: "050-55501" + (10 + i)} : {}, p[0] === "אבי" ? {off: true} : {})),
    staffAuth: empty ? [] : P.map((p, i) => ({id: uidOf(p[0]), name: p[0], h: i === 4 ? [] : ["demo" + i], email: i === 2 || i === 7 ? "" : "user" + i + "@example.com", role: p[2]})),
    meta: []
  };
}
