/*/* server/routes/chapterRoutes.js */
const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const { requireAuth } = require("../middleware/authMiddleware"); 
const cache = require("../middleware/cacheMiddleware"); // <--- IMPORT

router.use(requireAuth); 

router.post("/", chapterController.createChapter);

// ✅ CACHE APPLIED: Cache the chapter list for 5 minutes (300 seconds)
router.get("/", chapterController.getMyChapters);

router.get("/:id", chapterController.getChapterDetails);
router.put("/:id", chapterController.updateChapter);
router.delete("/:id", chapterController.deleteChapter);

// ✅ ADD THESE TWO LINES (They were missing):
router.post("/:id/members", chapterController.addMember);
router.delete("/:id/members/:memberId", chapterController.deleteMember);

module.exports = router;



