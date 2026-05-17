/* client/js/pwa/offline-queue.js */
/**
 * Offline Expense Queue
 * Uses IndexedDB to persist failed requests and retries them when online.
 */
const OfflineQueue = (() => {
  const DB_NAME = "hk-offline-queue";
  const STORE_NAME = "pending-requests";
  let db = null;

  async function initDB() {
    if (db) return db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const store = e.target.result.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("createdAt", "createdAt");
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function enqueue(request) {
    const idb = await initDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const item = {
        ...request,
        createdAt: Date.now(),
        retries: 0,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      const req = store.add(item);
      req.onsuccess = () => resolve(item);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getPending() {
    const idb = await initDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function remove(id) {
    const idb = await initDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function flush() {
    if (!navigator.onLine) return;
    const pending = await getPending();
    if (pending.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const item of pending) {
      try {
        const res = await fetch(
          (window.APP_CONFIG?.API_BASE || "/api") + item.path,
          {
            method: item.method || "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": window.CSRFManager?.get() || "",
              "X-Idempotency-Key": item.idempotencyKey,
            },
            credentials: "include",
            body: JSON.stringify(item.body),
          }
        );

        if (res.ok) {
          await remove(item.id);
          successCount++;
        } else if (res.status === 409) {
          // Conflict — already processed (idempotency hit)
          await remove(item.id);
          successCount++;
        } else if (res.status >= 400 && res.status < 500) {
          // Client error — remove without retrying (bad request won't succeed)
          await remove(item.id);
          failCount++;
        }
        // 5xx — leave in queue for next flush
      } catch (_) {
        // Network error — leave in queue
        failCount++;
      }
    }

    if (successCount > 0 && window.showToast) {
      window.showToast(`${successCount} offline expense${successCount !== 1 ? "s" : ""} synced ✓`, "success");
      // Refresh the current page's data
      if (typeof window.loadExpenses === "function") window.loadExpenses();
    }
  }

  // Flush when coming back online
  window.addEventListener("online", () => {
    setTimeout(flush, 1000); // Short delay to let network stabilize
  });

  return { enqueue, flush, getPending };
})();

window.OfflineQueue = OfflineQueue;