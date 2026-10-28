import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";
import { getConnectionState } from "../connection/whatsapp-connection";
import { getQueueItems, updateQueueStatus, QueueItem } from "../queue/whatsapp-queue";
import { logWhatsAppMessage } from "../logs/whatsapp-logs";

let schedulerInterval: any = null;
let isSchedulerRunning = false;

export function initWhatsAppAutomationSettingsSchema() {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_automation_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        flight_reminder_hours INTEGER DEFAULT 24,
        passport_expiry_days INTEGER DEFAULT 30,
        auto_send_ticket INTEGER DEFAULT 1,
        auto_send_pdf INTEGER DEFAULT 1,
        max_retry_attempts INTEGER DEFAULT 3,
        retry_wait_minutes INTEGER DEFAULT 15,
        allowed_start_hour INTEGER DEFAULT 8,
        allowed_end_hour INTEGER DEFAULT 22,
        is_automation_active INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO whatsapp_automation_settings (
        id, flight_reminder_hours, passport_expiry_days, auto_send_ticket, auto_send_pdf,
        max_retry_attempts, retry_wait_minutes, allowed_start_hour, allowed_end_hour, is_automation_active
      ) VALUES (
        1, 24, 30, 1, 1, 3, 15, 8, 22, 1
      )
    `).run();
  } catch (err) {
    logger.error({ err }, "Error initializing WhatsApp automation settings schema");
  }
}

initWhatsAppAutomationSettingsSchema();

export function getAutomationSettings() {
  try {
    const row = db.prepare("SELECT * FROM whatsapp_automation_settings WHERE id = 1").get();
    if (row) return row;
  } catch (e) {}
  return {
    flight_reminder_hours: 24,
    passport_expiry_days: 30,
    auto_send_ticket: 1,
    auto_send_pdf: 1,
    max_retry_attempts: 3,
    retry_wait_minutes: 15,
    allowed_start_hour: 8,
    allowed_end_hour: 22,
    is_automation_active: 1
  };
}

export function updateAutomationSettings(partial: any) {
  try {
    const current = getAutomationSettings() as any;
    const next = { ...current, ...partial };
    db.prepare(`
      UPDATE whatsapp_automation_settings
      SET flight_reminder_hours = ?, passport_expiry_days = ?, auto_send_ticket = ?, auto_send_pdf = ?,
          max_retry_attempts = ?, retry_wait_minutes = ?, allowed_start_hour = ?, allowed_end_hour = ?,
          is_automation_active = ?, updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(
      next.flight_reminder_hours,
      next.passport_expiry_days,
      next.auto_send_ticket,
      next.auto_send_pdf,
      next.max_retry_attempts,
      next.retry_wait_minutes,
      next.allowed_start_hour,
      next.allowed_end_hour,
      next.is_automation_active
    );
    return next;
  } catch (err) {
    logger.error({ err }, "Failed to update WhatsApp automation settings");
    return null;
  }
}

export function startWhatsAppScheduler() {
  if (schedulerInterval) return;
  logger.info("Starting WhatsApp Message Queue & Automation Scheduler");

  schedulerInterval = setInterval(async () => {
    if (isSchedulerRunning) return;
    isSchedulerRunning = true;

    try {
      const conn = getConnectionState();
      if (conn.status !== "CONNECTED") {
        isSchedulerRunning = false;
        return; // Pause queue processing if disconnected
      }

      const settings = getAutomationSettings() as any;
      if (!settings || settings.is_automation_active !== 1) {
        isSchedulerRunning = false;
        return;
      }

      // Check working hours
      const currentHour = new Date().getHours();
      if (currentHour < settings.allowed_start_hour || currentHour > settings.allowed_end_hour) {
        isSchedulerRunning = false;
        return; // Outside allowed working hours
      }

      // Fetch pending queue items
      const pendingItems = getQueueItems("PENDING", 10) as QueueItem[];
      for (const item of pendingItems) {
        try {
          updateQueueStatus(item.id, "PROCESSING");

          // Simulate dispatch to WhatsApp API / Provider
          await new Promise((r) => setTimeout(r, 600));

          updateQueueStatus(item.id, "SENT");

          // Log in traveler history / notification logs
          logWhatsAppMessage({
            traveler_id: item.traveler_id || 0,
            phone: item.phone,
            message_type: item.document_url ? "text_and_pdf" : "text",
            content: item.message,
            document_url: item.document_url,
            status: "SENT",
            attempts: item.retry_count + 1
          });
        } catch (err: any) {
          logger.error({ err, queue_id: item.id }, "Failed to process queue item");
          if (item.retry_count + 1 < (settings.max_retry_attempts || 3)) {
            updateQueueStatus(item.id, "RETRY", err?.message || "Send failed");
          } else {
            updateQueueStatus(item.id, "FAILED", err?.message || "Max retries exceeded");
            logWhatsAppMessage({
              traveler_id: item.traveler_id || 0,
              phone: item.phone,
              message_type: "text",
              content: item.message,
              status: "FAILED",
              failure_reason: err?.message || "Max retries exceeded",
              attempts: item.retry_count + 1
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in WhatsApp scheduler loop");
    } finally {
      isSchedulerRunning = false;
    }
  }, 30000); // Check every 30 seconds
}

export function stopWhatsAppScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
