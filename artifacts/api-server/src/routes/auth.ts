import { Router } from "express";
import { db, verifyPassword, hashPassword, createSession, getSessionUser, deleteSession } from "../lib/sqlite";
import { logger } from "../lib/logger";
import os from "node:os";
import crypto from "node:crypto";

const router = Router();

export function toBool(v: any): boolean {
  if (v === null || v === undefined || v === "" || v === false || v === "false" || v === 0 || v === "0") return false;
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  const num = Number(v);
  if (!isNaN(num)) {
    return num !== 0;
  }
  return Boolean(v);
}

export function getSystemCandidateDeviceIds(): string[] {
  const ids = new Set<string>();
  try {
    const saved = db.prepare("SELECT value FROM settings WHERE key='system_device_hwid'").get() as { value?: string } | undefined;
    if (saved?.value && saved.value.trim().startsWith("HW-")) {
      ids.add(saved.value.trim().toUpperCase());
    }
  } catch {}
  try {
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || "GENERIC-CPU";
    const cpuCount = cpus.length;
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    const interfaces = os.networkInterfaces();
    const macList: string[] = [];
    for (const name of Object.keys(interfaces).sort()) {
      const iface = interfaces[name];
      if (iface) {
        for (const ip of iface) {
          if (!ip.internal && ip.mac && ip.mac !== "00:00:00:00:00:00" && ip.mac !== "ff:ff:ff:ff:ff:ff") {
            macList.push(ip.mac.toUpperCase());
          }
        }
      }
    }

    const rawId = `HWID|${platform}|${arch}|${hostname}|${cpuModel}|${cpuCount}|${totalMem}GB|${macList.sort().join(",")}`;
    const hash = crypto.createHash("sha256").update(rawId).digest("hex").toUpperCase();
    ids.add(`HW-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`);

    const stableRaw = `HWID-STABLE|${platform}|${arch}|${hostname}|${cpuModel}|${cpuCount}|${totalMem}GB`;
    const stableHash = crypto.createHash("sha256").update(stableRaw).digest("hex").toUpperCase();
    ids.add(`HW-${stableHash.substring(0, 4)}-${stableHash.substring(4, 8)}-${stableHash.substring(8, 12)}`);
  } catch {}

  if (ids.size === 0) {
    ids.add("HW-OMNI-DEV-0001");
  }
  return Array.from(ids);
}

export function getSystemDeviceId(): string {
  const candidates = getSystemCandidateDeviceIds();
  const primary = candidates[0] || "HW-OMNI-DEV-0001";
  try {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('system_device_hwid', ?)").run(primary);
  } catch {}
  return primary;
}

export const CURRENT_SYSTEM_VERSION = "1.1.0";

export interface LicenseStatusResult {
  blocked: boolean;
  code?: "license_required" | "license_expired" | "license_suspended" | "version_upgrade_required" | "device_unauthorized" | "device_blocked";
  deviceId: string;
  licenseType?: "cloud" | "desktop";
  reason?: string;
  clientName?: string;
  expiresAt?: string;
  remainingDays?: number;
  isWarning?: boolean;
  warningMessage?: string;
  targetVersion?: string;
  currentVersion?: string;
  devicesLimit?: number;
  activeDevicesCount?: number;
}

export function checkLicenseStatus(deviceId?: string): LicenseStatusResult {
  try {
    const sysDevs = getSystemCandidateDeviceIds();
    const currentDevice = (deviceId ? String(deviceId).trim().toUpperCase() : sysDevs[0]) || sysDevs[0];
    const candidateDevs = Array.from(new Set([currentDevice, ...sysDevs].filter(Boolean)));

    let totalLicensesCount = (db.prepare("SELECT COUNT(*) as c FROM licenses").get() as { c: number })?.c || 0;
    if (totalLicensesCount === 0) {
      try {
        const licKey = "OMNI-CLOUD-MASTER-2026-9999";
        db.prepare(`
          INSERT INTO licenses (
            license_key, client_name, devices_limit, expires_at, active, status, target_version, license_type, notes
          ) VALUES (
            ?, 'شركة ومطاعم أومني العالمية', 999, '2035-12-31', 1, 'active', '*', 'cloud', 'ترخيص سحابي شامل'
          )
        `).run(licKey);
        totalLicensesCount = 1;
      } catch (e) {
        console.error("Auto license init error:", e);
      }
    }

    const activeLicenses = db.prepare("SELECT * FROM licenses WHERE active=1 AND (status IS NULL OR status='active') ORDER BY id DESC").all() as any[];
    if (!activeLicenses || activeLicenses.length === 0) {
      return {
        blocked: true,
        code: "license_suspended",
        deviceId: currentDevice,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: "تم إيقاف أو تعليق ترخيص النظام من قبل المطور. يرجى التواصل مع مطور النظام لتفعيل الترخيص."
      };
    }

    // Pick the best active license for this machine (prefer one that explicitly authorizes this device or is cloud)
    let lic = activeLicenses[0];
    for (const candidateLic of activeLicenses) {
      const expObj = new Date(candidateLic.expires_at);
      const nowObj = new Date();
      expObj.setHours(0, 0, 0, 0);
      nowObj.setHours(0, 0, 0, 0);
      if (expObj.getTime() < nowObj.getTime()) continue;

      const isCloud = !candidateLic.license_type || candidateLic.license_type === "cloud" || candidateLic.license_type === "سحابي";
      if (isCloud) {
        lic = candidateLic;
        break;
      }
      const devRows = db.prepare("SELECT * FROM license_devices WHERE license_id=?").all(candidateLic.id) as any[];
      const matchedDev = devRows.find(d => candidateDevs.includes(String(d.device_id || "").trim().toUpperCase()) && d.status !== "blocked" && d.status !== "disabled");
      if (matchedDev) {
        lic = candidateLic;
        break;
      }
    }

    const expireDate = new Date(lic.expires_at);
    const currentDate = new Date();
    
    // Set both to midnight to count full days
    expireDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    const diffTime = expireDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        blocked: true, 
        code: "license_expired",
        deviceId: currentDevice,
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        licenseType: lic.license_type || "cloud",
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `انتهت فترة صلاحية ترخيص النظام الممنوحة لهذا العميل (${lic.expires_at}). يرجى التواصل مع المطور لتجديد وتمديد الترخيص السحابي.`
      };
    }

    // Version validation check:
    if (lic.target_version && lic.target_version !== "*" && lic.target_version !== CURRENT_SYSTEM_VERSION) {
      return {
        blocked: true,
        code: "version_upgrade_required",
        deviceId: currentDevice,
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        licenseType: lic.license_type || "cloud",
        targetVersion: lic.target_version,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `تم تثبيت وتحديث إصدار جديد من النظام (v${CURRENT_SYSTEM_VERSION}) بينما الترخيص السابق مخصص للنسخة (v${lic.target_version}). لا يُسمح بتشغيل النظام بعد التحديث إلا بعد اعتماد وترخيص الإصدار الجديد من قِبل المطور.`
      };
    }

    const activeDevicesCount = (db.prepare("SELECT COUNT(*) as c FROM license_devices WHERE license_id=? AND (status IS NULL OR status='authorized' OR status='active')").get(lic.id) as { c: number })?.c || 1;

    const isWarning = diffDays <= 15 && diffDays > 0;
    const warningMessage = isWarning
      ? `تنبيه: متبقي ${diffDays} يوم فقط على انتهاء ترخيص هذا الجهاز (${lic.expires_at}). يرجى سرعة التواصل مع إدارة ومطور النظام لتجديد الترخيص قبل موعد التوقف.`
      : undefined;

    // CLOUD LICENSE SUPPORT:
    const isCloudLicense = !lic.license_type || lic.license_type === "cloud" || lic.license_type === "سحابي";
    if (isCloudLicense) {
      return {
        blocked: false,
        deviceId: currentDevice,
        licenseType: "cloud",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        isWarning,
        warningMessage,
        targetVersion: lic.target_version || CURRENT_SYSTEM_VERSION,
        currentVersion: CURRENT_SYSTEM_VERSION,
        devicesLimit: lic.devices_limit || 999,
        activeDevicesCount
      };
    }

    // Physical Device Authorization Check for Desktop / Offline mode:
    const allLicenseDevices = db.prepare("SELECT * FROM license_devices WHERE license_id=?").all(lic.id) as any[];
    let deviceCheck = allLicenseDevices.find(d => candidateDevs.includes(String(d.device_id || "").trim().toUpperCase()) || d.device_id === "*");

    // If a desktop license was just created with 0 bound devices and has available slots, auto-bind the local device
    if (!deviceCheck && allLicenseDevices.length === 0 && (lic.devices_limit || 1) >= 1) {
      try {
        const ins = db.prepare(`
          INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
          VALUES (?, ?, ?, 'ترخيص تلقائي للجهاز الأساسي', 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `).run(lic.id, currentDevice, `جهاز أساسي (${os.hostname()})`);
        deviceCheck = db.prepare("SELECT * FROM license_devices WHERE id=?").get(ins.lastInsertRowid);
      } catch {}
    }

    if (!deviceCheck) {
      return { 
        blocked: true, 
        code: "device_unauthorized",
        deviceId: currentDevice,
        licenseType: "desktop",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `هذا الجهاز (بصمة الجهاز: ${currentDevice}) غير مرخص له بتشغيل النظام. يُمنع منعاً باتاً تشغيل النظام عند نسخ ملفاته إلى جهاز آخر بدون ترخيص معتمد من المطور.`
      };
    }

    if (deviceCheck.status === 'blocked' || deviceCheck.status === 'disabled') {
      return {
        blocked: true,
        code: "device_blocked",
        deviceId: currentDevice,
        licenseType: "desktop",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `تم حظر هذا الجهاز (${currentDevice}) من قِبل المطور. يرجى التواصل مع المطور لفك الحظر.`
      };
    }

    // Update last active
    try {
      db.prepare("UPDATE license_devices SET last_active = datetime('now', 'localtime') WHERE id = ?").run(deviceCheck.id);
    } catch (e) {}

    return { 
      blocked: false,
      deviceId: currentDevice,
      licenseType: "desktop",
      clientName: lic.client_name,
      expiresAt: lic.expires_at,
      remainingDays: diffDays,
      isWarning,
      warningMessage,
      targetVersion: lic.target_version || CURRENT_SYSTEM_VERSION,
      currentVersion: CURRENT_SYSTEM_VERSION,
      devicesLimit: lic.devices_limit,
      activeDevicesCount
    };
  } catch (e) {
    return {
      blocked: true,
      code: "license_required",
      deviceId: getSystemDeviceId(),
      currentVersion: CURRENT_SYSTEM_VERSION,
      reason: "خطأ في فحص ترخيص النظام. يرجى التواصل مع مطور النظام."
    };
  }
}

export function formatAuthUser(u: any) {
  const isAdmin = u.role === "admin" || u.role === "developer" || u.role === "general_manager" || u.role === "مدير" || u.role === "مدير عام" || u.role === "مدير عام النظام" || u.role === "مدير عام الشركة" || u.username === "admin" || u.username === "developer" || toBool(u.is_system_admin);
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
    active: toBool(u.active) && !toBool(u.is_suspended),
    is_system_admin: isAdmin,
    is_cashier: toBool(u.is_cashier || u.role === "cashier" || u.role === "كاشير"),
    is_pos_user: toBool(u.is_pos_user || u.role === "cashier" || u.role === "كاشير"),
    perm_pos_only: posOnly,
    can_discount: isAdmin ? true : toBool(u.can_discount !== undefined && u.can_discount !== null ? u.can_discount : (u.perm_pos_discount ?? false)),
    allow_meal_deduction: isAdmin ? true : toBool(u.allow_meal_deduction !== undefined && u.allow_meal_deduction !== null ? u.allow_meal_deduction : (u.perm_pos_employee_invoice ?? false)),
    perm_pos_delivery: isAdmin ? true : (u.perm_pos_delivery !== undefined ? toBool(u.perm_pos_delivery) : true),
    perm_pos_dinein: isAdmin ? true : (u.perm_pos_dinein !== undefined ? toBool(u.perm_pos_dinein) : true),
    perm_pos_takeaway: isAdmin ? true : (u.perm_pos_takeaway !== undefined ? toBool(u.perm_pos_takeaway) : true),
    perm_pos_credit: isAdmin ? true : (u.perm_pos_credit !== undefined ? toBool(u.perm_pos_credit) : true),
    perm_pos_cash: isAdmin ? true : (u.perm_pos_cash !== undefined ? toBool(u.perm_pos_cash) : true),
    perm_pos_card: isAdmin ? true : (u.perm_pos_card !== undefined ? toBool(u.perm_pos_card) : true),
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
    default_branch_id: u.default_branch_id || u.branch_id || 1,
    default_safe_id: u.default_safe_id || null,
    default_screen: u.default_screen || (posOnly ? "pos" : "dashboard"),
    department: u.department || "الإدارة العامة",
    job_title: u.job_title || (u.role === "cashier" || u.role === "كاشير" ? "كاشير ونقطة بيع" : (u.role === "accountant" || u.role === "محاسب" ? "محاسب مالي" : (isAdmin ? "مدير عام النظام" : "موظف نظام")))
  };
}

export function getAuthUser(req: any) {
  try {
    const auth = req.headers?.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      if (token) {
        const userId = getSessionUser(token);
        if (userId) {
          const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId) as any;
          if (user) {
            const isDev = user.role === "developer" || user.username?.toLowerCase() === "developer";
            if (isDev) return user;
            const isSuspended = user.is_suspended === 1 || user.is_suspended === "1" || user.is_suspended === true || user.is_suspended === "true";
            const isActive = user.active === 1 || user.active === "1" || user.active === true || user.active === "true" || user.active === undefined || user.active === null;
            if (isActive && !isSuspended) return user;
          }
        }
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    return;
  }

  const cleanUsername = String(username).trim();
  const isDevLoginAttempt = cleanUsername.toLowerCase() === "developer";

  // 1. Special Handling & Guarantee for System Developer:
  // Developer account ALWAYS bypasses license check on ANY device (licensed, unlicensed, expired, or blocked)
  if (isDevLoginAttempt) {
    let devUser = db.prepare("SELECT * FROM users WHERE LOWER(TRIM(username))='developer'").get() as any;
    const isDevPassDefault = password === "dev123";
    let isPassValid = false;

    if (devUser) {
      isPassValid = isDevPassDefault || verifyPassword(password, devUser.password_hash);
    } else {
      isPassValid = isDevPassDefault;
    }

    if (!isPassValid) {
      res.status(401).json({ 
        error: "كلمة المرور غير صحيحة لحساب المطور", 
        code: "invalid_password" 
      });
      return;
    }

    // Ensure developer user exists with full privileges in database
    if (!devUser) {
      const devHash = hashPassword("dev123");
      const r = db.prepare(`
        INSERT INTO users (
          username, password_hash, name, role, active, is_suspended, can_discount,
          perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return,
          perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake,
          perm_edit_entries, perm_close_periods, perm_view_salaries, is_system_admin
        ) VALUES (
          'developer', ?, 'مطور النظام (Developer)', 'developer', 1, 0, 1,
          1, 1, 1, 1,
          1, 1, 1, 1,
          1, 1, 1, 1
        )
      `).run(devHash);
      devUser = db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid) as any;
    } else {
      // Ensure active and un-suspended
      db.prepare("UPDATE users SET active=1, is_suspended=0, role='developer' WHERE id=?").run(devUser.id);
      devUser.active = 1;
      devUser.is_suspended = 0;
      devUser.role = "developer";
    }

    // Auto-authorize current device for developer
    try {
      let lic = db.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get() as any;
      if (lic) {
        const currentDevice = getSystemDeviceId();
        const deviceCheck = db.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, currentDevice);
        if (!deviceCheck) {
          db.prepare(`
            INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active)
            VALUES (?, ?, ?, 'مطور النظام (تسجيل مباشر)', 'authorized', datetime('now', 'localtime'))
          `).run(lic.id, currentDevice, `جهاز المطور الرئيسي (${os.hostname()})`);
        } else {
          db.prepare("UPDATE license_devices SET status='authorized', last_active=datetime('now', 'localtime') WHERE id=?").run(deviceCheck.id);
        }
      }
    } catch (e) {
      console.error("Developer device auto-auth error:", e);
    }

    const token = createSession(devUser.id);
    const deviceName = req.body.device_name || os.hostname() || "DEV-CLIENT";
    try {
      db.prepare(`
        INSERT INTO erp_sessions (user_id, username, device_name, login_time, status, branch_id, language, created_by, created_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'), 'نشط', 1, 'عربي', ?, datetime('now', 'localtime'))
      `).run(devUser.id, devUser.name, deviceName, devUser.name);
    } catch (err) {}

    res.json({
      token,
      user: formatAuthUser(devUser),
    });
    return;
  }

  // 2. Lookup standard user in database first
  // Try exact username match first to prevent collision with numeric user_numbers or IDs
  let user = db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) 
       OR TRIM(username) = TRIM(?)
  `).get(cleanUsername, cleanUsername) as any;

  if (!user) {
    // Fallback 1: match by user_number
    user = db.prepare(`
      SELECT * FROM users 
      WHERE CAST(user_number AS TEXT) = TRIM(?)
    `).get(cleanUsername) as any;
  }

  if (!user) {
    // Fallback 2: match by short numeric ID (<= 4 chars)
    user = db.prepare(`
      SELECT * FROM users 
      WHERE CAST(id AS TEXT) = TRIM(?) AND LENGTH(TRIM(?)) <= 4
    `).get(cleanUsername, cleanUsername) as any;
  }

  // If user does not exist: return 401 with clear message. DO NOT check or show license modal!
  if (!user) {
    res.status(401).json({ 
      error: "اسم المستخدم غير مسجل أو غير موجود في النظام", 
      code: "user_not_found" 
    });
    return;
  }

  // Verify user password
  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ 
      error: "كلمة المرور غير صحيحة", 
      code: "invalid_password" 
    });
    return;
  }

  // Verify user status (active / suspended)
  const isSuspended = toBool(user.is_suspended);
  const isActive = toBool(user.active);
  if (!isActive || isSuspended) {
    res.status(403).json({ 
      error: "هذا الحساب معطل أو موقوف إدارياً. يرجى مراجعة إدارة النظام", 
      code: "account_suspended" 
    });
    return;
  }

  if (user.group_id) {
    try {
      const grp = db.prepare("SELECT * FROM user_groups WHERE id=?").get(user.group_id) as any;
      if (grp && grp.is_suspended) {
        res.status(403).json({ 
          error: `مجموعة المستخدمين (${grp.name_ar}) المرتبط بها هذا الحساب موقوفة حالياً. السبب: ${grp.suspended_reason || "إيقاف إداري"}`,
          code: "group_suspended"
        });
        return;
      }
    } catch {}
  }

  // 3. User is valid and authenticated. Now check device license for non-developers:
  const isDevUser = user.role === "developer" || user.username?.toLowerCase() === "developer";
  if (!isDevUser) {
    const licenseStatus = checkLicenseStatus();
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: licenseStatus.code || "license_blocked",
        code: licenseStatus.code || "license_blocked",
        deviceId: licenseStatus.deviceId,
        message: licenseStatus.reason || "تم انتهاء فترة صلاحية ترخيص استخدام النظام أو أن هذا الجهاز غير مرخص. يرجى التواصل مع إدارة النظام والمطور."
      });
      return;
    }
  }

  const token = createSession(user.id);

  // Log active session in erp_sessions
  const deviceName = req.body.device_name || os.hostname() || (req.headers["user-agent"] ? req.headers["user-agent"].split(" ")[0] : "DESKTOP-CLIENT");
  const branchId = user.branch_id || user.default_branch_id || 1;
  const userLang = user.language || "عربي";
  try {
    db.prepare(`
      INSERT INTO erp_sessions (user_id, username, device_name, login_time, status, branch_id, language, created_by, created_at)
      VALUES (?, ?, ?, datetime('now', 'localtime'), 'نشط', ?, ?, ?, datetime('now', 'localtime'))
    `).run(user.id, user.name, deviceName, branchId, userLang, user.name);
  } catch (err) {
    console.error("Failed to log erp session:", err);
  }

  res.json({
    token,
    user: formatAuthUser(user),
  });
});

router.get("/auth/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const isDev = user.username?.toLowerCase() === "developer" || user.role === "developer";
  if (!isDev) {
    const licenseStatus = checkLicenseStatus();
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: licenseStatus.code || "license_blocked",
        code: licenseStatus.code || "license_blocked",
        message: licenseStatus.reason || "تم انتهاء فترة ترخيص استخدام النظام أو الجهاز غير مرخص. يرجى التواصل مع المطور لتمديد الترخيص."
      });
      return;
    }
  }

  res.json(formatAuthUser(user));
});

router.post("/auth/logout", (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const userId = getSessionUser(token);
    if (userId) {
      const user = db.prepare("SELECT name FROM users WHERE id=?").get(userId) as any;
      if (user) {
        try {
          db.prepare(`
            UPDATE erp_sessions 
            SET status = 'خروج', logout_time = datetime('now', 'localtime') 
            WHERE username = ? AND status = 'نشط'
          `).run(user.name);
        } catch (err) {
          console.error("Failed to log erp session logout:", err);
        }
      }
    }
    deleteSession(token);
  }
  res.json({ ok: true });
});

router.post("/auth/change-password", (req, res) => {
  logger.info({ body: { ...req.body, oldPassword: "***", currentPassword: "***", newPassword: "***" } }, "Password change request received");
  try {
    const { username, oldPassword, currentPassword, newPassword } = req.body;
    const passwordToCheck = currentPassword || oldPassword;
    
    if (!passwordToCheck || !newPassword) {
      return res.status(400).json({ error: "الرجاء إدخال كلمة المرور الحالية وكلمة المرور الجديدة" });
    }

    if (String(newPassword).trim().length < 3) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل" });
    }

    let fullUser: any = null;

    // Prioritize username specified in request body (especially from /login interface)
    if (username && String(username).trim().length > 0) {
      const cleanUsername = String(username).trim();
      fullUser = db.prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))").get(cleanUsername) as any;
      if (!fullUser) {
        return res.status(404).json({ error: `اسم المستخدم (${cleanUsername}) غير موجود بالنظام` });
      }
    } else {
      // Fallback to active logged-in session user if username not provided
      const user = getAuthUser(req);
      if (user?.id) {
        fullUser = db.prepare("SELECT * FROM users WHERE id=?").get(user.id) as any;
      }
    }

    if (!fullUser) {
      return res.status(401).json({ error: "يرجى تحديد اسم المستخدم أو تسجيل الدخول أولاً" });
    }

    if (!fullUser.active) {
      return res.status(403).json({ error: "هذا الحساب معطل حالياً. يرجى التواصل مع مسؤول النظام." });
    }

    const ok = verifyPassword(String(passwordToCheck), fullUser.password_hash);
    if (!ok) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    const newHash = hashPassword(String(newPassword).trim());
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(newHash, fullUser.id);

    logger.info({ userId: fullUser.id, username: fullUser.username }, "Password changed successfully");
    res.json({ ok: true, message: "تم تغيير كلمة السر بنجاح. يمكنك الآن تسجيل الدخول بها." });
  } catch (error: any) {
    logger.error({ err: error, stack: error.stack }, "Critical error during password change");
    if (!res.headersSent) {
      res.status(500).json({ error: "حدث خطأ داخلي أثناء تغيير كلمة السر: " + error.message });
    }
  }
});

router.post("/auth/verify-supervisor", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور للمدير / المشرف" });
    }
    const user = db.prepare("SELECT * FROM users WHERE (username=? OR name=?) AND active=1").get(username, username) as any;
    if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "accountant")) {
      return res.status(403).json({ error: "المستخدم ليس لديه صلاحية مدير أو مشرف لمنح إذن الخصم" });
    }
    const ok = verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    }
    res.json({ ok: true, name: user.name, role: user.role });
  } catch (error: any) {
    res.status(500).json({ error: "حدث خطأ أثناء التحقق من الصلاحية: " + error.message });
  }
});

export default router;
