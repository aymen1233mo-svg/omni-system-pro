import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

export function recordAuditLog({
  userId,
  userName,
  action,
  actionType = "update",
  entityType,
  entityId,
  deviceName = "DESKTOP-POS-MAIN",
  ipAddress,
  oldData,
  newData,
  details,
  branchId = 1
}: {
  userId?: number | null;
  userName?: string | null;
  action: string;
  actionType?: "create" | "update" | "delete" | "void" | "refund" | "reissue" | "approve" | "print" | "login" | "export";
  entityType?: string | null;
  entityId?: number | null;
  deviceName?: string | null;
  ipAddress?: string | null;
  oldData?: any;
  newData?: any;
  details?: string | null;
  branchId?: number | null;
}) {
  try {
    if (userId === 2) return; // Prevent developer account from being logged
    const oldJson = oldData ? (typeof oldData === "string" ? oldData : JSON.stringify(oldData, null, 2)) : null;
    const newJson = newData ? (typeof newData === "string" ? newData : JSON.stringify(newData, null, 2)) : null;

    db.prepare(`
      INSERT INTO audit_logs (
        user_id, user_name, action, action_type, entity_type, entity_id,
        device_name, ip_address, old_data, new_data, details, branch_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(
      userId || null,
      userName || 'مستخدم النظام',
      action,
      actionType,
      entityType || null,
      entityId || null,
      deviceName || 'WORKSTATION-01',
      ipAddress || '127.0.0.1',
      oldJson,
      newJson,
      details || null,
      branchId || 1
    );
  } catch (err) {
    console.error("Error recording audit log:", err);
  }
}

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح بالوصول إلى سجل التدقيق" });
    return false;
  }
  return true;
}

router.get(["/audit-logs", "/audit"], (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { entity_type, entity_id, action_type, search, user_id, date_from, date_to, limit } = req.query;

  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params: any[] = [];

  if (user && user.role !== "developer") {
    sql += `
      AND (user_name NOT IN ('المطور', 'developer') OR user_name IS NULL)
      AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM users WHERE role = 'developer' OR username = 'developer'))
      AND action NOT LIKE '%ترخيص%'
      AND action NOT LIKE '%مطور%'
    `;
  }

  if (entity_type) {
    sql += ` AND entity_type = ?`;
    params.push(entity_type);
  }

  if (entity_id) {
    sql += ` AND entity_id = ?`;
    params.push(entity_id);
  }

  if (action_type) {
    sql += ` AND action_type = ?`;
    params.push(action_type);
  }

  if (user_id) {
    sql += ` AND user_id = ?`;
    params.push(user_id);
  }

  if (date_from) {
    sql += ` AND created_at >= ?`;
    params.push(`${date_from} 00:00:00`);
  }

  if (date_to) {
    sql += ` AND created_at <= ?`;
    params.push(`${date_to} 23:59:59`);
  }

  if (search) {
    sql += ` AND (action LIKE ? OR details LIKE ? OR user_name LIKE ? OR device_name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const queryLimit = Math.min(Number(limit || 200), 500);
  sql += ` ORDER BY created_at DESC, id DESC LIMIT ${queryLimit}`;

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

// Specific entity activity timeline
router.get("/audit-logs/timeline/:entity_type/:entity_id", (req, res) => {
  const { entity_type, entity_id } = req.params;
  const user = getAuthUser(req);
  
  let sql = `SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?`;
  const params: any[] = [entity_type, entity_id];

  if (user && user.role !== "developer") {
    sql += `
      AND (user_name NOT IN ('المطور', 'developer') OR user_name IS NULL)
      AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM users WHERE role = 'developer' OR username = 'developer'))
      AND action NOT LIKE '%ترخيص%'
      AND action NOT LIKE '%مطور%'
    `;
  }

  sql += ` ORDER BY created_at DESC, id DESC LIMIT 100`;
  const logs = db.prepare(sql).all(...params);

  res.json(logs);
});

export default router;

