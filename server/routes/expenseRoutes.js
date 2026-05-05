/* server/routes/expenseRoutes.js */
/* MODIFIED: Added bulkAssignEvent route (Feature 5) */
/* All existing routes are 100% unchanged */

const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

// ── EXISTING ROUTES (unchanged) ──────────────────────────────
router.post("/", expenseController.addExpense);
router.get("/chapter/:chapterId", expenseController.getChapterExpenses);
router.get("/:id", expenseController.getExpenseDetails);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);
router.get("/chapter/:chapterId/summary", expenseController.getExpenseSummary);
router.get("/chapter/:chapterId/settlements", expenseController.getChapterSettlements);

// ── NEW ROUTES ────────────────────────────────────────────────

// Feature 5: Bulk assign/remove expenses from an event
// PATCH /api/expenses/bulk-assign-event
router.patch("/bulk-assign-event", expenseController.bulkAssignEvent);

module.exports = router;