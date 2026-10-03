import { db } from "../../lib/sqlite";
import { logger } from "../../lib/logger";

export function evaluateTravelerAutomationRules() {
  // Evaluates travelers for automated reminders and ticket dispatch
  try {
    const travelers = db.prepare(`
      SELECT * FROM travelers WHERE whatsapp_sent = 0 OR whatsapp_sent IS NULL
    `).all() as any[];

    return { evaluated_count: travelers.length };
  } catch (err) {
    logger.error({ err }, "Error evaluating traveler automation rules");
    return { evaluated_count: 0 };
  }
}
