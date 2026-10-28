import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Search,
  User,
  Trash2,
  Edit,
  Printer,
  FileText,
  CheckCircle2,
  Plane,
  Hotel,
  Globe,
  Truck,
  Compass,
  ShieldCheck,
  Building2,
  Calculator,
  Coins,
  ArrowUpDown,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  RefreshCw,
  Check,
  ExternalLink,
  Filter,
  X,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

async function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

const SERVICE_TYPES = [
  { id: "flight", label: "تذكرة طيران (Airline)", icon: Plane, color: "text-blue-600", bg: "bg-blue-50", defaultAccount: "41000" },
  { id: "hotel", label: "حجز فندق (Hotel)", icon: Hotel, color: "text-amber-600", bg: "bg-amber-50", defaultAccount: "42000" },
  { id: "visa", label: "تأشيرة سفر (Visa)", icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50", defaultAccount: "43000" },
  { id: "transport", label: "تذكرة نقل بري / باص (Bus)", icon: Truck, color: "text-purple-600", bg: "bg-purple-50", defaultAccount: "44000" },
  { id: "package", label: "برنامج سياحي (Package)", icon: Compass, color: "text-cyan-600", bg: "bg-cyan-50", defaultAccount: "40000" },
  { id: "insurance", label: "تأمين سفر (Insurance)", icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50", defaultAccount: "40000" }
];

const CURRENCIES = [
  { code: "SAR", label: "ريال سعودي (SAR)", flag: "🇸🇦", symbol: "ر.س" },
  { code: "USD", label: "دولار أمريكي (USD)", flag: "🇺🇸", symbol: "$" },
  { code: "YER", label: "ريال يمني (YER)", flag: "🇾🇪", symbol: "ر.ي" }
];

export default function TravelInvoicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters state
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Modals state
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Advanced Previous Transactions / Invoices Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTab, setSearchTab] = useState<"invoices" | "accounts">("invoices");
  const [advSearchQuery, setAdvSearchQuery] = useState("");
  const [advDateFrom, setAdvDateFrom] = useState("");
  const [advDateTo, setAdvDateTo] = useState("");
  const [advCurrency, setAdvCurrency] = useState("all");
  const [advPaymentMethod, setAdvPaymentMethod] = useState("all");
  const [advServiceType, setAdvServiceType] = useState("all");
  const [advMinAmount, setAdvMinAmount] = useState("");
  const [advMaxAmount, setAdvMaxAmount] = useState("");
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Quick Customer modal
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });

  // Main Invoice Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerStatement, setCustomerStatement] = useState<string>("");
  const [currency, setCurrency] = useState<string>("SAR");
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Accounts mapping
  const [debitAccountCode, setDebitAccountCode] = useState<string>("11100");
  const [creditAccountCode, setCreditAccountCode] = useState<string>("40000");
  const [commissionAccountCode, setCommissionAccountCode] = useState<string>("45000");
  const [supplierAccountCode, setSupplierAccountCode] = useState<string>("21100");

  // Items State
  const [items, setItems] = useState<any[]>([
    {
      service_type: "flight",
      supplier_type: "airline",
      supplier_id: "",
      supplier_name: "",
      description: "تذكرة طيران الرياض -> دبي (ذهاب وعودة)",
      statement: "قيمة إصدار تذكرة طيران للمسافر",
      passenger_name: "",
      cost_price: 1200,
      service_fees: 50,
      agency_commission: 250,
      selling_price: 1500,
      accounting_impact_account: "41000"
    }
  ]);

  // Queries
  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/travel/invoices"],
    queryFn: () => fetchWithAuth("/api/travel/invoices")
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: airlines = [] } = useQuery<any[]>({
    queryKey: ["airlines-list"],
    queryFn: () => fetchWithAuth("/api/travel/airlines")
  });

  const { data: hotels = [] } = useQuery<any[]>({
    queryKey: ["hotels-db-list"],
    queryFn: () => fetchWithAuth("/api/travel/hotels-db")
  });

  const { data: partnerOffices = [] } = useQuery<any[]>({
    queryKey: ["partner-offices-list"],
    queryFn: () => fetchWithAuth("/api/travel/partner-offices")
  });

  const { data: transportCompanies = [] } = useQuery<any[]>({
    queryKey: ["transport-companies-list"],
    queryFn: () => fetchWithAuth("/api/travel/transport-companies")
  });

  const { data: generalSuppliers = [] } = useQuery<any[]>({
    queryKey: ["suppliers-list"],
    queryFn: () => fetchWithAuth("/api/travel/suppliers")
  });

  const { data: chartAccounts = [] } = useQuery<any[]>({
    queryKey: ["chart-accounts-list"],
    queryFn: () => fetchWithAuth("/api/accounting/accounts")
  });

  const { data: invoiceDetails } = useQuery<any>({
    queryKey: ["/api/travel/invoices", selectedInvoice?.id],
    queryFn: () => {
      if (!selectedInvoice?.id) return null;
      return fetchWithAuth(`/api/travel/invoices/${selectedInvoice.id}`);
    },
    enabled: !!selectedInvoice?.id
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingInvoiceId) {
        return fetchWithAuth(`/api/travel/invoices/${editingInvoiceId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      }
      return fetchWithAuth("/api/travel/invoices", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      toast({
        title: "تم بنجاح ✅",
        description: editingInvoiceId
          ? "تم تحديث فاتورة المبيعات المركزية بنجاح"
          : "تم إصدار فاتورة المبيعات وترحيل القيود المحاسبية بالدليل بنجاح"
      });
      setOpenCreateModal(false);
      resetInvoiceForm();
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "حدث خطأ أثناء حفظ الفاتورة",
        variant: "destructive"
      });
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/invoices"] });
      toast({ title: "تم الحذف", description: "تم حذف فاتورة المبيعات المركزية بنجاح" });
      setDeleteConfirmId(null);
    }
  });

  const quickCustomerMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newCust: any) => {
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      setQuickCustomerModalOpen(false);
      setCustomerId(String(newCust.id));
      setCustomerName(newCust.name);
      setQuickCustomerForm({ name: "", phone: "", customer_type: "individual", affiliation_type: "direct" });
      toast({ title: "تمت الإضافة", description: `تمت إضافة العميل ${newCust.name} بنجاح` });
    }
  });

  // Helper functions
  const resetInvoiceForm = () => {
    setEditingInvoiceId(null);
    setCustomerId("");
    setCustomerName("");
    setCustomerStatement("");
    setCurrency("SAR");
    setExchangeRate(1.0);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("cash");
    setDiscount(0);
    setPaidAmount(0);
    setNotes("");
    setDebitAccountCode("11100");
    setCreditAccountCode("40000");
    setCommissionAccountCode("45000");
    setSupplierAccountCode("21100");
    setItems([
      {
        service_type: "flight",
        supplier_type: "airline",
        supplier_id: "",
        supplier_name: "",
        description: "تذكرة طيران الرياض -> دبي (ذهاب وعودة)",
        statement: "قيمة إصدار تذكرة طيران للمسافر",
        passenger_name: "",
        cost_price: 1200,
        service_fees: 50,
        agency_commission: 250,
        selling_price: 1500,
        accounting_impact_account: "41000"
      }
    ]);
  };

  const handleOpenEdit = async (inv: any) => {
    setEditingInvoiceId(inv.id);
    setCustomerId(inv.customer_id ? String(inv.customer_id) : "");
    setCustomerName(inv.customer_name || "");
    setCustomerStatement(inv.customer_statement || "");
    setCurrency(inv.currency || "SAR");
    setExchangeRate(inv.exchange_rate || 1.0);
    setInvoiceDate(inv.invoice_date || new Date().toISOString().slice(0, 10));
    setPaymentMethod(inv.payment_method || "cash");
    setDiscount(Number(inv.discount || 0));
    setPaidAmount(Number(inv.paid_amount || 0));
    setNotes(inv.notes || "");
    setDebitAccountCode(inv.debit_account_code || "11100");
    setCreditAccountCode(inv.credit_account_code || "40000");
    setCommissionAccountCode(inv.commission_account_code || "45000");
    setSupplierAccountCode(inv.supplier_account_code || "21100");

    try {
      const full = await fetchWithAuth<any>(`/api/travel/invoices/${inv.id}`);
      if (full && Array.isArray(full.items) && full.items.length > 0) {
        setItems(full.items.map((i: any) => ({
          service_type: i.service_type || "flight",
          supplier_type: i.supplier_type || "airline",
          supplier_id: i.supplier_id ? String(i.supplier_id) : "",
          supplier_name: i.supplier_name || "",
          description: i.description || "",
          statement: i.statement || i.description || "",
          passenger_name: i.passenger_name || "",
          cost_price: Number(i.cost_price || 0),
          service_fees: Number(i.service_fees || 0),
          agency_commission: Number(i.agency_commission || (Number(i.selling_price || 0) - (Number(i.cost_price || 0) + Number(i.service_fees || 0)))),
          selling_price: Number(i.selling_price || 0),
          accounting_impact_account: i.accounting_impact_account || "40000"
        })));
      }
    } catch {
      // Fallback
    }

    setOpenCreateModal(true);
  };

  const handleCustomerSelect = (idStr: string) => {
    setCustomerId(idStr);
    if (idStr === "custom" || !idStr) {
      return;
    }
    const found = customers.find((c: any) => String(c.id) === idStr);
    if (found) {
      setCustomerName(found.name);
      if (!customerStatement) {
        setCustomerStatement(`معاملة سفر وسياحة للعميل ${found.name}`);
      }
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        service_type: "flight",
        supplier_type: "airline",
        supplier_id: "",
        supplier_name: "",
        description: "خدمة سفر سياحية",
        statement: "بيان الخدمة",
        passenger_name: customerName,
        cost_price: 0,
        service_fees: 0,
        agency_commission: 0,
        selling_price: 0,
        accounting_impact_account: "41000"
      }
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    // When changing service_type, automatically update supplier_type and default accounting_impact_account
    if (field === "service_type") {
      const typeDef = SERVICE_TYPES.find(t => t.id === value);
      if (typeDef) {
        current.accounting_impact_account = typeDef.defaultAccount;
      }
      current.supplier_id = "";
      current.supplier_name = "";
      if (value === "flight") current.supplier_type = "airline";
      else if (value === "hotel") current.supplier_type = "hotel";
      else if (value === "visa") current.supplier_type = "visa_office";
      else if (value === "transport") current.supplier_type = "bus_company";
      else current.supplier_type = "supplier";
    }

    // Auto calculate agency commission if selling or cost is changed
    if (field === "selling_price" || field === "cost_price" || field === "service_fees") {
      const cost = field === "cost_price" ? Number(value) : Number(current.cost_price || 0);
      const fees = field === "service_fees" ? Number(value) : Number(current.service_fees || 0);
      const sell = field === "selling_price" ? Number(value) : Number(current.selling_price || 0);
      current.agency_commission = Math.max(0, sell - (cost + fees));
    }

    // Auto set supplier_name when supplier_id changes
    if (field === "supplier_id") {
      const suppId = String(value);
      if (current.service_type === "flight") {
        const found = airlines.find((a: any) => String(a.id) === suppId);
        current.supplier_name = found ? `${found.name_ar} (${found.iata_code || "طيران"})` : "";
      } else if (current.service_type === "hotel") {
        const found = hotels.find((h: any) => String(h.id) === suppId);
        current.supplier_name = found ? `${found.hotel_name || found.name} - ${found.city || ""}` : "";
      } else if (current.service_type === "visa") {
        const found = partnerOffices.find((o: any) => String(o.id) === suppId);
        current.supplier_name = found ? found.name : "";
      } else if (current.service_type === "transport") {
        const found = transportCompanies.find((t: any) => String(t.id) === suppId);
        current.supplier_name = found ? (found.company_name || found.name) : "";
      } else {
        const found = generalSuppliers.find((s: any) => String(s.id) === suppId);
        current.supplier_name = found ? (found.supplier_name || found.name) : "";
      }
    }

    updated[index] = current;
    setItems(updated);
  };

  // Calculate live totals
  const totalCost = (items || []).reduce((sum, i) => sum + Number(i.cost_price || 0), 0);
  const totalFees = (items || []).reduce((sum, i) => sum + Number(i.service_fees || 0), 0);
  const totalSelling = (items || []).reduce((sum, i) => sum + Number(i.selling_price || 0), 0);
  const totalCommission = (items || []).reduce((sum, i) => sum + Number(i.agency_commission || 0), 0);
  const netSelling = Math.max(0, totalSelling - discount);
  const netProfit = netSelling - (totalCost + totalFees);

  // Filter invoices for main table
  const filtered = invoices.filter((inv: any) => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_statement?.toLowerCase().includes(search.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(search.toLowerCase());

    const matchesCurrency = currencyFilter === "all" || inv.currency === currencyFilter;
    const matchesPayment = paymentFilter === "all" || inv.payment_method === paymentFilter;

    return matchesSearch && matchesCurrency && matchesPayment;
  });

  // Advanced Search Filtered Invoices (Tab 1 of Search Dialog)
  const advFilteredInvoices = invoices.filter((inv: any) => {
    const q = advSearchQuery.toLowerCase().trim();
    const matchQuery = !q || (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.customer_statement?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q)
    );

    const matchDateFrom = !advDateFrom || (inv.invoice_date >= advDateFrom);
    const matchDateTo = !advDateTo || (inv.invoice_date <= advDateTo);
    const matchCurrency = advCurrency === "all" || inv.currency === advCurrency;
    const matchPayment = advPaymentMethod === "all" || inv.payment_method === advPaymentMethod;
    
    const net = Number(inv.net_selling || 0);
    const matchMin = !advMinAmount || net >= Number(advMinAmount);
    const matchMax = !advMaxAmount || net <= Number(advMaxAmount);

    return matchQuery && matchDateFrom && matchDateTo && matchCurrency && matchPayment && matchMin && matchMax;
  });

  // Advanced Accounts and Customers filter (Tab 2 of Search Dialog)
  const filteredAccounts = (chartAccounts || []).filter((acc: any) => {
    const q = accountSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.code?.toLowerCase().includes(q) ||
      acc.name?.toLowerCase().includes(q) ||
      acc.account_type?.toLowerCase().includes(q)
    );
  });

  const filteredSearchCustomers = (customers || []).filter((c: any) => {
    const q = accountSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.customer_number?.toLowerCase().includes(q) ||
      c.passport_number?.toLowerCase().includes(q)
    );
  });

  const handleSubmitInvoice = () => {
    if (!customerName || !customerName.trim()) {
      toast({
        title: "تنبيه مطلوب",
        description: "يرجى تحديد أو كتابة اسم العميل لإصدار الفاتورة",
        variant: "destructive"
      });
      return;
    }

    if (!items || items.length === 0) {
      toast({
        title: "تنبيه مطلوب",
        description: "يجب إضافة بند خدمة واحد على الأقل في الفاتورة",
        variant: "destructive"
      });
      return;
    }

    const cleanItems = items.map(it => ({
      service_type: it.service_type || "flight",
      supplier_type: it.supplier_type || "airline",
      supplier_id: it.supplier_id ? String(it.supplier_id) : null,
      supplier_name: it.supplier_name || "",
      description: it.description || "",
      statement: it.statement || it.description || "خدمة سفر وسياحة",
      passenger_name: it.passenger_name || customerName || "",
      cost_price: Number(it.cost_price || 0),
      service_fees: Number(it.service_fees || 0),
      agency_commission: Number(it.agency_commission || 0),
      selling_price: Number(it.selling_price || 0),
      accounting_impact_account: it.accounting_impact_account || "40000"
    }));

    const payload = {
      customer_id: customerId && customerId !== "custom" && !isNaN(Number(customerId)) ? Number(customerId) : null,
      customer_name: customerName.trim(),
      customer_statement: customerStatement || `معاملة خدمات سفر وسياحة للعميل ${customerName.trim()}`,
      currency: currency || "SAR",
      exchange_rate: Number(exchangeRate) || 1.0,
      invoice_date: invoiceDate || new Date().toISOString().slice(0, 10),
      payment_method: paymentMethod || "cash",
      discount: Number(discount) || 0,
      paid_amount: Number(netSelling) || 0,
      notes: notes || "",
      items: cleanItems,
      debit_account_code: debitAccountCode || "11100",
      credit_account_code: creditAccountCode || "40000",
      commission_account_code: commissionAccountCode || "45000",
      supplier_account_code: supplierAccountCode || "21100"
    };

    createInvoiceMutation.mutate(payload);
  };

  const getCurrencySymbol = (currCode: string) => {
    const found = CURRENCIES.find(c => c.code === currCode);
    return found ? found.symbol : currCode;
  };

  // Helper to render dynamic suppliers dropdown
  const renderSupplierSelect = (item: any, idx: number) => {
    switch (item.service_type) {
      case "flight":
        return (
          <select
            value={item.supplier_id || ""}
            onChange={e => updateItem(idx, "supplier_id", e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- اختر شركة الطيران الناقلة --</option>
            {airlines.map((air: any) => (
              <option key={air.id} value={air.id}>
                ✈️ {air.name_ar} {air.iata_code ? `[${air.iata_code}]` : ""} {air.country ? `(${air.country})` : ""}
              </option>
            ))}
          </select>
        );

      case "hotel":
        return (
          <select
            value={item.supplier_id || ""}
            onChange={e => updateItem(idx, "supplier_id", e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500"
          >
            <option value="">-- اختر الفندق أو المنتجع --</option>
            {hotels.map((h: any) => (
              <option key={h.id} value={h.id}>
                🏨 {h.hotel_name || h.name} {h.stars ? `(${h.stars}★)` : ""} - {h.city || h.country || ""}
              </option>
            ))}
          </select>
        );

      case "visa":
        return (
          <select
            value={item.supplier_id || ""}
            onChange={e => updateItem(idx, "supplier_id", e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">-- اختر المكتب المفوض / السفارة --</option>
            {partnerOffices.map((off: any) => (
              <option key={off.id} value={off.id}>
                🏛️ {off.name} {off.city ? `(${off.city})` : ""} {off.phone ? ` - ${off.phone}` : ""}
              </option>
            ))}
          </select>
        );

      case "transport":
        return (
          <select
            value={item.supplier_id || ""}
            onChange={e => updateItem(idx, "supplier_id", e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-purple-500"
          >
            <option value="">-- اختر شركة النقل البري / الباصات --</option>
            {transportCompanies.map((tc: any) => (
              <option key={tc.id} value={tc.id}>
                🚌 {tc.company_name || tc.name} {tc.phone ? `(${tc.phone})` : ""}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <select
            value={item.supplier_id || ""}
            onChange={e => updateItem(idx, "supplier_id", e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-teal-500"
          >
            <option value="">-- اختر مورد الخدمة السياحية --</option>
            {generalSuppliers.map((s: any) => (
              <option key={s.id} value={s.id}>
                🏢 {s.supplier_name || s.name} {s.service_type ? `(${s.service_type})` : ""}
              </option>
            ))}
          </select>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <Receipt className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  شاشة الفواتير والمبيعات المركزية (Central Sales & Invoices)
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  إصدار فواتير المبيعات الشاملة، ربط ديناميكي للموردين حسب نوع الخدمة، وحساب التأثير المحاسبي وعمولات المكتب المرتبطة بدليل الحسابات
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                resetInvoiceForm();
                setOpenCreateModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-4 py-2 shadow-xs"
            >
              <Plus className="w-4 h-4" /> إصدار فاتورة مبيعات جديدة
            </Button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>إجمالي عدد الفواتير</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{invoices.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">فاتورة مبيعات مركزية مسجلة</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>إجمالي المبيعات (Selling)</span>
              <Coins className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 font-mono">
              {invoices.reduce((sum: number, i: any) => sum + Number(i.net_selling || 0), 0).toLocaleString()} <span className="text-xs font-sans text-slate-500">ر.س</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">شامل التحصيلات والآجل</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>إجمالي تكلفة الموردين (Cost)</span>
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 font-mono">
              {invoices.reduce((sum: number, i: any) => sum + Number(i.cost_subtotal || 0), 0).toLocaleString()} <span className="text-xs font-sans text-slate-500">ر.س</span>
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">مستحقات الطيران والفنادق والمكاتب</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs bg-linear-to-br from-blue-50/50 to-emerald-50/50">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
              <span>أرباح وعمولات المكتب (Profit)</span>
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-800 font-mono">
              +{invoices.reduce((sum: number, i: any) => sum + Number(i.net_profit || 0), 0).toLocaleString()} <span className="text-xs font-sans text-slate-500">ر.س</span>
            </div>
            <div className="text-[11px] text-blue-700 font-semibold mt-1">مرحلة لحساب العمولات 45000</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث برقم الفاتورة، اسم العميل، البيان..."
                className="pr-9 h-9 text-xs"
              />
            </div>

            {/* Currency Filter */}
            <div>
              <select
                value={currencyFilter}
                onChange={e => setCurrencyFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-medium text-slate-700"
              >
                <option value="all">جميع العملات (SAR / USD / YER)</option>
                <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                <option value="YER">🇾🇪 ريال يمني (YER)</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-medium text-slate-700"
              >
                <option value="all">جميع طرق السداد</option>
                <option value="cash">💵 نقداً (Cash)</option>
                <option value="bank">💳 تحويل بنكي / شبكة</option>
                <option value="credit">⏳ آجل / ذمم مدينة</option>
              </select>
            </div>

            {/* Invoices Count Badge */}
            <div className="flex items-center justify-end">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border">
                الفواتير المعروضة: <span className="text-emerald-700 font-mono text-sm">{filtered.length}</span> من {invoices.length}
              </span>
            </div>
          </div>
        </div>

        {/* Invoices Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم الفاتورة</th>
                  <th className="p-3.5">العميل والبيان</th>
                  <th className="p-3.5">التاريخ والعملة</th>
                  <th className="p-3.5">طريقة الدفع</th>
                  <th className="p-3.5">تكلفة الموردين</th>
                  <th className="p-3.5">سعر بيع العميل</th>
                  <th className="p-3.5">عمولة وربح المكتب</th>
                  <th className="p-3.5">حسابات التأثير</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-400 font-medium">
                      جاري تحميل بيانات الفواتير والمبيعات...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center p-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="w-10 h-10 text-slate-300" />
                        <div className="font-bold text-sm text-slate-600">لا توجد فواتير مبيعات مطابقة للبحث</div>
                        <p className="text-xs text-slate-400">يمكنك إصدار فاتورة جديدة بالضغط على زر "إصدار فاتورة مبيعات جديدة"</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv: any) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-50/90 border-r-4 border-r-emerald-600 font-medium"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Invoice Number */}
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-emerald-800 text-[13px] flex items-center gap-1.5">
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 inline" />}
                            <span>{inv.invoice_number}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">{inv.items_count || 1} خدمات مضمنة</div>
                        </td>

                        {/* Customer & Statement */}
                        <td className="p-3.5 max-w-xs">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{inv.customer_name}</span>
                          </div>
                          {inv.customer_statement ? (
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              📝 {inv.customer_statement}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">بدون بيان تفصيلي</div>
                          )}
                        </td>

                        {/* Date & Currency */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{inv.invoice_date}</div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {inv.currency || "SAR"}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            inv.payment_method === 'cash'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : inv.payment_method === 'bank'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {inv.payment_method === 'cash' ? '💵 نقداً' : inv.payment_method === 'bank' ? '💳 تحويل بنكي' : '⏳ آجل (ذمم)'}
                          </span>
                        </td>

                        {/* Cost */}
                        <td className="p-3.5 font-mono text-slate-600 font-bold whitespace-nowrap">
                          {Number(inv.cost_subtotal || 0).toLocaleString()} {getCurrencySymbol(inv.currency || "SAR")}
                        </td>

                        {/* Selling */}
                        <td className="p-3.5 font-mono text-emerald-700 font-bold text-xs whitespace-nowrap">
                          {Number(inv.net_selling || 0).toLocaleString()} {getCurrencySymbol(inv.currency || "SAR")}
                        </td>

                        {/* Commission & Profit */}
                        <td className="p-3.5 font-mono text-blue-700 font-bold text-xs whitespace-nowrap">
                          +{Number(inv.net_profit || 0).toLocaleString()} {getCurrencySymbol(inv.currency || "SAR")}
                        </td>

                        {/* Accounting Impact */}
                        <td className="p-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                          <div>مدين: <span className="font-mono font-bold text-slate-700">{inv.debit_account_code || "11100"}</span></div>
                          <div>إيراد: <span className="font-mono font-bold text-emerald-700">{inv.credit_account_code || "40000"}</span></div>
                        </td>

                        {/* Actions */}
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setOpenPrintModal(true);
                              }}
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-600" />
                              <span>طباعة</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                              onClick={() => handleOpenEdit(inv)}
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                              <span>تعديل</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeleteConfirmId(inv.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Sticky Action Toolbar (أزرار تحت الشاشة: البحث، الطباعة، التعديل، والإصدار مع التفاعل الكامل) */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sticky bottom-4 z-20 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span>{selectedInvoice ? `الفاتورة المحددة: ${selectedInvoice.invoice_number}` : "شريط أدوات وإجراءات الفواتير والمبيعات"}</span>
                {selectedInvoice && (
                  <Badge variant="outline" className="bg-emerald-950 text-emerald-400 border-emerald-700 text-[10px] py-0">
                    {selectedInvoice.customer_name}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {selectedInvoice
                  ? `المبلغ الصافي: ${Number(selectedInvoice.net_selling || 0).toLocaleString()} ${getCurrencySymbol(selectedInvoice.currency || "SAR")} | التاريخ: ${selectedInvoice.invoice_date}`
                  : "حدد أي فاتورة من الجدول أعلاه أو انقر للبحث في العمليات السابقة"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Button (مثل سندات القيود المزدوج) */}
            <Button
              onClick={() => {
                setShowSearchModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 text-xs h-9 shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span>بحث في المعاملات السابقة</span>
            </Button>

            {/* Print Button */}
            <Button
              disabled={!selectedInvoice && filtered.length === 0}
              onClick={() => {
                const target = selectedInvoice || filtered[0];
                if (target) {
                  setSelectedInvoice(target);
                  setOpenPrintModal(true);
                } else {
                  toast({ title: "تنبيه", description: "يرجى تحديد فاتورة للطباعة", variant: "destructive" });
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs h-9 shadow-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </Button>

            {/* Edit Button */}
            <Button
              disabled={!selectedInvoice && filtered.length === 0}
              onClick={() => {
                const target = selectedInvoice || filtered[0];
                if (target) {
                  handleOpenEdit(target);
                } else {
                  toast({ title: "تنبيه", description: "يرجى تحديد فاتورة للتعديل", variant: "destructive" });
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 text-xs h-9 shadow-sm disabled:opacity-50"
            >
              <Edit className="w-4 h-4" />
              <span>تعديل الفاتورة</span>
            </Button>

            {/* New Invoice Button */}
            <Button
              onClick={() => {
                resetInvoiceForm();
                setOpenCreateModal(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5 text-xs h-9 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار فاتورة جديدة</span>
            </Button>

            {/* Delete Button */}
            {selectedInvoice && (
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirmId(selectedInvoice.id)}
                className="font-bold gap-1 text-xs h-9 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </Button>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/travel/invoices"] });
                toast({ title: "تم التحديث", description: "تم تحديث قائمة فواتير المبيعات" });
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold gap-1 text-xs h-9"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Create / Edit Centralized Invoice Modal */}
        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                <Receipt className="w-6 h-6 text-emerald-600" />
                <span>{editingInvoiceId ? "تعديل فاتورة مبيعات مركزية" : "إصدار فاتورة مبيعات خدمات سفر وسياحة مركزية"}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Top Header Card: Customer & Basic Invoice Data */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Customer Dropdown with Quick Add */}
                  <div className="space-y-1 md:col-span-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-slate-800">
                        اسم العميل (الطرف الأول / المدين) *
                      </Label>
                      <button
                        type="button"
                        onClick={() => setQuickCustomerModalOpen(true)}
                        className="text-[11px] text-emerald-700 hover:underline font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> إضافة عميل جديد سريعاً
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={customerId}
                        onChange={e => handleCustomerSelect(e.target.value)}
                        className="h-9 rounded-md border border-input bg-white px-2.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- اختر العميل من القائمة ({customers.length} مسجل) --</option>
                        {customers.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            👤 {c.name} {c.phone ? `(${c.phone})` : ""} {c.office_name ? `[${c.office_name}]` : ""}
                          </option>
                        ))}
                        <option value="custom">✍️ إدخال اسم عميل يدوي / نقدي...</option>
                      </select>

                      <Input
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="أو اكتب اسم العميل الرباعي هنا..."
                        className="h-9 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  {/* Invoice Date */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800">تاريخ الفاتورة</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={e => setInvoiceDate(e.target.value)}
                      className="h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Customer Statement (البيان) & Currency & Payment Method */}
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                  {/* General Statement */}
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-800">بيان الفاتورة وشرح المعاملة للعميل (Statement) *</Label>
                    <Input
                      value={customerStatement}
                      onChange={e => setCustomerStatement(e.target.value)}
                      placeholder="مثال: قيمة تذاكر طيران وحجز فندق وتأشيرة سفر للمسافر..."
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Currency */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800">عملة الفاتورة</Label>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs font-bold text-slate-900"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800">طريقة الدفع والتحصيل</Label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-xs font-bold text-slate-900"
                    >
                      <option value="cash">💵 نقداً (الصندوق الرئيسي 11100)</option>
                      <option value="bank">💳 تحويل بنكي / شبكة (البنك 11102)</option>
                      <option value="credit">⏳ آجل / ذمم مدينة (العميل 11200)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Service Items Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-100/80 px-3 py-2 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>بنود الخدمات والموردين والتأثير المحاسبي:</span>
                  </div>
                  <Button size="sm" onClick={addItem} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 h-8 font-bold">
                    <Plus className="w-3.5 h-3.5" /> إضافة خدمة / رحلة جديدة
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-300 shadow-xs space-y-3">
                      {/* Row Header: Service Type & Supplier & Delete */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-end">
                        {/* Service Type */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700">نوع الخدمة السياحية</Label>
                          <select
                            value={item.service_type}
                            onChange={e => updateItem(idx, "service_type", e.target.value)}
                            className="h-8 w-full rounded-md border border-input bg-slate-50 px-2 text-xs font-bold text-slate-900"
                          >
                            {SERVICE_TYPES.map(st => (
                              <option key={st.id} value={st.id}>{st.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Dynamic Supplier per Service Type */}
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <span>المورد / الشركة المزودة (الطرف الثاني / الدائن) *</span>
                            {item.supplier_name && (
                              <span className="text-[10px] text-emerald-700 font-semibold truncate">
                                [ {item.supplier_name} ]
                              </span>
                            )}
                          </Label>
                          {renderSupplierSelect(item, idx)}
                        </div>

                        {/* Passenger Name & Remove Button */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <Label className="text-[11px] font-bold text-slate-700">اسم المسافر / المستفيد</Label>
                            {items.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(idx)}
                                className="text-red-500 hover:bg-red-50 p-0.5 h-6 w-6"
                                title="حذف هذا البند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <Input
                            className="h-8 text-xs font-medium"
                            value={item.passenger_name || ""}
                            onChange={e => updateItem(idx, "passenger_name", e.target.value)}
                            placeholder="اسم المسافر..."
                          />
                        </div>
                      </div>

                      {/* Row Body: Statements & Accounting Impact Account */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                        {/* Service Statement / Description */}
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-[11px] font-bold text-slate-700">بيان تفصيلي للبند (البيان / الوصف)</Label>
                          <Input
                            className="h-8 text-xs"
                            value={item.statement || item.description || ""}
                            onChange={e => updateItem(idx, "statement", e.target.value)}
                            placeholder="وصف وتفاصيل الخدمة (مثلاً: رقم الحجز PNR، التواريخ، الفندق...)"
                          />
                        </div>

                        {/* Accounting Impact Account */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                            <span>حساب التأثير بدليل الحسابات</span>
                          </Label>
                          <select
                            value={item.accounting_impact_account || "40000"}
                            onChange={e => updateItem(idx, "accounting_impact_account", e.target.value)}
                            className="h-8 w-full rounded-md border border-input bg-blue-50/50 px-2 text-xs font-bold text-blue-950"
                          >
                            <option value="41000">41000 - إيرادات مبيعات تذاكر الطيران</option>
                            <option value="42000">42000 - إيرادات حجوزات الفنادق والمنتجعات</option>
                            <option value="43000">43000 - إيرادات معاملات وخدمات التأشيرات</option>
                            <option value="44000">44000 - إيرادات البرامج السياحية والنقل</option>
                            <option value="45000">45000 - إيرادات العمولات والحوافز</option>
                            <option value="40000">40000 - الإيرادات السياحية العامة</option>
                          </select>
                        </div>
                      </div>

                      {/* Row Financials: Cost + Fees + Commission = Selling */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 bg-slate-50/60 p-2.5 rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">تكلفة المورد (Cost)</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs font-mono font-bold"
                            value={item.cost_price}
                            onChange={e => updateItem(idx, "cost_price", Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-600">رسوم وضرائب (Fees)</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs font-mono"
                            value={item.service_fees}
                            onChange={e => updateItem(idx, "service_fees", Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-blue-700">عمولة وربح المكتب (Commission)</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs font-mono font-bold text-blue-700 bg-blue-50/60"
                            value={item.agency_commission}
                            onChange={e => {
                              const comm = Number(e.target.value);
                              const cost = Number(item.cost_price || 0);
                              const fees = Number(item.service_fees || 0);
                              updateItem(idx, "agency_commission", comm);
                              updateItem(idx, "selling_price", cost + fees + comm);
                            }}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-emerald-700">سعر بيع العميل (Selling)</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs font-mono font-bold text-emerald-800 bg-emerald-50/60"
                            value={item.selling_price}
                            onChange={e => updateItem(idx, "selling_price", Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accounting Integration & Journal Settings Card */}
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-700" />
                    <span>الربط والتأثير المحاسبي مع دليل الحسابات (Double-Entry Journal Accounts)</span>
                  </div>
                  <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-semibold">
                    قيد محاسبي آلي متوازن ✅
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-700">حساب التحصيل المدين (Debit)</Label>
                    <select
                      value={debitAccountCode}
                      onChange={e => setDebitAccountCode(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-[11px] font-bold text-slate-800"
                    >
                      <option value="11100">11100 - الصندوق الرئيسي لوكالة السفر</option>
                      <option value="11101">11101 - صندوق موظف الحجوزات</option>
                      <option value="11102">11102 - البنك / حساب التحصيل</option>
                      <option value="11200">11200 - الذمم المدينة (العملاء)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-700">حساب الإيراد الدائن (Credit Revenue)</Label>
                    <select
                      value={creditAccountCode}
                      onChange={e => setCreditAccountCode(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-[11px] font-bold text-slate-800"
                    >
                      <option value="40000">40000 - الإيرادات السياحية العامة</option>
                      <option value="41000">41000 - إيرادات مبيعات تذاكر الطيران</option>
                      <option value="42000">42000 - إيرادات حجوزات الفنادق</option>
                      <option value="43000">43000 - إيرادات خدمات التأشيرات</option>
                      <option value="44000">44000 - إيرادات البرامج والنقل</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-700">حساب عمولات وحوافز المكتب</Label>
                    <select
                      value={commissionAccountCode}
                      onChange={e => setCommissionAccountCode(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-[11px] font-bold text-slate-800"
                    >
                      <option value="45000">45000 - إيرادات العمولات والحوافز من الموردين</option>
                      <option value="40000">40000 - الإيرادات السياحية</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-700">حساب الذمم الدائنة للموردين</Label>
                    <select
                      value={supplierAccountCode}
                      onChange={e => setSupplierAccountCode(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-[11px] font-bold text-slate-800"
                    >
                      <option value="21100">21100 - الذمم الدائنة (الموردين والطيران)</option>
                      <option value="11300">11300 - أرصدة الشحن لدى خطوط الطيران</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Totals & Commission Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 rounded-xl border border-emerald-200 text-center">
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold">إجمالي التكلفة والرسوم</div>
                  <div className="font-bold text-slate-800 text-base font-mono">
                    {(totalCost + totalFees).toLocaleString()} {getCurrencySymbol(currency)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold">إجمالي مبيعات العميل</div>
                  <div className="font-bold text-emerald-800 text-base font-mono">
                    {netSelling.toLocaleString()} {getCurrencySymbol(currency)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-blue-700 font-bold">إجمالي عمولة وربح المكتب</div>
                  <div className="font-bold text-blue-800 text-lg font-mono">
                    +{totalCommission.toLocaleString()} {getCurrencySymbol(currency)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-emerald-700 font-bold">الصافي النهائي (Profit)</div>
                  <div className="font-bold text-emerald-900 text-lg font-mono">
                    +{netProfit.toLocaleString()} {getCurrencySymbol(currency)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">ملاحظات وشروط إضافية على الفاتورة</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي ملاحظات أو بنود إلغاء واسترجاع خاصة بالفاتورة..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setOpenCreateModal(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSubmitInvoice}
                disabled={createInvoiceMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 min-w-[200px]"
              >
                {createInvoiceMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ وترحيل الفاتورة...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingInvoiceId ? "حفظ وتحديث الفاتورة" : "تأكيد إصدار الفاتورة وترحيل القيد المحاسبي"}</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Add Customer Modal */}
        <Dialog open={quickCustomerModalOpen} onOpenChange={setQuickCustomerModalOpen}>
          <DialogContent className="max-w-md font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" /> إضافة عميل جديد سريعاً
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-bold">اسم العميل الرباعي *</Label>
                <Input
                  value={quickCustomerForm.name}
                  onChange={e => setQuickCustomerForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="الاسم الكامل للعميل"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">رقم الهاتف / الواتساب *</Label>
                <Input
                  value={quickCustomerForm.phone}
                  onChange={e => setQuickCustomerForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+966 5X XXX XXXX"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">نوع العميل</Label>
                <select
                  value={quickCustomerForm.customer_type}
                  onChange={e => setQuickCustomerForm(f => ({ ...f, customer_type: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold"
                >
                  <option value="individual">👤 عميل فردي مباشر</option>
                  <option value="corporate">🏢 شركة / مؤسسة تجارية</option>
                  <option value="vip">⭐ عميل كبار الشخصيات VIP</option>
                  <option value="agent">🤝 مكتب وسيط شريك</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickCustomerModalOpen(false)}>إلغاء</Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => {
                  if (!quickCustomerForm.name) {
                    toast({ title: "تنبيه", description: "يرجى كتابة اسم العميل", variant: "destructive" });
                    return;
                  }
                  quickCustomerMutation.mutate(quickCustomerForm);
                }}
                disabled={quickCustomerMutation.isPending}
              >
                حفظ واختيار العميل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Printable Official Invoice Modal */}
        <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
          <DialogContent className="max-w-3xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>معاينة وطباعة الفاتورة المركزية الرسمية</span>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedInvoice?.invoice_number}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div id="printable-travel-invoice" className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-xs font-sans">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <div className="text-lg font-bold text-emerald-800">مؤسسة أومني سيستم (Omni System Pro)</div>
                  <div className="text-xs text-slate-500">Omni System Pro</div>
                  <div className="text-[11px] text-slate-600 mt-1 font-bold">فاتورة مبيعات خدمات سفر وسياحة رسمية</div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    رقم الفاتورة: <span className="font-mono font-bold text-emerald-800">{selectedInvoice?.invoice_number}</span>
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <div className="text-xs text-slate-700">التاريخ: <span className="font-bold">{selectedInvoice?.invoice_date}</span></div>
                  <div className="text-xs text-slate-700">العملة: <span className="font-bold">{selectedInvoice?.currency || "SAR"}</span></div>
                  <div className="text-xs text-slate-700">طريقة الدفع: <span className="font-bold">{selectedInvoice?.payment_method === 'cash' ? 'نقداً' : selectedInvoice?.payment_method === 'bank' ? 'تحويل بنكي' : 'آجل (ذمم)'}</span></div>
                </div>
              </div>

              {/* Customer & Statement Details */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 font-bold">اسم العميل: </span>
                  <span className="font-bold text-slate-900">{selectedInvoice?.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">البيان والشرح: </span>
                  <span className="font-semibold text-slate-800">{selectedInvoice?.customer_statement || "معاملة خدمات سفر وسياحة"}</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-y border-slate-300">
                    <th className="p-2">#</th>
                    <th className="p-2">نوع الخدمة</th>
                    <th className="p-2">المورد / المزود</th>
                    <th className="p-2">البيان والوصف</th>
                    <th className="p-2">المسافر</th>
                    <th className="p-2 text-left">المبلغ ({selectedInvoice?.currency || "SAR"})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoiceDetails?.items?.map((it: any, idx: number) => (
                    <tr key={it.id || idx}>
                      <td className="p-2 text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-bold text-emerald-800">
                        {SERVICE_TYPES.find(st => st.id === it.service_type)?.label || it.service_type}
                      </td>
                      <td className="p-2 font-semibold text-slate-700">
                        {it.supplier_name || "-"}
                      </td>
                      <td className="p-2 text-slate-800">
                        {it.statement || it.description}
                      </td>
                      <td className="p-2 text-slate-600">
                        {it.passenger_name || selectedInvoice?.customer_name}
                      </td>
                      <td className="p-2 font-mono font-bold text-left">
                        {Number(it.selling_price || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary and Accounting Impact Box */}
              <div className="border-t border-slate-300 pt-3 flex flex-col sm:flex-row justify-between gap-3 items-center">
                <div className="text-[11px] text-slate-500">
                  <span>تم الترحيل الآلي إلى دليل الحسابات | رقم القيد: </span>
                  <span className="font-mono font-bold text-slate-700">#{selectedInvoice?.journal_entry_id || "JV-AUTO"}</span>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-4">
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="text-emerald-800 text-base font-mono font-bold">
                      {Number(selectedInvoice?.net_selling || 0).toLocaleString()} {getCurrencySymbol(selectedInvoice?.currency || "SAR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-2 text-center text-xs text-slate-600 border-t border-dashed">
                <div>
                  <div className="font-bold">المستلم / العميل</div>
                  <div className="mt-8">.................................</div>
                </div>
                <div>
                  <div className="font-bold">الموظف المسؤول / الختم الرسمي</div>
                  <div className="mt-8">.................................</div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setOpenPrintModal(false)}>إغلاق</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const elem = document.getElementById("printable-travel-invoice");
                  if (elem) {
                    setReportHtml(elem.innerHTML);
                    setReportTitle(`معاينة استعراض فاتورة مبيعات - ${selectedInvoice?.invoice_number || ""}`);
                    setReportViewerOpen(true);
                  }
                }}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 font-bold"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                استعراض قبل الطباعة
              </Button>
              <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold">
                <Printer className="w-4 h-4" /> طباعة مباشرة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="max-w-md font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-red-600">تأكيد حذف الفاتورة</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-600 py-2">
              هل أنت متأكد من رغبتك في حذف فاتورة المبيعات المركزية؟ سيتم إزالة الفاتورة وبنودها.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteConfirmId && deleteInvoiceMutation.mutate(deleteConfirmId)}
                disabled={deleteInvoiceMutation.isPending}
              >
                تأكيد الحذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Advanced Search Modal (نافذة البحث المتقدم في المعاملات السابقة والحسابات - مطابقة لسندات القيود المزدوج) */}
        <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-lg font-bold flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                  <Search className="w-5 h-5 text-blue-600" />
                  <span>البحث والاستعلام المتقدم في المعاملات السابقة ودليل الحسابات</span>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  نظام المبيعات والفواتير
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <Tabs value={searchTab} onValueChange={(val: any) => setSearchTab(val)} className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
                <TabsTrigger value="invoices" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-700">
                  <Receipt className="w-4 h-4" />
                  <span>فواتير المبيعات والمعاملات السابقة ({advFilteredInvoices.length})</span>
                </TabsTrigger>
                <TabsTrigger value="accounts" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700">
                  <Building2 className="w-4 h-4" />
                  <span>دليل الحسابات والعملاء</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Invoices Search */}
              <TabsContent value="invoices" className="space-y-4 pt-3">
                {/* Search Filters Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* General Text Search */}
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">بحث بالاسم / رقم الفاتورة / البيان / الملاحظات</Label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
                        <Input
                          value={advSearchQuery}
                          onChange={e => setAdvSearchQuery(e.target.value)}
                          placeholder="ابحث برقم الفاتورة، اسم العميل، البيان..."
                          className="pr-8 h-9 text-xs bg-white"
                        />
                      </div>
                    </div>

                    {/* Currency Filter */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">العملة</Label>
                      <select
                        value={advCurrency}
                        onChange={e => setAdvCurrency(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-700"
                      >
                        <option value="all">جميع العملات</option>
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                    {/* Date From */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">من تاريخ</Label>
                      <Input
                        type="date"
                        value={advDateFrom}
                        onChange={e => setAdvDateFrom(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    {/* Date To */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">إلى تاريخ</Label>
                      <Input
                        type="date"
                        value={advDateTo}
                        onChange={e => setAdvDateTo(e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">طريقة السداد</Label>
                      <select
                        value={advPaymentMethod}
                        onChange={e => setAdvPaymentMethod(e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs font-semibold text-slate-700"
                      >
                        <option value="all">الكل</option>
                        <option value="cash">💵 نقداً</option>
                        <option value="bank">💳 بنكي / شبكة</option>
                        <option value="credit">⏳ آجل (ذمم)</option>
                      </select>
                    </div>

                    {/* Reset Button */}
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAdvSearchQuery("");
                          setAdvDateFrom("");
                          setAdvDateTo("");
                          setAdvCurrency("all");
                          setAdvPaymentMethod("all");
                          setAdvMinAmount("");
                          setAdvMaxAmount("");
                        }}
                        className="w-full h-8 text-xs gap-1 text-slate-600 bg-white hover:bg-slate-100"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> إعادة ضبط الفلاتر
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Search Results Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b">
                        <tr>
                          <th className="p-2.5">رقم الفاتورة</th>
                          <th className="p-2.5">العميل والبيان</th>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">طريقة الدفع</th>
                          <th className="p-2.5">الصافي</th>
                          <th className="p-2.5">الربح</th>
                          <th className="p-2.5 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {advFilteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center p-8 text-slate-400">
                              لا توجد فواتير تطابق معايير البحث المحددة
                            </td>
                          </tr>
                        ) : (
                          advFilteredInvoices.map((inv: any) => (
                            <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                              <td className="p-2.5 font-mono font-bold text-blue-800">
                                {inv.invoice_number}
                              </td>
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900">{inv.customer_name}</div>
                                <div className="text-[10px] text-slate-500 line-clamp-1">{inv.customer_statement || "خدمات سفر"}</div>
                              </td>
                              <td className="p-2.5 whitespace-nowrap text-slate-600">
                                {inv.invoice_date}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {inv.payment_method === 'cash' ? '💵 نقداً' : inv.payment_method === 'bank' ? '💳 بنكي' : '⏳ آجل'}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                                {Number(inv.net_selling || 0).toLocaleString()} {getCurrencySymbol(inv.currency || "SAR")}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                                +{Number(inv.net_profit || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px] gap-1 bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setShowSearchModal(false);
                                      setOpenPrintModal(true);
                                    }}
                                  >
                                    <Printer className="w-3 h-3" />
                                    <span>طباعة</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-[10px] gap-1 bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                                    onClick={() => {
                                      setShowSearchModal(false);
                                      handleOpenEdit(inv);
                                    }}
                                  >
                                    <Edit className="w-3 h-3" />
                                    <span>تعديل</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setShowSearchModal(false);
                                      toast({
                                        title: "تم تحديد الفاتورة",
                                        description: `تم اختيار الفاتورة رقم ${inv.invoice_number}`
                                      });
                                    }}
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>اختيار</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Chart of Accounts and Customers Search */}
              <TabsContent value="accounts" className="space-y-4 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">بحث في دليل الحسابات والعملاء</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
                    <Input
                      value={accountSearchQuery}
                      onChange={e => setAccountSearchQuery(e.target.value)}
                      placeholder="ابحث برقم الحساب، اسم الحساب، رقم العميل، اسم العميل، الهاتف..."
                      className="pr-8 h-9 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customers Section */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>سجل العملاء ({filteredSearchCustomers.length})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">انقر لاختيار العميل للفاتورة</span>
                    </div>

                    <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
                      {filteredSearchCustomers.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">لا يوجد عملاء مطابقين</div>
                      ) : (
                        filteredSearchCustomers.map((c: any) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              handleCustomerSelect(String(c.id));
                              setShowSearchModal(false);
                              setOpenCreateModal(true);
                              toast({
                                title: "تم اختيار العميل",
                                description: `تم تحديد العميل: ${c.name} لإصدار الفاتورة`
                              });
                            }}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-colors text-xs flex justify-between items-center"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{c.name}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                {c.customer_number && <span>رقم العميل: <span className="font-mono font-bold text-emerald-700">{c.customer_number}</span></span>}
                                {c.phone && <span>هاتف: <span className="font-mono">{c.phone}</span></span>}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-700 font-bold">
                              اختيار +
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Accounts Section */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span>دليل الحسابات المالية ({filteredAccounts.length})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">حسابات الإيراد والذمم والعمولات</span>
                    </div>

                    <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
                      {filteredAccounts.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">لا توجد حسابات مطابقة</div>
                      ) : (
                        filteredAccounts.map((acc: any) => (
                          <div
                            key={acc.id || acc.code}
                            className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                  {acc.code}
                                </span>
                                <span className="font-bold text-slate-900">{acc.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                النوع: {acc.account_type || "حساب مالي"} | الرصيد: {Number(acc.balance || 0).toLocaleString()} SAR
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-3 mt-3">
              <Button variant="outline" onClick={() => setShowSearchModal(false)} className="text-xs">
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
