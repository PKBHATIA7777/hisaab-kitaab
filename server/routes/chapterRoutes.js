const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { 
  createChapter, 
  getMyChapters, 
  getChapterDetails 
} = require("../controllers/chapterController");

// All routes here are protected
router.use(requireAuth);

router.post("/", createChapter);       // Create
router.get("/", getMyChapters);        // List all
router.get("/:id", getChapterDetails); // Get one

module.exports = router;