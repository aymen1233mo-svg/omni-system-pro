import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

try {
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_1 TEXT DEFAULT 'معمل عبدالاسلام للخبز العربي'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_2 TEXT DEFAULT 'عدن/المعلا'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_3 TEXT DEFAULT '774106282'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_1 TEXT DEFAULT 'قيس'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_2 TEXT DEFAULT 'عدن/المعلا'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_3 TEXT DEFAULT '771845734'").run();
} catch (e) {
  // Ignore if columns already exist
}

const extraCols = [
  "ALTER TABLE document_print_settings ADD COLUMN address TEXT DEFAULT ''",
  "ALTER TABLE document_print_settings ADD COLUMN phone TEXT DEFAULT ''",
  "ALTER TABLE document_print_settings ADD COLUMN tax_number TEXT DEFAULT ''",
  "ALTER TABLE document_print_settings ADD COLUMN supplier_header_text TEXT DEFAULT 'كشف حساب مورد معتمد'",
  "ALTER TABLE document_print_settings ADD COLUMN supplier_footer_text TEXT DEFAULT 'الرصيد المبين أعلاه خاضع للمطابقة والتدقيق المحاسبي.'",
  "ALTER TABLE document_print_settings ADD COLUMN voucher_journal_title TEXT DEFAULT 'سند قيد يومية'",
  "ALTER TABLE document_print_settings ADD COLUMN invoice_header_text TEXT DEFAULT 'فاتورة مبيعات ضريبية'",
  "ALTER TABLE document_print_settings ADD COLUMN invoice_footer_text TEXT DEFAULT 'شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً'",
  "ALTER TABLE document_print_settings ADD COLUMN show_logo INTEGER DEFAULT 1",
  "ALTER TABLE document_print_settings ADD COLUMN show_tax_number INTEGER DEFAULT 1",
  "ALTER TABLE document_print_settings ADD COLUMN show_branch_info INTEGER DEFAULT 1",
  "ALTER TABLE document_print_settings ADD COLUMN show_signature_boxes INTEGER DEFAULT 1",
  "ALTER TABLE document_print_settings ADD COLUMN show_stamp_box INTEGER DEFAULT 1",
];
for (const sql of extraCols) {
  try { db.prepare(sql).run(); } catch {}
}

function normalizeLogo(logoUrl?: string | null, fallbackLogo?: string | null): string {
  const raw = (logoUrl ?? "").trim();
  if (raw === "/omnisystem_pro_logo_1784250216808.png" || raw === "/assets/images/omnisystem_pro_logo_1784250216808.png") {
    const fb = (fallbackLogo ?? "").trim();
    if (fb && fb !== "/omnisystem_pro_logo_1784250216808.png" && fb !== "/assets/images/omnisystem_pro_logo_1784250216808.png") {
      return fb;
    }
    return "/omnisystem-logo.png";
  }
  return raw;
}

function getGenSettingsMap(): Record<string, string> {
  try {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch {
    return {};
  }
}

function buildDocSettingsResponse(row: any) {
  const gen = getGenSettingsMap();
  const logoUrl = normalizeLogo(row.logo_url !== undefined ? row.logo_url : "/omnisystem-logo.png", gen.logoUrl);
  const companyName = row.company_name || gen.businessName || "OmniSystem Pro";
  const companySubtitle = row.company_subtitle ?? "نظام نقاط البيع وإدارة الموارد";
  const address = row.address || gen.address || gen.businessAddress || row.header_right_text_2 || "";
  const phone = row.phone || gen.phone || gen.businessPhone || row.header_right_text_3 || "";
  const taxNumber = row.tax_number || gen.taxNumber || "";
  const customerHeaderText = row.customer_header_text ?? "كشف حساب عميل معتمد";
  const customerFooterText = row.customer_footer_text ?? "شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً";
  const supplierHeaderText = row.supplier_header_text || "كشف حساب مورد معتمد";
  const supplierFooterText = row.supplier_footer_text || customerFooterText || "الرصيد المبين أعلاه خاضع للمطابقة والتدقيق المحاسبي.";
  const employeeHeaderText = row.employee_header_text ?? "كشف حساب ومسير رواتب موظف";
  const employeeFooterText = row.employee_footer_text ?? "إدارة الموارد البشرية - التوقيع والاعتماد";
  const voucherReceiptTitle = row.voucher_receipt_title ?? "سند قبض";
  const voucherPaymentTitle = row.voucher_payment_title ?? "سند صرف";
  const voucherJournalTitle = row.voucher_journal_title || "سند قيد يومية";
  const voucherFooterText = row.voucher_footer_text ?? "المحاسب _______ المدير _______ المستلم _______";
  const reportHeaderText = row.report_header_text ?? "تقرير عام شامل";
  const reportFooterText = row.report_footer_text ?? "طبع بواسطة نظام OmniSystem Pro";
  const invoiceHeaderText = row.invoice_header_text || "فاتورة مبيعات ضريبية";
  const invoiceFooterText = row.invoice_footer_text || gen.receiptMessage || reportFooterText || "شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً";
  const accentColor = row.accent_color || "#2563eb";
  const headerRightText1 = row.header_right_text_1 ?? "";
  const headerRightText2 = row.header_right_text_2 ?? "";
  const headerRightText3 = row.header_right_text_3 ?? "";
  const headerLeftText1 = row.header_left_text_1 ?? "";
  const headerLeftText2 = row.header_left_text_2 ?? "";
  const headerLeftText3 = row.header_left_text_3 ?? "";
  const showLogo = row.show_logo === undefined || row.show_logo === null ? Boolean(logoUrl) : Boolean(row.show_logo);
  const showTaxNumber = row.show_tax_number === undefined || row.show_tax_number === null ? true : Boolean(row.show_tax_number);
  const showBranchInfo = row.show_branch_info === undefined || row.show_branch_info === null ? true : Boolean(row.show_branch_info);
  const showSignatureBoxes = row.show_signature_boxes === undefined || row.show_signature_boxes === null ? true : Boolean(row.show_signature_boxes);
  const showStampBox = row.show_stamp_box === undefined || row.show_stamp_box === null ? true : Boolean(row.show_stamp_box);

  return {
    companyName,
    companySubtitle,
    address,
    phone,
    taxNumber,
    logoUrl,
    customerHeaderText,
    customerFooterText,
    supplierHeaderText,
    supplierFooterText,
    employeeHeaderText,
    employeeFooterText,
    voucherReceiptTitle,
    voucherPaymentTitle,
    voucherJournalTitle,
    voucherFooterText,
    reportHeaderText,
    reportFooterText,
    invoiceHeaderText,
    invoiceFooterText,
    accentColor,
    headerRightText1,
    headerRightText2,
    headerRightText3,
    headerLeftText1,
    headerLeftText2,
    headerLeftText3,
    showLogo,
    showTaxNumber,
    showBranchInfo,
    showSignatureBoxes,
    showStampBox,
    // snake_case aliases for full compatibility with all components
    company_name: companyName,
    company_subtitle: companySubtitle,
    tax_number: taxNumber,
    logo_url: logoUrl,
    customer_header_text: customerHeaderText,
    customer_footer_text: customerFooterText,
    supplier_header_text: supplierHeaderText,
    supplier_footer_text: supplierFooterText,
    employee_header_text: employeeHeaderText,
    employee_footer_text: employeeFooterText,
    voucher_receipt_title: voucherReceiptTitle,
    voucher_payment_title: voucherPaymentTitle,
    voucher_journal_title: voucherJournalTitle,
    voucher_footer_text: voucherFooterText,
    report_header_text: reportHeaderText,
    report_footer_text: reportFooterText,
    invoice_header_text: invoiceHeaderText,
    invoice_footer_text: invoiceFooterText,
    accent_color: accentColor,
    header_right_text_1: headerRightText1,
    header_right_text_2: headerRightText2,
    header_right_text_3: headerRightText3,
    header_left_text_1: headerLeftText1,
    header_left_text_2: headerLeftText2,
    header_left_text_3: headerLeftText3,
    header_right_text1: headerRightText1,
    header_right_text2: headerRightText2,
    header_right_text3: headerRightText3,
    header_left_text1: headerLeftText1,
    header_left_text2: headerLeftText2,
    header_left_text3: headerLeftText3,
    show_logo: showLogo ? 1 : 0,
    show_tax_number: showTaxNumber ? 1 : 0,
    show_branch_info: showBranchInfo ? 1 : 0,
    show_signature_boxes: showSignatureBoxes ? 1 : 0,
    show_stamp_box: showStampBox ? 1 : 0,
  };
}

router.get("/document-print-settings", (_req, res) => {
  let row = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get() as any;
  if (!row) {
    db.prepare(`
      INSERT OR IGNORE INTO document_print_settings (
        id, company_name, company_subtitle, logo_url,
        customer_header_text, customer_footer_text,
        employee_header_text, employee_footer_text,
        voucher_receipt_title, voucher_payment_title, voucher_footer_text,
        report_header_text, report_footer_text, accent_color,
        header_right_text_1, header_right_text_2, header_right_text_3,
        header_left_text_1, header_left_text_2, header_left_text_3
      ) VALUES (1, 'OmniSystem Pro', 'نظام نقاط البيع وإدارة الموارد', '/omnisystem-logo.png', 'كشف حساب عميل معتمد', 'شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً', 'كشف حساب ومسير رواتب موظف', 'إدارة الموارد البشرية - التوقيع والاعتماد', 'سند قبض', 'سند صرف', 'المحاسب _______ المدير _______ المستلم _______', 'تقرير عام شامل', 'طبع بواسطة نظام OmniSystem Pro', '#2563eb', 'معمل عبدالاسلام للخبز العربي', 'عدن/المعلا', '774106282', 'قيس', 'عدن/المعلا', '771845734')
    `).run();
    row = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get();
  }

  if (row?.logo_url === "/omnisystem_pro_logo_1784250216808.png" || row?.logo_url === "/assets/images/omnisystem_pro_logo_1784250216808.png") {
    try {
      db.prepare("UPDATE document_print_settings SET logo_url = '/omnisystem-logo.png' WHERE id = 1").run();
      row.logo_url = "/omnisystem-logo.png";
    } catch {}
  }

  res.json(buildDocSettingsResponse(row));
});

router.put("/document-print-settings", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "يرجى تسجيل الدخول لتعديل إعدادات الطباعة" });
      return;
    }

    const b = req.body ?? {};
    const currentRow = (db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get() as any) || {};
    const current = buildDocSettingsResponse(currentRow);

    const companyName = b.companyName ?? b.company_name ?? current.companyName;
    const companySubtitle = b.companySubtitle ?? b.company_subtitle ?? current.companySubtitle;
    const address = b.address ?? current.address;
    const phone = b.phone ?? current.phone;
    const taxNumber = b.taxNumber ?? b.tax_number ?? current.taxNumber;
    const rawLogo = b.logoUrl !== undefined ? b.logoUrl : (b.logo_url !== undefined ? b.logo_url : current.logoUrl);
    const logoUrl = rawLogo === "" ? "" : normalizeLogo(rawLogo, current.logoUrl);

    const customerHeaderText = b.customerHeaderText ?? b.customer_header_text ?? current.customerHeaderText;
    const customerFooterText = b.customerFooterText ?? b.customer_footer_text ?? current.customerFooterText;
    const supplierHeaderText = b.supplierHeaderText ?? b.supplier_header_text ?? current.supplierHeaderText;
    const supplierFooterText = b.supplierFooterText ?? b.supplier_footer_text ?? current.supplierFooterText;
    const employeeHeaderText = b.employeeHeaderText ?? b.employee_header_text ?? current.employeeHeaderText;
    const employeeFooterText = b.employeeFooterText ?? b.employee_footer_text ?? current.employeeFooterText;
    const voucherReceiptTitle = b.voucherReceiptTitle ?? b.voucher_receipt_title ?? current.voucherReceiptTitle;
    const voucherPaymentTitle = b.voucherPaymentTitle ?? b.voucher_payment_title ?? current.voucherPaymentTitle;
    const voucherJournalTitle = b.voucherJournalTitle ?? b.voucher_journal_title ?? current.voucherJournalTitle;
    const voucherFooterText = b.voucherFooterText ?? b.voucher_footer_text ?? current.voucherFooterText;
    const reportHeaderText = b.reportHeaderText ?? b.report_header_text ?? current.reportHeaderText;
    const reportFooterText = b.reportFooterText ?? b.report_footer_text ?? current.reportFooterText;
    const invoiceHeaderText = b.invoiceHeaderText ?? b.invoice_header_text ?? current.invoiceHeaderText;
    const invoiceFooterText = b.invoiceFooterText ?? b.invoice_footer_text ?? current.invoiceFooterText;
    const accentColor = b.accentColor ?? b.accent_color ?? current.accentColor;

    const headerRightText1 = b.headerRightText1 ?? b.header_right_text_1 ?? b.header_right_text1 ?? current.headerRightText1;
    const headerRightText2 = b.headerRightText2 ?? b.header_right_text_2 ?? b.header_right_text2 ?? current.headerRightText2;
    const headerRightText3 = b.headerRightText3 ?? b.header_right_text_3 ?? b.header_right_text3 ?? current.headerRightText3;
    const headerLeftText1 = b.headerLeftText1 ?? b.header_left_text_1 ?? b.header_left_text1 ?? current.headerLeftText1;
    const headerLeftText2 = b.headerLeftText2 ?? b.header_left_text_2 ?? b.header_left_text2 ?? current.headerLeftText2;
    const headerLeftText3 = b.headerLeftText3 ?? b.header_left_text_3 ?? b.header_left_text3 ?? current.headerLeftText3;

    const showLogo = (b.showLogo ?? b.show_logo ?? (logoUrl ? 1 : 0)) ? 1 : 0;
    const showTaxNumber = (b.showTaxNumber ?? b.show_tax_number ?? current.showTaxNumber) ? 1 : 0;
    const showBranchInfo = (b.showBranchInfo ?? b.show_branch_info ?? current.showBranchInfo) ? 1 : 0;
    const showSignatureBoxes = (b.showSignatureBoxes ?? b.show_signature_boxes ?? current.showSignatureBoxes) ? 1 : 0;
    const showStampBox = (b.showStampBox ?? b.show_stamp_box ?? current.showStampBox) ? 1 : 0;

    const updateStmt = db.prepare(`
      UPDATE document_print_settings SET
        company_name = ?,
        company_subtitle = ?,
        address = ?,
        phone = ?,
        tax_number = ?,
        logo_url = ?,
        customer_header_text = ?,
        customer_footer_text = ?,
        supplier_header_text = ?,
        supplier_footer_text = ?,
        employee_header_text = ?,
        employee_footer_text = ?,
        voucher_receipt_title = ?,
        voucher_payment_title = ?,
        voucher_journal_title = ?,
        voucher_footer_text = ?,
        report_header_text = ?,
        report_footer_text = ?,
        invoice_header_text = ?,
        invoice_footer_text = ?,
        accent_color = ?,
        header_right_text_1 = ?,
        header_right_text_2 = ?,
        header_right_text_3 = ?,
        header_left_text_1 = ?,
        header_left_text_2 = ?,
        header_left_text_3 = ?,
        show_logo = ?,
        show_tax_number = ?,
        show_branch_info = ?,
        show_signature_boxes = ?,
        show_stamp_box = ?
      WHERE id = 1
    `);

    updateStmt.run(
      companyName || "OmniSystem Pro",
      companySubtitle || "",
      address || "",
      phone || "",
      taxNumber || "",
      logoUrl ?? "",
      customerHeaderText || "",
      customerFooterText || "",
      supplierHeaderText || "",
      supplierFooterText || "",
      employeeHeaderText || "",
      employeeFooterText || "",
      voucherReceiptTitle || "سند قبض",
      voucherPaymentTitle || "سند صرف",
      voucherJournalTitle || "سند قيد يومية",
      voucherFooterText || "",
      reportHeaderText || "",
      reportFooterText || "",
      invoiceHeaderText || "فاتورة مبيعات ضريبية",
      invoiceFooterText || "",
      accentColor || "#2563eb",
      headerRightText1 || "",
      headerRightText2 || "",
      headerRightText3 || "",
      headerLeftText1 || "",
      headerLeftText2 || "",
      headerLeftText3 || "",
      showLogo,
      showTaxNumber,
      showBranchInfo,
      showSignatureBoxes,
      showStampBox
    );

    try {
      if (logoUrl !== undefined) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('logoUrl', ?)").run(String(logoUrl));
      }
      if (companyName) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('businessName', ?)").run(String(companyName));
      }
      if (address) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('address', ?)").run(String(address));
      }
      if (phone) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('phone', ?)").run(String(phone));
      }
      if (taxNumber) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('taxNumber', ?)").run(String(taxNumber));
      }
    } catch (e) {
      console.error("Error syncing print settings to settings table:", e);
    }

    const row = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get() as any;
    logAudit(user.id, user.name, "تعديل إعدادات الطباعة والوثائق", "تم تحديث الهوية البصرية والنصوص بنجاح");

    res.json(buildDocSettingsResponse(row));
  } catch (error: any) {
    console.error("Critical error in document-print-settings PUT:", error);
    res.status(500).json({ 
      error: "حدث خطأ في الخادم أثناء حفظ الإعدادات", 
      details: error.message 
    });
  }
});

export default router;
