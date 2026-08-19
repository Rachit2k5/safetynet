const DB_NAME = 'saferoute-offline';
const STORE = 'pending-actions';

const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const queueAction = async (action) => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...action, id: action.id || Date.now().toString(), timestamp: Date.now() });
    tx.oncomplete = () => resolve();
  });
};

export const getQueuedActions = async () => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
  });
};

export const removeAction = async (id) => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
};

export const flushQueue = async () => {
  const actions = await getQueuedActions();
  if (!actions.length) return;
  let delay = 1000;
  for (const action of actions) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      try {
        const stored = localStorage.getItem('sr_session');
        let token = stored ? JSON.parse(stored).token : '';
        const res = await fetch(action.url, {
          method: action.type || 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? {'Authorization': `Bearer ${token}`} : {}) },
          body: JSON.stringify(action.body)
        });
        if (res.ok) { await removeAction(action.id); success = true; }
        else throw new Error('Failed');
      } catch (e) {
        attempts++;
        if (attempts >= 5) break;
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30000);
      }
    }
  }
};
