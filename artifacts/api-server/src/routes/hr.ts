import { Router } from "express";
import { db, createDoubleEntryJournal, deleteJournalBySource } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { getBusinessDate } from "../lib/business-day";
import { getEmployeeSubAccountCode } from "../lib/erp-accounting-sync";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح، يرجى تسجيل الدخول مجدداً" });
    return false;
  }
  if (!user.active) {
    res.status(403).json({ error: "حساب المستخدم غير نشط" });
    return false;
  }
  return true;
}

/* ── Departments ── */
router.get("/hr/departments", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare("SELECT * FROM hr_departments ORDER BY name").all();
  res.json(rows);
});

router.post("/hr/departments", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, budget } = req.body;
  if (!name) { res.status(400).json({ error: "اسم القسم مطلوب" }); return; }
  const r = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?,?)").run(name, budget ?? 0);
  res.status(201).json(db.prepare("SELECT * FROM hr_departments WHERE id=?").get(r.lastInsertRowid));
});

router.put("/hr/departments/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, budget } = req.body;
  db.prepare("UPDATE hr_departments SET name=?, budget=? WHERE id=?").run(name, budget ?? 0, req.params.id);
  res.json(db.prepare("SELECT * FROM hr_departments WHERE id=?").get(req.params.id));
});

router.delete("/hr/departments/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_departments WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Employees ── */
router.get("/hr/employees", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT e.*, d.name as department_name
    FROM hr_employees e
    LEFT JOIN hr_departments d ON d.id = e.department_id
    ORDER BY e.name
  `).all() as any[];
  res.json(rows.map(r => ({ ...r, active: Boolean(r.active) })));
});

router.get("/hr/employees/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = db.prepare(`
    SELECT e.*, d.name as department_name
    FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id
    WHERE e.id=?
  `).get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json({ ...row, active: Boolean(row.active) });
});

router.post("/hr/employees", (req, res) => {
  if (!requireAdmin(req, res)) return;
  
  try {
    let { employee_number, name, phone, position, department_id, basic_salary, hire_date, active } = req.body;
    
    if (!name || name.trim() === "") { 
      res.status(400).json({ error: "اسم الموظف مطلوب" }); 
      return; 
    }
    
    // Check if employee_number is provided as a positive integer and unique, otherwise auto-generate 1, 2, 3...
    const rawNum = employee_number ? String(employee_number).trim() : "";
    if (/^[1-9]\d*$/.test(rawNum)) {
      const existing = db.prepare("SELECT 1 FROM hr_employees WHERE employee_number = ?").get(rawNum);
      if (existing) {
        res.status(400).json({ error: `رقم الموظف "${rawNum}" موجود مسبقاً` });
        return;
      }
      employee_number = rawNum;
    } else {
      let suffix = 1;
      let exists = true;
      while (exists) {
        employee_number = String(suffix);
        const check = db.prepare("SELECT 1 FROM hr_employees WHERE employee_number = ?").get(employee_number);
        if (!check) exists = false;
        else suffix++;
      }
    }

    // Handle dynamic department creation if department_id is a non-numeric string and not empty
    if (department_id && isNaN(Number(department_id))) {
      const existing = db.prepare("SELECT id FROM hr_departments WHERE name=?").get(department_id) as any;
      if (existing) {
        department_id = existing.id;
      } else {
        const d_res = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?, 0)").run(department_id);
        department_id = d_res.lastInsertRowid;
      }
    } else if (department_id) {
      department_id = Number(department_id);
    }

    const r = db.prepare(`
      INSERT INTO hr_employees (employee_number, name, phone, position, department_id, basic_salary, hire_date, active)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      employee_number, 
      name.trim(), 
      phone || null, 
      position || null, 
      department_id || null, 
      Number(basic_salary) || 0, 
      hire_date || new Date().toISOString().split('T')[0], 
      active === false ? 0 : 1
    );

    const employeeId = Number(r.lastInsertRowid);

    // Post-employee creation cleanup: if a customer with the same name exists, delete it and remap its account
    try {
      const empName = name.trim();
      const empCode = `214${String(employeeId).padStart(2, "0")}`;
      const empAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(empCode) as any;
      if (empAcc) {
        const rogueCusts = db.prepare("SELECT id, account_code FROM customers WHERE TRIM(name) = ?").all(empName) as any[];
        for (const rc of rogueCusts) {
          if (rc.account_code) {
            const rogueCustAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(rc.account_code) as any;
            if (rogueCustAcc) {
              db.prepare("UPDATE journal_entry_lines SET account_id = ?, account_code = ? WHERE account_id = ?").run(empAcc.id, empCode, rogueCustAcc.id);
              db.prepare("DELETE FROM accounts WHERE id = ?").run(rogueCustAcc.id);
            }
          }
          db.prepare("DELETE FROM customers WHERE id = ?").run(rc.id);
        }
      }
    } catch (e) {
      console.warn("Failed to auto-cleanup customer on employee add in hr.ts:", e);
    }

    const emp = db.prepare(`
      SELECT e.*, d.name as department_name FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id=e.department_id WHERE e.id=?
    `).get(employeeId) as any;
    
    if (!emp) {
      throw new Error("فشل في استعادة بيانات الموظف بعد الحفظ");
    }

    res.status(201).json({ ...emp, active: Boolean(emp.active) });
  } catch (e: any) {
    console.error("HR Employee insertion error:", e.message);
    res.status(500).json({ error: `فشل إضافة الموظف: ${e.message}` });
  }
});

router.put("/hr/employees/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_number, name, phone, position, department_id, basic_salary, hire_date, active } = req.body;
  db.prepare(`
    UPDATE hr_employees SET employee_number=?, name=?, phone=?, position=?, department_id=?, basic_salary=?, hire_date=?, active=?
    WHERE id=?
  `).run(employee_number, name, phone ?? null, position ?? null, department_id ?? null, basic_salary ?? 0, hire_date ?? null, active !== false ? 1 : 0, req.params.id);

  // Post-employee creation/update cleanup: if a customer with the same name exists, delete it and remap its account
  try {
    const empName = String(name || '').trim();
    const empCode = `214${String(req.params.id).padStart(2, "0")}`;
    const empAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(empCode) as any;
    if (empName && empAcc) {
      const rogueCusts = db.prepare("SELECT id, account_code FROM customers WHERE TRIM(name) = ?").all(empName) as any[];
      for (const rc of rogueCusts) {
        if (rc.account_code) {
          const rogueCustAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(rc.account_code) as any;
          if (rogueCustAcc) {
            db.prepare("UPDATE journal_entry_lines SET account_id = ?, account_code = ? WHERE account_id = ?").run(empAcc.id, empCode, rogueCustAcc.id);
            db.prepare("DELETE FROM accounts WHERE id = ?").run(rogueCustAcc.id);
          }
        }
        db.prepare("DELETE FROM customers WHERE id = ?").run(rc.id);
      }
    }
  } catch (e) {
    console.warn("Failed to auto-cleanup customer on employee update in hr.ts:", e);
  }

  const emp = db.prepare(`
    SELECT e.*, d.name as department_name FROM hr_employees e
    LEFT JOIN hr_departments d ON d.id=e.department_id WHERE e.id=?
  `).get(req.params.id) as any;
  res.json({ ...emp, active: Boolean(emp.active) });
});

router.delete("/hr/employees/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_employees WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Salaries ── */
router.get("/hr/salaries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, month } = req.query as any;
  let sql = `
    SELECT s.*, e.name as employee_name, e.employee_number
    FROM hr_salaries s JOIN hr_employees e ON e.id=s.employee_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (employee_id) { sql += " AND s.employee_id=?"; params.push(employee_id); }
  if (month) { sql += " AND s.month=?"; params.push(month); }
  sql += " ORDER BY s.month DESC, e.name";
  res.json(db.prepare(sql).all(...params));
});

router.post("/hr/salaries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, month, basic_salary, bonuses, deductions, notes } = req.body;
  if (!employee_id || !month) { res.status(400).json({ error: "الموظف والشهر مطلوبان" }); return; }
  const existing = db.prepare("SELECT id FROM hr_salaries WHERE employee_id=? AND month=?").get(employee_id, month);
  if (existing) { res.status(400).json({ error: "تم إضافة راتب هذا الشهر مسبقاً" }); return; }
  const net = (basic_salary ?? 0) + (bonuses ?? 0) - (deductions ?? 0);
  const r = db.prepare(`
    INSERT INTO hr_salaries (employee_id, month, basic_salary, bonuses, deductions, net_salary, status, notes)
    VALUES (?,?,?,?,?,?,'pending',?)
  `).run(employee_id, month, basic_salary ?? 0, bonuses ?? 0, deductions ?? 0, net, notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT s.*, e.name as employee_name, e.employee_number FROM hr_salaries s
    JOIN hr_employees e ON e.id=s.employee_id WHERE s.id=?
  `).get(r.lastInsertRowid));
});

router.put("/hr/salaries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { basic_salary, bonuses, deductions, status, payment_date, notes } = req.body;
  const net = (basic_salary ?? 0) + (bonuses ?? 0) - (deductions ?? 0);

  const oldSalary = db.prepare("SELECT * FROM hr_salaries WHERE id=?").get(req.params.id) as any;

  db.prepare(`
    UPDATE hr_salaries SET basic_salary=?, bonuses=?, deductions=?, net_salary=?, status=?, payment_date=?, notes=?
    WHERE id=?
  `).run(basic_salary ?? 0, bonuses ?? 0, deductions ?? 0, net, status ?? "pending", payment_date ?? null, notes ?? null, req.params.id);

  if (oldSalary && oldSalary.status !== "paid" && status === "paid") {
    try {
      const emp = db.prepare("SELECT name, account_code FROM hr_employees WHERE id=?").get(oldSalary.employee_id) as any;
      const empCode = emp?.account_code || `214${String(oldSalary.employee_id).padStart(2, "0")}`;
      createDoubleEntryJournal(
        payment_date || getBusinessDate("hr"),
        `صرف راتب شهر ${oldSalary.month} للموظف ${emp?.name || ''}`,
        "payroll",
        parseInt(req.params.id),
        [
          { account_code: empCode, debit: net, credit: 0, description: `تسوية وصرف راتب الموظف ${emp?.name || ''}` },
          { account_code: "11100", debit: 0, credit: net, description: `صرف نقدي لراتب الموظف من الصندوق الرئيسي` }
        ]
      );
    } catch (e) {
      console.error("Failed to auto-generate salary payment journal", e);
    }
  }

  res.json(db.prepare(`
    SELECT s.*, e.name as employee_name, e.employee_number FROM hr_salaries s
    JOIN hr_employees e ON e.id=s.employee_id WHERE s.id=?
  `).get(req.params.id));
});

router.delete("/hr/salaries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_salaries WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Attendance ── */
router.get("/hr/attendance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, date, month } = req.query as any;
  let sql = `
    SELECT a.*, e.name as employee_name, e.employee_number
    FROM hr_attendance a JOIN hr_employees e ON e.id=a.employee_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (employee_id) { sql += " AND a.employee_id=?"; params.push(employee_id); }
  if (date) { sql += " AND a.date=?"; params.push(date); }
  if (month) { sql += " AND strftime('%Y-%m', a.date)=?"; params.push(month); }
  sql += " ORDER BY a.date DESC, e.name";
  res.json(db.prepare(sql).all(...params));
});

router.post("/hr/attendance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, date, check_in, check_out, status, notes } = req.body;
  if (!employee_id || !date) { res.status(400).json({ error: "الموظف والتاريخ مطلوبان" }); return; }
  const existing = db.prepare("SELECT id FROM hr_attendance WHERE employee_id=? AND date=?").get(employee_id, date);
  if (existing) {
    db.prepare("UPDATE hr_attendance SET check_in=?, check_out=?, status=?, notes=? WHERE employee_id=? AND date=?")
      .run(check_in ?? null, check_out ?? null, status ?? "present", notes ?? null, employee_id, date);
    res.json(db.prepare("SELECT a.*, e.name as employee_name FROM hr_attendance a JOIN hr_employees e ON e.id=a.employee_id WHERE a.employee_id=? AND a.date=?").get(employee_id, date));
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_attendance (employee_id, date, check_in, check_out, status, notes)
    VALUES (?,?,?,?,?,?)
  `).run(employee_id, date, check_in ?? null, check_out ?? null, status ?? "present", notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT a.*, e.name as employee_name FROM hr_attendance a
    JOIN hr_employees e ON e.id=a.employee_id WHERE a.id=?
  `).get(r.lastInsertRowid));
});

router.put("/hr/attendance/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { check_in, check_out, status, notes } = req.body;
  db.prepare("UPDATE hr_attendance SET check_in=?, check_out=?, status=?, notes=? WHERE id=?")
    .run(check_in ?? null, check_out ?? null, status ?? "present", notes ?? null, req.params.id);
  res.json(db.prepare("SELECT a.*, e.name as employee_name FROM hr_attendance a JOIN hr_employees e ON e.id=a.employee_id WHERE a.id=?").get(req.params.id));
});

router.delete("/hr/attendance/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_attendance WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Meal Deductions ── */
router.get("/hr/meal-deductions", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, month } = req.query as any;
  let sql = `SELECT md.*, e.name as employee_name, e.employee_number FROM meal_deductions md
    JOIN hr_employees e ON e.id=md.employee_id WHERE 1=1`;
  const params: any[] = [];
  if (employee_id) { sql += " AND md.employee_id=?"; params.push(employee_id); }
  if (month) { sql += " AND strftime('%Y-%m', md.created_at)=?"; params.push(month); }
  sql += " ORDER BY md.created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

router.post("/hr/meal-deductions", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const { employee_id, employee_name, employee_number, order_id, invoice_number, amount, notes } = req.body;
  if (!employee_id || !amount) { res.status(400).json({ error: "الموظف والمبلغ مطلوبان" }); return; }

  // Prevent duplicate meal deduction entries for the same order or invoice
  if ((order_id || invoice_number) && Number(amount) > 0) {
    const existing = db.prepare(`
      SELECT * FROM meal_deductions 
      WHERE (order_id IS NOT NULL AND order_id = ?) 
         OR (invoice_number IS NOT NULL AND invoice_number = ? AND invoice_number != '')
      LIMIT 1
    `).get(order_id ?? -1, invoice_number ?? "") as any;
    if (existing) {
      return res.status(200).json(existing);
    }
  }

  const r = db.prepare(`
    INSERT INTO meal_deductions (employee_id, employee_name, employee_number, order_id, invoice_number, amount, cashier_id, cashier_name, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(employee_id, employee_name ?? "", employee_number ?? "", order_id ?? null, invoice_number ?? null, amount, user.id, user.name, notes ?? null);

  const mealDeductionId = Number(r.lastInsertRowid);

  // Auto-generate balanced double-entry journal entry for standalone meal deduction only (if not already journaled via sale order)
  const isPosOrderDeduction = Boolean(order_id || (invoice_number && db.prepare("SELECT id FROM orders WHERE invoice_number = ?").get(invoice_number)));
  if (!isPosOrderDeduction) {
    try {
      const empCode = getEmployeeSubAccountCode(db, employee_id, employee_name);
      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        `خصم وجبة للموظف ${employee_name || ''} - سند قيد تلقائي`,
        "meal_deduction",
        mealDeductionId,
        [
          { account_code: empCode, debit: Number(amount), credit: 0, description: `خصم وجبة للموظف ${employee_name || ''}` },
          { account_code: "41100", debit: 0, credit: Number(amount), description: `إيرادات مبيعات وجبات الموظفين` }
        ]
      );
    } catch (journalErr: any) {
      console.warn("Failed to auto-generate meal deduction journal entry:", journalErr.message);
    }
  }

  res.status(201).json(db.prepare("SELECT * FROM meal_deductions WHERE id=?").get(mealDeductionId));
});

/* ── Employee lookup by number (for POS meal deduction) ── */
router.get("/hr/employees/by-number/:num", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const emp = db.prepare(`
    SELECT e.*, d.name as department_name,
      (SELECT COALESCE(SUM(md.amount),0) FROM meal_deductions md WHERE md.employee_id=e.id AND strftime('%Y-%m', md.created_at)=strftime('%Y-%m','now')) as meal_deductions_this_month
    FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id
    WHERE e.employee_number=? AND e.active=1
  `).get(req.params.num) as any;
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود أو غير نشط" }); return; }
  res.json({ ...emp, active: Boolean(emp.active) });
});

/* ── Salary Statement Data (for A4 print) ── */
router.get("/hr/salary-statement/:employee_id/:month", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, month } = req.params;
  const emp = db.prepare(`
    SELECT e.*, d.name as department_name FROM hr_employees e
    LEFT JOIN hr_departments d ON d.id=e.department_id WHERE e.id=?
  `).get(employee_id) as any;
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const salary = db.prepare("SELECT * FROM hr_salaries WHERE employee_id=? AND month=?").get(employee_id, month) as any;
  const mealDeductions = db.prepare(`
    SELECT * FROM meal_deductions WHERE employee_id=? AND strftime('%Y-%m', created_at)=?
    ORDER BY created_at ASC
  `).all(employee_id, month) as any[];
  const mealTotal = mealDeductions.reduce((s: number, m: any) => s + m.amount, 0);
  const attendance = db.prepare(`
    SELECT status, COUNT(*) as count FROM hr_attendance
    WHERE employee_id=? AND strftime('%Y-%m', date)=?
    GROUP BY status
  `).all(employee_id, month) as any[];

  const businessSettings = db.prepare("SELECT key, value FROM settings").all() as any[];
  const settings: Record<string,string> = {};
  businessSettings.forEach((s: any) => { settings[s.key] = s.value; });

  res.json({
    employee: { ...emp, active: Boolean(emp.active) },
    salary: salary ?? null,
    mealDeductions,
    mealTotal,
    attendance,
    settings,
  });
});

/* ── Loans/Advances ── */
router.get("/hr/loans", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT l.*, e.name as employee_name, e.employee_number
    FROM hr_loans l JOIN hr_employees e ON e.id = l.employee_id
    ORDER BY l.request_date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/loans", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, amount, type, request_date, status, repayment_terms, notes } = req.body;
  if (!employee_id || !amount || !request_date) {
    res.status(400).json({ error: "الموظف، المبلغ والتاريخ حقول مطلوبة" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_loans (employee_id, amount, type, request_date, status, repayment_terms, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(employee_id, amount, type ?? 'loan', request_date, status ?? 'approved', repayment_terms ?? null, notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT l.*, e.name as employee_name, e.employee_number FROM hr_loans l
    JOIN hr_employees e ON e.id = l.employee_id WHERE l.id=?
  `).get(r.lastInsertRowid));
});

router.put("/hr/loans/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, amount, type, request_date, status, repayment_terms, notes } = req.body;
  db.prepare(`
    UPDATE hr_loans SET employee_id=?, amount=?, type=?, request_date=?, status=?, repayment_terms=?, notes=?
    WHERE id=?
  `).run(employee_id, amount, type, request_date, status, repayment_terms ?? null, notes ?? null, req.params.id);
  res.json(db.prepare(`
    SELECT l.*, e.name as employee_name, e.employee_number FROM hr_loans l
    JOIN hr_employees e ON e.id = l.employee_id WHERE l.id=?
  `).get(req.params.id));
});

router.delete("/hr/loans/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_loans WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Tools ── */
router.get("/hr/tools", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(db.prepare("SELECT * FROM hr_tools ORDER BY name").all());
});

router.post("/hr/tools", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, serial_number, quantity, available_qty, notes } = req.body;
  if (!name) { res.status(400).json({ error: "اسم الأداة مطلوب" }); return; }
  const r = db.prepare(`
    INSERT INTO hr_tools (name, serial_number, quantity, available_qty, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, serial_number ?? null, quantity ?? 1, available_qty ?? quantity ?? 1, notes ?? null);
  res.status(201).json(db.prepare("SELECT * FROM hr_tools WHERE id=?").get(r.lastInsertRowid));
});

router.put("/hr/tools/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, serial_number, quantity, available_qty, notes } = req.body;
  db.prepare(`
    UPDATE hr_tools SET name=?, serial_number=?, quantity=?, available_qty=?, notes=?
    WHERE id=?
  `).run(name, serial_number ?? null, quantity ?? 1, available_qty ?? 1, notes ?? null, req.params.id);
  res.json(db.prepare("SELECT * FROM hr_tools WHERE id=?").get(req.params.id));
});

router.delete("/hr/tools/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_tools WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Tools Movements ── */
router.get("/hr/tools/movements", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT tm.*, t.name as tool_name, t.serial_number as tool_serial, e.name as employee_name, e.employee_number
    FROM hr_tools_movements tm
    JOIN hr_tools t ON t.id = tm.tool_id
    JOIN hr_employees e ON e.id = tm.employee_id
    ORDER BY tm.date DESC, tm.id DESC
  `).all();
  res.json(rows);
});

router.post("/hr/tools/movements", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { tool_id, employee_id, type, quantity, date, notes } = req.body;
  if (!tool_id || !employee_id || !type || !quantity || !date) {
    res.status(400).json({ error: "جميع الحقول مطلوبة" });
    return;
  }
  
  // Adjust available qty in tools table
  const tool = db.prepare("SELECT * FROM hr_tools WHERE id=?").get(tool_id) as any;
  if (!tool) { res.status(404).json({ error: "الأداة غير موجودة" }); return; }
  
  let newAvail = tool.available_qty;
  if (type === 'out') {
    if (tool.available_qty < quantity) {
      res.status(400).json({ error: "الكمية المتاحة من هذه الأداة غير كافية" });
      return;
    }
    newAvail -= quantity;
  } else if (type === 'in') {
    newAvail += quantity;
    if (newAvail > tool.quantity) newAvail = tool.quantity; // Cap at max
  }
  
  db.prepare("UPDATE hr_tools SET available_qty=? WHERE id=?").run(newAvail, tool_id);
  
  const r = db.prepare(`
    INSERT INTO hr_tools_movements (tool_id, employee_id, type, quantity, date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tool_id, employee_id, type, quantity, date, notes ?? null);
  
  res.status(201).json(db.prepare(`
    SELECT tm.*, t.name as tool_name, t.serial_number as tool_serial, e.name as employee_name FROM hr_tools_movements tm
    JOIN hr_tools t ON t.id = tm.tool_id
    JOIN hr_employees e ON e.id = tm.employee_id
    WHERE tm.id=?
  `).get(r.lastInsertRowid));
});

/* ── Entitlements ── */
router.get("/hr/entitlements", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT en.*, e.name as employee_name, e.employee_number
    FROM hr_entitlements en JOIN hr_employees e ON e.id = en.employee_id
    ORDER BY en.date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/entitlements", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, type, amount, date, notes } = req.body;
  if (!employee_id || !type || !amount || !date) {
    res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_entitlements (employee_id, type, amount, date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(employee_id, type, amount, date, notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT en.*, e.name as employee_name FROM hr_entitlements en
    JOIN hr_employees e ON e.id = en.employee_id WHERE en.id=?
  `).get(r.lastInsertRowid));
});

router.delete("/hr/entitlements/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_entitlements WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Leaves ── */
router.get("/hr/leaves", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT l.*, e.name as employee_name, e.employee_number
    FROM hr_leaves l JOIN hr_employees e ON e.id = l.employee_id
    ORDER BY l.start_date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/leaves", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, start_date, end_date, type, status, notes } = req.body;
  if (!employee_id || !start_date || !end_date || !type) {
    res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_leaves (employee_id, start_date, end_date, type, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, start_date, end_date, type, status ?? 'approved', notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT l.*, e.name as employee_name FROM hr_leaves l
    JOIN hr_employees e ON e.id = l.employee_id WHERE l.id=?
  `).get(r.lastInsertRowid));
});

router.put("/hr/leaves/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, start_date, end_date, type, status, notes } = req.body;
  db.prepare(`
    UPDATE hr_leaves SET employee_id=?, start_date=?, end_date=?, type=?, status=?, notes=?
    WHERE id=?
  `).run(employee_id, start_date, end_date, type, status, notes ?? null, req.params.id);
  res.json(db.prepare(`
    SELECT l.*, e.name as employee_name FROM hr_leaves l
    JOIN hr_employees e ON e.id = l.employee_id WHERE l.id=?
  `).get(req.params.id));
});

router.delete("/hr/leaves/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_leaves WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Custodies ── */
router.get("/hr/custodies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT c.*, e.name as employee_name, e.employee_number
    FROM hr_custodies c JOIN hr_employees e ON e.id = c.employee_id
    ORDER BY c.received_date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/custodies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, item_name, received_date, returned_date, status, notes } = req.body;
  if (!employee_id || !item_name || !received_date) {
    res.status(400).json({ error: "اسم العهدة والموظف وتاريخ الاستلام حقول مطلوبة" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_custodies (employee_id, item_name, received_date, returned_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, item_name, received_date, returned_date ?? null, status ?? 'held', notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT c.*, e.name as employee_name FROM hr_custodies c
    JOIN hr_employees e ON e.id = c.employee_id WHERE c.id=?
  `).get(r.lastInsertRowid));
});

router.put("/hr/custodies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, item_name, received_date, returned_date, status, notes } = req.body;
  db.prepare(`
    UPDATE hr_custodies SET employee_id=?, item_name=?, received_date=?, returned_date=?, status=?, notes=?
    WHERE id=?
  `).run(employee_id, item_name, received_date, returned_date ?? null, status, notes ?? null, req.params.id);
  res.json(db.prepare(`
    SELECT c.*, e.name as employee_name FROM hr_custodies c
    JOIN hr_employees e ON e.id = c.employee_id WHERE c.id=?
  `).get(req.params.id));
});

router.delete("/hr/custodies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_custodies WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Penalties ── */
router.get("/hr/penalties", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT p.*, e.name as employee_name, e.employee_number
    FROM hr_penalties p JOIN hr_employees e ON e.id = p.employee_id
    ORDER BY p.date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/penalties", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, violation_name, amount, date, notes } = req.body;
  if (!employee_id || !violation_name || !amount || !date) {
    res.status(400).json({ error: "جميع الحقول مطلوبة" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO hr_penalties (employee_id, violation_name, amount, date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(employee_id, violation_name, amount, date, notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT p.*, e.name as employee_name FROM hr_penalties p
    JOIN hr_employees e ON e.id = p.employee_id WHERE p.id=?
  `).get(r.lastInsertRowid));
});

router.delete("/hr/penalties/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_penalties WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Overtime ── */
router.get("/hr/overtime", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT o.*, e.name as employee_name, e.employee_number
    FROM hr_overtime o JOIN hr_employees e ON e.id = o.employee_id
    ORDER BY o.date DESC
  `).all();
  res.json(rows);
});

router.post("/hr/overtime", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, hours, rate, date, notes } = req.body;
  if (!employee_id || !hours || !rate || !date) {
    res.status(400).json({ error: "جميع الحقول مطلوبة" });
    return;
  }
  const total = Number(hours) * Number(rate);
  const r = db.prepare(`
    INSERT INTO hr_overtime (employee_id, hours, rate, total_amount, date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employee_id, hours, rate, total, date, notes ?? null);
  res.status(201).json(db.prepare(`
    SELECT o.*, e.name as employee_name FROM hr_overtime o
    JOIN hr_employees e ON e.id = o.employee_id WHERE o.id=?
  `).get(r.lastInsertRowid));
});

router.delete("/hr/overtime/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_overtime WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Temporary Employees ── */
router.get("/hr/temp-employees", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(db.prepare("SELECT * FROM hr_temp_employees ORDER BY name").all());
});

router.post("/hr/temp-employees", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, phone, position, daily_rate, hire_date, active } = req.body;
  if (!name) { res.status(400).json({ error: "الاسم مطلوب" }); return; }
  const r = db.prepare(`
    INSERT INTO hr_temp_employees (name, phone, position, daily_rate, hire_date, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, phone ?? null, position ?? null, daily_rate ?? 0, hire_date ?? null, active !== false ? 1 : 0);
  res.status(201).json(db.prepare("SELECT * FROM hr_temp_employees WHERE id=?").get(r.lastInsertRowid));
});

router.put("/hr/temp-employees/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, phone, position, daily_rate, hire_date, active } = req.body;
  db.prepare(`
    UPDATE hr_temp_employees SET name=?, phone=?, position=?, daily_rate=?, hire_date=?, active=?
    WHERE id=?
  `).run(name, phone ?? null, position ?? null, daily_rate ?? 0, hire_date ?? null, active !== false ? 1 : 0, req.params.id);
  res.json(db.prepare("SELECT * FROM hr_temp_employees WHERE id=?").get(req.params.id));
});

router.delete("/hr/temp-employees/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_temp_employees WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Department Notes ── */
router.get("/hr/notes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`
    SELECT n.*, d.name as department_name
    FROM hr_notes n LEFT JOIN hr_departments d ON d.id = n.department_id
    ORDER BY n.created_at DESC
  `).all();
  res.json(rows);
});

router.post("/hr/notes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { department_id, title, content } = req.body;
  if (!title) { res.status(400).json({ error: "العنوان مطلوب" }); return; }
  const r = db.prepare(`
    INSERT INTO hr_notes (department_id, title, content)
    VALUES (?, ?, ?)
  `).run(department_id ?? null, title, content ?? null);
  res.status(201).json(db.prepare(`
    SELECT n.*, d.name as department_name FROM hr_notes n
    LEFT JOIN hr_departments d ON d.id = n.department_id WHERE n.id=?
  `).get(r.lastInsertRowid));
});

router.delete("/hr/notes/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("DELETE FROM hr_notes WHERE id=?").run(req.params.id);
  res.status(204).send();
});

/* ── Monthly Closure / Payroll Posting ── */
router.post("/hr/monthly-close/preview", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { month } = req.body;
  if (!month) { res.status(400).json({ error: "الشهر مطلوب" }); return; }

  try {
    const employees = db.prepare("SELECT e.*, d.name as department_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id=e.department_id WHERE e.active=1").all() as any[];
    const preview = [];

    for (const emp of employees) {
      const overtime = db.prepare("SELECT SUM(total_amount) as total FROM hr_overtime WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
      const entitlements = db.prepare("SELECT SUM(amount) as total FROM hr_entitlements WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
      const bonuses = (overtime?.total ?? 0) + (entitlements?.total ?? 0);

      const meals = db.prepare("SELECT SUM(amount) as total FROM meal_deductions WHERE employee_id=? AND strftime('%Y-%m', created_at)=?").get(emp.id, month) as any;
      const penalties = db.prepare("SELECT SUM(amount) as total FROM hr_penalties WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
      const loans = db.prepare("SELECT SUM(amount) as total FROM hr_loans WHERE employee_id=? AND strftime('%Y-%m', request_date)=? AND status='approved'").get(emp.id, month) as any;

      const absences = db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id=? AND strftime('%Y-%m', date)=? AND status='absent'").get(emp.id, month) as any;
      const lates = db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id=? AND strftime('%Y-%m', date)=? AND status='late'").get(emp.id, month) as any;

      const unpaidLeaves = db.prepare(`
        SELECT SUM(CAST(julianday(min(end_date, date(?, '+1 month', '-1 day'))) - julianday(max(start_date, date(?,'-01 day'))) as INTEGER)) as days
        FROM hr_leaves 
        WHERE employee_id=? AND type='unpaid' AND status='approved' 
        AND start_date <= date(?, '+1 month', '-1 day') AND end_date >= date(?, '-01 day')
      `).get(month + '-01', month + '-01', emp.id, month + '-01', month + '-01') as any;

      const dailyRate = (emp.basic_salary || 0) / 30;
      const absenceDeduction = ((absences?.days ?? 0) + (unpaidLeaves?.days ?? 0)) * dailyRate;
      const delayDeduction = (lates?.days ?? 0) * (dailyRate * 0.25);

      const deductions = (meals?.total ?? 0) + (penalties?.total ?? 0) + (loans?.total ?? 0) + absenceDeduction + delayDeduction;
      const net = emp.basic_salary + bonuses - deductions;

      preview.push({
        employee_id: emp.id,
        employee_name: emp.name,
        position: emp.position || emp.department_name || "موظف",
        basic: emp.basic_salary,
        overtime: overtime?.total ?? 0,
        entitlements: entitlements?.total ?? 0,
        bonuses,
        meals: meals?.total ?? 0,
        penalties: penalties?.total ?? 0,
        loans: loans?.total ?? 0,
        absencesDeduction: absenceDeduction,
        delaysDeduction: delayDeduction,
        deductions,
        net
      });
    }

    res.json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/monthly-close", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { month } = req.body;
  if (!month) { res.status(400).json({ error: "الشهر مطلوب" }); return; }
  
  try {
    // Fetch active employees
    const employees = db.prepare("SELECT * FROM hr_employees WHERE active=1").all() as any[];
    
    let addedCount = 0;
    let totalPayrollNet = 0;

    for (const emp of employees) {
      // Check if salary already added
      const existing = db.prepare("SELECT id FROM hr_salaries WHERE employee_id=? AND month=?").get(emp.id, month);
      if (!existing) {
        // Calculate automatically!
        // Add bonuses = total overtime + total daily/monthly entitlements
        const overtime = db.prepare("SELECT SUM(total_amount) as total FROM hr_overtime WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
        const entitlements = db.prepare("SELECT SUM(amount) as total FROM hr_entitlements WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
        const bonuses = (overtime?.total ?? 0) + (entitlements?.total ?? 0);
        
        // Add deductions = total meal deductions + penalties + approved loans for this month + absences
        const meals = db.prepare("SELECT SUM(amount) as total FROM meal_deductions WHERE employee_id=? AND strftime('%Y-%m', created_at)=?").get(emp.id, month) as any;
        const penalties = db.prepare("SELECT SUM(amount) as total FROM hr_penalties WHERE employee_id=? AND strftime('%Y-%m', date)=?").get(emp.id, month) as any;
        const loans = db.prepare("SELECT SUM(amount) as total FROM hr_loans WHERE employee_id=? AND strftime('%Y-%m', request_date)=? AND type='loan' AND status='approved'").get(emp.id, month) as any;
        
        // Calculate absence, delay and unpaid leaves deductions
        const absences = db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id=? AND strftime('%Y-%m', date)=? AND status='absent'").get(emp.id, month) as any;
        const lates = db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id=? AND strftime('%Y-%m', date)=? AND status='late'").get(emp.id, month) as any;
        
        // Count total unpaid leave days in this month
        const unpaidLeaves = db.prepare(`
          SELECT SUM(CAST(julianday(min(end_date, date(?, '+1 month', '-1 day'))) - julianday(max(start_date, date(?,'-01 day'))) as INTEGER)) as days
          FROM hr_leaves 
          WHERE employee_id=? AND type='unpaid' AND status='approved' 
          AND start_date <= date(?, '+1 month', '-1 day') AND end_date >= date(?, '-01 day')
        `).get(month + '-01', month + '-01', emp.id, month + '-01', month + '-01') as any;

        const dailyRate = (emp.basic_salary || 0) / 30;
        const absenceDeduction = ((absences?.days ?? 0) + (unpaidLeaves?.days ?? 0)) * dailyRate;
        const delayDeduction = (lates?.days ?? 0) * (dailyRate * 0.25);

        const deductions = (meals?.total ?? 0) + (penalties?.total ?? 0) + (loans?.total ?? 0) + absenceDeduction + delayDeduction;

        
        const net = emp.basic_salary + bonuses - deductions;
        
        db.prepare(`
          INSERT INTO hr_salaries (employee_id, month, basic_salary, bonuses, deductions, net_salary, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).run(emp.id, month, emp.basic_salary, bonuses, deductions, net);
        addedCount++;
        totalPayrollNet += net;
      }
    }
    
    // Automate general ledger journal entry for the salaries
    if (totalPayrollNet > 0) {
      try {
        createDoubleEntryJournal(
          getBusinessDate("hr"),
          `قيد استحقاق رواتب شهر ${month} - ترحيل مسير رواتب تلقائي`,
          "payroll",
          addedCount, // ref id is count of employees processed
          [
            { account_code: "61000", debit: totalPayrollNet, credit: 0, description: `مصروف الرواتب والأجور لشهر ${month}` },
            { account_code: "21400", debit: 0, credit: totalPayrollNet, description: `إجمالي رواتب وأجور مستحقة لشهر ${month}` }
          ]
        );
      } catch (journalErr: any) {
        console.error("Failed to auto-generate payroll journal entry:", journalErr.message);
      }
    }

    res.json({ success: true, message: `تم ترحيل رواتب الشهر لعدد ${addedCount} موظف بنجاح وتوليد القيد المحاسبي لرواتب بقيمة ${totalPayrollNet}` });
  } catch (err: any) {
    res.status(500).json({ error: "فشل ترحيل الرواتب وإغلاق الشهر: " + err.message });
  }
});

/* ── HR Reports: Detailed Employee Financial Statement ── */
router.get("/hr/reports/statement", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { employee_id, month } = req.query as { employee_id?: string; month?: string };
    if (!employee_id) {
      res.status(400).json({ error: "معرف الموظف مطلوب" });
      return;
    }

    const currentMonth = month || new Date().toISOString().slice(0, 7);

    // 1. Employee Data
    const emp = db.prepare(`
      SELECT e.*, d.name as department_name 
      FROM hr_employees e 
      LEFT JOIN hr_departments d ON d.id = e.department_id 
      WHERE e.id = ?
    `).get(employee_id) as any;

    if (!emp) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }

    // 2. Overtime for given month
    const overtime = db.prepare(`
      SELECT id, employee_id, hours, rate, total_amount, date, notes 
      FROM hr_overtime 
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date DESC
    `).all(employee_id, currentMonth) as any[];

    // 3. Penalties for given month
    const penalties = db.prepare(`
      SELECT id, employee_id, violation_name, amount, date, notes 
      FROM hr_penalties 
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date DESC
    `).all(employee_id, currentMonth) as any[];

    // 4. Meal Deductions for given month
    const meals = db.prepare(`
      SELECT id, employee_id, amount, order_id, invoice_number, cashier_name, notes, created_at 
      FROM meal_deductions 
      WHERE employee_id = ? AND strftime('%Y-%m', created_at) = ?
      ORDER BY created_at DESC
    `).all(employee_id, currentMonth) as any[];
    const mealsTotal = meals.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);

    // 5. Loans / Advances (active or requested in month)
    const loans = db.prepare(`
      SELECT id, employee_id, amount, type, request_date, status, repayment_terms, notes 
      FROM hr_loans 
      WHERE employee_id = ? AND (strftime('%Y-%m', request_date) = ? OR status = 'approved')
      ORDER BY request_date DESC
    `).all(employee_id, currentMonth) as any[];

    // 6. Entitlements / Allowances for month
    const entitlements = db.prepare(`
      SELECT id, employee_id, type, amount, date, notes 
      FROM hr_entitlements 
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date DESC
    `).all(employee_id, currentMonth) as any[];

    // 7. Leaves in month
    const leaves = db.prepare(`
      SELECT id, employee_id, type, start_date, end_date, status, notes 
      FROM hr_leaves 
      WHERE employee_id = ? AND (strftime('%Y-%m', start_date) = ? OR strftime('%Y-%m', end_date) = ?)
      ORDER BY start_date DESC
    `).all(employee_id, currentMonth, currentMonth) as any[];

    // 8. Attendance summary & records for month
    const attendance = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM hr_attendance 
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      GROUP BY status
    `).all(employee_id, currentMonth) as any[];

    const attendanceRecords = db.prepare(`
      SELECT id, date, status, check_in, check_out, notes
      FROM hr_attendance
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date ASC
    `).all(employee_id, currentMonth) as any[];

    // 9. Processed Salary Record (if any)
    const salary = db.prepare(`
      SELECT * FROM hr_salaries 
      WHERE employee_id = ? AND month = ?
    `).get(employee_id, currentMonth) as any;

    // 10. Custodies
    const custodies = db.prepare(`
      SELECT id, employee_id, item_name, received_date, returned_date, status, notes 
      FROM hr_custodies 
      WHERE employee_id = ?
      ORDER BY received_date DESC
    `).all(employee_id) as any[];

    // 11. Manual Ledger Entries for employee for the given month
    const manualEntries = db.prepare(`
      SELECT id, entry_date, description, debit, credit, notes, created_at 
      FROM manual_ledger_entries 
      WHERE (party_type = 'employee' OR party_type = 'user') AND party_id = ? AND strftime('%Y-%m', entry_date) = ?
      ORDER BY entry_date DESC
    `).all(employee_id, currentMonth) as any[];

    // 12. Vouchers paid/received for employee for given month
    const vouchers = db.prepare(`
      SELECT id, voucher_number, type, amount, payment_method, created_at, payment_against, notes, currency
      FROM vouchers
      WHERE party_type = 'employee' AND party_id = ? AND strftime('%Y-%m', created_at) = ?
      ORDER BY created_at DESC
    `).all(employee_id, currentMonth) as any[];

    const basicSalary = Number(emp.basic_salary) || 0;
    const overtimeTotal = overtime.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const penaltiesTotal = penalties.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const entitlementsTotal = entitlements.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const loansTotal = loans.filter((l: any) => (l.type === 'loan' || l.type === 'temporary') && (l.status === 'approved' || l.status === 'active')).reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);

    const manualDebitTotal = manualEntries.reduce((sum: number, me: any) => sum + (Number(me.debit) || 0), 0);
    const manualCreditTotal = manualEntries.reduce((sum: number, me: any) => sum + (Number(me.credit) || 0), 0);
    const manualEntriesTotal = manualDebitTotal - manualCreditTotal;

    const paidVouchersTotal = vouchers
      .filter((v: any) => v.type === 'payment')
      .reduce((sum: number, v: any) => sum + (Number(v.amount) || 0), 0);
    const receivedVouchersTotal = vouchers
      .filter((v: any) => v.type === 'receipt')
      .reduce((sum: number, v: any) => sum + (Number(v.amount) || 0), 0);
    const netVouchersPaid = paidVouchersTotal - receivedVouchersTotal;

    const absencesCount = attendance
      .filter((a: any) => a.status === 'absent')
      .reduce((sum: number, a: any) => sum + (Number(a.count) || 0), 0);
    const latesCount = attendance
      .filter((a: any) => a.status === 'late')
      .reduce((sum: number, a: any) => sum + (Number(a.count) || 0), 0);
    
    // Count unpaid leaves
    const unpaidLeavesDays = leaves.filter((l: any) => l.type === 'unpaid' && l.status === 'approved').reduce((sum: number, l: any) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + diffDays;
    }, 0);

    const dailyRate = basicSalary / 30;
    const absencesTotal = (absencesCount + unpaidLeavesDays) * dailyRate;
    const latesTotal = latesCount * (dailyRate * 0.25);

    const netCalculated = basicSalary + overtimeTotal + entitlementsTotal - penaltiesTotal - mealsTotal - loansTotal - absencesTotal - latesTotal - manualEntriesTotal;
    const remainingToPay = netCalculated - netVouchersPaid;

    res.json({
      employee: {
        ...emp,
        basic_salary: basicSalary,
        active: Boolean(emp.active)
      },
      month: currentMonth,
      overtime: overtime || [],
      overtimeTotal,
      penalties: penalties || [],
      penaltiesTotal,
      meals: meals || [],
      mealsTotal,
      loans: loans || [],
      loansTotal,
      manualEntries: manualEntries || [],
      manualEntriesTotal,
      vouchers: vouchers || [],
      paidVouchersTotal,
      receivedVouchersTotal,
      netVouchersPaid,
      remainingToPay,
      absencesTotal,
      absencesCount,
      latesTotal,
      latesCount,
      entitlements: entitlements || [],
      entitlementsTotal,
      leaves: leaves || [],
      attendance: attendance || [],
      attendanceRecords: attendanceRecords || [],
      custodies: custodies || [],
      salary: salary || null,
      netSalary: netCalculated,
    });
  } catch (err: any) {
    console.error("Error generating HR statement:", err);
    res.status(500).json({ error: "فشل في توليد كشف الحساب: " + err.message });
  }
});

/* ── Summary ── */
router.get("/hr/summary", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const totalEmployees = (db.prepare("SELECT COUNT(*) as c FROM hr_employees WHERE active=1").get() as any).c;
  const totalDepts = (db.prepare("SELECT COUNT(*) as c FROM hr_departments").get() as any).c;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const salariesThisMonth = db.prepare(`
    SELECT COALESCE(SUM(net_salary),0) as total, COUNT(*) as count,
           SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count
    FROM hr_salaries WHERE month=?
  `).get(currentMonth) as any;
  const todayAttendance = db.prepare(`
    SELECT COUNT(*) as present FROM hr_attendance
    WHERE date=? AND status='present'
  `).get(getBusinessDate("hr")) as any;
  res.json({
    totalEmployees,
    totalDepts,
    currentMonthSalaries: salariesThisMonth.total,
    currentMonthSalaryCount: salariesThisMonth.count,
    paidSalaries: salariesThisMonth.paid_count,
    todayPresent: todayAttendance.present,
  });
});

/* ── End of Service (تصفية نهاية الخدمة) ── */
router.post("/hr/end-of-service", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { employee_id, end_date, reason, notes } = req.body;
  if (!employee_id || !end_date) {
    res.status(400).json({ error: "معرف الموظف وتاريخ نهاية الخدمة مطلوبان" });
    return;
  }
  
  try {
    const emp = db.prepare("SELECT * FROM hr_employees WHERE id=?").get(employee_id) as any;
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

    // Calculate years of service
    const hireDate = new Date(emp.hire_date || new Date());
    const endDate = new Date(end_date);
    const diffTime = Math.abs(endDate.getTime() - hireDate.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    // Saudi Labor Law (simplified): Half month for first 5 years, one month for subsequent years
    let eosAmount = 0;
    const basicSalary = Number(emp.basic_salary) || 0;
    
    if (diffYears <= 5) {
      eosAmount = diffYears * (basicSalary / 2);
    } else {
      eosAmount = (5 * (basicSalary / 2)) + ((diffYears - 5) * basicSalary);
    }

    if (reason === "resignation" && diffYears < 2) {
      eosAmount = 0;
    } else if (reason === "resignation" && diffYears >= 2 && diffYears < 5) {
      eosAmount = eosAmount / 3;
    } else if (reason === "resignation" && diffYears >= 5 && diffYears < 10) {
      eosAmount = eosAmount * (2/3);
    }

    db.prepare("UPDATE hr_employees SET active = 0 WHERE id = ?").run(employee_id);

    // Save as an entitlement or manual record. We'll add it as an entitlement for record keeping.
    db.prepare(`
      INSERT INTO hr_entitlements (employee_id, type, amount, date, notes)
      VALUES (?, 'monthly', ?, ?, ?)
    `).run(employee_id, eosAmount, end_date, `مكافأة نهاية الخدمة - ${reason}: ${notes || ''}`);

    res.json({
      success: true,
      employee_id,
      years_of_service: diffYears.toFixed(2),
      eos_amount: eosAmount,
      message: "تم تصفية الموظف وحساب مكافأة نهاية الخدمة بنجاح وإيقاف حسابه."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
