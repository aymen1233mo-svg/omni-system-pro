import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

// ─── Currency Endpoints ───
router.get("/onyx/currencies", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM currencies ORDER BY id").all();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/currencies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, symbol, fraction, type, exchange_rate } = req.body;
  if (!name || !symbol) {
    res.status(400).json({ error: "اسم العملة ورمزها مطلوبان" });
    return;
  }
  try {
    const r = db.prepare(
      "INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)"
    ).run(name, symbol, fraction ?? null, type ?? "foreign", Number(exchange_rate || 1));
    logAudit(user.id, user.name, "إضافة عملة", `عملة: ${name} (${symbol})`);
    res.status(201).json({ id: r.lastInsertRowid, name, symbol, fraction, type, exchange_rate, active: 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/onyx/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, symbol, fraction, type, exchange_rate, active } = req.body;
  try {
    db.prepare(
      "UPDATE currencies SET name=?, symbol=?, fraction=?, type=?, exchange_rate=?, active=? WHERE id=?"
    ).run(name, symbol, fraction ?? null, type ?? "foreign", Number(exchange_rate || 1), active ?? 1, req.params.id);
    logAudit(user.id, user.name, "تعديل عملة", `تعديل عملة رقم: ${req.params.id} إلى ${name}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/onyx/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM currencies WHERE id=?").run(req.params.id);
    logAudit(user.id, user.name, "حذف عملة", `حذف عملة رقم: ${req.params.id}`);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Active Sessions & Logs Endpoints (واجهة عرض المستخدمين) ───
const SESSION_SELECT_SQL = `
  SELECT s.*,
         COALESCE(b.name, 'الفرع الرئيسي') as branch_name,
         u.username as user_login,
         u.role as user_role,
         u.group_id as group_id,
         ug.name_ar as group_name
  FROM erp_sessions s
  LEFT JOIN branches b ON s.branch_id = b.id
  LEFT JOIN users u ON (s.user_id = u.id OR s.username = u.name OR s.username = u.username)
  LEFT JOIN user_groups ug ON u.group_id = ug.id
`;

router.get("/onyx/sessions", (req, res) => {
  try {
    // Ensure current authenticated user has at least one active session row if logged in
    const currentUser = getAuthUser(req);
    if (currentUser) {
      const hasActive = db.prepare("SELECT id FROM erp_sessions WHERE (username = ? OR user_id = ?) AND (status = 'نشط' OR logout_time IS NULL) LIMIT 1")
        .get(currentUser.name, currentUser.id);
      if (!hasActive) {
        const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
        db.prepare(`
          INSERT INTO erp_sessions (user_id, username, device_name, login_time, status, branch_id, language, created_by, created_at)
          VALUES (?, ?, 'DESKTOP-QLP03GF-EMAD', ?, 'نشط', 1, 'عربي', ?, ?)
        `).run(currentUser.id, currentUser.name, nowStr, currentUser.name, nowStr);
      }
    }

    const active = db.prepare(`${SESSION_SELECT_SQL} WHERE s.status='نشط' AND (s.logout_time IS NULL OR s.logout_time = '') ORDER BY s.id DESC`).all();
    const all = db.prepare(`${SESSION_SELECT_SQL} ORDER BY s.id DESC LIMIT 250`).all();
    res.json({ active, history: all, all });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/sessions", (req, res) => {
  const user = getAuthUser(req);
  const { user_id, username, device_name, login_time, logout_time, status, branch_id, language, ip_address, notes } = req.body;
  if (!username) {
    res.status(400).json({ error: "اسم المستخدم مطلوب" });
    return;
  }
  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const r = db.prepare(`
      INSERT INTO erp_sessions (
        user_id, username, device_name, login_time, logout_time, status, branch_id, language, ip_address, notes, created_by, created_at, edit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      user_id ? Number(user_id) : null,
      username,
      device_name || "DESKTOP-QLP03GF-EMAD",
      login_time || nowStr,
      status === "نشط" ? null : (logout_time || null),
      status || "نشط",
      branch_id ? Number(branch_id) : 1,
      language || "عربي",
      ip_address || "192.168.1.100",
      notes || null,
      user?.name || "مدير النظام",
      nowStr
    );
    if (user) {
      logAudit(user.id, user.name, "تسجيل جلسة مستخدم", `المستخدم: ${username} - الجهاز: ${device_name || "DESKTOP-QLP03GF-EMAD"}`);
    }
    const created = db.prepare(`${SESSION_SELECT_SQL} WHERE s.id = ?`).get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/onyx/sessions/:id", (req, res) => {
  const user = getAuthUser(req);
  const existing = db.prepare("SELECT * FROM erp_sessions WHERE id=?").get(req.params.id) as any;
  if (!existing) {
    res.status(404).json({ error: "السجل غير موجود" });
    return;
  }
  const { user_id, username, device_name, login_time, logout_time, status, branch_id, language, ip_address, notes } = req.body;
  try {
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const nextStatus = status ?? existing.status;
    const nextLogout = nextStatus === "نشط" ? (logout_time || null) : (logout_time !== undefined ? logout_time : (existing.logout_time || nowStr));
    db.prepare(`
      UPDATE erp_sessions SET
        user_id = ?, username = ?, device_name = ?, login_time = ?, logout_time = ?,
        status = ?, branch_id = ?, language = ?, ip_address = ?, notes = ?,
        updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(
      user_id !== undefined ? (user_id ? Number(user_id) : null) : existing.user_id,
      username ?? existing.username,
      device_name ?? existing.device_name,
      login_time ?? existing.login_time,
      nextLogout,
      nextStatus,
      branch_id !== undefined ? Number(branch_id) : existing.branch_id,
      language ?? existing.language,
      ip_address ?? existing.ip_address ?? "192.168.1.100",
      notes !== undefined ? notes : existing.notes,
      user?.name || "مدير النظام",
      nowStr,
      req.params.id
    );
    if (user) {
      logAudit(user.id, user.name, "تعديل جلسة مستخدم", `تعديل جلسة رقم: ${req.params.id} للمستخدم: ${username ?? existing.username}`);
    }
    const updated = db.prepare(`${SESSION_SELECT_SQL} WHERE s.id = ?`).get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/sessions/disconnect/:id", (req, res) => {
  const user = getAuthUser(req);
  try {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const statusLabel = req.body?.status || "خروج";
    db.prepare(`
      UPDATE erp_sessions SET
        status = ?, logout_time = ?, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(statusLabel, now, user?.name || "مدير النظام", now, req.params.id);
    if (user) {
      logAudit(user.id, user.name, "إخراج / قطع اتصال مستخدم", `إغلاق جلسة رقم: ${req.params.id}`);
    }
    res.json({ success: true, logout_time: now, status: statusLabel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/sessions/reconnect/:id", (req, res) => {
  const user = getAuthUser(req);
  try {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db.prepare(`
      UPDATE erp_sessions SET
        status = 'نشط', logout_time = NULL, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(user?.name || "مدير النظام", now, req.params.id);
    if (user) {
      logAudit(user.id, user.name, "إعادة تفعيل جلسة مستخدم", `تفعيل جلسة رقم: ${req.params.id}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/sessions/disconnect-all", (req, res) => {
  const user = getAuthUser(req);
  try {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const r = db.prepare(`
      UPDATE erp_sessions SET
        status = 'خروج', logout_time = ?, updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE status = 'نشط'
    `).run(now, user?.name || "مدير النظام", now);
    if (user) {
      logAudit(user.id, user.name, "إغلاق جميع الجلسات النشطة", `تم إغلاق ${r.changes} جلسة نشطة`);
    }
    res.json({ success: true, disconnected_count: r.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/onyx/sessions/:id", (req, res) => {
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM erp_sessions WHERE id=?").run(req.params.id);
    if (user) {
      logAudit(user.id, user.name, "حذف سجل جلسة مستخدم", `حذف سجل جلسة رقم: ${req.params.id}`);
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Branches Extended Endpoints ───
router.get("/onyx/branches", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM branches ORDER BY id").all();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/onyx/branches/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const {
    name, address, phone, active,
    company_id, company_name, foreign_name, branch_foreign_name, group_id,
    header_1, header_2, header_3, header_1_foreign, header_2_foreign, header_3_foreign,
    tax_id, tax_rate, commercial_reg, lat, long, city, street, building
  } = req.body;
  try {
    db.prepare(`
      UPDATE branches SET
        name=?, address=?, phone=?, active=?,
        company_id=?, company_name=?, foreign_name=?, branch_foreign_name=?, group_id=?,
        header_1=?, header_2=?, header_3=?, header_1_foreign=?, header_2_foreign=?, header_3_foreign=?,
        tax_id=?, tax_rate=?, commercial_reg=?, lat=?, long=?, city=?, street=?, building=?
      WHERE id=?
    `).run(
      name, address ?? null, phone ?? null, active ?? 1,
      company_id ?? 1, company_name ?? null, foreign_name ?? null, branch_foreign_name ?? null, group_id ?? 1,
      header_1 ?? null, header_2 ?? null, header_3 ?? null, header_1_foreign ?? null, header_2_foreign ?? null, header_3_foreign ?? null,
      tax_id ?? null, tax_rate ?? 15, commercial_reg ?? null, lat ?? null, long ?? null, city ?? null, street ?? null, building ?? null,
      req.params.id
    );
    logAudit(user.id, user.name, "تحديث تفاصيل الفرع", `فرع رقم: ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/branches", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const {
    name, address, phone, active,
    company_id, company_name, foreign_name, branch_foreign_name, group_id,
    header_1, header_2, header_3, header_1_foreign, header_2_foreign, header_3_foreign,
    tax_id, tax_rate, commercial_reg, lat, long, city, street, building
  } = req.body;
  if (!name) {
    res.status(400).json({ error: "اسم الفرع مطلوب" });
    return;
  }
  try {
    const r = db.prepare(`
      INSERT INTO branches (
        name, address, phone, active,
        company_id, company_name, foreign_name, branch_foreign_name, group_id,
        header_1, header_2, header_3, header_1_foreign, header_2_foreign, header_3_foreign,
        tax_id, tax_rate, commercial_reg, lat, long, city, street, building
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      name, address ?? null, phone ?? null, active ?? 1,
      company_id ?? 1, company_name ?? "شركة عماد عقلان", foreign_name ?? "Emad Aqlaan Co.", branch_foreign_name ?? "Main Branch", group_id ?? 1,
      header_1 ?? null, header_2 ?? null, header_3 ?? null, header_1_foreign ?? null, header_2_foreign ?? null, header_3_foreign ?? null,
      tax_id ?? null, tax_rate ?? 15, commercial_reg ?? null, lat ?? null, long ?? null, city ?? "صنعاء", street ?? null, building ?? null
    );
    logAudit(user.id, user.name, "إضافة فرع جديد", `فرع: ${name}`);
    res.status(201).json({ id: r.lastInsertRowid, name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/onyx/branches/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM branches WHERE id=?").run(req.params.id);
    logAudit(user.id, user.name, "حذف فرع", `فرع رقم: ${req.params.id}`);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Granular Role Permissions Endpoints ───
router.get("/onyx/roles", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM role_permissions ORDER BY role").all();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/onyx/roles", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders } = req.body;
  if (!role) {
    res.status(400).json({ error: "اسم الدور مطلوب" });
    return;
  }
  try {
    db.prepare(`
      INSERT INTO role_permissions (
        role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns,
        can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      role,
      can_void_bills ? 1 : 0,
      can_view_cost ? 1 : 0,
      can_change_currencies ? 1 : 0,
      can_approve_returns ? 1 : 0,
      can_open_close_safe ? 1 : 0,
      can_transfer_funds ? 1 : 0,
      can_edit_products ? 1 : 0,
      can_delete_orders ? 1 : 0
    );
    logAudit(user.id, user.name, "إضافة دور أمني", `دور: ${role}`);
    res.status(201).json({ role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/onyx/roles/:role", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders } = req.body;
  try {
    db.prepare(`
      UPDATE role_permissions SET
        can_void_bills=?, can_view_cost=?, can_change_currencies=?, can_approve_returns=?,
        can_open_close_safe=?, can_transfer_funds=?, can_edit_products=?, can_delete_orders=?
      WHERE role=?
    `).run(
      can_void_bills ? 1 : 0,
      can_view_cost ? 1 : 0,
      can_change_currencies ? 1 : 0,
      can_approve_returns ? 1 : 0,
      can_open_close_safe ? 1 : 0,
      can_transfer_funds ? 1 : 0,
      can_edit_products ? 1 : 0,
      can_delete_orders ? 1 : 0,
      req.params.role
    );
    logAudit(user.id, user.name, "تحديث صلاحيات دور", `دور: ${req.params.role}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/onyx/roles/:role", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM role_permissions WHERE role=?").run(req.params.role);
    logAudit(user.id, user.name, "حذف دور أمني", `دور: ${req.params.role}`);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Extended Audit Log Endpoint ───
router.get("/onyx/audit_logs", (req, res) => {
  try {
    const data = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200").all();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
