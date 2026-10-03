import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Briefcase, ClipboardList, AlertCircle, FileSpreadsheet, CheckCircle2, Building, Calendar, ShieldCheck, UserCheck, Eye } from "lucide-react";
import { printA4Html, generateStatementA4Html } from "@/lib/printUtils";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { apiGet, fmt } from "./api";
import defaultLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";

export function ReportsTab({ initialTab }: { initialTab?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || "employee_statement");
  const [previewFormat, setPreviewFormat] = useState<"80mm" | "a4">("a4");
  const [viewerModalOpen, setViewerModalOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch company & document print settings from system configuration
  const { data: docSettings } = useQuery({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings").catch(() => ({
      companyName: "OmniSystem Pro",
      companySubtitle: "نظام نقاط البيع وإدارة الموارد",
      logoUrl: defaultLogo,
      employeeHeaderText: "كشف حساب ومسير رواتب موظف معتمد",
      employeeFooterText: "إدارة الموارد البشرية - التوقيع والاعتماد",
      accentColor: "#2563eb",
      reportHeaderText: "تقرير عام شامل",
      reportFooterText: "طبع بواسطة نظام OmniSystem Pro",
    })),
  });

  // Fetch thermal printer settings (80(72.1) x 297 mm margins & font sizes)
  const { data: printerSettings } = useQuery({
    queryKey: ["printer-settings"],
    queryFn: () => apiGet("/api/printer-settings").catch(() => {
      try {
        const cached = localStorage.getItem("pos_printer_settings_v1");
        if (cached) return JSON.parse(cached);
      } catch {}
      return {
        paperWidth: 80,
        leftMargin: 1,
        rightMargin: 1,
        topMargin: 1,
        bottomMargin: 1,
        bodyFontSize: 12,
      };
    }),
  });

  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: depts = [] } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });

  // Detailed Employee Statement State
  const [statementEmpId, setStatementEmpId] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statementData, setStatementData] = useState<any | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Other report states
  const { data: custodiesReport = [] } = useQuery({ queryKey: ["hr-report-custodies"], queryFn: () => apiGet("/api/hr/custodies") });
  const { data: movementsReport = [] } = useQuery({ queryKey: ["hr-report-movements"], queryFn: () => apiGet("/api/hr/tools/movements") });
  const { data: leavesReport = [] } = useQuery({ queryKey: ["hr-report-leaves"], queryFn: () => apiGet("/api/hr/leaves") });
  const { data: penaltiesReport = [] } = useQuery({ queryKey: ["hr-report-penalties"], queryFn: () => apiGet("/api/hr/penalties") });
  const { data: notesReport = [] } = useQuery({ queryKey: ["hr-report-notes"], queryFn: () => apiGet("/api/hr/notes") });

  const fetchStatement = async () => {
    if (!statementEmpId) {
      toast({ variant: "destructive", title: "الرجاء اختيار الموظف أولاً" });
      return;
    }
    setLoadingStatement(true);
    try {
      const res = await apiGet(`/api/hr/reports/statement?employee_id=${statementEmpId}&month=${statementMonth}`);
      setStatementData(res);
      toast({ title: "تم توليد الكشف المالي بنجاح", description: `الموظف: ${res.employee?.name || ""}` });
    } catch (e: any) {
      console.error("Error generating HR statement:", e);
      toast({ variant: "destructive", title: "فشل في جلب البيانات", description: e?.message || "تعذر تحميل بيانات كشف الحساب" });
    } finally {
      setLoadingStatement(false);
    }
  };

  const printArea = (elementId: string) => {
    const printContent = document.getElementById(elementId)?.innerHTML;
    if (!printContent) return;
    const title = `${docSettings?.employeeHeaderText || "كشف حساب ومسير رواتب موظف معتمد"} - ${statementData?.employee?.name || ""}`;
    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            padding: 0; 
            margin: 0;
            color: #0f172a; 
            background: #fff !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
          }
          @media print {
            body { padding: 0 !important; }
            .print-container { padding: 0 !important; max-width: 100% !important; }
            @page { size: A4 portrait; margin: 10mm; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">${printContent}</div>
      </body>
      </html>
    `;
    printA4Html(fullHtml, title);
  };

  const accent = docSettings?.accentColor || "#2563eb";
  const logo = docSettings?.logoUrl || defaultLogo;
  const companyName = docSettings?.companyName || "OmniSystem Pro";
  const companySubtitle = docSettings?.companySubtitle || "نظام نقاط البيع وإدارة الموارد";
  const headerTitle = docSettings?.employeeHeaderText || "كشف حساب ومسير رواتب موظف معتمد";
  const footerText = docSettings?.employeeFooterText || "إدارة الموارد البشرية - التوقيع والاعتماد";

  const basicSalary = Number(statementData?.employee?.basic_salary) || 0;
  const overtimeSum = Number(statementData?.overtimeTotal) || 0;
  const entitlementsSum = Number(statementData?.entitlementsTotal) || 0;
  const grossEntitlements = basicSalary + overtimeSum + entitlementsSum;

  const penaltiesSum = Number(statementData?.penaltiesTotal) || 0;
  const mealsSum = Number(statementData?.mealsTotal) || 0;
  const loansSum = Number(statementData?.loansTotal) || 0;
  const absencesSum = Number(statementData?.absencesTotal) || 0;
  const manualEntriesSum = Number(statementData?.manualEntriesTotal) || 0;
  const latesSum = Number(statementData?.latesTotal) || 0;

  const totalDeductions = penaltiesSum + mealsSum + loansSum + absencesSum + manualEntriesSum + latesSum;
  const netVouchersPaid = Number(statementData?.netVouchersPaid) || 0;
  const finalNetSalary = Number(statementData?.netSalary) ?? (grossEntitlements - totalDeductions);
  const remainingBalance = Number(statementData?.remainingToPay ?? (finalNetSalary - netVouchersPaid));

  // Helper to generate the detailed transactions list for both print and live preview
  const statementTransactions: any[] = [];
  if (statementData) {
    let running = basicSalary;
    statementTransactions.push({
      date: statementMonth + "-01",
      type: "راتب أساسي",
      source: "salary_earned",
      reference: `SAL-${statementMonth}`,
      description: `استحقاق الراتب الأساسي الشهري (${statementMonth})`,
      debit: 0,
      credit: basicSalary,
      running_balance: running
    });

    // 1. العمل الإضافي (Overtime) - تفصيلي
    const overtimeList = Array.isArray(statementData.overtime) ? statementData.overtime : [];
    if (overtimeList.length > 0) {
      overtimeList.slice().reverse().forEach((ot: any) => {
        const amt = Number(ot.total_amount) || 0;
        if (amt > 0) {
          running += amt;
          statementTransactions.push({
            date: ot.date || (statementMonth + "-15"),
            type: "عمل إضافي",
            source: "hr_overtime",
            reference: `OT-${ot.id}`,
            description: `عمل إضافي (${ot.hours || 0} ساعة × ${ot.rate || 0})${ot.notes ? ` - ${ot.notes}` : ""}`,
            debit: 0,
            credit: amt,
            running_balance: running
          });
        }
      });
    } else if (overtimeSum > 0) {
      running += overtimeSum;
      statementTransactions.push({
        date: statementMonth + "-15",
        type: "عمل إضافي",
        source: "hr_overtime",
        reference: `OT-${statementMonth}`,
        description: "إجمالي مستحق ساعات العمل الإضافية المسجلة بالشهر",
        debit: 0,
        credit: overtimeSum,
        running_balance: running
      });
    }

    // 2. المكافآت والبدلات (Entitlements) - تفصيلي
    const entitlementsList = Array.isArray(statementData.entitlements) ? statementData.entitlements : [];
    if (entitlementsList.length > 0) {
      entitlementsList.slice().reverse().forEach((en: any) => {
        const amt = Number(en.amount) || 0;
        if (amt > 0) {
          running += amt;
          const typeLabel = en.type === "bonus" ? "مكافأة" : en.type === "allowance" ? "بدل" : en.type || "استحقاق إضافي";
          statementTransactions.push({
            date: en.date || (statementMonth + "-20"),
            type: "مكافآت وبدلات",
            source: "hr_entitlement",
            reference: `ENT-${en.id}`,
            description: `${typeLabel}${en.notes ? ` - ${en.notes}` : ""}`,
            debit: 0,
            credit: amt,
            running_balance: running
          });
        }
      });
    } else if (entitlementsSum > 0) {
      running += entitlementsSum;
      statementTransactions.push({
        date: statementMonth + "-20",
        type: "مكافآت وبدلات",
        source: "hr_entitlement",
        reference: `ENT-${statementMonth}`,
        description: "مستحقات وبدلات إضافية معتمدة للموظف",
        debit: 0,
        credit: entitlementsSum,
        running_balance: running
      });
    }

    // 3. المخالفات والجزاءات (Penalties) - تفصيلي
    const penaltiesList = Array.isArray(statementData.penalties) ? statementData.penalties : [];
    if (penaltiesList.length > 0) {
      penaltiesList.slice().reverse().forEach((pen: any) => {
        const amt = Number(pen.amount) || 0;
        if (amt > 0) {
          running -= amt;
          statementTransactions.push({
            date: pen.date || (statementMonth + "-25"),
            type: "خصم مخالفات",
            source: "hr_penalty",
            reference: `PEN-${pen.id}`,
            description: `جزاء: ${pen.violation_name || "مخالفة إدارية"}${pen.notes ? ` (${pen.notes})` : ""}`,
            debit: amt,
            credit: 0,
            running_balance: running
          });
        }
      });
    } else if (penaltiesSum > 0) {
      running -= penaltiesSum;
      statementTransactions.push({
        date: statementMonth + "-25",
        type: "خصم مخالفات",
        source: "hr_penalty",
        reference: `PEN-${statementMonth}`,
        description: "خصومات الجزاءات والمخالفات المعتمدة",
        debit: penaltiesSum,
        credit: 0,
        running_balance: running
      });
    }

    // 4. الغياب والإجازات غير المدفوعة (Absences)
    if (absencesSum > 0) {
      running -= absencesSum;
      const absDays = Number(statementData.absencesCount) || 0;
      statementTransactions.push({
        date: statementMonth + "-25",
        type: "خصم غياب",
        source: "hr_absence",
        reference: `ABS-${statementMonth}`,
        description: `خصم أيام الغياب والانقطاع عن العمل${absDays > 0 ? ` (${absDays} يوم)` : ""}`,
        debit: absencesSum,
        credit: 0,
        running_balance: running
      });
    }

    // 5. التأخير (Lates)
    if (latesSum > 0) {
      running -= latesSum;
      const lateCnt = Number(statementData.latesCount) || 0;
      statementTransactions.push({
        date: statementMonth + "-25",
        type: "خصم تأخير",
        source: "hr_delay",
        reference: `LAT-${statementMonth}`,
        description: `خصم تأخير الدوام التراكمي${lateCnt > 0 ? ` (${lateCnt} مرات تأخير)` : ""}`,
        debit: latesSum,
        credit: 0,
        running_balance: running
      });
    }

    // 6. وجبات الموظفين (Meal Deductions) - تفصيلي
    const mealsList = Array.isArray(statementData.meals) ? statementData.meals : [];
    if (mealsList.length > 0) {
      mealsList.slice().reverse().forEach((ml: any) => {
        const amt = Number(ml.amount) || 0;
        if (amt > 0) {
          running -= amt;
          statementTransactions.push({
            date: ml.created_at || (statementMonth + "-25"),
            type: "خصم وجبات",
            source: "meal_deduction",
            reference: ml.invoice_number ? `#${ml.invoice_number}` : `MEAL-${ml.id}`,
            description: `وجبة موظف${ml.invoice_number ? ` - فاتورة #${ml.invoice_number}` : ""}${ml.notes ? ` (${ml.notes})` : ""}`,
            debit: amt,
            credit: 0,
            running_balance: running
          });
        }
      });
    } else if (mealsSum > 0) {
      running -= mealsSum;
      statementTransactions.push({
        date: statementMonth + "-25",
        type: "خصم وجبات",
        source: "meal_deduction",
        reference: `MEAL-${statementMonth}`,
        description: "استقطاع وجبات طعام من راتب الموظف",
        debit: mealsSum,
        credit: 0,
        running_balance: running
      });
    }

    // 7. السلف والقروض (Loans / Advances) - تفصيلي
    const loansList = (Array.isArray(statementData.loans) ? statementData.loans : []).filter(
      (l: any) => (l.type === "loan" || l.type === "temporary" || !l.type) && (l.status === "approved" || l.status === "active")
    );
    if (loansList.length > 0) {
      loansList.slice().reverse().forEach((ln: any) => {
        const amt = Number(ln.amount) || 0;
        if (amt > 0) {
          running -= amt;
          statementTransactions.push({
            date: ln.request_date || (statementMonth + "-28"),
            type: "تسوية سلفة",
            source: "hr_loan",
            reference: `LOAN-${ln.id}`,
            description: `استقطاع سلفة نقدية / قرض${ln.repayment_terms ? ` (${ln.repayment_terms})` : ""}${ln.notes ? ` - ${ln.notes}` : ""}`,
            debit: amt,
            credit: 0,
            running_balance: running
          });
        }
      });
    } else if (loansSum > 0) {
      running -= loansSum;
      statementTransactions.push({
        date: statementMonth + "-28",
        type: "تسوية سلفة",
        source: "hr_loan",
        reference: `LOAN-${statementMonth}`,
        description: "استقطاع وتنزيل سلفة نقدية / جزء من القرض",
        debit: loansSum,
        credit: 0,
        running_balance: running
      });
    }

    // 8. القيود اليدوية والتسويات (Manual Entries) - تفصيلي
    const manualList = Array.isArray(statementData.manualEntries) ? statementData.manualEntries : [];
    if (manualList.length > 0) {
      manualList.slice().reverse().forEach((me: any) => {
        const d = Number(me.debit) || 0;
        const c = Number(me.credit) || 0;
        if (d > 0 || c > 0) {
          running = running + c - d;
          statementTransactions.push({
            date: me.entry_date || me.created_at || (statementMonth + "-28"),
            type: "تسوية يدوية",
            source: "manual",
            reference: `MAN-${me.id}`,
            description: me.description || me.notes || "قيد تسوية يدوي بحساب الموظف",
            debit: d,
            credit: c,
            running_balance: running
          });
        }
      });
    } else if (manualEntriesSum !== 0) {
      const d = manualEntriesSum > 0 ? manualEntriesSum : 0;
      const c = manualEntriesSum < 0 ? Math.abs(manualEntriesSum) : 0;
      running = running + c - d;
      statementTransactions.push({
        date: statementMonth + "-28",
        type: "تسوية يدوية",
        source: "manual",
        reference: `MAN-${statementMonth}`,
        description: "صافي قيود التسوية اليدوية بالملف",
        debit: d,
        credit: c,
        running_balance: running
      });
    }

    // 9. سندات الصرف والقبض النقدية (Vouchers) - تفصيلي
    const vouchersList = Array.isArray(statementData.vouchers) ? statementData.vouchers : [];
    if (vouchersList.length > 0) {
      vouchersList.slice().reverse().forEach((vc: any) => {
        const amt = Number(vc.amount) || 0;
        if (amt > 0) {
          const isPay = vc.type === "payment";
          const d = isPay ? amt : 0;
          const c = isPay ? 0 : amt;
          running = running + c - d;
          statementTransactions.push({
            date: vc.created_at || (statementMonth + "-30"),
            type: isPay ? "سند صرف راتب/دفعة" : "سند قبض من موظف",
            source: isPay ? "payment_voucher" : "receipt_voucher",
            reference: vc.voucher_number || `VCH-${vc.id}`,
            description: `${isPay ? "صرف نقدي للموظف" : "توريد نقدي من الموظف"}${vc.payment_against ? ` (${vc.payment_against})` : ""}${vc.notes ? ` - ${vc.notes}` : ""}`,
            debit: d,
            credit: c,
            running_balance: running
          });
        }
      });
    }
  }

  const baseStatementParams = statementData ? {
    partyType: "employee" as const,
    party: {
      id: statementData.employee?.id,
      name: statementData.employee?.name,
      employee_number: statementData.employee?.employee_number,
      position: statementData.employee?.position,
      department_name: statementData.employee?.department_name,
      basic_salary: basicSalary,
      phone: statementData.employee?.phone,
      hire_date: statementData.employee?.hire_date,
      active: statementData.employee?.active,
    },
    startDate: statementMonth,
    endDate: statementMonth,
    previousBalance: 0,
    currentBalance: statementTransactions.length > 0
      ? statementTransactions[statementTransactions.length - 1].running_balance
      : remainingBalance,
    transactions: statementTransactions,
    settings: docSettings,
    printerSettings,
    docTitle: "كشف حساب ومسير رواتب موظف معتمد"
  } : null;

  // Generate both A4 HTML and high-precision 80(72.1) x 297 mm Thermal HTML
  const generatedA4Html = baseStatementParams ? generateStatementA4Html({
    ...baseStatementParams,
    paperFormat: "A4",
  }) : "";

  const generatedThermal80mmHtml = baseStatementParams ? generateStatementA4Html({
    ...baseStatementParams,
    paperFormat: "80mm",
  }) : "";

  const generatedHtml = previewFormat === "80mm" ? generatedThermal80mmHtml : generatedA4Html;

  const handlePrintA4 = () => {
    if (!generatedA4Html) return;
    printA4Html(generatedA4Html, `كشف حساب موظف (A4) - ${statementData?.employee?.name}`);
  };

  const handlePrintThermal80mm = () => {
    if (!generatedThermal80mmHtml) return;
    printA4Html(generatedThermal80mmHtml, `كشف حساب موظف حراري 80mm - ${statementData?.employee?.name}`);
  };

  const handlePrint = () => {
    if (previewFormat === "80mm") {
      handlePrintThermal80mm();
    } else {
      handlePrintA4();
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full gap-1 overflow-x-auto h-auto p-1 bg-muted">
          <TabsTrigger value="employee_statement" className="py-2 text-xs">كشف حساب موظف</TabsTrigger>
          <TabsTrigger value="custody_statement" className="py-2 text-xs">سجل العهد للموظفين</TabsTrigger>
          <TabsTrigger value="tools_movement" className="py-2 text-xs">حركة دخول وخروج الأدوات</TabsTrigger>
          <TabsTrigger value="leaves_report" className="py-2 text-xs">تقرير الإجازات</TabsTrigger>
          <TabsTrigger value="penalties_report" className="py-2 text-xs">تقرير المخالفات والجزاءات</TabsTrigger>
          <TabsTrigger value="notes_report" className="py-2 text-xs">سجل ملاحظات الأقسام</TabsTrigger>
        </TabsList>

        {/* 1. كشف حساب موظف تفصيلي */}
        <TabsContent value="employee_statement" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />توليد كشف حساب تفصيلي شامل للموظف</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 items-end flex-wrap">
              <div className="w-64">
                <label className="text-xs text-muted-foreground font-semibold mb-1 block">الموظف المعني</label>
                <SearchableSelect
                  options={((employees as any[]) || []).map((e: any) => ({
                    value: String(e.id),
                    label: e.name,
                    sublabel: e.position || e.department_name || "موظف",
                    badge: e.employee_number ? `#${e.employee_number}` : undefined
                  }))}
                  value={statementEmpId}
                  onChange={setStatementEmpId}
                  placeholder="ابحث واختر الموظف..."
                  searchPlaceholder="ابحث بالاسم أو الرقم..."
                />
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground font-semibold">شهر الاستحقاق</label>
                <Input type="month" value={statementMonth} onChange={e => setStatementMonth(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={fetchStatement} size="sm" disabled={loadingStatement}>
                {loadingStatement ? "جاري التوليد..." : "توليد الكشف المالي"}
              </Button>
              {statementData && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handlePrintThermal80mm}
                    size="sm"
                    className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    <Printer className="w-4 h-4" /> طباعة حرارية 80(72.1)×297mm
                  </Button>
                  <Button
                    onClick={handlePrintA4}
                    size="sm"
                    variant="outline"
                    className="gap-2 border-primary text-primary hover:bg-primary/10 font-bold"
                  >
                    <Printer className="w-4 h-4" /> طباعة كشف الحساب (A4)
                  </Button>
                  <Button
                    onClick={() => setViewerModalOpen(true)}
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 font-bold"
                  >
                    <Eye className="w-4 h-4" /> استعراض وتصدير PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {statementData && (
            <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
              <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> معاينة كشف الحساب المالي المعتمد
                  </h3>
                  <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewFormat("a4")}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                        previewFormat === "a4"
                          ? "bg-primary text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      مقاس قياسي A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFormat("80mm")}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                        previewFormat === "80mm"
                          ? "bg-emerald-700 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      حراري عالي الدقة 80(72.1) × 297 mm
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handlePrintThermal80mm}
                    size="sm"
                    className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    <Printer className="w-4 h-4" /> طباعة حرارية 80(72.1)×297mm
                  </Button>
                  <Button onClick={handlePrintA4} size="sm" className="gap-2 font-bold">
                    <Printer className="w-4 h-4" /> طباعة الكشف (A4)
                  </Button>
                </div>
              </div>
              
              <div id="employee-statement-preview" className="border rounded-lg bg-slate-100 p-3 overflow-auto shadow-inner flex justify-center">
                <iframe
                  title="معاينة كشف حساب موظف تفصيلي"
                  srcDoc={generatedHtml}
                  className={`border border-slate-300 bg-white rounded shadow-md transition-all ${
                    previewFormat === "80mm" ? "w-[340px] max-w-full h-[760px]" : "w-full h-[760px]"
                  }`}
                />
              </div>
            </div>
          )}

          {statementData && (
            <ReportViewerModal
              isOpen={viewerModalOpen}
              onClose={() => setViewerModalOpen(false)}
              htmlContent={generatedA4Html}
              thermalHtmlContent={generatedThermal80mmHtml}
              title={`كشف حساب موظف تفصيلي شامل - ${statementData?.employee?.name || ""}`}
            />
          )}
        </TabsContent>

        {/* 2. سجل عهد الموظفين */}
        <TabsContent value="custody_statement">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4 text-amber-500" />سجل جرد ومطابقة عهد الموظفين</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">بيان العهدة</th><th className="text-right p-3 font-semibold">تاريخ التسليم</th><th className="text-right p-3 font-semibold">تاريخ الاسترداد</th><th className="text-right p-3 font-semibold">حالة العهدة</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((custodiesReport as any[]) || []).map((c: any) => (
                    <tr key={c.id}>
                      <td className="p-3 font-medium">{c.employee_name}</td>
                      <td className="p-3 font-bold text-slate-700">{c.item_name}</td>
                      <td className="p-3 font-mono">{c.received_date}</td>
                      <td className="p-3 font-mono">{c.returned_date ?? "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${c.status === "held" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {c.status === "held" ? "مستمرة" : "تمت إعادتها"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. حركة دخول وخروج الأدوات */}
        <TabsContent value="tools_movement">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-500" />سجل حركة خروج وعودة الأدوات</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الحركة</th><th className="text-right p-3 font-semibold">الأداة</th><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">الكمية</th><th className="text-right p-3 font-semibold">تاريخ الحركة</th><th className="text-right p-3 font-semibold">ملاحظات</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((movementsReport as any[]) || []).map((m: any) => (
                    <tr key={m.id}>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.type === "out" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {m.type === "out" ? "صرف" : "عودة للعهدة"}
                        </span>
                      </td>
                      <td className="p-3">{m.tool_name}</td>
                      <td className="p-3">{m.employee_name}</td>
                      <td className="p-3 font-mono font-bold">{m.quantity}</td>
                      <td className="p-3 text-muted-foreground font-mono">{m.date}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. تقرير الإجازات */}
        <TabsContent value="leaves_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold">تقرير تفصيلي بالإجازات المسجلة</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">نوع الإجازة</th><th className="text-right p-3 font-semibold">من تاريخ</th><th className="text-right p-3 font-semibold">إلى تاريخ</th><th className="text-right p-3 font-semibold">الحالة</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((leavesReport as any[]) || []).map((l: any) => (
                    <tr key={l.id}>
                      <td className="p-3 font-semibold">{l.employee_name}</td>
                      <td className="p-3 font-medium text-blue-700">{l.type}</td>
                      <td className="p-3 font-mono">{l.start_date}</td>
                      <td className="p-3 font-mono">{l.end_date}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. تقرير المخالفات والجزاءات */}
        <TabsContent value="penalties_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" />سجل الجزاءات المالية والمخالفات المرصودة</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">البيان</th><th className="text-right p-3 font-semibold font-mono">الخصم المالي</th><th className="text-right p-3 font-semibold">تاريخ المخالفة</th><th className="text-right p-3 font-semibold">ملاحظات</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((penaltiesReport as any[]) || []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-3 font-medium">{p.employee_name}</td>
                      <td className="p-3 font-bold text-red-600">{p.violation_name}</td>
                      <td className="p-3 font-mono font-black text-red-600">-{fmt(p.amount)}</td>
                      <td className="p-3 text-muted-foreground font-mono">{p.date}</td>
                      <td className="p-3 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. تقرير ملاحظات الأقسام */}
        <TabsContent value="notes_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-purple-500" />سجل الملاحظات والطلبات التاريخية للأقسام</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">القسم المعني</th><th className="text-right p-3 font-semibold">العنوان والبيان</th><th className="text-right p-3 font-semibold">تاريخ ووقت التسجيل</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((notesReport as any[]) || []).map((n: any) => (
                    <tr key={n.id}>
                      <td className="p-3"><span className="font-bold px-2 py-1 bg-purple-50 text-purple-700 rounded-md">{n.department_name ?? "عام لكافة الأقسام"}</span></td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{n.content}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">{new Date(n.created_at).toLocaleString("ar-SA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
