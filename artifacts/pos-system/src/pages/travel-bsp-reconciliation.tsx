import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale,
  FileCheck,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  DollarSign,
  Plus,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Percent
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في الخادم");
    }
    return r.json();
  });
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TravelBspReconciliationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

  // Dialog States
  const [isImportHotOpen, setIsImportHotOpen] = useState(false);
  const [isNewPeriodOpen, setIsNewPeriodOpen] = useState(false);
  const [isNewMemoOpen, setIsNewMemoOpen] = useState(false);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [activeMemo, setActiveMemo] = useState<any>(null);
  const [disputeNotes, setDisputeNotes] = useState("");

  // Forms
  const [hotFileContent, setHotFileContent] = useState("");
  const [periodForm, setPeriodForm] = useState({
    period_name: "فترة النصف الأول سبتمبر 2026",
    start_date: "2026-09-01",
    end_date: "2026-09-15",
    remittance_date: "2026-09-28"
  });

  const [memoForm, setMemoForm] = useState({
    memo_type: "ADM",
    memo_number: "ADM-998811",
    airline_code: "SV",
    airline_name: "الخطوط السعودية",
    ticket_number: "065-2415896321",
    pnr: "6X9ZKL",
    amount: 350,
    currency: "SAR",
    reason_description: "تطبيق سعر فئة متدنية غير مطابقة لشروط الإقامة (Fare Class Under-collection)",
    dispute_deadline: "2026-09-25"
  });

  // Queries
  const { data: periods } = useQuery<any[]>({
    queryKey: ["bsp-periods"],
    queryFn: () => fetchWithAuth("/api/travel/bsp/periods")
  });

  const activePeriodId = selectedPeriodId || periods?.[0]?.id || 1;

  const { data: periodDetails } = useQuery<any>({
    queryKey: ["bsp-period-details", activePeriodId],
    queryFn: () => fetchWithAuth(`/api/travel/bsp/periods/${activePeriodId}`),
    enabled: !!activePeriodId
  });

  const { data: memos } = useQuery<any[]>({
    queryKey: ["bsp-memos"],
    queryFn: () => fetchWithAuth("/api/travel/bsp/memos")
  });

  // Mutations
  const importHotMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth<any>("/api/travel/bsp/import-hot", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bsp-periods"] });
      queryClient.invalidateQueries({ queryKey: ["bsp-period-details", activePeriodId] });
      setIsImportHotOpen(false);
      toast({ title: "تم استيراد ومطابقة ملف BSP بنجاح ✅", description: res.message });
    },
    onError: (err: any) => toast({ title: "فشل استيراد الملف", description: err.message, variant: "destructive" })
  });

  const settlePeriodMutation = useMutation({
    mutationFn: (id: number) =>
      fetchWithAuth<any>(`/api/travel/bsp/periods/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({ payment_account_code: "1121" })
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bsp-periods"] });
      queryClient.invalidateQueries({ queryKey: ["bsp-period-details", activePeriodId] });
      toast({ title: "تمت تسوية الفترة المحاسبية بنجاح! 🏛️", description: res.message });
    },
    onError: (err: any) => toast({ title: "فشل التسوية", description: err.message, variant: "destructive" })
  });

  const createMemoMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/bsp/memos", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bsp-memos"] });
      setIsNewMemoOpen(false);
      toast({ title: "تم تسجيل المذكرة بنجاح 📋" });
    },
    onError: (err: any) => toast({ title: "فشل التسجيل", description: err.message, variant: "destructive" })
  });

  const disputeMemoMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      fetchWithAuth(`/api/travel/bsp/memos/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ dispute_notes: notes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bsp-memos"] });
      setIsDisputeOpen(false);
      toast({ title: "تم تقديم الاعتراض الرسمي عبر BSPLink بنجاح ⚖️" });
    }
  });

  const currentPeriod = periodDetails?.period || periods?.find((p) => p.id === activePeriodId);
  const tickets = periodDetails?.tickets || [];

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-600/30 border border-sky-400/30 rounded-xl">
                <Scale className="w-8 h-8 text-sky-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">نظام مطابقة فواتير الإياتا IATA BSP & ADM/ACM Engine</h1>
                <p className="text-sm text-slate-300 mt-1">
                  استيراد ملفات الفوترة الإلكترونية HOT/RET، كشف الفروقات المحاسبية، وإدارة اعتراضات مذكرات التسوية BSPLink
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/travel-dashboard">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition shadow-md cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                الرجوع للواجهة الرئيسية
              </button>
            </Link>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
              onClick={() => setIsImportHotOpen(true)}
            >
              <Upload className="w-4 h-4 ml-2" />
              استيراد ملف IATA HOT / RET
            </Button>
          </div>
        </div>

        {/* Periods List Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {periods?.map((p) => {
            const isSelected = p.id === activePeriodId;
            return (
              <Card
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
                className={`cursor-pointer transition-all border-2 ${
                  isSelected ? "border-sky-600 bg-sky-50/40 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sky-700 text-sm">{p.period_code}</span>
                    <Badge
                      className={
                        p.reconciliation_status === "settled"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.reconciliation_status === "reconciled"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {p.reconciliation_status === "settled" ? "تم السداد والمطابقة" : p.reconciliation_status === "reconciled" ? "تمت المطابقة" : "قيد المعالجة"}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{p.period_name}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    {p.start_date} إلى {p.end_date} (موعد السداد: {p.remittance_date || "نهاية الشهر"})
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t text-xs">
                    <span className="text-slate-500">صافي المستحق للإياتا:</span>
                    <span className="font-bold font-mono text-slate-900 text-sm">{fmt(p.bsp_net_payable)} SAR</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs: Reconciliation Ledger / ADM ACM Management */}
        <Tabs defaultValue="reconciliation" className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="reconciliation" className="py-2.5 font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-sky-600" />
              <span>مصفوفة مطابقة التذاكر وملف الفوترة ({tickets.length} تذكرة)</span>
            </TabsTrigger>
            <TabsTrigger value="memos" className="py-2.5 font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>إدارة مذكرات التسوية والغرامات ADM / ACM ({memos?.length || 0})</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: RECONCILIATION MATRIX */}
          <TabsContent value="reconciliation" className="pt-4 space-y-4">
            {currentPeriod && (
              <div className="space-y-4">
                {/* Financial Summary KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-slate-200 bg-white">
                    <CardContent className="p-4">
                      <div className="text-xs text-slate-500">إجمالي مبيعات التذاكر (IATA Gross):</div>
                      <div className="text-xl font-bold font-mono text-slate-900 mt-1">{fmt(currentPeriod.bsp_gross_amount)} SAR</div>
                      <div className="text-[11px] text-slate-400 mt-1">الضرائب: {fmt(currentPeriod.bsp_tax_amount)} SAR</div>
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-200 bg-emerald-50/40">
                    <CardContent className="p-4">
                      <div className="text-xs text-emerald-700">عمولات الوكالة المكتسبة:</div>
                      <div className="text-xl font-bold font-mono text-emerald-800 mt-1">{fmt(currentPeriod.bsp_commission_amount)} SAR</div>
                      <div className="text-[11px] text-emerald-600 mt-1">خصم عمولة قياسي 5% - 8%</div>
                    </CardContent>
                  </Card>

                  <Card className="border-sky-200 bg-sky-50/40">
                    <CardContent className="p-4">
                      <div className="text-xs text-sky-700">صافي المستحق سداده (IATA Net Remittance):</div>
                      <div className="text-xl font-black font-mono text-sky-900 mt-1">{fmt(currentPeriod.bsp_net_payable)} SAR</div>
                      <div className="text-[11px] text-sky-600 mt-1">واجب السداد بنهاية الدورة</div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white flex flex-col justify-center p-4">
                    {currentPeriod.reconciliation_status !== "settled" ? (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10"
                        onClick={() => settlePeriodMutation.mutate(currentPeriod.id)}
                        disabled={settlePeriodMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 ml-1.5" />
                        اعتماد وتسوية الفترة في الحسابات 🏛️
                      </Button>
                    ) : (
                      <div className="text-center text-emerald-700 font-bold text-sm flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-5 h-5" />
                        تمت التسوية وإنشاء القيد المحاسبي
                      </div>
                    )}
                  </Card>
                </div>

                {/* Tickets Reconciliation Matrix Table */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold">جدول تدقيق ومطابقة تذاكر BSP مع حجوزات النظام</CardTitle>
                      <CardDescription>مقارنة أسعار وفروقات كل تذكرة إلكترونية صادرة</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100/80 text-slate-700 border-b">
                          <tr>
                            <th className="p-3">رقم التذكرة</th>
                            <th className="p-3">الناقل</th>
                            <th className="p-3">رقم PNR</th>
                            <th className="p-3">اسم الراكب</th>
                            <th className="p-3">سعر BSP</th>
                            <th className="p-3">الضريبة</th>
                            <th className="p-3">العمولة</th>
                            <th className="p-3">صافي BSP</th>
                            <th className="p-3">صافي الوكالة</th>
                            <th className="p-3">الفارق (Variance)</th>
                            <th className="p-3">حالة المطابقة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tickets.map((t: any) => (
                            <tr key={t.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-slate-900">{t.ticket_number}</td>
                              <td className="p-3 font-mono font-bold text-sky-700">{t.airline_code}</td>
                              <td className="p-3 font-mono text-indigo-600">{t.pnr}</td>
                              <td className="p-3 font-mono">{t.passenger_name}</td>
                              <td className="p-3 font-mono">{fmt(t.bsp_fare)}</td>
                              <td className="p-3 font-mono">{fmt(t.bsp_tax)}</td>
                              <td className="p-3 font-mono text-emerald-600">{fmt(t.bsp_commission)}</td>
                              <td className="p-3 font-mono font-bold text-slate-900">{fmt(t.bsp_net)}</td>
                              <td className="p-3 font-mono text-slate-700">{fmt(t.agency_net)}</td>
                              <td className={`p-3 font-mono font-bold ${Math.abs(t.variance) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                {fmt(t.variance)} SAR
                              </td>
                              <td className="p-3">
                                <Badge
                                  className={
                                    t.status === "matched"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : t.status === "fare_variance"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {t.status === "matched" ? "مطابق تماماً ✅" : t.status === "fare_variance" ? "فارق تسعير ⚠️" : "غير مسجل بالوكالة ❌"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ADM & ACM DISPUTE MANAGEMENT */}
          <TabsContent value="memos" className="pt-4 space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">سجل مذكرات تسوية خطوط الطيران (ADM / ACM Memos)</CardTitle>
                  <CardDescription>متابعة الغرامات المفروضة وتقديم الاعتراضات القانونية عبر BSPLink خلال المهلة النظامية</CardDescription>
                </div>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs" onClick={() => setIsNewMemoOpen(true)}>
                  <Plus className="w-4 h-4 ml-1.5" />
                  تسجيل مذكرة ADM/ACM جديدة
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-100/80 text-slate-700 border-b">
                      <tr>
                        <th className="p-3">النوع</th>
                        <th className="p-3">رقم المذكرة</th>
                        <th className="p-3">خط الطيران</th>
                        <th className="p-3">رقم التذكرة والـ PNR</th>
                        <th className="p-3">المبلغ</th>
                        <th className="p-3">سبب المذكرة</th>
                        <th className="p-3">مهلة الاعتراض</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {memos?.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <Badge className={m.memo_type === "ADM" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                              {m.memo_type} ({m.memo_type === "ADM" ? "غرامة" : "إضافة"})
                            </Badge>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">{m.memo_number}</td>
                          <td className="p-3 font-semibold">{m.airline_name} ({m.airline_code})</td>
                          <td className="p-3 font-mono text-slate-600">{m.ticket_number || m.pnr || "—"}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{fmt(m.amount)} SAR</td>
                          <td className="p-3 max-w-xs text-slate-600 truncate">{m.reason_description}</td>
                          <td className="p-3 font-mono text-amber-700 font-bold">{m.dispute_deadline || "—"}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                m.status === "settled"
                                  ? "bg-slate-100 text-slate-700"
                                  : m.status === "under_dispute"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {m.status === "settled" ? "تمت التسوية" : m.status === "under_dispute" ? "قيد الاعتراض BSPLink" : "مستلمة جديدة"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            {m.status !== "settled" && (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => {
                                    setActiveMemo(m);
                                    setIsDisputeOpen(true);
                                  }}
                                >
                                  اعتراض BSPLink ⚖️
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG: IMPORT HOT FILE */}
        <Dialog open={isImportHotOpen} onOpenChange={setIsImportHotOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">استيراد ومعالجة ملف IATA HOT / RET</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                الصق محتوى ملف شريط التسليم اليدوي (Hand-Off Tape) أو اتركه فارغاً لتحميل عينة الفوترة ومطابقتها آلياً مع حجوزات النظام:
              </p>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                placeholder="065-2415896321,SV,1200,180,60,ALOTAIBI/ABDULLAH..."
                value={hotFileContent}
                onChange={(e) => setHotFileContent(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportHotOpen(false)}>إلغاء</Button>
              <Button
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
                onClick={() => importHotMutation.mutate({ period_id: activePeriodId, raw_file_content: hotFileContent })}
                disabled={importHotMutation.isPending}
              >
                {importHotMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-1.5" /> : <Upload className="w-4 h-4 ml-1.5" />}
                بدء التدقيق والمطابقة الآن
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: RECORD NEW ADM/ACM */}
        <Dialog open={isNewMemoOpen} onOpenChange={setIsNewMemoOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">تسجيل مذكرة تسوية ADM / ACM</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">نوع المذكرة:</label>
                  <select
                    className="w-full h-9 border rounded px-2"
                    value={memoForm.memo_type}
                    onChange={(e) => setMemoForm({ ...memoForm, memo_type: e.target.value })}
                  >
                    <option value="ADM">ADM (غرامة / مطالبة مدينة)</option>
                    <option value="ACM">ACM (إضافة عمولة / مذكرة دائنة)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم المذكرة:</label>
                  <Input value={memoForm.memo_number} onChange={(e) => setMemoForm({ ...memoForm, memo_number: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">كود خط الطيران:</label>
                  <Input value={memoForm.airline_code} onChange={(e) => setMemoForm({ ...memoForm, airline_code: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">اسم خط الطيران:</label>
                  <Input value={memoForm.airline_name} onChange={(e) => setMemoForm({ ...memoForm, airline_name: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">رقم التذكرة المعنية:</label>
                  <Input value={memoForm.ticket_number} onChange={(e) => setMemoForm({ ...memoForm, ticket_number: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">المبلغ (SAR):</label>
                  <Input type="number" value={memoForm.amount} onChange={(e) => setMemoForm({ ...memoForm, amount: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">سبب المذكرة والتفاصيل:</label>
                <Textarea rows={2} value={memoForm.reason_description} onChange={(e) => setMemoForm({ ...memoForm, reason_description: e.target.value })} />
              </div>

              <div>
                <label className="font-semibold block mb-1">آخر موعد لتقديم الاعتراض (Dispute Deadline):</label>
                <Input type="date" value={memoForm.dispute_deadline} onChange={(e) => setMemoForm({ ...memoForm, dispute_deadline: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewMemoOpen(false)}>إلغاء</Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => createMemoMutation.mutate(memoForm)}>
                حفظ المذكرة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: DISPUTE BSPLINK */}
        <Dialog open={isDisputeOpen} onOpenChange={setIsDisputeOpen}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">تقديم اعتراض رسمي عبر BSPLink للمذكرة {activeMemo?.memo_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                أدخل المبررات الفنية والوثائق المؤيدة للاعتراض على غرامة خط الطيران ({activeMemo?.airline_name}):
              </p>
              <Textarea
                rows={4}
                value={disputeNotes}
                onChange={(e) => setDisputeNotes(e.target.value)}
                placeholder="تم تطبيق قواعد التعرفة الصحيحة حسب شروط نظام الحجز Amadeus GDS TST..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDisputeOpen(false)}>إلغاء</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={() => disputeMemoMutation.mutate({ id: activeMemo?.id, notes: disputeNotes })}
              >
                إرسال الاعتراض لـ BSPLink ⚖️
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
