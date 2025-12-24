/* server/routes/chapterRoutes.js */
const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
// 1. Import the Export Controller
const exportController = require("../controllers/exportController"); 

const { requireAuth } = require("../middleware/authMiddleware"); 
const cache = require("../middleware/cacheMiddleware");

router.use(requireAuth); 

router.post("/", chapterController.createChapter);

// Cache the chapter list for 5 minutes
router.get("/", chapterController.getMyChapters);

// 2. Add the Export Route (Place it before /:id generic routes for clarity)
router.get("/:id/export", exportController.exportChapter);

router.get("/:id", chapterController.getChapterDetails);
router.put("/:id", chapterController.updateChapter);
router.delete("/:id", chapterController.deleteChapter);

router.post("/:id/members", chapterController.addMember);
router.delete("/:id/members/:memberId", chapterController.deleteMember);

module.exports = router;



