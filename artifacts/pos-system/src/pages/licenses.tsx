import React, { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLogo } from "@/components/AppLogo";
import { 
  KeyRound, Plus, Trash2, ShieldCheck, Monitor, Lock, AlertTriangle, 
  Laptop, Palette, Upload, RefreshCw, Fingerprint, Copy, Check, 
  Sparkles, CheckCircle2, ShieldAlert, Cpu, ArrowUpRight, Cloud, Globe, Server, Zap, MessageSquare
} from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function parseErrorResponse(r: Response): Promise<string> {
  const txt = await r.text();
  try {
    const j = JSON.parse(txt);
    return j.error || j.message || txt;
  } catch {
    return txt || `HTTP Error ${r.status}`;
  }
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await parseErrorResponse(r)); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await parseErrorResponse(r)); return r.json(); }
async function apiPatch(url: string, body: any) { const r = await fetchAuth(url, { method: "PATCH", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await parseErrorResponse(r)); return r.json(); }
async function apiPut(url: string, body: any) { const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await parseErrorResponse(r)); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await parseErrorResponse(r)); }

function safeCopyText(text: string): boolean {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      });
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export default function LicensesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [clientName, setClientName] = useState("مؤسسة أومني سيستم للتجارة والمبيعات");
  const [devicesLimit, setDevicesLimit] = useState("999");
  const [expiresAt, setExpiresAt] = useState("2027-12-31");
  const [targetVersion, setTargetVersion] = useState("1.1.0");
  const [licenseType, setLicenseType] = useState<"cloud" | "desktop">("cloud");
  const [notes, setNotes] = useState("");
  const [expandedLicenseId, setExpandedLicenseId] = useState<number | null>(null);

  // Cloud remote activation state
  const [cloudClientName, setCloudClientName] = useState("مؤسسة أومني سيستم للتجارة والمبيعات");
  const [cloudExpiresAt, setCloudExpiresAt] = useState("2027-12-31");
  const [cloudNotes, setCloudNotes] = useState("ترخيص النسخة السحابية الشامل تم تفعيله عن بعد من قِبل المطور");

  // Manual device authorization state
  const [manualDeviceId, setManualDeviceId] = useState("");
  const [manualDeviceName, setManualDeviceName] = useState("");

  // Code generator state
  const [genDeviceId, setGenDeviceId] = useState("");
  const [genClientName, setGenClientName] = useState("مؤسسة أومني سيستم للتجارة والمبيعات");
  const [genExpiresAt, setGenExpiresAt] = useState("2027-12-31");
  const [genDevicesLimit, setGenDevicesLimit] = useState("1");
  const [genLicenseType, setGenLicenseType] = useState<"desktop" | "cloud">("desktop");
  const [genNotes, setGenNotes] = useState("");
  const [genVersion, setGenVersion] = useState("1.1.0");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedShareText, setGeneratedShareText] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShareText, setCopiedShareText] = useState(false);

  // Logo upload state
  const devLogoFileRef = useRef<HTMLInputElement>(null);
  const [devLogoUrlInput, setDevLogoUrlInput] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  // REQUIREMENT: Developer account only can access this page
  const isDeveloper = user?.role === "developer" || user?.username?.toLowerCase() === "developer";

  const { data: licenses = [] } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => apiGet("/api/licenses"),
    enabled: isDeveloper
  });

  const { data: deviceInfo } = useQuery({
    queryKey: ["device-info"],
    queryFn: () => apiGet("/api/licenses/device-info"),
    enabled: isDeveloper
  });

  React.useEffect(() => {
    if (deviceInfo?.deviceId && !genDeviceId) {
      setGenDeviceId(deviceInfo.deviceId);
    }
  }, [deviceInfo?.deviceId]);

  const { data: licenseStatus } = useQuery({
    queryKey: ["license-status"],
    queryFn: () => apiGet("/api/license/status"),
    enabled: isDeveloper
  });

  const addMut = useMutation({
    mutationFn: () => apiPost("/api/licenses", { 
      client_name: clientName.trim() || "مؤسسة أومني سيستم للتجارة والمبيعات", 
      devices_limit: Number(devicesLimit) || (licenseType === "cloud" ? 999 : 5), 
      expires_at: expiresAt || "2027-12-31",
      target_version: targetVersion || "1.1.0",
      license_type: licenseType,
      device_id: deviceInfo?.deviceId,
      notes 
    }),
    onSuccess: (data) => { 
      qc.invalidateQueries({ queryKey: ["licenses"] }); 
      qc.invalidateQueries({ queryKey: ["license-status"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      setNotes("");
      if (data?.license_key) {
        setGeneratedCode(data.license_key);
      }
      toast({ title: "تم إصدار مفتاح التفعيل والترخيص بنجاح ✅", description: data?.license_key ? `مفتاح الترخيص: ${data.license_key}` : undefined }); 
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إصدار الترخيص", description: e.message })
  });

  const activateCloudMut = useMutation({
    mutationFn: (customExp?: string) => apiPost("/api/licenses/activate-cloud-license", {
      client_name: cloudClientName,
      custom_expires_at: customExp || cloudExpiresAt,
      target_version: targetVersion,
      notes: cloudNotes
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم تفعيل الترخيص السحابي عن بُعد بنجاح ☁️✅", description: data.message });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تفعيل الترخيص السحابي", description: e.message })
  });

  const authorizeCurrentMut = useMutation({
    mutationFn: (licenseId?: number) => apiPost("/api/licenses/authorize-current", { license_id: licenseId }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم ترخيص الجهاز الحالي بنجاح ✅", description: data.message });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const authorizeManualMut = useMutation({
    mutationFn: ({ licenseId, deviceId, deviceName }: { licenseId: number; deviceId: string; deviceName: string }) => 
      apiPost("/api/licenses/authorize-device", { license_id: licenseId, device_id: deviceId, device_name: deviceName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      setManualDeviceId("");
      setManualDeviceName("");
      toast({ title: "تم إضافة وترخيص الجهاز يدوياً بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const generateCodeMut = useMutation({
    mutationFn: () => apiPost("/api/licenses/generate-code", { 
      device_id: genDeviceId.trim() || deviceInfo?.deviceId || (genLicenseType === "cloud" ? "*" : "HW-OMNI-DEV-0001"),
      client_name: genClientName.trim() || "مؤسسة أومني سيستم للتجارة والمبيعات",
      expires_at: genExpiresAt || "2027-12-31", 
      devices_limit: Number(genDevicesLimit) || 1,
      license_type: genLicenseType,
      target_version: genVersion || "1.1.0",
      notes: genNotes,
      auto_save: true
    }),
    onSuccess: (data) => {
      setGeneratedCode(data.activationCode);
      setGeneratedShareText(data.shareText || "");
      if (data.deviceId && !genDeviceId.trim()) {
        setGenDeviceId(data.deviceId);
      }
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "تم توليد واعتماد كود الترخيص بنجاح 🔑✅", description: `صالح حتى ${data.expiresAt}` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التوليد", description: e.message })
  });

  const upgradeAllVersionMut = useMutation({
    mutationFn: (ver: string) => apiPost("/api/licenses/upgrade-all-to-version", { version: ver }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم اعتماد الإصدار لجميع التراخيص ✅", description: data.message });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const toggleDeviceStatusMut = useMutation({
    mutationFn: (deviceId: number) => apiPatch(`/api/licenses/devices/${deviceId}/toggle`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم تحديث حالة الجهاز بنجاح ✅" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/licenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم حذف الترخيص بنجاح ✅" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل حذف الترخيص", description: e.message });
    }
  });

  const updateLicMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => apiPatch(`/api/licenses/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم تحديث حالة وبيانات الترخيص بنجاح ✅" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل تحديث الترخيص", description: e.message });
    }
  });

  const removeDeviceMut = useMutation({
    mutationFn: (deviceId: number) => apiDel(`/api/licenses/devices/${deviceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-status"] });
      toast({ title: "تم إلغاء ربط الجهاز بنجاح ✅" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "فشل إلغاء ربط الجهاز", description: e.message });
    }
  });

  if (!isDeveloper) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 dir-rtl">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-md border-2 border-red-200">
            <Lock className="w-10 h-10 animate-bounce" />
          </div>
          <Card className="max-w-md border-2 border-red-200 bg-red-50/80 shadow-xl rounded-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-red-700 font-black text-lg flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                غير مصرح للوصول - ميزة خاصة بالمطور
              </CardTitle>
              <CardDescription className="text-red-700 font-bold text-xs pt-2 leading-relaxed">
                يُمنع منعاً باتاً ظهور أو إمكانية استخدام شاشة التراخيص وإدارة الأجهزة (Developer License) وشعار النظام لأي مستخدم غير مطور النظام.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const handleApplyLogo = async (logoDataUrl: string) => {
    try {
      setLogoUploading(true);
      localStorage.setItem("omni_developer_system_logo", logoDataUrl);
      await apiPut("/api/settings", { systemLogoUrl: logoDataUrl });
      qc.invalidateQueries({ queryKey: ["settings"] });
      window.dispatchEvent(new Event("omni_logo_updated"));
      toast({ title: "تم رفع وتحديث شعار النظام المطور بنجاح ✅" });
      setDevLogoUrlInput("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "فشل حفظ الشعار", description: err.message });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDevLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "حجم الملف كبير جداً", description: "يرجى اختيار صورة بحجم أقل من 5 ميجابايت" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleApplyLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDevLogo = async () => {
    try {
      localStorage.removeItem("omni_developer_system_logo");
      await apiPut("/api/settings", { systemLogoUrl: "/assets/images/omnisystem_pro_logo_1784250216808.png" });
      qc.invalidateQueries({ queryKey: ["settings"] });
      window.dispatchEvent(new Event("omni_logo_updated"));
      toast({ title: "تم إعادة الشعار الافتراضي للنظام ✅" });
    } catch (e) {
      toast({ variant: "destructive", title: "حدث خطأ" });
    }
  };

  const currentDevId = deviceInfo?.deviceId || "";
  const currentSysVer = deviceInfo?.currentVersion || "1.1.0";

  // Check if current device is registered under any active license
  let isCurrentDeviceAuthorized = false;
  let activeLicenseObj: any = null;
  for (const lic of (licenses as any[])) {
    if (lic.active === 1 && (lic.status === "active" || !lic.status)) {
      if (!activeLicenseObj) activeLicenseObj = lic;
      const found = (lic.devices || []).find((d: any) => d.device_id === currentDevId && (d.status === "authorized" || !d.status));
      if (found) {
        isCurrentDeviceAuthorized = true;
        break;
      }
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 dir-rtl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2.5 text-slate-900">
              <KeyRound className="w-7 h-7 text-red-600" />
              نظام التراخيص وإدارة أمان الأجهزة (Developer Master Security)
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              التحكم المطلق لمالك ومطور النظام: ترخيص أجهزة التشغيل، منع النسخ غير المصرح، توليد أكواد التفعيل الرقمية، واعتماد إصدارات النظام.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-600 text-white font-black px-3 py-1.5 text-xs shadow-md gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>لوحة تحكم مالك النظام 💻</span>
            </Badge>
            <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50 font-black px-3 py-1.5 text-xs">
              إصدار النظام: v{currentSysVer}
            </Badge>
          </div>
        </div>

        {/* ── SECTION 0: Remote Cloud Master Licensing (الترخيص السحابي الشامل عن بُعد) ── */}
        <Card className="border-2 border-sky-500/40 bg-gradient-to-br from-sky-950 via-slate-950 to-indigo-950 text-white rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="bg-sky-900/40 border-b border-sky-800/60 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
                  <Cloud className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-base font-black text-sky-300 flex items-center gap-2">
                    <span>ترخيص النسخة السحابية الشامل عن بُعد (Cloud Master Remote License)</span>
                    <Badge className="bg-sky-500 text-slate-950 font-black text-[10px] px-2 py-0.5">تحكم المطور عن بُعد 🌐</Badge>
                  </CardTitle>
                  <p className="text-[11px] text-sky-200/80 font-medium mt-0.5">
                    يستطيع المطور تسجيل الدخول بحسابه من أي جهاز أو أي مكان في العالم لترخيص وتمديد عمل النسخة السحابية لجميع المستخدمين بضغطة زر.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={licenseStatus?.blocked ? "bg-red-600 text-white font-black" : "bg-emerald-600 text-white font-black"}>
                  {licenseStatus?.blocked ? "🔴 النسخة متوقفة / تحتاج ترخيص" : "🟢 الترخيص السحابي نشط ومعتمد"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/70 p-3.5 rounded-xl border border-sky-900/40 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block text-[11px]">حالة الترخيص الحالية:</span>
                <span className="font-black text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {licenseStatus?.blocked ? "متوقف ومجمد" : "مرخص وشغال بالكامل"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block text-[11px]">اسم المنشأة / العميل:</span>
                <span className="font-bold text-white truncate block">
                  {licenseStatus?.clientName || "مؤسسة أومني سيستم للتجارة والمبيعات"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block text-[11px]">تاريخ الانتهاء المعتمد:</span>
                <span className="font-mono font-black text-amber-400 block dir-ltr text-right">
                  {licenseStatus?.expiresAt || "2027-12-31"} {licenseStatus?.remainingDays !== undefined ? `(${licenseStatus.remainingDays} يوم متبقي)` : ""}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block text-[11px]">نوع الترخيص:</span>
                <Badge className="bg-sky-600/30 text-sky-300 border border-sky-400/40 text-[10px] font-black">
                  ☁️ سحابي شامل (مفتوح لكافة المتصفحات والموظفين)
                </Badge>
              </div>
            </div>

            {/* Quick Extension Presets */}
            <div className="space-y-2">
              <label className="text-xs font-black text-sky-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>تمديد وترخيص السحابة فوراً بفترة محددة (Quick License Extension):</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: "📅 شهر واحد (+1 Mo)", months: 1 },
                  { label: "📅 3 أشهر (+3 Mo)", months: 3 },
                  { label: "📅 6 أشهر (+6 Mo)", months: 6 },
                  { label: "🌟 سنة كاملة (1 Yr)", months: 12 },
                  { label: "🌟 سنتين (2 Yrs)", months: 24 },
                  { label: "👑 مدى الحياة (Lifetime)", exp: "2099-12-31" }
                ].map((item, idx) => {
                  const getExpDate = () => {
                    if (item.exp) return item.exp;
                    const d = new Date();
                    d.setMonth(d.getMonth() + (item.months || 12));
                    return d.toISOString().split("T")[0];
                  };
                  return (
                    <Button
                      key={idx}
                      type="button"
                      size="sm"
                      disabled={activateCloudMut.isPending}
                      onClick={() => {
                        const targetExp = getExpDate();
                        setCloudExpiresAt(targetExp);
                        activateCloudMut.mutate(targetExp);
                      }}
                      className="bg-sky-900/60 hover:bg-sky-800 text-sky-100 hover:text-white border border-sky-700/60 text-xs font-black h-9 transition-all hover:scale-[1.02] shadow-sm"
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom Expiry & Manual Activation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2 border-t border-sky-900/40 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم العميل / المنشأة:</label>
                <Input
                  value={cloudClientName}
                  onChange={(e) => setCloudClientName(e.target.value)}
                  placeholder="اسم المنشأة"
                  className="bg-slate-900 border-sky-800 text-white text-xs h-9 font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">تاريخ انتهاء الترخيص المخصص:</label>
                <Input
                  type="date"
                  value={cloudExpiresAt}
                  onChange={(e) => setCloudExpiresAt(e.target.value)}
                  className="bg-slate-900 border-sky-800 text-white text-xs h-9 font-bold font-mono"
                />
              </div>
              <div className="sm:col-span-1 md:col-span-2 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => activateCloudMut.mutate(cloudExpiresAt)}
                  disabled={activateCloudMut.isPending}
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-xs h-9 gap-2 shadow-lg shadow-sky-950"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{activateCloudMut.isPending ? "جاري التفعيل عن بعد..." : "تفعيل / تجديد الترخيص السحابي عن بُعد فوراً ☁️"}</span>
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-sky-200/70 font-medium leading-relaxed bg-sky-950/50 p-2.5 rounded-lg border border-sky-800/30">
              💡 <strong>كيف يعمل الترخيص السحابي عن بُعد:</strong> بمجرد قيام المطور بتفعيل أو تجديد الترخيص السحابي، يتم فك قفل النظام فوراً لجميع الموظفين ومدراء النظام والمحاسبين من أي متصفح ويب أو فرع دون الحاجة لتسجيل بصمة كل متصفح على حدة.
            </p>
          </CardContent>
        </Card>

        {/* ── SECTION 1: Current Machine HWID & Instant Authorization ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 border-2 border-slate-800 bg-slate-950 text-white rounded-2xl shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-900 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-amber-400" />
                  <span>بصمة هذا الجهاز المادية (Hardware Device ID)</span>
                </CardTitle>
                <Badge className={isCurrentDeviceAuthorized ? "bg-emerald-600 text-white font-bold" : "bg-amber-600 text-white font-bold"}>
                  {isCurrentDeviceAuthorized ? "🟢 هذا الجهاز مرخص ومفعل" : "🟡 جهاز المطور (يحتاج ترخيص دائم)"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                <div className="space-y-0.5 truncate">
                  <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>الجهاز: {deviceInfo?.hostname || "localhost"} | المنصة: {deviceInfo?.platform} ({deviceInfo?.arch})</span>
                  </div>
                  <div className="font-mono text-base font-black text-amber-400 dir-ltr tracking-wider">
                    {currentDevId || "جاري جلب البصمة..."}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(currentDevId);
                      toast({ title: "تم نسخ بصمة الجهاز 📋", description: currentDevId });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs h-8 px-3 gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ البصمة</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={authorizeCurrentMut.isPending}
                    onClick={() => authorizeCurrentMut.mutate(activeLicenseObj?.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-3.5 gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{authorizeCurrentMut.isPending ? "جاري الترخيص..." : "ترخيص هذا الجهاز فوراً"}</span>
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                🔒 يتم اشتقاق هذه البصمة حصرياً من عتاد المعالج واللوحة الأم وكروت الشبكة. إذا قام أي شخص بنسخ ملفات النظام إلى جهاز آخر، ستتغير البصمة ويتوقف النظام فوراً حتى يتم ترخيص الجهاز الجديد من قبل المطور.
              </p>
            </CardContent>
          </Card>

          {/* Version Guard Card */}
          <Card className="border-2 border-blue-200 bg-blue-50/70 rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black text-blue-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-700" />
                <span>حماية ترخيص إصدارات النظام</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-blue-950 font-bold leading-relaxed">
                عند نشر نسخة جديدة أو تحديث للنظام (v{currentSysVer})، يمنع دخول المستخدمين حتى يعتمد المطور الإصدار الجديد.
              </p>
              <Button
                type="button"
                onClick={() => upgradeAllVersionMut.mutate(currentSysVer)}
                disabled={upgradeAllVersionMut.isPending}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black text-xs py-2 gap-1.5 shadow-md"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>اعتماد ترخيص الإصدار (v{currentSysVer}) للجميع</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── SECTION 2: Instant Cloud & Offline Activation Code Generator ── */}
        <Card className="border-2 border-amber-500/40 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/50 rounded-2xl shadow-lg overflow-hidden">
          <CardHeader className="pb-3 border-b border-amber-200/60 bg-amber-100/40">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-black text-amber-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span>مولد ومصدر أكواد التراخيص السحابية والمكتبية (Cloud & Device License Generator)</span>
              </CardTitle>
              <Badge variant="outline" className="border-amber-600 text-amber-900 bg-amber-200/80 font-bold text-xs px-3 py-1">
                تشفير رقمي مشفر متضمن البيانات AES-256-GCM 🔑
              </Badge>
            </div>
            <CardDescription className="text-amber-900/90 text-xs font-medium">
              أدخل بصمة جهاز العميل (HWID) واسم المنشأة وتاريخ الانتهاء وعدد الأجهزة لتوليد كود ترخيص رقمي مشفر يحتوي بداخله على كافة بيانات الترخيص، ليقوم جهاز العميل بفك تشفيره وإنشاء الترخيص تلقائياً فور لصقه.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Target Device HWID */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  بصمة جهاز العميل المستهدف (Target HWID) *
                </label>
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  <Input
                    value={genDeviceId}
                    onChange={(e) => setGenDeviceId(e.target.value)}
                    placeholder="مثال: HW-3789-3288-C91A"
                    className="font-mono text-xs font-bold bg-white text-right border-slate-300 focus:border-amber-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text && text.trim()) {
                          setGenDeviceId(text.trim().toUpperCase());
                          toast({ title: "تم لصق بصمة الجهاز من الحافظة 📋", description: text.trim().toUpperCase() });
                        }
                      } catch {
                        toast({ variant: "destructive", title: "تعذر القراءة التلقائية", description: "استخدم Ctrl+V للصق البصمة في الحقل" });
                      }
                    }}
                    className="text-xs shrink-0 font-bold border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-xs"
                  >
                    لصق البصمة 📋
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGenDeviceId(currentDevId)}
                    className="text-xs shrink-0 font-bold border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-950 shadow-xs"
                  >
                    بصمة هذا الجهاز
                  </Button>
                </div>
              </div>

              {/* Client Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  اسم المنشأة / العميل المرخص له *
                </label>
                <Input
                  value={genClientName}
                  onChange={(e) => setGenClientName(e.target.value)}
                  placeholder="مؤسسة أومني سيستم للتجارة والمبيعات"
                  className="text-xs font-bold bg-white border-slate-300 focus:border-amber-500"
                />
              </div>

              {/* License Duration Presets */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  تحديد مدة الصلاحية وتاريخ الانتهاء
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "شهر (30 يوم)", days: 30 },
                    { label: "3 أشهر", days: 90 },
                    { label: "6 أشهر", days: 180 },
                    { label: "سنة (12 شهر)", days: 365 },
                    { label: "سنتين", days: 730 },
                    { label: "حتى 2030", custom: "2030-12-31" }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (preset.custom) {
                          setGenExpiresAt(preset.custom);
                        } else if (preset.days) {
                          const d = new Date();
                          d.setDate(d.getDate() + preset.days);
                          setGenExpiresAt(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-amber-100 border border-amber-300 text-slate-800 transition-colors shadow-2xs"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="date"
                  value={genExpiresAt}
                  onChange={(e) => setGenExpiresAt(e.target.value)}
                  className="text-xs font-bold bg-white border-slate-300 mt-1"
                />
              </div>

              {/* Devices Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  عدد الأجهزة المسموح بها لهذه البصمة
                </label>
                <select
                  value={genDevicesLimit}
                  onChange={(e) => setGenDevicesLimit(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-xs focus:ring-1 focus:ring-amber-500"
                >
                  <option value="1">جهاز واحد فقط (Single PC)</option>
                  <option value="2">جهازين (2 PCs)</option>
                  <option value="3">3 أجهزة (3 PCs)</option>
                  <option value="5">5 أجهزة (5 PCs)</option>
                  <option value="10">10 أجهزة (10 PCs)</option>
                  <option value="20">20 جهاز (20 PCs)</option>
                  <option value="50">50 جهاز (50 PCs)</option>
                  <option value="999">سحابي مفتوح بدون قيود (Unlimited)</option>
                </select>
              </div>

              {/* License Type */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  نوع الترخيص
                </label>
                <select
                  value={genLicenseType}
                  onChange={(e: any) => setGenLicenseType(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-xs focus:ring-1 focus:ring-amber-500"
                >
                  <option value="desktop">💻 ترخيص محلي مقيد بالأجهزة (Desktop HWID)</option>
                  <option value="cloud">☁️ ترخيص سحابي شامل (Cloud Instance)</option>
                </select>
              </div>
            </div>

            {/* Notes & Generate Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="w-full sm:flex-1">
                <Input
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="ملاحظات الترخيص (اختياري: مثلاً فرع الرياض، عقد سنوي رقم #204...)"
                  className="text-xs bg-white border-slate-300"
                />
              </div>
              <Button
                type="button"
                onClick={() => generateCodeMut.mutate()}
                disabled={generateCodeMut.isPending}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs h-9 px-6 shadow-md gap-2 shrink-0"
              >
                <KeyRound className="w-4 h-4" />
                <span>{generateCodeMut.isPending ? "جاري التوليد والاعتماد..." : "توليد واعتماد كود الترخيص"}</span>
              </Button>
            </div>

            {/* Result Box */}
            {generatedCode && (
              <div className="p-5 rounded-2xl bg-slate-950 text-white border-2 border-amber-500 space-y-4 shadow-xl animate-in fade-in-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      كود الترخيص الرقمي المشفر المعتمد للبصمة ({genDeviceId || currentDevId || "*"}):
                    </span>
                    <div className="font-mono text-xs sm:text-sm font-black text-amber-200 bg-slate-900 p-3 rounded-xl border border-slate-800 break-all select-all dir-ltr text-left">
                      {generatedCode}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        safeCopyText(generatedCode);
                        setCopiedCode(true);
                        toast({ title: "تم نسخ كود التفعيل 📋", description: generatedCode });
                        setTimeout(() => setCopiedCode(false), 3000);
                      }}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 gap-1.5 shadow-md"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? "تم النسخ!" : "نسخ الكود فقط"}</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        const text = generatedShareText || `كود تفعيل نظام Omni System Pro ERP للبصمة (${genDeviceId || currentDevId}):\n${generatedCode}\nصالح حتى: ${genExpiresAt}`;
                        safeCopyText(text);
                        setCopiedShareText(true);
                        toast({ title: "تم نسخ بيانات الترخيص كاملة 📋" });
                        setTimeout(() => setCopiedShareText(false), 3000);
                      }}
                      variant="outline"
                      className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs px-4 py-2 gap-1.5"
                    >
                      {copiedShareText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                      <span>نسخ رسالة التفعيل للعميل</span>
                    </Button>

                    {generatedShareText && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(generatedShareText)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2 rounded-md shadow-md transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>إرسال عبر واتساب</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Detailed Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-bold">
                  <div>
                    <span className="text-slate-400 block text-[10px]">المنشأة:</span>
                    <span className="text-white">{genClientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">صالح حتى:</span>
                    <span className="text-amber-300 font-mono">{genExpiresAt}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">عدد الأجهزة:</span>
                    <span className="text-emerald-400">{genDevicesLimit} أجهزة</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">نوع الترخيص:</span>
                    <span className="text-blue-300">{genLicenseType === "cloud" ? "سحابي شامل" : "أجهزة مكتبية"}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 3: Developer System Logo ── */}
        <Card className="border-2 border-amber-500/40 shadow-lg bg-slate-950 text-white overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-slate-800 pb-3 bg-slate-900/90">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-black text-amber-400 flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-400" />
                <span>شعار النظام المطور (Developer System Logo)</span>
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/50 text-amber-300 bg-amber-500/10 text-[10px]">
                تأثير فوري ومزامن ⚡
              </Badge>
            </div>
            <CardDescription className="text-slate-300 text-xs pt-1 font-medium">
              يمكن للمطور رفع وتحديد شعار النظام المعتمد. يظهر الشعار المرفوع تلقائياً في شريط القائمة الجانبية، شاشة تسجيل الدخول، وأعلى الترويسات الرسمية.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-6 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-28 h-28 rounded-2xl bg-slate-950 border-2 border-amber-500/50 p-2.5 flex items-center justify-center shadow-xl overflow-hidden relative group">
                  <AppLogo className="w-full h-full object-contain" />
                </div>
                <span className="text-[11px] text-amber-300 font-bold">معاينة الشعار الحالي</span>
              </div>

              <div className="flex-1 space-y-3.5 w-full">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    1. رفع ملف صورة الشعار من الجهاز (PNG / JPG / SVG / WebP)
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="file"
                      ref={devLogoFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleDevLogoFileUpload}
                    />
                    <Button
                      type="button"
                      onClick={() => devLogoFileRef.current?.click()}
                      disabled={logoUploading}
                      className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black hover:from-amber-400 hover:to-amber-500 border-amber-400 text-xs shadow-md"
                    >
                      <Upload className="w-4 h-4" />
                      {logoUploading ? "جاري الرفع..." : "رفع وتثبيت الشعار"}
                    </Button>
                    <span className="text-[11px] text-slate-400">ينصح بدقة عالية وخلفية شفافة</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-200">
                    2. أو إدخال رابط الشعار المباشر (Logo URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={devLogoUrlInput}
                      onChange={(e) => setDevLogoUrlInput(e.target.value)}
                      placeholder="https://example.com/system-logo.png"
                      className="bg-slate-950 border-slate-800 text-white text-xs h-9 focus:border-amber-500"
                    />
                    <Button
                      type="button"
                      onClick={() => handleApplyLogo(devLogoUrlInput.trim())}
                      disabled={!devLogoUrlInput.trim() || logoUploading}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs h-9 px-4 shrink-0"
                    >
                      حفظ الرابط
                    </Button>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                  <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    يتم الحفظ والتطبيق الفوري للشعار في كافة مكونات وشاشات النظام.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResetDevLogo}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 font-bold"
                  >
                    <RefreshCw className="w-3 h-3 ml-1" />
                    استعادة الشعار الافتراضي
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 4: Issue New License ── */}
        <Card className="shadow-sm rounded-2xl border-2">
          <CardHeader className="pb-3 bg-muted/20">
            <CardTitle className="text-base flex items-center justify-between font-black text-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-600" />
                <span>إصدار ترخيص جديد للمنشأة (Issue Master / Device License)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold text-slate-600">
                  {licenseType === "cloud" ? "☁️ ترخيص سحابي شامل بدون قيود أجهزة" : "💻 ترخيص مقيد بالأجهزة المادية"}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم العميل / المنشأة *</label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="اسم العميل / المنشأة *" className="text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع الترخيص</label>
                <select
                  value={licenseType}
                  onChange={(e: any) => {
                    const t = e.target.value;
                    setLicenseType(t);
                    if (t === "cloud") setDevicesLimit("999");
                    else setDevicesLimit("5");
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-bold shadow-xs focus:ring-1 focus:ring-red-500"
                >
                  <option value="cloud">☁️ سحابي شامل (Web/Cloud)</option>
                  <option value="desktop">💻 أجهزة مكتبية (Desktop HWID)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">عدد الأجهزة المسموحة</label>
                <Input type="number" min="1" value={devicesLimit} onChange={e => setDevicesLimit(e.target.value)} placeholder="عدد الأجهزة" className="text-xs font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الانتهاء</label>
                <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="تاريخ الانتهاء" className="text-xs font-bold" />
              </div>
              <div className="flex items-end">
                <Button onClick={() => addMut.mutate()} disabled={addMut.isPending} className="w-full gap-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs h-9 shadow-md">
                  <Plus className="w-4 h-4" />
                  {addMut.isPending ? "جاري الإصدار..." : "إصدار الترخيص"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION 5: Licenses & Devices Master Table ── */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-muted/40 border-b flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-red-600" />
              سجل التراخيص والأجهزة المعتمدة ({licenses.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 border-b text-slate-700">
                <tr>
                  <th className="text-right p-3 font-bold">مفتاح التفعيل</th>
                  <th className="text-right p-3 font-bold">اسم العميل</th>
                  <th className="text-center p-3 font-bold">نوع الترخيص</th>
                  <th className="text-center p-3 font-bold">الأجهزة المعتمدة / المسموحة</th>
                  <th className="text-center p-3 font-bold">إصدار النظام</th>
                  <th className="text-right p-3 font-bold">تاريخ الانتهاء</th>
                  <th className="text-right p-3 font-bold">الحالة</th>
                  <th className="p-3 text-center font-bold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {((licenses as any[]) || []).map(l => {
                  const isExpanded = expandedLicenseId === l.id;
                  const activeCount = l.devices?.filter((d: any) => d.status === 'authorized' || !d.status).length ?? 0;
                  const isExpired = l.expires_at && l.expires_at !== "غير محدد" && new Date(l.expires_at) < new Date();
                  const isSuspended = l.status === "suspended";
                  const isCloud = l.license_type === "cloud" || !l.license_type;

                  return (
                    <React.Fragment key={l.id}>
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-red-600 font-extrabold dir-ltr text-right">{l.license_key}</td>
                        <td className="p-3 font-bold text-slate-800">{l.client_name}</td>
                        <td className="p-3 text-center">
                          <select
                            value={l.license_type || "cloud"}
                            onChange={(e) => updateLicMut.mutate({ id: l.id, body: { license_type: e.target.value } })}
                            className={`text-[11px] font-black rounded-lg px-2.5 py-1 border cursor-pointer ${
                              isCloud ? "bg-sky-50 text-sky-800 border-sky-300" : "bg-slate-100 text-slate-800 border-slate-300"
                            }`}
                          >
                            <option value="cloud">☁️ سحابي شامل</option>
                            <option value="desktop">💻 أجهزة مكتبية</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          {isCloud ? (
                            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-200 border-sky-300 text-[11px] font-black px-2.5 py-1">
                              <Cloud className="w-3 h-3 ml-1" />
                              شامل لكافة المتصفحات عن بُعد ({activeCount} جهاز)
                            </Badge>
                          ) : (
                            <button 
                              onClick={() => setExpandedLicenseId(isExpanded ? null : l.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors border"
                            >
                              <Monitor className="w-3.5 h-3.5 text-red-600" />
                              <span>{activeCount} / {l.devices_limit} أجهزة</span>
                              <span className="text-slate-500 font-normal">({isExpanded ? "إخفاء" : "إدارة الأجهزة"})</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">
                          v{l.target_version || currentSysVer}
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            defaultValue={l.expire_date || l.expires_at || ""}
                            onChange={(e) => {
                              const newDate = e.target.value;
                              updateLicMut.mutate({ id: l.id, body: { expire_date: newDate, expires_at: newDate } });
                            }}
                            className="text-xs bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1 font-mono focus:ring-1 focus:ring-red-500 focus:outline-none shadow-xs font-bold"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={l.status || (l.active === 0 ? "suspended" : isExpired ? "expired" : "active")}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              updateLicMut.mutate({
                                id: l.id,
                                body: {
                                  status: newStatus,
                                  active: newStatus === "suspended" ? 0 : 1
                                }
                              });
                            }}
                            className={`text-xs font-black rounded-full px-3 py-1 border cursor-pointer shadow-xs ${
                              isSuspended || l.status === "suspended" || l.active === 0
                                ? "bg-red-100 text-red-800 border-red-300"
                                : isExpired
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            <option value="active">🟢 نشط</option>
                            <option value="suspended">🔴 موقوف (حظر النظام)</option>
                            <option value="expired">🟡 منتهي الصلاحية</option>
                          </select>
                        </td>
                        <td className="p-3 text-center flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 hover:bg-red-100 h-8 w-8 rounded-lg transition-colors" 
                            title="حذف هذا الترخيص"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من حذف الترخيص (${l.license_key}) الخاص بـ (${l.client_name})؟`)) {
                                delMut.mutate(l.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && !isCloud && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={8} className="p-4">
                            <div className="bg-white rounded-2xl border p-4 space-y-4 shadow-sm">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                <h4 className="font-black text-xs text-slate-800 flex items-center gap-2">
                                  <Laptop className="w-4 h-4 text-red-600" /> 
                                  <span>الأجهزة المرخصة والموثقة لهذا المفتاح ({l.devices?.length || 0} أجهزة)</span>
                                </h4>
                                <span className="text-[11px] text-slate-500 font-bold">
                                  الحد الأقصى المسموح: {l.devices_limit} جهاز
                                </span>
                              </div>

                              {/* Manual Device Authorization Form */}
                              <div className="bg-slate-50 p-3 rounded-xl border flex flex-col sm:flex-row items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 shrink-0">ترخيص جهاز جديد يدوياً:</span>
                                <Input
                                  value={manualDeviceId}
                                  onChange={(e) => setManualDeviceId(e.target.value)}
                                  placeholder="بصمة الجهاز المادية (HWID) *"
                                  className="text-xs font-mono bg-white h-8"
                                />
                                <Input
                                  value={manualDeviceName}
                                  onChange={(e) => setManualDeviceName(e.target.value)}
                                  placeholder="اسم المحطة / الموظف"
                                  className="text-xs bg-white h-8"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!manualDeviceId.trim() || authorizeManualMut.isPending}
                                  onClick={() => authorizeManualMut.mutate({ licenseId: l.id, deviceId: manualDeviceId, deviceName: manualDeviceName })}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-3 shrink-0"
                                >
                                  ترخيص الجهاز
                                </Button>
                              </div>

                              {/* Devices Grid */}
                              {l.devices && l.devices.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {l.devices.map((d: any) => {
                                    const isBlocked = d.status === 'blocked';
                                    const isCurrent = d.device_id === currentDevId;
                                    return (
                                      <div key={d.id} className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-colors ${
                                        isBlocked ? "bg-red-50/70 border-red-200" : isCurrent ? "bg-emerald-50/70 border-emerald-300" : "bg-slate-50 border-slate-200"
                                      }`}>
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-between">
                                            <span className="font-black text-slate-800 truncate">{d.device_name || "جهاز غير مسمى"}</span>
                                            <div className="flex items-center gap-1">
                                              {isCurrent && (
                                                <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-bold">هذا الجهاز</Badge>
                                              )}
                                              <Badge className={isBlocked ? "bg-red-600 text-white text-[9px] px-1.5 py-0" : "bg-emerald-600 text-white text-[9px] px-1.5 py-0"}>
                                                {isBlocked ? "محظور" : "مرخص"}
                                              </Badge>
                                            </div>
                                          </div>
                                          <div className="font-mono text-[10px] text-slate-600 dir-ltr text-right truncate">
                                            ID: {d.device_id}
                                          </div>
                                          <div className="text-[10px] text-slate-400">
                                            المعتمد: {d.authorized_by || "المطور"} | النشاط: {d.last_active || "غير محدد"}
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleDeviceStatusMut.mutate(d.id)}
                                            className={`text-[11px] h-7 px-2 font-bold ${isBlocked ? "text-emerald-700 hover:bg-emerald-100" : "text-amber-700 hover:bg-amber-100"}`}
                                          >
                                            {isBlocked ? "إلغاء الحظر" : "حظر الجهاز"}
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-red-600 h-7 px-2 hover:bg-red-100 font-bold" 
                                            onClick={() => confirm("هل تريد إلغاء ربط هذا الجهاز وإتاحته لجهاز آخر؟") && removeDeviceMut.mutate(d.id)}
                                          >
                                            إلغاء الربط
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 py-3 text-center">لا توجد أجهزة مسجلة لهذا الترخيص بعد. يمكنك ترخيص جهاز يدوياً أو بواسطة كود التفعيل.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {licenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-bold">لا توجد تراخيص مسجلة في الوقت الحالي.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
