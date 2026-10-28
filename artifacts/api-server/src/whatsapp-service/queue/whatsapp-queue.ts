import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";

export type QueueStatus = "PENDING" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED" | "RETRY" | "CANCELLED";

export interface QueueItem {
  id: number;
  phone: string;
  message: string;
  document_url?: string;
  document_name?: string;
  traveler_id?: number;
  template_key?: string;
  idempotency_key?: string;
  status: QueueStatus;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
}

export function initWhatsAppQueueSchema() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_message_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        document_url TEXT,
        document_name TEXT,
        traveler_id INTEGER,
        template_key TEXT,
        idempotency_key TEXT UNIQUE,
        status TEXT DEFAULT 'PENDING',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        last_error TEXT,
        scheduled_at TEXT DEFAULT (datetime('now', 'localtime')),
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `).run();
  } catch (err) {
    logger.error({ err }, "Error initializing WhatsApp message queue schema");
  }
}

initWhatsAppQueueSchema();

export function enqueueMessage(data: {
  phone: string;
  message: string;
  document_url?: string;
  document_name?: string;
  traveler_id?: number;
  template_key?: string;
  idempotency_key?: string;
  max_retries?: number;
  scheduled_at?: string;
}): { success: boolean; queue_id?: number; error?: string } {
  try {
    if (data.idempotency_key) {
      const existing = db.prepare("SELECT id, status FROM whatsapp_message_queue WHERE idempotency_key = ?").get(data.idempotency_key) as any;
      if (existing) {
        return { success: true, queue_id: existing.id };
      }
    }

    const res = db.prepare(`
      INSERT INTO whatsapp_message_queue (
        phone, message, document_url, document_name, traveler_id, template_key, idempotency_key, status, max_retries, scheduled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, COALESCE(?, datetime('now', 'localtime')))
    `).run(
      data.phone,
      data.message,
      data.document_url || null,
      data.document_name || null,
      data.traveler_id || null,
      data.template_key || null,
      data.idempotency_key || null,
      data.max_retries ?? 3,
      data.scheduled_at || null
    );

    return { success: true, queue_id: res.lastInsertRowid };
  } catch (err: any) {
    logger.error({ err }, "Failed to enqueue WhatsApp message");
    return { success: false, error: err?.message };
  }
}

export function getQueueItems(status?: QueueStatus, limit = 50): QueueItem[] {
  try {
    if (status) {
      return db.prepare("SELECT * FROM whatsapp_message_queue WHERE status = ? ORDER BY id DESC LIMIT ?").all(status, limit) as QueueItem[];
    }
    return db.prepare("SELECT * FROM whatsapp_message_queue ORDER BY id DESC LIMIT ?").all(limit) as QueueItem[];
  } catch (e) {
    return [];
  }
}

export function updateQueueStatus(id: number, status: QueueStatus, lastError?: string): void {
  try {
    db.prepare(`
      UPDATE whatsapp_message_queue
      SET status = ?, last_error = COALESCE(?, last_error), retry_count = CASE WHEN ? = 'RETRY' THEN retry_count + 1 ELSE retry_count END, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, lastError || null, status, id);
  } catch (err) {
    logger.error({ err }, "Failed to update queue item status");
  }
}
