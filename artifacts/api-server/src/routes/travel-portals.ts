import { Router } from "express";
import { db, createDoubleEntryJournal, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

// ============================================================================
// B2B CORPORATE PORTAL API ENDPOINTS
// ============================================================================

// 1. Get all corporate accounts
router.get("/travel/corporate/accounts", (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM travel_corporate_employees WHERE corporate_id = c.id) as employees_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id) as requests_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id AND status = 'pending_approval') as pending_approvals_count
    FROM travel_corporate_accounts c
    ORDER BY c.id DESC
  `).all();
  res.json(rows);
});

// 2. Get corporate account by ID with employees and recent requests
router.get("/travel/corporate/accounts/:id", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }
  const employees = db.prepare("SELECT * FROM travel_corporate_employees WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  const requests = db.prepare("SELECT * FROM travel_corporate_requests WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ account, employees, requests });
});

// 3. Create new corporate account
router.post("/travel/corporate/accounts", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit = 50000, payment_terms_days = 30,
    policy_max_booking_budget = 5000, policy_allowed_classes = "اقتصادية,أعمال",
    policy_require_manager_approval = 1, notes
  } = req.body;

  if (!company_name) {
    res.status(400).json({ error: "اسم الشركة مطلوب" });
    return;
  }

  const account_code = `CORP-${Date.now().toString().slice(-6)}`;

  const ins = db.prepare(`
    INSERT INTO travel_corporate_accounts (
      company_name, company_name_en, account_code, cr_number, tax_number,
      contact_person, contact_phone, contact_email, credit_limit, current_balance,
      payment_terms_days, policy_max_booking_budget, policy_allowed_classes,
      policy_require_manager_approval, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)
  `);

  const r = ins.run(
    company_name, company_name_en || null, account_code, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null, Number(credit_limit),
    Number(payment_terms_days), Number(policy_max_booking_budget), policy_allowed_classes,
    Number(policy_require_manager_approval), notes || null
  );

  const newAcc = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(r.lastInsertRowid);
  logAudit(user.id, user.name, "CORPORATE_ACCOUNT_CREATED", `إنشاء حساب شركة B2B جديد: ${company_name}`);

  res.status(201).json(newAcc);
});

// 4. Update corporate account
router.put("/travel/corporate/accounts/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit, current_balance, payment_terms_days,
    policy_max_booking_budget, policy_allowed_classes, policy_require_manager_approval,
    status, notes
  } = req.body;

  db.prepare(`
    UPDATE travel_corporate_accounts
    SET company_name = ?, company_name_en = ?, cr_number = ?, tax_number = ?,
        contact_person = ?, contact_phone = ?, contact_email = ?, credit_limit = ?,
        current_balance = ?, payment_terms_days = ?, policy_max_booking_budget = ?,
        policy_allowed_classes = ?, policy_require_manager_approval = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(
    company_name, company_name_en || null, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null,
    Number(credit_limit || 50000), Number(current_balance || 0), Number(payment_terms_days || 30),
    Number(policy_max_booking_budget || 5000), policy_allowed_classes,
    Number(policy_require_manager_approval ? 1 : 0), status || "active", notes || null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 5. Add employee to corporate account
router.post("/travel/corporate/employees", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    corporate_id, name_ar, name_en, employee_number, department,
    cost_center, job_title, phone, email, passport_number, passport_expiry,
    max_budget = 3000, allowed_class = "اقتصادية", requires_approval = 1
  } = req.body;

  if (!corporate_id || !name_ar) {
    res.status(400).json({ error: "معرف الشركة واسم الموظف حقول مطلوبة" });
    return;
  }

  let empNum = employee_number ? String(employee_number).trim() : "";
  if (!/^[1-9]\d*$/.test(empNum)) {
    const rows = db.prepare("SELECT employee_number FROM travel_corporate_employees").all() as { employee_number: string }[];
    const used = new Set<number>();
    for (const row of rows) {
      const n = parseInt(String(row.employee_number || "").trim(), 10);
      if (!isNaN(n) && n > 0 && String(n) === String(row.employee_number || "").trim()) used.add(n);
    }
    let next = 1;
    while (used.has(next)) next++;
    empNum = String(next);
  }

  const ins = db.prepare(`
    INSERT INTO travel_corporate_employees (
      corporate_id, name_ar, name_en, employee_number, department,
      cost_center, job_title, phone, email, passport_number, passport_expiry,
      max_budget, allowed_class, requires_approval, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const r = ins.run(
    corporate_id, name_ar, name_en || name_ar, empNum, department || null,
    cost_center || null, job_title || null, phone || null, email || null,
    passport_number || null, passport_expiry || null, Number(max_budget),
    allowed_class, Number(requires_approval)
  );

  const emp = db.prepare("SELECT * FROM travel_corporate_employees WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(emp);
});

// 6. Submit Corporate Travel Request (With Policy Check)
router.post("/travel/corporate/requests", (req, res) => {
  const {
    corporate_id, employee_id, passenger_name, service_type = "flight",
    trip_type = "round_trip", origin, destination, departure_date, return_date,
    preferred_class = "اقتصادية", purpose_of_trip, estimated_cost = 0
  } = req.body;

  if (!corporate_id || !passenger_name || !origin || !destination || !departure_date) {
    res.status(400).json({ error: "جميع بيانات الرحلة والمسافر مطلوبة" });
    return;
  }

  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(corporate_id) as any;
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  // Check policy rules
  let autoApprove = false;
  const estCost = Number(estimated_cost || 0);
  if (account.policy_require_manager_approval === 0 && estCost <= account.policy_max_booking_budget) {
    autoApprove = true;
  }

  const reqNumber = `REQ-CORP-${Date.now().toString().slice(-6)}`;
  const status = autoApprove ? "approved" : "pending_approval";

  const ins = db.prepare(`
    INSERT INTO travel_corporate_requests (
      request_number, corporate_id, employee_id, passenger_name, service_type,
      trip_type, origin, destination, departure_date, return_date,
      preferred_class, purpose_of_trip, estimated_cost, actual_cost,
      status, approver_name, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  const r = ins.run(
    reqNumber, corporate_id, employee_id || null, passenger_name, service_type,
    trip_type, origin, destination, departure_date, return_date || null,
    preferred_class, purpose_of_trip || null, estCost, status,
    autoApprove ? "النظام (الموافقة التلقائية لسياسة السفر)" : null,
    autoApprove ? new Date().toISOString() : null
  );

  const newReq = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(newReq);
});

// 7. Approve / Reject Corporate Travel Request
router.post("/travel/corporate/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { action, approver_name, notes, actual_cost } = req.body; // action: 'approve' | 'reject'
  const reqItem = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id) as any;
  if (!reqItem) {
    res.status(404).json({ error: "طلب السفر غير موجود" });
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const cost = actual_cost ? Number(actual_cost) : reqItem.estimated_cost;

  db.prepare(`
    UPDATE travel_corporate_requests
    SET status = ?, approver_name = ?, approval_notes = ?, approved_at = ?, actual_cost = ?
    WHERE id = ?
  `).run(
    newStatus,
    approver_name || user.name,
    notes || null,
    new Date().toISOString(),
    cost,
    req.params.id
  );

  // If approved, update corporate balance
  if (action === "approve") {
    db.prepare("UPDATE travel_corporate_accounts SET current_balance = current_balance + ? WHERE id = ?").run(cost, reqItem.corporate_id);
  }

  const updated = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 8. Get corporate statement / ledger
router.get("/travel/corporate/:id/statement", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  const requests = db.prepare(`
    SELECT r.*, e.department, e.employee_number
    FROM travel_corporate_requests r
    LEFT JOIN travel_corporate_employees e ON e.id = r.employee_id
    WHERE r.corporate_id = ?
    ORDER BY r.id DESC
  `).all(req.params.id);

  res.json({ account, statement_items: requests });
});

// ============================================================================
// B2C PASSENGER SELF-SERVICE PORTAL API ENDPOINTS
// ============================================================================

// 9. Passenger Self-Service Lookup (PNR, Ticket, Passport, or Phone)
router.get("/travel/b2c/lookup", (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length < 2) {
    res.status(400).json({ error: "الرجاء إدخال رقم الحجز أو التذكرة أو الجواز أو الهاتف" });
    return;
  }

  const q = String(query).trim();

  // Search bookings
  const bookings = db.prepare(`
    SELECT b.*, 
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.pnr LIKE ? OR b.ticket_number LIKE ? OR b.booking_number LIKE ?
       OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY b.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  // Search visas
  const visas = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number LIKE ? OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY v.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  // Search hotels
  const hotels = db.prepare(`
    SELECT h.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_hotels h
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    LEFT JOIN customers c ON c.id = h.customer_id
    WHERE h.booking_ref LIKE ? OR c.phone LIKE ?
    ORDER BY h.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`);

  res.json({
    query: q,
    results_count: bookings.length + visas.length + hotels.length,
    bookings,
    visas,
    hotels
  });
});

// 10. Visa Milestone Live Timeline Tracker
router.get("/travel/b2c/visa-tracking/:param", (req, res) => {
  const param = req.params.param.trim();
  const visa = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           p.nationality, c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number = ? OR v.id = ? OR p.passport_number = ?
  `).get(param, param, param) as any;

  if (!visa) {
    res.status(404).json({ error: "معاملة التأشيرة غير موجودة" });
    return;
  }

  // Construct official embassy milestones timeline
  const statusMilestones: Record<string, number> = {
    pending: 1,
    in_review: 2,
    submitted: 3,
    biometrics: 4,
    under_process: 5,
    approved: 6,
    delivered: 7,
    rejected: -1
  };

  const currentStep = statusMilestones[visa.status] || (visa.status === "approved" ? 6 : 3);

  const timeline = [
    { step: 1, title: "استلام الوثائق والجواز", desc: "تم استلام متطلبات التأشيرة من العميل والتحقق من صحة المستندات", date: visa.application_date || "2026-08-10", completed: currentStep >= 1 },
    { step: 2, title: "المراجعة وتعبئة النموذج الرسمي", desc: "تمت مراجعة البيانات وتعبئة الأبلكيشن وسداد الرسوم القنصلية", date: visa.application_date || "2026-08-12", completed: currentStep >= 2 },
    { step: 3, title: "التقديم إلى السفارة / مركز التأشيرات (VFS/TLS)", desc: "تم تقديم الملف رسمياً إلى القنصلية المعتمدة", date: visa.application_date || "2026-08-15", completed: currentStep >= 3 },
    { step: 4, title: "موعد البصمة والصور الحيوية (Biometrics)", desc: "حضور موعد التبصيم في مركز التأشيرات المعتمد", date: visa.application_date || "2026-08-18", completed: currentStep >= 4 },
    { step: 5, title: "قيد الدراسة والتدقيق الأمني في القنصلية", desc: "جواز السفر والملف قيد المعالجة النهائية لدى القنصلية", date: visa.application_date || "2026-08-20", completed: currentStep >= 5 },
    { step: 6, title: "صدور التأشيرة وإلصاقها في الجواز", desc: "تمت الموافقة الرسمية على التأشيرة واستلام الجواز من السفارة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 6 },
    { step: 7, title: "جاهز للتسليم أو الإرسال عبر الشحن", desc: "الجواز والتأشيرة جاهزة للاستلام من فرع الوكالة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 7 }
  ];

  res.json({
    visa,
    current_step: currentStep,
    timeline
  });
});

// 11. Submit B2C Customer Request (Change date, Refund, Inquiry)
router.post("/travel/b2c/requests", (req, res) => {
  const {
    request_type, customer_name, customer_phone, customer_email,
    pnr_or_ticket, passport_number, request_details, preferred_new_date
  } = req.body;

  if (!request_type || !customer_name || !customer_phone || !request_details) {
    res.status(400).json({ error: "اسم العميل ورقم الهاتف ونوع الطلب والتفاصيل حقول مطلوبة" });
    return;
  }

  const requestCode = `REQ-B2C-${Date.now().toString().slice(-6)}`;

  let calculatedFees = 0;
  if (request_type === "change_date") calculatedFees = 200; // Standard agency reissue fee
  if (request_type === "refund_ticket") calculatedFees = 150; // Standard cancellation fee

  const ins = db.prepare(`
    INSERT INTO travel_b2c_requests (
      request_code, request_type, customer_name, customer_phone, customer_email,
      pnr_or_ticket, passport_number, request_details, preferred_new_date,
      calculated_fees, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);

  const r = ins.run(
    requestCode, request_type, customer_name, customer_phone, customer_email || null,
    pnr_or_ticket || null, passport_number || null, request_details,
    preferred_new_date || null, calculatedFees
  );

  const created = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(created);
});

// 12. Agent view and resolve B2C customer requests
router.get("/travel/b2c/agent-requests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_b2c_requests ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

router.post("/travel/b2c/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status, agent_response } = req.body; // status: 'in_review' | 'actioned' | 'rejected'

  db.prepare(`
    UPDATE travel_b2c_requests
    SET status = ?, agent_response = ?, assigned_agent = ?, resolved_at = ?
    WHERE id = ?
  `).run(
    status || "actioned",
    agent_response || null,
    user.name,
    status === "actioned" || status === "rejected" ? new Date().toISOString() : null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

export default router;
