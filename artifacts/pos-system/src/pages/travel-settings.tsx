import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings, Building2, ShieldAlert, FileText, Globe,
  CheckCircle2, Plus, Edit2, Trash2, Save, Sparkles,
  DollarSign, Stamp, AlertTriangle, ListChecks, Check, ShieldCheck,
  KeyRound, Radio, Wifi, Send, Eye, EyeOff, RefreshCw, MessageSquare, Mail,
  ExternalLink, Copy, CheckCheck, Server, Cpu
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPut(url: string, body: any) { const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDelete(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok) throw new Error(await r.text()); return true; }

export default function TravelSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"agency" | "rules" | "visas" | "templates" | "apis">("agency");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
  const [testResults, setTestResults] = useState<Record<number, any>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };
  const [editingGateway, setEditingGateway] = useState<any | null>(null);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("0505544332");

  // Settings Query
  const { data: settings = {}, isLoading: settingsLoading } = useQuery({
    queryKey: ["travel-settings"],
    queryFn: () => apiGet("/api/travel/settings")
  });

  // Visa Types Query
  const { data: visaTypes = [], isLoading: visasLoading } = useQuery({
    queryKey: ["travel-visa-types"],
    queryFn: () => apiGet("/api/travel/visa-types")
  });

  // Gateways Query
  const { data: gateways = [], isLoading: gatewaysLoading } = useQuery({
    queryKey: ["travel-gateways"],
    queryFn: () => apiGet("/api/travel/notifications/gateways")
  });

  // Update Gateway Mutation
  const updateGatewayMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPut(`/api/travel/notifications/gateways/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-gateways"] });
      setGatewayModalOpen(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  });

  // Test Gateway Mutation
  const testGatewayMutation = useMutation({
    mutationFn: ({ id, phone }: { id: number; phone?: string }) => apiPost(`/api/travel/notifications/gateways/${id}/test`, { test_phone: phone }),
    onSuccess: (result, variables) => {
      setTestResults(prev => ({ ...prev, [variables.id]: result }));
      queryClient.invalidateQueries({ queryKey: ["travel-gateways"] });
    }
  });

  // Form State for System Settings
  const [formState, setFormState] = useState<any>({});

  // Sync loaded settings into local form state once loaded
  const currentSettings = { ...settings, ...formState };

  const updateSettingField = (field: string, value: any) => {
    setFormState((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: (data: any) => apiPut("/api/travel/settings", data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["travel-settings"], updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate(currentSettings);
  };

  // Visa Types CRUD Modal
  const [visaModalOpen, setVisaModalOpen] = useState(false);
  const [editingVisa, setEditingVisa] = useState<any | null>(null);
  const [country, setCountry] = useState("");
  const [countryEn, setCountryEn] = useState("");
  const [visaName, setVisaName] = useState("");
  const [visaCode, setVisaCode] = useState("");
  const [visaCategory, setVisaCategory] = useState("سياحة");
  const [standardFee, setStandardFee] = useState("500");
  const [embassyFee, setEmbassyFee] = useState("350");
  const [processingDays, setProcessingDays] = useState("7");
  const [validityDays, setValidityDays] = useState("90");
  const [stayDays, setStayDays] = useState("30");
  const [entryType, setEntryType] = useState("سفرة واحدة");
  const [docList, setDocList] = useState("جواز السفر ساري المفعول لمدة 6 أشهر على الأقل\nصورتين شخصيتين خلفية بيضاء\nكشف حساب بنكي لآخر 3 أشهر\nحجز فندقي وتذكرة طيران مبدئية");
  const [visaNotes, setVisaNotes] = useState("");

  const saveVisaMutation = useMutation({
    mutationFn: (data: any) => editingVisa ? apiPut(`/api/travel/visa-types/${editingVisa.id}`, data) : apiPost("/api/travel/visa-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-visa-types"] });
      setVisaModalOpen(false);
      setEditingVisa(null);
    }
  });

  const deleteVisaMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/travel/visa-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-visa-types"] });
    }
  });

  const openAddVisa = () => {
    setEditingVisa(null);
    setCountry("");
    setCountryEn("");
    setVisaName("");
    setVisaCode("");
    setVisaCategory("سياحة");
    setStandardFee("500");
    setEmbassyFee("350");
    setProcessingDays("7");
    setValidityDays("90");
    setStayDays("30");
    setEntryType("سفرة واحدة");
    setDocList("جواز السفر ساري المفعول لمدة 6 أشهر\nصورتين شخصيتين خلفية بيضاء\nكشف حساب بنكي 3 أشهر");
    setVisaNotes("");
    setVisaModalOpen(true);
  };

  const openEditVisa = (vt: any) => {
    setEditingVisa(vt);
    setCountry(vt.country || "");
    setCountryEn(vt.country_en || "");
    setVisaName(vt.name || "");
    setVisaCode(vt.visa_code || "");
    setVisaCategory(vt.visa_category || "سياحة");
    setStandardFee(String(vt.standard_fee || 0));
    setEmbassyFee(String(vt.embassy_fee || 0));
    setProcessingDays(String(vt.processing_days || 7));
    setValidityDays(String(vt.validity_days || 90));
    setStayDays(String(vt.stay_days || 30));
    setEntryType(vt.entry_type || "سفرة واحدة");
    
    let docs = vt.required_documents;
    if (typeof docs === "string" && docs.startsWith("[")) {
      try { docs = JSON.parse(docs).join("\n"); } catch {}
    }
    setDocList(docs || "");
    setVisaNotes(vt.notes || "");
    setVisaModalOpen(true);
  };

  const handleSaveVisa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country || !visaName) return;

    const docsArray = docList.split("\n").map(d => d.trim()).filter(Boolean);

    saveVisaMutation.mutate({
      country,
      country_en: countryEn,
      name: visaName,
      visa_code: visaCode,
      visa_category: visaCategory,
      standard_fee: Number(standardFee),
      embassy_fee: Number(embassyFee),
      processing_days: Number(processingDays),
      validity_days: Number(validityDays),
      stay_days: Number(stayDays),
      entry_type: entryType,
      required_documents: JSON.stringify(docsArray),
      notes: visaNotes
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Settings className="w-7 h-7 text-indigo-600" />
              إعدادات النظام الشاملة وقواعد العمل (Business Rules)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              إدارة هوية وكالة السفر، التراخيص، شروط التذاكر، وضبط القيود الرقابية وقواعد العمل الصارمة
            </p>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              تم حفظ الإعدادات وقواعد العمل بنجاح!
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("agency")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "agency"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            هوية وبيانات الوكالة
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "rules"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            قواعد العمل والأمان (Business Rules)
          </button>

          <button
            onClick={() => setActiveTab("visas")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "visas"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Stamp className="w-4 h-4" />
            أنواع التأشيرات والمتطلبات ({visaTypes.length})
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "templates"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            شروط وقوالب الطباعة
          </button>

          <button
            onClick={() => setActiveTab("apis")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "apis"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            تكامل موفري الـ API والرسائل ({gateways.length})
          </button>
        </div>

        {/* TAB 1: AGENCY IDENTITY & INFO */}
        {activeTab === "agency" && (
          <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-3">
              <Building2 className="w-5 h-5 text-indigo-600" />
              البيانات الرسمية وهوية وكالة السياحة والسفر
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم الوكالة / الشركة (بالعربية) *</label>
                <Input
                  required
                  value={currentSettings.company_name_ar || ""}
                  onChange={e => updateSettingField("company_name_ar", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم الشركة (بالإنجليزية)</label>
                <Input
                  value={currentSettings.company_name_en || ""}
                  onChange={e => updateSettingField("company_name_en", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">رمز منظمة أياتا (IATA Code)</label>
                <Input
                  placeholder="مثال: 12-3 4567 8"
                  value={currentSettings.iata_code || ""}
                  onChange={e => updateSettingField("iata_code", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">رقم ترخيص وزارة السياحة</label>
                <Input
                  placeholder="مثال: TRV-88992"
                  value={currentSettings.license_number || ""}
                  onChange={e => updateSettingField("license_number", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">الرقم الضريبي (VAT Number)</label>
                <Input
                  placeholder="مثال: 300000000000003"
                  value={currentSettings.tax_number || ""}
                  onChange={e => updateSettingField("tax_number", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">رقم السجل التجاري (CR)</label>
                <Input
                  placeholder="مثال: 1010101010"
                  value={currentSettings.commercial_reg || ""}
                  onChange={e => updateSettingField("commercial_reg", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">هاتف التواصل الرئيسي</label>
                <Input
                  value={currentSettings.phone_primary || ""}
                  onChange={e => updateSettingField("phone_primary", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">البريد الإلكتروني الرسمي</label>
                <Input
                  type="email"
                  value={currentSettings.email || ""}
                  onChange={e => updateSettingField("email", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">عنوان المقر الرئيسي</label>
                <Input
                  value={currentSettings.address || ""}
                  onChange={e => updateSettingField("address", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">العملة الافتراضية للنظام</label>
                <Input
                  value={currentSettings.default_currency || "ريال"}
                  onChange={e => updateSettingField("default_currency", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">نسبة ضريبة القيمة المضافة (VAT %)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={currentSettings.vat_percentage ?? 15}
                  onChange={e => updateSettingField("vat_percentage", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={saveSettingsMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-6 rounded-xl">
                <Save className="w-4 h-4 ml-1.5" />
                حفظ بيانات الوكالة
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: BUSINESS RULES ENFORCEMENT */}
        {activeTab === "rules" && (
          <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                تفعيل وإلزام قواعد العمل الرقابية والمحاسبية (Business Rules)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تطبيق السياسات الصارمة لمنع الأخطاء البشرية والتلاعب المالي والحفاظ على سلامة القيود المحاسبية
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Rule 1 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    منع إصدار أو حفظ أي تذكرة بدون تحديد العميل
                  </span>
                  <p className="text-[11px] text-slate-500">
                    يلزم النظام الموظف باختيار عميل مسجل أو إدخال بيانات العميل قبل إصدار التذكرة لمنع الحسابات المجهولة.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentSettings.require_customer_for_tickets ?? 1)}
                  onChange={e => updateSettingField("require_customer_for_tickets", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>

              {/* Rule 2 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    منع بيع التذاكر والخدمات بأقل من سعر التكلفة
                  </span>
                  <p className="text-[11px] text-slate-500">
                    يحظر تماماً بيع أي خدمة بسعر أقل من تكلفة المورد لتفادي الخسائر المالية غير المصرحة.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!Boolean(currentSettings.allow_selling_below_cost)}
                  onChange={e => updateSettingField("allow_selling_below_cost", e.target.checked ? 0 : 1)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>

              {/* Rule 3 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    الحظر الصارم لحذف العمليات المالية والتذاكر المؤكدة (استخدام الإلغاء بدلاً من الحذف)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    يمنع حذف التذاكر الصادرة أو القيود المالية نهائياً من قاعدة البيانات، ويلزم المستخدم باستخدام زر الإلغاء أو الاسترجاع مع تسجيل حركة في سجل التدقيق.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentSettings.strict_financial_deletion_prevention ?? 1)}
                  onChange={e => updateSettingField("strict_financial_deletion_prevention", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>

              {/* Rule 4 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    الربط التلقائي وإصدار الفاتورة عند تأكيد حجز التذكرة
                  </span>
                  <p className="text-[11px] text-slate-500">
                    توليد فاتورة مبيعات وقيد محاسبي مزدوج تلقائياً في دفتر اليومية عند إصدار أي تذكرة جديدة.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentSettings.auto_generate_invoice_on_booking ?? 1)}
                  onChange={e => updateSettingField("auto_generate_invoice_on_booking", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>

              {/* Rule 5 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    تسجيل ومطابقة العمولات تلقائياً (Commissions Tracking)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    حساب عمولة الوكالة وفرق التكلفة وإضافتها مباشرة لسجل العمولات اليومي وتقارير الأرباح.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentSettings.auto_register_commission ?? 1)}
                  onChange={e => updateSettingField("auto_register_commission", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>

              {/* Rule 6 */}
              <div className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/60 transition-colors">
                <div className="space-y-1">
                  <span className="font-black text-slate-900 text-xs block">
                    إلزام فحص قائمة المستندات المطلوبة للتأشيرات
                  </span>
                  <p className="text-[11px] text-slate-500">
                    التأكد من توفر جميع المستندات الإلزامية حسب نوع التأشيرة والدولة قبل إرسال الطلب للسفارة.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(currentSettings.enforce_visa_document_checklist ?? 1)}
                  onChange={e => updateSettingField("enforce_visa_document_checklist", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={saveSettingsMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-6 rounded-xl">
                <Save className="w-4 h-4 ml-1.5" />
                حفظ قواعد العمل
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: VISA TYPES & CHECKLIST */}
        {activeTab === "visas" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Stamp className="w-5 h-5 text-indigo-600" />
                  قائمة أنواع التأشيرات والأسعار وقوائم المستندات المطلوبة
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  تحديد الدول، رسوم السفارة، عمولة المكتب، ومدة الإنجاز مع قائمة المستندات الإلزامية لكل نوع تأشيرة
                </p>
              </div>

              <Button onClick={openAddVisa} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-4 rounded-xl">
                <Plus className="w-4 h-4 ml-1.5" />
                إضافة نوع تأشيرة جديد
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="p-3 text-right">الدولة / الكود</th>
                    <th className="p-3 text-right">اسم ونوع التأشيرة</th>
                    <th className="p-3 text-center">سعر البيع</th>
                    <th className="p-3 text-center">رسوم السفارة</th>
                    <th className="p-3 text-center">مدة الإنجاز</th>
                    <th className="p-3 text-right">المستندات المطلوبة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {visaTypes.map((vt: any) => {
                    let docs: string[] = [];
                    if (typeof vt.required_documents === "string") {
                      try { docs = JSON.parse(vt.required_documents); } catch { docs = vt.required_documents.split("\n"); }
                    } else if (Array.isArray(vt.required_documents)) {
                      docs = vt.required_documents;
                    }

                    return (
                      <tr key={vt.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{vt.country}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{vt.visa_code}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-indigo-700">{vt.name}</div>
                          <div className="text-[10px] text-slate-500">{vt.visa_category} ({vt.entry_type})</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-700">
                          {Number(vt.standard_fee || 0).toLocaleString()} ريال
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {Number(vt.embassy_fee || 0).toLocaleString()} ريال
                        </td>
                        <td className="p-3 text-center font-mono">
                          {vt.processing_days || 7} أيام
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {docs.slice(0, 3).map((d, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700 border border-slate-200">
                                {d}
                              </span>
                            ))}
                            {docs.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-[10px] text-indigo-700 font-bold">
                                +{docs.length - 3} مستندات
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditVisa(vt)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("هل تريد حذف هذا النوع من التأشيرات؟")) {
                                  deleteVisaMutation.mutate(vt.id);
                                }
                              }}
                              className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visaTypes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        لم يتم إضافة أي أنواع تأشيرات بعد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PRINTING TEMPLATES & TERMS */}
        {activeTab === "templates" && (
          <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              الشروط والأحكام ونصوص الترويسة والتذييل للطباعة
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ترويسة الفاتورة المطبوعة</label>
                <textarea
                  rows={3}
                  value={currentSettings.invoice_header_text || ""}
                  onChange={e => updateSettingField("invoice_header_text", e.target.value)}
                  placeholder="أدخل نص الترويسة للفواتير..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شروط وأحكام تذييل الفاتورة</label>
                <textarea
                  rows={3}
                  value={currentSettings.invoice_footer_terms || ""}
                  onChange={e => updateSettingField("invoice_footer_terms", e.target.value)}
                  placeholder="شروط السداد والاسترجاع للفواتير..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">شروط وأحكام تذاكر الطيران (Ticket Terms)</label>
                <textarea
                  rows={4}
                  value={currentSettings.ticket_footer_terms || ""}
                  onChange={e => updateSettingField("ticket_footer_terms", e.target.value)}
                  placeholder="تعليمات الحضور قبل موعد الإقلاع، سياسة الأمتعة، وشروط الإلغاء..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">إخلاء مسؤولية وشروط معاملات التأشيرات</label>
                <textarea
                  rows={4}
                  value={currentSettings.visa_footer_terms || ""}
                  onChange={e => updateSettingField("visa_footer_terms", e.target.value)}
                  placeholder="الوكالة غير مسؤولة عن رفض السفارة أو تأخر إصدار التأشيرات..."
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">غرامة إلغاء التذكرة الافتراضية (ريال)</label>
                <Input
                  type="number"
                  value={currentSettings.ticket_refund_penalty_default ?? 100}
                  onChange={e => updateSettingField("ticket_refund_penalty_default", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">رسوم خدمة استرجاع المكتب الافتراضية (ريال)</label>
                <Input
                  type="number"
                  value={currentSettings.ticket_refund_office_fee_default ?? 50}
                  onChange={e => updateSettingField("ticket_refund_office_fee_default", e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={saveSettingsMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-6 rounded-xl">
                <Save className="w-4 h-4 ml-1.5" />
                حفظ القوالب والشروط
              </Button>
            </div>
          </form>
        )}

        {/* TAB 5: API INTEGRATIONS & NOTIFICATION GATEWAYS */}
        {activeTab === "apis" && (
          <div className="space-y-6">
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
                      <KeyRound className="w-6 h-6 text-amber-400" />
                    </span>
                    <h2 className="text-xl font-black">لوحة تكامل واجهات برمجة التطبيقات (API Integrations Hub)</h2>
                  </div>
                  <p className="text-xs text-slate-300">
                    أدخل مفاتيح وبيانات الاعتماد التي تحصل عليها من موفري الخدمة (Infobip, WhatsApp Cloud API, Twilio, Unifonic, Google Workspace) لتفعيل الربط المباشر وإرسال الرسائل والتذاكر للعملاء
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 text-xs">
                  <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-mono text-emerald-300 font-bold">حالة محرك الربط: نشط وسحابي 🌐</span>
                </div>
              </div>
            </div>

            {/* Quick Test Phone Number Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">رقم الهاتف الافتراضي لإجراء الفحص والاختبار التجريبي:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  dir="ltr"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="مثال: 966501234567"
                  className="h-8 text-xs font-mono w-48 text-left"
                />
                <Badge variant="outline" className="bg-slate-50 text-[10px] text-slate-600">
                  سيتلقى رسالة اختبار
                </Badge>
              </div>
            </div>

            {/* Gateways Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gateways.map((gw: any) => {
                const isKeyVisible = visibleKeys[gw.id] || false;
                const testRes = testResults[gw.id];
                const isTesting = testGatewayMutation.isPending && (testGatewayMutation.variables as any)?.id === gw.id;

                let icon = <MessageSquare className="w-5 h-5 text-emerald-600" />;
                if (gw.channel_types.includes("email")) icon = <Mail className="w-5 h-5 text-blue-600" />;
                else if (gw.provider_key === "unifonic") icon = <Radio className="w-5 h-5 text-amber-600" />;
                else if (gw.provider_key === "twilio") icon = <Cpu className="w-5 h-5 text-red-600" />;

                return (
                  <div
                    key={gw.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                      gw.is_enabled ? "border-slate-200 hover:border-indigo-300" : "border-slate-200/60 bg-slate-50/50 opacity-80"
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 rounded-xl">
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm">{gw.provider_name}</h3>
                              {gw.is_default === 1 && (
                                <Badge className="bg-indigo-600 text-white text-[10px] py-0 px-1.5 font-bold">
                                  البوابة الرئيسية
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">{gw.provider_key}</span>
                          </div>
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateGatewayMutation.mutate({
                              id: gw.id,
                              data: { is_enabled: gw.is_enabled ? 0 : 1 }
                            })}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                              gw.is_enabled
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${gw.is_enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {gw.is_enabled ? "مفعل (Active)" : "معطل (Disabled)"}
                          </button>
                        </div>
                      </div>

                      {/* Credentials Summary */}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-500 font-medium">مفتاح الـ API / Token:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-800 font-bold">
                              {gw.api_key ? (isKeyVisible ? gw.api_key : gw.api_key_masked) : <span className="text-red-400 text-[11px]">غير مضبوط</span>}
                            </span>
                            {gw.api_key && (
                              <button
                                type="button"
                                onClick={() => setVisibleKeys(p => ({ ...p, [gw.id]: !p[gw.id] }))}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">مُعرف الحساب / Account SID:</span>
                            <span className="font-mono font-bold text-slate-700 truncate block">
                              {gw.account_id || "تلقائي"}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">مُعرف الإرسال / Sender:</span>
                            <span className="font-mono font-bold text-slate-700 truncate block">
                              {gw.sender_id || "افتراضي"}
                            </span>
                          </div>
                        </div>

                        {gw.base_url && (
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                            <span>الرابط الأساسي (Base URL):</span>
                            <span className="font-mono font-bold text-slate-700 truncate max-w-[200px]" dir="ltr">{gw.base_url}</span>
                          </div>
                        )}
                      </div>

                      {/* Test Status Badge */}
                      {gw.last_test_status && (
                        <div className={`mt-3 p-2 rounded-lg text-xs flex items-center justify-between ${
                          gw.last_test_status === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {gw.last_test_status === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                            <span className="text-[11px] font-medium">{gw.last_test_message || "تم الفحص"}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{gw.last_test_at?.slice(11, 16)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingGateway(gw);
                          setGatewayModalOpen(true);
                        }}
                        className="text-xs h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5 ml-1" />
                        تعديل المفاتيح والتهيئة
                      </Button>

                      <Button
                        size="sm"
                        disabled={isTesting}
                        onClick={() => testGatewayMutation.mutate({ id: gw.id, phone: testPhone })}
                        className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                      >
                        {isTesting ? <RefreshCw className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Wifi className="w-3.5 h-3.5 ml-1 text-emerald-400" />}
                        فحص واختبار الاتصال
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Webhook & Callback Integration Note */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300 text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Radio className="w-4 h-4" />
                <span>إعداد روابط الاستقبال والـ Webhooks للحصول على إشعارات التسليم وقراءة الرسائل (Delivery & Read Receipts)</span>
              </div>
              <p className="leading-relaxed">
                لاستقبال تقارير التسليم المباشرة وتأكيد قراءة العميل للرسالة عبر WhatsApp Meta أو Infobip، قم بنسخ الرابط التالي ولصقه في لوحة تحكم المزود:
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 font-mono text-emerald-400 text-xs" dir="ltr">
                <span>https://your-domain.com/api/travel/notifications/webhook/meta</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("https://your-domain.com/api/travel/notifications/webhook/meta", "webhook")}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {copiedText === "webhook" ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText === "webhook" ? "تم النسخ" : "نسخ"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gateway Edit Modal */}
        {gatewayModalOpen && editingGateway && (
          <Dialog open={gatewayModalOpen} onOpenChange={v => { if (!v) setGatewayModalOpen(false); }}>
            <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-black">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  تهيئة مفاتيح API لبوابة: {editingGateway.provider_name}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  updateGatewayMutation.mutate({
                    id: editingGateway.id,
                    data: {
                      provider_name: fd.get("provider_name"),
                      channel_types: fd.get("channel_types"),
                      api_key: fd.get("api_key"),
                      api_secret: fd.get("api_secret"),
                      base_url: fd.get("base_url"),
                      account_id: fd.get("account_id"),
                      sender_id: fd.get("sender_id"),
                      webhook_verify_token: fd.get("webhook_verify_token"),
                      is_enabled: fd.get("is_enabled") === "1" ? 1 : 0,
                      is_default: fd.get("is_default") === "1" ? 1 : 0
                    }
                  });
                }}
                className="space-y-4 py-2 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اسم البوابة المعروض:</label>
                    <Input
                      name="provider_name"
                      defaultValue={editingGateway.provider_name}
                      required
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">القنوات المدعومة:</label>
                    <select
                      name="channel_types"
                      defaultValue={editingGateway.channel_types}
                      className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs"
                    >
                      <option value="whatsapp">واتساب فقط (WhatsApp)</option>
                      <option value="sms">رسائل قصيرة فقط (SMS)</option>
                      <option value="whatsapp,sms">واتساب ورسائل قصيرة (WhatsApp + SMS)</option>
                      <option value="email">بريد إلكتروني (Email / SMTP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    مفتاح الـ API / رمز الوصول الدائم (API Key / Access Token) *
                  </label>
                  <Input
                    name="api_key"
                    defaultValue={editingGateway.api_key || ""}
                    placeholder="e.g. EAAG... or ib_live_apikey_..."
                    dir="ltr"
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    احصل عليه من حسابك لدى مزود الخدمة (مثل Meta Developer Console أو Infobip Portal)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المفتاح السري (API Secret / Password):</label>
                    <Input
                      name="api_secret"
                      type="password"
                      defaultValue={editingGateway.api_secret || ""}
                      placeholder="Secret or App Password"
                      dir="ltr"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">الرابط الأساسي للـ API (Base URL):</label>
                    <Input
                      name="base_url"
                      defaultValue={editingGateway.base_url || ""}
                      placeholder="e.g. https://api.infobip.com"
                      dir="ltr"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">مُعرف الحساب (Account SID / WABA ID):</label>
                    <Input
                      name="account_id"
                      defaultValue={editingGateway.account_id || ""}
                      placeholder="e.g. WhatsApp Business Account ID"
                      dir="ltr"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">مُعرف المرسل (Phone Number ID / Sender Name):</label>
                    <Input
                      name="sender_id"
                      defaultValue={editingGateway.sender_id || ""}
                      placeholder="e.g. Phone Number ID or OMNIFLY"
                      dir="ltr"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">رمز التحقق للـ Webhook (Verify Token):</label>
                  <Input
                    name="webhook_verify_token"
                    defaultValue={editingGateway.webhook_verify_token || ""}
                    placeholder="e.g. omnifly_meta_webhook_2026"
                    dir="ltr"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 border p-2.5 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      name="is_enabled"
                      value="1"
                      defaultChecked={editingGateway.is_enabled === 1}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">تفعيل هذه البوابة للعمل</span>
                  </label>

                  <label className="flex items-center gap-2 border p-2.5 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      name="is_default"
                      value="1"
                      defaultChecked={editingGateway.is_default === 1}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">تعيين كبوابة افتراضية للقناة</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setGatewayModalOpen(false)} className="h-9 text-xs">
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={updateGatewayMutation.isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                    {updateGatewayMutation.isPending ? "جاري الحفظ..." : "حفظ بيانات الاعتماد والتهيئة"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Visa Modal */}
        <Dialog open={visaModalOpen} onOpenChange={v => { if (!v) setVisaModalOpen(false); }}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-black">
                <Stamp className="w-5 h-5 text-indigo-600" />
                {editingVisa ? "تعديل بيانات نوع التأشيرة" : "إضافة نوع تأشيرة جديد"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveVisa} className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الدولة *</label>
                  <Input
                    required
                    placeholder="مثال: الإمارات العربية المتحدة"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم التأشيرة *</label>
                  <Input
                    required
                    placeholder="مثال: تأشيرة سياحية 30 يوم"
                    value={visaName}
                    onChange={e => setVisaName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">سعر البيع (ريال) *</label>
                  <Input
                    type="number"
                    required
                    value={standardFee}
                    onChange={e => setStandardFee(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">رسوم السفارة (ريال)</label>
                  <Input
                    type="number"
                    value={embassyFee}
                    onChange={e => setEmbassyFee(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">مدة الإنجاز (أيام)</label>
                  <Input
                    type="number"
                    value={processingDays}
                    onChange={e => setProcessingDays(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">فترة الصلاحية (يوم)</label>
                  <Input
                    type="number"
                    value={validityDays}
                    onChange={e => setValidityDays(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">مدة الإقامة (يوم)</label>
                  <Input
                    type="number"
                    value={stayDays}
                    onChange={e => setStayDays(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">نوع الدخول</label>
                  <select
                    value={entryType}
                    onChange={e => setEntryType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 h-9 text-xs"
                  >
                    <option value="سفرة واحدة">سفرة واحدة (Single)</option>
                    <option value="متعددة السفرات">متعددة السفرات (Multiple)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">قائمة المستندات المطلوبة (كل مستند في سطر منفصل)</label>
                <textarea
                  rows={4}
                  value={docList}
                  onChange={e => setDocList(e.target.value)}
                  placeholder="جواز السفر ساري المفعول&#10;صورتين شخصيتين&#10;كشف حساب بنكي"
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setVisaModalOpen(false)} className="h-9 text-xs">
                  إلغاء
                </Button>
                <Button type="submit" disabled={saveVisaMutation.isPending} className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {saveVisaMutation.isPending ? "جاري الحفظ..." : "حفظ نوع التأشيرة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
