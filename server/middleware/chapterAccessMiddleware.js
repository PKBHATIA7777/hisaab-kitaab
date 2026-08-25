const db = require("../config/db");
const log = require("../utils/logger");

/**
 * Helper to safely extract a nested property from an object via string path.
 * e.g. getNestedValue(req, 'params.id')
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Chapter Access Middleware Factory
 *
 * This is the core authorization layer for all chapter-related operations.
 * It handles both legacy (solo) and new (collaborative) chapters seamlessly.
 *
 * @param {Object} options
 * @param {string} options.role - Required role: 'member' (any active member) or 'admin' (only admin)
 * @param {string} options.paramName - Where to find the chapter ID in the request (e.g. 'params.id', 'body.chapterId')
 */
function requireChapterAccess({ role = 'member', paramName = 'params.id' } = {}) {
  return async (req, res, next) => {
    try {
      const userId = Number(req.user?.userId);
      if (!userId) {
        return res.status(401).json({ ok: false, message: "Authentication required" });
      }

      const chapterId = getNestedValue(req, paramName);
      if (!chapterId) {
        return res.status(400).json({ ok: false, message: "Chapter ID is required" });
      }

      // Query the chapter and the user's active membership in one go
      const { rows } = await db.query(
        `SELECT 
           c.*, 
           cm.id AS member_id, 
           cm.role AS member_role, 
           cm.status AS member_status
         FROM chapters c
         LEFT JOIN chapter_members cm 
           ON cm.chapter_id = c.id 
          AND cm.user_id = $2 
          AND cm.status = 'active'
         WHERE c.id = $1`,
        [chapterId, userId]
      );

      const chapterData = rows[0];

      if (!chapterData) {
        return res.status(404).json({ ok: false, message: "Chapter not found" });
      }

      // ─── AUTHORIZATION LOGIC ─────────────────────────────────────────

      if (chapterData.is_collaborative) {
        // COLLABORATIVE CHAPTER
        // 1. Must be an active member
        if (!chapterData.member_id) {
          return res.status(403).json({ ok: false, message: "You do not have access to this chapter" });
        }

        // 2. Role check
        if (role === 'admin' && chapterData.member_role !== 'admin') {
          return res.status(403).json({ ok: false, message: "Admin access required for this action" });
        }
      } else {
        // NON-COLLABORATIVE CHAPTER (Legacy / Solo)
        // Strictly fallback to the creator ownership model to guarantee zero backward compat issues.
        if (chapterData.created_by !== userId) {
          return res.status(403).json({ ok: false, message: "You do not have access to this chapter" });
        }
      }

      // ─── ATTACH TO REQUEST ───────────────────────────────────────────
      // Attach the objects so downstream controllers don't need to re-query the DB
      req.chapter = {
        id: chapterData.id,
        name: chapterData.name,
        is_collaborative: chapterData.is_collaborative,
        created_by: chapterData.created_by,
        is_personal: chapterData.is_personal,
        is_archived: chapterData.is_archived,
        data_updated_at: chapterData.data_updated_at
      };

      if (chapterData.member_id) {
        req.chapterMember = {
          id: chapterData.member_id,
          role: chapterData.member_role,
          status: chapterData.member_status
        };
      } else if (!chapterData.is_collaborative) {
        // For legacy chapters where they might not have a clean chapter_members row,
        // we synthesize an admin role since we already verified they are the creator.
        req.chapterMember = {
          id: null,
          role: 'admin',
          status: 'active'
        };
      }

      next();
    } catch (err) {
      log.error({ err, chapterId: getNestedValue(req, paramName), userId: req.user?.userId }, "Chapter access middleware error");
      return res.status(500).json({ ok: false, message: "Server error verifying chapter access" });
    }
  };
}

module.exports = {
  requireChapterAccess
};
