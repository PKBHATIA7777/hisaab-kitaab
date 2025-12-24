/* server/controllers/exportController.js */
const db = require("../config/db");
const ExcelJS = require("exceljs");
const { calculateSettlements } = require("./expenseController");

async function exportChapter(req, res) {
  try {
    const { id } = req.params; // Chapter ID
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

    // 2. Fetch Summary Data (Spent vs Used)
    const summaryQuery = `
      WITH spent_cte AS (
        SELECT payer_member_id, SUM(amount) as total
        FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
      ),
      used_cte AS (
        SELECT es.member_id, SUM(es.amount_owed) as total
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.chapter_id = $1
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
    const { rows: summaryRows } = await db.query(summaryQuery, [id]);

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

    // 4. Fetch Detailed Expenses
    const { rows: expenses } = await db.query(
      `SELECT e.id, e.description, e.amount, e.expense_date, cm.member_name as payer_name
       FROM expenses e
       JOIN chapter_members cm ON e.payer_member_id = cm.id
       WHERE e.chapter_id = $1
       ORDER BY e.expense_date DESC`,
      [id]
    );

    // 5. Fetch Splits
    const { rows: allSplits } = await db.query(
      `SELECT es.expense_id, cm.member_name 
       FROM expense_splits es
       JOIN expenses e ON es.expense_id = e.id
       JOIN chapter_members cm ON es.member_id = cm.id
       WHERE e.chapter_id = $1`,
      [id]
    );

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

    // ✅ MODIFICATION 1: Updated Header Format
    const chapterNameTitle = `Chapter Name - ${chapter.name}`;
    const chapterDescTitle = `Chapter Description - ${chapter.description || "N/A"}`;

    sheet1.addRow([chapterNameTitle]);
    sheet1.addRow([chapterDescTitle]);
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Chapter_Report_${id}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ ok: false, message: "Failed to generate export" });
  }
}

module.exports = { exportChapter };


// /* server/controllers/exportController.js */
// const db = require("../config/db");
// const ExcelJS = require("exceljs");
// const { calculateSettlements } = require("./expenseController");

// async function exportChapter(req, res) {
//   try {
//     const { id } = req.params; // Chapter ID
//     const userId = req.user.userId;

//     // 1. Verify Access & Fetch Chapter Details
//     const { rows: chapterRows } = await db.query(
//       "SELECT * FROM chapters WHERE id = $1 AND created_by = $2",
//       [id, userId]
//     );

//     if (chapterRows.length === 0) {
//       return res.status(403).json({ ok: false, message: "Unauthorized or Chapter not found" });
//     }
//     const chapter = chapterRows[0];

//     // 2. Fetch Summary Data (Spent vs Used)
//     // (Reusing logic from expenseController to ensure numbers match)
//     const summaryQuery = `
//       WITH spent_cte AS (
//         SELECT payer_member_id, SUM(amount) as total
//         FROM expenses WHERE chapter_id = $1 GROUP BY payer_member_id
//       ),
//       used_cte AS (
//         SELECT es.member_id, SUM(es.amount_owed) as total
//         FROM expense_splits es
//         JOIN expenses e ON es.expense_id = e.id
//         WHERE e.chapter_id = $1
//         GROUP BY es.member_id
//       )
//       SELECT 
//         cm.id, 
//         cm.member_name, 
//         COALESCE(s.total, 0) as total_spent,
//         COALESCE(u.total, 0) as total_used
//       FROM chapter_members cm
//       LEFT JOIN spent_cte s ON cm.id = s.payer_member_id
//       LEFT JOIN used_cte u ON cm.id = u.member_id
//       WHERE cm.chapter_id = $1
//       ORDER BY total_spent DESC
//     `;
//     const { rows: summaryRows } = await db.query(summaryQuery, [id]);

//     // 3. Prepare Balances for Settlement Calculation
//     const memberBalances = summaryRows.map(row => ({
//       id: row.id,
//       name: row.member_name,
//       balance: parseFloat(row.total_spent) - parseFloat(row.total_used),
//       paid: parseFloat(row.total_spent),
//       consumed: parseFloat(row.total_used)
//     }));

//     const settlements = calculateSettlements(memberBalances);
//     const totalChapterSpend = memberBalances.reduce((sum, m) => sum + m.paid, 0);

//     // 4. Fetch Detailed Expenses
//     const { rows: expenses } = await db.query(
//       `SELECT e.id, e.description, e.amount, e.expense_date, cm.member_name as payer_name
//        FROM expenses e
//        JOIN chapter_members cm ON e.payer_member_id = cm.id
//        WHERE e.chapter_id = $1
//        ORDER BY e.expense_date DESC`,
//       [id]
//     );

//     // 5. Fetch Splits for all these expenses (to show "Split Among")
//     const { rows: allSplits } = await db.query(
//       `SELECT es.expense_id, cm.member_name 
//        FROM expense_splits es
//        JOIN expenses e ON es.expense_id = e.id
//        JOIN chapter_members cm ON es.member_id = cm.id
//        WHERE e.chapter_id = $1`,
//       [id]
//     );

//     // Group splits by expense ID: { 101: ["Alice", "Bob"], 102: ["Bob"] }
//     const splitsMap = {};
//     allSplits.forEach(s => {
//       if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
//       splitsMap[s.expense_id].push(s.member_name);
//     });

//     // ==========================================
//     // 6. GENERATE EXCEL
//     // ==========================================
//     const workbook = new ExcelJS.Workbook();
//     workbook.creator = 'Hisaab-Kitaab';
//     workbook.created = new Date();

//     // --- SHEET 1: SUMMARY ---
//     const sheet1 = workbook.addWorksheet('Summary');

//     // Header Info
//     sheet1.columns = [{ width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];
//     sheet1.addRow([chapter.name.toUpperCase()]);
//     sheet1.addRow([chapter.description || "No description"]);
//     sheet1.addRow([`Total Budget: ₹${totalChapterSpend.toFixed(2)}`]);
//     sheet1.addRow([`Export Date: ${new Date().toLocaleDateString()}`]);
//     sheet1.addRow([]); // Spacer

//     // Style the Title
//     sheet1.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFD000FF' } };

//     // Table: Member Balances
//     sheet1.addRow(['MEMBER', 'PAID', 'CONSUMED', 'NET BALANCE', 'STATUS']);
//     sheet1.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
//     sheet1.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

//     memberBalances.forEach(m => {
//       const net = m.balance;
//       const status = net > 0 ? "Gets back" : (net < 0 ? "Owes" : "Settled");
//       const row = sheet1.addRow([
//         m.name, 
//         m.paid, 
//         m.consumed, 
//         net, 
//         status
//       ]);
      
//       // Color coding logic
//       if(net > 0) row.getCell(4).font = { color: { argb: 'FF00B050' } }; // Green
//       if(net < 0) row.getCell(4).font = { color: { argb: 'FFFF0000' } }; // Red
//     });

//     sheet1.addRow([]); // Spacer
//     sheet1.addRow(['SETTLEMENT PLAN']).font = { bold: true, size: 12 };
    
//     if (settlements.length === 0) {
//         sheet1.addRow(['All settled up! No debts.']);
//     } else {
//         sheet1.addRow(['FROM (Debtor)', 'TO (Creditor)', 'AMOUNT']);
//         // Style Header
//         sheet1.lastRow.font = { bold: true };
//         sheet1.lastRow.border = { bottom: { style: 'thin' } };

//         settlements.forEach(s => {
//             sheet1.addRow([s.from, s.to, parseFloat(s.amount)]);
//         });
//     }

//     // --- SHEET 2: EXPENSES LOG ---
//     const sheet2 = workbook.addWorksheet('Expense Log');
//     sheet2.columns = [
//       { header: 'Date', key: 'date', width: 15 },
//       { header: 'Description', key: 'desc', width: 30 },
//       { header: 'Payer', key: 'payer', width: 15 },
//       { header: 'Amount', key: 'amount', width: 15 },
//       { header: 'Split Between', key: 'splits', width: 40 },
//     ];

//     // Style Header
//     sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
//     sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD000FF' } };

//     expenses.forEach(ex => {
//       const splitNames = (splitsMap[ex.id] || []).join(", ");
//       sheet2.addRow({
//         date: new Date(ex.expense_date).toLocaleDateString(),
//         desc: ex.description,
//         payer: ex.payer_name,
//         amount: parseFloat(ex.amount),
//         splits: splitNames
//       });
//     });

//     // 7. Stream Response
//     res.setHeader(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=Chapter_Report_${id}.xlsx`
//     );

//     await workbook.xlsx.write(res);
//     res.end();

//   } catch (err) {
//     console.error("Export Error:", err);
//     res.status(500).json({ ok: false, message: "Failed to generate export" });
//   }
// }

// module.exports = { exportChapter };