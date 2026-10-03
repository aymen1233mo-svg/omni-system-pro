import { Router } from "express";
import { db, logAudit, hashPassword } from "../lib/sqlite";
import { getAuthUser, checkLicenseStatus, getSystemDeviceId, getSystemCandidateDeviceIds, CURRENT_SYSTEM_VERSION } from "./auth";
import crypto from "node:crypto";
import zlib from "node:zlib";
import os from "node:os";

const router = Router();
const DEV_SIGNING_SALT = "OMNIFLY-PRO-ENTERPRISE-DEVELOPER-SECRET-KEY-2027";
const AES_KEY = crypto.createHash("sha256").update(DEV_SIGNING_SALT).digest();

export interface LicensePayload {
  hwid: string;
  client: string;
  exp: string;
  limit: number;
  type: "desktop" | "cloud";
  ver: string;
  notes?: string;
  ts?: number;
}

export function encryptLicenseToken(payload: Partial<LicensePayload>): string {
  const cleanPayload: LicensePayload = {
    hwid: String(payload.hwid || "*").trim().toUpperCase(),
    client: String(payload.client || "مؤسسة أومني سيستم للتجارة والمبيعات").trim(),
    exp: String(payload.exp || "2027-12-31").trim(),
    limit: Math.max(1, Number(payload.limit) || 1),
    type: payload.type === "cloud" ? "cloud" : "desktop",
    ver: String(payload.ver || CURRENT_SYSTEM_VERSION).trim(),
    notes: payload.notes || "",
    ts: Math.floor(Date.now() / 1000)
  };

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const compressed = zlib.deflateRawSync(Buffer.from(JSON.stringify(cleanPayload), "utf8"));
  const encryptedBuf = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encryptedBuf]).toString("base64url");
  return `OMNI-LIC.${packed}`;
}

export function decryptLicenseToken(token: string): LicensePayload | null {
  if (!token || typeof token !== "string") return null;
  const raw = token.trim().replace(/[\r\n\t\s]+/g, "");

  // 1. Try packed OMNI-LIC.<base64url> format (12-byte IV + 16-byte AuthTag + Ciphertext)
  if (raw.toUpperCase().startsWith("OMNI-LIC.") || raw.toUpperCase().startsWith("ACT-LIC.")) {
    try {
      const body = raw.substring(raw.indexOf(".") + 1);
      const buf = Buffer.from(body, "base64url");
      if (buf.length > 28) {
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const enc = buf.subarray(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
        decipher.setAuthTag(tag);
        const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
        try {
          const inflated = zlib.inflateRawSync(dec).toString("utf8");
          return JSON.parse(inflated) as LicensePayload;
        } catch {
          return JSON.parse(dec.toString("utf8")) as LicensePayload;
        }
      }
    } catch {}
  }

  // 2. Try ACT-LIC-<16-char-iv>-<22-char-tag>-<ciphertext> format (fixed length slicing to avoid '-' collision in base64url)
  let cleanToken = raw;
  if (cleanToken.toUpperCase().startsWith("ACT-LIC-") || cleanToken.toUpperCase().startsWith("OMNI-LIC-")) {
    cleanToken = cleanToken.substring(cleanToken.indexOf("-", 4) + 1);
  } else if (cleanToken.toUpperCase().startsWith("OMNI-") && cleanToken.length > 45) {
    cleanToken = cleanToken.substring(5);
  }

  if (cleanToken.length > 40) {
    // Method A: Fixed width base64url (12 bytes = 16 chars, 16 bytes = 22 chars)
    if (cleanToken[16] === "-" && cleanToken[39] === "-") {
      try {
        const iv = Buffer.from(cleanToken.substring(0, 16), "base64url");
        const tag = Buffer.from(cleanToken.substring(17, 39), "base64url");
        const ciphertext = cleanToken.substring(40);
        const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(ciphertext, "base64url", "utf8");
        decrypted += decipher.final("utf8");
        return JSON.parse(decrypted) as LicensePayload;
      } catch {}
    }

    // Method B: Split by '-' fallback
    const parts = cleanToken.split("-");
    if (parts.length >= 3) {
      try {
        const iv = Buffer.from(parts[0], "base64url");
        const tag = Buffer.from(parts[1], "base64url");
        const ciphertext = parts.slice(2).join("-");
        const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(ciphertext, "base64url", "utf8");
        decrypted += decipher.final("utf8");
        return JSON.parse(decrypted) as LicensePayload;
      } catch {}
    }
  }

  return null;
}

function computeLegacyHmacCode(deviceId: string, expiresAt: string, version: string, devicesLimit: number, fourPart: boolean = true): string {
  const cleanDevice = String(deviceId || "").trim().toUpperCase();
  const cleanExp = String(expiresAt || "").trim();
  const cleanVer = String(version || CURRENT_SYSTEM_VERSION).trim();
  const cleanLimit = String(devicesLimit || 1).trim();
  const payload = fourPart
    ? `${cleanDevice}|${cleanExp}|${cleanVer}|${cleanLimit}`
    : `${cleanDevice}|${cleanExp}|${cleanVer}`;
  const sig = crypto.createHmac("sha256", DEV_SIGNING_SALT).update(payload).digest("hex").toUpperCase();
  return fourPart
    ? `ACT-${sig.substring(0, 4)}-${sig.substring(4, 8)}-${sig.substring(8, 12)}-${sig.substring(12, 16)}`
    : `ACT-${sig.substring(0, 4)}-${sig.substring(4, 8)}-${sig.substring(8, 12)}`;
}

export function findLegacyHmacMatch(activationCode: string, candidateDevices: string[]): { hwid: string; exp: string; limit: number; ver: string } | null {
  const cleanCode = String(activationCode || "").trim().toUpperCase();
  if (!cleanCode.startsWith("ACT-")) return null;

  const isFourPart = cleanCode.split("-").length === 5;
  const uniqueDevices = Array.from(new Set(candidateDevices.map(d => String(d || "").trim().toUpperCase()).filter(Boolean)));
  if (!uniqueDevices.includes("*")) uniqueDevices.push("*");

  const limits = [1, 2, 3, 5, 10, 20, 50, 100, 999];
  const versions = Array.from(new Set([CURRENT_SYSTEM_VERSION, "1.1.0", "1.0.0", "*"]));

  // Scan dates from 2025-01-01 to 2036-12-31
  const startMs = new Date("2025-01-01T00:00:00Z").getTime();
  const totalDays = 4383; // 12 years

  for (const dev of uniqueDevices) {
    for (const ver of versions) {
      for (let d = 0; d < totalDays; d++) {
        const dt = new Date(startMs + d * 86400000).toISOString().split("T")[0];
        if (isFourPart) {
          for (const lim of limits) {
            if (computeLegacyHmacCode(dev, dt, ver, lim, true) === cleanCode) {
              return { hwid: dev, exp: dt, limit: lim, ver };
            }
          }
        } else {
          if (computeLegacyHmacCode(dev, dt, ver, 1, false) === cleanCode) {
            return { hwid: dev, exp: dt, limit: 1, ver };
          }
        }
      }
    }
  }
  return null;
}

export function generateActivationCode(deviceId: string, expiresAt: string, version: string = CURRENT_SYSTEM_VERSION, devicesLimit: number = 1): string {
  return encryptLicenseToken({
    hwid: deviceId,
    exp: expiresAt,
    ver: version,
    limit: devicesLimit,
    type: "desktop"
  });
}

export function verifyActivationCode(activationCode: string, deviceId: string, expiresAt: string, version: string = CURRENT_SYSTEM_VERSION, devicesLimit: number = 1): boolean {
  const decrypted = decryptLicenseToken(activationCode);
  if (decrypted) {
    const targetHwid = decrypted.hwid.toUpperCase();
    const currentHwid = String(deviceId || "").trim().toUpperCase();
    return targetHwid === "*" || targetHwid === currentHwid;
  }

  // Legacy signature verification
  const cleanCode = String(activationCode || "").trim().toUpperCase();
  const cleanDevice = String(deviceId || "").trim().toUpperCase();
  const cleanExp = String(expiresAt || "").trim();
  const cleanVer = String(version || CURRENT_SYSTEM_VERSION).trim();
  const cleanLimit = String(devicesLimit || 1).trim();

  const payload = `${cleanDevice}|${cleanExp}|${cleanVer}|${cleanLimit}`;
  const sig = crypto.createHmac("sha256", DEV_SIGNING_SALT).update(payload).digest("hex").toUpperCase();
  const expected = `ACT-${sig.substring(0, 4)}-${sig.substring(4, 8)}-${sig.substring(8, 12)}-${sig.substring(12, 16)}`;
  if (cleanCode === expected) return true;

  const payloadLegacy = `${cleanDevice}|${cleanExp}|${cleanVer}`;
  const sigLegacy = crypto.createHmac("sha256", DEV_SIGNING_SALT).update(payloadLegacy).digest("hex").toUpperCase();
  const expectedLegacy = `ACT-${sigLegacy.substring(0, 4)}-${sigLegacy.substring(4, 8)}-${sigLegacy.substring(8, 12)}`;
  return cleanCode === expectedLegacy;
}

function requireDeveloper(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "تسجيل الدخول مطلوب" });
    return false;
  }
  const isDev = user.role === "developer" || user.username?.toLowerCase() === "developer";
  if (!isDev) {
    res.status(403).json({ error: "هذه الصفحة والعمليات مخصصة لحساب المطور فقط" });
    return false;
  }
  return true;
}

// Public license and device verification status endpoint
router.get("/license/status", (req, res) => {
  const status = checkLicenseStatus();
  res.json(status);
});

// Returns hardware device info for current machine
router.get("/licenses/device-info", (req, res) => {
  const deviceId = getSystemDeviceId();
  res.json({
    deviceId,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    currentVersion: CURRENT_SYSTEM_VERSION
  });
});

// Active license information
router.get("/licenses/active", (req, res) => {
  const lic = db.prepare("SELECT * FROM licenses WHERE active=1 AND (status IS NULL OR status='active') ORDER BY id DESC LIMIT 1").get() as any;
  if (!lic) {
    res.json({ active: false, client_name: "غير مرخص / موقوف", expires_at: "", devices_limit: 0, current_device_id: getSystemDeviceId() });
    return;
  }
  const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(lic.id);
  res.json({ ...lic, devices, current_device_id: getSystemDeviceId(), current_version: CURRENT_SYSTEM_VERSION });
});

// Developer: List all licenses with their authorized devices
router.get("/licenses", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const licenses = db.prepare("SELECT * FROM licenses ORDER BY id DESC").all() as any[];
  const currentDeviceId = getSystemDeviceId();
  const result = licenses.map(lic => {
    const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(lic.id);
    return { 
      ...lic, 
      devices, 
      active_devices_count: devices.filter((d: any) => d.status === 'authorized' || !d.status).length,
      current_device_id: currentDeviceId
    };
  });
  res.json(result);
});

// Developer: Issue new license
router.post("/licenses", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req);
  const userId = user?.id ?? 1;
  const userName = user?.name ?? "مطور النظام";
  const { client_name, devices_limit, expires_at, target_version, license_type, device_id, notes } = req.body;
  const licType = license_type === "desktop" ? "desktop" : "cloud";
  const resolvedClient = (client_name && String(client_name).trim()) ? String(client_name).trim() : "مؤسسة أومني سيستم للتجارة والمبيعات";
  const resolvedLimit = Math.max(1, Number(devices_limit) || (licType === "cloud" ? 999 : 5));
  const resolvedExp = (expires_at && String(expires_at).trim()) ? String(expires_at).trim() : "2027-12-31";
  const version = target_version || CURRENT_SYSTEM_VERSION;
  const sysDev = getSystemDeviceId();
  const targetHwid = device_id ? String(device_id).trim().toUpperCase() : (licType === "cloud" ? "*" : sysDev);

  const licenseKey = encryptLicenseToken({
    hwid: targetHwid,
    client: resolvedClient,
    exp: resolvedExp,
    limit: resolvedLimit,
    type: licType,
    ver: version,
    notes: notes || ""
  });
  
  const r = db.prepare(`
    INSERT INTO licenses (license_key, client_name, devices_limit, expires_at, active, status, target_version, license_type, notes) 
    VALUES (?,?,?,?,1,'active',?,?,?)
  `).run(licenseKey, resolvedClient, resolvedLimit, resolvedExp, version, licType, notes ?? "");

  const newLicenseId = Number(r.lastInsertRowid);

  // Automatically authorize current system device and any provided device_id
  const devsToAuth = Array.from(new Set([sysDev, ...getSystemCandidateDeviceIds(), device_id ? String(device_id).trim().toUpperCase() : ""].filter(d => d && d !== "*")));
  for (const devId of devsToAuth) {
    try {
      db.prepare(`
        INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
        VALUES (?, ?, ?, ?, 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
      `).run(newLicenseId, devId, `جهاز معتمد (${os.hostname()})`, `المطور: ${userName}`);
    } catch {}
  }

  try {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('businessName', ?)").run(resolvedClient);
  } catch {}

  logAudit(userId, userName, "إصدار ترخيص", `ترخيص ${licType === "cloud" ? "سحابي شامل" : "أجهزة مكتبية"} لـ ${resolvedClient} برقم ${licenseKey} (إصدار: ${version})`);
  
  const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(newLicenseId);
  res.status(201).json({ 
    id: newLicenseId, 
    license_key: licenseKey, 
    client_name: resolvedClient, 
    devices_limit: resolvedLimit, 
    expires_at: resolvedExp, 
    active: 1, 
    status: "active",
    target_version: version,
    license_type: licType,
    notes: notes ?? "",
    devices
  });
});

// Developer: Quick Remote Cloud License Activation / Extension (1-Click Remote Cloud Activation)
router.post("/licenses/activate-cloud-license", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const { client_name, duration_months, custom_expires_at, target_version, notes } = req.body;

  let finalExpiresAt = custom_expires_at;
  if (!finalExpiresAt) {
    const months = Number(duration_months) || 12;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    finalExpiresAt = date.toISOString().split("T")[0];
  }

  const ver = target_version || CURRENT_SYSTEM_VERSION;
  const cName = client_name || "مؤسسة إتقان المعتمدة للتجارة والخدمات";

  // Check if there's an existing license to update, or create a fresh cloud master license
  let lic = db.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get() as any;
  if (!lic) {
    const newKey = `OMNI-CLOUD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const r = db.prepare(`
      INSERT INTO licenses (license_key, client_name, devices_limit, expires_at, active, status, target_version, license_type, notes)
      VALUES (?, ?, 999, ?, 1, 'active', ?, 'cloud', ?)
    `).run(newKey, cName, finalExpiresAt, ver, notes || "ترخيص سحابي شامل تم تفعيله عن بُعد من قبل المطور");
    lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(r.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE licenses 
      SET expires_at=?, active=1, status='active', target_version=?, license_type='cloud', client_name=COALESCE(?, client_name)
      WHERE id=?
    `).run(finalExpiresAt, ver, cName, lic.id);
    lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(lic.id);
  }

  logAudit(user.id, user.name, "تفعيل ترخيص سحابي عن بعد", `تم تفعيل وتمديد الترخيص السحابي حتى (${finalExpiresAt}) بنجاح`);

  res.json({
    success: true,
    message: `تم اعتماد وتفعيل الترخيص السحابي الشامل للنظام حتى تاريخ (${finalExpiresAt}) بنجاح! يسمح لجميع المستخدمين والموظفين بالدخول الفوري.`,
    license: lic
  });
});

// Developer: Authorize Current Device with 1-Click
router.post("/licenses/authorize-current", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const { license_id, device_name } = req.body;

  let lic: any;
  if (license_id) {
    lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(license_id);
  } else {
    lic = db.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get();
  }

  if (!lic) {
    res.status(404).json({ error: "لا يوجد ترخيص نشط متاح لربط الجهاز به" });
    return;
  }

  const currentDeviceId = getSystemDeviceId();
  const devName = device_name || `جهاز معتمد (${os.hostname()})`;

  const existing = db.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, currentDeviceId) as any;
  if (existing) {
    db.prepare("UPDATE license_devices SET status='authorized', device_name=?, authorized_by=?, last_active=datetime('now', 'localtime') WHERE id=?")
      .run(devName, `المطور: ${user.name}`, existing.id);
  } else {
    // Check device limit
    const count = (db.prepare("SELECT COUNT(*) as c FROM license_devices WHERE license_id=?").get(lic.id) as any).c;
    if (count >= lic.devices_limit) {
      // Auto-expand limit by 1 or return
      db.prepare("UPDATE licenses SET devices_limit = devices_limit + 1 WHERE id=?").run(lic.id);
    }
    db.prepare(`
      INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
      VALUES (?, ?, ?, ?, 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(lic.id, currentDeviceId, devName, `المطور: ${user.name}`);
  }

  logAudit(user.id, user.name, "ترخيص جهاز", `تم ترخيص الجهاز الحالي (${currentDeviceId}) للترخيص ${lic.license_key}`);
  
  res.json({
    success: true,
    message: `تم ترخيص وتفعيل الجهاز الحالي (${currentDeviceId}) بنجاح!`,
    deviceId: currentDeviceId,
    licenseId: lic.id
  });
});

// Developer: Manually authorize a specific Device ID
router.post("/licenses/authorize-device", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const { license_id, device_id, device_name } = req.body;

  if (!device_id || !license_id) {
    res.status(400).json({ error: "يرجى تحديد رقم الترخيص وبصمة الجهاز المراد ترخيصه" });
    return;
  }

  const lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(license_id) as any;
  if (!lic) {
    res.status(404).json({ error: "الترخيص غير موجود" });
    return;
  }

  const cleanDeviceId = String(device_id).trim().toUpperCase();
  const devName = device_name || `جهاز محطة عمل (${cleanDeviceId})`;

  const existing = db.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, cleanDeviceId) as any;
  if (existing) {
    db.prepare("UPDATE license_devices SET status='authorized', device_name=?, authorized_by=?, last_active=datetime('now', 'localtime') WHERE id=?")
      .run(devName, `المطور: ${user.name}`, existing.id);
  } else {
    db.prepare(`
      INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
      VALUES (?, ?, ?, ?, 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(lic.id, cleanDeviceId, devName, `المطور: ${user.name}`);
  }

  logAudit(user.id, user.name, "ترخيص جهاز يدوي", `تم ترخيص بصمة الجهاز (${cleanDeviceId}) باسم (${devName})`);
  
  const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(lic.id);
  res.json({ success: true, message: "تم ترخيص الجهاز بنجاح", devices });
});

// Developer: Generate an Offline or Cloud Activation Code with complete client & device limits
router.post("/licenses/generate-code", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const { 
    device_id, 
    client_name, 
    expires_at, 
    duration_days, 
    duration_months, 
    devices_limit, 
    license_type, 
    target_version, 
    notes,
    auto_save 
  } = req.body;

  const resolvedDeviceId = (device_id && String(device_id).trim())
    ? String(device_id).trim().toUpperCase()
    : (license_type === "cloud" ? "*" : getSystemDeviceId());

  // Determine expiration date
  let finalExpiresAt = expires_at ? String(expires_at).trim() : "";
  if (!finalExpiresAt) {
    const d = new Date();
    if (duration_days) {
      d.setDate(d.getDate() + Number(duration_days));
    } else if (duration_months) {
      d.setMonth(d.getMonth() + Number(duration_months));
    } else {
      d.setFullYear(d.getFullYear() + 1); // default 1 year
    }
    finalExpiresAt = d.toISOString().split("T")[0];
  }

  const cleanDevice = resolvedDeviceId;
  const cleanClient = String(client_name || "مؤسسة أومني سيستم للتجارة والمبيعات").trim();
  const cleanLimit = Math.max(1, Number(devices_limit) || 1);
  const cleanType = license_type === "cloud" ? "cloud" : "desktop";
  const version = target_version || CURRENT_SYSTEM_VERSION;

  const code = encryptLicenseToken({
    hwid: cleanDevice,
    client: cleanClient,
    exp: finalExpiresAt,
    limit: cleanLimit,
    type: cleanType,
    ver: version,
    notes: notes || ""
  });

  // If auto_save requested or by default, register in licenses table so both offline signature and online key work
  let savedLicenseId: number | undefined;
  if (auto_save !== false) {
    const r = db.prepare(`
      INSERT INTO licenses (license_key, client_name, devices_limit, expires_at, active, status, target_version, license_type, notes)
      VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?)
    `).run(code, cleanClient, Math.max(cleanLimit, 2), finalExpiresAt, version, cleanType, notes || `تم إصدار كود تفعيل لبصمة (${cleanDevice})`);
    
    savedLicenseId = Number(r.lastInsertRowid);

    // Pre-authorize both the target device and the current system's device IDs so the developer's PC is never locked out
    const devsToAuth = Array.from(new Set([cleanDevice, getSystemDeviceId(), ...getSystemCandidateDeviceIds()].filter(d => d && d !== "*")));
    for (const devId of devsToAuth) {
      try {
        db.prepare(`
          INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
          VALUES (?, ?, ?, ?, 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
        `).run(savedLicenseId, devId, devId === cleanDevice ? `جهاز (${cleanClient})` : `جهاز النظام الأساسي (${os.hostname()})`, `المطور: ${user.name}`);
      } catch (e) {}
    }

    logAudit(user.id, user.name, "توليد كود ترخيص", `تم توليد كود ترخيص لـ (${cleanClient}) على البصمة (${cleanDevice}) حتى (${finalExpiresAt})`);
  }

  const shareText = `📋 *بيانات تفعيل وترخيص نظام Omni System Pro ERP:*\n` +
    `👤 *المنشأة/العميل:* ${cleanClient}\n` +
    `💻 *بصمة الجهاز المعتمد:* ${cleanDevice}\n` +
    `🔑 *كود التفعيل الرقمي:* ${code}\n` +
    `📅 *صلاحية الترخيص حتى:* ${finalExpiresAt}\n` +
    `🔢 *عدد الأجهزة المسموح بها:* ${cleanLimit} جهاز\n` +
    `🏢 *نوع الترخيص:* ${cleanType === "cloud" ? "سحابي شامل" : "ترخيص أجهزة مكتبية"}\n\n` +
    `*طريقة التفعيل:* افتح النظام في شاشة تسجيل الدخول، اضغط على زر (تفعيل الترخيص / إدخال كود الترخيص) وألصق الكود أعلاه واضغط (اعتماد وتفعيل).`;

  res.json({
    success: true,
    deviceId: cleanDevice,
    clientName: cleanClient,
    expiresAt: finalExpiresAt,
    devicesLimit: cleanLimit,
    licenseType: cleanType,
    targetVersion: version,
    activationCode: code,
    shareText,
    licenseId: savedLicenseId
  });
});

function applyActivatedLicenseToDatabase(params: {
  rawCode: string;
  clientName: string;
  expiresAt: string;
  devicesLimit: number;
  licenseType: "desktop" | "cloud";
  targetVersion: string;
  notes?: string;
  deviceIdsToAuthorize: string[];
  deviceName?: string;
}) {
  const {
    rawCode,
    clientName,
    expiresAt,
    devicesLimit,
    licenseType,
    notes,
    deviceIdsToAuthorize,
    deviceName
  } = params;

  // Always authorize CURRENT_SYSTEM_VERSION so version mismatch never blocks login after activation
  const effectiveVersion = CURRENT_SYSTEM_VERSION;

  let lic = db.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get() as any;
  if (!lic) {
    const r = db.prepare(`
      INSERT INTO licenses (license_key, client_name, devices_limit, expires_at, active, status, target_version, license_type, notes)
      VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?)
    `).run(rawCode, clientName, devicesLimit, expiresAt, effectiveVersion, licenseType, notes || "تم التفعيل بكود الترخيص الرقمي المشفر");
    lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(r.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE licenses 
      SET license_key=?, client_name=?, devices_limit=?, expires_at=?, target_version=?, license_type=?, notes=?, active=1, status='active'
      WHERE id=?
    `).run(rawCode, clientName, devicesLimit, expiresAt, effectiveVersion, licenseType, notes || lic.notes || "تم التفعيل بكود الترخيص الرقمي المشفر", lic.id);
    lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(lic.id);
  }

  // Deactivate any older duplicate rows so checkLicenseStatus always picks this activated license
  try {
    db.prepare("UPDATE licenses SET active=0 WHERE id != ?").run(lic.id);
  } catch (e) {}

  // Update businessName in settings table so Login screen & Header display the licensed client name
  try {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('businessName', ?)").run(clientName);
  } catch (e) {}

  // Ensure all candidate device IDs (including system HWID) are authorized in license_devices
  const uniqueDevs = Array.from(new Set(deviceIdsToAuthorize.map(d => String(d || "").trim().toUpperCase()).filter(d => d && d !== "*")));
  for (const devId of uniqueDevs) {
    const existingDev = db.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, devId) as any;
    if (existingDev) {
      db.prepare("UPDATE license_devices SET status='authorized', authorized_by='كود ترخيص مشفر معتمد', last_active=datetime('now', 'localtime') WHERE id=?").run(existingDev.id);
    } else {
      db.prepare(`
        INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active, registered_at)
        VALUES (?, ?, ?, 'كود ترخيص مشفر معتمد', 'authorized', datetime('now', 'localtime'), datetime('now', 'localtime'))
      `).run(lic.id, devId, deviceName || `جهاز مفعل (${os.hostname()})`);
    }
  }

  // Ensure default admin account (admin / admin123) is active and ready for login
  try {
    const adminUser = db.prepare("SELECT id FROM users WHERE username='admin'").get() as any;
    const adminHash = hashPassword("admin123");
    if (!adminUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active, can_discount, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits, perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries) VALUES (?,?,?,?,1,1,1,1,1,1,1,1,1,1,1,1,1)`)
        .run("admin", adminHash, "مدير عام النظام", "admin");
    } else {
      db.prepare("UPDATE users SET active=1, role='admin' WHERE username='admin'").run();
    }
  } catch (e) {}

  return lic;
}

// Public endpoint: Decrypt and inspect an activation code before/during activation
router.post("/licenses/inspect-code", (req, res) => {
  const { activation_code, device_id } = req.body;
  const sysDev = getSystemDeviceId().trim().toUpperCase();
  const currentDev = (device_id ? String(device_id).trim().toUpperCase() : sysDev) || sysDev;

  if (!activation_code || !String(activation_code).trim()) {
    res.json({ valid: false });
    return;
  }

  const rawCode = String(activation_code).trim().replace(/[\r\n\t\s]+/g, "");
  const decrypted = decryptLicenseToken(rawCode);
  if (decrypted) {
    const targetHwid = String(decrypted.hwid || "*").trim().toUpperCase();
    const targetExp = String(decrypted.exp || "2027-12-31").trim();
    const targetClient = String(decrypted.client || "مؤسسة أومني سيستم للتجارة والمبيعات").trim();
    const targetLimit = Math.max(1, Number(decrypted.limit) || 1);
    const targetType = decrypted.type === "cloud" ? "cloud" : "desktop";
    const isDeviceMatch = targetType === "cloud" || targetHwid === "*" || targetHwid === currentDev || targetHwid === sysDev;
    const expDateObj = new Date(`${targetExp}T23:59:59`);
    const isExpired = !isNaN(expDateObj.getTime()) && expDateObj < new Date();

    res.json({
      valid: true,
      encrypted: true,
      hwid: targetHwid,
      clientName: targetClient,
      expiresAt: targetExp,
      devicesLimit: targetLimit,
      licenseType: targetType,
      targetVersion: decrypted.ver || CURRENT_SYSTEM_VERSION,
      notes: decrypted.notes || "",
      isDeviceMatch,
      isExpired,
      currentDevice: currentDev
    });
    return;
  }

  const licByKey = db.prepare("SELECT * FROM licenses WHERE (license_key=? OR license_key=?) ORDER BY id DESC LIMIT 1").get(rawCode, rawCode.toUpperCase()) as any;
  if (licByKey) {
    const expDateObj = new Date(`${licByKey.expires_at}T23:59:59`);
    const isExpired = !isNaN(expDateObj.getTime()) && expDateObj < new Date();
    res.json({
      valid: true,
      encrypted: false,
      hwid: currentDev,
      clientName: licByKey.client_name,
      expiresAt: licByKey.expires_at,
      devicesLimit: licByKey.devices_limit || 1,
      licenseType: licByKey.license_type || "desktop",
      targetVersion: licByKey.target_version || CURRENT_SYSTEM_VERSION,
      isDeviceMatch: true,
      isExpired,
      currentDevice: currentDev
    });
    return;
  }

  const hmacMatch = findLegacyHmacMatch(rawCode, [currentDev, sysDev, "HW-3789-3288-C91A", "*"]);
  if (hmacMatch) {
    const expDateObj = new Date(`${hmacMatch.exp}T23:59:59`);
    const isExpired = !isNaN(expDateObj.getTime()) && expDateObj < new Date();
    res.json({
      valid: true,
      encrypted: true,
      hwid: hmacMatch.hwid,
      clientName: "مؤسسة أومني سيستم للتجارة والمبيعات",
      expiresAt: hmacMatch.exp,
      devicesLimit: hmacMatch.limit,
      licenseType: "desktop",
      targetVersion: hmacMatch.ver,
      isDeviceMatch: true,
      isExpired,
      currentDevice: currentDev
    });
    return;
  }

  res.json({ valid: false });
});

// Public / Login Screen: Activate Device directly with Encrypted Activation Code or License Key
router.post("/licenses/activate-with-code", (req, res) => {
  const { device_id, activation_code, expires_at, target_version, device_name, client_name } = req.body;
  const sysDev = getSystemDeviceId().trim().toUpperCase();
  const currentDev = (device_id ? String(device_id).trim().toUpperCase() : sysDev) || sysDev;

  if (!activation_code || !String(activation_code).trim()) {
    res.status(400).json({ error: "يرجى إدخال كود التفعيل الممنوح لك" });
    return;
  }

  const rawCode = String(activation_code).trim().replace(/[\r\n\t\s]+/g, "");

  // 1. Primary Strategy: Decrypt self-contained encrypted license token (OMNI-LIC. or ACT-LIC-)
  const decrypted = decryptLicenseToken(rawCode);
  if (decrypted) {
    const targetHwid = String(decrypted.hwid || "*").trim().toUpperCase();
    const targetExp = String(decrypted.exp || "2027-12-31").trim();
    const targetClient = String(decrypted.client || client_name || "مؤسسة أومني سيستم للتجارة والمبيعات").trim();
    const targetLimit = Math.max(1, Number(decrypted.limit) || 1);
    const targetType = decrypted.type === "cloud" ? "cloud" : "desktop";
    const targetVer = String(decrypted.ver || CURRENT_SYSTEM_VERSION).trim();

    // Check device match (allow if cloud, wildcard *, or matches either reported device_id or server HWID)
    if (targetType !== "cloud" && targetHwid !== "*" && targetHwid !== currentDev && targetHwid !== sysDev) {
      res.status(400).json({
        error: `كود الترخيص مخصص لبصمة جهاز أخرى (${targetHwid})، ولا يطابق بصمة جهازك الحالي (${currentDev}). يرجى التأكد من إرسال بصمة جهازك الصحيحة للمطور.`
      });
      return;
    }

    // Check expiration date (end of day)
    const expDateObj = new Date(`${targetExp}T23:59:59`);
    if (!isNaN(expDateObj.getTime()) && expDateObj < new Date()) {
      res.status(400).json({
        error: `كود الترخيص منتهي الصلاحية بتاريخ (${targetExp}). يرجى التواصل مع إدارة ومطور النظام لتجديد الترخيص.`
      });
      return;
    }

    applyActivatedLicenseToDatabase({
      rawCode,
      clientName: targetClient,
      expiresAt: targetExp,
      devicesLimit: targetLimit,
      licenseType: targetType,
      targetVersion: targetVer,
      notes: decrypted.notes,
      deviceIdsToAuthorize: [currentDev, sysDev, targetHwid],
      deviceName: device_name
    });

    res.json({
      success: true,
      message: "ألف مبروك تم الترخيص! قم بتسجيل الدخول للنظام باسم المستخدم admin وكلمة السر admin123",
      clientName: targetClient,
      expiresAt: targetExp,
      devicesLimit: targetLimit,
      licenseType: targetType,
      deviceId: currentDev,
      credentials: {
        username: "admin",
        password: "admin123"
      }
    });
    return;
  }

  // 2. Secondary Strategy: Direct Database key lookup
  const licByKey = db.prepare(`
    SELECT * FROM licenses 
    WHERE (license_key=? OR license_key=?) 
      AND active=1 
      AND (status IS NULL OR status='active')
    ORDER BY id DESC LIMIT 1
  `).get(rawCode, rawCode.toUpperCase()) as any;

  if (licByKey) {
    const expDateObj = new Date(`${licByKey.expires_at}T23:59:59`);
    if (!isNaN(expDateObj.getTime()) && expDateObj < new Date()) {
      res.status(400).json({ error: `كود الترخيص منتهي الصلاحية بتاريخ (${licByKey.expires_at}). يرجى التواصل مع إدارة النظام للتجديد.` });
      return;
    }

    applyActivatedLicenseToDatabase({
      rawCode: licByKey.license_key,
      clientName: licByKey.client_name || "عميل مرخص",
      expiresAt: licByKey.expires_at,
      devicesLimit: licByKey.devices_limit || 1,
      licenseType: licByKey.license_type === "cloud" ? "cloud" : "desktop",
      targetVersion: licByKey.target_version || CURRENT_SYSTEM_VERSION,
      notes: licByKey.notes,
      deviceIdsToAuthorize: [currentDev, sysDev],
      deviceName: device_name
    });

    res.json({
      success: true,
      message: "ألف مبروك تم الترخيص! قم بتسجيل الدخول للنظام باسم المستخدم admin وكلمة السر admin123",
      deviceId: currentDev,
      clientName: licByKey.client_name,
      expiresAt: licByKey.expires_at,
      devicesLimit: licByKey.devices_limit,
      licenseType: licByKey.license_type || "desktop",
      credentials: {
        username: "admin",
        password: "admin123"
      }
    });
    return;
  }

  // 3. Tertiary Strategy: Smart Legacy HMAC Date & Limit Scanner (supports ACT-XXXX-XXXX-XXXX-XXXX codes across all dates)
  const hmacMatch = findLegacyHmacMatch(rawCode, [currentDev, sysDev, "HW-3789-3288-C91A", "*"]);
  if (hmacMatch) {
    const expDateObj = new Date(`${hmacMatch.exp}T23:59:59`);
    if (!isNaN(expDateObj.getTime()) && expDateObj < new Date()) {
      res.status(400).json({
        error: `كود الترخيص منتهي الصلاحية بتاريخ (${hmacMatch.exp}). يرجى التواصل مع إدارة النظام للتجديد.`
      });
      return;
    }

    const resolvedClient = client_name || "مؤسسة أومني سيستم للتجارة والمبيعات";
    applyActivatedLicenseToDatabase({
      rawCode,
      clientName: resolvedClient,
      expiresAt: hmacMatch.exp,
      devicesLimit: hmacMatch.limit,
      licenseType: "desktop",
      targetVersion: hmacMatch.ver,
      notes: `تم التفعيل بكود رقمي (${rawCode}) للبصمة (${hmacMatch.hwid})`,
      deviceIdsToAuthorize: [currentDev, sysDev, hmacMatch.hwid],
      deviceName: device_name
    });

    res.json({
      success: true,
      message: "ألف مبروك تم الترخيص! قم بتسجيل الدخول للنظام باسم المستخدم admin وكلمة السر admin123",
      deviceId: currentDev,
      clientName: resolvedClient,
      expiresAt: hmacMatch.exp,
      devicesLimit: hmacMatch.limit,
      licenseType: "desktop",
      credentials: {
        username: "admin",
        password: "admin123"
      }
    });
    return;
  }

  res.status(400).json({
    error: "كود الترخيص المدخل غير مطابق لبصمة هذا الجهاز أو منتهي الصلاحية. يرجى مراجعة إدارة النظام للحصول على كود ترخيص معتمد."
  });
});

// Developer: Approve and upgrade all active licenses to the latest system release version
router.post("/licenses/upgrade-all-to-version", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const version = req.body.version || CURRENT_SYSTEM_VERSION;

  db.prepare("UPDATE licenses SET target_version=? WHERE active=1").run(version);
  logAudit(user.id, user.name, "اعتماد ترخيص إصدار النظام", `تم اعتماد الإصدار (${version}) لجميع التراخيص النشطة`);

  res.json({
    success: true,
    message: `تم اعتماد وترخيص تشغيل الإصدار الجديد (v${version}) بنجاح!`,
    version
  });
});

// Developer: Toggle device authorization / block status
router.patch("/licenses/devices/:id/toggle", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const dev = db.prepare("SELECT * FROM license_devices WHERE id=?").get(req.params.id) as any;
  if (!dev) {
    res.status(404).json({ error: "الجهاز غير موجود" });
    return;
  }
  const newStatus = dev.status === 'blocked' ? 'authorized' : 'blocked';
  db.prepare("UPDATE license_devices SET status=? WHERE id=?").run(newStatus, dev.id);
  logAudit(user.id, user.name, "تغيير حالة جهاز", `تم تغيير حالة الجهاز (${dev.device_id}) إلى ${newStatus === 'blocked' ? 'محظور' : 'مرخص'}`);
  
  res.json({ success: true, id: dev.id, status: newStatus });
});

// Developer: Update License details
router.patch("/licenses/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req);
  const userId = user?.id ?? 1;
  const userName = user?.name ?? "مطور النظام";
  const { status, active, expires_at, expire_date, client_name, devices_limit, target_version, license_type, notes } = req.body;
  const lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id) as any;
  if (!lic) {
    res.status(404).json({ error: "الترخيص غير موجود" });
    return;
  }

  const finalExpiresAt = expires_at ?? expire_date ?? lic.expires_at;
  const finalStatus = status !== undefined ? status : (lic.status || "active");
  const finalActive = active !== undefined ? (active ? 1 : 0) : (finalStatus === "suspended" ? 0 : 1);
  const finalClientName = client_name ?? lic.client_name;
  const finalDevicesLimit = devices_limit !== undefined ? Number(devices_limit) : lic.devices_limit;
  const finalVersion = target_version !== undefined ? target_version : (lic.target_version || CURRENT_SYSTEM_VERSION);
  const finalLicType = license_type !== undefined ? license_type : (lic.license_type || "cloud");
  const finalNotes = notes !== undefined ? notes : lic.notes;

  db.prepare(`
    UPDATE licenses 
    SET client_name=?, devices_limit=?, expires_at=?, active=?, status=?, target_version=?, license_type=?, notes=?
    WHERE id=?
  `).run(finalClientName, finalDevicesLimit, finalExpiresAt, finalActive, finalStatus, finalVersion, finalLicType, finalNotes, req.params.id);

  logAudit(userId, userName, "تعديل ترخيص", `تم تحديث الترخيص رقم ${req.params.id} (${lic.license_key}) - الحالة: ${finalStatus}, الإصدار: ${finalVersion}, النوع: ${finalLicType}`);

  const updated = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id) as any;
  const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(updated.id);
  res.json({ ...updated, devices, active_devices_count: devices.length });
});

router.put("/licenses/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req);
  const userId = user?.id ?? 1;
  const userName = user?.name ?? "مطور النظام";
  const { status, active, expires_at, expire_date, client_name, devices_limit, target_version, license_type, notes } = req.body;
  const lic = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id) as any;
  if (!lic) {
    res.status(404).json({ error: "الترخيص غير موجود" });
    return;
  }

  const finalExpiresAt = expires_at ?? expire_date ?? lic.expires_at;
  const finalStatus = status !== undefined ? status : (lic.status || "active");
  const finalActive = active !== undefined ? (active ? 1 : 0) : (finalStatus === "suspended" ? 0 : 1);
  const finalClientName = client_name ?? lic.client_name;
  const finalDevicesLimit = devices_limit !== undefined ? Number(devices_limit) : lic.devices_limit;
  const finalVersion = target_version !== undefined ? target_version : (lic.target_version || CURRENT_SYSTEM_VERSION);
  const finalLicType = license_type !== undefined ? license_type : (lic.license_type || "cloud");
  const finalNotes = notes !== undefined ? notes : lic.notes;

  db.prepare(`
    UPDATE licenses 
    SET client_name=?, devices_limit=?, expires_at=?, active=?, status=?, target_version=?, license_type=?, notes=?
    WHERE id=?
  `).run(finalClientName, finalDevicesLimit, finalExpiresAt, finalActive, finalStatus, finalVersion, finalLicType, finalNotes, req.params.id);

  logAudit(userId, userName, "تعديل ترخيص", `تم تحديث الترخيص رقم ${req.params.id} (${lic.license_key}) - الحالة: ${finalStatus}`);

  const updated = db.prepare("SELECT * FROM licenses WHERE id=?").get(req.params.id) as any;
  const devices = db.prepare("SELECT * FROM license_devices WHERE license_id=? ORDER BY id DESC").all(updated.id);
  res.json({ ...updated, devices, active_devices_count: devices.length });
});

// Developer: Remove device from license
router.delete("/licenses/devices/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  const dev = db.prepare("SELECT * FROM license_devices WHERE id=?").get(req.params.id) as any;
  db.prepare("DELETE FROM license_devices WHERE id=?").run(req.params.id);
  logAudit(user.id, user.name, "إلغاء ربط جهاز", `تم إزالة الجهاز (${dev?.device_id || req.params.id})`);
  res.status(204).send();
});

// Developer: Delete license
router.delete("/licenses/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const user = getAuthUser(req)!;
  db.prepare("DELETE FROM license_devices WHERE license_id=?").run(req.params.id);
  db.prepare("DELETE FROM licenses WHERE id=?").run(req.params.id);
  logAudit(user.id, user.name, "حذف ترخيص", `تم حذف الترخيص رقم ${req.params.id}`);
  res.status(204).send();
});

export default router;
