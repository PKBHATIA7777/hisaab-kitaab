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
      req.onsuccess = async () => {
        // Register Background Sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.sync.register('sync-expenses');
          } catch (_) { /* Sync not supported — online event fallback handles it */ }
        }
        resolve(item);
      };
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

    const MAX_RETRIES = 5;
    let successCount = 0;
    let failCount = 0;
    const droppedItems = [];

    for (const item of pending) {
      // INSTALL-07 FIX: Drop items that have exceeded the retry cap
      if ((item.retries || 0) >= MAX_RETRIES) {
        await remove(item.id);
        droppedItems.push(item);
        continue;
      }

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
        } else {
          // 5xx — increment retry count and leave in queue for next flush
          await _incrementRetries(item.id, item.retries || 0);
          failCount++;
        }
      } catch (_) {
        // Network error — increment retry count and leave in queue
        await _incrementRetries(item.id, item.retries || 0);
        failCount++;
      }
    }

    if (successCount > 0 && window.showToast) {
      window.showToast(`${successCount} offline expense${successCount !== 1 ? "s" : ""} synced`, "success");
      // Refresh the current page's data
      if (typeof window.loadExpenses === "function") window.loadExpenses();
    }

    // INSTALL-07 FIX: Notify user about dropped items
    if (droppedItems.length > 0 && window.showToast) {
      window.showToast(
        `${droppedItems.length} offline expense${droppedItems.length !== 1 ? "s" : ""} couldn't be saved — please re-enter ${droppedItems.length !== 1 ? "them" : "it"}.`,
        "error"
      );
    }
  }

  // Increment retry count for a queued item
  async function _incrementRetries(id, currentRetries) {
    const idb = await initDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) {
          item.retries = (currentRetries || 0) + 1;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => resolve(); // Non-fatal
    });
  }

  // Flush when coming back online
  window.addEventListener("online", () => {
    setTimeout(flush, 1000); // Short delay to let network stabilize
  });

  return { enqueue, flush, getPending };
})();

window.OfflineQueue = OfflineQueue;