import { Router } from "express";
import { db, createDoubleEntryJournal, updateDoubleEntryJournal, deleteDoubleEntryJournal, syncSupplierAccounts, ensureTravelVisasColumns, ensureTravelHotelsColumns } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { recordAuditLog } from "./audit";
import { triggerTravelNotificationEvent, applyPassengerWhatsAppAutomation } from "./travel-notifications";
import { getCustomerAccountCode, getSupplierAccountCode } from "./customers";
import { getBusinessDate } from "../lib/business-day";

const router = Router();

export function syncJournalEntryForSource({
  sourceType,
  sourceId,
  entryDate,
  description,
  lines,
  referenceNo,
  currency
}: {
  sourceType: string;
  sourceId: number;
  entryDate: string;
  description: string;
  lines: { account_code: string; debit: number; credit: number; description?: string; currency?: string }[];
  referenceNo?: string;
  currency?: string;
}) {
  try {
    const cur = currency || "SAR";
    const existing = db.prepare("SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?").get(sourceType, sourceId) as any;
    if (existing) {
      updateDoubleEntryJournal(existing.id, entryDate, description, lines, { reference_no: referenceNo, doc_type: sourceType, currency: cur });
      return existing.id;
    } else {
      return createDoubleEntryJournal(entryDate, description, sourceType, sourceId, lines, { reference_no: referenceNo, doc_type: sourceType, currency: cur });
    }
  } catch (err) {
    console.error(`Error syncing journal entry for ${sourceType} #${sourceId}:`, err);
    return null;
  }
}

function isCashOrBankMethod(method: string): boolean {
  const m = String(method || '').trim().toLowerCase();
  return (
    m === 'cash' ||
    m === 'bank' ||
    m === 'bank_transfer' ||
    m === 'pos' ||
    m === 'card' ||
    m === 'cheque' ||
    m === 'wallet' ||
    m.includes('نقدا') ||
    m.includes('نقداً') ||
    m.includes('كاش') ||
    m.includes('صندوق') ||
    m.includes('بنك') ||
    m.includes('تحويل') ||
    m.includes('شبكة') ||
    m.includes('مدى') ||
    m.includes('شيك') ||
    m.includes('محفظة') ||
    m.includes('رصيد')
  );
}

function isBankMethod(method: string): boolean {
  const m = String(method || '').trim().toLowerCase();
  return (
    m === 'bank' ||
    m === 'bank_transfer' ||
    m === 'pos' ||
    m === 'card' ||
    m.includes('بنك') ||
    m.includes('تحويل') ||
    m.includes('شبكة') ||
    m.includes('مدى') ||
    m.includes('شيك')
  );
}

export function buildTravelJournalLines(params: {
  sell: number;
  cost: number;
  custPayMethod: string;
  paid: number;
  suppPayMethod: string;
  sPaid: number;
  custAcc: string;
  suppAcc: string;
  revenueAcc: string;
  expenseAcc: string;
  custCur: string;
  suppCur: string;
  custStmt: string;
  suppStmt: string;
}): any[] {
  const lines: any[] = [];
  const {
    sell, cost, custPayMethod, paid, suppPayMethod, sPaid,
    custAcc, suppAcc, revenueAcc, expenseAcc, custCur, suppCur, custStmt, suppStmt
  } = params;

  // 1. Customer Side
  if (sell > 0) {
    const isCashOrBank = isCashOrBankMethod(custPayMethod);
    if (isCashOrBank) {
      const debitAcc = isBankMethod(custPayMethod) ? '11120' : '11100';
      lines.push(
        { account_code: debitAcc, debit: sell, credit: 0, description: `تحصيل (${isBankMethod(custPayMethod) ? 'بنكي' : 'نقدي'}) - ${custStmt}`, currency: custCur },
        { account_code: revenueAcc, debit: 0, credit: sell, description: custStmt, currency: custCur }
      );
    } else {
      // Credit / آجل
      lines.push(
        { account_code: custAcc, debit: sell, credit: 0, description: custStmt, currency: custCur },
        { account_code: revenueAcc, debit: 0, credit: sell, description: custStmt, currency: custCur }
      );
      if (paid > 0) {
        const debitAcc = isBankMethod(custPayMethod) ? '11120' : '11100';
        lines.push(
          { account_code: debitAcc, debit: paid, credit: 0, description: `سداد جزئي (${isBankMethod(custPayMethod) ? 'بنكي' : 'نقدي'}) - ${custStmt}`, currency: custCur },
          { account_code: custAcc, debit: 0, credit: paid, description: `سداد جزئي من العميل - ${custStmt}`, currency: custCur }
        );
      }
    }
  }

  // 2. Supplier Side
  if (cost > 0) {
    const isSuppCashOrBank = isCashOrBankMethod(suppPayMethod);
    if (isSuppCashOrBank) {
      const creditAcc = isBankMethod(suppPayMethod) ? '11120' : '11100';
      lines.push(
        { account_code: expenseAcc, debit: cost, credit: 0, description: suppStmt, currency: suppCur },
        { account_code: creditAcc, debit: 0, credit: cost, description: `صرف نقدي/بنكي للمورد - ${suppStmt}`, currency: suppCur }
      );
    } else {
      // Credit / آجل
      lines.push(
        { account_code: expenseAcc, debit: cost, credit: 0, description: suppStmt, currency: suppCur },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات المورد (آجل) - ${suppStmt}`, currency: suppCur }
      );
      if (sPaid > 0) {
        const creditAcc = isBankMethod(suppPayMethod) ? '11120' : '11100';
        lines.push(
          { account_code: suppAcc, debit: sPaid, credit: 0, description: `سداد جزئي للمورد - ${suppStmt}`, currency: suppCur },
          { account_code: creditAcc, debit: 0, credit: sPaid, description: `صرف جزئي للمورد - ${suppStmt}`, currency: suppCur }
        );
      }
    }
  }

  return lines;
}

export function buildHotelJournalLines(params: {
  sell: number;
  cost: number;
  custPayMethod: string;
  suppPayMethod: string;
  isSuppPaidCash: boolean; // Add this
  custAcc: string;
  suppAcc: string;
  revenueAcc: string;
  expenseAcc: string;
  custCur: string;
  suppCur: string;
  custStmt: string;
  suppStmt: string;
}): any[] {
  const lines: any[] = [];
  const {
    sell, cost, custPayMethod, suppPayMethod, isSuppPaidCash,
    custAcc, suppAcc, revenueAcc, expenseAcc, custCur, suppCur, custStmt, suppStmt
  } = params;

  // 1. Customer Side
  if (sell > 0) {
    const isCashOrBank = isCashOrBankMethod(custPayMethod);
    if (isCashOrBank) {
      const debitAcc = isBankMethod(custPayMethod) ? '11120' : '11100';
      lines.push(
        { account_code: debitAcc, debit: sell, credit: 0, description: `تحصيل نقدي/بنكي فوري - ${custStmt}`, currency: custCur },
        { account_code: revenueAcc, debit: 0, credit: sell, description: custStmt, currency: custCur }
      );
    } else {
      // Credit / آجل
      lines.push(
        { account_code: custAcc, debit: sell, credit: 0, description: `حساب العميل (آجل) - ${custStmt}`, currency: custCur },
        { account_code: revenueAcc, debit: 0, credit: sell, description: custStmt, currency: custCur }
      );
    }
  }

  // 2. Supplier Side
  if (cost > 0) {
    if (isSuppPaidCash) { // Use explicit parameter
      const creditAcc = isBankMethod(suppPayMethod) ? '11120' : '11100';
      // Record expense and credit cash/bank, do not touch supplier account
      lines.push(
        { account_code: expenseAcc, debit: cost, credit: 0, description: suppStmt, currency: suppCur },
        { account_code: creditAcc, debit: 0, credit: cost, description: `صرف نقدي/بنكي - حجز فندقي`, currency: suppCur }
      );
    } else {
      // Credit / آجل
      lines.push(
        { account_code: expenseAcc, debit: cost, credit: 0, description: suppStmt, currency: suppCur },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات المورد (آجل) - ${suppStmt}`, currency: suppCur }
      );
    }
  }

  return lines;
}

// ==========================================
// 1. PASSENGERS MANAGEMENT (المسافرين)
// ==========================================
router.get("/travel/passengers", (req, res) => {
  const { customer_id, search, visa_type, travel_status, as_of_date } = req.query;

  // Ensure Umrah test pilgrims exist with valid phone numbers
  try {
    let mohammedCust: any = db.prepare("SELECT id, phone FROM customers WHERE name LIKE '%محمد اليمني%'").get();
    if (!mohammedCust) {
      const info = db.prepare("INSERT INTO customers (name, phone, address) VALUES ('محمد اليمني', '966555123456', 'مكة المكرمة / جدة')").run();
      mohammedCust = { id: Number(info.lastInsertRowid), phone: '966555123456' };
    }

    const umrahCount = (db.prepare("SELECT COUNT(*) as c FROM travel_passengers WHERE passport_number IN ('14800339', '10270557', '14800340')").get() as any)?.c || 0;
    if (umrahCount === 0) {
      const pilgrims = [
        { name_ar: "علي عبدالله علي الشهابي", name_en: "Ali Abdullah Ali Al-Shehabi", passport_number: "14800339", visa_type: "تأشيرة عمره", program_duration_days: 86, travel_date: "2026-06-16", expected_exit_date: "2026-09-10", remaining_days: 3, phone: "967771234567" },
        { name_ar: "يوسف محمد سود الشريف", name_en: "Youssef Mohammed Sood Al-Sharif", passport_number: "10270557", visa_type: "تأشيرة عمره", program_duration_days: 85, travel_date: "2026-06-22", expected_exit_date: "2026-09-15", remaining_days: 8, phone: "967772345678" },
        { name_ar: "عبدالله علي صالح الشهابي", name_en: "Abdullah Ali Saleh Al-Shehabi", passport_number: "14800340", visa_type: "تأشيرة عمره", program_duration_days: 86, travel_date: "2026-06-16", expected_exit_date: "2026-09-10", remaining_days: 3, phone: "967773456789" }
      ];
      for (const p of pilgrims) {
        db.prepare(`
          INSERT INTO travel_passengers (
            customer_id, name_ar, name_en, passport_number, visa_type,
            program_duration_days, travel_date, expected_exit_date, remaining_days,
            nationality, gender, travel_status, passport_type, phone
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'يمني', 'ذكر', 'داخل مكة', 'عادي', ?)
        `).run(mohammedCust.id, p.name_ar, p.name_en, p.passport_number, p.visa_type, p.program_duration_days, p.travel_date, p.expected_exit_date, p.remaining_days, p.phone);
      }
    } else {
      // Auto-update existing sample pilgrims if phone is empty
      db.prepare("UPDATE travel_passengers SET phone = '967771234567' WHERE passport_number = '14800339' AND (phone IS NULL OR phone = '')").run();
      db.prepare("UPDATE travel_passengers SET phone = '967772345678' WHERE passport_number = '10270557' AND (phone IS NULL OR phone = '')").run();
      db.prepare("UPDATE travel_passengers SET phone = '967773456789' WHERE passport_number = '14800340' AND (phone IS NULL OR phone = '')").run();
    }
  } catch (seedErr) {
    console.warn("Umrah on-demand seed notice:", seedErr);
  }

  let sql = `
    SELECT p.*, c.name as customer_name, c.customer_type, c.phone as customer_phone
    FROM travel_passengers p
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customer_id) {
    sql += ` AND p.customer_id = ?`;
    params.push(customer_id);
  }
  if (visa_type) {
    sql += ` AND p.visa_type = ?`;
    params.push(visa_type);
  }
  if (travel_status) {
    sql += ` AND p.travel_status = ?`;
    params.push(travel_status);
  }
  if (search) {
    sql += ` AND (p.name_ar LIKE ? OR p.name_en LIKE ? OR p.passport_number LIKE ? OR p.phone LIKE ? OR p.visa_type LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY p.id DESC`;
  const rows = db.prepare(sql).all(...params) as any[];

  // Dynamic calculations for Umrah / Visa monitoring based on travel_date and duration
  const refDate = as_of_date ? new Date(String(as_of_date)) : new Date();
  const todayStr = refDate.toISOString().slice(0, 10);

  const enhancedRows = rows.map((p) => {
    let expectedExit = p.expected_exit_date;
    let remainingDays = p.remaining_days;
    let daysSpent = 0;

    if (p.travel_date && p.program_duration_days) {
      const travelDateObj = new Date(p.travel_date);
      if (!isNaN(travelDateObj.getTime())) {
        const exitObj = new Date(travelDateObj);
        exitObj.setDate(exitObj.getDate() + Number(p.program_duration_days));
        expectedExit = exitObj.toISOString().slice(0, 10);

        const diffTime = exitObj.getTime() - refDate.getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const spentTime = refDate.getTime() - travelDateObj.getTime();
        daysSpent = Math.max(0, Math.floor(spentTime / (1000 * 60 * 60 * 24)));
      }
    }

    return {
      ...p,
      expected_exit_date: expectedExit || p.expected_exit_date || "",
      remaining_days: remainingDays !== undefined ? remainingDays : (p.remaining_days ?? null),
      days_spent: daysSpent,
      as_of_date: todayStr
    };
  });

  res.json(enhancedRows);
});

function resolveCustomerId(customerIdInput: any): number | null {
  if (!customerIdInput) return null;
  const numId = Number(customerIdInput);
  if (isNaN(numId) || numId <= 0) return null;

  try {
    const directCust = db.prepare("SELECT id FROM customers WHERE id = ?").get(numId) as { id: number } | undefined;
    if (directCust) {
      return directCust.id;
    }

    const acc = db.prepare("SELECT id, name, code FROM accounts WHERE id = ?").get(numId) as any;
    if (acc) {
      const existingCust = db.prepare("SELECT id FROM customers WHERE name = ? OR account_code = ?").get(acc.name, acc.code) as { id: number } | undefined;
      if (existingCust) {
        return existingCust.id;
      }
      const ins = db.prepare("INSERT INTO customers (name, account_code) VALUES (?, ?)").run(
        acc.name || `عميل ${acc.code || numId}`,
        acc.code || null
      );
      return Number(ins.lastInsertRowid);
    }
  } catch (e) {
    return null;
  }
  return null;
}

router.post("/travel/passengers", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  try {
    const {
      customer_id, name_ar, name_en, title, dob, gender, nationality,
      passport_number, passport_issue_date, passport_expiry_date,
      passport_issue_place, passport_type, national_id, phone, email, special_notes,
      visa_type, travel_date, program_duration_days, expected_exit_date, remaining_days, travel_status
    } = req.body;

    let finalNameAr = (name_ar || name_en || "").trim();
    let finalNameEn = (name_en || name_ar || "").trim();

    if (!finalNameAr) {
      res.status(400).json({ error: "اسم المسافر مطلوب (بالعربي أو بالإنجليزي)" });
      return;
    }

    const validCustomerId = resolveCustomerId(customer_id);

    let finalProgDays = program_duration_days ? Number(program_duration_days) : 90;
    if (isNaN(finalProgDays) || finalProgDays <= 0) finalProgDays = 90;

    let finalExpectedExit = expected_exit_date || null;
    let finalRemainingDays: number | null = null;
    if (remaining_days !== undefined && remaining_days !== null && remaining_days !== "") {
      const parsed = Number(remaining_days);
      if (!isNaN(parsed)) finalRemainingDays = parsed;
    }

    if (travel_date && finalProgDays) {
      const tDate = new Date(travel_date);
      if (!isNaN(tDate.getTime())) {
        const exitDate = new Date(tDate);
        exitDate.setDate(exitDate.getDate() + finalProgDays);
        finalExpectedExit = exitDate.toISOString().slice(0, 10);

        const today = new Date();
        finalRemainingDays = Math.ceil((exitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const stmt = db.prepare(`
      INSERT INTO travel_passengers (
        customer_id, name_ar, name_en, title, dob, gender, nationality,
        passport_number, passport_issue_date, passport_expiry_date,
        passport_issue_place, passport_type, national_id, phone, email, special_notes,
        visa_type, travel_date, program_duration_days, expected_exit_date, remaining_days, travel_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let info: any;
    try {
      info = stmt.run(
        validCustomerId, finalNameAr, finalNameEn, title || 'Mr', dob || null, gender || null, nationality || null,
        passport_number || null, passport_issue_date || null, passport_expiry_date || null,
        passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null,
        visa_type || 'تأشيرة عمره', travel_date || null, finalProgDays,
        finalExpectedExit, finalRemainingDays, travel_status || 'داخل مكة'
      );
    } catch (runErr: any) {
      console.warn("Retrying passenger insert with null customer_id due to:", runErr?.message);
      info = stmt.run(
        null, finalNameAr, finalNameEn, title || 'Mr', dob || null, gender || null, nationality || null,
        passport_number || null, passport_issue_date || null, passport_expiry_date || null,
        passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null,
        visa_type || 'تأشيرة عمره', travel_date || null, finalProgDays,
        finalExpectedExit, finalRemainingDays, travel_status || 'داخل مكة'
      );
    }

    const newPax = db.prepare(`
      SELECT p.*, c.name as customer_name
      FROM travel_passengers p
      LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.id = ?
    `).get(info.lastInsertRowid);

    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: "إضافة مسافر جديد",
      actionType: "create",
      entityType: "passenger",
      entityId: Number(info.lastInsertRowid),
      details: `إضافة المسافر: ${finalNameAr} (${finalNameEn}) - نوع التأشيرة: ${visa_type || 'عمرة'} - جواز: ${passport_number || 'بدون'}`,
      newData: newPax
    });

    // Auto-apply WhatsApp Automation settings seamlessly in background
    try {
      const host = `${req.protocol}://${req.get("host")}`;
      applyPassengerWhatsAppAutomation(newPax, host).catch((err) => {
        console.warn("Auto-applying WhatsApp automation error:", err);
      });
    } catch (e) {}

    res.status(201).json(newPax);
  } catch (err: any) {
    console.error("Error creating passenger:", err);
    res.status(500).json({ error: "فشل حفظ بيانات المسافر: " + (err.message || "") });
  }
});

router.post("/travel/passengers/bulk-import", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { passengers = [], customer_id } = req.body;
  if (!Array.isArray(passengers) || passengers.length === 0) {
    res.status(400).json({ error: "قائمة المسافرين فارغة" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_passengers (
      customer_id, name_ar, name_en, title, dob, gender, nationality,
      passport_number, passport_issue_date, passport_expiry_date,
      passport_issue_place, passport_type, national_id, phone, email, special_notes,
      visa_type, travel_date, program_duration_days, expected_exit_date, remaining_days, travel_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  const errors: string[] = [];

  const runImport = db.transaction(() => {
    for (const p of passengers) {
      if (!p.name_ar && !p.name_en) {
        errors.push(`تم تخطي سجل بدون اسم: جواز ${p.passport_number || 'بدون'}`);
        continue;
      }

      const name_ar = (p.name_ar || p.name_en || "").trim();
      const name_en = (p.name_en || p.name_ar || "").trim();
      const progDays = p.program_duration_days ? Number(p.program_duration_days) : 90;
      const travelDate = p.travel_date || null;
      const validCid = resolveCustomerId(p.customer_id || customer_id);

      let expectedExit = p.expected_exit_date || null;
      let remainingDays = p.remaining_days !== undefined && p.remaining_days !== null && p.remaining_days !== "" ? Number(p.remaining_days) : null;

      if (travelDate && progDays) {
        const tDate = new Date(travelDate);
        if (!isNaN(tDate.getTime())) {
          const eDate = new Date(tDate);
          eDate.setDate(eDate.getDate() + progDays);
          expectedExit = eDate.toISOString().slice(0, 10);
          const diffTime = eDate.getTime() - Date.now();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      try {
        stmt.run(
          validCid,
          name_ar,
          name_en,
          p.title || 'Mr',
          p.dob || null,
          p.gender || 'ذكر',
          p.nationality || 'يمني',
          p.passport_number || null,
          p.passport_issue_date || null,
          p.passport_expiry_date || null,
          p.passport_issue_place || null,
          p.passport_type || 'عادي',
          p.national_id || null,
          p.phone || null,
          p.email || null,
          p.special_notes || null,
          p.visa_type || 'تأشيرة عمره',
          travelDate,
          isNaN(progDays) ? 90 : progDays,
          expectedExit,
          remainingDays,
          p.travel_status || 'داخل مكة'
        );
      } catch (importErr: any) {
        stmt.run(
          null,
          name_ar,
          name_en,
          p.title || 'Mr',
          p.dob || null,
          p.gender || 'ذكر',
          p.nationality || 'يمني',
          p.passport_number || null,
          p.passport_issue_date || null,
          p.passport_expiry_date || null,
          p.passport_issue_place || null,
          p.passport_type || 'عادي',
          p.national_id || null,
          p.phone || null,
          p.email || null,
          p.special_notes || null,
          p.visa_type || 'تأشيرة عمره',
          travelDate,
          isNaN(progDays) ? 90 : progDays,
          expectedExit,
          remainingDays,
          p.travel_status || 'داخل مكة'
        );
      }
      insertedCount++;
    }
  });

  try {
    runImport();
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: "استيراد مسافرين من إكسل",
      actionType: "create",
      entityType: "passenger",
      details: `تم استيراد ${insertedCount} مسافر بنجاح من ملف إكسل`
    });

    // Auto-apply WhatsApp automation and PDF generation for newly imported passengers
    try {
      const host = `${req.protocol}://${req.get("host")}`;
      const recentImported = db.prepare("SELECT * FROM travel_passengers ORDER BY id DESC LIMIT ?").all(insertedCount) as any[];
      if (recentImported && recentImported.length > 0) {
        for (const pax of recentImported) {
          applyPassengerWhatsAppAutomation(pax, host).catch((err) => {
            console.warn("Auto-applying WhatsApp on imported pax error:", err);
          });
        }
      }
    } catch (autoErr) {
      console.warn("Bulk import WhatsApp auto-trigger error:", autoErr);
    }

    res.json({ success: true, count: insertedCount, errors });
  } catch (err: any) {
    console.error("Error in bulk import:", err);
    res.status(500).json({ error: "فشل استيراد البيانات: " + (err.message || "") });
  }
});

router.put("/travel/passengers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  try {
    const oldPax = db.prepare("SELECT * FROM travel_passengers WHERE id = ?").get(req.params.id);

    const {
      customer_id, name_ar, name_en, title, dob, gender, nationality,
      passport_number, passport_issue_date, passport_expiry_date,
      passport_issue_place, passport_type, national_id, phone, email, special_notes,
      visa_type, travel_date, program_duration_days, expected_exit_date, remaining_days, travel_status
    } = req.body;

    let finalNameAr = (name_ar || name_en || "").trim();
    let finalNameEn = (name_en || name_ar || "").trim();

    if (!finalNameAr) {
      res.status(400).json({ error: "اسم المسافر مطلوب" });
      return;
    }

    const validCustomerId = resolveCustomerId(customer_id);

    let finalProgDays = program_duration_days ? Number(program_duration_days) : 90;
    if (isNaN(finalProgDays) || finalProgDays <= 0) finalProgDays = 90;

    let finalExpectedExit = expected_exit_date || null;
    let finalRemainingDays: number | null = null;
    if (remaining_days !== undefined && remaining_days !== null && remaining_days !== "") {
      const parsed = Number(remaining_days);
      if (!isNaN(parsed)) finalRemainingDays = parsed;
    }

    if (travel_date && finalProgDays) {
      const tDate = new Date(travel_date);
      if (!isNaN(tDate.getTime())) {
        const exitDate = new Date(tDate);
        exitDate.setDate(exitDate.getDate() + finalProgDays);
        finalExpectedExit = exitDate.toISOString().slice(0, 10);

        const today = new Date();
        finalRemainingDays = Math.ceil((exitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    try {
      db.prepare(`
        UPDATE travel_passengers SET
          customer_id = ?, name_ar = ?, name_en = ?, title = ?, dob = ?, gender = ?, nationality = ?,
          passport_number = ?, passport_issue_date = ?, passport_expiry_date = ?,
          passport_issue_place = ?, passport_type = ?, national_id = ?, phone = ?, email = ?, special_notes = ?,
          visa_type = ?, travel_date = ?, program_duration_days = ?, expected_exit_date = ?, remaining_days = ?, travel_status = ?
        WHERE id = ?
      `).run(
        validCustomerId, finalNameAr, finalNameEn, title || 'Mr', dob || null, gender || null, nationality || null,
        passport_number || null, passport_issue_date || null, passport_expiry_date || null,
        passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null,
        visa_type || 'تأشيرة عمره', travel_date || null, finalProgDays,
        finalExpectedExit, finalRemainingDays, travel_status || 'داخل مكة',
        req.params.id
      );
    } catch (updateErr: any) {
      console.warn("Retrying passenger update with null customer_id due to:", updateErr?.message);
      db.prepare(`
        UPDATE travel_passengers SET
          customer_id = NULL, name_ar = ?, name_en = ?, title = ?, dob = ?, gender = ?, nationality = ?,
          passport_number = ?, passport_issue_date = ?, passport_expiry_date = ?,
          passport_issue_place = ?, passport_type = ?, national_id = ?, phone = ?, email = ?, special_notes = ?,
          visa_type = ?, travel_date = ?, program_duration_days = ?, expected_exit_date = ?, remaining_days = ?, travel_status = ?
        WHERE id = ?
      `).run(
        finalNameAr, finalNameEn, title || 'Mr', dob || null, gender || null, nationality || null,
        passport_number || null, passport_issue_date || null, passport_expiry_date || null,
        passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null,
        visa_type || 'تأشيرة عمره', travel_date || null, finalProgDays,
        finalExpectedExit, finalRemainingDays, travel_status || 'داخل مكة',
        req.params.id
      );
    }

    const updatedPax = db.prepare(`
      SELECT p.*, c.name as customer_name
      FROM travel_passengers p
      LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.id = ?
    `).get(req.params.id);

    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: "تعديل بيانات مسافر",
      actionType: "update",
      entityType: "passenger",
      entityId: Number(req.params.id),
      details: `تعديل بيانات المسافر: ${finalNameAr}`,
      oldData: oldPax,
      newData: updatedPax
    });

    res.json(updatedPax);
  } catch (err: any) {
    console.error("Error updating passenger:", err);
    res.status(500).json({ error: "فشل تعديل بيانات المسافر: " + (err.message || "") });
  }
});

router.delete("/travel/passengers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  
  const oldPax = db.prepare("SELECT * FROM travel_passengers WHERE id = ?").get(req.params.id);

  // Check if passenger has active bookings
  const hasBookings = db.prepare("SELECT COUNT(*) as c FROM travel_bookings WHERE passenger_id = ?").get(req.params.id) as any;
  if (hasBookings && hasBookings.c > 0) {
    res.status(400).json({ error: "قواعد العمل: لا يمكن حذف المسافر لوجود تذاكر وحجوزات مرتبطة به في النظام" });
    return;
  }

  db.prepare("DELETE FROM travel_passengers WHERE id = ?").run(req.params.id);

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: "حذف مسافر",
    actionType: "delete",
    entityType: "passenger",
    entityId: Number(req.params.id),
    details: `حذف المسافر: ${(oldPax as any)?.name_ar || ''}`,
    oldData: oldPax
  });

  res.status(204).send();
});

// ==========================================
// 1.1 WHATSAPP DESKTOP & PASSENGER DOCUMENTS
// ==========================================

// Render standalone official A4 Document Card for a passenger (accessible via direct WhatsApp link or printable)
router.get("/travel/passengers/:id/document-card", (req, res) => {
  try {
    const pax = db.prepare(`
      SELECT p.*, c.name as customer_name, c.phone as customer_phone
      FROM travel_passengers p
      LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.id = ?
    `).get(req.params.id) as any;

    if (!pax) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="utf-8"><title>الوثيقة غير موجودة</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>⚠️ لم يتم العثور على وثيقة المسافر المطلوبة في النظام</h2>
        </body>
        </html>
      `);
      return;
    }

    const nameAr = pax.name_ar || pax.name_en || "مسافر";
    const nameEn = pax.name_en || "";
    const passportNo = pax.passport_number || "---";
    const visaType = pax.visa_type || "تأشيرة عمره";
    const remainingDays = pax.remaining_days !== null && pax.remaining_days !== undefined ? `${pax.remaining_days} يوم` : "مستمر";
    const issueDate = pax.passport_issue_date || "---";
    const expiryDate = pax.passport_expiry_date || "---";
    const entryDate = pax.travel_date || "---";
    const exitDate = pax.expected_exit_date || "---";
    const duration = pax.program_duration_days || 90;
    const nationality = pax.nationality || "يمني";
    const customer = pax.customer_name || "وكالة سفر معتمدة";

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>بطاقة المسافر والجواز - ${nameAr}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif; background: #f1f5f9; color: #0f172a; padding: 24px; }
          .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
          .header h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
          .header p { font-size: 13px; opacity: 0.9; }
          .badge { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
          .body { padding: 32px; }
          .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px dashed #cbd5e1; }
          .pax-names h2 { font-size: 22px; color: #065f46; font-weight: 800; }
          .pax-names h3 { font-size: 15px; color: #64748b; font-weight: 600; margin-top: 4px; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
          .cell-label { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; }
          .cell-val { font-size: 14px; font-weight: 700; color: #0f172a; }
          .status-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center; }
          .status-box .title { font-size: 13px; color: #065f46; font-weight: 700; }
          .status-box .val { font-size: 20px; font-weight: 900; color: #047857; margin-top: 4px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; }
          .btn-print { background: #047857; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; text-decoration: none; }
          .btn-print:hover { background: #065f46; }
          @media print {
            body { background: #fff; padding: 0; }
            .container { box-shadow: none; border: 1px solid #ccc; max-width: 100%; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h1>بطاقة المسافر والجواز الرسمية المعتمدة</h1>
              <p>Omni System Pro — نظام إدارة ومتابعة المسافرين والتأشيرات</p>
            </div>
            <div class="badge">وثيقة معتمدة وموثقة</div>
          </div>
          <div class="body">
            <div class="top-row">
              <div class="pax-names">
                <h2>${nameAr}</h2>
                <h3>${nameEn}</h3>
                <p style="margin-top: 6px; font-size: 13px; color: #475569;">العميل / الوكيل: <strong>${customer}</strong></p>
              </div>
              <div style="text-align: left;">
                <div style="font-family: monospace; font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: 2px;">${passportNo}</div>
                <div style="font-size: 11px; color: #64748b;">رقم وثيقة الجواز</div>
              </div>
            </div>

            <div class="status-box">
              <div class="title">حالة التأشيرة ومتابعة الإقامة والمغادرة</div>
              <div class="val">المتبقي على الخروج: ${remainingDays}</div>
              <div style="font-size: 12px; color: #065f46; margin-top: 4px;">تاريخ الدخول: ${entryDate} | تاريخ الخروج المتوقع: ${exitDate}</div>
            </div>

            <div class="grid">
              <div class="cell">
                <div class="cell-label">نوع المعاملة / التأشيرة</div>
                <div class="cell-val">${visaType}</div>
              </div>
              <div class="cell">
                <div class="cell-label">مدة البرنامج المصرح</div>
                <div class="cell-val">${duration} يوم</div>
              </div>
              <div class="cell">
                <div class="cell-label">الجنسية</div>
                <div class="cell-val">${nationality}</div>
              </div>
              <div class="cell">
                <div class="cell-label">رقم الهاتف / الواتساب</div>
                <div class="cell-val" dir="ltr" style="text-align: right;">${pax.phone || "---"}</div>
              </div>
              <div class="cell">
                <div class="cell-label">تاريخ إصدار الجواز</div>
                <div class="cell-val">${issueDate}</div>
              </div>
              <div class="cell">
                <div class="cell-label">تاريخ انتهاء الجواز</div>
                <div class="cell-val">${expiryDate}</div>
              </div>
            </div>

            <div style="font-size: 11px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              * هذه الوثيقة صادرة ومعتمدة آلياً من نظام Omni System Pro لإدارة السفريات ومتابعة تفويج المعتمرين.
            </div>
          </div>
          <div class="footer no-print">
            <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</div>
            <button class="btn-print" onclick="window.print()">🖨️ طباعة المستند / حفظ كـ PDF</button>
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    res.status(500).send("خطأ في توليد المستند: " + err.message);
  }
});

// Single WhatsApp Desktop message/document dispatch endpoint
router.post("/travel/whatsapp-desktop/dispatch", (req, res) => {
  const {
    passenger_id,
    recipient_phone,
    recipient_name,
    message_body,
    document_url,
    delivery_mode = "desktop_protocol"
  } = req.body;

  let cleanPhone = (recipient_phone || "").replace(/\D/g, "");
  if (cleanPhone.startsWith("0")) cleanPhone = "966" + cleanPhone.slice(1);
  else if (cleanPhone.length === 9) cleanPhone = "966" + cleanPhone;

  const desktop_uri = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message_body || "")}`;

  try {
    const info = db.prepare(`
      INSERT INTO travel_notifications (
        channel, recipient, message_body, passenger_name, entity_type, entity_id, status, title
      ) VALUES ('whatsapp_desktop', ?, ?, ?, 'passenger', ?, 'sent', 'إشعار واتساب لسطح المكتب')
    `).run(cleanPhone, message_body, recipient_name || "مسافر", passenger_id || null);

    res.json({
      success: true,
      id: info.lastInsertRowid,
      desktop_uri,
      clean_phone: cleanPhone,
      document_url: document_url || null,
      delivery_mode,
      status: "dispatched",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch WhatsApp Desktop queueing and logging endpoint
router.post("/travel/whatsapp-desktop/batch-queue", (req, res) => {
  const { items, agency_sender } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "قائمة المسافرين فارغة" });
    return;
  }

  const results: any[] = [];
  const stmt = db.prepare(`
    INSERT INTO travel_notifications (
      channel, recipient, message_body, passenger_name, entity_type, entity_id, status, title
    ) VALUES ('whatsapp_desktop', ?, ?, ?, 'passenger', ?, 'sent', 'إشعار واتساب لسطح المكتب - أتمتة خلفية')
  `);

  const runBatch = db.transaction((list: any[]) => {
    for (const item of list) {
      let cleanPhone = (item.phone || "").replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "966" + cleanPhone.slice(1);
      else if (cleanPhone.length === 9) cleanPhone = "966" + cleanPhone;

      const desktop_uri = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(item.message || "")}`;
      const info = stmt.run(cleanPhone, item.message, item.passenger_name || "مسافر", item.passenger_id || null);

      results.push({
        id: info.lastInsertRowid,
        passenger_id: item.passenger_id,
        passenger_name: item.passenger_name,
        clean_phone: cleanPhone,
        desktop_uri,
        status: "queued"
      });
    }
  });

  try {
    runBatch(items);
    res.json({
      success: true,
      count: results.length,
      items: results,
      agency_sender
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch recent WhatsApp Desktop dispatch logs
router.get("/travel/whatsapp-desktop/logs", (_req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM travel_notifications 
      WHERE channel IN ('whatsapp_desktop', 'whatsapp')
      ORDER BY id DESC LIMIT 50
    `).all();
    res.json(logs);
  } catch (err: any) {
    res.json([]);
  }
});

// ==========================================
router.get("/travel/bookings", (req, res) => {
  const { customer_id, status, service_type, search } = req.query;
  let sql = `
    SELECT b.*, c.name as customer_name, c.phone as customer_phone,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customer_id) { sql += ` AND b.customer_id = ?`; params.push(customer_id); }
  if (status) { sql += ` AND b.status = ?`; params.push(status); }
  if (service_type) { sql += ` AND b.service_type = ?`; params.push(service_type); }
  if (search) {
    sql += ` AND (b.booking_number LIKE ? OR b.ticket_number LIKE ? OR b.pnr LIKE ? OR c.name LIKE ? OR p.name_ar LIKE ? OR p.name_en LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }

  sql += ` ORDER BY b.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/bookings", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    booking_number, service_type, customer_id, passenger_id, airline_id, airline_name, airline_supplier, flight_number,
    origin_city, origin_airport_code, destination_city, destination_airport_code, routing_details,
    departure_date, departure_time, return_date, arrival_date, arrival_time, travel_class, fare_basis,
    baggage_weight, baggage_pieces, ticket_price, taxes, service_fee, discount, commission,
    ticket_number, pnr, status, issue_date, issue_time, cost_price, selling_price,
    payment_status, payment_method, supplier_id, supplier_name, notes, missing_docs,
    customer_currency, supplier_currency, customer_statement, supplier_statement, supplier_payment_method
  } = req.body;

  // RULE 41: Prevent issuing a ticket without customer
  if (!customer_id) {
    res.status(400).json({ error: "قواعد العمل: يمنع منعاً باتاً إصدار التذكرة أو تسجيل الحجز بدون تحديد العميل" });
    return;
  }

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);

  // RULE 41: Prevent selling below cost unless authorized
  if (sell < cost && user.role !== 'admin' && user.role !== 'developer') {
    const settings: any = db.prepare("SELECT allow_selling_below_cost FROM travel_system_settings WHERE id = 1").get();
    if (!settings || !settings.allow_selling_below_cost) {
      res.status(400).json({ error: `قواعد العمل: يمنع بيع التذكرة بأقل من التكلفة (سعر البيع: ${sell} < التكلفة: ${cost}) إلا بصلاحية خاصة من الإدارة` });
      return;
    }
  }

  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;
  const num = booking_number || `BK-${Date.now().toString().slice(-6)}`;
  const custPayMethod = payment_method || 'cash';
  const suppPayMethod = supplier_payment_method || custPayMethod || 'credit';
  const custCur = customer_currency || 'SAR';
  const suppCur = supplier_currency || 'SAR';

  const custInfo = customer_id ? db.prepare("SELECT id, name, affiliation_type, office_id, office_name, account_code FROM customers WHERE id = ?").get(customer_id) as any : null;
  const isAgencyCust = custInfo?.affiliation_type === 'agency';

  let custStmt = customer_statement;
  if (!custStmt) {
    if (isAgencyCust) {
      custStmt = `قيمة تذكرة طيران PNR: ${pnr || ''} رقم: ${ticket_number || num} - عميل: ${custInfo.name} (${custInfo.office_name || 'مكتب وسيط'})`;
    } else {
      custStmt = `قيمة تذكرة طيران PNR: ${pnr || ''} رقم: ${ticket_number || num}`;
    }
  } else if (isAgencyCust && !custStmt.includes(custInfo.name)) {
    custStmt = `${custStmt} - عميل: ${custInfo.name} (${custInfo.office_name || 'مكتب وسيط'})`;
  }
  const suppStmt = supplier_statement || `تكلفة تذكرة طيران PNR: ${pnr || ''} رقم: ${ticket_number || num}`;

  const stmt = db.prepare(`
    INSERT INTO travel_bookings (
      booking_number, service_type, customer_id, passenger_id, airline_id, airline_name, airline_supplier, flight_number,
      origin_city, origin_airport_code, destination_city, destination_airport_code, routing_details,
      departure_date, departure_time, return_date, arrival_date, arrival_time, travel_class, fare_basis,
      baggage_weight, baggage_pieces, ticket_price, taxes, service_fee, discount, commission, profit,
      ticket_number, pnr, status, issue_date, issue_time, cost_price, selling_price,
      payment_status, payment_method, issued_by_user_id, issued_by_user_name, branch_id,
      user_id, user_name, supplier_id, supplier_name, notes, missing_docs,
      customer_currency, supplier_currency, customer_statement, supplier_statement, supplier_payment_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    num, service_type || 'flight', customer_id || null, passenger_id || null, airline_id || null,
    airline_name || airline_supplier || null, airline_supplier || airline_name || null, flight_number || null,
    origin_city || null, origin_airport_code || null, destination_city || null, destination_airport_code || null,
    routing_details || `${origin_city || ''} -> ${destination_city || ''}`,
    departure_date || null, departure_time || null, return_date || null, arrival_date || null, arrival_time || null,
    travel_class || 'اقتصادية', fare_basis || null, Number(baggage_weight || 30), Number(baggage_pieces || 1),
    Number(ticket_price || 0), Number(taxes || 0), Number(service_fee || 0), Number(discount || 0), comm, prof,
    ticket_number || null, pnr || null, status || 'confirmed', issue_date || getBusinessDate("travel"),
    issue_time || new Date().toLocaleTimeString('ar-EG'), cost, sell, 
    payment_status || (custPayMethod === 'credit' ? 'unpaid' : 'paid'), custPayMethod,
    user.id, user.name, user.id, user.name, supplier_id || null, supplier_name || null, notes || null, missing_docs || null,
    custCur, suppCur, custStmt, suppStmt, suppPayMethod
  );

  const newBooking = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.id = ?
  `).get(info.lastInsertRowid);

  // Financial accounting double entry journal
  try {
    const entryDate = issue_date || getBusinessDate("travel");
    let desc = `قيد حجز وإصدار تذكرة طيران PNR: ${pnr || ''} رقم: ${ticket_number || num}`;
    if (isAgencyCust && custInfo) {
      desc += ` - عميل: ${custInfo.name} (مكتب: ${custInfo.office_name || 'مكتب وسيط'})`;
    }
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(supplier_id);
    const lines = buildTravelJournalLines({
      sell, cost, custPayMethod, paid: Number(req.body.paid_amount || 0),
      suppPayMethod, sPaid: Number(req.body.supplier_paid_amount || 0),
      custAcc, suppAcc, revenueAcc: "41001", expenseAcc: "51000",
      custCur, suppCur, custStmt, suppStmt
    });

    if (lines.length > 0) {
      syncJournalEntryForSource({
        sourceType: "booking",
        sourceId: Number(info.lastInsertRowid),
        entryDate,
        description: desc,
        lines,
        referenceNo: pnr || ticket_number || num,
        currency: custCur
      });
    }
  } catch (err) {
    console.error("Journal entry error on booking creation:", err);
  }

  // Auto record commission if configured
  if (comm > 0) {
    try {
      db.prepare(`
        INSERT INTO travel_commissions (
          source_type, source_id, customer_id, supplier_id, supplier_name,
          service_description, cost_amount, sale_amount, commission_amount, commission_rate,
          earned_date, status, agent_user_id, agent_user_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'earned', ?, ?)
      `).run(
        'ticket', Number(info.lastInsertRowid), customer_id, supplier_id || null, airline_name || supplier_name || 'طيران',
        `عمولة إصدار تذكرة PNR: ${pnr || ''} رقم: ${ticket_number || ''}`, cost, sell, comm,
        sell > 0 ? ((comm / sell) * 100) : 0, user.id, user.name
      );
    } catch {}
  }

  // RULE 30 & 49: Record Audit Log
  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: "إصدار تذكرة / حجز طيران",
    actionType: "create",
    entityType: "booking",
    entityId: Number(info.lastInsertRowid),
    details: `إصدار تذكرة جديدة PNR: ${pnr || 'بدون'} - التذكرة: ${ticket_number || 'بدون'} - العميل: ${(newBooking as any)?.customer_name} - المبلغ: ${sell} ريال`,
    newData: newBooking
  });

  // Automated Notification Trigger Engine
  try {
    const cust: any = customer_id ? db.prepare("SELECT phone, email, name FROM customers WHERE id = ?").get(customer_id) : null;
    const pax: any = passenger_id ? db.prepare("SELECT phone, email, name_ar, name_en, passport_number FROM travel_passengers WHERE id = ?").get(passenger_id) : null;
    const recipientPhone = pax?.phone || cust?.phone || "";
    const recipientEmail = pax?.email || cust?.email || "";

    if (recipientPhone || recipientEmail) {
      const triggerType = (ticket_number || status === 'issued') ? 'ticket_issued' : 'booking_confirmed';
      triggerTravelNotificationEvent({
        event_trigger: triggerType,
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        recipient_name: pax?.name_ar || cust?.name || "المسافر الكريم",
        data: {
          passenger_name: pax?.name_ar || pax?.name_en || cust?.name || "المسافر الكريم",
          customer_name: cust?.name || "",
          pnr: pnr || "N/A",
          ticket_number: ticket_number || "قيد الإصدار",
          airline: airline_name || airline_supplier || "الناقل الجوي",
          flight_no: flight_number || "",
          origin: origin_city || origin_airport_code || "",
          destination: destination_city || destination_airport_code || "",
          departure_date: departure_date || "",
          departure_time: departure_time || "",
          seat: "تم التعيين",
          total_amount: sell,
          ticket_url: `https://omnifly-travel.sa/travel-b2c-portal?pnr=${pnr || ''}`
        },
        entity_type: "booking",
        entity_id: Number(info.lastInsertRowid),
        sent_by: user.name
      }).catch((e) => console.error("Auto trigger error:", e));
    }
  } catch (err) {
    console.error("Auto notification trigger caught error:", err);
  }

  res.status(201).json(newBooking);
});

router.put("/travel/bookings/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const oldBooking = db.prepare("SELECT * FROM travel_bookings WHERE id = ?").get(req.params.id);
  if (!oldBooking) {
    res.status(404).json({ error: "الحجز غير موجود" });
    return;
  }

  const {
    service_type, customer_id, passenger_id, airline_id, airline_name, airline_supplier, flight_number,
    origin_city, origin_airport_code, destination_city, destination_airport_code, routing_details,
    departure_date, departure_time, return_date, arrival_date, arrival_time, travel_class, fare_basis,
    baggage_weight, baggage_pieces, ticket_price, taxes, service_fee, discount, commission,
    ticket_number, pnr, status, issue_date, issue_time, cost_price, selling_price,
    payment_status, payment_method, supplier_id, supplier_name, notes, missing_docs,
    customer_currency, supplier_currency, customer_statement, supplier_statement, supplier_payment_method
  } = req.body;

  // RULE 41: Prevent removing customer from ticket
  if (customer_id === null || customer_id === undefined || customer_id === "") {
    res.status(400).json({ error: "قواعد العمل: لا يمكن تعديل التذكرة بإلغاء أو ترك حقل العميل فارغاً" });
    return;
  }

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;
  const custPayMethod = payment_method || (oldBooking as any)?.payment_method || 'cash';
  const suppPayMethod = supplier_payment_method || (oldBooking as any)?.supplier_payment_method || 'credit';
  const custCur = customer_currency || (oldBooking as any)?.customer_currency || 'SAR';
  const suppCur = supplier_currency || (oldBooking as any)?.supplier_currency || 'SAR';
  const custStmt = customer_statement || (oldBooking as any)?.customer_statement || `قيمة تذكرة طيران PNR: ${pnr || (oldBooking as any)?.pnr || ''}`;
  const suppStmt = supplier_statement || (oldBooking as any)?.supplier_statement || `تكلفة تذكرة طيران PNR: ${pnr || (oldBooking as any)?.pnr || ''}`;

  db.prepare(`
    UPDATE travel_bookings SET
      service_type = ?, customer_id = ?, passenger_id = ?, airline_id = ?, airline_name = ?, airline_supplier = ?, flight_number = ?,
      origin_city = ?, origin_airport_code = ?, destination_city = ?, destination_airport_code = ?, routing_details = ?,
      departure_date = ?, departure_time = ?, return_date = ?, arrival_date = ?, arrival_time = ?, travel_class = ?, fare_basis = ?,
      baggage_weight = ?, baggage_pieces = ?, ticket_price = ?, taxes = ?, service_fee = ?, discount = ?, commission = ?, profit = ?,
      ticket_number = ?, pnr = ?, status = ?, issue_date = ?, issue_time = ?, cost_price = ?, selling_price = ?,
      payment_status = ?, payment_method = ?, supplier_id = ?, supplier_name = ?, notes = ?, missing_docs = ?,
      customer_currency = ?, supplier_currency = ?, customer_statement = ?, supplier_statement = ?, supplier_payment_method = ?
    WHERE id = ?
  `).run(
    service_type || 'flight', customer_id || null, passenger_id || null, airline_id || null,
    airline_name || airline_supplier || null, airline_supplier || airline_name || null, flight_number || null,
    origin_city || null, origin_airport_code || null, destination_city || null, destination_airport_code || null,
    routing_details || `${origin_city || ''} -> ${destination_city || ''}`,
    departure_date || null, departure_time || null, return_date || null, arrival_date || null, arrival_time || null,
    travel_class || 'اقتصادية', fare_basis || null, Number(baggage_weight || 30), Number(baggage_pieces || 1),
    Number(ticket_price || 0), Number(taxes || 0), Number(service_fee || 0), Number(discount || 0), comm, prof,
    ticket_number || null, pnr || null, status || 'confirmed', issue_date || null, issue_time || null,
    cost, sell, payment_status || (custPayMethod === 'credit' ? 'unpaid' : 'paid'), custPayMethod, 
    supplier_id || null, supplier_name || null, notes || null, missing_docs || null,
    custCur, suppCur, custStmt, suppStmt, suppPayMethod, req.params.id
  );

  const updated = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.id = ?
  `).get(req.params.id);

  // Sync double entry journal
  try {
    const entryDate = issue_date || (oldBooking as any)?.issue_date || new Date().toISOString().slice(0, 10);
    const desc = `قيد تعديل حجز وإصدار تذكرة طيران PNR: ${pnr || (oldBooking as any)?.pnr || ''} رقم: ${ticket_number || (oldBooking as any)?.ticket_number || ''}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(supplier_id);
    const lines = buildTravelJournalLines({
      sell, cost, custPayMethod, paid: Number(req.body.paid_amount || 0),
      suppPayMethod, sPaid: Number(req.body.supplier_paid_amount || 0),
      custAcc, suppAcc, revenueAcc: "41001", expenseAcc: "51000",
      custCur, suppCur, custStmt, suppStmt
    });

    if (lines.length > 0) {
      syncJournalEntryForSource({
        sourceType: "booking",
        sourceId: Number(req.params.id),
        entryDate,
        description: desc,
        lines,
        referenceNo: pnr || ticket_number,
        currency: custCur
      });
    }
  } catch (err) {
    console.error("Journal entry error on booking update:", err);
  }

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: "تعديل حجز / تذكرة",
    actionType: "update",
    entityType: "booking",
    entityId: Number(req.params.id),
    details: `تعديل التذكرة #${req.params.id} PNR: ${pnr || (oldBooking as any).pnr}`,
    oldData: oldBooking,
    newData: updated
  });

  res.json(updated);
});

router.delete("/travel/bookings/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const oldBooking: any = db.prepare("SELECT * FROM travel_bookings WHERE id = ?").get(req.params.id);
  if (!oldBooking) {
    res.status(404).json({ error: "الحجز غير موجود" });
    return;
  }

  // RULE 41: Financial Operations Deletion Prevention (استخدام الإلغاء بدل الحذف)
  if (oldBooking.status === 'confirmed' || oldBooking.payment_status === 'paid' || oldBooking.ticket_number) {
    res.status(400).json({
      error: "قواعد العمل الصارمة: يمنع حذف التذاكر والعمليات المالية المؤكدة نهائياً من قاعدة البيانات للحفاظ على سلامة التدقيق المالي. يرجى استخدام زر الإلغاء (Void) أو الاسترجاع (Refund) بدلاً من الحذف."
    });
    return;
  }

  db.prepare("DELETE FROM travel_bookings WHERE id = ?").run(req.params.id);

  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: "حذف حجز مسودة",
    actionType: "delete",
    entityType: "booking",
    entityId: Number(req.params.id),
    details: `حذف حجز مسودة #${req.params.id}`,
    oldData: oldBooking
  });

  res.status(204).send();
});


// ==========================================
// 3. REFUND SYSTEM (إلغاء واسترجاع التذاكر)
// ==========================================
router.get("/travel/refunds", (_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, c.name as customer_name, p.name_ar as passenger_name
    FROM travel_ticket_refunds r
    LEFT JOIN customers c ON c.id = r.customer_id
    LEFT JOIN travel_passengers p ON p.id = r.passenger_id
    ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

router.post("/travel/refunds", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    booking_id, ticket_number, pnr, customer_id, passenger_id,
    original_ticket_price, original_selling_price, airline_penalty,
    office_refund_fee, refunded_commission, refund_reason, payment_method, safe_id
  } = req.body;

  const origPrice = Number(original_ticket_price || 0);
  const origSell = Number(original_selling_price || origPrice);
  const penalty = Number(airline_penalty || 0);
  const officeFee = Number(office_refund_fee || 0);
  const refComm = Number(refunded_commission || 0);

  // RULE 41: Prevent refund amount greater than paid
  if (penalty < 0 || officeFee < 0) {
    res.status(400).json({ error: "قواعد العمل: لا يمكن إدخال قيم غرامات سالبة" });
    return;
  }

  const netRefundToCustomer = origSell - penalty - officeFee;

  if (netRefundToCustomer > origSell) {
    res.status(400).json({ error: "قواعد العمل: لا يمكن استرجاع مبلغ أكبر من المبلغ المدفوع / سعر البيع الأصلي" });
    return;
  }

  if (penalty > origSell) {
    res.status(400).json({ error: "قواعد العمل: غرامة الاسترجاع لا يمكن أن تتجاوز قيمة البيع الإجمالية للتذكرة" });
    return;
  }

  const officeNetProfitLoss = officeFee - refComm;
  const refNum = `REF-${Date.now().toString().slice(-6)}`;

  const stmt = db.prepare(`
    INSERT INTO travel_ticket_refunds (
      refund_number, booking_id, ticket_number, pnr, customer_id, passenger_id,
      original_ticket_price, original_selling_price, airline_penalty, office_refund_fee,
      refunded_commission, net_refund_to_customer, office_net_profit_loss, refund_reason,
      payment_method, safe_id, user_id, user_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    refNum, booking_id || null, ticket_number || null, pnr || null, customer_id || null, passenger_id || null,
    origPrice, origSell, penalty, officeFee, refComm, netRefundToCustomer, officeNetProfitLoss,
    refund_reason || 'طلب العميل', payment_method || 'cash', safe_id || 1, user.id, user.name
  );

  // Update booking status to refunded
  if (booking_id) {
    db.prepare("UPDATE travel_bookings SET status = 'refunded', notes = COALESCE(notes, '') || ? WHERE id = ?")
      .run(` | تم استرجاع التذكرة بموجب عملية رقم ${refNum}`, booking_id);
  }

  // Double entry accounting journal record
  try {
    const custAcc = getCustomerAccountCode(customer_id);
    const debitSafeAcc = payment_method === 'bank' ? '11120' : '11100';
    const lines: any[] = [
      { account_code: "41001", debit: origSell, credit: 0, description: `إلغاء إيراد عمولة ومبيعات التذكرة المسترجعة PNR: ${pnr || ''}` },
      { account_code: debitSafeAcc, debit: 0, credit: Math.max(0, netRefundToCustomer), description: `صرف المبلغ المسترد للعميل` }
    ];
    if (officeFee > 0) {
      lines.push({ account_code: "45000", debit: 0, credit: officeFee, description: `إيراد رسوم استرجاع المكتب` });
    }
    if (penalty > 0) {
      lines.push({ account_code: "51000", debit: penalty, credit: 0, description: `تكلفة غرامة إلغاء شركة الطيران` });
    }
    syncJournalEntryForSource({
      sourceType: "ticket_refund",
      sourceId: Number(info.lastInsertRowid),
      entryDate: new Date().toISOString().slice(0, 10),
      description: `استرجاع تذكرة طيران PNR: ${pnr || ''} / رقم: ${ticket_number || ''}`,
      lines,
      referenceNo: refNum
    });
  } catch (err) {
    console.error("Journal entry error on refund:", err);
  }

  const newRefund = db.prepare("SELECT * FROM travel_ticket_refunds WHERE id = ?").get(info.lastInsertRowid);

  // RULE 30 & 49: Record Audit Log
  recordAuditLog({
    userId: user.id,
    userName: user.name,
    action: "استرجاع تذكرة طيران",
    actionType: "refund",
    entityType: "refund",
    entityId: Number(info.lastInsertRowid),
    details: `عملية استرجاع ${refNum} لتذكرة ${ticket_number || ''} PNR: ${pnr || ''} - المبلغ المسترد: ${netRefundToCustomer} ريال (غرامة الناقل: ${penalty} - رسوم المكتب: ${officeFee})`,
    newData: newRefund
  });

  res.status(201).json(newRefund);
});


// ==========================================
// 4. BOOKING MODIFICATIONS (تعديل التذاكر والحجوزات)
// ==========================================
router.get("/travel/modifications", (req, res) => {
  const { booking_id } = req.query;
  let sql = `SELECT m.* FROM travel_booking_modifications m WHERE 1=1`;
  const params: any[] = [];
  if (booking_id) { sql += ` AND m.booking_id = ?`; params.push(booking_id); }
  sql += ` ORDER BY m.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/modifications", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    booking_id, pnr, modification_type, old_flight_details, new_flight_details,
    fare_difference, airline_reissue_fee, office_modification_fee, notes
  } = req.body;

  const fareDiff = Number(fare_difference || 0);
  const reissueFee = Number(airline_reissue_fee || 0);
  const officeFee = Number(office_modification_fee || 0);
  const totalCost = fareDiff + reissueFee;
  const totalCharge = totalCost + officeFee;

  const stmt = db.prepare(`
    INSERT INTO travel_booking_modifications (
      booking_id, pnr, modification_type, old_flight_details, new_flight_details,
      fare_difference, airline_reissue_fee, office_modification_fee,
      total_additional_cost, total_additional_charge_to_customer, notes, user_id, user_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    booking_id || null, pnr || null, modification_type || 'تغيير رحلة',
    old_flight_details || null, new_flight_details || null,
    fareDiff, reissueFee, officeFee, totalCost, totalCharge, notes || null, user.id, user.name
  );

  // Update original booking
  if (booking_id) {
    db.prepare(`
      UPDATE travel_bookings SET
        cost_price = cost_price + ?,
        selling_price = selling_price + ?,
        notes = COALESCE(notes, '') || ?
      WHERE id = ?
    `).run(totalCost, totalCharge, `\n[تم التعديل: ${modification_type} - رسوم ${totalCharge}]`, booking_id);
  }

  const modId = Number(info.lastInsertRowid);

  // Accounting double entry journal for ticket modification
  try {
    const bk: any = booking_id ? db.prepare("SELECT * FROM travel_bookings WHERE id = ?").get(booking_id) : null;
    const custAcc = getCustomerAccountCode(bk?.customer_id);
    const suppAcc = getSupplierAccountCode(bk?.supplier_id);
    const modCur = bk?.currency || 'SAR';
    const modLines: any[] = [];
    if (totalCharge > 0) {
      modLines.push(
        { account_code: custAcc, debit: totalCharge, credit: 0, description: `استحقاق رسوم تعديل وإعادة إصدار تذكرة PNR: ${pnr || ''} (${modification_type})`, currency: modCur },
        { account_code: "41001", debit: 0, credit: totalCharge, description: `إيرادات فروقات أسعار وعمولات تعديل التذاكر`, currency: modCur }
      );
    }
    if (totalCost > 0) {
      modLines.push(
        { account_code: "51000", debit: totalCost, credit: 0, description: `تكلفة فرق سعر وغرامة تعديل التذكرة PNR: ${pnr || ''}`, currency: modCur },
        { account_code: suppAcc, debit: 0, credit: totalCost, description: `مستحقات شركة الطيران لتعديل التذكرة`, currency: modCur }
      );
    }
    if (modLines.length > 0) {
      syncJournalEntryForSource({
        sourceType: "modification",
        sourceId: modId,
        entryDate: new Date().toISOString().slice(0, 10),
        description: `قيد تعديل حجز وتذكرة طيران PNR: ${pnr || ''} - ${modification_type}`,
        lines: modLines,
        referenceNo: pnr || `MOD-${modId}`,
        currency: modCur
      });
    }
  } catch (modJournalErr) {
    console.error("Journal entry error on ticket modification:", modJournalErr);
  }

  const newMod = db.prepare("SELECT * FROM travel_booking_modifications WHERE id = ?").get(modId);
  res.status(201).json(newMod);
});


// ==========================================
// 5. DOCUMENTS MANAGEMENT (إدارة الوثائق والجوازات)
// ==========================================
router.get("/travel/documents", (req, res) => {
  const { customer_id, passenger_id, booking_id, visa_id, document_type, search } = req.query;
  let sql = `
    SELECT d.*, c.name as customer_name, p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number
    FROM travel_documents d
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN travel_passengers p ON p.id = d.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customer_id) { sql += ` AND d.customer_id = ?`; params.push(customer_id); }
  if (passenger_id) { sql += ` AND d.passenger_id = ?`; params.push(passenger_id); }
  if (booking_id) { sql += ` AND d.booking_id = ?`; params.push(booking_id); }
  if (visa_id) { sql += ` AND d.visa_id = ?`; params.push(visa_id); }
  if (document_type) { sql += ` AND d.document_type = ?`; params.push(document_type); }
  if (search) {
    sql += ` AND (d.title LIKE ? OR d.file_name LIKE ? OR c.name LIKE ? OR p.name_ar LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY d.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/documents", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    document_type, title, file_url, file_name, file_size, customer_id, passenger_id,
    booking_id, visa_id, expiry_date, notify_before_days, notes
  } = req.body;

  if (!title) {
    res.status(400).json({ error: "عنوان المرفق/الوثيقة مطلوب" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_documents (
      document_type, title, file_url, file_name, file_size, customer_id, passenger_id,
      booking_id, visa_id, expiry_date, notify_before_days, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    document_type || 'جواز السفر', title, file_url || null, file_name || null, Number(file_size || 0),
    customer_id || null, passenger_id || null, booking_id || null, visa_id || null,
    expiry_date || null, Number(notify_before_days || 30), notes || null
  );

  const newDoc = db.prepare(`
    SELECT d.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_documents d
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN travel_passengers p ON p.id = d.passenger_id
    WHERE d.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(newDoc);
});

router.delete("/travel/documents/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_documents WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ==========================================
// 6. AIRLINES MANAGEMENT (شركات الطيران)
// ==========================================
router.get("/travel/airlines", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_airlines ORDER BY name_ar ASC").all();
  res.json(rows);
});

router.post("/travel/airlines", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name_ar, name_en, iata_code, icao_code, country, phone, email, agent_name, default_commission_percent, booking_conditions, notes } = req.body;
  if (!name_ar || !iata_code) {
    res.status(400).json({ error: "اسم شركة الطيران وكود IATA مطلوبة" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_airlines (name_ar, name_en, iata_code, icao_code, country, phone, email, agent_name, default_commission_percent, booking_conditions, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    name_ar, name_en || null, iata_code.toUpperCase(), icao_code ? icao_code.toUpperCase() : null,
    country || null, phone || null, email || null, agent_name || null,
    Number(default_commission_percent || 0), booking_conditions || null, notes || null
  );

  const newAirline = db.prepare("SELECT * FROM travel_airlines WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newAirline);
});

router.put("/travel/airlines/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name_ar, name_en, iata_code, icao_code, country, phone, email, agent_name, default_commission_percent, booking_conditions, notes, active } = req.body;
  db.prepare(`
    UPDATE travel_airlines SET
      name_ar=?, name_en=?, iata_code=?, icao_code=?, country=?, phone=?, email=?, agent_name=?,
      default_commission_percent=?, booking_conditions=?, notes=?, active=?
    WHERE id=?
  `).run(
    name_ar, name_en || null, iata_code ? iata_code.toUpperCase() : '', icao_code ? icao_code.toUpperCase() : null,
    country || null, phone || null, email || null, agent_name || null,
    Number(default_commission_percent || 0), booking_conditions || null, notes || null, active !== undefined ? active : 1, req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_airlines WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/travel/airlines/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_airlines WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ==========================================
// 7. AIRPORTS & DESTINATIONS (المطارات والوجهات)
// ==========================================
router.get("/travel/airports", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_airports ORDER BY country ASC, city ASC").all();
  res.json(rows);
});

router.post("/travel/airports", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { country, city, airport_name_ar, airport_name_en, iata_code, icao_code } = req.body;
  if (!country || !city || !airport_name_ar || !iata_code) {
    res.status(400).json({ error: "الدولة والمدينة واسم المطار وكود IATA مطلوبة" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_airports (country, city, airport_name_ar, airport_name_en, iata_code, icao_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    country, city, airport_name_ar, airport_name_en || null,
    iata_code.toUpperCase(), icao_code ? icao_code.toUpperCase() : null
  );

  const newAirport = db.prepare("SELECT * FROM travel_airports WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newAirport);
});

router.put("/travel/airports/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { country, city, airport_name_ar, airport_name_en, iata_code, icao_code } = req.body;
  db.prepare(`
    UPDATE travel_airports SET country=?, city=?, airport_name_ar=?, airport_name_en=?, iata_code=?, icao_code=?
    WHERE id=?
  `).run(country, city, airport_name_ar, airport_name_en || null, iata_code.toUpperCase(), icao_code ? icao_code.toUpperCase() : null, req.params.id);

  const updated = db.prepare("SELECT * FROM travel_airports WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/travel/airports/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_airports WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ==========================================
// 8. HOTELS DATABASE CATALOG (دليل الفنادق)
// ==========================================
router.get("/travel/hotels-db", (_req, res) => {
  try {
    syncSupplierAccounts();
  } catch {}
  const rows = db.prepare("SELECT * FROM travel_hotels_db ORDER BY country ASC, city ASC, name_ar ASC").all();
  res.json(rows);
});

router.post("/travel/hotels-db", (req, res) => {
  try { syncSupplierAccounts(); /* added sync */ } catch {}
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name_ar, name_en, country, city, star_rating, address, phone, email, supplier_name, default_commission_percent, notes } = req.body;
  if (!name_ar || !country || !city) {
    res.status(400).json({ error: "اسم الفندق والدولة والمدينة مطلوبة" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_hotels_db (name_ar, name_en, country, city, star_rating, address, phone, email, supplier_name, default_commission_percent, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    name_ar, name_en || null, country, city, Number(star_rating || 4),
    address || null, phone || null, email || null, supplier_name || null,
    Number(default_commission_percent || 0), notes || null
  );

  const newHotel = db.prepare("SELECT * FROM travel_hotels_db WHERE id = ?").get(info.lastInsertRowid);
  try {
    syncSupplierAccounts();
  } catch (syncErr) {
    console.error("Error running syncSupplierAccounts on hotel creation:", syncErr);
  }
  res.status(201).json(newHotel);
});


// ==========================================
// 9. VISAS MANAGEMENT (التأشيرات المتطورة ونظام الطرفين)
// ==========================================
router.get("/travel/visas", (req, res) => {
  const { customer_id, supplier_office_id, status, visa_type, currency, search } = req.query;
  let sql = `
    SELECT v.*, 
           c.name as customer_name, c.phone as customer_phone, c.office_name as customer_office_name,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number, p.phone as passenger_phone,
           po.name as supplier_office_official_name, po.phone as supplier_office_phone
    FROM travel_visas v
    LEFT JOIN customers c ON c.id = v.customer_id
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN travel_partner_offices po ON po.id = v.supplier_office_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND v.customer_id = ?`; params.push(customer_id); }
  if (supplier_office_id) { sql += ` AND v.supplier_office_id = ?`; params.push(supplier_office_id); }
  if (status && status !== "all") { sql += ` AND v.status = ?`; params.push(status); }
  if (visa_type && visa_type !== "all") { sql += ` AND v.visa_type = ?`; params.push(visa_type); }
  if (currency && currency !== "all") { 
    sql += ` AND (v.customer_currency = ? OR v.supplier_currency = ?)`; 
    params.push(currency, currency); 
  }
  if (search) {
    sql += ` AND (v.visa_number LIKE ? OR v.application_number LIKE ? OR v.country LIKE ? OR c.name LIKE ? OR p.name_ar LIKE ? OR p.name_en LIKE ? OR p.passport_number LIKE ? OR v.supplier_office_name LIKE ? OR po.name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s, s, s);
  }

  sql += ` ORDER BY v.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/visas", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  ensureTravelVisasColumns();

  try {
    const {
      application_number, customer_id, passenger_id, country, visa_type, status,
      application_date, expected_travel_date, expiry_date, duration_days, cost_price, selling_price,
      office_fees, paid_amount, responsible_employee, embassy_entity, supplier_agent,
      supplier_office_id, supplier_office_name, customer_currency, customer_statement,
      supplier_currency, supplier_statement, agency_commission, commission_currency, exchange_rate,
      payment_method, payment_status,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      issued_visa_number, issue_date, rejection_reason, rejection_date, delivered_to, delivery_date, delivery_method, delivery_notes, border_number, service_voucher_no,
      checklist_passport, checklist_photos, checklist_hotel, checklist_ticket,
      checklist_bank, checklist_job_letter, checklist_insurance, checklist_extra,
      missing_docs, notes
    } = req.body;

    const finalCountry = (country && String(country).trim()) || 'المملكة العربية السعودية';
    const payMethod = payment_method || 'cash';
    const suppPayMethod = supplier_payment_method || payMethod || 'credit';
    const cost = Number(cost_price || 0);
    const sell = Number(selling_price || 0);

    // If payment_method is credit (آجل), prevent register payment unless partial is explicitly chosen
    let paid = Number(paid_amount !== undefined ? paid_amount : (payMethod === 'credit' ? 0 : sell));
    if (payMethod === 'credit' && payment_status === 'unpaid') {
      paid = 0;
    }
    const rem = sell - paid;
    const payStatus = payment_status || (paid > 0 ? (paid >= sell ? 'paid' : 'partial') : (payMethod === 'credit' ? 'unpaid' : 'paid'));

    let sPaid = Number(supplier_paid_amount !== undefined ? supplier_paid_amount : (suppPayMethod === 'cash' ? cost : 0));
    if (suppPayMethod === 'credit' && supplier_payment_status === 'unpaid') {
      sPaid = 0;
    }
    const sRem = Number(supplier_remaining_balance !== undefined ? supplier_remaining_balance : (cost - sPaid));
    const sStatus = supplier_payment_status || (sPaid >= cost ? 'paid' : (sPaid > 0 ? 'partial' : 'unpaid'));

    const appNum = application_number || `VSA-${Date.now().toString().slice(-6)}`;
    const comm = agency_commission !== undefined && agency_commission !== "" ? Number(agency_commission) : (sell - cost);

    // Comprehensive supplier/partner office name resolution to avoid ID clashes
    let suppName = supplier_office_name;
    if (supplier_office_id && !suppName) {
      // 1. Check travel_partner_offices
      const off: any = db.prepare("SELECT name FROM travel_partner_offices WHERE id = ?").get(supplier_office_id);
      if (off) {
        suppName = off.name;
      } else {
        // 2. Check suppliers
        const sup: any = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(supplier_office_id);
        if (sup) {
          suppName = sup.name;
        } else {
          // 3. Check travel_suppliers
          const ts: any = db.prepare("SELECT name FROM travel_suppliers WHERE id = ?").get(supplier_office_id);
          if (ts) {
            suppName = ts.name;
          } else {
            // 4. Check accounts
            const acc: any = db.prepare("SELECT name FROM accounts WHERE id = ? OR code = ?").get(supplier_office_id, String(supplier_office_id));
            if (acc) suppName = acc.name;
          }
        }
      }
    }

    // Generate service voucher sequence e.g. 02026/1921-X if not provided
    let voucherNo = service_voucher_no;
    if (!voucherNo) {
      const currentYear = new Date().getFullYear();
      const countVouchers = (db.prepare("SELECT COUNT(*) as c FROM travel_visas").get() as any)?.c || 0;
      voucherNo = `0${currentYear}/1921-${countVouchers + 1}`;
    }

    const stmt = db.prepare(`
      INSERT INTO travel_visas (
        visa_number, application_number, customer_id, passenger_id, country, visa_type, status,
        application_date, expected_travel_date, expiry_date, duration_days, cost_price, selling_price,
        office_fees, paid_amount, remaining_balance, responsible_employee, embassy_entity, supplier_agent,
        supplier_office_id, supplier_office_name, customer_currency, customer_statement,
        supplier_currency, supplier_statement, agency_commission, commission_currency, exchange_rate,
        payment_method, payment_status,
        supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
        issued_visa_number, issue_date, rejection_reason, rejection_date, delivered_to, delivery_date, delivery_method, delivery_notes, border_number, service_voucher_no,
        checklist_passport, checklist_photos, checklist_hotel, checklist_ticket,
        checklist_bank, checklist_job_letter, checklist_insurance, checklist_extra,
        missing_docs, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      appNum, appNum, customer_id ? Number(customer_id) : null, passenger_id ? Number(passenger_id) : null,
      finalCountry, visa_type || 'تأشيرة عمرة', status || 'under_process',
      application_date || getBusinessDate("travel"), expected_travel_date || null, expiry_date || null,
      Number(duration_days || 30), cost, sell, Number(office_fees || 0), paid, rem,
      responsible_employee || user.name, embassy_entity || null, supplier_agent || suppName || null,
      supplier_office_id ? Number(supplier_office_id) : null, suppName || null,
      customer_currency || 'SAR', customer_statement || null,
      supplier_currency || 'SAR', supplier_statement || null,
      comm, commission_currency || customer_currency || 'SAR', Number(exchange_rate || 1),
      payMethod, payStatus,
      suppPayMethod, sStatus, sPaid, sRem,
      issued_visa_number || null, issue_date || null, rejection_reason || null, rejection_date || null, delivered_to || null, delivery_date || null, delivery_method || null, delivery_notes || null, border_number || null, voucherNo,
      checklist_passport ? 1 : 0, checklist_photos ? 1 : 0, checklist_hotel ? 1 : 0, checklist_ticket ? 1 : 0,
      checklist_bank ? 1 : 0, checklist_job_letter ? 1 : 0, checklist_insurance ? 1 : 0, checklist_extra ? 1 : 0,
      missing_docs || null, notes || null
    );

    const newVisa = db.prepare(`SELECT * FROM travel_visas WHERE id = ?`).get(info.lastInsertRowid);

  // Financial accounting journal entry
  try {
    const entryDate = application_date || getBusinessDate("travel");
    const desc = customer_statement || `معاملة ${visa_type || 'تأشيرة'} (${payMethod === 'credit' ? 'آجل' : payMethod === 'bank' ? 'تحويل بنكي' : 'نقداً'}) - ${country || 'السعودية'}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(suppName || supplier_agent || supplier_office_id);
    const visaCur = customer_currency || supplier_currency || 'SAR';
    const lines = buildTravelJournalLines({
      sell, cost, custPayMethod: payMethod, paid,
      suppPayMethod, sPaid,
      custAcc, suppAcc, revenueAcc: "43001", expenseAcc: "53000",
      custCur: customer_currency || visaCur, suppCur: supplier_currency || visaCur,
      custStmt: customer_statement || `رسوم معاملة ${visa_type || 'تأشيرة'} - ${appNum}`,
      suppStmt: supplier_statement || `تكلفة معاملة ${visa_type || 'تأشيرة'} - ${appNum}`
    });

    syncJournalEntryForSource({
      sourceType: "visa",
      sourceId: Number(info.lastInsertRowid),
      entryDate,
      description: desc,
      lines,
      referenceNo: appNum,
      currency: visaCur
    });
  } catch (err) {
    console.error("Journal entry error on visa creation:", err);
  }

  res.status(201).json(newVisa);
  } catch (err: any) {
    console.error("Error creating visa:", err);
    let errMsg = err.message;
    if (errMsg.includes("FOREIGN KEY constraint failed")) {
      errMsg = "فشل الحفظ بسبب عدم تطابق الحسابات أو البيانات المرتبطة (مثل العميل أو المسافر أو المورد) في النظام. يرجى التحقق من صحة المدخلات.";
    } else if (errMsg.includes("UNIQUE constraint failed")) {
      errMsg = "هذا الرقم أو المعاملة مسجلة بالفعل في النظام ومكررة.";
    }
    res.status(500).json({ error: errMsg });
  }
});

router.put("/travel/visas/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  try {
    const {
      customer_id, passenger_id, country, visa_type, status, application_date, expected_travel_date, expiry_date, duration_days,
      cost_price, selling_price, office_fees, paid_amount, responsible_employee, embassy_entity, supplier_agent,
      supplier_office_id, supplier_office_name, customer_currency, customer_statement,
      supplier_currency, supplier_statement, agency_commission, commission_currency, exchange_rate,
      payment_method, payment_status,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      issued_visa_number, issue_date, rejection_reason, rejection_date, delivered_to, delivery_date, delivery_method, delivery_notes, border_number, service_voucher_no,
      checklist_passport, checklist_photos, checklist_hotel, checklist_ticket,
      checklist_bank, checklist_job_letter, checklist_insurance, checklist_extra,
      missing_docs, notes
    } = req.body;

    const finalCountry = (country && String(country).trim()) || 'المملكة العربية السعودية';
    const cost = Number(cost_price || 0);
    const sell = Number(selling_price || 0);
    const payMethod = payment_method || 'cash';
    const suppPayMethod = supplier_payment_method || 'credit';

    // If payment_method is credit (آجل), prevent register payment unless partial is explicitly chosen
    let paid = Number(paid_amount !== undefined ? paid_amount : (payMethod === 'credit' ? 0 : sell));
    if (payMethod === 'credit' && payment_status === 'unpaid') {
      paid = 0;
    }
    const rem = sell - paid;
    const payStatus = payment_status || (paid >= sell ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));

    let sPaid = Number(supplier_paid_amount !== undefined ? supplier_paid_amount : (suppPayMethod === 'cash' ? cost : 0));
    if (suppPayMethod === 'credit' && supplier_payment_status === 'unpaid') {
      sPaid = 0;
    }
    const sRem = Number(supplier_remaining_balance !== undefined ? supplier_remaining_balance : (cost - sPaid));
    const sStatus = supplier_payment_status || (sPaid >= cost ? 'paid' : (sPaid > 0 ? 'partial' : 'unpaid'));

    const comm = agency_commission !== undefined && agency_commission !== "" ? Number(agency_commission) : (sell - cost);

    // Comprehensive supplier/partner office name resolution to avoid ID clashes
    let suppName = supplier_office_name;
    if (supplier_office_id && !suppName) {
      // 1. Check travel_partner_offices
      const off: any = db.prepare("SELECT name FROM travel_partner_offices WHERE id = ?").get(supplier_office_id);
      if (off) {
        suppName = off.name;
      } else {
        // 2. Check suppliers
        const sup: any = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(supplier_office_id);
        if (sup) {
          suppName = sup.name;
        } else {
          // 3. Check travel_suppliers
          const ts: any = db.prepare("SELECT name FROM travel_suppliers WHERE id = ?").get(supplier_office_id);
          if (ts) {
            suppName = ts.name;
          } else {
            // 4. Check accounts
            const acc: any = db.prepare("SELECT name FROM accounts WHERE id = ? OR code = ?").get(supplier_office_id, String(supplier_office_id));
            if (acc) suppName = acc.name;
          }
        }
      }
    }

    db.prepare(`
      UPDATE travel_visas SET
        customer_id=?, passenger_id=?, country=?, visa_type=?, status=?, application_date=?, expected_travel_date=?, expiry_date=?, duration_days=?,
        cost_price=?, selling_price=?, office_fees=?, paid_amount=?, remaining_balance=?,
        responsible_employee=?, embassy_entity=?, supplier_agent=?,
        supplier_office_id=?, supplier_office_name=?, customer_currency=?, customer_statement=?,
        supplier_currency=?, supplier_statement=?, agency_commission=?, commission_currency=?, exchange_rate=?,
        payment_method=?, payment_status=?,
        supplier_payment_method=?, supplier_payment_status=?, supplier_paid_amount=?, supplier_remaining_balance=?,
        issued_visa_number=?, issue_date=?, rejection_reason=?, rejection_date=?, delivered_to=?, delivery_date=?, delivery_method=?, delivery_notes=?, border_number=?, service_voucher_no=?,
        checklist_passport=?, checklist_photos=?, checklist_hotel=?, checklist_ticket=?,
        checklist_bank=?, checklist_job_letter=?, checklist_insurance=?, checklist_extra=?,
        missing_docs=?, notes=?
      WHERE id=?
    `).run(
      customer_id ? Number(customer_id) : null, passenger_id ? Number(passenger_id) : null,
      finalCountry, visa_type || 'تأشيرة عمرة', status || 'under_process',
      application_date || new Date().toISOString().slice(0, 10), expected_travel_date || null, expiry_date || null, Number(duration_days || 30),
      cost, sell, Number(office_fees || 0), paid, rem,
      responsible_employee || user.name, embassy_entity || null, supplier_agent || suppName || null,
      supplier_office_id ? Number(supplier_office_id) : null, suppName || null,
      customer_currency || 'SAR', customer_statement || null,
      supplier_currency || 'SAR', supplier_statement || null,
      comm, commission_currency || customer_currency || 'SAR', Number(exchange_rate || 1),
      payMethod, payStatus,
      suppPayMethod, sStatus, sPaid, sRem,
      issued_visa_number || null, issue_date || null, rejection_reason || null, rejection_date || null, delivered_to || null, delivery_date || null, delivery_method || null, delivery_notes || null, border_number || null, service_voucher_no || null,
      checklist_passport ? 1 : 0, checklist_photos ? 1 : 0, checklist_hotel ? 1 : 0, checklist_ticket ? 1 : 0,
      checklist_bank ? 1 : 0, checklist_job_letter ? 1 : 0, checklist_insurance ? 1 : 0, checklist_extra ? 1 : 0,
      missing_docs || null, notes || null, req.params.id
    );

  const updated = db.prepare("SELECT * FROM travel_visas WHERE id = ?").get(req.params.id) as any;

  // Sync double entry journal on update
  try {
    const entryDate = application_date || new Date().toISOString().slice(0, 10);
    const desc = customer_statement || `تعديل معاملة ${visa_type || 'تأشيرة'} - ${country || 'السعودية'}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(suppName || supplier_agent || supplier_office_id);
    const visaCur = customer_currency || supplier_currency || 'SAR';
    const lines = buildTravelJournalLines({
      sell, cost, custPayMethod: payMethod, paid,
      suppPayMethod, sPaid,
      custAcc, suppAcc, revenueAcc: "43001", expenseAcc: "53000",
      custCur: customer_currency || visaCur, suppCur: supplier_currency || visaCur,
      custStmt: customer_statement || `رسوم معاملة ${visa_type || 'تأشيرة'} - ${updated.application_number || req.params.id}`,
      suppStmt: supplier_statement || `تكلفة معاملة ${visa_type || 'تأشيرة'} - ${updated.application_number || req.params.id}`
    });

    syncJournalEntryForSource({
      sourceType: "visa",
      sourceId: Number(req.params.id),
      entryDate,
      description: desc,
      lines,
      referenceNo: updated.application_number || `VSA-${req.params.id}`,
      currency: visaCur
    });
  } catch (err) {
    console.error("Journal entry error on visa update:", err);
  }

  // Auto trigger visa notification if status is ready or approved or delivered
  if (status === "approved" || status === "جاهزة" || status === "issued" || status === "completed" || status === "delivered") {
    try {
      const cust: any = updated.customer_id ? db.prepare("SELECT phone, email, name FROM customers WHERE id = ?").get(updated.customer_id) : null;
      const pax: any = updated.passenger_id ? db.prepare("SELECT phone, email, name_ar, name_en FROM travel_passengers WHERE id = ?").get(updated.passenger_id) : null;
      const phone = pax?.phone || cust?.phone;
      if (phone) {
        triggerTravelNotificationEvent({
          event_trigger: "visa_ready",
          recipient_phone: phone,
          recipient_name: pax?.name_ar || cust?.name || "العميل الكريم",
          data: {
            customer_name: cust?.name || pax?.name_ar || "العميل الكريم",
            passenger_name: pax?.name_ar || cust?.name || "",
            country: country,
            visa_code: updated.issued_visa_number || updated.application_number || updated.visa_number || `#VSA-${req.params.id}`
          },
          entity_type: "visa",
          entity_id: Number(req.params.id),
          sent_by: user.name
        }).catch((e) => console.error("Visa auto trigger error:", e));
      }
    } catch (err) {
      console.error("Visa auto notification error:", err);
    }
  }

  res.json(updated);
  } catch (err: any) {
    console.error("Error updating visa:", err);
    let errMsg = err.message;
    if (errMsg.includes("FOREIGN KEY constraint failed")) {
      errMsg = "فشل تحديث المعاملة بسبب عدم تطابق الحسابات أو البيانات المرتبطة في النظام. يرجى التأكد من صحة اختيار العميل أو المسافر أو المورد.";
    } else if (errMsg.includes("UNIQUE constraint failed")) {
      errMsg = "فشل التحديث لأن القيمة المدخلة (مثل رقم التأشيرة أو المعاملة) مكررة وموجودة بالفعل في النظام.";
    }
    res.status(500).json({ error: errMsg });
  }
});

// Quick Action Status Update for Visas (مؤشرة، مرفوضة، مسلمة للعميل، في المكتب، قيد المعالجة)
router.put("/travel/visas/:id/status-action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    status,
    issued_visa_number,
    issue_date,
    expiry_date,
    border_number,
    rejection_reason,
    rejection_date,
    delivered_to,
    delivery_date,
    delivery_method,
    delivery_notes,
    missing_docs,
    notes,
    outward_date,
    batch_number,
    outward_voucher_no,
    inward_date,
    inward_note,
    inward_status,
    department,
    delivery_type
  } = req.body;

  const current = db.prepare("SELECT * FROM travel_visas WHERE id = ?").get(req.params.id) as any;
  if (!current) {
    res.status(404).json({ error: "معاملة التأشيرة غير موجودة" });
    return;
  }

  db.prepare(`
    UPDATE travel_visas SET
      status = COALESCE(?, status),
      issued_visa_number = COALESCE(?, issued_visa_number),
      issue_date = COALESCE(?, issue_date),
      expiry_date = COALESCE(?, expiry_date),
      border_number = COALESCE(?, border_number),
      rejection_reason = COALESCE(?, rejection_reason),
      rejection_date = COALESCE(?, rejection_date),
      delivered_to = COALESCE(?, delivered_to),
      delivery_date = COALESCE(?, delivery_date),
      delivery_method = COALESCE(?, delivery_method),
      delivery_notes = COALESCE(?, delivery_notes),
      missing_docs = COALESCE(?, missing_docs),
      outward_date = COALESCE(?, outward_date),
      batch_number = COALESCE(?, batch_number),
      outward_voucher_no = COALESCE(?, outward_voucher_no),
      inward_date = COALESCE(?, inward_date),
      inward_note = COALESCE(?, inward_note),
      inward_status = COALESCE(?, inward_status),
      department = COALESCE(?, department),
      delivery_type = COALESCE(?, delivery_type),
      notes = CASE WHEN ? IS NOT NULL THEN COALESCE(notes, '') || '\n' || ? ELSE notes END
    WHERE id = ?
  `).run(
    status,
    issued_visa_number,
    issue_date,
    expiry_date,
    border_number,
    rejection_reason,
    rejection_date,
    delivered_to,
    delivery_date,
    delivery_method,
    delivery_notes,
    missing_docs,
    outward_date,
    batch_number,
    outward_voucher_no,
    inward_date,
    inward_note,
    inward_status,
    department,
    delivery_type,
    notes, notes,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_visas WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/travel/visas/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    deleteDoubleEntryJournal("visa", Number(req.params.id));
  } catch (err) {
    console.error("Error deleting visa journal entry:", err);
  }
  db.prepare("DELETE FROM travel_visas WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// ==========================================
// UNIVERSAL SERVICE RETURNS & REFUNDS (فواتير مردود الخدمات ومردود المعاملات)
// ==========================================
router.get("/travel/service-returns", (req, res) => {
  const { service_type, customer_id, search, from_date, to_date } = req.query as any;
  let sql = `
    SELECT r.*, c.name as customer_official_name, c.phone as customer_phone
    FROM travel_service_returns r
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (service_type && service_type !== "all") {
    sql += ` AND r.service_type = ?`;
    params.push(service_type);
  }
  if (customer_id && customer_id !== "all") {
    sql += ` AND r.customer_id = ?`;
    params.push(customer_id);
  }
  if (from_date) {
    sql += ` AND r.return_date >= ?`;
    params.push(from_date);
  }
  if (to_date) {
    sql += ` AND r.return_date <= ?`;
    params.push(to_date);
  }
  if (search) {
    sql += ` AND (r.return_number LIKE ? OR r.original_service_ref LIKE ? OR r.customer_name LIKE ? OR r.statement LIKE ? OR r.passenger_name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  sql += ` ORDER BY r.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Auto-link Visas to Customers by matching passenger emails to customer emails
router.post("/travel/visas/auto-link-email", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { action, emailPayload } = req.body;
  const logs: string[] = [];
  let linkedCount = 0;

  if (action === "simulate" && emailPayload) {
    const { passenger_email, passenger_name, passport_number, visa_number, country, visa_type, cost_price, selling_price } = emailPayload;
    
    // Find or create passenger
    let passenger = db.prepare("SELECT * FROM travel_passengers WHERE email = ? OR passport_number = ?").get(passenger_email, passport_number) as any;
    if (!passenger) {
      const info = db.prepare(`
        INSERT INTO travel_passengers (name_ar, name_en, passport_number, email, phone)
        VALUES (?, ?, ?, ?, ?)
      `).run(passenger_name, passenger_name, passport_number, passenger_email, "0500000000");
      passenger = db.prepare("SELECT * FROM travel_passengers WHERE id = ?").get(info.lastInsertRowid);
      logs.push(`تم إنشاء سجل مسافر جديد: ${passenger_name} (${passenger_email})`);
      const host = `${req.protocol}://${req.get("host")}`;
      applyPassengerWhatsAppAutomation(passenger, host).catch(() => {});
    }

    // Match customer by email
    const customer = db.prepare("SELECT * FROM customers WHERE email = ?").get(passenger_email) as any;
    const customerId = customer ? customer.id : null;
    if (customer) {
      logs.push(`🎯 عثرنا على تطابق بريد الكتروني للعميل: ${customer.name} (${customer.email})`);
    } else {
      logs.push(`⚠️ لم نجد عميل مسجل بهذا البريد الإلكتروني في النظام. سيتم تسجيل التأشيرة غير مرتبطة.`);
    }

    const appNum = visa_number || `VSA-EML-${Date.now().toString().slice(-6)}`;
    const cost = Number(cost_price || 150);
    const sell = Number(selling_price || 300);
    const rem = sell;

    // Insert visa
    const stmt = db.prepare(`
      INSERT INTO travel_visas (
        visa_number, application_number, customer_id, passenger_id, country, visa_type, status,
        application_date, expected_travel_date, expiry_date, duration_days, cost_price, selling_price,
        paid_amount, remaining_balance, responsible_employee, payment_method, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'under_process', ?, ?, ?, 30, ?, ?, 0, ?, ?, 'credit', 'unpaid')
    `);

    const appDate = new Date().toISOString().slice(0, 10);
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 90);
    const expDateStr = expDate.toISOString().slice(0, 10);

    const info = stmt.run(
      appNum, appNum, customerId, passenger.id, country || "المملكة العربية السعودية", visa_type || "تأشيرة عمرة",
      appDate, appDate, expDateStr, cost, sell, rem, user.name
    );

    const visaId = Number(info.lastInsertRowid);
    logs.push(`✅ تم تسجيل التأشيرة رقم ${appNum} للمسافر ${passenger_name} في النظام.`);

    if (customerId) {
      linkedCount++;
      // Create journal entry
      try {
        const custAcc = getCustomerAccountCode(customerId);
        const lines = [
          { account_code: custAcc, debit: sell, credit: 0, description: `استحقاق رسوم تأشيرة عمرة تلقائي عبر البريد الإلكتروني` },
          { account_code: "43001", debit: 0, credit: sell, description: `ايرادات عمولة مبيعات معاملات التاشيرات - ربط آلي` }
        ];
        createDoubleEntryJournal(appDate, `قيد استحقاق تأشيرة ربط آلي - ${passenger_name}`, "visa", visaId, lines, { reference_no: appNum });
        logs.push(`📊 تم إنشاء قيد محاسبي مزدوج تلقائي للعميل ${customer.name} برصيد مدين ${sell} ريال على الحساب (${custAcc})`);
      } catch (err: any) {
        logs.push(`❌ خطأ محاسبي أثناء الربط: ${err.message}`);
      }

      // Record a simulated notification trigger
      try {
        db.prepare(`
          INSERT INTO travel_notifications (channel, recipient, message_body, status)
          VALUES ('whatsapp', ?, ?, 'sent')
        `).run(
          customer.phone || "0500000000",
          `مرحباً ${customer.name}، تم استلام تأشيرة العمرة الخاصة بالمسافر ${passenger_name} ورقم جواز السفر ${passport_number} من القنصلية، وتم ربطها تلقائياً بملفكم المالي وإدراج قيد الاستحقاق. شكراً لكم.`
        );
        logs.push(`📱 تم إرسال رسالة واتساب تلقائية للعميل لتأكيد ربط التأشيرة وإدراج استحقاقها المالي بنجاح!`);
      } catch (err: any) {
        console.error("Error creating notification:", err);
      }
    }
  } else {
    // Action: scan and match existing unlinked visas
    const unlinkedVisas = db.prepare(`
      SELECT v.id, v.visa_number, p.name_ar, p.email, p.passport_number, v.selling_price
      FROM travel_visas v
      JOIN travel_passengers p ON p.id = v.passenger_id
      WHERE v.customer_id IS NULL OR v.customer_id = 0
    `).all() as any[];

    logs.push(`🔍 جاري فحص عدد ${unlinkedVisas.length} تأشيرة غير مرتبطة بعميل في النظام...`);

    for (const v of unlinkedVisas) {
      if (v.email) {
        const customer = db.prepare("SELECT * FROM customers WHERE email = ?").get(v.email) as any;
        if (customer) {
          db.prepare("UPDATE travel_visas SET customer_id = ? WHERE id = ?").run(customer.id, v.id);
          linkedCount++;
          logs.push(`🎯 تم العثور على تطابق بريد إلكتروني: تم ربط التأشيرة ${v.visa_number} بالعميل [${customer.name}]`);

          // Create journal entry
          try {
            const custAcc = getCustomerAccountCode(customer.id);
            const appDate = new Date().toISOString().slice(0, 10);
            const lines = [
              { account_code: custAcc, debit: v.selling_price || 300, credit: 0, description: `استحقاق رسوم تأشيرة عمرة تلقائي عبر البريد الإلكتروني` },
              { account_code: "43001", debit: 0, credit: v.selling_price || 300, description: `ايرادات عمولة مبيعات معاملات التاشيرات - ربط آلي` }
            ];
            createDoubleEntryJournal(appDate, `قيد استحقاق تأشيرة ربط آلي - ${v.name_ar}`, "visa", v.id, lines, { reference_no: v.visa_number });
            logs.push(`📊 تم ترحيل التأثير المالي وتحديث دفتر الأستاذ للحساب المالي الفرعي (${custAcc}) برصيد ${v.selling_price || 300} ريال.`);
          } catch (err: any) {
            logs.push(`❌ خطأ في القيد المالي للتأشيرة ${v.visa_number}: ${err.message}`);
          }

          // Trigger simulated notification
          try {
            db.prepare(`
              INSERT INTO travel_notifications (channel, recipient, message_body, status)
              VALUES ('whatsapp', ?, ?, 'sent')
            `).run(
              customer.phone || "0500000000",
              `مرحباً ${customer.name}، تم ربط تأشيرة المسافر ${v.name_ar} رقم جواز ${v.passport_number} بملفكم المالي تلقائياً عبر مطابقة البريد الإلكتروني وتوثيق المعاملة قيود استحقاقها المالي.`
            );
          } catch {}
        }
      }
    }

    logs.push(`🏁 اكتمال عملية الفحص والربط التلقائي لملفات الوكلاء المعتمدين. تم ربط عدد (${linkedCount}) تأشيرة بنجاح.`);
  }

  res.json({ success: true, linkedCount, logs });
});

// Lookup available services to return (Visas, Flights, Bus Tickets, Hotels, Central Invoices)
router.get("/travel/services-lookup", (req, res) => {
  const { search, customer_id, service_type } = req.query as any;
  const results: any[] = [];

  // 1. Visas
  if (!service_type || service_type === "visa" || service_type === "all") {
    const visas = db.prepare(`
      SELECT v.id, v.visa_number, v.service_voucher_no, v.country, v.visa_type, v.selling_price, v.cost_price, v.customer_currency,
             v.application_date, v.status, c.id as customer_id, c.name as customer_name, p.name_ar as passenger_name
      FROM travel_visas v
      LEFT JOIN customers c ON c.id = v.customer_id
      LEFT JOIN travel_passengers p ON p.id = v.passenger_id
      WHERE v.status != 'cancelled' AND v.status != 'refunded'
      ORDER BY v.id DESC LIMIT 50
    `).all() as any[];

    for (const v of visas) {
      const voucherRef = v.service_voucher_no || `0${new Date().getFullYear()}/1921-${v.id}`;
      results.push({
        id: v.id,
        service_type: "visa",
        service_category_name: "تأشيرات ومعاملات",
        service_title: `معاملة تأشيرة ${v.country} (${v.visa_type})`,
        voucher_ref: voucherRef,
        customer_id: v.customer_id,
        customer_name: v.customer_name || "عميل عام",
        passenger_name: v.passenger_name || "",
        statement: `مقابل /معاملة جواز تأشيرة ${v.country} - ${v.visa_type}`,
        date: v.application_date,
        selling_price: v.selling_price || 0,
        cost_price: v.cost_price || 0,
        currency: v.customer_currency || "SAR"
      });
    }
  }

  // 2. Bus Tickets
  if (!service_type || service_type === "bus_ticket" || service_type === "all") {
    try {
      const bus = db.prepare(`
        SELECT b.id, b.ticket_number, b.origin_city, b.destination_city, b.selling_price, b.cost_price, b.departure_date,
               b.status, c.id as customer_id, c.name as customer_name, b.passenger_name
        FROM travel_bus_bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        WHERE b.status != 'cancelled' AND b.status != 'refunded'
        ORDER BY b.id DESC LIMIT 50
      `).all() as any[];

      for (const b of bus) {
        const voucherRef = `0${new Date().getFullYear()}/1921-${b.id + 10}`;
        results.push({
          id: b.id,
          service_type: "bus_ticket",
          service_category_name: "تذاكر نقل بري",
          service_title: `تذكرة باص ${b.origin_city} ⬅️ ${b.destination_city}`,
          voucher_ref: voucherRef,
          customer_id: b.customer_id,
          customer_name: b.customer_name || "عميل نقدي",
          passenger_name: b.passenger_name || "",
          statement: `مقابل /خدمة تذاكر سفر تذكرة سفر الى ${b.destination_city}`,
          date: b.departure_date,
          selling_price: b.selling_price || 0,
          cost_price: b.cost_price || 0,
          currency: "SAR"
        });
      }
    } catch {}
  }

  // 3. Flight Bookings
  if (!service_type || service_type === "flight_ticket" || service_type === "all") {
    try {
      const flights = db.prepare(`
        SELECT f.id, f.booking_number, f.pnr, f.ticket_number, f.origin_city, f.destination_city, f.selling_price, f.cost_price, f.departure_date,
               f.status, c.id as customer_id, c.name as customer_name, p.name_ar as passenger_name
        FROM travel_bookings f
        LEFT JOIN customers c ON c.id = f.customer_id
        LEFT JOIN travel_passengers p ON p.id = f.passenger_id
        WHERE f.status != 'cancelled' AND f.status != 'refunded'
        ORDER BY f.id DESC LIMIT 50
      `).all() as any[];

      for (const f of flights) {
        const voucherRef = `0${new Date().getFullYear()}/1921-${f.id + 20}`;
        results.push({
          id: f.id,
          service_type: "flight_ticket",
          service_category_name: "تذاكر طيران",
          service_title: `تذكرة طيران ${f.origin_city} ⬅️ ${f.destination_city} (PNR: ${f.pnr || '-'})`,
          voucher_ref: voucherRef,
          customer_id: f.customer_id,
          customer_name: f.customer_name || "عميل عام",
          passenger_name: f.passenger_name || "",
          statement: `مقابل /خدمة تذاكر طيران ${f.origin_city} إلى ${f.destination_city}`,
          date: f.departure_date,
          selling_price: f.selling_price || 0,
          cost_price: f.cost_price || 0,
          currency: "SAR"
        });
      }
    } catch {}
  }

  // 4. Central Invoices Items
  if (!service_type || service_type === "central_invoice" || service_type === "all") {
    try {
      const invs = db.prepare(`
        SELECT i.id, i.invoice_number, i.statement as invoice_stmt, i.grand_total, i.issue_date, i.currency,
               c.id as customer_id, c.name as customer_name
        FROM travel_invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status != 'cancelled'
        ORDER BY i.id DESC LIMIT 50
      `).all() as any[];

      for (const inv of invs) {
        results.push({
          id: inv.id,
          service_type: "central_invoice",
          service_category_name: "فاتورة مبيعات مركزية",
          service_title: `فاتورة مبيعات رقم ${inv.invoice_number}`,
          voucher_ref: `0${new Date().getFullYear()}/1921-${inv.id + 50}`,
          customer_id: inv.customer_id,
          customer_name: inv.customer_name || "عميل",
          passenger_name: "",
          statement: inv.invoice_stmt || `مقابل /مبيعات خدمات فاتورة رقم ${inv.invoice_number}`,
          date: inv.issue_date,
          selling_price: inv.grand_total || 0,
          cost_price: 0,
          currency: inv.currency || "SAR"
        });
      }
    } catch {}
  }

  // Filter if search query passed
  let filtered = results;
  if (search) {
    const s = search.toLowerCase();
    filtered = results.filter(r =>
      (r.voucher_ref || "").toLowerCase().includes(s) ||
      (r.statement || "").toLowerCase().includes(s) ||
      (r.customer_name || "").toLowerCase().includes(s) ||
      (r.passenger_name || "").toLowerCase().includes(s) ||
      (r.service_title || "").toLowerCase().includes(s)
    );
  }
  if (customer_id && customer_id !== "all") {
    filtered = filtered.filter(r => String(r.customer_id) === String(customer_id));
  }

  res.json(filtered);
});

// Create Universal Service Return Invoice (فاتورة مردود خدمة / مردود معاملات)
router.post("/travel/service-returns", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    return_number,
    original_service_ref,
    service_type,
    service_category_name,
    service_item_id,
    customer_id,
    customer_name,
    passenger_name,
    statement,
    return_date,
    currency,
    exchange_rate,
    original_amount,
    penalty_amount,
    agency_refund_fee,
    net_refund_amount,
    supplier_penalty,
    supplier_refund_amount,
    supplier_id,
    supplier_name,
    supplier_type,
    refund_method,
    debit_account_code,
    credit_account_code,
    reason,
    notes
  } = req.body;

  const currentYear = new Date().getFullYear();
  const countRet = (db.prepare("SELECT COUNT(*) as c FROM travel_service_returns").get() as any)?.c || 0;

  // Derive return number matching original sequence if original is 02026/1921-X -> return 02026/1941-X
  let retNum = return_number;
  if (!retNum) {
    if (original_service_ref && original_service_ref.includes("1921-")) {
      const suffix = original_service_ref.split("1921-")[1];
      retNum = `0${currentYear}/1941-${suffix}`;
    } else {
      retNum = `0${currentYear}/1941-${countRet + 1}`;
    }
  }

  const origAmt = Number(original_amount || 0);
  const penalty = Number(penalty_amount || 0);
  const agencyFee = Number(agency_refund_fee || 0);
  const netRefund = Number(net_refund_amount !== undefined ? net_refund_amount : Math.max(0, origAmt - penalty - agencyFee));

  const stmt = db.prepare(`
    INSERT INTO travel_service_returns (
      return_number, original_service_ref, service_type, service_category_name, service_item_id,
      customer_id, customer_name, passenger_name, statement, return_date, currency, exchange_rate,
      original_amount, penalty_amount, agency_refund_fee, net_refund_amount,
      supplier_penalty, supplier_refund_amount, supplier_id, supplier_name, supplier_type,
      refund_method, debit_account_code, credit_account_code, reason, notes,
      created_by_user_id, created_by_user_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    retNum,
    original_service_ref || null,
    service_type || 'general',
    service_category_name || 'مردود معاملات',
    service_item_id ? Number(service_item_id) : null,
    customer_id ? Number(customer_id) : null,
    customer_name || null,
    passenger_name || null,
    statement || `مردود/خدمة سفر مرجع ${original_service_ref || retNum}`,
    return_date || new Date().toISOString().slice(0, 10),
    currency || 'SAR',
    Number(exchange_rate || 1.0),
    origAmt,
    penalty,
    agencyFee,
    netRefund,
    Number(supplier_penalty || 0),
    Number(supplier_refund_amount || 0),
    supplier_id ? Number(supplier_id) : null,
    supplier_name || null,
    supplier_type || null,
    refund_method || 'credit_balance',
    debit_account_code || '41020',
    credit_account_code || '11100',
    reason || 'طلب العميل',
    notes || null,
    user.id,
    user.name
  );

  const returnId = info.lastInsertRowid;

  // Perform Double-Entry Accounting Journal
  try {
    const returnLines: any[] = [];
    const custAcc = getCustomerAccountCode(customer_id);
    const refundCreditAcc = refund_method === 'cash' ? '11100' : refund_method === 'bank' ? '11120' : custAcc;
    const returnDebitAcc = debit_account_code || '41020'; // حساب مردودات المبيعات والخدمات
    const retCur = currency || 'SAR';

    if (netRefund > 0) {
      returnLines.push(
        { account_code: returnDebitAcc, debit: netRefund, credit: 0, description: statement || `مردود خدمة ${original_service_ref || ''}`, currency: retCur },
        { account_code: refundCreditAcc, debit: 0, credit: netRefund, description: `تسوية رد مستحقات للعميل ${customer_name || ''} بموجب مردود ${retNum}`, currency: retCur }
      );
    }
    if (Number(supplier_refund_amount || 0) > 0 && supplier_id) {
      const suppAcc = getSupplierAccountCode(supplier_id);
      returnLines.push(
        { account_code: suppAcc, debit: 0, credit: Number(supplier_refund_amount), description: `تخفيض مستحقات المورد بموجب المردود ${retNum}`, currency: retCur },
        { account_code: "51000", debit: Number(supplier_refund_amount), credit: 0, description: `عكس تكلفة الخدمة المسترجعة من المورد`, currency: retCur }
      );
    }
    if (returnLines.length > 0) {
      const jEntryId = syncJournalEntryForSource({
        sourceType: "service_return",
        sourceId: Number(returnId),
        entryDate: return_date || new Date().toISOString().slice(0, 10),
        description: `قيد فاتورة مردود خدمة رقم ${retNum} (أصل الخدمة: ${original_service_ref || '-'})`,
        lines: returnLines,
        referenceNo: retNum,
        currency: retCur
      });
      if (jEntryId) {
        db.prepare("UPDATE travel_service_returns SET journal_entry_id = ? WHERE id = ?").run(jEntryId, returnId);
      }
    }
  } catch (err) {
    console.error("Failed to post journal entry for service return:", err);
  }

  // Update original service status to refunded / cancelled
  if (service_item_id && service_type) {
    try {
      if (service_type === "visa") {
        db.prepare("UPDATE travel_visas SET status = 'cancelled', notes = COALESCE(notes, '') || ? WHERE id = ?")
          .run(`\nتم كنسلة وإصدار مردود خدمة رقم ${retNum} بتاريخ ${return_date || new Date().toISOString().slice(0, 10)}`, service_item_id);
      } else if (service_type === "bus_ticket") {
        db.prepare("UPDATE travel_bus_bookings SET status = 'refunded', notes = COALESCE(notes, '') || ? WHERE id = ?")
          .run(` | تم إصدار مردود خدمة رقم ${retNum}`, service_item_id);
      } else if (service_type === "flight_ticket") {
        db.prepare("UPDATE travel_bookings SET status = 'refunded', notes = COALESCE(notes, '') || ? WHERE id = ?")
          .run(` | تم إصدار مردود خدمة رقم ${retNum}`, service_item_id);
      }
    } catch (e) {
      console.error("Failed to update status on refunded service item:", e);
    }
  }

  const created = db.prepare("SELECT * FROM travel_service_returns WHERE id = ?").get(returnId);
  res.status(201).json(created);
});

router.delete("/travel/service-returns/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const ret: any = db.prepare("SELECT * FROM travel_service_returns WHERE id = ?").get(req.params.id);
  if (!ret) {
    res.status(404).json({ error: "فاتورة المردود غير موجودة" });
    return;
  }

  if (ret.journal_entry_id) {
    try {
      db.prepare("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?").run(ret.journal_entry_id);
      db.prepare("DELETE FROM journal_entries WHERE id = ?").run(ret.journal_entry_id);
    } catch {}
  }

  db.prepare("DELETE FROM travel_service_returns WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// ==========================================
// DETAILED STATEMENT REPORT MATCHING IMAGE 2 (كشف الحساب والتقارير المالية للخدمات والمردودات)
// Columns: البيان | نوع الحركة | رقم الخدمة/المرجع | التاريخ | مدين | دائن | الرصيد
// ==========================================
router.get("/travel/statement-report", (req, res) => {
  const { customer_id, from_date, to_date, service_type } = req.query as any;

  const transactions: any[] = [];

  // 1. Fetch Visas as Debit entries (خدمات اضافية / معاملات جوازات)
  try {
    let vSql = `
      SELECT v.id, v.service_voucher_no, v.country, v.visa_type, v.selling_price, v.customer_currency,
             v.application_date, v.status, v.notes, v.customer_statement,
             c.id as customer_id, c.name as customer_name, p.name_ar as passenger_name
      FROM travel_visas v
      LEFT JOIN customers c ON c.id = v.customer_id
      LEFT JOIN travel_passengers p ON p.id = v.passenger_id
      WHERE 1=1
    `;
    const vParams: any[] = [];
    if (customer_id && customer_id !== "all") { vSql += ` AND v.customer_id = ?`; vParams.push(customer_id); }
    if (from_date) { vSql += ` AND v.application_date >= ?`; vParams.push(from_date); }
    if (to_date) { vSql += ` AND v.application_date <= ?`; vParams.push(to_date); }

    const visas = db.prepare(vSql).all(...vParams) as any[];
    for (const v of visas) {
      const refNo = v.service_voucher_no || `0${new Date().getFullYear()}/1921-${v.id}`;
      const desc = v.customer_statement || `مقابل /معاملة جواز تأشيرة ${v.country || ''} ${v.visa_type || ''} ${v.passenger_name ? `(${v.passenger_name})` : ''}`.trim();
      transactions.push({
        id: `visa-${v.id}`,
        raw_date: v.application_date || "2026-01-01",
        date: formatDateDisplay(v.application_date),
        statement: desc,
        category_type: "خدمات اضافية",
        reference_no: refNo,
        debit: Number(v.selling_price || 0),
        credit: 0,
        currency: v.customer_currency || "SAR",
        customer_id: v.customer_id,
        customer_name: v.customer_name || "عميل عام",
        service_type: "visa"
      });
    }
  } catch (e) {}

  // 2. Fetch Bus Bookings as Debit entries
  try {
    let bSql = `
      SELECT b.id, b.ticket_number, b.origin_city, b.destination_city, b.selling_price, b.departure_date,
             c.id as customer_id, c.name as customer_name, b.passenger_name
      FROM travel_bus_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      WHERE 1=1
    `;
    const bParams: any[] = [];
    if (customer_id && customer_id !== "all") { bSql += ` AND b.customer_id = ?`; bParams.push(customer_id); }
    if (from_date) { bSql += ` AND b.departure_date >= ?`; bParams.push(from_date); }
    if (to_date) { bSql += ` AND b.departure_date <= ?`; bParams.push(to_date); }

    const bus = db.prepare(bSql).all(...bParams) as any[];
    for (const b of bus) {
      const refNo = `0${new Date().getFullYear()}/1921-${b.id + 10}`;
      const desc = `مقابل /خدمة تذاكر سفر تذكرة سفر الى ${b.destination_city || 'مكه'}`.trim();
      transactions.push({
        id: `bus-${b.id}`,
        raw_date: b.departure_date || "2026-01-01",
        date: formatDateDisplay(b.departure_date),
        statement: desc,
        category_type: "خدمات اضافية",
        reference_no: refNo,
        debit: Number(b.selling_price || 0),
        credit: 0,
        currency: "SAR",
        customer_id: b.customer_id,
        customer_name: b.customer_name || "عميل نقدي",
        service_type: "bus_ticket"
      });
    }
  } catch (e) {}

  // 3. Fetch Service Returns as Credit entries (مردود معاملات / مردود خدمات)
  try {
    let rSql = `
      SELECT r.*, c.name as customer_official_name
      FROM travel_service_returns r
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE 1=1
    `;
    const rParams: any[] = [];
    if (customer_id && customer_id !== "all") { rSql += ` AND r.customer_id = ?`; rParams.push(customer_id); }
    if (from_date) { rSql += ` AND r.return_date >= ?`; rParams.push(from_date); }
    if (to_date) { rSql += ` AND r.return_date <= ?`; rParams.push(to_date); }

    const returns = db.prepare(rSql).all(...rParams) as any[];
    for (const r of returns) {
      transactions.push({
        id: `ret-${r.id}`,
        raw_date: r.return_date || "2026-01-01",
        date: formatDateDisplay(r.return_date),
        statement: r.statement || `مردود/خدمة تذاكر سفر`,
        category_type: r.service_category_name || "مردود معاملات",
        reference_no: r.return_number || `0${new Date().getFullYear()}/1941-${r.id}`,
        original_service_ref: r.original_service_ref,
        debit: 0,
        credit: Number(r.net_refund_amount || r.original_amount || 0),
        currency: r.currency || "SAR",
        customer_id: r.customer_id,
        customer_name: r.customer_official_name || r.customer_name || "عميل",
        service_type: r.service_type
      });
    }
  } catch (e) {}

  // Sort chronological
  transactions.sort((a, b) => new Date(a.raw_date).getTime() - new Date(b.raw_date).getTime());

  // Calculate cumulative balance
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const rowsWithBalance = transactions.map(t => {
    running += (t.debit - t.credit);
    totalDebit += t.debit;
    totalCredit += t.credit;
    return {
      ...t,
      balance: running
    };
  });

  res.json({
    transactions: rowsWithBalance,
    summary: {
      totalDebit,
      totalCredit,
      netBalance: running,
      count: rowsWithBalance.length
    }
  });
});

function formatDateDisplay(d?: string): string {
  if (!d) return "01/01/2026";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  } catch {
    return d || "";
  }
}


// ==========================================
// 10. HOTELS BOOKING MANAGEMENT (حجوزات الفنادق ونظام الطرفين)
// ==========================================
router.get("/travel/hotels", (req, res) => {
  const { customer_id, search, status, payment_status, payment_method } = req.query as any;
  let sql = `
    SELECT h.*, 
           c.name as customer_name, c.phone as customer_phone, c.customer_type,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number as passenger_passport
    FROM travel_hotels h
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND h.customer_id = ?`; params.push(customer_id); }
  if (status) { sql += ` AND h.status = ?`; params.push(status); }
  if (payment_status) { sql += ` AND h.payment_status = ?`; params.push(payment_status); }
  if (payment_method) { sql += ` AND h.payment_method = ?`; params.push(payment_method); }

  if (search) {
    sql += ` AND (
      h.booking_ref LIKE ? OR 
      h.voucher_number LIKE ? OR 
      h.hotel_name LIKE ? OR 
      h.city_country LIKE ? OR 
      h.guest_name LIKE ? OR 
      h.customer_statement LIKE ? OR 
      h.supplier_statement LIKE ? OR 
      c.name LIKE ? OR 
      p.name_ar LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s, s, s);
  }

  sql += ` ORDER BY h.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

function ensureTravelHotelsColumns() {
  try {
    const cols = (db.prepare("PRAGMA table_info(travel_hotels)").all() as any[]).map(c => c.name);
    const set = new Set(cols);
    const required: [string, string][] = [
      ["voucher_number", "TEXT"],
      ["confirmation_number", "TEXT"],
      ["hotel_db_id", "INTEGER"],
      ["country", "TEXT"],
      ["city", "TEXT"],
      ["city_country", "TEXT"],
      ["customer_name", "TEXT"],
      ["guest_name", "TEXT"],
      ["guest_phone", "TEXT"],
      ["guest_passport", "TEXT"],
      ["customer_days", "INTEGER DEFAULT 1"],
      ["supplier_days", "INTEGER DEFAULT 1"],
      ["customer_currency", "TEXT DEFAULT 'SAR'"],
      ["supplier_currency", "TEXT DEFAULT 'SAR'"],
      ["commission_currency", "TEXT DEFAULT 'SAR'"],
      ["customer_statement", "TEXT"],
      ["supplier_statement", "TEXT"],
      ["commission_statement", "TEXT"],
      ["commission", "REAL DEFAULT 0"],
      ["profit", "REAL DEFAULT 0"],
      ["rooms_count", "INTEGER DEFAULT 1"],
      ["guests_count", "INTEGER DEFAULT 1"],
      ["meal_plan", "TEXT DEFAULT 'إفطار شامل (Bed & Breakfast)'"],
      ["payment_method", "TEXT DEFAULT 'cash'"],
      ["payment_status", "TEXT DEFAULT 'paid'"],
      ["paid_amount", "REAL DEFAULT 0"],
      ["remaining_balance", "REAL DEFAULT 0"],
      ["supplier_payment_method", "TEXT DEFAULT 'credit'"],
      ["supplier_payment_status", "TEXT DEFAULT 'unpaid'"],
      ["supplier_paid_amount", "REAL DEFAULT 0"],
      ["supplier_remaining_balance", "REAL DEFAULT 0"],
      ["supplier_office_id", "INTEGER"],
      ["supplier_office_name", "TEXT"],
      ["supplier_id", "INTEGER"],
      ["supplier_name", "TEXT"],
      ["issue_date", "TEXT"]
    ];
    for (const [col, colType] of required) {
      if (!set.has(col)) {
        try {
          db.exec(`ALTER TABLE travel_hotels ADD COLUMN ${col} ${colType}`);
        } catch {}
      }
    }
  } catch (e) {
    console.error("ensureTravelHotelsColumns warning:", e);
  }
}

function formatArabicTravelError(err: any): string {
  const msg = String(err?.message || err || "");
  console.error("[Travel Arabic Error Handler]:", msg);

  if (msg.includes("has no column named")) {
    const match = msg.match(/has no column named (\w+)/);
    const col = match ? match[1] : "";
    ensureTravelHotelsColumns();
    return `تم تحديث حقل قاعدة البيانات (${col}) تلقائياً. يرجى الضغط على حفظ مرة أخرى لإتمام العملية بنجاح.`;
  }
  if (msg.includes("NOT NULL constraint failed: travel_visas.country")) {
    return "يرجى تحديد دولة وجهة التأشيرة المطلوبة.";
  }
  if (msg.includes("NOT NULL constraint failed")) {
    const match = msg.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
    const col = match ? match[2] : "";
    const colLabels: Record<string, string> = {
      country: "الدولة",
      hotel_name: "اسم الفندق",
      booking_ref: "مرجع الحجز",
      voucher_number: "رقم الفاوتشر",
      customer_id: "العميل",
      name_ar: "الاسم بالعربية"
    };
    return `يرجى استكمال الحقل الإلزامي المطلوب: (${colLabels[col] || col})`;
  }
  if (msg.includes("UNIQUE constraint failed")) {
    return "رقم المرجع أو السند مسجل مسبقاً في النظام. يرجى اختيار أو توليد رقم فريد.";
  }
  return "حدث خطأ أثناء حفظ بيانات الحجز الفندقي. يرجى مراجعة المدخلات والمحاولة مرة أخرى.";
}

router.post("/travel/hotels", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  ensureTravelHotelsColumns();

  try {
    const {
      booking_ref, voucher_number, confirmation_number,
      customer_id, customer_name, passenger_id, guest_name, guest_phone, guest_passport,
      hotel_db_id, hotel_name, country, city, city_country,
      check_in, check_out, room_type, nights, customer_days, supplier_days, rooms_count, guests_count, meal_plan,
      cost_price, selling_price, commission, profit,
      customer_currency, supplier_currency, commission_currency,
      customer_statement, supplier_statement, commission_statement,
      payment_method, payment_status, paid_amount, remaining_balance,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      supplier_office_id, supplier_office_name, supplier_id, supplier_name,
      status, issue_date, notes
    } = req.body;

    const finalHotelName = hotel_name || (hotel_db_id ? `فندق #${hotel_db_id}` : "حجز فندقي عام");

    const ref = booking_ref || `HTL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const vch = voucher_number || `VCH-${Math.floor(100000 + Math.random() * 900000)}`;
    const cost = Number(cost_price || 0);
    const sell = Number(selling_price || 0);
    const comm = Number(commission !== undefined ? commission : (sell - cost));
    const prof = Number(profit !== undefined ? profit : comm);
    const n = Number(nights || customer_days || 1);
    const cDays = Number(customer_days || n);
    const sDays = Number(supplier_days || n);
    const paid = Number(paid_amount !== undefined ? paid_amount : (payment_status === 'paid' ? sell : 0));
    const rem = Number(remaining_balance !== undefined ? remaining_balance : (sell - paid));
    const sPaid = Number(supplier_paid_amount !== undefined ? supplier_paid_amount : (supplier_payment_status === 'paid' ? cost : 0));
    const sRem = Number(supplier_remaining_balance !== undefined ? supplier_remaining_balance : (cost - sPaid));

    const stmt = db.prepare(`
      INSERT INTO travel_hotels (
        booking_ref, voucher_number, confirmation_number,
        customer_id, customer_name, passenger_id, guest_name, guest_phone, guest_passport,
        hotel_db_id, hotel_name, country, city, city_country,
        check_in, check_out, room_type, nights, customer_days, supplier_days, rooms_count, guests_count, meal_plan,
        cost_price, selling_price, commission, profit,
        customer_currency, supplier_currency, commission_currency,
        customer_statement, supplier_statement, commission_statement,
        payment_method, payment_status, paid_amount, remaining_balance,
        supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
        supplier_office_id, supplier_office_name, supplier_id, supplier_name,
        status, issue_date, notes
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const info = stmt.run(
      ref, vch, confirmation_number || null,
      customer_id || null, customer_name || null, passenger_id || null, guest_name || null, guest_phone || null, guest_passport || null,
      hotel_db_id || null, finalHotelName, country || null, city || null, city_country || `${city || ''}, ${country || ''}`,
      check_in || null, check_out || null, room_type || 'مزدوجة Double', n, cDays, sDays, Number(rooms_count || 1), Number(guests_count || 1), meal_plan || 'إفطار شامل (Bed & Breakfast)',
      cost, sell, comm, prof,
      customer_currency || 'SAR', supplier_currency || 'SAR', commission_currency || 'SAR',
      customer_statement || null, supplier_statement || null, commission_statement || null,
      payment_method || 'cash', payment_status || 'paid', paid, rem,
      supplier_payment_method || 'credit', supplier_payment_status || 'unpaid', sPaid, sRem,
      supplier_office_id || null, supplier_office_name || null, supplier_id || null, supplier_name || null,
      status || 'confirmed', issue_date || new Date().toISOString().slice(0, 10), notes || null
    );

    const newHtl = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(info.lastInsertRowid);

    // Double entry accounting journal record
    try {
      const entryDate = issue_date || new Date().toISOString().slice(0, 10);
      const desc = customer_statement || `حجز فندق ${finalHotelName} - مرجع: ${ref}`;
      const custAcc = getCustomerAccountCode(customer_id);
      const suppAcc = getSupplierAccountCode(supplier_office_id || supplier_id || hotel_db_id || finalHotelName);
      const hotelBookingCur = customer_currency || supplier_currency || 'SAR';
      const lines = buildHotelJournalLines({
        sell, cost, custPayMethod: payment_method || 'cash',
        suppPayMethod: supplier_payment_method || 'credit',
        isSuppPaidCash: isCashOrBankMethod(supplier_payment_method || 'credit'),
        custAcc, suppAcc, revenueAcc: "42001", expenseAcc: "52000",
        custCur: customer_currency || hotelBookingCur, suppCur: supplier_currency || hotelBookingCur,
        custStmt: customer_statement || `حجز فندق ${finalHotelName} - مرجع: ${ref}`,
        suppStmt: supplier_statement || `تكلفة حجز فندق ${finalHotelName} - مرجع: ${ref}`
      });

      syncJournalEntryForSource({
        sourceType: "hotel",
        sourceId: Number(info.lastInsertRowid),
        entryDate,
        description: desc,
        lines,
        referenceNo: ref,
        currency: hotelBookingCur
      });
    } catch (err) {
      console.error("Journal entry error on hotel creation:", err);
    }

    res.status(201).json(newHtl);
  } catch (err: any) {
    res.status(400).json({ error: formatArabicTravelError(err) });
  }
});

router.put("/travel/hotels/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  ensureTravelHotelsColumns();

  try {
    const {
      booking_ref, voucher_number, confirmation_number,
      customer_id, customer_name, passenger_id, guest_name, guest_phone, guest_passport,
      hotel_db_id, hotel_name, country, city, city_country,
      check_in, check_out, room_type, nights, customer_days, supplier_days, rooms_count, guests_count, meal_plan,
      cost_price, selling_price, commission, profit,
      customer_currency, supplier_currency, commission_currency,
      customer_statement, supplier_statement, commission_statement,
      payment_method, payment_status, paid_amount, remaining_balance,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      supplier_office_id, supplier_office_name, supplier_id, supplier_name,
      status, issue_date, notes
    } = req.body;

    const finalHotelName = hotel_name || (hotel_db_id ? `فندق #${hotel_db_id}` : "حجز فندقي عام");

    const cost = Number(cost_price || 0);
    const sell = Number(selling_price || 0);
    const comm = Number(commission !== undefined ? commission : (sell - cost));
    const prof = Number(profit !== undefined ? profit : comm);
    const n = Number(nights || customer_days || 1);
    const cDays = Number(customer_days || n);
    const sDays = Number(supplier_days || n);
    const paid = Number(paid_amount !== undefined ? paid_amount : (payment_status === 'paid' ? sell : 0));
    const rem = Number(remaining_balance !== undefined ? remaining_balance : (sell - paid));
    const sPaid = Number(supplier_paid_amount !== undefined ? supplier_paid_amount : (supplier_payment_status === 'paid' ? cost : 0));
    const sRem = Number(supplier_remaining_balance !== undefined ? supplier_remaining_balance : (cost - sPaid));

    db.prepare(`
      UPDATE travel_hotels SET
        booking_ref=?, voucher_number=?, confirmation_number=?,
        customer_id=?, customer_name=?, passenger_id=?, guest_name=?, guest_phone=?, guest_passport=?,
        hotel_db_id=?, hotel_name=?, country=?, city=?, city_country=?,
        check_in=?, check_out=?, room_type=?, nights=?, customer_days=?, supplier_days=?, rooms_count=?, guests_count=?, meal_plan=?,
        cost_price=?, selling_price=?, commission=?, profit=?,
        customer_currency=?, supplier_currency=?, commission_currency=?,
        customer_statement=?, supplier_statement=?, commission_statement=?,
        payment_method=?, payment_status=?, paid_amount=?, remaining_balance=?,
        supplier_payment_method=?, supplier_payment_status=?, supplier_paid_amount=?, supplier_remaining_balance=?,
        supplier_office_id=?, supplier_office_name=?, supplier_id=?, supplier_name=?,
        status=?, issue_date=?, notes=?
      WHERE id=?
    `).run(
      booking_ref, voucher_number || null, confirmation_number || null,
      customer_id || null, customer_name || null, passenger_id || null, guest_name || null, guest_phone || null, guest_passport || null,
      hotel_db_id || null, finalHotelName, country || null, city || null, city_country || `${city || ''}, ${country || ''}`,
      check_in || null, check_out || null, room_type || 'مزدوجة Double', n, cDays, sDays, Number(rooms_count || 1), Number(guests_count || 1), meal_plan || 'إفطار شامل (Bed & Breakfast)',
      cost, sell, comm, prof,
      customer_currency || 'SAR', supplier_currency || 'SAR', commission_currency || 'SAR',
      customer_statement || null, supplier_statement || null, commission_statement || null,
      payment_method || 'cash', payment_status || 'paid', paid, rem,
      supplier_payment_method || 'credit', supplier_payment_status || 'unpaid', sPaid, sRem,
      supplier_office_id || null, supplier_office_name || null, supplier_id || null, supplier_name || null,
      status || 'confirmed', issue_date || new Date().toISOString().slice(0, 10), notes || null,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(req.params.id);

    // Sync double entry journal on update
    try {
      const entryDate = issue_date || new Date().toISOString().slice(0, 10);
      const desc = customer_statement || `تعديل حجز فندق ${hotel_name || ''} - مرجع: ${booking_ref}`;
      const custAcc = getCustomerAccountCode(customer_id);
      const suppAcc = getSupplierAccountCode(supplier_office_id || supplier_id || hotel_db_id || hotel_name);
      const hotelBookingCur = supplier_currency || customer_currency || 'SAR';
      const lines = buildHotelJournalLines({
        sell, cost, custPayMethod: payment_method || 'cash',
        suppPayMethod: supplier_payment_method || 'credit',
        isSuppPaidCash: isCashOrBankMethod(supplier_payment_method || 'credit'),
        custAcc, suppAcc, revenueAcc: "42001", expenseAcc: "52000",
        custCur: customer_currency || hotelBookingCur, suppCur: supplier_currency || hotelBookingCur,
        custStmt: customer_statement || `تعديل حجز فندق ${finalHotelName} - مرجع: ${booking_ref}`,
        suppStmt: supplier_statement || `تكلفة حجز فندق ${finalHotelName} - مرجع: ${booking_ref}`
      });

      syncJournalEntryForSource({
        sourceType: "hotel",
        sourceId: Number(req.params.id),
        entryDate,
        description: desc,
        lines,
        referenceNo: booking_ref,
        currency: hotelBookingCur
      });
    } catch (err) {
      console.error("Journal entry error on hotel update:", err);
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: formatArabicTravelError(err) });
  }
});

router.delete("/travel/hotels/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    deleteDoubleEntryJournal("hotel", Number(req.params.id));
  } catch (err) {
    console.error("Error deleting hotel journal entry:", err);
  }
  db.prepare("DELETE FROM travel_hotels WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

router.post("/travel/hotels/:id/confirm", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  ensureTravelHotelsColumns();
  try {
    const current = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(req.params.id) as any;
    if (!current) { res.status(404).json({ error: "الحجز غير موجود" }); return; }
    
    const conf = current.confirmation_number || `HTL-CONF-${Math.floor(10000 + Math.random() * 90000)}`;
    db.prepare("UPDATE travel_hotels SET status = 'confirmed', confirmation_number = ? WHERE id = ?").run(conf, req.params.id);
    const updated = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: formatArabicTravelError(err) });
  }
});

router.post("/travel/hotels/:id/issue", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  ensureTravelHotelsColumns();
  try {
    const current = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(req.params.id) as any;
    if (!current) { res.status(404).json({ error: "الحجز غير موجود" }); return; }
    
    const vch = current.voucher_number || `VCH-${Math.floor(100000 + Math.random() * 900000)}`;
    const conf = current.confirmation_number || `HTL-CONF-${Math.floor(10000 + Math.random() * 90000)}`;
    const issueDate = current.issue_date || new Date().toISOString().slice(0, 10);
    db.prepare("UPDATE travel_hotels SET status = 'issued', voucher_number = ?, confirmation_number = ?, issue_date = ? WHERE id = ?")
      .run(vch, conf, issueDate, req.params.id);
    const updated = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: formatArabicTravelError(err) });
  }
});


// ==========================================
// 11. CONTACT LOGS (سجل التواصل)
// ==========================================
router.get("/travel/contact-logs", (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) { res.json([]); return; }
  const rows = db.prepare("SELECT * FROM travel_contact_logs WHERE customer_id = ? ORDER BY id DESC").all(customer_id);
  res.json(rows);
});

router.post("/travel/contact-logs", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { customer_id, contact_type, summary } = req.body;
  if (!customer_id || !summary) {
    res.status(400).json({ error: "العميل والملخص مطلوبان" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_contact_logs (customer_id, contact_type, summary, user_name)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(customer_id, contact_type || 'اتصال', summary, user.name);
  const newLog = db.prepare("SELECT * FROM travel_contact_logs WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newLog);
});


// ==========================================
// 12. DETAILED CLIENT PROFILE (ملف العميل الموحد)
// ==========================================
router.get("/travel/customer-profile/:id", (req, res) => {
  const custId = req.params.id;

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(custId) as any;
  if (!customer) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }

  const isAgency = customer.affiliation_type === 'agency';
  let totalSales = 0;
  let totalPaid = 0;
  let dueAmount = 0;

  // Fetch POS & Warehouse orders for this customer
  const posOrders = db.prepare(`
    SELECT o.*, o.created_at as order_date
    FROM orders o
    WHERE o.customer_id = ? ORDER BY o.id DESC
  `).all(custId);

  // Fetch Receipt Vouchers for this customer
  const receiptVouchers = db.prepare(`
    SELECT v.*
    FROM vouchers v
    WHERE v.customer_id = ? ORDER BY v.id DESC
  `).all(custId);

  if (!isAgency) {
    const bkSales = db.prepare("SELECT COALESCE(SUM(selling_price), 0) as s, COALESCE(SUM(paid_amount), 0) as p FROM travel_bookings WHERE customer_id = ?").get(custId) as any;
    const vsSales = db.prepare("SELECT COALESCE(SUM(selling_price), 0) as s, COALESCE(SUM(paid_amount), 0) as p FROM travel_visas WHERE customer_id = ?").get(custId) as any;
    const htSales = db.prepare("SELECT COALESCE(SUM(selling_price), 0) as s, COALESCE(SUM(paid_amount), 0) as p FROM travel_hotels WHERE customer_id = ?").get(custId) as any;
    const posSales = db.prepare("SELECT COALESCE(SUM(total), 0) as s, COALESCE(SUM(paid_amount), 0) as p FROM orders WHERE customer_id = ? AND status != 'cancelled'").get(custId) as any;
    
    totalSales = (bkSales?.s || 0) + (vsSales?.s || 0) + (htSales?.s || 0) + (posSales?.s || 0);
    totalPaid = (bkSales?.p || 0) + (vsSales?.p || 0) + (htSales?.p || 0) + (posSales?.p || 0);
    dueAmount = totalSales - totalPaid;
  }

  const passengers = db.prepare("SELECT * FROM travel_passengers WHERE customer_id = ? ORDER BY id DESC").all(custId);
  const bookings = db.prepare(`
    SELECT b.*, p.name_ar as passenger_name
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.customer_id = ? ORDER BY b.id DESC
  `).all(custId);

  const visas = db.prepare(`
    SELECT v.*, p.name_ar as passenger_name
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    WHERE v.customer_id = ? ORDER BY v.id DESC
  `).all(custId);

  const hotels = db.prepare(`
    SELECT h.*, p.name_ar as passenger_name
    FROM travel_hotels h
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    WHERE h.customer_id = ? ORDER BY h.id DESC
  `).all(custId);

  const documents = db.prepare(`
    SELECT d.*, p.name_ar as passenger_name
    FROM travel_documents d
    LEFT JOIN travel_passengers p ON p.id = d.passenger_id
    WHERE d.customer_id = ? ORDER BY d.id DESC
  `).all(custId);

  const contactLogs = db.prepare("SELECT * FROM travel_contact_logs WHERE customer_id = ? ORDER BY id DESC").all(custId);

  res.json({
    customer,
    passengers,
    bookings,
    visas,
    hotels,
    documents,
    contactLogs,
    posOrders,
    receiptVouchers,
    summary: {
      totalBookingsCount: bookings.length,
      totalVisasCount: visas.length,
      totalHotelsCount: hotels.length,
      totalOrdersCount: posOrders.length,
      totalReceiptsCount: receiptVouchers.length,
      totalSales,
      paidAmount: totalPaid,
      dueAmount,
      isAgencyAffiliated: isAgency,
      officeAccountCode: customer.account_code
    }
  });
});


// ==========================================
// 7. COMPREHENSIVE TRAVEL DASHBOARD KPIS & CHARTS
// ==========================================
router.get("/travel/dashboard-stats", (_req, res) => {
  const today = getBusinessDate("travel");
  const monthStart = today.slice(0, 7) + "-01";

  // Today sales
  const todaySalesRow = db.prepare(`
    SELECT COALESCE(SUM(selling_price), 0) as total, COALESCE(SUM(commission), 0) as comm, COUNT(*) as cnt
    FROM travel_bookings WHERE issue_date = ?
  `).get(today) as any;

  // Month sales
  const monthSalesRow = db.prepare(`
    SELECT COALESCE(SUM(selling_price), 0) as total, COALESCE(SUM(commission), 0) as comm, COUNT(*) as cnt
    FROM travel_bookings WHERE issue_date >= ?
  `).get(monthStart) as any;

  // Expenses
  const monthExpRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE expense_date >= ?
  `).get(monthStart) as any;

  // Safe and Bank Balances
  const safes = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM safes WHERE active=1").get() as any;

  // Travel & Service Counts
  const ticketCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bookings WHERE service_type='flight' AND status='issued'").get() as any;
  const cancelledTicketCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bookings WHERE status='cancelled'").get() as any;
  const visaCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_visas").get() as any;
  const hotelCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_hotels").get() as any;
  const customerCount = db.prepare("SELECT COUNT(*) as cnt FROM customers").get() as any;
  const passengerCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_passengers").get() as any;
  let busCount = { cnt: 0 };
  try {
    busCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bus_bookings").get() as any;
  } catch (e) {
    try {
      busCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bookings WHERE service_type='bus'").get() as any;
    } catch (e2) {}
  }
  let refundCount = { cnt: 0 };
  try {
    refundCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_service_returns").get() as any;
  } catch (e) {
    try {
      refundCount = db.prepare("SELECT COUNT(*) as cnt FROM returns").get() as any;
    } catch (e2) {}
  }

  // Due from customers & Due to suppliers
  const customerDebts = db.prepare("SELECT COALESCE(SUM(selling_price), 0) as total FROM travel_bookings WHERE payment_status='unpaid' OR payment_status='partial'").get() as any;

  // Recharts: Sales by Airline
  const airlineStats = db.prepare(`
    SELECT airline_supplier as name, COUNT(*) as count, SUM(selling_price) as value
    FROM travel_bookings
    WHERE airline_supplier IS NOT NULL AND airline_supplier != ''
    GROUP BY airline_supplier ORDER BY value DESC LIMIT 6
  `).all();

  // Recharts: Top Destinations
  const destStats = db.prepare(`
    SELECT destination_city as name, COUNT(*) as count
    FROM travel_bookings
    WHERE destination_city IS NOT NULL AND destination_city != ''
    GROUP BY destination_city ORDER BY count DESC LIMIT 6
  `).all();

  // Recharts: Sales by Service Type
  const serviceTypeStats = db.prepare(`
    SELECT service_type as name, SUM(selling_price) as value, COUNT(*) as count
    FROM travel_bookings
    GROUP BY service_type
  `).all();

  // Smart Alerts
  // 1. Expiring Passports (within 6 months)
  const expiringPassports = db.prepare(`
    SELECT id, name_ar, passport_number, passport_expiry_date
    FROM travel_passengers
    WHERE passport_expiry_date IS NOT NULL AND passport_expiry_date != '' AND passport_expiry_date <= date('now', '+6 months')
    LIMIT 10
  `).all();

  // 2. Visas Under Process
  const pendingVisas = db.prepare(`
    SELECT v.*, c.name as customer_name, p.name_ar as passenger_name
    FROM travel_visas v
    LEFT JOIN customers c ON c.id = v.customer_id
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    WHERE v.status = 'under_process' OR v.status = 'pending_docs'
  `).all();

  // 3. Upcoming Flight Departures (Next 7 days)
  const upcomingFlights = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.departure_date >= date('now') AND b.departure_date <= date('now', '+7 days')
  `).all();

  res.json({
    kpis: {
      todaySales: todaySalesRow?.total || 0,
      todayBookings: todaySalesRow?.cnt || 0,
      monthSales: monthSalesRow?.total || 0,
      monthCommission: monthSalesRow?.comm || 0,
      netProfit: (monthSalesRow?.comm || 0) - (monthExpRow?.total || 0),
      monthExpenses: monthExpRow?.total || 0,
      safeBalance: safes?.total || 0,
      issuedTickets: ticketCount?.cnt || 0,
      cancelledTickets: cancelledTicketCount?.cnt || 0,
      visaTransactions: visaCount?.cnt || 0,
      hotelBookings: hotelCount?.cnt || 0,
      customersCount: customerCount?.cnt || 0,
      passengersCount: passengerCount?.cnt || 0,
      busBookingsCount: busCount?.cnt || 0,
      refundsCount: refundCount?.cnt || 0,
      customerDebts: customerDebts?.total || 0
    },
    charts: {
      airlineStats,
      destStats,
      serviceTypeStats
    },
    alerts: {
      expiringPassports,
      pendingVisas,
      upcomingFlights
    }
  });
});

// ==========================================
// 14. TRAVEL PARTNER & DELEGATED OFFICES (المكاتب المفوضة والوكلاء الشركاء)
// ==========================================
router.get("/travel/partner-offices", (req, res) => {
  const { search, office_type, active } = req.query;
  let sql = `SELECT * FROM travel_partner_offices WHERE 1=1`;
  const params: any[] = [];
  if (active !== undefined && active !== "all") {
    sql += ` AND active = ?`;
    params.push(active === "true" || active === "1" ? 1 : 0);
  }
  if (office_type && office_type !== "all") {
    sql += ` AND office_type = ?`;
    params.push(office_type);
  }
  if (search) {
    sql += ` AND (name LIKE ? OR name_en LIKE ? OR phone LIKE ? OR city LIKE ? OR contact_person LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  sql += ` ORDER BY id ASC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/partner-offices", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name, name_en, office_type, city, phone, email, contact_person, commission_rate, notes } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: "اسم المكتب مطلوب" });
    return;
  }

  const cleanName = name.trim();

  // Create account in Chart of Accounts under 11200 (الذمم المدينة - مكاتب ووكلاء وشركاء)
  const getNextSubCode = () => {
    const rows = db.prepare("SELECT code FROM accounts WHERE code LIKE '112%' AND code != '11200'").all() as { code: string }[];
    let maxNum = 11200;
    for (const r of rows) {
      const num = parseInt(r.code, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
    let cand = maxNum + 1;
    while (db.prepare("SELECT id FROM accounts WHERE code = ?").get(String(cand))) {
      cand++;
    }
    return String(cand);
  };

  const accountCode = getNextSubCode();
  try {
    db.prepare(`
      INSERT INTO accounts (code, name, type, parent_code, balance, active, is_parent, auto_add, level)
      VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
    `).run(accountCode, cleanName);
  } catch (err) {
    console.error("Error creating account for partner office:", err);
  }

  const stmt = db.prepare(`
    INSERT INTO travel_partner_offices (name, name_en, office_type, city, phone, email, contact_person, commission_rate, notes, account_code, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const info = stmt.run(
    cleanName, name_en || null, office_type || 'partner_agency', city || null, phone || null, email || null,
    contact_person || null, Number(commission_rate || 0), notes || null, accountCode
  );

  const created = db.prepare("SELECT * FROM travel_partner_offices WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put("/travel/partner-offices/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name, name_en, office_type, city, phone, email, contact_person, commission_rate, notes, active } = req.body;
  const cleanName = name ? name.trim() : null;

  const existingOff = db.prepare("SELECT * FROM travel_partner_offices WHERE id = ?").get(req.params.id) as any;
  if (existingOff && existingOff.account_code && cleanName) {
    try {
      db.prepare("UPDATE accounts SET name = ? WHERE code = ?").run(cleanName, existingOff.account_code);
    } catch {}
  }

  db.prepare(`
    UPDATE travel_partner_offices SET
      name=?, name_en=?, office_type=?, city=?, phone=?, email=?, contact_person=?, commission_rate=?, notes=?, active=?
    WHERE id=?
  `).run(
    cleanName || name, name_en || null, office_type || 'partner_agency', city || null, phone || null, email || null,
    contact_person || null, Number(commission_rate || 0), notes || null, active !== undefined ? (active ? 1 : 0) : 1,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_partner_offices WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.delete("/travel/partner-offices/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_partner_offices WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
