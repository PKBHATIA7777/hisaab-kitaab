/* server/controllers/exportController.js */
const db = require("../config/db");
const ExcelJS = require("exceljs");
const { calculateSettlements } = require("./expenseController");

async function exportChapter(req, res) {
  try {
    const { id } = req.params; // Chapter ID
    const { eventId } = req.query; // ✅ Get eventId from URL
    const userId = req.user.userId;

    // 1. Verify Access & Fetch Chapter Details
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

    // If Event ID exists, fetch event name to append to filename and title
    if (eventId) {
      const { rows: ev } = await db.query("SELECT name FROM events WHERE id = $1 AND chapter_id = $2", [eventId, id]);
      if (ev.length > 0) {
        reportTitle += ` - ${ev[0].name}`;
        filenamePrefix += `_${ev[0].name}`;
      }
    }

    // 2. Fetch Summary Data (Spent vs Used) - Filtered by eventId if provided
    const summaryQuery = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses 
        WHERE chapter_id = $1 
        ${eventId ? "AND event_id = $2" : ""}
        GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1
        ${eventId ? "AND e.event_id = $2" : ""}
        GROUP BY es.member_id
      )
      SELECT 
        cm.id, 
        cm.member_name, 
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

    // 3. Prepare Balances for Settlement Calculation
    const memberBalances = summaryRows.map(row => ({
      id: row.id,
      name: row.member_name,
      balance: parseFloat(row.total_spent) - parseFloat(row.total_used),
      paid: parseFloat(row.total_spent),
      consumed: parseFloat(row.total_used)
    }));

    const settlements = calculateSettlements(memberBalances);
    const totalChapterSpend = memberBalances.reduce((sum, m) => sum + m.paid, 0);

    // 4. Fetch Detailed Expenses - Filtered by eventId if provided
    const expenseQuery = `
      SELECT e.id, e.description, e.amount, e.expense_date, cm.member_name as payer_name
      FROM expenses e
      JOIN chapter_members cm ON e.payer_member_id = cm.id
      WHERE e.chapter_id = $1
      ${eventId ? "AND e.event_id = $2" : ""}
      ORDER BY e.expense_date DESC
    `;
    const expenseParams = eventId ? [id, eventId] : [id];
    const { rows: expenses } = await db.query(expenseQuery, expenseParams);

    // 5. Fetch Splits - Filtered by eventId if provided
    const splitsQuery = `
      SELECT es.expense_id, cm.member_name 
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      JOIN chapter_members cm ON es.member_id = cm.id
      WHERE e.chapter_id = $1
      ${eventId ? "AND e.event_id = $2" : ""}
    `;
    const splitsParams = eventId ? [id, eventId] : [id];
    const { rows: allSplits } = await db.query(splitsQuery, splitsParams);

    const splitsMap = {};
    allSplits.forEach(s => {
      if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
      splitsMap[s.expense_id].push(s.member_name);
    });

    // ==========================================
    // 6. GENERATE EXCEL
    // ==========================================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hisaab-Kitaab';
    workbook.created = new Date();

    // --- SHEET 1: SUMMARY ---
    const sheet1 = workbook.addWorksheet('Summary');

    // Define column widths
    sheet1.columns = [{ width: 10 }, { width: 30 }, { width: 20 }, { width: 15 }, { width: 40 }];

    // ✅ MODIFICATION 1: Updated Header Format with Report Title
    sheet1.addRow([reportTitle]); // Uses dynamic title (with event if provided)
    sheet1.addRow([`Chapter Description - ${chapter.description || "N/A"}`]);
    sheet1.addRow([`Total Budget: ₹${totalChapterSpend.toFixed(2)}`]);
    sheet1.addRow([`Export Date: ${new Date().toLocaleDateString()}`]);
    sheet1.addRow([]); // Spacer

    // Style the Title (Keep existing color)
    sheet1.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFD000FF' } };

    // --- Table 1: Member Balances ---
    sheet1.addRow(['MEMBER', 'PAID', 'CONSUMED', 'NET BALANCE', 'STATUS']);
    
    // Style Header Row
    const balanceHeaderRow = sheet1.lastRow;
    balanceHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    balanceHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

    memberBalances.forEach(m => {
      const net = m.balance;
      const status = net > 0 ? "Gets back" : (net < 0 ? "Owes" : "Settled");
      const row = sheet1.addRow([
        m.name, 
        m.paid, 
        m.consumed, 
        net, 
        status
      ]);
      
      // Color coding logic
      if(net > 0) row.getCell(4).font = { color: { argb: 'FF00B050' } }; // Green
      if(net < 0) row.getCell(4).font = { color: { argb: 'FFFF0000' } }; // Red
    });

    sheet1.addRow([]); // Spacer

    // --- Table 2: Settlement Plan ---
    sheet1.addRow(['SETTLEMENT PLAN']).font = { bold: true, size: 12 };
    
    if (settlements.length === 0) {
        sheet1.addRow(['All settled up! No debts.']);
    } else {
        sheet1.addRow(['FROM (Debtor)', 'TO (Creditor)', 'AMOUNT']);
        sheet1.lastRow.font = { bold: true };
        sheet1.lastRow.border = { bottom: { style: 'thin' } };

        settlements.forEach(s => {
            sheet1.addRow([s.from, s.to, parseFloat(s.amount)]);
        });
    }

    sheet1.addRow([]); // Spacer
    sheet1.addRow([]); // Extra Spacer before expenses

    // ✅ MODIFICATION 2: Add Expense Table to Sheet 1
    sheet1.addRow(['ALL EXPENSES RECORD']).font = { bold: true, size: 12, color: { argb: 'FFD000FF' } };
    
    // Headers: S.No., Description, Paid By, Amount, Split Between
    sheet1.addRow(['S.No.', 'Description', 'Paid By', 'Amount', 'Split Between']);
    
    // Style the Expense Header
    const expenseHeaderRow = sheet1.lastRow;
    expenseHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    expenseHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800080' } }; // Purple background

    // Add Data Rows
    expenses.forEach((ex, index) => {
      const splitNames = (splitsMap[ex.id] || []).join(", ");
      sheet1.addRow([
        index + 1,           // S.No.
        ex.description,      // Description
        ex.payer_name,       // Paid By
        parseFloat(ex.amount), // Amount
        splitNames           // Divided Among
      ]);
    });

    // 7. Stream Response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    
    // Sanitize filename
    const safeName = filenamePrefix.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${safeName}_report.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ ok: false, message: "Failed to generate export" });
  }
}

module.exports = { exportChapter };