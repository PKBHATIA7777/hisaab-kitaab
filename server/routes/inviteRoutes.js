const express = require("express");
const router = express.Router();
const inviteController = require("../controllers/inviteController");
const { requireAuth } = require("../middleware/authMiddleware");

// ── PUBLIC / TOKEN BASED ROUTES ──────────────────────────────

// Get details of an invite (can be used before login to show the user what they are joining)
router.get("/:token", inviteController.getInviteDetails);

// Accept or decline an invite (requires the user to be logged in and match the email)
router.post("/:token/respond", requireAuth, inviteController.respondToInvite);

module.exports = router;
