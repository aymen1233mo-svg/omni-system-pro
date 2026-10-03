import { Router } from "express";
import { db, createDoubleEntryJournal } from "../lib/sqlite";
import { getEmployeeSubAccountCode, recordSafeOrBankMovement } from "../lib/erp-accounting-sync";
import { getBusinessDate } from "../lib/business-day";

const router = Router();

function syncEmployeeAccountAndBalance(employeeId: number) {
  try {
    const emp = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(employeeId) as any;
    if (!emp) return "21400";
    const code = getEmployeeSubAccountCode(db, employeeId, emp.name);
    const pendingSal = (db.prepare("SELECT COALESCE(SUM(net_salary), 0) as s FROM hr_salaries WHERE employee_id = ? AND status != 'paid'").get(employeeId) as any)?.s ?? 0;
    const jlBalRes = db.prepare("SELECT COALESCE(SUM(credit - debit), 0) as s, COUNT(*) as c FROM journal_entry_lines WHERE account_code = ? OR account_id IN (SELECT id FROM accounts WHERE code = ?)").get(code, code) as any;
    const hasJournalLines = jlBalRes && jlBalRes.c > 0;
    const bal = hasJournalLines ? Math.round(Number(jlBalRes.s || 0) * 100) / 100 : (Number(emp.balance || 0) !== 0 ? Number(emp.balance) : Math.round(Number(pendingSal) * 100) / 100);

    db.prepare("UPDATE hr_employees SET balance = ?, account_code = ? WHERE id = ?").run(bal, code, employeeId);
    db.prepare("UPDATE accounts SET balance = ? WHERE code = ?").run(bal, code);
    const totalEmpBal = (db.prepare("SELECT COALESCE(SUM(balance), 0) as s FROM accounts WHERE parent_code = '21400'").get() as any)?.s ?? 0;
    db.prepare("UPDATE accounts SET balance = ? WHERE code = '21400'").run(Number(totalEmpBal));
    return code;
  } catch (e) {
    console.warn("syncEmployeeAccountAndBalance warning:", e);
    return "21400";
  }
}

// ==================== DEPARTMENTS ====================
router.get("/hr/departments", (req, res) => {
  try {
    const depts = db.prepare("SELECT * FROM hr_departments ORDER BY name").all();
    res.json(depts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/departments", (req, res) => {
  try {
    const { name, budget } = req.body;
    if (!name) return res.status(400).json({ error: "اسم القسم مطلوب" });
    const r = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?, ?)").run(name, Number(budget) || 0);
    const created = db.prepare("SELECT * FROM hr_departments WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/departments/:id", (req, res) => {
  try {
    const { name, budget } = req.body;
    db.prepare("UPDATE hr_departments SET name = COALESCE(?, name), budget = COALESCE(?, budget) WHERE id = ?")
      .run(name ?? null, budget !== undefined ? Number(budget) : null, req.params.id);
    const updated = db.prepare("SELECT * FROM hr_departments WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/departments/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_departments WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EMPLOYEES ====================
router.get(["/employees", "/hr/employees"], (req, res) => {
  try {
    const { search, role, department_id } = req.query;
    let sql = `
      SELECT e.*, d.name as department_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (role) {
      sql += " AND e.position = ?";
      params.push(role);
    }
    if (department_id) {
      sql += " AND e.department_id = ?";
      params.push(department_id);
    }
    if (search) {
      sql += " AND (e.name LIKE ? OR e.phone LIKE ? OR e.employee_number LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY CAST(e.employee_number AS INTEGER) ASC, e.id ASC";
    const rows = db.prepare(sql).all(...params) as any[];
    res.json(rows.map(e => ({ ...e, active: Boolean(e.active) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getNextSequentialEmployeeNumber(): string {
  const rows = db.prepare("SELECT employee_number FROM hr_employees").all() as { employee_number: string }[];
  const used = new Set<number>();
  for (const r of rows) {
    const n = parseInt(String(r.employee_number || "").trim(), 10);
    if (!isNaN(n) && n > 0 && String(n) === String(r.employee_number || "").trim()) {
      used.add(n);
    }
  }
  let candidate = 1;
  while (used.has(candidate)) {
    candidate++;
  }
  return String(candidate);
}

router.post(["/employees", "/hr/employees"], (req, res) => {
  try {
    let { 
      employee_number, 
      name, 
      phone, 
      position, 
      role, 
      department_id, 
      basic_salary, 
      salary, 
      base_salary, 
      hire_date, 
      joinDate, 
      active,
      branch_id,
      job_title,
      commission_rate,
      commission_basis,
      sales_target
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "اسم الموظف مطلوب" });
    }

    const pos = position || role || "موظف";
    const sal = Number(basic_salary ?? salary ?? base_salary ?? 0) || 0;
    const hDate = hire_date || joinDate || new Date().toISOString().slice(0, 10);
    const isActive = active !== undefined ? (active ? 1 : 0) : 1;

    // Handle department_id: if string is department name, create or get it
    let deptId: number | null = null;
    if (department_id !== undefined && department_id !== null && department_id !== "") {
      if (!isNaN(Number(department_id))) {
        deptId = Number(department_id);
      } else {
        const deptName = String(department_id).trim();
        let existingDept = db.prepare("SELECT id FROM hr_departments WHERE name = ?").get(deptName) as any;
        if (!existingDept) {
          const insertDept = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?, 0)").run(deptName);
          deptId = Number(insertDept.lastInsertRowid);
        } else {
          deptId = existingDept.id;
        }
      }
    }

    // Auto-generate sequential integer employee_number (1, 2, 3...) if not provided or not a valid positive integer
    let empNum = employee_number ? String(employee_number).trim() : "";
    if (!/^[1-9]\d*$/.test(empNum)) {
      empNum = getNextSequentialEmployeeNumber();
    } else {
      const existing = db.prepare("SELECT id FROM hr_employees WHERE employee_number = ?").get(empNum);
      if (existing) {
        empNum = getNextSequentialEmployeeNumber();
      }
    }

    const r = db.prepare(`
      INSERT INTO hr_employees (
        employee_number, name, phone, position, department_id, basic_salary, hire_date, active,
        branch_id, job_title, commission_rate, commission_basis, sales_target
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empNum,
      String(name).trim(),
      phone || null,
      pos,
      deptId,
      sal,
      hDate,
      isActive,
      branch_id ? Number(branch_id) : 1,
      job_title || pos,
      commission_rate !== undefined ? Number(commission_rate) : 5.0,
      commission_basis || "sales_value",
      sales_target !== undefined ? Number(sales_target) : 50000.0
    );

    const newEmpId = Number(r.lastInsertRowid);
    syncEmployeeAccountAndBalance(newEmpId);

    // Post-employee creation cleanup: if a customer with the same name exists, delete it and remap its account
    try {
      const empName = String(name).trim();
      const empCode = `214${String(newEmpId).padStart(2, "0")}`;
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
      console.warn("Failed to auto-cleanup customer on employee add in employees.ts:", e);
    }

    const created = db.prepare(`
      SELECT e.*, d.name as department_name 
      FROM hr_employees e 
      LEFT JOIN hr_departments d ON d.id = e.department_id 
      WHERE e.id = ?
    `).get(newEmpId);

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get(["/employees/:id", "/hr/employees/:id"], (req, res) => {
  try {
    const emp = db.prepare(`
      SELECT e.*, d.name as department_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    res.json(emp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleUpdateEmployee = (req: any, res: any) => {
  try {
    const { 
      employee_number, 
      name, 
      phone, 
      position, 
      role, 
      department_id, 
      basic_salary, 
      salary, 
      base_salary, 
      hire_date, 
      joinDate, 
      active, 
      isActive,
      branch_id,
      job_title,
      commission_rate,
      commission_basis,
      sales_target
    } = req.body;

    const emp = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(req.params.id) as any;
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

    let deptId = emp.department_id;
    if (department_id !== undefined) {
      if (department_id === null || department_id === "") {
        deptId = null;
      } else if (!isNaN(Number(department_id))) {
        deptId = Number(department_id);
      } else {
        const deptName = String(department_id).trim();
        let existingDept = db.prepare("SELECT id FROM hr_departments WHERE name = ?").get(deptName) as any;
        if (!existingDept) {
          const insertDept = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?, 0)").run(deptName);
          deptId = Number(insertDept.lastInsertRowid);
        } else {
          deptId = existingDept.id;
        }
      }
    }

    const sal = (basic_salary !== undefined ? Number(basic_salary) : (salary !== undefined ? Number(salary) : (base_salary !== undefined ? Number(base_salary) : emp.basic_salary)));
    const activeVal = (active !== undefined ? (active ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : emp.active));

    let cleanEmpNum: string | null = null;
    if (employee_number !== undefined && employee_number !== null) {
      const candidate = String(employee_number).trim();
      if (/^[1-9]\d*$/.test(candidate)) {
        const conflict = db.prepare("SELECT id FROM hr_employees WHERE employee_number = ? AND id != ?").get(candidate, req.params.id);
        if (!conflict) {
          cleanEmpNum = candidate;
        }
      }
    }

    db.prepare(`
      UPDATE hr_employees
      SET employee_number = COALESCE(?, employee_number),
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          position = COALESCE(?, position),
          department_id = ?,
          basic_salary = COALESCE(?, basic_salary),
          hire_date = COALESCE(?, hire_date),
          active = COALESCE(?, active),
          branch_id = COALESCE(?, branch_id),
          job_title = COALESCE(?, job_title),
          commission_rate = COALESCE(?, commission_rate),
          commission_basis = COALESCE(?, commission_basis),
          sales_target = COALESCE(?, sales_target)
      WHERE id = ?
    `).run(
      cleanEmpNum,
      name ?? null,
      phone ?? null,
      position || role || null,
      deptId,
      sal,
      hire_date || joinDate || null,
      activeVal,
      branch_id !== undefined ? Number(branch_id) : null,
      job_title || null,
      commission_rate !== undefined ? Number(commission_rate) : null,
      commission_basis || null,
      sales_target !== undefined ? Number(sales_target) : null,
      req.params.id
    );

    syncEmployeeAccountAndBalance(Number(req.params.id));

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
      console.warn("Failed to auto-cleanup customer on employee update in employees.ts:", e);
    }

    const updated = db.prepare(`
      SELECT e.*, d.name as department_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE e.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

router.patch(["/employees/:id", "/hr/employees/:id"], handleUpdateEmployee);
router.put(["/employees/:id", "/hr/employees/:id"], handleUpdateEmployee);

router.delete(["/employees/:id", "/hr/employees/:id"], (req, res) => {
  try {
    db.prepare("DELETE FROM hr_employees WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SALARIES ====================
router.get("/hr/salaries", (req, res) => {
  try {
    const { month, employee_id } = req.query;
    let sql = `
      SELECT s.*, e.name as employee_name, e.employee_number, d.name as department_name
      FROM hr_salaries s
      JOIN hr_employees e ON e.id = s.employee_id
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (month) {
      sql += " AND s.month = ?";
      params.push(month);
    }
    if (employee_id) {
      sql += " AND s.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY s.id DESC";
    const salaries = db.prepare(sql).all(...params);
    res.json(salaries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/salaries", (req, res) => {
  try {
    const { employee_id, month, basic_salary, bonuses, deductions, status, payment_date, payment_method, safe_id, notes } = req.body;
    const empId = Number(employee_id);
    const emp = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(empId) as any;
    const bSal = basic_salary !== undefined ? Number(basic_salary) : Number(emp?.basic_salary || 0);
    const bon = Number(bonuses) || 0;
    const ded = Number(deductions) || 0;
    const net = Math.round((bSal + bon - ded) * 100) / 100;
    const salStatus = status || "pending";
    const payDate = salStatus === "paid" ? (payment_date || getBusinessDate("hr")) : (payment_date || null);

    const r = db.prepare(`
      INSERT INTO hr_salaries (employee_id, month, basic_salary, bonuses, deductions, net_salary, status, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(empId, month, bSal, bon, ded, net, salStatus, payDate, notes || null);

    const salaryId = Number(r.lastInsertRowid);
    const empAccCode = syncEmployeeAccountAndBalance(empId);
    const empName = emp?.name || `موظف #${empId}`;

    if (net > 0) {
      try {
        if (salStatus === "paid") {
          const payMethod = payment_method || "cash";
          const cashAcc = (payMethod === "bank" || payMethod === "card") ? "11200" : "11100";
          createDoubleEntryJournal(
            payDate || getBusinessDate("hr"),
            `احتساب وصرف راتب شهر ${month} للموظف ${empName}`,
            "payroll",
            salaryId,
            [
              { account_code: "61000", debit: net, credit: 0, description: `إثبات مصروف راتب شهر ${month} للموظف ${empName}` },
              { account_code: empAccCode, debit: 0, credit: net, description: `استحقاق راتب شهر ${month} بحساب الموظف ${empName} (${empAccCode})` },
              { account_code: empAccCode, debit: net, credit: 0, description: `تسوية وصرف راتب شهر ${month} للموظف ${empName} (${empAccCode})` },
              { account_code: cashAcc, debit: 0, credit: net, description: `صرف راتب شهر ${month} للموظف ${empName}` },
            ]
          );
          recordSafeOrBankMovement(db, {
            type: "out",
            amount: net,
            method: payMethod,
            safeId: safe_id ? Number(safe_id) : 1,
            description: `صرف راتب شهر ${month} للموظف ${empName}`,
            referenceType: "payroll",
            referenceId: salaryId,
          });
        } else {
          createDoubleEntryJournal(
            getBusinessDate("hr"),
            `احتساب استحقاق راتب شهر ${month} للموظف ${empName}`,
            "payroll_accrual",
            salaryId,
            [
              { account_code: "61000", debit: net, credit: 0, description: `إثبات مصروف راتب شهر ${month} للموظف ${empName}` },
              { account_code: empAccCode, debit: 0, credit: net, description: `استحقاق راتب شهر ${month} بحساب الموظف ${empName} (${empAccCode})` },
            ]
          );
        }
      } catch (jvErr: any) {
        console.error("Salary journal creation error:", jvErr.message);
      }
    }

    syncEmployeeAccountAndBalance(empId);
    const created = db.prepare(`
      SELECT s.*, e.name as employee_name, e.employee_number, e.account_code as employee_account_code, e.balance as employee_balance
      FROM hr_salaries s
      JOIN hr_employees e ON e.id = s.employee_id
      WHERE s.id = ?
    `).get(salaryId);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleUpdateOrPaySalary = (req: any, res: any) => {
  try {
    const { basic_salary, bonuses, deductions, status, payment_date, payment_method, safe_id, notes } = req.body;
    const current = db.prepare("SELECT * FROM hr_salaries WHERE id = ?").get(req.params.id) as any;
    if (!current) return res.status(404).json({ error: "مسير الراتب غير موجود" });

    const bSal = basic_salary !== undefined ? Number(basic_salary) : Number(current.basic_salary);
    const bon = bonuses !== undefined ? Number(bonuses) : Number(current.bonuses);
    const ded = deductions !== undefined ? Number(deductions) : Number(current.deductions);
    const net = Math.round((bSal + bon - ded) * 100) / 100;
    const newStatus = status || (req.path.endsWith("/pay") ? "paid" : current.status);
    const payDate = newStatus === "paid" ? (payment_date || current.payment_date || getBusinessDate("hr")) : (payment_date || current.payment_date || null);

    db.prepare(`
      UPDATE hr_salaries
      SET basic_salary = ?, bonuses = ?, deductions = ?, net_salary = ?, status = ?,
          payment_date = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(bSal, bon, ded, net, newStatus, payDate, notes || null, req.params.id);

    const empId = Number(current.employee_id);
    const emp = db.prepare("SELECT * FROM hr_employees WHERE id = ?").get(empId) as any;
    const empAccCode = getEmployeeSubAccountCode(db, empId, emp?.name);
    const empName = emp?.name || `موظف #${empId}`;

    if (current.status !== "paid" && newStatus === "paid" && net > 0) {
      try {
        const payMethod = payment_method || "cash";
        const cashAcc = (payMethod === "bank" || payMethod === "card") ? "11200" : "11100";
        const hasAccrual = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'payroll_accrual' AND source_id = ?").get(current.id) as any;

        if (hasAccrual) {
          createDoubleEntryJournal(
            payDate || getBusinessDate("hr"),
            `صرف راتب شهر ${current.month} للموظف ${empName}`,
            "payroll",
            Number(current.id),
            [
              { account_code: empAccCode, debit: net, credit: 0, description: `تسوية وصرف راتب شهر ${current.month} للموظف ${empName} (${empAccCode})` },
              { account_code: cashAcc, debit: 0, credit: net, description: `صرف راتب شهر ${current.month} للموظف ${empName}` },
            ]
          );
        } else {
          createDoubleEntryJournal(
            payDate || getBusinessDate("hr"),
            `احتساب وصرف راتب شهر ${current.month} للموظف ${empName}`,
            "payroll",
            Number(current.id),
            [
              { account_code: "61000", debit: net, credit: 0, description: `إثبات مصروف راتب شهر ${current.month} للموظف ${empName}` },
              { account_code: empAccCode, debit: 0, credit: net, description: `استحقاق راتب شهر ${current.month} بحساب الموظف ${empName} (${empAccCode})` },
              { account_code: empAccCode, debit: net, credit: 0, description: `تسوية وصرف راتب شهر ${current.month} للموظف ${empName} (${empAccCode})` },
              { account_code: cashAcc, debit: 0, credit: net, description: `صرف راتب شهر ${current.month} للموظف ${empName}` },
            ]
          );
        }

        recordSafeOrBankMovement(db, {
          type: "out",
          amount: net,
          method: payMethod,
          safeId: safe_id ? Number(safe_id) : 1,
          description: `صرف راتب شهر ${current.month} للموظف ${empName}`,
          referenceType: "payroll",
          referenceId: Number(current.id),
        });
      } catch (jvErr: any) {
        console.error("Salary disbursement journal error:", jvErr.message);
      }
    }

    syncEmployeeAccountAndBalance(empId);
    const updated = db.prepare(`
      SELECT s.*, e.name as employee_name, e.employee_number, e.account_code as employee_account_code, e.balance as employee_balance
      FROM hr_salaries s
      JOIN hr_employees e ON e.id = s.employee_id
      WHERE s.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

router.put("/hr/salaries/:id", handleUpdateOrPaySalary);
router.patch("/hr/salaries/:id", handleUpdateOrPaySalary);
router.post("/hr/salaries/:id/pay", handleUpdateOrPaySalary);

router.delete("/hr/salaries/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_salaries WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ATTENDANCE ====================
router.get("/hr/attendance", (req, res) => {
  try {
    const { date, month, employee_id } = req.query;
    let sql = `
      SELECT a.*, e.name as employee_name, e.employee_number, d.name as department_name
      FROM hr_attendance a
      JOIN hr_employees e ON e.id = a.employee_id
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (date) {
      sql += " AND a.date = ?";
      params.push(date);
    }
    if (month) {
      sql += " AND a.date LIKE ?";
      params.push(`${month}%`);
    }
    if (employee_id) {
      sql += " AND a.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY a.date DESC, e.name ASC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/attendance", (req, res) => {
  try {
    const { employee_id, date, check_in, check_out, status, notes } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_attendance (employee_id, date, check_in, check_out, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(employee_id), date, check_in || null, check_out || null, status || 'present', notes || null);
    const created = db.prepare("SELECT * FROM hr_attendance WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/attendance/:id", (req, res) => {
  try {
    const { check_in, check_out, status, notes } = req.body;
    db.prepare(`
      UPDATE hr_attendance
      SET check_in = COALESCE(?, check_in), check_out = COALESCE(?, check_out),
          status = COALESCE(?, status), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(check_in || null, check_out || null, status || null, notes || null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_attendance WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/attendance/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_attendance WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== LOANS ====================
router.get("/hr/loans", (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `
      SELECT l.*, e.name as employee_name, e.employee_number
      FROM hr_loans l
      JOIN hr_employees e ON e.id = l.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employee_id) {
      sql += " AND l.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY l.request_date DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/loans", (req, res) => {
  try {
    const { employee_id, amount, type, request_date, status, repayment_terms, notes, payment_method, safe_id } = req.body;
    const empId = Number(employee_id);
    const amt = Number(amount) || 0;
    const loanStatus = status || "approved";
    const reqDate = request_date || getBusinessDate("hr");
    const r = db.prepare(`
      INSERT INTO hr_loans (employee_id, amount, type, request_date, status, repayment_terms, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(empId, amt, type || "loan", reqDate, loanStatus, repayment_terms || null, notes || null);

    const loanId = Number(r.lastInsertRowid);
    if (loanStatus === "approved" && amt > 0) {
      try {
        const emp = db.prepare("SELECT name FROM hr_employees WHERE id = ?").get(empId) as any;
        const empName = emp?.name || `موظف #${empId}`;
        const payMethod = payment_method || "cash";
        const cashAcc = (payMethod === "bank" || payMethod === "card") ? "11200" : "11100";
        createDoubleEntryJournal(
          reqDate,
          `صرف سلفة مالية للموظف ${empName}`,
          "hr_loan",
          loanId,
          [
            { account_code: "11600", debit: amt, credit: 0, description: `سلفة موظف - ${empName}` },
            { account_code: cashAcc, debit: 0, credit: amt, description: `صرف سلفة للموظف ${empName}` },
          ]
        );
        recordSafeOrBankMovement(db, {
          type: "out",
          amount: amt,
          method: payMethod,
          safeId: safe_id ? Number(safe_id) : 1,
          description: `صرف سلفة للموظف ${empName}`,
          referenceType: "hr_loan",
          referenceId: loanId,
        });
      } catch (e: any) {
        console.warn("Loan journal notice:", e.message);
      }
    }

    res.status(201).json(db.prepare("SELECT * FROM hr_loans WHERE id = ?").get(loanId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/loans/:id", (req, res) => {
  try {
    const { amount, type, request_date, status, repayment_terms, notes } = req.body;
    db.prepare(`
      UPDATE hr_loans
      SET amount = COALESCE(?, amount), type = COALESCE(?, type), request_date = COALESCE(?, request_date),
          status = COALESCE(?, status), repayment_terms = COALESCE(?, repayment_terms), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(amount !== undefined ? Number(amount) : null, type || null, request_date || null, status || null, repayment_terms || null, notes || null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_loans WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/loans/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_loans WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CUSTODIES ====================
router.get("/hr/custodies", (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `
      SELECT c.*, e.name as employee_name, e.employee_number
      FROM hr_custodies c
      JOIN hr_employees e ON e.id = c.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employee_id) {
      sql += " AND c.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY c.received_date DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/custodies", (req, res) => {
  try {
    const { employee_id, item_name, received_date, returned_date, status, notes } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_custodies (employee_id, item_name, received_date, returned_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(employee_id), item_name, received_date || new Date().toISOString().slice(0, 10), returned_date || null, status || 'held', notes || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_custodies WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/custodies/:id", (req, res) => {
  try {
    const { item_name, received_date, returned_date, status, notes } = req.body;
    db.prepare(`
      UPDATE hr_custodies
      SET item_name = COALESCE(?, item_name), received_date = COALESCE(?, received_date),
          returned_date = ?, status = COALESCE(?, status), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(item_name || null, received_date || null, returned_date || null, status || null, notes || null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_custodies WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/custodies/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_custodies WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== LEAVES ====================
router.get("/hr/leaves", (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `
      SELECT l.*, e.name as employee_name, e.employee_number
      FROM hr_leaves l
      JOIN hr_employees e ON e.id = l.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employee_id) {
      sql += " AND l.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY l.start_date DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/leaves", (req, res) => {
  try {
    const { employee_id, start_date, end_date, type, status, notes } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_leaves (employee_id, start_date, end_date, type, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(employee_id), start_date, end_date, type || 'annual', status || 'approved', notes || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_leaves WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/leaves/:id", (req, res) => {
  try {
    const { start_date, end_date, type, status, notes } = req.body;
    db.prepare(`
      UPDATE hr_leaves
      SET start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
          type = COALESCE(?, type), status = COALESCE(?, status), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(start_date || null, end_date || null, type || null, status || null, notes || null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_leaves WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/leaves/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_leaves WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PENALTIES ====================
router.get("/hr/penalties", (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `
      SELECT p.*, e.name as employee_name, e.employee_number
      FROM hr_penalties p
      JOIN hr_employees e ON e.id = p.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employee_id) {
      sql += " AND p.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY p.date DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/penalties", (req, res) => {
  try {
    const { employee_id, violation_name, amount, date, notes } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_penalties (employee_id, violation_name, amount, date, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(employee_id), violation_name, Number(amount) || 0, date || getBusinessDate("hr"), notes || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_penalties WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/penalties/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_penalties WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== OVERTIME ====================
router.get("/hr/overtime", (req, res) => {
  try {
    const { employee_id } = req.query;
    let sql = `
      SELECT o.*, e.name as employee_name, e.employee_number
      FROM hr_overtime o
      JOIN hr_employees e ON e.id = o.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employee_id) {
      sql += " AND o.employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY o.date DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/overtime", (req, res) => {
  try {
    const { employee_id, hours, rate, total_amount, date, notes } = req.body;
    const hrs = Number(hours) || 0;
    const rt = Number(rate) || 0;
    const tot = total_amount !== undefined ? Number(total_amount) : (hrs * rt);
    const r = db.prepare(`
      INSERT INTO hr_overtime (employee_id, hours, rate, total_amount, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(employee_id), hrs, rt, tot, date || getBusinessDate("hr"), notes || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_overtime WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/overtime/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_overtime WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TOOLS & MOVEMENTS ====================
router.get("/hr/tools", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM hr_tools ORDER BY name").all());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/tools", (req, res) => {
  try {
    const { name, serial_number, quantity, available_qty, notes } = req.body;
    const qty = Number(quantity) || 1;
    const avail = available_qty !== undefined ? Number(available_qty) : qty;
    const r = db.prepare(`
      INSERT INTO hr_tools (name, serial_number, quantity, available_qty, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, serial_number || null, qty, avail, notes || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_tools WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/tools/:id", (req, res) => {
  try {
    const { name, serial_number, quantity, available_qty, notes } = req.body;
    db.prepare(`
      UPDATE hr_tools
      SET name = COALESCE(?, name), serial_number = COALESCE(?, serial_number),
          quantity = COALESCE(?, quantity), available_qty = COALESCE(?, available_qty), notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name || null, serial_number || null, quantity !== undefined ? Number(quantity) : null, available_qty !== undefined ? Number(available_qty) : null, notes || null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_tools WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/tools/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_tools WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/hr/tools/movements", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT m.*, t.name as tool_name, t.serial_number, e.name as employee_name, e.employee_number
      FROM hr_tools_movements m
      JOIN hr_tools t ON t.id = m.tool_id
      JOIN hr_employees e ON e.id = m.employee_id
      ORDER BY m.date DESC
    `).all();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/tools/movements", (req, res) => {
  try {
    const { tool_id, employee_id, type, quantity, date, notes } = req.body;
    const qty = Number(quantity) || 1;
    const r = db.prepare(`
      INSERT INTO hr_tools_movements (tool_id, employee_id, type, quantity, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(tool_id), Number(employee_id), type || 'out', qty, date || new Date().toISOString().slice(0, 10), notes || null);

    // Update tool available qty
    if (type === 'out') {
      db.prepare("UPDATE hr_tools SET available_qty = MAX(0, available_qty - ?) WHERE id = ?").run(qty, Number(tool_id));
    } else {
      db.prepare("UPDATE hr_tools SET available_qty = available_qty + ? WHERE id = ?").run(qty, Number(tool_id));
    }

    res.status(201).json(db.prepare("SELECT * FROM hr_tools_movements WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TEMP EMPLOYEES ====================
router.get("/hr/temp-employees", (req, res) => {
  try {
    res.json(db.prepare("SELECT * FROM hr_temp_employees ORDER BY name").all());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/temp-employees", (req, res) => {
  try {
    const { name, phone, position, daily_rate, hire_date, active } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_temp_employees (name, phone, position, daily_rate, hire_date, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, phone || null, position || 'موظف مؤقت', Number(daily_rate) || 0, hire_date || getBusinessDate("hr"), active !== undefined ? (active ? 1 : 0) : 1);
    res.status(201).json(db.prepare("SELECT * FROM hr_temp_employees WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/hr/temp-employees/:id", (req, res) => {
  try {
    const { name, phone, position, daily_rate, hire_date, active } = req.body;
    db.prepare(`
      UPDATE hr_temp_employees
      SET name = COALESCE(?, name), phone = COALESCE(?, phone), position = COALESCE(?, position),
          daily_rate = COALESCE(?, daily_rate), hire_date = COALESCE(?, hire_date), active = COALESCE(?, active)
      WHERE id = ?
    `).run(name || null, phone || null, position || null, daily_rate !== undefined ? Number(daily_rate) : null, hire_date || null, active !== undefined ? (active ? 1 : 0) : null, req.params.id);
    res.json(db.prepare("SELECT * FROM hr_temp_employees WHERE id = ?").get(req.params.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/temp-employees/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_temp_employees WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NOTES ====================
router.get("/hr/notes", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT n.*, d.name as department_name
      FROM hr_notes n
      LEFT JOIN hr_departments d ON d.id = n.department_id
      ORDER BY n.created_at DESC
    `).all();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/notes", (req, res) => {
  try {
    const { department_id, title, content } = req.body;
    const r = db.prepare(`
      INSERT INTO hr_notes (department_id, title, content)
      VALUES (?, ?, ?)
    `).run(department_id ? Number(department_id) : null, title, content || null);
    res.status(201).json(db.prepare("SELECT * FROM hr_notes WHERE id = ?").get(r.lastInsertRowid));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hr/notes/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM hr_notes WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MEAL DEDUCTIONS ====================
router.get("/hr/meal-deductions", (req, res) => {
  try {
    const { month, employee_id } = req.query;
    let sql = "SELECT * FROM meal_deductions WHERE 1=1";
    const params: any[] = [];
    if (month) {
      sql += " AND created_at LIKE ?";
      params.push(`${month}%`);
    }
    if (employee_id) {
      sql += " AND employee_id = ?";
      params.push(employee_id);
    }
    sql += " ORDER BY created_at DESC";
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MONTHLY CLOSE ====================
router.post("/hr/monthly-close/preview", (req, res) => {
  try {
    const { month } = req.body;
    const employees = db.prepare("SELECT e.*, d.name as department_name FROM hr_employees e LEFT JOIN hr_departments d ON d.id = e.department_id WHERE e.active = 1").all() as any[];
    const result = employees.map(emp => {
      const basic = Number(emp.basic_salary) || 0;
      const overtime = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM hr_overtime WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const entitlements = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_entitlements WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const bonuses = overtime + entitlements;
      const penalties = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_penalties WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const loans = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_loans WHERE employee_id = ? AND request_date LIKE ? AND status = 'approved'").get(emp.id, `${month}%`) as any).s;
      const meals = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM meal_deductions WHERE employee_id = ? AND created_at LIKE ?").get(emp.id, `${month}%`) as any).s;
      const absences = (db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id = ? AND date LIKE ? AND status = 'absent'").get(emp.id, `${month}%`) as any)?.days ?? 0;
      const lates = (db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id = ? AND date LIKE ? AND status = 'late'").get(emp.id, `${month}%`) as any)?.days ?? 0;
      const dailyRate = basic / 30;
      const absenceDeduction = Math.round((absences * dailyRate) * 100) / 100;
      const delayDeduction = Math.round((lates * dailyRate * 0.25) * 100) / 100;

      const deductions = Math.round((penalties + loans + meals + absenceDeduction + delayDeduction) * 100) / 100;
      const net = Math.round((basic + bonuses - deductions) * 100) / 100;
      return {
        employee_id: emp.id,
        employee_name: emp.name,
        employee_number: emp.employee_number,
        position: emp.position || emp.department_name || "موظف",
        basic,
        basic_salary: basic,
        overtime,
        entitlements,
        bonuses,
        meals,
        penalties,
        loans,
        absencesDeduction: absenceDeduction,
        delaysDeduction: delayDeduction,
        deductions,
        net,
        net_salary: net,
        month
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hr/monthly-close", (req, res) => {
  try {
    const { month } = req.body;
    const employees = db.prepare("SELECT * FROM hr_employees WHERE active = 1").all() as any[];
    let processedCount = 0;
    let totalPayrollNet = 0;

    for (const emp of employees) {
      const basic = Number(emp.basic_salary) || 0;
      const overtime = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM hr_overtime WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const entitlements = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_entitlements WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const bonuses = overtime + entitlements;
      const penalties = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_penalties WHERE employee_id = ? AND date LIKE ?").get(emp.id, `${month}%`) as any).s;
      const loans = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_loans WHERE employee_id = ? AND request_date LIKE ? AND status = 'approved'").get(emp.id, `${month}%`) as any).s;
      const meals = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM meal_deductions WHERE employee_id = ? AND created_at LIKE ?").get(emp.id, `${month}%`) as any).s;
      const absences = (db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id = ? AND date LIKE ? AND status = 'absent'").get(emp.id, `${month}%`) as any)?.days ?? 0;
      const lates = (db.prepare("SELECT COUNT(*) as days FROM hr_attendance WHERE employee_id = ? AND date LIKE ? AND status = 'late'").get(emp.id, `${month}%`) as any)?.days ?? 0;
      const dailyRate = basic / 30;
      const absenceDeduction = Math.round((absences * dailyRate) * 100) / 100;
      const delayDeduction = Math.round((lates * dailyRate * 0.25) * 100) / 100;

      const deductions = Math.round((penalties + loans + meals + absenceDeduction + delayDeduction) * 100) / 100;
      const net = Math.round((basic + bonuses - deductions) * 100) / 100;

      const existing = db.prepare("SELECT id, status FROM hr_salaries WHERE employee_id = ? AND month = ?").get(emp.id, month) as any;
      if (existing) {
        if (existing.status !== "paid") {
          db.prepare("UPDATE hr_salaries SET basic_salary = ?, bonuses = ?, deductions = ?, net_salary = ? WHERE id = ?")
            .run(basic, bonuses, deductions, net, existing.id);
        }
      } else {
        const ins = db.prepare("INSERT INTO hr_salaries (employee_id, month, basic_salary, bonuses, deductions, net_salary, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')")
          .run(emp.id, month, basic, bonuses, deductions, net);
        const salId = Number(ins.lastInsertRowid);
        const empAccCode = getEmployeeSubAccountCode(db, emp.id, emp.name);
        if (net > 0) {
          try {
            createDoubleEntryJournal(
              getBusinessDate("hr"),
              `قيد استحقاق راتب شهر ${month} للموظف ${emp.name}`,
              "payroll_accrual",
              salId,
              [
                { account_code: "61000", debit: net, credit: 0, description: `مصروف الرواتب والأجور لشهر ${month} - ${emp.name}` },
                { account_code: empAccCode, debit: 0, credit: net, description: `استحقاق راتب شهر ${month} بحساب الموظف ${emp.name} (${empAccCode})` },
              ]
            );
          } catch (jvErr: any) {
            console.warn("Monthly close accrual journal warning:", jvErr.message);
          }
        }
        processedCount++;
        totalPayrollNet += net;
      }
      syncEmployeeAccountAndBalance(emp.id);
    }
    res.json({
      success: true,
      message: `تم إغلاق وترحيل رواتب شهر ${month} بنجاح وتحديث حسابات الموظفين وتوليد القيود المحاسبية`,
      processedCount,
      totalPayrollNet,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUMMARY & REPORTS ====================
router.get("/hr/summary", (req, res) => {
  try {
    const totalEmployees = (db.prepare("SELECT COUNT(*) as c FROM hr_employees WHERE active = 1").get() as any).c;
    const totalDepartments = (db.prepare("SELECT COUNT(*) as c FROM hr_departments").get() as any).c;
    const totalSalariesPaid = (db.prepare("SELECT COALESCE(SUM(net_salary), 0) as s FROM hr_salaries WHERE status = 'paid'").get() as any).s;
    const pendingLoans = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM hr_loans WHERE status = 'pending'").get() as any).s;
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
      totalDepartments,
      totalDepts: totalDepartments,
      totalSalariesPaid,
      pendingLoans,
      currentMonthSalaries: salariesThisMonth?.total ?? 0,
      currentMonthSalaryCount: salariesThisMonth?.count ?? 0,
      paidSalaries: salariesThisMonth?.paid_count ?? 0,
      todayPresent: todayAttendance?.present ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Detailed Comprehensive Employee Statement Report Endpoint
router.get("/hr/reports/statement", (req, res) => {
  try {
    const { employee_id, month } = req.query as { employee_id?: string; month?: string };
    if (!employee_id) {
      return res.status(400).json({ error: "معرف الموظف مطلوب" });
    }

    const currentMonth = month || new Date().toISOString().slice(0, 7);
    syncEmployeeAccountAndBalance(Number(employee_id));

    const emp = db.prepare(`
      SELECT e.*, d.name as department_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      WHERE e.id = ?
    `).get(employee_id) as any;

    if (!emp) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    const mQuery = month ? `${month}%` : "%";

    const overtimes = db.prepare("SELECT * FROM hr_overtime WHERE employee_id = ? AND date LIKE ? ORDER BY date DESC").all(employee_id, mQuery) as any[];
    const overtimeTotal = overtimes.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    const entitlements = db.prepare("SELECT * FROM hr_entitlements WHERE employee_id = ? AND date LIKE ? ORDER BY date DESC").all(employee_id, mQuery) as any[];
    const entitlementsTotal = entitlements.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const penalties = db.prepare("SELECT * FROM hr_penalties WHERE employee_id = ? AND date LIKE ? ORDER BY date DESC").all(employee_id, mQuery) as any[];
    const penaltiesTotal = penalties.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const loans = db.prepare("SELECT * FROM hr_loans WHERE employee_id = ? AND (request_date LIKE ? OR status = 'approved') ORDER BY request_date DESC").all(employee_id, mQuery) as any[];
    const loansTotal = loans.filter((l: any) => l.status === "approved" || l.status === "active").reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

    const meals = db.prepare("SELECT * FROM meal_deductions WHERE employee_id = ? AND created_at LIKE ? ORDER BY created_at DESC").all(employee_id, mQuery) as any[];
    const mealsTotal = meals.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const leaves = db.prepare("SELECT * FROM hr_leaves WHERE employee_id = ? AND (start_date LIKE ? OR end_date LIKE ?) ORDER BY start_date DESC").all(employee_id, mQuery, mQuery) as any[];
    const custodies = db.prepare("SELECT * FROM hr_custodies WHERE employee_id = ? ORDER BY received_date DESC").all(employee_id) as any[];
    const salary = db.prepare("SELECT * FROM hr_salaries WHERE employee_id = ? AND month = ?").get(employee_id, currentMonth) as any;

    let manualEntries: any[] = [];
    try {
      manualEntries = db.prepare("SELECT * FROM manual_ledger_entries WHERE (party_type = 'employee' OR party_type = 'user') AND party_id = ? AND entry_date LIKE ? ORDER BY entry_date DESC").all(employee_id, mQuery) as any[];
    } catch {}
    const manualDebitTotal = manualEntries.reduce((sum, me) => sum + (Number(me.debit) || 0), 0);
    const manualCreditTotal = manualEntries.reduce((sum, me) => sum + (Number(me.credit) || 0), 0);
    const manualEntriesTotal = manualDebitTotal - manualCreditTotal;

    let vouchers: any[] = [];
    try {
      vouchers = db.prepare("SELECT * FROM vouchers WHERE party_type = 'employee' AND party_id = ? AND created_at LIKE ? ORDER BY created_at DESC").all(employee_id, mQuery) as any[];
    } catch {}
    const paidVouchersTotal = vouchers.filter(v => v.type === "payment").reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    const receivedVouchersTotal = vouchers.filter(v => v.type === "receipt").reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    const netVouchersPaid = paidVouchersTotal - receivedVouchersTotal;

    const attendances = db.prepare("SELECT * FROM hr_attendance WHERE employee_id = ? AND date LIKE ?").all(employee_id, mQuery) as any[];
    let absencesTotal = 0;
    let latesTotal = 0;
    let absencesCount = 0;
    let latesCount = 0;
    const dailyRate = (emp.basic_salary || 0) / 30;

    attendances.forEach(a => {
      if (a.status === 'absent') {
        absencesCount++;
        absencesTotal += dailyRate;
      } else if (a.status === 'late') {
        latesCount++;
        latesTotal += dailyRate * 0.25;
      }
    });

    const basicSalary = Number(emp.basic_salary) || 0;
    const totalEntitlements = basicSalary + overtimeTotal + entitlementsTotal;
    const totalDeductions = penaltiesTotal + loansTotal + mealsTotal + absencesTotal + latesTotal + manualEntriesTotal;
    const netSalary = totalEntitlements - totalDeductions;
    const remainingToPay = salary?.status === "paid" ? 0 : (netSalary - netVouchersPaid);

    res.json({
      employee: { ...emp, basic_salary: basicSalary, active: Boolean(emp.active) },
      month: month || currentMonth,
      basicSalary,
      overtimes,
      overtime: overtimes,
      overtimeTotal,
      entitlements,
      entitlementsTotal,
      penalties,
      penaltiesTotal,
      loans,
      loansTotal,
      meals,
      mealsTotal,
      leaves,
      custodies,
      salary: salary || null,
      manualEntries,
      manualEntriesTotal,
      vouchers,
      paidVouchersTotal,
      receivedVouchersTotal,
      netVouchersPaid,
      remainingToPay,
      absencesCount,
      latesCount,
      absencesTotal,
      latesTotal,
      totalEntitlements,
      totalDeductions,
      netSalary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

