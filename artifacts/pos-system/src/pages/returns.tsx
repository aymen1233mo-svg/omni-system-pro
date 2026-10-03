import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppLogo } from "@/components/AppLogo";
import { 
  Plus, Trash2, Eye, Search, RotateCcw, DollarSign, Package, Calendar, 
  AlertTriangle, Users, Printer, CheckCircle2, FileText, Save, Edit3, X, 
  RefreshCw, Paperclip, Lock, ArrowRight, Filter, Building2, Store, 
  CreditCard, Wallet, UserCheck, Tag, FileSpreadsheet, Check, Send, 
  ChevronRight, ShieldCheck, Clock, User
} from "lucide-react";

import { printA4Html, generateSalesReturnVoucherA4Html } from "@/lib/printUtils";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { 
    ...opts, 
    headers: { 
      "Content-Type": "application/json", 
      Authorization: `Bearer ${token}`, 
      ...(opts.headers ?? {}) 
    } 
  });
}

async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) {
    let errText = "حدث خطأ أثناء الاتصال بالخادم";
    try {
      const json = await r.json();
      if (json.error) errText = json.error;
    } catch {
      errText = await r.text();
    }
    throw new Error(errText);
  }
  return r.json();
}

async function apiPost(url: string, body: any) { 
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); 
  if (!r.ok) {
    let errText = "حدث خطأ أثناء الحفظ";
    try {
      const json = await r.json();
      if (json.error) errText = json.error;
    } catch {
      errText = await r.text();
    }
    throw new Error(errText);
  }
  return r.json(); 
}

async function apiDel(url: string) { 
  const r = await fetchAuth(url, { method: "DELETE" }); 
  if (!r.ok && r.status !== 204) throw new Error(await r.text()); 
}

function fmt(n?: number) { 
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

/* ─────────────────────────────────────────────────────────────
   نافذة معاينة وطباعة سند المرتجع (مع القالب الرسمي للفاتورة الضريبية)
───────────────────────────────────────────────────────────── */
function ViewReturnDialog({ ret, onClose, docPrintSettings }: { ret: any; onClose: () => void; docPrintSettings?: any }) {
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");

  if (!ret) return null;

  const htmlContent = generateSalesReturnVoucherA4Html(ret, docPrintSettings);

  const handlePreview = () => {
    setReportHtml(htmlContent);
    setReportViewerOpen(true);
  };

  const handlePrint = () => {
    printA4Html(htmlContent, `سند_مردود_مبيعات_${ret.return_number}`);
  };

  return (
    <Dialog open={!!ret} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-slate-900 text-white shrink-0 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-red-400" />
            سند مردود مبيعات رقم {ret.return_number}
          </DialogTitle>
          <div className="flex gap-2">
            <Button onClick={handlePreview} variant="outline" size="sm" className="gap-1.5 border-indigo-200 text-indigo-100 bg-indigo-950/50 hover:bg-indigo-900 font-bold">
              <Eye className="w-4 h-4 text-indigo-300" /> استعراض قبل الطباعة
            </Button>
            <Button onClick={handlePrint} size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold">
              <Printer className="w-4 h-4" /> طباعة السند الرسمية
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div 
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 font-sans text-xs"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        <DialogFooter className="border-t p-4 bg-white flex justify-between">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <div className="flex gap-2">
            <Button onClick={handlePreview} variant="outline" className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold">
              <Eye className="w-4 h-4 text-indigo-600" /> استعراض قبل الطباعة
            </Button>
            <Button onClick={handlePrint} className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold">
              <Printer className="w-4 h-4" /> طباعة السند
            </Button>
          </div>
        </DialogFooter>

        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={`معاينة استعراض سند مردود مبيعات - ${ret.return_number}`}
        />
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   شاشة إدارة المرتجعات المتقدمة المماثلة لنظام Omni System Pro ERP
───────────────────────────────────────────────────────────── */
export default function Returns() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // URL Parameters and Search State
  const [initialInv, setInitialInv] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  
  // Header Toolbar Controls State
  const [selectedBranch, setSelectedBranch] = useState("1");
  const [selectedWarehouse, setSelectedWarehouse] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [safeId, setSafeId] = useState("1");
  const [returnType, setReturnType] = useState("مردود مبيعات نقدي");
  const [currency, setCurrency] = useState("ريال");
  const [exchangeRate, setExchangeRate] = useState("1.00");
  const [costCenter, setCostCenter] = useState("101");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [delegateId, setDelegateId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [returnReason, setReturnReason] = useState("طلب الزبون / إرجاع صنف");
  const [notes, setNotes] = useState("");
  const [isSuspended, setIsSuspended] = useState(false);
  const [isPosted, setIsPosted] = useState(true);

  // Invoice Lookup & Items
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<Record<number, { selected: boolean; qty: number }>>({});

  // Active View Dialog & Historical Return Records
  const [viewRet, setViewRet] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  // Submitting state
  const [saving, setSaving] = useState(false);

  // Parse initial invoice from URL query parameter if navigated from Orders page (/returns?invoice=1001)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invoice = urlParams.get("invoice") || urlParams.get("invoiceNumber") || urlParams.get("q");
    const orderId = urlParams.get("orderId") || urlParams.get("id");
    
    if (orderId) {
      setInvoiceQuery(invoice || orderId);
      executeInvoiceLookup(orderId);
    } else if (invoice) {
      setInvoiceQuery(invoice);
      executeInvoiceLookup(invoice);
    }
  }, []);

  // Lookup Order / Invoice by number
  const executeInvoiceLookup = async (term: string) => {
    if (!term || !term.trim()) return;
    setSearchingInvoice(true);
    try {
      const q = encodeURIComponent(term.trim());
      const rawData = await apiGet(`/api/orders/lookup?q=${q}`);
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
      
      if (!data || (!data.id && !data.invoiceNumber)) {
        throw new Error(`لم يتم العثور على الفاتورة المطابقة لـ "${term}"`);
      }
      
      setFoundOrder(data);
      if (data.customerName) setCustomerName(data.customerName);
      if (data.customerId) setCustomerId(data.customerId);
      if (data.paymentMethod === "credit" || (data.note && data.note.includes("وجبة موظف"))) {
        setPaymentMethod("credit");
        setReturnType("مردود مبيعات آجل");
      } else if (data.paymentMethod === "card" || data.paymentMethod === "bank") {
        setPaymentMethod("card");
        setReturnType("مردود مبيعات شبكة/بنك");
      } else {
        setPaymentMethod("cash");
        setReturnType("مردود مبيعات نقدي");
      }
      
      // Auto-populate item selection with available unreturned quantities
      const itemsMap: Record<number, { selected: boolean; qty: number }> = {};
      (data.items ?? []).forEach((item: any, idx: number) => {
        const remaining = item.remainingQuantity ?? item.quantity;
        itemsMap[idx] = { selected: remaining > 0, qty: Math.max(1, remaining) };
      });
      setReturnItems(itemsMap);
      
      toast({ 
        title: "✅ تم العثور على الفاتورة", 
        description: `فاتورة رقم: ${data.invoiceNumber} — التاريخ: ${new Date(data.createdAt).toLocaleDateString("ar-SA")}` 
      });
    } catch (e: any) {
      setFoundOrder(null);
      toast({ 
        variant: "destructive", 
        title: "تنبيه: الفاتورة غير موجودة", 
        description: e.message || "تأكد من صحة رقم الفاتورة المحفوظ في النظام وحاول مرة أخرى." 
      });
    } finally {
      setSearchingInvoice(false);
    }
  };

  const handleToggleAll = (checked: boolean) => {
    if (!foundOrder?.items) return;
    const next: Record<number, { selected: boolean; qty: number }> = {};
    foundOrder.items.forEach((item: any, idx: number) => {
      const remaining = item.remainingQuantity ?? item.quantity;
      if (remaining > 0) {
        next[idx] = { selected: checked, qty: Math.max(1, remaining) };
      }
    });
    setReturnItems(next);
  };

  const handleItemToggle = (idx: number) => {
    setReturnItems(prev => ({
      ...prev,
      [idx]: { ...prev[idx], selected: !prev[idx]?.selected }
    }));
  };

  const handleItemQtyChange = (idx: number, qty: number) => {
    const item = foundOrder?.items?.[idx];
    const maxQty = item?.remainingQuantity ?? item?.quantity ?? 1;
    const validQty = Math.min(Math.max(1, qty), maxQty);
    setReturnItems(prev => ({
      ...prev,
      [idx]: { ...prev[idx], qty: validQty }
    }));
  };

  // Calculate totals
  const getSelectedItemsArray = () => {
    if (!foundOrder?.items) return [];
    return foundOrder.items
      .map((item: any, idx: number) => ({ item, state: returnItems[idx] }))
      .filter(({ state }: any) => state?.selected && state?.qty > 0);
  };

  const selectedList = getSelectedItemsArray();
  const subtotalRefund = selectedList.reduce((sum: number, { item, state }: any) => sum + (item.unitPrice * state.qty), 0);
  const taxRefund = Math.round(subtotalRefund * 0.15);
  const totalRefund = subtotalRefund;

  // Save / Post Return Voucher
  const handleSaveReturn = async () => {
    if (!foundOrder) {
      toast({ variant: "destructive", title: "مطلوب فاتورة مبيعات", description: "يرجى البحث واستدعاء فاتورة مبيعات أولاً لإصدار سند المردود." });
      return;
    }
    if (selectedList.length === 0) {
      toast({ variant: "destructive", title: "لم يتم تحديد أي بنود", description: "يرجى اختيار صنف واحد على الأقل لإرجاعه." });
      return;
    }

    setSaving(true);
    try {
      const payloadItems = selectedList.map(({ item, state }: any) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: state.qty,
        unit_price: item.unitPrice,
        unit: "حبة",
        item_code: item.productId ? `ITM-${item.productId}` : undefined,
        original_quantity: item.quantity,
        order_item_id: item.id,
      }));

      const body = {
        invoice_number: foundOrder.invoiceNumber,
        order_id: foundOrder.id,
        reason: returnReason,
        payment_method: paymentMethod,
        customer_id: customerId,
        notes,
        items: payloadItems,
        branch_id: Number(selectedBranch),
        warehouse_id: Number(selectedWarehouse),
        return_type: returnType,
        safe_id: Number(safeId),
        currency,
        exchange_rate: Number(exchangeRate),
        cost_center: costCenter,
        delegate_id: delegateId,
        driver_id: driverId,
        region_id: regionId,
        reference_number: referenceNumber,
        is_suspended: isSuspended,
        is_posted: isPosted,
        subtotal: subtotalRefund / 1.15,
        tax: taxRefund,
        entry_device: "WORKSTATION-01"
      };

      const res = await apiPost("/api/returns", body);
      toast({ title: "🎉 تم حفظ وسند مردود المبيعات بنجاح", description: `رقم السند: ${res.return_number}` });
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["returns-summary"] });
      
      setViewRet(res);
      handleResetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل حفظ سند المردود", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setFoundOrder(null);
    setInvoiceQuery("");
    setReturnItems({});
    setNotes("");
    setReferenceNumber("");
  };

  // History Query for Past Returns
  const historyParams = new URLSearchParams();
  if (historyStartDate) historyParams.set("startDate", historyStartDate);
  if (historyEndDate) historyParams.set("endDate", historyEndDate);
  if (historySearch) historyParams.set("search", historySearch);

  const { data: returnsList = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["returns", historyStartDate, historyEndDate, historySearch],
    queryFn: () => apiGet(`/api/returns?${historyParams}`),
    enabled: showHistory
  });

  const { data: returnsSummary } = useQuery({
    queryKey: ["returns-summary"],
    queryFn: () => apiGet("/api/returns-summary")
  });

  const { data: safes = [] } = useQuery({
    queryKey: ["safes-list"],
    queryFn: () => apiGet("/api/safes")
  });

  const { data: docPrintSettings } = useQuery({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings").catch(() => ({}))
  });

  useEffect(() => {
    if (safes.length > 0 && (!safeId || safeId === "1")) {
      const active = safes.find((s: any) => s.active);
      if (active) setSafeId(String(active.id));
      else setSafeId(String(safes[0].id));
    }
  }, [safes]);

  const deleteReturnMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/returns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["returns-summary"] });
      toast({ title: "تم حذف سند المرتجع بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحذف", description: e.message })
  });

  return (
    <AdminLayout>
      <div className="space-y-3 select-none text-right font-sans">
        
        {/* 1. Header System Breadcrumb & User Info Bar (شريط المسار والمستخدم) */}
        <div className="bg-slate-900 text-white p-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-between shadow-md text-xs border border-slate-800">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-blue-400">أنظمة العملاء</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-blue-400">نظام إدارة المبيعات</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-amber-400 text-sm font-black flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              فواتير مردود المبيعات
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px] mt-2 sm:mt-0">
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>المستخدم : 1 - مدير النظام</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{new Date().toLocaleDateString("ar-SA")}</span>
            </div>
          </div>
        </div>

        {/* 2. Top ERP Operations Action Toolbar (شريط أدوات العمليات العليا) */}
        <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-300 flex flex-wrap items-center gap-1 shadow-sm">
          <Button 
            onClick={handleResetForm} 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-bold"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" /> إضافة (جديد)
          </Button>

          <Button 
            onClick={handleSaveReturn} 
            disabled={saving || !foundOrder} 
            size="sm" 
            className="h-8 gap-1 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
          >
            <Save className="w-3.5 h-3.5" /> حفظ (تأكيد)
          </Button>

          <Button 
            onClick={() => setShowHistory(true)} 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-bold"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" /> استعلام / بحث
          </Button>

          <Button 
            onClick={handleResetForm} 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-bold"
          >
            <X className="w-3.5 h-3.5 text-red-600" /> إلغاء
          </Button>

          <Button 
            onClick={() => setIsPosted(!isPosted)} 
            size="sm" 
            variant={isPosted ? "default" : "outline"} 
            className={`h-8 gap-1 text-xs font-bold ${isPosted ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> {isPosted ? "مرحل تلقائياً" : "ترحيل"}
          </Button>

          <Button 
            onClick={() => showHistory ? setShowHistory(false) : setShowHistory(true)} 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1 text-xs bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-bold mr-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" /> 
            {showHistory ? "العودة لشاشة الإدخال" : `سجلات المرتجعات السابق (${returnsSummary?.totalCount ?? 0})`}
          </Button>
        </div>

        {/* Show History Table or Main Entry Interface */}
        {showHistory ? (
          /* ── قسم سجلات المرتجعات السابقة ── */
          <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-300 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b pb-3">
              <div className="text-base font-black flex items-center gap-2 text-slate-800">
                <FileText className="w-5 h-5 text-blue-600" />
                جدول سندات المرتجعات المعتمدة السابقة
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  value={historySearch} 
                  onChange={e => setHistorySearch(e.target.value)} 
                  placeholder="بحث برقم المرتجع أو رقم الفاتورة..." 
                  className="w-64 h-8 text-xs" 
                />
                <Button size="sm" variant="outline" onClick={() => setShowHistory(false)} className="h-8 text-xs">
                  العودة للنموذج
                </Button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-slate-500 text-xs">جاري تحميل سجلات المرتجعات...</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">رقم سند المرتجع</th>
                      <th className="p-2.5">الفاتورة الأصلية</th>
                      <th className="p-2.5">تاريخ الإرجاع</th>
                      <th className="p-2.5">نوع المردود</th>
                      <th className="p-2.5">المبلغ المسترد</th>
                      <th className="p-2.5">العميل</th>
                      <th className="p-2.5">الكاشير</th>
                      <th className="p-2.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {((returnsList as any[]) || []).map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-blue-700">{r.return_number}</td>
                        <td className="p-2.5 font-mono font-bold">{r.invoice_number}</td>
                        <td className="p-2.5 text-slate-500">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                        <td className="p-2.5 font-semibold">{r.return_type ?? "نقدي"}</td>
                        <td className="p-2.5 font-mono font-bold text-red-600">-{fmt(r.total_refund)} ريال</td>
                        <td className="p-2.5 text-slate-600">{r.customer_name ?? "عميل نقدي"}</td>
                        <td className="p-2.5 text-slate-600">{r.cashier_name ?? "مدير النظام"}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewRet(r)} title="معاينة ومعاينة">
                              <Printer className="w-3.5 h-3.5 text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => confirm(`حذف المرتجع ${r.return_number}؟`) && deleteReturnMutation.mutate(r.id)} title="حذف">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {((returnsList as any[]) || []).length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد سجلات مرتجعات مطابقة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── الشاشة الرئيسية لإدخال وتعديل فاتورة المردود ── */
          <div className="space-y-3">
            
            {/* 3. Onyx Tabs Navigation Bar (تبويبات بيانات السند العليا) */}
            <div className="bg-slate-200 p-1 rounded-t-lg border-b border-slate-300 flex items-center gap-1 text-xs font-bold">
              <button 
                onClick={() => setActiveTab("main")}
                className={`px-3 py-1.5 rounded-t border-t-2 transition-all ${activeTab === "main" ? "bg-white text-blue-900 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 border-transparent"}`}
              >
                البيانات الرئيسية
              </button>
              <button 
                onClick={() => setActiveTab("other")}
                className={`px-3 py-1.5 rounded-t border-t-2 transition-all ${activeTab === "other" ? "bg-white text-blue-900 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 border-transparent"}`}
              >
                بيانات أخرى
              </button>
              <button 
                onClick={() => setActiveTab("extra")}
                className={`px-3 py-1.5 rounded-t border-t-2 transition-all ${activeTab === "extra" ? "bg-white text-blue-900 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 border-transparent"}`}
              >
                بيانات إضافية
              </button>
              <button 
                onClick={() => setActiveTab("expenses")}
                className={`px-3 py-1.5 rounded-t border-t-2 transition-all ${activeTab === "expenses" ? "bg-white text-blue-900 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 border-transparent"}`}
              >
                أعباء المبيعات
              </button>
              <button 
                onClick={() => setActiveTab("xml")}
                className={`px-3 py-1.5 rounded-t border-t-2 transition-all ${activeTab === "xml" ? "bg-white text-blue-900 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 border-transparent"}`}
              >
                إستيراد من ملف إكسمل
              </button>
            </div>

            {/* 4. Main Form Input Block (حقول بيانات السند المماثلة تماماً للنموذج) */}
            <div className="bg-slate-50 p-3 rounded-b-lg border border-slate-300 shadow-sm text-xs space-y-3">
              
              {/* Row 1: Branch, Warehouse, Payment Method, Cash Safe, Exchange Rate */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم الفرع:</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">01 - الفرع الرئيسي</SelectItem>
                      <SelectItem value="2">02 - فرع الشمال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم المخزن:</Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="اختر المستودع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">01 - المستودع الرئيسي</SelectItem>
                      <SelectItem value="2">02 - مستودع المطبخ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">طريقة الدفع:</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300 font-bold">
                      <SelectValue placeholder="طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً (الصندوق)</SelectItem>
                      <SelectItem value="card">شبكة / بنك</SelectItem>
                      <SelectItem value="credit">آجل (حساب العميل)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم الصندوق:</Label>
                  <Select value={safeId} onValueChange={setSafeId}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="اختر الصندوق" />
                    </SelectTrigger>
                    <SelectContent>
                      {safes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.id} - {s.name}</SelectItem>
                      ))}
                      {safes.length === 0 && (
                        <SelectItem value="1">101 - صندوق الكاشير الرئيسي</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">سعر التحويل / احتساب:</Label>
                  <Input 
                    value={exchangeRate} 
                    onChange={e => setExchangeRate(e.target.value)} 
                    className="h-8 text-xs bg-white font-mono border-slate-300 text-center" 
                  />
                </div>
              </div>

              {/* Row 2: Customer, Sales Rep, Date, Return Type, Return Voucher Number */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">اسم / رقم العميل:</Label>
                  <Input 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                    placeholder="عميل نقدي افتراضي" 
                    className="h-8 text-xs bg-white border-slate-300" 
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم المسوق / المندوب:</Label>
                  <Input 
                    value={delegateId} 
                    onChange={e => setDelegateId(e.target.value)} 
                    placeholder="رمز المندوب" 
                    className="h-8 text-xs bg-white border-slate-300" 
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">التاريخ:</Label>
                  <Input 
                    type="date" 
                    defaultValue={new Date().toISOString().slice(0, 10)} 
                    className="h-8 text-xs bg-white border-slate-300" 
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">نوع المردود:</Label>
                  <Select value={returnType} onValueChange={setReturnType}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300 font-bold">
                      <SelectValue placeholder="نوع المردود" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مردود مبيعات نقدي">مردود مبيعات نقدي</SelectItem>
                      <SelectItem value="مردود مبيعات آجل">مردود مبيعات آجل</SelectItem>
                      <SelectItem value="استبدال أصناف">استبدال أصناف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم المردود:</Label>
                  <Input 
                    value="تلقائي (RET-NEW)"
                    disabled
                    readOnly
                    className="h-8 text-xs bg-slate-200 font-mono text-slate-600 font-bold border-slate-300" 
                  />
                </div>
              </div>

              {/* Row 3: Sales Invoice Lookup (ربط مباشر بفواتير المبيعات), Currency, Cost Center, Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-blue-50/70 p-2.5 rounded border border-blue-200">
                <div className="sm:col-span-5">
                  <Label className="text-[11px] font-bold text-blue-900 mb-1 block flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-blue-700" />
                    فواتير المبيعات (استدعاء بالرقم البسيط):
                  </Label>
                  <div className="flex gap-1">
                    <Input 
                      value={invoiceQuery} 
                      onChange={e => setInvoiceQuery(e.target.value)} 
                      onKeyDown={e => e.key === "Enter" && executeInvoiceLookup(invoiceQuery)}
                      placeholder="أدخل رقم الفاتورة مثل 1001 أو 1002..." 
                      className="h-8 text-xs bg-white border-blue-300 font-mono font-bold" 
                    />
                    <Button 
                      onClick={() => executeInvoiceLookup(invoiceQuery)} 
                      disabled={searchingInvoice || !invoiceQuery.trim()} 
                      size="sm" 
                      className="h-8 text-xs bg-blue-700 hover:bg-blue-800 text-white font-bold gap-1"
                    >
                      {searchingInvoice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "بحث / استدعاء"}
                    </Button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">العملة:</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                      <SelectValue placeholder="العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ريال">ريال يمني / سعودي</SelectItem>
                      <SelectItem value="دولار">دولار أمريكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-[11px] font-bold text-slate-700 mb-1 block">رقم المركز:</Label>
                  <Input 
                    value={costCenter} 
                    onChange={e => setCostCenter(e.target.value)} 
                    className="h-8 text-xs bg-white font-mono border-slate-300" 
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-4 h-8 pt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                    <Checkbox 
                      checked={isSuspended} 
                      onCheckedChange={(c) => setIsSuspended(!!c)} 
                    />
                    <span>تعليق السند</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-blue-900">
                    <Checkbox 
                      checked={isPosted} 
                      onCheckedChange={(c) => setIsPosted(!!c)} 
                    />
                    <span>ترحيل إلكتروني</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 5. Onyx Items Table Grid (جدول أصناف الفاتورة والمردود) */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="bg-slate-800 text-white p-2 text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  جدول أصناف وبنود المردود
                  {foundOrder && (
                    <Badge variant="outline" className="text-[11px] text-emerald-400 border-emerald-500 bg-emerald-950/50 mr-2 font-mono">
                      الفاتورة الأصلية #{foundOrder.invoiceNumber}
                    </Badge>
                  )}
                </span>
                
                {foundOrder?.items && (
                  <Button 
                    onClick={() => handleToggleAll(true)} 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 text-[11px] text-amber-300 hover:text-white hover:bg-slate-700 gap-1 p-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> تحديد الكل لليإرجاع
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto min-h-[180px]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2 text-center w-10">تحديد</th>
                      <th className="p-2 text-center w-8">م</th>
                      <th className="p-2">رقم الصنف</th>
                      <th className="p-2">اسم الصنف والبيان</th>
                      <th className="p-2 text-center">الوحدة</th>
                      <th className="p-2 text-center">رقم الفاتورة</th>
                      <th className="p-2 text-center">الكمية الأصلية</th>
                      <th className="p-2 text-center w-28">ك المرتجعه</th>
                      <th className="p-2 text-center">السعر</th>
                      <th className="p-2 text-center font-bold">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {foundOrder?.items?.map((item: any, idx: number) => {
                      const st = returnItems[idx] ?? { selected: false, qty: 1 };
                      const remaining = item.remainingQuantity ?? item.quantity;
                      const isRowSelected = st.selected && remaining > 0;

                      return (
                        <tr key={idx} className={isRowSelected ? "bg-amber-50/70 font-semibold" : "hover:bg-slate-50"}>
                          <td className="p-2 text-center">
                            <Checkbox 
                              checked={isRowSelected} 
                              disabled={remaining <= 0} 
                              onCheckedChange={() => handleItemToggle(idx)} 
                            />
                          </td>
                          <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2 font-mono text-slate-600">{item.productId ? `ITM-${item.productId}` : `—`}</td>
                          <td className="p-2 font-bold text-slate-900">{item.productName}</td>
                          <td className="p-2 text-center text-slate-600">حبة</td>
                          <td className="p-2 text-center font-mono text-blue-700 font-bold">{foundOrder.invoiceNumber}</td>
                          <td className="p-2 text-center font-bold text-slate-600">{item.quantity}</td>
                          <td className="p-2 text-center">
                            <Input 
                              type="number" 
                              min={1} 
                              max={remaining} 
                              value={st.qty} 
                              disabled={!isRowSelected || remaining <= 0}
                              onChange={e => handleItemQtyChange(idx, Number(e.target.value))}
                              className="h-7 w-20 text-center font-bold text-red-600 mx-auto bg-white border-slate-300"
                            />
                          </td>
                          <td className="p-2 text-center font-mono">{fmt(item.unitPrice)}</td>
                          <td className="p-2 text-center font-mono font-bold text-slate-900">
                            {fmt(isRowSelected ? item.unitPrice * st.qty : 0)} ريال
                          </td>
                        </tr>
                      );
                    })}

                    {!foundOrder && (
                      <tr>
                        <td colSpan={10} className="p-12 text-center text-slate-400 bg-slate-50/50">
                          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-60" />
                          <div>يرجى إدخال أو استدعاء رقم الفاتورة من شريط البحث أعلاه لاستعراض أصناف الم مردود.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Summary Footer Accounting Totals & supplemental details (ملخص المبالغ والبيانات التكميلية) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
              
              {/* Left Column: Supplemental Information (البيان والبيانات التكميلية) */}
              <div className="lg:col-span-7 bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[11px] text-slate-600 block mb-1">رقم المنطقة:</Label>
                    <Input 
                      value={regionId} 
                      onChange={e => setRegionId(e.target.value)} 
                      placeholder="منطقة المبيعات" 
                      className="h-7 text-xs bg-white border-slate-300" 
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-600 block mb-1">رقم السائق:</Label>
                    <Input 
                      value={driverId} 
                      onChange={e => setDriverId(e.target.value)} 
                      placeholder="سائق التوصيل" 
                      className="h-7 text-xs bg-white border-slate-300" 
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-600 block mb-1">عدد المرفقات:</Label>
                    <Input 
                      type="number" 
                      defaultValue={0} 
                      className="h-7 text-xs bg-white border-slate-300 text-center font-mono" 
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-600 block mb-1">رقم المرجع:</Label>
                    <Input 
                      value={referenceNumber} 
                      onChange={e => setReferenceNumber(e.target.value)} 
                      placeholder="رقم مرجعي إضافي" 
                      className="h-7 text-xs bg-white border-slate-300 font-mono" 
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700 block mb-1">البيان / سبب المردود:</Label>
                  <Textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="اكتب بيان وسند المردود المالي المعتمد هنا..." 
                    className="h-14 text-xs bg-white border-slate-300 resize-none" 
                  />
                </div>
              </div>

              {/* Right Column: Financial Totals Box (صندوق المجاميع والإجمالي) */}
              <div className="lg:col-span-5 bg-slate-900 text-white p-3 rounded-lg border border-slate-800 space-y-2 font-mono text-xs shadow-md">
                <div className="flex justify-between text-slate-300">
                  <span>إجمالي الكميات المرتجعة:</span>
                  <span className="font-bold text-amber-400">
                    {selectedList.reduce((sum, { state }) => sum + state.qty, 0)} قطعة
                  </span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>المجموع الفرعي:</span>
                  <span>{fmt(subtotalRefund / 1.15)} ريال</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>الخصم المستقطع:</span>
                  <span>0.00 ريال</span>
                </div>

                <div className="flex justify-between text-slate-300 border-b border-slate-800 pb-2">
                  <span>ضريبة القيمة المضافة (15%):</span>
                  <span>{fmt(subtotalRefund - (subtotalRefund / 1.15))} ريال</span>
                </div>

                <div className="flex justify-between items-center text-sm font-black text-emerald-400 pt-1">
                  <span className="font-sans">المجموع النهائي للمردود:</span>
                  <span className="text-base text-emerald-400 font-mono">{fmt(totalRefund)} ريال</span>
                </div>
              </div>
            </div>

            {/* 7. System Audit & Record Metadata Footer Bar (شريط بيانات النظام والتدقيق بأسفل الشاشة) */}
            <div className="bg-slate-200 text-slate-700 p-2 rounded-lg border border-slate-300 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block">مدخل السجل:</span>
                <span className="font-bold">1 - مدير النظام</span>
              </div>

              <div>
                <span className="text-slate-500 block">تاريخ الإدخال:</span>
                <span>{new Date().toLocaleDateString("ar-SA")}</span>
              </div>

              <div>
                <span className="text-slate-500 block">الجهاز المدخل:</span>
                <span>WORKSTATION-01</span>
              </div>

              <div>
                <span className="text-slate-500 block">معدل السجل:</span>
                <span>1 - مدير النظام</span>
              </div>

              <div>
                <span className="text-slate-500 block">تاريخ التعديل:</span>
                <span>—</span>
              </div>

              <div>
                <span className="text-slate-500 block">الجهاز المعدل:</span>
                <span>WORKSTATION-01</span>
              </div>

              <div>
                <span className="text-slate-500 block">مرات الطباعة:</span>
                <span className="font-bold">1</span>
              </div>

              <div>
                <span className="text-slate-500 block">مرات التعديل:</span>
                <span className="font-bold">0</span>
              </div>
            </div>

          </div>
        )}

        {/* View / Print Voucher Dialog */}
        <ViewReturnDialog ret={viewRet} onClose={() => setViewRet(null)} docPrintSettings={docPrintSettings} />

      </div>
    </AdminLayout>
  );
}
