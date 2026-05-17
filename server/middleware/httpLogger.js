/* server/middleware/httpLogger.js */
const pinoHttp = require("pino-http");
const logger = require("../utils/logger");

module.exports = pinoHttp({
  logger,
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    if (req.url === "/ping" || req.url === "/api/health") return "trace";
    return "info";
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} ${res.statusCode} — ${err.message}`;
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      };
    },
  },
});