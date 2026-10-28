import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import {
  getConnectionState,
  updateConnectionState,
  testWhatsAppConnection,
  getTemplates,
  updateTemplate,
  renderTemplate,
  enqueueMessage,
  getQueueItems,
  getAutomationSettings,
  updateAutomationSettings,
  getTravelerWhatsAppHistory,
  runWhatsAppDiagnostics,
  validatePhoneNumber,
  generateIdempotencyKey,
  checkDuplicateMessage
} from "../whatsapp-service";

const router = Router();

// 1. Connection Status & Management
router.get("/connection", (req: Request, res: Response) => {
  try {
    const state = getConnectionState();
    res.json(state);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/connection error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

router.post("/connection/update", (req: Request, res: Response) => {
  try {
    const partial = req.body;
    const updated = updateConnectionState(partial);
    res.json({ success: true, state: updated });
  } catch (err: any) {
    logger.error({ err }, "POST /api/whatsapp-service/connection/update error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

router.post("/connection/test", (req: Request, res: Response) => {
  try {
    const result = testWhatsAppConnection();
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "POST /api/whatsapp-service/connection/test error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

// 2. Templates
router.get("/templates", (req: Request, res: Response) => {
  try {
    const templates = getTemplates();
    res.json(templates);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/templates error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

router.post("/templates/update", (req: Request, res: Response) => {
  try {
    const { template_key, body, title, is_active } = req.body;
    if (!template_key || !body) {
      return res.status(400).json({ error: "Missing template_key or body" });
    }
    const success = updateTemplate(template_key, body, title, is_active);
    res.json({ success });
  } catch (err: any) {
    logger.error({ err }, "POST /api/whatsapp-service/templates/update error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

// 3. Message Queue
router.get("/queue", (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const items = getQueueItems(status as any, limit ? Number(limit) : 50);
    res.json(items);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/queue error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

router.post("/queue/send", (req: Request, res: Response) => {
  try {
    const { phone, message, document_url, document_name, traveler_id, template_key } = req.body;
    const val = validatePhoneNumber(phone);
    if (!val.valid) {
      return res.status(400).json({ error: val.error || "رقم الهاتف غير صالح" });
    }

    const idempotencyKey = generateIdempotencyKey(val.normalized, template_key || "custom", message);
    if (checkDuplicateMessage(idempotencyKey)) {
      return res.status(400).json({ error: "تم إرسال هذه الرسالة مسبقاً (محمي ضد التكرار عبر Idempotency Key)" });
    }

    const result = enqueueMessage({
      phone: val.normalized,
      message,
      document_url,
      document_name,
      traveler_id: traveler_id ? Number(traveler_id) : undefined,
      template_key,
      idempotency_key: idempotencyKey
    });

    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "POST /api/whatsapp-service/queue/send error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

// 4. Automation Settings
router.get("/automation", (req: Request, res: Response) => {
  try {
    const settings = getAutomationSettings();
    res.json(settings);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/automation error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

router.post("/automation/update", (req: Request, res: Response) => {
  try {
    const updated = updateAutomationSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    logger.error({ err }, "POST /api/whatsapp-service/automation/update error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

// 5. Traveler History
router.get("/history/:travelerId", (req: Request, res: Response) => {
  try {
    const travelerId = Number(req.params.travelerId);
    const history = getTravelerWhatsAppHistory(travelerId);
    res.json(history);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/history error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

// 6. Diagnostics
router.get("/diagnostics", (req: Request, res: Response) => {
  try {
    const diagnostics = runWhatsAppDiagnostics();
    res.json(diagnostics);
  } catch (err: any) {
    logger.error({ err }, "GET /api/whatsapp-service/diagnostics error");
    res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
});

export default router;
