import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return user;
}

router.get("/shifts/active", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const shift = db.prepare("SELECT * FROM cash_shifts WHERE user_id=? AND status='open' ORDER BY id DESC LIMIT 1").get(user.id) as any;
  if (!shift) {
    res.json(null);
    return;
  }

  const sales = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END), 0) as gross_cash_sales,
      COALESCE(SUM(CASE WHEN payment_method!='cash' THEN total ELSE 0 END), 0) as gross_card_sales,
      COUNT(id) as orders_count
    FROM orders 
    WHERE user_id=? AND created_at >= ?
  `).get(user.id, shift.start_time) as any;

  const returns_ = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN r.payment_method='cash' THEN r.total_refund ELSE 0 END), 0) as cash_returns,
      COALESCE(SUM(CASE WHEN r.payment_method!='cash' THEN r.total_refund ELSE 0 END), 0) as card_returns,
      COUNT(r.id) as returns_count
    FROM returns r
    LEFT JOIN orders o ON o.id = r.order_id OR (r.order_id IS NULL AND o.invoice_number = r.invoice_number)
    WHERE (r.user_id = ? OR o.user_id = ?) AND r.created_at >= ?
  `).get(user.id, user.id, shift.start_time) as any;

  const grossCash = sales.gross_cash_sales;
  const grossCard = sales.gross_card_sales;
  const cashReturns = returns_.cash_returns;
  const cardReturns = returns_.card_returns;

  const netCash = Math.max(0, grossCash - cashReturns);
  const netCard = Math.max(0, grossCard - cardReturns);

  res.json({
    ...shift,
    gross_cash_sales: grossCash,
    gross_card_sales: grossCard,
    cash_returns: cashReturns,
    card_returns: cardReturns,
    cash_sales: netCash,
    card_sales: netCard,
    orders_count: sales.orders_count,
    returns_count: returns_.returns_count,
    expected_cash: shift.starting_cash + netCash + (shift.deposits || 0) - (shift.withdrawals || 0)
  });
});

router.post("/shifts/open", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { starting_cash, safe_id, branch_id } = req.body;
  const activeShift = db.prepare("SELECT id FROM cash_shifts WHERE user_id=? AND status='open'").get(user.id);
  if (activeShift) {
    res.status(400).json({ error: "لديك وردية مفتوحة بالفعل" });
    return;
  }
  const r = db.prepare("INSERT INTO cash_shifts (user_id, user_name, starting_cash, status, safe_id, branch_id) VALUES (?,?,?, 'open', ?, ?)")
    .run(user.id, user.name, starting_cash ?? 0, safe_id ? Number(safe_id) : 1, branch_id ? Number(branch_id) : 1);
  logAudit(user.id, user.name, "فتح وردية", `بدء وردية بمبلغ أساسي ${starting_cash ?? 0}`);
  res.status(201).json({ id: r.lastInsertRowid, starting_cash: starting_cash ?? 0, status: "open", safe_id: safe_id ?? 1 });
});

router.post("/shifts/close", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { shift_id, actual_cash, withdrawals, deposits } = req.body;
  const shift = db.prepare("SELECT * FROM cash_shifts WHERE id=? AND user_id=? AND status='open'").get(shift_id, user.id) as any;
  if (!shift) {
    res.status(404).json({ error: "الوردية غير موجودة أو مغلقة مسبقاً" });
    return;
  }

  // Calculate sales during shift time
  const sales = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method!='cash' THEN total ELSE 0 END), 0) as card_sales
    FROM orders 
    WHERE user_id=? AND created_at >= ?
  `).get(user.id, shift.start_time) as any;

  // Calculate returns during shift time
  const returns_ = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN r.payment_method='cash' THEN r.total_refund ELSE 0 END), 0) as cash_returns,
      COALESCE(SUM(CASE WHEN r.payment_method!='cash' THEN r.total_refund ELSE 0 END), 0) as card_returns
    FROM returns r
    LEFT JOIN orders o ON o.id = r.order_id OR (r.order_id IS NULL AND o.invoice_number = r.invoice_number)
    WHERE (r.user_id = ? OR o.user_id = ?) AND r.created_at >= ?
  `).get(user.id, user.id, shift.start_time) as any;

  const grossCashSales = sales.cash_sales;
  const grossCardSales = sales.card_sales;
  const cashReturns = returns_.cash_returns;
  const cardReturns = returns_.card_returns;

  const netCashSales = Math.max(0, grossCashSales - cashReturns);
  const netCardSales = Math.max(0, grossCardSales - cardReturns);

  const withAmt = withdrawals ?? 0;
  const depAmt = deposits ?? 0;

  const expectedCash = shift.starting_cash + netCashSales + depAmt - withAmt;
  const actCash = actual_cash ?? expectedCash;
  const difference = actCash - expectedCash;

  db.prepare(`
    UPDATE cash_shifts 
    SET end_time = datetime('now'), cash_sales = ?, card_sales = ?, withdrawals = ?, deposits = ?, actual_cash = ?, difference = ?, status = 'closed'
    WHERE id = ?
  `).run(netCashSales, netCardSales, withAmt, depAmt, actCash, difference, shift.id);

  logAudit(user.id, user.name, "إغلاق وردية", `إغلاق الوردية رقم ${shift.id} - المبيعات الصافية: ${netCashSales}، المرتجعات: ${cashReturns}، العجز/الزيادة: ${difference}`);
  res.json({ 
    success: true, 
    expectedCash, 
    actualCash: actCash, 
    difference, 
    cashSales: netCashSales, 
    cardSales: netCardSales,
    grossCashSales,
    cashReturns,
    grossCardSales,
    cardReturns
  });
});

export default router;
