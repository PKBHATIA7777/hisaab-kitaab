/* server/routes/friendRoutes.js */
const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const { requireAuth } = require("../middleware/authMiddleware");

// All friend routes require login
router.use(requireAuth);

router.post("/", friendController.addFriend);
router.get("/", friendController.getFriends);
router.put("/:id", friendController.updateFriend);
router.delete("/:id", friendController.deleteFriend);

module.exports = router;