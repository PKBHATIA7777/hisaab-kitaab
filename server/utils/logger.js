/* server/utils/logger.js */
const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {} // Production: JSON output for log aggregators (Datadog, Logtail, etc.)
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }),
  redact: {
    // Never log these fields — security critical
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "body.password",
      "body.newPassword",
      "body.otp",
      "body.idToken",
    ],
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "unknown",
  },
});

module.exports = logger;