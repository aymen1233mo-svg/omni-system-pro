import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";

export interface WhatsAppTemplate {
  id: number;
  template_key: string;
  title: string;
  body: string;
  is_active: number;
}

export function initWhatsAppTemplatesSchema() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `).run();

    const defaults = [
      {
        key: "booking_confirmation",
        title: "تأكيد الحجز",
        body: "السلام عليكم {{traveler_name}}، نود إعلامكم بأن حجزكم برقم ({{booking_number}}) على خطوط {{airline}} بتاريخ {{departure_date}} الساعة {{departure_time}} مؤكد وموثق بنجاح. رحلة سعيدة!"
      },
      {
        key: "trip_reminder",
        title: "تذكير الرحلة",
        body: "عزيزي المسافر {{traveler_name}}، نذكركم بموعد رحلتكم القادمة برقم الحجز {{booking_number}} على متن {{airline}} في تاريخ {{departure_date}} الساعة {{departure_time}}. يرجى التواجد بالمطار قبل الموعد بـ 3 ساعات."
      },
      {
        key: "passport_expiry",
        title: "انتهاء الجواز",
        body: "تنبيه هام للمسافر {{traveler_name}}: نود إفادتكم بأن جواز السفر الخاص بكم سينتهي بتاريخ {{passport_expiry}}. يرجى المبادرة بالتجديد لضمان سلاسة سفركم."
      },
      {
        key: "ticket_issued",
        title: "إصدار التذكرة",
        body: "عزيزي {{traveler_name}}، تم إصدار تذكرة السفر الخاصة بكم برقم التذكرة {{ticket_number}} ورقم الحجز {{booking_number}}. مرفق أدناه مستند التذكرة الرسمي."
      },
      {
        key: "invoice_sent",
        title: "إرسال الفاتورة",
        body: "مرحباً {{traveler_name}}، مرفق تفاصيل الفاتورة المالية الخاصة بكم برقم {{booking_number}}. شكراً لثقتكم بمؤسسة أومني سيستم (Omni System Pro ERP)."
      },
      {
        key: "document_sent",
        title: "إرسال المستندات",
        body: "عزيزي المسافر {{traveler_name}}، تجدون مرفقاً بهذا الرسالة كافة مستندات السفر، التأشيرة، والحجز الخاصة برحلتكم."
      }
    ];

    for (const t of defaults) {
      db.prepare(`
        INSERT OR IGNORE INTO whatsapp_templates (template_key, title, body, is_active)
        VALUES (?, ?, ?, 1)
      `).run(t.key, t.title, t.body);
    }
  } catch (err) {
    logger.error({ err }, "Error initializing WhatsApp templates schema");
  }
}

initWhatsAppTemplatesSchema();

export function getTemplates(): WhatsAppTemplate[] {
  try {
    return db.prepare("SELECT * FROM whatsapp_templates ORDER BY id ASC").all() as WhatsAppTemplate[];
  } catch (e) {
    return [];
  }
}

export function updateTemplate(templateKey: string, body: string, title?: string, isActive?: number): boolean {
  try {
    db.prepare(`
      UPDATE whatsapp_templates
      SET body = ?, title = COALESCE(?, title), is_active = COALESCE(?, is_active), updated_at = datetime('now', 'localtime')
      WHERE template_key = ?
    `).run(body, title || null, isActive ?? null, templateKey);
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to update WhatsApp template");
    return false;
  }
}

export function renderTemplate(templateKey: string, variables: Record<string, string>): string {
  try {
    const row = db.prepare("SELECT body FROM whatsapp_templates WHERE template_key = ? AND is_active = 1").get(templateKey) as any;
    if (!row || !row.body) {
      return `مرحباً بك، نرفق لكم تفاصيل فاتورتكم وعمليتكم عبر مؤسسة أومني سيستم (Omni System Pro ERP).`;
    }
    let text = row.body;
    for (const [key, val] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      text = text.replace(regex, val || "-");
    }
    return text;
  } catch (e) {
    return `مرحباً بك، تفاصيل الحجز والسفر.`;
  }
}
