/* server/routes/settlementRecordRoutes.js */
/* Feature 1: Settlement marking routes */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const {
  markSettlement,
  getSettlementHistory,
  undoSettlement,
} = require("../controllers/settlementRecordController");

router.use(requireAuth);

// Mark a settlement as paid in real world
// POST /api/chapters/:chapterId/settlements/mark
router.post("/:chapterId/settlements/mark", markSettlement);

// Get all completed settlement records for a chapter
// GET /api/chapters/:chapterId/settlements/history
router.get("/:chapterId/settlements/history", getSettlementHistory);

// Undo a settlement record (bring back to pending)
// DELETE /api/chapters/:chapterId/settlements/history/:recordId
router.delete("/:chapterId/settlements/history/:recordId", undoSettlement);

module.exports = router;