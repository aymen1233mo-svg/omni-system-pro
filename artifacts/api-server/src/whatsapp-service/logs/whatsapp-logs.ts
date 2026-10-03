import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";

export interface WhatsAppMessageHistoryItem {
  id: number;
  traveler_id: number;
  phone: string;
  message_type: string;
  content: string;
  document_url?: string;
  status: string;
  failure_reason?: string;
  attempts: number;
  sent_at: string;
}

export function initWhatsAppHistorySchema() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_message_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        traveler_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        content TEXT NOT NULL,
        document_url TEXT,
        status TEXT DEFAULT 'SENT',
        failure_reason TEXT,
        attempts INTEGER DEFAULT 1,
        sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )
    `).run();
  } catch (err) {
    logger.error({ err }, "Error initializing WhatsApp history schema");
  }
}

initWhatsAppHistorySchema();

export function logWhatsAppMessage(data: {
  traveler_id: number;
  phone: string;
  message_type?: string;
  content: string;
  document_url?: string;
  status: string;
  failure_reason?: string;
  attempts?: number;
}): void {
  try {
    db.prepare(`
      INSERT INTO whatsapp_message_history (
        traveler_id, phone, message_type, content, document_url, status, failure_reason, attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.traveler_id,
      data.phone,
      data.message_type || "text",
      data.content,
      data.document_url || null,
      data.status,
      data.failure_reason || null,
      data.attempts || 1
    );
  } catch (err) {
    logger.error({ err }, "Failed to log WhatsApp message history");
  }
}

export function getTravelerWhatsAppHistory(travelerId: number): WhatsAppMessageHistoryItem[] {
  try {
    return db.prepare("SELECT * FROM whatsapp_message_history WHERE traveler_id = ? ORDER BY id DESC").all(travelerId) as WhatsAppMessageHistoryItem[];
  } catch (e) {
    return [];
  }
}
