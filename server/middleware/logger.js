/* server/middleware/logger.js */
const log = require("../utils/logger");

const logger = (req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  // Hook into response finish to log status and duration
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    log.info({ method, url, status, duration }, `${method} ${url} ${status} - ${duration}ms`);
  });

  next();
};

module.exports = logger;