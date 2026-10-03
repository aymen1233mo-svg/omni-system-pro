import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingBag,
  Truck,
  Users,
  Receipt,
  BarChart3,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Filter,
  Printer,
  Search,
  RefreshCw,
  Layers,
  ShieldCheck,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  ClipboardList,
  Clock,
  Star,
  Eye,
  Sparkles,
  Building2,
  Wallet,
  FileCheck,
  Percent,
  Calendar,
  Check,
  HelpCircle,
  TrendingUp,
  RotateCcw,
  Zap,
  Pencil,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Maximize2,
  FileDown,
  BookOpen,
  Landmark,
  LayoutDashboard
} from "lucide-react";
import { printGenericDocument, generateGenericDocumentHtml, saveA4HtmlAsPdf, printA4Html, generateStatementA4Html, generatePurchaseInvoiceA4Html, generateVoucherStyle2A4Html } from "@/lib/printUtils";
import { ReportViewerModal } from "@/components/ReportViewerModal";

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

async function parseApiError(r: Response) {
  try {
    const data = await r.json();
    return data.error || data.message || JSON.stringify(data);
  } catch {
    return await r.text();
  }
}

async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) {
    const err = await parseApiError(r);
    throw new Error(err || `Request failed with status ${r.status}`);
  }
  return r.json();
}

async function apiPost(url: string, body: any) {
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await parseApiError(r);
    throw new Error(err || `Request failed with status ${r.status}`);
  }
  return r.json();
}

async function apiPut(url: string, body: any) {
  const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await parseApiError(r);
    throw new Error(err || `Request failed with status ${r.status}`);
  }
  return r.json();
}

async function apiDel(url: string) {
  const r = await fetchAuth(url, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    const err = await parseApiError(r);
    throw new Error(err || `Request failed with status ${r.status}`);
  }
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizePurchaseTab(raw?: string | null): string {
  const t = (raw || "dashboard").trim();
  const map: Record<string, string> = {
    pr: "requests",
    rfq: "rfqs",
    po: "orders",
    payments: "payments_returns",
    returns: "payments_returns",
    contracts: "contracts_analytics",
  };
  return map[t] || t;
}

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""));
  const [activeTab, setActiveTab] = useState(() => normalizePurchaseTab(searchParams.get("tab")));
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; title: string; htmlContent: string }>({
    isOpen: false,
    title: "",
    htmlContent: ""
  });

  const handleTabChange = (val: string) => {
    const normalized = normalizePurchaseTab(val);
    setActiveTab(normalized);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/suppliers?tab=${normalized}`);
    }
  };

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      setSearchParams(params);
      const tabParam = normalizePurchaseTab(params.get("tab"));
      if (tabParam && tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
      const actionParam = params.get("action");
      if (actionParam === "new_pr") {
        setIsPROpen(true);
      } else if (actionParam === "new_po") {
        setIsPOOpen(true);
      } else if (actionParam === "new_invoice") {
        setIsInvoiceOpen(true);
      } else if (actionParam === "refresh") {
        refreshAll();
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [activeTab, window.location.search]);

  // ─────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────
  const { data: dashboard, refetch: refetchDash } = useQuery({
    queryKey: ["purchases-dashboard"],
    queryFn: () => apiGet("/api/purchases/dashboard")
  });

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiGet("/api/suppliers")
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet("/api/products")
  });

  const { data: requests = [], refetch: refetchPRs } = useQuery({
    queryKey: ["purchase-requests"],
    queryFn: () => apiGet("/api/purchases/requests")
  });

  const { data: autoReorders = [], refetch: refetchAuto } = useQuery({
    queryKey: ["auto-reorders"],
    queryFn: () => apiGet("/api/purchases/auto-reorder")
  });

  const { data: rfqs = [], refetch: refetchRFQs } = useQuery({
    queryKey: ["purchase-rfqs"],
    queryFn: () => apiGet("/api/purchases/rfqs")
  });

  const { data: orders = [], refetch: refetchPOs } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => apiGet("/api/purchases/orders")
  });

  const { data: grns = [], refetch: refetchGRNs } = useQuery({
    queryKey: ["purchase-grn"],
    queryFn: () => apiGet("/api/purchases/grn")
  });

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => apiGet("/api/purchases/invoices")
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: () => apiGet("/api/purchases/payments")
  });

  const { data: returns = [], refetch: refetchReturns } = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: () => apiGet("/api/purchases/returns")
  });

  const { data: contracts = [], refetch: refetchContracts } = useQuery({
    queryKey: ["supplier-contracts"],
    queryFn: () => apiGet("/api/purchases/contracts")
  });

  const { data: docPrintSettings } = useQuery({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings")
  });

  const { data: priceTrends = [] } = useQuery({
    queryKey: ["price-trends"],
    queryFn: () => apiGet("/api/purchases/analytics/price-trends")
  });

  // Refresh all
  const refreshAll = () => {
    refetchDash();
    refetchSuppliers();
    refetchPRs();
    refetchAuto();
    refetchRFQs();
    refetchPOs();
    refetchGRNs();
    refetchInvoices();
    refetchPayments();
    refetchReturns();
    refetchContracts();
  };

  // ─────────────────────────────────────────────────────────────
  // MODAL STATES
  // ─────────────────────────────────────────────────────────────
  const [isPROpen, setIsPROpen] = useState(false);
  const [isRFQOpen, setIsRFQOpen] = useState(false);
  const [isPOOpen, setIsPOOpen] = useState(false);
  const [isGRNOpen, setIsGRNOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);

  // Form States
  const [prForm, setPrForm] = useState({
    requester_name: "",
    department: "المخازن",
    priority: "عادي",
    reason: "",
    items: [{ product_id: "", product_name: "", unit: "كجم", requested_qty: 1, notes: "" }]
  });

  const [rfqForm, setRfqForm] = useState({
    pr_id: "",
    item_name: "",
    quantity: 1,
    unit: "كجم",
    supplier_id: "",
    supplier_name: "",
    unit_price: 0,
    lead_time_days: 2,
    payment_terms: "30 يوم",
    notes: ""
  });

  const [poForm, setPoForm] = useState({
    supplier_id: "",
    pr_id: "",
    payment_terms: "30 يوم",
    delivery_terms: "تسليم بالفرع الرئيسي",
    discount: 0,
    tax: 0,
    shipping_cost: 0,
    notes: "",
    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }]
  });

  const [grnForm, setGrnForm] = useState({
    po_id: "",
    supplier_id: "",
    supplier_name: "",
    delivery_note_ref: "",
    notes: "",
    items: [{ product_id: "", product_name: "", ordered_qty: 1, received_qty: 1, accepted_qty: 1, rejected_qty: 0, rejection_reason: "", temperature: 4, batch_number: "", expiry_date: "" }]
  });

  const [invForm, setInvForm] = useState({
    supplier_id: "",
    supplier_name: "",
    po_id: "",
    grn_id: "",
    supplier_invoice_ref: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    paid_amount: 0,
    discount: 0,
    tax: 0,
    shipping_cost: 0,
    additional_expenses: 0,
    payment_method: "credit",
    is_direct_purchase: false,
    notes: "",
    items: [{ product_id: "", product_name: "", unit: "كجم", quantity: 1, unit_price: 0 }]
  });

  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supForm, setSupForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    mobile_number: "",
    email: "",
    tax_number: "",
    commercial_register: "",
    address: "",
    payment_terms: "30 يوم",
    bank_name: "",
    bank_account: "",
    notes: "",
    rating: 5,
    balance: 0
  });

  const [payForm, setPayForm] = useState({
    supplier_id: "",
    invoice_id: "",
    amount: 0,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    check_number: "",
    bank_name: "",
    reference_number: "",
    notes: ""
  });

  const [retForm, setRetForm] = useState({
    supplier_id: "",
    invoice_id: "",
    return_date: new Date().toISOString().slice(0, 10),
    reason: "عطوب / تلف بالمواصفات",
    notes: "",
    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }]
  });

  const [cntForm, setCntForm] = useState({
    supplier_id: "",
    title: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    agreed_amount: 0,
    payment_terms: "30 يوم",
    notes: ""
  });

  // Filter States
  const [selectedReportType, setSelectedReportType] = useState("by_supplier");
  const [reportFromDate, setReportFromDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [reportToDate, setReportToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportSupplierId, setReportSupplierId] = useState("");
  const [reportBranchId, setReportBranchId] = useState("");

  const { data: reportData = [] } = useQuery({
    queryKey: ["procurement-report", selectedReportType, reportFromDate, reportToDate, reportSupplierId, reportBranchId],
    queryFn: () => apiGet(`/api/purchases/reports?type=${selectedReportType}&from_date=${reportFromDate}&to_date=${reportToDate}&supplier_id=${reportSupplierId}&branch_id=${reportBranchId}`),
    enabled: activeTab === "reports"
  });

  // ─────────────────────────────────────────────────────────────
  // MUTATIONS
  // ─────────────────────────────────────────────────────────────
  const createPR = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/requests", data),
    onSuccess: () => {
      refreshAll();
      setIsPROpen(false);
      setPrForm({
        requester_name: "",
        department: "المخازن",
        priority: "عادي",
        reason: "",
        items: [{ product_id: "", product_name: "", unit: "كجم", requested_qty: 1, notes: "" }]
      });
      toast({ title: "تم إنشاء طلب الشراء بنجاح وإرساله للاعتماد ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في إنشاء طلب الشراء", description: e.message })
  });

  const updatePRStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiPost(`/api/purchases/requests/${id}/status`, { status }),
    onSuccess: () => {
      refreshAll();
      toast({ title: "تم تحديث حالة طلب الشراء ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createAutoPR = useMutation({
    mutationFn: (items: any[]) => apiPost("/api/purchases/auto-reorder/create-pr", { items }),
    onSuccess: () => {
      refreshAll();
      toast({ title: "تم توليد طلب الشراء التلقائي بنجاح وإرساله للاعتماد ⚡" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في إنشاء طلب الشراء الآلي", description: e.message })
  });

  const createRFQ = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/rfqs", data),
    onSuccess: () => {
      refreshAll();
      setIsRFQOpen(false);
      setRfqForm({
        pr_id: "",
        item_name: "",
        quantity: 1,
        unit: "كجم",
        supplier_id: "",
        supplier_name: "",
        unit_price: 0,
        lead_time_days: 2,
        payment_terms: "30 يوم",
        notes: ""
      });
      toast({ title: "تم تسجيل عرض السعر بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في حفظ عرض السعر", description: e.message })
  });

  const acceptRFQ = useMutation({
    mutationFn: (id: number) => apiPost(`/api/purchases/rfqs/${id}/accept`, {}),
    onSuccess: () => {
      refreshAll();
      toast({ title: "تم قبول عرض السعر بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createPO = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/orders", data),
    onSuccess: () => {
      refreshAll();
      setIsPOOpen(false);
      setPoForm({
        supplier_id: "",
        pr_id: "",
        payment_terms: "30 يوم",
        delivery_terms: "تسليم بالفرع الرئيسي",
        discount: 0,
        tax: 0,
        shipping_cost: 0,
        notes: "",
        items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0 }]
      });
      toast({ title: "تم إنشاء أمر الشراء بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const approvePO = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiPost(`/api/purchases/orders/${id}/approve`, { status }),
    onSuccess: () => {
      refreshAll();
      toast({ title: "تم تحديث موافقة أمر الشراء ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createGRN = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/grn", data),
    onSuccess: () => {
      refreshAll();
      setIsGRNOpen(false);
      setGrnForm({
        po_id: "",
        supplier_id: "",
        supplier_name: "",
        delivery_note_ref: "",
        notes: "",
        items: [{ product_id: "", product_name: "", ordered_qty: 1, received_qty: 1, accepted_qty: 1, rejected_qty: 0, rejection_reason: "", temperature: 4, batch_number: "", expiry_date: "" }]
      });
      toast({ title: "تم تسجيل استلام المشتريات وفحص الجودة ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في تسجيل استلام المشتريات", description: e.message })
  });

  const createInvoice = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/invoices", data),
    onSuccess: () => {
      refreshAll();
      setIsInvoiceOpen(false);
      toast({ title: "تم تسجيل فاتورة المشتريات وتحديث المخزون بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createSupplier = useMutation({
    mutationFn: (data: any) => apiPost("/api/suppliers", data),
    onSuccess: () => {
      refreshAll();
      setIsSupplierOpen(false);
      setEditingSupplier(null);
      setSupForm({
        name: "",
        contact_person: "",
        phone: "",
        mobile_number: "",
        email: "",
        tax_number: "",
        commercial_register: "",
        address: "",
        payment_terms: "30 يوم",
        bank_name: "",
        bank_account: "",
        notes: "",
        rating: 5,
        balance: 0
      });
      toast({ title: "تم إضافة المورد بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في إضافة المورد", description: e.message })
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPut(`/api/suppliers/${id}`, data),
    onSuccess: () => {
      refreshAll();
      setIsSupplierOpen(false);
      setEditingSupplier(null);
      setSupForm({
        name: "",
        contact_person: "",
        phone: "",
        mobile_number: "",
        email: "",
        tax_number: "",
        commercial_register: "",
        address: "",
        payment_terms: "30 يوم",
        bank_name: "",
        bank_account: "",
        notes: "",
        rating: 5,
        balance: 0
      });
      toast({ title: "تم تحديث بيانات المورد بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في تعديل المورد", description: e.message })
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: number) => apiDel(`/api/suppliers/${id}`),
    onSuccess: () => {
      refreshAll();
      toast({ title: "تم حذف المورد بنجاح 🗑️" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ في حذف المورد", description: e.message })
  });

  const createPayment = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/payments", data),
    onSuccess: () => {
      refreshAll();
      setIsPaymentOpen(false);
      toast({ title: "تم تسجيل دفعة المورد وتحديث الحساب بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createReturn = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/returns", data),
    onSuccess: () => {
      refreshAll();
      setIsReturnOpen(false);
      toast({ title: "تم تسجيل مرتجع المشتريات وتخفيض المخزون بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  const createContract = useMutation({
    mutationFn: (data: any) => apiPost("/api/purchases/contracts", data),
    onSuccess: () => {
      refreshAll();
      setIsContractOpen(false);
      toast({ title: "تم حفظ عقد التوريد بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "خطأ", description: e.message })
  });

  // Document Preview, PDF & Printing Helpers
  const getDocHtml = (title: string, data: any) => {
    if (
      title.startsWith("فاتورة شراء") || 
      title.startsWith("طلب شراء") || 
      title.startsWith("عرض سعر") || 
      title.startsWith("أمر شراء") || 
      title.startsWith("محضر استلام") || 
      title.startsWith("إشعار خصم")
    ) {
      return generatePurchaseInvoiceA4Html({ ...data, title }, docPrintSettings);
    }
    if (title.startsWith("كشف حساب مورد")) {
      return generateStatementA4Html({
        partyType: "supplier",
        party: data.supplier || data,
        transactions: data.invoices || data.transactions || [],
        settings: docPrintSettings
      });
    }
    if (title.startsWith("سند صرف") || title.startsWith("سند قبض")) {
      const type = (title.includes("قبض") || data.type === "receipt") ? "receipt" : "payment";
      return generateVoucherStyle2A4Html({
        type,
        voucherNumber: data.payment_number || data.voucher_number || data.id || "1",
        date: data.payment_date || data.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        amount: data.amount,
        partyName: data.supplier_name || data.party_name || data.received_from || "الطرف المعني",
        paymentMethod: data.payment_method || "cash",
        notes: data.notes || data.payment_against || "بيان السند",
        referenceNo: data.reference_number || data.payment_number || data.voucher_number || "1",
        settings: docPrintSettings
      });
    }
    return generateGenericDocumentHtml(title, data, docPrintSettings);
  };

  const printDocument = (title: string, data: any) => {
    const html = getDocHtml(title, data);
    printA4Html(html, title);
  };

  const previewDocument = (title: string, data: any) => {
    const html = getDocHtml(title, data);
    setPreviewModal({ isOpen: true, title, htmlContent: html });
  };

  const exportPdfDocument = async (title: string, data: any) => {
    const html = getDocHtml(title, data);
    toast({ title: "جاري توليد ملف PDF...", description: title });
    await saveA4HtmlAsPdf(html, `${title}.pdf`);
    toast({ title: "تم تصدير وحفظ ملف PDF بنجاح ✅", description: title });
  };

  const renderDocActions = (title: string, data: any, compact = true) => (
    <div className="inline-flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className={compact ? "h-7 px-2 text-[11px] gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50" : "gap-1.5 text-xs"}
        title="معاينة بشاشة كاملة"
        onClick={() => previewDocument(title, data)}
      >
        <Maximize2 className="w-3.5 h-3.5" /> معاينة
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={compact ? "h-7 px-2 text-[11px] gap-1 text-rose-700 border-rose-200 hover:bg-rose-50" : "gap-1.5 text-xs"}
        title="توليد ملف PDF"
        onClick={() => exportPdfDocument(title, data)}
      >
        <FileDown className="w-3.5 h-3.5" /> PDF
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className={compact ? "h-7 px-2 text-[11px] gap-1" : "gap-1.5 text-xs"}
        title="طباعة المستند A4"
        onClick={() => printDocument(title, data)}
      >
        <Printer className="w-3.5 h-3.5" /> طباعة
      </Button>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header & Accounting Linkage Banner */}
        <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-slate-700/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    نظام إدارة المشتريات والموردين وسلسلة الإمداد المتكامل
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                      10 خدمات متكاملة • Omni System Pro ERP
                    </Badge>
                  </h1>
                  <p className="text-xs text-slate-300">
                    مرتبط آلياً بنظام المخازن والمستودعات (حساب المخزون 11300) ونظام الحسابات العامة ودليل الحسابات (حسابات الموردين 21100 والضريبة 11500)
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-amber-500/40 text-xs font-bold h-8 gap-1.5"
                onClick={() => { window.location.href = "/accounting?tab=chart"; }}
              >
                <BookOpen className="w-3.5 h-3.5" /> شجرة ودليل الحسابات (21100)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border-emerald-500/40 text-xs font-bold h-8 gap-1.5"
                onClick={() => { window.location.href = "/accounting?tab=journal"; }}
              >
                <Landmark className="w-3.5 h-3.5" /> القيود اليومية للمشتريات
              </Button>
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-8 gap-1.5"
                onClick={() => setIsInvoiceOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> فاتورة مشتريات سريعة
              </Button>
            </div>
          </div>

          {/* Interactive 10-Service Navigation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 mt-4 pt-3 border-t border-slate-700/80">
            {[
              { id: "dashboard", num: "1", label: "لوحة المؤشرات", icon: LayoutDashboard },
              { id: "requests", num: "2", label: "طلبات الشراء PR", icon: ClipboardList, count: requests.length },
              { id: "rfqs", num: "3", label: "عروض الأسعار RFQ", icon: FileCheck, count: rfqs.length },
              { id: "orders", num: "4", label: "أوامر الشراء PO", icon: ShoppingBag, count: orders.length },
              { id: "grn", num: "5", label: "الاستلام والجودة GRN", icon: Truck, count: grns.length },
              { id: "invoices", num: "6", label: "فواتير المشتريات", icon: Receipt, count: invoices.length },
              { id: "suppliers", num: "7", label: "الموردين (21100)", icon: Users, count: suppliers.length },
              { id: "payments_returns", num: "8", label: "الدفعات والمرتجعات", icon: Wallet, count: payments.length + returns.length },
              { id: "contracts_analytics", num: "9", label: "العقود والأسعار", icon: FileText, count: contracts.length },
              { id: "reports", num: "10", label: "التقارير (12)", icon: BarChart3 }
            ].map((srv) => {
              const IconComp = srv.icon;
              const isAct = activeTab === srv.id;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleTabChange(srv.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer border ${
                    isAct
                      ? "bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md scale-[1.02]"
                      : "bg-slate-800/70 hover:bg-slate-800 text-slate-200 border-slate-700/70 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-extrabold truncate max-w-full">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isAct ? "bg-slate-950 text-amber-400" : "bg-slate-700 text-amber-300"}`}>
                      {srv.num}
                    </span>
                    <IconComp className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <span className="text-[11px] mt-1 truncate w-full">{srv.label}</span>
                  {srv.count !== undefined && (
                    <span className={`text-[9px] font-mono mt-0.5 px-1.5 rounded-full ${isAct ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-900/80 text-slate-400"}`}>
                      {srv.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Purchasing Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">لوحة التحكم</TabsTrigger>
            <TabsTrigger value="requests">طلبات الشراء والطلب الآلي</TabsTrigger>
            <TabsTrigger value="rfqs">عروض الأسعار والمقارنة</TabsTrigger>
            <TabsTrigger value="orders">أوامر الشراء</TabsTrigger>
            <TabsTrigger value="grn">الاستلام والجودة (GRN)</TabsTrigger>
            <TabsTrigger value="invoices">فواتير المشتريات</TabsTrigger>
            <TabsTrigger value="suppliers">الموردين والذمم</TabsTrigger>
            <TabsTrigger value="payments_returns">الدفعات والمرتجعات</TabsTrigger>
            <TabsTrigger value="contracts_analytics">العقود وتحليل الأسعار</TabsTrigger>
            <TabsTrigger value="reports">التقارير الشاملة</TabsTrigger>
          </TabsList>

          {/* ─────────────────────────────────────────────────────────────
              1. PROCUREMENT DASHBOARD
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Top Indicator Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">مشتريات اليوم</p>
                  <p className="text-xl font-black font-mono text-primary">{fmt(dashboard?.todayPurchases)}</p>
                  <p className="text-[10px] text-muted-foreground">ريال</p>
                </CardContent>
              </Card>

              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">مشتريات الشهر</p>
                  <p className="text-xl font-black font-mono text-emerald-600">{fmt(dashboard?.monthPurchases)}</p>
                  <p className="text-[10px] text-muted-foreground">ريال</p>
                </CardContent>
              </Card>

              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">طلبات الشراء المعلقة</p>
                  <p className="text-xl font-black font-mono text-amber-600">{dashboard?.pendingPrCount ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">طلب بانتظار الاعتماد</p>
                </CardContent>
              </Card>

              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">أوامر الشراء المفتوحة</p>
                  <p className="text-xl font-black font-mono text-blue-600">{dashboard?.openPoCount ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">أمر جاري توريده</p>
                </CardContent>
              </Card>

              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">مستحقات الموردين</p>
                  <p className="text-xl font-black font-mono text-destructive">{fmt(dashboard?.supplierPayables)}</p>
                  <p className="text-[10px] text-muted-foreground">ذمم دائنة قائمة</p>
                </CardContent>
              </Card>

              <Card className="bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">إجمالي المدفوع للموردين</p>
                  <p className="text-xl font-black font-mono text-indigo-600">{fmt(dashboard?.supplierTotalPaid)}</p>
                  <p className="text-[10px] text-muted-foreground">سدادات موثقة</p>
                </CardContent>
              </Card>
            </div>

            {/* Reorder Alerts & Price Surge Warnings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Smart Auto-Reorder Alerts Widget */}
              <Card className="shadow-sm border-amber-200">
                <CardHeader className="pb-3 border-b bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
                      <Zap className="w-5 h-5 text-amber-500" />
                      تنبيهات نقص المخزون والطلب الآلي
                    </CardTitle>
                    {autoReorders.length > 0 && (
                      <Button size="sm" onClick={() => createAutoPR.mutate(autoReorders)} disabled={createAutoPR.isPending} className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs">
                        <Sparkles className="w-3.5 h-3.5" /> إنشاء طلب شراء تلقائي
                      </Button>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    الأصناف التي وصلت أو تجاوزت الحد الأدنى للمخزون وتحتاج إلى إعادة إمداد فورية.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[300px] overflow-y-auto text-xs">
                    {autoReorders.map((item: any) => (
                      <div key={item.product_id} className="p-3 flex items-center justify-between hover:bg-muted/40">
                        <div>
                          <p className="font-bold text-sm">{item.product_name}</p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">{item.reason}</p>
                        </div>
                        <div className="text-left font-mono">
                          <p className="font-bold text-amber-700">المقترح: {item.suggested_qty} كجم</p>
                          <p className="text-[10px] text-muted-foreground">التكلفة التقديرية: {fmt(item.estimated_total)} ريال</p>
                        </div>
                      </div>
                    ))}
                    {autoReorders.length === 0 && (
                      <div className="p-6 text-center text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        جميع المستويات الميدانية للمخزون في الحدود الآمنة الممتازة.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Price Surge Warnings Widget */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-rose-500/5">
                  <CardTitle className="text-base flex items-center gap-2 text-rose-900 dark:text-rose-300">
                    <TrendingUp className="w-5 h-5 text-rose-500" />
                    الأصناف التي ارتفع سعر شرائها مؤخراً
                  </CardTitle>
                  <CardDescription className="text-xs">
                    مراقبة تضخم أسعار الموردين مقارنة بالفواتير السابقة لمنع الشراء بأسعار مرتفعة.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[300px] overflow-y-auto text-xs">
                    {(dashboard?.priceSurges || []).map((surge: any) => (
                      <div key={surge.id} className="p-3 flex items-center justify-between hover:bg-muted/40">
                        <div>
                          <p className="font-bold text-sm">{surge.name}</p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            السعر السابق: <span className="font-mono">{fmt(surge.prev_cost)}</span> ⬅ السعر الجديد: <span className="font-mono font-bold text-rose-600">{fmt(surge.current_cost)}</span>
                          </p>
                        </div>
                        <Badge variant="destructive" className="font-mono text-xs">
                          +{surge.percentage}% ارتفاع
                        </Badge>
                      </div>
                    ))}
                    {(dashboard?.priceSurges || []).length === 0 && (
                      <div className="p-6 text-center text-muted-foreground">
                        <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        استقرار تام في أسعار الشراء للأصناف الموردة.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Suppliers & Top Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> أكثر الموردين تعاملاً (حسب حجم الشراء)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="p-2.5 text-right font-semibold">المورد</th>
                        <th className="p-2.5 text-center font-semibold">عدد الفواتير</th>
                        <th className="p-2.5 text-left font-semibold">إجمالي الشراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(dashboard?.topSuppliers || []).map((s: any, idx: number) => (
                        <tr key={`top-sup-${s.id || idx}-${idx}`} className="hover:bg-muted/30">
                          <td className="p-2.5 font-medium">{s.name}</td>
                          <td className="p-2.5 text-center font-mono">{s.invoice_count}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-primary">{fmt(s.total_purchases)} ريال</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" /> أكثر الأصناف شراءً
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="p-2.5 text-right font-semibold">الصنف</th>
                        <th className="p-2.5 text-center font-semibold">الكمية المشراة</th>
                        <th className="p-2.5 text-left font-semibold">إجمالي التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(dashboard?.topItems || []).map((i: any) => (
                        <tr key={i.id} className="hover:bg-muted/30">
                          <td className="p-2.5 font-medium">{i.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold">{i.total_qty} كجم</td>
                          <td className="p-2.5 text-left font-mono font-bold text-emerald-600">{fmt(i.total_cost)} ريال</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              2. PURCHASE REQUESTS (طلبات الشراء)
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> قائمة طلبات الشراء المرفوعة
              </h2>
              <Button onClick={() => setIsPROpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> طلب شراء جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-right font-semibold">رقم الطلب</th>
                    <th className="p-3 text-right font-semibold">طالب الشراء</th>
                    <th className="p-3 text-right font-semibold">الإدارة / الفرع</th>
                    <th className="p-3 text-right font-semibold">التاريخ</th>
                    <th className="p-3 text-center font-semibold">الأولويات</th>
                    <th className="p-3 text-center font-semibold">الحالة</th>
                    <th className="p-3 text-left font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((pr: any) => (
                    <tr key={pr.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{pr.pr_number}</td>
                      <td className="p-3 font-medium">{pr.requester_name}</td>
                      <td className="p-3 text-muted-foreground">{pr.department} - {pr.branch_name || "الفرع الرئيسي"}</td>
                      <td className="p-3 text-muted-foreground font-mono">{pr.request_date}</td>
                      <td className="p-3 text-center">
                        <Badge variant={pr.priority === "عاجل جداً" ? "destructive" : pr.priority === "عالي" ? "outline" : "secondary"}>
                          {pr.priority}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={
                          pr.status === "approved" ? "bg-emerald-600" :
                          pr.status === "converted_to_po" ? "bg-blue-600" :
                          pr.status === "rejected" ? "bg-rose-600" : "bg-amber-500"
                        }>
                          {pr.status === "pending_approval" ? "قيد المراجعة" :
                           pr.status === "approved" ? "معتمد" :
                           pr.status === "converted_to_po" ? "تم تحويله لأمر شراء" :
                           pr.status === "rejected" ? "مرفوض" : pr.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {pr.status === "pending_approval" && (
                            <>
                              <Button size="sm" variant="outline" className="text-emerald-600 hover:bg-emerald-50 h-7 text-xs px-2" onClick={() => updatePRStatus.mutate({ id: pr.id, status: "approved" })}>
                                <Check className="w-3.5 h-3.5" /> اعتماد
                              </Button>
                              <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50 h-7 text-xs px-2" onClick={() => updatePRStatus.mutate({ id: pr.id, status: "rejected" })}>
                                <XCircle className="w-3.5 h-3.5" /> رفض
                              </Button>
                            </>
                          )}
                          {renderDocActions("طلب شراء داخلي (PR)", pr)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد طلبات شراء مسجلة حالياً.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              3. QUOTATIONS & RFQS
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="rfqs" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" /> عروض أسعار الموردين والمقارنة
              </h2>
              <Button onClick={() => setIsRFQOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> إضافة عرض سعر
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rfqs.map((q: any) => (
                <Card key={q.id} className={`shadow-sm ${q.status === 'accepted' ? 'border-emerald-500 bg-emerald-500/5' : ''}`}>
                  <CardHeader className="p-4 pb-2 border-b">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono">{q.rfq_number}</Badge>
                      <Badge className={q.status === 'accepted' ? 'bg-emerald-600' : 'bg-muted text-foreground'}>
                        {q.status === 'accepted' ? 'مقبول ومُعتمَد' : 'قيد الدراسة'}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{q.item_name}</CardTitle>
                    <CardDescription className="text-xs font-semibold text-primary">{q.supplier_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">سعر الوحدة:</span>
                      <span className="font-mono font-bold text-sm text-primary">{fmt(q.unit_price)} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مدة التوريد:</span>
                      <span className="font-medium">{q.lead_time_days} أيام</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تقييم الجودة:</span>
                      <span className="flex items-center gap-1 font-bold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-500" /> {q.quality_rating} / 5
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2 font-bold text-sm">
                      <span>إجمالي العرض:</span>
                      <span className="font-mono">{fmt(q.total_price)} ريال</span>
                    </div>
                    {q.status !== 'accepted' && (
                      <Button size="sm" onClick={() => acceptRFQ.mutate(q.id)} className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                        <Check className="w-3.5 h-3.5" /> قبول واختيار هذا العرض
                      </Button>
                    )}
                    <div className="pt-2 border-t flex justify-end">
                      {renderDocActions("عرض سعر مورد (RFQ)", q)}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {rfqs.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground bg-card rounded-xl border">
                  لا توجد عروض أسعار مسجلة للمقارنة.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              4. PURCHASE ORDERS (أوامر الشراء)
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> أوامر الشراء ونظام الموافقات
              </h2>
              <Button onClick={() => setIsPOOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> أمر شراء جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-right font-semibold">رقم أمر الشراء</th>
                    <th className="p-3 text-right font-semibold">المورد</th>
                    <th className="p-3 text-right font-semibold">تاريخ الأمر</th>
                    <th className="p-3 text-right font-semibold">مستوى الصلاحية</th>
                    <th className="p-3 text-right font-semibold">الإجمالي</th>
                    <th className="p-3 text-center font-semibold">حالة الأمر</th>
                    <th className="p-3 text-left font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((po: any) => (
                    <tr key={po.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{po.po_number}</td>
                      <td className="p-3 font-medium">{po.supplier_name || "مورد عام"}</td>
                      <td className="p-3 text-muted-foreground font-mono">{po.order_date || po.created_at?.slice(0, 10)}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {po.approval_tier === "executive" ? "إدارة عليا (>2,000,000)" :
                           po.approval_tier === "system" ? "مدير النظام (500k-2M)" : "مدير الفرع (<500k)"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono font-bold text-sm">{fmt(po.total)} ريال</td>
                      <td className="p-3 text-center">
                        <Badge className={
                          po.status === "received" ? "bg-emerald-600" :
                          po.status === "partially_received" ? "bg-blue-600" :
                          po.status === "approved" ? "bg-indigo-600" :
                          po.status === "pending_approval" ? "bg-amber-500" : "bg-muted"
                        }>
                          {po.status === "pending_approval" ? "بانتظار موافقة الإدارة" :
                           po.status === "approved" ? "معتمد جاهز للتوريد" :
                           po.status === "partially_received" ? "مستلم جزئياً" :
                           po.status === "received" ? "مكتمل الاستلام" : po.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {po.status === "pending_approval" && (
                            <Button size="sm" variant="outline" className="text-emerald-600 hover:bg-emerald-50 h-7 text-xs px-2" onClick={() => approvePO.mutate({ id: po.id, status: "approved" })}>
                              <Check className="w-3.5 h-3.5" /> اعتماد الأمر
                            </Button>
                          )}
                          {renderDocActions("أمر شراء موثق (PO)", po)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد أوامر شراء قائمة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              5. GOODS RECEIPT (GRN) & QUALITY INSPECTION
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="grn" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> استلام المشتريات وفحص الجودة (GRN)
              </h2>
              <Button onClick={() => setIsGRNOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> سند استلام جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-right font-semibold">رقم سند الاستلام</th>
                    <th className="p-3 text-right font-semibold">أمر الشراء المرتبط</th>
                    <th className="p-3 text-right font-semibold">المورد</th>
                    <th className="p-3 text-right font-semibold">تاريخ الاستلام</th>
                    <th className="p-3 text-right font-semibold">مستلم الشحنة</th>
                    <th className="p-3 text-center font-semibold">فحص الجودة</th>
                    <th className="p-3 text-left font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grns.map((g: any) => (
                    <tr key={g.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{g.grn_number}</td>
                      <td className="p-3 font-mono text-muted-foreground">{g.po_number || "استلام مباشر"}</td>
                      <td className="p-3 font-medium">{g.supplier_name}</td>
                      <td className="p-3 text-muted-foreground font-mono">{g.received_date}</td>
                      <td className="p-3">{g.received_by}</td>
                      <td className="p-3 text-center">
                        <Badge variant={g.qc_passed ? "default" : "destructive"}>
                          {g.qc_passed ? "مطابق للمواصفات ✅" : "يوجد ملاحظات/مرفوضات ⚠️"}
                        </Badge>
                      </td>
                      <td className="p-3 text-left">
                        {renderDocActions("محضر استلام بضاعة وفحص جودة (GRN)", g)}
                      </td>
                    </tr>
                  ))}
                  {grns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد أسناد استلام مسجلة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              6. PURCHASE INVOICES
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" /> فواتير المشتريات والربط المخزني والمحاسبي
              </h2>
              <Button onClick={() => setIsInvoiceOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> فاتورة شراء جديدة
              </Button>
            </div>

            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-right font-semibold">رقم الفاتورة</th>
                    <th className="p-3 text-right font-semibold">رقم فاتورة المورد</th>
                    <th className="p-3 text-right font-semibold">المورد</th>
                    <th className="p-3 text-right font-semibold">تاريخ الفاتورة</th>
                    <th className="p-3 text-right font-semibold">تاريخ الاستحقاق</th>
                    <th className="p-3 text-right font-semibold">الإجمالي</th>
                    <th className="p-3 text-right font-semibold">المتبقي</th>
                    <th className="p-3 text-center font-semibold">الحالة</th>
                    <th className="p-3 text-left font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-primary">{inv.invoice_number}</td>
                      <td className="p-3 font-mono text-muted-foreground">{inv.supplier_invoice_ref || "—"}</td>
                      <td className="p-3 font-medium">{inv.supplier_name}</td>
                      <td className="p-3 text-muted-foreground font-mono">{inv.invoice_date}</td>
                      <td className="p-3 text-muted-foreground font-mono">{inv.due_date}</td>
                      <td className="p-3 font-mono font-bold text-sm">{fmt(inv.total)} ريال</td>
                      <td className="p-3 font-mono font-bold text-destructive">{fmt(inv.remaining_amount)} ريال</td>
                      <td className="p-3 text-center">
                        <Badge className={
                          inv.payment_status === "paid" ? "bg-emerald-600" :
                          inv.payment_status === "partially_paid" ? "bg-amber-500" : "bg-rose-600"
                        }>
                          {inv.payment_status === "paid" ? "مسدد بالكامل" :
                           inv.payment_status === "partially_paid" ? "مسدد جزئياً" : "غير مسدد (آجل)"}
                        </Badge>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {Number(inv.remaining_amount) > 0 && inv.supplier_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold"
                              onClick={() => {
                                setPayForm({
                                  supplier_id: String(inv.supplier_id),
                                  invoice_id: String(inv.id),
                                  amount: Number(inv.remaining_amount),
                                  payment_date: new Date().toISOString().slice(0, 10),
                                  payment_method: "cash",
                                  check_number: "",
                                  bank_name: "",
                                  reference_number: inv.invoice_number,
                                  notes: `سداد فاتورة مشتريات رقم ${inv.invoice_number}`
                                });
                                setIsPaymentOpen(true);
                              }}
                            >
                              <Wallet className="w-3.5 h-3.5" /> سداد
                            </Button>
                          )}
                          {renderDocActions("فاتورة شراء موثقة", inv)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">لا توجد فواتير شراء مسجلة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              7. SUPPLIERS DIRECTORY & LEDGER
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> دليل الموردين والذمم الدائنة
                </h2>
                <p className="text-xs text-muted-foreground">إدارة سجلات الموردين، بيانات التواصل والضريبة، وشروط السداد، ومتابعة الأرصدة المستحقة.</p>
              </div>
              <Button onClick={() => {
                setEditingSupplier(null);
                setSupForm({
                  name: "",
                  contact_person: "",
                  phone: "",
                  mobile_number: "",
                  email: "",
                  tax_number: "",
                  commercial_register: "",
                  address: "",
                  payment_terms: "30 يوم",
                  bank_name: "",
                  bank_account: "",
                  notes: "",
                  rating: 5,
                  balance: 0
                });
                setIsSupplierOpen(true);
              }} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> إضافة مورد جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-right font-semibold">اسم المورد / الشركة</th>
                    <th className="p-3 text-right font-semibold">حساب الدليل المحاسبي</th>
                    <th className="p-3 text-right font-semibold">بيانات التواصل</th>
                    <th className="p-3 text-right font-semibold">الرقم الضريبي / السجل</th>
                    <th className="p-3 text-right font-semibold">العنوان</th>
                    <th className="p-3 text-right font-semibold">شروط الدفع</th>
                    <th className="p-3 text-right font-semibold">المديونية المستحقة</th>
                    <th className="p-3 text-left font-semibold">الإجراءات وكشف الحساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map((s: any, idx: number) => (
                    <tr key={`sup-row-${s.id || idx}-${idx}`} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-bold text-sm text-foreground">{s.name}</div>
                        {s.contact_person && <div className="text-[11px] text-muted-foreground">مسؤول: {s.contact_person}</div>}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-xs bg-amber-50 text-amber-900 border-amber-300 font-bold">
                          {s.account_code || `211${String(s.id).padStart(2, "0")}`}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">ذمم الموردين (21100)</div>
                      </td>
                      <td className="p-3">
                        {s.mobile_number && (
                          <div className="font-mono text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <span>📱 {s.mobile_number}</span>
                          </div>
                        )}
                        {s.phone && s.phone !== s.mobile_number && <div className="font-mono text-xs text-muted-foreground">☎️ {s.phone}</div>}
                        {s.email && <div className="text-[11px] text-muted-foreground">{s.email}</div>}
                        {!s.mobile_number && !s.phone && !s.email && <div className="text-xs text-muted-foreground">—</div>}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs">{s.tax_number || "—"}</div>
                        {s.commercial_register && <div className="text-[11px] text-muted-foreground font-mono">س.ت: {s.commercial_register}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{s.address || "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {s.payment_terms || "30 يوم"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono font-bold text-sm">
                        <span className={Number(s.balance) > 0 ? "text-destructive font-black" : "text-emerald-600"}>
                          {fmt(s.balance)} ريال
                        </span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary hover:bg-primary/10" title="تعديل بيانات المورد" onClick={() => {
                            setEditingSupplier(s);
                            setSupForm({
                              name: s.name || "",
                              contact_person: s.contact_person || "",
                              phone: s.phone || "",
                              mobile_number: s.mobile_number || "",
                              email: s.email || "",
                              tax_number: s.tax_number || "",
                              commercial_register: s.commercial_register || "",
                              address: s.address || "",
                              payment_terms: s.payment_terms || "30 يوم",
                              bank_name: s.bank_name || "",
                              bank_account: s.bank_account || "",
                              notes: s.notes || "",
                              rating: s.rating ?? 5,
                              balance: s.balance ?? 0
                            });
                            setIsSupplierOpen(true);
                          }}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> تعديل
                          </Button>
                          {renderDocActions(`كشف حساب مورد - ${s.name}`, { supplier: s, invoices: invoices.filter((i: any) => i.supplier_id === s.id) })}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" title="حذف المورد" onClick={() => {
                            if (window.confirm(`هل أنت متأكد من رغبتك في حذف المورد "${s.name}"؟`)) {
                              deleteSupplier.mutate(s.id);
                            }
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">لا يوجد موردين مسجلين حالياً. اضغط على زر "إضافة مورد جديد" لإضافة مورد.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              8. PAYMENTS & RETURNS
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="payments_returns" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Payments Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" /> سداد دفعات الموردين
                  </h3>
                  <Button size="sm" onClick={() => setIsPaymentOpen(true)} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> تسجيل دفعة
                  </Button>
                </div>
                <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-2.5 text-right font-semibold">رقم السند</th>
                        <th className="p-2.5 text-right font-semibold">المورد</th>
                        <th className="p-2.5 text-right font-semibold">التاريخ</th>
                        <th className="p-2.5 text-right font-semibold">المبلغ</th>
                        <th className="p-2.5 text-center font-semibold">الطريقة</th>
                        <th className="p-2.5 text-left font-semibold">المعاينة والطباعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="p-2.5 font-mono font-bold text-emerald-600">{p.payment_number}</td>
                          <td className="p-2.5 font-medium">{p.supplier_name}</td>
                          <td className="p-2.5 text-muted-foreground font-mono">{p.payment_date}</td>
                          <td className="p-2.5 font-mono font-bold">{fmt(p.amount)} ريال</td>
                          <td className="p-2.5 text-center">
                            <Badge variant="outline">{p.payment_method}</Badge>
                          </td>
                          <td className="p-2.5 text-left">
                            {renderDocActions(`سند صرف مورد ${p.payment_number}`, p)}
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد دفعات مسجلة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Returns Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-600" /> مرتجعات المشتريات
                  </h3>
                  <Button size="sm" variant="destructive" onClick={() => setIsReturnOpen(true)} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> إنشاء مرتجع
                  </Button>
                </div>
                <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-2.5 text-right font-semibold">رقم المرتجع</th>
                        <th className="p-2.5 text-right font-semibold">المورد</th>
                        <th className="p-2.5 text-right font-semibold">التاريخ</th>
                        <th className="p-2.5 text-right font-semibold">الإجمالي</th>
                        <th className="p-2.5 text-center font-semibold">الحالة</th>
                        <th className="p-2.5 text-left font-semibold">المعاينة والطباعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {returns.map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="p-2.5 font-mono font-bold text-rose-600">{r.return_number}</td>
                          <td className="p-2.5 font-medium">{r.supplier_name}</td>
                          <td className="p-2.5 text-muted-foreground font-mono">{r.return_date || r.created_at?.slice(0, 10)}</td>
                          <td className="p-2.5 font-mono font-bold">{fmt(r.total_amount)} ريال</td>
                          <td className="p-2.5 text-center">
                            <Badge className="bg-emerald-600">تم الخصم والمقابلة</Badge>
                          </td>
                          <td className="p-2.5 text-left">
                            {renderDocActions(`إشعار خصم ومرتجع مشتريات ${r.return_number}`, r)}
                          </td>
                        </tr>
                      ))}
                      {returns.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد مرتجعات مسجلة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              9. CONTRACTS & PRICE ANALYTICS
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="contracts_analytics" className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> عقود التوريد وتحليل حركة وتقلبات الأسعار
              </h2>
              <Button onClick={() => setIsContractOpen(true)} className="gap-1.5 shadow-sm">
                <Plus className="w-4 h-4" /> إضافة عقد توريد
              </Button>
            </div>

            {/* Contracts List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contracts.map((c: any) => (
                <Card key={c.id}>
                  <CardHeader className="p-4 pb-2 border-b">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="font-mono">{c.contract_number}</Badge>
                      <Badge className="bg-emerald-600">ساري</Badge>
                    </div>
                    <CardTitle className="text-base mt-2">{c.title}</CardTitle>
                    <CardDescription className="text-xs font-semibold text-primary">{c.supplier_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ البداية:</span>
                      <span className="font-mono">{c.start_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                      <span className="font-mono font-bold text-amber-600">{c.end_date}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-sm">
                      <span>قيمة التوريد:</span>
                      <span className="font-mono">{fmt(c.agreed_amount)} ريال</span>
                    </div>
                    <div className="pt-2 border-t flex justify-end">
                      {renderDocActions(`عقد اتفاقية توريد ${c.contract_number}`, c)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Price Trend History Table */}
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> تاريخ تغير أسعار الشراء للأصناف الموردة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="p-3 text-right font-semibold">الصنف</th>
                      <th className="p-3 text-right font-semibold">آخر مورد</th>
                      <th className="p-3 text-center font-semibold">السعر السابق</th>
                      <th className="p-3 text-center font-semibold">السعر الحالي</th>
                      <th className="p-3 text-center font-semibold">مقدار التغير</th>
                      <th className="p-3 text-center font-semibold">مؤشر التضخم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {priceTrends.map((pt: any) => (
                      <tr key={pt.product_id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold">{pt.product_name}</td>
                        <td className="p-3 text-muted-foreground">{pt.latest_supplier || "عام"}</td>
                        <td className="p-3 text-center font-mono">{fmt(pt.previous_price)} ريال</td>
                        <td className="p-3 text-center font-mono font-bold text-primary">{fmt(pt.current_price)} ريال</td>
                        <td className="p-3 text-center font-mono">{fmt(pt.price_diff)} ريال</td>
                        <td className="p-3 text-center">
                          <Badge variant={pt.is_surge ? "destructive" : "secondary"}>
                            {pt.percentage_change}% {pt.is_surge ? "ارتفاع ملحوظ ⚠️" : "مستقر"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────────────────────────────────────────────────────
              10. PROCUREMENT REPORTS
          ───────────────────────────────────────────────────────────── */}
          <TabsContent value="reports" className="space-y-4">
            {/* بطاقة التحكم والاختيارات والفلترة */}
            <div className="bg-card p-5 rounded-xl border space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2 text-slate-800">
                    <BarChart3 className="w-5 h-5 text-blue-600" /> التقارير الشاملة لدورة المشتريات والموردين (12 تقرير متقدم)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">اختر نوع التقرير وقم بتصفية النتائج بشكل حي ومباشر.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                    <SelectTrigger className="w-[280px] text-xs font-bold border-blue-100 bg-blue-50/20 text-slate-700">
                      <SelectValue placeholder="اختر نوع التقرير..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="daily">📅 1. تقرير المشتريات اليومية</SelectItem>
                      <SelectItem value="by_period">⏱️ 2. تقرير المشتريات حسب الفترة</SelectItem>
                      <SelectItem value="by_supplier">🤝 3. تقرير المشتريات حسب المورد</SelectItem>
                      <SelectItem value="by_item">📦 4. تقرير المشتريات حسب الصنف والتكلفة</SelectItem>
                      <SelectItem value="by_branch">🏢 5. تقرير المشتريات حسب الفرع</SelectItem>
                      <SelectItem value="credit">💳 6. تقرير المشتريات الآجلة (المستحقة)</SelectItem>
                      <SelectItem value="payables">💰 7. تقرير المبالغ المستحقة للموردين</SelectItem>
                      <SelectItem value="supplier_statement">📑 8. تقرير كشف حساب وحركة المورد التفصيلي</SelectItem>
                      <SelectItem value="price_analysis">📊 9. تقرير تحليل أسعار الشراء وتغير التكاليف</SelectItem>
                      <SelectItem value="most_purchased">🔥 10. تقرير الأصناف الأكثر شراءً وحجماً</SelectItem>
                      <SelectItem value="debt_aging">⏳ 11. تقرير أعمار الديون للموردين (Aging)</SelectItem>
                      <SelectItem value="general">🧾 12. تقرير حركة الفواتير الإجمالي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs gap-1"
                    onClick={() => {
                      const title = `تقرير المشتريات والموردين - ${selectedReportType}`;
                      previewDocument(title, { "نوع التقرير": selectedReportType, "من تاريخ": reportFromDate, "إلى تاريخ": reportToDate, items: reportData });
                    }}
                  >
                    <Maximize2 className="w-4 h-4" /> معاينة بشاشة كاملة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs gap-1"
                    onClick={() => {
                      const title = `تقرير المشتريات والموردين - ${selectedReportType}`;
                      exportPdfDocument(title, { "نوع التقرير": selectedReportType, "من تاريخ": reportFromDate, "إلى تاريخ": reportToDate, items: reportData });
                    }}
                  >
                    <FileDown className="w-4 h-4" /> توليد ملف PDF
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1" onClick={() => {
                    const title = `تقرير المشتريات والموردين - ${selectedReportType}`;
                    printDocument(title, { "نوع التقرير": selectedReportType, "من تاريخ": reportFromDate, "إلى تاريخ": reportToDate, items: reportData });
                  }}>
                    <Printer className="w-4 h-4" /> طباعة هذا التقرير (A4)
                  </Button>
                </div>
              </div>

              {/* فلاتر ديناميكية بناءً على التقرير */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t text-xs">
                {["by_period", "general", "daily", "by_supplier", "by_item", "credit", "most_purchased"].includes(selectedReportType) && (
                  <>
                    <div>
                      <label className="font-semibold block text-slate-600 mb-1">تاريخ البدء</label>
                      <Input type="date" value={reportFromDate} onChange={e => setReportFromDate(e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="font-semibold block text-slate-600 mb-1">تاريخ الانتهاء</label>
                      <Input type="date" value={reportToDate} onChange={e => setReportToDate(e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                  </>
                )}

                {selectedReportType === "supplier_statement" && (
                  <div>
                    <label className="font-semibold block text-slate-600 mb-1">اختر المورد المراد كشف حسابه</label>
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={reportSupplierId}
                      onChange={e => setReportSupplierId(e.target.value)}
                    >
                      <option value="">-- اختر مورد --</option>
                      {suppliers.map((s: any, idx: number) => (
                        <option key={`rep-sup-${s.id || idx}-${idx}`} value={s.id}>{s.name} (الرصيد الحالي: {s.balance} ر.س)</option>
                      ))}
                    </select>
                  </div>
                )}

                {["by_branch"].includes(selectedReportType) && (
                  <div>
                    <label className="font-semibold block text-slate-600 mb-1">الفرع</label>
                    <select
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={reportBranchId}
                      onChange={e => setReportBranchId(e.target.value)}
                    >
                      <option value="">جميع الفروع</option>
                      <option value="1">الفرع الرئيسي</option>
                      <option value="2">فرع العليا</option>
                      <option value="3">فرع الروضة</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* عرض نتائج التقارير بشكل جدول منسق */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">عدد السجلات المعروضة: <strong>{reportData?.length || 0}</strong></span>
                <span className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">نمط التقرير: {selectedReportType}</span>
              </div>

              {(!reportData || reportData.length === 0) ? (
                <div className="text-center py-12 text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <p className="text-xs font-bold">لا تتوفر أي بيانات متطابقة للتقرير المحدد في هذه الفترة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  {selectedReportType === "daily" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">رقم الفاتورة</th>
                          <th className="p-3 font-bold">المورد</th>
                          <th className="p-3 font-bold">الفرع</th>
                          <th className="p-3 font-bold">التاريخ</th>
                          <th className="p-3 font-bold text-left">المبلغ الإجمالي</th>
                          <th className="p-3 font-bold text-left">المدفوع</th>
                          <th className="p-3 font-bold text-left">المتبقي الآجل</th>
                          <th className="p-3 font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-blue-600">{row.invoice_number}</td>
                            <td className="p-3 font-bold">{row.supplier_name}</td>
                            <td className="p-3">{row.branch_name || "الرئيسي"}</td>
                            <td className="p-3 font-mono">{row.invoice_date}</td>
                            <td className="p-3 text-left font-mono font-bold">{row.total?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.paid_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-rose-600 font-bold">{row.remaining_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3">
                              <Badge variant={row.payment_status === "paid" ? "default" : "destructive"}>
                                {row.payment_status === "paid" ? "مدفوعة" : "آجلة مستحقة"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "by_period" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">رقم الفاتورة</th>
                          <th className="p-3 font-bold">المورد</th>
                          <th className="p-3 font-bold">التاريخ</th>
                          <th className="p-3 font-bold text-left">الإجمالي الخاضع للضريبة</th>
                          <th className="p-3 font-bold text-left">المدفوع</th>
                          <th className="p-3 font-bold text-left">المتبقي الآجل</th>
                          <th className="p-3 font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-blue-600">{row.invoice_number}</td>
                            <td className="p-3 font-bold">{row.supplier_name}</td>
                            <td className="p-3 font-mono">{row.invoice_date}</td>
                            <td className="p-3 text-left font-mono font-bold">{row.total?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.paid_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-rose-600 font-bold">{row.remaining_amount?.toFixed(2)} ر.s</td>
                            <td className="p-3">
                              <Badge variant={row.payment_status === "paid" ? "default" : "destructive"}>
                                {row.payment_status === "paid" ? "مدفوعة كاملة" : "آجل مستحق"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "by_supplier" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">اسم المورد</th>
                          <th className="p-3 font-bold">رقم الجوال</th>
                          <th className="p-3 text-center">عدد الفواتير المستلمة</th>
                          <th className="p-3 text-left font-bold">إجمالي قيمة المشتريات</th>
                          <th className="p-3 text-left">إجمالي المبالغ المسددة</th>
                          <th className="p-3 text-left font-bold text-rose-600">رصيد المديونية المستحق</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{row.name}</td>
                            <td className="p-3 font-mono">{row.phone || "بدون جوال"}</td>
                            <td className="p-3 text-center font-bold font-mono">{row.invoice_count}</td>
                            <td className="p-3 text-left font-mono font-bold text-slate-700">{row.total_purchases?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.total_paid?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-rose-600 font-bold bg-rose-50/50">{row.balance?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "by_item" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">اسم الصنف / الصنف المشتري</th>
                          <th className="p-3 text-center">إجمالي الكمية المشتراة</th>
                          <th className="p-3 text-left">متوسط سعر الشراء</th>
                          <th className="p-3 text-left">أدنى سعر شراء</th>
                          <th className="p-3 text-left">أعلى سعر شراء</th>
                          <th className="p-3 text-left font-bold">إجمالي تكاليف الشراء الكلية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-emerald-800">{row.item_name}</td>
                            <td className="p-3 text-center font-bold font-mono text-blue-600">{row.total_qty}</td>
                            <td className="p-3 text-left font-mono">{row.avg_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-slate-500">{row.min_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-slate-700">{row.max_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono font-bold text-indigo-700 bg-indigo-50/10">{row.total_cost?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "by_branch" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">اسم الفرع المستودعي</th>
                          <th className="p-3 text-center">عدد فواتير الشراء</th>
                          <th className="p-3 text-left font-bold">إجمالي مشتريات الفرع</th>
                          <th className="p-3 text-left">إجمالي المبالغ المسددة</th>
                          <th className="p-3 text-left font-bold text-rose-600">الذمم الآجلة الحالية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{row.branch_name || "الفرع الرئيسي"}</td>
                            <td className="p-3 text-center font-bold font-mono">{row.invoice_count}</td>
                            <td className="p-3 text-left font-mono font-bold text-slate-800">{row.total_purchases?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.total_paid?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-rose-600 font-bold bg-rose-50/20">{row.total_remaining?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "credit" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">رقم الفاتورة الآجلة</th>
                          <th className="p-3 font-bold">المورد الدائن</th>
                          <th className="p-3 font-bold">التاريخ والمدة الزمنية</th>
                          <th className="p-3 font-bold text-left">مبلغ الفاتورة</th>
                          <th className="p-3 font-bold text-left">المبلغ المسدد</th>
                          <th className="p-3 font-bold text-left text-rose-600">الذمم المستحقة الحالية</th>
                          <th className="p-3 font-bold">الحالة المالية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-rose-600">{row.invoice_number}</td>
                            <td className="p-3 font-bold text-slate-800">{row.supplier_name}</td>
                            <td className="p-3 font-mono">{row.invoice_date}</td>
                            <td className="p-3 text-left font-mono">{row.total?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.paid_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono font-bold text-rose-600 bg-rose-50/40">{row.remaining_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                <AlertTriangle className="w-3 h-3" /> غير مسددة بالكامل
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "payables" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">المورد</th>
                          <th className="p-3 font-bold">الجوال</th>
                          <th className="p-3 text-center">عدد الفواتير غير المسددة</th>
                          <th className="p-3 text-left font-bold text-rose-600">المبلغ المستحق للدفع ر.س</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{row.supplier_name}</td>
                            <td className="p-3 font-mono">{row.phone || "لا يوجد"}</td>
                            <td className="p-3 text-center font-bold font-mono text-red-600 bg-red-50/30">{row.unpaid_invoices_count}</td>
                            <td className="p-3 text-left font-mono font-bold text-rose-600 bg-rose-50 text-base">{row.total_due?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "supplier_statement" && (
                    <div>
                      <div className="p-3 mb-3 bg-blue-50/50 rounded-lg text-xs font-bold text-blue-800 flex justify-between">
                        <span>كشف حساب وحركة تفصيلية</span>
                        <span>يرجى اختيار المورد من الفلتر بالأعلى لاستعراض الحركة كاملة بالتتابع الزمني</span>
                      </div>
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b text-slate-600">
                            <th className="p-3 font-bold">نوع المستند</th>
                            <th className="p-3 font-bold">الرقم المرجعي</th>
                            <th className="p-3 font-bold">التاريخ والوقت</th>
                            <th className="p-3 text-left font-bold">مدين (+) مشتريات</th>
                            <th className="p-3 text-left font-bold">دائن (-) مدفوعات ومرتجع</th>
                            <th className="p-3 font-bold">الملاحظات والشرح بالدفتر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row: any, i: number) => (
                            <tr key={i} className="border-b hover:bg-slate-50/50">
                              <td className="p-3 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.type_name === "فاتورة شراء" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                                  row.type_name === "سند صرف دفعة" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  "bg-rose-50 text-rose-700 border border-rose-100"
                                }`}>
                                  {row.type_name}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700">{row.ref_no}</td>
                              <td className="p-3 font-mono">{row.date}</td>
                              <td className="p-3 text-left font-mono text-slate-900 font-bold">{row.debit > 0 ? `${row.debit?.toFixed(2)} ر.س` : "-"}</td>
                              <td className="p-3 text-left font-mono text-emerald-600 font-bold">{row.credit > 0 ? `${row.credit?.toFixed(2)} ر.س` : "-"}</td>
                              <td className="p-3 text-slate-600">{row.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedReportType === "price_analysis" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">الصنف</th>
                          <th className="p-3 text-left font-bold">سعر الشراء الافتراضي (التكلفة)</th>
                          <th className="p-3 text-left">متوسط سعر الشراء الفعلي</th>
                          <th className="p-3 text-left">أدنى سعر شراء تم</th>
                          <th className="p-3 text-left">أعلى سعر شراء تم</th>
                          <th className="p-3 text-center">مرات الشراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{row.item_name}</td>
                            <td className="p-3 text-left font-mono font-bold text-slate-700">{row.current_cost?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-blue-600">{row.average_purchase_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.minimum_purchase_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-red-600">{row.maximum_purchase_price?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-center font-bold font-mono">{row.purchases_count} مرات</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "most_purchased" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">اسم الصنف</th>
                          <th className="p-3 text-center font-bold">إجمالي كمية التوريد والشراء</th>
                          <th className="p-3 text-left font-bold text-blue-600">القيمة الإجمالية للمشتريات الكلية ر.س</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any, i: number) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">
                              <span className="inline-block w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-center text-[10px] leading-5 font-bold ml-2">
                                {i + 1}
                              </span>
                              {row.item_name}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-600 text-sm">{row.total_qty} وحدات</td>
                            <td className="p-3 text-left font-mono font-bold text-blue-700 text-sm">{row.total_cost?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "debt_aging" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">المورد</th>
                          <th className="p-3 text-left font-bold">الرصيد الإجمالي المستحق</th>
                          <th className="p-3 text-left font-bold text-emerald-600">خلال 30 يوم</th>
                          <th className="p-3 text-left font-bold text-amber-600">31 إلى 60 يوم</th>
                          <th className="p-3 text-left font-bold text-orange-600">61 إلى 90 يوم</th>
                          <th className="p-3 text-left font-bold text-red-600">أكثر من 90 يوم</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{row.supplier_name}</td>
                            <td className="p-3 text-left font-mono font-bold text-slate-900 bg-slate-50">{row.total_balance?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.age_0_30?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-amber-600">{row.age_31_60?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-orange-600">{row.age_61_90?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-red-600 font-bold bg-red-50/30">{row.age_above_90?.toFixed(2)} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedReportType === "general" && (
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-slate-600">
                          <th className="p-3 font-bold">رقم الفاتورة</th>
                          <th className="p-3 font-bold">المورد</th>
                          <th className="p-3 font-bold">التاريخ</th>
                          <th className="p-3 font-bold text-left">قيمة الفاتورة ر.س</th>
                          <th className="p-3 font-bold text-left">المدفوع ر.س</th>
                          <th className="p-3 font-bold text-left">الذمة المتبقية الآجلة ر.س</th>
                          <th className="p-3 font-bold">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((row: any) => (
                          <tr key={row.id} className="border-b hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-800">{row.invoice_number}</td>
                            <td className="p-3 font-bold">{row.supplier_name}</td>
                            <td className="p-3 font-mono">{row.invoice_date}</td>
                            <td className="p-3 text-left font-mono font-bold">{row.total?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-emerald-600">{row.paid_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3 text-left font-mono text-rose-600 font-bold bg-rose-50/20">{row.remaining_amount?.toFixed(2)} ر.س</td>
                            <td className="p-3">
                              <Badge variant={row.payment_status === "paid" ? "default" : "destructive"}>
                                {row.payment_status === "paid" ? "مدفوعة بالكامل" : "آجلة ومستحقة"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 1: CREATE PURCHASE REQUEST
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isPROpen} onOpenChange={setIsPROpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> إنشاء طلب شراء جديد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">طالب الشراء</label>
                  <Input value={prForm.requester_name} onChange={e => setPrForm({ ...prForm, requester_name: e.target.value })} placeholder="اسم الموظف / أمين المخزن" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">الإدارة / القسم</label>
                  <Input value={prForm.department} onChange={e => setPrForm({ ...prForm, department: e.target.value })} placeholder="المخازن / المطبخ" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">درجة الأهمية</label>
                  <Select value={prForm.priority} onValueChange={val => setPrForm({ ...prForm, priority: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="عادي">عادي</SelectItem>
                      <SelectItem value="عالي">عالي</SelectItem>
                      <SelectItem value="عاجل جداً">عاجل جداً</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">مبررات وسبب الشراء</label>
                <Textarea value={prForm.reason} onChange={e => setPrForm({ ...prForm, reason: e.target.value })} placeholder="اذكر السبب التنفيذي للشراء..." rows={2} />
              </div>

              {/* Items List Table */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">الأصناف المطلوبة</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setPrForm({ ...prForm, items: [...prForm.items, { product_id: "", product_name: "", unit: "كجم", requested_qty: 1, notes: "" }] })}>
                    + إضافة صنف
                  </Button>
                </div>
                {prForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={it.product_id} onValueChange={val => {
                        const prod = products.find((p: any) => String(p.id) === val);
                        const updated = [...prForm.items];
                        updated[idx].product_id = val;
                        updated[idx].product_name = prod?.name || "";
                        setPrForm({ ...prForm, items: updated });
                      }}>
                        <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="1" value={it.requested_qty} onChange={e => {
                        const updated = [...prForm.items];
                        updated[idx].requested_qty = Number(e.target.value);
                        setPrForm({ ...prForm, items: updated });
                      }} placeholder="الكمية" />
                    </div>
                    <div className="col-span-3">
                      <Input value={it.unit} onChange={e => {
                        const updated = [...prForm.items];
                        updated[idx].unit = e.target.value;
                        setPrForm({ ...prForm, items: updated });
                      }} placeholder="الوحدة" />
                    </div>
                    <div className="col-span-1 text-center">
                      <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => {
                        const updated = prForm.items.filter((_, i) => i !== idx);
                        setPrForm({ ...prForm, items: updated });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                const validItems = prForm.items.filter(it => it.product_id || it.product_name.trim());
                if (validItems.length === 0) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى تحديد صنف واحد على الأقل لطلب الشراء" });
                  return;
                }
                createPR.mutate({ ...prForm, items: validItems });
              }} disabled={createPR.isPending}>
                حفظ وإرسال للاعتماد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 1.5: CREATE / ADD RFQ QUOTATION (عروض الأسعار)
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isRFQOpen} onOpenChange={setIsRFQOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" /> تسجيل عرض سعر جديد للمقارنة
              </DialogTitle>
              <DialogDescription className="text-xs">
                تسجيل ومقارنة عروض أسعار الموردين المختلفة لاختيار العرض الأنسب من حيث السعر والجودة.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">طلب الشراء المرتبط (اختياري)</label>
                  <Select value={rfqForm.pr_id} onValueChange={val => {
                    const pr = requests.find((r: any) => String(r.id) === val);
                    const firstItem = pr?.items?.[0];
                    setRfqForm({
                      ...rfqForm,
                      pr_id: val,
                      item_name: firstItem?.product_name || rfqForm.item_name,
                      quantity: firstItem?.requested_qty || rfqForm.quantity,
                      unit: firstItem?.unit || rfqForm.unit
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر طلب الشراء إن وجد" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون طلب شراء مباشر</SelectItem>
                      {requests.map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.pr_number} - {r.requester_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">الصنف المطلوب *</label>
                  <div className="flex gap-2">
                    <Select onValueChange={val => {
                      const prod = products.find((p: any) => String(p.id) === val);
                      if (prod) setRfqForm({ ...rfqForm, item_name: prod.name });
                    }}>
                      <SelectTrigger className="w-1/2"><SelectValue placeholder="من القائمة" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="w-1/2" value={rfqForm.item_name} onChange={e => setRfqForm({ ...rfqForm, item_name: e.target.value })} placeholder="أو اكتب اسم الصنف" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">المورد *</label>
                  <Select value={rfqForm.supplier_id} onValueChange={val => {
                    const sup = suppliers.find((s: any) => String(s.id) === val);
                    setRfqForm({ ...rfqForm, supplier_id: val, supplier_name: sup?.name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any, idx: number) => (
                        <SelectItem key={`rfq-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">الكمية</label>
                  <Input type="number" min="0.1" step="any" value={rfqForm.quantity} onChange={e => setRfqForm({ ...rfqForm, quantity: Number(e.target.value) })} placeholder="الكمية" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">الوحدة</label>
                  <Select value={rfqForm.unit} onValueChange={val => setRfqForm({ ...rfqForm, unit: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="كجم">كجم</SelectItem>
                      <SelectItem value="حبة">حبة</SelectItem>
                      <SelectItem value="كرتون">كرتون</SelectItem>
                      <SelectItem value="لتر">لتر</SelectItem>
                      <SelectItem value="متر">متر</SelectItem>
                      <SelectItem value="علبة">علبة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">سعر الوحدة بالريال *</label>
                  <Input type="number" min="0" step="any" value={rfqForm.unit_price} onChange={e => setRfqForm({ ...rfqForm, unit_price: Number(e.target.value) })} placeholder="سعر الوحدة" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">مدة التوريد (أيام)</label>
                  <Input type="number" min="1" value={rfqForm.lead_time_days} onChange={e => setRfqForm({ ...rfqForm, lead_time_days: Number(e.target.value) })} placeholder="أيام" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">شروط الدفع</label>
                  <Input value={rfqForm.payment_terms} onChange={e => setRfqForm({ ...rfqForm, payment_terms: e.target.value })} placeholder="مثال: نقداً، 30 يوم" />
                </div>
              </div>

              {/* Total Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center">
                <span className="font-semibold text-primary">إجمالي قيمة عرض السعر:</span>
                <span className="font-mono font-black text-base text-primary">
                  {fmt((rfqForm.quantity || 1) * (rfqForm.unit_price || 0))} ريال
                </span>
              </div>

              <div>
                <label className="font-semibold block mb-1">ملاحظات وشروط إضافية</label>
                <Textarea value={rfqForm.notes} onChange={e => setRfqForm({ ...rfqForm, notes: e.target.value })} placeholder="ملاحظات حول الضمان، جودة الصنف، مواعيد التسليم..." rows={2} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsRFQOpen(false)}>إلغاء</Button>
              <Button onClick={() => {
                if (!rfqForm.item_name.trim()) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى تحديد أو كتابة اسم الصنف" });
                  return;
                }
                if (!rfqForm.supplier_name.trim() && !rfqForm.supplier_id) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى اختيار المورد" });
                  return;
                }
                if (!rfqForm.unit_price || rfqForm.unit_price <= 0) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال سعر الوحدة" });
                  return;
                }
                createRFQ.mutate(rfqForm);
              }} disabled={createRFQ.isPending}>
                حفظ عرض السعر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 2: CREATE PURCHASE ORDER
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isPOOpen} onOpenChange={setIsPOOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" /> إنشاء أمر شراء جديد (PO)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">المورد</label>
                  <Select value={poForm.supplier_id} onValueChange={val => setPoForm({ ...poForm, supplier_id: val })}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any, idx: number) => (
                        <SelectItem key={`po-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">شروط الدفع والتسليم</label>
                  <Input value={poForm.payment_terms} onChange={e => setPoForm({ ...poForm, payment_terms: e.target.value })} placeholder="مثال: 30 يوم" />
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">أصناف أمر الشراء</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setPoForm({ ...poForm, items: [...poForm.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0 }] })}>
                    + إضافة صنف
                  </Button>
                </div>
                {poForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={it.product_id} onValueChange={val => {
                        const prod = products.find((p: any) => String(p.id) === val);
                        const updated = [...poForm.items];
                        updated[idx].product_id = val;
                        updated[idx].product_name = prod?.name || "";
                        updated[idx].unit_price = prod?.cost || 0;
                        setPoForm({ ...poForm, items: updated });
                      }}>
                        <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="1" value={it.quantity} onChange={e => {
                        const updated = [...poForm.items];
                        updated[idx].quantity = Number(e.target.value);
                        setPoForm({ ...poForm, items: updated });
                      }} placeholder="الكمية" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" value={it.unit_price} onChange={e => {
                        const updated = [...poForm.items];
                        updated[idx].unit_price = Number(e.target.value);
                        setPoForm({ ...poForm, items: updated });
                      }} placeholder="سعر الوحدة" />
                    </div>
                    <div className="col-span-1 text-center">
                      <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => {
                        const updated = poForm.items.filter((_, i) => i !== idx);
                        setPoForm({ ...poForm, items: updated });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                const validItems = poForm.items.filter(it => it.product_id || it.product_name.trim());
                if (validItems.length === 0) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى إضافة صنف واحد على الأقل لأمر الشراء" });
                  return;
                }
                createPO.mutate({ ...poForm, items: validItems });
              }} disabled={createPO.isPending}>
                اصدار أمر الشراء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 2.5: CREATE GRN & QUALITY INSPECTION (استلام المشتريات)
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isGRNOpen} onOpenChange={setIsGRNOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> سند استلام بضاعة وفحص الجودة (GRN)
              </DialogTitle>
              <DialogDescription className="text-xs">
                فحص ومطابقة الكميات المستلمة فعلياً من المورد مع أمر الشراء ومعايير الجودة ودرجة الحرارة.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">أمر الشراء المرتبط (اختياري)</label>
                  <Select value={grnForm.po_id} onValueChange={val => {
                    const po = orders.find((o: any) => String(o.id) === val);
                    const sup = suppliers.find((s: any) => s.id === po?.supplier_id);
                    const poItems = po?.items?.map((it: any) => ({
                      product_id: it.product_id ? String(it.product_id) : "",
                      product_name: it.product_name || "",
                      ordered_qty: it.quantity || 1,
                      received_qty: it.quantity || 1,
                      accepted_qty: it.quantity || 1,
                      rejected_qty: 0,
                      rejection_reason: "",
                      temperature: 4,
                      batch_number: "",
                      expiry_date: ""
                    })) || [{ product_id: "", product_name: "", ordered_qty: 1, received_qty: 1, accepted_qty: 1, rejected_qty: 0, rejection_reason: "", temperature: 4, batch_number: "", expiry_date: "" }];

                    setGrnForm({
                      ...grnForm,
                      po_id: val,
                      supplier_id: po?.supplier_id ? String(po.supplier_id) : grnForm.supplier_id,
                      supplier_name: sup?.name || po?.supplier_name || grnForm.supplier_name,
                      items: poItems
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر أمر الشراء" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">استلام مباشر بدون أمر شراء</SelectItem>
                      {orders.map((o: any) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.po_number} - {o.supplier_name || "مورد"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">المورد *</label>
                  <Select value={grnForm.supplier_id} onValueChange={val => {
                    const sup = suppliers.find((s: any) => String(s.id) === val);
                    setGrnForm({ ...grnForm, supplier_id: val, supplier_name: sup?.name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any, idx: number) => (
                        <SelectItem key={`grn-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم بوليصة / إشعار تسليم المورد</label>
                  <Input value={grnForm.delivery_note_ref} onChange={e => setGrnForm({ ...grnForm, delivery_note_ref: e.target.value })} placeholder="مثال: DN-98765" />
                </div>
              </div>

              {/* Items Inspection Section */}
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">أصناف الفحص والاستلام</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setGrnForm({
                    ...grnForm,
                    items: [...grnForm.items, { product_id: "", product_name: "", ordered_qty: 1, received_qty: 1, accepted_qty: 1, rejected_qty: 0, rejection_reason: "", temperature: 4, batch_number: "", expiry_date: "" }]
                  })}>
                    + إضافة صنف
                  </Button>
                </div>

                {grnForm.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-muted/40 rounded-lg space-y-2 border">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-primary">صنف #{idx + 1}</span>
                      {grnForm.items.length > 1 && (
                        <Button size="sm" variant="ghost" className="text-destructive h-6 px-2 text-xs" onClick={() => {
                          const updated = grnForm.items.filter((_, i) => i !== idx);
                          setGrnForm({ ...grnForm, items: updated });
                        }}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> حذف
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold block mb-0.5">الصنف</label>
                        <div className="flex gap-1">
                          <Select value={it.product_id} onValueChange={val => {
                            const prod = products.find((p: any) => String(p.id) === val);
                            const updated = [...grnForm.items];
                            updated[idx].product_id = val;
                            updated[idx].product_name = prod?.name || "";
                            setGrnForm({ ...grnForm, items: updated });
                          }}>
                            <SelectTrigger className="w-1/2"><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input className="w-1/2" value={it.product_name} onChange={e => {
                            const updated = [...grnForm.items];
                            updated[idx].product_name = e.target.value;
                            setGrnForm({ ...grnForm, items: updated });
                          }} placeholder="اسم الصنف" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5">الكمية المطلوبة</label>
                        <Input type="number" min="1" value={it.ordered_qty} onChange={e => {
                          const updated = [...grnForm.items];
                          updated[idx].ordered_qty = Number(e.target.value);
                          setGrnForm({ ...grnForm, items: updated });
                        }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5">الكمية المستلمة فعلياً</label>
                        <Input type="number" min="0" value={it.received_qty} onChange={e => {
                          const rec = Number(e.target.value);
                          const updated = [...grnForm.items];
                          updated[idx].received_qty = rec;
                          updated[idx].accepted_qty = Math.max(0, rec - (updated[idx].rejected_qty || 0));
                          setGrnForm({ ...grnForm, items: updated });
                        }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1 border-t border-muted">
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5 text-emerald-700">المقبول</label>
                        <Input type="number" min="0" value={it.accepted_qty} onChange={e => {
                          const acc = Number(e.target.value);
                          const updated = [...grnForm.items];
                          updated[idx].accepted_qty = acc;
                          updated[idx].rejected_qty = Math.max(0, (updated[idx].received_qty || 0) - acc);
                          setGrnForm({ ...grnForm, items: updated });
                        }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5 text-destructive">المرفوض</label>
                        <Input type="number" min="0" value={it.rejected_qty} onChange={e => {
                          const rej = Number(e.target.value);
                          const updated = [...grnForm.items];
                          updated[idx].rejected_qty = rej;
                          updated[idx].accepted_qty = Math.max(0, (updated[idx].received_qty || 0) - rej);
                          setGrnForm({ ...grnForm, items: updated });
                        }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5">الحرارة (°C)</label>
                        <Input type="number" step="0.5" value={it.temperature} onChange={e => {
                          const updated = [...grnForm.items];
                          updated[idx].temperature = Number(e.target.value);
                          setGrnForm({ ...grnForm, items: updated });
                        }} placeholder="°C" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5">رقم التشغيلة / الوجبة</label>
                        <Input value={it.batch_number} onChange={e => {
                          const updated = [...grnForm.items];
                          updated[idx].batch_number = e.target.value;
                          setGrnForm({ ...grnForm, items: updated });
                        }} placeholder="Batch #" />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5">تاريخ الصلاحية</label>
                        <Input type="date" value={it.expiry_date} onChange={e => {
                          const updated = [...grnForm.items];
                          updated[idx].expiry_date = e.target.value;
                          setGrnForm({ ...grnForm, items: updated });
                        }} />
                      </div>
                    </div>
                    {Number(it.rejected_qty) > 0 && (
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5 text-destructive">سبب الرفض</label>
                        <Input value={it.rejection_reason} onChange={e => {
                          const updated = [...grnForm.items];
                          updated[idx].rejection_reason = e.target.value;
                          setGrnForm({ ...grnForm, items: updated });
                        }} placeholder="مثال: تلف أثناء النقل، انتهاء صلاحية، عدم مطابقة للمواصفات..." />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="font-semibold block mb-1">ملاحظات المستلم والمستودع</label>
                <Textarea value={grnForm.notes} onChange={e => setGrnForm({ ...grnForm, notes: e.target.value })} placeholder="أي ملاحظات حول الشاحنة، السائق، التغليف..." rows={2} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsGRNOpen(false)}>إلغاء</Button>
              <Button onClick={() => {
                if (!grnForm.supplier_name.trim() && !grnForm.supplier_id) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى تحديد المورد" });
                  return;
                }
                const validItems = grnForm.items.filter(it => it.product_name.trim() || it.product_id);
                if (validItems.length === 0) {
                  toast({ variant: "destructive", title: "تنبيه", description: "يرجى إضافة صنف واحد على الأقل للفحص والاستلام" });
                  return;
                }
                createGRN.mutate({ ...grnForm, items: validItems });
              }} disabled={createGRN.isPending}>
                تأكيد الاستلام وفحص الجودة وتحديث المخزون
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 3: CREATE PURCHASE INVOICE
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" /> تسجيل فاتورة شراء جديدة (مرتبطة بالمخزون ودليل الحسابات)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">المورد *</label>
                  <Select value={invForm.supplier_id} onValueChange={val => {
                    const sup = suppliers.find((s: any) => String(s.id) === val);
                    setInvForm({ ...invForm, supplier_id: val, supplier_name: sup?.name || "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any, idx: number) => (
                        <SelectItem key={`inv-sup-${s.id || idx}-${idx}`} value={String(s.id)}>
                          {s.name} ({s.account_code || `211${String(s.id).padStart(2, "0")}`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم فاتورة المورد</label>
                  <Input value={invForm.supplier_invoice_ref} onChange={e => setInvForm({ ...invForm, supplier_invoice_ref: e.target.value })} placeholder="رقم فاتورة المورد الورقية" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">طريقة الدفع</label>
                  <Select value={invForm.payment_method} onValueChange={val => setInvForm({ ...invForm, payment_method: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">آجل (ذمم دائنة على حساب المورد)</SelectItem>
                      <SelectItem value="cash">نقداً من الصندوق الرئيسي (11100)</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي (11200)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">عناصر الفاتورة الموردة للمخازن</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setInvForm({ ...invForm, items: [...invForm.items, { product_id: "", product_name: "", unit: "كجم", quantity: 1, unit_price: 0 }] })}>
                    + إضافة صنف
                  </Button>
                </div>
                {invForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={it.product_id} onValueChange={val => {
                        const prod = products.find((p: any) => String(p.id) === val);
                        const updated = [...invForm.items];
                        updated[idx].product_id = val;
                        updated[idx].product_name = prod?.name || "";
                        updated[idx].unit_price = prod?.cost || 0;
                        setInvForm({ ...invForm, items: updated });
                      }}>
                        <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="1" value={it.quantity} onChange={e => {
                        const updated = [...invForm.items];
                        updated[idx].quantity = Number(e.target.value);
                        setInvForm({ ...invForm, items: updated });
                      }} placeholder="الكمية" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" value={it.unit_price} onChange={e => {
                        const updated = [...invForm.items];
                        updated[idx].unit_price = Number(e.target.value);
                        setInvForm({ ...invForm, items: updated });
                      }} placeholder="السعر" />
                    </div>
                    <div className="col-span-1 text-center">
                      <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => {
                        const updated = invForm.items.filter((_, i) => i !== idx);
                        setInvForm({ ...invForm, items: updated });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">الخصم المكتسب (ريال)</label>
                  <Input type="number" min="0" value={invForm.discount} onChange={e => setInvForm({ ...invForm, discount: Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">ضريبة القيمة المضافة (11500)</label>
                  <Input type="number" min="0" value={invForm.tax} onChange={e => setInvForm({ ...invForm, tax: Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div>
                  <label className="font-semibold block mb-1">المبلغ المدفوع فوراً</label>
                  <Input type="number" min="0" value={invForm.paid_amount} onChange={e => setInvForm({ ...invForm, paid_amount: Number(e.target.value) })} placeholder="0.00" />
                </div>
              </div>

              {/* Accounting Double-Entry Preview */}
              {(() => {
                const sub = invForm.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
                const netInv = Math.max(0, sub - (Number(invForm.discount) || 0));
                const vat = Number(invForm.tax) || 0;
                const tot = netInv + vat;
                const selSup = suppliers.find((s: any) => String(s.id) === String(invForm.supplier_id));
                const supCode = selSup?.account_code || (invForm.supplier_id ? `211${String(invForm.supplier_id).padStart(2, "0")}` : "21100");
                return (
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-3 border border-slate-700 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" /> القيد المحاسبي الآلي المزدوج في دفتر اليومية:
                      </span>
                      <span className="font-mono font-bold text-emerald-400">الإجمالي: {fmt(tot)} ريال</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>من حـ/ 11300 المخزون السلعي: <strong className="text-emerald-300">{fmt(netInv)}</strong> مدين</div>
                      {vat > 0 && <div>من حـ/ 11500 ضريبة المدخلات: <strong className="text-emerald-300">{fmt(vat)}</strong> مدين</div>}
                      <div>إلى حـ/ {supCode} ({selSup?.name || "حساب المورد"}): <strong className="text-amber-300">{fmt(tot)}</strong> دائن</div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <DialogFooter>
              <Button onClick={() => createInvoice.mutate(invForm)} disabled={createInvoice.isPending}>
                حفظ الفاتورة وترحيل القيد المحاسبي والمخزني
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 4: CREATE / EDIT SUPPLIER
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isSupplierOpen} onOpenChange={setIsSupplierOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {editingSupplier ? `تعديل بيانات المورد: ${editingSupplier.name}` : "إضافة مورد جديد إلى الدليل"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                تسجيل البيانات التجارية، بيانات الاتصال، الرقم الضريبي، وشروط السداد للمورد.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">اسم المورد / الشركة *</label>
                  <Input
                    value={supForm.name}
                    onChange={e => setSupForm({ ...supForm, name: e.target.value })}
                    placeholder="مثال: شركة التوريدات الغذائية المتقدمة"
                    className="font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">الشخص المسؤول / مندوب المورد</label>
                  <Input
                    value={supForm.contact_person}
                    onChange={e => setSupForm({ ...supForm, contact_person: e.target.value })}
                    placeholder="مثال: م. أحمد السعيد"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">رقم الهاتف الثابت</label>
                  <Input
                    value={supForm.phone}
                    onChange={e => setSupForm({ ...supForm, phone: e.target.value })}
                    placeholder="0112345678"
                    dir="ltr"
                    className="text-right"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم جوال المورد *</label>
                  <Input
                    value={supForm.mobile_number}
                    onChange={e => setSupForm({ ...supForm, mobile_number: e.target.value })}
                    placeholder="0501234567"
                    dir="ltr"
                    className="text-right"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    value={supForm.email}
                    onChange={e => setSupForm({ ...supForm, email: e.target.value })}
                    placeholder="supplier@company.com"
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">الرقم الضريبي (15 رقم)</label>
                  <Input
                    value={supForm.tax_number}
                    onChange={e => setSupForm({ ...supForm, tax_number: e.target.value })}
                    placeholder="300000000000003"
                    dir="ltr"
                    className="text-right font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم السجل التجاري</label>
                  <Input
                    value={supForm.commercial_register}
                    onChange={e => setSupForm({ ...supForm, commercial_register: e.target.value })}
                    placeholder="1010000000"
                    dir="ltr"
                    className="text-right font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">شروط الدفع والائتمان</label>
                  <Select value={supForm.payment_terms} onValueChange={val => setSupForm({ ...supForm, payment_terms: val })}>
                    <SelectTrigger><SelectValue placeholder="اختر شروط الدفع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="نقداً عند الاستلام">نقداً عند الاستلام (COD)</SelectItem>
                      <SelectItem value="15 يوم">آجل 15 يوم</SelectItem>
                      <SelectItem value="30 يوم">آجل 30 يوم</SelectItem>
                      <SelectItem value="45 يوم">آجل 45 يوم</SelectItem>
                      <SelectItem value="60 يوم">آجل 60 يوم</SelectItem>
                      <SelectItem value="90 يوم">آجل 90 يوم</SelectItem>
                      <SelectItem value="دفعة مقدمة 50% والباقي عند التسليم">دفعة مقدمة 50% والباقي عند التسليم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">تقييم المورد (1 إلى 5 نجوم)</label>
                  <Select value={String(supForm.rating || 5)} onValueChange={val => setSupForm({ ...supForm, rating: Number(val) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">⭐⭐⭐⭐⭐ ممتاز (5)</SelectItem>
                      <SelectItem value="4">⭐⭐⭐⭐ جيد جداً (4)</SelectItem>
                      <SelectItem value="3">⭐⭐⭐ جيد (3)</SelectItem>
                      <SelectItem value="2">⭐⭐ مقبول (2)</SelectItem>
                      <SelectItem value="1">⭐ ضعيف (1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">اسم البنك</label>
                  <Input
                    value={supForm.bank_name}
                    onChange={e => setSupForm({ ...supForm, bank_name: e.target.value })}
                    placeholder="مثال: مصرف الراجحي / البنك الأهلي"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">رقم الحساب / الآيبان (IBAN)</label>
                  <Input
                    value={supForm.bank_account}
                    onChange={e => setSupForm({ ...supForm, bank_account: e.target.value })}
                    placeholder="SA0000000000000000000000"
                    dir="ltr"
                    className="text-right font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">العنوان / المستودع الرئيسي</label>
                <Input
                  value={supForm.address}
                  onChange={e => setSupForm({ ...supForm, address: e.target.value })}
                  placeholder="المدينة، الحي، الشارع، الرمز البريدي"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">ملاحظات إضافية</label>
                <Textarea
                  value={supForm.notes}
                  onChange={e => setSupForm({ ...supForm, notes: e.target.value })}
                  placeholder="أي معلومات إضافية حول التوريد، الخصومات المتفق عليها، مواعيد العمل..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsSupplierOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (!supForm.name.trim()) {
                    toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة اسم المورد / الشركة" });
                    return;
                  }
                  if (editingSupplier) {
                    updateSupplier.mutate({ id: editingSupplier.id, data: supForm });
                  } else {
                    createSupplier.mutate(supForm);
                  }
                }}
                disabled={!supForm.name.trim() || createSupplier.isPending || updateSupplier.isPending}
              >
                {editingSupplier ? "حفظ التعديلات" : "حفظ المورد في الدليل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 5: RECORD SUPPLIER PAYMENT
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" /> سداد دفعة للمورد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">المورد</label>
                <Select value={payForm.supplier_id} onValueChange={val => setPayForm({ ...payForm, supplier_id: val })}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any, idx: number) => (
                      <SelectItem key={`pay-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name} (المتبقي: {fmt(s.balance)} ريال)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">المبلغ المدفوع (ريال)</label>
                <Input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: Number(e.target.value) })} placeholder="0.00" />
              </div>
              <div>
                <label className="font-semibold block mb-1">طريقة السداد</label>
                <Select value={payForm.payment_method} onValueChange={val => setPayForm({ ...payForm, payment_method: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقداً من الصندوق</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك بنكي</SelectItem>
                    <SelectItem value="earned_discount">خصم مكتسب (تسوية)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createPayment.mutate(payForm)} disabled={!payForm.supplier_id || payForm.amount <= 0}>
                تأكيد السداد والخصم من المديونية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 6: CREATE PURCHASE RETURN
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <RotateCcw className="w-5 h-5" /> إنشاء مرتجع مشتريات
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">المورد</label>
                <Select value={retForm.supplier_id} onValueChange={val => setRetForm({ ...retForm, supplier_id: val })}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any, idx: number) => (
                      <SelectItem key={`ret-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">سبب المرتجع</label>
                <Input value={retForm.reason} onChange={e => setRetForm({ ...retForm, reason: e.target.value })} placeholder="مخالفة للمواصفات / تلف بالبضاعة" />
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <span className="font-bold block mb-1">الصنف المراد إرجاعه</span>
                <Select value={retForm.items[0]?.product_id} onValueChange={val => {
                  const prod = products.find((p: any) => String(p.id) === val);
                  setRetForm({
                    ...retForm,
                    items: [{ product_id: val, product_name: prod?.name || "", quantity: 1, unit_price: prod?.cost || 0 }]
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input type="number" min="1" value={retForm.items[0]?.quantity} onChange={e => {
                    const items = [...retForm.items];
                    items[0].quantity = Number(e.target.value);
                    setRetForm({ ...retForm, items });
                  }} placeholder="الكمية المرتجعة" />
                  <Input type="number" value={retForm.items[0]?.unit_price} onChange={e => {
                    const items = [...retForm.items];
                    items[0].unit_price = Number(e.target.value);
                    setRetForm({ ...retForm, items });
                  }} placeholder="سعر الوحدة" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => createReturn.mutate(retForm)} disabled={!retForm.items[0]?.product_id}>
                تأكيد المرتجع وتحديث المخزون
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─────────────────────────────────────────────────────────────
            MODAL 7: CREATE CONTRACT
        ───────────────────────────────────────────────────────────── */}
        <Dialog open={isContractOpen} onOpenChange={setIsContractOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> إضافة عقد توريد جديد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">المورد</label>
                <Select value={cntForm.supplier_id} onValueChange={val => setCntForm({ ...cntForm, supplier_id: val })}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any, idx: number) => (
                      <SelectItem key={`cnt-sup-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">عنوان الاتفاقية / العقد</label>
                <Input value={cntForm.title} onChange={e => setCntForm({ ...cntForm, title: e.target.value })} placeholder="عقد توريد اللحوم والدواجن السنوي" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">تاريخ البداية</label>
                  <Input type="date" value={cntForm.start_date} onChange={e => setCntForm({ ...cntForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">تاريخ النهاية</label>
                  <Input type="date" value={cntForm.end_date} onChange={e => setCntForm({ ...cntForm, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">القيمة الإجمالية للعقد (ريال)</label>
                <Input type="number" value={cntForm.agreed_amount} onChange={e => setCntForm({ ...cntForm, agreed_amount: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createContract.mutate(cntForm)} disabled={!cntForm.supplier_id || !cntForm.title}>
                حفظ العقد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReportViewerModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(prev => ({ ...prev, isOpen: false }))}
          title={previewModal.title}
          htmlContent={previewModal.htmlContent}
        />

      </div>
    </AdminLayout>
  );
}
