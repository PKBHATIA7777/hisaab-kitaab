const rateLimit = require("express-rate-limit");
const log = require("../utils/logger");

const rateLimitHandler = (req, res, next, options) => {
  const retryAfter = Math.ceil(options.resetTime / 1000) - Math.floor(Date.now() / 1000);
  log.warn({ ip: req.ip, path: req.originalUrl, retryAfter }, "Rate Limit Hit");
  res.setHeader("Retry-After", retryAfter > 0 ? retryAfter : 60);
  res.status(options.statusCode).json({
    ok: false,
    message: options.message.message || "Too many requests, please try again later.",
    retryAfter: retryAfter > 0 ? retryAfter : 60,
    isRateLimit: true
  });
};

const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 invites per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: { ok: false, message: "Too many invites sent. Please wait 15 minutes before trying again." },
  keyGenerator: (req) => req.ip || "unknown"
});

module.exports = {
  inviteLimiter
};
