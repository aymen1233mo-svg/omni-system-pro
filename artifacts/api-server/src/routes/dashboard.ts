import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

router.get("/dashboard/summary", (req, res) => {
  const user = getAuthUser(req);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const todayStats = db.prepare(`
    SELECT COALESCE(SUM(total),0) as sales, COUNT(*) as orders
    FROM orders WHERE DATE(created_at)=? ${devFilter}
  `).get(today) as any;

  const todayReturns = db.prepare(`
    SELECT COALESCE(SUM(total_refund),0) as returns, COUNT(*) as return_orders
    FROM returns WHERE DATE(created_at)=? AND (status IS NULL OR status='approved') ${devFilter}
  `).get(today) as any;

  const todayProfit = db.prepare(`
    SELECT COALESCE(SUM((oi.unit_price - COALESCE(p.cost,0)) * oi.quantity), 0) as profit
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    LEFT JOIN products p ON p.id=oi.product_id
    WHERE DATE(o.created_at)=? ${devFilter}
  `).get(today) as any;

  const monthStats = db.prepare(`
    SELECT COALESCE(SUM(total),0) as sales, COUNT(*) as orders
    FROM orders WHERE DATE(created_at)>=? ${devFilter}
  `).get(monthStart) as any;

  const monthReturns = db.prepare(`
    SELECT COALESCE(SUM(total_refund),0) as returns
    FROM returns WHERE DATE(created_at)>=? AND (status IS NULL OR status='approved') ${devFilter}
  `).get(monthStart) as any;

  const netTodaySales = Math.max(0, Number(todayStats.sales || 0) - Number(todayReturns.returns || 0));
  const netMonthSales = Math.max(0, Number(monthStats.sales || 0) - Number(monthReturns.returns || 0));

  const totalProducts = (db.prepare("SELECT COUNT(*) as c FROM products WHERE active=1").get() as any).c;
  const totalCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers").get() as any).c;

  res.json({
    todaySales: netTodaySales,
    todayOrders: Math.max(0, Number(todayStats.orders || 0) - Number(todayReturns.return_orders || 0)),
    todayProfit: todayProfit.profit,
    monthSales: netMonthSales,
    monthOrders: monthStats.orders,
    totalProducts,
    totalCustomers,
  });
});

router.get("/dashboard/top-products", (req, res) => {
  const user = getAuthUser(req);
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";
  
  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const rows = db.prepare(`
    SELECT 
      oi.product_id as productId, 
      oi.product_name as productName,
      (SUM(oi.quantity) - COALESCE(ret.returnedQty, 0)) as totalQty, 
      (SUM(oi.total) - COALESCE(ret.returnedTotal, 0)) as totalRevenue
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    LEFT JOIN (
      SELECT 
        ri.product_id,
        SUM(ri.quantity) as returnedQty,
        SUM(ri.total) as returnedTotal
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      WHERE DATE(r.created_at)>=? AND (r.status IS NULL OR r.status='approved')
      GROUP BY ri.product_id
    ) ret ON ret.product_id = oi.product_id
    WHERE DATE(o.created_at)>=? ${devFilter}
    GROUP BY oi.product_id, oi.product_name
    HAVING totalQty > 0
    ORDER BY totalQty DESC LIMIT 10
  `).all(monthStart, monthStart);
  res.json(rows);
});

router.get("/dashboard/sales-by-hour", (req, res) => {
  const user = getAuthUser(req);
  const today = new Date().toISOString().slice(0, 10);
  
  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const rows = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
           COALESCE(SUM(total),0) as total, COUNT(*) as orders
    FROM orders
    WHERE DATE(created_at)=? ${devFilter}
    GROUP BY hour ORDER BY hour
  `).all(today);

  const result = Array.from({ length: 24 }, (_, h) => {
    const found = (rows as any[]).find(r => r.hour === h);
    return { hour: h, total: found?.total ?? 0, orders: found?.orders ?? 0 };
  });
  res.json(result);
});

export default router;
