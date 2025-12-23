/* server/middleware/logger.js */
const logger = (req, res, next) => {
    const start = Date.now();
    const { method, url } = req;
  
    // Hook into response finish to log status and duration
    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      let logColor = "\x1b[32m"; // Green (Success)
      if (status >= 400) logColor = "\x1b[33m"; // Yellow (Client Error)
      if (status >= 500) logColor = "\x1b[31m"; // Red (Server Error)
      const resetColor = "\x1b[0m";
  
      console.log(
        `${logColor}[${new Date().toISOString()}] ${method} ${url} ${status} - ${duration}ms${resetColor}`
      );
    });
  
    next();
  };
  
  module.exports = logger;