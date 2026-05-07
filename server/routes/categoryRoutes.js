/* server/routes/categoryRoutes.js */
/* FIX: /monthly MUST come before /:id — otherwise Express treats "monthly" as the :id param */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMonthlyBreakdown,
} = require("../controllers/categoryController");

router.use(requireAuth);

// ✅ CRITICAL: /monthly MUST be declared before /:id
// Otherwise Express matches GET /monthly as /:id with id="monthly"
router.get("/monthly", getMonthlyBreakdown);

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;