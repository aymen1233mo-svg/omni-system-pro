import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { AlertTriangle, Clock, Key, ShieldAlert, X, Copy, Check, MessageSquare, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function LicenseExpiryBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);

  // Check license status every 10 minutes or on load
  const { data: status } = useQuery({
    queryKey: ["license-status-banner"],
    queryFn: () => fetch("/api/license/status").then(r => r.json()).catch(() => null),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: deviceInfo } = useQuery({
    queryKey: ["device-info-banner"],
    queryFn: () => fetch("/api/licenses/device-info").then(r => r.json()).catch(() => null),
  });

  const remainingDays = status?.remainingDays;
  const isExpiringSoon = remainingDays !== undefined && remainingDays !== null && remainingDays <= 15 && remainingDays > 0;
  const isCritical = remainingDays !== undefined && remainingDays !== null && remainingDays <= 3 && remainingDays > 0;
  const isExpired = remainingDays !== undefined && remainingDays !== null && remainingDays <= 0;

  // Show urgent popup once per session if critical (<= 3 days)
  useEffect(() => {
    if (isCritical) {
      const hasShown = sessionStorage.getItem("omni_expiry_popup_shown");
      if (!hasShown) {
        setShowRenewModal(true);
        sessionStorage.setItem("omni_expiry_popup_shown", "true");
      }
    }
  }, [isCritical]);

  if (!status || status.blocked || (!isExpiringSoon && !isCritical) || bannerDismissed) {
    return null;
  }

  const handleCopyFingerprint = () => {
    const hwid = deviceInfo?.deviceId || status.deviceId || "";
    if (!hwid) return;
    navigator.clipboard.writeText(hwid);
    setCopiedHwid(true);
    toast({ title: "تم نسخ بصمة الجهاز 📋", description: hwid });
    setTimeout(() => setCopiedHwid(false), 3000);
  };

  const handleActivateRenewCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال كود التفعيل الممنوح لك" });
      return;
    }
    try {
      setIsActivating(true);
      const res = await fetch("/api/licenses/activate-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: activationCode.trim(),
          device_id: deviceInfo?.deviceId || status.deviceId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "كود التفعيل غير صحيح");
      }
      toast({
        title: "تم تجديد وترخيص النظام بنجاح! 🎉✅",
        description: data.message || `تم تمديد الترخيص حتى ${data.expiresAt}`
      });
      setShowRenewModal(false);
      setActivationCode("");
      queryClient.invalidateQueries({ queryKey: ["license-status-banner"] });
      queryClient.invalidateQueries({ queryKey: ["license-status"] });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التفعيل",
        description: err.message || "كود الترخيص غير متوافق أو منتهي"
      });
    } finally {
      setIsActivating(false);
    }
  };

  const currentDev = deviceInfo?.deviceId || status.deviceId || "";
  const devWhatsappMsg = encodeURIComponent(
    `السلام عليكم ورحمة الله،\nأرغب في تجديد ترخيص نظام Omni System Pro ERP.\nاسم المنشأة: ${status.clientName || "العميل"}\nبصمة الجهاز: ${currentDev}\nتاريخ الانتهاء الحالي: ${status.expiresAt} (متبقي ${remainingDays} يوم).\nيرجى إرسال كود التجديد والترخيص.`
  );

  return (
    <>
      {/* Top Banner Alert Bar */}
      <div 
        className={`w-full text-white text-xs font-bold py-2.5 px-4 shadow-md flex items-center justify-between flex-wrap gap-2 transition-all duration-300 z-40 relative dir-rtl ${
          isCritical 
            ? "bg-gradient-to-r from-red-700 via-red-600 to-rose-800 animate-pulse" 
            : "bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700"
        }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="p-1 bg-white/20 rounded-lg shrink-0">
            {isCritical ? <ShieldAlert className="w-4 h-4 text-yellow-300" /> : <Clock className="w-4 h-4 text-white" />}
          </div>
          <div className="leading-snug">
            <span className="font-extrabold ml-1.5">
              {isCritical ? "⚠️ تحذير عاجل: اقتراب توقف النظام!" : "🔔 تنبيه قرب انتهاء الترخيص:"}
            </span>
            <span>
              متبقي <span className="underline font-black text-yellow-200 text-sm">{remainingDays} يوم</span> على انتهاء ترخيص هذا الجهاز (تاريخ الانتهاء: <span className="font-mono">{status.expiresAt}</span>).
            </span>
            <span className="hidden md:inline mr-1 text-white/90">
              يرجى سرعة التواصل مع إدارة ومطور النظام لتجديد الترخيص قبل موعد التوقف لضمان استمرار العمل دون انقطاع.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowRenewModal(true)}
            className="bg-white hover:bg-yellow-50 text-slate-900 font-black text-xs h-7 px-3 gap-1 shadow-xs rounded-lg"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>إدخال كود التجديد</span>
          </Button>

          <a
            href={`https://wa.me/967777146387?text=${devWhatsappMsg}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-7 px-2.5 rounded-lg transition-colors shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">واتساب المطور</span>
          </a>

          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 hover:bg-white/20 rounded-md text-white/80 hover:text-white transition-colors"
            title="إخفاء التنبيه مؤقتاً"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Renew License Modal - Modern Horizontal Layout */}
      <Dialog open={showRenewModal} onOpenChange={setShowRenewModal}>
        <DialogContent className="max-w-3xl w-full dir-rtl rounded-3xl p-0 font-sans border-2 border-amber-500/80 bg-slate-950 text-white overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Right Column: Status & Fingerprint Information */}
            <div className="md:col-span-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-800 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl shrink-0">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black rounded-full uppercase tracking-wider inline-block">
                      ترخيص النظام (Omni ERP)
                    </span>
                    <h3 className="text-base font-black text-white pt-0.5">نافذة تجديد وترخيص النظام</h3>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>حالة الترخيص الحالية:</span>
                    <span className="px-2 py-0.5 rounded font-black text-[11px] bg-red-500/20 text-red-400 border border-red-500/30">
                      متبقي {remainingDays} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-1.5">
                    <span>تاريخ الانتهاء:</span>
                    <span className="font-mono font-bold text-amber-300">{status.expiresAt}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-1.5">
                    <span>اسم المنشأة المرخصة:</span>
                    <span className="font-bold text-slate-100 truncate max-w-[180px]">{status.clientName || "المنشأة المعتمدة"}</span>
                  </div>
                </div>

                {/* Machine Fingerprint Box */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Key className="w-3.5 h-3.5" />
                      بصمة هذا الجهاز (HWID):
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">بصمة مشفرة</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="font-mono text-xs text-amber-300 font-black tracking-wider dir-ltr truncate">
                      {currentDev || "جاري القراءة..."}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCopyFingerprint}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-6 px-2.5 gap-1 shrink-0 rounded-lg"
                    >
                      {copiedHwid ? <Check className="w-3 h-3 text-emerald-950" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHwid ? "تم النسخ" : "نسخ البصمة"}</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    انسخ هذه البصمة وأرسلها لإدارة ومطور النظام لتوليد كود التجديد الرقمي.
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                <span>الدعم الفني والترخيص:</span>
                <a href="tel:777146387" className="font-mono text-amber-400 font-bold hover:underline dir-ltr">777146387</a>
              </div>
            </div>

            {/* Left Column: Activation Code Form & Actions */}
            <div className="md:col-span-6 p-6 flex flex-col justify-between space-y-4 bg-slate-950">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-emerald-400" />
                    إدخال كود التجديد والترخيص الفوري
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    أدخل كود التفعيل الرقمي الممنوح لك ليتم تجديد وتمديد فترة العمل فورياً.
                  </p>
                </div>

                {/* Activation Form */}
                <form onSubmit={handleActivateRenewCode} className="space-y-3 pt-1">
                  <div className="space-y-1.5 text-right">
                    <label className="block text-xs font-bold text-slate-300">
                      كود التفعيل / مفتاح الترخيص المشفر *
                    </label>
                    <Input
                      type="text"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value)}
                      placeholder="OMNI-LIC-... أو ACT-XXXX-XXXX"
                      className="font-mono text-center text-xs h-10 font-black tracking-wider bg-slate-900 border-slate-700 text-amber-300 focus:border-amber-400 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <Button
                      type="submit"
                      disabled={!activationCode.trim() || isActivating}
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-black text-xs h-10 rounded-xl shadow-lg transition-all"
                    >
                      {isActivating ? "جاري التحقق والاعتماد..." : "اعتماد وتمديد الترخيص الآن ✅"}
                    </Button>

                    <a
                      href={`https://wa.me/967777146387?text=${devWhatsappMsg}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-3 rounded-xl transition-colors shadow"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>طلب كود الترخيص عبر واتساب المطور</span>
                    </a>
                  </div>
                </form>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRenewModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 text-xs font-bold rounded-xl px-4"
                >
                  إغلاق النافذة
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
