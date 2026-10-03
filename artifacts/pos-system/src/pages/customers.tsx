import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Search, Edit2, Trash2, Eye, Phone, Mail,
  Printer, FileText, MessageSquare, Building2, Check,
  DollarSign, AlertCircle, Lock, ShieldCheck, Package,
  ShoppingCart, Receipt, RotateCcw, CreditCard, TrendingUp
} from "lucide-react";
import { printA4Html, generateStatementA4Html } from "@/lib/printUtils";

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

const TYPE_BADGES: Record<string, { label: string; class: string }> = {
  individual: { label: "عميل تجزئة / أفراد", class: "bg-blue-100 text-blue-800 border-blue-200" },
  corporate: { label: "شركة / مؤسسة تجارية", class: "bg-purple-100 text-purple-800 border-purple-200" },
  vip: { label: "عميل جملة / VIP", class: "bg-amber-100 text-amber-800 border-amber-200 font-bold" },
  debtor: { label: "عميل آجل (ذمم مدينة)", class: "bg-red-100 text-red-800 border-red-200" }
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [affiliationFilter, setAffiliationFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  // New Distributor / Branch Office Modal State
  const [newOfficeModalOpen, setNewOfficeModalOpen] = useState(false);
  const [newOfficeForm, setNewOfficeForm] = useState({
    name: "",
    name_en: "",
    office_type: "partner_agency",
    city: "",
    phone: "",
    email: "",
    contact_person: "",
    notes: ""
  });

  // Profile Modal State
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [profileTab, setProfileTab] = useState<"warehouse_invoices" | "pos_orders" | "quotations" | "statement" | "logs">("warehouse_invoices");

  // Full-Screen Statement Preview & Payment Modal State
  const [previewStatementOpen, setPreviewStatementOpen] = useState(false);
  const [previewStatementHtml, setPreviewStatementHtml] = useState("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "cash",
    reference: "",
    notes: ""
  });

  // New Log input state
  const [newLogType, setNewLogType] = useState("واتساب");
  const [newLogSummary, setNewLogSummary] = useState("");

  const [form, setForm] = useState({
    customer_number: "",
    name: "",
    name_en: "",
    phone: "",
    alternate_phone: "",
    email: "",
    address: "",
    nationality: "اليمن / السعودية",
    country: "صنعاء / الرياض",
    dob: "",
    gender: "ذكر",
    national_id: "",
    passport_number: "",
    passport_issue_date: "",
    passport_expiry_date: "",
    employer: "",
    notes: "",
    customer_type: "individual",
    affiliation_type: "direct", // "direct" or "agency"
    office_id: "",
    office_name: "المركز الرئيسي - الإدارة العامة للمبيعات",
    office_phone: "",
    account_code: ""
  });

  const { data: customers = [], isLoading } = useQuery<any[]>({
    queryKey: ["customers-list", search, typeFilter, affiliationFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (typeFilter) q.set("type", typeFilter);
      if (affiliationFilter) q.set("affiliation_type", affiliationFilter);
      return fetchWithAuth(`/api/customers?${q.toString()}`);
    }
  });

  const { data: offices = [] } = useQuery<any[]>({
    queryKey: ["travel-offices-list"],
    queryFn: () => fetchWithAuth("/api/travel/offices")
  });

  // Dynamic fetch of sub-accounts under 11400 (ذمم العملاء والمدينين التجاريين)
  const parentCode = "11400";
  const { data: subAccounts = [] } = useQuery<any[]>({
    queryKey: ["customer-sub-accounts", parentCode],
    queryFn: () => fetchWithAuth(`/api/travel/sub-accounts/${parentCode}`),
    enabled: modalOpen,
  });

  useEffect(() => {
    if (modalOpen && subAccounts.length > 0 && form.affiliation_type === "agency") {
      const hasValidCode = subAccounts.some((a: any) => a.code === form.account_code);
      if (!hasValidCode) {
        const defaultSub = subAccounts.find((a: any) => a.parent_code === parentCode);
        if (defaultSub) {
          setForm(f => ({ ...f, account_code: defaultSub.code }));
        }
      }
    }
  }, [subAccounts, modalOpen, parentCode, form.affiliation_type]);

  const { data: profileData, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: ["customer-sales-profile", activeProfileId],
    queryFn: () => fetchWithAuth(`/api/customers/${activeProfileId}/sales-profile`),
    enabled: Boolean(activeProfileId)
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingCustomer) {
        return fetchWithAuth(`/api/customers/${editingCustomer.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/customers", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setModalOpen(false);
      resetForm();
    }
  });

  const saveOfficeMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/offices", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (newOff: any) => {
      qc.invalidateQueries({ queryKey: ["travel-offices-list"] });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      qc.invalidateQueries({ queryKey: ["sub-accounts-accounts"] });
      qc.invalidateQueries({ queryKey: ["chart-accounts"] });
      setNewOfficeModalOpen(false);
      setForm(f => ({
        ...f,
        affiliation_type: "agency",
        office_id: String(newOff.id),
        office_name: newOff.name,
        office_phone: newOff.phone || "",
        account_code: newOff.account_code || "11200"
      }));
      setNewOfficeForm({
        name: "",
        name_en: "",
        office_type: "partner_agency",
        city: "",
        phone: "",
        email: "",
        contact_person: "",
        notes: ""
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
    }
  });

  const addLogMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/contact-logs", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-sales-profile", activeProfileId] });
      setNewLogSummary("");
    }
  });

  const paymentMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth(`/api/customers/${activeProfileId}/pay`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-sales-profile", activeProfileId] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setPaymentModalOpen(false);
      setPaymentForm({ amount: "", payment_method: "cash", reference: "", notes: "" });
    }
  });

  const handlePreviewStatement = async () => {
    if (!profileData || !profileData.customer) return;
    try {
      const docSettings = await fetchWithAuth<any>("/api/document-print-settings").catch(() => ({}));
      let stmtData: any = null;
      try {
        stmtData = await fetchWithAuth<any>(`/api/accounting/statement/customer/${profileData.customer.id}`);
      } catch {
        stmtData = null;
      }

      const txs = (stmtData && stmtData.transactions && stmtData.transactions.length > 0)
        ? stmtData.transactions
        : (profileData.statement || []).map((s: any) => ({
            date: s.date || "",
            description: s.description || "",
            debit: Number(s.debit || 0),
            credit: Number(s.credit || 0),
            running_balance: Number(s.balance || 0),
            notes: s.entry_number || ""
          }));

      const html = generateStatementA4Html({
        partyType: "customer",
        party: profileData.customer,
        previousBalance: stmtData?.previousBalance || 0,
        currentBalance: stmtData?.currentBalance ?? profileData.summary?.remaining_balance ?? 0,
        transactions: txs,
        settings: docSettings || {}
      });

      setPreviewStatementHtml(html);
      setPreviewStatementOpen(true);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSendWhatsApp = () => {
    if (!profileData?.customer) return;
    const phone = profileData.customer.phone || "";
    const name = profileData.customer.name || "";
    const due = profileData.summary?.remaining_balance || 0;
    const msg = `مرحباً العميل العزيز ${name}، رصيد حسابكم المستحق هو ${Number(due).toLocaleString()} ريال. نسعد بخدمتكم دائماً - OmniSystem Pro`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleExportCsv = () => {
    if (!profileData?.statement) return;
    const headers = ["رقم القيد,التاريخ,البيان,مدين,دائن,الرصيد التراكمي\n"];
    const rows = profileData.statement.map((s: any) =>
      `"${s.entry_number || s.id}","${s.date || ""}","${(s.description || "").replace(/"/g, '""')}",${s.debit || 0},${s.credit || 0},${s.balance || 0}`
    );
    const blob = new Blob(["\ufeff" + headers.concat(rows).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_statement_${profileData.customer.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setForm({
      customer_number: "",
      name: "",
      name_en: "",
      phone: "",
      alternate_phone: "",
      email: "",
      address: "",
      nationality: "اليمن / السعودية",
      country: "صنعاء / الرياض",
      dob: "",
      gender: "ذكر",
      national_id: "",
      passport_number: "",
      passport_issue_date: "",
      passport_expiry_date: "",
      employer: "",
      notes: "",
      customer_type: "individual",
      affiliation_type: "direct",
      office_id: "",
      office_name: "المركز الرئيسي - الإدارة العامة للمبيعات",
      office_phone: "",
      account_code: ""
    });
  };

  const handleEdit = (c: any) => {
    setEditingCustomer(c);
    setForm({
      customer_number: c.customer_number || "",
      name: c.name || "",
      name_en: c.name_en || "",
      phone: c.phone || "",
      alternate_phone: c.alternate_phone || "",
      email: c.email || "",
      address: c.address || "",
      nationality: c.nationality || "اليمن / السعودية",
      country: c.country || "صنعاء / الرياض",
      dob: c.dob || "",
      gender: c.gender || "ذكر",
      national_id: c.national_id || "",
      passport_number: c.passport_number || "",
      passport_issue_date: c.passport_issue_date || "",
      passport_expiry_date: c.passport_expiry_date || "",
      employer: c.employer || "",
      notes: c.notes || "",
      customer_type: c.customer_type || "individual",
      affiliation_type: c.affiliation_type || "direct",
      office_id: c.office_id ? String(c.office_id) : "",
      office_name: c.office_name || (c.affiliation_type === "agency" ? "وكيل تجاري معتمد" : "المركز الرئيسي - الإدارة العامة للمبيعات"),
      office_phone: c.office_phone || "",
      account_code: c.account_code || ""
    });
    setModalOpen(true);
  };

  const handleSelectOffice = (officeIdStr: string) => {
    if (officeIdStr === "NEW_OFFICE") {
      setNewOfficeModalOpen(true);
      return;
    }
    const found = offices.find((o: any) => String(o.id) === officeIdStr);
    if (found) {
      setForm(f => ({
        ...f,
        office_id: String(found.id),
        office_name: found.name,
        office_phone: found.phone || "",
        account_code: found.account_code || f.account_code || "11200"
      }));
    } else {
      setForm(f => ({
        ...f,
        office_id: "",
        office_name: ""
      }));
    }
  };

  // Aggregate summary stats for top KPI cards
  const totalSalesAll = customers.reduce((s, c) => s + Number(c.total_invoices_amount || c.totalPurchases || 0), 0);
  const totalDebtAll = customers.reduce((s, c) => s + Number(c.remaining_debt || c.balance || 0), 0);
  const totalInvoicesAll = customers.reduce((s, c) => s + Number(c.warehouse_invoices_count || 0) + Number(c.orders_count || 0), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Users className="w-7 h-7 text-primary" />
              إدارة العملاء والوكلاء التجاريين (CRM & Customer Accounts)
            </h1>
            <p className="text-sm text-muted-foreground">
              سجل موحد لعملاء المبيعات المخزنية ونقاط البيع (أفراد / شركات / تجار جملة)، ربط تلقائي بدليل الحسابات، وكشوفات الحساب التفصيلية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setNewOfficeModalOpen(true)} variant="outline" className="gap-1 text-xs border-slate-300">
              <Building2 className="w-4 h-4 text-amber-600" /> إضافة فرع / موزع معتمد
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 gap-2 font-bold shadow">
              <Plus className="w-4 h-4" /> إضافة عميل جديد
            </Button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-r-4 border-r-primary">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold">إجمالي العملاء المسجلين</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{customers.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">مرتبطون بشجرة الحسابات (11400)</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold">إجمالي الفواتير (مخزني + POS)</p>
                <p className="text-2xl font-black text-blue-700 mt-1">{totalInvoicesAll}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">فواتير مبيعات مخزنية ونقاط بيع</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Receipt className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-emerald-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold">إجمالي مسحوبات ومبيعات العملاء</p>
                <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{totalSalesAll.toLocaleString()} ر.س</p>
                <p className="text-[11px] text-slate-500 mt-0.5">نقداً وآجل عبر المخازن والفروع</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-r-4 border-r-amber-600">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-bold">الذمم المدينة المستحقة (الآجل)</p>
                <p className="text-2xl font-black text-amber-700 font-mono mt-1">{totalDebtAll.toLocaleString()} ر.س</p>
                <p className="text-[11px] text-slate-500 mt-0.5">أرصدة الفواتير الآجلة قيد التحصيل</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <CreditCard className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="ابحث باسم العميل، رقم العميل، الجوال، السجل التجاري، الرقم الضريبي، أو الفرع/الموزع..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold w-full md:w-48"
            >
              <option value="">جميع تصنيفات العملاء</option>
              <option value="individual">عملاء التجزئة والأفراد (Individuals)</option>
              <option value="corporate">الشركات والمؤسسات (Corporate)</option>
              <option value="vip">عملاء الجملة وكبار العملاء (VIP)</option>
              <option value="debtor">عملاء الذمم الآجلة (Debtors)</option>
            </select>
            <select
              value={affiliationFilter}
              onChange={e => setAffiliationFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold w-full md:w-56"
            >
              <option value="">جميع جهات التبعية</option>
              <option value="direct">🏢 عميل مباشر (المركز الرئيسي / الفروع)</option>
              <option value="agency">🏬 تابع لوكيل / موزع تجاري معتمد</option>
            </select>
          </div>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">قائمة العملاء المسجلين ({customers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل العملاء...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا يوجد عملاء مطابقون للبحث</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">#</th>
                      <th className="p-3">اسم العميل ورقم الحساب</th>
                      <th className="p-3">الفرع / الوكيل التجاري</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">السجل التجاري / الضريبي</th>
                      <th className="p-3">إجمالي المبيعات والرصيد</th>
                      <th className="p-3">الفواتير والعمليات</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, idx) => {
                      const badge = TYPE_BADGES[c.customer_type] || { label: c.customer_type || "عميل تجزئة", class: "bg-slate-100" };
                      const isDirect = !c.affiliation_type || c.affiliation_type === "direct";
                      const totalSales = Number(c.total_invoices_amount || c.totalPurchases || 0);
                      const remainingDebt = Number(c.remaining_debt || c.balance || 0);
                      return (
                        <tr key={`cust-${c.id || idx}`} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.customer_number && (
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border">
                                  {c.customer_number}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.account_code && (
                                <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  حساب: {c.account_code}
                                </span>
                              )}
                              {c.name_en && <span className="text-xs text-muted-foreground font-mono">{c.name_en}</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            {isDirect ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                                {c.office_name || "المركز الرئيسي - الإدارة العامة للمبيعات"}
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <Users className="w-3.5 h-3.5 text-amber-600" />
                                  وكيل/موزع: {c.office_name || "وكيل معتمد"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {c.phone || "-"}
                            </div>
                            {c.email && (
                              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                                <Mail className="w-3 h-3" /> {c.email}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div>سجل/هوية: <span className="font-bold">{c.national_id || "-"}</span></div>
                            {c.passport_number && (
                              <div className="text-[11px] text-slate-500">الرقم الضريبي: {c.passport_number}</div>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-bold text-emerald-700 text-xs">
                              مبيعات: {totalSales.toLocaleString()} ر.س
                            </div>
                            {remainingDebt > 0 && (
                              <div className="text-[11px] font-bold text-amber-700 mt-0.5">
                                متبقي آجل: {remainingDebt.toLocaleString()} ر.س
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-200">
                                {Number(c.warehouse_invoices_count || 0)} فاتورة مخزنية
                              </span>
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold border border-purple-200">
                                {Number(c.orders_count || 0)} نقطة بيع
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 font-bold"
                                onClick={() => {
                                  setActiveProfileId(c.id);
                                  setProfileTab("warehouse_invoices");
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" /> ملف المبيعات وكشف الحساب
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600" onClick={() => handleEdit(c)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600"
                                onClick={() => {
                                  if (confirm("هل أنت متأكد من حذف هذا العميل؟")) deleteMutation.mutate(c.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

        {/* Add / Edit Customer Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد وتحديد حساب الذمم"}</DialogTitle>
              <DialogDescription>
                أدخل بيانات العميل التجارية والضريبية وحدد تبعيته للفرع الرئيسي أو لموزع/وكيل معتمد لربطه تلقائياً بدليل الحسابات
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-4 py-2"
            >
              {/* Section 1: Branch / Distributor Affiliation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  تبعية العميل ونوع الحساب المالي (Affiliation & Accounting Link) *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setForm(f => ({
                      ...f,
                      affiliation_type: "direct",
                      office_id: "",
                      office_name: "المركز الرئيسي - الإدارة العامة للمبيعات",
                      account_code: ""
                    }))}
                    className={`cursor-pointer p-3 rounded-lg border-2 transition-all flex items-start gap-2.5 ${
                      form.affiliation_type === "direct"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center h-5 mt-0.5">
                      <input
                        type="radio"
                        name="affiliation_type"
                        checked={form.affiliation_type === "direct"}
                        onChange={() => {}}
                        className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-extrabold text-slate-900">🏢 عميل مباشر (المركز الرئيسي / الفروع)</span>
                      <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        يتم فتح حساب فرعي مستقل للعميل ضمن ذمم العملاء (11400) ويظهر له كشف حساب مستقل
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      const firstOff = offices[0];
                      setForm(f => ({
                        ...f,
                        affiliation_type: "agency",
                        office_id: firstOff ? String(firstOff.id) : "",
                        office_name: firstOff ? firstOff.name : "",
                        office_phone: firstOff ? firstOff.phone || "" : "",
                        account_code: firstOff?.account_code || "11200"
                      }));
                    }}
                    className={`cursor-pointer p-3 rounded-lg border-2 transition-all flex items-start gap-2.5 ${
                      form.affiliation_type === "agency"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center h-5 mt-0.5">
                      <input
                        type="radio"
                        name="affiliation_type"
                        checked={form.affiliation_type === "agency"}
                        onChange={() => {}}
                        className="h-4 w-4 text-primary border-slate-300 focus:ring-primary"
                      />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-extrabold text-slate-900">🏬 تابع لوكيل / موزع تجاري معتمد</span>
                      <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        عميل فرعي مسجل تحت مظلة موزع جملة أو وكيل مبيعات معتمد وترحل فواتيره لحساب الوكيل
                      </span>
                    </div>
                  </div>
                </div>

                {form.affiliation_type === "direct" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">اختر الفرع / نقطة المبيعات الرئيسية *</label>
                    <select
                      value={form.office_name || "المركز الرئيسي - الإدارة العامة للمبيعات"}
                      onChange={e => setForm(f => ({ ...f, office_name: e.target.value, office_id: "" }))}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="المركز الرئيسي - الإدارة العامة للمبيعات">
                        🏢 المركز الرئيسي - الإدارة العامة للمبيعات (المستودع المركزي)
                      </option>
                      <option value="فرع صنعاء - شارع حدة">🏢 فرع صنعاء - شارع حدة</option>
                      <option value="فرع عدن - خور مكسر">🏢 فرع عدن - خور مكسر</option>
                      <option value="فرع الرياض - طريق الملك فهد">🏢 فرع الرياض - طريق الملك فهد</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">الوكيل / الموزع التجاري المعتمد *</label>
                      <button
                        type="button"
                        onClick={() => setNewOfficeModalOpen(true)}
                        className="text-[11px] font-extrabold text-primary hover:underline"
                      >
                        + إضافة فرع أو وكيل توزيع جديد
                      </button>
                    </div>
                    <select
                      value={form.office_id || ""}
                      onChange={e => {
                        if (e.target.value === "NEW_OFFICE") {
                          setNewOfficeModalOpen(true);
                        } else {
                          handleSelectOffice(e.target.value);
                        }
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="" disabled>-- اختر الوكيل / الموزع التجاري --</option>
                      {offices.map((o: any) => (
                        <option key={o.id} value={o.id}>🏬 {o.name} {o.phone ? `(هاتف: ${o.phone})` : ""}</option>
                      ))}
                      <option value="NEW_OFFICE" className="font-bold text-primary">+ إضافة وكيل/موزع جديد...</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Dynamic Chart of Accounts sub-account linkage selection */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                {form.affiliation_type === "agency" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span>حساب الوكيل / الموزع في شجرة الحسابات:</span>
                      </label>
                      <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200">
                        كود الحساب: {form.account_code || "11200"}
                      </span>
                    </div>

                    <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-purple-950">
                          {form.office_name ? `حساب: ${form.office_name}` : "يرجى تحديد الوكيل التجاري من القائمة أعلاه"}
                        </div>
                        <div className="text-[11px] text-purple-700 font-mono mt-0.5">
                          دليل الحسابات &gt; الأصول المتداولة &gt; {form.account_code || "11200"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold bg-purple-700 text-white px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-sm">
                          <Lock className="w-3 h-3" />
                          مرتبط تلقائياً بحساب الوكيل
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-950">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>قاعدة الربط المحاسبي للوكلاء التجاريين:</span>
                      </div>
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        تُرحل كافة الفواتير والعمليات المالية لهذا العميل مباشرة إلى <strong>كشف حساب الوكيل التجاري ({form.office_name || "الوكيل المختار"})</strong> مع ذكر اسم العميل في بيان كل قيد وفاتورة.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>ربط الحساب بدليل الحسابات (ذمم العملاء والمدينين التجاريين 11400) *</span>
                    </label>
                    <select
                      value={form.account_code}
                      onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      <option value="">✨ إنشاء/ربط حساب فرعي مستقل للعميل تلقائياً ضمن (ذمم العملاء 11400)</option>
                      {subAccounts.map((acc: any) => (
                        <option key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      عميل مباشر: يتم تخصيص حساب مالي مستقل وكشف حساب خاص به ضمن ذمم العملاء والمدينين التجاريين (114XX).
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم العميل (Customer Code)</label>
                  <Input
                    placeholder="مثال: CUST-1001 أو يترك تلقائياً"
                    value={form.customer_number}
                    onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تصنيف العميل (Category) *</label>
                  <select
                    value={form.customer_type}
                    onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="individual">عميل تجزئة / أفراد (Individual)</option>
                    <option value="corporate">شركة / مؤسسة تجارية (Corporate)</option>
                    <option value="vip">عميل جملة / VIP</option>
                    <option value="debtor">عميل آجل (Debtor)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">اسم العميل / المنشأة التجارية بالعربية *</label>
                  <Input
                    required
                    placeholder="مثال: عبدالله محمد العتيبي / مؤسسة الأفق للتجارة"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الاسم التجاري بالإنجليزية</label>
                  <Input
                    placeholder="مثال: AL-OFOQ TRADING EST"
                    value={form.name_en}
                    onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم الجوال الأساسي *</label>
                  <Input
                    required
                    placeholder="0500000000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">هاتف بديل / واتساب</label>
                  <Input
                    placeholder="0550000000"
                    value={form.alternate_phone}
                    onChange={e => setForm(f => ({ ...f, alternate_phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    placeholder="client@company.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الرقم الضريبي (VAT Number)</label>
                  <Input
                    placeholder="مثال: 300123456700003"
                    value={form.passport_number}
                    onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم السجل التجاري / الهوية الوطنية</label>
                  <Input
                    placeholder="1010887766"
                    value={form.national_id}
                    onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ انتهاء السجل / العقد الائتماني</label>
                  <Input
                    type="date"
                    value={form.passport_expiry_date}
                    onChange={e => setForm(f => ({ ...f, passport_expiry_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">النشاط التجاري / جهة العمل</label>
                  <Input
                    placeholder="تجارة مواد غذائية / مقاولات / تموينات"
                    value={form.employer}
                    onChange={e => setForm(f => ({ ...f, employer: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">العنوان التفصيلي والمدينة</label>
                  <Input
                    placeholder="المدينة - الحي - الشارع"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ملاحظات العميل وشروط الدفع والائتمان</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="شروط السداد، السقف الائتماني، وملاحظات التسليم..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 font-bold">
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ بيانات العميل"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Quick Add Branch / Commercial Distributor Modal */}
        <Dialog open={newOfficeModalOpen} onOpenChange={setNewOfficeModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                إضافة فرع / موزع تجاري معتمد
              </DialogTitle>
              <DialogDescription>
                تسجيل فرع مبيعات أو وكيل توزيع جملة للربط مع العملاء وفواتير المبيعات
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                saveOfficeMutation.mutate(newOfficeForm);
              }}
              className="space-y-3 py-2"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم الفرع أو مؤسسة التوزيع *</label>
                <Input
                  required
                  placeholder="مثال: مؤسسة النخبة للتجارة والتوزيع"
                  value={newOfficeForm.name}
                  onChange={e => setNewOfficeForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">نوع الجهة *</label>
                  <select
                    value={newOfficeForm.office_type}
                    onChange={e => setNewOfficeForm(f => ({ ...f, office_type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="partner_agency">وكيل وموزع مبيعات معتمد</option>
                    <option value="branch">فرع مبيعات تابع للشركة</option>
                    <option value="b2b_office">موزع جملة وتوريدات مخزنية</option>
                    <option value="sub_agent">مندوب / وكيل توزيع فرعي</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المدينة / المنطقة</label>
                  <Input
                    placeholder="صنعاء / الرياض / جدة"
                    value={newOfficeForm.city}
                    onChange={e => setNewOfficeForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم الهاتف / الواتساب</label>
                  <Input
                    placeholder="0500000000"
                    value={newOfficeForm.phone}
                    onChange={e => setNewOfficeForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المسؤول التجاري</label>
                  <Input
                    placeholder="أ. مدير المبيعات"
                    value={newOfficeForm.contact_person}
                    onChange={e => setNewOfficeForm(f => ({ ...f, contact_person: e.target.value }))}
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-emerald-900 block">فتح حساب فوري في دليل الحسابات:</span>
                  بمجرد إضافة هذا الفرع/الوكيل، يتم تلقائياً فتح حساب مالي له في شجرة الحسابات وترحيل معاملات العملاء التابعين له.
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => setNewOfficeModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={saveOfficeMutation.isPending} className="bg-primary hover:bg-primary/90 font-bold">
                  {saveOfficeMutation.isPending ? "جاري الإضافة..." : "إضافة وحفظ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Unified Customer Sales, Warehouse & Financial Profile Modal */}
        <Dialog open={Boolean(activeProfileId)} onOpenChange={open => !open && setActiveProfileId(null)}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
            {isLoadingProfile || !profileData ? (
              <div className="p-12 text-center text-muted-foreground">جاري تحميل ملف المبيعات وكشف الحساب للعميل...</div>
            ) : (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900 text-white rounded-xl gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold">{profileData.customer.name}</h2>
                      <span className="px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-xs font-mono rounded">
                        حساب رقم: {profileData.customer.account_code}
                      </span>
                    </div>
                    {profileData.customer.name_en && <p className="text-sm font-mono opacity-80">{profileData.customer.name_en}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-xs mt-2 opacity-90">
                      <span>📱 {profileData.customer.phone || "-"}</span>
                      {profileData.customer.email && <span>✉️ {profileData.customer.email}</span>}
                      {profileData.customer.national_id && <span>🏢 سجل/هوية: {profileData.customer.national_id}</span>}
                      {profileData.customer.passport_number && <span>🧾 الرقم الضريبي: {profileData.customer.passport_number}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                        {TYPE_BADGES[profileData.customer.customer_type]?.label || "عميل"}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        profileData.customer.affiliation_type === "agency" ? "bg-amber-400 text-amber-950" : "bg-emerald-400 text-emerald-950"
                      }`}>
                        {profileData.customer.affiliation_type === "agency"
                          ? `🏬 وكيل: ${profileData.customer.office_name || "موزع معتمد"}`
                          : `🏢 مباشر: ${profileData.customer.office_name || "المركز الرئيسي"}`}
                      </span>
                    </div>
                    <span className="text-xs opacity-75 font-mono">
                      كود العميل: {profileData.customer.customer_number || `#${profileData.customer.id}`}
                    </span>
                  </div>
                </div>

                {/* Profile Summary KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg border">
                    <p className="text-xs text-muted-foreground font-bold">إجمالي المبيعات (مخزني + POS)</p>
                    <p className="text-lg font-bold font-mono text-slate-900">
                      {Number(profileData.summary?.total_sales_amount || 0).toLocaleString()} ر.س
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-800 font-bold">إجمالي المسدد والمدفوعات</p>
                    <p className="text-lg font-bold font-mono text-emerald-700">
                      {Number(profileData.summary?.total_paid_amount || 0).toLocaleString()} ر.س
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800 font-bold">الرصيد المتبقي في كشف الحساب</p>
                    <p className="text-lg font-bold font-mono text-amber-700">
                      {Number(profileData.summary?.remaining_balance || 0).toLocaleString()} ر.س
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800 font-bold">إجمالي الفواتير المنفذة</p>
                    <p className="text-lg font-bold font-mono text-blue-700">
                      {Number(profileData.summary?.warehouse_invoices_count || 0) + Number(profileData.summary?.pos_orders_count || 0)} فاتورة
                    </p>
                  </div>
                </div>

                {/* Profile Tabs Navigation */}
                <div className="flex border-b overflow-x-auto gap-2 pb-1">
                  {[
                    ["warehouse_invoices", `فواتير المبيعات المخزنية (${profileData.warehouseInvoices?.length || 0})`, Package],
                    ["pos_orders", `فواتير نقاط البيع POS (${profileData.posOrders?.length || 0})`, ShoppingCart],
                    ["quotations", `عروض الأسعار والمرتجعات (${(profileData.quotations?.length || 0) + (profileData.salesReturns?.length || 0)})`, RotateCcw],
                    ["statement", `كشف الحساب المالي (${profileData.statement?.length || 0})`, FileText],
                    ["logs", "سجل التواصل والملاحظات", MessageSquare]
                  ].map(([id, title, Icon]: any) => (
                    <button
                      key={id}
                      onClick={() => setProfileTab(id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap ${
                        profileTab === id ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {title}
                    </button>
                  ))}
                </div>

                {/* Tab 1: Warehouse Sales Invoices */}
                {profileTab === "warehouse_invoices" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">فواتير المبيعات المخزنية (نقد / آجل) الخاصة بالعميل</h3>
                    </div>
                    {(!profileData.warehouseInvoices || profileData.warehouseInvoices.length === 0) ? (
                      <p className="text-xs text-muted-foreground p-6 text-center bg-slate-50 rounded-lg border">
                        لا توجد فواتير مبيعات مخزنية مسجلة لهذا العميل حتى الآن
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2.5">رقم الفاتورة</th>
                              <th className="p-2.5">التاريخ</th>
                              <th className="p-2.5">المستودع</th>
                              <th className="p-2.5">نوع الدفع</th>
                              <th className="p-2.5">الأصناف</th>
                              <th className="p-2.5">الإجمالي</th>
                              <th className="p-2.5">المدفوع</th>
                              <th className="p-2.5">المتبقي</th>
                              <th className="p-2.5">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.warehouseInvoices.map((inv: any) => (
                              <tr key={inv.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-bold text-primary">{inv.invoice_no}</td>
                                <td className="p-2.5 font-mono">{inv.invoice_date}</td>
                                <td className="p-2.5">{inv.warehouse_name || "المستودع الرئيسي"}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    inv.payment_type === "credit" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                  }`}>
                                    {inv.payment_type === "credit" ? "آجل (ذمم)" : inv.payment_type === "card" ? "شبكة / بنك" : "نقدي"}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  {inv.items && inv.items.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {inv.items.map((it: any, idx: number) => (
                                        <div key={idx} className="text-[11px] text-slate-700">
                                          • {it.item_name} ({it.quantity} {it.unit})
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>{inv.items_count || 1} صنف</span>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono font-bold">{Number(inv.total_amount || 0).toLocaleString()} ر.س</td>
                                <td className="p-2.5 font-mono text-emerald-700 font-bold">{Number(inv.paid_amount || 0).toLocaleString()} ر.س</td>
                                <td className="p-2.5 font-mono text-amber-700 font-bold">{Number(inv.remaining_amount || 0).toLocaleString()} ر.س</td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px]">
                                    {inv.status === "posted" ? "مرحّلة للحسابات ✅" : inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: POS Orders */}
                {profileTab === "pos_orders" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-800">فواتير مبيعات نقاط البيع (POS)</h3>
                    {(!profileData.posOrders || profileData.posOrders.length === 0) ? (
                      <p className="text-xs text-muted-foreground p-6 text-center bg-slate-50 rounded-lg border">
                        لا توجد فواتير نقاط بيع (POS) لهذا العميل
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2.5">رقم الطلب</th>
                              <th className="p-2.5">التاريخ</th>
                              <th className="p-2.5">طريقة الدفع</th>
                              <th className="p-2.5">عدد الأصناف</th>
                              <th className="p-2.5">الإجمالي</th>
                              <th className="p-2.5">المدفوع</th>
                              <th className="p-2.5">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.posOrders.map((o: any) => (
                              <tr key={o.id} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-bold text-primary">{o.order_number || `#${o.id}`}</td>
                                <td className="p-2.5 font-mono">{(o.created_at || "").slice(0, 16)}</td>
                                <td className="p-2.5 font-bold">{o.payment_method === "credit" ? "آجل" : o.payment_method === "card" ? "شبكة" : "نقدي"}</td>
                                <td className="p-2.5">{o.items_count || 1} صنف</td>
                                <td className="p-2.5 font-mono font-bold">{Number(o.total || 0).toLocaleString()} ر.س</td>
                                <td className="p-2.5 font-mono text-emerald-700 font-bold">{Number(o.paid_amount ?? o.total ?? 0).toLocaleString()} ر.س</td>
                                <td className="p-2.5 font-bold">{o.status || "مكتمل"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Quotations & Returns */}
                {profileTab === "quotations" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-800">عروض الأسعار المقدمة للعميل ({profileData.quotations?.length || 0})</h3>
                      {(!profileData.quotations || profileData.quotations.length === 0) ? (
                        <p className="text-xs text-muted-foreground p-4 text-center bg-slate-50 rounded border">لا توجد عروض أسعار مسجلة</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right border">
                            <thead className="bg-slate-100 font-bold border-b">
                              <tr>
                                <th className="p-2">رقم العرض</th>
                                <th className="p-2">التاريخ</th>
                                <th className="p-2">تاريخ الانتهاء</th>
                                <th className="p-2">الإجمالي</th>
                                <th className="p-2">الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profileData.quotations.map((q: any) => (
                                <tr key={q.id} className="border-b">
                                  <td className="p-2 font-mono font-bold">{q.quotation_number || `#${q.id}`}</td>
                                  <td className="p-2 font-mono">{q.quotation_date || q.created_at?.slice(0, 10)}</td>
                                  <td className="p-2 font-mono">{q.valid_until || "-"}</td>
                                  <td className="p-2 font-mono font-bold">{Number(q.total_amount || q.total || 0).toLocaleString()} ر.س</td>
                                  <td className="p-2 font-bold">{q.status || "جديد"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-800">مرتجعات المبيعات ({profileData.salesReturns?.length || 0})</h3>
                      {(!profileData.salesReturns || profileData.salesReturns.length === 0) ? (
                        <p className="text-xs text-muted-foreground p-4 text-center bg-slate-50 rounded border">لا توجد مرتجعات مبيعات مسجلة</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right border">
                            <thead className="bg-slate-100 font-bold border-b">
                              <tr>
                                <th className="p-2">رقم المرتجع</th>
                                <th className="p-2">التاريخ</th>
                                <th className="p-2">السبب</th>
                                <th className="p-2">المبلغ</th>
                                <th className="p-2">الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profileData.salesReturns.map((sr: any) => (
                                <tr key={sr.id} className="border-b">
                                  <td className="p-2 font-mono font-bold text-red-700">{sr.return_number || `#${sr.id}`}</td>
                                  <td className="p-2 font-mono">{sr.return_date || sr.created_at?.slice(0, 10)}</td>
                                  <td className="p-2">{sr.reason || "-"}</td>
                                  <td className="p-2 font-mono font-bold">{Number(sr.total_amount || sr.total || 0).toLocaleString()} ر.س</td>
                                  <td className="p-2 font-bold">{sr.status || "معتمد"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: Statement of Account (كشف حساب العميل التفصيلي) */}
                {profileTab === "statement" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          كشف حساب العميل التفصيلي - حساب ({profileData.customer.account_code})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          مرتبط مباشرة بدفتر الأستاذ العام وكشوفات الحسابات في النظام المحاسبي
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={handlePreviewStatement} className="gap-1 text-xs bg-primary hover:bg-primary/90 font-bold">
                          <Eye className="w-3.5 h-3.5" /> استعراض كشف الحساب A4
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1 text-xs border-slate-300">
                          تصدير CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleSendWhatsApp} className="gap-1 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100">
                          <MessageSquare className="w-3.5 h-3.5" /> إرسال واتساب
                        </Button>
                        <Button size="sm" onClick={() => setPaymentModalOpen(true)} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold text-white">
                          <DollarSign className="w-3.5 h-3.5" /> تسجيل دفعة / سند قبض
                        </Button>
                      </div>
                    </div>

                    {(!profileData.statement || profileData.statement.length === 0) ? (
                      <p className="text-xs text-muted-foreground p-6 text-center bg-slate-50 rounded-lg border">
                        لا توجد حركات محاسبية مسجلة على حساب هذا العميل حتى الآن
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-900 text-white font-bold">
                            <tr>
                              <th className="p-2.5">التاريخ</th>
                              <th className="p-2.5">رقم القيد</th>
                              <th className="p-2.5">البيان والتفاصيل</th>
                              <th className="p-2.5">مدين (عليه)</th>
                              <th className="p-2.5">دائن (له)</th>
                              <th className="p-2.5">الرصيد التراكمي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.statement.map((row: any, idx: number) => (
                              <tr key={row.id || idx} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 font-mono">{row.date}</td>
                                <td className="p-2.5 font-mono font-bold text-blue-700">{row.entry_number || `#${row.entry_id}`}</td>
                                <td className="p-2.5 font-medium">{row.description}</td>
                                <td className="p-2.5 font-mono font-bold text-red-700">
                                  {Number(row.debit || 0) > 0 ? Number(row.debit).toLocaleString() : "-"}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-emerald-700">
                                  {Number(row.credit || 0) > 0 ? Number(row.credit).toLocaleString() : "-"}
                                </td>
                                <td className="p-2.5 font-mono font-black text-slate-900 bg-slate-50">
                                  {Number(row.balance || 0).toLocaleString()} ر.س
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Communication Logs & Notes */}
                {profileTab === "logs" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold">سجل التواصل وملاحظات المتابعة التجارية</h3>

                    <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={newLogType}
                          onChange={e => setNewLogType(e.target.value)}
                          className="h-9 rounded border text-xs px-2 bg-white font-bold"
                        >
                          <option value="واتساب">واتساب</option>
                          <option value="اتصال">اتصال هاتفي</option>
                          <option value="بريد إلكتروني">بريد إلكتروني</option>
                          <option value="زيارة ميدانية">زيارة مندوب مبيعات</option>
                        </select>
                        <Input
                          placeholder="اكتب ملخص التواصل أو المتابعة مع العميل..."
                          value={newLogSummary}
                          onChange={e => setNewLogSummary(e.target.value)}
                          className="h-9 text-xs bg-white flex-1"
                        />
                        <Button
                          disabled={!newLogSummary || addLogMutation.isPending}
                          onClick={() => addLogMutation.mutate({ customer_id: activeProfileId, contact_type: newLogType, summary: newLogSummary })}
                          className="h-9 text-xs font-bold"
                        >
                          إضافة ملاحظة
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Full-Screen Statement Preview Modal */}
        <Dialog open={previewStatementOpen} onOpenChange={setPreviewStatementOpen}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <DialogTitle className="text-white text-lg font-bold">استعراض كشف الحساب المعتمد (A4)</DialogTitle>
                <DialogDescription className="text-slate-300 text-xs">استعراض دقيق لكشف الحساب قبل الطباعة أو التصدير</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => profileData?.customer && printA4Html(previewStatementHtml, `كشف حساب - ${profileData.customer.name}`)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1">
                  <Printer className="w-4 h-4" /> طباعة فورية
                </Button>
                <Button onClick={handleExportCsv} variant="outline" className="text-white border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs gap-1">
                  تصدير CSV
                </Button>
                <Button onClick={() => setPreviewStatementOpen(false)} variant="ghost" className="text-white hover:bg-slate-800">
                  إغلاق
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 overflow-hidden">
              <iframe
                srcDoc={previewStatementHtml}
                className="w-full h-full bg-white rounded-lg shadow-md border"
                title="Full Screen Statement Preview"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Voucher Modal */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                تسجيل سند قبض دفعة مالية من العميل
              </DialogTitle>
              <DialogDescription>
                تحصيل مبلغ نقدي أو تحويل بنكي وتخفيض الرصيد الآجل للعميل في كشف الحساب
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); paymentMutation.mutate(paymentForm); }} className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">مبلغ القبض (ر.س) *</label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">طريقة التحصيل</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold"
                >
                  <option value="cash">نقداً (الصندوق الرئيسي 11100)</option>
                  <option value="bank">تحويل بنكي (البنك 11200)</option>
                  <option value="card">شبكة / بطاقة مدى (11200)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">رقم المرجع / الإيصال</label>
                <Input
                  placeholder="رقم سند القبض أو الحوالة البنكية"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">البيان / ملاحظات السند</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="دفعة مسددة من حساب العميل..."
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={paymentMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                  {paymentMutation.isPending ? "جاري الحفظ..." : "حفظ وترحيل سند القبض"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
