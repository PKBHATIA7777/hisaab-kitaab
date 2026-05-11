/* server/routes/chapterRoutes.js */
/* MODIFIED: Added personal chapter routes (Feature 3) and settlement record routes (Feature 1) */
/* All existing routes are 100% unchanged */

const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const exportController = require("../controllers/exportController");
const eventController = require("../controllers/eventController");

// ✅ NEW imports for Features 1 and 3
const {
  markSettlement,
  getSettlementHistory,
  undoSettlement,
} = require("../controllers/settlementRecordController");

const {
  createPersonalChapter,
  getPersonalChapterStatus,
  addToPersonalFromChapter,
  getSyncStatus,
  updateSyncedExpense,
} = require("../controllers/personalChapterController");

const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

// ── FEATURE 3: Personal chapter routes ───────────────────────
// These must come BEFORE /:id routes to avoid param conflicts

// Check if user has a personal chapter
router.get("/personal/status", getPersonalChapterStatus);

// Create personal chapter (for existing users)
router.post("/create-personal", createPersonalChapter);

// Add consumed amount from a source chapter to My Expenses
router.post("/personal/add-from-chapter", addToPersonalFromChapter);

// ── EXISTING ROUTES (unchanged) ──────────────────────────────
router.post("/", chapterController.createChapter);
router.get("/", chapterController.getMyChapters);

// ── FEATURE 1: Settlement record routes ──────────────────────
// Place before /:id/export to avoid conflicts
router.post("/:chapterId/settlements/mark", markSettlement);
router.get("/:chapterId/settlements/history", getSettlementHistory);
router.delete("/:chapterId/settlements/history/:recordId", undoSettlement);

// ── EVENTS (existing) ─────────────────────────────────────────
router.post("/:chapterId/events", eventController.createEvent);
router.get("/:chapterId/events", eventController.getChapterEvents);

// ── FEATURE 3: Sync status routes ────────────────────────────
// Check if user's synced expense is stale
router.get("/:chapterId/sync-status", getSyncStatus);
// Update or dismiss the stale warning
router.patch("/:chapterId/sync-update", updateSyncedExpense);

// ── EXISTING SPECIFIC CHAPTER ROUTES (unchanged) ─────────────
router.get("/:id/export", exportController.exportChapter);
router.get("/:id", chapterController.getChapterDetails);
router.put("/:id", chapterController.updateChapter);
router.patch("/:id/archive", chapterController.toggleArchiveChapter);
router.delete("/:id", chapterController.deleteChapter);

// Beacon-based delete (for beforeunload scenarios)
router.post("/:id/beacon-delete", async (req, res) => {
  // Reuse the existing deleteChapter logic via direct call
  req.method = "DELETE";
  req.params.id = req.params.id;
  return chapterController.deleteChapter(req, res);
});

// ── EXISTING MEMBER ROUTES (unchanged) ───────────────────────
router.post("/:id/members", chapterController.addMember);
router.delete("/:id/members/:memberId", chapterController.deleteMember);
router.get("/:id/members/deletability", chapterController.getMemberDeletability);

module.exports = router;