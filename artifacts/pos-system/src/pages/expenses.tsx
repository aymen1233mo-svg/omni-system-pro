import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Plus, Trash2, Calendar, Printer, Eye, FileText, Filter, RotateCcw, Check, ArrowDownRight, Building2, Receipt } from "lucide-react";
import { ReportViewerModal } from "@/components/ReportViewerModal";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Form states for adding new expense
  const [category, setCategory] = useState("كهرباء");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [safeId, setSafeId] = useState("");

  // Filter states
  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonthStr = new Date().toISOString().slice(0, 7) + "-01";
  const [filterStartDate, setFilterStartDate] = useState(startOfMonthStr);
  const [filterEndDate, setFilterEndDate] = useState(todayStr);
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterSafeId, setFilterSafeId] = useState("ALL");

  // Report Viewer states
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Queries
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => apiGet("/api/expenses") });
  const { data: safes = [] } = useQuery({ queryKey: ["safes-list"], queryFn: () => apiGet("/api/safes") });
  const { data: printerSettings } = useQuery({ queryKey: ["printer-settings"], queryFn: () => apiGet("/api/printer-settings") });
  const { data: businessSettings } = useQuery({ queryKey: ["settings"], queryFn: () => apiGet("/api/settings") });

  const businessName = (businessSettings as any)?.businessName ?? "المؤسسة / المطعم";

  // Mutations
  const addMut = useMutation({
    mutationFn: () => apiPost("/api/expenses", {
      category,
      amount: Number(amount),
      expense_date: expenseDate,
      notes,
      safe_id: safeId ? Number(safeId) : undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["safes-list"] });
      setAmount("");
      setNotes("");
      toast({ title: "تم إضافة المصروف بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["safes-list"] });
      toast({ title: "تم الحذف بنجاح" });
    }
  });

  // Filtered Expenses
  const filteredExpenses = ((expenses as any[]) || []).filter(e => {
    if (filterStartDate && e.expense_date < filterStartDate) return false;
    if (filterEndDate && e.expense_date > filterEndDate) return false;
    if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
    if (filterSafeId !== "ALL" && String(e.safe_id ?? "") !== filterSafeId) return false;
    return true;
  });

  const totalFilteredExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const avgExpense = filteredExpenses.length > 0 ? totalFilteredExpenses / filteredExpenses.length : 0;

  // Quick Date Filter Helpers
  const setQuickDate = (type: "today" | "week" | "month" | "all") => {
    if (type === "today") {
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (type === "week") {
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      setFilterStartDate(firstDay.toISOString().slice(0, 10));
      setFilterEndDate(todayStr);
    } else if (type === "month") {
      setFilterStartDate(startOfMonthStr);
      setFilterEndDate(todayStr);
    } else if (type === "all") {
      setFilterStartDate("");
      setFilterEndDate("");
    }
  };

  // ── A4 Preview for Expenses Statement ──
  const handlePreviewA4Summary = () => {
    const listRowsHtml = filteredExpenses.map((e, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px; font-weight: bold; color: #475569;">${idx + 1}</td>
        <td style="padding: 8px; font-weight: bold; color: #1e3a8a;">${e.category}</td>
        <td style="padding: 8px;">${e.safe_name ?? "الصندوق الرئيسي"}</td>
        <td style="padding: 8px; font-family: monospace; font-weight: 900; color: #b91c1c; text-align: left;" dir="ltr">${fmt(e.amount)} YER</td>
        <td style="padding: 8px;">${e.expense_date}</td>
        <td style="padding: 8px; color: #334155;">${e.notes || "—"}</td>
        <td style="padding: 8px; color: #64748b;">${e.user_name || "—"}</td>
      </tr>
    `).join("");

    const html = `
      <div style="direction: rtl; font-family: 'Tajawal', sans-serif; padding: 25px; color: #0f172a; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 15px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #1e3a8a;">${businessName}</h1>
            <h2 style="margin: 4px 0 0; font-size: 16px; font-weight: bold; color: #475569;">كشف المصروفات والخرجيات التشغيلية الشامل</h2>
          </div>
          <div style="text-align: left; font-size: 12px; color: #64748b;">
            <div><strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString('ar-SA')}</div>
            <div><strong>الفترة:</strong> من ${filterStartDate || 'البداية'} إلى ${filterEndDate || 'الآن'}</div>
          </div>
        </div>

        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: right;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">إجمالي المصروفات للفترة</div>
            <div style="font-size: 20px; font-weight: 900; color: #b91c1c; font-family: monospace; margin-top: 4px;" dir="ltr">${fmt(totalFilteredExpenses)} YER</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: right;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">عدد السندات المعروضة</div>
            <div style="font-size: 20px; font-weight: 900; color: #1e3a8a; font-family: monospace; margin-top: 4px;">${filteredExpenses.length} سند</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; text-align: right;">
            <div style="font-size: 11px; color: #64748b; font-weight: bold;">متوسط المصروف للسند</div>
            <div style="font-size: 20px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 4px;" dir="ltr">${fmt(avgExpense)} YER</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 12px; font-weight: bold; color: #1e293b;">
              <th style="padding: 10px; text-align: right;">#</th>
              <th style="padding: 10px; text-align: right;">التصنيف</th>
              <th style="padding: 10px; text-align: right;">الصندوق المالي</th>
              <th style="padding: 10px; text-align: left;">المبلغ المنصرف</th>
              <th style="padding: 10px; text-align: right;">التاريخ</th>
              <th style="padding: 10px; text-align: right;">البيان والملاحظات</th>
              <th style="padding: 10px; text-align: right;">المسجل</th>
            </tr>
          </thead>
          <tbody>
            ${listRowsHtml || "<tr><td colSpan='7' style='padding: 20px; text-align: center; color: #94a3b8;'>لا توجد مصروفات مسجلة ضمن هذه الفترة</td></tr>"}
          </tbody>
        </table>

        <!-- Prominent Total Footer Box -->
        <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 15px; margin-top: 25px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 16px; font-weight: 900; color: #991b1b;">المجموع الإجمالي الشامل للمصروفات التشغيلية:</span>
            <span style="font-size: 24px; font-weight: 900; color: #b91c1c; font-family: monospace;" dir="ltr">${fmt(totalFilteredExpenses)} YER</span>
          </div>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; color: #475569;">
          <div>
            <div>توقيع المحاسب المسؤول</div>
            <div style="margin-top: 30px; font-weight: bold;">.......................................</div>
          </div>
          <div>
            <div>توقيع المدير المالي / الاعتماد</div>
            <div style="margin-top: 30px; font-weight: bold;">.......................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle("كشف الخرجيات والمصروفات التشغيلية الشامل (A4)");
    setReportViewerOpen(true);
  };

  // ── Thermal 80mm Preview for Expenses Statement ──
  const handlePreviewThermal80mmSummary = () => {
    const ps = printerSettings as any;
    const pw = ps?.paperWidth ?? 80;
    const lm = (ps?.leftMargin !== undefined && ps?.leftMargin !== null) ? ps.leftMargin : 2;
    const rm = (ps?.rightMargin !== undefined && ps?.rightMargin !== null) ? ps.rightMargin : 2;
    const tm = ps?.topMargin ?? 2;
    const bm = ps?.bottomMargin ?? 4;
    const currency = "YER";

    const itemRowsHtml = filteredExpenses.map((e, idx) => `
      <div style="border-bottom: 1px dashed #94a3b8; padding: 4px 0; margin-bottom: 3px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
          <span>${idx + 1}. ${e.category}</span>
          <span style="font-family: monospace; color: #b91c1c;">${fmt(e.amount)} ${currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #475569; margin-top: 2px;">
          <span>📅 ${e.expense_date} | 🏦 ${e.safe_name || "الصندوق"}</span>
          <span>👤 ${e.user_name || "المسؤول"}</span>
        </div>
        ${e.notes ? `<div style="font-size: 9px; color: #334155; margin-top: 2px;">📝 ${e.notes}</div>` : ""}
      </div>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>كشف الخرجيات الحراري 80mm</title>
          <style>
            @page {
              size: ${pw}mm auto;
              margin: ${tm}mm ${rm}mm ${bm}mm ${lm}mm;
            }
            body {
              font-family: 'Tajawal', 'Cairo', Tahoma, sans-serif;
              width: ${pw - lm - rm}mm;
              margin: 0 auto;
              padding: 5px 0;
              color: #0f172a;
              font-size: 11px;
              direction: rtl;
              background: #fff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .sep { border-top: 1.5px solid #000; margin: 6px 0; }
            .double-sep { border-top: 2px double #000; margin: 8px 0; }
            .total-box {
              background: #f1f5f9;
              border: 1.5px solid #000;
              padding: 8px;
              text-align: center;
              margin-top: 8px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px; margin-bottom: 2px;">${businessName}</div>
          <div class="center bold" style="font-size: 12px; color: #1e3a8a;">كشف الخرجيات والمصروفات التشغيلية</div>
          <div class="center" style="font-size: 9px; color: #475569; margin-top: 3px;">
            الفترة: من ${filterStartDate || "البداية"} إلى ${filterEndDate || "الآن"}
          </div>
          <div class="center" style="font-size: 9px; color: #64748b;">
            تاريخ التصدير: ${new Date().toLocaleDateString("ar-SA")}
          </div>

          <div class="sep"></div>

          <div>
            ${itemRowsHtml || '<div class="center" style="padding: 10px; color: #64748b;">لا توجد مصروفات مسجلة في هذه الفترة</div>'}
          </div>

          <div class="double-sep"></div>

          <div class="total-box">
            <div style="font-size: 10px; font-weight: bold; color: #334155;">إجمالي الخرجيات والمصروفات (${filteredExpenses.length} بند)</div>
            <div style="font-size: 17px; font-weight: 900; color: #b91c1c; font-family: monospace; margin-top: 3px;">
              ${fmt(totalFilteredExpenses)} ${currency}
            </div>
          </div>

          <div class="center" style="font-size: 9px; color: #94a3b8; margin-top: 15px;">
            نظام Omni System Pro ERP — طباعة حرارية 80mm
          </div>
        </body>
      </html>
    `;

    setReportHtml(html);
    setReportTitle("كشف الخرجيات الحراري (طابعة الفواتير 80mm)");
    setReportViewerOpen(true);
  };

  // ── Single Expense Voucher Preview ──
  const handlePreviewSingleVoucherA4 = (e: any) => {
    const html = `
      <div style="direction: rtl; font-family: 'Tajawal', sans-serif; padding: 30px; border: 2px solid #1e3a8a; border-radius: 12px; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px;">
          <div>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 20px;">${businessName}</h1>
            <h2 style="margin: 4px 0 0; color: #475569; font-size: 16px;">سند صرف مصروفات تشغيلية</h2>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 12px; font-family: monospace; font-weight: bold;">سند رقم: EXP-${e.id}</p>
          </div>
          <div style="text-align: left;">
            <div style="font-size: 13px; font-weight: bold;">تاريخ الصرف: ${e.expense_date}</div>
            <div style="font-size: 12px; color: #64748b;">الصندوق: ${e.safe_name || "الصندوق الرئيسي"}</div>
          </div>
        </div>

        <div style="margin: 30px 0; font-size: 15px; line-height: 2.2; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div><strong>تصنيف المصروف:</strong> <span style="color: #1e3a8a; font-weight: bold;">${e.category}</span></div>
          <div><strong>المبلغ المنصرف:</strong> <span style="font-size: 20px; font-weight: 900; color: #b91c1c; font-family: monospace;">${fmt(e.amount)} YER</span></div>
          <div><strong>البيان / الملاحظات:</strong> <span style="color: #334155;">${e.notes || "لا توجد ملاحظات إضافية"}</span></div>
          <div><strong>الموظف المسجل:</strong> <span style="color: #64748b;">${e.user_name || "المسؤول المحاسبي"}</span></div>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; text-align: center; font-size: 13px;">
          <div>
            <div>توقيع المستلم / الجهة</div>
            <div style="margin-top: 35px; font-weight: bold;">.................................</div>
          </div>
          <div>
            <div>توقيع المحاسب / الختم</div>
            <div style="margin-top: 35px; font-weight: bold;">.................................</div>
          </div>
        </div>
      </div>
    `;
    setReportHtml(html);
    setReportTitle(`سند صرف مصروف - ${e.category} (#EXP-${e.id})`);
    setReportViewerOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl border border-red-200">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">إدارة الخرجيات والمصروفات التشغيلية</h1>
              <p className="text-xs text-slate-500">تسجيل وضبط كافة المصروفات وسندات الصرف والتقارير الفترية</p>
            </div>
          </div>

          {/* Top Actions & Overall KPI */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePreviewA4Summary}
              className="gap-1.5 font-bold text-xs border-blue-300 text-blue-900 bg-blue-50/50 hover:bg-blue-100 shadow-xs"
            >
              <Eye className="w-4 h-4 text-blue-700" />
              معاينة كشف A4 الشامل
            </Button>

            <Button
              onClick={handlePreviewThermal80mmSummary}
              className="gap-1.5 font-bold text-xs bg-gradient-to-r from-slate-800 to-slate-950 text-amber-300 hover:from-slate-900 hover:to-black shadow-xs border border-slate-700"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              طباعة كشف حراري (80mm)
            </Button>
          </div>
        </div>

        {/* Filter Toolbar (التصفية من تاريخ - إلى تاريخ والتصنيف والصندوق) */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3 pt-4 px-5 border-b bg-slate-50/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                تصفية كشف الخرجيات والمصروفات الفترية (من - إلى)
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setQuickDate("today")} className="h-7 text-[11px] font-bold px-2 text-slate-700">اليوم</Button>
                <Button variant="ghost" size="sm" onClick={() => setQuickDate("week")} className="h-7 text-[11px] font-bold px-2 text-slate-700">هذا الأسبوع</Button>
                <Button variant="ghost" size="sm" onClick={() => setQuickDate("month")} className="h-7 text-[11px] font-bold px-2 text-blue-700">هذا الشهر</Button>
                <Button variant="ghost" size="sm" onClick={() => setQuickDate("all")} className="h-7 text-[11px] font-bold px-2 text-slate-500">الكل</Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">من تاريخ *</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="text-xs font-mono border-slate-300"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">إلى تاريخ *</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="text-xs font-mono border-slate-300"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصفية حسب التصنيف</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800"
              >
                <option value="ALL">جميع التصنيفات</option>
                <option value="كهرباء">كهرباء</option>
                <option value="ماء">ماء</option>
                <option value="إيجار">إيجار</option>
                <option value="مرتبات">مرتبات</option>
                <option value="تشغيل وصيانة">تشغيل وصيانة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 block">تصفية حسب الصندوق المالي</label>
              <select
                value={filterSafeId}
                onChange={e => setFilterSafeId(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800"
              >
                <option value="ALL">جميع الصناديق</option>
                {((safes as any[]) || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Filtered Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-rose-100/50 border-red-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-700 block">إجمالي المصروفات للفترة</span>
                <span className="text-2xl font-black text-red-900 font-mono mt-1 block" dir="ltr">
                  {fmt(totalFilteredExpenses)} YER
                </span>
              </div>
              <div className="p-3 bg-red-600 text-white rounded-xl shadow-xs">
                <ArrowDownRight className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100/50 border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-700 block">عدد سندات المصروفات</span>
                <span className="text-2xl font-black text-blue-900 font-mono mt-1 block">
                  {filteredExpenses.length} <span className="text-xs font-normal">سند</span>
                </span>
              </div>
              <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs">
                <Receipt className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-teal-100/50 border-emerald-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 block">متوسط قيمة المصروف</span>
                <span className="text-2xl font-black text-emerald-900 font-mono mt-1 block" dir="ltr">
                  {fmt(avgExpense)} YER
                </span>
              </div>
              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form: Add New Expense */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2 pt-3 px-5 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              تسجيل سند مصروفات جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <select value={category} onChange={e => setCategory(e.target.value)} className="border border-slate-300 rounded-md px-3 bg-white text-xs font-bold text-slate-800 h-9">
              <option value="كهرباء">كهرباء</option>
              <option value="ماء">ماء</option>
              <option value="إيجار">إيجار</option>
              <option value="مرتبات">مرتبات</option>
              <option value="تشغيل وصيانة">تشغيل وصيانة</option>
              <option value="أخرى">أخرى</option>
            </select>

            <select value={safeId} onChange={e => setSafeId(e.target.value)} className="border border-slate-300 rounded-md px-3 bg-white text-xs font-bold text-slate-800 h-9">
              <option value="">-- اختر الصندوق المالي --</option>
              {((safes as any[]) || []).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({fmt(s.balance)} {s.currency})</option>
              ))}
            </select>

            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ *" className="text-xs font-mono font-bold" />
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="text-xs font-mono" />
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات البيان..." className="text-xs" />
            <Button onClick={() => addMut.mutate()} disabled={!amount} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-9">
              <Plus className="w-4 h-4" /> إثبات المصروف
            </Button>
          </CardContent>
        </Card>

        {/* Expenses List Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">التصنيف</th>
                <th className="p-3">الصندوق المالي</th>
                <th className="p-3 text-left">المبلغ المنصرف</th>
                <th className="p-3">تاريخ الصرف</th>
                <th className="p-3">ملاحظات والبيان</th>
                <th className="p-3">الموظف المسجل</th>
                <th className="p-3 text-center w-28">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredExpenses.map((e, idx) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-blue-900">{e.category}</td>
                  <td className="p-3 font-semibold text-slate-600">{e.safe_name ?? "الصندوق الرئيسي"}</td>
                  <td className="p-3 font-mono font-black text-red-600 text-left text-sm" dir="ltr">{fmt(e.amount)} YER</td>
                  <td className="p-3 text-slate-600 font-mono">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" />{e.expense_date}</span>
                  </td>
                  <td className="p-3 text-slate-600 max-w-xs truncate">{e.notes ?? "—"}</td>
                  <td className="p-3 text-slate-500">{e.user_name ?? "—"}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                        title="استعراض وطباعة سند المصروف"
                        onClick={() => handlePreviewSingleVoucherA4(e)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                        title="حذف المصروف"
                        onClick={() => confirm("هل أنت متأكد من حذف هذا المصروف؟") && delMut.mutate(e.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                    لا توجد مصروفات مسجلة تطابق محددات التصفية والتاريخ Selected
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Report Viewer Modal */}
        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
        />
      </div>
    </AdminLayout>
  );
}
