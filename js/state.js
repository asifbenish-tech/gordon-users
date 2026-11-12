// המצב המשותף. null = עוד לא נטען.
export const S = {
  ready: false,      // כבר ידוע אם יש משתמש מחובר
  user: null,        // {uid, name, role}
  denied: false,     // המאגר סירב לקריאה (משתמש חסום)
  T: null,           // מערכת השעות: {teachers, full, homes}
  staff: null,       // staff/*: [{id, name, full?, phone?, role?, groups, aliases?, off?, removed?}]
  auth: null,        // staffAuth/*: {uid: {h: [גיבובי ת"ז], email, role}}
  groupsDoc: null,   // meta/groups
  pending: null,     // pending/*: בקשות עדכון עצמי שממתינות לאישור
  duty: null,        // לוח תורנות השמירה (מ-adgordon), לזיהוי שמות שלא שויכו
  err: ""
};
const subs = new Set();
export const onChange = f => subs.add(f);
export const changed = () => subs.forEach(f => f());
