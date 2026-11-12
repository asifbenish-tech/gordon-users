// שכבת הנתונים: Firestore, או הדפדפן עצמו במצב הדגמה. אותו ממשק לשניהם.
//   watch(path, cb) -> unsub      put(path, id, obj, merge)      del(path, id)
import {SDK, DEMO} from "./config.js";
import {ls} from "./util.js";
import {seed} from "./demo.js";

let impl = null;
export const watch = (path, cb) => impl.watch(path, cb);
export const put = (path, id, obj, merge) => impl.put(path, id, obj, !!merge);
export const del = (path, id) => impl.del(path, id);
export async function openStore(fbApp) { if (!impl) impl = DEMO ? demoStore() : await fireStore(fbApp); }

async function fireStore(fbApp) {
  const Fs = await import(SDK + "firebase-firestore.js"), db = Fs.getFirestore(fbApp);
  return {
    watch: (path, cb) => Fs.onSnapshot(Fs.collection(db, path), snap => cb(snap.docs.map(d => Object.assign({id: d.id}, d.data()))), err => cb(null, err)),
    put: (path, id, obj, merge) => Fs.setDoc(Fs.doc(db, path, id), obj, {merge}),
    del: (path, id) => Fs.deleteDoc(Fs.doc(db, path, id))
  };
}

function demoStore() {
  let db = ls("guDemoData");
  if (!db) { db = seed(); ls("guDemoData", db); }
  const ws = new Set();
  const emit = path => { ls("guDemoData", db); for (const w of ws) if (w.path === path) w.cb((db[path] || []).slice()); };
  return {
    watch(path, cb) { const w = {path, cb}; ws.add(w); setTimeout(() => ws.has(w) && cb((db[path] || []).slice()), 0); return () => ws.delete(w); },
    async put(path, id, obj, merge) {
      const list = db[path] = db[path] || [], i = list.findIndex(x => x.id === id);
      if (i >= 0) list[i] = Object.assign(merge ? Object.assign({}, list[i]) : {id}, obj); else list.push(Object.assign({id}, obj));
      emit(path);
    },
    async del(path, id) { db[path] = (db[path] || []).filter(x => x.id !== id); emit(path); }
  };
}
