# איך אפליקציה אחרת מזהה משתמש וקוראת את פרטי הצוות

אנשי הצוות של בית חינוך א.ד. גורדון מוגדרים במקום אחד: Firestore של פרויקט Firebase בשם `gordon-staff`.
ההנהלה מנהלת אותם באפליקציה הזו (https://asifbenish-tech.github.io/gordon-users/).
**אפליקציה חדשה לא מקימה רשימת ת"ז, מאגר משתמשים או שרת כניסה משלה. היא מושכת מכאן.**

## 1. הגדרות (ציבוריות, אפשר להעתיק)

```js
const AUTH_API = "https://script.google.com/macros/s/AKfycbybc8g3EQJ0Ki6YLg7WWwhsUGi_KlIEWcciPugCN0voO1S1INHxTZDHQ5oiPy64gLe0/exec";
const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const FIREBASE = {apiKey: "AIzaSyAXThb9nGkGSKH8ulaznf0ABgzJmlRxYEo", authDomain: "gordon-staff.firebaseapp.com", projectId: "gordon-staff",
  storageBucket: "gordon-staff.firebasestorage.app", messagingSenderId: "120741333798", appId: "1:120741333798:web:301e18ca732bd6bca9cfe7"};
const ID_SALT = "gordon-lohot-2026";
```

המקור המחייב: `js/config.js` בריפו הזה. אם כתובת שרת הכניסה תשתנה, היא תתעדכן שם.

## 2. זיהוי משתמש: ת"ז -> קוד במייל -> אסימון Firebase

תעודת הזהות לא יוצאת מהדפדפן. מגבבים אותה, ושולחים לשרת רק את הגיבוב.

```js
// א. גיבוב הת"ז (PBKDF2-SHA256, 100,000 איטרציות, 9 ספרות עם אפסים מובילים)
async function idHash(raw) {
  const id = String(raw).replace(/\D/g, "").padStart(9, "0"), enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(id), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: enc.encode(ID_SALT), iterations: 100000}, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// ב. קריאה לשרת הכניסה. חובה Content-Type של text/plain (כך הדפדפן לא שולח בקשת CORS מקדימה)
const api = body => fetch(AUTH_API, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(body)}).then(r => r.json());

const h = await idHash(tz);
const r1 = await api({a: "code", h});                 // {ok, to: "a•••@gmail.com", name} או {ok: false, error: "הודעה בעברית"}
const r2 = await api({a: "verify", h, c: "123456"});  // {ok, token, name} או {ok: false, error, expired?}

// ג. כניסה ל-Firebase עם האסימון
const {initializeApp} = await import(SDK + "firebase-app.js");
const A = await import(SDK + "firebase-auth.js");
const app = initializeApp(FIREBASE);
const auth = A.initializeAuth(app, {persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence]});
await A.signInWithCustomToken(auth, r2.token);
A.onAuthStateChanged(auth, user => { /* user.uid = מזהה איש הצוות; null = לא מחובר */ });
```

- את `error` מהשרת מציגים למשתמש כמו שהוא (עברית). `expired: true` = לחזור למסך הת"ז.
- מגבלות השרת: קוד בתוקף 10 דקות, 5 ניסיונות לקוד, 3 קודים לאדם ב-10 דקות.
- הכניסה נשמרת בדפדפן. אפליקציות שמתפרסמות תחת `asifbenish-tech.github.io` חולקות אותה:
  מי שנכנס באחת כבר מחובר בכולן (ויציאה מאחת מנתקת את כולן).
- באסימון חתומים `n` (השם הקצר) ו-`r` (התפקיד בזמן הכניסה). **את התפקיד העדכני קוראים מ-`staff/<uid>.role`**, לא מהאסימון.

## 3. קריאת פרטי הצוות

כל איש צוות מחובר (שלא נחסם) קורא את `staff` ואת `meta/groups`. רק ההנהלה כותבת.

```js
const Fs = await import(SDK + "firebase-firestore.js"), db = Fs.getFirestore(app);
const me = (await Fs.getDoc(Fs.doc(db, "staff", auth.currentUser.uid))).data();          // איש הצוות המחובר
const all = (await Fs.getDocs(Fs.collection(db, "staff"))).docs.map(d => ({uid: d.id, ...d.data()})).filter(p => !p.removed);
const groups = ((await Fs.getDoc(Fs.doc(db, "meta", "groups"))).data() || {}).list;      // [{id, label}]
```

| מסמך | שדות | הערות |
|---|---|---|
| `staff/<uid>` | `name` | השם הקצר = המזהה (השם בלוח המערכות). לא משתנה. |
| | `full?` | שם מלא לתצוגה. אם חסר: `full_names[name]` מ-`timetable.json`, ואם גם שם אין - `name`. |
| | `phone?` | טלפון נייד. גלוי לכל הצוות. |
| | `role?` | `admin` (הנהלה) / `coordinator` (ריכוז בית) / `teacher` (צוות הוראה) / `classes` (צוות, לא הוראה). חסר = `teacher`. |
| | `groups` | מזהי קבוצות: `hA`, `hB`, `hC` (בית א/ב/ג, אפשר כמה), `home` (מחנכים), `mgmt` (צוות ניהול), ועוד שההנהלה הוסיפה. |
| | `aliases?` | איך האדם נכתב באפליקציות אחרות ("רותי כ", "רות כהן"). לשימוש בהתאמת שמות חופשיים. |
| | `off?` | `true` = חסום. הכללים כבר חוסמים אותו מקריאה; להציג לו "אין גישה". |
| | `removed?` | `true` = הוסר מהצוות ("מצבה"). **לדלג עליו בכל רשימה.** |
| `meta/groups` | `list: [{id, label}]` | רשימת הקבוצות. אם המסמך לא קיים: חמש קבוצות ברירת המחדל (`DEFAULT_GROUPS` ב-`js/config.js`). |
| `staffAuth/<uid>` | `name, h: [גיבובי ת"ז], email, role` | **הנהלה ושרת הכניסה בלבד.** אפליקציה רגילה לא קוראת אותו. המייל לא גלוי לצוות. |

מי שנכנס ועדיין אין לו מסמך `staff` (למשל לפני הייבוא): התפקיד מהאסימון (`(await user.getIdTokenResult()).claims.r`),
והשם מפענוח המזהה (סעיף 4).

## 4. כללים

1. **מזהה איש צוות** = `t_` + hex של השם הקצר ב-UTF-8. לא להמציא מזהה אחר ולא לשמור ת"ז.
   ```js
   const uidOf = name => "t_" + [...new TextEncoder().encode(name)].map(b => b.toString(16).padStart(2, "0")).join("");
   const nameOf = uid => new TextDecoder().decode(new Uint8Array(uid.slice(2).match(/../g).map(h => parseInt(h, 16))));
   ```
2. **הרשאות לפי תפקיד או קבוצה** (למשל "רק מחנכים רואים"): בודקים ב-`staff/<uid>.role` / `.groups` בצד הלקוח,
   ואם המידע רגיש - גם בכלל ב-`firestore.rules` (הפונקציות `admin()` ו-`inGroup('home')` כבר קיימות שם).
3. **שם חופשי -> איש צוות** (שם שנכתב בגיליון): כינוי (`aliases`) > שם קצר / שם מלא > שם פרטי + תחילת שם משפחה.
   לא לנחש כששם המשפחה סותר. מימוש מוכן: `resolver()` ב-`js/data.js`. שם שלא זוהה - ההנהלה משייכת באפליקציה הזו (נשמר ככינוי).
4. **לא כותבים** ל-`staff`, `staffAuth`, `meta/groups` מאפליקציה אחרת. מי שצריך שדה נוסף על איש צוות - מוסיף אותו כאן.
5. **מידע משלה** אפליקציה שומרת באוסף משלה באותו מאגר: שורה בטבלה ב-`adgordon/INTEGRATION.md`, כלל ב-`adgordon/firestore.rules`,
   בדיקה ב-`adgordon/tests/rules.test.mjs`, ואסיף מדביק את הכללים בקונסול. אין פריסה אוטומטית.
6. **בחינם בלבד:** בלי Cloud Functions, בלי Cloud Storage. שרת = Google Apps Script.
7. **הריפו ציבורי:** אין תעודות זהות, מיילים או מפתחות בגיט.

## 5. מה אפליקציה חדשה צריכה לבקש מאסיף

כלום, אם היא רק מזהה משתמשים וקוראת את `staff`. אם היא שומרת מידע משלה - הדבקה אחת של `firestore.rules` בקונסול (סעיף 4.5).
