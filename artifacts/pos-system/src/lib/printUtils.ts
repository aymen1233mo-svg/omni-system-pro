import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { tafqeet } from "./tafqeet";

let cachedDocSettings: any = null;
let cachedGenSettings: any = null;

function normalizeLogoUrl(url?: string | null, fallback?: string | null): string {
  const raw = (url ?? "").trim();
  if (raw === "/omnisystem_pro_logo_1784250216808.png" || raw === "/assets/images/omnisystem_pro_logo_1784250216808.png") {
    const fb = (fallback ?? "").trim();
    if (fb && fb !== "/omnisystem_pro_logo_1784250216808.png" && fb !== "/assets/images/omnisystem_pro_logo_1784250216808.png") {
      return fb;
    }
    return "/omnisystem-logo.png";
  }
  return raw;
}

if (typeof window !== "undefined") {
  const refreshDocPrintCache = () => {
    fetch("/api/document-print-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !d.error) {
          cachedDocSettings = d;
          try {
            localStorage.setItem("pos_doc_print_settings", JSON.stringify(d));
          } catch {}
        }
      })
      .catch(() => {});

    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !d.error) {
          cachedGenSettings = d;
          try {
            localStorage.setItem("pos_system_settings_v1", JSON.stringify(d));
          } catch {}
        }
      })
      .catch(() => {});
  };

  setTimeout(refreshDocPrintCache, 50);
  window.addEventListener("doc-print-settings-updated", ((e: CustomEvent) => {
    if (e.detail) {
      cachedDocSettings = e.detail;
      try {
        localStorage.setItem("pos_doc_print_settings", JSON.stringify(e.detail));
      } catch {}
    } else {
      refreshDocPrintCache();
    }
  }) as EventListener);
}

export function getEffectiveDocPrintSettings(passed?: any): any {
  let lsDoc: any = {};
  let lsGen: any = {};
  if (typeof window !== "undefined") {
    try {
      const rawDoc = localStorage.getItem("pos_doc_print_settings");
      if (rawDoc) lsDoc = JSON.parse(rawDoc);
    } catch {}
    try {
      const rawGen = localStorage.getItem("pos_system_settings_v1");
      if (rawGen) lsGen = JSON.parse(rawGen);
    } catch {}
  }

  const gen = { ...(cachedGenSettings || {}), ...lsGen };
  const doc = { ...(cachedDocSettings || {}), ...lsDoc, ...(passed || {}) };

  const companyName =
    doc.companyName || doc.company_name || gen.businessName || "OmniSystem Pro";
  const companySubtitle =
    doc.companySubtitle ?? doc.company_subtitle ?? "نظام نقاط البيع وإدارة الموارد";
  const headerRightText1 =
    doc.headerRightText1 ?? doc.header_right_text_1 ?? doc.header_right_text1 ?? companyName;
  const headerRightText2 =
    doc.headerRightText2 ?? doc.header_right_text_2 ?? doc.header_right_text2 ?? doc.address ?? gen.address ?? "";
  const headerRightText3 =
    doc.headerRightText3 ?? doc.header_right_text_3 ?? doc.header_right_text3 ?? doc.phone ?? gen.phone ?? "";

  const headerLeftText1 =
    doc.headerLeftText1 ?? doc.header_left_text_1 ?? doc.header_left_text1 ?? companyName;
  const headerLeftText2 =
    doc.headerLeftText2 ?? doc.header_left_text_2 ?? doc.header_left_text2 ?? "";
  const headerLeftText3 =
    doc.headerLeftText3 ?? doc.header_left_text_3 ?? doc.header_left_text3 ?? "";

  const address = doc.address || gen.address || headerRightText2 || "";
  const phone = doc.phone || gen.phone || headerRightText3 || "";
  const taxNumber = doc.taxNumber || doc.tax_number || gen.taxNumber || "";

  const rawLogo =
    doc.logoUrl !== undefined
      ? doc.logoUrl
      : doc.logo_url !== undefined
      ? doc.logo_url
      : gen.logoUrl !== undefined
      ? gen.logoUrl
      : "/omnisystem-logo.png";
  const logoUrl = rawLogo === "" ? "" : normalizeLogoUrl(rawLogo, gen.logoUrl);
  const showLogo =
    doc.showLogo !== undefined
      ? Boolean(doc.showLogo)
      : doc.show_logo !== undefined
      ? Boolean(doc.show_logo)
      : doc.printLogo !== undefined
      ? doc.printLogo !== "false" && doc.printLogo !== false
      : Boolean(logoUrl);

  const showTaxNumber =
    doc.showTaxNumber !== undefined
      ? Boolean(doc.showTaxNumber)
      : doc.show_tax_number !== undefined
      ? Boolean(doc.show_tax_number)
      : true;
  const showBranchInfo =
    doc.showBranchInfo !== undefined
      ? Boolean(doc.showBranchInfo)
      : doc.show_branch_info !== undefined
      ? Boolean(doc.show_branch_info)
      : true;
  const showSignatureBoxes =
    doc.showSignatureBoxes !== undefined
      ? Boolean(doc.showSignatureBoxes)
      : doc.show_signature_boxes !== undefined
      ? Boolean(doc.show_signature_boxes)
      : true;
  const showStampBox =
    doc.showStampBox !== undefined
      ? Boolean(doc.showStampBox)
      : doc.show_stamp_box !== undefined
      ? Boolean(doc.show_stamp_box)
      : true;

  const accentColor = doc.accentColor || doc.accent_color || "#2563eb";
  const customerHeaderText =
    doc.customerHeaderText ?? doc.customer_header_text ?? "كشف حساب عميل معتمد";
  const customerFooterText =
    doc.customerFooterText ??
    doc.customer_footer_text ??
    "شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً";
  const supplierHeaderText =
    doc.supplierHeaderText ?? doc.supplier_header_text ?? "كشف حساب مورد معتمد";
  const supplierFooterText =
    doc.supplierFooterText ??
    doc.supplier_footer_text ??
    customerFooterText ??
    "الرصيد المبين أعلاه خاضع للمطابقة والتدقيق المحاسبي.";
  const employeeHeaderText =
    doc.employeeHeaderText ?? doc.employee_header_text ?? "كشف حساب ومسير رواتب موظف";
  const employeeFooterText =
    doc.employeeFooterText ?? doc.employee_footer_text ?? "إدارة الموارد البشرية - التوقيع والاعتماد";
  const voucherReceiptTitle =
    doc.voucherReceiptTitle ?? doc.voucher_receipt_title ?? "سند قبض";
  const voucherPaymentTitle =
    doc.voucherPaymentTitle ?? doc.voucher_payment_title ?? "سند صرف";
  const voucherJournalTitle =
    doc.voucherJournalTitle ?? doc.voucher_journal_title ?? "سند قيد يومية";
  const voucherFooterText =
    doc.voucherFooterText ??
    doc.voucher_footer_text ??
    "المحاسب _______ المدير _______ المستلم _______";
  const invoiceHeaderText =
    doc.invoiceHeaderText ?? doc.invoice_header_text ?? "فاتورة مبيعات ضريبية";
  const invoiceFooterText =
    doc.invoiceFooterText ??
    doc.invoice_footer_text ??
    gen.receiptMessage ??
    "شكراً لتعاملكم معنا — نتطلع لخدمتكم دائماً";
  const reportHeaderText =
    doc.reportHeaderText ?? doc.report_header_text ?? "تقرير عام شامل";
  const reportFooterText =
    doc.reportFooterText ?? doc.report_footer_text ?? `طبع بواسطة ${companyName}`;

  return {
    ...gen,
    ...doc,
    companyName,
    companySubtitle,
    address,
    phone,
    taxNumber,
    logoUrl: showLogo ? logoUrl : "",
    rawLogoUrl: logoUrl,
    showLogo,
    printLogo: showLogo ? "true" : "false",
    showTaxNumber,
    showBranchInfo,
    showSignatureBoxes,
    showStampBox,
    accentColor,
    headerRightText1,
    headerRightText2,
    headerRightText3,
    headerLeftText1,
    headerLeftText2,
    headerLeftText3,
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
    invoiceHeaderText,
    invoiceFooterText,
    reportHeaderText,
    reportFooterText,
    // snake_case aliases
    company_name: companyName,
    company_subtitle: companySubtitle,
    companyAddress: address,
    companyPhone: phone,
    companyTaxNumber: taxNumber,
    tax_number: taxNumber,
    logo_url: showLogo ? logoUrl : "",
    accent_color: accentColor,
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
    invoice_header_text: invoiceHeaderText,
    invoice_footer_text: invoiceFooterText,
    report_header_text: reportHeaderText,
    report_footer_text: reportFooterText,
    header_right_text_1: headerRightText1,
    header_right_text_2: headerRightText2,
    header_right_text_3: headerRightText3,
    header_left_text_1: headerLeftText1,
    header_left_text_2: headerLeftText2,
    header_left_text_3: headerLeftText3,
  };
}

export function wrapSnippetWithDocBranding(htmlSnippet: string, title: string = "مستند رسمي"): string {
  if (!htmlSnippet) return htmlSnippet;
  if (
    htmlSnippet.includes("<!DOCTYPE html>") ||
    htmlSnippet.includes("<html") ||
    htmlSnippet.includes("data-doc-branded") ||
    htmlSnippet.includes("stmt-top-grid") ||
    htmlSnippet.includes("top-dark-banner") ||
    htmlSnippet.includes("top-burgundy-banner") ||
    htmlSnippet.includes("print-header-branded")
  ) {
    return htmlSnippet;
  }

  const s = getEffectiveDocPrintSettings();
  const accent = s.accentColor || "#2563eb";
  const right1 = s.headerRightText1 || s.companyName || "OmniSystem Pro";
  const right2 = s.headerRightText2 || s.companySubtitle || "";
  const right3 = s.headerRightText3 || s.phone || "";
  const left1 = s.headerLeftText1 || s.companyName || "";
  const left2 = s.headerLeftText2 || "";
  const left3 = s.headerLeftText3 || "";
  const logoHtml =
    s.showLogo && s.logoUrl
      ? `<img src="${s.logoUrl}" alt="Logo" style="max-height:68px; max-width:120px; object-fit:contain; margin:0 auto 4px auto; display:block;" />`
      : "";

  let footerNote = s.reportFooterText || "";
  if (title.includes("عميل")) footerNote = s.customerFooterText || footerNote;
  else if (title.includes("مورد")) footerNote = s.supplierFooterText || footerNote;
  else if (title.includes("موظف") || title.includes("رواتب")) footerNote = s.employeeFooterText || footerNote;
  else if (title.includes("سند") || title.includes("قيد")) footerNote = s.voucherFooterText || footerNote;
  else if (title.includes("فاتورة")) footerNote = s.invoiceFooterText || footerNote;

  return `
    <div data-doc-branded="true" style="direction:rtl; font-family:'Tajawal','Cairo',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid ${accent}; padding-bottom:12px; margin-bottom:16px; gap:12px;">
        <div style="flex:1; text-align:right;">
          <div style="font-size:18px; font-weight:900; color:${accent};">${right1}</div>
          ${ s.companySubtitle && right2 !== s.companySubtitle ? `<div style="font-size:12px; font-weight:700; color:#475569;">${s.companySubtitle}</div>` : "" }
          ${ right2 ? `<div style="font-size:12px; font-weight:700; color:#334155;">${right2}</div>` : "" }
          ${ right3 ? `<div style="font-size:12px; font-family:monospace; font-weight:700; color:#334155;">${right3}</div>` : "" }
          ${ s.showTaxNumber && s.taxNumber ? `<div style="font-size:11px; color:#64748b;">الرقم الضريبي: ${s.taxNumber}</div>` : "" }
        </div>
        <div style="flex:1; text-align:center;">
          ${logoHtml}
          <div style="display:inline-block; background:${accent}; color:#fff; font-weight:900; font-size:14px; padding:4px 18px; border-radius:999px; margin-top:4px;">
            ${title}
          </div>
        </div>
        <div style="flex:1; text-align:left;" dir="ltr">
          <div style="font-size:16px; font-weight:900; color:${accent};">${left1}</div>
          ${ left2 ? `<div style="font-size:12px; font-weight:700; color:#334155;">${left2}</div>` : "" }
          ${ left3 ? `<div style="font-size:12px; font-family:monospace; font-weight:700; color:#334155;">${left3}</div>` : "" }
          <div style="font-size:11px; color:#64748b; margin-top:2px;">${new Date().toLocaleDateString("ar-SA")}</div>
        </div>
      </div>
      <div>${htmlSnippet}</div>
      ${footerNote ? `
      <div style="margin-top:24px; padding-top:10px; border-top:2px solid ${accent}; display:flex; justify-content:space-between; align-items:center; font-size:11.5px; font-weight:700; color:#475569;">
        <div>${footerNote}</div>
        <div>${s.companyName}</div>
      </div>` : ""}
    </div>
  `;
}

export function generateGenericDocumentHtml(title: string, data: any, settings?: any): string {
  const s = getEffectiveDocPrintSettings(settings);
  const accentColor = s.accentColor || "#1e293b";
  const bizName = s.headerRightText1 || s.companyName || "Omni System Pro ERP";
  const subtitle = s.companySubtitle || "نظام إدارة المخازن والمبيعات والحسابات المتكامل";
  const right2 = s.headerRightText2 || s.address || "";
  const right3 = s.headerRightText3 || s.phone || "";
  const left1 = s.headerLeftText1 || s.companyName || "";
  const left2 = s.headerLeftText2 || "";
  const left3 = s.headerLeftText3 || "";
  const logo = (s.showLogo && s.logoUrl) ? `<img src="${s.logoUrl}" style="max-height:80px;object-fit:contain;" alt="Logo" />` : "";
  
  let contentHtml = "";

  if (data) {
    if (data.supplier && data.invoices) {
      // Specialized layout for Supplier Statement
      contentHtml += `
        <div style="margin-bottom:20px; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
          <table style="width:100%; font-size:12px;">
            <tr>
              <td><strong>اسم المورد:</strong> ${data.supplier.name}</td>
              <td><strong>كود المورد:</strong> ${data.supplier.code || '---'}</td>
              <td><strong>الهاتف:</strong> ${data.supplier.phone || '---'}</td>
              <td><strong>الرصيد الحالي:</strong> <span style="color:${data.supplier.balance > 0 ? '#16a34a' : data.supplier.balance < 0 ? '#dc2626' : '#000'}; font-weight:bold; font-size:14px;" dir="ltr">${Number(data.supplier.balance).toFixed(2)} ر.س</span></td>
            </tr>
          </table>
        </div>
        <h3 style="color:${accentColor}; border-bottom:2px solid ${accentColor}; padding-bottom:5px; margin-bottom:15px;">حركة الفواتير</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>تاريخ الفاتورة</th>
              <th>رقم الفاتورة</th>
              <th>المبلغ</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.length > 0 ? data.invoices.map((inv: any) => `
              <tr>
                <td>${new Date(inv.invoice_date || inv.created_at).toLocaleDateString('ar-SA')}</td>
                <td>${inv.invoice_number || inv.id}</td>
                <td style="font-weight:bold" dir="ltr">${Number(inv.total).toFixed(2)}</td>
                <td>${inv.notes || '---'}</td>
              </tr>
            `).join('') : `<tr><td colspan="4" style="text-align:center;">لا توجد فواتير</td></tr>`}
          </tbody>
        </table>
      `;
    } else {
      // Generic Layout for anything else (like Purchase Orders, Receipts, etc)
      contentHtml += `<div style="margin-bottom:20px; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">`;
      
      const tableRows: string[] = [];
      const arraysToRender: {title: string, items: any[]}[] = [];

      Object.entries(data).forEach(([key, value]) => {
        // Exclude system keys
        if (key === 'id' || key === 'created_at' || key === 'updated_at') return;

        if (Array.isArray(value)) {
          arraysToRender.push({ title: key, items: value });
        } else if (typeof value === 'object' && value !== null) {
          tableRows.push(`<tr><td style="font-weight:bold; width:150px;">${key}</td><td><pre style="margin:0;font-family:inherit;">${JSON.stringify(value)}</pre></td></tr>`);
        } else {
          tableRows.push(`<tr><td style="font-weight:bold; width:150px;">${key}</td><td>${value}</td></tr>`);
        }
      });

      if (tableRows.length > 0) {
        contentHtml += `<table style="width:100%; font-size:12px; line-height:2;"><tbody>${tableRows.join('')}</tbody></table>`;
      }
      contentHtml += `</div>`;

      // Render Arrays as Tables
      arraysToRender.forEach(arr => {
        if (arr.items.length === 0) return;
        contentHtml += `<h3 style="color:${accentColor}; border-bottom:2px solid ${accentColor}; padding-bottom:5px; margin-bottom:15px;">${arr.title}</h3>`;
        contentHtml += `<table class="data-table"><thead><tr>`;
        const headers = Object.keys(arr.items[0] || {}).filter(k => k !== 'id' && !k.endsWith('_id'));
        headers.forEach(h => {
          contentHtml += `<th>${h}</th>`;
        });
        contentHtml += `</tr></thead><tbody>`;
        arr.items.forEach((item: any) => {
          contentHtml += `<tr>`;
          headers.forEach(h => {
            const v = item[h];
            contentHtml += `<td>${typeof v === 'object' ? JSON.stringify(v) : v}</td>`;
          });
          contentHtml += `</tr>`;
        });
        contentHtml += `</tbody></table>`;
      });
    }
  }

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    body { font-family: 'Cairo', sans-serif; color: #000; margin: 0; padding: 30px; font-size: 13px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accentColor}; padding-bottom: 20px; margin-bottom: 30px; }
    .header-right { text-align: right; flex: 1; }
    .header-center { text-align: center; flex: 1; }
    .header-left { text-align: left; flex: 1; }
    .biz-name { font-weight: 900; font-size: 24px; color: ${accentColor}; margin-bottom: 5px; }
    .biz-sub { font-weight: 700; font-size: 14px; color: #475569; }
    .doc-title { font-size: 18px; font-weight: 900; background: ${accentColor}; color: #fff; padding: 6px 24px; border-radius: 20px; display: inline-block; margin-top: 10px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
    .data-table th { background-color: #f8fafc; color: #0f172a; font-weight: 900; }
    .footer { display: flex; justify-content: space-between; border-top: 2px solid ${accentColor}; padding-top: 20px; margin-top: 50px; font-weight: bold; font-size: 12px; color: #475569; }
    .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; }
    .sig-box { width: 25%; }
    .sig-line { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-right">
      <div class="biz-name">${bizName}</div>
      <div class="biz-sub">${subtitle}</div>
      ${right2 ? `<div style="font-size:12px; font-weight:bold; color:#334155;">${right2}</div>` : ""}
      ${right3 ? `<div style="font-size:12px; font-family:monospace; font-weight:bold; color:#334155;">${right3}</div>` : ""}
      ${s.showTaxNumber && s.taxNumber ? `<div style="font-size:11px; color:#64748b;">الرقم الضريبي: ${s.taxNumber}</div>` : ""}
    </div>
    <div class="header-center">
      ${logo}
      <br/>
      <div class="doc-title">${title}</div>
    </div>
    <div class="header-left" dir="ltr">
      ${left1 ? `<div style="font-weight:900; font-size:16px; color:${accentColor};">${left1}</div>` : ""}
      ${left2 ? `<div style="font-size:12px; font-weight:bold; color:#334155;">${left2}</div>` : ""}
      ${left3 ? `<div style="font-size:12px; font-family:monospace; font-weight:bold; color:#334155;">${left3}</div>` : ""}
      <div style="font-weight:bold; margin-top:4px;" dir="rtl">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
  </div>

  <div style="text-align:center; font-weight:bold; font-size:16px; margin-bottom:30px; color:${accentColor};">
    ${title.includes('مورد') ? (s.supplierHeaderText || '') : title.includes('عميل') ? (s.customerHeaderText || '') : title.includes('موظف') ? (s.employeeHeaderText || '') : (s.reportHeaderText || '')}
  </div>

  ${contentHtml}

  ${s.showSignatureBoxes !== false ? `
  <div class="signatures">
    <div class="sig-box"><div class="sig-line">توقيع المستلم / المعتمد</div></div>
    ${s.showStampBox !== false ? `<div class="sig-box"><div class="sig-line">الختم الرسمي</div></div>` : ""}
    <div class="sig-box"><div class="sig-line">توقيع الإدارة / المحاسب</div></div>
  </div>
  ` : ""}

  <div class="footer">
    <div>${title.includes('مورد') ? (s.supplierFooterText || s.reportFooterText) : title.includes('عميل') ? (s.customerFooterText || s.reportFooterText) : title.includes('موظف') ? (s.employeeFooterText || s.reportFooterText) : (s.reportFooterText || 'تمت الطباعة بواسطة Omni System Pro ERP')}</div>
    <div>${s.voucherFooterText || ''}</div>
  </div>
</body>
</html>
  `;

  return html;
}

export function printGenericDocument(title: string, data: any, settings?: any) {
  const html = generateGenericDocumentHtml(title, data, settings);
  fallbackIframePrint(html);
}

/**
 * Universal A4 Printing Helper
 * Opens print window or falls back to hidden iframe to prevent popup-blocker failures.
 */
export function printA4Html(htmlContent: string, title: string = "مستند A4 معتمد") {
  // If the content already contains a full html document, make sure we clean any duplicate or broken print scripts
  const s = getEffectiveDocPrintSettings();
  const accentColor = s.accentColor || "#1e3a8a";
  const cleanContent = wrapSnippetWithDocBranding(htmlContent, title);
  
  const fullHtml = cleanContent.includes("<!DOCTYPE html>") ? cleanContent : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #0f172a;
      background: #ffffff !important;
      margin: 0;
      padding: 10px;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #94a3b8 !important; padding: 6px 8px !important; text-align: right !important; }
    th { background-color: ${accentColor} !important; font-weight: bold !important; color: #ffffff !important; }
    @media print {
      body { padding: 0 !important; background: #fff !important; }
    }
  </style>
</head>
<body>
  ${cleanContent}
</body>
</html>`;

  // Always use iframe printing in sandboxed/iframe preview environments to prevent blank popup window issues
  fallbackIframePrint(fullHtml);
}

function fallbackIframePrint(html: string) {
  let iframe = document.getElementById("print-a4-hidden-iframe") as HTMLIFrameElement;
  if (iframe) {
    iframe.remove();
  }
  
  iframe = document.createElement("iframe");
  iframe.id = "print-a4-hidden-iframe";
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.zIndex = "-99999";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    
    // Give fonts and layout a solid frame to render before triggering print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("Print invocation error:", e);
      }
    }, 450);
  }
}

/**
 * Save Document as PDF File directly (Desktop File System & Web Browser fallback)
 * Allows choosing path and file name or automatic name without triggering print dialog!
 */
export async function saveA4PdfToFile(
  htmlContent: string,
  title: string = "مستند_PDF",
  defaultFileName?: string,
  options?: { landscape?: boolean; pageSize?: string }
): Promise<{ success: boolean; canceled?: boolean; filePath?: string; fileName?: string; error?: string }> {
  const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim();
  const baseName = (defaultFileName || cleanTitle || "مستند").replace(/\.pdf$/i, "");
  const fileName = `${baseName}.pdf`;

  const fullHtml = htmlContent.includes("<!DOCTYPE html>") ? htmlContent : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${cleanTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: ${options?.pageSize || 'A4'} ${options?.landscape ? 'landscape' : 'portrait'};
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #0f172a;
      background: #ffffff !important;
      margin: 0;
      padding: 10px;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #94a3b8 !important; padding: 6px 8px !important; text-align: right !important; }
    th { background-color: #f1f5f9 !important; font-weight: bold !important; color: #0f172a !important; }
    @media print {
      body { padding: 0 !important; background: #fff !important; }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

  // 1. Electron Desktop Environment: Native File Save Dialog & High-Res PDF Rendering directly to disk
  if (typeof window !== "undefined" && (window as any).electronAPI?.savePdf) {
    try {
      const result = await (window as any).electronAPI.savePdf({
        html: fullHtml,
        title: cleanTitle,
        defaultFileName: fileName,
        pageSize: options?.pageSize || "A4",
        landscape: options?.landscape || false
      });
      return result;
    } catch (err: any) {
      console.error("Electron savePdf failed:", err);
      // fallback to client-side PDF creation
    }
  }

  // 2. Web Browser: High-Resolution Client-side PDF Generation via html2canvas & jsPDF
  try {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = options?.landscape ? "1122px" : "794px";
    container.style.background = "#ffffff";
    container.style.color = "#0f172a";
    container.style.padding = "20px";
    container.style.zIndex = "-99999";
    container.dir = "rtl";
    container.innerHTML = fullHtml;

    container.querySelectorAll("script, .no-print").forEach(el => el.remove());
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff"
    });
    document.body.removeChild(container);

    const orientation = options?.landscape ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: (options?.pageSize?.toLowerCase() as any) || "a4"
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);

    return {
      success: true,
      fileName: fileName,
      filePath: "مجلد التنزيلات (Downloads)"
    };
  } catch (err: any) {
    console.error("Client-side PDF save error:", err);
    return { success: false, error: err.message || "تعذر حفظ وتصدير ملف الـ PDF" };
  }
}

export const saveA4HtmlAsPdf = saveA4PdfToFile;

export function generateWarehouseInvoiceA4Html(invoice: any, settings?: any): string {
  const s = getEffectiveDocPrintSettings(settings);
  const accentColor = s.accentColor || "#282425";
  const headerRight1 = s.headerRightText1 || s.companyName || "اسم النشاط التجاري";
  const headerRight2 = s.headerRightText2 || s.companySubtitle || "وصف اختياري - إدارة المخازن والمبيعات";
  const headerRight3 = s.headerRightText3 || s.companyPhone || "04-541474 - 773449820 - 737587221";

  const headerLeft1 = s.headerLeftText1 || s.address || "تعز - شارع جمال - بداية المركزي";
  const headerLeft2 = s.headerLeftText2 || "اليمن - المركز الرئيسي";
  const headerLeft3 = s.headerLeftText3 || "";

  const logoUrl = s.logoUrl;
  const logo = (s.showLogo && logoUrl) 
    ? `<img src="${logoUrl}" style="max-height:64px;max-width:70px;object-fit:contain;" alt="Logo" />` 
    : `<div style="color:${accentColor}; font-size:10px; font-weight:900; text-align:center;">${s.companyName || "الشعار"}</div>`;
  const invoiceTitleText = invoice.headerTitle || s.invoiceHeaderText || "فــاتــورة بــيــع";
  const invoiceFooterText = s.invoiceFooterText || s.reportFooterText || "";

  const invNo = invoice.invoice_no || invoice.invoice_number || `INV-${invoice.id || '0001'}`;
  const invDate = invoice.invoice_date || invoice.date || new Date().toISOString().slice(0, 10);
  const invTime = invoice.invoice_time || invoice.created_at?.slice(11, 16) || "12:00";
  
  const paymentType = invoice.payment_type || invoice.payment_method || "cash";
  const isCredit = paymentType === "credit" || paymentType === "آجل";
  const paymentLabel = isCredit ? "آجل (ذمم)" : "نقداً";

  const custName = invoice.customer_name || invoice.party_name || "عميل نقدي عام";
  const custCode = invoice.customer_account_code || invoice.account_code || (invoice.customer_id ? `CUST-${invoice.customer_id}` : "11400");
  const currency = invoice.currency || "YER";

  const items = invoice.items || [];
  const subtotal = Number(invoice.subtotal || invoice.total_amount || invoice.net_amount || 0);
  const discountAmount = Number(invoice.discount_amount || invoice.total_discount || 0);
  const taxableAmount = Number(invoice.taxable_amount || (subtotal - discountAmount));
  const taxAmount = Number(invoice.tax_amount || invoice.total_tax || 0);
  const netTotal = Number(invoice.net_amount || invoice.total_amount || invoice.netTotal || (taxableAmount + taxAmount));

  const words = tafqeet(netTotal, currency);
  const fmt = (v: number) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة بيع - ${invNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 6px;
      font-size: 11.5px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .invoice-card {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      border: 3.5px solid #282425;
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      position: relative;
    }
    
    /* Top Arched Dark Header Banner Matching Image */
    .top-dark-banner {
      background: #282425;
      color: #ffffff;
      padding: 10px 18px 18px 18px;
      position: relative;
      border-bottom: 4px solid #8b263e;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-right-box {
      flex: 1.2;
      text-align: right;
    }
    .header-right-box .biz-title {
      font-size: 16px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 2px;
      letter-spacing: -0.3px;
    }
    .header-right-box .biz-desc {
      font-size: 11px;
      font-weight: 700;
      color: #e2e8f0;
    }
    
    /* Central Protruding Logo Badge */
    .center-logo-badge {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: #ffffff;
      border: 3px solid #282425;
      position: absolute;
      left: 50%;
      top: 6px;
      transform: translateX(-50%);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .header-left-box {
      flex: 1.2;
      text-align: left;
      font-size: 11px;
      color: #f1f5f9;
      line-height: 1.5;
    }

    /* Sub-header Metadata Row */
    .meta-sub-header {
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #282425;
      background: #fafaf9;
      gap: 15px;
    }
    .meta-col-right {
      text-align: right;
      font-weight: bold;
      font-size: 12px;
      line-height: 1.9;
      color: #1e293b;
      flex: 1.2;
    }
    .meta-col-center {
      text-align: center;
      flex: 1;
    }
    .meta-col-left {
      text-align: left;
      font-weight: bold;
      font-size: 12px;
      line-height: 1.9;
      color: #1e293b;
      flex: 1.2;
    }
    .inv-title-text {
      font-size: 19px;
      font-weight: 900;
      color: #282425;
      letter-spacing: 0.5px;
      border-bottom: 2.5px solid #282425;
      padding-bottom: 2px;
      display: inline-block;
    }

    /* Distinct Vertical Column Boxes matching image */
    .vertical-columns-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.8fr 2.8fr;
      gap: 6px;
      padding: 10px 14px;
      min-height: 380px;
    }
    .col-header-pill {
      background: #282425;
      color: #ffffff;
      padding: 8px 4px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 900;
      text-align: center;
      margin-bottom: 4px;
    }
    .col-vertical-box {
      border: 2px solid #282425;
      border-radius: 8px;
      min-height: 330px;
      background: #ffffff;
      padding: 8px 4px;
      display: flex;
      flex-direction: column;
    }
    .col-row-item {
      padding: 6px 4px;
      border-bottom: 1px dashed #cbd5e1;
      text-align: center;
      font-size: 11.5px;
      font-weight: bold;
    }
    .col-row-item:last-child {
      border-bottom: none;
    }
    .col-row-item.text-right {
      text-align: right;
      padding-right: 8px;
    }

    /* Bottom Summary & Totals Box */
    .summary-totals-row {
      padding: 6px 14px 10px 14px;
      display: grid;
      grid-template-columns: 2.8fr 0.8fr 1fr 1.2fr;
      gap: 6px;
      align-items: center;
    }
    .total-pill-header {
      background: #282425;
      color: #ffffff;
      padding: 6px;
      border-radius: 6px;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
    }
    .total-value-box {
      border: 2px solid #282425;
      border-radius: 6px;
      padding: 6px;
      text-align: center;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      background: #f8fafc;
    }

    .tafqeet-notes-banner {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #f0fdf4;
      color: #166534;
      font-weight: 800;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bottom-signatures-bar {
      border-top: 2px solid #282425;
      padding: 12px 20px;
      background: #fafafa;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      font-size: 12px;
      color: #1e293b;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- 1. Top Dark Banner with Central Protruding Logo Badge -->
    <div class="top-dark-banner">
      <div class="header-right-box">
        <div class="biz-title">${headerRight1}</div>
        <div class="biz-desc">${headerRight2}</div>
      </div>

      <div class="center-logo-badge">
        ${logo}
      </div>

      <div class="header-left-box">
        <div>${headerLeft1}</div>
        <div>${headerLeft2 || headerRight3}</div>
        ${headerLeft3 ? `<div>${headerLeft3}</div>` : ""}
      </div>
    </div>

    <!-- 2. Sub-header Metadata Row -->
    <div class="meta-sub-header">
      <div class="meta-col-right">
        <div>التاريخ : <span dir="ltr" class="font-mono">${invDate}</span> &nbsp; ${invTime}</div>
        <div>المطلوب من الأخ / الأخوة : <strong style="color:#000; font-size:13px;">${custName}</strong></div>
      </div>

      <div class="meta-col-center">
        <div class="inv-title-text" style="color:${accentColor}; border-bottom-color:${accentColor};">${invoiceTitleText}</div>
        <div style="font-size:11px; color:#475569; margin-top:2px;">
          طريقة السداد : <strong style="color:#0f172a;">${paymentLabel}</strong>
        </div>
      </div>

      <div class="meta-col-left">
        <div>NO : <strong class="font-mono" style="font-size:14px; color:#b91c1c;">${invNo}</strong></div>
        <div>المحترم / المحترمون : <span class="font-mono">${custCode}</span></div>
      </div>
    </div>

    <!-- 3. Distinct Vertical Column Boxes matching image -->
    <div class="vertical-columns-grid">
      <!-- Column 1: Total Amount -->
      <div>
        <div class="col-header-pill">القيمة الإجمالية</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => {
            const itTotal = Number(it.total || (Number(it.quantity || 1) * Number(it.price || 0) - Number(it.discount_amount || 0)));
            return `<div class="col-row-item font-mono" dir="ltr">${fmt(itTotal)} ${currency}</div>`;
          }).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 2: Unit Price -->
      <div>
        <div class="col-header-pill">سعر الوحدة</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => `
            <div class="col-row-item font-mono">${fmt(Number(it.price || 0))}</div>
          `).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 3: Quantity -->
      <div>
        <div class="col-header-pill">الكمية</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => `
            <div class="col-row-item font-mono">${it.quantity || 1}</div>
          `).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 4: Item Details -->
      <div>
        <div class="col-header-pill">التـــفـــاصــيــل / البــيــان</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any, idx: number) => `
            <div class="col-row-item text-right">
              <span>#${idx + 1} - ${it.product_name || it.item_name || "صنف تجاري"}</span>
              ${it.product_code || it.item_code ? `<span style="font-size:10px; color:#64748b; margin-right:6px;">(كود: ${it.product_code || it.item_code})</span>` : ''}
              ${it.notes ? `<div style="font-size:9.5px; color:#64748b;">${it.notes}</div>` : ''}
            </div>
          `).join('') : '<div class="col-row-item text-right">لا توجد أصناف مدخلة</div>'}
        </div>
      </div>
    </div>

    <!-- 4. Summary & Totals Box -->
    <div class="summary-totals-row">
      <div class="tafqeet-notes-banner">
        <span>المبلغ كتابة:</span>
        <strong>${words}</strong>
      </div>

      <div></div>
      <div>
        <div class="total-pill-header">الإجـمـالـي</div>
      </div>

      <div>
        <div class="total-value-box font-mono" dir="ltr">${fmt(netTotal)} ${currency}</div>
      </div>
    </div>

    <!-- 5. Bottom Signatures -->
    <div class="bottom-signatures-bar">
      <div>المستلم / .............................................</div>
      ${invoiceFooterText ? `<div style="font-size:11px; color:${accentColor}; text-align:center;">${invoiceFooterText}</div>` : ""}
      <div>التوقيع / .............................................</div>
    </div>
  </div>
</body>
</html>`;
}


export function generatePurchaseInvoiceA4Html(purchase: any, settings?: any): string {
  const s = getEffectiveDocPrintSettings(settings);
  const accentColor = s.accentColor || "#282425";
  const headerRight1 = s.headerRightText1 || s.companyName || "اسم النشاط التجاري";
  const headerRight2 = s.headerRightText2 || s.companySubtitle || "وصف اختياري - إدارة المخازن والمشتريات";
  const headerRight3 = s.headerRightText3 || s.companyPhone || "04-541474 - 773449820 - 737587221";

  const headerLeft1 = s.headerLeftText1 || s.address || "تعز - شارع جمال - بداية المركزي";
  const headerLeft2 = s.headerLeftText2 || "اليمن - المركز الرئيسي";

  const logoUrl = s.logoUrl;
  const logo = (s.showLogo && logoUrl) 
    ? `<img src="${logoUrl}" style="max-height:64px;max-width:70px;object-fit:contain;" alt="Logo" />` 
    : `<div style="color:${accentColor}; font-size:10px; font-weight:900; text-align:center;">${s.companyName || "الشعار"}</div>`;

  const invNo = purchase.invoice_number || purchase.po_number || purchase.invoice_no || purchase.pr_number || purchase.rfq_number || purchase.grn_number || purchase.return_number || purchase.contract_number || `PUR-${purchase.id || '0001'}`;
  const invDate = purchase.invoice_date || purchase.order_date || purchase.date || purchase.payment_date || purchase.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  
  const paymentType = purchase.payment_type || purchase.payment_method || "credit";
  const isCredit = paymentType === "credit" || paymentType === "آجل";
  const paymentLabel = isCredit ? "آجل (ذمم موردين)" : "نقداً";

  const supName = purchase.supplier_name || purchase.party_name || purchase.received_from || "مورد تجاري عام";
  const supCode = purchase.supplier_code || purchase.supplier_account_code || purchase.account_code || "21100";
  const currency = purchase.currency || "YER";

  const items = purchase.items || [];
  const subtotal = Number(purchase.subtotal || purchase.total_amount || purchase.total || purchase.total_cost || purchase.total_price || 0);
  const discountAmount = Number(purchase.discount_amount !== undefined ? purchase.discount_amount : (purchase.discount || 0));
  const taxAmount = Number(purchase.tax_amount !== undefined ? purchase.tax_amount : (purchase.tax || 0));
  const netTotal = Number(purchase.net_amount || purchase.total || purchase.total_amount || purchase.total_cost || purchase.total_price || (subtotal - discountAmount + taxAmount));

  const words = tafqeet(netTotal, currency);
  const fmt = (v: number) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة شراء - ${invNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 6px;
      font-size: 11.5px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .invoice-card {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      border: 3.5px solid #282425;
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      position: relative;
    }
    
    /* Top Arched Dark Header Banner Matching Image */
    .top-dark-banner {
      background: #282425;
      color: #ffffff;
      padding: 10px 18px 18px 18px;
      position: relative;
      border-bottom: 4px solid #8b263e;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-right-box {
      flex: 1.2;
      text-align: right;
    }
    .header-right-box .biz-title {
      font-size: 16px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 2px;
      letter-spacing: -0.3px;
    }
    .header-right-box .biz-desc {
      font-size: 11px;
      font-weight: 700;
      color: #e2e8f0;
    }
    
    /* Central Protruding Logo Badge */
    .center-logo-badge {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: #ffffff;
      border: 3px solid #282425;
      position: absolute;
      left: 50%;
      top: 6px;
      transform: translateX(-50%);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .header-left-box {
      flex: 1.2;
      text-align: left;
      font-size: 11px;
      color: #f1f5f9;
      line-height: 1.5;
    }

    /* Sub-header Metadata Row */
    .meta-sub-header {
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #282425;
      background: #fafaf9;
      gap: 15px;
    }
    .meta-col-right {
      text-align: right;
      font-weight: bold;
      font-size: 12px;
      line-height: 1.9;
      color: #1e293b;
      flex: 1.2;
    }
    .meta-col-center {
      text-align: center;
      flex: 1;
    }
    .meta-col-left {
      text-align: left;
      font-weight: bold;
      font-size: 12px;
      line-height: 1.9;
      color: #1e293b;
      flex: 1.2;
    }
    .inv-title-text {
      font-size: 19px;
      font-weight: 900;
      color: #282425;
      letter-spacing: 0.5px;
      border-bottom: 2.5px solid #282425;
      padding-bottom: 2px;
      display: inline-block;
    }

    /* Distinct Vertical Column Boxes matching image */
    .vertical-columns-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 0.8fr 2.8fr;
      gap: 6px;
      padding: 10px 14px;
      min-height: 380px;
    }
    .col-header-pill {
      background: #282425;
      color: #ffffff;
      padding: 8px 4px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 900;
      text-align: center;
      margin-bottom: 4px;
    }
    .col-vertical-box {
      border: 2px solid #282425;
      border-radius: 8px;
      min-height: 330px;
      background: #ffffff;
      padding: 8px 4px;
      display: flex;
      flex-direction: column;
    }
    .col-row-item {
      padding: 6px 4px;
      border-bottom: 1px dashed #cbd5e1;
      text-align: center;
      font-size: 11.5px;
      font-weight: bold;
    }
    .col-row-item:last-child {
      border-bottom: none;
    }
    .col-row-item.text-right {
      text-align: right;
      padding-right: 8px;
    }

    /* Bottom Summary & Totals Box */
    .summary-totals-row {
      padding: 6px 14px 10px 14px;
      display: grid;
      grid-template-columns: 2.8fr 0.8fr 1fr 1.2fr;
      gap: 6px;
      align-items: center;
    }
    .total-pill-header {
      background: #282425;
      color: #ffffff;
      padding: 6px;
      border-radius: 6px;
      text-align: center;
      font-size: 12px;
      font-weight: 900;
    }
    .total-value-box {
      border: 2px solid #282425;
      border-radius: 6px;
      padding: 6px;
      text-align: center;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      background: #f8fafc;
    }

    .tafqeet-notes-banner {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      background: #f0fdf4;
      color: #166534;
      font-weight: 800;
      font-size: 11.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bottom-signatures-bar {
      border-top: 2px solid #282425;
      padding: 12px 20px;
      background: #fafafa;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      font-size: 12px;
      color: #1e293b;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- 1. Top Dark Banner with Central Protruding Logo Badge -->
    <div class="top-dark-banner">
      <div class="header-right-box">
        <div class="biz-title">${headerRight1}</div>
        <div class="biz-desc">${headerRight2}</div>
      </div>

      <div class="center-logo-badge">
        ${logo}
      </div>

      <div class="header-left-box">
        <div>${headerLeft1}</div>
        <div>${headerRight3}</div>
      </div>
    </div>

    <!-- 2. Sub-header Metadata Row -->
    <div class="meta-sub-header">
      <div class="meta-col-right">
        <div>التاريخ : <span dir="ltr" class="font-mono">${invDate}</span></div>
        <div>المطلوب من الأخ / الأخوة : <strong style="color:#000; font-size:13px;">${supName}</strong></div>
      </div>

      <div class="meta-col-center">
        <div class="inv-title-text">${purchase.title || "فــاتــورة شــراء"}</div>
        <div style="font-size:11px; color:#475569; margin-top:2px;">
          طريقة السداد : <strong style="color:#0f172a;">${paymentLabel}</strong>
        </div>
      </div>

      <div class="meta-col-left">
        <div>NO : <strong class="font-mono" style="font-size:14px; color:#b91c1c;">${invNo}</strong></div>
        <div>المحترم / المحترمون : <span class="font-mono">${supCode}</span></div>
      </div>
    </div>

    <!-- 3. Distinct Vertical Column Boxes matching image -->
    <div class="vertical-columns-grid">
      <!-- Column 1: Total Amount -->
      <div>
        <div class="col-header-pill">القيمة الإجمالية</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => {
            const qty = Number(it.quantity || it.requested_qty || it.ordered_qty || it.received_qty || 1);
            const price = Number(it.unit_price || it.cost_price || it.price || 0);
            const disc = Number(it.discount || it.discount_amount || 0);
            const taxVal = Number(it.tax || it.tax_amount || 0);
            const itTotal = Number(it.total || (qty * price - disc + taxVal));
            return `<div class="col-row-item font-mono" dir="ltr">${fmt(itTotal)} ${currency}</div>`;
          }).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 2: Unit Price -->
      <div>
        <div class="col-header-pill">سعر الوحدة</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => `
            <div class="col-row-item font-mono">${fmt(Number(it.unit_price || it.cost_price || it.price || 0))}</div>
          `).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 3: Quantity -->
      <div>
        <div class="col-header-pill">الكمية</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any) => `
            <div class="col-row-item font-mono">${it.quantity || it.requested_qty || it.ordered_qty || it.received_qty || 1}</div>
          `).join('') : '<div class="col-row-item">—</div>'}
        </div>
      </div>

      <!-- Column 4: Item Details -->
      <div>
        <div class="col-header-pill">التـــفـــاصــيــل / البــيــان</div>
        <div class="col-vertical-box">
          ${items.length > 0 ? items.map((it: any, idx: number) => `
            <div class="col-row-item text-right">
              <span>#${idx + 1} - ${it.product_name || it.item_name || it.name || "صنف تجاري"}</span>
              ${it.product_code || it.item_code || it.code ? `<span style="font-size:10px; color:#64748b; margin-right:6px;">(كود: ${it.product_code || it.item_code || it.code})</span>` : ''}
              ${it.notes ? `<div style="font-size:9.5px; color:#64748b;">${it.notes}</div>` : ''}
            </div>
          `).join('') : '<div class="col-row-item text-right">لا توجد أصناف مدخلة</div>'}
        </div>
      </div>
    </div>

    <!-- 4. Summary & Totals Box -->
    <div class="summary-totals-row">
      <div class="tafqeet-notes-banner">
        <span>المبلغ كتابة:</span>
        <strong>${words}</strong>
      </div>

      <div></div>
      <div>
        <div class="total-pill-header">الإجـمـالـي</div>
      </div>

      <div>
        <div class="total-value-box font-mono" dir="ltr">${fmt(netTotal)} ${currency}</div>
      </div>
    </div>

    <!-- 5. Bottom Signatures -->
    <div class="bottom-signatures-bar">
      <div>المستلم / .............................................</div>
      <div>التوقيع / .............................................</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateStatementA4Html(params: {
  partyType: "employee" | "customer" | "supplier" | "account" | "user" | string;
  party: any;
  startDate?: string;
  endDate?: string;
  previousBalance?: number;
  currentBalance?: number;
  transactions?: any[];
  settings?: any;
  docTitle?: string;
  currency?: string;
  currencySummaries?: any;
  paperFormat?: "A4" | "80mm";
  printerSettings?: any;
}) {
  const { partyType, party, startDate, endDate, previousBalance = 0, currentBalance = 0, transactions = [], settings = {}, docTitle, currency = "all", currencySummaries, paperFormat = "A4", printerSettings } = params;
  
  const fromDate = startDate ? new Date(startDate).toLocaleDateString('ar-EG') : "بداية التعامل";
  const toDate = endDate ? new Date(endDate).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG');
  const issueDateStr = new Date().toLocaleDateString('ar-EG');
  const issueTimeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  let totalDebit = 0;
  let totalCredit = 0;
  transactions.forEach((t: any) => {
    totalDebit += Number(t.debit || 0);
    totalCredit += Number(t.credit || 0);
  });

  const fmt = (v: number) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const s = getEffectiveDocPrintSettings(settings);
  const headerRight1 = s.headerRightText1 || s.companyName || "معمل عبدالسلام للخبز العربي";
  const headerRight2 = s.headerRightText2 || s.companySubtitle || "عدن/المعلا";
  const headerRight3 = s.headerRightText3 || s.companyPhone || "774106282";

  const headerLeft1 = s.headerLeftText1 || s.companyName || "قيس";
  const headerLeft2 = s.headerLeftText2 || "عدن/المعلا";
  const headerLeft3 = s.headerLeftText3 || "771845734";

  const logoUrl = s.logoUrl;
  const headerAccentColor = s.statementHeaderColor || s.accentColor || "#1e64fa";

  const companyName = s.company_name || s.companyName || headerRight1;
  const companyPhone = s.phone || s.companyPhone || headerRight3;
  const companyAddress = s.address || s.companyAddress || headerRight2;

  // ─────────────────────────────────────────────────────────────
  // 1. DEDICATED COMPREHENSIVE EMPLOYEE STATEMENT (كشف حساب تفصيلي شامل للموظف)
  // ─────────────────────────────────────────────────────────────
  if (partyType === "employee") {
    const empName = party?.name || "الموظف";
    const empNumber = party?.employee_number || `#${party?.id || '---'}`;
    const empPosition = party?.position || "موظف";
    const empDepartment = party?.department_name || "القسم العام";
    const empBasicSalary = party?.basic_salary || 0;
    const empPhone = party?.phone || "---";
    const empHireDate = party?.hire_date ? new Date(party.hire_date).toLocaleDateString('ar-EG') : "---";
    const empStatus = party?.active !== false && party?.active !== 0 ? "على رأس العمل (نشط)" : "غير نشط / منتهي العقد";

    // Helper to format movement type for employees
    const getEmployeeMovementType = (t: any) => {
      if (t.type && String(t.type).trim()) return String(t.type).trim();
      if (t.source === "hr_loan") return "سلفة نقدية / عهدة";
      if (t.source === "hr_penalty") return "خصم جزاء ومخالفة";
      if (t.source === "hr_absence") return "خصم غياب";
      if (t.source === "hr_delay") return "خصم تأخير دوام";
      if (t.source === "hr_unpaid_leave") return "خصم إجازة غير مدفوعة";
      if (t.source === "hr_overtime") return "مستحق عمل إضافي";
      if (t.source === "hr_entitlement") return "استحقاق / مكافأة";
      if (t.source === "meal_deduction") return "خصم وجبات طعام";
      if (t.source === "salary_earned" || t.source === "salary_accrued") return "استحقاق راتب أساسي";
      if (t.source === "voucher") return t.debit > 0 ? "سند صرف / دفعة نقدية" : "سند قبض مالي";
      if (t.source === "manual") return "قيد تسوية يدوي";
      return t.debit > 0 ? "استقطاع / سلفة" : "استحقاق / راتب";
    };

    const ps = printerSettings || {};
    const lm = (ps.leftMargin !== undefined && ps.leftMargin !== null) ? Number(ps.leftMargin) : 1;
    const rm = (ps.rightMargin !== undefined && ps.rightMargin !== null) ? Number(ps.rightMargin) : 1;
    const tm = (ps.topMargin !== undefined && ps.topMargin !== null) ? Number(ps.topMargin) : 1;
    const bm = (ps.bottomMargin !== undefined && ps.bottomMargin !== null) ? Number(ps.bottomMargin) : 1;

    // ── 1A. HIGH-PRECISION 80(72.1) x 297 mm THERMAL FORMAT FOR EMPLOYEE STATEMENT ──
    if (paperFormat === "80mm") {
      return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب تفصيلي شامل للموظف (80mm) - ${empName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@500;700;800;900&display=swap');
    @page {
      size: 80mm 297mm;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100%;
      max-width: 72.1mm;
      margin: 0 auto;
      background: #ffffff;
      color: #000000;
      font-family: 'Tajawal', 'Cairo', Arial, sans-serif;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.32;
      direction: rtl;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    .thermal-emp-stmt {
      width: 100%;
      max-width: 72.1mm;
      margin: 0 auto;
      padding: ${tm}mm ${rm}mm ${bm}mm ${lm}mm;
      background: #ffffff;
      color: #000000;
    }
    .t-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .t-logo {
      max-width: 42mm;
      max-height: 16mm;
      object-fit: contain;
      display: block;
      margin: 0 auto 3px auto;
    }
    .t-biz-name {
      font-size: 13.5px;
      font-weight: 900;
      color: #000;
      line-height: 1.2;
    }
    .t-biz-sub {
      font-size: 10px;
      font-weight: 800;
      color: #000;
    }
    .t-doc-title {
      background: #000;
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      padding: 3px 6px;
      margin: 4px 0 2px 0;
      text-align: center;
      border-radius: 3px;
    }
    .t-period-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      font-weight: 800;
      border: 1px solid #000;
      padding: 2px 4px;
      margin-bottom: 4px;
      background: #f8fafc;
    }
    .t-profile-box {
      border: 1.5px solid #000;
      border-radius: 3px;
      padding: 4px 5px;
      margin-bottom: 5px;
      font-size: 10.5px;
    }
    .t-profile-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px dashed #000;
      padding: 2px 0;
    }
    .t-profile-row:last-child {
      border-bottom: none;
    }
    .t-lbl {
      font-weight: 800;
      color: #000;
    }
    .t-val {
      font-weight: 900;
      color: #000;
    }
    .t-kpi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      margin-bottom: 5px;
    }
    .t-kpi-box {
      border: 1.5px solid #000;
      border-radius: 3px;
      padding: 3px 4px;
      text-align: center;
    }
    .t-kpi-box.net {
      grid-column: span 2;
      background: #f1f5f9;
      border-width: 2px;
      padding: 4px;
    }
    .t-kpi-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #000;
    }
    .t-kpi-num {
      font-size: 12.5px;
      font-weight: 900;
      font-family: monospace, sans-serif;
      color: #000;
      direction: ltr;
      display: inline-block;
    }
    .t-kpi-box.net .t-kpi-num {
      font-size: 14px;
    }
    .t-sec-title {
      font-size: 11px;
      font-weight: 900;
      text-align: center;
      border: 1.5px solid #000;
      background: #e2e8f0;
      padding: 2px 4px;
      margin-bottom: 3px;
    }
    table.t-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 5px;
      font-size: 10px;
      table-layout: fixed;
    }
    table.t-table th {
      background: #000;
      color: #fff;
      font-weight: 900;
      font-size: 9.5px;
      padding: 3px 2px;
      border: 1px solid #000;
      text-align: center;
    }
    table.t-table td {
      border: 1px solid #000;
      padding: 2.5px 2px;
      color: #000;
      font-weight: 800;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .t-num {
      font-family: monospace, sans-serif;
      font-weight: 900;
      text-align: center;
      direction: ltr;
      font-size: 10px;
    }
    .t-sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px;
      margin-top: 5px;
      page-break-inside: avoid;
    }
    .t-sig-card {
      border: 1px solid #000;
      padding: 4px 3px;
      text-align: center;
      min-height: 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 800;
    }
    .t-sig-line {
      border-bottom: 1px dashed #000;
      margin-top: 16px;
    }
    .t-footer {
      text-align: center;
      font-size: 9px;
      font-weight: 800;
      border-top: 1.5px solid #000;
      padding-top: 3px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="thermal-emp-stmt">
    <div class="t-header">
      ${(s.showLogo && logoUrl) ? `<img src="${logoUrl}" class="t-logo" alt="Logo" />` : ""}
      <div class="t-biz-name">${headerRight1}</div>
      <div class="t-biz-sub">${headerRight2} ${headerRight3 ? `• ${headerRight3}` : ""}</div>
      <div class="t-doc-title" style="background:${headerAccentColor};">${docTitle || s.employeeHeaderText || "كشف حساب تفصيلي شامل للموظف"}</div>
    </div>

    <div class="t-period-bar">
      <span>الفترة: ${startDate || fromDate}</span>
      <span dir="ltr">${issueDateStr} ${issueTimeStr}</span>
    </div>

    <div class="t-profile-box">
      <div class="t-profile-row">
        <span class="t-lbl">اسم الموظف:</span>
        <span class="t-val" style="font-size:11.5px;">${empName}</span>
      </div>
      <div class="t-profile-row">
        <span class="t-lbl">الرقم الوظيفي / القسم:</span>
        <span class="t-val">${empNumber} • ${empDepartment}</span>
      </div>
      <div class="t-profile-row">
        <span class="t-lbl">المسمى الوظيفي:</span>
        <span class="t-val">${empPosition}</span>
      </div>
      <div class="t-profile-row">
        <span class="t-lbl">الراتب الأساسي الشهري:</span>
        <span class="t-val" dir="ltr">${fmt(empBasicSalary)} ريال</span>
      </div>
    </div>

    <div class="t-kpi-grid">
      <div class="t-kpi-box">
        <div class="t-kpi-title">إجمالي الاستحقاقات (+)</div>
        <div class="t-kpi-num">+${fmt(totalCredit)}</div>
      </div>
      <div class="t-kpi-box">
        <div class="t-kpi-title">إجمالي الاستقطاعات (-)</div>
        <div class="t-kpi-num">-${fmt(totalDebit)}</div>
      </div>
      <div class="t-kpi-box net">
        <div class="t-kpi-title">صافي الرصيد المستحق النهائي (${currentBalance >= 0 ? "مستحق للموظف" : "ذمة على الموظف"})</div>
        <div class="t-kpi-num">${fmt(currentBalance)} ريال</div>
      </div>
    </div>

    <div class="t-sec-title">تفاصيل الحركات المالية والاستقطاعات (${transactions.length})</div>

    <table class="t-table">
      <thead>
        <tr>
          <th style="width: 44%;">التاريخ والبيان التفصيلي</th>
          <th style="width: 18%;">له (+)</th>
          <th style="width: 18%;">عليه (-)</th>
          <th style="width: 20%;">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${previousBalance !== 0 ? `
        <tr>
          <td>
            <div style="font-size:9px;">${fromDate} • رصيد افتتاحي</div>
            <div>رصيد سابق مدور</div>
          </td>
          <td class="t-num">${previousBalance > 0 ? fmt(previousBalance) : "-"}</td>
          <td class="t-num">${previousBalance < 0 ? fmt(Math.abs(previousBalance)) : "-"}</td>
          <td class="t-num">${fmt(previousBalance)}</td>
        </tr>
        ` : ""}
        ${transactions.length > 0 ? transactions.map((t: any, idx: number) => {
          const mType = getEmployeeMovementType(t);
          const isCred = Number(t.credit || 0) > 0;
          const isDeb = Number(t.debit || 0) > 0;
          const dateShort = String(t.date || "").slice(5, 10) || String(t.date || "").slice(0, 10);
          return `
          <tr>
            <td>
              <div style="font-size:9.5px; font-weight:900; border-bottom:1px dotted #000; padding-bottom:1px; margin-bottom:1px;">
                #${idx + 1} [${dateShort}] ${mType}
              </div>
              <div style="font-size:9.5px; line-height:1.2;">${t.description || "حركة مالية"}${t.notes ? ` (${t.notes})` : ""}</div>
            </td>
            <td class="t-num">${isCred ? fmt(t.credit) : "-"}</td>
            <td class="t-num">${isDeb ? fmt(t.debit) : "-"}</td>
            <td class="t-num">${fmt(t.running_balance ?? t.runningBalance ?? 0)}</td>
          </tr>
          `;
        }).join("") : `
          <tr>
            <td colspan="4" style="text-align:center; padding:8px;">لا توجد حركات مسجلة خلال هذه الفترة</td>
          </tr>
        `}
        <tr style="background:#e2e8f0; border-top:2px solid #000;">
          <td style="font-weight:900; font-size:10px;">الإجمالي النهائي</td>
          <td class="t-num" style="font-size:10.5px;">${fmt(totalCredit)}</td>
          <td class="t-num" style="font-size:10.5px;">${fmt(totalDebit)}</td>
          <td class="t-num" style="font-size:11px;">${fmt(currentBalance)}</td>
        </tr>
      </tbody>
    </table>

    <div class="t-sig-grid">
      <div class="t-sig-card">
        <div>شؤون الموظفين / المحاسب</div>
        <div class="t-sig-line"></div>
      </div>
      <div class="t-sig-card">
        <div>توقيع الموظف بالاستلام</div>
        <div class="t-sig-line"></div>
      </div>
    </div>

    <div class="t-footer">
      <div>${s.employeeFooterText || `كشف حساب معتمد • ${companyName}`}</div>
      <div>${companyName} • مقاس 80(72.1)×297mm</div>
    </div>
  </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب تفصيلي شامل للموظف - ${empName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { 
      size: A4 portrait; 
      margin: 10mm 8mm 12mm 8mm; 
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { 
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif; 
      color: #000000; 
      background: #ffffff; 
      font-size: 12.5px; 
      font-weight: 700;
      line-height: 1.4; 
      padding: 10px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    .emp-stmt-container { width: 100%; max-width: 210mm; margin: 0 auto; }
    
    /* Header */
    .emp-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 2.5px solid #000000; 
      padding-bottom: 12px; 
      margin-bottom: 14px; 
    }
    .emp-brand h1 { font-size: 20px; font-weight: 900; color: #000000; }
    .emp-brand p { font-size: 11.5px; color: #000000; font-weight: 700; margin-top: 2px; }
    
    .emp-doc-badge { 
      text-align: center; 
      background: #f1f5f9; 
      border: 2px solid #000000; 
      border-radius: 6px; 
      padding: 6px 16px; 
    }
    .emp-doc-badge h2 { font-size: 16px; font-weight: 900; color: #000000; }
    .emp-doc-badge span { font-size: 11px; font-weight: 800; color: #000000; }
    
    .emp-meta { text-align: left; font-size: 11.5px; color: #000000; font-weight: 700; line-height: 1.5; }
    
    /* Profile Grid */
    .emp-profile-box { 
      background: #f8fafc; 
      border: 2px solid #000000; 
      border-radius: 6px; 
      padding: 10px 14px; 
      margin-bottom: 14px; 
    }
    .emp-profile-title { 
      font-size: 12.5px; 
      font-weight: 900; 
      color: #000000; 
      margin-bottom: 8px; 
      border-bottom: 1.5px dashed #000000; 
      padding-bottom: 4px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 4px;
    }
    .emp-profile-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 8px 14px; 
      font-size: 12px; 
    }
    .emp-info-item { display: flex; flex-direction: column; }
    .emp-info-label { font-size: 11px; color: #1e293b; font-weight: 800; }
    .emp-info-value { font-size: 12.5px; font-weight: 900; color: #000000; }

    /* KPI Summary Cards */
    .emp-kpi-row { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 10px; 
      margin-bottom: 14px; 
    }
    .emp-kpi-card { 
      border: 2px solid #000000; 
      border-radius: 6px; 
      padding: 8px 10px; 
      text-align: center; 
      background: #ffffff; 
    }
    .emp-kpi-card.highlight { 
      background: #eff6ff; 
      border-color: #000000; 
    }
    .emp-kpi-card.due { 
      background: #ecfdf5; 
      border-color: #000000; 
    }
    .emp-kpi-label { font-size: 11px; font-weight: 900; color: #000000; margin-bottom: 4px; }
    .emp-kpi-val { font-size: 15px; font-weight: 900; font-family: monospace; color: #000000; }
    .emp-kpi-sub { font-size: 10px; color: #1e293b; font-weight: 800; }

    /* Transactions Table */
    table.emp-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 15px; 
      font-size: 12px; 
      border: 2px solid #000000; 
    }
    table.emp-table th { 
      background: ${headerAccentColor}; 
      color: #ffffff; 
      padding: 7px 6px; 
      font-weight: 900; 
      text-align: center; 
      border: 1.5px solid #000000; 
    }
    table.emp-table td { 
      padding: 6px 8px; 
      border: 1.5px solid #000000; 
      vertical-align: middle; 
      color: #000000;
      font-weight: 700;
    }
    table.emp-table tr:nth-child(even) { background-color: #f8fafc; }
    .td-center { text-align: center; }
    .td-num { font-family: monospace; font-weight: 900; text-align: center; }
    .td-credit { color: #047857; font-weight: 900; }
    .td-debit { color: #b91c1c; font-weight: 900; }
    .td-balance { color: #000000; font-weight: 900; font-size: 12.5px; }

    /* Summary Row in Table */
    .table-summary-row { background: #e2e8f0 !important; font-weight: 900; border-top: 2.5px solid #000000; }

    /* Signatures Section */
    .emp-signatures { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 12px; 
      margin-top: 25px; 
      page-break-inside: avoid; 
    }
    .emp-sig-box { 
      border: 1.5px solid #000000; 
      border-radius: 6px; 
      padding: 8px; 
      text-align: center; 
      min-height: 85px; 
      display: flex; 
      flex-direction: column; 
      justify-content: space-between; 
      background: #fafafa;
    }
    .emp-sig-title { font-size: 11px; font-weight: 900; color: #000000; }
    .emp-sig-line { border-bottom: 1.5px dashed #000000; margin-top: 30px; }
    .emp-sig-note { font-size: 9.5px; color: #000000; font-weight: 700; margin-top: 4px; }

    /* Bottom Disclaimer */
    .emp-footer-note { 
      margin-top: 15px; 
      padding-top: 8px; 
      border-top: 1.5px solid #000000; 
      display: flex; 
      justify-content: space-between; 
      font-size: 10.5px; 
      font-weight: 800;
      color: #000000; 
    }

    /* Automatic adaptation if printed on 80(72.1) x 297 mm thermal roll */
    @media (max-width: 95mm), print and (max-width: 95mm) {
      body { padding: ${tm}mm ${rm}mm ${bm}mm ${lm}mm !important; font-size: 10px !important; max-width: 72.1mm !important; margin: 0 auto !important; }
      .emp-stmt-container { max-width: 72.1mm !important; }
      .emp-profile-grid, .emp-kpi-row, .emp-signatures { grid-template-columns: repeat(2, 1fr) !important; gap: 4px !important; }
      table.emp-table { font-size: 9.5px !important; }
      table.emp-table th, table.emp-table td { padding: 2px 3px !important; }
    }
  </style>
</head>
<body>
  <div class="emp-stmt-container">
    <!-- Top 3-Column Header Matching Image -->
    <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 3px solid ${headerAccentColor};">
      <div style="text-align: right;">
        <div style="font-size: 17px; font-weight: 900; color: ${headerAccentColor}; line-height: 1.25;">${headerRight1}</div>
        ${s.companySubtitle && headerRight2 !== s.companySubtitle ? `<div style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 2px;">${s.companySubtitle}</div>` : ""}
        <div style="font-size: 14px; font-weight: 800; color: #000; margin-top: 2px;">${headerRight2}</div>
        <div style="font-size: 15px; font-weight: 800; color: #000; font-family: monospace, sans-serif; margin-top: 2px;">${headerRight3}</div>
      </div>
      <div style="text-align: center; padding: 0 10px;">
        <div style="width: 90px; height: 90px; border-radius: 50%; border: 2.5px solid ${headerAccentColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto; overflow: hidden; background: #ffffff;">
          ${(s.showLogo && logoUrl) 
            ? `<img src="${logoUrl}" alt="Logo" style="max-width:100%; max-height:100%; object-fit:contain;" />`
            : `<div style="font-size:11px; font-weight:900; color:${headerAccentColor}; text-align:center;">${companyName}</div>`
          }
        </div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 17px; font-weight: 900; color: ${headerAccentColor}; line-height: 1.25;">${headerLeft1}</div>
        <div style="font-size: 14px; font-weight: 800; color: #000; margin-top: 2px;">${headerLeft2}</div>
        <div style="font-size: 15px; font-weight: 800; color: #000; font-family: monospace, sans-serif; margin-top: 2px;">${headerLeft3}</div>
      </div>
    </div>

    <!-- Centered Statement Title -->
    <div style="text-align: center; font-size: 20px; font-weight: 900; color: ${headerAccentColor}; margin: 6px 0 4px 0;">
      ${docTitle || s.employeeHeaderText || "كشف حساب ومسير رواتب موظف"}
    </div>
    <div style="text-align: center; font-size: 17px; font-weight: 900; color: #000; margin: 0 0 10px 0;">
      الموظف : ${empName}
    </div>

    <!-- Sub-header Date Bar -->
    <div style="border-top: 2px solid #000; border-bottom: 1.5px solid #000; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; color: #000; margin-bottom: 12px; background: #ffffff;">
      <div dir="ltr" style="font-family: monospace;">${issueDateStr} ${issueTimeStr}</div>
      <div>من تاريخ ${fromDate} &nbsp; الى تاريخ ${toDate}</div>
    </div>

    <!-- Employee Profile Info Box -->
    <div class="emp-profile-box">
      <div class="emp-profile-title">
        <span>👤 الملف الشخصي والبيانات الوظيفية للموظف</span>
        <span style="color: #2563eb;">رقم كشف الحساب: STMT-EMP-${party?.id || '00'}-${Date.now().toString().slice(-4)}</span>
      </div>
      <div class="emp-profile-grid">
        <div class="emp-info-item">
          <span class="emp-info-label">اسم الموظف الثلاثي:</span>
          <span class="emp-info-value">${empName}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">الرقم الوظيفي (الكود):</span>
          <span class="emp-info-value font-mono">${empNumber}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">المسمى الوظيفي:</span>
          <span class="emp-info-value">${empPosition}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">الإدارة / القسم التابع له:</span>
          <span class="emp-info-value">${empDepartment}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">الراتب الأساسي الشهري:</span>
          <span class="emp-info-value font-mono" style="color:#2563eb;">${fmt(empBasicSalary)} ريال</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">رقم الهاتف / التواصل:</span>
          <span class="emp-info-value font-mono">${empPhone}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">تاريخ التعيين / المباشرة:</span>
          <span class="emp-info-value font-mono">${empHireDate}</span>
        </div>
        <div class="emp-info-item">
          <span class="emp-info-label">الحالة الوظيفية:</span>
          <span class="emp-info-value">${empStatus}</span>
        </div>
      </div>
    </div>

    <!-- Financial KPI Summary Cards -->
    <div class="emp-kpi-row">
      <div class="emp-kpi-card">
        <div class="emp-kpi-label">الرصيد الافتتاحي السابق</div>
        <div class="emp-kpi-val text-slate-700">${fmt(previousBalance)} <small style="font-size:10px;">ريال</small></div>
        <div class="emp-kpi-sub">ما قبل تاريخ ${fromDate}</div>
      </div>

      <div class="emp-kpi-card highlight">
        <div class="emp-kpi-label" style="color:#1d4ed8;">إجمالي الاستحقاقات والرواتب (+)</div>
        <div class="emp-kpi-val text-blue-700 font-bold">${fmt(totalCredit)} <small style="font-size:10px;">ريال</small></div>
        <div class="emp-kpi-sub">رواتب، مكافآت، وبدلات مستحقة</div>
      </div>

      <div class="emp-kpi-card" style="background: #fef2f2; border-color:#f87171;">
        <div class="emp-kpi-label" style="color:#b91c1c;">إجمالي الاستقطاعات والسلف (-)</div>
        <div class="emp-kpi-val text-rose-700 font-bold">${fmt(totalDebit)} <small style="font-size:10px;">ريال</small></div>
        <div class="emp-kpi-sub">سلف، عهد، جزاءات، وغياب</div>
      </div>

      <div class="emp-kpi-card due">
        <div class="emp-kpi-label" style="color:#047857;">صافي الرصيد المستحق النهائي</div>
        <div class="emp-kpi-val text-emerald-800 font-extrabold">${fmt(currentBalance)} <small style="font-size:10px;">ريال</small></div>
        <div class="emp-kpi-sub">${currentBalance >= 0 ? 'مستحق الدفع للموظف' : 'متبقي ذمة على الموظف'}</div>
      </div>
    </div>

    <!-- Detailed Transactions Table -->
    <table class="emp-table">
      <thead>
        <tr>
          <th style="width: 4%;">م</th>
          <th style="width: 10%;">التاريخ</th>
          <th style="width: 16%;">نوع الحركة / السند</th>
          <th style="width: 27%;">البيان والشرح التفصيلي</th>
          <th style="width: 11%;">المستحق (دائن +)</th>
          <th style="width: 11%;">المستقطع (مدين -)</th>
          <th style="width: 11%;">الرصيد التراكمي</th>
          <th style="width: 10%;">الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        <!-- Previous Balance Row -->
        <tr style="background-color: #f1f5f9;">
          <td class="td-center font-mono">0</td>
          <td class="td-center font-mono">${fromDate}</td>
          <td class="td-center font-bold" style="color: #475569;">رصيد افتتاحي سابق</td>
          <td style="font-weight: 600; color: #475569;">الرصيد المدور ما قبل بداية الفترة المحددة</td>
          <td class="td-num td-credit">${previousBalance > 0 ? fmt(previousBalance) : '—'}</td>
          <td class="td-num td-debit">${previousBalance < 0 ? fmt(Math.abs(previousBalance)) : '—'}</td>
          <td class="td-num td-balance" dir="ltr">${fmt(previousBalance)}</td>
          <td class="td-center text-slate-400">مدور</td>
        </tr>

        <!-- Transaction Rows -->
        ${transactions.length > 0 ? transactions.map((t: any, idx: number) => {
          const mType = getEmployeeMovementType(t);
          const isCred = Number(t.credit || 0) > 0;
          const isDeb = Number(t.debit || 0) > 0;
          return `
          <tr>
            <td class="td-center font-mono">${idx + 1}</td>
            <td class="td-center font-mono" dir="ltr">${(t.date || '').slice(0, 10)}</td>
            <td class="td-center font-bold" style="color: #1e293b;">
              <span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; background: ${isCred ? '#dbeafe' : '#fee2e2'}; color: ${isCred ? '#1e40af' : '#991b1b'};">
                ${mType}
              </span>
            </td>
            <td style="font-weight: 600;">${t.description || 'حركة مالية'}</td>
            <td class="td-num td-credit">${isCred ? fmt(t.credit) : '—'}</td>
            <td class="td-num td-debit">${isDeb ? fmt(t.debit) : '—'}</td>
            <td class="td-num td-balance" dir="ltr">${fmt(t.running_balance ?? t.runningBalance ?? 0)}</td>
            <td class="td-center" style="font-size: 10.5px; color: #64748b;">${t.notes || '—'}</td>
          </tr>
          `;
        }).join('') : `
          <tr>
            <td colspan="8" style="text-align: center; padding: 25px; font-weight: bold; color: #64748b; background: #f8fafc;">
              لا توجد حركات أو مسيرات مالية مسجلة لهذا الموظف خلال الفترة المحددة
            </td>
          </tr>
        `}

        <!-- Totals Row -->
        <tr class="table-summary-row">
          <td colspan="4" style="text-align: left; padding: 8px 12px; font-size: 12px;">
            <strong>إجمالي حركة الفترة الحالية:</strong> (${transactions.length} حركات)
          </td>
          <td class="td-num td-credit" style="font-size: 12.5px;">${fmt(totalCredit)}</td>
          <td class="td-num td-debit" style="font-size: 12.5px;">${fmt(totalDebit)}</td>
          <td class="td-num td-balance" style="font-size: 13px;" dir="ltr">${fmt(currentBalance)}</td>
          <td class="td-center font-bold">${currentBalance >= 0 ? 'مستحق' : 'متبقي'}</td>
        </tr>
      </tbody>
    </table>

    <!-- Official Signatures Box -->
    <div class="emp-signatures">
      <div class="emp-sig-box">
        <div class="emp-sig-title">إعداد ومراجعة شؤون الموظفين</div>
        <div class="emp-sig-line"></div>
        <div class="emp-sig-note">التوقيع والتاريخ</div>
      </div>

      <div class="emp-sig-box">
        <div class="emp-sig-title">المحاسب المالي المختص</div>
        <div class="emp-sig-line"></div>
        <div class="emp-sig-note">التوقيع والتاريخ</div>
      </div>

      <div class="emp-sig-box">
        <div class="emp-sig-title">اعتماد المدير العام / المالي</div>
        <div class="emp-sig-line"></div>
        <div class="emp-sig-note">الختم والتوقيع الرسمي</div>
      </div>

      <div class="emp-sig-box" style="border-color: #3b82f6; background: #eff6ff;">
        <div class="emp-sig-title" style="color: #1d4ed8;">إقرار وتوقيع الموظف بالاستلام</div>
        <div class="emp-sig-line" style="border-color: #3b82f6;"></div>
        <div class="emp-sig-note" style="color: #1d4ed8;">أقر بصحة الرصيد ومطابقته</div>
      </div>
    </div>

    <!-- Footer Disclaimer -->
    <div class="emp-footer-note" style="border-top-color: ${headerAccentColor};">
      <div>${s.employeeFooterText || `هذا الكشف وثيقة مالية رسمية معتمدة من نظام ${companyName}، وأي شطب أو تعديل يدوي يلغي صحتها.`}</div>
      <div>صفحة 1 من 1 • ${companyName}</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. STANDARD GENERAL STATEMENT (عملاء وموردين وحسابات عامة)
  // ─────────────────────────────────────────────────────────────
  const partyTitle = partyType === "customer" ? "العميل" : partyType === "supplier" ? "المورد" : partyType === "employee" ? "الموظف" : "الحساب";
  const partyName = party?.name || "حساب عام";
  const partyCode = party?.code || party?.id || "—";
  const partyPhone = party?.phone || "—";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب : ${partyName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 10mm 10mm 15mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', 'Cairo', sans-serif; color: #000; margin: 0; padding: 10px; font-size: 13px; background: #ffffff; }
    .stmt-container { width: 100%; max-width: 210mm; margin: 0 auto; }
    
    /* Top 3-Column Header Matching Image */
    .stmt-top-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding-bottom: 6px;
      margin-bottom: 4px;
    }
    .header-col-right { text-align: right; }
    .header-col-center { text-align: center; padding: 0 10px; }
    .header-col-left { text-align: left; }
    
    .brand-title { font-size: 17px; font-weight: 900; color: #000; line-height: 1.25; }
    .brand-sub { font-size: 14px; font-weight: 800; color: #000; margin-top: 2px; }
    .brand-phone { font-size: 15px; font-weight: 800; color: #000; font-family: monospace, sans-serif; margin-top: 2px; }
    
    .logo-circle-wrapper {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 2.5px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      overflow: hidden;
      background: #ffffff;
    }
    .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .logo-text { font-size: 11px; font-weight: 900; color: #000; text-align: center; }

    /* Centered Title Line */
    .stmt-title-center {
      text-align: center;
      font-size: 21px;
      font-weight: 900;
      color: #000;
      margin: 8px 0 10px 0;
      letter-spacing: 0.5px;
    }

    /* Date Bar Line Above Table */
    .stmt-date-bar {
      border-top: 2px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 5px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 800;
      color: #000;
      margin-bottom: 8px;
      background: #ffffff;
    }

    .account-info-box {
      border: 1px solid #000;
      padding: 6px 12px;
      margin-bottom: 8px;
      background: #fafafa;
      font-size: 12px;
    }
    .account-info-box table { width: 100%; border: none; }
    .account-info-box td { padding: 2px 4px; text-align: right; font-weight: bold; }
    
    /* Solid Blue Table Matching Image */
    .stmt-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      text-align: center;
      font-size: 13px;
      border: 2px solid #000;
    }
    .stmt-table th {
      background-color: ${headerAccentColor};
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      padding: 8px 4px;
      border: 1px solid #ffffff;
    }
    .stmt-table td {
      border: 1px solid #000000;
      padding: 6px 4px;
      font-weight: 700;
      color: #000;
    }
    
    .signatures-row { margin-top: 25px; text-align: center; font-weight: bold; display: flex; justify-content: space-between; gap: 15px; page-break-inside: avoid; }
    .sig-col { border: 1px solid #000; padding: 10px; flex: 1; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between; }
    .sig-line { border-bottom: 1px dashed #000; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="stmt-container">
    <!-- 1. Top 3-Column Header Matching Image -->
    <div class="stmt-top-grid" style="border-bottom: 3px solid ${headerAccentColor}; padding-bottom: 10px;">
      <div class="header-col-right">
        <div class="brand-title" style="color: ${headerAccentColor};">${headerRight1}</div>
        ${s.companySubtitle && headerRight2 !== s.companySubtitle ? `<div style="font-size:12px; font-weight:700; color:#334155;">${s.companySubtitle}</div>` : ""}
        <div class="brand-sub">${headerRight2}</div>
        <div class="brand-phone">${headerRight3}</div>
        ${s.showTaxNumber && s.taxNumber ? `<div style="font-size:11px; color:#475569;">الرقم الضريبي: ${s.taxNumber}</div>` : ""}
      </div>
      <div class="header-col-center">
        <div class="logo-circle-wrapper" style="border-color: ${headerAccentColor};">
          ${(s.showLogo && logoUrl) 
            ? `<img src="${logoUrl}" alt="Logo" class="logo-img" />`
            : `<div class="logo-text" style="color: ${headerAccentColor};">${companyName}</div>`
          }
        </div>
      </div>
      <div class="header-col-left">
        <div class="brand-title" style="color: ${headerAccentColor};">${headerLeft1}</div>
        <div class="brand-sub">${headerLeft2}</div>
        <div class="brand-phone">${headerLeft3}</div>
      </div>
    </div>

    <!-- 2. Centered Statement Title -->
    <div class="stmt-title-center" style="color: ${headerAccentColor}; margin-bottom: 2px;">
      ${docTitle || (partyType === "supplier" ? (s.supplierHeaderText || "كشف حساب مورد معتمد") : (s.customerHeaderText || "كشف حساب عميل معتمد"))}
    </div>
    <div style="text-align: center; font-size: 17px; font-weight: 900; color: #000; margin-bottom: 8px;">
      ${partyTitle} : ${partyName}
    </div>

    <!-- 3. Sub-header Date Bar -->
    <div class="stmt-date-bar">
      <div class="print-time-col font-mono" dir="ltr">${issueDateStr} ${issueTimeStr}</div>
      <div class="date-range-col">من تاريخ ${fromDate} &nbsp; الى تاريخ ${toDate}</div>
    </div>

    <!-- Account Details Banner -->
    <div class="account-info-box">
      <table>
        <tr>
          <td style="width: 15%;">رقم ${partyTitle}:</td>
          <td style="width: 35%; font-family: monospace;">${partyCode}</td>
          <td style="width: 15%;">اسم ${partyTitle}:</td>
          <td style="width: 35%; font-size: 13.5px; font-weight: 900;">${partyName}</td>
        </tr>
        <tr>
          <td>رقم الهاتف:</td>
          <td style="font-family: monospace;">${partyPhone}</td>
          <td>العملة المعتمدة:</td>
          <td>${currency === "all" ? "الكل (جميع العملات)" : currency === "SAR" ? "ريال سعودي (SAR)" : currency === "YER" ? "ريال يمني (YER)" : currency === "USD" ? "دولار أمريكي (USD)" : currency}</td>
        </tr>
      </table>
    </div>

    <!-- 4. Table matching image columns -->
    <table class="stmt-table">
      <thead>
        <tr>
          <th style="width: 6%;">الرقم</th>
          <th style="width: 12%;">التاريخ</th>
          <th style="width: 14%;">نوع السند</th>
          <th style="width: 36%;">التفاصيل</th>
          <th style="width: 11%;">عليه</th>
          <th style="width: 11%;">له</th>
          <th style="width: 10%;">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #f8fafc;">
          <td style="font-family: monospace;">0</td>
          <td style="font-family: monospace;">${fromDate}</td>
          <td style="font-weight: bold;">رصيد سابق</td>
          <td style="text-align: right; padding-right: 8px;">الرصيد الافتتاحي ما قبل الفترة المحددة</td>
          <td>${previousBalance > 0 ? `${fmt(previousBalance)}` : '—'}</td>
          <td>${previousBalance < 0 ? `${fmt(Math.abs(previousBalance))}` : '—'}</td>
          <td dir="ltr" style="font-weight: 900;">${fmt(previousBalance)}</td>
        </tr>
        ${transactions.length > 0 ? transactions.map((t: any, idx: number) => {
          const curStr = t.currency || "";
          const docType = t.type_name || t.voucher_type || t.type || (Number(t.debit || 0) > 0 ? 'سند صرف' : 'سند قبض');
          return `
          <tr>
            <td style="font-family: monospace;">${idx + 1}</td>
            <td dir="ltr" style="font-family: monospace;">${(t.date || '').slice(0, 10)}</td>
            <td>${docType}</td>
            <td style="text-align: right; padding-right: 8px;">${t.description || t.statement || 'حركة مالية'}</td>
            <td>${Number(t.debit || 0) > 0 ? `${fmt(t.debit)} ${curStr}` : '—'}</td>
            <td>${Number(t.credit || 0) > 0 ? `${fmt(t.credit)} ${curStr}` : '—'}</td>
            <td dir="ltr" style="font-weight: 900;">${fmt(t.running_balance ?? t.runningBalance ?? 0)} ${curStr}</td>
          </tr>
          `;
        }).join('') : `
          <tr>
            <td colspan="7" style="padding: 20px; color: #64748b;">لا توجد حركات مالية مسجلة خلال الفترة المحددة</td>
          </tr>
        `}
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="4" style="text-align: left; padding: 8px 12px; font-size: 13px;">إجمالي حركات الفترة الحالية:</td>
          <td style="color: #047857; font-size: 13px;">${fmt(totalDebit)}</td>
          <td style="color: #b91c1c; font-size: 13px;">${fmt(totalCredit)}</td>
          <td dir="ltr" style="font-size: 13.5px; font-weight: 900; color: #1e3a8a;">${fmt(currentBalance)}</td>
        </tr>
      </tbody>
    </table>

    ${currency === "all" && currencySummaries ? `
    <div style="margin-top: 15px; border: 1.5px solid #000; padding: 10px; background: #fafafa; border-radius: 4px; font-size: 11px;">
      <div style="font-weight: 900; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 4px; color: #1e3a8a;">
        إجمالي العمليات والأرصدة حسب العملات:
      </div>
      <table style="width: 100%; border-collapse: collapse; text-align: right;">
        <thead>
          <tr style="border-bottom: 1px solid #000; font-weight: bold; background-color: #e2e8f0;">
            <th style="padding: 4px; text-align: right; width: 40%;">العملة</th>
            <th style="padding: 4px; text-align: center; width: 20%;">إجمالي مدين</th>
            <th style="padding: 4px; text-align: center; width: 20%;">إجمالي دائن</th>
            <th style="padding: 4px; text-align: center; width: 20%;">صافي الرصيد المستحق</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(currencySummaries).map(([cur, summary]: [string, any]) => {
            if (summary.totalDebit === 0 && summary.totalCredit === 0) return '';
            const curLabel = cur === 'SAR' ? 'ريال سعودي (SAR)' : cur === 'YER' ? 'ريال يمني (YER)' : 'دولار أمريكي (USD)';
            return `
            <tr style="border-bottom: 1px dashed #cbd5e1; font-weight: bold;">
              <td style="padding: 5px 4px; color: #1e3a8a;">${curLabel}</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace; color: #047857;">${fmt(summary.totalDebit)}</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace; color: #b91c1c;">${fmt(summary.totalCredit)}</td>
              <td style="padding: 5px 4px; text-align: center; font-family: monospace; font-size: 12px; color: ${summary.balance < 0 ? '#b91c1c' : '#047857'};" dir="ltr">${fmt(summary.balance)}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${s.showSignatureBoxes !== false ? `
    <div class="signatures-row">
      <div class="sig-col">
        <div>المحاسب المختص</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-col">
        <div>المدير المالي</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-col">
        <div>توقيع واستلام ${partyTitle}</div>
        <div class="sig-line"></div>
      </div>
    </div>
    ` : ""}
    <div style="margin-top: 15px; padding-top: 8px; border-top: 2px solid ${headerAccentColor}; display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 800; color: #334155;">
      <div>${partyType === "supplier" ? (s.supplierFooterText || s.customerFooterText || "") : (s.customerFooterText || "")}</div>
      <div>${companyName}</div>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 3. PASSENGERS & PASSPORTS DIRECTORY A4 HTML (سجل المسافرين والجوازات)
// ─────────────────────────────────────────────────────────────
export function generatePassengersDirectoryA4Html(
  passengers: any[],
  options?: {
    customerName?: string;
    reportDate?: string;
    companyName?: string;
    filterTitle?: string;
  }
): string {
  const customerName = options?.customerName || "كافة العملاء والوكلاء";
  const reportDate = options?.reportDate || new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  const companyName = options?.companyName || "Omni System Pro ERP — نظام إدارة المؤسسات والعمليات";
  const reportTitle = options?.filterTitle || "سجل المسافرين ووثائق الجوازات (A4 PDF)";

  // Calculate stats for summary bar
  let urgentCount = 0;
  let warningCount = 0;
  let warning15Count = 0;
  let inMakkahCount = 0;

  const rowsHtml = passengers.map((p, idx) => {
    const pNameAr = p.name_ar || p.name || "---";
    const pNameEn = p.name_en || "---";
    const pPassport = p.passport_number || "---";
    const pNationality = p.nationality || "يمني";
    const pVisa = p.visa_type || "تأشيرة عمره";
    const pPhone = p.phone || "---";
    const pAgency = p.customer_name || customerName;
    const pTravelDate = (p.travel_date || p.entry_date || "---").replace(/-/g, "/");
    const pExitDate = (p.expected_exit_date || "---").replace(/-/g, "/");
    const pStatus = p.travel_status || "داخل مكة";
    const pDuration = p.program_duration_days ? `${p.program_duration_days} يوم` : (p.duration_days ? `${p.duration_days} يوم` : "---");

    if (pStatus === "داخل مكة" || !p.travel_status) inMakkahCount++;

    let daysSpent = 0;
    if (p.travel_date || p.entry_date) {
      const entryTime = new Date(p.travel_date || p.entry_date).getTime();
      if (!isNaN(entryTime)) {
        daysSpent = Math.max(0, Math.floor((Date.now() - entryTime) / (1000 * 60 * 60 * 24)));
      }
    }

    let remainingDays: number | null = null;
    if (p.remaining_days !== null && p.remaining_days !== undefined && p.remaining_days !== "") {
      remainingDays = Number(p.remaining_days);
    } else if (p.expected_exit_date) {
      const exitTime = new Date(p.expected_exit_date).getTime();
      if (!isNaN(exitTime)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        remainingDays = Math.ceil((exitTime - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    let rowStyle = "";
    let remBadge = "";
    if (remainingDays !== null) {
      if (remainingDays < 0) {
        urgentCount++;
        rowStyle = 'style="background-color: #fecaca; font-weight: bold; color: #000000;"';
        remBadge = `<span style="background:#dc2626; color:#ffffff; padding:1px 5px; border-radius:3px; font-size:9.5px;">متجاوز (${Math.abs(remainingDays)})</span>`;
      } else if (remainingDays <= 3) {
        urgentCount++;
        rowStyle = 'style="background-color: #fecaca; font-weight: bold; color: #000000;"';
        remBadge = `<span style="background:#ef4444; color:#ffffff; padding:1px 5px; border-radius:3px; font-size:9.5px;">${remainingDays} يوم (عاجل)</span>`;
      } else if (remainingDays <= 10) {
        warningCount++;
        rowStyle = 'style="background-color: #fef08a; font-weight: bold; color: #000000;"';
        remBadge = `<span style="background:#d97706; color:#ffffff; padding:1px 5px; border-radius:3px; font-size:9.5px;">${remainingDays} يوم (قريباً)</span>`;
      } else if (remainingDays <= 15) {
        warning15Count++;
        remBadge = `<span style="background:#6366f1; color:#ffffff; padding:1px 5px; border-radius:3px; font-size:9.5px;">${remainingDays} يوم (15 يوم)</span>`;
      } else {
        remBadge = `<span style="color:#059669; font-weight:bold;">${remainingDays} يوم</span>`;
      }
    } else {
      if (daysSpent >= 80) {
        urgentCount++;
        rowStyle = 'style="background-color: #fecaca; font-weight: bold; color: #000000;"';
      } else if (daysSpent >= 70) {
        warningCount++;
        rowStyle = 'style="background-color: #fef08a; font-weight: bold; color: #000000;"';
      }
      remBadge = `<span style="color:#64748b;">---</span>`;
    }

    const daysSpentBadge = daysSpent >= 80 
      ? `<span style="background:#fee2e2; color:#991b1b; border:1px solid #f87171; padding:1px 6px; border-radius:4px; font-weight:800;">${daysSpent} يوم</span>`
      : daysSpent >= 70 
      ? `<span style="background:#fef08a; color:#854d0e; border:1px solid #facc15; padding:1px 6px; border-radius:4px; font-weight:800;">${daysSpent} يوم</span>`
      : `<span style="color:#1e40af; font-weight:700;">${daysSpent} يوم</span>`;

    return `
      <tr ${rowStyle}>
        <td class="col-center font-mono">${idx + 1}</td>
        <td class="col-name font-bold">${pNameAr}</td>
        <td class="col-name font-mono text-[10.5px]">${pNameEn}</td>
        <td class="col-center font-mono font-bold">${pPassport}</td>
        <td class="col-center">${pNationality}</td>
        <td class="col-center">${pVisa}</td>
        <td class="col-center font-bold">${pStatus}</td>
        <td class="col-center font-mono">${pDuration}</td>
        <td class="col-center font-mono">${pTravelDate}</td>
        <td class="col-center font-mono font-bold">${daysSpentBadge}</td>
        <td class="col-center font-mono">${remBadge}</td>
        <td class="col-center font-mono font-bold">${pExitDate}</td>
        <td class="col-center font-mono" dir="ltr">${pPhone}</td>
        <td class="col-center font-semibold text-[10.5px]">${pAgency}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - ${customerName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: A4 landscape;
      margin: 8mm 8mm 10mm 8mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', 'Cairo', sans-serif;
      background: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-size: 11px;
      line-height: 1.35;
      padding: 6px;
    }
    .dir-container { width: 100%; margin: 0 auto; }
    .dir-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .dir-title h1 { font-size: 17px; font-weight: 900; color: #0f172a; }
    .dir-title p { font-size: 10.5px; color: #475569; }
    .dir-badge {
      background: #f1f5f9;
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 4px 16px;
      text-align: center;
    }
    .dir-badge h2 { font-size: 13.5px; font-weight: 900; color: #0f172a; }
    .dir-badge span { font-size: 10px; color: #2563eb; font-weight: 700; }

    .dir-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 8px;
      background: #f8fafc;
      padding: 5px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: bold;
    }

    table.dir-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      border: 1.5px solid #0f172a;
    }
    table.dir-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 3px;
      font-weight: bold;
      text-align: center;
      border: 1px solid #334155;
      font-size: 10.5px;
      white-space: nowrap;
    }
    table.dir-table td {
      padding: 4px 5px;
      border: 1px solid #cbd5e1;
      text-align: right;
      vertical-align: middle;
    }
    table.dir-table tr:nth-child(even) { background-color: #f8fafc; }
    .col-center { text-align: center !important; }
    .col-name { font-weight: 700; }

    .dir-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      font-size: 9.5px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="dir-container">
    <div class="dir-header">
      <div class="dir-title">
        <h1>${companyName}</h1>
        <p>إدارة المسافرين والجوازات • السجل المعتمد للرحلات والتأشيرات ومتابعة المعتمرين</p>
      </div>

      <div class="dir-badge">
        <h2>${reportTitle}</h2>
        <span>الجهة / الوكيل: ${customerName}</span>
      </div>

      <div style="font-size: 10px; text-align: left;">
        <div><strong>تاريخ التصدير:</strong> ${reportDate}</div>
        <div><strong>إجمالي السجلات:</strong> ${passengers.length} مسافر</div>
      </div>
    </div>

    <div class="dir-stats">
      <div>📊 إجمالي السجلات: <span style="color:#2563eb;">${passengers.length}</span></div>
      <div>🕋 داخل مكة المكرمة: <span style="color:#059669;">${inMakkahCount}</span></div>
      ${urgentCount > 0 ? `<div>🚨 إنذار عاجل (≤3 أيام / متجاوز): <span style="color:#dc2626;">${urgentCount}</span></div>` : ''}
      ${warningCount > 0 ? `<div>⚠️ اقتراب موعد (4-10 أيام): <span style="color:#d97706;">${warningCount}</span></div>` : ''}
      ${warning15Count > 0 ? `<div>⏱️ إنذار خروج (11-15 يوم): <span style="color:#4f46e5;">${warning15Count}</span></div>` : ''}
      <div>🏢 العميل / الوكالة المعتمدة: <span>${customerName}</span></div>
      <div>📅 تاريخ الاستخراج: <span>${reportDate}</span></div>
    </div>

    <table class="dir-table">
      <thead>
        <tr>
          <th style="width: 2.5%;">#</th>
          <th style="width: 14%;">الاسم بالعربي</th>
          <th style="width: 13%;">الاسم بالإنجليزي</th>
          <th style="width: 8%;">رقم الجواز</th>
          <th style="width: 6%;">الجنسية</th>
          <th style="width: 7%;">نوع التأشيرة</th>
          <th style="width: 7%;">حالة المسافر</th>
          <th style="width: 6%;">مدة السفر</th>
          <th style="width: 7%;">تاريخ الدخول</th>
          <th style="width: 6%;">المنقضية</th>
          <th style="width: 8%;">المتبقية</th>
          <th style="width: 7%;">الخروج المتوقع</th>
          <th style="width: 8.5%;">رقم الهاتف</th>
          <th style="width: 10%;">العميل / الوكيل</th>
        </tr>
      </thead>
      <tbody>
        ${passengers.length > 0 ? rowsHtml : `
          <tr>
            <td colspan="14" class="col-center" style="padding: 20px; color: #64748b; font-weight: bold;">
              لا توجد سجلات مسافرين مسجلة تطابق معايير البحث
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="dir-footer">
      <div>تم استخراج وتصدير هذا الملف كنسخة PDF معتمدة من نظام Omni System Pro ERP</div>
      <div>صفحة 1 من 1 • كشف وبيانات المسافرين والجوازات</div>
      <div>ختم وتوقيع قسم التأشيرات والعمليات: __________________</div>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 4. SINGLE PASSENGER PASSPORT CARD A4/A5 HTML (استمارة وبيانات المسافر)
// ─────────────────────────────────────────────────────────────
export function generateSinglePassengerCardA4Html(
  p: any,
  options?: { companyName?: string }
): string {
  const companyName = options?.companyName || "Omni System Pro ERP — نظام إدارة المؤسسات والعمليات";
  const pNameAr = p.name_ar || p.name || "---";
  const pNameEn = p.name_en || "---";
  const pPassport = p.passport_number || "---";
  const pNationality = p.nationality || "يمني";
  const pVisa = p.visa_type || "تأشيرة عمره";
  const pPhone = p.phone || "---";
  const pAgency = p.customer_name || "الفرع الرئيسي";
  const pTravelDate = (p.travel_date || "---").replace(/-/g, "/");
  const pExitDate = (p.expected_exit_date || "---").replace(/-/g, "/");
  const pDuration = p.program_duration_days || p.duration_days || 90;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بطاقة مسافر وجواز سفر - ${pNameAr}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', 'Cairo', sans-serif; color: #0f172a; padding: 15px; font-size: 13px; }
    .card-box { border: 2px solid #0f172a; border-radius: 8px; padding: 18px; max-width: 650px; margin: 0 auto; }
    .card-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
    .card-header h1 { font-size: 18px; font-weight: 900; }
    .card-header h2 { font-size: 15px; color: #2563eb; font-weight: 800; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
    .item { border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; background: #f8fafc; }
    .item-label { font-size: 11px; color: #64748b; font-weight: bold; }
    .item-val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    .barcode-box { text-align: center; border-top: 1.5px dashed #cbd5e1; padding-top: 15px; margin-top: 15px; }
    .barcode-sim { font-family: monospace; letter-spacing: 4px; font-size: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card-box">
    <div class="card-header">
      <h1>${companyName}</h1>
      <h2>استمارة وبطاقة بيانات المسافر والجواز</h2>
      <p style="font-size: 11px; color: #64748b;">وثيقة بيانات رسمية معتمدة لحامل الجواز</p>
    </div>

    <div class="grid">
      <div class="item">
        <div class="item-label">اسم المسافر بالعربي:</div>
        <div class="item-val">${pNameAr}</div>
      </div>
      <div class="item">
        <div class="item-label">اسم المسافر بالإنجليزي:</div>
        <div class="item-val font-mono">${pNameEn}</div>
      </div>
      <div class="item">
        <div class="item-label">رقم جواز السفر:</div>
        <div class="item-val font-mono" style="color:#2563eb;">${pPassport}</div>
      </div>
      <div class="item">
        <div class="item-label">الجنسية:</div>
        <div class="item-val">${pNationality}</div>
      </div>
      <div class="item">
        <div class="item-label">نوع التأشيرة / الخدمة:</div>
        <div class="item-val">${pVisa}</div>
      </div>
      <div class="item">
        <div class="item-label">مدة البرنامج (أيام):</div>
        <div class="item-val font-mono">${pDuration} يوم</div>
      </div>
      <div class="item">
        <div class="item-label">تاريخ الدخول / السفر:</div>
        <div class="item-val font-mono">${pTravelDate}</div>
      </div>
      <div class="item">
        <div class="item-label">تاريخ الخروج المتوقع:</div>
        <div class="item-val font-mono">${pExitDate}</div>
      </div>
      <div class="item">
        <div class="item-label">الوكيل / العميل التابع له:</div>
        <div class="item-val">${pAgency}</div>
      </div>
      <div class="item">
        <div class="item-label">رقم الهاتف / التواصل:</div>
        <div class="item-val font-mono">${pPhone}</div>
      </div>
    </div>

    <div class="barcode-box">
      <div class="barcode-sim">||| | ||||| || |||||| | |||| ||| ${pPassport} |||</div>
      <p style="font-size: 10px; color: #64748b; margin-top: 6px;">تم التصدير كملف PDF معتمد • نظام إدارة المسافرين والجوازات</p>
    </div>
  </div>
</body>
</html>`;
}

export function generateTransactionA4Html(params: {
  visa: any;
  settings?: any;
  docTitle?: string;
}) {
  const { visa, settings = {}, docTitle } = params;
  const s = getEffectiveDocPrintSettings(settings);

  const bizName = s.headerRightText1 || s.companyName || "Omni System Pro ERP";
  const subtitle = s.companySubtitle || "خدمات التأشيرات وحجوزات السفر الدولية";
  const showLogo = s.showLogo;
  const logo = (showLogo && s.logoUrl) ? `<img src="${s.logoUrl}" style="max-height:85px;max-width:180px;object-fit:contain;" alt="Logo" />` : "";
  const accentColor = s.accentColor || "#0f172a";

  const appNum = visa.service_voucher_no || visa.application_number || visa.visa_number || `VSA-${visa.id}`;
  const title = docTitle || "سند قيد واستلام معاملة خدمات سفر وتأشيرات";

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return '💵 نقداً (الصندوق)';
      case 'credit': return '⏳ آجل (حساب العميل / ذمم)';
      case 'bank': return '💳 تحويل بنكي';
      case 'card': return '💳 شبكة مدى / بطاقة';
      case 'cheque': return '📑 شيك بنكي';
      default: return '💵 نقداً';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': case 'issued': return '✅ تم إصدار التأشيرة';
      case 'under_process': return '⏳ قيد المعالجة بالسفارة';
      case 'in_office': return '🏢 في المكتب (قيد التجهيز)';
      case 'pending_docs': return '⚠️ بانتظار استكمال الوثائق';
      case 'appointment_booked': return '📅 تم حجز موعد البصمة';
      case 'delivered': return '🤝 تم التسليم للعميل';
      case 'rejected': return '❌ مرفوضة من السفارة';
      case 'cancelled': return '🚫 ملغية';
      default: return status || 'قيد الإجراء';
    }
  };

  const sellPrice = Number(visa.selling_price || 0);
  const paid = Number(visa.paid_amount || 0);
  const rem = Number(visa.remaining_balance !== undefined ? visa.remaining_balance : (sellPrice - paid));
  const curr = visa.customer_currency || "SAR";

  const headerRight = [
    { label: "العنوان", value: s.companyAddress },
    { label: "الهاتف", value: s.companyPhone },
    { label: "الجوال", value: s.companyMobile },
    { label: "البريد الإلكتروني", value: s.companyEmail },
    { label: "السجل التجاري", value: s.companyCR },
    { label: "الرقم الضريبي", value: s.companyTaxNumber },
  ].filter(i => i.value);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${appNum}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 5px;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .voucher-container {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      padding: 16px;
      border-radius: 8px;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${accentColor};
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .header-right { flex: 1.2; text-align: right; font-size: 8.5pt; color: #334155; }
    .header-center { flex: 1.2; text-align: center; }
    .header-left { flex: 1.2; text-align: left; font-size: 8.5pt; color: #334155; }
    .biz-name { font-size: 15pt; font-weight: 900; color: ${accentColor}; margin-bottom: 2px; }
    .biz-sub { font-size: 9pt; font-weight: 700; color: #475569; }
    
    .doc-banner {
      background: ${accentColor};
      color: #ffffff;
      text-align: center;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13pt;
      font-weight: 800;
      margin-bottom: 14px;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .section-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .section-header {
      background: #f1f5f9;
      padding: 6px 10px;
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-body {
      padding: 10px;
      font-size: 9.5pt;
    }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 12px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px 10px; }
    
    .field-row { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding-bottom: 3px; }
    .field-label { font-weight: 700; color: #475569; }
    .field-value { font-weight: 800; color: #0f172a; }
    
    .fin-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    .fin-table th, .fin-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: center;
      font-size: 9pt;
    }
    .fin-table th {
      background: #f8fafc;
      font-weight: 800;
      color: #0f172a;
    }
    
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 8.5pt;
      color: #92400e;
      margin-bottom: 12px;
    }
    
    .terms-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 8pt;
      color: #475569;
      background: #fafafa;
      line-height: 1.5;
      margin-bottom: 14px;
    }
    
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20px;
      padding: 0 10px;
      text-align: center;
    }
    .sig-col { width: 28%; }
    .sig-title { font-weight: 800; font-size: 9pt; color: #1e293b; margin-bottom: 40px; }
    .sig-line { border-top: 1px solid #475569; padding-top: 4px; font-weight: 700; font-size: 8.5pt; color: #334155; }
    .stamp-box {
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      height: 65px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #64748b;
      font-size: 8.5pt;
    }
    
    .footer-bar {
      margin-top: 14px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="voucher-container">
    <!-- Header -->
    <div class="header-box">
      <div class="header-right">
        <div class="biz-name">${bizName}</div>
        <div class="biz-sub">${subtitle}</div>
        ${headerRight.map(i => `<div><strong>${i.label}:</strong> ${i.value}</div>`).join('')}
      </div>
      <div class="header-center">
        ${logo}
      </div>
      <div class="header-left">
        <div style="font-weight:900; font-size:11pt; color:${accentColor}; margin-bottom:4px;">
          رقم السند: <span dir="ltr">${appNum}</span>
        </div>
        <div><strong>تاريخ الإصدار:</strong> ${visa.application_date || new Date().toISOString().slice(0, 10)}</div>
        <div><strong>الموظف المسؤول:</strong> ${visa.responsible_employee || 'قسم المعاملات والتأشيرات'}</div>
        <div><strong>طريقة السداد:</strong> <span style="font-weight:bold; color:#0f172a;">${getPaymentLabel(visa.payment_method)}</span></div>
      </div>
    </div>

    <!-- Title Banner -->
    <div class="doc-banner">
      <span>${title}</span>
      <span style="font-size:10pt; font-weight:700; background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:4px;">
        الحالة: ${getStatusLabel(visa.status)}
      </span>
    </div>

    <!-- Section 1: Customer & Passenger Info -->
    <div class="section-box">
      <div class="section-header">
        <span>👤 1. بيانات العميل والمسافر (صاحب الجواز)</span>
        <span style="font-weight:normal; font-size:8.5pt;">الطرف الأول / المستفيد</span>
      </div>
      <div class="section-body">
        <div class="grid-2">
          <div class="field-row">
            <span class="field-label">اسم العميل (المفوّض):</span>
            <span class="field-value">${visa.customer_name || 'عميل نقدي عام'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">هاتف العميل:</span>
            <span class="field-value" dir="ltr">${visa.customer_phone || visa.phone || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">اسم المسافر (عربي):</span>
            <span class="field-value">${visa.passenger_name_ar || visa.passenger_name || visa.customer_name || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">اسم المسافر (English):</span>
            <span class="field-value" dir="ltr">${visa.passenger_name_en || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">رقم جواز السفر:</span>
            <span class="field-value" dir="ltr" style="letter-spacing:1px; color:#1e3a8a;">${visa.passport_number || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">الجنسية:</span>
            <span class="field-value">${visa.passenger_nationality || visa.nationality || 'يمني'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Visa Specifications -->
    <div class="section-box">
      <div class="section-header">
        <span>🛂 2. مواصفات وبيانات التأشيرة والمعاملة</span>
        <span style="font-weight:normal; font-size:8.5pt;">الجهة المنفذة والبلد</span>
      </div>
      <div class="section-body">
        <div class="grid-3">
          <div class="field-row">
            <span class="field-label">نوع التأشيرة / المعاملة:</span>
            <span class="field-value" style="color:#047857;">${visa.visa_type || 'تأشيرة عمرة'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">دولة الوجهة:</span>
            <span class="field-value">${visa.country || 'المملكة العربية السعودية'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">مدة الإقامة المصرحة:</span>
            <span class="field-value">${visa.duration_days ? `${visa.duration_days} يوم` : '30 يوم'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">تاريخ التقديم:</span>
            <span class="field-value" dir="ltr">${visa.application_date || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">تاريخ السفر المتوقع:</span>
            <span class="field-value" dir="ltr">${visa.expected_travel_date || '---'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">المكتب المفوض / الشريك:</span>
            <span class="field-value">${visa.supplier_office_name || visa.supplier_agent || 'وكالتنا المباشرة'}</span>
          </div>
          ${visa.issued_visa_number ? `
          <div class="field-row" style="grid-column: span 2;">
            <span class="field-label">رقم التأشيرة الصادرة:</span>
            <span class="field-value" style="color:#047857;" dir="ltr">${visa.issued_visa_number}</span>
          </div>` : ''}
          ${visa.border_number ? `
          <div class="field-row">
            <span class="field-label">رقم الحدود:</span>
            <span class="field-value" dir="ltr">${visa.border_number}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Section 3: Financial & Payment Info -->
    <div class="section-box">
      <div class="section-header">
        <span>💰 3. البيانات المالية وطريقة الدفع والسداد</span>
        <span style="font-weight:bold; color:${visa.payment_method === 'credit' ? '#b45309' : '#047857'};">
          ${getPaymentLabel(visa.payment_method)}
        </span>
      </div>
      <div class="section-body">
        <table class="fin-table">
          <thead>
            <tr>
              <th>بيان المعاملة والخدمة</th>
              <th>سعر الخدمة (الإجمالي)</th>
              <th>طريقة الدفع</th>
              <th>المسدد / المقبوض</th>
              <th>المتبقي (الذمة)</th>
              <th>العملة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:right; font-weight:700;">
                ${visa.customer_statement || `معاملة ${visa.visa_type || 'تأشيرة'} - ${visa.country || 'السعودية'} للمسافر ${visa.passenger_name_ar || visa.customer_name || ''}`}
              </td>
              <td style="font-weight:900; font-size:10pt;">${sellPrice.toLocaleString()}</td>
              <td style="font-weight:800; color:#1e293b;">${getPaymentLabel(visa.payment_method)}</td>
              <td style="font-weight:800; color:#047857;">${paid.toLocaleString()}</td>
              <td style="font-weight:800; color:${rem > 0 ? '#b91c1c' : '#047857'};">${rem.toLocaleString()}</td>
              <td style="font-weight:800;">${curr}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 4: Missing Docs and Notes -->
    ${(visa.missing_docs || visa.notes) ? `
    <div class="notes-box">
      ${visa.missing_docs ? `<div><strong>⚠️ الوثائق والمستندات الناقصة:</strong> ${visa.missing_docs}</div>` : ''}
      ${visa.notes ? `<div><strong>📌 الملاحظات ومواعيد البصمة:</strong> ${visa.notes}</div>` : ''}
    </div>` : ''}

    <!-- Section 5: Terms -->
    <div class="terms-box">
      <strong>تنبيهات وشروط هامة:</strong>
      <ul>
        <li>يجب على العميل والمسافر التحقق من صحة كافة البيانات المدونة في التأشيرة فور استلامها وقبل موعد السفر.</li>
        <li>الوكالة مسؤولة عن إجراءات التقديم والمتابعة الرسمية، وتخضع فترات المعالجة والموافقات لاختصاص السفارات والجهات القنصلية المختصة.</li>
        <li>يُعتبر هذا السند مستنداً رسمياً لإثبات المعاملة والقيد المالي وطريقة السداد المقيدة بالنظام.</li>
      </ul>
    </div>

    <!-- Signatures -->
    <div class="signatures-row">
      <div class="sig-col">
        <div class="sig-title">توقيع واستلام العميل</div>
        <div class="sig-line">الاسم: ...............................</div>
      </div>
      <div class="sig-col">
        <div class="stamp-box">
          الختم الرسمي المعتمد
        </div>
      </div>
      <div class="sig-col">
        <div class="sig-title">مسؤول قسم التأشيرات / الإدارة</div>
        <div class="sig-line">${visa.responsible_employee || 'المحاسب المعتمد'}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-bar">
      <div>نظام Omni System Pro ERP لإدارة المخازن والمبيعات والحسابات المتكامل</div>
      <div>تمت الطباعة بتاريخ: ${new Date().toLocaleString('ar-SA')}</div>
      <div>صفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>`;
}



export function generateFinancialA4Html({ type, startDate, endDate }: any) {
  const isPL = type === 'pl';
  const title = isPL ? "قائمة الأرباح والخسائر" : "الميزانية العمومية";
  
  const fromDate = startDate ? new Date(startDate).toLocaleDateString('en-GB') : "01/01/2026";
  const toDate = endDate ? new Date(endDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  let rowsHtml = '';
  if (isPL) {
    rowsHtml = `
      <tr style="background-color: #f1f5f9; font-weight: bold;"><td colspan="2" style="border: 1px solid #000; padding: 5px; text-align: right;">الإيرادات</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">إيرادات مبيعات البضائع</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">2,026,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">إيرادات الخدمات والحجوزات</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">850,500.00</td></tr>
      <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 5px; text-align: left;">إجمالي الإيرادات</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">2,876,500.00</td></tr>
      
      <tr style="background-color: #f1f5f9; font-weight: bold;"><td colspan="2" style="border: 1px solid #000; padding: 5px; text-align: right;">المصروفات</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">تكلفة البضاعة المباعة</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">1,200,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">مصروفات عمومية وإدارية</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">450,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">مصروفات رواتب وأجور</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">280,000.00</td></tr>
      <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 5px; text-align: left;">إجمالي المصروفات</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">1,930,000.00</td></tr>
      
      <tr style="background-color: #cffafe; font-weight: bold; font-size: 16px;"><td style="border: 1px solid #000; padding: 5px; text-align: left;">صافي الربح / (الخسارة)</td><td style="border: 1px solid #000; padding: 5px; color: #16a34a;" dir="ltr">946,500.00</td></tr>
    `;
  } else {
    rowsHtml = `
      <tr style="background-color: #f1f5f9; font-weight: bold;"><td colspan="2" style="border: 1px solid #000; padding: 5px; text-align: right;">الأصول</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">الأصول المتداولة (النقدية والبنوك)</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">3,450,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">الذمم المدينة (العملاء)</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">1,250,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">الأصول الثابتة (صافي)</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">2,800,000.00</td></tr>
      <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 5px; text-align: left;">إجمالي الأصول</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">7,500,000.00</td></tr>
      
      <tr style="background-color: #f1f5f9; font-weight: bold;"><td colspan="2" style="border: 1px solid #000; padding: 5px; text-align: right;">الخصوم وحقوق الملكية</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">الذمم الدائنة (الموردين)</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">2,100,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">أرصدة دائنة أخرى</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">453,500.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">رأس المال</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">4,000,000.00</td></tr>
      <tr><td style="border: 1px solid #000; padding: 5px; text-align: right;">أرباح مرحلة (صافي ربح الفترة)</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">946,500.00</td></tr>
      <tr style="font-weight: bold;"><td style="border: 1px solid #000; padding: 5px; text-align: left;">إجمالي الخصوم وحقوق الملكية</td><td style="border: 1px solid #000; padding: 5px;" dir="ltr">7,500,000.00</td></tr>
    `;
  }

  return `
  <div style="font-family: 'Tajawal', sans-serif; max-width: 100%; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px;">${title}</h2>
    
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; font-size: 14px; font-weight: bold;">
      <div>ص 1</div>
      <div>من تاريخ ${fromDate} &nbsp;&nbsp;&nbsp; الى تاريخ ${toDate}</div>
      <div></div>
    </div>

    <table style="width: 100%; border: 2px solid #000; border-collapse: collapse; text-align: center; font-size: 14px;">
      <thead>
        <tr style="background-color: ${isPL ? '#dcfce7' : '#e0e7ff'};">
          <th style="border: 1px solid #000; padding: 10px; width: 70%;">البيان</th>
          <th style="border: 1px solid #000; padding: 10px; width: 30%;">القيمة (ريال)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="margin-top: 50px; position: relative;">
      <div style="position: absolute; left: 10px; top: 0px; font-weight: bold; text-align: center;">
        المحاسب<br/>
        التوقيع
      </div>
      <div style="position: absolute; right: 10px; top: 0px; font-weight: bold; text-align: center;">
        المدير المالي<br/>
        التوقيع
      </div>
    </div>
  </div>
  `;
}

export function generateTrialBalanceA4Html({ accounts, startDate, endDate }: any) {
  const fromDate = startDate ? new Date(startDate).toLocaleDateString('en-GB') : "01/01/2026";
  const toDate = endDate ? new Date(endDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  let totalOpenDebit = 0; let totalOpenCredit = 0;
  let totalPeriodDebit = 0; let totalPeriodCredit = 0;
  let totalEndDebit = 0; let totalEndCredit = 0;

  const rowsHtml = accounts.map((acc:any) => {
    const obd = Number(acc.opening_debit || 0);
    const obc = Number(acc.opening_credit || 0);
    const pd = Number(acc.period_debit || (acc.balance > 0 ? acc.balance : 0));
    const pc = Number(acc.period_credit || (acc.balance < 0 ? Math.abs(acc.balance) : 0));
    const ed = obd + pd;
    const ec = obc + pc;
    
    totalOpenDebit += obd; totalOpenCredit += obc;
    totalPeriodDebit += pd; totalPeriodCredit += pc;
    totalEndDebit += ed; totalEndCredit += ec;

    return `
      <tr>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(ec).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(ed).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(pc).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(pd).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(obc).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(obd).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;">${acc.name}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;">${acc.code || acc.id || '-'}</td>
      </tr>
    `;
  }).join('');

  return `
  <div style="font-family: 'Tajawal', sans-serif; max-width: 100%; margin: 0 auto;">
    <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px;">ميزان المراجعة</h2>
    
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; font-size: 14px; font-weight: bold;">
      <div>ص 1</div>
      <div>من تاريخ ${fromDate} &nbsp;&nbsp;&nbsp; الى تاريخ ${toDate}</div>
      <div></div>
    </div>

    <table style="width: 100%; border: 2px solid #000; border-collapse: collapse; text-align: center; font-size: 13px;">
      <thead>
        <tr style="background-color: #fed7aa;">
          <th style="border: 1px solid #000; padding: 5px;" colspan="2">الرصيد</th>
          <th style="border: 1px solid #000; padding: 5px;" colspan="2">الرصيد خلال الفترة</th>
          <th style="border: 1px solid #000; padding: 5px;" colspan="2">الرصيد الافتتاحي</th>
          <th style="border: 1px solid #000; padding: 5px;" rowspan="2">اسم الحساب</th>
          <th style="border: 1px solid #000; padding: 5px;" rowspan="2">رقم الحساب</th>
        </tr>
        <tr style="background-color: #fed7aa;">
          <th style="border: 1px solid #000; padding: 5px;">دائن</th>
          <th style="border: 1px solid #000; padding: 5px;">مدين</th>
          <th style="border: 1px solid #000; padding: 5px;">دائن</th>
          <th style="border: 1px solid #000; padding: 5px;">مدين</th>
          <th style="border: 1px solid #000; padding: 5px;">دائن</th>
          <th style="border: 1px solid #000; padding: 5px;">مدين</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr style="background-color: #fed7aa; font-weight: bold;">
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalEndCredit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalEndDebit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalPeriodCredit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalPeriodDebit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalOpenCredit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px;" dir="ltr">${Number(totalOpenDebit).toLocaleString()}</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center;" colspan="2">إجماليات</td>
        </tr>
      </tbody>
    </table>
    
    <div style="font-size: 14px; margin-top: 5px; text-align: right;">0</div>

    <div style="margin-top: 50px; position: relative;">
      <div style="position: absolute; left: 10px; top: 0px; font-weight: bold; text-align: center;">
        المختص<br/>
        التوقيع
      </div>
    </div>
  </div>
  `;
}


export function generateVoucherStyle2A4Html(params: {
  type: "receipt" | "payment";
  voucherNumber?: string | number;
  date?: string;
  time?: string;
  safeName?: string;
  partyName?: string;
  partyCode?: string;
  amount?: number | string;
  amountWords?: string;
  currency?: string;
  exchangeRate?: number | string;
  paymentMethod?: string;
  checkNumber?: string;
  bankName?: string;
  checkDate?: string;
  notes?: string;
  referenceNo?: string | number;
  detailsNote?: string;
  costCenter?: string;
  accountCode?: string;
  accountName?: string;
  settings?: any;
}) {
  const {
    type,
    voucherNumber = "1",
    date,
    time = "10:30",
    safeName = "صندوق رئيسي",
    partyName = "",
    partyCode = "",
    amount = 0,
    amountWords = "",
    currency = "SAR",
    exchangeRate = 1,
    paymentMethod = "cash",
    checkNumber = "",
    bankName = "",
    checkDate = "",
    notes = "",
    referenceNo = "1",
    detailsNote = "",
    costCenter = "المركز الرئيسي",
    accountCode = "",
    accountName = "",
    settings
  } = params;

  const s = getEffectiveDocPrintSettings(settings);
  const isReceipt = type === "receipt";
  const titleAr = isReceipt ? (s.voucherReceiptTitle || "سند قبض") : (s.voucherPaymentTitle || "سند صرف");
  const titleEn = isReceipt ? "RECEIPT VOUCHER" : "PAYMENT VOUCHER";
  const actionLabel = isReceipt ? "تسلمنا من المكرم / السادة:" : "إصرفوا للمكرم / السادة:";
  const partyLabelEn = isReceipt ? "Received From Mr./Messrs:" : "Pay to Mr./Messrs:";

  // Dynamic Theme from document print settings
  const accentColor = s.voucherAccentColor || s.accentColor || "#8b1d2c";
  const burgundyAccent = accentColor;
  const badgeColor = accentColor;

  const headerRight1 = s.headerRightText1 || s.companyName || "اسم النشاط التجاري";
  const headerRight2 = s.headerRightText2 || s.companySubtitle || "وصف اختياري - إدارة المخازن والحسابات";
  const headerRight3 = s.headerRightText3 || s.companyPhone || "04-541474 - 773449820";
  const headerLeft1 = s.headerLeftText1 || s.companyName || "";
  const headerLeft2 = s.headerLeftText2 || "";
  const headerLeft3 = s.headerLeftText3 || "";

  const logoUrl = s.logoUrl;
  const logo = (s.showLogo && logoUrl) 
    ? `<img src="${logoUrl}" style="max-height:75px;max-width:85px;object-fit:contain;" alt="Logo" />` 
    : `<div style="color:${accentColor}; font-size:11px; font-weight:900; text-align:center;">${s.companyName || "الشعار"}</div>`;

  let currSymbol = "ر.س";
  let currName = "ريال سعودي";
  if (currency === "YER" || currency.includes("يمني") || currency === "ر.ي") {
    currSymbol = "ر.ي";
    currName = "ريال يمني";
  } else if (currency === "USD" || currency.includes("دولار") || currency === "$") {
    currSymbol = "$";
    currName = "دولار أمريكي";
  } else if (currency === "SAR" || currency.includes("سعودي") || currency === "ر.س") {
    currSymbol = "ر.س";
    currName = "ريال سعودي";
  }

  const numAmount = Number(amount) || 0;
  const intPart = Math.floor(numAmount);
  const decPart = Math.round((numAmount - intPart) * 100);
  const formattedAmount = numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedInt = intPart.toLocaleString('en-US');
  const formattedDec = decPart < 10 ? `0${decPart}` : `${decPart}`;

  const words = amountWords || tafqeet(numAmount, currency);

  let formattedDate = new Date().toISOString().slice(0, 10);
  if (date) {
    if (date.includes("-")) {
      formattedDate = date;
    } else {
      formattedDate = date;
    }
  }

  const isCash = paymentMethod === "cash" || paymentMethod === "نقدي" || !paymentMethod;
  const isCheck = paymentMethod === "check" || paymentMethod === "شيك";
  const isBank = paymentMethod === "bank" || paymentMethod === "transfer" || paymentMethod === "تحويل" || paymentMethod === "شبكة";

  const paymentLabelAr = isCash ? "نقداً (صندوق)" : isCheck ? "بموجب شيك بنكي" : "حوالة / تحويل بنكي";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${titleAr} - ${voucherNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 8px;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .voucher-card {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      border: 3.5px solid ${burgundyAccent};
      border-radius: 18px;
      overflow: hidden;
      background: #ffffff;
      position: relative;
    }
    
    /* Top Burgundy Arched Banner matching Image 2 */
    .top-burgundy-banner {
      background: ${burgundyAccent};
      color: #ffffff;
      padding: 30px 40px 50px 40px;
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom-left-radius: 40px 15px;
      border-bottom-right-radius: 80px 45px;
    }
    .header-text-right {
      flex: 1;
      text-align: left;
    }
    .header-text-right .biz-title {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 2px;
    }
    .header-text-right .biz-desc {
      font-size: 12.5px;
      font-weight: 700;
      color: #fecdd3;
    }

    /* Protruding Top-Right Circle Badge */
    .top-right-circle-badge {
      width: 125px;
      height: 125px;
      border-radius: 50%;
      background: #ffffff;
      border: 4px solid ${burgundyAccent};
      position: absolute;
      right: 45px;
      top: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Sub-header Controls & Metadata Row matching Image 2 */
    .voucher-meta-row {
      padding: 12px 20px 8px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .meta-date-no-col {
      text-align: right;
    }
    .date-shaded-box {
      background: #fdf2f2;
      border: 1px solid #fca5a5;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 900;
      color: ${burgundyAccent};
      font-size: 13px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .voucher-no-text {
      font-size: 14px;
      font-weight: 900;
      color: ${burgundyAccent};
      font-family: monospace;
    }
    .voucher-badge {
      display: inline-block;
      background: ${badgeColor};
      color: #ffffff;
      padding: 5px 22px;
      border-radius: 20px;
      margin-top: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.12);
      text-align: center;
    }
    .voucher-badge .title-ar {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .voucher-badge .title-en {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1px;
      opacity: 0.95;
    }
    
    .header-col-left {
      flex: 1.1;
      text-align: left;
      line-height: 1.5;
      direction: ltr;
    }
    .header-col-left .co-name-en {
      font-size: 12.5px;
      font-weight: 900;
      color: #0f172a;
    }
    .header-col-left .co-sub-en {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
    }
    .header-col-left .co-tel-en {
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }

    /* Metadata Bar with Amount Box Matching Image 1 */
    .meta-box-container {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      gap: 12px;
    }
    .meta-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      font-size: 11px;
    }
    .meta-line {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-lbl {
      font-weight: 800;
      color: #475569;
      min-width: 65px;
    }
    .meta-val {
      font-weight: 900;
      color: #0f172a;
    }
    
    /* Bank-grade Amount Box */
    .amount-display-box {
      border: 1.5px solid ${accentColor};
      border-radius: 6px;
      background: #ffffff;
      padding: 4px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 170px;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
    }
    .amount-display-box .amt-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #64748b;
      margin-bottom: 2px;
    }
    .amount-split-grid {
      display: flex;
      align-items: center;
      direction: ltr;
      gap: 6px;
    }
    .amt-int {
      font-size: 16px;
      font-weight: 900;
      font-family: monospace;
      color: ${accentColor};
    }
    .amt-dec {
      font-size: 13px;
      font-weight: 800;
      font-family: monospace;
      color: #64748b;
      border-left: 1px solid #cbd5e1;
      padding-left: 4px;
    }
    .amt-curr {
      font-size: 11px;
      font-weight: 900;
      color: #1e293b;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
    }

    /* Core Voucher Body Rows */
    .voucher-body-section {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      padding: 10px 12px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .body-field-row {
      display: flex;
      align-items: baseline;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 6px;
      gap: 10px;
    }
    .field-label-text {
      font-weight: 900;
      font-size: 11.5px;
      color: #1e293b;
      min-width: 140px;
      display: flex;
      flex-direction: column;
    }
    .field-label-text small {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.3px;
    }
    .field-value-content {
      flex: 1;
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
    }
    .tafqeet-highlight {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 4px 8px;
      color: #166534;
      font-weight: 900;
      font-size: 11.5px;
    }

    /* Accounting & Entry Grid Table */
    .accounting-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 11px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .accounting-table th, .accounting-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: center;
    }
    .accounting-table th {
      background: ${accentColor};
      color: #ffffff;
      font-weight: 900;
      font-size: 11px;
    }
    .accounting-table tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Signatures Section with 4 Boxes & Stamp */
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 14px;
      margin-bottom: 10px;
      text-align: center;
    }
    .sig-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 4px;
      min-height: 70px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
    }
    .sig-card-title {
      font-size: 10px;
      font-weight: 800;
      color: #1e293b;
    }
    .sig-card-line {
      border-bottom: 1px dashed #64748b;
      margin: 18px 8px 2px 8px;
    }
    .stamp-container {
      border: 2px dashed ${accentColor};
      border-radius: 6px;
      height: 70px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: ${accentColor};
      font-size: 10px;
      background: #fff;
    }

    .voucher-footer {
      margin-top: 8px;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      font-size: 9.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Modern Styled Classes matching شکل2 لي سندات الصرف او القبض .png */
    .center-title-badge {
      background: ${burgundyAccent};
      color: #ffffff;
      padding: 8px 38px;
      border-radius: 8px 24px 8px 24px;
      font-size: 19px;
      font-weight: 900;
      text-align: center;
      display: inline-block;
      box-shadow: 0 4px 10px rgba(139, 29, 44, 0.25);
      transform: skewX(-8deg);
      border: 1px solid #ffffff;
    }

    .top-amount-currency-boxes {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }
    .box-labeled {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .box-labeled label {
      font-size: 11px;
      font-weight: 900;
      color: ${burgundyAccent};
    }
    .box-value-frame {
      background: #fdf2f2;
      border: 1.5px solid #fca5a5;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 900;
      color: ${burgundyAccent};
      text-align: center;
      min-width: 90px;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.04);
    }

    .voucher-body-form {
      background: #ffffff;
      padding: 24px 30px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .form-line-row {
      display: flex;
      align-items: baseline;
      width: 100%;
      gap: 12px;
    }
    .line-label {
      font-weight: 900;
      font-size: 15px;
      color: ${burgundyAccent};
      white-space: nowrap;
    }
    .line-dotted-fill {
      flex: 1;
      border-bottom: 2px dotted #fca5a5;
      font-weight: 800;
      font-size: 14px;
      color: #0f172a;
      padding-bottom: 3px;
      line-height: 1.8;
    }

    .tafqeet-pink-container {
      background: #fdf2f2;
      border: 1.5px solid #fca5a5;
      border-radius: 8px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: ${burgundyAccent};
      font-weight: 900;
      font-size: 14.5px;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
    }
    .tafqeet-words-text {
      flex: 1;
      font-size: 14.5px;
      text-align: right;
    }
    .tafqeet-tail-text {
      font-size: 13.5px;
      font-weight: 900;
      color: ${burgundyAccent};
      border-right: 1.5px solid #fca5a5;
      padding-right: 14px;
      margin-right: 14px;
    }

    .payment-options-row {
      display: flex;
      align-items: center;
      gap: 24px;
      background: #fdf2f2;
      border: 1.5px solid #fca5a5;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 900;
      font-size: 13.5px;
      color: ${burgundyAccent};
    }
    .check-option-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .check-box-square {
      width: 18px;
      height: 18px;
      border: 1.8px solid ${burgundyAccent};
      background: #ffffff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 12px;
      color: ${burgundyAccent};
    }

    .signatures-footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      font-weight: 900;
      font-size: 14px;
      color: ${burgundyAccent};
      border-top: 1px dashed #cbd5e1;
      margin-top: 10px;
    }

    .bottom-accent-stripes {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #ffffff;
      margin-top: auto;
    }
    .bottom-accent-stripes .stripe-1 {
      background: ${burgundyAccent};
      color: #ffffff;
      padding: 8px 24px;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }
    .bottom-accent-stripes .stripe-2 {
      background: ${burgundyAccent};
      color: #ffffff;
      padding: 8px 24px;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="voucher-card">
    <!-- 1. Top Burgundy Arched Banner with Protruding Circle Badge -->
    <div class="top-burgundy-banner">
      <div class="header-text-right">
        <div class="biz-title">${headerRight1}</div>
        <div class="biz-desc">${headerRight2}</div>
      </div>

      <div class="top-right-circle-badge">
        ${logo}
      </div>
    </div>

    <!-- 2. Sub-header Controls & Metadata Row -->
    <div class="voucher-meta-row">
      <div class="meta-date-no-col">
        <div class="date-shaded-box">التاريخ : <span dir="ltr" class="font-mono">${formattedDate}</span> م</div>
        <div class="voucher-no-text">NO: ${voucherNumber}</div>
      </div>

      <div>
        <div class="center-title-badge">${titleAr}</div>
      </div>

      <div class="top-amount-currency-boxes">
        <div class="box-labeled">
          <label>المبلغ</label>
          <div class="box-value-frame">${formattedAmount}</div>
        </div>
        <div class="box-labeled">
          <label>العملة</label>
          <div class="box-value-frame" style="min-width: 75px;">${currSymbol}</div>
        </div>
      </div>
    </div>

    <!-- 3. Core Form Fields matching Image 2 -->
    <div class="voucher-body-form">
      <div class="form-line-row">
        <div class="line-label">${actionLabel}</div>
        <div class="line-dotted-fill">
          ${partyName || "..................................................................................................................."} &nbsp; المحترم
        </div>
      </div>

      <div class="form-line-row">
        <div class="line-label">مبلغ وقدره:</div>
        <div style="flex: 1;">
          <div class="tafqeet-pink-container">
            <div class="tafqeet-words-text">${words}</div>
            <div class="tafqeet-tail-text">فقط لاغير</div>
          </div>
        </div>
      </div>

      <div class="payment-options-row">
        <div class="check-option-box">
          <span>نقداً</span>
          <div class="check-box-square">${isCash ? '✓' : ''}</div>
        </div>
        <div class="check-option-box">
          <span>حواله</span>
          <div class="check-box-square">${isBank ? '✓' : ''}</div>
        </div>
        <div class="check-option-box">
          <span>شيك</span>
          <div class="check-box-square">${isCheck ? '✓' : ''}</div>
        </div>
        <div style="margin-right: auto; display: flex; gap: 10px;">
          <span>رقم : <strong class="font-mono" style="color:#0f172a;">${checkNumber || referenceNo || '............'}</strong></span>
          <span>عبر: <strong style="color:#0f172a;">${bankName || safeName || '............'}</strong></span>
        </div>
      </div>

      <div class="form-line-row">
        <div class="line-label">وذلك مقابل:</div>
        <div class="line-dotted-fill">
          ${notes || detailsNote || "............................................................................................................................................................"}
        </div>
      </div>

      <div class="form-line-row">
        <div class="line-dotted-fill" style="min-height: 20px;">
          ............................................................................................................................................................................................................
        </div>
      </div>
    </div>

    <!-- 4. Signatures & Footer -->
    <div class="signatures-footer-row">
      ${s.voucherFooterText ? `<div style="width:100%; text-align:center; font-weight:800; color:${accentColor}; margin-bottom:6px;">${s.voucherFooterText}</div>` : `
      <div>المحاسب : .............................................................</div>
      <div>التوقيع: .............................................................</div>
      `}
    </div>

    <div class="bottom-accent-stripes">
      <div class="stripe-1">📍 ${headerRight1} ${headerRight2 ? `• ${headerRight2}` : "• المركز الرئيسي"} ${headerLeft1 && headerLeft1 !== headerRight1 ? `| ${headerLeft1}` : ""}</div>
      <div class="stripe-2">📞 ${headerRight3}${headerLeft3 ? ` | ${headerLeft3}` : ""}</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateVoucherA4Html(params: {
  type: "receipt" | "payment";
  voucherNumber?: string | number;
  date?: string;
  time?: string;
  safeName?: string;
  partyName?: string;
  partyCode?: string;
  amount?: number | string;
  amountWords?: string;
  currency?: string;
  exchangeRate?: number | string;
  paymentMethod?: string;
  checkNumber?: string;
  bankName?: string;
  checkDate?: string;
  notes?: string;
  referenceNo?: string | number;
  detailsNote?: string;
  costCenter?: string;
  accountCode?: string;
  accountName?: string;
  settings?: any;
  templateStyle?: "style1" | "style2";
}) {
  // Use Style 2 as standard high-fidelity layout matching Image 1
  return generateVoucherStyle2A4Html(params);
}


export function generateJournalVoucherA4Html(params: {
  voucherNumber?: string | number;
  date?: string;
  docType?: string;
  userName?: string;
  description?: string;
  currency?: string;
  referenceNo?: string | number;
  lines?: Array<{
    account_code?: string;
    account_name?: string;
    analytical?: string;
    description?: string;
    cost_center?: string;
    currency?: string;
    debit?: number | string;
    credit?: number | string;
  }>;
  agencyName?: string;
  agencyAddress?: string;
  settings?: any;
}) {
  const s = getEffectiveDocPrintSettings(params.settings);
  const {
    voucherNumber = "3",
    date = "29/08/2026",
    docType = "نوع الوثيقة",
    userName = "علي احمد محمد اليمني",
    description = "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
    currency = "ريال سعودي",
    referenceNo = "8",
    lines = [],
    agencyName = s.headerRightText1 || s.companyName || "اسم النشاط التجاري",
    agencyAddress = s.headerRightText2 || s.address || "",
  } = params;
  const accentColor = s.accentColor || "#1e3a8a";
  const journalTitle = s.voucherJournalTitle || "سند قيد يومية";
  const logoHtml = (s.showLogo && s.logoUrl)
    ? `<img src="${s.logoUrl}" alt="Logo" style="max-height:60px; max-width:90px; object-fit:contain;" />`
    : "";

  let formattedDate = "29/08/2026";
  if (date) {
    if (date.includes("-")) {
      const parts = date.split("-");
      if (parts.length === 3) {
        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        formattedDate = new Date(date).toLocaleDateString('en-GB');
      }
    } else {
      formattedDate = date;
    }
  }

  let currName = currency;
  let currSymbol = "ر.س";
  if (currency === "YER" || currency.includes("يمني") || currency === "ر.ي") {
    currName = "ريال يمني";
    currSymbol = "ر.ي";
  } else if (currency === "USD" || currency.includes("دولار") || currency === "$") {
    currName = "دولار أمريكي";
    currSymbol = "$";
  } else if (currency === "SAR" || currency.includes("سعودي") || currency === "ر.س") {
    currName = "ريال سعودي";
    currSymbol = "ر.س";
  }

  const sampleLines = lines && lines.length > 0 ? lines : [
    {
      account_code: "41101001",
      analytical: "",
      account_name: "ايراد مبيعات البضائع",
      description: description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
      cost_center: "",
      currency: currSymbol,
      debit: 695,
      credit: 0
    },
    {
      account_code: "11100",
      analytical: "",
      account_name: "الصندوق الرئيسي",
      description: description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
      cost_center: "",
      currency: currSymbol,
      debit: 0,
      credit: 695
    }
  ];

  let totalDebit = 0;
  let totalCredit = 0;

  sampleLines.forEach(l => {
    totalDebit += Number(l.debit || 0);
    totalCredit += Number(l.credit || 0);
  });

  const fmt = (num: number) => {
    if (!num || num === 0) return "";
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>سند قيد يومية - ${voucherNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #000;
      margin: 0;
      padding: 5px;
      font-size: 13.5px;
      background: #fff;
      direction: rtl;
    }
    .sheet-container {
      width: 100%;
      max-width: 195mm;
      margin: 0 auto;
    }
    .top-double-bar {
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      height: 3px;
      margin-bottom: 6px;
    }
    .top-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .page-indicator {
      font-size: 14px;
      font-weight: bold;
    }
    .main-sheet-title {
      font-size: 22px;
      font-weight: 900;
      text-align: center;
      flex: 1;
    }
    .header-metadata-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      gap: 15px;
    }
    .right-metadata-box {
      flex: 1;
      max-width: 58%;
    }
    .bordered-doc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-bottom: 6px;
      background: #fff;
    }
    .bordered-doc-table td {
      border: 1px solid #000;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 13px;
    }
    .doc-type-label {
      width: 90px;
      background: #f8fafc;
      text-align: center;
    }
    .doc-type-val {
      font-weight: 800;
    }
    .doc-no-label {
      width: 70px;
      background: #f8fafc;
      text-align: center;
    }
    .doc-no-val {
      width: 50px;
      text-align: center;
      font-family: monospace;
      font-size: 14px;
    }
    .doc-date-label {
      width: 80px;
      background: #f8fafc;
      text-align: center;
    }
    .doc-date-val {
      font-family: monospace;
      font-size: 13px;
      text-align: center;
    }
    .statement-row {
      display: flex;
      align-items: flex-start;
      font-size: 13.5px;
      font-weight: bold;
      margin-top: 4px;
      gap: 10px;
    }
    .statement-label {
      min-width: 45px;
      color: #000;
    }
    .statement-val {
      color: #000;
      line-height: 1.4;
    }
    .left-metadata-info {
      min-width: 35%;
      font-size: 13.5px;
      font-weight: bold;
      line-height: 2.2;
      text-align: right;
    }
    .left-info-row {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 15px;
    }
    .left-info-label {
      min-width: 80px;
    }
    .left-info-val {
      font-family: inherit;
    }
    .jv-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      margin-top: 4px;
      margin-bottom: 25px;
      font-size: 12px;
    }
    .jv-table th {
      background-color: #c7d2fe;
      border: 1px solid #000;
      padding: 5px 4px;
      font-weight: 900;
      text-align: center;
      font-size: 12.5px;
    }
    .jv-table td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-weight: bold;
      vertical-align: middle;
    }
    .jv-table td.col-idx {
      text-align: center;
      width: 32px;
    }
    .jv-table td.col-code {
      text-align: center;
      font-family: monospace;
      font-size: 12px;
      width: 85px;
    }
    .jv-table td.col-ana {
      text-align: center;
      width: 55px;
    }
    .jv-table td.col-name {
      text-align: right;
      width: 170px;
    }
    .jv-table td.col-desc {
      text-align: right;
    }
    .jv-table td.col-cc {
      text-align: center;
      width: 70px;
    }
    .jv-table td.col-curr {
      text-align: center;
      width: 50px;
    }
    .jv-table td.col-num {
      text-align: center;
      font-family: monospace;
      font-size: 13px;
      width: 75px;
    }
    .totals-row td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-weight: 900;
    }
    .totals-label {
      text-align: center;
      font-size: 13px;
      font-weight: 900;
    }
    .footer-flex-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 30px;
      padding: 0 10px;
    }
    .agency-box-footer {
      border: 1.5px solid #000;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 12.5px;
      line-height: 1.6;
      text-align: right;
      background: #fff;
    }
    .doc-bottom-tag {
      font-size: 13px;
      font-weight: bold;
      margin-top: 6px;
      text-align: right;
    }
    .signatures-box {
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      line-height: 2.2;
      min-width: 120px;
    }
  </style>
</head>
<body>
  <div class="sheet-container">
    <!-- Top Branded Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; margin-bottom:6px; border-bottom:2.5px solid ${accentColor};">
      <div style="text-align:right; flex:1;">
        <div style="font-size:16px; font-weight:900; color:${accentColor};">${s.headerRightText1 || agencyName}</div>
        ${s.companySubtitle ? `<div style="font-size:11.5px; font-weight:700; color:#475569;">${s.companySubtitle}</div>` : ""}
        ${s.headerRightText2 ? `<div style="font-size:11.5px; font-weight:700;">${s.headerRightText2}</div>` : ""}
        ${s.headerRightText3 ? `<div style="font-size:11.5px; font-family:monospace; font-weight:700;">${s.headerRightText3}</div>` : ""}
      </div>
      <div style="text-align:center; padding:0 10px;">
        ${logoHtml}
      </div>
      <div style="text-align:left; flex:1;" dir="ltr">
        <div style="font-size:15px; font-weight:900; color:${accentColor};">${s.headerLeftText1 || s.companyName || ""}</div>
        ${s.headerLeftText2 ? `<div style="font-size:11.5px; font-weight:700;">${s.headerLeftText2}</div>` : ""}
        ${s.headerLeftText3 ? `<div style="font-size:11.5px; font-family:monospace; font-weight:700;">${s.headerLeftText3}</div>` : ""}
      </div>
    </div>

    <!-- Header Row -->
    <div class="top-header-row">
      <div style="width: 50px;"></div>
      <div class="main-sheet-title" style="color:${accentColor};">${journalTitle}</div>
      <div class="page-indicator">ص 1</div>
    </div>

    <!-- Metadata Section -->
    <div class="header-metadata-grid">
      <!-- Right Box -->
      <div class="right-metadata-box">
        <table class="bordered-doc-table">
          <tr>
            <td class="doc-type-label">نوع الوثيقة</td>
            <td colspan="3" class="doc-type-val">${userName || "علي احمد محمد اليمني"}</td>
          </tr>
          <tr>
            <td class="doc-no-label">رقم السند</td>
            <td class="doc-no-val">${voucherNumber}</td>
            <td class="doc-date-label">تاريخ السند</td>
            <td class="doc-date-val">${formattedDate}</td>
          </tr>
        </table>

        <div class="statement-row">
          <span class="statement-label">البيان</span>
          <span class="statement-val">${description}</span>
        </div>
      </div>

      <!-- Left Info -->
      <div class="left-metadata-info">
        <div class="left-info-row">
          <span class="left-info-label">عملة القيد</span>
          <span class="left-info-val">${currName}</span>
        </div>
        <div class="left-info-row">
          <span class="left-info-label">رقم المرجع</span>
          <span class="left-info-val">${referenceNo || "—"}</span>
        </div>
      </div>
    </div>

    <!-- Table of Entries Matching Image 22 -->
    <table class="jv-table">
      <thead>
        <tr>
          <th style="width: 32px;">م</th>
          <th style="width: 85px;">رقم الحساب</th>
          <th style="width: 55px;">تحليلي</th>
          <th style="width: 170px;">اسم الحساب</th>
          <th>البيان</th>
          <th style="width: 70px;">مركز التكلفة</th>
          <th style="width: 50px;">العملة</th>
          <th style="width: 75px;">مدين</th>
          <th style="width: 75px;">دائن</th>
        </tr>
      </thead>
      <tbody>
        ${sampleLines.map((line, idx) => `
          <tr>
            <td class="col-idx">${idx + 1}</td>
            <td class="col-code">${line.account_code || ""}</td>
            <td class="col-ana">${line.analytical || ""}</td>
            <td class="col-name">${line.account_name || ""}</td>
            <td class="col-desc">${line.description || description || ""}</td>
            <td class="col-cc">${line.cost_center || ""}</td>
            <td class="col-curr">${line.currency || currSymbol}</td>
            <td class="col-num">${fmt(Number(line.debit || 0))}</td>
            <td class="col-num">${fmt(Number(line.credit || 0))}</td>
          </tr>
        `).join("")}

        <!-- Totals Row Matching Image 22 -->
        <tr class="totals-row">
          <td colspan="5" style="border: none; border-top: 1px solid #000;"></td>
          <td colspan="2" class="totals-label">اجماليات</td>
          <td class="col-num" style="background: #f8fafc; font-weight: 900;">${fmt(totalDebit)}</td>
          <td class="col-num" style="background: #f8fafc; font-weight: 900;">${fmt(totalCredit)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer Signatures & Agency Box -->
    <div class="footer-flex-section">
      <!-- Right Signatures -->
      <div class="signatures-box">
        ${s.voucherFooterText || "المختص / التوقيع"}
      </div>

      <!-- Left Agency Box -->
      <div>
        <div class="agency-box-footer" style="border-color:${accentColor};">
          <div style="color:${accentColor};">${agencyName}</div>
          <div style="font-size: 11px; margin-top: 2px;">${agencyAddress}</div>
        </div>
        <div class="doc-bottom-tag">${journalTitle}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function generateVisitorsStatusReportA4Html(
  passengers: any[],
  options?: {
    customerName?: string;
    reportDate?: string;
    companyName?: string;
    filterTitle?: string;
  }
): string {
  const customerName = options?.customerName || "محمد اليمني";
  const reportDate = options?.reportDate || new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  const companyName = options?.companyName || "نظام إدارة المسافرين وتأشيرات العمرة";
  const reportTitle = options?.filterTitle || "تقرير حالة الزائرين";

  // Helper to calculate days spent
  const getDaysSpent = (travelDate: string | null | undefined): number => {
    if (!travelDate) return 0;
    const entryDate = new Date(travelDate);
    if (isNaN(entryDate.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    entryDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - entryDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const sortedPassengers = [...passengers].sort((a, b) => {
    const daysSpentA = getDaysSpent(a.travel_date || a.entry_date);
    const daysSpentB = getDaysSpent(b.travel_date || b.entry_date);
    return daysSpentB - daysSpentA;
  });

  const rowsHtml = sortedPassengers.map((p) => {
    const pName = p.name_ar || p.name_en || p.name || "---";
    const pPassport = p.passport_number || "---";
    const pType = p.visa_type || "تأشيرة عمره";
    const pDuration = p.program_duration_days || p.duration_days || 90;
    const pEntryDate = (p.travel_date || p.entry_date || "").replace(/-/g, "/");
    const pExitDate = (p.expected_exit_date || "").replace(/-/g, "/");
    const pDaysSpent = getDaysSpent(p.travel_date || p.entry_date);

    let pRemainingStr = "---";
    if (p.remaining_days !== null && p.remaining_days !== undefined && p.remaining_days !== "") {
      const rem = Number(p.remaining_days);
      if (rem < 0) {
        pRemainingStr = `${Math.abs(rem)}-`;
      } else {
        pRemainingStr = `${rem}`;
      }
    } else if (p.expected_exit_date) {
      const exitTime = new Date(p.expected_exit_date).getTime();
      if (!isNaN(exitTime)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((exitTime - today.getTime()) / (1000 * 60 * 60 * 24));
        pRemainingStr = diff < 0 ? `${Math.abs(diff)}-` : `${diff}`;
      }
    }

    let rowStyle = "";
    if (pDaysSpent >= 80) {
      rowStyle = 'style="background-color: #ffd2d2; font-weight: bold; color: #000000;"';
    } else if (pDaysSpent >= 70) {
      rowStyle = 'style="background-color: #ffff00; font-weight: bold; color: #000000;"';
    }

    return `
      <tr ${rowStyle}>
        <td class="col-name">${pName}</td>
        <td class="col-center font-mono font-bold">${pPassport}</td>
        <td class="col-center">${pType}</td>
        <td class="col-center font-bold">${pDuration}</td>
        <td class="col-center font-mono">${pEntryDate || "---"}</td>
        <td class="col-center font-bold">${pDaysSpent} يوم</td>
        <td class="col-center font-bold font-mono">${pRemainingStr}</td>
        <td class="col-center font-mono">${pExitDate || "---"}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - ${customerName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Tajawal', 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #ffffff;
      color: #000000;
      direction: rtl;
      font-size: 13px;
      line-height: 1.4;
      padding: 8px;
    }
    .report-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
    }
    .report-header-box {
      text-align: center;
      margin-bottom: 22px;
      padding-top: 5px;
    }
    .report-main-title {
      font-size: 24px;
      font-weight: 900;
      color: #000000;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .report-customer-line {
      font-size: 16px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 4px;
    }
    .report-date-line {
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      margin-bottom: 12px;
    }
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      border: 1.5px solid #000000;
    }
    table.report-table th,
    table.report-table td {
      border: 1.5px solid #000000;
      padding: 7px 6px;
      color: #000000;
      vertical-align: middle;
    }
    table.report-table th {
      background-color: #ffffff;
      color: #000000;
      font-weight: 800;
      font-size: 12.5px;
      text-align: center;
      white-space: normal;
      line-height: 1.35;
    }
    table.report-table td {
      color: #000000;
      font-size: 12.5px;
      line-height: 1.3;
    }
    .col-name {
      text-align: right;
      font-weight: 800;
      font-size: 13px;
      width: 25%;
      padding-right: 10px !important;
    }
    .col-center {
      text-align: center;
    }
    .font-mono {
      font-family: inherit;
    }
    .font-bold {
      font-weight: 700;
    }
    .report-footer {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      color: #334155;
      padding-top: 8px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header-box">
      <h1 class="report-main-title">${reportTitle}</h1>
      <div class="report-customer-line">العميل ${customerName}</div>
      <div class="report-date-line">التاريخ : ${reportDate}</div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 25%;">اسم المعتمر</th>
          <th style="width: 12%;">رقم الجواز</th>
          <th style="width: 10%;">النوع</th>
          <th style="width: 9%;">مدة<br>السفر<br>(فترة<br>البرنامج)</th>
          <th style="width: 11%;">تاريخ<br>الدخول<br>(السفر)</th>
          <th style="width: 11%;">الأيام<br>المنقضية<br>داخل<br>مكة</th>
          <th style="width: 10%;">الأيام<br>المتبقية<br>على<br>الخروج</th>
          <th style="width: 12%;">تاريخ<br>الخروج<br>المتوقع</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="8" style="text-align:center; padding: 25px; font-weight:bold;">لا توجد بيانات للعرض</td></tr>`}
      </tbody>
    </table>

    <div class="report-footer">
      <div>إجمالي المعتمرين في التقرير: <strong>${passengers.length}</strong></div>
      <div>نظام متابعة تأشيرات العمرة والرقابة - ${companyName}</div>
      <div>صفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateSalesReturnVoucherA4Html(ret: any, settings?: any): string {
  const s = getEffectiveDocPrintSettings(settings);
  const bizName = s.headerRightText1 || s.companyName || "اسم النشاط التجاري";
  const subtitle = s.headerRightText2 || s.companySubtitle || "نظام المبيعات والحسابات المتكامل";
  const phone = s.headerRightText3 || s.companyPhone || "";
  const address = s.companyAddress || s.headerLeftText2 || "";
  const taxNumber = s.companyTaxNumber || s.taxNumber || "310123456700003";
  const logoUrl = s.logoUrl || "";
  const accentColor = s.accentColor || "#1e3a8a";

  const returnNo = ret?.return_number || ret?.returnNumber || "RET-1001";
  const invoiceNo = ret?.invoice_number || ret?.invoiceNumber || "—";
  const dateStr = ret?.created_at ? new Date(ret.created_at).toLocaleString("ar-SA") : new Date().toLocaleString("ar-SA");
  const returnType = ret?.return_type || ret?.returnType || "مردود مبيعات نقدي";

  let paymentLabel = "نقداً (الصندوق)";
  if (ret?.payment_method === "credit" || ret?.payment_method === "أجل") {
    paymentLabel = "حساب العميل / الموظف (آجل)";
  } else if (ret?.payment_method === "card" || ret?.payment_method === "bank") {
    paymentLabel = "بطاقة / تحويل بنكي";
  }

  const customerName = ret?.customer_name || ret?.customerName || "عميل نقدي عام";
  const cashierName = ret?.cashier_name || ret?.cashierName || ret?.user_name || "مدير النظام";
  const items = ret?.items || ret?.return_items || [];

  const totalRefund = Number(ret?.total_refund || ret?.totalRefund || 0);
  const taxRefund = Number(ret?.tax || (totalRefund > 0 ? Math.round((totalRefund - (totalRefund / 1.15)) * 100) / 100 : 0));
  const subtotalRefund = Number(ret?.subtotal || Math.round((totalRefund - taxRefund) * 100) / 100);
  const words = tafqeet(totalRefund, "SAR");

  const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rowsHtml = items.map((it: any, idx: number) => {
    const code = it.item_code || it.product_id || `ITM-${idx + 1}`;
    const name = it.product_name || it.productName || "صنف";
    const unit = it.unit || "حبة";
    const qty = Number(it.quantity || 0);
    const price = Number(it.unit_price ?? it.unitPrice ?? 0);
    const total = Number(it.total ?? (price * qty));
    return `
      <tr>
        <td style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${idx + 1}</td>
        <td style="padding: 8px; text-align: center; font-family: monospace; border: 1px solid #cbd5e1;">${code}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold; border: 1px solid #cbd5e1;">${name}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1;">${unit}</td>
        <td style="padding: 8px; text-align: center; font-weight: bold; color: #dc2626; border: 1px solid #cbd5e1;">${qty}</td>
        <td style="padding: 8px; text-align: center; font-family: monospace; border: 1px solid #cbd5e1;">${fmtNum(price)}</td>
        <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1;">${fmtNum(total)}</td>
      </tr>
    `;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>سند مردود مبيعات - ${returnNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 15px;
      font-size: 12px;
      line-height: 1.5;
    }
    .return-card {
      width: 100%;
      max-width: 200mm;
      margin: 0 auto;
      border: 2px solid ${accentColor};
      border-radius: 12px;
      padding: 20px;
      background: #ffffff;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid ${accentColor};
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    .biz-title { font-size: 20px; font-weight: 900; color: ${accentColor}; }
    .biz-sub { font-size: 12px; font-weight: 700; color: #475569; margin-top: 2px; }
    .tax-num { font-size: 11px; color: #64748b; margin-top: 2px; }

    .doc-badge { text-align: left; }
    .doc-title { font-size: 18px; font-weight: 900; color: #dc2626; letter-spacing: 0.5px; }
    .doc-no { font-size: 15px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 2px; }
    .doc-date { font-size: 11px; color: #64748b; margin-top: 2px; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 15px;
      font-size: 11.5px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-lbl { font-size: 10px; font-weight: 700; color: #64748b; }
    .meta-val { font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 1px; }

    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 11.5px;
    }
    table.items-table th {
      background: #f1f5f9;
      color: #0f172a;
      padding: 8px;
      font-weight: 900;
      text-align: center;
      border: 1px solid #cbd5e1;
    }

    .summary-box {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-top: 10px;
    }
    .notes-side {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
      font-size: 11px;
    }
    .totals-side {
      min-width: 240px;
      border: 1.5px solid ${accentColor};
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
      font-size: 12px;
    }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; }
    .grand-total { border-top: 2px solid ${accentColor}; border-bottom: none; font-size: 15px; font-weight: 900; color: #dc2626; padding-top: 6px; margin-top: 4px; }

    .tafqeet-box {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      padding: 6px 12px;
      color: #991b1b;
      font-weight: 900;
      font-size: 12px;
      margin-top: 10px;
      text-align: center;
    }

    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 35px;
      padding-top: 15px;
      border-top: 1.5px dashed #cbd5e1;
      font-weight: 800;
      font-size: 11.5px;
      color: #334155;
    }
    .footer-bar {
      margin-top: 15px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="return-card">
    <div class="header-box">
      <div>
        <div class="biz-title">${bizName}</div>
        <div class="biz-sub">${subtitle}</div>
        ${address ? `<div style="font-size:11px; color:#475569;">📍 ${address}</div>` : ''}
        ${phone ? `<div style="font-size:11px; color:#475569;">📞 ${phone}</div>` : ''}
        ${s.showTaxNumber && taxNumber ? `<div class="tax-num">الرقم الضريبي: <strong style="color:#0f172a;">${taxNumber}</strong></div>` : ''}
      </div>

      ${s.showLogo && logoUrl ? `
      <div style="text-align:center;">
        <img src="${logoUrl}" alt="Logo" style="max-height:65px; max-width:110px; object-fit:contain;" />
      </div>
      ` : ''}

      <div class="doc-badge">
        <div class="doc-title">سند مردود مبيعات</div>
        <div class="doc-no">${returnNo}</div>
        <div class="doc-date">${dateStr}</div>
        ${s.headerLeftText1 ? `<div style="font-size:11px; font-weight:bold; color:${accentColor}; margin-top:2px;">${s.headerLeftText1}</div>` : ''}
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-lbl">رقم الفاتورة الأصلية:</span>
        <span class="meta-val font-mono" style="color:#1d4ed8;">${invoiceNo}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">نوع المردود:</span>
        <span class="meta-val">${returnType}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">طريقة الاسترداد:</span>
        <span class="meta-val" style="color:#047857;">${paymentLabel}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">اسم العميل / الموظف:</span>
        <span class="meta-val">${customerName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">كاشير الإرجاع:</span>
        <span class="meta-val">${cashierName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">حالة الاعتماد:</span>
        <span class="meta-val" style="color:#16a34a;">${ret?.status === "approved" || !ret?.status ? "معتمد ومرحل" : "قيد المعالجة"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">مركز التكلفة:</span>
        <span class="meta-val">${ret?.cost_center || "الرئيسي"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-lbl">جهاز الإدخال:</span>
        <span class="meta-val">${ret?.entry_device || "WORKSTATION-01"}</span>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th style="width: 100px;">رمز الصنف</th>
          <th>اسم الصنف والبيان</th>
          <th style="width: 60px;">الوحدة</th>
          <th style="width: 80px;">الكمية</th>
          <th style="width: 90px;">سعر الوحدة</th>
          <th style="width: 100px;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="7" style="text-align:center; padding:15px; color:#94a3b8;">لا توجد أصناف مرتجعة</td></tr>`}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="notes-side">
        <div style="font-weight:bold; margin-bottom:4px; color:#1e293b;">سبب الإرجاع والبيان:</div>
        <div style="color:#334155; line-height:1.5;">${ret?.reason || ret?.notes || "إرجاع صنف / طلب الزبون"}</div>
        ${ret?.reference_number ? `<div style="margin-top:8px; font-weight:bold;">رقم المرجع: <span style="font-family:monospace;">${ret.reference_number}</span></div>` : ''}
      </div>

      <div class="totals-side">
        <div class="total-row">
          <span>المبلغ قبل الضريبة:</span>
          <span style="font-family:monospace; font-weight:bold;">${fmtNum(subtotalRefund)} ريال</span>
        </div>
        <div class="total-row">
          <span>ضريبة القيمة المضافة (15%):</span>
          <span style="font-family:monospace; font-weight:bold;">${fmtNum(taxRefund)} ريال</span>
        </div>
        <div class="total-row grand-total">
          <span>إجمالي المسترد:</span>
          <span style="font-family:monospace;">${fmtNum(totalRefund)} ريال</span>
        </div>
      </div>
    </div>

    <div class="tafqeet-box">
      المبلغ كتابةً: ${words}
    </div>

    <div class="signatures-row">
      ${s.voucherFooterText ? `<div style="width:100%; text-align:center;">${s.voucherFooterText}</div>` : `
      <div>توقيع المستلم / العميل: .................................</div>
      <div>توقيع أمين الصندوق: .................................</div>
      <div>اعتماد مدير المبيعات: .................................</div>
      `}
    </div>

    <div class="footer-bar">
      ${s.invoiceFooterText || s.reportFooterText || `تمت الطباعة بواسطة نظام ${s.companyName} • وثيقة رسمية معتمدة`}
    </div>
  </div>
</body>
</html>`;
}


