/* server/routes/expenseRoutes.js */
/* MODIFIED: Added bulkAssignEvent route (Feature 5) */
/* All existing routes are 100% unchanged */

const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { requireAuth } = require("../middleware/authMiddleware");
const { requireChapterAccess } = require("../middleware/chapterAccessMiddleware");

router.use(requireAuth);

// ── EXISTING ROUTES (unchanged) ──────────────────────────────
router.post("/", requireChapterAccess({ role: 'member', paramName: 'body.chapterId' }), expenseController.addExpense);
router.get("/chapter/:chapterId", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), expenseController.getChapterExpenses);
router.get("/:id", expenseController.getExpenseDetails);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);
router.get("/chapter/:chapterId/summary", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), expenseController.getExpenseSummary);
router.get("/chapter/:chapterId/settlements", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), expenseController.getChapterSettlements);

// ── NEW ROUTES ────────────────────────────────────────────────

// Feature 5: Bulk assign/remove expenses from an event
// PATCH /api/expenses/bulk-assign-event
router.patch("/bulk-assign-event", requireChapterAccess({ role: 'member', paramName: 'body.chapterId' }), expenseController.bulkAssignEvent);

module.exports = router;