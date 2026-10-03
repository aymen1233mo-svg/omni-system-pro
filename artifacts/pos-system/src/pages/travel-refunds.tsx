import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  RotateCcw, Plus, Search, Receipt, Ticket, UserCheck, DollarSign,
  AlertCircle, FileText, Calendar, Wallet, CheckCircle2, Globe,
  Bus, Plane, Building2, Printer, ArrowDownLeft, ArrowUpRight,
  TrendingDown, TrendingUp, Layers, Check, X, ShieldAlert,
  ArrowRightLeft, FileSpreadsheet, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {})
    }
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ أثناء العملية");
    }
    if (res.status === 204) return {} as T;
    return res.json();
  });
}

const SERVICE_TYPE_MAP: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  bus_ticket: { label: "تذكرة نقل بري وباص", icon: Bus, color: "text-amber-600", badge: "bg-amber-100 text-amber-900 border-amber-300" },
  flight: { label: "تذكرة طيران", icon: Plane, color: "text-blue-600", badge: "bg-blue-100 text-blue-900 border-blue-300" },
  visa: { label: "معاملة تأشيرة", icon: Globe, color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  hotel: { label: "حجز فندقي", icon: Building2, color: "text-purple-600", badge: "bg-purple-100 text-purple-900 border-purple-300" },
  general_service: { label: "خدمة عامة / فاتورة مبيعات", icon: Receipt, color: "text-slate-600", badge: "bg-slate-100 text-slate-800 border-slate-300" }
};

export default function TravelRefundsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"returns" | "statement">("returns");

  // Data states
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [servicesLookup, setServicesLookup] = useState<any[]>([]);
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Filters state for returns
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Filters state for statement report
  const [statementFilters, setStatementFilters] = useState({
    account_id: "",
    from_date: "",
    to_date: "",
    service_type: "all"
  });

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<any | null>(null);
  const [selectedService, setSelectedService] = useState<any | null>(null);

  // Form for new return
  const [form, setForm] = useState({
    service_type: "bus_ticket",
    service_item_id: "",
    service_reference_no: "",
    return_voucher_no: "",
    customer_id: "",
    customer_name: "",
    supplier_id: "",
    supplier_name: "",
    statement: "مردود/خدمة تذاكر سفر",
    currency: "SAR",
    original_amount: "0",
    penalty_amount: "0",
    office_fee: "0",
    refunded_commission: "0",
    return_reason: "طلب العميل / كنسلة الخدمة",
    payment_method: "cash",
    return_date: new Date().toISOString().slice(0, 10)
  });

  // Fetch Returns & Services Lookup
  const fetchData = async () => {
    setLoading(true);
    try {
      const [retData, lookupData] = await Promise.all([
        fetchWithAuth<any[]>("/api/travel/service-returns").catch(() => []),
        fetchWithAuth<any[]>("/api/travel/services-lookup").catch(() => [])
      ]);
      setReturnsList(retData || []);
      setServicesLookup(lookupData || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "تنبيه", description: "فشل تحميل بعض السجلات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Account Statement
  const fetchStatement = async () => {
    setLoadingStatement(true);
    try {
      const q = new URLSearchParams();
      if (statementFilters.account_id) q.set("account_id", statementFilters.account_id);
      if (statementFilters.from_date) q.set("from_date", statementFilters.from_date);
      if (statementFilters.to_date) q.set("to_date", statementFilters.to_date);
      if (statementFilters.service_type && statementFilters.service_type !== "all") q.set("service_type", statementFilters.service_type);

      const res = await fetchWithAuth<any>(`/api/travel/statement-report?${q.toString()}`);
      setStatementData(res);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل تحميل كشف الحساب", variant: "destructive" });
    } finally {
      setLoadingStatement(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "statement") {
      fetchStatement();
    }
  }, [activeTab, statementFilters]);

  // Handle service select in modal
  const handleSelectService = (srvKey: string) => {
    if (!srvKey) {
      setSelectedService(null);
      return;
    }
    const [stype, sid] = srvKey.split(":");
    const srv = servicesLookup.find(s => s.service_type === stype && String(s.service_item_id) === sid);
    if (srv) {
      setSelectedService(srv);
      const origAmt = Number(srv.amount || 0);
      const defaultStmt = srv.service_type === 'bus_ticket'
        ? `مردود/خدمة تذاكر سفر نقل بري رقم (${srv.service_reference_no})`
        : srv.service_type === 'visa'
        ? `مردود/معاملة تأشيرة رقم (${srv.service_reference_no})`
        : srv.service_type === 'flight'
        ? `مردود/تذكرة طيران رقم (${srv.service_reference_no})`
        : `مردود/خدمة رقم (${srv.service_reference_no})`;

      setForm(f => ({
        ...f,
        service_type: srv.service_type,
        service_item_id: String(srv.service_item_id),
        service_reference_no: srv.service_reference_no,
        return_voucher_no: srv.suggested_return_no || "",
        customer_id: srv.customer_id ? String(srv.customer_id) : "",
        customer_name: srv.customer_name || "",
        supplier_id: srv.supplier_id ? String(srv.supplier_id) : "",
        supplier_name: srv.supplier_name || "",
        statement: defaultStmt,
        currency: srv.currency || "SAR",
        original_amount: String(origAmt),
        penalty_amount: "0",
        office_fee: "0",
        refunded_commission: "0"
      }));
    }
  };

  // Calculations
  const origAmount = Number(form.original_amount || 0);
  const penaltyAmount = Number(form.penalty_amount || 0);
  const officeFee = Number(form.office_fee || 0);
  const netRefundToCustomer = Math.max(0, origAmount - penaltyAmount - officeFee);

  // Submit New Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.service_reference_no) {
      toast({ title: "خطأ", description: "يرجى تحديد الخدمة الأصلية أو إدخال رقم المرجع", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        ...form,
        service_item_id: form.service_item_id ? Number(form.service_item_id) : null,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        original_amount: origAmount,
        penalty_amount: penaltyAmount,
        office_fee: officeFee,
        refunded_commission: Number(form.refunded_commission || 0)
      };

      const result = await fetchWithAuth<any>("/api/travel/service-returns", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      toast({
        title: "تم إصدار فاتورة المردود بنجاح ✅",
        description: `تم توليد فاتورة المردود رقم ${result.return_voucher_no} وتسجيل القيد المحاسبي الآلي #${result.journal_entry_id}`
      });

      setCreateModalOpen(false);
      fetchData();
      if (result) {
        setPrintVoucher(result);
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  // Filtered Returns
  const filteredReturns = useMemo(() => {
    return returnsList.filter(r => {
      const matchesSearch =
        !search ||
        (r.return_voucher_no || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.service_reference_no || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.statement || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.supplier_name || "").toLowerCase().includes(search.toLowerCase());

      const matchesType = typeFilter === "all" || r.service_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [returnsList, search, typeFilter]);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  نظام فواتير مردود الخدمات واسترجاع المعاملات والتذاكر
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  معالجة كنسلة واسترجاع تذاكر النقل البري والطيران والتأشيرات والفنادق مع توليد القيود المحاسبية والتأثير المالي الفوري
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => {
                setSelectedService(null);
                setForm({
                  service_type: "bus_ticket",
                  service_item_id: "",
                  service_reference_no: "",
                  return_voucher_no: "",
                  customer_id: "",
                  customer_name: "",
                  supplier_id: "",
                  supplier_name: "",
                  statement: "مردود/خدمة تذاكر سفر",
                  currency: "SAR",
                  original_amount: "0",
                  penalty_amount: "0",
                  office_fee: "0",
                  refunded_commission: "0",
                  return_reason: "طلب العميل / كنسلة الخدمة",
                  payment_method: "cash",
                  return_date: new Date().toISOString().slice(0, 10)
                });
                setCreateModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" /> إضافة فاتورة مردود خدمة ➕
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("returns")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "returns"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>سجل فواتير مردود الخدمات ({returnsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("statement")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "statement"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>كشف حساب الخدمات والمردودات المالي (مدين / دائن / رصيد)</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: RETURNS REGISTER (سجل فواتير المردود) */}
        {/* ========================================================================= */}
        {activeTab === "returns" && (
          <div className="space-y-4">
            {/* Filter Card */}
            <Card className="border shadow-sm p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم المردود، رقم الخدمة المرجعي، اسم العميل، البيان، المورد..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-9 text-xs h-10"
                  />
                </div>

                <div>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold"
                  >
                    <option value="all">جميع أنواع الخدمات المردودة</option>
                    <option value="bus_ticket">🚌 تذاكر نقل بري وباصات</option>
                    <option value="flight">✈️ تذاكر طيران</option>
                    <option value="visa">🌐 معاملات تأشيرات</option>
                    <option value="hotel">🏨 حجوزات فنادق</option>
                    <option value="general_service">🧾 فواتير مبيعات عامة</option>
                  </select>
                </div>
              </div>

              {/* Service Type Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t">
                <span className="text-[11px] font-bold text-slate-700 ml-1">نوع الخدمة:</span>
                {[
                  { key: "all", label: "الكل", count: returnsList.length },
                  { key: "bus_ticket", label: "🚌 تذاكر نقل بري", count: returnsList.filter(r => r.service_type === "bus_ticket").length },
                  { key: "flight", label: "✈️ تذاكر طيران", count: returnsList.filter(r => r.service_type === "flight").length },
                  { key: "visa", label: "🌐 معاملات تأشيرات", count: returnsList.filter(r => r.service_type === "visa").length },
                  { key: "hotel", label: "🏨 فنادق", count: returnsList.filter(r => r.service_type === "hotel").length }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTypeFilter(tab.key)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold border transition-all flex items-center gap-1.5 ${
                      typeFilter === tab.key
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 bg-white/20 rounded-full font-mono">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Returns Data Table */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    سجل فواتير مردود الخدمات المعتمدة ({filteredReturns.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    جميع عمليات الإلغاء والاسترجاع مع التوجيه المحاسبي والقيد الآلي
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground text-xs">جاري تحميل سجلات المردود...</div>
                ) : filteredReturns.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-3">
                    <RotateCcw className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-semibold">لا توجد فواتير مردود خدمات مسجلة</p>
                    <Button
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> إنشاء أول فاتورة مردود
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b text-slate-700 font-bold text-[11px]">
                          <th className="p-3">رقم المردود / التاريخ</th>
                          <th className="p-3">رقم الخدمة الأصلية</th>
                          <th className="p-3">نوع الخدمة</th>
                          <th className="p-3">العميل والبيان المحاسبي</th>
                          <th className="p-3">المورد / الناقل</th>
                          <th className="p-3 text-left">المبلغ الأصلي</th>
                          <th className="p-3 text-left">الغرامة والرسوم</th>
                          <th className="p-3 text-left">الصافي المسترد للعميل</th>
                          <th className="p-3 text-center">القيد المحاسبي</th>
                          <th className="p-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredReturns.map(r => {
                          const srvInfo = SERVICE_TYPE_MAP[r.service_type] || SERVICE_TYPE_MAP.general_service;
                          const SrvIcon = srvInfo.icon;
                          const curr = r.currency || "SAR";

                          return (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Col 1: Return Voucher No & Date */}
                              <td className="p-3">
                                <div className="font-mono font-bold text-rose-700 text-xs">
                                  {r.return_voucher_no}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" /> {r.return_date || r.created_at?.slice(0, 10) || "-"}
                                </div>
                              </td>

                              {/* Col 2: Original Reference */}
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border">
                                  {r.service_reference_no || "-"}
                                </span>
                              </td>

                              {/* Col 3: Service Type */}
                              <td className="p-3">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border inline-flex items-center gap-1 ${srvInfo.badge}`}>
                                  <SrvIcon className="w-3 h-3" />
                                  <span>{srvInfo.label}</span>
                                </span>
                              </td>

                              {/* Col 4: Customer & Statement */}
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{r.customer_name || "عميل عام"}</div>
                                <div className="text-[10px] text-slate-600 bg-slate-50 p-1 rounded mt-0.5 border line-clamp-2">
                                  📝 {r.statement || "مردود خدمة"}
                                </div>
                              </td>

                              {/* Col 5: Supplier */}
                              <td className="p-3">
                                <div className="font-medium text-slate-800">{r.supplier_name || "-"}</div>
                              </td>

                              {/* Col 6: Original Amount */}
                              <td className="p-3 text-left font-mono text-slate-700">
                                {Number(r.original_amount || 0).toLocaleString()} {curr}
                              </td>

                              {/* Col 7: Penalties & Fees */}
                              <td className="p-3 text-left font-mono text-rose-600 font-semibold">
                                -{(Number(r.penalty_amount || 0) + Number(r.office_fee || 0)).toLocaleString()} {curr}
                              </td>

                              {/* Col 8: Net Refund to Customer */}
                              <td className="p-3 text-left font-mono font-bold text-emerald-800 bg-emerald-50/50">
                                {Number(r.net_refund_to_customer || 0).toLocaleString()} {curr}
                              </td>

                              {/* Col 9: Journal Entry */}
                              <td className="p-3 text-center">
                                {r.journal_entry_id ? (
                                  <span className="font-mono text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-bold">
                                    قيد #{r.journal_entry_id}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">-</span>
                                )}
                              </td>

                              {/* Col 10: Actions */}
                              <td className="p-3 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] font-bold border-slate-300 hover:bg-slate-100"
                                  onClick={() => setPrintVoucher(r)}
                                  title="طباعة سند مردود خدمة معتمد"
                                >
                                  <Printer className="w-3.5 h-3.5 ml-1" /> طباعة
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STATEMENT REPORT (كشف حساب الخدمات والمردودات المالي - مدين/دائن/رصيد) */}
        {/* ========================================================================= */}
        {activeTab === "statement" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <Card className="border shadow-sm p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نوع الخدمة:</label>
                  <select
                    value={statementFilters.service_type}
                    onChange={e => setStatementFilters(f => ({ ...f, service_type: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  >
                    <option value="all">جميع الخدمات والمردودات</option>
                    <option value="bus_ticket">🚌 تذاكر نقل بري</option>
                    <option value="flight">✈️ تذاكر طيران</option>
                    <option value="visa">🌐 معاملات تأشيرات</option>
                    <option value="hotel">🏨 فنادق</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">من تاريخ:</label>
                  <Input
                    type="date"
                    value={statementFilters.from_date}
                    onChange={e => setStatementFilters(f => ({ ...f, from_date: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">إلى تاريخ:</label>
                  <Input
                    type="date"
                    value={statementFilters.to_date}
                    onChange={e => setStatementFilters(f => ({ ...f, to_date: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={fetchStatement}
                    className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> تحديث الكشف
                  </Button>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            {statementData?.summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border bg-emerald-50/60 border-emerald-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-800 font-bold">إجمالي المبيعات والخدمات (مدين +)</p>
                      <p className="text-xl font-bold font-mono text-emerald-950 mt-1">
                        {Number(statementData.summary.total_debit || 0).toLocaleString()} {statementData.summary.currency}
                      </p>
                    </div>
                    <ArrowUpRight className="w-8 h-8 text-emerald-600 opacity-60" />
                  </div>
                </Card>

                <Card className="border bg-rose-50/60 border-rose-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-rose-800 font-bold">إجمالي المردودات والاسترجاع (دائن -)</p>
                      <p className="text-xl font-bold font-mono text-rose-950 mt-1">
                        {Number(statementData.summary.total_credit || 0).toLocaleString()} {statementData.summary.currency}
                      </p>
                    </div>
                    <ArrowDownLeft className="w-8 h-8 text-rose-600 opacity-60" />
                  </div>
                </Card>

                <Card className="border bg-blue-50/60 border-blue-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-800 font-bold">صافي الرصيد المستحق (Balance)</p>
                      <p className="text-xl font-bold font-mono text-blue-950 mt-1">
                        {Number(statementData.summary.closing_balance || 0).toLocaleString()} {statementData.summary.currency}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-600 opacity-60" />
                  </div>
                </Card>
              </div>
            )}

            {/* Statement Table (مطابق لكشف الحساب المحاسبي المطلوب بالصورة) */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    كشف الحساب المحاسبي للخدمات والمردودات (Statement of Accounts)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    عرض الحركات المتسلسلة (مدين: مبيعات، دائن: مردودات) مع الرصيد التراكمي
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs gap-1 font-bold border-slate-300"
                >
                  <Printer className="w-3.5 h-3.5" /> طباعة كشف الحساب
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                {loadingStatement ? (
                  <div className="p-12 text-center text-muted-foreground text-xs">جاري تجهيز كشف الحساب...</div>
                ) : !statementData?.transactions || statementData.transactions.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-xs">لا توجد حركات مسجلة للفترة المحددة</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b text-slate-800 font-bold text-[11px]">
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">رقم السند / المرجع</th>
                          <th className="p-3">نوع العملية</th>
                          <th className="p-3">البيان المحاسبي الكامل</th>
                          <th className="p-3 text-left">مدين (بيع خدمة)</th>
                          <th className="p-3 text-left">دائن (مردود خدمة)</th>
                          <th className="p-3 text-left">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {statementData.transactions.map((tx: any, idx: number) => {
                          const isReturn = tx.type === "service_return";
                          return (
                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isReturn ? "bg-rose-50/20" : ""}`}>
                              <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                {tx.date}
                              </td>

                              <td className="p-3 font-mono font-bold text-slate-900">
                                {tx.reference_no}
                              </td>

                              <td className="p-3">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border inline-flex items-center gap-1 ${
                                  isReturn
                                    ? "bg-rose-100 text-rose-900 border-rose-300"
                                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                                }`}>
                                  {isReturn ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                  <span>{tx.type_label}</span>
                                </span>
                              </td>

                              <td className="p-3 text-slate-800 font-medium">
                                {tx.statement}
                              </td>

                              <td className="p-3 text-left font-mono font-bold text-emerald-700">
                                {tx.debit > 0 ? Number(tx.debit).toLocaleString() : "-"}
                              </td>

                              <td className="p-3 text-left font-mono font-bold text-rose-700">
                                {tx.credit > 0 ? Number(tx.credit).toLocaleString() : "-"}
                              </td>

                              <td className="p-3 text-left font-mono font-extrabold text-slate-900 bg-slate-50/80">
                                {Number(tx.running_balance).toLocaleString()} {statementData.summary?.currency || "SAR"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CREATE SERVICE RETURN INVOICE MODAL (نموذج إنشاء فاتورة مردود خدمة) */}
        {/* ========================================================================= */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <span>إصدار فاتورة مردود خدمة واسترجاع مالي (Service Return Voucher)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                يرجى اختيار الخدمة الأصلية لتعبئة البيانات آلياً، واحتساب غرامات الإلغاء ورسوم الاسترجاع والتأثير المحاسبي
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitReturn} className="space-y-4 py-2 text-xs">
              {/* Step 1: Select Original Service */}
              <div className="p-3.5 rounded-lg border bg-slate-50 space-y-2">
                <label className="font-bold text-slate-800 block">
                  1. اختيار الخدمة الأصلية المطلوب كنسلتها أو استرجاعها:
                </label>
                <select
                  value={selectedService ? `${selectedService.service_type}:${selectedService.service_item_id}` : ""}
                  onChange={e => handleSelectService(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-white px-3 text-xs font-semibold"
                >
                  <option value="">-- اختر من قائمة الخدمات المسجلة مسبقاً --</option>
                  {servicesLookup.map((s, idx) => (
                    <option key={`${s.service_type}:${s.service_item_id}:${idx}`} value={`${s.service_type}:${s.service_item_id}`}>
                      [{SERVICE_TYPE_MAP[s.service_type]?.label || s.service_type}] مرجع: {s.service_reference_no} | {s.customer_name} | {Number(s.amount).toLocaleString()} {s.currency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Reference Numbers and Types */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-800 block mb-1">نوع الخدمة المردودة *</label>
                  <select
                    value={form.service_type}
                    onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 font-semibold"
                  >
                    <option value="bus_ticket">🚌 تذكرة نقل بري وباص</option>
                    <option value="flight">✈️ تذكرة طيران</option>
                    <option value="visa">🌐 معاملة تأشيرة</option>
                    <option value="hotel">🏨 حجز فندقي</option>
                    <option value="general_service">🧾 خدمة عامة</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-800 block mb-1">رقم الخدمة المرجعي الأصلي *</label>
                  <Input
                    required
                    placeholder="مثال: 02026/1921-1"
                    value={form.service_reference_no}
                    onChange={e => setForm(f => ({ ...f, service_reference_no: e.target.value }))}
                    className="font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 block mb-1">رقم فاتورة المردود (توليد تسلسلي)</label>
                  <Input
                    placeholder="مثال: 02026/1941-1"
                    value={form.return_voucher_no}
                    onChange={e => setForm(f => ({ ...f, return_voucher_no: e.target.value }))}
                    className="font-mono text-rose-700 font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 block mb-1">تاريخ المردود</label>
                  <Input
                    type="date"
                    value={form.return_date}
                    onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Step 3: Parties & Statement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-800 block mb-1">اسم العميل *</label>
                  <Input
                    required
                    placeholder="اسم العميل المستفيد"
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 block mb-1">المورد / شركة النقل / المكتب</label>
                  <Input
                    placeholder="مثال: شركة الرويشان للنقل / طيران أديل"
                    value={form.supplier_name}
                    onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-800 block mb-1">البيان المحاسبي للمردود *</label>
                  <Input
                    required
                    placeholder="مثال: مردود/خدمة تذاكر سفر رقم 02026/1921-1 للمسافر..."
                    value={form.statement}
                    onChange={e => setForm(f => ({ ...f, statement: e.target.value }))}
                  />
                </div>
              </div>

              {/* Step 4: Financial Breakdown */}
              <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950">احتساب مبالغ المردود والغرامات والعمولة:</span>
                  <span className="font-mono font-bold text-slate-700">العملة: {form.currency}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-800 block mb-1">المبلغ الأصلي للخدمة *</label>
                    <Input
                      type="number"
                      step="any"
                      required
                      value={form.original_amount}
                      onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))}
                      className="font-mono font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-800 block mb-1">غرامة الإلغاء / الناقل (-)</label>
                    <Input
                      type="number"
                      step="any"
                      value={form.penalty_amount}
                      onChange={e => setForm(f => ({ ...f, penalty_amount: e.target.value }))}
                      className="font-mono font-bold text-rose-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-800 block mb-1">رسوم استرجاع المكتب (-)</label>
                    <Input
                      type="number"
                      step="any"
                      value={form.office_fee}
                      onChange={e => setForm(f => ({ ...f, office_fee: e.target.value }))}
                      className="font-mono font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Net Refund Display Banner */}
                <div className="bg-white border border-emerald-300 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-800 font-bold block">صافي المبلغ المسترد للعميل:</span>
                    <span className="text-xl font-mono font-black text-emerald-950">
                      {netRefundToCustomer.toLocaleString()} {form.currency}
                    </span>
                  </div>
                  <div className="text-left text-[11px] text-slate-600">
                    <div>إجمالي المبلغ: {origAmount.toLocaleString()} {form.currency}</div>
                    <div className="text-rose-700">الخصم والغرامات: -{(penaltyAmount + officeFee).toLocaleString()} {form.currency}</div>
                  </div>
                </div>
              </div>

              {/* Step 5: Refund Reason & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-800 block mb-1">سبب الاسترجاع / الإلغاء</label>
                  <Input
                    value={form.return_reason}
                    onChange={e => setForm(f => ({ ...f, return_reason: e.target.value }))}
                    placeholder="مثال: إلغاء الرحلة، تغيير الموعد..."
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-800 block mb-1">طريقة سداد المردود للعميل</label>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-2 font-semibold"
                  >
                    <option value="cash">نقداً من الصندوق (Cash)</option>
                    <option value="bank_transfer">تحويل بنكي (Bank Transfer)</option>
                    <option value="credit_on_account">قيد دائن على حساب العميل (On Account)</option>
                  </select>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5 shadow">
                  <RotateCcw className="w-4 h-4" /> تأكيد وإصدار فاتورة المردود والقيد
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* PRINTABLE RETURN VOUCHER DIALOG (سند فاتورة مردود خدمة معتمد) */}
        {/* ========================================================================= */}
        <Dialog open={Boolean(printVoucher)} onOpenChange={open => !open && setPrintVoucher(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Printer className="w-4 h-4 text-primary" />
                سند فاتورة مردود خدمة رسمي ومعتمد
              </DialogTitle>
            </DialogHeader>

            {printVoucher && (
              <div className="p-4 border rounded-lg bg-white space-y-4 text-xs">
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">وكالة السفر والسياحة وخدمات النقل والتأشيرات</h3>
                    <p className="text-muted-foreground text-[10px]">قسم الإلغاء والمردودات والتسويات المالية</p>
                  </div>
                  <div className="text-left font-mono">
                    <p className="font-bold text-rose-700 text-sm">{printVoucher.return_voucher_no}</p>
                    <p className="text-[10px] text-muted-foreground">{printVoucher.return_date || printVoucher.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)}</p>
                  </div>
                </div>

                {/* Return Details */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">رقم الخدمة المرجعي الأصلي:</span>
                    <span className="font-bold font-mono text-slate-900">{printVoucher.service_reference_no}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">نوع الخدمة:</span>
                    <span className="font-bold text-primary">{SERVICE_TYPE_MAP[printVoucher.service_type]?.label || printVoucher.service_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">العميل المستفيد:</span>
                    <span className="font-bold text-slate-900">{printVoucher.customer_name || "عميل عام"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">المورد / الناقل:</span>
                    <span className="font-bold text-slate-900">{printVoucher.supplier_name || "-"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[10px]">البيان المحاسبي:</span>
                    <span className="font-medium text-slate-900">{printVoucher.statement}</span>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="border p-3 rounded space-y-1.5 bg-slate-50/50">
                  <div className="flex justify-between">
                    <span>المبلغ الأصلي للخدمة:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {Number(printVoucher.original_amount || 0).toLocaleString()} {printVoucher.currency || "SAR"}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>غرامة الإلغاء / رسوم الناقل:</span>
                    <span className="font-bold font-mono">
                      -{Number(printVoucher.penalty_amount || 0).toLocaleString()} {printVoucher.currency || "SAR"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>رسوم استرجاع المكتب:</span>
                    <span className="font-bold font-mono">
                      -{Number(printVoucher.office_fee || 0).toLocaleString()} {printVoucher.currency || "SAR"}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold border-t pt-1.5 text-sm">
                    <span>صافي المبلغ المسترد للعميل:</span>
                    <span className="font-mono">
                      {Number(printVoucher.net_refund_to_customer || 0).toLocaleString()} {printVoucher.currency || "SAR"}
                    </span>
                  </div>
                </div>

                {printVoucher.journal_entry_id && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-950 font-mono text-[11px]">
                    <span>تم الترحيل للقيد المحاسبي المزدوج رقم: </span>
                    <span className="font-bold">#{printVoucher.journal_entry_id}</span>
                  </div>
                )}

                <div className="flex justify-between pt-6 border-t text-[11px] text-muted-foreground">
                  <div>توقيع واستلام العميل: ___________________</div>
                  <div>ختم وتوقيع المحاسب: ___________________</div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setPrintVoucher(null)}>إغلاق</Button>
              <Button onClick={() => window.print()} className="bg-slate-900 gap-1 font-bold">
                <Printer className="w-4 h-4" /> طباعة السند
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
