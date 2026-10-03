import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Info, HelpCircle, Shield, Star, Lightbulb, Mail, 
  BookOpen, Layers, FileText, Users, Tag, Settings, Shuffle, 
  BarChart3, TrendingUp, PieChart, Key, Phone, Laptop, Lock, User,
  Cloud, ShieldCheck, Sparkles, Copy, Check, Fingerprint, AlertOctagon, Wrench,
  X, MessageSquare
} from "lucide-react";
import { AppLogo, AppIcon } from "@/components/AppLogo";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, login } = useAuth();
  const loginMutation = useLogin();

  // If already authenticated, redirect based on user role and permissions
  useEffect(() => {
    if (user) {
      const userRole = user.role as string;
      const isDevOrAdmin = userRole === "admin" || userRole === "developer" || userRole === "general_manager" || (user as any).is_system_admin;
      const isPosOnly = !isDevOrAdmin && (Boolean((user as any).perm_pos_only) || userRole === "cashier" || userRole === "كاشير" || (user as any).default_screen === "pos");

      if (isPosOnly) {
        setLocation("/pos");
        return;
      }
      
      if (isDevOrAdmin) {
        setLocation("/dashboard");
        return;
      }

      // Non-admin user: query their fine-grained screen permissions and open their first permitted screen
      const token = localStorage.getItem("pos_token") || sessionStorage.getItem("pos_token") || "";
      fetch("/api/me/screen-permissions", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.permissions) {
          const SCREEN_PATHS: Record<number, string> = {
            20: "/accounting?tab=journal",
            21: "/accounting?tab=payment",
            22: "/accounting?tab=receipt",
            24: "/accounting?tab=debit_notes",
            25: "/accounting?tab=credit_notes",
            26: "/accounting?tab=cheques_auto",
            27: "/accounting?tab=cheques_manual",
            28: "/accounting?tab=bank_reconcile",
            298: "/accounting?tab=journal_requests",
            299: "/accounting?tab=payment_requests",
            300: "/accounting?tab=receipt_requests",
            498: "/currencies?tab=exchange",
            10: "/accounting?tab=tree",
            11: "/accounting?tab=cost_centers",
            12: "/accounting?tab=safes",
            15: "/accounting?tab=opening",
            16: "/branches",
            30: "/reports/cashier-statement",
            31: "/accounting?tab=trial_balance",
            32: "/accounting?tab=income_statement",
            33: "/accounting?tab=balance_sheet",
            34: "/accounting?tab=general_ledger",
            40: "/accounting?tab=posting",
            41: "/accounting?tab=vouchers_post",
            42: "/accounting?tab=unpost",
            49: "/inventory-variables",
            50: "/products",
            51: "/inventory?tab=units",
            52: "/suppliers?tab=grn",
            53: "/inventory?tab=requests",
            54: "/inventory?tab=stocktake",
            55: "/inventory?tab=waste",
            56: "/inventory?tab=barcode",
            57: "/inventory?tab=reports",
            60: "/pos",
            61: "/sales-invoices",
            62: "/orders",
            63: "/returns",
            64: "/travel-quotations",
            65: "/customers",
            66: "/shifts",
            67: "/tables",
            70: "/suppliers?tab=requests",
            71: "/suppliers?tab=rfqs",
            72: "/suppliers?tab=orders",
            73: "/suppliers?tab=invoices",
            74: "/suppliers?tab=suppliers",
            75: "/suppliers?tab=payments_returns",
            76: "/suppliers?tab=reports",
            80: "/hr?view=employees",
            81: "/hr?view=attendance",
            82: "/hr?view=salaries",
            83: "/hr?view=loans",
            84: "/hr?view=leaves",
            85: "/hr?view=reports_tab",
            110: "/users?tab=master_record",
            111: "/users?tab=active_users",
            113: "/users?tab=screen_permissions",
            114: "/audit",
            115: "/backup-restore",
            116: "/settings",
            117: "/document-print-settings"
          };

          // Priority-ordered screen checks
          const sortedScreenIds = [
            // POS and Sales
            60, 66, 61, 62, 63, 67, 64, 65,
            // GL Operations
            21, 22, 20, 24, 25, 298, 299, 300,
            // Inventory & Purchases
            50, 52, 53, 54, 55, 56, 70, 71, 72, 73, 74, 75,
            // HR
            80, 81, 82, 83, 84,
            // Rest
            10, 11, 12, 15, 16, 30, 31, 32, 33, 34, 40, 41, 42, 49, 51, 57, 76, 85, 110, 111, 113, 114, 115, 116, 117
          ];

          for (const screenId of sortedScreenIds) {
            const perm = data.permissions[screenId];
            if (perm && (perm.can_check === 1 || perm.can_check === true || perm.can_view === 1 || perm.can_view === true)) {
              const path = SCREEN_PATHS[screenId];
              if (path) {
                setLocation(path);
                return;
              }
            }
          }
        }

        // Default fallback if no permission maps matched
        const isPosOnlyUser = Boolean((user as any).perm_pos_only) || userRole === "cashier" || (user as any).default_screen === "pos";
        if (isPosOnlyUser) {
          setLocation("/");
        } else {
          setLocation("/dashboard");
        }
      })
      .catch(() => {
        const isPosOnlyUser = Boolean((user as any).perm_pos_only) || userRole === "cashier" || (user as any).default_screen === "pos";
        if (isPosOnlyUser) {
          setLocation("/");
        } else {
          setLocation("/dashboard");
        }
      });
    }
  }, [user, setLocation]);

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then(r => r.json()).catch(() => ({})),
  });

  const { data: deviceInfo } = useQuery({
    queryKey: ["device-info"],
    queryFn: () => fetch("/api/licenses/device-info").then(r => r.json()).catch(() => ({})),
  });

  const rawBusinessName = settings?.businessName || "";
  const licenseeName = (!rawBusinessName || rawBusinessName.includes("أومني فلاي") || rawBusinessName.includes("OmniFly") || rawBusinessName.includes("لسفريات") || rawBusinessName.includes("للسفريات"))
    ? "مؤسسة أومني سيستم للتجارة والمبيعات (Omni System Pro ERP)"
    : rawBusinessName;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activeForm, setActiveForm] = useState<"login" | "password">("login");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFromBlockedSystem, setIsFromBlockedSystem] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("role") === "developer" || params.get("blocked") === "true") {
        setUsername("developer");
        setIsFromBlockedSystem(true);
      }
    } catch (e) {}
  }, []);

  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseModalTitle, setLicenseModalTitle] = useState("");
  const [licenseModalMessage, setLicenseModalMessage] = useState("");
  const [licenseModalType, setLicenseModalType] = useState<"expired" | "unauthorized" | "version_upgrade" | "generic">("generic");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Quick in-modal device activation state
  const [activationCodeInput, setActivationCodeInput] = useState("");
  const [isActivatingCode, setIsActivatingCode] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [inspectedCodeInfo, setInspectedCodeInfo] = useState<any>(null);

  useEffect(() => {
    const code = activationCodeInput.trim();
    if (!code || code.length < 8) {
      setInspectedCodeInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/licenses/inspect-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: code,
          device_id: deviceInfo?.deviceId
        })
      })
        .then(r => r.json())
        .then(d => {
          if (d && d.valid) setInspectedCodeInfo(d);
          else setInspectedCodeInfo(null);
        })
        .catch(() => setInspectedCodeInfo(null));
    }, 200);
    return () => clearTimeout(timer);
  }, [activationCodeInput, deviceInfo?.deviceId]);

  // Success Celebration Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activationSuccessData, setActivationSuccessData] = useState<any>(null);

  const [promoIndex, setPromoIndex] = useState(0);
  const promoSlides = [
    {
      title: "إدارة المخازن والمبيعات ونقاط البيع الذكية",
      desc: "شاشة كاشير سريعة وإدارة مخزنية شاملة تدعم الجرد الدوري، الباركود، المستودعات المتعددة، وفواتير الجملة والتجزئة.",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
      icon: Laptop,
      iconColor: "text-blue-300",
    },
    {
      title: "تقارير مالية ومحاسبية دقيقة",
      desc: "راقب أرباحك، مبيعاتك ومخزونك لحظة بلحظة مع ربط آلي بدفتر الأستاذ المزدوج وشجرة الحسابات وسندات القبض والصرف.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
      icon: BarChart3,
      iconColor: "text-amber-300",
    },
    {
      title: "إدارة متكاملة للمؤسسات والمخازن والمبيعات",
      desc: "نظام Omni System Pro ERP يوفر إدارة دقيقة للفروع، الصناديق، العملاء، الموردين، وشؤون الموظفين وفق أعلى المعايير.",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80",
      icon: ShieldCheck,
      iconColor: "text-emerald-300",
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % promoSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [promoSlides.length]);

  const handleActivateWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCodeInput.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال كود التفعيل الممنوح لك" });
      return;
    }
    try {
      setIsActivatingCode(true);
      const res = await fetch("/api/licenses/activate-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: activationCodeInput.trim(),
          device_id: deviceInfo?.deviceId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل التفعيل بكود الترخيص");
      }

      setActivationSuccessData(data);
      setShowLicenseModal(false);
      setShowSuccessModal(true);
      setUsername("admin");
      setPassword("admin123");
      setActivationCodeInput("");
      refetchSettings();

      toast({
        title: "ألف مبروك تم الترخيص! 🎉✅",
        description: "قم بتسجيل الدخول للنظام باسم المستخدم admin وكلمة السر admin123"
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التفعيل",
        description: err.message || "كود التفعيل غير صحيح أو غير متوافق مع بصمة هذا الجهاز"
      });
    } finally {
      setIsActivatingCode(false);
    }
  };

  const handleCopyDeviceId = (devId?: string) => {
    const idToCopy = devId || deviceInfo?.deviceId || "";
    if (!idToCopy) return;
    navigator.clipboard.writeText(idToCopy);
    setCopiedHwid(true);
    toast({ title: "تم نسخ بصمة الجهاز 📋", description: idToCopy });
    setTimeout(() => setCopiedHwid(false), 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          toast({
            title: "تم تسجيل الدخول بنجاح",
            description: `أهلاً بك ${data.user?.name || data.user?.username || ""}`,
          });
          const userRole = data.user?.role;
          const isDevOrAdmin = userRole === "admin" || userRole === "developer" || userRole === "general_manager" || (data.user as any)?.is_system_admin;
          const isPosOnly = !isDevOrAdmin && (Boolean((data.user as any)?.perm_pos_only) || userRole === "cashier" || userRole === "كاشير" || (data.user as any)?.default_screen === "pos");
          if (isPosOnly) {
            setLocation("/pos");
          } else if (isDevOrAdmin) {
            setLocation("/dashboard");
          }
        },
        onError: (err: any) => {
          let errorMessage = "تأكد من اسم المستخدم وكلمة المرور.";
          let isLicenseBlocked = false;
          let modalTitle = "تنبيه انتهاء ترخيص النظام";
          let modalMessage = "تم انتهاء فترة صلاحيات ترخيص استخدام النظام يرجى التواصل مع إدارة النظام من أجل ترخيص الاستخدام";
          let modalType: "expired" | "unauthorized" | "version_upgrade" | "generic" = "expired";

          try {
            const data = err?.data || err?.response?.data;
            const status = err?.status || err?.statusCode || err?.response?.status;
            const rawMsg = typeof err === "string" ? err : (err?.message || "");
            
            let parsed: any = data || null;
            if (!parsed && rawMsg) {
              try { parsed = JSON.parse(rawMsg); } catch (e) {}
            }

            const code = err?.code || parsed?.code || parsed?.error;
            const msg = parsed?.message || parsed?.reason || parsed?.error || rawMsg;

            // Only trigger license blocked modal for explicit LICENSE / DEVICE restriction codes (HTTP 403)
            if (code === "version_upgrade_required") {
              isLicenseBlocked = true;
              modalType = "version_upgrade";
              modalTitle = "تنبيه: يلزم ترخيص الإصدار الجديد للنظام";
              modalMessage = msg || "تم تثبيت نسخة نظام جديدة. يمنع تشغيل النظام بحسابات المستخدمين حتى يقوم مالك/مطور النظام بتسجيل الدخول وترخيص الإصدار الجديد للجهاز.";
            } else if (code === "device_unauthorized" || code === "device_blocked" || code === "no_authorized_devices") {
              isLicenseBlocked = true;
              modalType = "unauthorized";
              modalTitle = "تحذير أمني: جهاز غير مرخص للاستخدام";
              modalMessage = msg || "يمنع منعاً باتاً تشغيل النظام على هذا الجهاز بدون ترخيص مسبق من مطور النظام. تم حظر الدخول لحماية أمان النظام.";
            } else if (code === "license_expired") {
              isLicenseBlocked = true;
              modalType = "expired";
              modalTitle = "تنبيه: انتهاء فترة ترخيص النظام";
              modalMessage = msg || "انتهت فترة صلاحية ترخيص استخدام هذا النظام. يرجى التواصل مع مطور النظام لتجديد الترخيص.";
            } else if (code === "license_suspended" || code === "no_active_license" || code === "license_blocked" || code === "license_required") {
              isLicenseBlocked = true;
              modalType = "expired";
              modalTitle = "تنبيه: ترخيص النظام موقوف أو غير مفعّل";
              modalMessage = msg || "ترخيص النظام موقوف حالياً. لا يسمح بالدخول إلا لحساب المطور.";
            } else if (status === 403 && (typeof code === "string" && (code.startsWith("license_") || code.startsWith("device_")))) {
              isLicenseBlocked = true;
              modalType = "unauthorized";
              modalTitle = "تنبيه ترخيص النظام";
              modalMessage = msg || "يمنع استخدام النظام على هذا الجهاز بدون ترخيص معتمد من المطور.";
            } else {
              // Standard authentication error (401 invalid credentials / not found / wrong password)
              isLicenseBlocked = false;
              if (parsed?.error && typeof parsed.error === "string") {
                errorMessage = parsed.error;
              } else if (parsed?.message && typeof parsed.message === "string") {
                errorMessage = parsed.message;
              } else if (rawMsg) {
                errorMessage = rawMsg;
              }
            }
          } catch (e) {
            isLicenseBlocked = false;
            errorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة.";
          }

          if (isLicenseBlocked) {
            setLicenseModalTitle(modalTitle);
            setLicenseModalMessage(modalMessage);
            setLicenseModalType(modalType);
            setShowLicenseModal(true);
          } else {
            toast({
              variant: "destructive",
              title: "خطأ في تسجيل الدخول",
              description: errorMessage,
            });
          }
        },
      }
    );
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        variant: "destructive",
        title: "خطأ في البيانات",
        description: "يرجى إدخال اسم الحساب / المستخدم أولاً.",
      });
      return;
    }
    if (!oldPassword) {
      toast({
        variant: "destructive",
        title: "خطأ في البيانات",
        description: "يرجى إدخال كلمة المرور الحالية.",
      });
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      toast({
        variant: "destructive",
        title: "خطأ في البيانات",
        description: "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "خطأ في البيانات",
        description: "كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقين.",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          oldPassword,
          newPassword,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        data = { error: "خطأ في استجابة الخادم" };
      }

      if (!res.ok) {
        throw new Error(data.error || "فشل تغيير كلمة المرور");
      }

      toast({
        title: "تم تغيير كلمة المرور بنجاح",
        description: "تم اعتماد كلمة المرور الجديدة. يمكنك الآن تسجيل الدخول مباشرة بها.",
      });

      setPassword(newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setActiveForm("login");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تغيير كلمة المرور",
        description: err.message || "حدث خطأ أثناء تعديل كلمة المرور",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#cbd5e1] flex flex-col font-sans select-none" dir="rtl">
      {/* ─── Top Windows Title Bar (إطار النافذة العلوي) ─── */}
      <div className="h-12 bg-gradient-to-r from-[#1e3a8a] to-[#0f172a] text-white flex items-center justify-between px-4 shadow-md border-b border-blue-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 p-1 flex items-center justify-center overflow-hidden border border-white/20">
            <AppIcon alt="Omni System Pro ERP" className="w-full h-full object-contain" />
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-wide">Omni System Pro ERP - نظام إدارة المخازن والمبيعات والحسابات المتكامل</span>
        </div>
        
        {/* الترخيص لـ اسم المرخص له في المنتصف */}
        <div className="hidden md:block bg-yellow-500/10 border border-yellow-500/30 px-4 py-1 rounded text-xs text-yellow-300 font-bold">
          هذا النظام مرخص لـ: <span className="text-white font-black text-sm">{licenseeName}</span>
        </div>

        {/* أزرار تفاعلية ملونة مثل الصورة */}
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-blue-300" title="معلومات النظام">
            <Info className="w-5 h-5" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-cyan-300" title="المساعدة والدعم">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-emerald-300" title="حالة الأمان">
            <Shield className="w-5 h-5" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-yellow-300" title="المفضلة">
            <Star className="w-5 h-5" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-orange-400" title="المقترحات">
            <Lightbulb className="w-5 h-5" />
          </button>
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-indigo-300" title="اتصل بنا">
            <Mail className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── Main Application Body Layout ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Left Sidebar: Promotional Showcase replacing the old fake navigation */}
        <aside className="hidden lg:flex w-80 bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] border-l border-slate-300 flex-col py-6 shadow-inner relative overflow-y-auto custom-scrollbar">
          {/* Decorative geometric background */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          
          <div className="relative z-10 px-5 space-y-6">
            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-lg mb-2">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Omni System Pro ERP</h3>
              <p className="text-sm font-bold text-blue-700">نظام إدارة المخازن والمبيعات والحسابات المتكامل</p>
            </div>

            {/* Dynamic Promo Slider */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 group relative transition-all duration-500 min-h-[220px] flex flex-col">
              <div className="h-32 w-full overflow-hidden relative">
                <img 
                  src={promoSlides[promoIndex].image}
                  alt={promoSlides[promoIndex].title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                
                {/* Dots indicator */}
                <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 z-20">
                  {promoSlides.map((slide, idx) => (
                    <button
                      key={`promo-dot-${idx}`}
                      onClick={() => setPromoIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${promoIndex === idx ? 'w-4 bg-white' : 'bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>

                <h4 className="absolute bottom-3 right-4 text-white font-bold text-sm flex items-center gap-2">
                  {React.createElement(promoSlides[promoIndex].icon, { className: `w-4 h-4 ${promoSlides[promoIndex].iconColor}` })}
                  {promoSlides[promoIndex].title}
                </h4>
              </div>
              <div className="p-4 flex-1">
                <p className="text-xs text-slate-600 leading-relaxed font-medium transition-opacity duration-500 min-h-[48px]">
                  {promoSlides[promoIndex].desc}
                </p>
              </div>
            </div>

            {/* Feature Badges */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-bold text-emerald-900 leading-tight">أمان ونسخ احتياطي مجدول</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-indigo-900 leading-tight">قاعدة بيانات سحابية متزامنة</span>
              </div>
            </div>
            
            {/* Trust Banner */}
            <div className="p-4 bg-gradient-to-l from-amber-100 to-amber-50 border border-amber-200 rounded-xl text-center shadow-sm">
              <div className="flex items-center justify-center gap-1 mb-2">
                {[1,2,3,4,5].map(i => (
                  <Star key={`trust-star-${i}`} className="w-4 h-4 text-amber-500 fill-amber-500" />
                ))}
              </div>
              <p className="text-xs font-extrabold text-amber-900">أكثر من 5000 مؤسسة وفرع ومستودع يثقون في أنظمتنا</p>
            </div>
          </div>
        </aside>

        {/* 2. Center Branding Workspace (المساحة الوسطى الكبيرة بشعار أومني سيستم) */}
        <section className="flex-1 bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] flex flex-col justify-between p-6 relative">
          {/* خلفية هندسية مميزة */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
          
          <div className="flex-1 flex flex-col items-center justify-center text-center z-10 my-auto">
            {/* الشعار المعتمد Omni System Pro ERP */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 bg-white p-5 rounded-3xl shadow-xl border border-slate-200 mb-6 flex items-center justify-center transform hover:scale-105 transition-transform duration-300 overflow-hidden">
              <AppLogo alt="Omni System Pro ERP Logo" className="w-full h-full object-contain" />
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] tracking-tight mb-2">
              Omni System Pro ERP
            </h2>
            <p className="text-sm sm:text-base font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full shadow-sm">
              نظام إدارة المخازن والمبيعات والحسابات المتكامل
            </p>

            {/* التواصل ومعلومات الدعم */}
            <div className="mt-8 bg-white/70 backdrop-blur-sm border border-slate-300/50 rounded-xl p-4 shadow-md max-w-sm w-full">
              <div className="flex items-center justify-center gap-2 text-slate-700 font-extrabold mb-1">
                <Phone className="w-4 h-4 text-green-600" />
                <span>التواصل مع الدعم الفني والترخيص:</span>
              </div>
              <p className="text-xl font-black text-blue-900 tracking-widest"><Num>777146387</Num></p>
            </div>
          </div>

          {/* تذييل واجهة العمل */}
          <div className="text-center text-slate-500 font-bold text-xs border-t border-slate-300/60 pt-4 z-10">
            Omni System Pro ERP Enterprise Solutions &copy; {new Date().getFullYear()}
          </div>
        </section>

        {/* 3. Right Sidebar Control Panel (لوحة الدخول والتحكم والتبديل) */}
        <aside className="w-full sm:w-[380px] lg:w-[400px] bg-white border-r border-slate-300 flex flex-col p-6 shadow-2xl justify-center z-20">
          <div className="mb-6 text-center">
            <h3 className="text-2xl font-black text-slate-800 mb-1">تسجيل الدخول</h3>
            <p className="text-xs font-bold text-slate-500">اختر العملية المطلوبة للبدء في استخدام النظام</p>
          </div>

          {/* تبديل التبويبات التفاعلية */}
          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setActiveForm("login")}
              className={`py-2 px-3 rounded-md text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                activeForm === "login" 
                  ? "bg-blue-900 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>دخول النظام</span>
            </button>
            <button 
              onClick={() => setActiveForm("password")}
              className={`py-2 px-3 rounded-md text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                activeForm === "password" 
                  ? "bg-blue-900 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>تغيير كلمة السر</span>
            </button>
          </div>

          {/* نموذج تسجيل الدخول لنقطة البيع */}
          {activeForm === "login" ? (
            <Card className="border-slate-200 shadow-lg">
              <CardContent className="p-4 sm:p-5">
                {isFromBlockedSystem || username.toLowerCase() === "developer" ? (
                  <div className="mb-4 bg-amber-500/10 border-r-4 border-amber-600 p-3 rounded space-y-1 text-right">
                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                      <Shield className="w-4 h-4 text-amber-700" />
                      <span>بوابة دخول مطور / مالك النظام 🔐</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      سجّل الدخول بحساب المطور لاعتماد وتجديد ترخيص النظام أو فك تجميد الجهاز.
                    </p>
                  </div>
                ) : (
                  <div className="mb-4 bg-blue-50 border-r-4 border-blue-900 p-3 rounded">
                    <p className="text-xs font-bold text-blue-900">أدخل بيانات الموظف أو مدير النظام للبدء في إدارة المخازن والمبيعات والحسابات.</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-800" />
                      اسم المستخدم
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم (عربي / English / أرقام)"
                      required
                      disabled={loginMutation.isPending}
                      className="text-right border-slate-300 font-bold focus:ring-blue-800 focus:border-blue-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-800" />
                      كلمة المرور
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الخاصة بك"
                      required
                      disabled={loginMutation.isPending}
                      className="text-right border-slate-300 font-bold focus:ring-blue-800 focus:border-blue-800"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-[#1e3a8a] hover:bg-blue-950 text-white font-extrabold text-sm py-2.5 shadow-md flex items-center justify-center gap-2 mt-4" 
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <>
                        <Laptop className="w-4 h-4" />
                        <span>تسجيل الدخول للنظام</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* نموذج تغيير كلمة السر المعتمد والمربوط بالأمان */
            <Card className="border-slate-200 shadow-lg">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 bg-amber-50 border-r-4 border-amber-600 p-3 rounded">
                  <p className="text-xs font-bold text-amber-900 leading-relaxed">
                    أدخل الحساب، كلمة السر الحالية، وكلمة السر الجديدة، مع تأكيدها لاعتماد التغيير والتسجيل بكلمة السر الجديدة.
                  </p>
                </div>

                <form onSubmit={handlePasswordChangeSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="pass-username" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-700" />
                      الحساب / اسم المستخدم
                    </Label>
                    <Input
                      id="pass-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم (مثال: admin)"
                      required
                      className="text-right border-slate-300 font-bold focus:ring-amber-600 focus:border-amber-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="old-pass" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      كلمة السر الحالية
                    </Label>
                    <Input
                      id="old-pass"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="أدخل كلمة السر الحالية"
                      required
                      className="text-right border-slate-300 font-bold focus:ring-amber-600 focus:border-amber-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="new-pass" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      كلمة السر الجديدة
                    </Label>
                    <Input
                      id="new-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="أدخل كلمة السر الجديدة"
                      required
                      className="text-right border-slate-300 font-bold focus:ring-amber-600 focus:border-amber-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="confirm-pass" className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      اعتماد / تأكيد كلمة السر الجديدة
                    </Label>
                    <Input
                      id="confirm-pass"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة السر الجديدة لتأكيدها"
                      required
                      className="text-right border-slate-300 font-bold focus:ring-amber-600 focus:border-amber-600"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isChangingPassword}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-sm py-2.5 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                  >
                    {isChangingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    <span>{isChangingPassword ? "جاري التغيير والاعتماد..." : "اعتماد كلمة السر الجديدة"}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="mt-5 flex flex-col items-center gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLicenseModalTitle("تفعيل وترخيص هذا الجهاز");
                setLicenseModalMessage("أدخل كود التفعيل الممنوح لك من إدارة ومطور النظام لتفعيل وترخيص هذا الجهاز.");
                setLicenseModalType("generic");
                setShowLicenseModal(true);
              }}
              className="w-full border-2 border-amber-500/40 bg-amber-50/80 hover:bg-amber-100 text-amber-950 font-black text-xs py-2 shadow-xs flex items-center justify-center gap-1.5 rounded-xl"
            >
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <span>تفعيل ترخيص الجهاز / إدخال كود الترخيص</span>
            </Button>

            {deviceInfo?.deviceId && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold shadow-xs">
                <Fingerprint className="w-3.5 h-3.5 text-amber-700" />
                <span>بصمة الجهاز:</span>
                <span className="font-mono text-slate-900 dir-ltr">{deviceInfo.deviceId}</span>
                <button
                  type="button"
                  onClick={() => handleCopyDeviceId(deviceInfo.deviceId)}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="نسخ بصمة الجهاز"
                >
                  {copiedHwid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            <div className="text-center text-[10px] text-slate-400 font-extrabold">
              تصميم وتطوير بواسطة إتقان سوفت للحلول البرمجية المتكاملة
            </div>
          </div>
        </aside>
      </div>

      {showLicenseModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
          <div className="bg-white rounded-3xl border-4 border-red-600 shadow-2xl max-w-4xl w-full overflow-hidden transform animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header */}
            <div className={`text-white p-5 flex items-center justify-between gap-4 ${
              licenseModalType === "expired" 
                ? "bg-gradient-to-r from-amber-600 via-red-600 to-red-800" 
                : licenseModalType === "version_upgrade"
                ? "bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900"
                : "bg-gradient-to-r from-red-600 via-red-700 to-slate-950"
            }`}>
              <div className="flex items-center gap-3.5 text-right">
                <div className="p-2.5 bg-white/15 rounded-2xl shadow-inner shrink-0">
                  {licenseModalType === "version_upgrade" ? (
                    <AlertOctagon className="w-7 h-7 text-blue-200 animate-pulse" />
                  ) : (
                    <Shield className="w-7 h-7 text-yellow-300 animate-bounce" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-base sm:text-lg">
                    {licenseModalTitle || (licenseModalType === "expired" ? "تنبيه: انتهاء ترخيص النظام" : "تحذير أمني: يمنع استخدام النظام بدون ترخيص")}
                  </h4>
                  <p className="text-xs text-white/85 font-bold">إتقان سوفت للحلول البرمجية المتكاملة (Omni System Pro ERP)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLicenseModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Horizontal Split Content */}
            <div className="grid grid-cols-1 md:grid-cols-12 max-h-[75vh] overflow-y-auto">
              {/* Right Column: Alert Description, Device HWID & Technical Support */}
              <div className="md:col-span-6 bg-gradient-to-br from-slate-50 to-slate-100/80 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-200 space-y-4">
                <div className="space-y-3.5">
                  <div className={`p-4 rounded-2xl border-r-4 ${
                    licenseModalType === "expired" 
                      ? "bg-amber-50 border-amber-600 text-amber-950" 
                      : licenseModalType === "version_upgrade"
                      ? "bg-blue-50 border-blue-600 text-blue-950"
                      : "bg-red-50 border-red-600 text-red-950"
                  }`}>
                    <p className="font-black text-xs sm:text-sm leading-relaxed text-right">
                      {licenseModalMessage || "يمنع منعاً باتاً استخدام أو نسخ ملفات النظام إلى هذا الجهاز دون ترخيص معتمد من المطور."}
                    </p>
                  </div>

                  {/* Hardware Device Fingerprint Card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-3.5 border border-slate-800 space-y-2 text-right">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Fingerprint className="w-4 h-4" />
                        بصمة هذا الجهاز المادية (HWID)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">مشفر</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="font-mono text-xs text-amber-400 font-black tracking-wider dir-ltr truncate">
                        {deviceInfo?.deviceId || "جاري قراءة بصمة الجهاز..."}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleCopyDeviceId(deviceInfo?.deviceId)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-6 px-2.5 gap-1 shrink-0 rounded-lg"
                      >
                        {copiedHwid ? <Check className="w-3 h-3 text-emerald-950" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedHwid ? "تم النسخ" : "نسخ البصمة"}</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      قم بإرسال هذه البصمة إلى مطور النظام للحصول على كود التفعيل والترخيص الخاص بجهازك.
                    </p>
                  </div>
                </div>

                {/* Technical Support Phone & Contact */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      الدعم الفني وتحديث التراخيص:
                    </span>
                    <a href="tel:777146387" className="text-sm font-black text-red-600 font-mono hover:underline dir-ltr">
                      777146387
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium text-right">
                    إدارة إتقان سوفت للحلول البرمجية المتكاملة
                  </p>
                </div>
              </div>

              {/* Left Column: Instant Encrypted Code Activation Form */}
              <div className="md:col-span-6 p-6 flex flex-col justify-between space-y-4 bg-white">
                <div className="space-y-3">
                  <div className="space-y-1 text-right">
                    <h5 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-emerald-600" />
                      تفعيل فوري بكود الترخيص الرقمي المشفر
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      أدخل أو الصق كود الترخيص الرقمي المعتمد لترخيص وتفعيل هذا الجهاز مباشرة.
                    </p>
                  </div>

                  {/* Instant Activation with Code Form */}
                  <form onSubmit={handleActivateWithCode} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700">
                        كود الترخيص المشفر *
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text && text.trim()) {
                              setActivationCodeInput(text.trim());
                              toast({ title: "تم لصق كود التفعيل 📋" });
                            }
                          } catch {
                            toast({ variant: "destructive", title: "استخدم Ctrl+V للصق الكود" });
                          }
                        }}
                        className="text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300 transition-colors"
                      >
                        لصق الكود 📋
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Input
                        type="text"
                        value={activationCodeInput}
                        onChange={(e) => setActivationCodeInput(e.target.value)}
                        placeholder="ألصق كود الترخيص هنا (OMNI-LIC... أو ACT-...)"
                        className="font-mono text-center text-xs h-9 bg-white border-slate-300 font-black tracking-wider text-slate-900 rounded-xl"
                      />

                      <Button
                        type="submit"
                        disabled={!activationCodeInput.trim() || isActivatingCode}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 shadow-md rounded-xl transition-all"
                      >
                        {isActivatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : "اعتماد وتفعيل الترخيص الآن ✅"}
                      </Button>

                      <a
                        href={`https://wa.me/967777146387?text=${encodeURIComponent(`السلام عليكم، أحتاج كود ترخيص لنظام Omni ERP لجهازي.\nبصمة الجهاز (HWID): ${deviceInfo?.deviceId || ""}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs h-8 px-3 rounded-xl transition-colors shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>طلب الكود عبر واتساب المطور</span>
                      </a>
                    </div>

                    {inspectedCodeInfo && (
                      <div className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-200 ${
                        inspectedCodeInfo.isDeviceMatch && !inspectedCodeInfo.isExpired
                          ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                          : "bg-red-50 border-red-300 text-red-950"
                      }`}>
                        <div className="font-black flex items-center justify-between border-b border-current/15 pb-1">
                          <span>🔓 تم فك تشفير كود الترخيص الرقمي بنجاح:</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                            {inspectedCodeInfo.isDeviceMatch ? "مطابق لبصمة جهازك ✅" : "بصمة مختلفة ⚠️"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-bold">
                          <div>العميل المرخص له: <span className="font-black">{inspectedCodeInfo.clientName}</span></div>
                          <div>تاريخ الانتهاء: <span className="font-mono font-black">{inspectedCodeInfo.expiresAt}</span></div>
                          <div>عدد الأجهزة المسموحة: <span className="font-black">{inspectedCodeInfo.devicesLimit} جهاز</span></div>
                          <div>البصمة المضمنة: <span className="font-mono font-black dir-ltr">{inspectedCodeInfo.hwid}</span></div>
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                {/* Modal Footer Controls without Developer login button */}
                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                  <Button 
                    type="button"
                    onClick={() => setShowLicenseModal(false)}
                    variant="outline"
                    className="border-slate-300 text-slate-700 font-extrabold px-6 py-2 rounded-xl text-xs hover:bg-slate-100"
                  >
                    إغلاق التنبيه
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── CELEBRATION SUCCESS MODAL ON LICENSE ACTIVATION ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
          <div className="bg-white rounded-3xl border-4 border-emerald-500 shadow-2xl max-w-lg w-full overflow-hidden transform animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white p-6 flex items-center gap-4 text-right">
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

            {/* Body */}
            <div className="p-6 space-y-4 text-right">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>المنشأة المرخص لها:</span>
                  <span className="font-black text-slate-900 text-sm">{activationSuccessData?.clientName || "مؤسسة أومني سيستم للتجارة العامة"}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-t border-emerald-100 pt-1.5">
                  <span>تاريخ انتهاء الصلاحية:</span>
                  <span className="font-mono font-black text-emerald-800">{activationSuccessData?.expiresAt || "2027-12-31"}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-t border-emerald-100 pt-1.5">
                  <span>عدد الأجهزة المعتمدة:</span>
                  <span className="font-black text-emerald-800">{activationSuccessData?.devicesLimit || 1} أجهزة</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-t border-emerald-100 pt-1.5">
                  <span>بصمة هذا الجهاز:</span>
                  <span className="font-mono text-[11px] font-black text-slate-700 dir-ltr">{activationSuccessData?.deviceId || deviceInfo?.deviceId}</span>
                </div>
              </div>

              {/* Login Credentials Guide */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 font-black text-xs">
                  <Key className="w-4 h-4" />
                  <span>بيانات تسجيل الدخول الافتراضية للنظام:</span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-0.5">اسم المستخدم</span>
                    <span className="font-mono text-sm font-black text-yellow-300">admin</span>
                  </div>
                  <div className="border-r border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">كلمة السر</span>
                    <span className="font-mono text-sm font-black text-yellow-300">admin123</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  تمت تعبئة بيانات الدخول في النموذج تلقائياً، يمكنك الآن النقر على الزر أدناه للدخول إلى لوحة التحكم فوراً.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between gap-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSuccessModal(false)}
                className="text-xs font-bold"
              >
                إغلاق
              </Button>

              <Button
                type="button"
                onClick={(e) => {
                  setShowSuccessModal(false);
                  setUsername("admin");
                  setPassword("admin123");
                  loginMutation.mutate(
                    { data: { username: "admin", password: "admin123" } },
                    {
                      onSuccess: (data) => {
                        login(data.token, data.user);
                        toast({
                          title: "تم تسجيل الدخول بنجاح",
                          description: `أهلاً بك ${data.user?.name || data.user?.username || ""}`,
                        });
                        setLocation("/dashboard");
                      }
                    }
                  );
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-11 px-6 rounded-xl shadow-lg gap-2"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>تسجيل الدخول للنظام الآن 🚀</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// مكون بسيط لعرض الأرقام بالإنجليزية دائماً لتطابق الفواتير المطبوعة
function Num({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums font-bold font-mono">{children}</span>;
}
