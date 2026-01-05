/* server/routes/chapterRoutes.js */
const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const exportController = require("../controllers/exportController"); 
// ✅ Import Event Controller
const eventController = require("../controllers/eventController");

const { requireAuth } = require("../middleware/authMiddleware"); 
const cache = require("../middleware/cacheMiddleware");

router.use(requireAuth); 

// --- CHAPTERS ---
router.post("/", chapterController.createChapter);

// Cache the chapter list for 5 minutes
router.get("/", chapterController.getMyChapters);

// --- EVENTS (New) ---
// Place these BEFORE the generic /:id routes to ensure matching
router.post("/:chapterId/events", eventController.createEvent);
router.get("/:chapterId/events", eventController.getChapterEvents);

// --- SPECIFIC CHAPTER ---
router.get("/:id/export", exportController.exportChapter);
router.get("/:id", chapterController.getChapterDetails);
router.put("/:id", chapterController.updateChapter);
router.delete("/:id", chapterController.deleteChapter);

// --- MEMBERS ---
router.post("/:id/members", chapterController.addMember);
router.delete("/:id/members/:memberId", chapterController.deleteMember);

module.exports = router;