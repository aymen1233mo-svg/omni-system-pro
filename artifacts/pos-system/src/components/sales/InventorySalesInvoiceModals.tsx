import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Printer, CheckCircle2, FileText, Users, HelpCircle, Palette, ShoppingBag, Warehouse } from "lucide-react";
import { getEffectiveDocPrintSettings } from "@/lib/printUtils";

export function numberToArabicWords(amount: number, currencyName = "ريال سعودي"): string {
  const n = Math.abs(Math.round(amount * 100) / 100);
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  if (intPart === 0 && decPart === 0) return `صفر ${currencyName} فقط لا غير`;

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  const convertBelow1000 = (num: number): string => {
    if (num === 0) return "";
    const parts: string[] = [];
    const h = Math.floor(num / 100);
    const rem = num % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem > 0) {
      if (rem < 20) {
        parts.push(ones[rem]);
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) parts.push(`${ones[o]} و${tens[t]}`);
        else parts.push(tens[t]);
      }
    }
    return parts.join(" و");
  };

  const chunks: string[] = [];
  const millions = Math.floor(intPart / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const remainder = intPart % 1000;

  if (millions > 0) {
    if (millions === 1) chunks.push("مليون");
    else if (millions === 2) chunks.push("مليونان");
    else chunks.push(`${convertBelow1000(millions)} مليون`);
  }
  if (thousands > 0) {
    if (thousands === 1) chunks.push("ألف");
    else if (thousands === 2) chunks.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) chunks.push(`${convertBelow1000(thousands)} آلاف`);
    else chunks.push(`${convertBelow1000(thousands)} ألف`);
  }
  if (remainder > 0) {
    chunks.push(convertBelow1000(remainder));
  }

  let result = `فقط وقدره ${chunks.join(" و")} ${currencyName}`;
  if (decPart > 0) {
    result += ` و${convertBelow1000(decPart)} هللة/قرش`;
  }
  return `${result} لا غير`;
}

export function buildInventorySalesInvoiceHtml(inv: any, designConfig?: { headerTitle?: string; showSignatures?: boolean; showCostCenter?: boolean }) {
  const eff = getEffectiveDocPrintSettings();
  const accent = eff.accentColor || "#0284c7";
  const isEn = Boolean(inv.print_english);
  const hideEmpty = Boolean(inv.hide_empty_rows);
  const rawItems: any[] = Array.isArray(inv.items) ? inv.items : [];
  const items = hideEmpty ? rawItems.filter((it) => it.product_name && Number(it.quantity) > 0) : rawItems;
  const cheques: any[] = Array.isArray(inv.cheques) ? inv.cheques : [];
  const accLines: any[] = Array.isArray(inv.account_lines) ? inv.account_lines : [];

  const rowsHtml = items.map((it, idx) => `
    <tr>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace;">${idx + 1}</td>
      <td style="padding:7px; border:1px solid #94a3b8; font-family:monospace;">${it.product_code || it.product_id || "-"}</td>
      <td style="padding:7px; border:1px solid #94a3b8; font-weight:bold;">${it.product_name || "-"} ${it.is_gift ? "(هدية مجانية)" : ""}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center;">${it.unit || "وحدة"}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace; font-weight:bold;">${Number(it.quantity || 0)}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace;">${Number(it.unit_price || 0).toFixed(2)}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace; color:#dc2626;">${Number(it.discount || 0).toFixed(2)}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace; color:#059669;">${Number(it.addition || 0).toFixed(2)}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:center; font-family:monospace;">${Number(it.tax_amount || 0).toFixed(2)}</td>
      <td style="padding:7px; border:1px solid #94a3b8; text-align:left; font-family:monospace; font-weight:bold;">${Number(it.total || 0).toFixed(2)}</td>
    </tr>
  `).join("");

  const statusText = inv.posting_status === "posted"
    ? (isEn ? "POSTED" : "مرحل ومعتمد")
    : inv.posting_status === "cancelled"
    ? (isEn ? "CANCELLED" : "ملغي")
    : (isEn ? "UNPOSTED / DRAFT" : "غير مرحل (مسودة)");

  const statusColor = inv.posting_status === "posted" ? "#15803d" : "#dc2626";
  const resolvedTitle =
    designConfig?.headerTitle && designConfig.headerTitle !== "فاتورة مبيعات مخزنية رسمية"
      ? designConfig.headerTitle
      : eff.invoiceHeaderText || (isEn ? "Official Inventory Sales Invoice" : "فاتورة مبيعات مخزنية رسمية");

  return `
    <div style="direction:${isEn ? "ltr" : "rtl"}; font-family:Tajawal, Cairo, sans-serif; padding:24px; color:#0f172a; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid ${accent}; padding-bottom:14px; margin-bottom:14px;">
        <div style="flex:1; text-align:right;">
          <div style="font-size:17px; font-weight:900; color:#0f172a;">${eff.headerRightText1 || eff.companyName}</div>
          ${eff.companySubtitle ? `<div style="font-size:12px; font-weight:700; color:#475569;">${eff.companySubtitle}</div>` : ""}
          ${eff.headerRightText2 ? `<div style="font-size:11px; color:#334155;">${eff.headerRightText2}</div>` : ""}
          ${eff.headerRightText3 ? `<div style="font-size:11px; color:#334155;">${eff.headerRightText3}</div>` : ""}
          ${eff.showTaxNumber && eff.taxNumber ? `<div style="font-size:11px; font-weight:700; color:#334155;">الرقم الضريبي: ${eff.taxNumber}</div>` : ""}
        </div>
        <div style="flex:1; text-align:center;">
          ${eff.showLogo && eff.logoUrl ? `<img src="${eff.logoUrl}" alt="Logo" style="max-height:64px; max-width:140px; object-fit:contain; margin:0 auto 6px auto; display:block;" onerror="this.style.display='none'" />` : ""}
          <h1 style="margin:0; font-size:19px; color:${accent}; font-weight:900;">${resolvedTitle}</h1>
          <div style="display:inline-block; margin-top:6px; border:2px solid ${statusColor}; color:${statusColor}; padding:3px 12px; border-radius:6px; font-weight:900; font-size:12px;">
            ${statusText}
          </div>
        </div>
        <div style="flex:1; text-align:${isEn ? "right" : "left"}; font-size:12px;">
          ${eff.headerLeftText1 ? `<div style="font-weight:800; color:#0f172a; margin-bottom:2px;">${eff.headerLeftText1}</div>` : ""}
          ${eff.headerLeftText2 ? `<div style="font-size:11px; color:#475569; margin-bottom:2px;">${eff.headerLeftText2}</div>` : ""}
          <div><strong>${isEn ? "Invoice No:" : "رقم الفاتورة:"}</strong> <span style="font-family:monospace; font-size:15px; font-weight:bold; color:${accent};">${inv.invoice_number}</span></div>
          <div><strong>${isEn ? "Payment Type:" : "طريقة التعامل:"}</strong> ${inv.payment_type === "cash" ? (isEn ? "Cash (نقداً)" : "نقداً") : (isEn ? "Credit (آجل)" : "آجل (ذمم عملاء)")}</div>
          <div><strong>${isEn ? "Date:" : "التاريخ:"}</strong> ${inv.invoice_date} ${inv.hijri_date ? `(${inv.hijri_date} هـ)` : ""}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
        <div><strong>${isEn ? "Customer:" : "العميل:"}</strong> ${inv.customer_name || "عميل عام"}</div>
        <div><strong>${isEn ? "Warehouse:" : "المخزن:"}</strong> ${inv.warehouse_name || "المستودع الرئيسي"}</div>
        <div><strong>${isEn ? "Cost Center:" : "مركز التكلفة:"}</strong> ${inv.cost_center_name || "المبيعات العامة"}</div>
        <div><strong>${isEn ? "Sales Rep:" : "المندوب:"}</strong> ${inv.sales_rep_name || "-"}</div>
        <div><strong>${isEn ? "Driver / Distributor:" : "السائق / الموزع:"}</strong> ${inv.driver_name || "-"} / ${inv.distributor_name || "-"}</div>
        <div><strong>${isEn ? "Tax Nature:" : "طبيعة التعامل الضريبي:"}</strong> ${inv.tax_treatment || "دون ضريبة"} (${inv.currency || "ريال سعودي"})</div>
        <div style="grid-column:span 2;"><strong>${isEn ? "Description:" : "الشرح والبيان:"}</strong> ${inv.description || "-"}</div>
        <div><strong>${isEn ? "Return Policy:" : "السماح بالارتجاع:"}</strong> ${inv.allow_return ? `${inv.allow_return_days || 365} يوم` : "غير مسموح"}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px;">
        <thead>
          <tr style="background:${accent}; color:#ffffff;">
            <th style="padding:8px; border:1px solid ${accent};">#</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Code" : "الرقم/الكود"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Item Description" : "اسم الصنف والبيان"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Unit" : "الوحدة"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Qty" : "الكمية"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Unit Price" : "سعر الوحدة"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Discount" : "الخصم"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Addition" : "الإضافة"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Tax" : "الضريبة"}</th>
            <th style="padding:8px; border:1px solid ${accent};">${isEn ? "Total" : "الإجمالي"}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="10" style="padding:16px; text-align:center;">لا توجد أصناف</td></tr>`}
        </tbody>
      </table>

      ${accLines.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; font-weight:bold; color:${accent}; margin-bottom:4px;">جدول الحسابات والخصومات والإضافات الإضافية:</div>
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9; color:${accent};">
                <th style="padding:5px; border:1px solid #cbd5e1;">الحساب</th>
                <th style="padding:5px; border:1px solid #cbd5e1;">الخصم</th>
                <th style="padding:5px; border:1px solid #cbd5e1;">الإضافة</th>
                <th style="padding:5px; border:1px solid #cbd5e1;">الشرح</th>
                <th style="padding:5px; border:1px solid #cbd5e1;">مركز التكلفة</th>
              </tr>
            </thead>
            <tbody>
              ${accLines.map((al) => `
                <tr>
                  <td style="padding:5px; border:1px solid #cbd5e1;">${al.account_code || ""} - ${al.account_name || ""}</td>
                  <td style="padding:5px; border:1px solid #cbd5e1; font-family:monospace;">${Number(al.discount || 0).toFixed(2)}</td>
                  <td style="padding:5px; border:1px solid #cbd5e1; font-family:monospace;">${Number(al.addition || 0).toFixed(2)}</td>
                  <td style="padding:5px; border:1px solid #cbd5e1;">${al.description || "-"}</td>
                  <td style="padding:5px; border:1px solid #cbd5e1;">${al.cost_center || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : ""}

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px;">
        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:8px; font-size:12px;">
          <div><strong>التفقيط (القيمة بالحروف):</strong></div>
          <div style="color:${accent}; font-weight:bold; margin-top:4px;">${numberToArabicWords(Number(inv.net_total || 0), inv.currency || "ريال سعودي")}</div>
          <div style="margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:6px;">
            <div>الدفعة النقدية المقدمة (${inv.safe_name || "الصندوق"}): <strong>${Number(inv.advance_cash_amount || 0).toFixed(2)}</strong></div>
            <div>إجمالي الشيكات (${cheques.length}): <strong>${cheques.reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2)}</strong></div>
          </div>
          ${eff.termsAndConditions ? `<div style="margin-top:8px; font-size:11px; color:#475569; border-top:1px dashed #cbd5e1; padding-top:6px;"><strong>الشروط والأحكام:</strong> ${eff.termsAndConditions}</div>` : ""}
        </div>
        <div style="background:#f8fafc; border:2px solid ${accent}; padding:12px; border-radius:8px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>إجمالي الفاتورة بدون ضرائب:</span><strong style="font-family:monospace;">${Number(inv.subtotal_no_tax || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>قيمة ضريبة المبيعات:</span><strong style="font-family:monospace;">${Number(inv.sales_tax_amount || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>ضريبة خصم المنبع:</span><strong style="font-family:monospace;">${Number(inv.withholding_tax_amount || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>الإضافات والخصومات:</span><strong style="font-family:monospace;">${Number(inv.additions_discounts_net || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>إجمالي الهدايا:</span><strong style="font-family:monospace;">${Number(inv.gifts_total || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; border-top:2px solid ${accent}; padding-top:6px; margin-top:6px; font-size:15px; font-weight:900; color:${accent};">
            <span>القيمة الصافية للفاتورة:</span>
            <span style="font-family:monospace;">${Number(inv.net_total || 0).toFixed(2)} ${inv.currency || ""}</span>
          </div>
        </div>
      </div>

      ${designConfig?.showSignatures !== false && eff.showSignatureBoxes !== false ? `
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:20px; margin-top:28px; text-align:center; font-size:12px; color:#475569; font-weight:700;">
          <div>${eff.signatureLabel1 || "أمين المستودع / التسليم"}<br/><br/>___________________</div>
          <div>${eff.signatureLabel2 || "المندوب / المحاسب المختص"}<br/><br/>___________________</div>
          <div>${eff.signatureLabel3 || "توقيع وختم المستلم (العميل)"}<br/><br/>___________________</div>
        </div>
      ` : ""}

      ${eff.invoiceFooterText ? `
        <div style="margin-top:18px; border-top:1px dashed #cbd5e1; padding-top:8px; text-align:center; font-size:11px; font-weight:700; color:#475569;">
          ${eff.invoiceFooterText}
        </div>
      ` : ""}
    </div>
  `;
}

export function buildInvoiceBarcodeHtml(inv: any) {
  const eff = getEffectiveDocPrintSettings();
  const accent = eff.accentColor || "#0369a1";
  const items: any[] = (Array.isArray(inv.items) ? inv.items : []).filter((it) => it.product_name);
  const cards = items.map((it) => `
    <div style="border:2px dashed #334155; border-radius:8px; padding:12px; text-align:center; width:220px; display:inline-block; margin:8px; font-family:Tajawal, sans-serif;">
      <div style="font-size:11px; font-weight:bold; color:${accent};">${eff.companyName || "Omni System Pro"}</div>
      <div style="font-size:12px; font-weight:bold; margin:4px 0;">${it.product_name}</div>
      <div style="font-family:monospace; font-size:16px; letter-spacing:3px; background:#f1f5f9; padding:6px; margin:4px 0; border:1px solid #cbd5e1;">|||| ||| || |||| |||</div>
      <div style="font-family:monospace; font-size:12px; font-weight:bold;">${it.product_code || it.product_id || "6281000101"}</div>
      <div style="font-size:13px; font-weight:900; color:#0f172a; margin-top:4px;">السعر: ${Number(it.unit_price || 0).toFixed(2)} ${inv.currency || "ر.س"}</div>
    </div>
  `).join("");

  return `
    <div style="direction:rtl; padding:20px; font-family:Tajawal, sans-serif;">
      <h3 style="text-align:center; color:${accent}; border-bottom:1px solid #cbd5e1; padding-bottom:10px;">${eff.companyName} — ملصقات باركود أصناف فاتورة المبيعات رقم ${inv.invoice_number}</h3>
      <div style="display:flex; flex-wrap:wrap; justify-content:center;">
        ${cards || "<p>لا توجد أصناف لطباعة الباركود</p>"}
      </div>
    </div>
  `;
}

export function SalesPosVsInventoryComparisonCard({ onOpenInvoice, onOpenPos }: { onOpenInvoice?: () => void; onOpenPos?: () => void }) {
  const comparisonRows = [
    { criterion: "الغرض", pos: "إتمام عملية بيع سريعة أمام العميل", inv: "توثيق عملية بيع رسمية مع تفاصيل كاملة" },
    { criterion: "العميل", pos: "غالباً غير معروف (بيع نقدي فوري)", inv: "معروف ومسجل (أو نقدي مع بيانات)" },
    { criterion: "السرعة", pos: "لحظية، بضغطة أو مسح باركود", inv: "تحتاج إدخال بيانات ومراجعة" },
    { criterion: "المخزون", pos: "يُخصم فوراً ويمكن ربطه بوصفات (في المطاعم)", inv: "يُخصم عند ترحيل الفاتورة (ترحيل / فك ترحيل)" },
    { criterion: "الفاتورة", pos: "إيصال مبسط (حراري)", inv: "فاتورة رسمية مرقمة (ضريبية)" },
    { criterion: "الاستخدام", pos: "مطاعم، سوبرماركت، كافيهات", inv: "محلات تجارية، بيع جملة/تجزئة، توريدات" },
    { criterion: "التقارير", pos: "مبيعات يومية/ورديات", inv: "تحليل عملاء، هامش ربح، ذمم مدينة" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" dir="rtl">
      <div className="bg-gradient-to-l from-sky-800 via-sky-700 to-blue-800 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-black flex items-center gap-2">
            <span>🔹 الفرق الجوهري بين نقطة البيع السريعة (POS) وفاتورة المبيعات المخزنية</span>
          </h2>
          <p className="text-xs text-sky-100 mt-1">
            يوفر نظام Omni System Pro كلا النظامين معاً بتكامل محاسبي ومخزني كامل لتغطية البيع المباشر السريع وفواتير الجملة والآجل.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {onOpenPos ? (
            <Button size="sm" onClick={onOpenPos} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> فتح نقطة البيع POS
            </Button>
          ) : (
            <Link href="/pos">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> فتح نقطة البيع POS
              </Button>
            </Link>
          )}
          {onOpenInvoice && (
            <Button size="sm" onClick={onOpenInvoice} className="bg-white hover:bg-sky-50 text-sky-900 font-bold text-xs gap-1.5">
              <Warehouse className="w-3.5 h-3.5" /> فتح فاتورة المبيعات المخزنية
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
              <th className="p-3 text-right font-black border-l border-slate-200 w-36">المعيار</th>
              <th className="p-3 text-right font-black border-l border-slate-200 text-amber-800 bg-amber-50/60">نقطة البيع (POS / كاشير)</th>
              <th className="p-3 text-right font-black text-sky-900 bg-sky-50/60">فاتورة المبيعات المخزنية (نقداً / آجل)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {comparisonRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900 border-l border-slate-200 bg-slate-50/60">{row.criterion}</td>
                <td className="p-3 text-slate-700 border-l border-slate-200">{row.pos}</td>
                <td className="p-3 font-semibold text-sky-950 bg-sky-50/20">{row.inv}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InvoiceJournalModal({
  open,
  onOpenChange,
  journalData,
  invoiceNumber,
  onPrintJournal
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journalData: any;
  invoiceNumber: string;
  onPrintJournal: () => void;
}) {
  const lines: any[] = journalData?.lines || [];
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sky-800">
              <FileText className="w-5 h-5" />
              قيد اليومية المحاسبي للفاتورة رقم ({invoiceNumber})
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${journalData?.posted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {journalData?.posted ? "قيد مرحل ومعتمد في الأستاذ العام" : "معاينة القيد المتوقع (قبل الترحيل)"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-2">
            <div><strong>رقم القيد:</strong> <span className="font-mono">{journalData?.entry?.entry_number || "-"}</span></div>
            <div><strong>التاريخ:</strong> <span className="font-mono">{journalData?.entry?.entry_date || "-"}</span></div>
            <div><strong>البيان:</strong> {journalData?.entry?.description || "-"}</div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-sky-800 text-white">
                  <th className="p-2.5 text-right border-l border-sky-700">كود الحساب</th>
                  <th className="p-2.5 text-right border-l border-sky-700">اسم الحساب</th>
                  <th className="p-2.5 text-center border-l border-sky-700 w-28">مدين (منه)</th>
                  <th className="p-2.5 text-center border-l border-sky-700 w-28">دائن (له)</th>
                  <th className="p-2.5 text-right">البيان والشرح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold text-sky-900 border-l border-slate-200">{l.acc_code || l.account_code || "-"}</td>
                    <td className="p-2 font-bold border-l border-slate-200">{l.account_name || "-"}</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-l border-slate-200">{Number(l.debit || 0) > 0 ? Number(l.debit).toFixed(2) : "-"}</td>
                    <td className="p-2 text-center font-mono font-bold text-rose-700 border-l border-slate-200">{Number(l.credit || 0) > 0 ? Number(l.credit).toFixed(2) : "-"}</td>
                    <td className="p-2 text-slate-600">{l.description || "-"}</td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">لا توجد سطور محاسبية</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                  <td colSpan={2} className="p-2.5 text-left border-l border-slate-300">إجمالي القيد المحاسبي المتوازن:</td>
                  <td className="p-2.5 text-center font-mono text-emerald-800 border-l border-slate-300">{totalDebit.toFixed(2)}</td>
                  <td className="p-2.5 text-center font-mono text-rose-800 border-l border-slate-300">{totalCredit.toFixed(2)}</td>
                  <td className="p-2.5 text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> متوازن
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onPrintJournal} className="gap-1.5">
            <Printer className="w-4 h-4" /> طباعة سند القيد
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerCollectionsModal({
  open,
  onOpenChange,
  data,
  onSelectInvoice
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: any;
  onSelectInvoice: (invId: number) => void;
}) {
  const customer = data?.customer;
  const invoices: any[] = data?.invoices || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sky-800">
            <Users className="w-5 h-5" />
            كشف تحصيلات وفواتير العميل: {customer?.name || "عميل عام"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg">
              <div className="text-slate-500">اسم العميل ورقم الهاتف</div>
              <div className="font-black text-sm text-sky-950 mt-0.5">{customer?.name || "غير محدد"}</div>
              <div className="font-mono text-slate-600">{customer?.phone || "-"}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
              <div className="text-slate-500">الرصيد الحالي المستحق (ذمم مدينة)</div>
              <div className="font-black text-base font-mono text-amber-800 mt-1">
                {Number(customer?.balance || 0).toFixed(2)} ر.س
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
              <div className="text-slate-500">إجمالي الفواتير المخزنية المسجلة</div>
              <div className="font-black text-base font-mono text-emerald-800 mt-1">
                {invoices.length} فاتورة
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                  <th className="p-2 text-right">رقم الفاتورة</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-center">نوع التعامل</th>
                  <th className="p-2 text-center">الصافي</th>
                  <th className="p-2 text-center">المسدد مقدماً</th>
                  <th className="p-2 text-center">الحالة</th>
                  <th className="p-2 text-center">عرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold text-sky-800">{inv.invoice_number}</td>
                    <td className="p-2 font-mono">{inv.invoice_date}</td>
                    <td className="p-2 text-center">{inv.payment_type === "cash" ? "نقداً" : "آجل"}</td>
                    <td className="p-2 text-center font-mono font-bold">{Number(inv.net_total || 0).toFixed(2)}</td>
                    <td className="p-2 text-center font-mono text-emerald-700">{Number(inv.advance_cash_amount || 0).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${inv.posting_status === "posted" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        {inv.posting_status === "posted" ? "مرحل" : "غير مرحل"}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-sky-700" onClick={() => { onSelectInvoice(inv.id); onOpenChange(false); }}>
                        فتح الفاتورة
                      </Button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">لا توجد فواتير مسجلة لهذا العميل</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Link href="/accounting?tab=receipt_vouchers">
            <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300 bg-emerald-50">
              إصدار سند قبض من العميل
            </Button>
          </Link>
          <Button size="sm" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceSearchModal({
  open,
  onOpenChange,
  invoices,
  searchQuery,
  setSearchQuery,
  onSelectInvoice
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoices: any[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onSelectInvoice: (idx: number) => void;
}) {
  const filtered = invoices
    .map((inv, idx) => ({ inv, idx }))
    .filter(({ inv }) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(inv.invoice_number || "").toLowerCase().includes(q) ||
        String(inv.customer_name || "").toLowerCase().includes(q) ||
        String(inv.description || "").toLowerCase().includes(q) ||
        String(inv.sales_order_number || "").toLowerCase().includes(q)
      );
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sky-800">
            <Search className="w-5 h-5" />
            البحث المتقدم في فواتير المبيعات المخزنية ({invoices.length} فاتورة)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="ابحث برقم الفاتورة، اسم العميل، الشرح، أو رقم أمر البيع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-sky-900 text-white">
                  <th className="p-2.5 text-right">رقم الفاتورة</th>
                  <th className="p-2.5 text-right">التاريخ</th>
                  <th className="p-2.5 text-right">العميل</th>
                  <th className="p-2.5 text-center">طريقة التعامل</th>
                  <th className="p-2.5 text-right">المخزن</th>
                  <th className="p-2.5 text-center">الصافي</th>
                  <th className="p-2.5 text-center">الحالة</th>
                  <th className="p-2.5 text-center">اختيار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(({ inv, idx }) => (
                  <tr key={inv.id} className="hover:bg-sky-50/60 cursor-pointer" onClick={() => { onSelectInvoice(idx); onOpenChange(false); }}>
                    <td className="p-2 font-mono font-bold text-sky-800">{inv.invoice_number}</td>
                    <td className="p-2 font-mono">{inv.invoice_date}</td>
                    <td className="p-2 font-bold">{inv.customer_name || "عميل عام"}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${inv.payment_type === "cash" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {inv.payment_type === "cash" ? "نقداً" : "آجل"}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600">{inv.warehouse_name}</td>
                    <td className="p-2 text-center font-mono font-black text-slate-900">{Number(inv.net_total || 0).toFixed(2)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${inv.posting_status === "posted" ? "bg-emerald-100 text-emerald-800" : inv.posting_status === "cancelled" ? "bg-slate-200 text-slate-700" : "bg-rose-100 text-rose-800"}`}>
                        {inv.posting_status === "posted" ? "مرحل" : inv.posting_status === "cancelled" ? "ملغي" : "غير مرحل"}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Button size="sm" className="h-6 text-xs bg-sky-700 hover:bg-sky-800">عرض</Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">لا توجد فواتير مطابقة للبحث</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceDesignModal({
  open,
  onOpenChange,
  designConfig,
  setDesignConfig
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  designConfig: { headerTitle: string; showSignatures: boolean; showCostCenter: boolean };
  setDesignConfig: React.Dispatch<React.SetStateAction<{ headerTitle: string; showSignatures: boolean; showCostCenter: boolean }>>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sky-800">
            <Palette className="w-5 h-5" />
            إعدادات وتصميم طباعة فاتورة المبيعات المخزنية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">عنوان الفاتورة في الطباعة:</label>
            <Input
              value={designConfig.headerTitle}
              onChange={(e) => setDesignConfig((p) => ({ ...p, headerTitle: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={designConfig.showSignatures}
              onChange={(e) => setDesignConfig((p) => ({ ...p, showSignatures: e.target.checked }))}
            />
            إظهار توقيعات أمين المستودع والمحاسب والعميل أسفل الفاتورة
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={designConfig.showCostCenter}
              onChange={(e) => setDesignConfig((p) => ({ ...p, showCostCenter: e.target.checked }))}
            />
            إظهار بيانات مركز التكلفة والمندوب والسائق في الترويسة
          </label>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>حفظ التصميم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceInstructionsModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sky-800">
            <HelpCircle className="w-5 h-5" />
            تعليمات فاتورة المبيعات المخزنية والفرق الجوهري مع نقطة البيع POS
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <SalesPosVsInventoryComparisonCard />
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 leading-relaxed">
            <h4 className="font-black text-sky-900 text-sm">خطوات العمل على فاتورة المبيعات المخزنية (نقداً أو آجل):</h4>
            <ul className="list-disc pr-5 space-y-1 text-slate-700">
              <li><strong>طريقة التعامل (نقداً / آجل):</strong> اختر <strong>نقداً</strong> لتحصيل قيمة الفاتورة مباشرة في الصندوق المحدد، أو اختر <strong>آجل</strong> لتسجيل الفاتورة على ذمة العميل مع إمكانية تسجيل دفعة نقدية مقدمة أو شيكات.</li>
              <li><strong>حفظ كمسودة (غير مرحل):</strong> عند الضغط على <strong>حفظ</strong> تُحفظ الفاتورة بحالة <span className="text-rose-600 font-bold">(غير مرحل)</span> لمراجعتها وتدقيقها دون خصم المخزون.</li>
              <li><strong>الترحيل والاعتماد (ترحيل / فك ترحيل):</strong> عند الضغط على <strong>ترحيل</strong> يتم خصم الكميات من المستودع فوراً وتوليد قيد اليومية المحاسبي المزدوج وتحديث حساب العميل أو الصندوق، وعند الضغط على <strong>فك ترحيل</strong> يتم التراجع العكسي الكامل بأمان.</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>فهمت، إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

