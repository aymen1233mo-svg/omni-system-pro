import { Router } from "express";
import { db, seedWorkReportsAndPDFData } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { getSqlBusinessDateModifier } from "../lib/business-day";

const router = Router();

// 1. Daily / Periodic Sales Report
router.get("/reports/sales", (req, res) => {
  const user = getAuthUser(req);
  const { startDate, endDate, groupBy = "day" } = req.query;
  let format = "%Y-%m-%d";
  if (groupBy === "month") format = "%Y-%m";
  if (groupBy === "year") format = "%Y";

  let devFilterOrders = "";
  let devFilterReturns = "";
  if (!user || user.role !== "developer") {
    devFilterOrders = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
    devFilterReturns = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const salesMod = getSqlBusinessDateModifier("sales");
  
  let salesSql = `
    SELECT strftime(?, datetime(created_at, '${salesMod}')) as period,
           COALESCE(SUM(total), 0) as gross_total,
           COALESCE(SUM(subtotal), 0) as subtotal,
           COALESCE(SUM(discount), 0) as discount,
           COALESCE(SUM(tax), 0) as tax,
           COUNT(*) as orders
    FROM orders 
    WHERE (status IS NULL OR status != 'cancelled') ${devFilterOrders}
  `;
  const params: any[] = [format];
  if (startDate) { salesSql += ` AND date(datetime(created_at, '${salesMod}'))>=?`; params.push(startDate); }
  if (endDate) { salesSql += ` AND date(datetime(created_at, '${salesMod}'))<=?`; params.push(endDate); }
  salesSql += " GROUP BY period ORDER BY period";

  const salesRows = db.prepare(salesSql).all(...params) as any[];

  let returnsSql = `
    SELECT strftime(?, datetime(created_at, '${salesMod}')) as period,
           COALESCE(SUM(total_refund), 0) as total_refund,
           COALESCE(SUM(subtotal), 0) as ret_subtotal,
           COALESCE(SUM(tax), 0) as ret_tax,
           COALESCE(SUM(discount), 0) as ret_discount,
           COUNT(*) as returns_count
    FROM returns 
    WHERE status = 'approved' ${devFilterReturns}
  `;
  const retParams: any[] = [format];
  if (startDate) { returnsSql += ` AND date(datetime(created_at, '${salesMod}'))>=?`; retParams.push(startDate); }
  if (endDate) { returnsSql += ` AND date(datetime(created_at, '${salesMod}'))<=?`; retParams.push(endDate); }
  returnsSql += " GROUP BY period";

  const returnRows = db.prepare(returnsSql).all(...retParams) as any[];
  const returnsMap: Record<string, any> = {};
  for (const r of returnRows) {
    returnsMap[r.period] = {
      total_refund: Number(r.total_refund || 0),
      ret_subtotal: Number(r.ret_subtotal || 0),
      ret_tax: Number(r.ret_tax || 0),
      ret_discount: Number(r.ret_discount || 0),
      returns_count: Number(r.returns_count || 0)
    };
  }

  // Combine periods from both sales and returns
  const allPeriodsSet = new Set<string>();
  salesRows.forEach(s => allPeriodsSet.add(s.period));
  returnRows.forEach(r => allPeriodsSet.add(r.period));

  const sortedPeriods = Array.from(allPeriodsSet).sort();

  const rows = sortedPeriods.map(period => {
    const s = salesRows.find(item => item.period === period) || {
      period,
      gross_total: 0,
      subtotal: 0,
      discount: 0,
      tax: 0,
      orders: 0
    };
    const ret = returnsMap[period] || {
      total_refund: 0,
      ret_subtotal: 0,
      ret_tax: 0,
      ret_discount: 0,
      returns_count: 0
    };

    const grossTotal = Number(s.gross_total || 0);
    const retAmount = Number(ret.total_refund || 0);
    const netTotal = Math.max(0, grossTotal - retAmount);
    const netSubtotal = Math.max(0, Number(s.subtotal || 0) - Number(ret.ret_subtotal || 0));
    const netTax = Math.max(0, Number(s.tax || 0) - Number(ret.ret_tax || 0));

    return {
      period,
      orders: Number(s.orders || 0),
      gross_total: grossTotal,
      returnsTotal: retAmount,
      returnsCount: Number(ret.returns_count || 0),
      total: netTotal,
      subtotal: netSubtotal,
      discount: Number(s.discount || 0),
      tax: netTax
    };
  });

  res.json(rows);
});

// 2. Sales by Cashier Report
router.get("/reports/by-cashier", (req, res) => {
  const user = getAuthUser(req);
  const { startDate, endDate } = req.query;

  let dateFilterOrders = "";
  let dateFilterReturns = "";
  const orderParams: any[] = [];
  const retParams: any[] = [];

  const salesMod = getSqlBusinessDateModifier("sales");
  if (startDate) {
    dateFilterOrders += ` AND date(datetime(o.created_at, '${salesMod}'))>=? `;
    orderParams.push(startDate);
    dateFilterReturns += ` AND date(datetime(r.created_at, '${salesMod}'))>=? `;
    retParams.push(startDate);
  }
  if (endDate) {
    dateFilterOrders += ` AND date(datetime(o.created_at, '${salesMod}'))<=? `;
    orderParams.push(endDate);
    dateFilterReturns += ` AND date(datetime(r.created_at, '${salesMod}'))<=? `;
    retParams.push(endDate);
  }
  const params: any[] = [...orderParams, ...retParams];

  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND u.role != 'developer' AND u.username != 'developer' ";
  }

  const sql = `
    SELECT 
      u.id as userId, 
      u.name as userName,
      u.role as userRole,
      COALESCE(ord.ordersCount, 0) as orders,
      COALESCE(ord.grossTotal, 0) as grossTotal,
      COALESCE(ret.returnsTotal, 0) as returnsTotal,
      COALESCE(ret.returnsCount, 0) as returnsCount,
      (COALESCE(ord.grossTotal, 0) - COALESCE(ret.returnsTotal, 0)) as total,
      COALESCE(ord.subtotal, 0) as subtotal,
      COALESCE(ord.discount, 0) as discount,
      COALESCE(ord.tax, 0) as tax
    FROM users u
    LEFT JOIN (
      SELECT o.user_id,
             COUNT(DISTINCT o.id) as ordersCount,
             SUM(o.total) as grossTotal,
             SUM(o.subtotal) as subtotal,
             SUM(o.discount) as discount,
             SUM(o.tax) as tax
      FROM orders o
      WHERE (o.status IS NULL OR o.status != 'cancelled')
      ${dateFilterOrders}
      GROUP BY o.user_id
    ) ord ON ord.user_id = u.id
    LEFT JOIN (
      SELECT 
        COALESCE(o2.user_id, r.user_id) as uid,
        SUM(r.total_refund) as returnsTotal,
        COUNT(r.id) as returnsCount
      FROM returns r
      LEFT JOIN orders o2 ON o2.id = r.order_id OR (r.order_id IS NULL AND o2.invoice_number = r.invoice_number)
      WHERE r.status = 'approved'
      ${dateFilterReturns}
      GROUP BY COALESCE(o2.user_id, r.user_id)
    ) ret ON ret.uid = u.id
    WHERE u.active = 1 ${devFilter}
      AND (COALESCE(ord.ordersCount, 0) > 0 OR COALESCE(ret.returnsCount, 0) > 0)
    ORDER BY total DESC
  `;

  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Sales by Product Report
router.get("/reports/by-product", (req, res) => {
  const user = getAuthUser(req);
  const { startDate, endDate, limit } = req.query;
  
  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND o.user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const salesMod = getSqlBusinessDateModifier("sales");

  let orderDateFilter = "";
  const orderParams: any[] = [];
  if (startDate) { orderDateFilter += ` AND date(datetime(o.created_at, '${salesMod}'))>=?`; orderParams.push(startDate); }
  if (endDate) { orderDateFilter += ` AND date(datetime(o.created_at, '${salesMod}'))<=?`; orderParams.push(endDate); }

  let retDateFilter = "";
  const retParams: any[] = [];
  if (startDate) { retDateFilter += ` AND date(datetime(r.created_at, '${salesMod}'))>=?`; retParams.push(startDate); }
  if (endDate) { retDateFilter += ` AND date(datetime(r.created_at, '${salesMod}'))<=?`; retParams.push(endDate); }

  let sql = `
    SELECT p_agg.productId, 
           p_agg.productName,
           p_agg.categoryName,
           p_agg.categoryId,
           p_agg.unitPrice,
           p_agg.grossQty,
           p_agg.grossRevenue,
           p_agg.grossProfit,
           p_agg.orderCount,
           p_agg.cost,
           COALESCE(ret.returnedQty, 0) as returnedQty,
           COALESCE(ret.returnedRevenue, 0) as returnedRevenue
    FROM (
      SELECT COALESCE(p.id, oi.product_id) as productId,
             COALESCE(p.name, oi.product_name) as productName,
             MAX(COALESCE(NULLIF(oi.category_name, ''), c.name, 'غير مصنّف')) as categoryName,
             MAX(COALESCE(oi.category_id, p.category_id)) as categoryId,
             ROUND(COALESCE(AVG(oi.unit_price), 0), 2) as unitPrice,
             COALESCE(p.cost, 0) as cost,
             SUM(oi.quantity) as grossQty,
             COALESCE(SUM(oi.total), 0) as grossRevenue,
             COALESCE(SUM((oi.unit_price - COALESCE(p.cost, 0)) * oi.quantity), 0) as grossProfit,
             COUNT(DISTINCT oi.order_id) as orderCount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON (p.id = oi.product_id OR p.number = oi.product_id OR p.name = oi.product_name)
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE (o.status IS NULL OR o.status != 'cancelled') ${devFilter} ${orderDateFilter}
      GROUP BY COALESCE(p.id, oi.product_id), COALESCE(p.name, oi.product_name)
    ) p_agg
    LEFT JOIN (
      SELECT 
        COALESCE(p.id, ri.product_id) as pid,
        COALESCE(p.name, ri.product_name) as productName,
        SUM(ri.quantity) as returnedQty,
        SUM(ri.total) as returnedRevenue
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      LEFT JOIN products p ON (p.id = ri.product_id OR p.number = ri.product_id OR p.name = ri.product_name)
      WHERE r.status = 'approved' ${retDateFilter}
      GROUP BY COALESCE(p.id, ri.product_id), COALESCE(p.name, ri.product_name)
    ) ret ON ret.pid = p_agg.productId OR ret.productName = p_agg.productName
    ORDER BY (p_agg.grossRevenue - COALESCE(ret.returnedRevenue, 0)) DESC
  `;
  const params: any[] = [...orderParams, ...retParams];
  if (limit) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }

  const rawRows = db.prepare(sql).all(...params) as any[];
  const rows = rawRows.map(r => {
    const netQty = Math.max(0, Number(r.grossQty || 0) - Number(r.returnedQty || 0));
    const netRevenue = Math.max(0, Number(r.grossRevenue || 0) - Number(r.returnedRevenue || 0));
    const unitCost = Number(r.cost || 0);
    const netProfit = Math.max(0, netRevenue - (netQty * unitCost));
    return {
      ...r,
      totalQty: netQty,
      totalRevenue: netRevenue,
      totalProfit: netProfit
    };
  });

  res.json(rows);
});

// 4. Sales by Category Report
router.get("/reports/by-category", (req, res) => {
  const user = getAuthUser(req);
  const { startDate, endDate } = req.query;

  let devFilter = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND o.user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const salesMod = getSqlBusinessDateModifier("sales");

  let orderDateFilter = "";
  const orderParams: any[] = [];
  if (startDate) { orderDateFilter += ` AND date(datetime(o.created_at, '${salesMod}'))>=?`; orderParams.push(startDate); }
  if (endDate) { orderDateFilter += ` AND date(datetime(o.created_at, '${salesMod}'))<=?`; orderParams.push(endDate); }

  let retDateFilter = "";
  const retParams: any[] = [];
  if (startDate) { retDateFilter += ` AND date(datetime(r.created_at, '${salesMod}'))>=?`; retParams.push(startDate); }
  if (endDate) { retDateFilter += ` AND date(datetime(r.created_at, '${salesMod}'))<=?`; retParams.push(endDate); }

  let categorySql = `
    SELECT cat_agg.categoryId,
           cat_agg.categoryName,
           cat_agg.grossQty,
           cat_agg.grossRevenue,
           cat_agg.orderCount,
           COALESCE(retCat.returnedQty, 0) as returnedQty,
           COALESCE(retCat.returnedRevenue, 0) as returnedRevenue
    FROM (
      SELECT COALESCE(oi.category_id, p.category_id) as categoryId,
             COALESCE(NULLIF(oi.category_name, ''), c.name, 'غير مصنّف') as categoryName,
             SUM(oi.quantity) as grossQty,
             COALESCE(SUM(oi.total), 0) as grossRevenue,
             COUNT(DISTINCT oi.order_id) as orderCount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE (o.status IS NULL OR o.status != 'cancelled') ${devFilter} ${orderDateFilter}
      GROUP BY COALESCE(oi.category_id, p.category_id), COALESCE(NULLIF(oi.category_name, ''), c.name, 'غير مصنّف')
    ) cat_agg
    LEFT JOIN (
      SELECT COALESCE(p2.category_id, (SELECT p3.category_id FROM products p3 WHERE p3.name = ri.product_name LIMIT 1)) as category_id,
             SUM(ri.quantity) as returnedQty,
             SUM(ri.total) as returnedRevenue
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      LEFT JOIN products p2 ON p2.id = ri.product_id
      WHERE r.status = 'approved' ${retDateFilter}
      GROUP BY COALESCE(p2.category_id, (SELECT p3.category_id FROM products p3 WHERE p3.name = ri.product_name LIMIT 1))
    ) retCat ON retCat.category_id = cat_agg.categoryId
    ORDER BY (cat_agg.grossRevenue - COALESCE(retCat.returnedRevenue, 0)) DESC
  `;
  const catParams: any[] = [...orderParams, ...retParams];

  const rawCategories = db.prepare(categorySql).all(...catParams) as any[];
  const categories = rawCategories.map(cat => ({
    ...cat,
    totalQty: Math.max(0, Number(cat.grossQty || 0) - Number(cat.returnedQty || 0)),
    totalRevenue: Math.max(0, Number(cat.grossRevenue || 0) - Number(cat.returnedRevenue || 0))
  }));

  let itemsSql = `
    SELECT item_agg.productId,
           item_agg.productName,
           item_agg.categoryName,
           item_agg.categoryId,
           item_agg.unitPrice,
           item_agg.grossQty,
           item_agg.grossRevenue,
           item_agg.grossProfit,
           item_agg.cost,
           item_agg.orderCount,
           COALESCE(ret.returnedQty, 0) as returnedQty,
           COALESCE(ret.returnedRevenue, 0) as returnedRevenue
    FROM (
      SELECT COALESCE(p.id, oi.product_id) as productId,
             COALESCE(p.name, oi.product_name) as productName,
             MAX(COALESCE(NULLIF(oi.category_name, ''), c.name, 'غير مصنّف')) as categoryName,
             MAX(COALESCE(oi.category_id, p.category_id)) as categoryId,
             ROUND(COALESCE(AVG(oi.unit_price), 0), 2) as unitPrice,
             COALESCE(p.cost, 0) as cost,
             SUM(oi.quantity) as grossQty,
             COALESCE(SUM(oi.total), 0) as grossRevenue,
             COALESCE(SUM((oi.unit_price - COALESCE(p.cost, 0)) * oi.quantity), 0) as grossProfit,
             COUNT(DISTINCT oi.order_id) as orderCount
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON (p.id = oi.product_id OR p.number = oi.product_id OR p.name = oi.product_name)
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE (o.status IS NULL OR o.status != 'cancelled') ${devFilter} ${orderDateFilter}
      GROUP BY COALESCE(p.id, oi.product_id), COALESCE(p.name, oi.product_name)
    ) item_agg
    LEFT JOIN (
      SELECT 
        COALESCE(p.id, ri.product_id) as pid,
        COALESCE(p.name, ri.product_name) as productName,
        SUM(ri.quantity) as returnedQty,
        SUM(ri.total) as returnedRevenue
      FROM return_items ri
      JOIN returns r ON r.id = ri.return_id
      LEFT JOIN products p ON (p.id = ri.product_id OR p.number = ri.product_id OR p.name = ri.product_name)
      WHERE r.status = 'approved' ${retDateFilter}
      GROUP BY COALESCE(p.id, ri.product_id), COALESCE(p.name, ri.product_name)
    ) ret ON ret.pid = item_agg.productId OR ret.productName = item_agg.productName
    ORDER BY (item_agg.grossRevenue - COALESCE(ret.returnedRevenue, 0)) DESC
  `;
  const itemsParams: any[] = [...orderParams, ...retParams];

  const rawItems = db.prepare(itemsSql).all(...itemsParams) as any[];
  const allItems = rawItems.map(item => {
    const netQty = Math.max(0, Number(item.grossQty || 0) - Number(item.returnedQty || 0));
    const netRevenue = Math.max(0, Number(item.grossRevenue || 0) - Number(item.returnedRevenue || 0));
    const unitCost = Number(item.cost || 0);
    const netProfit = Math.max(0, netRevenue - (netQty * unitCost));
    return {
      ...item,
      totalQty: netQty,
      totalRevenue: netRevenue,
      totalProfit: netProfit
    };
  });

  const categoriesWithItems = categories.map(cat => {
    const items = allItems.filter(item => 
      (cat.categoryId && item.categoryId === cat.categoryId) ||
      (cat.categoryName && item.categoryName === cat.categoryName)
    );
    return {
      ...cat,
      items
    };
  });

  res.json(categoriesWithItems);
});

// 5. Sales by Payment Method Report
router.get("/reports/by-payment", (req, res) => {
  const user = getAuthUser(req);
  const { startDate, endDate } = req.query;

  let devFilter = "";
  let devFilterReturns = "";
  if (!user || user.role !== "developer") {
    devFilter = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
    devFilterReturns = " AND user_id NOT IN (SELECT id FROM users WHERE role='developer' OR username='developer') ";
  }

  const salesMod = getSqlBusinessDateModifier("sales");

  let orderDateFilter = "";
  const orderParams: any[] = [];
  if (startDate) { orderDateFilter += ` AND date(datetime(created_at, '${salesMod}'))>=?`; orderParams.push(startDate); }
  if (endDate) { orderDateFilter += ` AND date(datetime(created_at, '${salesMod}'))<=?`; orderParams.push(endDate); }

  let retDateFilter = "";
  const retParams: any[] = [];
  if (startDate) { retDateFilter += ` AND date(datetime(created_at, '${salesMod}'))>=?`; retParams.push(startDate); }
  if (endDate) { retDateFilter += ` AND date(datetime(created_at, '${salesMod}'))<=?`; retParams.push(endDate); }

  let sql = `
    SELECT 
      pm.paymentMethod,
      COALESCE(ord.ordersCount, 0) as orders,
      COALESCE(ord.grossTotal, 0) as grossTotal,
      COALESCE(ret.returnsTotal, 0) as returnsTotal,
      COALESCE(ret.returnsCount, 0) as returnsCount,
      (COALESCE(ord.grossTotal, 0) - COALESCE(ret.returnsTotal, 0)) as total
    FROM (
      SELECT DISTINCT payment_method as paymentMethod FROM orders WHERE payment_method IS NOT NULL AND TRIM(payment_method) != ''
      UNION
      SELECT DISTINCT payment_method as paymentMethod FROM returns WHERE payment_method IS NOT NULL AND TRIM(payment_method) != ''
    ) pm
    LEFT JOIN (
      SELECT 
        payment_method,
        COUNT(*) as ordersCount,
        SUM(total) as grossTotal
      FROM orders
      WHERE (status IS NULL OR status != 'cancelled') ${devFilter} ${orderDateFilter}
      GROUP BY payment_method
    ) ord ON ord.payment_method = pm.paymentMethod
    LEFT JOIN (
      SELECT 
        payment_method,
        COUNT(*) as returnsCount,
        SUM(total_refund) as returnsTotal
      FROM returns
      WHERE status = 'approved' ${devFilterReturns} ${retDateFilter}
      GROUP BY payment_method
    ) ret ON ret.payment_method = pm.paymentMethod
    WHERE (COALESCE(ord.ordersCount, 0) > 0 OR COALESCE(ret.returnsCount, 0) > 0)
    ORDER BY total DESC
  `;

  const params: any[] = [...orderParams, ...retParams];
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

/* ─── Additional Comprehensive Reports ─── */

// 6. Purchases & Suppliers Report
router.get("/reports/purchases", (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = `
    SELECT pi.id, pi.invoice_number as invoiceNumber, pi.supplier_name as supplierName,
           pi.invoice_date as invoiceDate, pi.total, pi.paid_amount as paidAmount,
           pi.remaining_amount as remainingAmount, pi.payment_status as paymentStatus
    FROM purchase_invoices pi
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { sql += " AND DATE(pi.invoice_date)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(pi.invoice_date)<=?"; params.push(endDate); }
  sql += " ORDER BY pi.invoice_date DESC";

  const rows = db.prepare(sql).all(...params) as any[];
  const totals = rows.reduce((acc: any, r: any) => {
    acc.totalPurchases += Number(r.total || 0);
    acc.totalPaid += Number(r.paidAmount || 0);
    acc.totalRemaining += Number(r.remainingAmount || 0);
    return acc;
  }, { totalPurchases: 0, totalPaid: 0, totalRemaining: 0 });

  res.json({ rows, totals });
});

// 7. Inventory & Stock Valuation Report
router.get("/reports/inventory", (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.id, p.name, c.name as categoryName, p.stock, p.min_stock as minStock,
             p.cost, p.price, (p.stock * p.cost) as totalCostValuation,
             (p.stock * p.price) as totalSalesValuation
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.active = 1
      ORDER BY p.stock ASC
    `).all();

    const totals = products.reduce((acc: any, p: any) => {
      acc.totalItems += 1;
      acc.totalStockUnits += Number(p.stock || 0);
      acc.totalCostValuation += Number(p.totalCostValuation || 0);
      acc.totalSalesValuation += Number(p.totalSalesValuation || 0);
      if (Number(p.stock || 0) <= Number(p.minStock || 0)) acc.lowStockCount += 1;
      return acc;
    }, { totalItems: 0, totalStockUnits: 0, totalCostValuation: 0, totalSalesValuation: 0, lowStockCount: 0 });

    res.json({ products, totals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 8. Operational Expenses Summary
router.get("/reports/expenses", (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = `
    SELECT category, COALESCE(SUM(amount), 0) as totalAmount, COUNT(*) as count
    FROM expenses
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { sql += " AND DATE(expense_date)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(expense_date)<=?"; params.push(endDate); }
  sql += " GROUP BY category ORDER BY totalAmount DESC";

  const categories = db.prepare(sql).all(...params) as any[];

  let detailSql = `SELECT * FROM expenses WHERE 1=1`;
  const detailParams: any[] = [];
  if (startDate) { detailSql += " AND DATE(expense_date)>=?"; detailParams.push(startDate); }
  if (endDate) { detailSql += " AND DATE(expense_date)<=?"; detailParams.push(endDate); }
  detailSql += " ORDER BY expense_date DESC LIMIT 100";

  const details = db.prepare(detailSql).all(...detailParams);
  const totalExpense = categories.reduce((s: number, c: any) => s + Number(c.totalAmount || 0), 0);

  res.json({ categories, details, totalExpense });
});

// 9. Shift Closures & Cashier Variance
router.get("/reports/shifts", (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = `
      SELECT cs.*, cs.difference as variance, u.name as cashierName, COALESCE(s.name, 'الصندوق الرئيسي') as safeName
      FROM cash_shifts cs
      LEFT JOIN users u ON u.id = cs.user_id
      LEFT JOIN safes s ON s.id = cs.safe_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (startDate) { sql += " AND DATE(cs.start_time)>=?"; params.push(startDate); }
    if (endDate) { sql += " AND DATE(cs.start_time)<=?"; params.push(endDate); }
    sql += " ORDER BY cs.start_time DESC";

    const shifts = db.prepare(sql).all(...params) as any[];
    const totalVariance = shifts.reduce((s: number, sh: any) => s + Number(sh.variance || 0), 0);
    const totalCashSales = shifts.reduce((s: number, sh: any) => s + Number(sh.cash_sales || 0), 0);

    res.json({ shifts, totalVariance, totalCashSales });
  } catch (e: any) {
    console.error("Error in /reports/shifts:", e);
    res.status(500).json({ error: e.message });
  }
});

// 10. Tax & VAT Report (ZATCA VAT Summary with Returns Deduction)
router.get("/reports/tax", (req, res) => {
  const { startDate, endDate } = req.query;
  
  let salesSql = `
    SELECT COALESCE(SUM(subtotal), 0) as grossTaxableSales,
           COALESCE(SUM(tax), 0) as grossOutputTax,
           COUNT(*) as salesCount
    FROM orders WHERE (status IS NULL OR status != 'cancelled')
  `;
  const salesParams: any[] = [];
  if (startDate) { salesSql += " AND DATE(created_at)>=?"; salesParams.push(startDate); }
  if (endDate) { salesSql += " AND DATE(created_at)<=?"; salesParams.push(endDate); }

  const salesTax = db.prepare(salesSql).get(...salesParams) as any;

  let retSql = `
    SELECT COALESCE(SUM(subtotal), 0) as returnedSubtotal,
           COALESCE(SUM(tax), 0) as returnedTax,
           COUNT(*) as returnsCount
    FROM returns WHERE status = 'approved'
  `;
  const retParams: any[] = [];
  if (startDate) { retSql += " AND DATE(created_at)>=?"; retParams.push(startDate); }
  if (endDate) { retSql += " AND DATE(created_at)<=?"; retParams.push(endDate); }

  const returnsTax = db.prepare(retSql).get(...retParams) as any;

  const netTaxableSales = Math.max(0, Number(salesTax?.grossTaxableSales || 0) - Number(returnsTax?.returnedSubtotal || 0));
  const netOutputTax = Math.max(0, Number(salesTax?.grossOutputTax || 0) - Number(returnsTax?.returnedTax || 0));

  let purSql = `
    SELECT COALESCE(SUM(subtotal), 0) as taxablePurchases,
           COALESCE(SUM(tax), 0) as inputTax,
           COUNT(*) as purchaseCount
    FROM purchase_invoices WHERE 1=1
  `;
  const purParams: any[] = [];
  if (startDate) { purSql += " AND DATE(invoice_date)>=?"; purParams.push(startDate); }
  if (endDate) { purSql += " AND DATE(invoice_date)<=?"; purParams.push(endDate); }

  const purchaseTax = db.prepare(purSql).get(...purParams) as any;

  const netTaxPayable = netOutputTax - Number(purchaseTax?.inputTax || 0);

  res.json({
    grossTaxableSales: Number(salesTax?.grossTaxableSales || 0),
    returnedTaxableSales: Number(returnsTax?.returnedSubtotal || 0),
    taxableSales: netTaxableSales,
    grossOutputTax: Number(salesTax?.grossOutputTax || 0),
    returnedTax: Number(returnsTax?.returnedTax || 0),
    outputTax: netOutputTax,
    salesCount: Number(salesTax?.salesCount || 0),
    returnsCount: Number(returnsTax?.returnsCount || 0),
    taxablePurchases: Number(purchaseTax?.taxablePurchases || 0),
    inputTax: Number(purchaseTax?.inputTax || 0),
    purchaseCount: Number(purchaseTax?.purchaseCount || 0),
    netTaxPayable
  });
});

// 11. Waste & Spoilage Report
router.get("/reports/waste", (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = `
    SELECT w.*, COALESCE(w.total_cost, w.unit_cost * w.quantity) as cost, w.created_at as waste_date, p.name as productName, u.name as userName
    FROM stock_waste_records w
    LEFT JOIN products p ON p.id = w.product_id
    LEFT JOIN users u ON u.id = w.user_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { sql += " AND DATE(w.created_at)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(w.created_at)<=?"; params.push(endDate); }
  sql += " ORDER BY w.created_at DESC";

  const records = db.prepare(sql).all(...params) as any[];
  const totalCost = records.reduce((s: number, r: any) => s + Number(r.cost || 0), 0);

  res.json({ records, totalCost });
});

router.get("/reports/seed-data", (req, res) => {
  try {
    seedWorkReportsAndPDFData();
    res.json({ success: true, message: "تم تحديث وتجهيز كافة بيانات تقارير العمل والـ PDF بنجاح!" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

