/* server/utils/validation.js */
const { z } = require("zod");
const xss = require("xss");

// 1. Common Sanitizers
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return xss(str.trim());
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

// 2. Shared Zod Schemas
const emailSchema = z.string().email("Invalid email format").transform(normalizeEmail);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

// 3. Request Validators
const registerSchema = z.object({
  username: z.string().min(2).max(50).trim(),
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string(),
});

module.exports = {
  sanitize,
  normalizeEmail,
  registerSchema,
  loginSchema,
  emailSchema
};