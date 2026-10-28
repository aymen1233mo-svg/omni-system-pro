import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Globe, Plus, Search, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, AlertTriangle, User,
  FileText, CheckSquare, Printer, MessageCircle, UserPlus, Calendar,
  DollarSign, Building2, Eye, ShieldCheck, Share2, ArrowUpDown, RefreshCw,
  Coins, Download, FileSpreadsheet, Layers, Check, ChevronDown, Landmark,
  Zap, Sparkles, XCircle, Send, CheckCheck, RotateCcw, Receipt, ShieldAlert,
  ArrowLeftRight, CreditCard, Banknote, Wallet, Mail, Settings, Key, Copy, Lock, Sliders
} from "lucide-react";
import { generateTransactionA4Html, printA4Html } from "@/lib/printUtils";

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

// Available Currencies
const CURRENCIES = [
  { code: "SAR", symbol: "ر.س", label: "ريال سعودي (SAR)", flag: "🇸🇦", rateToSar: 1 },
  { code: "USD", symbol: "$", label: "دولار أمريكي (USD)", flag: "🇺🇸", rateToSar: 3.75 },
  { code: "YER", symbol: "ر.ي", label: "ريال يمني (YER)", flag: "🇾🇪", rateToSar: 0.00263 } // ~380 YER per SAR
];

// Visa Types as explicitly requested
const VISA_TYPES = [
  "1- تأشيرة عمرة",
  "2- تأشيرة زيارة عائلية",
  "3- تأشيرة حج",
  "4- تأشيرة عمل",
  "تأشيرة سياحية",
  "تأشيرة تجارية / رجال أعمال",
  "تأشيرة دراسية",
  "تأشيرة علاجية",
  "تأشيرة ترانزيت",
  "تأشيرة زيارة شخصية",
  "تأشيرة إقامة وعمل",
  "معامله جوازات"
];

const VISA_STATUS: Record<string, { label: string; class: string; icon: string }> = {
  in_office: { label: "في المكتب الخاص بنا (قيد التجهيز)", class: "bg-amber-100 text-amber-900 border-amber-300 font-bold", icon: "🏢" },
  under_process: { label: "قيد المعالجة (سفارة/مكتب)", class: "bg-blue-100 text-blue-900 border-blue-200", icon: "⏳" },
  pending_docs: { label: "بانتظار الوثائق والمستندات ⚠️", class: "bg-orange-100 text-orange-900 border-orange-200 font-bold", icon: "⚠️" },
  appointment_booked: { label: "تم حجز موعد البصمة 📅", class: "bg-purple-100 text-purple-900 border-purple-200 font-bold", icon: "📅" },
  approved: { label: "تم إصدار التأشيرة بنجاح ✅", class: "bg-emerald-100 text-emerald-900 border-emerald-200 font-bold", icon: "✅" },
  delivered: { label: "تم التسليم للعميل 🤝", class: "bg-teal-100 text-teal-900 border-teal-200", icon: "🤝" },
  rejected: { label: "مرفوضة من السفارة ❌", class: "bg-red-100 text-red-900 border-red-200", icon: "❌" },
  cancelled: { label: "ملغية", class: "bg-slate-100 text-slate-700 border-slate-200", icon: "🚫" }
};

const COMMON_MISSING_DOCS = [
  "جواز السفر الأصلي ساري لأكثر من 6 أشهر",
  "صورتان شخصيتان 3.5×4.5 خلفية بيضاء",
  "كشف حساب بنكي معتمد",
  "تعريف بالراتب مصدق",
  "حجز طيران وفندق مبدئي",
  "تأمين طبي دولي",
  "صورة الإقامة / الهوية الوطنية"
];

export default function TravelVisasPage() {
  const qc = useQueryClient();

  // Settings for print & company branding
  const { data: docSettings = {} } = useQuery<any>({
    queryKey: ["document-print-settings"],
    queryFn: () => fetchWithAuth("/api/document-print-settings").catch(() => ({}))
  });

  // Workflow tracking states
  const [viewMode, setViewMode] = useState<"standard" | "workflow">("workflow");
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<"new" | "outward" | "inward" | "delivered" | "movement">("new");
  
  // Report filter inputs
  const [reportCustomerId, setReportCustomerId] = useState("");
  const [reportCustomerName, setReportCustomerName] = useState("");
  const [reportCustomerPhone, setReportCustomerPhone] = useState("");
  const [reportPassportNum, setReportPassportNum] = useState("");
  const [reportVisaNum, setReportVisaNum] = useState("");
  const [reportRegisterNum, setReportRegisterNum] = useState("");

  // Selection states
  const [selectedVisaIds, setSelectedVisaIds] = useState<number[]>([]);

  // Tab action form fields
  const [wfOutwardDate, setWfOutwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [wfOutwardVoucherNo, setWfOutwardVoucherNo] = useState("");
  const [wfBatchNumber, setWfBatchNumber] = useState("");
  const [wfOutwardNote, setWfOutwardNote] = useState("");

  const [wfInwardStatus, setWfInwardStatus] = useState("approved"); // 'approved' as ready, 'rejected' as returned
  const [wfInwardDate, setWfInwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [wfInwardNote, setWfInwardNote] = useState("");
  const [wfDepartment, setWfDepartment] = useState("عام");

  const [wfDeliveryDate, setWfDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [wfDeliveryType, setWfDeliveryType] = useState("باليد"); // 'ارسال بالبريد', 'باليد'
  const [wfReceiverName, setWfReceiverName] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingVisa, setEditingVisa] = useState<any | null>(null);

  // Quick Customer modal
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });

  // Quick Passenger modal
  const [quickPassengerModalOpen, setQuickPassengerModalOpen] = useState(false);
  const [quickPassengerForm, setQuickPassengerForm] = useState({ name_ar: "", name_en: "", passport_number: "", passport_expiry_date: "", nationality: "سعودي" });

  // Quick Partner Office modal
  const [quickOfficeModalOpen, setQuickOfficeModalOpen] = useState(false);
  const [quickOfficeForm, setQuickOfficeForm] = useState({ name: "", phone: "", city: "", office_type: "partner_agency", contact_person: "" });

  // Print voucher modal
  const [printVisa, setPrintVisa] = useState<any | null>(null);

  // Auto Link & WhatsApp Gateway States
  const [autoLinkModalOpen, setAutoLinkModalOpen] = useState(false);
  const [autoLinkTab, setAutoLinkTab] = useState<"config_wa" | "config_email" | "scan" | "simulate" | "whatsapp">("config_wa");
  const [autoLinkLogs, setAutoLinkLogs] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [waTestPhone, setWaTestPhone] = useState("966500000000");
  const [waTestMessage, setWaTestMessage] = useState("مرحباً بك، تم تفعيل ربط نظام الواتساب التلقائي لخدمات العمرة والتأشيرات بنجاح 🕋");
  const [waTestStatus, setWaTestStatus] = useState("");
  const [saveGwMessage, setSaveGwMessage] = useState("");
  const [isSavingGw, setIsSavingGw] = useState(false);

  // WhatsApp Gateway Configuration State
  const [waGwState, setWaGwState] = useState({
    id: null as number | null,
    provider_key: "whatsapp_meta",
    provider_name: "Meta WhatsApp Cloud API (الرسمي)",
    is_enabled: true,
    api_key: "",
    account_id: "",
    sender_id: "",
    webhook_verify_token: "omnifly_meta_webhook_2026",
    base_url: "https://graph.facebook.com/v19.0"
  });

  // Email / SMTP Gateway Configuration State
  const [emailGwState, setEmailGwState] = useState({
    id: null as number | null,
    provider_key: "smtp_google",
    provider_name: "Google Workspace / Gmail SMTP",
    is_enabled: true,
    api_key: "", // App Password / Password
    sender_id: "visas@omnifly.com", // Sender Email
    smtp_host: "smtp.gmail.com",
    smtp_port: "587",
    sender_name: "أومني فلاي لخدمات العمرة والتأشيرات"
  });

  const [emailPayload, setEmailPayload] = useState({
    passenger_name: "موسى الفيفي",
    passenger_email: "agency@omnifly.com", // default simulation email
    passport_number: "P998877",
    visa_number: "VSA-9922110",
    country: "المملكة العربية السعودية",
    visa_type: "1- تأشيرة عمرة",
    cost_price: "150",
    selling_price: "350"
  });

  // Load existing gateway settings from server
  const loadGateways = async () => {
    try {
      const rows = await fetchWithAuth<any[]>("/api/travel/notifications/gateways");
      if (Array.isArray(rows)) {
        const wa = rows.find(g => g.provider_key === "whatsapp_meta" || (g.channel_types && g.channel_types.includes("whatsapp")));
        if (wa) {
          setWaGwState({
            id: wa.id,
            provider_key: wa.provider_key,
            provider_name: wa.provider_name || "Meta WhatsApp Cloud API (الرسمي)",
            is_enabled: wa.is_enabled === 1,
            api_key: wa.api_key || "",
            account_id: wa.account_id || "",
            sender_id: wa.sender_id || "",
            webhook_verify_token: wa.webhook_verify_token || "omnifly_meta_webhook_2026",
            base_url: wa.base_url || "https://graph.facebook.com/v19.0"
          });
        }
        const em = rows.find(g => g.provider_key === "smtp_google" || (g.channel_types && g.channel_types.includes("email")));
        if (em) {
          let cfg: any = {};
          try { cfg = typeof em.config_json === "string" ? JSON.parse(em.config_json) : (em.config_json || {}); } catch {}
          setEmailGwState({
            id: em.id,
            provider_key: em.provider_key,
            provider_name: em.provider_name || "Google Workspace / Gmail SMTP",
            is_enabled: em.is_enabled === 1,
            api_key: em.api_key || "",
            sender_id: em.sender_id || "",
            smtp_host: cfg.smtp_host || "smtp.gmail.com",
            smtp_port: String(cfg.smtp_port || "587"),
            sender_name: cfg.sender_name || "أومني فلاي لخدمات العمرة والتأشيرات"
          });
        }
      }
    } catch (err) {
      console.error("Error fetching notification gateways:", err);
    }
  };

  const saveWaGateway = async () => {
    setIsSavingGw(true);
    setSaveGwMessage("");
    try {
      const payload = {
        provider_name: waGwState.provider_name,
        channel_types: "whatsapp",
        is_enabled: waGwState.is_enabled ? 1 : 0,
        is_default: 1,
        api_key: waGwState.api_key,
        account_id: waGwState.account_id,
        sender_id: waGwState.sender_id,
        webhook_verify_token: waGwState.webhook_verify_token,
        base_url: waGwState.base_url,
        config_json: { api_version: "v19.0", webhook_callback_url: "/api/travel/notifications/webhook/meta" }
      };

      if (waGwState.id) {
        await fetchWithAuth(`/api/travel/notifications/gateways/${waGwState.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        const created: any = await fetchWithAuth("/api/travel/notifications/gateways", {
          method: "POST",
          body: JSON.stringify({ ...payload, provider_key: waGwState.provider_key })
        });
        if (created?.id) setWaGwState(s => ({ ...s, id: created.id }));
      }
      setSaveGwMessage("✅ تم حفظ وتفعيل إعدادات بوابة الواتساب بنجاح! الإشعارات جاهزة للتسليم للعملاء.");
      setAutoLinkLogs(prev => [`✅ [${new Date().toLocaleTimeString()}] تم تحديث وتفعيل إعدادات بوابة الواتساب بنجاح!`, ...prev]);
    } catch (err: any) {
      setSaveGwMessage(`❌ خطأ أثناء الحفظ: ${err.message}`);
    } finally {
      setIsSavingGw(false);
    }
  };

  const saveEmailGateway = async () => {
    setIsSavingGw(true);
    setSaveGwMessage("");
    try {
      const payload = {
        provider_name: emailGwState.provider_name,
        channel_types: "email",
        is_enabled: emailGwState.is_enabled ? 1 : 0,
        is_default: 1,
        api_key: emailGwState.api_key,
        sender_id: emailGwState.sender_id,
        config_json: {
          smtp_host: emailGwState.smtp_host,
          smtp_port: emailGwState.smtp_port,
          sender_name: emailGwState.sender_name
        }
      };

      if (emailGwState.id) {
        await fetchWithAuth(`/api/travel/notifications/gateways/${emailGwState.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        const created: any = await fetchWithAuth("/api/travel/notifications/gateways", {
          method: "POST",
          body: JSON.stringify({ ...payload, provider_key: emailGwState.provider_key })
        });
        if (created?.id) setEmailGwState(s => ({ ...s, id: created.id }));
      }
      setSaveGwMessage("✅ تم حفظ وتفعيل إعدادات بوابة البريد الإلكتروني بنجاح! الربط الآلي والإشعارات نشطة الآن.");
      setAutoLinkLogs(prev => [`✅ [${new Date().toLocaleTimeString()}] تم تحديث وتفعيل إعدادات بوابة البريد الإلكتروني بنجاح!`, ...prev]);
    } catch (err: any) {
      setSaveGwMessage(`❌ خطأ أثناء الحفظ: ${err.message}`);
    } finally {
      setIsSavingGw(false);
    }
  };

  // Visa Status Action Modal (إجراءات حالة المعاملة: مؤشرة، مرفوضة، مسلمة للعميل...)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionVisa, setActionVisa] = useState<any | null>(null);
  const [actionForm, setActionForm] = useState({
    status: "approved",
    issued_visa_number: "",
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    border_number: "",
    rejection_reason: "نقص وثائق ومستندات",
    custom_rejection_reason: "",
    rejection_date: new Date().toISOString().slice(0, 10),
    delivered_to: "",
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_method: "يداً بيد بالفرع",
    delivery_notes: "",
    missing_docs: "",
    notes: ""
  });

  // Main Form State
  const [form, setForm] = useState({
    customer_id: "",
    passenger_id: "",
    country: "المملكة العربية السعودية",
    visa_type: "1- تأشيرة عمرة",
    status: "in_office",
    application_date: new Date().toISOString().slice(0, 10),
    expected_travel_date: "",
    expiry_date: "",
    duration_days: "30",

    // الطرف الأول: العميل (المدين / المستفيد)
    selling_price: "0",
    customer_currency: "SAR",
    customer_statement: "",
    payment_method: "cash", // 'cash' | 'credit' | 'bank' | 'card' | 'cheque'
    payment_status: "paid",
    paid_amount: "0",
    remaining_balance: "0",
    invoice_number: "",
    tax_amount: "0",

    // الطرف الثاني: المكتب المفوض للتأشيرة (الدائن / المورد)
    affiliation_type: "agency", // "direct" or "agency"
    supplier_office_id: "",
    supplier_office_name: "",
    cost_price: "0",
    supplier_currency: "SAR",
    supplier_statement: "",
    supplier_payment_method: "credit", // 'cash' | 'credit'
    supplier_payment_status: "unpaid",
    supplier_paid_amount: "0",
    supplier_remaining_balance: "0",

    // عمولة المكتب الخاص بنا والربح
    agency_commission: "0",
    commission_currency: "SAR",
    commission_statement: "",
    exchange_rate: "1",

    // المستندات والملاحظات
    missing_docs: "",
    notes: ""
  });

  // Print function handler using A4 engine
  const handlePrintVisa = (v: any) => {
    const html = generateTransactionA4Html({ visa: v, settings: docSettings });
    printA4Html(html, `سند-معاملة-${v.service_voucher_no || v.visa_number || v.id}`);
  };

  // Queries
  const { data: visas = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["travel-visas", search, statusFilter, typeFilter, currencyFilter, officeFilter, paymentFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (statusFilter && statusFilter !== "all") q.set("status", statusFilter);
      if (typeFilter && typeFilter !== "all") q.set("visa_type", typeFilter);
      if (currencyFilter && currencyFilter !== "all") q.set("currency", currencyFilter);
      if (officeFilter && officeFilter !== "all") q.set("supplier_office_id", officeFilter);
      if (paymentFilter && paymentFilter !== "all") q.set("payment_method", paymentFilter);
      return fetchWithAuth(`/api/travel/visas?${q.toString()}`);
    }
  });

  // Workflow tracking calculations and functions
  const filteredVisasForWorkflow = useMemo(() => {
    return visas.filter(v => {
      // Filter based on active tab:
      if (activeWorkflowTab === "new") {
        if (!(v.status === "in_office" || v.status === "new")) return false;
      } else if (activeWorkflowTab === "outward") {
        if (!(v.status === "under_process" || v.status === "outward")) return false;
      } else if (activeWorkflowTab === "inward") {
        if (!(v.status === "approved" || v.status === "rejected" || v.status === "inward_ready" || v.status === "inward_returned")) return false;
      } else if (activeWorkflowTab === "delivered") {
        if (!(v.status === "delivered" || v.status === "received_by_client")) return false;
      }

      // Apply the top header search filters:
      if (reportCustomerId && !String(v.customer_id || "").includes(reportCustomerId)) return false;
      if (reportCustomerName && !String(v.customer_name || "").toLowerCase().includes(reportCustomerName.toLowerCase())) return false;
      if (reportCustomerPhone && !String(v.customer_phone || "").includes(reportCustomerPhone)) return false;
      if (reportPassportNum && !String(v.passport_number || "").toLowerCase().includes(reportPassportNum.toLowerCase())) return false;
      if (reportVisaNum && !String(v.issued_visa_number || v.visa_number || "").toLowerCase().includes(reportVisaNum.toLowerCase())) return false;
      if (reportRegisterNum && !String(v.service_voucher_no || "").toLowerCase().includes(reportRegisterNum.toLowerCase())) return false;

      return true;
    });
  }, [visas, activeWorkflowTab, reportCustomerId, reportCustomerName, reportCustomerPhone, reportPassportNum, reportVisaNum, reportRegisterNum]);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleBatchStatusTransition = async () => {
    if (selectedVisaIds.length === 0) {
      alert("يرجى تحديد معاملة واحدة على الأقل لإجراء العملية.");
      return;
    }

    setIsTransitioning(true);
    try {
      let payload: any = {};
      
      if (activeWorkflowTab === "new") {
        payload = {
          status: "under_process",
          outward_date: wfOutwardDate,
          batch_number: wfBatchNumber,
          outward_voucher_no: wfOutwardVoucherNo,
          notes: wfOutwardNote ? `حركة الصادر: ${wfOutwardNote}` : "تم التصدير إلى السفارة"
        };
      } else if (activeWorkflowTab === "outward") {
        payload = {
          status: wfInwardStatus,
          inward_date: wfInwardDate,
          inward_note: wfInwardNote,
          inward_status: wfInwardStatus,
          department: wfDepartment,
          notes: wfInwardNote ? `حركة الوارد: ${wfInwardNote}` : `تم الاستلام من السفارة كـ (${wfInwardStatus === "approved" ? "جاهز" : "مرتجع"})`
        };
      } else if (activeWorkflowTab === "inward") {
        payload = {
          status: "delivered",
          delivered_to: wfReceiverName || "العميل نفسه",
          delivery_date: wfDeliveryDate,
          delivery_method: wfDeliveryType,
          delivery_notes: `طريقة التسليم: ${wfDeliveryType}. المستلم: ${wfReceiverName}`
        };
      } else {
        setIsTransitioning(false);
        return;
      }

      await Promise.all(
        selectedVisaIds.map(id =>
          fetchWithAuth(`/api/travel/visas/${id}/status-action`, {
            method: "PUT",
            body: JSON.stringify(payload)
          })
        )
      );

      qc.invalidateQueries({ queryKey: ["travel-visas"] });
      setSelectedVisaIds([]);
      alert("تم تحديث ونقل المعاملات المحددة بنجاح.");
    } catch (error: any) {
      alert("حدث خطأ أثناء تحديث حالة المعاملات: " + error.message);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleResetSelectedVisas = async () => {
    if (selectedVisaIds.length === 0) {
      setWfOutwardVoucherNo("");
      setWfBatchNumber("");
      setWfOutwardNote("");
      setWfInwardNote("");
      setWfReceiverName("");
      setSelectedVisaIds([]);
      return;
    }

    if (confirm("هل تريد إلغاء تحديد هذه المعاملات وإعادة تعيين حالتها إلى البداية (في المكتب)؟")) {
      setIsTransitioning(true);
      try {
        await Promise.all(
          selectedVisaIds.map(id =>
            fetchWithAuth(`/api/travel/visas/${id}/status-action`, {
              method: "PUT",
              body: JSON.stringify({
                status: "in_office",
                notes: "تمت إعادة التعيين إلى المكتب"
              })
            })
          )
        );
        qc.invalidateQueries({ queryKey: ["travel-visas"] });
        setSelectedVisaIds([]);
        alert("تمت إعادة تعيين المعاملات المحددة إلى المكتب بنجاح.");
      } catch (err: any) {
        alert("فشل إعادة تعيين المعاملات: " + err.message);
      } finally {
        setIsTransitioning(false);
      }
    }
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (viewMode === "standard") {
      if (visas.length === 0) return;
      headers = ["رقم المعاملة", "العميل الدافع", "المسافر المتقدم", "رقم الجواز", "نوع التأشيرة", "الدولة", "المكتب المفوض", "سعر البيع", "عملة البيع", "سعر التكلفة", "عملة التكلفة", "عمولة المكتب", "الحالة", "تاريخ التقديم"];
      rows = visas.map(v => [
        v.visa_number,
        `"${v.customer_name || 'عميل عام'}"`,
        `"${v.passenger_name_ar || v.passenger_name_en || v.customer_name || ''}"`,
        v.passport_number || '',
        `"${v.visa_type}"`,
        `"${v.country}"`,
        `"${v.supplier_office_official_name || v.supplier_office_name || 'المكتب الرئيسي'}"`,
        v.selling_price || 0,
        v.customer_currency || 'SAR',
        v.cost_price || 0,
        v.supplier_currency || 'SAR',
        v.agency_commission || ((v.selling_price || 0) - (v.cost_price || 0)),
        `"${VISA_STATUS[v.status]?.label || v.status}"`,
        v.application_date || ''
      ]);
    } else {
      if (activeWorkflowTab === "new") {
        headers = ["رقم العميل", "اسم العميل", "الجواز", "نوع الخدمة", "البلد", "نوع التأشيرة", "تاريخ التقديم", "سعر البيع", "رقم الطلب"];
        rows = filteredVisasForWorkflow.map(v => [
          v.customer_id || "",
          v.customer_name || "عميل عام",
          v.passport_number || "",
          "تأشيرة سياحية",
          v.country || "",
          v.visa_type || "",
          v.application_date || "",
          v.selling_price || 0,
          v.visa_number || ""
        ]);
      } else if (activeWorkflowTab === "outward") {
        headers = ["رقم العميل", "اسم العميل", "الجواز", "السجل", "رقم الدفعة", "رقم السند", "تاريخ الصادر", "نوع الخدمة", "الوكيل", "التأشيرة", "البيان", "رقم الطلب"];
        rows = filteredVisasForWorkflow.map(v => [
          v.customer_id || "",
          v.customer_name || "عميل عام",
          v.passport_number || "",
          v.service_voucher_no || "",
          v.batch_number || "",
          v.outward_voucher_no || "",
          v.outward_date || "",
          "تأشيرة سياحية",
          v.supplier_office_name || "الوكيل",
          v.visa_type || "",
          v.notes || "",
          v.visa_number || ""
        ]);
      } else if (activeWorkflowTab === "inward") {
        headers = ["رقم العميل", "اسم العميل", "الجواز", "التأشيرة", "الوكيل", "نوع الخدمة", "تاريخ الوارد", "رقم السند", "الحالة", "بيان الوارد", "رقم الطلب"];
        rows = filteredVisasForWorkflow.map(v => [
          v.customer_id || "",
          v.customer_name || "عميل عام",
          v.passport_number || "",
          v.visa_type || "",
          v.supplier_office_name || "",
          "تأشيرة سياحية",
          v.inward_date || "",
          v.outward_voucher_no || "",
          v.status === "approved" ? "جاهز" : "مرتجع",
          v.inward_note || "",
          v.visa_number || ""
        ]);
      } else if (activeWorkflowTab === "delivered") {
        headers = ["رقم العميل", "اسم العميل", "الجواز", "التأشيرة", "السجل", "رقم الدفعة", "نوع الخدمة", "تاريخ التسليم", "الحالة", "المستلم", "تاريخ الوارد", "بيان الوارد", "رقم الطلب"];
        rows = filteredVisasForWorkflow.map(v => [
          v.customer_id || "",
          v.customer_name || "عميل عام",
          v.passport_number || "",
          v.visa_type || "",
          v.service_voucher_no || "",
          v.batch_number || "",
          "تأشيرة سياحية",
          v.delivery_date || "",
          "مسلمة للعميل",
          v.delivered_to || "",
          v.inward_date || "",
          v.inward_note || "",
          v.visa_number || ""
        ]);
      } else {
        headers = ["رقم المعاملة", "العميل", "الجواز", "الحالة"];
        rows = filteredVisasForWorkflow.map(v => [v.visa_number, v.customer_name, v.passport_number, v.status]);
      }
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      viewMode === "standard"
        ? `تقرير_معاملات_التأشيرات_${new Date().toISOString().slice(0, 10)}.csv`
        : `تقرير_متابعة_التأشيرات_${activeWorkflowTab}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list"],
    queryFn: () => fetchWithAuth("/api/travel/passengers")
  });

  const { data: partnerOffices = [] } = useQuery<any[]>({
    queryKey: ["travel-partner-offices-list"],
    queryFn: () => fetchWithAuth("/api/travel/partner-offices")
  });

  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      try {
        const res = await fetchWithAuth("/api/suppliers");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    }
  });

  const { data: subAccounts21100 = [] } = useQuery<any[]>({
    queryKey: ["sub-accounts-21100"],
    queryFn: async () => {
      try {
        const res = await fetchWithAuth("/api/travel/sub-accounts/21100");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    }
  });

  const allSuppliersAndOffices = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    partnerOffices.forEach((po: any) => {
      if (po.name) {
        seen.add(po.name.trim().toLowerCase());
        list.push({
          id: po.id,
          name: po.name,
          city: po.city || "",
          label: `🏢 ${po.name} ${po.city ? `(${po.city})` : ""}`
        });
      }
    });

    suppliersList.forEach((s: any) => {
      if (s.name && !seen.has(s.name.trim().toLowerCase())) {
        seen.add(s.name.trim().toLowerCase());
        list.push({
          id: s.id,
          name: s.name,
          city: s.address || s.notes || "مورد - ذمم دائنة",
          label: `🏬 [مورد ذمم دائنة] ${s.name} ${s.phone ? `(${s.phone})` : ""}`
        });
      }
    });

    subAccounts21100.forEach((acc: any) => {
      if (acc.name && !seen.has(acc.name.trim().toLowerCase()) && acc.code !== "21100") {
        seen.add(acc.name.trim().toLowerCase());
        list.push({
          id: acc.id,
          name: acc.name,
          city: `حساب دائم ${acc.code}`,
          label: `📊 [دليل الحسابات - ذمم دائنة ${acc.code}] ${acc.name}`
        });
      }
    });

    return list;
  }, [partnerOffices, suppliersList, subAccounts21100]);

  const selectedCustomerObj = useMemo(() => {
    if (!form.customer_id) return null;
    return customers.find((c: any) => String(c.id) === String(form.customer_id)) || null;
  }, [customers, form.customer_id]);

  const selectedCustomerAffiliation = selectedCustomerObj?.affiliation_type || 'direct';

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        customer_id: data.customer_id ? Number(data.customer_id) : null,
        passenger_id: data.passenger_id ? Number(data.passenger_id) : null,
        supplier_office_id: data.supplier_office_id ? Number(data.supplier_office_id) : null,
        cost_price: Number(data.cost_price || 0),
        selling_price: Number(data.selling_price || 0),
        agency_commission: Number(data.agency_commission || 0),
        exchange_rate: Number(data.exchange_rate || 1),
        paid_amount: Number(data.paid_amount || 0),
        remaining_balance: Number(data.remaining_balance || 0),
        tax_amount: Number(data.tax_amount || 0),
        payment_method: data.payment_method || "cash",
        payment_status: data.payment_status || "paid",
        invoice_number: data.invoice_number || ""
      };
      if (editingVisa) {
        return fetchWithAuth(`/api/travel/visas/${editingVisa.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return fetchWithAuth("/api/travel/visas", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-visas"] });
      setSaveError(null);
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setSaveError(err.message || "حدث خطأ أثناء الحفظ. يرجى التحقق من الحقول المطلوبة.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/visas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-visas"] });
    }
  });

  const statusActionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      fetchWithAuth(`/api/travel/visas/${id}/status-action`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-visas"] });
      setActionModalOpen(false);
      setActionVisa(null);
    }
  });

  const handleOpenAction = (v: any, defaultStatus?: string) => {
    setActionVisa(v);
    const targetStatus = defaultStatus || (v.status === 'in_office' ? 'approved' : v.status);
    setActionForm({
      status: targetStatus,
      issued_visa_number: v.issued_visa_number || v.visa_number || "",
      issue_date: v.issue_date || new Date().toISOString().slice(0, 10),
      expiry_date: v.expiry_date || "",
      border_number: v.border_number || "",
      rejection_reason: v.rejection_reason || "نقص وثائق ومستندات",
      custom_rejection_reason: "",
      rejection_date: v.rejection_date || new Date().toISOString().slice(0, 10),
      delivered_to: v.delivered_to || v.passenger_name_ar || v.passenger_name_en || v.customer_name || "",
      delivery_date: v.delivery_date || new Date().toISOString().slice(0, 10),
      delivery_method: v.delivery_method || "يداً بيد بالفرع",
      delivery_notes: v.delivery_notes || "",
      missing_docs: v.missing_docs || "",
      notes: ""
    });
    setActionModalOpen(true);
  };

  const quickCustomerMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newCust: any) => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      setQuickCustomerModalOpen(false);
      setForm(f => ({ ...f, customer_id: String(newCust.id) }));
      setQuickCustomerForm({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });
    }
  });

  const quickPassengerMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/passengers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newPass: any) => {
      qc.invalidateQueries({ queryKey: ["travel-passengers-list"] });
      setQuickPassengerModalOpen(false);
      setForm(f => ({ ...f, passenger_id: String(newPass.id) }));
      setQuickPassengerForm({ name_ar: "", name_en: "", passport_number: "", passport_expiry_date: "", nationality: "سعودي" });
    }
  });

  const quickOfficeMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/partner-offices", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newOff: any) => {
      qc.invalidateQueries({ queryKey: ["travel-partner-offices-list"] });
      setQuickOfficeModalOpen(false);
      setForm(f => ({ ...f, supplier_office_id: String(newOff.id), supplier_office_name: newOff.name }));
      setQuickOfficeForm({ name: "", phone: "", city: "", office_type: "partner_agency", contact_person: "" });
    }
  });

  const resetForm = () => {
    setEditingVisa(null);
    setForm({
      customer_id: "",
      passenger_id: "",
      country: "المملكة العربية السعودية",
      visa_type: "1- تأشيرة عمرة",
      status: "in_office",
      application_date: new Date().toISOString().slice(0, 10),
      expected_travel_date: "",
      expiry_date: "",
      duration_days: "30",
      selling_price: "0",
      customer_currency: "SAR",
      customer_statement: "",
      payment_method: "cash",
      payment_status: "paid",
      paid_amount: "0",
      remaining_balance: "0",
      invoice_number: "",
      tax_amount: "0",
      affiliation_type: "direct",
      supplier_office_id: "",
      supplier_office_name: "",
      cost_price: "0",
      supplier_currency: "SAR",
      supplier_statement: "",
      supplier_payment_method: "credit",
      supplier_payment_status: "unpaid",
      supplier_paid_amount: "0",
      supplier_remaining_balance: "0",
      agency_commission: "0",
      commission_currency: "SAR",
      commission_statement: "",
      exchange_rate: "1",
      missing_docs: "",
      notes: ""
    });
  };

  const handleEdit = (v: any) => {
    setEditingVisa(v);
    const sell = Number(v.selling_price ?? 0);
    const method = v.payment_method || "cash";
    const paid = Number(v.paid_amount ?? (method === "credit" ? 0 : sell));
    const rem = Number(v.remaining_balance ?? Math.max(0, sell - paid));
    const status = v.payment_status || (paid >= sell && sell > 0 ? "paid" : (paid > 0 ? "partial" : "unpaid"));

    setForm({
      customer_id: v.customer_id ? String(v.customer_id) : "",
      passenger_id: v.passenger_id ? String(v.passenger_id) : "",
      country: v.country || "المملكة العربية السعودية",
      visa_type: v.visa_type || "1- تأشيرة عمرة",
      status: v.status || "under_process",
      application_date: v.application_date || new Date().toISOString().slice(0, 10),
      expected_travel_date: v.expected_travel_date || "",
      expiry_date: v.expiry_date || "",
      duration_days: String(v.duration_days ?? 30),
      selling_price: String(sell),
      customer_currency: v.customer_currency || "SAR",
      customer_statement: v.customer_statement || "",
      payment_method: method,
      payment_status: status,
      paid_amount: String(paid),
      remaining_balance: String(rem),
      invoice_number: v.invoice_number || "",
      tax_amount: String(v.tax_amount ?? 0),
      affiliation_type: v.supplier_office_id ? "agency" : "direct",
      supplier_office_id: v.supplier_office_id ? String(v.supplier_office_id) : "",
      supplier_office_name: v.supplier_office_name || "",
      cost_price: String(v.cost_price ?? 0),
      supplier_currency: v.supplier_currency || "SAR",
      supplier_statement: v.supplier_statement || "",
      supplier_payment_method: v.supplier_payment_method || "credit",
      supplier_payment_status: v.supplier_payment_status || "unpaid",
      supplier_paid_amount: String(v.supplier_paid_amount ?? 0),
      supplier_remaining_balance: String(v.supplier_remaining_balance ?? (v.cost_price ?? 0)),
      agency_commission: String(v.agency_commission ?? ((v.selling_price || 0) - (v.cost_price || 0))),
      commission_currency: v.commission_currency || v.customer_currency || "SAR",
      commission_statement: v.commission_statement || "",
      exchange_rate: String(v.exchange_rate ?? 1),
      missing_docs: v.missing_docs || "",
      notes: v.notes || ""
    });
    setModalOpen(true);
  };

  // Payment status change handler
  const handlePaymentStatusChange = (status: string) => {
    const sell = Number(form.selling_price || 0);
    if (status === "paid") {
      setForm(f => ({ ...f, payment_status: status, paid_amount: String(sell), remaining_balance: "0" }));
    } else if (status === "unpaid") {
      setForm(f => ({ ...f, payment_status: status, paid_amount: "0", remaining_balance: String(sell) }));
    } else {
      const paid = Number(form.paid_amount || 0);
      setForm(f => ({ ...f, payment_status: status, remaining_balance: String(Math.max(0, sell - paid)) }));
    }
  };

  // Payment method change handler
  const handlePaymentMethodChange = (method: string) => {
    const sell = Number(form.selling_price || 0);
    if (method === "credit") {
      setForm(f => ({
        ...f,
        payment_method: method,
        paid_amount: "0",
        remaining_balance: String(sell),
        payment_status: "unpaid"
      }));
    } else {
      setForm(f => ({
        ...f,
        payment_method: method,
        paid_amount: String(sell),
        remaining_balance: "0",
        payment_status: "paid"
      }));
    }
  };

  // Paid amount change handler
  const handlePaidAmountChange = (val: string) => {
    const paid = Number(val || 0);
    const sell = Number(form.selling_price || 0);
    const rem = Math.max(0, sell - paid);
    const status = paid >= sell && sell > 0 ? "paid" : (paid > 0 ? "partial" : "unpaid");
    setForm(f => ({
      ...f,
      paid_amount: val,
      remaining_balance: String(rem),
      payment_status: status
    }));
  };

  // Auto statement generation helper
  const autoGenerateStatements = (custName: string, paxName: string, vType: string, offName: string) => {
    const custText = `قيمة إصدار ${vType} للمسافر (${paxName || custName || "العميل"})`;
    const offText = `رسوم إصدار ${vType} عبر ${offName || "المكتب المفوض"} للمسافر (${paxName || custName || "العميل"})`;
    setForm(f => ({
      ...f,
      customer_statement: f.customer_statement || custText,
      supplier_statement: f.supplier_statement || offText
    }));
  };

  // Auto calculate commission when selling or cost price changes
  const handleSellingPriceChange = (val: string) => {
    const sell = Number(val || 0);
    const cost = Number(form.cost_price || 0);
    const comm = sell - cost;
    setForm(f => {
      const isCredit = f.payment_method === "credit";
      const paid = isCredit ? Number(f.paid_amount || 0) : sell;
      const rem = Math.max(0, sell - paid);
      const status = paid >= sell && sell > 0 ? "paid" : (paid > 0 ? "partial" : "unpaid");
      return {
        ...f,
        selling_price: val,
        paid_amount: String(paid),
        remaining_balance: String(rem),
        payment_status: status,
        agency_commission: String(comm >= 0 ? comm : 0)
      };
    });
  };

  const handleCostPriceChange = (val: string) => {
    const cost = Number(val || 0);
    const sell = Number(form.selling_price || 0);
    const comm = sell - cost;
    setForm(f => ({
      ...f,
      cost_price: val,
      agency_commission: String(comm >= 0 ? comm : 0)
    }));
  };

  const appendMissingDoc = (doc: string) => {
    setForm(f => {
      if (!f.missing_docs) return { ...f, missing_docs: doc };
      if (f.missing_docs.includes(doc)) return f;
      return { ...f, missing_docs: `${f.missing_docs} + ${doc}` };
    });
  };

  // Multi-Currency KPI Summaries Calculation
  const currencyTotals = useMemo(() => {
    const totals: Record<string, { sales: number; cost: number; comm: number; count: number }> = {
      SAR: { sales: 0, cost: 0, comm: 0, count: 0 },
      USD: { sales: 0, cost: 0, comm: 0, count: 0 },
      YER: { sales: 0, cost: 0, comm: 0, count: 0 }
    };

    visas.forEach(v => {
      const cCurr = v.customer_currency || "SAR";
      const sCurr = v.supplier_currency || "SAR";
      const commCurr = v.commission_currency || cCurr || "SAR";

      if (totals[cCurr]) totals[cCurr].sales += Number(v.selling_price || 0);
      if (totals[sCurr]) totals[sCurr].cost += Number(v.cost_price || 0);
      if (totals[commCurr]) totals[commCurr].comm += Number(v.agency_commission ?? ((v.selling_price || 0) - (v.cost_price || 0)));
      if (totals[cCurr]) totals[cCurr].count += 1;
    });

    return totals;
  }, [visas]);

  const costNum = Number(form.cost_price || 0);
  const sellNum = Number(form.selling_price || 0);
  const commNum = Number(form.agency_commission || 0);

  return (
    <AdminLayout>
      <div className="space-y-5 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-primary/10 text-primary">
                <Globe className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  معاملات وخدمات التأشيرات المتطورة (Visa Services & Delegated Offices)
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  نظام الطرفين (العميل والمكتب المفوض)، دعم متعدد العملات (ريال سعودي، دولار، ريال يمني)، ومتابعة العمولات والوثائق
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => { setAutoLinkModalOpen(true); loadGateways(); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow text-xs h-10 px-4"
            >
              <Zap className="w-4 h-4 text-amber-300 animate-bounce" /> بوابة الربط والواتساب
            </Button>
            <Button
              onClick={() => { resetForm(); setModalOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-white font-bold gap-1.5 shadow text-xs h-10 px-4"
            >
              <Plus className="w-4 h-4" /> إضافة معاملة تأشيرة جديدة
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="gap-1.5 text-xs h-10 border-slate-300"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-3.5 h-3.5" /> تحديث
            </Button>
          </div>
        </div>

        {/* Toggle View Mode */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm gap-2 print:hidden">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setViewMode("workflow")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "workflow"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Globe className="w-4 h-4" />
              تقرير وتتبع المعاملات الأربع (الخطوات التأسيسية)
            </button>
            <button
              onClick={() => setViewMode("standard")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                viewMode === "standard"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              السجل المحاسبي والتفصيلي العام
            </button>
          </div>
          <span className="text-[11px] text-slate-500 font-medium pl-2">
            {viewMode === "workflow" 
              ? "وضع التتبع النشط: تتبع وترحيل دفعات السفارات خطوة بخطوة بدقة متناهية" 
              : "وضع الدفاتر: مراجعة وتدقيق الحسابات والوثائق وعمولات الوكالات والشركاء"
            }
          </span>
        </div>

        {/* Multi-Currency Financial KPI Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Saudi Riyal (SAR) */}
          <Card className="border-amber-200 bg-amber-50/40 p-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <span>🇸🇦</span>
                <span>إجماليات بالريال السعودي (SAR)</span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                {currencyTotals.SAR.count} معاملة
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
              <div className="bg-white/80 p-2 rounded border border-amber-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي المبيعات</span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {currencyTotals.SAR.sales.toLocaleString()} <span className="text-[9px]">ر.س</span>
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded border border-amber-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي التكلفة</span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {currencyTotals.SAR.cost.toLocaleString()} <span className="text-[9px]">ر.س</span>
                </span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold block">صافي العمولات</span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  {currencyTotals.SAR.comm.toLocaleString()} <span className="text-[9px]">ر.س</span>
                </span>
              </div>
            </div>
          </Card>

          {/* Card 2: US Dollar (USD) */}
          <Card className="border-blue-200 bg-blue-50/40 p-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                <span>🇺🇸</span>
                <span>إجماليات بالدولار الأمريكي (USD)</span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                {currencyTotals.USD.count} معاملة
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
              <div className="bg-white/80 p-2 rounded border border-blue-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي المبيعات</span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  ${currencyTotals.USD.sales.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded border border-blue-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي التكلفة</span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  ${currencyTotals.USD.cost.toLocaleString()}
                </span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold block">صافي العمولات</span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  ${currencyTotals.USD.comm.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Card 3: Yemeni Riyal (YER) */}
          <Card className="border-teal-200 bg-teal-50/40 p-3.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-teal-900 text-xs">
                <span>🇾🇪</span>
                <span>إجماليات بالريال اليمني (YER)</span>
              </div>
              <span className="text-[11px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                {currencyTotals.YER.count} معاملة
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
              <div className="bg-white/80 p-2 rounded border border-teal-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي المبيعات</span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {currencyTotals.YER.sales.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                </span>
              </div>
              <div className="bg-white/80 p-2 rounded border border-teal-100">
                <span className="text-[10px] text-muted-foreground block">إجمالي التكلفة</span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {currencyTotals.YER.cost.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                </span>
              </div>
              <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold block">صافي العمولات</span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  {currencyTotals.YER.comm.toLocaleString()} <span className="text-[9px]">ر.ي</span>
                </span>
              </div>
            </div>
          </Card>
        </div>

        {viewMode === "workflow" ? (
          <div className="space-y-4">
            {/* 1. Sleek Search Filter Box (as in the images, styled with a distinct background) */}
            <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl shadow-sm text-slate-800 space-y-3 print:bg-white print:border-none print:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">شاشة تتبع المعاملات - فلاتر البحث والتقارير</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  نظام الأربع خطوات
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">رقم العميل</label>
                  <Input
                    type="text"
                    value={reportCustomerId}
                    onChange={(e) => setReportCustomerId(e.target.value)}
                    placeholder="مثال: 41"
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">اسم العميل</label>
                  <Input
                    type="text"
                    value={reportCustomerName}
                    onChange={(e) => setReportCustomerName(e.target.value)}
                    placeholder="البحث بالاسم..."
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">رقم الهاتف</label>
                  <Input
                    type="text"
                    value={reportCustomerPhone}
                    onChange={(e) => setReportCustomerPhone(e.target.value)}
                    placeholder="رقم الهاتف..."
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">رقم الجواز</label>
                  <Input
                    type="text"
                    value={reportPassportNum}
                    onChange={(e) => setReportPassportNum(e.target.value)}
                    placeholder="رقم جواز السفر..."
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">رقم التأشيرة</label>
                  <Input
                    type="text"
                    value={reportVisaNum}
                    onChange={(e) => setReportVisaNum(e.target.value)}
                    placeholder="رقم التأشيرة..."
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 block">رقم السجل</label>
                  <Input
                    type="text"
                    value={reportRegisterNum}
                    onChange={(e) => setReportRegisterNum(e.target.value)}
                    placeholder="رقم السجل المرجعي..."
                    className="h-8 text-xs bg-white border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => refetch()}
                      variant="outline"
                      type="button"
                      className="bg-indigo-50 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 h-8 text-xs flex items-center justify-center gap-1"
                    >
                      <Search className="w-3.5 h-3.5" /> بحث
                    </Button>
                    <Button
                      onClick={() => window.print()}
                      variant="outline"
                      type="button"
                      className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 h-8 text-xs flex items-center justify-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" /> طباعة
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Beautiful step-by-step navigation tabs (matching user's pictures) */}
            <div className="border-b border-slate-200 flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-lg border print:hidden">
              <button
                onClick={() => { setActiveWorkflowTab("new"); setSelectedVisaIds([]); }}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeWorkflowTab === "new"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                🏢 جديدة (في المكتب)
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeWorkflowTab === "new" ? "bg-white text-indigo-600" : "bg-slate-200 text-slate-800"}`}>
                  {visas.filter(v => v.status === "in_office" || v.status === "new").length}
                </span>
              </button>

              <button
                onClick={() => { setActiveWorkflowTab("outward"); setSelectedVisaIds([]); }}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeWorkflowTab === "outward"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                ✈️ الصادرة (في السفارة)
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeWorkflowTab === "outward" ? "bg-white text-indigo-600" : "bg-slate-200 text-slate-800"}`}>
                  {visas.filter(v => v.status === "under_process" || v.status === "outward").length}
                </span>
              </button>

              <button
                onClick={() => { setActiveWorkflowTab("inward"); setSelectedVisaIds([]); }}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeWorkflowTab === "inward"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                📥 الواردة (جاهزة بالمكتب)
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeWorkflowTab === "inward" ? "bg-white text-indigo-600" : "bg-slate-200 text-slate-800"}`}>
                  {visas.filter(v => v.status === "approved" || v.status === "rejected" || v.status === "inward_ready" || v.status === "inward_returned").length}
                </span>
              </button>

              <button
                onClick={() => { setActiveWorkflowTab("delivered"); setSelectedVisaIds([]); }}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeWorkflowTab === "delivered"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                🤝 المستلمة (سلمت للعميل)
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeWorkflowTab === "delivered" ? "bg-white text-indigo-600" : "bg-slate-200 text-slate-800"}`}>
                  {visas.filter(v => v.status === "delivered" || v.status === "received_by_client").length}
                </span>
              </button>

              <button
                onClick={() => { setActiveWorkflowTab("movement"); setSelectedVisaIds([]); }}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeWorkflowTab === "movement"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                🔄 الحركة العامة والتدقيق
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                  {visas.length}
                </span>
              </button>
            </div>

            {/* 3. Sleek horizontal Action Toolbar for batch transitions (matching images) */}
            {activeWorkflowTab !== "movement" && (
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleResetSelectedVisas}
                    variant="outline"
                    type="button"
                    className="h-8 w-8 p-0 rounded-full bg-red-100 text-red-700 hover:bg-red-200 border-red-300 flex items-center justify-center"
                    title="إعادة تعيين أو إلغاء تحديد المعاملات المحددة"
                  >
                    <XCircle className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={handleBatchStatusTransition}
                    disabled={isTransitioning || selectedVisaIds.length === 0}
                    variant="outline"
                    type="button"
                    className="h-8 w-8 p-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center"
                    title="ترقية وترحيل الدفعات إلى المرحلة التالية"
                  >
                    <CheckCheck className="w-5 h-5" />
                  </Button>
                  {(activeWorkflowTab === "outward" || activeWorkflowTab === "inward") && (
                    <Button
                      onClick={handleExportCSV}
                      variant="outline"
                      type="button"
                      className="h-8 w-8 p-0 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300 flex items-center justify-center"
                      title="تصدير الجدول الحالي بصيغة إكسل Excel"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <span className="text-xs font-bold text-amber-800">
                    {selectedVisaIds.length > 0 
                      ? `تم تحديد ${selectedVisaIds.length} معاملة للتأشير والترحيل` 
                      : "يرجى تحديد المعاملات من الجدول لتفعيل الترحيل الجماعي"
                    }
                  </span>
                </div>

                {/* Input Fields specific to the active tab */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                  {activeWorkflowTab === "new" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">تاريخ الصادر:</label>
                        <Input
                          type="date"
                          value={wfOutwardDate}
                          onChange={e => setWfOutwardDate(e.target.value)}
                          className="h-7 w-32 text-[11px] px-1.5 bg-white border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">رقم السند:</label>
                        <Input
                          type="text"
                          value={wfOutwardVoucherNo}
                          onChange={e => setWfOutwardVoucherNo(e.target.value)}
                          placeholder="رقم السند..."
                          className="h-7 w-28 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">رقم الدفعة:</label>
                        <Input
                          type="text"
                          value={wfBatchNumber}
                          onChange={e => setWfBatchNumber(e.target.value)}
                          placeholder="رقم الدفعة..."
                          className="h-7 w-24 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">البيان:</label>
                        <Input
                          type="text"
                          value={wfOutwardNote}
                          onChange={e => setWfOutwardNote(e.target.value)}
                          placeholder="أدخل البيان..."
                          className="h-7 w-40 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                    </>
                  )}

                  {activeWorkflowTab === "outward" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">تاريخ الصادر:</label>
                        <Input
                          type="date"
                          value={wfOutwardDate}
                          onChange={e => setWfOutwardDate(e.target.value)}
                          className="h-7 w-32 text-[11px] px-1.5 bg-white border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">رقم السند:</label>
                        <Input
                          type="text"
                          value={wfOutwardVoucherNo}
                          onChange={e => setWfOutwardVoucherNo(e.target.value)}
                          placeholder="رقم السند..."
                          className="h-7 w-28 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">رقم الدفعة:</label>
                        <Input
                          type="text"
                          value={wfBatchNumber}
                          onChange={e => setWfBatchNumber(e.target.value)}
                          placeholder="رقم الدفعة..."
                          className="h-7 w-24 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">البيان:</label>
                        <Input
                          type="text"
                          value={wfOutwardNote}
                          onChange={e => setWfOutwardNote(e.target.value)}
                          placeholder="البيان..."
                          className="h-7 w-40 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                    </>
                  )}

                  {activeWorkflowTab === "inward" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">الحالة:</label>
                        <select
                          value={wfInwardStatus}
                          onChange={e => setWfInwardStatus(e.target.value)}
                          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-900"
                        >
                          <option value="approved">🟢 جاهز (مؤشرة)</option>
                          <option value="rejected">🔴 مرتجع (مرفوضة)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">تاريخ الوارد:</label>
                        <Input
                          type="date"
                          value={wfInwardDate}
                          onChange={e => setWfInwardDate(e.target.value)}
                          className="h-7 w-32 text-[11px] px-1.5 bg-white border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">البيان الوارد:</label>
                        <Input
                          type="text"
                          value={wfInwardNote}
                          onChange={e => setWfInwardNote(e.target.value)}
                          placeholder="ملاحظات الوارد..."
                          className="h-7 w-40 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">القسم:</label>
                        <select
                          value={wfDepartment}
                          onChange={e => setWfDepartment(e.target.value)}
                          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-900"
                        >
                          <option value="عام">عام</option>
                          <option value="سفارات">سفارات</option>
                          <option value="سياحة">سياحة</option>
                        </select>
                      </div>
                    </>
                  )}

                  {activeWorkflowTab === "delivered" && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">تاريخ التسليم:</label>
                        <Input
                          type="date"
                          value={wfDeliveryDate}
                          onChange={e => setWfDeliveryDate(e.target.value)}
                          className="h-7 w-32 text-[11px] px-1.5 bg-white border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">النوع:</label>
                        <select
                          value={wfDeliveryType}
                          onChange={e => setWfDeliveryType(e.target.value)}
                          className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-900"
                        >
                          <option value="باليد">🤝 باليد بالفرع</option>
                          <option value="ارسال بالبريد">📬 إرسال بالبريد/شحن</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="font-bold text-slate-700">اسم المستلم:</label>
                        <Input
                          type="text"
                          value={wfReceiverName}
                          onChange={e => setWfReceiverName(e.target.value)}
                          placeholder="اسم الشخص المستلم..."
                          className="h-7 w-48 text-[11px] px-1.5 bg-white border-slate-300 text-slate-900"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 4. Dynamic Data Table corresponding to selected tab columns */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-10 text-center text-slate-500 font-bold">جاري تحميل المعاملات والتقارير...</div>
              ) : filteredVisasForWorkflow.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold">لا توجد معاملات مسجلة تطابق محددات البحث في هذه المرحلة.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-50 border-b text-slate-700 font-bold">
                      {activeWorkflowTab === "new" && (
                        <tr>
                          <th className="p-3 text-center w-12 print:hidden">
                            <input
                              type="checkbox"
                              checked={selectedVisaIds.length > 0 && selectedVisaIds.length === filteredVisasForWorkflow.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVisaIds(filteredVisasForWorkflow.map(v => v.id));
                                } else {
                                  setSelectedVisaIds([]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="p-3">رقم العميل</th>
                          <th className="p-3">اسم العميل</th>
                          <th className="p-3">الجواز</th>
                          <th className="p-3">نوع الخدمة</th>
                          <th className="p-3">البلد</th>
                          <th className="p-3">نوع التأشيرة</th>
                          <th className="p-3">تاريخ التقديم</th>
                          <th className="p-3">سعر البيع</th>
                          <th className="p-3">الدفعة المسددة</th>
                          <th className="p-3">رقم الطلب (التأشيرة)</th>
                        </tr>
                      )}

                      {activeWorkflowTab === "outward" && (
                        <tr>
                          <th className="p-3 text-center w-12 print:hidden">
                            <input
                              type="checkbox"
                              checked={selectedVisaIds.length > 0 && selectedVisaIds.length === filteredVisasForWorkflow.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVisaIds(filteredVisasForWorkflow.map(v => v.id));
                                } else {
                                  setSelectedVisaIds([]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="p-3">رقم العميل</th>
                          <th className="p-3">اسم العميل</th>
                          <th className="p-3">الجواز</th>
                          <th className="p-3">السجل</th>
                          <th className="p-3">رقم الدفعة</th>
                          <th className="p-3">رقم السند</th>
                          <th className="p-3">تاريخ الصادر</th>
                          <th className="p-3">نوع الخدمة</th>
                          <th className="p-3">الوكيل</th>
                          <th className="p-3">التأشيرة</th>
                          <th className="p-3">البيان</th>
                          <th className="p-3">رقم الطلب</th>
                        </tr>
                      )}

                      {activeWorkflowTab === "inward" && (
                        <tr>
                          <th className="p-3 text-center w-12 print:hidden">
                            <input
                              type="checkbox"
                              checked={selectedVisaIds.length > 0 && selectedVisaIds.length === filteredVisasForWorkflow.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVisaIds(filteredVisasForWorkflow.map(v => v.id));
                                } else {
                                  setSelectedVisaIds([]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="p-3">رقم العميل</th>
                          <th className="p-3">اسم العميل</th>
                          <th className="p-3">الجواز</th>
                          <th className="p-3">التأشيرة</th>
                          <th className="p-3">الوكيل</th>
                          <th className="p-3">نوع الخدمة</th>
                          <th className="p-3">تاريخ الوارد</th>
                          <th className="p-3">رقم السند</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">بيان الوارد</th>
                          <th className="p-3">رقم الطلب</th>
                        </tr>
                      )}

                      {activeWorkflowTab === "delivered" && (
                        <tr>
                          <th className="p-3 text-center w-12 print:hidden">
                            <input
                              type="checkbox"
                              checked={selectedVisaIds.length > 0 && selectedVisaIds.length === filteredVisasForWorkflow.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVisaIds(filteredVisasForWorkflow.map(v => v.id));
                                } else {
                                  setSelectedVisaIds([]);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="p-3">رقم العميل</th>
                          <th className="p-3">اسم العميل</th>
                          <th className="p-3">الجواز</th>
                          <th className="p-3">التأشيرة</th>
                          <th className="p-3">السجل</th>
                          <th className="p-3">رقم الدفعة</th>
                          <th className="p-3">نوع الخدمة</th>
                          <th className="p-3">تاريخ التسليم</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">المستلم</th>
                          <th className="p-3">تاريخ الوارد</th>
                          <th className="p-3">بيان الوارد</th>
                          <th className="p-3">رقم الطلب</th>
                        </tr>
                      )}

                      {activeWorkflowTab === "movement" && (
                        <tr>
                          <th className="p-3">رقم المعاملة</th>
                          <th className="p-3">العميل</th>
                          <th className="p-3">المسافر والجواز</th>
                          <th className="p-3">التأشيرة والبلد</th>
                          <th className="p-3">المرحلة الحالية</th>
                          <th className="p-3">سجل الملاحظات والحركة</th>
                          <th className="p-3 text-center">الإجراء</th>
                        </tr>
                      )}
                    </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-900">
                    {filteredVisasForWorkflow.map((v, idx) => {
                      const isSelected = selectedVisaIds.includes(v.id);
                      return (
                        <tr 
                          key={`wf-visa-${v.id || idx}-${idx}`} 
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          {activeWorkflowTab === "new" && (
                            <>
                              <td className="p-3 text-center print:hidden">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVisaIds([...selectedVisaIds, v.id]);
                                    } else {
                                      setSelectedVisaIds(selectedVisaIds.filter(id => id !== v.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700">#{v.customer_id || "-"}</td>
                              <td className="p-3 font-bold text-slate-900">{v.customer_name || "عميل عام"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.passport_number || "-"}</td>
                              <td className="p-3 text-slate-600">تأشيرة سياحية</td>
                              <td className="p-3 font-bold text-slate-800">{v.country}</td>
                              <td className="p-3">
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                  {v.visa_type}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600">{v.application_date || "-"}</td>
                              <td className="p-3 font-mono font-bold text-emerald-700">{Number(v.selling_price || 0).toLocaleString()} {v.customer_currency}</td>
                              <td className="p-3 font-mono text-indigo-700">{Number(v.paid_amount || 0).toLocaleString()} {v.customer_currency}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{v.visa_number}</td>
                            </>
                          )}

                          {activeWorkflowTab === "outward" && (
                            <>
                              <td className="p-3 text-center print:hidden">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVisaIds([...selectedVisaIds, v.id]);
                                    } else {
                                      setSelectedVisaIds(selectedVisaIds.filter(id => id !== v.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700">#{v.customer_id || "-"}</td>
                              <td className="p-3 font-bold text-slate-900">{v.customer_name || "عميل عام"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.passport_number || "-"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.service_voucher_no || "-"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.batch_number || wfBatchNumber || "-"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.outward_voucher_no || wfOutwardVoucherNo || "-"}</td>
                              <td className="p-3 text-slate-600">{v.outward_date || wfOutwardDate || "-"}</td>
                              <td className="p-3 text-slate-600">تأشيرة سياحية</td>
                              <td className="p-3 font-bold text-slate-800">{v.supplier_office_name || "وكالة مباشرة"}</td>
                              <td className="p-3 font-bold text-indigo-800">{v.visa_type}</td>
                              <td className="p-3 text-slate-500 max-w-xs truncate" title={v.notes}>{v.notes || "-"}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{v.visa_number}</td>
                            </>
                          )}

                          {activeWorkflowTab === "inward" && (
                            <>
                              <td className="p-3 text-center print:hidden">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVisaIds([...selectedVisaIds, v.id]);
                                    } else {
                                      setSelectedVisaIds(selectedVisaIds.filter(id => id !== v.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700">#{v.customer_id || "-"}</td>
                              <td className="p-3 font-bold text-slate-900">{v.customer_name || "عميل عام"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.passport_number || "-"}</td>
                              <td className="p-3 font-bold text-indigo-800">{v.visa_type}</td>
                              <td className="p-3 font-bold text-slate-800">{v.supplier_office_name || "وكالة مباشرة"}</td>
                              <td className="p-3 text-slate-600">تأشيرة سياحية</td>
                              <td className="p-3 text-slate-600">{v.inward_date || "-"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.outward_voucher_no || "-"}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.status === "approved" || v.status === "inward_ready"
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {v.status === "approved" || v.status === "inward_ready" ? "🟢 جاهز" : "🔴 مرتجع"}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500 max-w-xs truncate" title={v.inward_note}>{v.inward_note || "-"}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{v.visa_number}</td>
                            </>
                          )}

                          {activeWorkflowTab === "delivered" && (
                            <>
                              <td className="p-3 text-center print:hidden">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVisaIds([...selectedVisaIds, v.id]);
                                    } else {
                                      setSelectedVisaIds(selectedVisaIds.filter(id => id !== v.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-700">#{v.customer_id || "-"}</td>
                              <td className="p-3 font-bold text-slate-900">{v.customer_name || "عميل عام"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.passport_number || "-"}</td>
                              <td className="p-3 font-bold text-indigo-800">{v.visa_type}</td>
                              <td className="p-3 font-mono text-slate-600">{v.service_voucher_no || "-"}</td>
                              <td className="p-3 font-mono text-slate-600">{v.batch_number || "-"}</td>
                              <td className="p-3 text-slate-600">تأشيرة سياحية</td>
                              <td className="p-3 text-slate-600">{v.delivery_date || "-"}</td>
                              <td className="p-3">
                                <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold text-[10px]">
                                  🤝 تم التسليم للعميل
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-800">{v.delivered_to || "-"}</td>
                              <td className="p-3 text-slate-600">{v.inward_date || "-"}</td>
                              <td className="p-3 text-slate-500 max-w-xs truncate" title={v.inward_note}>{v.inward_note || "-"}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{v.visa_number}</td>
                            </>
                          )}

                          {activeWorkflowTab === "movement" && (
                            <>
                              <td className="p-3 font-mono font-bold text-indigo-600">{v.visa_number}</td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{v.customer_name || "عميل عام"}</div>
                                <div className="text-[10px] text-slate-500 font-mono">📱 {v.customer_phone || "-"}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">{v.passenger_name_ar || "نفس العميل"}</div>
                                <div className="text-[10px] text-slate-500 font-mono font-bold">📄 {v.passport_number || "-"}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{v.visa_type}</div>
                                <div className="text-[10px] text-slate-500">🌍 {v.country}</div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                  v.status === "in_office" || v.status === "new"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : v.status === "under_process" || v.status === "outward"
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : v.status === "approved" || v.status === "inward_ready"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : v.status === "delivered" || v.status === "received_by_client"
                                    ? "bg-teal-100 text-teal-800 border border-teal-200"
                                    : "bg-red-100 text-red-800 border border-red-200"
                                }`}>
                                  {v.status === "in_office" || v.status === "new" ? "🏢 في المكتب" : ""}
                                  {v.status === "under_process" || v.status === "outward" ? "✈️ الصادرة (السفارة)" : ""}
                                  {v.status === "approved" || v.status === "inward_ready" ? "🟢 الواردة (جاهز)" : ""}
                                  {v.status === "rejected" || v.status === "inward_returned" ? "🔴 الواردة (مرتجع)" : ""}
                                  {v.status === "delivered" || v.status === "received_by_client" ? "🤝 المستلمة" : ""}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 max-w-md break-all text-[11px]">
                                {v.notes || <span className="text-slate-400 font-normal">لا توجد حركات مسجلة</span>}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenAction(v)}
                                  className="h-7 px-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold gap-1"
                                >
                                  <Edit2 className="w-3 h-3" /> تحديث تفصيلي
                                </Button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
          <>
            <Card className="p-4 border shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {/* Search Input */}
                <div className="lg:col-span-2 relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم التأشيرة، اسم العميل، المسافر، الجواز، المكتب المفوض..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-9 text-xs h-10 text-slate-900"
                  />
                </div>

                {/* Visa Type Filter */}
                <div>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-slate-900"
                  >
                    <option value="all">جميع أنواع التأشيرات</option>
                    {VISA_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Office Filter */}
                <div>
                  <select
                    value={officeFilter}
                    onChange={e => setOfficeFilter(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-slate-900"
                  >
                    <option value="all">جميع المكاتب المفوضة</option>
                    {partnerOffices.map((po: any, idx: number) => (
                      <option key={`po-opt-${po.id || idx}-${idx}`} value={po.id}>🏢 {po.name}</option>
                    ))}
                  </select>
                </div>

                {/* Currency Filter */}
                <div>
                  <select
                    value={currencyFilter}
                    onChange={e => setCurrencyFilter(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-slate-900"
                  >
                    <option value="all">جميع العملات (SAR / USD / YER)</option>
                    <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                    <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                    <option value="YER">🇾🇪 ريال يمني (YER)</option>
                  </select>
                </div>

                {/* Payment Method Filter (طريقة الدفع) */}
                <div>
                  <select
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-bold text-slate-900"
                  >
                    <option value="all">جميع طرق الدفع</option>
                    <option value="cash">💵 نقداً</option>
                    <option value="credit">⏳ آجل (على الحساب / ذمم)</option>
                    <option value="bank">🏦 تحويل بنكي</option>
                    <option value="card">💳 شبكة / مدى</option>
                  </select>
                </div>
              </div>

              {/* Quick Payment & Status Filter Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t">
                <span className="text-[11px] font-bold text-slate-700 ml-1">طريقة الدفع:</span>
                {[
                  { key: "all", label: "الكل", count: visas.length, color: "bg-slate-100 text-slate-800" },
                  { key: "cash", label: "💵 نقداً", count: visas.filter(v => v.payment_method === 'cash' || !v.payment_method).length, color: "bg-emerald-50 text-emerald-900 border-emerald-300" },
                  { key: "credit", label: "⏳ آجل (ذمم)", count: visas.filter(v => v.payment_method === 'credit').length, color: "bg-amber-50 text-amber-900 border-amber-300" },
                  { key: "bank", label: "🏦 تحويل بنكي", count: visas.filter(v => v.payment_method === 'bank').length, color: "bg-blue-50 text-blue-900 border-blue-300" },
                  { key: "card", label: "💳 شبكة", count: visas.filter(v => v.payment_method === 'card').length, color: "bg-purple-50 text-purple-900 border-purple-300" }
                ].map(pTab => (
                  <button
                    key={pTab.key}
                    type="button"
                    onClick={() => setPaymentFilter(pTab.key)}
                    className={`text-xs px-2.5 py-1 rounded-md font-bold border transition-all flex items-center gap-1.5 ${
                      paymentFilter === pTab.key
                        ? "ring-2 ring-emerald-600 bg-emerald-100 text-emerald-950 font-extrabold shadow-xs"
                        : "opacity-80 hover:opacity-100"
                    } ${pTab.color}`}
                  >
                    <span>{pTab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-white/80 rounded-full font-mono font-bold">
                      {pTab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick Status Filter Tabs (الكل، في المكتب، قيد المعالجة، مؤشرة، مسلمة للعميل، مرفوضة...) */}
              <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-3 border-t">
                <span className="text-[11px] font-bold text-slate-700 ml-1">حالة المعاملة:</span>
                {[
                  { key: "all", label: "الكل", count: visas.length, color: "bg-slate-100 text-slate-800 hover:bg-slate-200" },
                  { key: "in_office", label: "🏢 في المكتب", count: visas.filter(v => v.status === 'in_office').length, color: "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200" },
                  { key: "under_process", label: "⏳ قيد المعالجة", count: visas.filter(v => v.status === 'under_process').length, color: "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200" },
                  { key: "approved", label: "✅ مؤشرة / صادرة", count: visas.filter(v => v.status === 'approved' || v.status === 'issued').length, color: "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200" },
                  { key: "delivered", label: "🤝 مسلمة للعميل", count: visas.filter(v => v.status === 'delivered').length, color: "bg-teal-100 text-teal-900 border-teal-300 hover:bg-teal-200" },
                  { key: "rejected", label: "❌ مرفوضة", count: visas.filter(v => v.status === 'rejected').length, color: "bg-red-100 text-red-900 border-red-300 hover:bg-red-200" },
                  { key: "pending_docs", label: "⚠️ بانتظار الوثائق", count: visas.filter(v => v.status === 'pending_docs').length, color: "bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-200" },
                  { key: "cancelled", label: "🚫 ملغية ومردودة", count: visas.filter(v => v.status === 'cancelled').length, color: "bg-slate-200 text-slate-800 hover:bg-slate-300" }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold border transition-all flex items-center gap-1.5 ${
                      statusFilter === tab.key
                        ? "ring-2 ring-primary ring-offset-1 shadow-sm font-extrabold"
                        : "opacity-80 hover:opacity-100"
                    } ${tab.color}`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-white/80 rounded-full font-mono font-bold shadow-xs">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Visas Data Table */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    سجل معاملات التأشيرات والإجراءات ({visas.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    إدارة دورة حياة التأشيرة (في المكتب ⬅️ قيد المعالجة ⬅️ مؤشرة ⬅️ مسلمة للعميل ⬅️ مرفوضة أو مردودة)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/travel-refunds">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 h-8 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" /> فواتير ومردود الخدمات
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="text-xs gap-1 h-8 border-slate-300"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> تصدير Excel
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-12 text-center text-muted-foreground text-xs">جاري تحميل معاملات التأشيرات...</div>
                ) : visas.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground space-y-3">
                    <Globe className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-semibold">لا توجد معاملات تأشيرات مطابقة لمعايير البحث</p>
                    <Button
                      onClick={() => { resetForm(); setModalOpen(true); }}
                      className="bg-primary text-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> تسجيل معاملة جديدة
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse text-slate-900">
                      <thead>
                        <tr className="bg-slate-100/80 border-b text-slate-700 font-bold text-[11px]">
                          <th className="p-3">رقم المعاملة / التاريخ</th>
                          <th className="p-3">الطرف الأول (العميل)</th>
                          <th className="p-3">المسافر والجواز</th>
                          <th className="p-3">نوع التأشيرة / الدولة</th>
                          <th className="p-3">الطرف الثاني (المكتب المفوض)</th>
                          <th className="p-3">الجانب المالي (البيع والتكلفة)</th>
                          <th className="p-3">عمولة المكتب والربح</th>
                          <th className="p-3">حالة المعاملة والتأشيرة</th>
                          <th className="p-3 text-center">الإجراءات والعمليات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {visas.map((v, idx) => {
                          const badge = VISA_STATUS[v.status] || { label: v.status, class: "bg-slate-100 text-slate-800", icon: "📄" };
                          const custCurr = v.customer_currency || "SAR";
                          const suppCurr = v.supplier_currency || "SAR";
                          const commCurr = v.commission_currency || custCurr || "SAR";
                          const commVal = Number(v.agency_commission ?? ((v.selling_price || 0) - (v.cost_price || 0)));

                          return (
                            <tr key={`v-row-${v.id || idx}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              {/* Col 1: Transaction Number & Date */}
                              <td className="p-3">
                                <div className="font-mono font-bold text-primary">{v.visa_number}</div>
                                {v.service_voucher_no && (
                                  <div className="text-[10px] font-mono text-slate-600 font-semibold mt-0.5">
                                    مرجع: {v.service_voucher_no}
                                  </div>
                                )}
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" /> {v.application_date || "-"}
                                </div>
                              </td>

                              {/* Col 2: Party 1 (Customer & Statement) */}
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{v.customer_name || "عميل عام"}</div>
                                {v.customer_phone && <div className="text-[10px] font-mono text-muted-foreground">📱 {v.customer_phone}</div>}
                                {v.customer_statement && (
                                  <div className="text-[10px] text-slate-600 bg-slate-100/80 p-1 rounded mt-1 border border-slate-200 line-clamp-2" title={v.customer_statement}>
                                    📝 {v.customer_statement}
                                  </div>
                                )}
                              </td>

                              {/* Col 3: Passenger & Passport */}
                              <td className="p-3">
                                <div className="font-bold text-slate-800">
                                  {v.passenger_name_ar || v.passenger_name_en || v.customer_name || "نفس العميل"}
                                </div>
                                {v.passport_number ? (
                                  <div className="text-[10px] font-mono text-muted-foreground">
                                    📄 جواز: <span className="font-bold text-slate-700">{v.passport_number}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">-</span>
                                )}
                              </td>

                              {/* Col 4: Visa Type & Country */}
                              <td className="p-3">
                                <span className="inline-block font-bold text-slate-900 bg-amber-50 text-amber-950 px-2 py-0.5 rounded border border-amber-200">
                                  {v.visa_type}
                                </span>
                                <div className="text-[11px] text-muted-foreground mt-1">🌍 {v.country}</div>
                              </td>

                              {/* Col 5: Party 2 (Delegated Office & Statement) */}
                              <td className="p-3">
                                <div className="font-bold text-slate-900 flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-slate-500" />
                                  <span>{v.supplier_office_official_name || v.supplier_office_name || "وكالتنا المباشرة"}</span>
                                </div>
                                {v.supplier_statement && (
                                  <div className="text-[10px] text-slate-600 bg-slate-100/80 p-1 rounded mt-1 border border-slate-200 line-clamp-2" title={v.supplier_statement}>
                                    📋 {v.supplier_statement}
                                  </div>
                                )}
                              </td>

                              {/* Col 6: Financials (Sale & Cost with Multi-Currency) */}
                              <td className="p-3 font-mono text-xs">
                                <div className="flex items-center justify-between text-emerald-800 font-bold">
                                  <span className="text-[10px] text-muted-foreground font-sans">سعر البيع:</span>
                                  <span>{Number(v.selling_price || 0).toLocaleString()} {custCurr}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-700 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground font-sans">التكلفة:</span>
                                  <span>{Number(v.cost_price || 0).toLocaleString()} {suppCurr}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1 font-sans">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    v.payment_method === 'credit'
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : v.payment_method === 'bank'
                                      ? "bg-blue-100 text-blue-900 border border-blue-300"
                                      : v.payment_method === 'card'
                                      ? "bg-purple-100 text-purple-900 border border-purple-300"
                                      : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                  }`}>
                                    {v.payment_method === 'credit' ? "⏳ آجل (ذمم)" : v.payment_method === 'bank' ? "🏦 تحويل بنكي" : v.payment_method === 'card' ? "💳 شبكة" : "💵 نقداً"}
                                  </span>
                                  {Number(v.paid_amount || 0) > 0 && (
                                    <span className="text-[9px] text-slate-600 font-mono font-bold">
                                      (مسدد: {Number(v.paid_amount).toLocaleString()})
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Col 7: Agency Commission & Profit */}
                              <td className="p-3 font-mono text-xs">
                                <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded text-center">
                                  <span className="text-[10px] font-sans text-emerald-800 block">عمولة وكالتنا</span>
                                  <span className="font-bold text-emerald-700 text-sm">
                                    {commVal.toLocaleString()} {commCurr}
                                  </span>
                                </div>
                              </td>

                              {/* Col 8: Status Badge with Rich Details (مؤشرة، مرفوضة، مسلمة) */}
                              <td className="p-3">
                                <div className="space-y-1">
                                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border inline-flex items-center gap-1 shadow-xs ${badge.class}`}>
                                    <span>{badge.icon}</span>
                                    <span>{badge.label}</span>
                                  </span>

                                  {/* If Issued / Approved */}
                                  {(v.status === 'approved' || v.status === 'issued') && (
                                    <div className="text-[10px] bg-emerald-50 border border-emerald-200 p-1 rounded font-mono text-emerald-950 font-bold">
                                      <span>رقم التأشيرة: </span>
                                      <span className="text-emerald-700">{v.issued_visa_number || v.visa_number}</span>
                                      {v.issue_date && <span className="block text-[9px] text-muted-foreground font-sans">بتاريخ: {v.issue_date}</span>}
                                    </div>
                                  )}

                                  {/* If Rejected */}
                                  {v.status === 'rejected' && (
                                    <div className="text-[10px] bg-red-50 border border-red-200 p-1 rounded text-red-950 font-bold">
                                      <span className="font-bold">سبب الرفض: </span>
                                      <span>{v.rejection_reason || "نقص وثائق/أسباب قنصلية"}</span>
                                      {v.rejection_date && <span className="block text-[9px] text-muted-foreground">بتاريخ: {v.rejection_date}</span>}
                                    </div>
                                  )}

                                  {/* If Delivered */}
                                  {v.status === 'delivered' && (
                                    <div className="text-[10px] bg-teal-50 border border-teal-200 p-1 rounded text-teal-950 font-bold">
                                      <span className="font-bold">المستلم: </span>
                                      <span>{v.delivered_to || v.passenger_name_ar || v.customer_name || "العميل"}</span>
                                      {v.delivery_date && <span className="block text-[9px] text-muted-foreground">بتاريخ: {v.delivery_date}</span>}
                                    </div>
                                  )}

                                  {v.missing_docs && v.status === 'pending_docs' && (
                                    <div className="text-[10px] text-amber-900 bg-amber-50 p-1 rounded border border-amber-200 line-clamp-1" title={v.missing_docs}>
                                      ⚠️ ناقص: {v.missing_docs}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Col 9: Action Buttons */}
                              <td className="p-3 text-center">
                                <div className="flex flex-col gap-1.5 items-center justify-center">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5 shadow-sm border border-amber-600/40 w-full"
                                    onClick={() => handleOpenAction(v)}
                                    title="تغيير حالة المعاملة (مؤشرة، مرفوضة، مسلمة للعميل...)"
                                  >
                                    <Zap className="w-3.5 h-3.5 fill-slate-950" /> إجراءات
                                  </Button>

                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-1.5 text-[10px] font-bold border-slate-300 hover:bg-slate-100"
                                      onClick={() => setPrintVisa(v)}
                                      title="طباعة سند معاملة تأشيرة رسمي"
                                    >
                                      <Printer className="w-3 h-3" /> سند
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                                      onClick={() => handleEdit(v)}
                                      title="تعديل المعاملة"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        if (confirm(`هل أنت متأكد من حذف معاملة التأشيرة رقم "${v.visa_number}"؟`)) {
                                          deleteMutation.mutate(v.id);
                                        }
                                      }}
                                      title="حذف المعاملة"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
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
          </>
        )}

        {/* Bottom Quick Search & Action Bar (كما طلب المستخدم في نهاية الشاشة) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-lg">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs font-bold">إدارة عمليات التأشيرات والمكاتب المفوضة</p>
              <p className="text-[11px] text-slate-400">إجمالي المعاملات المسجلة: {visas.length} معاملة بالعملات (SAR, USD, YER)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                refetch();
              }}
              variant="outline"
              className="text-xs font-bold gap-1 bg-slate-800 hover:bg-slate-700 text-white border-slate-600 flex-1 sm:flex-initial"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" /> بحث وتحديث المعاملات السابقة
            </Button>
            <Button
              onClick={() => { resetForm(); setModalOpen(true); }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4" /> إضافة معاملة جديدة ➕
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN VISA REGISTRATION / EDIT MODAL (نموذج تسجيل وتعديل معاملة التأشيرة) */}
        {/* ========================================================================= */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-5xl h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-50/50" dir="rtl">
            <DialogHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-5 py-3 shrink-0 flex items-center justify-between border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {editingVisa ? `تعديل معاملة التأشيرة (${editingVisa.visa_number})` : "تسجيل معاملة تأشيرة جديدة (نظام الطرفين المتكامل)"}
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-400 font-medium">
                    يرجى تحديد بيانات العميل وسعر البيع والمورد، مع اختيار العملة المطلوبة واحتساب العمولة.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-100/70">
                
                {saveError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                    <button type="button" onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-700">
                      ✕
                    </button>
                  </div>
                )}

              {/* قسم أفقي 1: نظام الطرفين الماليين جنباً إلى جنب */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* الطرف الأول: العميل */}
                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-blue-900 text-sm flex items-center gap-2 border-b border-blue-200 pb-2 mb-3">
                      <User className="w-5 h-5 text-blue-600" />
                      الطرف الأول: بيانات العميل والبيع (Customer & Sales)
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>العميل الدافع (Customer) *</span>
                          <button type="button" onClick={() => setQuickCustomerModalOpen(true)} className="text-[10px] text-blue-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          required
                          value={form.customer_id}
                          onChange={e => {
                            const newCustId = e.target.value;
                            setForm(f => ({ ...f, customer_id: newCustId }));
                            const cust = customers.find((c: any) => String(c.id) === newCustId)?.name;
                            const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                            const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                            autoGenerateStatements(cust, pax, form.visa_type, off);
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs font-bold"
                        >
                          <option value="">-- اختر العميل الدافع --</option>
                          {customers.map((c: any, idx: number) => (
                            <option key={`v-cust-${c.id || idx}-${idx}`} value={c.id}>
                              {c.name} {c.phone ? `(${c.phone})` : ""} {c.affiliation_type === 'agency' ? `🏬 [تابع لمكتب: ${c.office_name || 'وكيل وسيط'}]` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                          <span>اسم المسافر (Passenger)</span>
                          <button type="button" onClick={() => setQuickPassengerModalOpen(true)} className="text-[10px] text-emerald-600 hover:underline">
                            + جديد
                          </button>
                        </label>
                        <select
                          value={form.passenger_id}
                          onChange={e => {
                            const newPaxId = e.target.value;
                            setForm(f => ({ ...f, passenger_id: newPaxId }));
                            const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                            const pax = passengers.find((p: any) => String(p.id) === newPaxId)?.name_ar;
                            const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                            autoGenerateStatements(cust, pax, form.visa_type, off);
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs"
                        >
                          <option value="">نفس العميل الدافع (Self)</option>
                          {passengers.map((p: any, idx: number) => (
                            <option key={`v-pax-${p.id || idx}-${idx}`} value={p.id}>{p.name_ar}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">سعر البيع للعميل *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.selling_price}
                          onChange={e => handleSellingPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة العميل *</label>
                        <select
                          required
                          value={form.customer_currency}
                          onChange={e => setForm(f => ({ ...f, customer_currency: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">طريقة سداد العميل *</label>
                        {selectedCustomerAffiliation === 'agency' && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                            🏬 عميل تابع لمكتب وسيط
                          </span>
                        )}
                      </div>
                      <select
                        required
                        value={form.payment_method}
                        onChange={e => handlePaymentMethodChange(e.target.value)}
                        className={`flex h-9 w-full rounded-md border px-2 text-xs font-bold ${
                          selectedCustomerAffiliation === 'agency' && form.payment_method === 'credit'
                            ? 'border-purple-500 bg-purple-50 text-purple-950 font-black'
                            : 'border-input bg-white'
                        }`}
                      >
                        <option value="cash">نقداً (Cash)</option>
                        {selectedCustomerAffiliation === 'agency' ? (
                          <option value="credit">
                            🏢 آجل على حساب المكتب الوسيط ({selectedCustomerObj?.office_name || "الوكيل الوسيط"})
                          </option>
                        ) : (
                          <option value="credit">آجل على حساب العميل (Credit - ذمم مدينة 11200)</option>
                        )}
                        <option value="bank">تحويل بنكي (Bank Transfer)</option>
                        <option value="card">بطاقة دفع (Card)</option>
                        <option value="cheque">شيك (Cheque)</option>
                      </select>

                      {/* تنبيه محاسبي وأمني توضيحي للعميل التابع */}
                      {selectedCustomerAffiliation === 'agency' && form.payment_method === 'credit' && (
                        <div className="mt-1.5 p-2 bg-purple-50/90 border border-purple-200 rounded-lg text-[10px] text-purple-950 flex items-start gap-1.5 leading-relaxed">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                          <span>
                            <strong>حماية محاسبية مشددة:</strong> نظراً لأن العميل (<strong>{selectedCustomerObj?.name}</strong>) تابع لمكتب (<strong>{selectedCustomerObj?.office_name || 'الوكيل الوسيط'}</strong>)، فإن اختيار طريقة الدفع الآجل يوجه القيد مباشرة لكشف حساب المكتب الوسيط بدليل الحسابات برقم (<strong>{selectedCustomerObj?.account_code || '11200'}</strong>) ويمنع النظام تماماً إنشاء أي حساب فردي للعميل.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المبلغ المدفوع</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={form.paid_amount}
                          onChange={e => handlePaidAmountChange(e.target.value)}
                          disabled={form.payment_method === 'credit'}
                          className="h-9 bg-white font-mono text-xs disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المتبقي</label>
                        <Input
                          type="number"
                          value={form.remaining_balance}
                          readOnly
                          className="h-9 bg-slate-100 font-mono text-xs text-rose-700 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي للعميل</label>
                    <Input
                      placeholder="رسوم تأشيرة فلان الفلاني..."
                      value={form.customer_statement}
                      onChange={e => setForm(f => ({ ...f, customer_statement: e.target.value }))}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>

                {/* الطرف الثاني: المورد/المكتب */}
                <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-emerald-900 text-sm flex items-center justify-between border-b border-emerald-200 pb-2 mb-3">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                        الطرف الثاني: بيانات المكتب المفوض والتكلفة (Supplier/Agent)
                      </span>
                      <button type="button" onClick={() => setQuickOfficeModalOpen(true)} className="text-xs text-emerald-700 bg-white border border-emerald-300 rounded px-2 py-0.5 hover:bg-emerald-100">
                        + مكتب/مورد جديد
                      </button>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">طريقة التقديم والتفويض</label>
                        <select
                          value={form.affiliation_type}
                          onChange={e => setForm(f => ({ ...f, affiliation_type: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          <option value="agency">عبر مكتب مفوض (وكيل / مورد)</option>
                          <option value="direct">مباشر للسفارة (بدون مكتب وسيط)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">المكتب المفوض / المورد (دليل الحسابات) *</label>
                        <select
                          required
                          value={form.supplier_office_id}
                          onChange={e => {
                            const newSuppId = e.target.value;
                            const offObj = allSuppliersAndOffices.find((o: any) => String(o.id) === newSuppId);
                            const offName = offObj?.name || "";
                            setForm(f => ({ 
                              ...f, 
                              supplier_office_id: newSuppId,
                              supplier_office_name: offName
                            }));
                            const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                            const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                            autoGenerateStatements(cust, pax, form.visa_type, offName);
                          }}
                          className="flex h-9 w-full rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-950"
                        >
                          <option value="">-- اختر المكتب أو المورد --</option>
                          {allSuppliersAndOffices.map((o: any, idx: number) => (
                            <option key={`v-supp-${o.id || idx}-${idx}`} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">تكلفة التأشيرة (Cost) *</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={form.cost_price}
                          onChange={e => handleCostPriceChange(e.target.value)}
                          className="h-9 bg-white font-mono font-bold text-xs text-emerald-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">عملة التكلفة *</label>
                        <select
                          required
                          value={form.supplier_currency}
                          onChange={e => setForm(f => ({ ...f, supplier_currency: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">طريقة سداد المورد *</label>
                        <select
                          required
                          value={form.supplier_payment_method}
                          onChange={e => setForm(f => ({ ...f, supplier_payment_method: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-emerald-300 bg-white px-2 text-xs font-bold text-emerald-900"
                        >
                          <option value="credit">آجل على حساب المورد (Credit)</option>
                          <option value="cash">نقداً من الصندوق (Cash)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">بيان القيد المحاسبي للمكتب / السفارة</label>
                    <Input
                      placeholder="تكلفة تأشيرة فلان الفلاني..."
                      value={form.supplier_statement}
                      onChange={e => setForm(f => ({ ...f, supplier_statement: e.target.value }))}
                      className="h-9 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 2: تفاصيل التأشيرة */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    بيانات وتفاصيل التأشيرة الأساسية
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">نوع التأشيرة *</label>
                    <select
                      required
                      value={form.visa_type}
                      onChange={e => {
                        const newType = e.target.value;
                        setForm(f => ({ ...f, visa_type: newType }));
                        const cust = customers.find((c: any) => String(c.id) === form.customer_id)?.name;
                        const pax = passengers.find((p: any) => String(p.id) === form.passenger_id)?.name_ar;
                        const off = allSuppliersAndOffices.find((o: any) => String(o.id) === form.supplier_office_id)?.name;
                        autoGenerateStatements(cust, pax, newType, off);
                      }}
                      className="flex h-8 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-slate-900 focus:ring-amber-500"
                    >
                      {VISA_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">الدولة المطلوبة *</label>
                    <Input
                      required
                      placeholder="السعودية / مصر / تركيا..."
                      value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      className="text-xs h-8 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">مدة التأشيرة (بالأيام)</label>
                    <Input
                      type="number"
                      value={form.duration_days}
                      onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-indigo-900 mb-1 block">تاريخ التقديم *</label>
                    <Input
                      required
                      type="date"
                      value={form.application_date}
                      onChange={e => setForm(f => ({ ...f, application_date: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono text-indigo-950 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">تاريخ السفر المتوقع</label>
                    <Input
                      type="date"
                      value={form.expected_travel_date}
                      onChange={e => setForm(f => ({ ...f, expected_travel_date: e.target.value }))}
                      className="text-xs h-8 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* قسم أفقي 3: الأرباح والملاحظات */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Auto Calculated Commission Card */}
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      صافي عمولة وأرباح المعاملة
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                      {Number(form.selling_price) > 0 ? `${(((Number(form.selling_price) - Number(form.cost_price)) / Number(form.selling_price)) * 100).toFixed(1)}% هامش` : '0%'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">الربح (البيع - التكلفة):</span>
                    <span className="text-base font-black font-mono text-amber-700">
                      {(Number(form.selling_price) - Number(form.cost_price)).toLocaleString()} {form.customer_currency}
                    </span>
                  </div>

                  <div className="mt-2">
                    <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">بيان العمولة</label>
                    <Input
                      placeholder="عمولة وأتعاب استخراج تأشيرة"
                      value={form.commission_statement}
                      onChange={e => setForm(f => ({ ...f, commission_statement: e.target.value }))}
                      className="bg-white text-xs h-7"
                    />
                  </div>
                </div>

                {/* Booking Status & Issue Date */}
                <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    حالة وموقع المعاملة الحالية
                  </span>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-0.5 block">حالة المعاملة *</label>
                    <select
                      required
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-bold text-slate-900"
                    >
                      <option value="in_office">🏢 في المكتب الخاص بنا (قيد التجهيز)</option>
                      <option value="under_process">⏳ قيد المعالجة (سفارة/مكتب مفوض)</option>
                      <option value="pending_docs">⚠️ بانتظار الوثائق والمستندات</option>
                      <option value="appointment_booked">📅 تم حجز موعد البصمة</option>
                      <option value="approved">✅ تم إصدار التأشيرة بنجاح</option>
                      <option value="delivered">🤝 تم التسليم للعميل</option>
                      <option value="rejected">❌ مرفوضة من السفارة</option>
                      <option value="cancelled">🚫 ملغية</option>
                    </select>
                  </div>
                </div>

                {/* Notes & Missing Docs */}
                <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2 flex flex-col justify-between">
                  <label className="text-xs font-bold text-slate-700 block">ملاحظات ومستندات ناقصة</label>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات حول المعاملة..."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-md border border-input bg-white p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 mb-1"
                  />
                  <Input
                    placeholder="المستندات الناقصة (كشف حساب، صور...)"
                    value={form.missing_docs}
                    onChange={e => setForm(f => ({ ...f, missing_docs: e.target.value }))}
                    className="bg-white text-xs h-7"
                  />
                </div>
              </div>
            </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4 bg-slate-50/70 p-3 rounded-b-xl">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start">
                  {/* زر حذف المعاملة */}
                  {editingVisa ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف معاملة التأشيرة نهائياً؟`)) {
                          deleteMutation.mutate(editingVisa.id);
                          setModalOpen(false);
                        }
                      }}
                      className="font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف المعاملة 🗑️
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (confirm("هل تريد إفراغ كافة الحقول وإعادة الضبط؟")) {
                          resetForm();
                        }
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs gap-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                      إفراغ الحقول 🔄
                    </Button>
                  )}
                </div>

                {/* Right side actions: Save and Cancel */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs font-bold h-9">
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 shadow-md gap-1.5 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saveMutation.isPending ? "جاري الحفظ..." : editingVisa ? "حفظ التعديلات ✅" : "حفظ المعاملة وتوثيق القيد ➕"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Automated Email Linking & WhatsApp Integration Gateway Control Panel */}
        <Dialog open={autoLinkModalOpen} onOpenChange={(open) => { setAutoLinkModalOpen(open); if(!open) refetch(); }}>
          <DialogContent className="max-w-3xl bg-slate-900 text-white border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader className="pb-4 border-b border-slate-800">
              <DialogTitle className="text-lg font-black flex items-center gap-2.5 text-indigo-400">
                <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                <span>بوابة الربط الذكي للتأشيرات والواتساب (Email & WhatsApp Integration Hub)</span>
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-1">
                تفعيل المطابقة التلقائية لتأشيرات المعتمرين مع الحسابات المالية للعملاء والوكلاء عبر البريد الإلكتروني، وإدارة بوابات الواتساب لضمان التسليم الآلي.
              </DialogDescription>
            </DialogHeader>

            {/* Hub Navigation Tabs */}
            <div className="flex border-b border-slate-800 mb-4 mt-2 overflow-x-auto gap-1">
              <button
                onClick={() => setAutoLinkTab("config_wa")}
                className={`py-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  autoLinkTab === "config_wa"
                    ? "border-emerald-500 text-emerald-400 font-black bg-slate-800/40"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                ⚙️ إعدادات الواتساب
              </button>
              <button
                onClick={() => setAutoLinkTab("config_email")}
                className={`py-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  autoLinkTab === "config_email"
                    ? "border-blue-500 text-blue-400 font-black bg-slate-800/40"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                ✉️ إعدادات البريد
              </button>
              <button
                onClick={() => setAutoLinkTab("scan")}
                className={`py-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  autoLinkTab === "scan"
                    ? "border-indigo-500 text-indigo-400 font-black bg-slate-800/40"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                🔍 فحص ومطابقة الموجود
              </button>
              <button
                onClick={() => setAutoLinkTab("simulate")}
                className={`py-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  autoLinkTab === "simulate"
                    ? "border-purple-500 text-purple-400 font-black bg-slate-800/40"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                🧪 محاكاة استلام بريد
              </button>
              <button
                onClick={() => setAutoLinkTab("whatsapp")}
                className={`py-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                  autoLinkTab === "whatsapp"
                    ? "border-amber-500 text-amber-400 font-black bg-slate-800/40"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-amber-400" />
                ⚡ إرسال تجريبي
              </button>
            </div>

            <div className="space-y-4">
              {/* Save Feedback Banner */}
              {saveGwMessage && (
                <div className={`p-3 rounded-xl border text-xs font-bold animate-in fade-in ${
                  saveGwMessage.includes("✅")
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  {saveGwMessage}
                </div>
              )}

              {/* Tab 1: WhatsApp Configuration */}
              {autoLinkTab === "config_wa" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-emerald-400" />
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm">تهيئة بوابة الواتساب التلقائية (WhatsApp Meta Cloud API)</h3>
                          <p className="text-[11px] text-slate-400">أدخل بيانات الاعتماد والمفاتيح الرسمية من Meta/Facebook لإرسال إشعارات وتأكيدات الحجز والبيانات المالية للعملاء فوراً.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          waGwState.is_enabled
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}>
                          {waGwState.is_enabled ? "🟢 نشطة ومفعلة" : "🔴 متوقفة"}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={waGwState.is_enabled}
                            onChange={(e) => setWaGwState({ ...waGwState, is_enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">نوع المزود (Provider)</label>
                        <select
                          value={waGwState.provider_key}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWaGwState({
                              ...waGwState,
                              provider_key: val,
                              provider_name: val === "whatsapp_meta" ? "Meta WhatsApp Cloud API (الرسمي)" : val === "infobip" ? "Infobip WhatsApp & SMS" : "Twilio WhatsApp API"
                            });
                          }}
                          className="w-full h-8 rounded-md bg-slate-900 border border-slate-700 px-2 text-xs text-white focus:ring-emerald-500"
                        >
                          <option value="whatsapp_meta">Meta WhatsApp Cloud API (الرسمي - مجاني)</option>
                          <option value="infobip">Infobip WhatsApp Multi-Channel</option>
                          <option value="twilio">Twilio Business WhatsApp</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">اسم البوابة بالنظام</label>
                        <Input
                          value={waGwState.provider_name}
                          onChange={(e) => setWaGwState({ ...waGwState, provider_name: e.target.value })}
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                          <span>رمز الوصول السري (Permanent System User Access Token)</span>
                          <span className="text-[10px] text-emerald-400 font-normal">تُستخرج من Meta Developer Console</span>
                        </label>
                        <Input
                          type="password"
                          dir="ltr"
                          value={waGwState.api_key}
                          onChange={(e) => setWaGwState({ ...waGwState, api_key: e.target.value })}
                          placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">معرّف رقم الهاتف (Phone Number ID)</label>
                        <Input
                          dir="ltr"
                          value={waGwState.sender_id}
                          onChange={(e) => setWaGwState({ ...waGwState, sender_id: e.target.value })}
                          placeholder="e.g. 105544332211000"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">معرّف حساب الأعمال (WhatsApp Business Account ID)</label>
                        <Input
                          dir="ltr"
                          value={waGwState.account_id}
                          onChange={(e) => setWaGwState({ ...waGwState, account_id: e.target.value })}
                          placeholder="e.g. 109283746501928"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                          <span>رابط الاستقبال التلقائي الـ Webhook (ضع هذا الرابط في إعدادات Meta)</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/api/travel/notifications/webhook/meta`);
                              setSaveGwMessage("📋 تم نسخ رابط الـ Webhook إلى الحافظة بنجاح!");
                            }}
                            className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                          >
                            <Copy className="w-3 h-3" /> نسخ الرابط
                          </button>
                        </label>
                        <Input
                          readOnly
                          dir="ltr"
                          value={`${window.location.origin}/api/travel/notifications/webhook/meta`}
                          className="bg-slate-950 border-slate-800 text-xs h-8 text-indigo-300 text-left cursor-pointer font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/60">
                      <span className="text-[11px] text-slate-400">احفظ البيانات ليتم اعتمادها كبوابة أساسية لإرسال إشعارات التأشيرات فوراً.</span>
                      <Button
                        onClick={saveWaGateway}
                        disabled={isSavingGw}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-6 gap-2 shadow-lg"
                      >
                        {isSavingGw ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        حفظ وتفعيل إعدادات الواتساب
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Email Configuration */}
              {autoLinkTab === "config_email" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-400" />
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm">تهيئة بوابة البريد الإلكتروني والربط الآلي (SMTP Engine)</h3>
                          <p className="text-[11px] text-slate-400">أدخل إعدادات خادم البريد لربط تأشيرات المسافرين الواردة بريدياً بحسابات العملاء تلقائياً وإرسال وثائق التأشيرات.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          emailGwState.is_enabled
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}>
                          {emailGwState.is_enabled ? "🟢 نشطة ومفعلة" : "🔴 متوقفة"}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emailGwState.is_enabled}
                            onChange={(e) => setEmailGwState({ ...emailGwState, is_enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">خادم البريد المرسل (SMTP Host)</label>
                        <Input
                          dir="ltr"
                          value={emailGwState.smtp_host}
                          onChange={(e) => setEmailGwState({ ...emailGwState, smtp_host: e.target.value })}
                          placeholder="e.g. smtp.gmail.com"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">منفذ الاتصال (SMTP Port)</label>
                        <Input
                          dir="ltr"
                          value={emailGwState.smtp_port}
                          onChange={(e) => setEmailGwState({ ...emailGwState, smtp_port: e.target.value })}
                          placeholder="587 / 465"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">البريد الإلكتروني للشركة (Sender Email)</label>
                        <Input
                          dir="ltr"
                          value={emailGwState.sender_id}
                          onChange={(e) => setEmailGwState({ ...emailGwState, sender_id: e.target.value })}
                          placeholder="visas@omnifly.com"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">كلمة مرور التطبيق (App Password)</label>
                        <Input
                          type="password"
                          dir="ltr"
                          value={emailGwState.api_key}
                          onChange={(e) => setEmailGwState({ ...emailGwState, api_key: e.target.value })}
                          placeholder="•••• •••• •••• ••••"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white text-left focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-300">اسم المرسل المكتوب بالبريد (Sender Display Name)</label>
                        <Input
                          value={emailGwState.sender_name}
                          onChange={(e) => setEmailGwState({ ...emailGwState, sender_name: e.target.value })}
                          placeholder="أومني فلاي لخدمات العمرة والتأشيرات"
                          className="bg-slate-900 border-slate-700 text-xs h-8 text-white focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/60">
                      <span className="text-[11px] text-slate-400">تتيح هذه الإعدادات للنظام استيراد التأشيرات وإرسال الفواتير ووثائق العمرة بريدياً.</span>
                      <Button
                        onClick={saveEmailGateway}
                        disabled={isSavingGw}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-6 gap-2 shadow-lg"
                      >
                        {isSavingGw ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        حفظ وتفعيل إعدادات البريد
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {/* Tab 1: Scan Existing */}
              {autoLinkTab === "scan" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-800/50 border border-slate-800 p-4 rounded-xl text-xs space-y-2">
                    <h3 className="font-bold text-slate-200 flex items-center gap-1.5 text-sm">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      كيف تعمل آلية المطابقة الذكية؟
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      يقوم المحرك الذكي بمسح جميع معاملات التأشيرات غير المرتبطة بالعملاء الماليين في شجرة الحسابات، ومطابقتها فوراً مع البريد الإلكتروني للمسافر. بمجرد إيجاد تطابق، يتم:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                      <li>تحديث سجل المعاملة برقم معرف العميل الحقيقي.</li>
                      <li>تأمين التأثير المالي تلقائياً عبر ترحيل قيد استحقاق مزدوج لدفتر الأستاذ الخاص بحساب العميل.</li>
                      <li>إرسال إشعار واتساب تلقائي للعميل بتفاصيل الفاتورة والمستند لراحة بال متكاملة.</li>
                    </ul>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">انقر على الزر لبدء المسح والمطابقة لجميع التأشيرات المعلقة:</span>
                    <Button
                      onClick={async () => {
                        setIsLinking(true);
                        try {
                          const res = await fetchWithAuth<any>("/api/travel/visas/auto-link-email", {
                            method: "POST",
                            body: JSON.stringify({ action: "scan" })
                          });
                          setAutoLinkLogs(res.logs || []);
                        } catch (err: any) {
                          setAutoLinkLogs([`❌ فشل الفحص والربط: ${err.message}`]);
                        } finally {
                          setIsLinking(false);
                        }
                      }}
                      disabled={isLinking}
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-9 px-5 gap-1.5 text-white shadow-lg"
                    >
                      {isLinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      فحص ومطابقة جميع التأشيرات المعلقة
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Simulate Email Ingestion */}
              {autoLinkTab === "simulate" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl text-xs">
                    <p className="text-slate-300">
                      💡 <strong>محاكي سحب البريد الإلكتروني:</strong> يمكنك اختبار استلام تأشيرة جديدة مباشرة من البريد الإلكتروني. أدخل البريد الإلكتروني للمسافر المتطابق مع بريد أحد وكلائك أو عملائك المسجلين لتشاهد كيف يقوم النظام بربطها فوراً، ترحيل قيدها المحاسبي، وتوجيه إشعار واتساب.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">اسم المسافر (المعتمر)</label>
                      <Input
                        value={emailPayload.passenger_name}
                        onChange={(e) => setEmailPayload({ ...emailPayload, passenger_name: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">البريد الإلكتروني للربط (يتطابق مع بريد العميل/الوكيل)</label>
                      <Input
                        dir="ltr"
                        value={emailPayload.passenger_email}
                        onChange={(e) => setEmailPayload({ ...emailPayload, passenger_email: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white text-left focus:ring-indigo-500"
                        placeholder="e.g. agency@email.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">رقم جواز السفر</label>
                      <Input
                        dir="ltr"
                        value={emailPayload.passport_number}
                        onChange={(e) => setEmailPayload({ ...emailPayload, passport_number: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white text-left focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">رقم التأشيرة الصادرة</label>
                      <Input
                        dir="ltr"
                        value={emailPayload.visa_number}
                        onChange={(e) => setEmailPayload({ ...emailPayload, visa_number: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white text-left focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">سعر التكلفة (ريال)</label>
                      <Input
                        type="number"
                        value={emailPayload.cost_price}
                        onChange={(e) => setEmailPayload({ ...emailPayload, cost_price: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">سعر البيع المقيد على العميل (ريال)</label>
                      <Input
                        type="number"
                        value={emailPayload.selling_price}
                        onChange={(e) => setEmailPayload({ ...emailPayload, selling_price: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={async () => {
                        setIsLinking(true);
                        try {
                          const res = await fetchWithAuth<any>("/api/travel/visas/auto-link-email", {
                            method: "POST",
                            body: JSON.stringify({ action: "simulate", emailPayload })
                          });
                          setAutoLinkLogs(res.logs || []);
                        } catch (err: any) {
                          setAutoLinkLogs([`❌ فشل سحب ومحاكاة التأشيرة: ${err.message}`]);
                        } finally {
                          setIsLinking(false);
                        }
                      }}
                      disabled={isLinking}
                      className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-9 px-6 gap-1.5 text-white"
                    >
                      {isLinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-indigo-300" />}
                      استيراد ومحاكاة الربط التلقائي فوراً
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 3: WhatsApp Test */}
              {autoLinkTab === "whatsapp" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl text-xs space-y-1">
                    <p className="text-slate-300">
                      📱 <strong>تأكيد سلامة بوابة الواتساب:</strong> للتأكد من ربط نظام الواتساب التفاعلي دون أي مشاكل، أدخل رقم العميل أو هاتفك الخاص لإجراء فحص إرسال فوري وتأكيد سلامة التكامل مع بوابات التوصيل (Meta Cloud API, Twilio, Infobip).
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">رقم هاتف المستلم (شاملاً رمز الدولة)</label>
                      <Input
                        dir="ltr"
                        value={waTestPhone}
                        onChange={(e) => setWaTestPhone(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-xs h-8 text-white text-left focus:ring-indigo-500"
                        placeholder="e.g. 966500000000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">نص الرسالة</label>
                      <textarea
                        value={waTestMessage}
                        onChange={(e) => setWaTestMessage(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-xs text-white focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    {waTestStatus && (
                      <div className={`p-2.5 rounded-lg border text-xs font-bold ${
                        waTestStatus.includes("نجاح") 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-red-500/10 border-red-500/30 text-red-400"
                      }`}>
                        {waTestStatus}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={async () => {
                          setWaTestStatus("جاري الإرسال والتحقق...");
                          try {
                            const res = await fetchWithAuth<any>("/api/travel/notifications/gateways", {
                              method: "GET"
                            });
                            const defaultGateway = (res || []).find((g: any) => g.is_enabled === 1 && g.channel_types.includes("whatsapp")) || (res || [])[0];
                            
                            if (!defaultGateway) {
                              setWaTestStatus("❌ لم يتم العثور على بوابة واتساب نشطة في النظام. يرجى تهيئتها من شاشة الإعدادات.");
                              return;
                            }

                            // Dispatch test message
                            const testRes = await fetchWithAuth<any>(`/api/travel/notifications/gateways/${defaultGateway.id}/test`, {
                              method: "POST",
                              body: JSON.stringify({ recipient_phone: waTestPhone, message_body: waTestMessage })
                            });

                            if (testRes.success) {
                              setWaTestStatus("✅ تم إرسال رسالة الواتساب بنجاح عبر البوابة النشطة! النظام متصل ومؤمن بالكامل.");
                            } else {
                              setWaTestStatus(`❌ فشل في إرسال الرسالة: ${testRes.errorMessage || "خطأ مجهول"}`);
                            }
                          } catch (err: any) {
                            setWaTestStatus(`❌ خطأ أثناء الاتصال بالخادم: ${err.message}`);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs h-9 px-6 gap-1.5 text-white"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                        إرسال واختبار بوابة الواتساب الآن
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Action logs display */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">سجل المخرجات والربط المالي في الوقت الحقيقي (Live Processing Console):</span>
                  {autoLinkLogs.length > 0 && (
                    <button 
                      onClick={() => setAutoLinkLogs([])}
                      className="text-[10px] text-slate-500 hover:text-slate-300 underline font-bold"
                    >
                      مسح السجل
                    </button>
                  )}
                </div>
                <div className="bg-black/80 border border-slate-800 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs text-indigo-300 space-y-1.5">
                  {autoLinkLogs.length === 0 ? (
                    <div className="text-slate-600 italic text-center pt-16 text-[11px]">
                      بانتظار تنفيذ فحص أو اختبار محاكاة لعرض تفاصيل المعالجة وتحديث قيود دفتر الأستاذ...
                    </div>
                  ) : (
                    autoLinkLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed animate-in fade-in slide-in-from-right-1 duration-150">
                        <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>{" "}
                        <span className={
                          log.includes("❌") ? "text-red-400 font-bold" :
                          log.includes("✅") ? "text-emerald-400 font-bold" :
                          log.includes("🎯") ? "text-amber-400 font-bold" :
                          log.includes("📊") ? "text-indigo-400 font-bold" : "text-indigo-300"
                        }>
                          {log}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800 pt-4 mt-2">
              <Button
                variant="outline"
                onClick={() => { setAutoLinkModalOpen(false); refetch(); }}
                className="text-xs h-8 px-4 border-slate-700 bg-transparent text-slate-400 hover:text-white"
              >
                إغلاق المنصة المحاكية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Add Customer Modal */}
        <Dialog open={quickCustomerModalOpen} onOpenChange={setQuickCustomerModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                إضافة عميل جديد فوري
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                quickCustomerMutation.mutate(quickCustomerForm);
              }}
              className="space-y-3 py-2"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold">اسم العميل *</label>
                <Input
                  required
                  placeholder="مثال: فهد محمد الخالدي"
                  value={quickCustomerForm.name}
                  onChange={e => setQuickCustomerForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">رقم الهاتف / الواتساب *</label>
                <Input
                  required
                  placeholder="0500000000 / 777000000"
                  value={quickCustomerForm.phone}
                  onChange={e => setQuickCustomerForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setQuickCustomerModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={quickCustomerMutation.isPending} className="bg-primary font-bold">
                  {quickCustomerMutation.isPending ? "جاري الحفظ..." : "حفظ واختيار العميل"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Quick Add Passenger Modal */}
        <Dialog open={quickPassengerModalOpen} onOpenChange={setQuickPassengerModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                إضافة مسافر جديد فوري
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                quickPassengerMutation.mutate(quickPassengerForm);
              }}
              className="space-y-3 py-2"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold">الاسم بالعربية *</label>
                <Input
                  required
                  placeholder="مثال: خالد فهد السعيد"
                  value={quickPassengerForm.name_ar}
                  onChange={e => setQuickPassengerForm(f => ({ ...f, name_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">الاسم بالإنجليزية (حسب الجواز)</label>
                <Input
                  placeholder="KHALID FAHAD ALSAEED"
                  value={quickPassengerForm.name_en}
                  onChange={e => setQuickPassengerForm(f => ({ ...f, name_en: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold">رقم الجواز</label>
                  <Input
                    placeholder="A12345678"
                    value={quickPassengerForm.passport_number}
                    onChange={e => setQuickPassengerForm(f => ({ ...f, passport_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">تاريخ انتهاء الجواز</label>
                  <Input
                    type="date"
                    value={quickPassengerForm.passport_expiry_date}
                    onChange={e => setQuickPassengerForm(f => ({ ...f, passport_expiry_date: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setQuickPassengerModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={quickPassengerMutation.isPending} className="bg-primary font-bold">
                  {quickPassengerMutation.isPending ? "جاري الحفظ..." : "حفظ واختيار المسافر"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Quick Add Partner Office Modal */}
        <Dialog open={quickOfficeModalOpen} onOpenChange={setQuickOfficeModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                إضافة مكتب مفوض / وكيل شريك جديد
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                quickOfficeMutation.mutate(quickOfficeForm);
              }}
              className="space-y-3 py-2"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold">اسم المكتب أو الوكالة المفوضة *</label>
                <Input
                  required
                  placeholder="مثال: وكالة الأفق للسفريات والتأشيرات"
                  value={quickOfficeForm.name}
                  onChange={e => setQuickOfficeForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold">المدينة / الدولة</label>
                  <Input
                    placeholder="الرياض / جدة / صنعاء"
                    value={quickOfficeForm.city}
                    onChange={e => setQuickOfficeForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold">رقم الهاتف</label>
                  <Input
                    placeholder="+966 50 0000000"
                    value={quickOfficeForm.phone}
                    onChange={e => setQuickOfficeForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold">الشخص المسؤول / جهة الاتصال</label>
                <Input
                  placeholder="أ. منصور العتيبي"
                  value={quickOfficeForm.contact_person}
                  onChange={e => setQuickOfficeForm(f => ({ ...f, contact_person: e.target.value }))}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setQuickOfficeModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={quickOfficeMutation.isPending} className="bg-primary font-bold">
                  {quickOfficeMutation.isPending ? "جاري الحفظ..." : "حفظ واختيار المكتب"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* VISA ACTION & STATUS DIALOG (نافذة إجراءات وتحديث حالة المعاملة - مؤشرة، مرفوضة، مسلمة) */}
        {/* ========================================================================= */}
        <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-base font-bold flex items-center justify-between text-slate-900">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span>إجراءات وحالة المعاملة ({actionVisa?.visa_number})</span>
                </div>
                {actionVisa && (
                  <span className="text-xs font-mono font-normal bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                    {actionVisa.visa_type}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                المسافر: <strong className="text-slate-800">{actionVisa?.passenger_name_ar || actionVisa?.passenger_name_en || actionVisa?.customer_name}</strong> | العميل: <strong className="text-slate-800">{actionVisa?.customer_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!actionVisa) return;
                const reasonToSave = actionForm.status === 'rejected'
                  ? (actionForm.custom_rejection_reason || actionForm.rejection_reason)
                  : "";
                
                statusActionMutation.mutate({
                  id: actionVisa.id,
                  data: {
                    status: actionForm.status,
                    issued_visa_number: actionForm.issued_visa_number,
                    issue_date: actionForm.issue_date,
                    expiry_date: actionForm.expiry_date,
                    border_number: actionForm.border_number,
                    rejection_reason: reasonToSave,
                    rejection_date: actionForm.rejection_date,
                    delivered_to: actionForm.delivered_to,
                    delivery_date: actionForm.delivery_date,
                    delivery_method: actionForm.delivery_method,
                    delivery_notes: actionForm.delivery_notes,
                    missing_docs: actionForm.missing_docs,
                    notes: actionForm.notes
                  }
                });
              }}
              className="space-y-4 py-2"
            >
              {/* Choose Target Action Status */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  اختر الإجراء أو الحالة الجديدة للمعاملة:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "approved", label: "✅ مؤشرة / صادرة", desc: "تم إصدار التأشيرة بنجاح", color: "border-emerald-500 bg-emerald-50 text-emerald-950" },
                    { id: "rejected", label: "❌ مرفوضة من السفارة", desc: "تم رفض المعاملة مع بيان السبب", color: "border-red-500 bg-red-50 text-red-950" },
                    { id: "delivered", label: "🤝 مسلمة للعميل", desc: "تم تسليم التأشيرة للعميل", color: "border-teal-500 bg-teal-50 text-teal-950" },
                    { id: "under_process", label: "⏳ قيد المعالجة", desc: "بالسفارة أو القنصلية", color: "border-blue-500 bg-blue-50 text-blue-950" },
                    { id: "in_office", label: "🏢 في المكتب", desc: "قيد المراجعة والتجهيز", color: "border-amber-500 bg-amber-50 text-amber-950" },
                    { id: "pending_docs", label: "⚠️ بانتظار الوثائق", desc: "نقص مستندات مطلوبة", color: "border-orange-500 bg-orange-50 text-orange-950" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setActionForm(f => ({ ...f, status: st.id }))}
                      className={`p-2.5 rounded-lg border text-right transition-all flex flex-col justify-between ${
                        actionForm.status === st.id
                          ? `${st.color} ring-2 ring-primary ring-offset-1 font-bold shadow-sm`
                          : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold">{st.label}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC FIELDS: IF APPROVED / ISSUED */}
              {(actionForm.status === "approved" || actionForm.status === "issued") && (
                <div className="p-3.5 rounded-lg border border-emerald-300 bg-emerald-50/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>بيانات التأشيرة الصادرة (مؤشرة):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">رقم التأشيرة الصادرة *</label>
                      <Input
                        required
                        placeholder="مثال: 6019284729"
                        value={actionForm.issued_visa_number}
                        onChange={e => setActionForm(f => ({ ...f, issued_visa_number: e.target.value }))}
                        className="bg-white font-mono font-bold text-emerald-800"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">رقم الحدود / الإقامة (إن وجد)</label>
                      <Input
                        placeholder="مثال: 3091823741"
                        value={actionForm.border_number}
                        onChange={e => setActionForm(f => ({ ...f, border_number: e.target.value }))}
                        className="bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">تاريخ إصدار التأشيرة</label>
                      <Input
                        type="date"
                        value={actionForm.issue_date}
                        onChange={e => setActionForm(f => ({ ...f, issue_date: e.target.value }))}
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">تاريخ انتهاء صلاحية التأشيرة</label>
                      <Input
                        type="date"
                        value={actionForm.expiry_date}
                        onChange={e => setActionForm(f => ({ ...f, expiry_date: e.target.value }))}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC FIELDS: IF REJECTED */}
              {actionForm.status === "rejected" && (
                <div className="p-3.5 rounded-lg border border-red-300 bg-red-50/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>بيانات وأسباب رفض التأشيرة:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">سبب الرفض الرئيسي *</label>
                      <select
                        value={actionForm.rejection_reason}
                        onChange={e => setActionForm(f => ({ ...f, rejection_reason: e.target.value }))}
                        className="w-full h-9 rounded-md border border-input bg-white px-3 text-xs font-semibold text-red-950"
                      >
                        <option value="نقص وثائق ومستندات">نقص وثائق ومستندات</option>
                        <option value="عدم تطابق البصمة أو قيود أمنية">عدم تطابق البصمة أو قيود أمنية</option>
                        <option value="تعارض فترات الإقامة والزيارة السابقة">تعارض فترات الإقامة والزيارة السابقة</option>
                        <option value="صلاحية الجواز أقل من 6 أشهر">صلاحية الجواز أقل من 6 أشهر</option>
                        <option value="رفض قنصلي مباشر من السفارة">رفض قنصلي مباشر من السفارة</option>
                        <option value="سبب آخر مخصص">سبب آخر مخصص (يرجى التدوين أدناه)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">تاريخ الرفض</label>
                      <Input
                        type="date"
                        value={actionForm.rejection_date}
                        onChange={e => setActionForm(f => ({ ...f, rejection_date: e.target.value }))}
                        className="bg-white"
                      />
                    </div>

                    {actionForm.rejection_reason === "سبب آخر مخصص" && (
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-800 block mb-1">اكتب سبب الرفض بالتفصيل</label>
                        <Input
                          placeholder="مثال: تم إرجاع المعاملة لعدم وضوح صورة الجواز أو وجود بلاغ هروب..."
                          value={actionForm.custom_rejection_reason}
                          onChange={e => setActionForm(f => ({ ...f, custom_rejection_reason: e.target.value }))}
                          className="bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DYNAMIC FIELDS: IF DELIVERED */}
              {actionForm.status === "delivered" && (
                <div className="p-3.5 rounded-lg border border-teal-300 bg-teal-50/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                    <CheckCheck className="w-4 h-4 text-teal-600" />
                    <span>بيانات تسليم التأشيرة للعميل:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">اسم المستلم *</label>
                      <Input
                        required
                        placeholder="اسم الشخص الذي استلم التأشيرة"
                        value={actionForm.delivered_to}
                        onChange={e => setActionForm(f => ({ ...f, delivered_to: e.target.value }))}
                        className="bg-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">طريقة التسليم</label>
                      <select
                        value={actionForm.delivery_method}
                        onChange={e => setActionForm(f => ({ ...f, delivery_method: e.target.value }))}
                        className="w-full h-9 rounded-md border border-input bg-white px-3 text-xs font-semibold"
                      >
                        <option value="يداً بيد بالفرع">يداً بيد بالفرع الرئيسي</option>
                        <option value="إرسال عبر الواتساب (PDF)">إرسال عبر الواتساب (PDF)</option>
                        <option value="إرسال عبر البريد الإلكتروني">إرسال عبر البريد الإلكتروني</option>
                        <option value="تسليم لمندوب أو سائق">تسليم لمندوب أو سائق</option>
                        <option value="شحن عبر شركة نقليات">شحن عبر شركة نقليات</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">تاريخ التسليم</label>
                      <Input
                        type="date"
                        value={actionForm.delivery_date}
                        onChange={e => setActionForm(f => ({ ...f, delivery_date: e.target.value }))}
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-800 block mb-1">ملاحظات التسليم</label>
                      <Input
                        placeholder="مثال: تم التأكد من صحة الاسم والمطابقة واستلام العميل للرمز"
                        value={actionForm.delivery_notes}
                        onChange={e => setActionForm(f => ({ ...f, delivery_notes: e.target.value }))}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC FIELDS: IF PENDING DOCS */}
              {actionForm.status === "pending_docs" && (
                <div className="p-3.5 rounded-lg border border-orange-300 bg-orange-50/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-orange-900 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span>تحديد الوثائق والمستندات الناقصة:</span>
                  </div>

                  <div className="space-y-2">
                    <Input
                      placeholder="اكتب النواقص هنا..."
                      value={actionForm.missing_docs}
                      onChange={e => setActionForm(f => ({ ...f, missing_docs: e.target.value }))}
                      className="bg-white text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_MISSING_DOCS.map(doc => (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => {
                            const curr = actionForm.missing_docs ? `${actionForm.missing_docs}، ${doc}` : doc;
                            setActionForm(f => ({ ...f, missing_docs: curr }));
                          }}
                          className="text-[10px] bg-white border border-orange-200 px-2 py-0.5 rounded text-orange-900 hover:bg-orange-100"
                        >
                          + {doc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* General Internal Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ملاحظات إضافية / سجل العملية:
                </label>
                <Input
                  placeholder="أي ملاحظات إدارية أو تتبع..."
                  value={actionForm.notes}
                  onChange={e => setActionForm(f => ({ ...f, notes: e.target.value }))}
                  className="text-xs"
                />
              </div>

              {/* Quick Link to Refund Voucher if Return/Cancellation requested */}
              <div className="p-3 rounded-lg bg-slate-100 border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-slate-700">
                    هل ترغب في كنسلة الخدمة واسترجاع المبلغ مع التأثير المحاسبي؟
                  </span>
                </div>
                <Link href="/travel-refunds">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold border-amber-400 text-amber-900 hover:bg-amber-100"
                  >
                    فاتورة مردود خدمة
                  </Button>
                </Link>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setActionModalOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={statusActionMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 shadow-sm"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  {statusActionMutation.isPending ? "جاري الحفظ والتحديث..." : "حفظ الإجراء وتحديث الحالة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================================= */}
        {/* PRINTABLE VISA VOUCHER DIALOG (سند استلام وقيد معاملة تأشيرة رسمي) */}
        {/* ========================================================================= */}
        <Dialog open={Boolean(printVisa)} onOpenChange={open => !open && setPrintVisa(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Printer className="w-4 h-4 text-primary" />
                سند استلام وقيد معاملة تأشيرة رسمي
              </DialogTitle>
            </DialogHeader>

            {printVisa && (
              <div className="p-4 border rounded-lg bg-white space-y-3.5 text-xs">
                {/* Header Voucher */}
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{docSettings?.company_name_ar || "وكالة السفر والسياحة وخدمات التأشيرات المعتمدة"}</h3>
                    <p className="text-muted-foreground text-[10px]">{docSettings?.company_activity_ar || "قسم المعاملات والسفارات والمكاتب المفوضة"}</p>
                  </div>
                  <div className="text-left font-mono">
                    <p className="font-bold text-primary text-sm">{printVisa.service_voucher_no || printVisa.visa_number}</p>
                    <p className="text-[10px] text-muted-foreground">{printVisa.application_date || new Date().toISOString().slice(0, 10)}</p>
                  </div>
                </div>

                {/* Parties Details */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">الطرف الأول (العميل الدافع):</span>
                    <span className="font-bold text-slate-900">{printVisa.customer_name || "عميل عام"}</span>
                    {printVisa.customer_phone && <span className="block text-[10px] text-muted-foreground font-mono">📱 {printVisa.customer_phone}</span>}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">الطرف الثاني (المكتب المفوض):</span>
                    <span className="font-bold text-slate-900">{printVisa.supplier_office_official_name || printVisa.supplier_office_name || "وكالتنا المباشرة"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">المسافر المتقدم:</span>
                    <span className="font-bold text-slate-900">{printVisa.passenger_name_ar || printVisa.passenger_name_en || printVisa.customer_name}</span>
                    {printVisa.passport_number && <span className="block text-[10px] font-mono font-bold text-slate-700">📄 جواز: {printVisa.passport_number}</span>}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">نوع التأشيرة والوجهة:</span>
                    <span className="font-bold text-primary">{printVisa.visa_type} - {printVisa.country}</span>
                  </div>
                </div>

                {/* Financial Summary & Payment Method */}
                <div className="border p-3 rounded-lg space-y-2 bg-slate-50/70">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-white p-2 rounded border">
                      <span className="text-slate-600 font-bold">طريقة الدفع:</span>
                      <span className="font-bold text-emerald-800">
                        {printVisa.payment_method === 'credit' ? "⏳ آجل (على الحساب)" : printVisa.payment_method === 'bank' ? "🏦 تحويل بنكي" : printVisa.payment_method === 'card' ? "💳 شبكة مدى" : "💵 نقداً"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded border">
                      <span className="text-slate-600 font-bold">إجمالي سعر البيع:</span>
                      <span className="font-bold font-mono text-emerald-700">
                        {Number(printVisa.selling_price || 0).toLocaleString()} {printVisa.customer_currency || "SAR"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-white p-2 rounded border">
                      <span className="text-slate-600 font-bold">المبلغ المدفوع:</span>
                      <span className="font-bold font-mono text-slate-900">
                        {Number(printVisa.paid_amount ?? (printVisa.payment_method === 'credit' ? 0 : printVisa.selling_price || 0)).toLocaleString()} {printVisa.customer_currency || "SAR"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded border">
                      <span className="text-slate-600 font-bold">المتبقي (الذمة):</span>
                      <span className="font-bold font-mono text-amber-800">
                        {Number(printVisa.remaining_balance ?? (printVisa.payment_method === 'credit' ? printVisa.selling_price || 0 : 0)).toLocaleString()} {printVisa.customer_currency || "SAR"}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-slate-600">حالة المعاملة الحالية:</span>
                    <span className="font-bold text-primary">{VISA_STATUS[printVisa.status]?.label || printVisa.status}</span>
                  </div>
                  {printVisa.customer_statement && (
                    <div className="text-[11px] text-slate-700 pt-1 border-t">
                      <span className="font-bold">بيان القيد: </span>{printVisa.customer_statement}
                    </div>
                  )}
                </div>

                {printVisa.missing_docs && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    <p className="font-bold text-[11px]">⚠️ المستندات المطلوبة لاستكمال المعاملة:</p>
                    <p className="text-[10px] mt-0.5">{printVisa.missing_docs}</p>
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t text-[11px] text-slate-600 font-bold">
                  <div>توقيع واستلام العميل: ___________________</div>
                  <div>ختم وتوقيع موظف التأشيرات: ___________________</div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button variant="outline" onClick={() => setPrintVisa(null)}>إغلاق</Button>
              <Button 
                onClick={() => {
                  if (printVisa) handlePrintVisa(printVisa);
                }} 
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 font-bold shadow-md"
              >
                <Printer className="w-4 h-4" /> طباعة السند الرسمية (A4)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
