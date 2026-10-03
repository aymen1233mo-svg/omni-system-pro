import { Router } from "express";
import { db, createDoubleEntryJournal, deleteJournalBySource } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { getCustomerAccountCode } from "./customers";
import { recordSafeOrBankMovement, getEmployeeSubAccountCode } from "../lib/erp-accounting-sync";
import { getBusinessDate, getOrderBusinessDate, getSqlBusinessDateModifier, getBusinessDayConfig } from "../lib/business-day";

const router = Router();

try {
  db.exec("ALTER TABLE orders ADD COLUMN business_date TEXT");
} catch {}

/**
 * Calculates the next sequential POS invoice number (starting at 1) for the current active business day.
 * Automatically resets to 1 when a new business day begins according to General Settings (cutoff time after midnight).
 */
export function getNextPosInvoiceNumber(nowInput?: Date): {
  nextInvoiceNumber: string;
  activeBusinessDate: string;
  todayCount: number;
  cutoffTime: string;
  cutoffEnabled: boolean;
} {
  const config = getBusinessDayConfig();
  const activeBusinessDate = getBusinessDate("sales", nowInput);
  const recentOrders = db.prepare(`
    SELECT id, invoice_number, order_type, created_at, business_date, status
    FROM orders
    WHERE (order_type IS NULL OR order_type != 'inventory_invoice')
    ORDER BY id DESC
    LIMIT 2000
  `).all() as {
    id: number;
    invoice_number: string;
    order_type: string | null;
    created_at: string | null;
    business_date?: string | null;
    status?: string | null;
  }[];

  let maxTodayNum = 0;
  let todayCount = 0;

  for (const o of recentOrders) {
    const orderBizDate = o.created_at
      ? getOrderBusinessDate(o.created_at, "sales")
      : (o.business_date || "");

    if (orderBizDate === activeBusinessDate) {
      todayCount++;
      const cleanInv = String(o.invoice_number || "").trim();
      if (/^\d+$/.test(cleanInv)) {
        const val = parseInt(cleanInv, 10);
        if (!isNaN(val) && val > maxTodayNum) {
          maxTodayNum = val;
        }
      } else if (!cleanInv.toUpperCase().startsWith("SINV")) {
        const matches = cleanInv.match(/\d+/g);
        if (matches && matches.length > 0) {
          const val = parseInt(matches[matches.length - 1], 10);
          if (!isNaN(val) && val < 100000 && val > maxTodayNum) {
            maxTodayNum = val;
          }
        }
      }
    }
  }

  const nextNum = maxTodayNum + 1;
  return {
    nextInvoiceNumber: String(nextNum),
    activeBusinessDate,
    todayCount,
    cutoffTime: config.cutoffTime,
    cutoffEnabled: config.enabled && config.applyCutoffToSales,
  };
}

function formatOrder(o: any, items: any[]) {
  return {
    id: o.id,
    invoiceNumber: o.invoice_number,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    paymentMethod: o.payment_method,
    cashAmount: o.cash_amount,
    cardAmount: o.card_amount,
    customerId: o.customer_id ?? null,
    customerName: o.customer_name ?? null,
    employeeId: o.employee_id ?? null,
    userId: o.user_id,
    userName: o.user_name,
    note: o.note,
    orderType: o.order_type ?? "dine-in",
    tableNumber: o.table_number ?? null,
    createdAt: (function(d: string){
      if(!d) return d;
      let s = String(d).trim();
      if(s.includes(" ")) s = s.replace(" ", "T");
      if(!s.endsWith("Z") && !s.match(/[+-]\d{2}:\d{2}$/)) s += "Z";
      return s;
    })(o.created_at),
    items: items.map(i => ({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      total: i.total,
      categoryId: i.category_id ?? null,
      categoryName: i.category_name ?? null,
    })),
  };
}

router.get("/orders", (req, res) => {
  const { startDate, endDate, userId, orderType } = req.query;
  let sql = `
    SELECT o.*, u.name as user_name, c.name as customer_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1
  `;
  const params: any[] = [];
  const salesModifier = getSqlBusinessDateModifier("sales");
  if (startDate) { sql += ` AND date(datetime(o.created_at, '${salesModifier}')) >= ?`; params.push(startDate); }
  if (endDate) { sql += ` AND date(datetime(o.created_at, '${salesModifier}')) <= ?`; params.push(endDate); }
  if (userId) { sql += " AND o.user_id=?"; params.push(userId); }
  if (orderType) { sql += " AND o.order_type=?"; params.push(orderType); }
  sql += " ORDER BY o.created_at DESC LIMIT 200";
  const orders = db.prepare(sql).all(...params) as any[];
  const result = orders.map(o => {
    const items = db.prepare(`
      SELECT oi.*, COALESCE(oi.category_id, p.category_id) as category_id, COALESCE(oi.category_name, c.name) as category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE oi.order_id=?
    `).all(o.id) as any[];
    return formatOrder(o, items);
  });
  res.json(result);
});

router.post("/orders", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" }); return; }
    const { items, paymentMethod, subtotal, discount, tax, total, cashAmount, cardAmount, customerId, supplierId, supplier_id, userId, note, orderType, tableNumber, safeId, safe_id, employeeId, employee_id, admin_override, supervisor_authorized } = req.body;
    if (!items?.length) { res.status(400).json({ error: "لا توجد منتجات في الفاتورة" }); return; }

    const effectiveUserId = userId ?? authUser.id;
    const effectiveSupplierId = supplierId ?? supplier_id ? Number(supplierId ?? supplier_id) : null;
    let effectiveEmployeeId: number | null = (employeeId ?? employee_id) ? Number(employeeId ?? employee_id) : null;
    // Look for either safeId or safe_id, default to 1 or existing safe
    const parsedSafeId = Number(safeId ?? safe_id);
    let effectiveSafeId = (!isNaN(parsedSafeId) && parsedSafeId > 0) ? parsedSafeId : 1;
    try {
      const safeCheck = db.prepare("SELECT id FROM safes WHERE id=?").get(effectiveSafeId);
      if (!safeCheck) {
        const firstSafe = db.prepare("SELECT id FROM safes LIMIT 1").get() as any;
        if (firstSafe) {
          effectiveSafeId = firstSafe.id;
        } else {
          const ins = db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?, ?, ?, ?, 1)").run("الصندوق الرئيسي", 0, "ريال", "صندوق افتراضي");
          effectiveSafeId = ins.lastInsertRowid;
        }
      }
    } catch (e) {
      try {
        const ins = db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?, ?, ?, ?, 1)").run("الصندوق الرئيسي", 0, "ريال", "صندوق افتراضي");
        effectiveSafeId = ins.lastInsertRowid;
      } catch (err2) {
        effectiveSafeId = 1;
      }
    }

    // Daily sequential invoice number generation: resets to 1 each new business day
    // Respects the system's business day rollover cutoff time after 12:00 midnight
    const posCounterInfo = getNextPosInvoiceNumber();
    const invoiceNumber = posCounterInfo.nextInvoiceNumber;
    const activeBusinessDate = posCounterInfo.activeBusinessDate;
    const createdAt = new Date().toISOString();

    let effectiveCustomerId = customerId ? Number(customerId) : null;
    if (!effectiveEmployeeId && (employeeId || employee_id)) {
      effectiveEmployeeId = Number(employeeId ?? employee_id);
    }

    if (note && (note.includes("وجبة موظف") || note.includes("وجبة"))) {
      try {
        const empNameMatch = note.match(/وجبة موظف:\s*([^(]+)/);
        const empName = empNameMatch ? empNameMatch[1].trim() : note.replace("وجبة موظف:", "").trim();
        if (empName) {
          const emp = db.prepare("SELECT * FROM hr_employees WHERE name = ?").get(empName) as any;
          if (emp) {
            effectiveEmployeeId = emp.id;
            effectiveCustomerId = null; // Do NOT create or link customer accounts for employees
          } else {
            let cust = db.prepare("SELECT id FROM customers WHERE name = ?").get(empName) as any;
            if (!cust) {
              const r = db.prepare(`
                INSERT INTO customers (name, customer_type, notes)
                VALUES (?, 'individual', ?)
              `).run(empName, `حساب وجبات الموظف ${empName}`);
              cust = { id: r.lastInsertRowid };
            }
            if (cust && cust.id) {
              effectiveCustomerId = cust.id;
            }
          }
        }
      } catch (e) {
        console.warn("Failed to auto-link employee customer record:", e);
      }
    }

    // ── Employee Balance & Credit Limit Verification (منع القطع إذا كان رصيد الموظف لا يسمح) ──
    if (effectiveEmployeeId) {
      const emp = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(effectiveEmployeeId) as any;
      if (emp) {
        const balance = Number(emp.balance || 0);
        const creditLimit = emp.credit_limit !== null && emp.credit_limit !== undefined ? Number(emp.credit_limit) : 20000;
        const allowExceed = Boolean(emp.allow_exceed_balance);
        const blockInsufficient = emp.block_insufficient_balance !== undefined ? Boolean(emp.block_insufficient_balance) : true;

        const deductions = db.prepare(`
          SELECT COALESCE(SUM(amount),0) as sum 
          FROM meal_deductions 
          WHERE employee_id=? AND strftime('%Y-%m', created_at)=strftime('%Y-%m','now')
        `).get(effectiveEmployeeId) as any;
        const currentMonthDeductions = Number(deductions?.sum || 0);
        const available = balance + creditLimit - currentMonthDeductions;
        const isOverride = Boolean(admin_override || supervisor_authorized);

        if (blockInsufficient && !allowExceed && !isOverride && Number(total || 0) > available) {
          return res.status(403).json({
            error: `تم منع قطع الطلب للموظف (${emp.name}) لأن رصيد الموظف لا يسمح (الرصيد المتاح: ${available.toLocaleString()} ريال، والمطلوب: ${Number(total || 0).toLocaleString()} ريال)`,
            reason: "insufficient_employee_balance",
            employee_id: emp.id,
            employee_name: emp.name,
            available_balance: available,
            credit_limit: creditLimit,
            requested_total: Number(total || 0),
            shortfall: Number(total || 0) - available
          });
        }
      }
    }

    let orderId: number;
    try {
      const r = db.prepare(`
        INSERT INTO orders (
          invoice_number, subtotal, discount, tax, total, 
          payment_method, cash_amount, card_amount, 
          customer_id, supplier_id, employee_id, user_id, note, order_type, 
          table_number, safe_id, created_at, business_date, status
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'completed')
      `).run(
        invoiceNumber,
        subtotal ?? 0,
        discount ?? 0,
        tax ?? 0,
        total ?? 0,
        paymentMethod ?? "cash",
        cashAmount ?? (paymentMethod === "cash" ? total : null),
        cardAmount ?? (paymentMethod === "card" ? total : null),
        effectiveCustomerId,
        effectiveSupplierId,
        effectiveEmployeeId,
        effectiveUserId,
        note ?? null,
        orderType ?? "dine-in",
        tableNumber ?? null,
        effectiveSafeId,
        createdAt,
        activeBusinessDate
      );
      orderId = Number(r.lastInsertRowid);
    } catch (insertErr: any) {
      console.warn("Order insert with safe_id/supplier_id failed, retrying fallback:", insertErr.message);
      const r2 = db.prepare(`
        INSERT INTO orders (
          invoice_number, subtotal, discount, tax, total, 
          payment_method, cash_amount, card_amount, 
          customer_id, supplier_id, employee_id, user_id, note, order_type, 
          table_number, created_at, status
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'completed')
      `).run(
        invoiceNumber,
        subtotal ?? 0,
        discount ?? 0,
        tax ?? 0,
        total ?? 0,
        paymentMethod ?? "cash",
        cashAmount ?? (paymentMethod === "cash" ? total : null),
        cardAmount ?? (paymentMethod === "card" ? total : null),
        effectiveCustomerId,
        effectiveSupplierId,
        effectiveEmployeeId,
        effectiveUserId,
        note ?? null,
        orderType ?? "dine-in",
        tableNumber ?? null,
        createdAt
      );
      orderId = Number(r2.lastInsertRowid);
    }

    if (effectiveSupplierId) {
      try {
        db.prepare("UPDATE suppliers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(Number(total || 0), effectiveSupplierId);
      } catch (e) {
        console.warn("Failed to update supplier balance:", e);
      }
    }

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total, category_id, category_name)
      VALUES (?,?,?,?,?,?,?,?)
    `);

    let orderCogs = 0;

    for (const item of items) {
      const prod = db.prepare("SELECT p.*, c.name as cat_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?").get(item.productId) as any;
      const name = prod?.name ?? "منتج محذوف";
      insertItem.run(orderId, item.productId, name, item.quantity, item.unitPrice, item.quantity * item.unitPrice, prod?.category_id ?? null, prod?.cat_name ?? null);

      if (prod) {
        try {
          // BOM recipe subtraction
          const recipes = db.prepare("SELECT * FROM product_recipes WHERE product_id=?").all(prod.id) as any[];
          if (recipes.length > 0) {
            let recipeCostSum = 0;
            for (const rec of recipes) {
              const ingProduct = db.prepare("SELECT * FROM products WHERE name=? COLLATE NOCASE LIMIT 1").get(rec.ingredient_name) as any;
              const totalQtyDeducted = (rec.quantity || 1) * item.quantity;
              if (ingProduct) {
                const prevStock = ingProduct.stock ?? 0;
                const newStock = Math.max(0, prevStock - totalQtyDeducted);
                db.prepare("UPDATE products SET stock=? WHERE id=?").run(newStock, ingProduct.id);

                // Log stock movement for raw ingredient
                try {
                  db.prepare(`
                    INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_name)
                    VALUES (?, 'out', ?, ?, ?, ?, ?, ?)
                  `).run(ingProduct.id, totalQtyDeducted, prevStock, newStock, `استهلاك وصفة مبيعات لـ ${prod.name} (فاتورة #${invoiceNumber})`, orderId, authUser.name);
                } catch (smErr) {}

                try {
                  db.prepare(`
                    INSERT INTO inventory_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
                    VALUES (?, 'out', ?, ?, 'sale_order', ?, ?)
                  `).run(ingProduct.id, totalQtyDeducted, ingProduct.cost || 0, orderId, `استهلاك وصفة مبيعات لـ ${prod.name} (فاتورة #${invoiceNumber})`);
                } catch (imErr) {}

                recipeCostSum += (ingProduct.cost || 0) * (rec.quantity || 1);
              }
            }
            orderCogs += recipeCostSum * item.quantity;
          } else {
            // No recipe, deduct direct product stock
            const prevStock = prod.stock ?? 0;
            const newStock = Math.max(0, prevStock - item.quantity);
            db.prepare("UPDATE products SET stock=? WHERE id=?").run(newStock, prod.id);

            // Log stock movement
            try {
              db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_name)
                VALUES (?, 'out', ?, ?, ?, ?, ?, ?)
              `).run(prod.id, item.quantity, prevStock, newStock, `صرف مبيعات فاتورة رقم #${invoiceNumber}`, orderId, authUser.name);
            } catch (smErr) {}

            try {
              db.prepare(`
                INSERT INTO inventory_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
                VALUES (?, 'out', ?, ?, 'sale_order', ?, ?)
              `).run(prod.id, item.quantity, prod.cost || 0, orderId, `صرف مبيعات فاتورة رقم #${invoiceNumber}`);
            } catch (imErr) {}

            orderCogs += (prod.cost || 0) * item.quantity;
          }
        } catch (stockErr: any) {
          console.warn("Stock movement deduction notice:", stockErr.message);
        }
      }
    }

    // Create Balanced Double-Entry Journal for Order Sale & Update Safe/Bank/Customer Balances
    try {
      const totalVal = Math.round((Number(total) || 0) * 100) / 100;
      const taxVal = Math.round((Number(tax) || 0) * 100) / 100;
      const netRevenue = Math.max(0, Math.round((totalVal - taxVal) * 100) / 100);
      const custAccCode = getCustomerAccountCode(customerId);
      const custRow = customerId ? (db.prepare("SELECT name FROM customers WHERE id = ?").get(customerId) as any) : null;
      const custLabel = custRow?.name ? ` (${custRow.name})` : "";

      const lines: { account_code: string; debit: number; credit: number; description?: string }[] = [];

      if (paymentMethod === "cash") {
        lines.push({ account_code: "11100", debit: totalVal, credit: 0, description: `تحصيل نقدي مبيعات فاتورة #${invoiceNumber}${custLabel}` });
        recordSafeOrBankMovement(db, {
          type: "in",
          amount: totalVal,
          method: "cash",
          safeId: effectiveSafeId,
          description: `مبيعات نقدية فاتورة رقم #${invoiceNumber}${custLabel}`,
          referenceType: "sale",
          referenceId: orderId,
          userId: effectiveUserId,
        });
      } else if (paymentMethod === "card" || paymentMethod === "bank") {
        lines.push({ account_code: "11200", debit: totalVal, credit: 0, description: `تحصيل شبكة/بنك مبيعات فاتورة #${invoiceNumber}${custLabel}` });
        recordSafeOrBankMovement(db, {
          type: "in",
          amount: totalVal,
          method: "card",
          safeId: effectiveSafeId,
          description: `مبيعات شبكة/بنك فاتورة رقم #${invoiceNumber}${custLabel}`,
          referenceType: "sale",
          referenceId: orderId,
          userId: effectiveUserId,
        });
      } else if (paymentMethod === "credit") {
        let isEmployeeMeal = false;
        let empRow = null;
        if (note && note.includes("وجبة موظف")) {
          const empNameMatch = note.match(/وجبة موظف:\s*([^(]+)/);
          const empName = empNameMatch ? empNameMatch[1].trim() : note.replace("وجبة موظف:", "").trim();
          if (empName) {
            empRow = db.prepare("SELECT * FROM hr_employees WHERE name = ?").get(empName) as any;
            if (empRow) {
              isEmployeeMeal = true;
            }
          }
        }

        if (isEmployeeMeal && empRow) {
          const empAccCode = getEmployeeSubAccountCode(db, empRow.id, empRow.name);
          lines.push({
            account_code: empAccCode,
            debit: totalVal,
            credit: 0,
            description: `خصم وجبة موظف (${empRow.name}) - فاتورة #${invoiceNumber}`
          });
          // Decrement employee liability balance (representing salary deduction / they owe more)
          db.prepare("UPDATE hr_employees SET balance = COALESCE(balance, 0) - ? WHERE id = ?").run(totalVal, empRow.id);
          db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE code = ?").run(totalVal, empAccCode);
        } else {
          lines.push({ account_code: custAccCode, debit: totalVal, credit: 0, description: `مبيعات آجلة على العميل${custLabel} - فاتورة #${invoiceNumber}` });
          if (customerId) {
            db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(totalVal, Number(customerId));
          }
        }
      } else if (paymentMethod === "split") {
        const cashAmt = Math.round((Number(cashAmount) || 0) * 100) / 100;
        const cardAmt = Math.round((Number(cardAmount) || 0) * 100) / 100;
        const creditAmt = Math.max(0, Math.round((totalVal - cashAmt - cardAmt) * 100) / 100);
        if (cashAmt > 0) {
          lines.push({ account_code: "11100", debit: cashAmt, credit: 0, description: `تحصيل نقدي جزئي فاتورة #${invoiceNumber}` });
          recordSafeOrBankMovement(db, {
            type: "in",
            amount: cashAmt,
            method: "cash",
            safeId: effectiveSafeId,
            description: `تحصيل نقدي جزئي فاتورة #${invoiceNumber}${custLabel}`,
            referenceType: "sale",
            referenceId: orderId,
            userId: effectiveUserId,
          });
        }
        if (cardAmt > 0) {
          lines.push({ account_code: "11200", debit: cardAmt, credit: 0, description: `تحصيل شبكة جزئي فاتورة #${invoiceNumber}` });
          recordSafeOrBankMovement(db, {
            type: "in",
            amount: cardAmt,
            method: "card",
            safeId: effectiveSafeId,
            description: `تحصيل شبكة جزئي فاتورة #${invoiceNumber}${custLabel}`,
            referenceType: "sale",
            referenceId: orderId,
            userId: effectiveUserId,
          });
        }
        if (creditAmt > 0) {
          let isEmployeeMeal = false;
          let empRow = null;
          if (note && note.includes("وجبة موظف")) {
            const empNameMatch = note.match(/وجبة موظف:\s*([^(]+)/);
            const empName = empNameMatch ? empNameMatch[1].trim() : note.replace("وجبة موظف:", "").trim();
            if (empName) {
              empRow = db.prepare("SELECT * FROM hr_employees WHERE name = ?").get(empName) as any;
              if (empRow) {
                isEmployeeMeal = true;
              }
            }
          }

          if (isEmployeeMeal && empRow) {
            const empAccCode = getEmployeeSubAccountCode(db, empRow.id, empRow.name);
            lines.push({ account_code: empAccCode, debit: creditAmt, credit: 0, description: `متبقي خصم وجبة موظف (${empRow.name}) - فاتورة #${invoiceNumber}` });
            db.prepare("UPDATE hr_employees SET balance = COALESCE(balance, 0) - ? WHERE id = ?").run(creditAmt, empRow.id);
            db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE code = ?").run(creditAmt, empAccCode);
          } else {
            lines.push({ account_code: custAccCode, debit: creditAmt, credit: 0, description: `متبقي آجل على العميل${custLabel} - فاتورة #${invoiceNumber}` });
            if (customerId) {
              db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(creditAmt, Number(customerId));
            }
          }
        }
      } else {
        lines.push({ account_code: "11100", debit: totalVal, credit: 0, description: `تحصيل مبيعات فاتورة #${invoiceNumber}` });
        recordSafeOrBankMovement(db, {
          type: "in",
          amount: totalVal,
          method: "cash",
          safeId: effectiveSafeId,
          description: `مبيعات فاتورة رقم #${invoiceNumber}`,
          referenceType: "sale",
          referenceId: orderId,
          userId: effectiveUserId,
        });
      }

      if (netRevenue > 0) {
        lines.push({ account_code: "41000", debit: 0, credit: netRevenue, description: `إيرادات مبيعات فاتورة #${invoiceNumber}` });
      }
      if (taxVal > 0) {
        lines.push({ account_code: "21300", debit: 0, credit: taxVal, description: `ضريبة القيمة المضافة المحصلة - فاتورة #${invoiceNumber}` });
      }
      if (netRevenue === 0 && taxVal === 0 && totalVal > 0) {
        lines.push({ account_code: "41000", debit: 0, credit: totalVal, description: `إيرادات مبيعات فاتورة #${invoiceNumber}` });
      }

      const cogsRounded = Math.round(orderCogs * 100) / 100;
      if (cogsRounded > 0) {
        lines.push({ account_code: "51000", debit: cogsRounded, credit: 0, description: `تكلفة البضاعة المباعة للفاتورة #${invoiceNumber}` });
        lines.push({ account_code: "11300", debit: 0, credit: cogsRounded, description: `تخفيض المخزون للمبيعات فاتورة #${invoiceNumber}` });
      }

      createDoubleEntryJournal(
        getBusinessDate("sales"),
        `فاتورة مبيعات رقم #${invoiceNumber}${custLabel}`,
        "sale",
        orderId as number,
        lines
      );
    } catch (journalErr: any) {
      console.error("Failed to generate double entry for sale:", journalErr.message);
    }

    const order = db.prepare(`
      SELECT o.*, u.name as user_name, c.name as customer_name
      FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN customers c ON c.id=o.customer_id
      WHERE o.id=?
    `).get(orderId) as any;
    const orderItems = db.prepare(`
      SELECT oi.*, COALESCE(oi.category_id, p.category_id) as category_id, COALESCE(oi.category_name, c.name) as category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE oi.order_id=?
    `).all(orderId) as any[];
    res.status(201).json(formatOrder(order, orderItems));
  } catch (err: any) {
    console.error("Order creation fatal error:", err);
    res.status(500).json({ error: err?.message || "حدث خطأ أثناء حفظ الفاتورة" });
  }
});

/* ── استعلام رقم الفاتورة القادمة في نقطة المبيعات حسب يوم العمل النشط ── */
router.get("/orders/next-invoice-number", (_req, res) => {
  try {
    res.json(getNextPosInvoiceNumber());
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل حساب رقم الفاتورة القادمة" });
  }
});

/* ── استدعاء بيانات آخر فاتورة صادرة في النظام ── */
router.get("/orders/last", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" }); return; }

  try {
    const lastOrder = db.prepare(`
      SELECT o.*, u.name as user_name, c.name as customer_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE (o.order_type IS NULL OR o.order_type != 'inventory_invoice')
      ORDER BY o.id DESC LIMIT 1
    `).get() as any;

    if (!lastOrder) {
      res.status(404).json({ error: "لا توجد فواتير سابقة مسجلة في النظام حتى الآن" });
      return;
    }

    const items = db.prepare(`
      SELECT oi.*, COALESCE(oi.category_id, p.category_id) as category_id, COALESCE(oi.category_name, c.name) as category_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories c ON c.id = COALESCE(oi.category_id, p.category_id)
      WHERE oi.order_id=?
    `).all(lastOrder.id) as any[];
    const counterInfo = getNextPosInvoiceNumber();
    res.json({
      ...formatOrder(lastOrder, items),
      nextInvoiceNumber: counterInfo.nextInvoiceNumber,
      activeBusinessDate: counterInfo.activeBusinessDate,
      todayCount: counterInfo.todayCount,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "فشل جلب آخر فاتورة" });
  }
});

/* ── البحث عن طلب بواسطة رقم الفاتورة أو ID للـ المرتجعات ── */
router.get("/orders/lookup", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) { res.status(401).json({ error: "غير مصرح" }); return; }

  const qRaw = req.query.q || req.query.invoice || req.query.invoiceNumber || req.query.id;
  if (!qRaw || !String(qRaw).trim()) {
    res.status(400).json({ error: "مطلوب رقم الفاتورة للبحث" });
    return;
  }

  // Convert Arabic digits to English digits
  const toEnglishDigits = (str: string) => str.replace(/[٠-٩]/g, d => '0123456789'[d.charCodeAt(0) - 0x0660]);
  
  const qStr = toEnglishDigits(String(qRaw).trim());
  // Remove any common prefixes and leading zeros for a cleaner search
  const cleanQ = qStr.replace(/^(inv|ord|#|ref|فاتورة|رقم)-?/i, "").replace(/^0+/, "") || qStr;
  
  // Also try to find by just numbers if there are any
  const numbersOnly = qStr.replace(/\D/g, "");

  try {
    // Advanced lookup: Try exact match on invoice_number, exact match on ID, 
    // and also check if the invoice_number contains the clean search term
    let orderRows = db.prepare(`
      SELECT o.*, u.name as user_name, u.role as user_role, c.name as customer_name
      FROM orders o
      LEFT JOIN users u ON u.id=o.user_id
      LEFT JOIN customers c ON c.id=o.customer_id
      WHERE o.invoice_number = ?
         OR o.invoice_number = ?
         OR TRIM(o.invoice_number) = ?
         OR CAST(o.id AS TEXT) = ?
         OR CAST(o.id AS TEXT) = ?
         OR o.invoice_number LIKE ?
         OR o.invoice_number LIKE ?
         OR (LENGTH(?) > 0 AND (o.invoice_number LIKE ? OR CAST(o.id AS TEXT) = ?))
      ORDER BY 
        CASE 
          WHEN o.invoice_number = ? THEN 0 
          WHEN CAST(o.id AS TEXT) = ? THEN 1
          WHEN TRIM(o.invoice_number) = ? THEN 2
          WHEN o.invoice_number = ? THEN 3
          WHEN o.invoice_number LIKE ? THEN 4
          ELSE 5 
        END,
        o.created_at DESC
      LIMIT 20
    `).all(
      qStr, cleanQ, cleanQ, qStr, cleanQ, `%${cleanQ}`, `%${qStr}%`,
      numbersOnly, `%${numbersOnly}%`, numbersOnly,
      qStr, qStr, cleanQ, cleanQ, `%${cleanQ}`
    ) as any[];

    if (!orderRows || orderRows.length === 0) {
      res.status(404).json({ error: `لم يتم العثور على الفاتورة رقم "${qStr}"` });
      return;
    }

    const results = orderRows.map(orderRow => {
      const items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(orderRow.id) as any[];

      const existingReturnsRaw = db.prepare(`
        SELECT id, return_number, total_refund, created_at, status, reason
        FROM returns 
        WHERE order_id=? OR invoice_number=?
      `).all(orderRow.id, orderRow.invoice_number) as any[];

      const existingReturns = existingReturnsRaw.map(ret => ({
        ...ret,
        created_at: (function(d: string){
          if(!d) return d;
          let s = String(d).trim();
          if(s.includes(" ")) s = s.replace(" ", "T");
          if(!s.endsWith("Z") && !s.match(/[+-]\d{2}:\d{2}$/)) s += "Z";
          return s;
        })(ret.created_at)
      }));

      const returnedQtyRows = db.prepare(`
        SELECT product_id, SUM(quantity) as returned_qty
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE r.order_id = ? OR r.invoice_number = ?
        GROUP BY product_id
      `).all(orderRow.id, orderRow.invoice_number) as any[];

      const returnedQtyMap: Record<number, number> = {};
      for (const row of returnedQtyRows) {
        if (row.product_id) {
          returnedQtyMap[row.product_id] = Number(row.returned_qty || 0);
        }
      }

      const itemsWithQty = items.map(i => {
        const returnedQuantity = returnedQtyMap[i.product_id] || 0;
        const remainingQuantity = Math.max(0, i.quantity - returnedQuantity);
        return {
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          quantity: i.quantity,
          returnedQuantity,
          remainingQuantity,
          unitPrice: i.unit_price,
          total: i.total,
          categoryId: i.category_id,
          categoryName: i.category_name,
        };
      });

      const fullyReturned = itemsWithQty.length > 0 && itemsWithQty.every(item => item.remainingQuantity <= 0);
      const partiallyReturned = existingReturns.length > 0 && !fullyReturned;

      return {
        id: orderRow.id,
        invoiceNumber: orderRow.invoice_number,
        total: orderRow.total,
        subtotal: orderRow.subtotal,
        discount: orderRow.discount,
        tax: orderRow.tax,
        paymentMethod: orderRow.payment_method,
        cashAmount: orderRow.cash_amount,
        cardAmount: orderRow.card_amount,
        customerId: orderRow.customer_id ?? null,
        employeeId: orderRow.employee_id ?? null,
        orderType: orderRow.order_type ?? "dine-in",
        tableNumber: orderRow.table_number,
        note: orderRow.note,
        createdAt: (function(d: string){
          if(!d) return d;
          let s = String(d).trim();
          if(s.includes(" ")) s = s.replace(" ", "T");
          if(!s.endsWith("Z") && !s.match(/[+-]\d{2}:\d{2}$/)) s += "Z";
          return s;
        })(orderRow.created_at),
        cashierName: orderRow.user_name ?? "الكاشير",
        userId: orderRow.user_id,
        customerName: orderRow.customer_name ?? null,
        alreadyReturned: existingReturns.length > 0,
        partiallyReturned,
        fullyReturned,
        previousReturns: existingReturns,
        items: itemsWithQty,
      };
    });

    res.json(results.length === 1 ? results[0] : results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/orders/:id", (req, res) => {
  const order = db.prepare(`
    SELECT o.*, u.name as user_name, c.name as customer_name
    FROM orders o LEFT JOIN users u ON u.id=o.user_id LEFT JOIN customers c ON c.id=o.customer_id
    WHERE o.id=?
  `).get(req.params.id) as any;
  if (!order) { res.status(404).json({ error: "غير موجود" }); return; }
  const items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(order.id) as any[];
  res.json(formatOrder(order, items));
});

router.delete("/orders/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) { res.status(403).json({ error: "غير مصرح" }); return; }
  
  try {
    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id) as any;
    if (order) {
      if (order.customer_id && (order.payment_method === "credit" || order.payment_method === "split")) {
        db.prepare("UPDATE customers SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").run(order.total, order.customer_id);
      }

      // Delete associated journal entries before deleting meal deductions
      try {
        const mealsToDelete = db.prepare("SELECT id FROM meal_deductions WHERE order_id = ? OR invoice_number = ?").all(order.id, order.invoice_number) as { id: number }[];
        for (const m of mealsToDelete) {
          try { deleteJournalBySource("meal_deduction", m.id); } catch {}
        }
      } catch (meErr) {
        console.warn("Failed to delete meal deduction journals on order cancel:", meErr);
      }

      db.prepare("DELETE FROM meal_deductions WHERE order_id = ? OR invoice_number = ?").run(order.id, order.invoice_number);
      db.prepare("DELETE FROM order_items WHERE order_id=?").run(req.params.id);
      db.prepare("DELETE FROM orders WHERE id=?").run(req.params.id);
    }
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: "فشل حذف الفاتورة: " + e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   نظام فاتورة المبيعات المخزنية (نقداً / آجل) — Inventory Sales Invoices ERP
   ══════════════════════════════════════════════════════════════════════════ */

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      payment_type TEXT NOT NULL DEFAULT 'credit',
      allow_return INTEGER NOT NULL DEFAULT 1,
      allow_return_days INTEGER NOT NULL DEFAULT 365,
      description TEXT,
      invoice_date TEXT NOT NULL,
      hijri_date TEXT,
      delivery_date TEXT,
      hijri_delivery_date TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      warehouse_id INTEGER DEFAULT 1,
      warehouse_name TEXT DEFAULT 'المستودع الرئيسي',
      cost_center_id INTEGER,
      cost_center_name TEXT DEFAULT 'المبيعات العامة',
      sales_rep_id INTEGER,
      sales_rep_name TEXT,
      driver_name TEXT,
      distributor_name TEXT,
      seller_name TEXT,
      tax_treatment TEXT DEFAULT 'دون ضريبة',
      currency TEXT DEFAULT 'ريال سعودي',
      exchange_rate REAL DEFAULT 1,
      sales_order_number TEXT,
      is_delivered INTEGER DEFAULT 0,
      subject_to_sales_tax INTEGER DEFAULT 1,
      advance_cash_amount REAL DEFAULT 0,
      safe_id INTEGER DEFAULT 1,
      safe_name TEXT DEFAULT 'الصندوق الرئيسي',
      cheques_json TEXT DEFAULT '[]',
      account_lines_json TEXT DEFAULT '[]',
      items_json TEXT DEFAULT '[]',
      subtotal_no_tax REAL DEFAULT 0,
      sales_tax_amount REAL DEFAULT 0,
      withholding_tax_amount REAL DEFAULT 0,
      additions_discounts_net REAL DEFAULT 0,
      gifts_total REAL DEFAULT 0,
      net_total REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      posting_status TEXT NOT NULL DEFAULT 'unposted',
      print_english INTEGER DEFAULT 0,
      hide_empty_rows INTEGER DEFAULT 1,
      order_id INTEGER,
      journal_entry_id INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const invSalesCount = (db.prepare("SELECT COUNT(*) as c FROM inventory_sales_invoices").get() as any)?.c || 0;
  if (invSalesCount === 0) {
    const custs = db.prepare("SELECT * FROM customers ORDER BY id ASC").all() as any[];
    const prods = db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY id ASC").all() as any[];
    const emps = db.prepare("SELECT * FROM hr_employees WHERE active = 1 ORDER BY id ASC").all() as any[];
    const c1 = custs[0] || { id: 1, name: "شركة الأفق للتجارة والتوريدات" };
    const c2 = custs[1] || c1;
    const p1 = prods[0] || { id: 101, name: "أرز بسمتي هندي درجة أولى (كيس 10 كجم)", price: 85, cost: 65, unit: "كيس", barcode: "6281000101" };
    const p2 = prods[1] || { id: 102, name: "زيت طبخ نباتي صافي (كرتون 6 عبوات)", price: 98, cost: 75, unit: "كرتون", barcode: "6281000102" };
    const p3 = prods[2] || { id: 104, name: "حليب طويل الأجل كامل الدسم (كرتون 12 لتر)", price: 72, cost: 54, unit: "كرتون", barcode: "6281000104" };
    const emp1 = emps[0] || { id: 1, name: "أحمد محمد الغامدي" };

    const sampleItems1 = [
      {
        id: "1",
        product_id: p1.id,
        product_code: p1.barcode || String(p1.id),
        product_name: p1.name,
        unit: p1.unit || "كيس",
        warehouse_name: "المستودع الرئيسي - فرع الهرم",
        available_stock: Number(p1.stock ?? 140),
        quantity: 10,
        unit_price: Number(p1.price || 85),
        discount: 0,
        addition: 0,
        tax_rate: 15,
        tax_amount: Math.round(10 * Number(p1.price || 85) * 0.15 * 100) / 100,
        total: Math.round(10 * Number(p1.price || 85) * 1.15 * 100) / 100,
        cost_price: Number(p1.cost || 65),
        is_gift: false,
        cost_center: "مبيعات الجملة",
        description: "توريد بضاعة مخزنية درجة أولى"
      },
      {
        id: "2",
        product_id: p2.id,
        product_code: p2.barcode || String(p2.id),
        product_name: p2.name,
        unit: p2.unit || "كرتون",
        warehouse_name: "المستودع الرئيسي - فرع الهرم",
        available_stock: Number(p2.stock ?? 90),
        quantity: 5,
        unit_price: Number(p2.price || 98),
        discount: 20,
        addition: 0,
        tax_rate: 15,
        tax_amount: Math.round((5 * Number(p2.price || 98) - 20) * 0.15 * 100) / 100,
        total: Math.round((5 * Number(p2.price || 98) - 20) * 1.15 * 100) / 100,
        cost_price: Number(p2.cost || 75),
        is_gift: false,
        cost_center: "مبيعات الجملة",
        description: "كرتون 6 عبوات"
      }
    ];

    const sub1 = 10 * Number(p1.price || 85) + 5 * Number(p2.price || 98);
    const disc1 = -20;
    const tax1 = Math.round((sub1 + disc1) * 0.15 * 100) / 100;
    const net1 = Math.round((sub1 + disc1 + tax1) * 100) / 100;
    const cost1 = 10 * Number(p1.cost || 65) + 5 * Number(p2.cost || 75);

    const sampleAccLines1 = [
      {
        id: "acc-1",
        account_code: "41000",
        account_name: "خصم مكتسب / مسموحات مبيعات",
        discount: 20,
        addition: 0,
        description: "خصم تشجيعي على الكميات",
        cost_center: "مبيعات الجملة",
        currency: "ريال سعودي",
        exchange_rate: 1
      }
    ];

    const sampleCheques1 = [
      {
        id: "chq-1",
        cheque_number: "CHK-990124",
        amount: 400,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        entity: "مصرف الراجحي"
      }
    ];

    const insInv = db.prepare(`
      INSERT INTO inventory_sales_invoices (
        invoice_number, payment_type, allow_return, allow_return_days, description,
        invoice_date, hijri_date, delivery_date, hijri_delivery_date,
        customer_id, customer_name, warehouse_id, warehouse_name,
        cost_center_id, cost_center_name, sales_rep_id, sales_rep_name,
        driver_name, distributor_name, seller_name,
        tax_treatment, currency, exchange_rate, sales_order_number,
        is_delivered, subject_to_sales_tax, advance_cash_amount, safe_id, safe_name,
        cheques_json, account_lines_json, items_json,
        subtotal_no_tax, sales_tax_amount, withholding_tax_amount, additions_discounts_net,
        gifts_total, net_total, total_cost, profit_margin, posting_status, created_by_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const todayIso = new Date().toISOString().slice(0, 10);
    insInv.run(
      "SINV-1001", "credit", 1, 365, "فاتورة مبيعات مخزنية آجلة لتوريد مواد غذائية بالجملة",
      todayIso, "16/04/1448", todayIso, "16/04/1448",
      c1.id, c1.name, 1, "المستودع الرئيسي - فرع الهرم",
      1, "مبيعات الجملة والتوريدات", emp1.id, emp1.name,
      "سعيد القحطاني", "شركة التوزيع السريع", emp1.name,
      "خاضع للضريبة 15%", "ريال سعودي", 1, "SO-2026-101",
      1, 1, 200, 1, "الصندوق الرئيسي",
      JSON.stringify(sampleCheques1), JSON.stringify(sampleAccLines1), JSON.stringify(sampleItems1),
      sub1, tax1, 0, disc1,
      0, net1, cost1, Math.round((sub1 + disc1 - cost1) * 100) / 100, "unposted", "مدير النظام"
    );

    const sampleItems2 = [
      {
        id: "1",
        product_id: p3.id,
        product_code: p3.barcode || String(p3.id),
        product_name: p3.name,
        unit: p3.unit || "كرتون",
        warehouse_name: "المستودع الرئيسي - فرع الهرم",
        available_stock: Number(p3.stock ?? 110),
        quantity: 8,
        unit_price: Number(p3.price || 72),
        discount: 0,
        addition: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: Math.round(8 * Number(p3.price || 72) * 100) / 100,
        cost_price: Number(p3.cost || 54),
        is_gift: false,
        cost_center: "مبيعات نقدية مخزنية",
        description: "بيع مخزني نقدي مباشر"
      }
    ];
    const sub2 = 8 * Number(p3.price || 72);
    const cost2 = 8 * Number(p3.cost || 54);

    insInv.run(
      "SINV-1002", "cash", 1, 365, "فاتورة مبيعات مخزنية نقدية - تسليم فوري من المستودع",
      todayIso, "16/04/1448", todayIso, "16/04/1448",
      c2.id, c2.name, 1, "المستودع الرئيسي - فرع الهرم",
      1, "مبيعات نقدية مخزنية", emp1.id, emp1.name,
      "عبدالله الشهري", "توزيع الفرع الرئيسي", emp1.name,
      "دون ضريبة", "ريال سعودي", 1, "SO-2026-102",
      1, 0, sub2, 1, "الصندوق الرئيسي",
      "[]", "[]", JSON.stringify(sampleItems2),
      sub2, 0, 0, 0,
      0, sub2, cost2, Math.round((sub2 - cost2) * 100) / 100, "unposted", "مدير النظام"
    );
  }
} catch (initErr: any) {
  console.warn("inventory_sales_invoices init notice:", initErr?.message);
}

function parseInvoiceRow(row: any) {
  if (!row) return null;
  let items = [];
  let cheques = [];
  let accountLines = [];
  try { items = JSON.parse(row.items_json || "[]"); } catch {}
  try { cheques = JSON.parse(row.cheques_json || "[]"); } catch {}
  try { accountLines = JSON.parse(row.account_lines_json || "[]"); } catch {}
  return {
    ...row,
    allow_return: Boolean(row.allow_return),
    is_delivered: Boolean(row.is_delivered),
    subject_to_sales_tax: Boolean(row.subject_to_sales_tax),
    print_english: Boolean(row.print_english),
    hide_empty_rows: Boolean(row.hide_empty_rows),
    items,
    cheques,
    account_lines: accountLines,
  };
}

function getNextSalesInvoiceNumber(): string {
  const rows = db.prepare("SELECT invoice_number FROM inventory_sales_invoices").all() as { invoice_number: string }[];
  let maxNum = 1000;
  for (const r of rows) {
    const matches = String(r.invoice_number || "").match(/\d+/g);
    if (matches && matches.length > 0) {
      const n = parseInt(matches[matches.length - 1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `SINV-${maxNum + 1}`;
}

function executePostInventorySalesInvoice(invId: number, userId: number, userName: string) {
  const raw = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
  if (!raw) throw new Error("الفاتورة غير موجودة");
  if (raw.posting_status === "posted") {
    return parseInvoiceRow(raw);
  }

  const inv = parseInvoiceRow(raw)!;
  const items: any[] = Array.isArray(inv.items) ? inv.items : [];
  if (items.length === 0) {
    throw new Error("لا يمكن ترحيل فاتورة مبيعات مخزنية بدون أصناف");
  }

  const invoiceNumber = inv.invoice_number;
  const customerId = inv.customer_id ? Number(inv.customer_id) : null;
  const effectiveSafeId = inv.safe_id ? Number(inv.safe_id) : 1;

  // 1. Create or sync record in central `orders` table so all sales reports & returns work seamlessly
  let orderId = inv.order_id ? Number(inv.order_id) : null;
  const pmForOrder = inv.payment_type === "cash" ? "cash" : "credit";
  const chequesTotal = (inv.cheques || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
  const cashCollected = inv.payment_type === "cash"
    ? Number(inv.net_total || 0)
    : Number(inv.advance_cash_amount || 0);

  const ordRes = db.prepare(`
    INSERT INTO orders (
      invoice_number, subtotal, discount, tax, total,
      payment_method, cash_amount, card_amount,
      customer_id, user_id, note, order_type, safe_id, created_at, status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'completed')
  `).run(
    invoiceNumber,
    Number(inv.subtotal_no_tax || 0),
    Math.abs(Math.min(0, Number(inv.additions_discounts_net || 0))),
    Number(inv.sales_tax_amount || 0),
    Number(inv.net_total || 0),
    pmForOrder,
    cashCollected,
    chequesTotal,
    customerId,
    userId,
    inv.description || `فاتورة مبيعات مخزنية رقم ${invoiceNumber}`,
    "inventory_invoice",
    effectiveSafeId,
    new Date().toISOString()
  );
  orderId = Number(ordRes.lastInsertRowid);

  const insOrdItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total, category_id, category_name)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  // 2. Deduct stock from products & log stock_movements + inventory_movements
  let totalCogs = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const prod = item.product_id
      ? (db.prepare("SELECT p.*, c.name as cat_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?").get(item.product_id) as any)
      : null;

    insOrdItem.run(
      orderId,
      prod?.id || item.product_id || null,
      item.product_name || prod?.name || "صنف مخزني",
      qty,
      price,
      Number(item.total) || (qty * price),
      prod?.category_id || null,
      prod?.cat_name || null
    );

    if (prod && qty > 0) {
      const prevStock = Number(prod.stock ?? 0);
      const newStock = Math.max(0, prevStock - qty);
      db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, prod.id);

      try {
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_name)
          VALUES (?, 'out', ?, ?, ?, ?, ?, ?)
        `).run(
          prod.id,
          qty,
          prevStock,
          newStock,
          `ترحيل فاتورة مبيعات مخزنية رقم ${invoiceNumber} (${inv.warehouse_name || "المستودع الرئيسي"})`,
          orderId,
          userName
        );
      } catch {}

      try {
        db.prepare(`
          INSERT INTO inventory_movements (product_id, type, quantity, unit_cost, reference_type, reference_id, notes)
          VALUES (?, 'out', ?, ?, 'inventory_sale_invoice', ?, ?)
        `).run(
          prod.id,
          qty,
          Number(prod.cost || item.cost_price || 0),
          invId,
          `ترحيل فاتورة مبيعات مخزنية رقم ${invoiceNumber}`
        );
      } catch {}

      totalCogs += Number(prod.cost || item.cost_price || 0) * qty;
    } else {
      totalCogs += Number(item.cost_price || 0) * qty;
    }
  }

  // 3. Accounting Journal Entry & Customer / Safe / Bank Balance Updates
  const netTotal = Math.round((Number(inv.net_total) || 0) * 100) / 100;
  const salesTax = Math.round((Number(inv.sales_tax_amount) || 0) * 100) / 100;
  const withholdingTax = Math.round((Number(inv.withholding_tax_amount) || 0) * 100) / 100;
  const netRev = Math.max(0, Math.round((netTotal - salesTax + withholdingTax) * 100) / 100);
  const custAccCode = getCustomerAccountCode(customerId);
  const custLabel = inv.customer_name ? ` - العميل: ${inv.customer_name}` : "";

  const lines: { account_code: string; debit: number; credit: number; description?: string }[] = [];

  if (inv.payment_type === "cash") {
    const cashPart = Math.max(0, Math.round((netTotal - chequesTotal) * 100) / 100);
    if (cashPart > 0) {
      lines.push({
        account_code: "11100",
        debit: cashPart,
        credit: 0,
        description: `تحصيل نقدي فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`
      });
      recordSafeOrBankMovement(db, {
        type: "in",
        amount: cashPart,
        method: "cash",
        safeId: effectiveSafeId,
        description: `تحصيل نقدي فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`,
        referenceType: "inventory_sale_invoice",
        referenceId: invId,
        userId
      });
    }
    if (chequesTotal > 0) {
      lines.push({
        account_code: "11200",
        debit: Math.round(chequesTotal * 100) / 100,
        credit: 0,
        description: `تحصيل شيكات فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`
      });
      recordSafeOrBankMovement(db, {
        type: "in",
        amount: Math.round(chequesTotal * 100) / 100,
        method: "bank",
        safeId: effectiveSafeId,
        description: `تحصيل شيكات فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`,
        referenceType: "inventory_sale_invoice",
        referenceId: invId,
        userId
      });
    }
  } else {
    // Credit Invoice (أجل) with optional advance cash & cheques
    const advCash = Math.round((Number(inv.advance_cash_amount) || 0) * 100) / 100;
    const chqAmt = Math.round(chequesTotal * 100) / 100;
    const remainingOnCustomer = Math.max(0, Math.round((netTotal - advCash - chqAmt) * 100) / 100);

    if (advCash > 0) {
      lines.push({
        account_code: "11100",
        debit: advCash,
        credit: 0,
        description: `دفعة مقدمة نقدية - فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`
      });
      recordSafeOrBankMovement(db, {
        type: "in",
        amount: advCash,
        method: "cash",
        safeId: effectiveSafeId,
        description: `دفعة مقدمة نقدية فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`,
        referenceType: "inventory_sale_invoice",
        referenceId: invId,
        userId
      });
    }
    if (chqAmt > 0) {
      lines.push({
        account_code: "11200",
        debit: chqAmt,
        credit: 0,
        description: `شيكات محصلة مقدماً - فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`
      });
      recordSafeOrBankMovement(db, {
        type: "in",
        amount: chqAmt,
        method: "bank",
        safeId: effectiveSafeId,
        description: `شيكات محصلة فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`,
        referenceType: "inventory_sale_invoice",
        referenceId: invId,
        userId
      });
    }
    if (remainingOnCustomer > 0) {
      lines.push({
        account_code: custAccCode,
        debit: remainingOnCustomer,
        credit: 0,
        description: `استحقاق فاتورة مبيعات مخزنية آجلة #${invoiceNumber}${custLabel}`
      });
      if (customerId) {
        db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(remainingOnCustomer, customerId);
      }
    }
  }

  if (withholdingTax > 0) {
    lines.push({
      account_code: "21300",
      debit: withholdingTax,
      credit: 0,
      description: `ضريبة خصم المنبع - فاتورة #${invoiceNumber}`
    });
  }

  if (netRev > 0) {
    lines.push({
      account_code: "41000",
      debit: 0,
      credit: netRev,
      description: `إيرادات فاتورة مبيعات مخزنية #${invoiceNumber}${custLabel}`
    });
  }
  if (salesTax > 0) {
    lines.push({
      account_code: "21300",
      debit: 0,
      credit: salesTax,
      description: `ضريبة المبيعات المحصلة - فاتورة #${invoiceNumber}`
    });
  }

  const cogsRounded = Math.round(totalCogs * 100) / 100;
  if (cogsRounded > 0) {
    lines.push({
      account_code: "51000",
      debit: cogsRounded,
      credit: 0,
      description: `تكلفة البضاعة المباعة - فاتورة مخزنية #${invoiceNumber}`
    });
    lines.push({
      account_code: "11300",
      debit: 0,
      credit: cogsRounded,
      description: `صرف مخزون بضاعة مباعة - فاتورة مخزنية #${invoiceNumber}`
    });
  }

  let journalEntryId: number | null = null;
  try {
    journalEntryId = createDoubleEntryJournal(
      inv.invoice_date || getBusinessDate("sales"),
      `ترحيل فاتورة مبيعات مخزنية رقم #${invoiceNumber}${custLabel}`,
      "inventory_sale_invoice",
      invId,
      lines
    );
  } catch (jeErr: any) {
    console.warn("Journal creation notice for inventory invoice:", jeErr?.message);
  }

  db.prepare(`
    UPDATE inventory_sales_invoices
    SET posting_status = 'posted',
        order_id = ?,
        journal_entry_id = ?,
        total_cost = ?,
        profit_margin = ?
    WHERE id = ?
  `).run(
    orderId,
    journalEntryId,
    cogsRounded,
    Math.round((netRev - cogsRounded) * 100) / 100,
    invId
  );

  return parseInvoiceRow(db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId));
}

function executeUnpostInventorySalesInvoice(invId: number, userId: number, userName: string) {
  const raw = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
  if (!raw) throw new Error("الفاتورة غير موجودة");
  if (raw.posting_status !== "posted") {
    return parseInvoiceRow(raw);
  }

  const inv = parseInvoiceRow(raw)!;
  const items: any[] = Array.isArray(inv.items) ? inv.items : [];
  const invoiceNumber = inv.invoice_number;
  const customerId = inv.customer_id ? Number(inv.customer_id) : null;
  const effectiveSafeId = inv.safe_id ? Number(inv.safe_id) : 1;

  // 1. Restore Stock
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const prod = item.product_id
      ? (db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id) as any)
      : null;
    if (prod && qty > 0) {
      const prevStock = Number(prod.stock ?? 0);
      const newStock = prevStock + qty;
      db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, prod.id);
      try {
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_name)
          VALUES (?, 'in', ?, ?, ?, ?, ?, ?)
        `).run(
          prod.id,
          qty,
          prevStock,
          newStock,
          `فك ترحيل فاتورة مبيعات مخزنية رقم ${invoiceNumber} (إرجاع للمخزون)`,
          invId,
          userName
        );
      } catch {}
    }
  }

  // 2. Reverse Customer Balance / Safe Movements
  const netTotal = Math.round((Number(inv.net_total) || 0) * 100) / 100;
  const chequesTotal = (inv.cheques || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

  if (inv.payment_type === "cash") {
    const cashPart = Math.max(0, Math.round((netTotal - chequesTotal) * 100) / 100);
    if (cashPart > 0) {
      recordSafeOrBankMovement(db, {
        type: "out",
        amount: cashPart,
        method: "cash",
        safeId: effectiveSafeId,
        description: `عكس تحصيل نقدي (فك ترحيل فاتورة #${invoiceNumber})`,
        referenceType: "inventory_sale_unpost",
        referenceId: invId,
        userId
      });
    }
  } else {
    const advCash = Math.round((Number(inv.advance_cash_amount) || 0) * 100) / 100;
    const chqAmt = Math.round(chequesTotal * 100) / 100;
    const remainingOnCustomer = Math.max(0, Math.round((netTotal - advCash - chqAmt) * 100) / 100);
    if (advCash > 0) {
      recordSafeOrBankMovement(db, {
        type: "out",
        amount: advCash,
        method: "cash",
        safeId: effectiveSafeId,
        description: `عكس دفعة مقدمة (فك ترحيل فاتورة #${invoiceNumber})`,
        referenceType: "inventory_sale_unpost",
        referenceId: invId,
        userId
      });
    }
    if (remainingOnCustomer > 0 && customerId) {
      db.prepare("UPDATE customers SET balance = COALESCE(balance, 0) - ? WHERE id = ?").run(remainingOnCustomer, customerId);
    }
  }

  // 3. Remove linked Journal Entry & reversing account balances
  if (inv.journal_entry_id) {
    try {
      const jLines = db.prepare("SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?").all(inv.journal_entry_id) as any[];
      for (const jl of jLines) {
        const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(jl.account_id) as any;
        if (acc) {
          const isDebitNormal = acc.type === "asset" || acc.type === "expense" || acc.type === "cogs";
          const delta = isDebitNormal ? (Number(jl.debit || 0) - Number(jl.credit || 0)) : (Number(jl.credit || 0) - Number(jl.debit || 0));
          db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) - ? WHERE id = ?").run(delta, acc.id);
        }
      }
      db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(inv.journal_entry_id);
      db.prepare("DELETE FROM journal_entries WHERE id = ?").run(inv.journal_entry_id);
    } catch {}
  }

  // 4. Remove linked central order record
  if (inv.order_id) {
    try {
      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(inv.order_id);
      db.prepare("DELETE FROM orders WHERE id = ?").run(inv.order_id);
    } catch {}
  }

  db.prepare(`
    UPDATE inventory_sales_invoices
    SET posting_status = 'unposted',
        order_id = NULL,
        journal_entry_id = NULL
    WHERE id = ?
  `).run(invId);

  return parseInvoiceRow(db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId));
}

router.get("/sales-invoices/meta", (_req, res) => {
  try {
    const customers = db.prepare("SELECT * FROM customers ORDER BY id ASC").all();
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.active = 1
      ORDER BY p.id ASC
    `).all();
    const categories = db.prepare("SELECT * FROM categories ORDER BY id ASC").all();
    let branches: any[] = [];
    try { branches = db.prepare("SELECT * FROM branches ORDER BY id ASC").all(); } catch {}
    if (branches.length === 0) {
      branches = [
        { id: 1, name: "المستودع الرئيسي - فرع الهرم" },
        { id: 2, name: "مستودع الفرع التجاري" }
      ];
    }
    let safes: any[] = [];
    try { safes = db.prepare("SELECT * FROM safes WHERE active = 1 ORDER BY id ASC").all(); } catch {}
    let employees: any[] = [];
    try { employees = db.prepare("SELECT id, employee_number, name, position FROM hr_employees WHERE active = 1 ORDER BY CAST(employee_number AS INTEGER) ASC, id ASC").all(); } catch {}
    let currencies: any[] = [];
    try { currencies = db.prepare("SELECT * FROM currencies ORDER BY id ASC").all(); } catch {}
    if (currencies.length === 0) {
      currencies = [
        { id: 1, name: "ريال سعودي", symbol: "SAR", exchange_rate: 1 },
        { id: 2, name: "جنيه مصري", symbol: "EGP", exchange_rate: 1 },
        { id: 3, name: "ريال يمني", symbol: "YER", exchange_rate: 1 },
        { id: 4, name: "دولار أمريكي", symbol: "USD", exchange_rate: 3.75 }
      ];
    }
    let accounts: any[] = [];
    try { accounts = db.prepare("SELECT id, code, name, type FROM accounts ORDER BY code ASC").all(); } catch {}
    let costCenters: any[] = [];
    try { costCenters = db.prepare("SELECT * FROM cost_centers ORDER BY id ASC").all(); } catch {}
    if (costCenters.length === 0) {
      costCenters = [
        { id: 1, code: "CC-01", name: "المبيعات العامة" },
        { id: 2, code: "CC-02", name: "مبيعات الجملة والتوريدات" },
        { id: 3, code: "CC-03", name: "مبيعات الفروع والتجزئة" }
      ];
    }

    res.json({
      customers,
      products,
      categories,
      branches,
      safes,
      employees,
      currencies,
      accounts,
      costCenters,
      nextInvoiceNumber: getNextSalesInvoiceNumber(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sales-invoices", (req, res) => {
  try {
    const { status, search, payment_type, customer_id } = req.query;
    let sql = "SELECT * FROM inventory_sales_invoices WHERE 1=1";
    const params: any[] = [];

    if (status === "cancelled") {
      sql += " AND posting_status = 'cancelled'";
    } else if (status === "normal") {
      sql += " AND posting_status != 'cancelled'";
    } else if (status && status !== "all") {
      sql += " AND posting_status = ?";
      params.push(status);
    }

    if (payment_type && payment_type !== "all") {
      sql += " AND payment_type = ?";
      params.push(payment_type);
    }

    if (customer_id) {
      sql += " AND customer_id = ?";
      params.push(Number(customer_id));
    }

    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      sql += " AND (invoice_number LIKE ? OR customer_name LIKE ? OR description LIKE ? OR sales_order_number LIKE ?)";
      params.push(q, q, q, q);
    }

    sql += " ORDER BY id ASC";
    const rows = db.prepare(sql).all(...params) as any[];
    res.json(rows.map(parseInvoiceRow));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sales-invoices/customer/:customerId/collections", (req, res) => {
  try {
    const cid = Number(req.params.customerId);
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(cid) as any;
    const invoices = db.prepare(`
      SELECT id, invoice_number, invoice_date, payment_type, net_total, advance_cash_amount, posting_status
      FROM inventory_sales_invoices
      WHERE customer_id = ?
      ORDER BY id DESC
    `).all(cid);
    const ordersList = db.prepare(`
      SELECT id, invoice_number, total, payment_method, cash_amount, created_at
      FROM orders
      WHERE customer_id = ?
      ORDER BY id DESC LIMIT 30
    `).all(cid);
    res.json({ customer, invoices, orders: ordersList });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sales-invoices/:id/journal", (req, res) => {
  try {
    const raw = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(req.params.id) as any;
    if (!raw) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    const inv = parseInvoiceRow(raw)!;

    if (inv.journal_entry_id) {
      const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(inv.journal_entry_id) as any;
      const lines = db.prepare(`
        SELECT jl.*, a.code as acc_code, a.name as account_name
        FROM journal_entry_lines jl
        LEFT JOIN accounts a ON a.id = jl.account_id
        WHERE jl.journal_entry_id = ?
      `).all(inv.journal_entry_id);
      if (entry) {
        res.json({ posted: true, entry, lines });
        return;
      }
    }

    // Build preview journal entry for unposted invoice
    const netTotal = Math.round((Number(inv.net_total) || 0) * 100) / 100;
    const salesTax = Math.round((Number(inv.sales_tax_amount) || 0) * 100) / 100;
    const withholdingTax = Math.round((Number(inv.withholding_tax_amount) || 0) * 100) / 100;
    const netRev = Math.max(0, Math.round((netTotal - salesTax + withholdingTax) * 100) / 100);
    const chequesTotal = (inv.cheques || []).reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
    const custAccCode = getCustomerAccountCode(inv.customer_id ? Number(inv.customer_id) : null);
    const totalCost = Math.round((inv.items || []).reduce((s: number, it: any) => s + (Number(it.cost_price || 0) * Number(it.quantity || 0)), 0) * 100) / 100;

    const previewLines: any[] = [];
    if (inv.payment_type === "cash") {
      const cashPart = Math.max(0, Math.round((netTotal - chequesTotal) * 100) / 100);
      if (cashPart > 0) previewLines.push({ account_code: "11100", account_name: "الصندوق الرئيسي للمؤسسة", debit: cashPart, credit: 0, description: `تحصيل نقدي فاتورة #${inv.invoice_number}` });
      if (chequesTotal > 0) previewLines.push({ account_code: "11200", account_name: "البنك / الشيكات تحت التحصيل", debit: chequesTotal, credit: 0, description: `تحصيل شيكات فاتورة #${inv.invoice_number}` });
    } else {
      const advCash = Math.round((Number(inv.advance_cash_amount) || 0) * 100) / 100;
      const remaining = Math.max(0, Math.round((netTotal - advCash - chequesTotal) * 100) / 100);
      if (advCash > 0) previewLines.push({ account_code: "11100", account_name: "الصندوق الرئيسي للمؤسسة", debit: advCash, credit: 0, description: `دفعة مقدمة نقدية فاتورة #${inv.invoice_number}` });
      if (chequesTotal > 0) previewLines.push({ account_code: "11200", account_name: "البنك / الشيكات", debit: chequesTotal, credit: 0, description: `دفعة شيكات فاتورة #${inv.invoice_number}` });
      if (remaining > 0) previewLines.push({ account_code: custAccCode, account_name: `ذمم العميل: ${inv.customer_name || "عميل آجل"}`, debit: remaining, credit: 0, description: `استحقاق آجل فاتورة #${inv.invoice_number}` });
    }
    if (withholdingTax > 0) {
      previewLines.push({ account_code: "21300", account_name: "ضريبة خصم المنبع", debit: withholdingTax, credit: 0, description: `ضريبة خصم المنبع فاتورة #${inv.invoice_number}` });
    }
    if (netRev > 0) {
      previewLines.push({ account_code: "41000", account_name: "إيرادات المبيعات", debit: 0, credit: netRev, description: `إيرادات مبيعات فاتورة #${inv.invoice_number}` });
    }
    if (salesTax > 0) {
      previewLines.push({ account_code: "21300", account_name: "ضريبة القيمة المضافة المحصلة", debit: 0, credit: salesTax, description: `ضريبة المبيعات فاتورة #${inv.invoice_number}` });
    }
    if (totalCost > 0) {
      previewLines.push({ account_code: "51000", account_name: "تكلفة البضاعة المباعة", debit: totalCost, credit: 0, description: `تكلفة مبيعات الفاتورة #${inv.invoice_number}` });
      previewLines.push({ account_code: "11300", account_name: "مخزون البضاعة", debit: 0, credit: totalCost, description: `صرف مخزون الفاتورة #${inv.invoice_number}` });
    }

    res.json({
      posted: false,
      entry: {
        entry_number: `PREVIEW-${inv.invoice_number}`,
        entry_date: inv.invoice_date,
        description: `معاينة قيد فاتورة مبيعات مخزنية #${inv.invoice_number} (يُعتمد عند الترحيل)`,
      },
      lines: previewLines,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sales-invoices", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const b = req.body || {};
    let invNum = b.invoice_number ? String(b.invoice_number).trim() : "";
    if (!invNum) invNum = getNextSalesInvoiceNumber();
    const exists = db.prepare("SELECT id FROM inventory_sales_invoices WHERE invoice_number = ?").get(invNum);
    if (exists) invNum = getNextSalesInvoiceNumber();

    const items = Array.isArray(b.items) ? b.items : [];
    const cheques = Array.isArray(b.cheques) ? b.cheques : [];
    const accountLines = Array.isArray(b.account_lines) ? b.account_lines : [];

    const totalCost = items.reduce((s: number, it: any) => s + (Number(it.cost_price || 0) * Number(it.quantity || 0)), 0);
    const subNoTax = Number(b.subtotal_no_tax ?? 0);
    const addDiscNet = Number(b.additions_discounts_net ?? 0);
    const profitMargin = Math.round((subNoTax + addDiscNet - totalCost) * 100) / 100;

    const r = db.prepare(`
      INSERT INTO inventory_sales_invoices (
        invoice_number, payment_type, allow_return, allow_return_days, description,
        invoice_date, hijri_date, delivery_date, hijri_delivery_date,
        customer_id, customer_name, warehouse_id, warehouse_name,
        cost_center_id, cost_center_name, sales_rep_id, sales_rep_name,
        driver_name, distributor_name, seller_name,
        tax_treatment, currency, exchange_rate, sales_order_number,
        is_delivered, subject_to_sales_tax, advance_cash_amount, safe_id, safe_name,
        cheques_json, account_lines_json, items_json,
        subtotal_no_tax, sales_tax_amount, withholding_tax_amount, additions_discounts_net,
        gifts_total, net_total, total_cost, profit_margin,
        posting_status, print_english, hide_empty_rows, created_by, created_by_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      invNum,
      b.payment_type === "cash" ? "cash" : "credit",
      b.allow_return !== false ? 1 : 0,
      Number(b.allow_return_days ?? 365),
      b.description ?? "",
      b.invoice_date || new Date().toISOString().slice(0, 10),
      b.hijri_date ?? "",
      b.delivery_date || b.invoice_date || new Date().toISOString().slice(0, 10),
      b.hijri_delivery_date ?? "",
      b.customer_id ? Number(b.customer_id) : null,
      b.customer_name ?? "عميل نقدي / عام",
      b.warehouse_id ? Number(b.warehouse_id) : 1,
      b.warehouse_name ?? "المستودع الرئيسي",
      b.cost_center_id ? Number(b.cost_center_id) : 1,
      b.cost_center_name ?? "المبيعات العامة",
      b.sales_rep_id ? Number(b.sales_rep_id) : null,
      b.sales_rep_name ?? "",
      b.driver_name ?? "",
      b.distributor_name ?? "",
      b.seller_name ?? "",
      b.tax_treatment ?? "دون ضريبة",
      b.currency ?? "ريال سعودي",
      Number(b.exchange_rate ?? 1),
      b.sales_order_number ?? "",
      b.is_delivered ? 1 : 0,
      b.subject_to_sales_tax !== false ? 1 : 0,
      Number(b.advance_cash_amount ?? 0),
      b.safe_id ? Number(b.safe_id) : 1,
      b.safe_name ?? "الصندوق الرئيسي",
      JSON.stringify(cheques),
      JSON.stringify(accountLines),
      JSON.stringify(items),
      subNoTax,
      Number(b.sales_tax_amount ?? 0),
      Number(b.withholding_tax_amount ?? 0),
      addDiscNet,
      Number(b.gifts_total ?? 0),
      Number(b.net_total ?? 0),
      Math.round(totalCost * 100) / 100,
      profitMargin,
      "unposted",
      b.print_english ? 1 : 0,
      b.hide_empty_rows !== false ? 1 : 0,
      authUser?.id || 1,
      authUser?.name || "مدير النظام"
    );

    const newId = Number(r.lastInsertRowid);
    if (b.auto_post) {
      const posted = executePostInventorySalesInvoice(newId, authUser?.id || 1, authUser?.name || "مدير النظام");
      res.status(201).json(posted);
      return;
    }

    const created = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(newId);
    res.status(201).json(parseInvoiceRow(created));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/sales-invoices/:id", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const invId = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
    if (!existing) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

    const wasPosted = existing.posting_status === "posted";
    if (wasPosted) {
      executeUnpostInventorySalesInvoice(invId, authUser?.id || 1, authUser?.name || "مدير النظام");
    }

    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : JSON.parse(existing.items_json || "[]");
    const cheques = Array.isArray(b.cheques) ? b.cheques : JSON.parse(existing.cheques_json || "[]");
    const accountLines = Array.isArray(b.account_lines) ? b.account_lines : JSON.parse(existing.account_lines_json || "[]");

    const totalCost = items.reduce((s: number, it: any) => s + (Number(it.cost_price || 0) * Number(it.quantity || 0)), 0);
    const subNoTax = Number(b.subtotal_no_tax ?? existing.subtotal_no_tax ?? 0);
    const addDiscNet = Number(b.additions_discounts_net ?? existing.additions_discounts_net ?? 0);
    const profitMargin = Math.round((subNoTax + addDiscNet - totalCost) * 100) / 100;

    db.prepare(`
      UPDATE inventory_sales_invoices
      SET invoice_number = COALESCE(?, invoice_number),
          payment_type = ?,
          allow_return = ?,
          allow_return_days = ?,
          description = ?,
          invoice_date = ?,
          hijri_date = ?,
          delivery_date = ?,
          hijri_delivery_date = ?,
          customer_id = ?,
          customer_name = ?,
          warehouse_id = ?,
          warehouse_name = ?,
          cost_center_id = ?,
          cost_center_name = ?,
          sales_rep_id = ?,
          sales_rep_name = ?,
          driver_name = ?,
          distributor_name = ?,
          seller_name = ?,
          tax_treatment = ?,
          currency = ?,
          exchange_rate = ?,
          sales_order_number = ?,
          is_delivered = ?,
          subject_to_sales_tax = ?,
          advance_cash_amount = ?,
          safe_id = ?,
          safe_name = ?,
          cheques_json = ?,
          account_lines_json = ?,
          items_json = ?,
          subtotal_no_tax = ?,
          sales_tax_amount = ?,
          withholding_tax_amount = ?,
          additions_discounts_net = ?,
          gifts_total = ?,
          net_total = ?,
          total_cost = ?,
          profit_margin = ?,
          print_english = ?,
          hide_empty_rows = ?
      WHERE id = ?
    `).run(
      b.invoice_number ? String(b.invoice_number).trim() : null,
      b.payment_type === "cash" ? "cash" : "credit",
      b.allow_return !== false ? 1 : 0,
      Number(b.allow_return_days ?? 365),
      b.description ?? "",
      b.invoice_date || existing.invoice_date,
      b.hijri_date ?? existing.hijri_date ?? "",
      b.delivery_date || existing.delivery_date,
      b.hijri_delivery_date ?? existing.hijri_delivery_date ?? "",
      b.customer_id ? Number(b.customer_id) : null,
      b.customer_name ?? existing.customer_name,
      b.warehouse_id ? Number(b.warehouse_id) : 1,
      b.warehouse_name ?? existing.warehouse_name,
      b.cost_center_id ? Number(b.cost_center_id) : 1,
      b.cost_center_name ?? existing.cost_center_name,
      b.sales_rep_id ? Number(b.sales_rep_id) : null,
      b.sales_rep_name ?? existing.sales_rep_name,
      b.driver_name ?? existing.driver_name,
      b.distributor_name ?? existing.distributor_name,
      b.seller_name ?? existing.seller_name,
      b.tax_treatment ?? existing.tax_treatment,
      b.currency ?? existing.currency,
      Number(b.exchange_rate ?? existing.exchange_rate ?? 1),
      b.sales_order_number ?? existing.sales_order_number,
      b.is_delivered ? 1 : 0,
      b.subject_to_sales_tax !== false ? 1 : 0,
      Number(b.advance_cash_amount ?? 0),
      b.safe_id ? Number(b.safe_id) : 1,
      b.safe_name ?? existing.safe_name,
      JSON.stringify(cheques),
      JSON.stringify(accountLines),
      JSON.stringify(items),
      subNoTax,
      Number(b.sales_tax_amount ?? 0),
      Number(b.withholding_tax_amount ?? 0),
      addDiscNet,
      Number(b.gifts_total ?? 0),
      Number(b.net_total ?? 0),
      Math.round(totalCost * 100) / 100,
      profitMargin,
      b.print_english ? 1 : 0,
      b.hide_empty_rows !== false ? 1 : 0,
      invId
    );

    if (wasPosted && b.keep_posted !== false) {
      const reposted = executePostInventorySalesInvoice(invId, authUser?.id || 1, authUser?.name || "مدير النظام");
      res.json(reposted);
      return;
    }

    const updated = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId);
    res.json(parseInvoiceRow(updated));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/sales-invoices/:id/post", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const posted = executePostInventorySalesInvoice(Number(req.params.id), authUser?.id || 1, authUser?.name || "مدير النظام");
    res.json(posted);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/sales-invoices/:id/unpost", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const unposted = executeUnpostInventorySalesInvoice(Number(req.params.id), authUser?.id || 1, authUser?.name || "مدير النظام");
    res.json(unposted);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/sales-invoices/:id/cancel", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const invId = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
    if (!existing) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    if (existing.posting_status === "posted") {
      executeUnpostInventorySalesInvoice(invId, authUser?.id || 1, authUser?.name || "مدير النظام");
    }
    db.prepare("UPDATE inventory_sales_invoices SET posting_status = 'cancelled' WHERE id = ?").run(invId);
    const cancelled = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId);
    res.json(parseInvoiceRow(cancelled));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/sales-invoices/:id/restore", (req, res) => {
  try {
    const invId = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
    if (!existing) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    db.prepare("UPDATE inventory_sales_invoices SET posting_status = 'unposted' WHERE id = ?").run(invId);
    const restored = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId);
    res.json(parseInvoiceRow(restored));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/sales-invoices/:id", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const invId = Number(req.params.id);
    const existing = db.prepare("SELECT * FROM inventory_sales_invoices WHERE id = ?").get(invId) as any;
    if (!existing) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    if (existing.posting_status === "posted") {
      executeUnpostInventorySalesInvoice(invId, authUser?.id || 1, authUser?.name || "مدير النظام");
    }
    db.prepare("DELETE FROM inventory_sales_invoices WHERE id = ?").run(invId);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
