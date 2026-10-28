import { startWhatsAppScheduler, stopWhatsAppScheduler } from "./scheduler/whatsapp-scheduler";
import { getConnectionState, updateConnectionState, testWhatsAppConnection } from "./connection/whatsapp-connection";
import { validatePhoneNumber, generateIdempotencyKey, checkDuplicateMessage } from "./messages/whatsapp-messages";
import { getTemplates, updateTemplate, renderTemplate } from "./templates/whatsapp-templates";
import { enqueueMessage, getQueueItems, updateQueueStatus } from "./queue/whatsapp-queue";
import { getAutomationSettings, updateAutomationSettings } from "./scheduler/whatsapp-scheduler";
import { logWhatsAppMessage, getTravelerWhatsAppHistory } from "./logs/whatsapp-logs";
import { runWhatsAppDiagnostics } from "./health/whatsapp-health";

// Automatically start scheduler on service load
startWhatsAppScheduler();

export {
  getConnectionState,
  updateConnectionState,
  testWhatsAppConnection,
  validatePhoneNumber,
  generateIdempotencyKey,
  checkDuplicateMessage,
  getTemplates,
  updateTemplate,
  renderTemplate,
  enqueueMessage,
  getQueueItems,
  updateQueueStatus,
  getAutomationSettings,
  updateAutomationSettings,
  logWhatsAppMessage,
  getTravelerWhatsAppHistory,
  runWhatsAppDiagnostics,
  startWhatsAppScheduler,
  stopWhatsAppScheduler
};
