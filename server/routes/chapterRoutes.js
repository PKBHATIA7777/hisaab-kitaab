/* server/routes/chapterRoutes.js */
/* MODIFIED: Added personal chapter routes (Feature 3) and settlement record routes (Feature 1) */
/* All existing routes are 100% unchanged */

const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const exportController = require("../controllers/exportController");
const eventController = require("../controllers/eventController");
const inviteController = require("../controllers/inviteController");

// ✅ NEW imports for Features 1 and 3
const {
  markSettlement,
  getSettlementHistory,
  undoSettlement,
  confirmSettlement,
  disputeSettlement
} = require("../controllers/settlementRecordController");

const {
  createPersonalChapter,
  getPersonalChapterStatus,
  addToPersonalFromChapter,
  getSyncStatus,
  updateSyncedExpense,
} = require("../controllers/personalChapterController");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireChapterAccess } = require("../middleware/chapterAccessMiddleware");

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
router.post("/:chapterId/settlements/mark", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), markSettlement);
router.get("/:chapterId/settlements/history", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), getSettlementHistory);
router.delete("/:chapterId/settlements/history/:recordId", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), undoSettlement);
router.post("/:chapterId/settlements/:recordId/confirm", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), confirmSettlement);
router.post("/:chapterId/settlements/:recordId/dispute", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), disputeSettlement);

// ── EVENTS (existing) ─────────────────────────────────────────
router.post("/:chapterId/events", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), eventController.createEvent);
router.get("/:chapterId/events", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), eventController.getChapterEvents);

const { inviteLimiter } = require("../middleware/rateLimiters");

// ── FEATURE 3: Invite System (Admin) ─────────────────────────
router.post("/:chapterId/invites", inviteLimiter, requireChapterAccess({ role: 'admin', paramName: 'params.chapterId' }), inviteController.createInvite);
router.get("/:chapterId/invites", requireChapterAccess({ role: 'admin', paramName: 'params.chapterId' }), inviteController.listChapterInvites);
router.delete("/:chapterId/invites/:inviteId", requireChapterAccess({ role: 'admin', paramName: 'params.chapterId' }), inviteController.revokeInvite);

// ── FEATURE 3: Sync status routes ────────────────────────────
// Check if user's synced expense is stale
router.get("/:chapterId/sync-status", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), getSyncStatus);
// Update or dismiss the stale warning
router.patch("/:chapterId/sync-update", requireChapterAccess({ role: 'member', paramName: 'params.chapterId' }), updateSyncedExpense);

// ── EXISTING SPECIFIC CHAPTER ROUTES (unchanged) ─────────────
router.get("/:id/export", requireChapterAccess({ role: 'member' }), exportController.exportChapter);
router.get("/:id", requireChapterAccess({ role: 'member' }), chapterController.getChapterDetails);
router.put("/:id", requireChapterAccess({ role: 'admin' }), chapterController.updateChapter);
router.patch("/:id/archive", requireChapterAccess({ role: 'admin' }), chapterController.toggleArchiveChapter);
router.delete("/:id", requireChapterAccess({ role: 'admin' }), chapterController.deleteChapter);

// ── FEATURE 4: Collaborative Upgrades & Leaving ────────────────
router.patch("/:id/upgrade", requireChapterAccess({ role: 'admin' }), chapterController.upgradeToCollaborative);
router.delete("/:id/leave", requireChapterAccess({ role: 'member' }), chapterController.leaveChapter);

// Beacon-based delete (for beforeunload scenarios)
router.post("/:id/beacon-delete", requireChapterAccess({ role: 'admin' }), async (req, res) => {
  return chapterController.deleteChapter(req, res);
});

// ── EXISTING MEMBER ROUTES (unchanged) ───────────────────────
router.post("/:id/members", requireChapterAccess({ role: 'admin' }), chapterController.addMember);
router.delete("/:id/members/:memberId", requireChapterAccess({ role: 'admin' }), chapterController.deleteMember);
router.get("/:id/members/deletability", requireChapterAccess({ role: 'admin' }), chapterController.getMemberDeletability);



// Change detection endpoint — polling foundation before WebSocket implementation
// Returns data_updated_at timestamp for the chapter
// Future: This endpoint will be deprecated in favor of WebSocket subscription
router.get("/:id/heartbeat", requireChapterAccess({ role: 'member' }), chapterController.getChapterHeartbeat);

module.exports = router;