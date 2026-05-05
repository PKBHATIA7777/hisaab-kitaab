/* server/controllers/exportController.js */
/* MODIFIED: Settlement Plan now shows PENDING and COMPLETED separately (Feature 1) */
/* All other logic is identical to original */

const db = require("../config/db");
const ExcelJS = require("exceljs");
const { calculateSettlements } = require("./expenseController");
const { getNetSettlements } = require("./settlementRecordController");

function sanitizeCell(value) {
  if (typeof value !== "string") return value;
  if (/^[=+\-@\t]/.test(value)) return "\t" + value;
  return value;
}

async function exportChapter(req, res) {
  try {
    const { id } = req.params;
    const { eventId } = req.query;
    const userId = req.user.userId;

    const { rows: chapterRows } = await db.query(
      "SELECT * FROM chapters WHERE id = $1 AND created_by = $2",
      [id, userId]
    );
    if (chapterRows.length === 0) {
      return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
    }
    const chapter = chapterRows[0];

    let reportTitle = chapter.name;
    let filenamePrefix = chapter.name;

    if (eventId) {
      const { rows: ev } = await db.query(
        "SELECT name FROM events WHERE id = $1 AND chapter_id = $2",
        [eventId, id]
      );
      if (ev.length > 0) {
        reportTitle += ` - ${ev[0].name}`;
        filenamePrefix += `_${ev[0].name}`;
      }
    }

    // Summary data
    const summaryQuery = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses
        WHERE chapter_id = $1 ${eventId ? "AND event_id = $2" : ""}
        GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1 ${eventId ? "AND e.event_id = $2" : ""}
        GROUP BY es.member_id
      )
      SELECT cm.id, cm.member_name,
        COALESCE(s.total, 0) as total_spent,
        COALESCE(u.total, 0) as total_used
      FROM chapter_members cm
      LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
      LEFT JOIN used_cte u ON cm.id = u.member_id
      WHERE cm.chapter_id = $1
      ORDER BY total_spent DESC
    `;
    const summaryParams = eventId ? [id, eventId] : [id];
    const { rows: summaryRows } = await db.query(summaryQuery, summaryParams);

    const memberBalances = summaryRows.map(row => ({
      id: row.id,
      name: row.member_name,
      balance: parseFloat(row.total_spent) - parseFloat(row.total_used),
      paid: parseFloat(row.total_spent),
      consumed: parseFloat(row.total_used)
    }));

    const rawSettlements = calculateSettlements(memberBalances);

    // ✅ NEW Feature 1: Get pending settlements (minus already settled)
    const pendingSettlements = await getNetSettlements(rawSettlements, id, eventId || null);

    // ✅ NEW Feature 1: Get completed settlements
    let settledQuery = `
      SELECT
        sr.amount, sr.note, sr.marked_at,
        fm.member_name AS from_name,
        tm.member_name AS to_name
      FROM settlement_records sr
      JOIN chapter_members fm ON sr.from_member_id = fm.id
      JOIN chapter_members tm ON sr.to_member_id = tm.id
      WHERE sr.chapter_id = $1 AND sr.status = 'settled'
    `;
    const settledParams = [id];
    if (eventId) {
      settledQuery += ` AND sr.event_id = $2`;
      settledParams.push(eventId);
    }
    settledQuery += ` ORDER BY sr.marked_at DESC`;
    const { rows: completedSettlements } = await db.query(settledQuery, settledParams);

    const totalChapterSpend = memberBalances.reduce((sum, m) => sum + m.paid, 0);

    // Expenses
    const expenseQuery = `
      SELECT e.id, e.description, e.amount, e.expense_date, cm.member_name as payer_name
      FROM expenses e
      JOIN chapter_members cm ON e.payer_member_id = cm.id
      WHERE e.chapter_id = $1 ${eventId ? "AND e.event_id = $2" : ""}
      ORDER BY e.expense_date DESC
    `;
    const expenseParams = eventId ? [id, eventId] : [id];
    const { rows: expenses } = await db.query(expenseQuery, expenseParams);

    // Splits
    const splitsQuery = `
      SELECT es.expense_id, cm.member_name
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      JOIN chapter_members cm ON es.member_id = cm.id
      WHERE e.chapter_id = $1 ${eventId ? "AND e.event_id = $2" : ""}
    `;
    const splitsParams = eventId ? [id, eventId] : [id];
    const { rows: allSplits } = await db.query(splitsQuery, splitsParams);

    const splitsMap = {};
    allSplits.forEach(s => {
      if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
      splitsMap[s.expense_id].push(s.member_name);
    });

    // ── BUILD EXCEL ─────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hisaab-Kitaab';
    workbook.created = new Date();

    const sheet1 = workbook.addWorksheet('Summary');
    sheet1.columns = [{ width: 10 }, { width: 30 }, { width: 20 }, { width: 15 }, { width: 40 }];

    sheet1.addRow([reportTitle]);
    sheet1.addRow([`Chapter Description - ${chapter.description || "N/A"}`]);
    sheet1.addRow([`Total Budget: ₹${totalChapterSpend.toFixed(2)}`]);
    sheet1.addRow([`Export Date: ${new Date().toLocaleDateString()}`]);
    sheet1.addRow([]);

    sheet1.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFD000FF' } };

    // Member balances table
    sheet1.addRow(['MEMBER', 'PAID', 'CONSUMED', 'NET BALANCE', 'STATUS']);
    const balanceHeaderRow = sheet1.lastRow;
    balanceHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    balanceHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

    memberBalances.forEach(m => {
      const net = m.balance;
      const status = net > 0 ? "Gets back" : (net < 0 ? "Owes" : "Settled");
      const row = sheet1.addRow([sanitizeCell(m.name), m.paid, m.consumed, net, status]);
      if (net > 0) row.getCell(4).font = { color: { argb: 'FF00B050' } };
      if (net < 0) row.getCell(4).font = { color: { argb: 'FFFF0000' } };
    });

    sheet1.addRow([]);

    // ✅ NEW Feature 1: PENDING settlements section
    sheet1.addRow(['PENDING SETTLEMENTS']).font = { bold: true, size: 12, color: { argb: 'FFFF6B00' } };

    if (pendingSettlements.length === 0) {
      sheet1.addRow(['All pending settlements cleared ✓']).font = { color: { argb: 'FF00B050' } };
    } else {
      const pendingHeader = sheet1.addRow(['FROM (Debtor)', 'TO (Creditor)', 'AMOUNT']);
      pendingHeader.font = { bold: true };
      pendingHeader.border = { bottom: { style: 'thin' } };

      pendingSettlements.forEach(s => {
        sheet1.addRow([s.from, s.to, parseFloat(s.amount)]);
      });
    }

    sheet1.addRow([]);

    // ✅ NEW Feature 1: COMPLETED settlements section
    sheet1.addRow(['COMPLETED SETTLEMENTS']).font = { bold: true, size: 12, color: { argb: 'FF00B050' } };

    if (completedSettlements.length === 0) {
      sheet1.addRow(['No settlements marked as completed yet.']);
    } else {
      const doneHeader = sheet1.addRow(['FROM', 'TO', 'AMOUNT', 'DATE', 'NOTE']);
      doneHeader.font = { bold: true };
      doneHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

      completedSettlements.forEach(s => {
        sheet1.addRow([
          sanitizeCell(s.from_name),
          sanitizeCell(s.to_name),
          parseFloat(s.amount),
          new Date(s.marked_at).toLocaleDateString(),
          sanitizeCell(s.note || '—')
        ]);
      });
    }

    sheet1.addRow([]);
    sheet1.addRow([]);

    // All Expenses table
    sheet1.addRow(['ALL EXPENSES RECORD']).font = { bold: true, size: 12, color: { argb: 'FFD000FF' } };
    sheet1.addRow(['S.No.', 'Description', 'Paid By', 'Amount', 'Split Between']);

    const expenseHeaderRow = sheet1.lastRow;
    expenseHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    expenseHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800080' } };

    expenses.forEach((ex, index) => {
      const splitNames = (splitsMap[ex.id] || []).join(", ");
      sheet1.addRow([
        index + 1,
        sanitizeCell(ex.description),
        sanitizeCell(ex.payer_name),
        parseFloat(ex.amount),
        sanitizeCell(splitNames),
      ]);
    });

    // Response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const safeName = filenamePrefix.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    res.setHeader("Content-Disposition", `attachment; filename=${safeName}_report.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ ok: false, message: "Failed to generate export" });
  }
}

module.exports = { exportChapter };