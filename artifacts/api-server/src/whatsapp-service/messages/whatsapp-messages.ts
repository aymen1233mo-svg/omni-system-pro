import crypto from "node:crypto";
import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";

export interface OutgoingWhatsAppMessage {
  phone: string;
  message: string;
  document_url?: string;
  document_name?: string;
  traveler_id?: number;
  template_key?: string;
  idempotency_key?: string;
}

export function validatePhoneNumber(phone: string): { valid: boolean; normalized: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: "", error: "رقم الهاتـف فارغ" };
  }
  let cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.startsWith("0")) {
    // Assume local Saudi or standard regional number starting with 0, convert to 966 if needed
    cleaned = "966" + cleaned.slice(1);
  }
  if (cleaned.length < 9) {
    return { valid: false, normalized: cleaned, error: "رقم الهاتف قصير جداً غير صالح" };
  }
  return { valid: true, normalized: cleaned };
}

export function generateIdempotencyKey(phone: string, templateKey: string, payloadSignature: string): string {
  const hash = crypto.createHash("sha256").update(`${phone}:${templateKey}:${payloadSignature}:${new Date().toDateString()}`).digest("hex");
  return `idemp_${hash.slice(0, 24)}`;
}

export function checkDuplicateMessage(idempotencyKey: string): boolean {
  if (!idempotencyKey) return false;
  try {
    const row = db.prepare(`
      SELECT id FROM whatsapp_message_queue
      WHERE idempotency_key = ? AND status IN ('SENT', 'DELIVERED', 'PROCESSING', 'PENDING')
      LIMIT 1
    `).get(idempotencyKey) as any;
    return !!row;
  } catch (e) {
    return false;
  }
}
