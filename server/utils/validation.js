/* server/utils/validation.js */
const { z } = require("zod");
const xss = require("xss");

// ... existing sanitizers ...

// 1. Common Sanitizers
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return xss(str.trim());
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

const emailSchema = z.string().email("Invalid email format").transform(normalizeEmail);

// 🔐 UPDATED: Hardened password schema (AUTH-015)
const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .refine(
    (pwd) => {
      // At least one of: uppercase, lowercase, digit, special char
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasDigit = /\d/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
      // Require at least 3 of 4 categories
      const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
      return score >= 3;
    },
    {
      message:
        "Password must include at least 3 of: uppercase letter, lowercase letter, number, special character",
    }
  );

// 3. Request Validators
const registerSchema = z.object({
  // 🔴 REMOVED: username: z.string().min(2).max(50).trim(),
  // 🟢 NEW: Username is optional/removed from input
  realName: z.string().min(2, "Name is required").trim(),
  username: z.string().optional(), // kept optional just in case, but we won't send it
  // We still validate email implicitly via the signup token, but 
  // sometimes we might pass it for consistency. The controller handles the main logic.
  // Actually, the controller only extracts realName and password usually.
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string(),
});

module.exports = {
  sanitize,
  normalizeEmail,
  registerSchema,
  loginSchema,
  emailSchema,
  passwordSchema // 🟢 Exported for reuse in other validators if needed
};