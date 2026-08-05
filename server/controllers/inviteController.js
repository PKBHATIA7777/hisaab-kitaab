const db = require("../config/db");
const log = require("../utils/logger");
const crypto = require("crypto");
const { z } = require("zod");
const { sendInviteEmail } = require("../utils/email");

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

// ─────────────────────────────────────────────────────────────
// 1. Create and Send Invite (Admin only)
// POST /api/chapters/:chapterId/invites
// ─────────────────────────────────────────────────────────────
async function createInvite(req, res) {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;
    const chapter = req.chapter; // from middleware

    if (!chapter.is_collaborative) {
      return res.status(400).json({ ok: false, message: "Only collaborative chapters can invite members" });
    }

    const result = createInviteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { email } = result.data;

    // 1. Check if user is already an active member
    const { rows: existingMember } = await db.query(
      `SELECT cm.id FROM chapter_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.chapter_id = $1 AND u.email = $2 AND cm.status = 'active'`,
      [chapterId, email]
    );
    if (existingMember.length > 0) {
      return res.status(400).json({ ok: false, message: "User is already a member of this chapter" });
    }

    // 2. Check if there's already a pending invite
    const { rows: pendingInvite } = await db.query(
      `SELECT id FROM chapter_invitations 
       WHERE chapter_id = $1 AND invited_email = $2 AND status = 'pending' AND expires_at > NOW()`,
      [chapterId, email]
    );
    if (pendingInvite.length > 0) {
      return res.status(400).json({ ok: false, message: "A pending invite already exists for this email" });
    }

    // 3. Generate secure token
    const token = crypto.randomBytes(48).toString("hex");

    // 4. Insert invite (expires in 15 days)
    const { rows: inviteRows } = await db.query(
      `INSERT INTO chapter_invitations (chapter_id, invited_by, invited_email, invite_token, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '15 days')
       ON CONFLICT (chapter_id, invited_email) 
       DO UPDATE SET 
          invite_token = EXCLUDED.invite_token,
          status = 'pending',
          expires_at = EXCLUDED.expires_at,
          invited_by = EXCLUDED.invited_by
       RETURNING *`,
      [chapterId, userId, email, token]
    );

    // 5. Fetch inviter name
    const { rows: inviterRows } = await db.query("SELECT real_name FROM users WHERE id = $1", [userId]);
    const inviterName = inviterRows[0].real_name;

    // 6. Send Email
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteLink = `${frontendUrl}/invite.html?token=${token}`;
    
    // Fire and forget email
    sendInviteEmail(email, chapter.name, inviterName, inviteLink).catch(err => {
      log.error({ err, email }, "Failed to send invite email in background");
    });

    res.json({ ok: true, message: "Invite sent successfully", invite: inviteRows[0] });
  } catch (err) {
    log.error({ err }, "createInvite error");
    res.status(500).json({ ok: false, message: "Server error creating invite" });
  }
}

// ─────────────────────────────────────────────────────────────
// 2. List Chapter Invites (Admin only)
// GET /api/chapters/:chapterId/invites
// ─────────────────────────────────────────────────────────────
async function listChapterInvites(req, res) {
  try {
    const { chapterId } = req.params;

    const { rows } = await db.query(
      `SELECT ci.id, ci.invited_email, ci.status, ci.created_at, ci.expires_at, ci.responded_at, u.real_name as invited_by_name
       FROM chapter_invitations ci
       JOIN users u ON ci.invited_by = u.id
       WHERE ci.chapter_id = $1
       ORDER BY ci.created_at DESC`,
      [chapterId]
    );

    res.json({ ok: true, invites: rows });
  } catch (err) {
    log.error({ err }, "listChapterInvites error");
    res.status(500).json({ ok: false, message: "Server error listing invites" });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Revoke Invite (Admin only)
// DELETE /api/chapters/:chapterId/invites/:inviteId
// ─────────────────────────────────────────────────────────────
async function revokeInvite(req, res) {
  try {
    const { chapterId, inviteId } = req.params;

    const { rowCount } = await db.query(
      `UPDATE chapter_invitations SET status = 'revoked' 
       WHERE id = $1 AND chapter_id = $2 AND status = 'pending'`,
      [inviteId, chapterId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Pending invite not found" });
    }

    res.json({ ok: true, message: "Invite revoked" });
  } catch (err) {
    log.error({ err }, "revokeInvite error");
    res.status(500).json({ ok: false, message: "Server error revoking invite" });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Get Invite Details (Public/Auth)
// GET /api/invites/:token
// ─────────────────────────────────────────────────────────────
async function getInviteDetails(req, res) {
  try {
    const { token } = req.params;

    const { rows } = await db.query(
      `SELECT ci.id, ci.status, ci.expires_at, ci.invited_email, c.name as chapter_name, u.real_name as inviter_name
       FROM chapter_invitations ci
       JOIN chapters c ON ci.chapter_id = c.id
       JOIN users u ON ci.invited_by = u.id
       WHERE ci.invite_token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Invalid invite link" });
    }

    const invite = rows[0];

    if (invite.status !== 'pending') {
      return res.status(400).json({ ok: false, message: `This invite has already been ${invite.status}` });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, message: "This invite has expired" });
    }

    res.json({
      ok: true,
      invite: {
        id: invite.id,
        chapter_id: invite.chapter_id,
        chapter_name: invite.chapter_name,
        inviter_name: invite.inviter_name,
        expires_at: invite.expires_at
      }
    });
  } catch (err) {
    log.error({ err }, "getInviteDetails error");
    res.status(500).json({ ok: false, message: "Server error fetching invite" });
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Respond to Invite (Auth Required)
// POST /api/invites/:token/respond
// req.body.accept (boolean)
// ─────────────────────────────────────────────────────────────
async function respondToInvite(req, res) {
  const client = await db.pool.connect();
  try {
    const { token } = req.params;
    const { accept } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email; // assuming email is in jwt or we can fetch it

    await client.query("BEGIN");

    // 1. Fetch Invite
    const { rows: inviteRows } = await client.query(
      `SELECT ci.*, c.name as chapter_name 
       FROM chapter_invitations ci
       JOIN chapters c ON ci.chapter_id = c.id
       WHERE ci.invite_token = $1 FOR UPDATE`,
      [token]
    );

    if (inviteRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Invalid invite link" });
    }

    const invite = inviteRows[0];

    if (invite.status !== 'pending') {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, message: `This invite is already ${invite.status}` });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, message: "This invite has expired" });
    }

    // 2. Fetch the logged-in user's info to verify email
    const { rows: userRows } = await client.query("SELECT real_name, email FROM users WHERE id = $1", [userId]);
    const loggedInEmail = userRows[0].email;
    const loggedInName = userRows[0].real_name;

    if (loggedInEmail.toLowerCase() !== invite.invited_email.toLowerCase()) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, message: "This invite was sent to a different email address" });
    }

    // 3. Handle Decline
    if (!accept) {
      await client.query(
        "UPDATE chapter_invitations SET status = 'declined', responded_at = NOW() WHERE id = $1",
        [invite.id]
      );
      
      // Optional: Insert notification for inviter
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, chapter_id)
         VALUES ($1, 'invite_declined', $2, $3, $4)`,
        [invite.invited_by, `Invite declined`, `${loggedInName} declined your invite to join ${invite.chapter_name}.`, invite.chapter_id]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, message: "Invite declined" });
    }

    // 4. Handle Accept
    // First, check if already in chapter_members (e.g. from a previous legacy membership)
    const { rows: memberRows } = await client.query(
      "SELECT id, status FROM chapter_members WHERE chapter_id = $1 AND user_id = $2",
      [invite.chapter_id, userId]
    );

    if (memberRows.length > 0) {
      // Re-activate if left
      await client.query(
        "UPDATE chapter_members SET status = 'active', joined_at = NOW(), left_at = NULL WHERE id = $1",
        [memberRows[0].id]
      );
    } else {
      // Check if there is a ghost member with the same name (case-insensitive)
      const { rows: ghostRows } = await client.query(
        "SELECT id FROM chapter_members WHERE chapter_id = $1 AND user_id IS NULL AND LOWER(member_name) = LOWER($2) AND status = 'active'",
        [invite.chapter_id, loggedInName]
      );

      if (ghostRows.length > 0) {
        // Link ghost to user
        await client.query(
          "UPDATE chapter_members SET user_id = $1, invited_by = $2, invited_email = $3, joined_at = NOW() WHERE id = $4",
          [userId, invite.invited_by, invite.invited_email, ghostRows[0].id]
        );
      } else {
        // Insert new member
        await client.query(
          `INSERT INTO chapter_members (chapter_id, user_id, member_name, role, status, invited_by, invited_email, joined_at)
           VALUES ($1, $2, $3, 'member', 'active', $4, $5, NOW())`,
          [invite.chapter_id, userId, loggedInName, invite.invited_by, invite.invited_email]
        );
      }
    }

    // Mark invite as accepted
    await client.query(
      "UPDATE chapter_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1",
      [invite.id]
    );

    // Notify the inviter
    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, chapter_id)
       VALUES ($1, 'invite_accepted', $2, $3, $4)`,
      [invite.invited_by, `New member joined!`, `${loggedInName} accepted your invite and joined ${invite.chapter_name}.`, invite.chapter_id]
    );

    await client.query("COMMIT");
    res.json({ ok: true, message: "Welcome to the chapter! Invite accepted.", chapterId: invite.chapter_id });

  } catch (err) {
    await client.query("ROLLBACK");
    log.error({ err }, "respondToInvite error");
    res.status(500).json({ ok: false, message: "Server error responding to invite" });
  } finally {
    client.release();
  }
}

module.exports = {
  createInvite,
  listChapterInvites,
  revokeInvite,
  getInviteDetails,
  respondToInvite
};
