// הגדרות. שום דבר כאן אינו סוד (הריפו ציבורי). אותו מאגר ואותו שרת כניסה כמו אפליקציית הצוות (adgordon).
export const AUTH_API = "https://script.google.com/macros/s/AKfycbybc8g3EQJ0Ki6YLg7WWwhsUGi_KlIEWcciPugCN0voO1S1INHxTZDHQ5oiPy64gLe0/exec";   // adgordon/server/Code.gs
export const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
export const FIREBASE = {
  apiKey: "AIzaSyAXThb9nGkGSKH8ulaznf0ABgzJmlRxYEo",
  authDomain: "gordon-staff.firebaseapp.com",
  projectId: "gordon-staff",
  storageBucket: "gordon-staff.firebasestorage.app",
  messagingSenderId: "120741333798",
  appId: "1:120741333798:web:301e18ca732bd6bca9cfe7"
};
export const ID_SALT = "gordon-lohot-2026";   // אותו מלח כמו בלוח המערכות ובאפליקציית הצוות
// מקורות לקריאה בלבד: מערכת השעות (שמות מלאים, מחנכים) ולוח תורנות השמירה (שמות שלא זוהו)
export const TT_URL = "https://raw.githubusercontent.com/asifbenish-tech/gordon-timetable/master/timetable.json";
export const DUTY_URL = "https://asifbenish-tech.github.io/adgordon/data/duty.json";
export const STAFF_APP = "https://asifbenish-tech.github.io/adgordon/";
// מצב הדגמה: בלי שרת ובלי Firebase, נתוני דוגמה שנשמרים רק בדפדפן. ?demo=1, או ?demo=empty למאגר לפני ייבוא.
export const DEMO = (() => { try { const v = new URLSearchParams(location.search).get("demo"); if (v !== null) sessionStorage.setItem("guDemo", v || "1"); return sessionStorage.getItem("guDemo") || ""; } catch (e) { return ""; } })();
// קבוצות ברירת המחדל, כל עוד meta/groups לא נשמר. אותה רשימה כמו ב-adgordon.
export const DEFAULT_GROUPS = [
  {id: "hA", label: "בית א"}, {id: "hB", label: "בית ב"}, {id: "hC", label: "בית ג"},
  {id: "home", label: "מחנכים"}, {id: "mgmt", label: "צוות ניהול"}
];
