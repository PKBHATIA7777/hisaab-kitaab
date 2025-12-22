/* server/routes/expenseRoutes.js */
const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseController");
const { requireAuth } = require("../middleware/authMiddleware"); 

router.use(requireAuth); 

router.post("/", expenseController.addExpense);
router.get("/chapter/:chapterId", expenseController.getChapterExpenses);
router.get("/:id", expenseController.getExpenseDetails);        // Fetch details for edit
router.put("/:id", expenseController.updateExpense);           // Save edits
router.delete("/:id", expenseController.deleteExpense);

// ✅ NEW ROUTE
router.get("/chapter/:chapterId/summary", expenseController.getExpenseSummary);

module.exports = router;
