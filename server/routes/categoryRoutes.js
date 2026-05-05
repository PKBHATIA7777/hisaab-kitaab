/* server/routes/categoryRoutes.js */
/* Feature 4: Category CRUD routes */

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

// GET    /api/categories         — System + user's custom categories
router.get("/", getCategories);

// POST   /api/categories         — Create custom category
router.post("/", createCategory);

// PUT    /api/categories/:id     — Edit custom category
router.put("/:id", updateCategory);

// DELETE /api/categories/:id     — Delete custom category
router.delete("/:id", deleteCategory);

// GET    /api/categories/monthly — Monthly + category breakdown for personal chapter
router.get("/monthly", getMonthlyBreakdown);

module.exports = router;