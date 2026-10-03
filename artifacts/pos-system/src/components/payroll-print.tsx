import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { getEffectiveDocPrintSettings } from "@/lib/printUtils";

interface PayrollStatementProps {
  data: {
    employee: {
      name: string;
      employee_number: string;
      position?: string;
      department_name?: string;
      hire_date?: string;
      phone?: string;
    };
    salary: {
      month: string;
      basic_salary: number;
      bonuses: number;
      deductions: number;
      net_salary: number;
      status: string;
      payment_date?: string;
      notes?: string;
    } | null;
    mealDeductions: Array<{
      id: number;
      amount: number;
      cashier_name: string;
      created_at: string;
      notes?: string;
    }>;
    mealTotal: number;
    attendance: Array<{ status: string; count: number }>;
    settings: Record<string, string>;
  };
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthLabel(month: string) {
  if (!month) return "";
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
}

export function PayrollStatement({ data }: PayrollStatementProps) {
  const { employee, salary, mealDeductions, mealTotal, attendance, settings } = data;
  const eff = getEffectiveDocPrintSettings(settings);
  const accent = eff.accentColor || "#1e3a5f";

  const presentDays = attendance.find(a => a.status === "present")?.count ?? 0;
  const absentDays = attendance.find(a => a.status === "absent")?.count ?? 0;
  const lateDays = attendance.find(a => a.status === "late")?.count ?? 0;

  const totalDeductions = (salary?.deductions ?? 0) + mealTotal;
  const netAfterMeals = (salary?.net_salary ?? 0) - mealTotal;

  return (
    <div
      id="payroll-print-area"
      style={{
        fontFamily: "'Tajawal', Arial, sans-serif",
        direction: "rtl",
        textAlign: "right",
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "15mm 15mm 20mm 15mm",
        background: "white",
        color: "#000",
        boxSizing: "border-box",
        fontSize: "11pt",
        lineHeight: "1.6",
      }}
    >
      {/* ── رأس الصفحة ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px double ${accent}`, paddingBottom: "12px", marginBottom: "16px" }}>
        {/* اليمين: معلومات النشاط */}
        <div style={{ fontSize: "9pt", color: "#333", lineHeight: "1.8" }}>
          <div style={{ fontWeight: "900", fontSize: "11pt", color: "#000" }}>{eff.headerRightText1 || eff.companyName}</div>
          {eff.companySubtitle && <div style={{ fontWeight: "bold", color: "#555" }}>{eff.companySubtitle}</div>}
          {(eff.phone || settings.phone) && <div>📞 {eff.phone || settings.phone}</div>}
          {(eff.address || settings.address) && <div>📍 {eff.address || settings.address}</div>}
          {eff.showTaxNumber && (eff.taxNumber || settings.taxNumber) && <div>ر.ض: {eff.taxNumber || settings.taxNumber}</div>}
        </div>

        {/* الوسط: شعار + اسم النشاط */}
        <div style={{ textAlign: "center", flex: 1 }}>
          {eff.showLogo && eff.logoUrl && (
            <img src={eff.logoUrl} alt="شعار" style={{ maxHeight: "60px", maxWidth: "120px", objectFit: "contain", marginBottom: "6px" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          <div style={{ fontSize: "18pt", fontWeight: "900", letterSpacing: "0.5px" }}>{eff.companyName || settings.businessName || "OmniSystem Pro"}</div>
          <div style={{ fontSize: "13pt", fontWeight: "bold", color: accent, marginTop: "4px" }}>{eff.employeeHeaderText || "كشف حساب ومسير رواتب موظف معتمد"}</div>
        </div>

        {/* اليسار: تاريخ الإصدار */}
        <div style={{ fontSize: "9pt", color: "#333", lineHeight: "1.8", textAlign: "left" }}>
          {eff.headerLeftText1 && <div style={{ fontWeight: "bold", color: "#000" }}>{eff.headerLeftText1}</div>}
          <div>تاريخ الإصدار:</div>
          <div style={{ fontWeight: "bold" }}>{new Date().toLocaleDateString("ar-SA")}</div>
          {salary?.month && (
            <>
              <div style={{ marginTop: "4px" }}>الشهر:</div>
              <div style={{ fontWeight: "bold" }}>{getMonthLabel(salary.month)}</div>
            </>
          )}
        </div>
      </div>

      {/* ── معلومات الموظف ── */}
      <div style={{
        background: "#f8f9fa",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        padding: "12px 16px",
        marginBottom: "16px",
      }}>
        <div style={{ fontSize: "12pt", fontWeight: "900", borderBottom: "1px solid #dee2e6", paddingBottom: "6px", marginBottom: "10px", color: "#1e3a5f" }}>
          بيانات الموظف
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 20px", fontSize: "10pt" }}>
          <div><span style={{ color: "#666" }}>الاسم: </span><strong>{employee.name}</strong></div>
          <div><span style={{ color: "#666" }}>الرقم الوظيفي: </span><strong>{employee.employee_number}</strong></div>
          <div><span style={{ color: "#666" }}>المنصب: </span><strong>{employee.position ?? "—"}</strong></div>
          <div><span style={{ color: "#666" }}>القسم: </span><strong>{employee.department_name ?? "—"}</strong></div>
          <div><span style={{ color: "#666" }}>تاريخ التعيين: </span><strong>{employee.hire_date ?? "—"}</strong></div>
          <div><span style={{ color: "#666" }}>الهاتف: </span><strong>{employee.phone ?? "—"}</strong></div>
        </div>
      </div>

      {/* ── الراتب ── */}
      {salary ? (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12pt", fontWeight: "900", borderBottom: "2px solid #000", paddingBottom: "4px", marginBottom: "10px", color: "#1e3a5f" }}>
            تفاصيل الراتب — {getMonthLabel(salary.month)}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5pt" }}>
            <thead>
              <tr style={{ background: "#1e3a5f", color: "white" }}>
                <th style={{ padding: "8px 12px", textAlign: "right", width: "50%" }}>البند</th>
                <th style={{ padding: "8px 12px", textAlign: "center", width: "25%" }}>النوع</th>
                <th style={{ padding: "8px 12px", textAlign: "left", width: "25%" }}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #dee2e6" }}>
                <td style={{ padding: "7px 12px", fontWeight: "bold" }}>الراتب الأساسي</td>
                <td style={{ padding: "7px 12px", textAlign: "center" }}>
                  <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "4px", fontSize: "9pt" }}>إضافة</span>
                </td>
                <td style={{ padding: "7px 12px", textAlign: "left", fontFamily: "monospace", fontWeight: "bold" }}>{fmt(salary.basic_salary)}</td>
              </tr>
              {salary.bonuses > 0 && (
                <tr style={{ borderBottom: "1px solid #dee2e6", background: "#f0fdf4" }}>
                  <td style={{ padding: "7px 12px" }}>البدلات والمكافآت</td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "4px", fontSize: "9pt" }}>إضافة</span>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "left", fontFamily: "monospace", color: "#16a34a" }}>+{fmt(salary.bonuses)}</td>
                </tr>
              )}
              {salary.deductions > 0 && (
                <tr style={{ borderBottom: "1px solid #dee2e6", background: "#fff7f7" }}>
                  <td style={{ padding: "7px 12px" }}>الخصومات</td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "4px", fontSize: "9pt" }}>خصم</span>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "left", fontFamily: "monospace", color: "#dc2626" }}>-{fmt(salary.deductions)}</td>
                </tr>
              )}
              {mealTotal > 0 && (
                <tr style={{ borderBottom: "1px solid #dee2e6", background: "#fff7f7" }}>
                  <td style={{ padding: "7px 12px" }}>خصم الوجبات ({mealDeductions.length} وجبة)</td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "4px", fontSize: "9pt" }}>خصم</span>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "left", fontFamily: "monospace", color: "#dc2626" }}>-{fmt(mealTotal)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1e3a5f", color: "white", fontWeight: "900", fontSize: "12pt" }}>
                <td colSpan={2} style={{ padding: "10px 12px" }}>صافي الراتب</td>
                <td style={{ padding: "10px 12px", textAlign: "left", fontFamily: "monospace" }}>{fmt(netAfterMeals)}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop: "6px", fontSize: "9pt", color: "#666" }}>
            الحالة: <strong>{salary.status === "paid" ? `✅ مصروف${salary.payment_date ? ` بتاريخ ${salary.payment_date}` : ""}` : "⏳ معلق"}</strong>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: "6px", padding: "12px", marginBottom: "16px", fontSize: "10pt", color: "#92400e" }}>
          ⚠️ لا يوجد سجل راتب لهذا الشهر
        </div>
      )}

      {/* ── تفصيل وجبات الموظفين ── */}
      {mealDeductions.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11pt", fontWeight: "bold", borderBottom: "1px solid #ccc", paddingBottom: "4px", marginBottom: "8px" }}>
            تفصيل خصم الوجبات
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "5px 8px", textAlign: "right" }}>التاريخ</th>
                <th style={{ padding: "5px 8px", textAlign: "right" }}>الكاشير</th>
                <th style={{ padding: "5px 8px", textAlign: "right" }}>ملاحظات</th>
                <th style={{ padding: "5px 8px", textAlign: "left" }}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {mealDeductions.map(md => (
                <tr key={md.id} style={{ borderBottom: "1px dashed #e5e7eb" }}>
                  <td style={{ padding: "4px 8px" }}>{new Date(md.created_at).toLocaleDateString("ar-SA")}</td>
                  <td style={{ padding: "4px 8px" }}>{md.cashier_name}</td>
                  <td style={{ padding: "4px 8px", fontSize: "9pt", color: "#666" }}>{md.notes ?? "—"}</td>
                  <td style={{ padding: "4px 8px", textAlign: "left", fontFamily: "monospace", color: "#dc2626" }}>{fmt(md.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ملخص الحضور ── */}
      {attendance.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11pt", fontWeight: "bold", borderBottom: "1px solid #ccc", paddingBottom: "4px", marginBottom: "8px" }}>
            ملخص الحضور والانصراف
          </div>
          <div style={{ display: "flex", gap: "20px", fontSize: "10pt" }}>
            <div style={{ textAlign: "center", background: "#d1fae5", borderRadius: "6px", padding: "8px 16px" }}>
              <div style={{ fontWeight: "900", fontSize: "16pt", color: "#065f46" }}>{presentDays}</div>
              <div style={{ color: "#065f46" }}>حاضر</div>
            </div>
            <div style={{ textAlign: "center", background: "#fee2e2", borderRadius: "6px", padding: "8px 16px" }}>
              <div style={{ fontWeight: "900", fontSize: "16pt", color: "#991b1b" }}>{absentDays}</div>
              <div style={{ color: "#991b1b" }}>غائب</div>
            </div>
            <div style={{ textAlign: "center", background: "#fef3c7", borderRadius: "6px", padding: "8px 16px" }}>
              <div style={{ fontWeight: "900", fontSize: "16pt", color: "#92400e" }}>{lateDays}</div>
              <div style={{ color: "#92400e" }}>متأخر</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ملاحظات الراتب ── */}
      {salary?.notes && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "10pt" }}>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>ملاحظات:</div>
          <div>{salary.notes}</div>
        </div>
      )}

      {/* ── التوقيعات ── */}
      {eff.showSignatureBoxes !== false && (
        <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", borderTop: `2px solid ${accent}`, paddingTop: "20px" }}>
          <div style={{ textAlign: "center", width: "30%" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "6px", fontSize: "9pt", color: "#555" }}>{eff.signatureLabel1 || "توقيع الموظف"}</div>
            <div style={{ marginTop: "2px", fontSize: "9pt" }}>{employee.name}</div>
          </div>
          <div style={{ textAlign: "center", width: "30%" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "6px", fontSize: "9pt", color: "#555" }}>{eff.signatureLabel2 || "مدير الموارد البشرية"}</div>
          </div>
          <div style={{ textAlign: "center", width: "30%" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "6px", fontSize: "9pt", color: "#555" }}>{eff.signatureLabel3 || "المدير العام"}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "16px", fontSize: "8.5pt", color: "#555", textAlign: "center", borderTop: "1px dashed #ccc", paddingTop: "8px", fontWeight: "bold" }}>
        {eff.employeeFooterText && <div style={{ marginBottom: "4px", color: accent }}>{eff.employeeFooterText}</div>}
        <div>{eff.companyName} — {eff.address} — {eff.phone}</div>
      </div>
    </div>
  );
}

export function PayrollPrintButton({ employeeId, month, employeeName }: { employeeId: number; month: string; employeeName: string }) {
  const handlePrint = async (format: "a4" | "80mm" = "a4") => {
    const token = localStorage.getItem("pos_token") || sessionStorage.getItem("pos_token") || "";
    const resp = await fetch(`/api/hr/salary-statement/${employeeId}/${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) { return; }
    const data = await resp.json();

    const { employee, salary, mealDeductions = [], mealTotal = 0, attendance = [], settings: s = {} } = data;
    const eff = getEffectiveDocPrintSettings(s);
    const accent = eff.accentColor || "#000000";
    const getMonthLabel = (m: string) => {
      if (!m) return "";
      const [y, mo] = m.split("-");
      return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
    };
    const f = (n?: number) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const presentDays = (attendance as any[]).find((a: any) => a.status === "present")?.count ?? 0;
    const absentDays = (attendance as any[]).find((a: any) => a.status === "absent")?.count ?? 0;
    const lateDays = (attendance as any[]).find((a: any) => a.status === "late")?.count ?? 0;
    const netAfterMeals = (salary?.net_salary ?? 0) - mealTotal;
    const is80mm = format === "80mm";

    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${eff.employeeHeaderText || "كشف حساب"} — ${employee.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>
  @page { size: ${is80mm ? "80mm 297mm" : "A4 portrait"}; margin: ${is80mm ? "0mm" : "10mm"}; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body {
    font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
    direction: rtl;
    text-align: right;
    color: #000000 !important;
    background: #ffffff !important;
    font-size: ${is80mm ? "11px" : "12pt"};
    font-weight: 700;
    line-height: 1.5;
    margin: 0 auto;
    padding: ${is80mm ? "1mm 1mm 1mm 1mm" : "0"};
    width: ${is80mm ? "72.1mm" : "100%"};
    max-width: ${is80mm ? "72.1mm" : "210mm"};
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
  }
  table { width: 100%; border-collapse: collapse; border: 2px solid ${accent}; }
  th, td { padding: ${is80mm ? "4px 3px" : "7px 10px"}; border: 1.5px solid #000; color: #000 !important; font-weight: 800; }
  .header { display: flex; flex-direction: ${is80mm ? "column" : "row"}; justify-content: space-between; align-items: ${is80mm ? "center" : "flex-start"}; text-align: ${is80mm ? "center" : "right"}; border-bottom: 3px solid ${accent}; padding-bottom: 8px; margin-bottom: 10px; gap: 6px; }
  .header-center { text-align: center; flex: 1; }
  .biz-name { font-size: ${is80mm ? "15px" : "20pt"}; font-weight: 900; color: #000; }
  .doc-title { font-size: ${is80mm ? "13px" : "14pt"}; font-weight: 900; color: ${is80mm ? "#000" : accent}; margin-top: 2px; border: 1.5px solid ${accent}; display: inline-block; padding: 2px 10px; border-radius: 4px; background: #f1f5f9; }
  .section-title { font-size: ${is80mm ? "11.5px" : "12pt"}; font-weight: 900; border-bottom: 2px solid ${accent}; padding-bottom: 3px; margin-bottom: 6px; color: ${is80mm ? "#000" : accent}; }
  .info-box { background: #f8fafc; border: 2px solid ${accent}; border-radius: 4px; padding: ${is80mm ? "6px" : "10px 14px"}; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: ${is80mm ? "1fr 1fr" : "1fr 1fr 1fr"}; gap: ${is80mm ? "4px 6px" : "8px 16px"}; font-size: ${is80mm ? "10.5px" : "10.5pt"}; font-weight: 800; color: #000; }
  .badge-add { border: 1px solid #000; background: #dcfce7; color: #000; padding: 1px 6px; border-radius: 3px; font-size: ${is80mm ? "9.5px" : "9pt"}; font-weight: 900; }
  .badge-ded { border: 1px solid #000; background: #fee2e2; color: #000; padding: 1px 6px; border-radius: 3px; font-size: ${is80mm ? "9.5px" : "9pt"}; font-weight: 900; }
  .salary-table thead tr { background: #e2e8f0; color: #000; font-weight: 900; }
  .salary-table tfoot tr { background: #e2e8f0; color: #000; font-weight: 900; font-size: ${is80mm ? "12px" : "12pt"}; }
  .sig-row { margin-top: ${is80mm ? "12px" : "24px"}; display: flex; flex-direction: ${is80mm ? "column" : "row"}; gap: ${is80mm ? "12px" : "10px"}; justify-content: space-between; border-top: 2px solid ${accent}; padding-top: 10px; }
  .sig-box { text-align: center; width: ${is80mm ? "100%" : "30%"}; }
  .sig-line { border-top: 1.5px dashed #000; padding-top: 4px; font-size: ${is80mm ? "10px" : "10pt"}; font-weight: 900; color: #000; }
  .footer { margin-top: 10px; font-size: ${is80mm ? "9.5px" : "9pt"}; font-weight: 800; color: #000; text-align: center; border-top: 1.5px dashed #000; padding-top: 6px; }
  .attendance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: ${is80mm ? "10px" : "10pt"}; }
  .att-box { text-align: center; border: 1.5px solid #000; border-radius: 4px; padding: 4px 6px; font-weight: 900; color: #000; }
</style>
</head>
<body>
<div class="header">
  <div style="font-size:${is80mm ? "10px" : "9.5pt"};color:#000;font-weight:800;line-height:1.5">
    <div style="font-weight:900">${eff.headerRightText1 || eff.companyName}</div>
    ${eff.companySubtitle ? `<div>${eff.companySubtitle}</div>` : ""}
    ${eff.phone ? `<div>هاتف: ${eff.phone}</div>` : ""}
    ${eff.address ? `<div>العنوان: ${eff.address}</div>` : ""}
    ${eff.showTaxNumber && eff.taxNumber ? `<div>ر.ض: ${eff.taxNumber}</div>` : ""}
  </div>
  <div class="header-center">
    ${eff.showLogo && eff.logoUrl ? `<img src="${eff.logoUrl}" style="max-height:48px;max-width:90px;object-fit:contain;margin-bottom:4px" alt="" onerror="this.style.display='none'">` : ""}
    <div class="biz-name">${eff.companyName ?? "OmniSystem Pro"}</div>
    <div class="doc-title">${eff.employeeHeaderText || "كشف حساب ومسير راتب موظف"}</div>
  </div>
  <div style="font-size:${is80mm ? "10px" : "9.5pt"};color:#000;font-weight:800;line-height:1.5;text-align:${is80mm ? "center" : "left"}">
    ${eff.headerLeftText1 ? `<div><strong>${eff.headerLeftText1}</strong></div>` : ""}
    <div>تاريخ الإصدار: <strong>${new Date().toLocaleDateString("ar-SA")}</strong></div>
    ${salary?.month ? `<div>الشهر: <strong>${getMonthLabel(salary.month)}</strong></div>` : ""}
  </div>
</div>

<div class="info-box">
  <div class="section-title">بيانات الموظف</div>
  <div class="info-grid">
    <div>الاسم: <strong>${employee.name}</strong></div>
    <div>الرقم الوظيفي: <strong>${employee.employee_number || employee.id}</strong></div>
    <div>المنصب: <strong>${employee.position ?? "—"}</strong></div>
    <div>القسم: <strong>${employee.department_name ?? "—"}</strong></div>
    <div>تاريخ التعيين: <strong>${employee.hire_date ?? "—"}</strong></div>
    <div>الهاتف: <strong>${employee.phone ?? "—"}</strong></div>
  </div>
</div>

${salary ? `
<div style="margin-bottom:10px">
  <div class="section-title">تفاصيل الراتب — ${getMonthLabel(salary.month)}</div>
  <table class="salary-table">
    <thead><tr>
      <th style="text-align:right;width:50%">البند</th>
      <th style="text-align:center;width:22%">النوع</th>
      <th style="text-align:left;width:28%">المبلغ</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>الراتب الأساسي</td>
        <td style="text-align:center"><span class="badge-add">استحقاق</span></td>
        <td style="text-align:left;font-family:monospace;direction:ltr">${f(salary.basic_salary)}</td>
      </tr>
      ${salary.bonuses > 0 ? `<tr>
        <td>البدلات والمكافآت</td>
        <td style="text-align:center"><span class="badge-add">إضافة</span></td>
        <td style="text-align:left;font-family:monospace;direction:ltr">+${f(salary.bonuses)}</td>
      </tr>` : ""}
      ${salary.deductions > 0 ? `<tr>
        <td>الخصومات</td>
        <td style="text-align:center"><span class="badge-ded">خصم</span></td>
        <td style="text-align:left;font-family:monospace;direction:ltr">-${f(salary.deductions)}</td>
      </tr>` : ""}
      ${mealTotal > 0 ? `<tr>
        <td>خصم الوجبات (${mealDeductions.length} وجبة)</td>
        <td style="text-align:center"><span class="badge-ded">خصم</span></td>
        <td style="text-align:left;font-family:monospace;direction:ltr">-${f(mealTotal)}</td>
      </tr>` : ""}
    </tbody>
    <tfoot><tr>
      <td colspan="2">صافي الراتب المستحق</td>
      <td style="text-align:left;font-family:monospace;direction:ltr">${f(netAfterMeals)}</td>
    </tr></tfoot>
  </table>
  <div style="margin-top:4px;font-size:${is80mm ? "10px" : "9.5pt"};color:#000;font-weight:900">
    الحالة: <strong>${salary.status === "paid" ? `مصروف${salary.payment_date ? " بتاريخ " + salary.payment_date : ""}` : "معلق"}</strong>
  </div>
</div>` : ""}

${mealDeductions.length > 0 ? `
<div style="margin-bottom:10px">
  <div class="section-title">تفصيل خصم الوجبات</div>
  <table>
    <thead style="background:#e2e8f0"><tr>
      <th style="text-align:right">التاريخ</th>
      <th style="text-align:right">الكاشير</th>
      <th style="text-align:right">ملاحظات</th>
      <th style="text-align:left">المبلغ</th>
    </tr></thead>
    <tbody>
      ${mealDeductions.map((md: any) => `<tr>
        <td>${new Date(md.created_at).toLocaleDateString("ar-SA")}</td>
        <td>${md.cashier_name || "—"}</td>
        <td>${md.notes ?? "—"}</td>
        <td style="text-align:left;font-family:monospace;direction:ltr">${f(md.amount)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}

${attendance.length > 0 ? `
<div style="margin-bottom:10px">
  <div class="section-title">ملخص الحضور والانصراف</div>
  <div class="attendance-grid">
    <div class="att-box" style="background:#dcfce7">
      <div style="font-size:${is80mm ? "13px" : "14pt"}">${presentDays}</div>
      <div>حاضر</div>
    </div>
    <div class="att-box" style="background:#fee2e2">
      <div style="font-size:${is80mm ? "13px" : "14pt"}">${absentDays}</div>
      <div>غائب</div>
    </div>
    <div class="att-box" style="background:#fef3c7">
      <div style="font-size:${is80mm ? "13px" : "14pt"}">${lateDays}</div>
      <div>متأخر</div>
    </div>
  </div>
</div>` : ""}

${eff.showSignatureBoxes !== false ? `
<div class="sig-row">
  <div class="sig-box"><div class="sig-line">${eff.signatureLabel1 || "توقيع الموظف"}: ${employee.name}</div></div>
  <div class="sig-box"><div class="sig-line">${eff.signatureLabel2 || "مدير الموارد البشرية"}</div></div>
  <div class="sig-box"><div class="sig-line">${eff.signatureLabel3 || "المدير العام"}</div></div>
</div>` : ""}
<div class="footer">
  ${eff.employeeFooterText ? `<div>${eff.employeeFooterText}</div>` : ""}
  <div>${eff.companyName ?? "OmniSystem Pro"} ${eff.address ? `— ${eff.address}` : ""} ${eff.phone ? `— ${eff.phone}` : ""}</div>
</div>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
      }, 400);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 font-bold" onClick={() => handlePrint("a4")} title={`طباعة كشف حساب ${employeeName} (A4)`}>
        <Printer className="w-3 h-3" />كشف (A4)
      </Button>
      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 font-bold border-emerald-600 text-emerald-700 hover:bg-emerald-50" onClick={() => handlePrint("80mm")} title={`طباعة كشف حساب ${employeeName} حراري 80(72.1)×297mm`}>
        <Printer className="w-3 h-3" />80mm
      </Button>
    </div>
  );
}
