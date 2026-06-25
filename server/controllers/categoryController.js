/* server/controllers/categoryController.js */
/* Feature 4: Expense Categories */

const db = require("../config/db");
const log = require("../utils/logger");
const { z } = require("zod");
const xss = require("xss");

const categorySchema = z.object({
  name: z.string().min(1, "Name required").max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color hex").optional().default("#888888"),
  icon: z.string().max(10).optional().default("📦"),
});

// ─────────────────────────────────────────────────────────────
// GET /api/categories
// Returns system categories + user's custom categories
// ─────────────────────────────────────────────────────────────
async function getCategories(req, res) {
  try {
    const userId = req.user.userId;

    const { rows } = await db.query(
      `SELECT id, name, color, icon, is_system, user_id
       FROM expense_categories
       WHERE is_system = TRUE OR user_id = $1
       ORDER BY is_system DESC, name ASC`,
      [userId]
    );

    res.json({ ok: true, categories: rows });
  } catch (err) {
    log.error({ err }, "getCategories error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/categories
// Create a custom category
// ─────────────────────────────────────────────────────────────
async function createCategory(req, res) {
  try {
    const userId = req.user.userId;
    const result = categorySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, color, icon } = result.data;
    const cleanName = xss(name);
    const cleanIcon = xss(icon);

    // Check max 20 custom categories per user
    const { rows: countRows } = await db.query(
      "SELECT COUNT(*) as cnt FROM expense_categories WHERE user_id = $1",
      [userId]
    );
    if (parseInt(countRows[0].cnt) >= 20) {
      return res.status(400).json({ ok: false, message: "Maximum 20 custom categories allowed" });
    }

    const { rows } = await db.query(
      `INSERT INTO expense_categories (user_id, name, color, icon, is_system)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING *`,
      [userId, cleanName, color, cleanIcon]
    );

    res.json({ ok: true, message: "Category created", category: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ ok: false, message: "A category with this name already exists" });
    }
    log.error({ err }, "createCategory error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/categories/:id
// Update a custom category (cannot update system ones)
// ─────────────────────────────────────────────────────────────
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const result = categorySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ ok: false, message: result.error.issues[0].message });
    }

    const { name, color, icon } = result.data;
    const cleanName = xss(name);
    const cleanIcon = xss(icon);

    const { rowCount, rows } = await db.query(
      `UPDATE expense_categories
       SET name = $1, color = $2, icon = $3
       WHERE id = $4 AND user_id = $5 AND is_system = FALSE
       RETURNING *`,
      [cleanName, color, cleanIcon, id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Category not found or cannot be edited" });
    }

    res.json({ ok: true, message: "Category updated", category: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ ok: false, message: "A category with this name already exists" });
    }
    log.error({ err }, "updateCategory error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/categories/:id
// Delete a custom category (cannot delete system ones)
// ─────────────────────────────────────────────────────────────
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const { rowCount } = await db.query(
      "DELETE FROM expense_categories WHERE id = $1 AND user_id = $2 AND is_system = FALSE",
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: "Category not found or cannot be deleted" });
    }

    // Expenses that had this category are set to NULL via ON DELETE SET NULL in DB
    res.json({ ok: true, message: "Category deleted" });
  } catch (err) {
    log.error({ err }, "deleteCategory error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/expenses/personal/monthly
// Monthly breakdown for personal chapter
// ─────────────────────────────────────────────────────────────
async function getMonthlyBreakdown(req, res) {
  try {
    const userId = req.user.userId;

    // Find personal chapter
    const { rows: chapRows } = await db.query(
      "SELECT id FROM chapters WHERE created_by = $1 AND is_personal = TRUE LIMIT 1",
      [userId]
    );
    if (chapRows.length === 0) {
      return res.json({ ok: true, months: [], categories: [] });
    }
    const chapterId = chapRows[0].id;

    // Monthly totals
    const { rows: monthRows } = await db.query(
      `SELECT
         TO_CHAR(e.expense_date, 'YYYY-MM') AS month,
         TO_CHAR(e.expense_date, 'Mon YYYY') AS month_label,
         SUM(e.amount) AS total,
         COUNT(e.id) AS expense_count
       FROM expenses e
       WHERE e.chapter_id = $1
       GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM'), TO_CHAR(e.expense_date, 'Mon YYYY')
       ORDER BY month DESC`,
      [chapterId]
    );

    // Category breakdown
    const { rows: catRows } = await db.query(
      `SELECT
         COALESCE(ec.name, 'Other') AS category_name,
         COALESCE(ec.color, '#C9C9C9') AS category_color,
         COALESCE(ec.icon, '📦') AS category_icon,
         SUM(e.amount) AS total,
         COUNT(e.id) AS expense_count
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       WHERE e.chapter_id = $1
       GROUP BY ec.name, ec.color, ec.icon
       ORDER BY total DESC`,
      [chapterId]
    );

    // Expenses grouped by month with category info
    const { rows: expRows } = await db.query(
      `SELECT
         e.id, e.amount, e.description, e.expense_date,
         e.category_id, e.is_synced_from_chapter, e.source_chapter_id,
         e.sync_dismissed,
         COALESCE(ec.name, 'Other') AS category_name,
         COALESCE(ec.color, '#C9C9C9') AS category_color,
         COALESCE(ec.icon, '📦') AS category_icon,
         sc.name AS source_chapter_name,
         TO_CHAR(e.expense_date, 'YYYY-MM') AS month
       FROM expenses e
       LEFT JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN chapters sc ON e.source_chapter_id = sc.id
       WHERE e.chapter_id = $1
       ORDER BY e.expense_date DESC`,
      [chapterId]
    );

    res.json({ ok: true, months: monthRows, categories: catRows, expenses: expRows });
  } catch (err) {
    log.error({ err }, "getMonthlyBreakdown error");
    res.status(500).json({ ok: false, message: "Server error" });
  }
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMonthlyBreakdown,
};