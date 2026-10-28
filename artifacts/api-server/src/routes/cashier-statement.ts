import { Router } from "express";
import { getAuthUser } from "./auth";
import { db } from "../lib/sqlite";
import { getSqlBusinessDateModifier } from "../lib/business-day";

const router = Router();

router.get("/reports/cashier-statement", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "accountant")) {
    return res.status(403).json({ error: "غير مصرح لك" });
  }

  const { startDate, endDate, cashierId } = req.query;

  try {
    const isDev = user.role === "developer" || user.username === "developer";
    const devSalesFilter = isDev ? "" : " AND o.user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer' OR name LIKE '%مطور%') AND u.role != 'developer' AND u.username != 'developer' AND u.name NOT LIKE '%مطور%' ";
    const devReturnsFilter = isDev ? "" : " AND r.user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer' OR name LIKE '%مطور%') ";
    const devShiftFilter = isDev ? "" : " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer' OR name LIKE '%مطور%') AND user_name NOT LIKE '%مطور%' AND user_name != 'developer' ";
    const devExpenseFilter = isDev ? "" : " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer' OR name LIKE '%مطور%') ";

    const salesMod = getSqlBusinessDateModifier("sales");
    const salesDateExpr = `date(datetime(o.created_at, '${salesMod}'))`;
    const returnsDateExpr = `date(datetime(r.created_at, '${salesMod}'))`;
    const shiftDateExpr = `date(datetime(start_time, '${salesMod}'))`;

    let dateCond = "";
    let userCond = "";
    const params: any[] = [];
    
    if (startDate && endDate) {
      dateCond = `BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else {
      dateCond = `!= ''`; // dummy true condition
    }

    if (cashierId && cashierId !== "all") {
      userCond = `= ?`;
      params.push(Number(cashierId));
    } else {
      userCond = `!= -1`; // dummy true condition
    }

    // We will apply the params multiple times in the query
    const allParams = [];
    for (let i = 0; i < 4; i++) {
      if (startDate && endDate) allParams.push(startDate, endDate);
      if (cashierId && cashierId !== "all") allParams.push(Number(cashierId));
    }

    const query = `
      WITH sales_data AS (
        SELECT 
          ${salesDateExpr} as shift_date,
          u.name as cashier_name,
          o.user_id,
          CASE WHEN o.payment_method = 'credit' THEN 'أجل' ELSE 'نقدي' END as sale_type,
          COUNT(o.id) as invoice_count,
          SUM(o.subtotal + o.tax) as total_sales,
          SUM(o.discount) as total_discount,
          SUM(COALESCE(o.card_amount, CASE WHEN o.payment_method = 'card' THEN o.total ELSE 0 END)) as card_payments
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.status != 'cancelled' AND ${salesDateExpr} ${dateCond} AND o.user_id ${userCond} ${devSalesFilter}
        GROUP BY ${salesDateExpr}, u.name, o.user_id, CASE WHEN o.payment_method = 'credit' THEN 'أجل' ELSE 'نقدي' END
      ),
      returns_data AS (
        SELECT 
          ${returnsDateExpr} as shift_date,
          r.user_id,
          CASE WHEN r.payment_method = 'credit' THEN 'أجل' ELSE 'نقدي' END as sale_type,
          SUM(r.total_refund) as total_returns
        FROM returns r
        WHERE r.status = 'approved' AND ${returnsDateExpr} ${dateCond} AND r.user_id ${userCond} ${devReturnsFilter}
        GROUP BY ${returnsDateExpr}, r.user_id, CASE WHEN r.payment_method = 'credit' THEN 'أجل' ELSE 'نقدي' END
      ),
      deposits_data AS (
        SELECT 
          ${shiftDateExpr} as shift_date,
          user_id,
          SUM(deposits) as total_deposits
        FROM cash_shifts
        WHERE ${shiftDateExpr} ${dateCond} AND user_id ${userCond} ${devShiftFilter}
        GROUP BY ${shiftDateExpr}, user_id
      ),
      expenses_data AS (
        SELECT 
          date(expense_date) as shift_date,
          user_id,
          SUM(amount) as total_expenses
        FROM expenses
        WHERE date(expense_date) ${dateCond} AND user_id ${userCond} ${devExpenseFilter}
        GROUP BY date(expense_date), user_id
      )
      SELECT 
        s.shift_date as date,
        s.cashier_name as cashier,
        s.invoice_count,
        s.sale_type,
        COALESCE(s.total_sales, 0) as sales,
        COALESCE(r.total_returns, 0) as returns,
        COALESCE(s.total_discount, 0) as discount,
        CASE WHEN s.sale_type = 'نقدي' THEN COALESCE(d.total_deposits, 0) ELSE 0 END as deposits,
        CASE WHEN s.sale_type = 'نقدي' THEN COALESCE(s.card_payments, 0) ELSE 0 END as network,
        CASE WHEN s.sale_type = 'نقدي' THEN COALESCE(e.total_expenses, 0) ELSE 0 END as accounting_entries
      FROM sales_data s
      LEFT JOIN returns_data r ON r.shift_date = s.shift_date AND r.user_id = s.user_id AND r.sale_type = s.sale_type
      LEFT JOIN deposits_data d ON d.shift_date = s.shift_date AND d.user_id = s.user_id
      LEFT JOIN expenses_data e ON e.shift_date = s.shift_date AND e.user_id = s.user_id
      ORDER BY s.shift_date DESC, s.cashier_name, s.sale_type DESC;
    `;

    const rows = db.prepare(query).all(...allParams);
    
    // Process rows to calculate balance
    const processedRows = rows.map((r: any) => {
        const netSales = r.sales - r.returns - r.discount;
        let balance = null;
        if (r.sale_type === 'نقدي') {
            balance = netSales - r.deposits - r.network - r.accounting_entries;
        }
        return {
            ...r,
            netSales,
            balance
        };
    });

    res.json(processedRows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
