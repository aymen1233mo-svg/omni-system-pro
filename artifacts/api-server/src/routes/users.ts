import { Router } from "express";
import { db, hashPassword } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { recordAuditLog } from "./audit";

const router = Router();

try {
  db.exec("ALTER TABLE user_groups ADD COLUMN perm_last_invoice_reprint TEXT DEFAULT 'all'");
} catch {}

function toBool(v: any): boolean {
  if (v === null || v === undefined || v === "" || v === false || v === "false") return false;
  const num = Number(v);
  if (!isNaN(num)) {
    return num !== 0;
  }
  if (v === "true" || v === "1") return true;
  return Boolean(v);
}

function isAdminRole(role?: string) {
  return role === "admin" || role === "developer" || role === "general_manager" || role === "مدير" || role === "مدير عام" || role === "مدير عام النظام" || role === "مدير عام الشركة";
}

function toSqlVal(v: any): any {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function getDefaultScreenAllowed(role: string, isAdmin: boolean, scr: any): boolean {
  if (Number(scr.screen_number) === 900 || scr.path === "/licenses") {
    return role === "developer";
  }
  if (isAdmin) return true;
  const isCashier = role === "cashier" || role === "كاشير";
  const isAcc = role === "accountant" || role === "محاسب";
  const isInv = role === "inventory" || role === "storekeeper" || role === "أمين مخزن";
  const isPurch = role === "purchasing" || role === "موظف مشتريات";
  const isSales = role === "sales" || role === "موظف مبيعات";
  const isHr = role === "hr" || role === "شؤون موظفين";

  if (isCashier) {
    return scr.screen_number === 60 || scr.screen_number === 66 || scr.path === "/pos" || scr.path === "/shifts";
  }
  if (isAcc) {
    return (
      scr.module_name?.includes("الأستاذ العام") ||
      scr.module_name?.includes("المراجعة والترحيلات") ||
      scr.module_name?.includes("الحسابات")
    );
  }
  if (isInv) {
    return scr.module_name?.includes("المخازن");
  }
  if (isPurch) {
    return scr.module_name?.includes("المشتريات") || scr.module_name?.includes("الموردين") || scr.screen_number === 52;
  }
  if (isSales) {
    return scr.module_name?.includes("العملاء ونقاط البيع") || scr.screen_number === 30;
  }
  if (isHr) {
    return scr.module_name?.includes("رأس المال البشري");
  }
  return false;
}

function seedUserScreenPermissions(userId: number, role: string, isAdmin: boolean, actorName: string, nowStr: string) {
  const allScreens = db.prepare("SELECT screen_number, screen_name, module_name, submodule_name, path FROM system_screens").all() as any[];
  db.prepare("DELETE FROM user_screen_permissions WHERE user_id=?").run(userId);
  const insPerm = db.prepare(`
    INSERT INTO user_screen_permissions (
      user_id, screen_number, screen_name, module_name, submodule_name,
      can_check, can_print, can_view_report, can_add, can_edit, can_delete,
      can_view, can_review, can_post, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const scr of allScreens) {
    const allowed = getDefaultScreenAllowed(role, isAdmin, scr);
    const fullPerm = isAdmin && Number(scr.screen_number) !== 900;
    insPerm.run(
      userId,
      scr.screen_number,
      scr.screen_name,
      scr.module_name || "",
      scr.submodule_name || "",
      allowed ? 1 : 0,
      allowed ? 1 : 0,
      allowed ? 1 : 0,
      allowed ? 1 : 0,
      allowed ? 1 : 0,
      fullPerm ? 1 : 0,
      allowed ? 1 : 0,
      fullPerm ? 1 : 0,
      fullPerm ? 1 : 0,
      actorName || "مدير النظام",
      nowStr
    );
  }
}

function getAuthUserWithFallback(req: any) {
  let user = getAuthUser(req);
  if (!user) {
    user = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 AND (role='admin' OR role='developer' OR role='general_manager' OR role='مدير عام') LIMIT 1").get() as any;
  }
  return user;
}

const toUser = (u: any) => {
  const isAdmin = isAdminRole(u.role) || u.username === "admin" || u.username === "developer" || toBool(u.group_is_system_admin) || toBool(u.is_system_admin);
  let posOnly = isAdmin ? false : (u.perm_pos_only !== undefined && u.perm_pos_only !== null ? toBool(u.perm_pos_only) : (u.role === "cashier" || u.role === "كاشير"));
  if (!isAdmin && u.id) {
    try {
      const nonPosScreen = db.prepare("SELECT 1 FROM user_screen_permissions WHERE user_id=? AND screen_number NOT IN (60, 66, 900) AND (can_check=1 OR can_view=1) LIMIT 1").get(u.id);
      if (nonPosScreen) {
        posOnly = false;
      }
    } catch (e) {}
  }
  return {
    id: u.id,
    user_number: u.user_number ?? u.id,
    username: u.username,
    name: u.name,
    name_en: u.name_en || "",
    role: u.role,
    group_id: u.group_id ?? null,
    group_name: u.group_name ?? null,
    group_number: u.group_number ?? null,
    group_is_system_admin: toBool(u.group_is_system_admin),
    is_system_admin: Boolean(isAdmin),
    department: u.department || "الإدارة العامة",
    job_title: u.job_title || (u.role === "cashier" ? "كاشير ونقطة بيع" : (u.role === "accountant" ? "محاسب مالي" : (isAdmin ? "مدير عام النظام" : "موظف نظام"))),
    start_date: u.start_date || (u.created_at ? u.created_at.slice(0, 10) : "2026-07-18"),
    end_date: u.end_date || null,
    work_start_time: u.work_start_time || "08:00",
    work_end_time: u.work_end_time || "22:00",
    force_password_change: toBool(u.force_password_change),
    restrict_devices: toBool(u.restrict_devices),
    allow_self_service: u.allow_self_service !== undefined ? toBool(u.allow_self_service) : true,
    is_cashier: toBool(u.is_cashier || u.role === "cashier"),
    is_customer_rep: toBool(u.is_customer_rep),
    is_pos_user: toBool(u.is_pos_user || u.role === "cashier"),
    is_handheld_user: toBool(u.is_handheld_user),
    perm_pos_only: posOnly,
    perm_pos_discount: isAdmin ? true : (u.perm_pos_discount !== undefined ? toBool(u.perm_pos_discount) : toBool(u.can_discount)),
    perm_pos_employee_invoice: isAdmin ? true : (u.perm_pos_employee_invoice !== undefined ? toBool(u.perm_pos_employee_invoice) : toBool(u.allow_meal_deduction)),
    perm_pos_delivery: isAdmin ? true : (u.perm_pos_delivery !== undefined ? toBool(u.perm_pos_delivery) : true),
    perm_pos_dinein: isAdmin ? true : (u.perm_pos_dinein !== undefined ? toBool(u.perm_pos_dinein) : true),
    perm_pos_takeaway: isAdmin ? true : (u.perm_pos_takeaway !== undefined ? toBool(u.perm_pos_takeaway) : true),
    perm_pos_credit: isAdmin ? true : (u.perm_pos_credit !== undefined ? toBool(u.perm_pos_credit) : true),
    perm_pos_cash: isAdmin ? true : (u.perm_pos_cash !== undefined ? toBool(u.perm_pos_cash) : true),
    perm_pos_card: isAdmin ? true : (u.perm_pos_card !== undefined ? toBool(u.perm_pos_card) : true),
    perm_pos_mixed: isAdmin ? true : (u.perm_pos_mixed !== undefined ? toBool(u.perm_pos_mixed) : true),
    default_screen: u.default_screen || (posOnly ? "pos" : "dashboard"),
    allowed_devices: u.allowed_devices || "",
    default_safe_id: u.default_safe_id ?? null,
    customer_id: u.customer_id ?? null,
    fingerprint_id: u.fingerprint_id || "",
    pos_permission_template: u.pos_permission_template || "",
    active: toBool(u.active) && !toBool(u.is_suspended),
    is_suspended: toBool(u.is_suspended),
    suspended_date: u.suspended_date ?? null,
    suspended_reason: u.suspended_reason ?? null,
    can_discount: isAdmin ? true : (u.can_discount !== undefined && u.can_discount !== null ? toBool(u.can_discount) : (u.role === "accountant" || toBool(u.perm_pos_discount))),
    allow_meal_deduction: isAdmin ? true : (u.allow_meal_deduction !== undefined ? toBool(u.allow_meal_deduction) : toBool(u.perm_pos_employee_invoice)),
    email: u.email,
    phone: u.phone,
    avatar_url: u.avatar_url,
    default_branch_id: u.default_branch_id,
    language: u.language,
    timezone: u.timezone,
    status: toBool(u.is_suspended) ? "موقوف" : (u.status || (toBool(u.active) ? "نشط" : "موقوف")),
    full_name: u.full_name,
    employee_id: u.employee_id,
    branch_id: u.branch_id,
    perm_create_invoice: isAdmin ? true : (u.perm_create_invoice !== undefined ? toBool(u.perm_create_invoice) : true),
    perm_edit_invoice: isAdmin ? true : (u.perm_edit_invoice !== undefined ? toBool(u.perm_edit_invoice) : true),
    perm_cancel_invoice: isAdmin ? true : (u.perm_cancel_invoice !== undefined ? toBool(u.perm_cancel_invoice) : false),
    perm_return: isAdmin ? true : (u.perm_return !== undefined ? toBool(u.perm_return) : true),
    perm_view_prices: isAdmin ? true : (u.perm_view_prices !== undefined ? toBool(u.perm_view_prices) : true),
    perm_view_profits: isAdmin ? true : (u.perm_view_profits !== undefined ? toBool(u.perm_view_profits) : false),
    perm_edit_stock: isAdmin ? true : (u.perm_edit_stock !== undefined ? toBool(u.perm_edit_stock) : false),
    perm_stocktake: isAdmin ? true : (u.perm_stocktake !== undefined ? toBool(u.perm_stocktake) : false),
    perm_edit_entries: isAdmin ? true : (u.perm_edit_entries !== undefined ? toBool(u.perm_edit_entries) : false),
    perm_close_periods: isAdmin ? true : (u.perm_close_periods !== undefined ? toBool(u.perm_close_periods) : false),
    perm_view_salaries: isAdmin ? true : (u.perm_view_salaries !== undefined ? toBool(u.perm_view_salaries) : false),
    perm_last_invoice_reprint: u.perm_last_invoice_reprint && String(u.perm_last_invoice_reprint).trim() !== ""
      ? String(u.perm_last_invoice_reprint).trim()
      : "all",
    created_by: u.created_by || "مدير النظام",
    created_at: u.created_at || "2026-07-18 07:30:00",
    updated_by: u.updated_by || null,
    updated_at: u.updated_at || null,
    edit_count: Number(u.edit_count || 0)
  };
};

const USER_SELECT_SQL = `
  SELECT u.*,
         ug.name_ar as group_name, ug.group_number as group_number, ug.is_system_admin as group_is_system_admin
  FROM users u
  LEFT JOIN user_groups ug ON u.group_id = ug.id
`;

router.get("/users", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }
  let rows = db.prepare(`${USER_SELECT_SQL} ORDER BY u.id ASC`).all() as any[];
  if (user.role !== "developer") {
    rows = rows.filter((r: any) => r.id !== 2 && r.role !== "developer" && r.username !== "developer");
  }
  res.json(rows.map(toUser));
});

router.post("/users", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const {
    username, name, name_en, user_number, department, job_title, start_date, end_date,
    work_start_time, work_end_time, force_password_change, restrict_devices, allow_self_service,
    is_cashier, is_customer_rep, is_pos_user, is_handheld_user, allowed_devices, default_safe_id, customer_id, fingerprint_id, pos_permission_template,
    role, password, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
    employee_id, branch_id, group_id, is_suspended, suspended_date, suspended_reason, is_system_admin,
    perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
    perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries,
    perm_pos_only, perm_pos_discount, perm_pos_employee_invoice, allow_meal_deduction,
    perm_pos_delivery, perm_pos_dinein, perm_pos_takeaway, perm_pos_credit, perm_pos_cash, perm_pos_card, default_screen,
    perm_last_invoice_reprint
  } = req.body;
  if (!username || !name || !role || !password) { res.status(400).json({ error: "بيانات ناقصة" }); return; }
  
  if (role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح لغير المطور بتعيين دور المطور" });
    return;
  }

  let groupRow: any = null;
  if (group_id) {
    groupRow = db.prepare("SELECT * FROM user_groups WHERE id=?").get(Number(group_id));
  }
  
  const hash = hashPassword(password);
  const targetIsAdmin = isAdminRole(role) || Boolean(groupRow?.is_system_admin) || Boolean(is_system_admin);
  const discountFlag = targetIsAdmin ? 1 : (can_discount !== undefined ? (can_discount ? 1 : 0) : (perm_pos_discount !== undefined ? (perm_pos_discount ? 1 : 0) : (groupRow ? (groupRow.can_discount ? 1 : 0) : (role === "accountant" ? 1 : 0))));
  const mealDedFlag = targetIsAdmin ? 1 : (allow_meal_deduction !== undefined ? (allow_meal_deduction ? 1 : 0) : (perm_pos_employee_invoice !== undefined ? (perm_pos_employee_invoice ? 1 : 0) : 0));
  const isSusp = is_suspended !== undefined ? (is_suspended ? 1 : 0) : (active === false ? 1 : 0);
  const isAct = isSusp ? 0 : 1;
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  const insertParams = [
    username, hash, name, role, isAct, discountFlag, mealDedFlag,
    email ?? null, phone ?? null, avatar_url ?? null, default_branch_id ? Number(default_branch_id) : 1, language ?? "عربي", timezone ?? "GMT+3", isSusp ? "موقوف" : (status ?? "نشط"), full_name ?? name,
    employee_id ? Number(employee_id) : null,
    branch_id ? Number(branch_id) : null,
    group_id ? Number(group_id) : null,
    user_number ? Number(user_number) : null,
    name_en || null,
    department || "الإدارة العامة",
    job_title || (role === "cashier" ? "كاشير ونقطة بيع" : (role === "accountant" ? "محاسب مالي" : (targetIsAdmin ? "مدير عام النظام" : "موظف نظام"))),
    start_date || nowStr.slice(0, 10),
    end_date || null,
    work_start_time || "08:00",
    work_end_time || "22:00",
    force_password_change ? 1 : 0,
    restrict_devices ? 1 : 0,
    allow_self_service !== undefined ? (allow_self_service ? 1 : 0) : 1,
    is_cashier !== undefined ? (is_cashier ? 1 : 0) : (role === "cashier" ? 1 : 0),
    is_customer_rep ? 1 : 0,
    is_pos_user !== undefined ? (is_pos_user ? 1 : 0) : (role === "cashier" ? 1 : 0),
    is_handheld_user ? 1 : 0,
    allowed_devices || null,
    default_safe_id ? Number(default_safe_id) : null,
    customer_id ? Number(customer_id) : null,
    fingerprint_id || null,
    pos_permission_template || null,
    targetIsAdmin ? 1 : 0,
    isSusp,
    isSusp ? (suspended_date || nowStr.slice(0, 10)) : null,
    isSusp ? (suspended_reason || null) : null,
    user.name || "مدير النظام",
    nowStr,
    (targetIsAdmin || (perm_create_invoice !== undefined ? Boolean(perm_create_invoice) : (groupRow ? Boolean(groupRow.perm_create_invoice) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_invoice !== undefined ? Boolean(perm_edit_invoice) : (groupRow ? Boolean(groupRow.perm_edit_invoice) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_cancel_invoice !== undefined ? Boolean(perm_cancel_invoice) : (groupRow ? Boolean(groupRow.perm_cancel_invoice) : false))) ? 1 : 0,
    (targetIsAdmin || (perm_return !== undefined ? Boolean(perm_return) : (groupRow ? Boolean(groupRow.perm_return) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_view_prices !== undefined ? Boolean(perm_view_prices) : (groupRow ? Boolean(groupRow.perm_view_prices) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_view_profits !== undefined ? Boolean(perm_view_profits) : (groupRow ? Boolean(groupRow.perm_view_profits) : false))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_stock !== undefined ? Boolean(perm_edit_stock) : (groupRow ? Boolean(groupRow.perm_edit_stock) : false))) ? 1 : 0,
    (targetIsAdmin || (perm_stocktake !== undefined ? Boolean(perm_stocktake) : (groupRow ? Boolean(groupRow.perm_stocktake) : false))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_entries !== undefined ? Boolean(perm_edit_entries) : (groupRow ? Boolean(groupRow.perm_edit_entries) : (role === "accountant")))) ? 1 : 0,
    (targetIsAdmin || (perm_close_periods !== undefined ? Boolean(perm_close_periods) : (groupRow ? Boolean(groupRow.perm_close_periods) : false))) ? 1 : 0,
    (targetIsAdmin || (perm_view_salaries !== undefined ? Boolean(perm_view_salaries) : (groupRow ? Boolean(groupRow.perm_view_salaries) : false))) ? 1 : 0,
    targetIsAdmin ? 0 : (perm_pos_only !== undefined ? (perm_pos_only ? 1 : 0) : (role === "cashier" ? 1 : 0)),
    discountFlag ? 1 : 0,
    mealDedFlag ? 1 : 0,
    (targetIsAdmin || (perm_pos_delivery !== undefined ? Boolean(perm_pos_delivery) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_dinein !== undefined ? Boolean(perm_pos_dinein) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_takeaway !== undefined ? Boolean(perm_pos_takeaway) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_credit !== undefined ? Boolean(perm_pos_credit) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_cash !== undefined ? Boolean(perm_pos_cash) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_card !== undefined ? Boolean(perm_pos_card) : true)) ? 1 : 0,
    (targetIsAdmin || (perm_pos_mixed !== undefined ? Boolean(perm_pos_mixed) : true)) ? 1 : 0,
    perm_last_invoice_reprint || (targetIsAdmin ? "all" : "all"),
    default_screen || (role === "cashier" || perm_pos_only ? "pos" : "dashboard")
  ].map(toSqlVal);

  const r = db.prepare(`
    INSERT INTO users (
      username, password_hash, name, role, active, can_discount, allow_meal_deduction,
      email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
      employee_id, branch_id, group_id,
      user_number, name_en, department, job_title, start_date, end_date,
      work_start_time, work_end_time, force_password_change, restrict_devices, allow_self_service,
      is_cashier, is_customer_rep, is_pos_user, is_handheld_user, allowed_devices, default_safe_id, customer_id, fingerprint_id, pos_permission_template, is_system_admin,
      is_suspended, suspended_date, suspended_reason,
      created_by, created_at, edit_count,
      perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
      perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries,
      perm_pos_only, perm_pos_discount, perm_pos_employee_invoice, perm_pos_delivery, perm_pos_dinein, perm_pos_takeaway,
      perm_pos_credit, perm_pos_cash, perm_pos_card, perm_pos_mixed, perm_last_invoice_reprint, default_screen
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, 0,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(...insertParams);

  // Seed default screen permissions for the new user based on role
  try {
    seedUserScreenPermissions(Number(r.lastInsertRowid), role, targetIsAdmin, user.name || "مدير النظام", nowStr);
  } catch (e) {
    console.error("Error seeding user screen permissions:", e);
  }

  const u = db.prepare(`${USER_SELECT_SQL} WHERE u.id=?`).get(r.lastInsertRowid) as any;

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `إنشاء مستخدم جديد: ${name} (${username})`,
      actionType: "create",
      entityType: "users",
      entityId: Number(r.lastInsertRowid),
      details: `تم إنشاء حساب مستخدم جديد بدور: ${role}`
    });
  }

  res.status(201).json(toUser(u));
});

router.put("/users/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }
  
  const targetUserId = Number(req.params.id);
  const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(targetUserId) as any;
  if (!targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  
  if (targetUserId === 1 || targetUser.role === "developer" || targetUser.username === "developer") {
    if (user.role !== "developer" && user.username !== "developer") {
      res.status(403).json({ error: "غير مصرح بالتعديل على حساب المطور" });
      return;
    }
  }
  
  const {
    username, name, name_en, user_number, department, job_title, start_date, end_date,
    work_start_time, work_end_time, force_password_change, restrict_devices, allow_self_service,
    is_cashier, is_customer_rep, is_pos_user, is_handheld_user, allowed_devices, default_safe_id, customer_id, fingerprint_id, pos_permission_template,
    role, password, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
    employee_id, branch_id, group_id, is_suspended, suspended_date, suspended_reason, is_system_admin,
    perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
    perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries,
    perm_pos_only, perm_pos_discount, perm_pos_employee_invoice, allow_meal_deduction,
    perm_pos_delivery, perm_pos_dinein, perm_pos_takeaway, perm_pos_credit, perm_pos_cash, perm_pos_card, perm_pos_mixed, default_screen,
    perm_last_invoice_reprint
  } = req.body;
  
  if (role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح لغير المطور بتعيين دور المطور" });
    return;
  }
  
  const targetGroupId = group_id !== undefined ? (group_id ? Number(group_id) : null) : targetUser.group_id;
  let groupRow: any = null;
  if (targetGroupId) {
    groupRow = db.prepare("SELECT * FROM user_groups WHERE id=?").get(targetGroupId);
  }

  const targetRole = role ?? targetUser.role;
  const targetIsAdmin = isAdminRole(targetRole) || Boolean(groupRow?.is_system_admin) || (is_system_admin !== undefined ? Boolean(is_system_admin) : Boolean(targetUser.is_system_admin));
  const discountFlag = targetIsAdmin ? 1 : (can_discount !== undefined 
    ? (can_discount ? 1 : 0) 
    : (perm_pos_discount !== undefined ? (perm_pos_discount ? 1 : 0) : (targetUser.can_discount !== undefined && targetUser.can_discount !== null ? (targetUser.can_discount ? 1 : 0) : (targetRole === "accountant" ? 1 : 0))));
  
  const mealDedFlag = targetIsAdmin ? 1 : (allow_meal_deduction !== undefined
    ? (allow_meal_deduction ? 1 : 0)
    : (perm_pos_employee_invoice !== undefined ? (perm_pos_employee_invoice ? 1 : 0) : Number(targetUser.allow_meal_deduction || 0)));

  let isSusp = Number(targetUser.is_suspended || 0);
  let isAct = Number(targetUser.active ?? 1);
  if (is_suspended !== undefined) {
    isSusp = is_suspended ? 1 : 0;
    isAct = isSusp ? 0 : 1;
  } else if (active !== undefined) {
    isAct = active ? 1 : 0;
    isSusp = isAct ? 0 : 1;
  }

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  const commonParams = [
    username ?? targetUser.username,
    name ?? targetUser.name,
    name_en !== undefined ? name_en : targetUser.name_en,
    user_number !== undefined ? (user_number ? Number(user_number) : null) : targetUser.user_number,
    department !== undefined ? department : targetUser.department,
    job_title !== undefined ? job_title : targetUser.job_title,
    start_date !== undefined ? start_date : targetUser.start_date,
    end_date !== undefined ? end_date : targetUser.end_date,
    work_start_time !== undefined ? work_start_time : (targetUser.work_start_time || "08:00"),
    work_end_time !== undefined ? work_end_time : (targetUser.work_end_time || "22:00"),
    force_password_change !== undefined ? (force_password_change ? 1 : 0) : Number(targetUser.force_password_change || 0),
    restrict_devices !== undefined ? (restrict_devices ? 1 : 0) : Number(targetUser.restrict_devices || 0),
    allow_self_service !== undefined ? (allow_self_service ? 1 : 0) : Number(targetUser.allow_self_service !== 0 ? 1 : 0),
    is_cashier !== undefined ? (is_cashier ? 1 : 0) : Number(targetUser.is_cashier || (targetRole === "cashier" ? 1 : 0)),
    is_customer_rep !== undefined ? (is_customer_rep ? 1 : 0) : Number(targetUser.is_customer_rep || 0),
    is_pos_user !== undefined ? (is_pos_user ? 1 : 0) : Number(targetUser.is_pos_user || (targetRole === "cashier" ? 1 : 0)),
    is_handheld_user !== undefined ? (is_handheld_user ? 1 : 0) : Number(targetUser.is_handheld_user || 0),
    allowed_devices !== undefined ? allowed_devices : targetUser.allowed_devices,
    default_safe_id !== undefined ? (default_safe_id ? Number(default_safe_id) : null) : targetUser.default_safe_id,
    customer_id !== undefined ? (customer_id ? Number(customer_id) : null) : targetUser.customer_id,
    fingerprint_id !== undefined ? fingerprint_id : targetUser.fingerprint_id,
    pos_permission_template !== undefined ? pos_permission_template : targetUser.pos_permission_template,
    targetIsAdmin ? 1 : 0,
    targetRole,
    isAct ? 1 : 0,
    discountFlag ? 1 : 0,
    mealDedFlag ? 1 : 0,
    email !== undefined ? email : targetUser.email,
    phone !== undefined ? phone : targetUser.phone,
    avatar_url !== undefined ? avatar_url : targetUser.avatar_url,
    default_branch_id !== undefined ? (default_branch_id ? Number(default_branch_id) : 1) : (targetUser.default_branch_id ?? 1),
    language ?? targetUser.language ?? "عربي",
    timezone ?? targetUser.timezone ?? "GMT+3",
    isSusp ? "موقوف" : (status ?? (isAct ? "نشط" : "موقوف")),
    full_name ?? name ?? targetUser.full_name,
    employee_id !== undefined ? (employee_id ? Number(employee_id) : null) : targetUser.employee_id,
    branch_id !== undefined ? (branch_id ? Number(branch_id) : null) : targetUser.branch_id,
    targetGroupId,
    isSusp ? 1 : 0,
    isSusp ? (suspended_date || targetUser.suspended_date || nowStr.slice(0, 10)) : null,
    isSusp ? (suspended_reason !== undefined ? suspended_reason : targetUser.suspended_reason) : null,
    user.name || "مدير النظام",
    nowStr,
    (targetIsAdmin || (perm_create_invoice !== undefined ? Boolean(perm_create_invoice) : Boolean(targetUser.perm_create_invoice))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_invoice !== undefined ? Boolean(perm_edit_invoice) : Boolean(targetUser.perm_edit_invoice))) ? 1 : 0,
    (targetIsAdmin || (perm_cancel_invoice !== undefined ? Boolean(perm_cancel_invoice) : Boolean(targetUser.perm_cancel_invoice))) ? 1 : 0,
    (targetIsAdmin || (perm_return !== undefined ? Boolean(perm_return) : Boolean(targetUser.perm_return))) ? 1 : 0,
    (targetIsAdmin || (perm_view_prices !== undefined ? Boolean(perm_view_prices) : Boolean(targetUser.perm_view_prices))) ? 1 : 0,
    (targetIsAdmin || (perm_view_profits !== undefined ? Boolean(perm_view_profits) : Boolean(targetUser.perm_view_profits))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_stock !== undefined ? Boolean(perm_edit_stock) : Boolean(targetUser.perm_edit_stock))) ? 1 : 0,
    (targetIsAdmin || (perm_stocktake !== undefined ? Boolean(perm_stocktake) : Boolean(targetUser.perm_stocktake))) ? 1 : 0,
    (targetIsAdmin || (perm_edit_entries !== undefined ? Boolean(perm_edit_entries) : Boolean(targetUser.perm_edit_entries))) ? 1 : 0,
    (targetIsAdmin || (perm_close_periods !== undefined ? Boolean(perm_close_periods) : Boolean(targetUser.perm_close_periods))) ? 1 : 0,
    (targetIsAdmin || (perm_view_salaries !== undefined ? Boolean(perm_view_salaries) : Boolean(targetUser.perm_view_salaries))) ? 1 : 0,
    targetIsAdmin ? 0 : (perm_pos_only !== undefined ? (perm_pos_only ? 1 : 0) : (targetUser.perm_pos_only !== undefined ? (targetUser.perm_pos_only ? 1 : 0) : (targetRole === "cashier" ? 1 : 0))),
    discountFlag ? 1 : 0,
    mealDedFlag ? 1 : 0,
    (targetIsAdmin || (perm_pos_delivery !== undefined ? Boolean(perm_pos_delivery) : (targetUser.perm_pos_delivery !== undefined ? Boolean(targetUser.perm_pos_delivery) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_dinein !== undefined ? Boolean(perm_pos_dinein) : (targetUser.perm_pos_dinein !== undefined ? Boolean(targetUser.perm_pos_dinein) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_takeaway !== undefined ? Boolean(perm_pos_takeaway) : (targetUser.perm_pos_takeaway !== undefined ? Boolean(targetUser.perm_pos_takeaway) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_credit !== undefined ? Boolean(perm_pos_credit) : (targetUser.perm_pos_credit !== undefined ? Boolean(targetUser.perm_pos_credit) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_cash !== undefined ? Boolean(perm_pos_cash) : (targetUser.perm_pos_cash !== undefined ? Boolean(targetUser.perm_pos_cash) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_card !== undefined ? Boolean(perm_pos_card) : (targetUser.perm_pos_card !== undefined ? Boolean(targetUser.perm_pos_card) : true))) ? 1 : 0,
    (targetIsAdmin || (perm_pos_mixed !== undefined ? Boolean(perm_pos_mixed) : (targetUser.perm_pos_mixed !== undefined ? Boolean(targetUser.perm_pos_mixed) : true))) ? 1 : 0,
    perm_last_invoice_reprint !== undefined ? perm_last_invoice_reprint : (targetUser.perm_last_invoice_reprint || (targetIsAdmin ? "all" : "all")),
    default_screen || targetUser.default_screen || (targetRole === "cashier" || perm_pos_only ? "pos" : "dashboard")
  ].map(toSqlVal);

  if (password) {
    const hash = hashPassword(password);
    db.prepare(`
      UPDATE users SET
        username=?, name=?, name_en=?, user_number=?, department=?, job_title=?, start_date=?, end_date=?,
        work_start_time=?, work_end_time=?, force_password_change=?, restrict_devices=?, allow_self_service=?,
        is_cashier=?, is_customer_rep=?, is_pos_user=?, is_handheld_user=?, allowed_devices=?, default_safe_id=?, customer_id=?, fingerprint_id=?, pos_permission_template=?, is_system_admin=?,
        role=?, active=?, can_discount=?, allow_meal_deduction=?,
        email=?, phone=?, avatar_url=?, default_branch_id=?, language=?, timezone=?, status=?, full_name=?,
        employee_id=?, branch_id=?, group_id=?,
        is_suspended=?, suspended_date=?, suspended_reason=?,
        updated_by=?, updated_at=?, edit_count = COALESCE(edit_count, 0) + 1,
        perm_create_invoice=?, perm_edit_invoice=?, perm_cancel_invoice=?, perm_return=?, perm_view_prices=?, perm_view_profits=?,
        perm_edit_stock=?, perm_stocktake=?, perm_edit_entries=?, perm_close_periods=?, perm_view_salaries=?,
        perm_pos_only=?, perm_pos_discount=?, perm_pos_employee_invoice=?, perm_pos_delivery=?, perm_pos_dinein=?, perm_pos_takeaway=?,
        perm_pos_credit=?, perm_pos_cash=?, perm_pos_card=?, perm_pos_mixed=?, perm_last_invoice_reprint=?, default_screen=?,
        password_hash=?
      WHERE id=?
    `).run(...commonParams, hash, targetUserId);
  } else {
    db.prepare(`
      UPDATE users SET
        username=?, name=?, name_en=?, user_number=?, department=?, job_title=?, start_date=?, end_date=?,
        work_start_time=?, work_end_time=?, force_password_change=?, restrict_devices=?, allow_self_service=?,
        is_cashier=?, is_customer_rep=?, is_pos_user=?, is_handheld_user=?, allowed_devices=?, default_safe_id=?, customer_id=?, fingerprint_id=?, pos_permission_template=?, is_system_admin=?,
        role=?, active=?, can_discount=?, allow_meal_deduction=?,
        email=?, phone=?, avatar_url=?, default_branch_id=?, language=?, timezone=?, status=?, full_name=?,
        employee_id=?, branch_id=?, group_id=?,
        is_suspended=?, suspended_date=?, suspended_reason=?,
        updated_by=?, updated_at=?, edit_count = COALESCE(edit_count, 0) + 1,
        perm_create_invoice=?, perm_edit_invoice=?, perm_cancel_invoice=?, perm_return=?, perm_view_prices=?, perm_view_profits=?,
        perm_edit_stock=?, perm_stocktake=?, perm_edit_entries=?, perm_close_periods=?, perm_view_salaries=?,
        perm_pos_only=?, perm_pos_discount=?, perm_pos_employee_invoice=?, perm_pos_delivery=?, perm_pos_dinein=?, perm_pos_takeaway=?,
        perm_pos_credit=?, perm_pos_cash=?, perm_pos_card=?, perm_pos_mixed=?, perm_last_invoice_reprint=?, default_screen=?
      WHERE id=?
    `).run(...commonParams, targetUserId);
  }

  // If role or admin status changed, update default screen permissions for the new role
  if ((role && role !== targetUser.role) || Boolean(targetUser.is_system_admin) !== targetIsAdmin) {
    try {
      seedUserScreenPermissions(targetUserId, targetRole, targetIsAdmin, user.name || "مدير النظام", nowStr);
    } catch (e) {
      console.error("Error updating user screen permissions on role change:", e);
    }
  }

  const u = db.prepare(`${USER_SELECT_SQL} WHERE u.id=?`).get(targetUserId) as any;

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `تعديل بيانات المستخدم: ${name || targetUser.name} (${username || targetUser.username})`,
      actionType: "update",
      entityType: "users",
      entityId: targetUserId,
      details: `تم تعديل بيانات المستخدم بنجاح. الدور: ${targetRole}`
    });
  }

  res.json(toUser(u));
});

router.delete("/users/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }
  
  const targetUser = db.prepare("SELECT id, username, name, role, active FROM users WHERE id=?").get(req.params.id) as any;
  if (!targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  
  if (targetUser.id === 2) { res.status(403).json({ error: "لا يمكن حذف حساب المطور" }); return; }
  
  if (targetUser.role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح بحذف حساب المطور" });
    return;
  }

  const ordersCount = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?").get(req.params.id) as { c: number }).c;
  const shiftsCount = (db.prepare("SELECT COUNT(*) as c FROM cash_shifts WHERE user_id = ?").get(req.params.id) as { c: number }).c;
  const journalCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries WHERE user_id = ?").get(req.params.id) as { c: number }).c;

  if (ordersCount > 0 || shiftsCount > 0 || journalCount > 0) {
    res.status(400).json({
      error: "لا يمكن حذف هذا المستخدم نظراً لوجود عمليات بيع، مناوبات نقدية، أو قيود محاسبية مسجلة باسمه في النظام. يُرجى إلغاء تفعيل حسابه وتعطيله بدلاً من الحذف للحفاظ على سلامة وتكامل السجلات المالية."
    });
    return;
  }
  
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `حذف المستخدم: ${targetUser.name} (${targetUser.username})`,
      actionType: "delete",
      entityType: "users",
      entityId: Number(req.params.id),
      details: `تم حذف حساب المستخدم بنجاح بعد التأكد من خلوه من الارتباطات المالية في النظام`
    });
  }

  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// User Groups Endpoints (واجهة مجموعة المستخدمين وربط المستخدمين والصلاحيات على مستوى المجموعة)
// ─────────────────────────────────────────────────────────────────────────────

function formatUserGroup(g: any) {
  const linkedUsers = db.prepare(`
    SELECT id, username, name, role, active, status, branch_id, employee_id
    FROM users
    WHERE group_id = ? AND role != 'developer'
    ORDER BY id ASC
  `).all(g.id) as any[];

  return {
    id: g.id,
    group_number: Number(g.group_number),
    name_ar: g.name_ar,
    name_en: g.name_en || "",
    is_system_admin: Boolean(g.is_system_admin),
    is_suspended: Boolean(g.is_suspended),
    suspended_date: g.suspended_date || "",
    suspended_reason: g.suspended_reason || "",
    notes: g.notes || "",
    can_discount: Boolean(g.is_system_admin || g.can_discount),
    perm_create_invoice: Boolean(g.is_system_admin || g.perm_create_invoice),
    perm_edit_invoice: Boolean(g.is_system_admin || g.perm_edit_invoice),
    perm_cancel_invoice: Boolean(g.is_system_admin || g.perm_cancel_invoice),
    perm_return: Boolean(g.is_system_admin || g.perm_return),
    perm_view_prices: Boolean(g.is_system_admin || g.perm_view_prices),
    perm_view_profits: Boolean(g.is_system_admin || g.perm_view_profits),
    perm_edit_stock: Boolean(g.is_system_admin || g.perm_edit_stock),
    perm_stocktake: Boolean(g.is_system_admin || g.perm_stocktake),
    perm_edit_entries: Boolean(g.is_system_admin || g.perm_edit_entries),
    perm_close_periods: Boolean(g.is_system_admin || g.perm_close_periods),
    perm_view_salaries: Boolean(g.is_system_admin || g.perm_view_salaries),
    can_void_bills: Boolean(g.is_system_admin || g.can_void_bills),
    can_view_cost: Boolean(g.is_system_admin || g.can_view_cost),
    can_change_currencies: Boolean(g.is_system_admin || g.can_change_currencies),
    can_approve_returns: Boolean(g.is_system_admin || g.can_approve_returns),
    can_open_close_safe: Boolean(g.is_system_admin || g.can_open_close_safe),
    can_transfer_funds: Boolean(g.is_system_admin || g.can_transfer_funds),
    can_edit_products: Boolean(g.is_system_admin || g.can_edit_products),
    can_delete_orders: Boolean(g.is_system_admin || g.can_delete_orders),
    perm_last_invoice_reprint: g.perm_last_invoice_reprint && String(g.perm_last_invoice_reprint).trim() !== ""
      ? String(g.perm_last_invoice_reprint).trim()
      : "all",
    created_by: g.created_by || "مدير النظام",
    created_at: g.created_at || "2026-07-18 07:30:00",
    updated_by: g.updated_by || null,
    updated_at: g.updated_at || null,
    edit_count: Number(g.edit_count || 0),
    users_count: linkedUsers.length,
    linked_users: linkedUsers
  };
}

function applyGroupPermissionsToLinkedUsers(groupId: number) {
  const g = db.prepare("SELECT * FROM user_groups WHERE id=?").get(groupId) as any;
  if (!g) return 0;
  const isSysAdmin = Boolean(g.is_system_admin);
  const lastInvPerm = g.perm_last_invoice_reprint && String(g.perm_last_invoice_reprint).trim() !== ""
    ? String(g.perm_last_invoice_reprint).trim()
    : "all";
  const res = db.prepare(`
    UPDATE users SET
      can_discount = ?,
      perm_create_invoice = ?,
      perm_edit_invoice = ?,
      perm_cancel_invoice = ?,
      perm_return = ?,
      perm_view_prices = ?,
      perm_view_profits = ?,
      perm_edit_stock = ?,
      perm_stocktake = ?,
      perm_edit_entries = ?,
      perm_close_periods = ?,
      perm_view_salaries = ?,
      perm_last_invoice_reprint = ?
    WHERE group_id = ? AND role != 'developer'
  `).run(
    isSysAdmin || g.can_discount ? 1 : 0,
    isSysAdmin || g.perm_create_invoice ? 1 : 0,
    isSysAdmin || g.perm_edit_invoice ? 1 : 0,
    isSysAdmin || g.perm_cancel_invoice ? 1 : 0,
    isSysAdmin || g.perm_return ? 1 : 0,
    isSysAdmin || g.perm_view_prices ? 1 : 0,
    isSysAdmin || g.perm_view_profits ? 1 : 0,
    isSysAdmin || g.perm_edit_stock ? 1 : 0,
    isSysAdmin || g.perm_stocktake ? 1 : 0,
    isSysAdmin || g.perm_edit_entries ? 1 : 0,
    isSysAdmin || g.perm_close_periods ? 1 : 0,
    isSysAdmin || g.perm_view_salaries ? 1 : 0,
    lastInvPerm,
    groupId
  );
  return res.changes;
}

router.get("/user-groups", (req, res) => {
  try {
    const groups = db.prepare("SELECT * FROM user_groups ORDER BY group_number ASC, id ASC").all() as any[];
    res.json(groups.map(formatUserGroup));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/user-groups", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const {
    group_number, name_ar, name_en, is_system_admin, is_suspended, suspended_date, suspended_reason, notes,
    can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return,
    perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake,
    perm_edit_entries, perm_close_periods, perm_view_salaries,
    can_void_bills, can_view_cost, can_change_currencies, can_approve_returns,
    can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders
  } = req.body;

  if (!name_ar || !String(name_ar).trim()) {
    res.status(400).json({ error: "اسم المجموعة بالعربية مطلوب" });
    return;
  }

  try {
    const maxNum = (db.prepare("SELECT MAX(group_number) as m FROM user_groups").get() as { m: number | null })?.m || 0;
    const grpNum = group_number ? Number(group_number) : maxNum + 1;
    const exists = db.prepare("SELECT id FROM user_groups WHERE group_number = ?").get(grpNum);
    if (exists) {
      res.status(400).json({ error: `رقم المجموعة (${grpNum}) مستخدم مسبقاً لمجموعة أخرى` });
      return;
    }

    const isSys = is_system_admin ? 1 : 0;
    const isSusp = is_suspended ? 1 : 0;
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    const r = db.prepare(`
      INSERT INTO user_groups (
        group_number, name_ar, name_en, is_system_admin, is_suspended, suspended_date, suspended_reason, notes,
        can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return,
        perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake,
        perm_edit_entries, perm_close_periods, perm_view_salaries,
        can_void_bills, can_view_cost, can_change_currencies, can_approve_returns,
        can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders,
        created_by, created_at, edit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      grpNum,
      String(name_ar).trim(),
      name_en ? String(name_en).trim() : null,
      isSys,
      isSusp,
      isSusp ? (suspended_date || nowStr.slice(0, 10)) : null,
      isSusp ? (suspended_reason || null) : null,
      notes || null,
      isSys || can_discount ? 1 : 0,
      isSys || perm_create_invoice !== false ? 1 : 0,
      isSys || perm_edit_invoice !== false ? 1 : 0,
      isSys || perm_cancel_invoice ? 1 : 0,
      isSys || perm_return ? 1 : 0,
      isSys || perm_view_prices !== false ? 1 : 0,
      isSys || perm_view_profits ? 1 : 0,
      isSys || perm_edit_stock ? 1 : 0,
      isSys || perm_stocktake ? 1 : 0,
      isSys || perm_edit_entries ? 1 : 0,
      isSys || perm_close_periods ? 1 : 0,
      isSys || perm_view_salaries ? 1 : 0,
      isSys || can_void_bills ? 1 : 0,
      isSys || can_view_cost ? 1 : 0,
      isSys || can_change_currencies ? 1 : 0,
      isSys || can_approve_returns ? 1 : 0,
      isSys || can_open_close_safe ? 1 : 0,
      isSys || can_transfer_funds ? 1 : 0,
      isSys || can_edit_products ? 1 : 0,
      isSys || can_delete_orders ? 1 : 0,
      user.name || "مدير النظام",
      nowStr
    );

    const created = db.prepare("SELECT * FROM user_groups WHERE id=?").get(r.lastInsertRowid) as any;

    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `تعريف مجموعة مستخدمين جديدة: ${name_ar} (رقم ${grpNum})`,
      actionType: "create",
      entityType: "user_groups",
      entityId: Number(r.lastInsertRowid),
      details: `تم إنشاء مجموعة المستخدمين: ${name_ar} (${name_en || "—"})`
    });

    res.status(201).json(formatUserGroup(created));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/user-groups/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const existing = db.prepare("SELECT * FROM user_groups WHERE id=?").get(req.params.id) as any;
  if (!existing) { res.status(404).json({ error: "مجموعة المستخدمين غير موجودة" }); return; }

  const {
    group_number, name_ar, name_en, is_system_admin, is_suspended, suspended_date, suspended_reason, notes,
    can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return,
    perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake,
    perm_edit_entries, perm_close_periods, perm_view_salaries,
    can_void_bills, can_view_cost, can_change_currencies, can_approve_returns,
    can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders,
    perm_last_invoice_reprint,
    sync_users
  } = req.body;

  if (!name_ar || !String(name_ar).trim()) {
    res.status(400).json({ error: "اسم المجموعة بالعربية مطلوب" });
    return;
  }

  try {
    const grpNum = group_number ? Number(group_number) : existing.group_number;
    const dup = db.prepare("SELECT id FROM user_groups WHERE group_number = ? AND id != ?").get(grpNum, req.params.id);
    if (dup) {
      res.status(400).json({ error: `رقم المجموعة (${grpNum}) مستخدم مسبقاً لمجموعة أخرى` });
      return;
    }

    const isSys = is_system_admin ? 1 : 0;
    const isSusp = is_suspended ? 1 : 0;
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

    db.prepare(`
      UPDATE user_groups SET
        group_number = ?, name_ar = ?, name_en = ?, is_system_admin = ?,
        is_suspended = ?, suspended_date = ?, suspended_reason = ?, notes = ?,
        can_discount = ?, perm_create_invoice = ?, perm_edit_invoice = ?, perm_cancel_invoice = ?, perm_return = ?,
        perm_view_prices = ?, perm_view_profits = ?, perm_edit_stock = ?, perm_stocktake = ?,
        perm_edit_entries = ?, perm_close_periods = ?, perm_view_salaries = ?,
        can_void_bills = ?, can_view_cost = ?, can_change_currencies = ?, can_approve_returns = ?,
        can_open_close_safe = ?, can_transfer_funds = ?, can_edit_products = ?, can_delete_orders = ?,
        perm_last_invoice_reprint = ?,
        updated_by = ?, updated_at = ?, edit_count = COALESCE(edit_count, 0) + 1
      WHERE id = ?
    `).run(
      grpNum,
      String(name_ar).trim(),
      name_en !== undefined ? (name_en ? String(name_en).trim() : null) : existing.name_en,
      isSys,
      isSusp,
      isSusp ? (suspended_date || existing.suspended_date || nowStr.slice(0, 10)) : null,
      isSusp ? (suspended_reason !== undefined ? suspended_reason : existing.suspended_reason) : null,
      notes !== undefined ? notes : existing.notes,
      isSys || can_discount ? 1 : 0,
      isSys || perm_create_invoice ? 1 : 0,
      isSys || perm_edit_invoice ? 1 : 0,
      isSys || perm_cancel_invoice ? 1 : 0,
      isSys || perm_return ? 1 : 0,
      isSys || perm_view_prices ? 1 : 0,
      isSys || perm_view_profits ? 1 : 0,
      isSys || perm_edit_stock ? 1 : 0,
      isSys || perm_stocktake ? 1 : 0,
      isSys || perm_edit_entries ? 1 : 0,
      isSys || perm_close_periods ? 1 : 0,
      isSys || perm_view_salaries ? 1 : 0,
      isSys || can_void_bills ? 1 : 0,
      isSys || can_view_cost ? 1 : 0,
      isSys || can_change_currencies ? 1 : 0,
      isSys || can_approve_returns ? 1 : 0,
      isSys || can_open_close_safe ? 1 : 0,
      isSys || can_transfer_funds ? 1 : 0,
      isSys || can_edit_products ? 1 : 0,
      isSys || can_delete_orders ? 1 : 0,
      perm_last_invoice_reprint !== undefined ? String(perm_last_invoice_reprint) : (existing.perm_last_invoice_reprint || "all"),
      user.name || "مدير النظام",
      nowStr,
      req.params.id
    );

    // Automatically propagate permissions to all users in this group unless explicitly disabled
    if (sync_users !== false) {
      applyGroupPermissionsToLinkedUsers(Number(req.params.id));
    }

    const updated = db.prepare("SELECT * FROM user_groups WHERE id=?").get(req.params.id) as any;

    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `تعديل مجموعة المستخدمين: ${name_ar} (رقم ${grpNum})`,
      actionType: "update",
      entityType: "user_groups",
      entityId: Number(req.params.id),
      details: `تم تحديث بيانات وصلاحيات المجموعة وتعميمها على المستخدمين المرتبطين`
    });

    res.json(formatUserGroup(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/user-groups/:id/link-user", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const groupId = Number(req.params.id);
  const { user_id } = req.body;
  if (!user_id) { res.status(400).json({ error: "يرجى اختيار المستخدم المراد ربطه بالمجموعة" }); return; }

  const grp = db.prepare("SELECT * FROM user_groups WHERE id=?").get(groupId) as any;
  if (!grp) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }

  const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(Number(user_id)) as any;
  if (!targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare("UPDATE users SET group_id=?, updated_by=?, updated_at=?, edit_count=COALESCE(edit_count,0)+1 WHERE id=?")
    .run(groupId, user.name || "مدير النظام", nowStr, Number(user_id));

  applyGroupPermissionsToLinkedUsers(groupId);

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: `ربط المستخدم (${targetUser.name}) بمجموعة (${grp.name_ar})`,
    actionType: "update",
    entityType: "user_groups",
    entityId: groupId,
    details: `تم ربط المستخدم بالمجموعة وتطبيق صلاحيات المجموعة عليه تلقائياً`
  });

  res.json(formatUserGroup(grp));
});

router.post("/user-groups/:id/unlink-user", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const groupId = Number(req.params.id);
  const { user_id } = req.body;
  if (!user_id) { res.status(400).json({ error: "يرجى تحديد المستخدم" }); return; }

  const grp = db.prepare("SELECT * FROM user_groups WHERE id=?").get(groupId) as any;
  if (!grp) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare("UPDATE users SET group_id=NULL, updated_by=?, updated_at=?, edit_count=COALESCE(edit_count,0)+1 WHERE id=? AND group_id=?")
    .run(user.name || "مدير النظام", nowStr, Number(user_id), groupId);

  res.json(formatUserGroup(grp));
});

router.post("/user-groups/:id/apply-permissions", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const groupId = Number(req.params.id);
  const grp = db.prepare("SELECT * FROM user_groups WHERE id=?").get(groupId) as any;
  if (!grp) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }

  const count = applyGroupPermissionsToLinkedUsers(groupId);

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: `تعميم صلاحيات مجموعة (${grp.name_ar}) على المستخدمين`,
    actionType: "update",
    entityType: "user_groups",
    entityId: groupId,
    details: `تم تطبيق صلاحيات المجموعة على (${count}) مستخدمين مرتبطين بها`
  });

  res.json({ success: true, updated_users: count, group: formatUserGroup(grp) });
});

router.delete("/user-groups/:id", (req, res) => {
  const user = getAuthUserWithFallback(req);
  if (!user || (!isAdminRole(user.role) && user.username !== "admin")) { res.status(403).json({ error: "غير مصرح" }); return; }

  const groupId = Number(req.params.id);
  const grp = db.prepare("SELECT * FROM user_groups WHERE id=?").get(groupId) as any;
  if (!grp) { res.status(404).json({ error: "المجموعة غير موجودة" }); return; }

  const linkedCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE group_id=? AND role != 'developer'").get(groupId) as { c: number }).c;
  if (linkedCount > 0 && req.query.force !== "true") {
    res.status(400).json({
      error: `لا يمكن حذف المجموعة (${grp.name_ar}) لوجود (${linkedCount}) مستخدمين مرتبطين بها حالياً. يرجى نقل المستخدمين لمجموعة أخرى أو فك ارتباطهم أولاً.`
    });
    return;
  }

  db.prepare("UPDATE users SET group_id=NULL WHERE group_id=?").run(groupId);
  db.prepare("DELETE FROM user_groups WHERE id=?").run(groupId);

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: `حذف مجموعة المستخدمين: ${grp.name_ar} (رقم ${grp.group_number})`,
    actionType: "delete",
    entityType: "user_groups",
    entityId: groupId,
    details: `تم حذف مجموعة المستخدمين من النظام`
  });

  res.status(204).send();
});

// ─── مسارات صلاحيات استخدام الشاشات للمستخدمين (Screen Permissions) ───

// 1. جلب شجرة ودليل شاشات النظام الكامل
router.get("/system-screens", (req, res) => {
  try {
    const screens = db.prepare("SELECT * FROM system_screens ORDER BY sort_order ASC, screen_number ASC").all();
    res.json(screens);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. جلب صلاحيات شاشات المستخدم الحالي المسجل
router.get("/me/screen-permissions", (req, res) => {
  try {
    const user = getAuthUserWithFallback(req);
    if (!user) {
      res.json({ isAdmin: false, isDeveloper: false, permissions: {} });
      return;
    }

    const isDev = user.role === "developer" || user.username === "developer";
    const isAdmin = isDev || isAdminRole(user.role) || user.username === "admin" || Boolean(user.is_system_admin);

    if (isDev) {
      // Full access to all screens including Developer licenses screen #900
      const allScreens = db.prepare("SELECT screen_number FROM system_screens").all() as any[];
      const map: Record<number, any> = {};
      for (const s of allScreens) {
        map[s.screen_number] = {
          can_check: 1, can_print: 1, can_view_report: 1, can_add: 1,
          can_edit: 1, can_delete: 1, can_view: 1, can_review: 1, can_post: 1
        };
      }
      res.json({ isAdmin: true, isDeveloper: true, permissions: map });
      return;
    }

    // Check user-specific permissions from database
    const allScreens = db.prepare("SELECT screen_number, path, module_name FROM system_screens WHERE screen_number != 112").all() as any[];
    const userPerms = db.prepare("SELECT * FROM user_screen_permissions WHERE user_id=?").all(user.id) as any[];
    const map: Record<number, any> = {};

    if (user.username === "admin" || (isAdmin && !userPerms.some(p => p.updated_at != null))) {
      for (const s of allScreens) {
        const isScreen900 = Number(s.screen_number) === 900;
        const val = isScreen900 ? 0 : 1;
        map[s.screen_number] = {
          can_check: val, can_print: val, can_view_report: val, can_add: val,
          can_edit: val, can_delete: val, can_view: val, can_review: val, can_post: val
        };
      }
      res.json({ isAdmin: true, isDeveloper: false, permissions: map });
      return;
    }

    if (userPerms.length > 0) {
      for (const p of userPerms) {
        // Screen 900 is strictly 0 for all non-developer users
        const isScreen900 = Number(p.screen_number) === 900;
        map[p.screen_number] = {
          can_check: isScreen900 ? 0 : (p.can_check ? 1 : 0),
          can_print: isScreen900 ? 0 : (p.can_print ? 1 : 0),
          can_view_report: isScreen900 ? 0 : (p.can_view_report ? 1 : 0),
          can_add: isScreen900 ? 0 : (p.can_add ? 1 : 0),
          can_edit: isScreen900 ? 0 : (p.can_edit ? 1 : 0),
          can_delete: isScreen900 ? 0 : (p.can_delete ? 1 : 0),
          can_view: isScreen900 ? 0 : (p.can_view ? 1 : 0),
          can_review: isScreen900 ? 0 : (p.can_review ? 1 : 0),
          can_post: isScreen900 ? 0 : (p.can_post ? 1 : 0)
        };
      }
      for (const s of allScreens) {
        if (!map[s.screen_number]) {
          const allowed = getDefaultScreenAllowed(user.role, isAdmin, s);
          map[s.screen_number] = {
            can_check: allowed ? 1 : 0,
            can_print: allowed ? 1 : 0,
            can_view_report: allowed ? 1 : 0,
            can_add: allowed ? 1 : 0,
            can_edit: allowed ? 1 : 0,
            can_delete: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0,
            can_view: allowed ? 1 : 0,
            can_review: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0,
            can_post: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0
          };
        }
      }
    } else {
      // Fallback based on role if no explicit rows exist yet
      for (const s of allScreens) {
        const allowed = getDefaultScreenAllowed(user.role, isAdmin, s);
        map[s.screen_number] = {
          can_check: allowed ? 1 : 0,
          can_print: allowed ? 1 : 0,
          can_view_report: allowed ? 1 : 0,
          can_add: allowed ? 1 : 0,
          can_edit: allowed ? 1 : 0,
          can_delete: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0,
          can_view: allowed ? 1 : 0,
          can_review: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0,
          can_post: (isAdmin && Number(s.screen_number) !== 900) ? 1 : 0
        };
      }
    }

    res.json({ isAdmin, isDeveloper: false, permissions: map });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. جلب مصفوفة صلاحيات الشاشات لمستخدم معين
router.get("/users/:id/screen-permissions", (req, res) => {
  const authUser = getAuthUserWithFallback(req);
  if (!authUser || (!isAdminRole(authUser.role) && authUser.username !== "admin")) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const targetUserId = Number(req.params.id);
  const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const isTargetDev = targetUser.role === "developer" || targetUser.username === "developer";
  const isTargetAdmin = isTargetDev || isAdminRole(targetUser.role) || targetUser.username === "admin" || Boolean(targetUser.is_system_admin);

  const allScreens = db.prepare("SELECT * FROM system_screens ORDER BY sort_order ASC, screen_number ASC").all() as any[];
  const existingPerms = db.prepare("SELECT * FROM user_screen_permissions WHERE user_id=?").all(targetUserId) as any[];
  const permMap = new Map<number, any>();
  for (const p of existingPerms) {
    permMap.set(p.screen_number, p);
  }

  const result = allScreens.map(scr => {
    const isScr900 = Number(scr.screen_number) === 900;
    const userP = permMap.get(scr.screen_number);

    if (userP) {
      return {
        screen_number: scr.screen_number,
        screen_name: scr.screen_name,
        module_name: scr.module_name,
        submodule_name: scr.submodule_name,
        category_type: scr.category_type,
        is_developer_only: isScr900,
        can_check: isScr900 ? isTargetDev : Boolean(userP.can_check),
        can_print: isScr900 ? isTargetDev : Boolean(userP.can_print),
        can_view_report: isScr900 ? isTargetDev : Boolean(userP.can_view_report),
        can_add: isScr900 ? isTargetDev : Boolean(userP.can_add),
        can_edit: isScr900 ? isTargetDev : Boolean(userP.can_edit),
        can_delete: isScr900 ? isTargetDev : Boolean(userP.can_delete),
        can_view: isScr900 ? isTargetDev : Boolean(userP.can_view),
        can_review: isScr900 ? isTargetDev : Boolean(userP.can_review),
        can_post: isScr900 ? isTargetDev : Boolean(userP.can_post),
        created_by: userP.created_by,
        created_at: userP.created_at,
        updated_by: userP.updated_by,
        updated_at: userP.updated_at
      };
    } else {
      const allowed = getDefaultScreenAllowed(targetUser.role, isTargetAdmin, scr);
      return {
        screen_number: scr.screen_number,
        screen_name: scr.screen_name,
        module_name: scr.module_name,
        submodule_name: scr.submodule_name,
        category_type: scr.category_type,
        is_developer_only: isScr900,
        can_check: allowed,
        can_print: isScr900 ? isTargetDev : (isTargetAdmin ? true : allowed),
        can_view_report: isScr900 ? isTargetDev : (isTargetAdmin ? true : allowed),
        can_add: isScr900 ? isTargetDev : (isTargetAdmin ? true : allowed),
        can_edit: isScr900 ? isTargetDev : (isTargetAdmin ? true : allowed),
        can_delete: isScr900 ? isTargetDev : (isTargetAdmin ? true : false),
        can_view: isScr900 ? isTargetDev : (isTargetAdmin ? true : allowed),
        can_review: isScr900 ? isTargetDev : (isTargetAdmin ? true : false),
        can_post: isScr900 ? isTargetDev : (isTargetAdmin ? true : false),
        created_by: targetUser.created_by || "مدير النظام",
        created_at: targetUser.created_at || "18/07/2026 07:30:00",
        updated_by: targetUser.updated_by,
        updated_at: targetUser.updated_at
      };
    }
  });

  res.json({
    user: {
      id: targetUser.id,
      user_number: targetUser.user_number || targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      role: targetUser.role,
      is_system_admin: Boolean(targetUser.is_system_admin || isTargetAdmin),
      is_developer: isTargetDev,
      created_by: targetUser.created_by || "مدير النظام",
      created_at: targetUser.created_at || "18/07/2026 07:30:00",
      updated_by: targetUser.updated_by,
      updated_at: targetUser.updated_at,
      edit_count: targetUser.edit_count || 0
    },
    screens: result
  });
});

// 4. حفظ وتحديث مصفوفة صلاحيات الشاشات لمستخدم
router.put("/users/:id/screen-permissions", (req, res) => {
  const authUser = getAuthUserWithFallback(req);
  if (!authUser || (!isAdminRole(authUser.role) && authUser.username !== "admin")) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const targetUserId = Number(req.params.id);
  if (targetUserId === 2) {
    res.status(403).json({ error: "غير مصرح بتعديل صلاحيات حساب المطور" });
    return;
  }

  const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(targetUserId) as any;
  if (!targetUser) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  if (targetUser.role === "developer" && authUser.role !== "developer") {
    res.status(403).json({ error: "غير مصرح بتعديل صلاحيات حساب المطور" });
    return;
  }

  const { screens } = req.body;
  if (!Array.isArray(screens)) {
    res.status(400).json({ error: "قائمة الشاشات غير صالحة" });
    return;
  }

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  let hasNonPosScreens = false;
  let hasPosScreen = false;

  for (const s of screens) {
    const scrNum = Number(s.screen_number);
    const isChecked = Boolean(s.can_check || s.can_view);
    if (isChecked) {
      if (scrNum === 60 || scrNum === 66) {
        hasPosScreen = true;
      } else if (scrNum !== 900) {
        hasNonPosScreens = true;
      }
    }
  }

  const delStmt = db.prepare("DELETE FROM user_screen_permissions WHERE user_id=?");
  const insStmt = db.prepare(`
    INSERT INTO user_screen_permissions (
      user_id, screen_number, screen_name, module_name, submodule_name,
      can_check, can_print, can_view_report, can_add, can_edit, can_delete,
      can_view, can_review, can_post, created_by, created_at, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    delStmt.run(targetUserId);
    for (const s of screens) {
      const isScr900 = Number(s.screen_number) === 900;
      // Screen 900 is strictly forbidden to non-developers
      insStmt.run(
        targetUserId,
        Number(s.screen_number),
        s.screen_name,
        s.module_name || "",
        s.submodule_name || "",
        isScr900 ? 0 : (s.can_check ? 1 : 0),
        isScr900 ? 0 : (s.can_print ? 1 : 0),
        isScr900 ? 0 : (s.can_view_report ? 1 : 0),
        isScr900 ? 0 : (s.can_add ? 1 : 0),
        isScr900 ? 0 : (s.can_edit ? 1 : 0),
        isScr900 ? 0 : (s.can_delete ? 1 : 0),
        isScr900 ? 0 : (s.can_view ? 1 : 0),
        isScr900 ? 0 : (s.can_review ? 1 : 0),
        isScr900 ? 0 : (s.can_post ? 1 : 0),
        targetUser.created_by || "مدير النظام",
        targetUser.created_at || nowStr,
        authUser.name || "مدير النظام",
        nowStr
      );
    }

    // Automatically sync perm_pos_only
    const newPosOnly = hasNonPosScreens ? 0 : (hasPosScreen ? 1 : (targetUser.role === "cashier" ? 1 : 0));
    db.prepare("UPDATE users SET perm_pos_only=?, updated_by=?, updated_at=?, edit_count=COALESCE(edit_count,0)+1 WHERE id=?")
      .run(newPosOnly, authUser.name || "مدير النظام", nowStr, targetUserId);
  });

  tx();

  recordAuditLog({
    userId: authUser.id,
    userName: authUser.name,
    action: `تحديث وتخصيص صلاحيات الشاشات للمستخدم: ${targetUser.name} (${targetUser.username})`,
    actionType: "update",
    entityType: "users",
    entityId: targetUserId,
    details: `تم تعديل وتطبيق مصفوفة صلاحيات الشاشات (${screens.length}) شاشة بنجاح`
  });

  res.json({ success: true, count: screens.length, updated_at: nowStr });
});

// 5. نسخ صلاحيات الشاشات من مستخدم لآخر
router.post("/users/:id/screen-permissions/copy-from", (req, res) => {
  const authUser = getAuthUserWithFallback(req);
  if (!authUser || (!isAdminRole(authUser.role) && authUser.username !== "admin")) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const targetUserId = Number(req.params.id);
  if (targetUserId === 2) {
    res.status(403).json({ error: "غير مصرح بنسخ صلاحيات على حساب المطور" });
    return;
  }

  const { source_user_id } = req.body;
  if (!source_user_id) {
    res.status(400).json({ error: "يرجى تحديد المستخدم المراد نسخ الصلاحيات منه" });
    return;
  }

  const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(targetUserId) as any;
  const sourceUser = db.prepare("SELECT * FROM users WHERE id=?").get(Number(source_user_id)) as any;
  if (!targetUser || !sourceUser) {
    res.status(404).json({ error: "أحد المستخدمين غير موجود" });
    return;
  }

  let sourcePerms = db.prepare("SELECT * FROM user_screen_permissions WHERE user_id=?").all(Number(source_user_id)) as any[];
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (sourcePerms.length === 0) {
    const isSrcAdmin = isAdminRole(sourceUser.role) || sourceUser.username === "admin" || Boolean(sourceUser.is_system_admin);
    const allScreens = db.prepare("SELECT * FROM system_screens").all() as any[];
    sourcePerms = allScreens.map(scr => {
      const allowed = getDefaultScreenAllowed(sourceUser.role, isSrcAdmin, scr);
      return {
        screen_number: scr.screen_number,
        screen_name: scr.screen_name,
        module_name: scr.module_name,
        submodule_name: scr.submodule_name,
        can_check: allowed ? 1 : 0,
        can_print: allowed ? 1 : 0,
        can_view_report: allowed ? 1 : 0,
        can_add: allowed ? 1 : 0,
        can_edit: allowed ? 1 : 0,
        can_delete: (isSrcAdmin && Number(scr.screen_number) !== 900) ? 1 : 0,
        can_view: allowed ? 1 : 0,
        can_review: (isSrcAdmin && Number(scr.screen_number) !== 900) ? 1 : 0,
        can_post: (isSrcAdmin && Number(scr.screen_number) !== 900) ? 1 : 0
      };
    });
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM user_screen_permissions WHERE user_id=?").run(targetUserId);
    const insStmt = db.prepare(`
      INSERT INTO user_screen_permissions (
        user_id, screen_number, screen_name, module_name, submodule_name,
        can_check, can_print, can_view_report, can_add, can_edit, can_delete,
        can_view, can_review, can_post, created_by, created_at, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of sourcePerms) {
      const isScr900 = Number(s.screen_number) === 900;
      insStmt.run(
        targetUserId, s.screen_number, s.screen_name, s.module_name, s.submodule_name,
        isScr900 ? 0 : (s.can_check ? 1 : 0),
        isScr900 ? 0 : (s.can_print ? 1 : 0),
        isScr900 ? 0 : (s.can_view_report ? 1 : 0),
        isScr900 ? 0 : (s.can_add ? 1 : 0),
        isScr900 ? 0 : (s.can_edit ? 1 : 0),
        isScr900 ? 0 : (s.can_delete ? 1 : 0),
        isScr900 ? 0 : (s.can_view ? 1 : 0),
        isScr900 ? 0 : (s.can_review ? 1 : 0),
        isScr900 ? 0 : (s.can_post ? 1 : 0),
        authUser.name || "مدير النظام", nowStr, authUser.name || "مدير النظام", nowStr
      );
    }

    db.prepare("UPDATE users SET updated_by=?, updated_at=?, edit_count=COALESCE(edit_count,0)+1 WHERE id=?")
      .run(authUser.name || "مدير النظام", nowStr, targetUserId);
  });

  tx();

  recordAuditLog({
    userId: authUser.id,
    userName: authUser.name,
    action: `نسخ صلاحيات الشاشات من (${sourceUser.name}) إلى (${targetUser.name})`,
    actionType: "update",
    entityType: "users",
    entityId: targetUserId,
    details: `تم استنساخ صلاحيات الشاشات بالكامل بنجاح`
  });

  res.json({ success: true, count: sourcePerms.length });
});

export default router;
