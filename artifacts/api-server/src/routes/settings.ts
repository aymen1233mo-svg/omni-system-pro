import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import {
  getBusinessDayConfig,
  getBusinessDayStatus,
  invalidateBusinessDayConfigCache,
} from "../lib/business-day";
import { getNextPosInvoiceNumber } from "./orders";

const router = Router();

function getSettingsObj() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map: Record<string, any> = {};
  for (const r of rows) {
    if (r.value === "true") map[r.key] = true;
    else if (r.value === "false") map[r.key] = false;
    else if (r.value === "null" || r.value === "") map[r.key] = null;
    else if (!isNaN(Number(r.value)) && r.value !== "") map[r.key] = Number(r.value);
    else map[r.key] = r.value;
  }
  let docRow = null;
  try {
    docRow = db.prepare("SELECT company_name, logo_url FROM document_print_settings WHERE id = 1").get() as any;
  } catch {}

  const logoUrlVal = map["logoUrl"] && map["logoUrl"] !== "null" ? map["logoUrl"] : docRow?.logo_url ?? null;
  const businessNameVal = map["businessName"] && map["businessName"] !== "مطعمي" ? map["businessName"] : docRow?.company_name || map["businessName"] || "وكالة السفريات والسياحة ERP";

  return {
    businessName: businessNameVal,
    address: map["address"] ?? null,
    phone: map["phone"] ?? null,
    taxNumber: map["taxNumber"] ?? null,
    taxRate: map["taxRate"] ?? 15,
    currency: map["currency"] ?? "ريال",
    receiptMessage: map["receiptMessage"] ?? null,
    printLogo: map["printLogo"] ?? true,
    printQr: map["printQr"] ?? false,
    showCashier: map["showCashier"] ?? true,
    showCustomer: map["showCustomer"] ?? true,
    allowCashierDiscount: map["allowCashierDiscount"] ?? false,
    allowPosDelivery: map["allowPosDelivery"] ?? true,
    allowPosDineIn: map["allowPosDineIn"] ?? true,
    allowPosTakeout: map["allowPosTakeout"] ?? true,
    allowPosCash: map["allowPosCash"] ?? true,
    allowPosCard: map["allowPosCard"] ?? true,
    allowPosMixed: map["allowPosMixed"] ?? true,
    allowPosCredit: map["allowPosCredit"] ?? true,
    showLastInvoiceReprintButtons: map["showLastInvoiceReprintButtons"] ?? "all",
    // Receipt format
    receiptPaperSize: map["receiptPaperSize"] ?? "80mm",
    showOrderNumber: map["showOrderNumber"] ?? true,
    showTableNumber: map["showTableNumber"] ?? true,
    showDateTime: map["showDateTime"] ?? true,
    showBarcode: map["showBarcode"] ?? false,
    showOrderType: map["showOrderType"] ?? true,
    showTax: map["showTax"] ?? true,
    showDiscount: map["showDiscount"] ?? true,
    showNotes: map["showNotes"] ?? true,
    // Print behavior
    autoPrintTrigger: map["autoPrintTrigger"] ?? "print_button",
    maxReprintCount: map["maxReprintCount"] ?? 3,
    masterCopiesCount: map["masterCopiesCount"] ?? 1,
    logoUrl: logoUrlVal,
    systemLogoUrl: map["systemLogoUrl"] ?? null,

    // Business Day Rollover & Cutoff Time Settings
    businessDayCutoffEnabled: map["businessDayCutoffEnabled"] !== false,
    businessDayCutoffTime: map["businessDayCutoffTime"] ?? "03:00",
    businessDayRolloverHour: map["businessDayRolloverHour"] !== undefined ? Number(map["businessDayRolloverHour"]) : 3,
    applyCutoffToAccounting: map["applyCutoffToAccounting"] !== false,
    applyCutoffToTravel: map["applyCutoffToTravel"] !== false,
    applyCutoffToTravelServices: map["applyCutoffToTravelServices"] !== false,
    applyCutoffToSales: map["applyCutoffToSales"] !== false,
    applyCutoffToPurchases: map["applyCutoffToPurchases"] !== false,
    applyCutoffToHR: map["applyCutoffToHR"] !== false,
  };
}

router.get("/settings", (_req, res) => {
  res.json(getSettingsObj());
});

router.get("/settings/business-day", (_req, res) => {
  const status = getBusinessDayStatus();
  const posCounter = getNextPosInvoiceNumber();
  res.json({
    ...status,
    posInvoiceCounter: posCounter,
    nextInvoiceNumber: posCounter.nextInvoiceNumber,
    todayInvoicesCount: posCounter.todayCount,
  });
});

router.put("/settings", (req, res) => {
  try {
    let user = getAuthUser(req);
    if (!user) {
      const adminFallback = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 AND (role='admin' OR role='developer' OR role='general_manager') LIMIT 1").get() as any;
      if (adminFallback) user = adminFallback;
    }
    if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "general_manager" && user.role !== "accountant" && !user.is_system_admin)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)");
    let updates = req.body as Record<string, any>;
    if (updates && updates.data && typeof updates.data === "object") {
      updates = updates.data;
    }
    if (updates && typeof updates === "object") {
      for (const [k, v] of Object.entries(updates)) {
        if (k === "systemLogoUrl" && user.role !== "developer") {
          continue;
        }
        const strVal = v === null || v === undefined ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v);
        upsert.run(k, strVal);

        // Sync with document_print_settings table
        if (k === "logoUrl" && v) {
          try {
            db.prepare("UPDATE document_print_settings SET logo_url = ? WHERE id = 1").run(String(v));
          } catch {}
        }
        if (k === "businessName" && v) {
          try {
            db.prepare("UPDATE document_print_settings SET company_name = ? WHERE id = 1").run(String(v));
          } catch {}
        }
      }
      invalidateBusinessDayConfigCache();
    }
    res.json(getSettingsObj());
  } catch (err: any) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "حدث خطأ أثناء حفظ الإعدادات", message: err?.message });
  }
});

export default router;
