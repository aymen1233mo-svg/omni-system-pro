import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import {
  useGetSettings, useUpdateSettings, getGetSettingsQueryKey,
  useGetReceiptCopyConfigs, useUpdateReceiptCopyConfig, useCreateReceiptCopyConfig, useDeleteReceiptCopyConfig, getGetReceiptCopyConfigsQueryKey,
  useGetDepartmentPrintConfigs, useUpdateDepartmentPrintConfig, useCreateDepartmentPrintConfig, useDeleteDepartmentPrintConfig, getGetDepartmentPrintConfigsQueryKey,
  useGetCategories, useGetPrintersList,
  useGetPrinterSettings, useUpdatePrinterSettings, getGetPrinterSettingsQueryKey,
} from "@workspace/api-client-react";
import type { SettingsInput, ReceiptCopyConfig, DepartmentPrintConfig, PrinterSettingsInput } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Plus, Trash2, Pencil, Printer, Copy, Building2, Settings2, Upload, X, ShieldCheck,
  Sparkles, Image as ImageIcon, Clock, Moon, Sun, CheckCircle2, AlertCircle, Plane,
  DollarSign, ShoppingCart, Users, Briefcase, FileSpreadsheet, ShieldAlert, Check, RefreshCw,
  HelpCircle, ArrowRight, CalendarCheck, KeyRound, Fingerprint
} from "lucide-react";
import { fetchWithAuth } from "@workspace/api-client-react";

// ─────────────────────────────────────────────
// Main Settings Component
// ─────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const isDeveloper = user?.role === "developer" || user?.username === "developer";
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const qc = useQueryClient();
  const { toast } = useToast();

  const devLogoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<any>({
    businessName: "",
    address: null,
    phone: null,
    taxNumber: null,
    taxRate: 15,
    currency: "ريال",
    receiptMessage: null,
    printLogo: true,
    printQr: false,
    showCashier: true,
    showCustomer: true,
    allowCashierDiscount: false,
    receiptPaperSize: "80mm",
    showOrderNumber: true,
    showTableNumber: true,
    showDateTime: true,
    showBarcode: false,
    showOrderType: true,
    showTax: true,
    showDiscount: true,
    showNotes: true,
    autoPrintTrigger: "print_button",
    maxReprintCount: 3,
    masterCopiesCount: 1,
    logoUrl: null,
    printMode: "browser",
    businessDayCutoffEnabled: true,
    businessDayCutoffTime: "03:00",
    businessDayRolloverHour: 3,
    applyCutoffToAccounting: true,
    applyCutoffToTravel: true,
    applyCutoffToTravelServices: true,
    applyCutoffToSales: true,
    applyCutoffToPurchases: true,
    applyCutoffToHR: true,
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [setupLicenseCode, setSetupLicenseCode] = useState("");
  const [activatingSetupLicense, setActivatingSetupLicense] = useState(false);
  const [setupActivatedModalData, setSetupActivatedModalData] = useState<any>(null);

  const { data: activeLicenseInfo, refetch: refetchActiveLicense } = useQuery({
    queryKey: ["active-license-setup"],
    queryFn: () => fetch("/api/licenses/active").then(r => r.json()).catch(() => null),
  });

  const handleActivateInSetup = async () => {
    if (!setupLicenseCode.trim()) return;
    try {
      setActivatingSetupLicense(true);
      const res = await fetch("/api/licenses/activate-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: setupLicenseCode.trim(),
          device_id: activeLicenseInfo?.current_device_id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تفعيل الكود");
      setSetupLicenseCode("");
      setSetupActivatedModalData(data);
      refetchActiveLicense();
      qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({
        title: "ألف مبروك تم الترخيص! 🎉✅",
        description: "قم بتسجيل الدخول للنظام باسم المستخدم admin وكلمة السر admin123"
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ في التفعيل", description: e.message });
    } finally {
      setActivatingSetupLicense(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setForm((prev: any) => {
        const next = { ...prev, ...settings };
        try { localStorage.setItem("pos_system_settings_v1", JSON.stringify(next)); } catch {}
        return next;
      });
    } else {
      try {
        const cached = localStorage.getItem("pos_system_settings_v1");
        if (cached) setForm((prev: any) => ({ ...prev, ...JSON.parse(cached) }));
      } catch {}
    }
  }, [settings]);

  const handleSave = () => {
    const payload = { ...form };
    if (!isDeveloper) {
      delete payload.systemLogoUrl;
    }
    try { localStorage.setItem("pos_system_settings_v1", JSON.stringify(payload)); } catch {}
    window.dispatchEvent(new CustomEvent("pos:save-printer-settings"));
    updateMutation.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        qc.invalidateQueries({ queryKey: ["business-day-status"] });
        qc.invalidateQueries({ queryKey: ["next-pos-invoice-number"] });
        window.dispatchEvent(new Event("pos-permissions-updated"));
        toast({ title: "تم حفظ جميع الإعدادات بنجاح وتثبيتها بشكل دائم" });
      },
      onError: (err: any) => toast({ variant: "destructive", title: "فشل في الحفظ", description: err?.message || "يرجى المحاولة مرة أخرى" })
    });
  };

  const setField = (field: any, value: any) =>
    setForm((f: any) => ({ ...f, [field]: value }));

  if (isLoading) return (
    <AdminLayout>
      <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-4xl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">إعدادات النظام</h1>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            حفظ الإعدادات
          </Button>
        </div>

        <Tabs defaultValue="business">
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="business" className="gap-1 py-2 text-xs sm:text-sm">
              <Settings2 className="w-4 h-4" />
              النشاط التجاري
            </TabsTrigger>
            <TabsTrigger value="business-day" className="gap-1 py-2 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
              <Clock className="w-4 h-4" />
              يوم العمل والتقليب
            </TabsTrigger>
            <TabsTrigger value="receipt-format" className="gap-1 py-2 text-xs sm:text-sm">
              <Printer className="w-4 h-4" />
              شكل الفاتورة
            </TabsTrigger>
            <TabsTrigger value="master-copies" className="gap-1 py-2 text-xs sm:text-sm">
              <Copy className="w-4 h-4" />
              نسخ الفاتورة
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1 py-2 text-xs sm:text-sm">
              <Building2 className="w-4 h-4" />
              الأقسام
            </TabsTrigger>
            <TabsTrigger value="printer-layout" className="gap-1 py-2 text-xs sm:text-sm">
              <Printer className="w-4 h-4" />
              ضبط الطابعة
            </TabsTrigger>
          </TabsList>

          {/* ─── Business Tab ─── */}
          <TabsContent value="business" className="space-y-4 mt-4">
            {/* ─── Active License Card in System Setup (تهيئة النظام) ─── */}
            <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 dark:from-emerald-950/20 dark:to-slate-900 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                    <KeyRound className="w-5 h-5 text-emerald-600" />
                    <span>بيانات الترخيص الرقمي المعتمد في تهيئة النظام</span>
                  </div>
                  <Badge className={activeLicenseInfo?.active ? "bg-emerald-600 text-white font-bold" : "bg-red-600 text-white font-bold"}>
                    {activeLicenseInfo?.active ? "النظام مرخص ومفعل ✅" : "غير مرخص"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs font-medium">
                  يتم تحديث هذه البيانات تلقائياً عند لصق وتفعيل كود الترخيص الرقمي المشفر الخاص ببصمة هذا الجهاز.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200/80 dark:border-slate-800">
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">اسم المنشأة / العميل المرخص له:</span>
                    <span className="font-black text-slate-900 dark:text-white text-sm">{activeLicenseInfo?.client_name || form.businessName || "مؤسسة أومني سيستم للتجارة والمبيعات"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">تاريخ انتهاء الترخيص:</span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">{activeLicenseInfo?.expires_at || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">عدد الأجهزة المسموح بها:</span>
                    <span className="font-black text-blue-700 dark:text-blue-400 text-sm">{activeLicenseInfo?.devices_limit || 1} جهاز</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">بصمة هذا الجهاز (HWID):</span>
                    <span className="font-mono font-black text-amber-700 dark:text-amber-400 dir-ltr inline-block">{activeLicenseInfo?.current_device_id || "—"}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <Input
                    value={setupLicenseCode}
                    onChange={e => setSetupLicenseCode(e.target.value)}
                    placeholder="ألصق كود ترخيص رقمي مشفر جديد هنا لتحديث أو تمديد الترخيص في تهيئة النظام..."
                    className="font-mono text-xs bg-white dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    onClick={handleActivateInSetup}
                    disabled={!setupLicenseCode.trim() || activatingSetupLicense}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{activatingSetupLicense ? "جاري فك التشفير..." : "فك التشفير وتحديث الترخيص"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {setupActivatedModalData && (
              <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
                <div className="bg-white rounded-3xl border-4 border-emerald-500 shadow-2xl max-w-lg w-full overflow-hidden transform animate-in fade-in-50 zoom-in-95 duration-200 text-right">
                  <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white p-6 flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl shadow-inner animate-bounce">
                      <ShieldCheck className="w-10 h-10 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">ألف مبروك تم الترخيص! 🎉✅</h3>
                      <p className="text-xs text-white/95 font-bold mt-1">
                        قم بتسجيل الدخول للنظام باسم المستخدم <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-yellow-200">admin</span> وكلمة السر <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-yellow-200">admin123</span>
                      </p>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2 text-xs font-bold text-slate-700">
                      <div className="flex justify-between">
                        <span>المنشأة المرخص لها:</span>
                        <span className="font-black text-slate-900">{setupActivatedModalData.clientName}</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                        <span>تاريخ انتهاء الترخيص:</span>
                        <span className="font-mono font-black text-emerald-800">{setupActivatedModalData.expiresAt}</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                        <span>عدد الأجهزة المسموح بها:</span>
                        <span className="font-black text-emerald-800">{setupActivatedModalData.devicesLimit} أجهزة</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                        <span>بصمة الجهاز المعتمد:</span>
                        <span className="font-mono font-black text-slate-900 dir-ltr">{setupActivatedModalData.deviceId}</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                      <div className="text-xs font-black text-yellow-400">بيانات الدخول الافتراضية المعتمدة:</div>
                      <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-[11px] text-slate-400 block">اسم المستخدم</span>
                          <span className="font-mono text-sm font-black text-yellow-300">admin</span>
                        </div>
                        <div className="border-r border-slate-800">
                          <span className="text-[11px] text-slate-400 block">كلمة السر</span>
                          <span className="font-mono text-sm font-black text-yellow-300">admin123</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-6 py-4 flex justify-end border-t">
                    <Button
                      type="button"
                      onClick={() => setSetupActivatedModalData(null)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6"
                    >
                      حسناً، متابعة العمل ✅
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>معلومات النشاط التجاري</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  ["businessName", "اسم النشاط / النظام *"],
                  ["address", "العنوان"],
                  ["phone", "رقم الهاتف"],
                  ["taxNumber", "الرقم الضريبي"],
                  ["currency", "العملة"],
                ] as [keyof SettingsInput, string][]).map(([field, label]) => {
                  return (
                    <div key={field} className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <span>{label}</span>
                      </label>
                      <Input
                        value={(form[field] as string) ?? ""}
                        onChange={e => setField(field, e.target.value || null)}
                      />
                    </div>
                  );
                })}
                <div className="space-y-1">
                  <label className="text-sm font-medium">نسبة الضريبة (%)</label>
                  <Input
                    type="number"
                    value={form.taxRate ?? 15}
                    onChange={e => setField("taxRate", Number(e.target.value))}
                    className="w-32"
                    min={0}
                    max={100}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ─── Travel Sales Discount Permissions Card ─── */}
            <Card className="border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <span>صلاحيات الخصم المباشر لموظفي المبيعات والحجوزات</span>
                  </div>
                  <Badge variant={form.allowCashierDiscount ? "default" : "secondary"} className={form.allowCashierDiscount ? "bg-green-600 text-white font-bold" : "bg-slate-200 text-slate-700 font-bold"}>
                    {form.allowCashierDiscount ? "الخصم مسموح لموظفي الحجوزات" : "الخصم ممنوع عن موظفي الحجوزات"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                  التحكم في إمكانية قيام موظفي الحجوزات والمبيعات بإدخال خصم مباشر على فواتير وحجوزات السفر.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-border">
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">السماح لموظف المبيعات بعمل خصم على الحجز</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      عند <strong>التفعيل</strong>: يمكن لموظف المبيعات والحجوزات إدخال وتطبيق الخصم بحرية. عند <strong>التعطيل</strong>: يتم قفل حقل الخصم ولا يمكن منحه إلا بإذن المشرف/المدير.
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(form.allowCashierDiscount)}
                    onCheckedChange={(checked) => setField("allowCashierDiscount", checked)}
                  />
                </div>
              </CardContent>
            </Card>



            <Card className="border-blue-500/20 bg-blue-50/20 dark:bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    <span>شعار النشاط التجاري (الفواتير والوثائق المعتمدة)</span>
                  </div>
                  <Badge className="bg-blue-600 text-white font-bold gap-1 shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    متاح للرفع والتعديل
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  يمكنك رفع وتغيير صورة شعار المنشأة والنشاط التجاري لاستخدامها مباشرة على الفواتير، السندات، والمطبوعات الرسمية.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-500/20 shadow-xs">
                  <div className="border rounded-lg p-2 bg-white flex items-center justify-center w-36 h-24 shrink-0 shadow-inner overflow-hidden">
                    <img src={form.logoUrl || "/assets/images/omnisystem_pro_logo_1784250216808.png"} alt="شعار النشاط التجاري" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">رفع وتحديث الشعار من الملفات</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      اختر ملف صورة للشعار (PNG, JPG, WEBP, SVG). سيتم حفظه واستخدامه في جميع الترويسات والمطبوعات المعتمدة.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setField("logoUrl", reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" asChild className="gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-300 cursor-pointer">
                          <span>
                            <Upload className="w-3.5 h-3.5 ml-1" />
                            اختر صورة الشعار من الملفات
                          </span>
                        </Button>
                      </label>
                      {form.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                          onClick={() => setField("logoUrl", null)}
                        >
                          إزالة الشعار
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isDeveloper && (
              <Card className="border-blue-500/50 bg-blue-50/10 dark:bg-blue-950/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-blue-600 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    أدوات المطور - منطقة إدارة
                  </CardTitle>
                  <CardDescription className="text-blue-500/80 font-bold">
                    تحذير: هذه العمليات لا يمكن التراجع عنها. يرجى التأكد قبل التنفيذ.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-3">
                    <div className="flex flex-col gap-1">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">تصفير ومحو بيانات النظام بالكامل</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        سيقوم النظام بحذف كافة (الطلبات، المنتجات، العملاء، الموردين، بيانات الموظفين، العمليات المالية، والتقارير). 
                        سيبقى فقط حساب (admin) و (developer) وإعدادات النظام الأساسية لتبدأ من الصفر تماماً.
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      className="w-full sm:w-auto gap-2 font-bold shadow-md bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        if (confirm("هل أنت متأكد تماماً من رغبتك في تصفير قاعدة البيانات ومحو كل البيانات؟\nسيتم حذف كافة الطلبات والمنتجات والتقارير ولا يمكن التراجع!")) {
                          const token = sessionStorage.getItem("pos_token");
                          fetch("/api/admin/reset-database", {
                            method: "POST",
                            headers: {
                              "Authorization": `Bearer ${token}`
                            }
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.error) throw new Error(data.error);
                            toast({ title: "تم التصفير بنجاح", description: data.message });
                            window.location.reload();
                          })
                          .catch(err => {
                            toast({ variant: "destructive", title: "فشل التصفير", description: err.message });
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      تصفير قاعدة البيانات والبدء من الصفر
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>معلومات الدخول الافتراضية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 font-mono">
                  <p>مدير عام الشركة: <span className="font-bold text-foreground">admin</span> / كلمة المرور: <span className="font-bold text-foreground">admin123</span></p>
                  <p>موظف مبيعات وحجوزات: <span className="font-bold text-foreground">sales</span> / كلمة المرور: <span className="font-bold text-foreground">sales123</span></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Receipt & Travel Document Format Tab ─── */}
          <TabsContent value="receipt-format" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>شكل الفاتورة والسندات التجارية والمحاسبية</CardTitle>
                <CardDescription>تحكم في البيانات والعناصر المطبوعة على فواتير المبيعات والمخازن وسندات القبض/الصرف</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">رسالة الشكر أو التنويه في نهاية الفاتورة</label>
                  <Input
                    value={form.receiptMessage ?? ""}
                    onChange={e => setField("receiptMessage", e.target.value || null)}
                    placeholder="شكراً لتعاملكم معنا... يسعدنا خدمتكم دائماً!"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">حجم ورق طباعة الوثيقة</label>
                  <Select
                    value={form.receiptPaperSize as string ?? "80mm"}
                    onValueChange={v => setField("receiptPaperSize", v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm (حراري)</SelectItem>
                      <SelectItem value="80mm">80mm (حراري واسع)</SelectItem>
                      <SelectItem value="A4">A4 (ورق رسمي عادي)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2">
                  {([
                    ["printLogo", "إظهار شعار المؤسسة / الشركة التجارية"],
                    ["printQr", "إظهار QR Code المعتمد (الربط الإلكتروني ZATCA)"],
                    ["showCashier", "إظهار اسم موظف المبيعات / الكاشير"],
                    ["showCustomer", "إظهار اسم العميل / الحساب"],
                    ["showOrderNumber", "إظهار الرقم المرجعي للفاتورة / الطلب"],
                    ["showTableNumber", "إظهار رقم السند / المستودع"],
                    ["showDateTime", "إظهار تاريخ ووقت الإصدار"],
                    ["showBarcode", "إظهار الباركود المرجعي"],
                    ["showOrderType", "إظهار نوع الفاتورة (نقدي / آجل / جملة / تجزئة)"],
                    ["showTax", "إظهار تفاصيل وقيمة ضريبة القيمة المضافة"],
                    ["showDiscount", "إظهار قيمة الخصم الممنوح"],
                    ["showNotes", "إظهار شروط وملاحظات الفاتورة والضمان"],
                  ] as [keyof SettingsInput, string][]).map(([field, label]) => (
                    <div key={field} className="flex items-center justify-between py-2 border-b border-border/50">
                      <label className="text-sm">{label}</label>
                      <Switch
                        checked={Boolean(form[field])}
                        onCheckedChange={v => setField(field, v)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>إعدادات الطباعة التلقائية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">وقت تنفيذ الطباعة التلقائية</label>
                  <Select
                    value={form.autoPrintTrigger as string ?? "print_button"}
                    onValueChange={v => setField("autoPrintTrigger", v)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="print_button">عند الضغط على زر الطباعة</SelectItem>
                      <SelectItem value="save">عند حفظ الطلب</SelectItem>
                      <SelectItem value="after_payment">بعد الدفع مباشرة</SelectItem>
                      <SelectItem value="manual">يدوي فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 pt-2 border-t">
                  <label className="text-sm font-medium">طريقة الطباعة المفضلة للطلب</label>
                  <Select
                    value={form.printMode as string ?? "browser"}
                    onValueChange={v => setField("printMode", v)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="browser">طباعة المتصفح الرسومية (بالشعار والتنسيق الكامل)</SelectItem>
                      <SelectItem value="silent">الطباعة الصامتة المباشرة (بدون نوافذ - نصوص فقط)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                    تنويه: طباعة المتصفح تدعم إظهار الشعار ونفس التنسيق المبرمج بالملف بشكل مثالي، بينما الطباعة الصامتة ترسل نصوصًا خامًا مباشرة وتعتمد على إعدادات الحروف والعرض بالطابعة.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">الحد الأقصى لإعادة الطباعة</label>
                  <Input
                    type="number"
                    value={form.maxReprintCount ?? 3}
                    onChange={e => setField("maxReprintCount", Number(e.target.value))}
                    className="w-32"
                    min={0}
                    max={20}
                  />
                  <p className="text-xs text-muted-foreground">0 = بدون حد</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Master Copies Tab ─── */}
          <TabsContent value="master-copies" className="mt-4">
            <MasterCopiesTab
              masterCopiesCount={form.masterCopiesCount as number ?? 1}
              onCopiesCountChange={v => setField("masterCopiesCount", v)}
              onSave={handleSave}
              isSaving={updateMutation.isPending}
            />
          </TabsContent>

          {/* ─── Departments Tab ─── */}
          <TabsContent value="departments" className="mt-4">
            <DepartmentsTab />
          </TabsContent>

          {/* ─── Printer Layout Tab ─── */}
          <TabsContent value="printer-layout" className="mt-4">
            <PrinterLayoutTab />
          </TabsContent>

          {/* ─── Business Day Rollover Tab ─── */}
          <TabsContent value="business-day" className="mt-4">
            <BusinessDaySettingsTab
              form={form}
              setField={setField}
              handleSave={handleSave}
              isSaving={updateMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// ─────────────────────────────────────────────
// Master Copies Tab
// ─────────────────────────────────────────────
function MasterCopiesTab({
  masterCopiesCount,
  onCopiesCountChange,
  onSave,
  isSaving,
}: {
  masterCopiesCount: number;
  onCopiesCountChange: (v: number) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const { data: copies = [], isLoading } = useGetReceiptCopyConfigs();
  const updateCopy = useUpdateReceiptCopyConfig();
  const createCopy = useCreateReceiptCopyConfig();
  const deleteCopy = useDeleteReceiptCopyConfig();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editItem, setEditItem] = useState<ReceiptCopyConfig | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEnabled, setNewEnabled] = useState(true);

  const handleToggle = (item: ReceiptCopyConfig) => {
    updateCopy.mutate({ id: item.id, data: { copyNumber: item.copyNumber, label: item.label, enabled: !item.enabled } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetReceiptCopyConfigsQueryKey() }),
    });
  };

  const handleEditSave = () => {
    if (!editItem) return;
    updateCopy.mutate({ id: editItem.id, data: { copyNumber: editItem.copyNumber, label: editLabel, enabled: editItem.enabled } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetReceiptCopyConfigsQueryKey() });
        setEditItem(null);
        toast({ title: "تم التعديل" });
      },
    });
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const nextNum = copies.length > 0 ? Math.max(...copies.map(c => c.copyNumber)) + 1 : 1;
    createCopy.mutate({ data: { copyNumber: nextNum, label: newLabel.trim(), enabled: newEnabled } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetReceiptCopyConfigsQueryKey() });
        setShowAdd(false);
        setNewLabel("");
        setNewEnabled(true);
        toast({ title: "تمت الإضافة" });
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteCopy.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetReceiptCopyConfigsQueryKey() });
        toast({ title: "تم الحذف" });
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>عدد نسخ الفاتورة الرئيسية</CardTitle>
          <CardDescription>تحديد عدد النسخ الإجمالي للفاتورة الرئيسية التي تُطبع عند كل طلب</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">عدد النسخ</label>
              <Input
                type="number"
                value={masterCopiesCount}
                onChange={e => onCopiesCountChange(Number(e.target.value))}
                className="w-24 text-center text-lg font-bold"
                min={1}
                max={10}
              />
            </div>
            <Button onClick={onSave} disabled={isSaving} variant="outline" className="mt-6 gap-2">
              <Save className="w-4 h-4" />
              حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>تخصيص كل نسخة</CardTitle>
            <CardDescription>تحديد الغرض من كل نسخة (عميل، كاشير، محاسبة، أرشيف...)</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة نسخة
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="space-y-2">
              {copies.map(copy => (
                <div key={copy.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {copy.copyNumber}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{copy.label}</p>
                    <p className="text-xs text-muted-foreground">نسخة رقم {copy.copyNumber}</p>
                  </div>
                  <Badge variant={copy.enabled ? "default" : "secondary"}>
                    {copy.enabled ? "مفعّل" : "معطّل"}
                  </Badge>
                  <Switch checked={copy.enabled} onCheckedChange={() => handleToggle(copy)} />
                  <Button variant="ghost" size="sm" onClick={() => { setEditItem(copy); setEditLabel(copy.label); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(copy.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {copies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد نسخ مضافة</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تعديل النسخة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم النسخة / الغرض</label>
              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={updateCopy.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>إضافة نسخة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم النسخة / الغرض</label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="مثال: نسخة المحاسبة" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">مفعّل</label>
              <Switch checked={newEnabled} onCheckedChange={setNewEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={createCopy.isPending || !newLabel.trim()}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Departments Tab
// ─────────────────────────────────────────────
function DepartmentsTab() {
  const { data: depts = [], isLoading } = useGetDepartmentPrintConfigs();
  const { data: categories = [] } = useGetCategories();
  const { data: systemPrinters = [] } = useGetPrintersList();
  const updateDept = useUpdateDepartmentPrintConfig();
  const createDept = useCreateDepartmentPrintConfig();
  const deleteDept = useDeleteDepartmentPrintConfig();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editItem, setEditItem] = useState<DepartmentPrintConfig | null>(null);
  const [editForm, setEditForm] = useState({ categoryId: "", printerName: "", copies: 1, enabled: true, printOrder: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ categoryId: "", printerName: "", copies: 1, enabled: true, printOrder: 0 });

  const openEdit = (item: DepartmentPrintConfig) => {
    setEditItem(item);
    setEditForm({
      categoryId: item.categoryId ? String(item.categoryId) : "",
      printerName: item.printerName ?? "",
      copies: item.copies,
      enabled: item.enabled,
      printOrder: item.printOrder,
    });
  };

  const handleEditSave = () => {
    if (!editItem) return;
    updateDept.mutate({
      id: editItem.id,
      data: {
        categoryId: editForm.categoryId ? Number(editForm.categoryId) : null,
        printerName: editForm.printerName || null,
        copies: editForm.copies,
        enabled: editForm.enabled,
        printOrder: editForm.printOrder,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDepartmentPrintConfigsQueryKey() });
        setEditItem(null);
        toast({ title: "تم التعديل" });
      },
    });
  };

  const handleAdd = () => {
    createDept.mutate({
      data: {
        categoryId: addForm.categoryId ? Number(addForm.categoryId) : null,
        printerName: addForm.printerName || null,
        copies: addForm.copies,
        enabled: addForm.enabled,
        printOrder: addForm.printOrder,
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDepartmentPrintConfigsQueryKey() });
        setShowAdd(false);
        setAddForm({ categoryId: "", printerName: "", copies: 1, enabled: true, printOrder: 0 });
        toast({ title: "تمت الإضافة" });
      },
    });
  };

  const handleToggle = (item: DepartmentPrintConfig) => {
    updateDept.mutate({
      id: item.id,
      data: {
        categoryId: item.categoryId ?? null,
        printerName: item.printerName ?? null,
        copies: item.copies,
        enabled: !item.enabled,
        printOrder: item.printOrder,
      }
    }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetDepartmentPrintConfigsQueryKey() }),
    });
  };

  const handleDelete = (id: number) => {
    deleteDept.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDepartmentPrintConfigsQueryKey() });
        toast({ title: "تم الحذف" });
      },
    });
  };

  const DeptForm = ({ form, onChange }: { form: typeof addForm, onChange: (f: typeof addForm) => void }) => (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">القسم (التصنيف)</label>
        <Select value={form.categoryId} onValueChange={v => onChange({ ...form, categoryId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="اختر قسماً" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">الطابعة</label>
        {systemPrinters.length > 0 ? (
          <Select value={form.printerName || "__none__"} onValueChange={v => onChange({ ...form, printerName: v === "__none__" ? "" : v })}>
            <SelectTrigger dir="ltr">
              <SelectValue placeholder="اختر طابعة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">بدون طابعة</SelectItem>
              {systemPrinters.map((p: string) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-1">
            <Input value={form.printerName} onChange={e => onChange({ ...form, printerName: e.target.value })} placeholder="اسم الطابعة أو عنوان IP (مثال: 192.168.1.100)" dir="ltr" />
            <p className="text-xs text-muted-foreground">لم يتم اكتشاف طابعات. أدخل اسم الطابعة يدوياً أو عنوان IP الشبكي</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">عدد النسخ</label>
          <Input type="number" value={form.copies} onChange={e => onChange({ ...form, copies: Number(e.target.value) })} min={1} max={10} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">ترتيب الطباعة</label>
          <Input type="number" value={form.printOrder} onChange={e => onChange({ ...form, printOrder: Number(e.target.value) })} min={0} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">تفعيل الطباعة</label>
        <Switch checked={form.enabled} onCheckedChange={v => onChange({ ...form, enabled: v })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>فواتير الأقسام</CardTitle>
            <CardDescription>
              بعد طباعة الفاتورة الرئيسية، يُرسل النظام تلقائياً فاتورة مستقلة لكل قسم تحتوي فقط على الأصناف الخاصة به
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            إضافة قسم
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="space-y-2">
              {depts.map(dept => (
                <div key={dept.id} className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-opacity ${!dept.enabled ? "opacity-50" : ""}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {dept.printOrder}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{dept.categoryName ?? "قسم غير محدد"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {dept.printerName ? `🖨️ ${dept.printerName}` : "بدون طابعة محددة"}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{dept.copies} نسخة</span>
                    </div>
                  </div>
                  <Badge variant={dept.enabled ? "default" : "secondary"}>
                    {dept.enabled ? "مفعّل" : "معطّل"}
                  </Badge>
                  <Switch checked={dept.enabled} onCheckedChange={() => handleToggle(dept)} />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(dept)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(dept.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {depts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  لا توجد أقسام مضافة. أضف قسماً لتفعيل طباعة فواتير الأقسام.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={o => !o && setEditItem(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>تعديل إعدادات القسم</DialogTitle></DialogHeader>
          <DeptForm form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={updateDept.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>إضافة قسم جديد</DialogTitle></DialogHeader>
          <DeptForm form={addForm} onChange={setAddForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={createDept.isPending}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Printer Layout Settings Tab
// ─────────────────────────────────────────────
function PrinterLayoutTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: saved } = useGetPrinterSettings();
  const updateMutation = useUpdatePrinterSettings();

  const defaults: PrinterSettingsInput & { mainPrinterName?: string | null } = {
    paperWidth: 80, leftMargin: 1, rightMargin: 1,
    topMargin: 1, bottomMargin: 1, fontSize: 11,
    lineSpacing: 2, charactersPerLine: 48, mainPrinterName: null,
  };

  const [form, setForm] = useState<PrinterSettingsInput & { mainPrinterName?: string | null }>(() => {
    try {
      const cached = localStorage.getItem("pos_printer_settings_v1");
      if (cached) {
        return { ...defaults, ...JSON.parse(cached) };
      }
    } catch {}
    return defaults;
  });

  useEffect(() => {
    if (saved) {
      const merged = {
        ...defaults,
        ...(saved as any),
      };
      setForm(merged);
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(merged)); } catch {}
    }
  }, [saved]);

  const set = (k: any, v: number | string | null) =>
    setForm(f => {
      const next = { ...f, [k]: v };
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(next)); } catch {}
      return next;
    });

  const applyPreset = (type: "80mm_72_1" | "80mm_standard" | "58mm_compact") => {
    if (type === "80mm_72_1") {
      const next = {
        ...form,
        paperWidth: 80,
        leftMargin: 1,
        rightMargin: 1,
        topMargin: 1,
        bottomMargin: 1,
        fontSize: 11,
        lineSpacing: 2,
        charactersPerLine: 48,
      };
      setForm(next);
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(next)); } catch {}
      toast({ title: "تم تطبيق ضبط ورق 80(72.1) × 297 mm (هوامش 1mm منضبطة)" });
    } else if (type === "80mm_standard") {
      const next = {
        ...form,
        paperWidth: 80,
        leftMargin: 8,
        rightMargin: 4,
        topMargin: 1,
        bottomMargin: 1,
        fontSize: 11,
        lineSpacing: 2,
        charactersPerLine: 48,
      };
      setForm(next);
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(next)); } catch {}
      toast({ title: "تم تطبيق معايرة طابعات 80mm بهوامش موسعة (8mm يسار / 4mm يمين)" });
    } else {
      const next = {
        ...form,
        paperWidth: 58,
        leftMargin: 1,
        rightMargin: 1,
        topMargin: 1,
        bottomMargin: 1,
        fontSize: 9.5,
        lineSpacing: 1.5,
        charactersPerLine: 32,
      };
      setForm(next);
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(next)); } catch {}
      toast({ title: "تم تطبيق معايرة طابعات 58mm الصغيرة" });
    }
  };

  const handleSave = () => {
    try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(form)); } catch {}
    updateMutation.mutate({ data: form }, {
      onSuccess: (updatedData) => {
        if (updatedData) {
          try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(updatedData)); } catch {}
        }
        qc.invalidateQueries({ queryKey: getGetPrinterSettingsQueryKey() });
        toast({ title: "تم حفظ وتثبيت إعدادات الطابعة والهوامش بنجاح" });
      },
      onError: () => toast({ variant: "destructive", title: "فشل حفظ الإعدادات" }),
    });
  };

  useEffect(() => {
    const onGlobalSave = () => {
      try { localStorage.setItem("pos_printer_settings_v1", JSON.stringify(form)); } catch {}
      updateMutation.mutate({ data: form }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPrinterSettingsQueryKey() });
        },
      });
    };
    window.addEventListener("pos:save-printer-settings", onGlobalSave);
    return () => window.removeEventListener("pos:save-printer-settings", onGlobalSave);
  }, [form, qc, updateMutation]);

  const handleTestPrint = () => {
    const lm = form.leftMargin ?? 1;
    const rm = form.rightMargin ?? 1;
    const pw = form.paperWidth ?? 80;
    const printableW = pw === 80 ? 72.1 : pw;
    const fs = form.fontSize ?? 11;
    const tm = form.topMargin ?? 1;
    const bm = form.bottomMargin ?? 1;
    const ls = form.lineSpacing ?? 2;

    const testContainerId = "__printer-test-container__";
    document.getElementById(testContainerId)?.remove();

    const style = document.createElement("style");
    style.id = "__test-print-style__";
    style.textContent = `
      @page { size: ${pw}mm 297mm; margin: 0mm; }
      @media print {
        body * { visibility: hidden !important; }
        #${testContainerId}, #${testContainerId} * { visibility: visible !important; }
        #${testContainerId} {
          position: static !important;
          display: block !important;
          width: 100% !important;
          max-width: ${printableW}mm !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          background: white !important;
          z-index: 999999 !important;
        }
      }
      .test-receipt-slip {
        font-family: 'Tajawal', sans-serif !important;
        font-size: ${fs}px !important;
        line-height: ${1 + ls / 10} !important;
        padding: ${tm}mm ${rm}mm ${bm}mm ${lm}mm !important;
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: ${printableW}mm !important;
        color: #000 !important;
        direction: rtl !important;
      }
    `;
    document.head.appendChild(style);

    const testDiv = document.createElement("div");
    testDiv.id = testContainerId;
    testDiv.innerHTML = `
      <div class="test-receipt-slip">
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
          <h3 style="font-size: 14px; font-weight: 900; margin: 0;">اختبار معايرة الطابعة الحرارية</h3>
          <p style="font-size: 10px; margin: 2px 0;">مقاس الورق: ${pw === 80 ? "80(72.1) x 297 mm" : `${pw}mm`} | الهوامش: ${lm}mm</p>
        </div>
        <div style="font-size: 10px; margin: 4px 0; border: 1px solid #000; padding: 4px;">
          <div><strong>الهامش الأيسر (Left):</strong> ${lm}mm ✅ مضبوط وملائم للورق</div>
          <div><strong>الهامش الأيمن (Right):</strong> ${rm}mm | <strong>العلوي:</strong> ${tm}mm | <strong>السفلي:</strong> ${bm}mm</div>
          <div><strong>المساحة القابلة للطباعة الفعلية:</strong> ${pw - lm - rm}mm (عرض رأس الطباعة ${printableW}mm)</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: right; padding: 2px;">الصنف</th>
              <th style="text-align: center; padding: 2px;">الكمية</th>
              <th style="text-align: left; padding: 2px;">السعر</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding: 2px;">صنف اختباري تجريبي 1</td><td style="text-align: center;">2</td><td style="text-align: left;">50.00</td></tr>
            <tr><td style="padding: 2px;">صنف اختباري تجريبي 2</td><td style="text-align: center;">1</td><td style="text-align: left;">120.00</td></tr>
          </tbody>
        </table>
        <div style="border-top: 1px dashed #000; padding-top: 4px; text-align: left; font-weight: bold; font-size: 12px;">
          الإجمالي: 170.00 ريال
        </div>
        <div style="text-align: center; margin-top: 6px; font-size: 9px; border-top: 1px solid #000; padding-top: 2px;">
          تمت الطباعة بنجاح - مقاس 80(72.1) × 297 mm بهوامش ${lm}mm
        </div>
      </div>
    `;
    document.body.appendChild(testDiv);

    window.print();

    setTimeout(() => {
      document.getElementById("__test-print-style__")?.remove();
      document.getElementById(testContainerId)?.remove();
    }, 1000);
  };

  const numField = (label: string, key: keyof PrinterSettingsInput, unit = "mm", min = 0, max = 99, step = 0.5, helper?: string) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b last:border-0 gap-2">
      <div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</span>
        {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={form[key] !== undefined && form[key] !== null ? (form[key] as number) : 1}
          onChange={e => set(key, e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-24 text-center font-bold"
          min={min} max={max} step={step}
        />
        <span className="text-xs text-muted-foreground w-8 font-medium">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Guidance Banner ── */}
      <Card className="border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100 font-bold block text-sm">
              معايرة دقيقة لطابعات الفواتير الحرارية 80(72.1) × 297 mm (حفظ دائم للإعدادات)
            </strong>
            <p>
              تم ضبط النظام ليتوافق بدقة تامة مع حجم ورق الطابعة الحرارية <strong>80(72.1) × 297 mm</strong>.
              عند ضبط الهوامش (الأيسر <strong>1mm</strong>، الأيمن <strong>1mm</strong>، العلوي <strong>1mm</strong>، السفلي <strong>1mm</strong>) تصبح المساحة القابلة للطباعة الفعلية <strong>78mm</strong> (ملائمة تماماً لعرض الطباعة الفعلي 72.1mm بدون أي قص)، ويتم حفظ إعداداتك بشكل دائم في قاعدة البيانات دون أن تتغير عند الخروج أو إيقاف تشغيل الجهاز.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Presets Selector ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">القوالب الجاهزة والمعايرة الموصى بها</CardTitle>
          <CardDescription>اختر الإعداد الموصى به لنوع طابعتك أو عدّل الهوامش يدوياً بالأسفل</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={(form.paperWidth === 80 && form.leftMargin === 1 && form.rightMargin === 1) ? "default" : "outline"}
            className="gap-2 text-xs font-bold"
            onClick={() => applyPreset("80mm_72_1")}
          >
            <Printer className="w-4 h-4" />
            🌟 ورق 80(72.1) × 297 mm القياسي (هوامش 1mm لكل الاتجاهات)
          </Button>
          <Button
            type="button"
            variant={(form.paperWidth === 80 && form.leftMargin === 8) ? "default" : "outline"}
            className="gap-2 text-xs font-bold"
            onClick={() => applyPreset("80mm_standard")}
          >
            <Printer className="w-4 h-4" />
            طابعات 80mm بهوامش موسعة (يسار 8mm / يمين 4mm)
          </Button>
          <Button
            type="button"
            variant={(form.paperWidth === 58) ? "default" : "outline"}
            className="gap-2 text-xs font-bold"
            onClick={() => applyPreset("58mm_compact")}
          >
            <Printer className="w-4 h-4" />
            طابعات 58mm الصغيرة
          </Button>
        </CardContent>
      </Card>

      {/* ── Paper Type ── */}
      <Card>
        <CardHeader>
          <CardTitle>نوع وحجم ورق الطابعة</CardTitle>
          <CardDescription>حجم ورق الطابعة الحرارية المعتمد في النظام</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-6 flex-wrap">
          {[80, 58].map(w => (
            <label key={w} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="paperWidth"
                value={w}
                checked={(form.paperWidth ?? 80) === w}
                onChange={() => set("paperWidth", w)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-bold">
                {w === 80 ? "80(72.1) × 297 mm (القياسي المعتمد للطابعات الحرارية 80mm)" : "58mm (رول حراري صغير)"}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* ── Margins ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>هوامش رأس الطباعة</CardTitle>
            <Badge className="bg-emerald-600 text-white font-bold">
              الهامش الأيسر الحالي: {form.leftMargin ?? 1}mm
            </Badge>
          </div>
          <CardDescription>
            المساحة القابلة للطباعة الفعلية = {form.paperWidth ?? 80}mm − {form.leftMargin ?? 1}mm (يسار) − {form.rightMargin ?? 1}mm (يمين) ={" "}
            <strong className="text-slate-900 font-black">{(form.paperWidth ?? 80) - (form.leftMargin ?? 1) - (form.rightMargin ?? 1)}mm</strong>
            {" "}• متلائم مع مقاس الورق <strong>80(72.1) × 297 mm</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-6">
          {numField("الهامش الأيسر (Left Margin)", "leftMargin", "mm", 0, 25, 0.5, "الضبط الملائم لورق 80(72.1) × 297 mm هو 1mm (أو 8mm للطابعات بدون معايرة درايفر)")}
          {numField("الهامش الأيمن (Right Margin)", "rightMargin", "mm", 0, 20, 0.5, "الضبط الملائم لورق 80(72.1) × 297 mm هو 1mm (أو 4mm)")}
          {numField("الهامش العلوي (Top Margin)", "topMargin", "mm", 0, 20, 0.5, "المسافة قبل بداية طباعة الترويسة والشعار (1mm)")}
          {numField("الهامش السفلي (Bottom Margin)", "bottomMargin", "mm", 0, 25, 0.5, "المسافة بعد نهاية الفاتورة لضمان خروج الورق من القاطع (1mm)")}
        </CardContent>
      </Card>

      {/* ── Typography ── */}
      <Card>
        <CardHeader><CardTitle>الخط والسطر والتباعد</CardTitle></CardHeader>
        <CardContent className="p-0 px-6">
          {numField("حجم الخط (Font Size)", "fontSize", "px", 8, 20, 1, "الحجم المثالي 11px للقراءة الواضحة")}
          {numField("مسافة السطر (Line Spacing)", "lineSpacing", "px", 0.5, 10, 0.5, "المسافة بين أسطر النصوص والأصناف")}
          {numField("عدد الأحرف بالسطر (ESC/POS Mode)", "charactersPerLine", "حرف", 20, 80, 1, "مخصص للطباعة المباشرة الصامتة بدون متصفح")}
        </CardContent>
      </Card>

      {/* ── Main Printer Direct Network / Silent ── */}
      <Card>
        <CardHeader>
          <CardTitle>طابعة الفاتورة الرئيسية المباشرة</CardTitle>
          <CardDescription>
            عند إدخال اسم الطابعة أو عنوان IP الخاص بها، سيقوم النظام بالطباعة المباشرة عليها تلقائياً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">اسم الطابعة أو عنوان IP (اختياري)</label>
            <Input
              value={(form as any).mainPrinterName ?? ""}
              onChange={e => set("mainPrinterName", e.target.value || null)}
              placeholder="مثال: 192.168.1.100 أو Xprinter XP-80C"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              اتركه فارغاً لاستخدام نافذة الطباعة الرسومية للمتصفح مع كامل التنسيقات والشعار.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap pt-2">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold">
          <Save className="w-4 h-4" />
          حفظ وتطبيق إعدادات الطابعة
        </Button>
        <Button variant="outline" onClick={handleTestPrint} className="gap-2 font-bold border-slate-300">
          <Printer className="w-4 h-4" />
          طباعة تجريبية بالهوامش الحالية ({form.leftMargin ?? 1}mm)
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Business Day & Rollover Tab Component
// ─────────────────────────────────────────────
function BusinessDaySettingsTab({
  form,
  setField,
  handleSave,
  isSaving,
}: {
  form: any;
  setField: (field: string, val: any) => void;
  handleSave: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [simulatedTime, setSimulatedTime] = useState("01:30");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);

  const { data: serverStatus } = useQuery<any>({
    queryKey: ["business-day-status"],
    queryFn: () => fetchWithAuth("/api/business-day-settings").then(r => r.json()).catch(() => null),
    refetchInterval: 15000,
  });

  const enabled = form.businessDayCutoffEnabled !== false;
  const cutoffTime = form.businessDayCutoffTime || "03:00";

  // Calculate live current status
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const [cutoffH, cutoffM] = cutoffTime.split(":").map((v: string) => parseInt(v, 10) || 0);
  const currentTotalMin = currentHour * 60 + currentMin;
  const cutoffTotalMin = cutoffH * 60 + cutoffM;
  const isPastMidnight = enabled && currentTotalMin < cutoffTotalMin;

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const calendarDate = `${y}-${m}-${d}`;

  const targetDateObj = new Date(now);
  if (isPastMidnight) {
    targetDateObj.setDate(targetDateObj.getDate() - 1);
  }
  const busY = targetDateObj.getFullYear();
  const busM = String(targetDateObj.getMonth() + 1).padStart(2, "0");
  const busD = String(targetDateObj.getDate()).padStart(2, "0");
  const currentBusinessDate = `${busY}-${busM}-${busD}`;

  // Calculate simulated test result
  const [simH, simM] = simulatedTime.split(":").map(v => parseInt(v, 10) || 0);
  const simTotalMin = simH * 60 + simM;
  const simIsPastMidnight = enabled && simTotalMin < cutoffTotalMin;
  const simTargetObj = new Date(now);
  if (simIsPastMidnight) {
    simTargetObj.setDate(simTargetObj.getDate() - 1);
  }
  const simBusDate = `${simTargetObj.getFullYear()}-${String(simTargetObj.getMonth() + 1).padStart(2, "0")}-${String(simTargetObj.getDate()).padStart(2, "0")}`;

  const presetTimes = [
    { label: "12:00 منتصف الليل (الافتراضي)", time: "00:00" },
    { label: "01:00 فجراً (+1 ساعة)", time: "01:00" },
    { label: "02:00 فجراً (+2 ساعة)", time: "02:00" },
    { label: "03:00 فجراً (موصى به لوكالات السفر)", time: "03:00" },
    { label: "04:00 فجراً (+4 ساعات)", time: "04:00" },
    { label: "05:00 فجراً (+5 ساعات)", time: "05:00" },
    { label: "06:00 صباحاً (+6 ساعات)", time: "06:00" },
  ];

  const handleTestServer = async () => {
    setIsTestingServer(true);
    try {
      const res = await fetchWithAuth("/api/settings/business-day");
      setTestResult(res);
      toast({
        title: "تم التحقق من الخادم وقاعدة البيانات بنجاح",
        description: `تاريخ يوم العمل النشط على السيرفر هو: ${res?.businessDate}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل التحقق من الخادم",
        description: err?.message || "حدث خطأ أثناء الاتصال بالخادم",
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleApplyPreset = (time: string) => {
    setField("businessDayCutoffTime", time);
    const hour = parseInt(time.split(":")[0], 10) || 0;
    setField("businessDayRolloverHour", hour);
  };

  return (
    <div className="space-y-6 bg-slate-50/50 p-3 sm:p-5 rounded-2xl">
      {/* ── Header Summary Card (Fresh & Modern Light Style) ── */}
      <Card className="border-amber-400/40 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 shadow-md text-slate-900">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0 shadow-sm">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                  إدارة وتحديد وقت تقليب يوم جديد للنظام بعد الساعة 12 ليلاً
                  <Badge className="bg-amber-600 text-white font-black text-[11px] shadow-2xs">ميزة مستمرة يومياً</Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 mt-0.5">
                  ضبط ساعة إغلاق وتقليب اليوم المالي تلقائياً ومستمراً لضمان بقاء الفواتير والسندات والحجوزات والورديات الليلية ضمن نفس يوم العمل المعتمد.
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black shadow-md self-start sm:self-auto shrink-0"
            >
              <Save className="w-4 h-4" />
              حفظ وتطبيق الإعدادات
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Live Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block mb-1">يوم العمل المعتمد بالنظام:</span>
              <div className="font-mono font-black text-emerald-600 text-base flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                {currentBusinessDate}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block mb-1">التاريخ التقويمي الفعلي:</span>
              <div className="font-mono font-bold text-slate-800 text-base">
                {calendarDate}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block mb-1">وقت تقليب اليوم المحدد:</span>
              <div className="font-mono font-bold text-amber-600 text-base flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                {cutoffTime} فجراً
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-medium block mb-1">الحالة التشغيلية الآن:</span>
              <div className="flex items-center gap-1.5">
                {isPastMidnight ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-300 shadow-2xs">
                    <Moon className="w-3.5 h-3.5 text-amber-600" />
                    فترة تمديد ليلي نشطة (مستمرة)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs">
                    <Sun className="w-3.5 h-3.5 text-emerald-600" />
                    ساعات عمل نهارية اعتيادية
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* POS Daily Invoice Counter Auto-Reset Banner */}
          <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="font-black text-emerald-950 flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تصفير عداد فواتير نقطة المبيعات تلقائياً مع تقليب يوم العمل</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                يبدأ عداد فواتير نقطة المبيعات تلقائياً من الرقم <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">1</strong> عند دخول يوم عمل جديد بحسب وقت التقليب المحدد أعلاه (<strong className="font-mono">{cutoffTime}</strong> بعد منتصف الليل).
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 bg-white px-3.5 py-2 rounded-lg border border-emerald-200 shadow-2xs">
              <div>
                <span className="text-[10px] text-slate-500 block">الفاتورة القادمة لليوم ({currentBusinessDate}):</span>
                <span className="font-mono font-black text-base text-emerald-700">
                  #{serverStatus?.nextInvoiceNumber || "1"}
                </span>
              </div>
              <div className="border-r border-slate-200 pr-3">
                <span className="text-[10px] text-slate-500 block">فواتير يوم العمل الحالي:</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  {serverStatus?.todayInvoicesCount ?? 0} فاتورة
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Configuration Card ── */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-slate-900">
            <Settings2 className="w-5 h-5 text-primary" />
            ضبط موعد وتوقيت التقليب المستمر (Cutoff Time)
          </CardTitle>
          <CardDescription>
            حدد بدقة متى يتم اعتبار اليوم المنصرم منتهياً والانتقال لتاريخ اليوم الجديد، ويتم تطبيق هذه الإعدادات بصفة مستمرة يومياً دون انقطاع إلى أن يتم تعديلها أو إيقافها.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="space-y-1">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                تفعيل ميزة تحديد وقت تقليب اليوم بعد 12:00 ليلاً واستمرارها يومياً
                {enabled && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                عند التفعيل، يضمن النظام بصفة مستمرة يومياً عدم تقليب التاريخ عند منتصف الليل، بل يثبت على يوم العمل الحالي حتى حلول الساعة المحددة أدناه تلقائياً.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={v => setField("businessDayCutoffEnabled", v)}
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-800 block">
              اختيار سريع لوقت تقليب اليوم الجديد (مستمر يومياً):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {presetTimes.map(p => {
                const isSelected = form.businessDayCutoffTime === p.time;
                return (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => handleApplyPreset(p.time)}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                      isSelected
                        ? "bg-amber-50 border-amber-500 text-amber-900 font-bold ring-2 ring-amber-400/30"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{p.label}</div>
                      <div className="font-mono text-xs font-bold text-amber-600 mt-1">{p.time}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Input */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-bold text-slate-900">
                تحديد وقت التقليب بدقة مخصصة (ساعة : دقيقة)
              </label>
              <p className="text-xs text-slate-600">
                يمكنك كتابة أي وقت بصيغة (HH:mm) مثل 02:30 أو 03:00 أو 04:00 ليتم اعتماده يومياً بشكل مستمر ودائم.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={form.businessDayCutoffTime || "03:00"}
                onChange={e => {
                  const val = e.target.value || "03:00";
                  setField("businessDayCutoffTime", val);
                  const h = parseInt(val.split(":")[0], 10) || 0;
                  setField("businessDayRolloverHour", h);
                }}
                className="w-36 text-center font-mono font-bold text-base bg-white text-slate-900 border-slate-300 shadow-2xs"
              />
              <span className="text-xs font-semibold text-slate-600">فجراً / صباحاً</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Subsystems Scope Checklist ── */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-slate-900">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            نطاق سريان وتطبيق وقت التقليب المستمر على أنظمة ووظائف البرنامج
          </CardTitle>
          <CardDescription>
            حدد الأنظمة والوظائف التي يُطبق عليها توقيت يوم العمل المالي الجديد بصفة مستمرة ودائمة:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              field: "applyCutoffToAccounting",
              title: "1. نظام الحسابات العامة والقيود والسندات",
              desc: "يسري على القيود اليومية التلقائية، سندات الصرف، سندات القبض، ميزان المراجعة، اليوميات العامة والتقارير المالية.",
              icon: FileSpreadsheet,
              color: "text-blue-600 bg-blue-50 border-blue-200",
            },
            {
              field: "applyCutoffToTravel",
              title: "2. نظام إدارة المخازن والمستودعات الشامل",
              desc: "يسري على أذونات التوريد والصرف المخزني، التحويل بين المستودعات، الجرد الدوري، تسويات التالف، وإحصائيات لوحة المخازن.",
              icon: Plane,
              color: "text-sky-600 bg-sky-50 border-sky-200",
            },
            {
              field: "applyCutoffToTravelServices",
              title: "3. نظام عروض الأسعار والطلبيات والعقود التجارية",
              desc: "يسري على عروض الأسعار التجارية، طلبيات التوريد، العقود التجارية، وسندات دفعات الوكلاء والموزعين.",
              icon: Briefcase,
              color: "text-emerald-600 bg-emerald-50 border-emerald-200",
            },
            {
              field: "applyCutoffToSales",
              title: "4. نظام المبيعات والفواتير ونقاط البيع",
              desc: "يسري على فواتير المبيعات، شاشات الكاشير POS، الورديات الليلية، كشف حساب الكاشير، وتقارير المبيعات اليومية.",
              icon: DollarSign,
              color: "text-amber-600 bg-amber-50 border-amber-200",
            },
            {
              field: "applyCutoffToPurchases",
              title: "5. نظام المشتريات والمصروفات",
              desc: "يسري على أوامر الشراء، فواتير المشتريات، تسجيل المصروفات النثرية والتشغيلية، سندات سداد الموردين ومرتجعات الشراء.",
              icon: ShoppingCart,
              color: "text-purple-600 bg-purple-50 border-purple-200",
            },
            {
              field: "applyCutoffToHR",
              title: "6. نظام شؤون الموظفين والرواتب",
              desc: "يسري على إثبات الحضور والانصراف الليلي، ساعات العمل الإضافي، السلف، الجزاءات، وإغلاق مسير الرواتب الشهري.",
              icon: Users,
              color: "text-rose-600 bg-rose-50 border-rose-200",
            },
          ].map(item => {
            const Icon = item.icon;
            const checked = form[item.field] !== false;
            return (
              <div
                key={item.field}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors shadow-2xs"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{item.title}</div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={checked}
                  onCheckedChange={v => setField(item.field, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Interactive Simulator & Testing Sandbox ── */}
      <Card className="border-blue-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-blue-700">
            <Sparkles className="w-5 h-5 text-blue-600" />
            محاكي واختبار دقة تقليب تاريخ النظام المستمر (Testing & Simulation Sandbox)
          </CardTitle>
          <CardDescription>
            جرّب واختبر مباشرة كيف سيتعامل النظام مع العمليات التي تُجرى في أي ساعة من الليل والنهار بصفة يومية مستمرة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-900">اختر ساعة تجريبية لاختبارها:</span>
                <p className="text-[11px] text-slate-600">
                  مثال: حدد الساعة 01:30 ليلاً لترى ما إذا كان النظام سينسبها لليوم المنصرم أو يقلب ليوم جديد.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={simulatedTime}
                  onChange={e => setSimulatedTime(e.target.value)}
                  className="w-32 font-mono font-bold text-center bg-white text-blue-900 border-blue-300 shadow-2xs"
                />
              </div>
            </div>

            {/* Simulation Output */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-blue-200">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block mb-0.5">الساعة المختارة للتجربة:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{simulatedTime}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block mb-0.5">التاريخ الذي سيُسجل بالعملية:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">{simBusDate}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-slate-500 block mb-0.5">النتيجة والتقييم:</span>
                <span className={`font-bold ${simIsPastMidnight ? "text-amber-700" : "text-emerald-700"}`}>
                  {simIsPastMidnight
                    ? `تمديد تابع لتاريخ الأمس (${simBusDate})`
                    : `يوم جديد مستقل (${simBusDate})`}
                </span>
              </div>
            </div>

            <div className="text-xs leading-relaxed text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <strong>شرح السلوك المعتمد (مستمر يومياً):</strong>{" "}
              {simIsPastMidnight ? (
                <span>
                  نظراً لأن الساعة <span className="font-mono font-bold text-amber-700">{simulatedTime}</span> تأتي بعد 12:00 منتصف الليل وتسبق وقت التقليب المحدد (<span className="font-mono font-bold text-amber-700">{cutoffTime}</span>)، فإن كافة الفواتير والسندات وحركات المخازن والورديات ستُسجل تلقائياً تحت تاريخ{" "}
                  <strong className="text-emerald-700 font-mono">{simBusDate}</strong>.
                </span>
              ) : (
                <span>
                  نظراً لأن الساعة <span className="font-mono font-bold text-emerald-700">{simulatedTime}</span> بعد موعد التقليب (<span className="font-mono font-bold text-emerald-700">{cutoffTime}</span>)، فإن النظام قد قلب التاريخ بنجاح وسيسجل العمليات على اليوم الجديد{" "}
                  <strong className="text-emerald-700 font-mono">{simBusDate}</strong>.
                </span>
              )}
            </div>

            {/* Test Server Direct Endpoint */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestServer}
                disabled={isTestingServer}
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 bg-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingServer ? "animate-spin" : ""}`} />
                اختبار فحص الاتصال بالخادم وقاعدة البيانات مباشرة
              </Button>
              {testResult && (
                <div className="text-xs font-mono text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم التحقق من الخادم: يوم العمل = {testResult.businessDate} | وقت التقليب = {testResult.cutoffTime} (مستمر يومياً)
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Save Settings Action ── */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-xs text-slate-600 font-medium">
          ✓ يتم تطبيق هذه الإعدادات بصفة مستمرة ودائمة يومياً بشكل آلي ودقيق على مدار الساعة إلى أن يتم إيقافها أو تعديلها.
        </p>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-black px-6 shadow-md shrink-0"
        >
          <Save className="w-4 h-4" />
          حفظ وتفعيل إعدادات التقليب المستمر
        </Button>
      </div>
    </div>
  );
}

