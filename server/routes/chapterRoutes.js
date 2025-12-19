// ✅ COMPLETE server/routes/chapterRoutes.js
const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");

// FIX: Must match the name exported in authMiddleware.js (which is 'requireAuth')
const { requireAuth } = require("../middleware/authMiddleware"); 

// FIX: Use the correct function name
router.use(requireAuth); 

router.post("/", chapterController.createChapter);
router.get("/", chapterController.getMyChapters);
router.get("/:id", chapterController.getChapterDetails);
router.put("/:id", chapterController.updateChapter);
router.delete("/:id", chapterController.deleteChapter);

module.exports = router;