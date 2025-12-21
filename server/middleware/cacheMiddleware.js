/* server/middleware/cacheMiddleware.js */
const simpleCache = new Map();

/**
 * Simple In-Memory Cache Middleware
 * @param {number} durationSeconds - How long to keep the data (e.g. 300 for 5 mins)
 */
const cache = (durationSeconds) => (req, res, next) => {
  // 1. Only cache GET requests
  if (req.method !== "GET") {
    return next();
  }

  // 2. Create a unique key for this user & request
  // We use the Auth Token or User ID to ensure data isn't shared between users
  const userKey = req.user ? req.user.userId : (req.cookies.auth_token || "anon");
  const key = `__cache__${req.originalUrl}__${userKey}`;

  // 3. Check if data exists
  const cachedEntry = simpleCache.get(key);
  if (cachedEntry) {
    const { body, timestamp } = cachedEntry;
    // Check if expired
    if (Date.now() - timestamp < durationSeconds * 1000) {
      return res.json(body); // HIT! Return cached data immediately
    }
    simpleCache.delete(key); // Expired
  }

  // 4. If MISS, hijack res.json to capture the output before sending
  const originalJson = res.json;
  res.json = (body) => {
    // Only cache successful responses (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      simpleCache.set(key, { body, timestamp: Date.now() });
      
      // Safety: Limit cache size to prevent memory leaks (FIFO)
      if (simpleCache.size > 1000) {
        const firstKey = simpleCache.keys().next().value;
        simpleCache.delete(firstKey);
      }
    }
    return originalJson.call(res, body);
  };

  next();
};

module.exports = cache;