import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { useLogout, useGetSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import {
  LogOut,
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  Receipt,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  FileText,
  UserCheck,
  RotateCcw,
  Calculator,
  KeyRound,
  Utensils,
  Clock,
  Truck,
  Wallet,
  Coins,
  Building2,
  Palette,
  Cpu,
  ShieldCheck,
  Boxes,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  Database,
  DollarSign,
  ClipboardList,
  FileCheck,
  ListTodo,
  AlertTriangle,
  Lock,
  BookOpen,
  HelpCircle,
  Image,
  ShieldAlert,
  MapPin,
  X,
  TrendingUp,
  UserPlus,
  Scale,
  Landmark,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  Warehouse,
  ArrowRightLeft,
  Printer,
  Layers,
  Trash2,
  Link2,
  Plus,
  RefreshCw,
  Plane,
  Globe,
  Ticket,
  Luggage,
  Hotel,
  Compass,
  Bus,
  Search,
  Bell,
  Terminal,
  MessageSquare,
  CreditCard,
  FileCheck2,
  Radio,
  Percent,
  QrCode,
  Menu,
  Copy,
  Check,
  Key,
  Fingerprint,
  LogIn,
  Shield,
  PackageCheck,
  Activity,
  Sliders
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "./AppLogo";
import { TravelGlobalSearch } from "./travel-global-search";
import { BusinessDayBadge } from "./BusinessDayBadge";

interface SystemTask {
  name: string;
  href?: string;
  isAction?: "change_password";
  icon: any;
  highlight?: boolean;
}

interface SystemModule {
  id: string;
  title: string;
  icon: any;
  systemKey: string;
  items: SystemTask[];
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, login, logout } = useAuth();
  const { data: settings } = useGetSettings();
  const logoutMutation = useLogout();
  const [location, setLocation] = useLocation();
  const sidebarNavRef = useRef<HTMLDivElement>(null);

  const isDeveloper = user?.role === "developer" || user?.username?.toLowerCase() === "developer";
  const role = (user?.role || "admin") as string;
  const isAdminOrDev = role === "admin" || role === "developer" || role === "general_manager" || role === "مدير" || role === "مدير عام" || role === "مدير عام النظام" || role === "مدير عام الشركة" || user?.username === "admin" || isDeveloper;
  const isCashier = !isAdminOrDev && (role === "cashier" || role === "كاشير");
  const isAccountant = !isAdminOrDev && (role === "accountant" || role === "محاسب");
  const isInventory = !isAdminOrDev && (role === "inventory" || role === "storekeeper" || role === "أمين مخزن");
  const isHr = !isAdminOrDev && (role === "hr" || role === "شؤون موظفين");
  const isSales = !isAdminOrDev && (role === "sales" || role === "موظف مبيعات" || role === "موظف مبيعات وحجوزات سياحية");
  const isGdsSpec = !isAdminOrDev && (role === "gds_spec" || role === "أخصائي أنظمة GDS وإصدار التذاكر");
  const isPurchasing = !isAdminOrDev && (role === "purchasing" || role === "موظف مشتريات" || role === "مسؤول مشتريات الخدمات والموردين");

  const [licenseBlockedReason, setLicenseBlockedReason] = useState<string | null>(null);
  const [deviceHwid, setDeviceHwid] = useState<string>("");
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [lockActivationCode, setLockActivationCode] = useState("");
  const [lockActivating, setLockActivating] = useState(false);
  const [lockActivationError, setLockActivationError] = useState<string | null>(null);
  const [lockSuccessModalData, setLockSuccessModalData] = useState<any>(null);

  const handleLockActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockActivationCode.trim()) return;
    setLockActivating(true);
    setLockActivationError(null);
    try {
      const res = await fetch("/api/licenses/activate-with-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activation_code: lockActivationCode.trim(),
          device_id: deviceHwid
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "كود الترخيص غير مطابق لبصمة الجهاز");
      setLockActivationCode("");
      setLicenseBlockedReason(null);
      setLockSuccessModalData(data);
    } catch (err: any) {
      setLockActivationError(err.message || "فشل تفعيل كود الترخيص");
    } finally {
      setLockActivating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const checkLicense = async () => {
      try {
        const res = await fetch("/api/license/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.blocked && !isDeveloper) {
              setLicenseBlockedReason(data.reason || "توقف الترخيص");
            } else {
              setLicenseBlockedReason(null);
            }
          }
        }
      } catch (e) {}
    };

    checkLicense();
    const interval = setInterval(checkLicense, 8000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [isDeveloper]);

  useEffect(() => {
    if (licenseBlockedReason) {
      fetch("/api/licenses/device-info")
        .then((r) => r.json())
        .then((d) => {
          if (d.deviceId) setDeviceHwid(d.deviceId);
        })
        .catch(() => {});
    }
  }, [licenseBlockedReason]);

  const handleCopyHwid = () => {
    if (!deviceHwid) return;
    navigator.clipboard.writeText(deviceHwid);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 3000);
  };

  // Change Password Modal State
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Mobile navigation drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Full URL State for Sidebar Active Link Matching
  const [currSearchUrl, setCurrSearchUrl] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname + window.location.search : ""
  );

  useEffect(() => {
    const updateUrl = () => {
      setCurrSearchUrl(window.location.pathname + window.location.search);
    };
    updateUrl();
    window.addEventListener("popstate", updateUrl);
    return () => window.removeEventListener("popstate", updateUrl);
  }, [location]);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (pwdForm.newPassword.length < 4) {
      setPwdError("كلمة المرور الجديدة يجب أن تكون 4 أحرف/أرقام على الأقل");
      return;
    }

    setPwdLoading(true);
    try {
      const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : "") ?? "";
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: pwdForm.currentPassword,
          newPassword: pwdForm.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تغيير كلمة السر");
      }

      setPwdSuccess("تم تغيير كلمة السر بنجاح ✅");
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setChangePasswordOpen(false);
        setPwdSuccess(null);
      }, 2000);
    } catch (err: any) {
      setPwdError(err.message || "فشل تغيير كلمة السر");
    } finally {
      setPwdLoading(false);
    }
  };

  // Systems Definition matching the Omni System Pro ERP layout and structure
  const allSystemModules: SystemModule[] = [
    {
      id: "sys_inventory",
      title: "نظام إدارة المخازن والمستودعات الشامل",
      icon: Warehouse,
      systemKey: "sys_inventory",
      items: [
        { name: "متغيرات نظام المخازن والتهيئة (شاشة 49)", href: "/inventory-variables", icon: Sliders, highlight: true },
        { name: "تهيئة وتعريف وحدات القياس (شاشة 51)", href: "/units", icon: Scale, highlight: true },
        { name: "أنواع الأصناف وتصنيفاتها الهرمية", href: "/item-types", icon: Tags, highlight: true },
        { name: "المجموعات الفرعية والمساعدة وتصنيفات الشجرة (رتب)", href: "/item-groups", icon: FolderTree, highlight: true },
        { name: "أنواع أوامر ومعاملات المخزون (تسوية، صرف، توريد، طلبات)", href: "/inventory-types", icon: Layers, highlight: true },
        { name: "عمليات التحويل المتعدد والقياسي والاستلام والتسويات والأرشفة (شاشات 1-5)", href: "/warehouse-operations", icon: ArrowRightLeft, highlight: true },
        { name: "بطاقة وقائمة الأصناف والمنتجات (شاشة 50)", href: "/products", icon: Package, highlight: true },
        { name: "لوحة مؤشرات المخزون وحركة المواد", href: "/inventory?tab=dashboard", icon: Warehouse },
        { name: "أرصدة ومخزون الأصناف والبطاقات", href: "/inventory?tab=stocks", icon: Boxes, highlight: true },
        { name: "سندات التوريد والصرف والتحويلات المخزنية", href: "/inventory?tab=vouchers", icon: ArrowRightLeft, highlight: true },
        { name: "الجرد الدوري والتسويات المخزنية", href: "/inventory?tab=stocktake", icon: ClipboardList },
        { name: "التالف والهالك ومردودات المخزون", href: "/inventory?tab=waste", icon: RotateCcw },
        { name: "طلبات المخزون الداخلية بين الفروع", href: "/inventory?tab=requests", icon: Truck },
        { name: "بطاقة مراقبة الصنف وتكلفة الـ Average", href: "/inventory?tab=costing", icon: Calculator },
        { name: "استيكرات الباركود وطباعة الملصقات QR", href: "/inventory?tab=barcode", icon: QrCode },
        { name: "سجل التدقيق والإلغاء العكسي للمخزون", href: "/inventory?tab=audit", icon: ShieldAlert },
        { name: "تقارير حركة المخزون الشاملة", href: "/inventory?tab=reports", icon: BarChart3 }
      ]
    },
    {
      id: "sys_sales",
      title: "نظام المبيعات ونقاط البيع والعملاء",
      icon: TrendingUp,
      systemKey: "sys_sales",
      items: [
        { name: "نقطة البيع السريعة POS والكاشير", href: "/pos", icon: ShoppingBag, highlight: true },
        { name: "فاتورة المبيعات المخزنية (نقد / آجل)", href: "/sales-invoices", icon: FileText, highlight: true },
        { name: "فواتير المبيعات المركزية Invoices", href: "/orders", icon: Receipt, highlight: true },
        { name: "تقارير المبيعات الشاملة والتحليلية", href: "/reports", icon: BarChart3, highlight: true },
        { name: "مردودات ومرتجع المبيعات Returns", href: "/returns", icon: RotateCcw, highlight: true },
        { name: "إدارة العملاء والشركات CRM", href: "/customers", icon: Users },
        { name: "كشف حساب المبيعات والعملاء التفصيلي", href: "/reports/cashier-statement", icon: FileSpreadsheet, highlight: true },
        { name: "عروض الأسعار والطلبيات Quotations", href: "/travel-quotations", icon: FileText },
        { name: "تصنيفات المبيعات والمنتجات", href: "/categories", icon: Tags },
        { name: "ورديات وشفتات الكاشير والصناديق", href: "/shifts", icon: Clock },
        { name: "إدارة الطاولات والجلسات (للمطاعم والمقاهي)", href: "/tables", icon: Utensils }
      ]
    },
    {
      id: "sys_purchases",
      title: "نظام المشتريات والموردين وسلسلة الإمداد",
      icon: ShoppingBag,
      systemKey: "sys_purchases",
      items: [
        { name: "1. لوحة تحكم ومؤشرات المشتريات", href: "/suppliers?tab=dashboard", icon: LayoutDashboard, highlight: true },
        { name: "2. طلبات الشراء الداخلية والطلب الآلي (PR)", href: "/suppliers?tab=requests", icon: ClipboardList },
        { name: "3. عروض أسعار الموردين والمقارنة (RFQ)", href: "/suppliers?tab=rfqs", icon: FileCheck },
        { name: "4. أوامر شراء المنتجات والبضائع (PO)", href: "/suppliers?tab=orders", icon: ShoppingBag, highlight: true },
        { name: "5. سندات الاستلام المخزني والجودة (GRN)", href: "/suppliers?tab=grn", icon: PackageCheck },
        { name: "6. فواتير المشتريات والمخزون الوارد", href: "/suppliers?tab=invoices", icon: Receipt, highlight: true },
        { name: "7. إدارة الموردين والذمم الدائنة (21100)", href: "/suppliers?tab=suppliers", icon: Users, highlight: true },
        { name: "8. سندات صرف الموردين والمرتجعات", href: "/suppliers?tab=payments_returns", icon: Wallet, highlight: true },
        { name: "9. عقود التوريد وتحليلات الأسعار", href: "/suppliers?tab=contracts_analytics", icon: FileText },
        { name: "10. تقارير المشتريات والموردين الشاملة", href: "/suppliers?tab=reports", icon: BarChart3 }
      ]
    },
    {
      id: "sys_accounting",
      title: "نظام الحسابات العامة وشجرة ودليل الحسابات",
      icon: Landmark,
      systemKey: "sys_accounting",
      items: [
        { name: "لوحة البيانات والمؤشرات المالية", href: "/accounting?tab=dashboard", icon: LayoutDashboard },
        { name: "شجرة الحسابات والدليل المحاسبي الموحد", href: "/accounting?tab=chart", icon: BookOpen, highlight: true },
        { name: "دفتر اليومية العامة والقيود الآلية", href: "/accounting?tab=journal", icon: FileText, highlight: true },
        { name: "سند قبض", href: "/accounting?tab=receipt_vouchers", icon: Receipt, highlight: true },
        { name: "سند صرف", href: "/accounting?tab=payment_vouchers", icon: Wallet, highlight: true },
        { name: "القيود اليومية", href: "/accounting?tab=manual_journal_entry", icon: FileSpreadsheet, highlight: true },
        { name: "إدارة الصناديق والخزائن النقدية", href: "/accounting?tab=safes", icon: Wallet },
        { name: "الحسابات البنكية والتحويلات المصرفية", href: "/accounting?tab=banks", icon: Landmark },
        { name: "مراكز التكلفة والمشاريع والفروع", href: "/accounting?tab=cost_centers", icon: Layers },
        { name: "إدارة المصروفات العامة والنفقات", href: "/expenses", icon: Coins },
        { name: "الأرصدة الافتتاحية للحسابات", href: "/accounting?tab=opening_balances", icon: Calculator },
        { name: "إدارة الأصول الثابتة والإهلاكات", href: "/accounting?tab=assets", icon: Building2 },
        { name: "ميزان المراجعة والقوائم الختامية", href: "/accounting?tab=trial_balance", icon: Scale, highlight: true },
        { name: "الفترات المالية والإغلاقات الدورية", href: "/accounting?tab=periods", icon: Clock },
        { name: "التقارير الحسابية وكشوف الحسابات", href: "/accounting?tab=reports", icon: BarChart3 }
      ]
    },
    {
      id: "sys_hr",
      title: "نظام شؤون الموظفين والرواتب",
      icon: Users,
      systemKey: "sys_hr",
      items: [
        { name: "سجل وبيانات الموظفين والكادر", href: "/hr?view=employees", icon: Users, highlight: true },
        { name: "الحضور والانصراف والورديات", href: "/hr?view=attendance", icon: Clock },
        { name: "مسير المرتبات والأجور الشهرية", href: "/hr?view=salaries", icon: Wallet, highlight: true },
        { name: "سلف ومستحقات وعهد الموظفين", href: "/hr?view=loans", icon: Coins, highlight: true },
        { name: "الإجازات والجزاءات والمكافآت", href: "/hr?view=leaves", icon: FileText },
        { name: "الهيكل الوظيفي وتكويد الوظائف", href: "/hr?view=hr_coding_jobs", icon: ListTodo },
        { name: "تقارير ومؤشرات شؤون الموظفين", href: "/hr?view=reports_tab", icon: BarChart3 }
      ]
    },
    {
      id: "sys_reports",
      title: "نظام التقارير الإدارية والتحليلية",
      icon: BarChart3,
      systemKey: "sys_reports",
      items: [
        { name: "لوحة التقارير والمؤشرات العامة", href: "/reports", icon: BarChart3, highlight: true },
        { name: "كشف حساب المبيعات والكاشير اليومي", href: "/reports/cashier-statement", icon: FileSpreadsheet, highlight: true },
        { name: "تقارير حركة الأرباح والمبيعات", href: "/reports", icon: TrendingUp }
      ]
    },
    {
      id: "sys_admin",
      title: "إدارة وتهيئة النظام والأمان",
      icon: ShieldCheck,
      systemKey: "sys_admin",
      items: [
        { name: "بيانات المستخدمين (الرسمية)", href: "/users?tab=master_record", icon: Users, highlight: true },
        { name: "صلاحيات استخدام الشاشات للمستخدمين", href: "/users?tab=screen_permissions", icon: ShieldCheck, highlight: true },
        { name: "متغيرات نظام المخازن والتهيئة العامة", href: "/inventory-variables", icon: Sliders, highlight: true },
        { name: "عرض المستخدمين (العاملين حالياً)", href: "/users?tab=active_users", icon: Activity, highlight: true },
        { name: "جدول وقائمة المستخدمين", href: "/users?tab=manage", icon: ListTodo },
        { name: "سجل التدقيق والرقابة والأمان", href: "/audit", icon: ShieldAlert },
        { name: "العملات وأسعار الصرف المتعددة", href: "/currencies", icon: Coins },
        { name: "تصميم الترويسة والوثائق والسندات", href: "/document-print-settings", icon: Palette },
        { name: "إدارة الفروع والمواقع والمستودعات", href: "/branches", icon: Building2 },
        { name: "النسخ الاحتياطي واستعادة البيانات", href: "/backup-restore", icon: Database },
        ...(isDeveloper ? [{ name: "تراخيص التشغيل والتفعيل", href: "/licenses", icon: KeyRound }] : []),
        { name: "سجل الطباعة والتحكم", href: "/print-log", icon: Printer },
        { name: "إعدادات النظام العامة", href: "/settings", icon: Settings },
        { name: "🔑 تغيير كلمة السر", isAction: "change_password", icon: Lock }
      ]
    },
    {
      id: "sys_help",
      title: "المساعدة والدعم",
      icon: HelpCircle,
      systemKey: "sys_help",
      items: [
        { name: "🎨 برشورات وكتالوجات النظام", href: "/brochures", icon: Image, highlight: true },
        { name: "دليل الاستخدام والتشغيل التفصيلي", href: "/system-guide", icon: BookOpen }
      ]
    }
  ];

  // Fetch user fine-grained screen permissions
  const { data: userPermsData } = useQuery({
    queryKey: ["me-screen-permissions"],
    queryFn: async () => {
      const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : "") ?? "";
      if (!token) return { isAdmin: false, isDeveloper: false, permissions: {} };
      try {
        const res = await fetch("/api/me/screen-permissions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return { isAdmin: false, isDeveloper: false, permissions: {} };
        return res.json();
      } catch (e) {
        return { isAdmin: false, isDeveloper: false, permissions: {} };
      }
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const SCREEN_ID_BY_HREF: Record<string, number> = {
    "/inventory-variables": 49,
    "/units": 51,
    "/item-types": 51,
    "/item-groups": 51,
    "/inventory-types": 49,
    "/warehouse-operations": 53,
    "/products": 50,
    "/inventory?tab=dashboard": 57,
    "/inventory?tab=stocks": 50,
    "/inventory?tab=vouchers": 53,
    "/inventory?tab=stocktake": 54,
    "/inventory?tab=waste": 55,
    "/inventory?tab=requests": 53,
    "/inventory?tab=costing": 57,
    "/inventory?tab=barcode": 56,
    "/inventory?tab=audit": 57,
    "/inventory?tab=reports": 57,
    "/pos": 60,
    "/sales-invoices": 61,
    "/orders": 62,
    "/returns": 63,
    "/customers": 65,
    "/reports/cashier-statement": 30,
    "/travel-quotations": 64,
    "/categories": 60,
    "/shifts": 66,
    "/tables": 67,
    "/suppliers?tab=dashboard": 76,
    "/suppliers?tab=requests": 70,
    "/suppliers?tab=rfqs": 71,
    "/suppliers?tab=orders": 72,
    "/suppliers?tab=grn": 52,
    "/suppliers?tab=invoices": 73,
    "/suppliers?tab=suppliers": 74,
    "/suppliers?tab=payments_returns": 75,
    "/suppliers?tab=contracts_analytics": 76,
    "/suppliers?tab=reports": 76,
    "/accounting?tab=dashboard": 30,
    "/accounting?tab=chart": 10,
    "/accounting?tab=journal": 20,
    "/accounting?tab=receipt_vouchers": 22,
    "/accounting?tab=payment_vouchers": 21,
    "/accounting?tab=manual_journal_entry": 20,
    "/accounting?tab=safes": 12,
    "/accounting?tab=banks": 28,
    "/accounting?tab=cost_centers": 11,
    "/expenses": 21,
    "/accounting?tab=opening_balances": 15,
    "/accounting?tab=assets": 10,
    "/accounting?tab=trial_balance": 31,
    "/accounting?tab=periods": 40,
    "/accounting?tab=reports": 34,
    "/hr?view=employees": 80,
    "/hr?view=attendance": 81,
    "/hr?view=salaries": 82,
    "/hr?view=loans": 83,
    "/hr?view=leaves": 84,
    "/hr?view=hr_coding_jobs": 80,
    "/hr?view=reports_tab": 85,
    "/reports": 30,
    "/users?tab=master_record": 110,
    "/users?tab=screen_permissions": 113,
    "/users?tab=active_users": 111,
    "/users?tab=manage": 110,
    "/audit": 114,
    "/currencies": 498,
    "/document-print-settings": 117,
    "/branches": 16,
    "/backup-restore": 115,
    "/licenses": 900,
    "/print-log": 114,
    "/settings": 116
  };

  // Role and screen-permissions based filtering logic
  const getVisibleSystems = (): SystemModule[] => {
    if (isDeveloper || isAdminOrDev) {
      return allSystemModules;
    }

    const perms = userPermsData?.permissions || {};
    const isPosOnlyUser = isCashier || Boolean((user as any)?.perm_pos_only);

    // If cashier / pos-only: strictly restrict to sales and basic tools
    return allSystemModules
      .map((mod) => {
        // Cashiers / POS only users cannot access whole other ERP systems unless explicitly permitted
        if (isPosOnlyUser && !["sys_sales", "sys_admin", "sys_help"].includes(mod.id)) {
          return null;
        }

        const filteredItems = mod.items.filter((item) => {
          if (item.isAction === "change_password") return true;
          if (!item.href) return false;

          const screenId = SCREEN_ID_BY_HREF[item.href];
          if (screenId !== undefined) {
            const p = perms[screenId];
            if (p) {
              return Boolean(p.can_check || p.can_view || p.can_view_report || p.can_add || p.can_edit);
            }
            // For Cashier: only POS (60) and Shifts (66) are allowed by default
            if (isPosOnlyUser) {
              return screenId === 60 || screenId === 66 || item.href === "/pos" || item.href === "/shifts";
            }
            return false;
          }

          if (isPosOnlyUser) {
            return item.href === "/pos" || item.href === "/shifts";
          }
          return false;
        });

        if (filteredItems.length === 0) return null;
        return { ...mod, items: filteredItems };
      })
      .filter(Boolean) as SystemModule[];
  };

  const visibleSystems = getVisibleSystems();

  // State to track which system accordion dropdown is currently open
  const [openSystems, setOpenSystems] = useState<Record<string, boolean>>(() => {
    let saved: Record<string, boolean> = {};
    try {
      const raw = sessionStorage.getItem("admin_open_systems");
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}

    const initialState: Record<string, boolean> = { ...saved };

    if (isCashier) {
      initialState["sys_sales"] = true;
    } else {
      // Auto-open active system based on route while preserving other open accordions
      if (location.startsWith("/travel-ndc") || location.startsWith("/travel-gds") || location.startsWith("/travel-hotel-aggregator") || location.startsWith("/travel-charter") || location.startsWith("/travel-zatca") || location.startsWith("/travel-vcc") || location.startsWith("/travel-smart") || location.startsWith("/travel-b2b") || location.startsWith("/travel-b2c") || location.startsWith("/travel-bsp") || location.startsWith("/travel-notifications") || location.startsWith("/travel-atb")) {
        initialState["sys_enterprise"] = true;
      } else if (location.startsWith("/travel-operations") || location.startsWith("/travel-wizard") || location.startsWith("/travel-manager") || location.startsWith("/travel-approvals") || location.startsWith("/travel-branches") || location.startsWith("/travel-tasks") || location.startsWith("/travel-documents") || location.startsWith("/travel-settings") || location.startsWith("/passengers")) {
        initialState["sys_travel"] = true;
      } else if (location.startsWith("/travel-bookings") || location.startsWith("/travel-refunds") || location.startsWith("/travel-modifications") || location.startsWith("/travel-hotels") || location.startsWith("/travel-visas") || location.startsWith("/travel-packages") || location.startsWith("/travel-transport") || location.startsWith("/travel-insurance") || location.startsWith("/travel-airlines") || location.startsWith("/travel-airports")) {
        initialState["sys_services"] = true;
      } else if (location.startsWith("/travel-invoices") || location.startsWith("/travel-quotations") || location.startsWith("/travel-commissions") || location.startsWith("/travel-reports")) {
        initialState["sys_sales"] = true;
      } else if (location.startsWith("/travel-procurement") || location.startsWith("/travel-suppliers")) {
        initialState["sys_purchases"] = true;
      } else if (location.startsWith("/pos") || location.startsWith("/orders") || location.startsWith("/tables") || location.startsWith("/shifts") || location.startsWith("/returns")) {
        initialState["sys_sales"] = true;
      } else if (location.startsWith("/accounting") || location.startsWith("/customers") || location.startsWith("/expenses")) {
        initialState["sys_accounting"] = true;
      } else if (location.startsWith("/products") || location.startsWith("/categories") || location.startsWith("/inventory")) {
        initialState["sys_inventory"] = true;
      } else if (location.startsWith("/suppliers") || location.startsWith("/purchases")) {
        initialState["sys_purchases"] = true;
      } else if (location.startsWith("/hr")) {
        initialState["sys_hr"] = true;
      } else if (location.startsWith("/users") || location.startsWith("/audit") || location.startsWith("/licenses")) {
        initialState["sys_admin"] = true;
      } else if (location.startsWith("/onyx-erp") || location.startsWith("/settings") || location.startsWith("/currencies") || location.startsWith("/document-print-settings")) {
        initialState["sys_config"] = true;
      } else if (location.startsWith("/brochures") || location.startsWith("/system-guide")) {
        initialState["sys_help"] = true;
      } else {
        if (Object.keys(initialState).length === 0) {
          initialState["sys_sales"] = true;
        }
      }
    }
    return initialState;
  });

  // Ensure system accordion is auto-opened when navigating to pages like /brochures
  useEffect(() => {
    if (location.startsWith("/brochures") || location.startsWith("/system-guide")) {
      setOpenSystems((prev) => ({ ...prev, sys_help: true }));
    }
  }, [location]);

  useEffect(() => {
    try {
      sessionStorage.setItem("admin_open_systems", JSON.stringify(openSystems));
    } catch (e) {}
  }, [openSystems]);

  const toggleSystem = (sysId: string) => {
    saveScrollState();
    setOpenSystems((prev) => {
      const next = { ...prev, [sysId]: !prev[sysId] };
      try {
        sessionStorage.setItem("admin_open_systems", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSidebarScroll = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem("admin_sidebar_scroll", String(sidebarNavRef.current.scrollTop));
    }
  };

  const saveScrollState = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem("admin_sidebar_scroll", String(sidebarNavRef.current.scrollTop));
    }
  };

  useLayoutEffect(() => {
    const restoreScroll = () => {
      const savedScroll = sessionStorage.getItem("admin_sidebar_scroll");
      if (savedScroll !== null && sidebarNavRef.current) {
        sidebarNavRef.current.scrollTop = Number(savedScroll);
      }
    };

    restoreScroll();
    const timer = setTimeout(restoreScroll, 0);
    const raf = requestAnimationFrame(restoreScroll);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [location, openSystems]);

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // Keyboard shortcut Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pos_token");
          localStorage.removeItem("pos_token");
        }
        window.location.href = "/login";
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden" dir="rtl">
      {/* Global Search Dialog */}
      <TravelGlobalSearch open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} />

      {/* Mobile Off-Canvas Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-80 max-w-[85vw] bg-slate-950 text-slate-100 flex flex-col border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300 h-full">
            <div className="h-16 flex items-center justify-between border-b border-slate-800 px-4 bg-slate-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <AppIcon className="w-8 h-8 rounded-lg border border-amber-500/30 object-contain bg-white p-0.5" />
                <div>
                  <h2 className="text-sm font-black text-white">Omni System Pro ERP</h2>
                  <span className="text-[10px] text-amber-400 font-bold block">نظام إدارة المخازن والمبيعات والحسابات المتكامل</span>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isAdminOrDev && (
              <div className="p-2 border-b border-slate-800/60 bg-slate-900/40">
                <Link href="/dashboard" onClick={() => { saveScrollState(); setMobileOpen(false); }}>
                  <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                    location === "/dashboard"
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md"
                      : "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800"
                  )}>
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-amber-400" />
                      <span>لوحة القيادة والمؤشرات</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
                  </div>
                </Link>
              </div>
            )}

            <div className="flex-1 py-3 px-3 overflow-y-auto space-y-2.5 scrollbar-thin">
              {visibleSystems.map((sys) => {
                const SysIcon = sys.icon;
                const isOpen = !!openSystems[sys.id];
                return (
                  <div key={`m-${sys.id}`} className="space-y-1.5">
                    <div
                      onClick={() => toggleSystem(sys.id)}
                      className={cn(
                        "relative w-full overflow-hidden rounded-2xl p-2.5 flex items-center justify-between cursor-pointer transition-all duration-200 shadow-md border group select-none",
                        isOpen
                          ? "bg-slate-900 border-blue-500/80 ring-1 ring-blue-500/50 shadow-lg"
                          : "bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 rounded-r-2xl"></div>
                      <div className="flex items-center gap-3 pr-2.5 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-white/90 flex items-center justify-center text-white shadow-md shrink-0">
                          <SysIcon className="w-4 h-4 text-white stroke-[2.4]" />
                        </div>
                        <span className="text-sm font-extrabold text-white truncate tracking-wide">
                          {sys.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pl-1">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-blue-400 font-bold" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mr-3 pl-1 pr-3 my-1 space-y-1 border-r-2 border-blue-500/60 animate-in fade-in duration-200">
                        {sys.items.map((item, idx) => {
                          if (item.isAction === "change_password") {
                            return (
                              <button
                                key={`m-action-${sys.id}-${idx}`}
                                type="button"
                                onClick={() => {
                                  saveScrollState();
                                  setMobileOpen(false);
                                  setChangePasswordOpen(true);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/20 text-right my-1 border border-amber-500/30"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">{item.name}</span>
                              </button>
                            );
                          }
                          const ItemIcon = item.icon;
                          const isActive = item.href ? (
                            currSearchUrl === item.href ||
                            (item.href.includes("?tab=") && currSearchUrl === item.href) ||
                            (!item.href.includes("?") && location === item.href)
                          ) : false;

                          return (
                            <Link key={`m-nav-${sys.id}-${item.href || item.name}-${idx}`} href={item.href || "#"} onClick={() => {
                              saveScrollState();
                              setMobileOpen(false);
                              if (item.href) {
                                window.history.pushState({}, "", item.href);
                                window.dispatchEvent(new Event("popstate"));
                              }
                            }}>
                              <div className={cn(
                                "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                isActive
                                  ? "bg-blue-600 text-white font-black shadow-md border border-blue-400/50"
                                  : item.highlight
                                  ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20"
                                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                              )}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <ItemIcon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-white" : "text-blue-400/80")} />
                                  <span className="truncate">{item.name}</span>
                                </div>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0"></span>}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-amber-600 text-white flex items-center justify-center font-black text-xs">
                  {user?.name ? user.name.charAt(0) : "م"}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-extrabold text-white truncate">{user?.name || "مستخدم النظام"}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {isDeveloper ? "مطور ومبرمج" : isAdminOrDev ? "مدير النظام العام" : "مستخدم النظام"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setChangePasswordOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] text-amber-400 hover:bg-amber-500/15 rounded-xl transition-colors font-bold border border-amber-500/30"
                  title="تغيير كلمة السر"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>كلمة السر</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] text-red-400 hover:bg-red-500/20 bg-red-500/10 rounded-xl transition-colors font-bold border border-red-500/30 shadow-xs"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل خروج</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex w-72 bg-slate-950 text-slate-100 flex-col border-l border-slate-800 shadow-xl shrink-0">
        {/* Top Header Branding */}
        <div className="h-16 flex items-center justify-between border-b border-slate-800/80 px-4 bg-slate-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl border border-amber-500/30 overflow-hidden flex items-center justify-center bg-white p-0.5 shadow-md shrink-0">
              <AppIcon className="w-full h-full object-contain" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h1 className="text-sm font-black text-white leading-tight truncate">
                Omni System Pro ERP
              </h1>
              <span className="text-[10px] text-amber-400 font-bold tracking-tight block truncate">
                نظام إدارة المخازن والمبيعات والحسابات المتكامل
              </span>
            </div>
          </div>
        </div>

        {/* Quick Link to Dashboard if admin/dev */}
        {isAdminOrDev && (
          <div className="p-2 border-b border-slate-800/60 bg-slate-900/40">
            <Link href="/dashboard" onClick={saveScrollState}>
              <div className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                location === "/dashboard"
                  ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md"
                  : "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-700"
              )}>
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  <span>لوحة القيادة والمؤشرات</span>
                </div>
                <ChevronLeft className="w-3.5 h-3.5 opacity-60" />
              </div>
            </Link>
          </div>
        )}

        {/* Sidebar System List - Matched with Image */}
        <div ref={sidebarNavRef} onScroll={handleSidebarScroll} className="flex-1 py-3 px-3 overflow-y-auto space-y-2.5 scrollbar-thin">
          {visibleSystems.map((sys) => {
            const SysIcon = sys.icon;
            const isOpen = !!openSystems[sys.id];

            return (
              <div key={sys.id} className="space-y-1.5">
                {/* Main System Button (Matching Image Style) */}
                <div
                  onClick={() => toggleSystem(sys.id)}
                  className={cn(
                    "relative w-full overflow-hidden rounded-2xl p-2.5 flex items-center justify-between cursor-pointer transition-all duration-200 shadow-md border group select-none",
                    isOpen
                      ? "bg-slate-900 border-blue-500/80 ring-1 ring-blue-500/50 shadow-lg"
                      : "bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700"
                  )}
                >
                  {/* Blue Accent Trim / Flag on right edge (Matching photo design) */}
                  <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 rounded-r-2xl shadow-xs"></div>

                  <div className="flex items-center gap-3 pr-2.5 overflow-hidden">
                    {/* Blue Circular Icon Frame */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-white/90 flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                      <SysIcon className="w-4 h-4 text-white stroke-[2.4]" />
                    </div>

                    {/* System Name Title */}
                    <span className="text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors truncate tracking-wide">
                      {sys.title}
                    </span>
                  </div>

                  {/* Expand Chevron Icon */}
                  <div className="flex items-center gap-1 shrink-0 pl-1">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-blue-400 font-bold transition-transform" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    )}
                  </div>
                </div>

                {/* Submenu Dropdown List of Tasks & Operations */}
                {isOpen && (
                  <div className="mr-3 pl-1 pr-3 my-1 space-y-1 border-r-2 border-blue-500/60 animate-in fade-in slide-in-from-top-1 duration-200">
                    {sys.items.map((item, idx) => {
                      if (item.isAction === "change_password") {
                        return (
                          <button
                            key={`action-${sys.id}-${item.isAction || idx}`}
                            type="button"
                            onClick={() => {
                              saveScrollState();
                              setChangePasswordOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border border-amber-500/30 transition-all text-right cursor-pointer my-1 shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </button>
                        );
                      }

                      const ItemIcon = item.icon;
                      const isActive = item.href ? (
                        currSearchUrl === item.href ||
                        (item.href.includes("?tab=") && currSearchUrl === item.href) ||
                        (!item.href.includes("?") && location === item.href)
                      ) : false;

                      return (
                        <Link key={`nav-${sys.id}-${item.href || item.name}-${idx}`} href={item.href || "#"} onClick={() => {
                          saveScrollState();
                          if (item.href) {
                            window.history.pushState({}, "", item.href);
                            window.dispatchEvent(new Event("popstate"));
                          }
                        }}>
                          <div className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer group",
                            isActive
                              ? "bg-blue-600 text-white font-black shadow-md border border-blue-400/50"
                              : item.highlight
                              ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20"
                              : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                          )}>
                            <div className="flex items-center gap-2 overflow-hidden">
                              <ItemIcon className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-blue-400/80")} />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0"></span>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Logged in User Profile Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900 shrink-0 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-amber-600 text-white flex items-center justify-center font-black text-sm shadow-md border border-white/20 shrink-0">
              {user?.name ? user.name.charAt(0) : "م"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-extrabold text-white truncate">{user?.name || "مستخدم النظام"}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {isDeveloper ? "مطور ومبرمج النظام 💻" : isAdminOrDev ? "مدير النظام العام 👑" : isCashier ? "كاشير مبيعات 🛒" : isAccountant ? "محاسب مالي 📊" : "مستخدم النظام"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setChangePasswordOpen(true)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl transition-all font-bold border border-amber-500/30 cursor-pointer shadow-xs"
              title="تغيير كلمة السر"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>كلمة السر</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs text-red-300 hover:text-white bg-red-600/20 hover:bg-red-600 rounded-xl transition-all font-bold border border-red-500/40 cursor-pointer shadow-xs"
              title="تسجيل الخروج من النظام"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Top Header Bar with Global Search & Branch Switcher */}
        <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between shadow-xs shrink-0 print:hidden z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors font-bold flex items-center gap-1.5 shadow-2xs"
              title="فتح القائمة الرئيسية"
            >
              <Menu className="w-5 h-5 text-slate-800" />
              <span className="text-xs font-black text-slate-900 hidden sm:inline">القائمة</span>
            </button>

            {/* Global Search Button */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="flex items-center gap-2 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-600 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs transition-colors shadow-xs group max-w-[150px] xs:max-w-[200px] sm:w-72"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors shrink-0" />
              <span className="truncate flex-1 text-right text-slate-500 text-[11px] sm:text-xs">بحث شامل...</span>
              <kbd className="hidden sm:inline-block bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shadow-xs">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Branch Switcher Pill */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-blue-50 border border-blue-200 text-blue-900 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold max-w-[120px] sm:max-w-none truncate">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{settings?.businessName || "الرئيسي"}</span>
            </div>

            {/* Quick Reports Link */}
            <Link href="/reports">
              <div className="hidden md:flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>التقارير</span>
              </div>
            </Link>

            {/* Quick Brochures Link */}
            <Link href="/brochures">
              <div className="hidden sm:flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs">
                <Image className="w-3.5 h-3.5 text-amber-600" />
                <span>🎨 البرشورات</span>
              </div>
            </Link>

            {/* Quick Developer Licenses Link */}
            {isDeveloper && (
              <Link href="/licenses">
                <div className="flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs">
                  <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                  <span>🔑 إدارة التراخيص</span>
                </div>
              </Link>
            )}

            {/* Business Day Badge */}
            <BusinessDayBadge />

            {/* Notification Bell */}
            <Link href="/dashboard">
              <div
                className="relative p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="التنبيهات والإشعارات"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              </div>
            </Link>

            {/* Quick Header Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="تسجيل الخروج من النظام"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden xs:inline">خروج</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 lg:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Dock Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 text-slate-200 h-16 flex items-center justify-around px-2 shadow-2xl dir-rtl">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
          <div className={cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl transition-colors", location === "/dashboard" ? "text-amber-400 font-black" : "text-slate-400 hover:text-slate-200")}>
            <LayoutDashboard className="w-5 h-5" />
            <span>الرئيسية</span>
          </div>
        </Link>
        <Link href="/pos" onClick={() => setMobileOpen(false)}>
          <div className={cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl transition-colors", location === "/pos" ? "text-amber-400 font-black" : "text-slate-400 hover:text-slate-200")}>
            <ShoppingBag className="w-5 h-5" />
            <span>نقطة البيع</span>
          </div>
        </Link>
        <Link href="/inventory" onClick={() => setMobileOpen(false)}>
          <div className={cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl transition-colors", location === "/inventory" ? "text-amber-400 font-black" : "text-slate-400 hover:text-slate-200")}>
            <Warehouse className="w-5 h-5" />
            <span>المخازن</span>
          </div>
        </Link>
        <Link href="/customers" onClick={() => setMobileOpen(false)}>
          <div className={cn("flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl transition-colors", location === "/customers" ? "text-amber-400 font-black" : "text-slate-400 hover:text-slate-200")}>
            <Users className="w-5 h-5" />
            <span>العملاء</span>
          </div>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-xl text-amber-400 hover:text-amber-300">
          <Menu className="w-5 h-5 text-amber-400" />
          <span>الأنظمة</span>
        </button>
      </div>

      {/* Change Password Modal */}
      {changePasswordOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تغيير كلمة السر</h3>
                  <p className="text-[11px] text-slate-400">تحديث كلمة المرور الخاصة بحسابك في النظام</p>
                </div>
              </div>
              <button 
                onClick={() => { setChangePasswordOpen(false); setPwdError(null); setPwdSuccess(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pwdError && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold">
                {pwdError}
              </div>
            )}

            {pwdSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
                {pwdSuccess}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الحالية</label>
                <input
                  type="password"
                  required
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  placeholder="أدخل كلمة المرور الحالية"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  placeholder="أدخل كلمة المرور الجديدة"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تأكيد كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md disabled:opacity-50"
                >
                  {pwdLoading ? "جاري الحفظ..." : "حفظ كلمة السر الجديدة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global License Kill Switch Lock Overlay - Modern Horizontal Layout */}
      {licenseBlockedReason && !isDeveloper && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-red-500/60 text-white rounded-3xl max-w-4xl w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300 dir-rtl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12">
              {/* Right Column: Alert, Reason & Machine Fingerprint */}
              <div className="md:col-span-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-l border-slate-800 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/20 text-red-500 border border-red-500/40 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                      <Lock className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black rounded-full uppercase tracking-wider inline-block">
                        توقف الترخيص 🔒
                      </span>
                      <h2 className="text-lg font-black text-white pt-0.5">تم إيقاف وتجميد النظام</h2>
                    </div>
                  </div>

                  <div className="bg-red-950/40 border border-red-500/30 text-red-200 p-3.5 rounded-2xl text-xs leading-relaxed font-semibold">
                    {licenseBlockedReason}
                  </div>

                  {/* Hardware ID Display & Copy */}
                  {deviceHwid && (
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-right">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <Fingerprint className="w-4 h-4" />
                          بصمة الجهاز المعتمدة للترخيص:
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">HWID</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                        <span className="font-mono text-xs font-black text-amber-300 dir-ltr truncate">{deviceHwid}</span>
                        <button
                          type="button"
                          onClick={handleCopyHwid}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 transition-colors shrink-0"
                          title="نسخ بصمة الجهاز"
                        >
                          {copiedHwid ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedHwid ? "تم النسخ" : "نسخ البصمة"}</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        يرجى تزويد إدارة النظام بهذه البصمة لإصدار كود الترخيص الرقمي.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300 space-y-0.5 text-right">
                  <p className="font-bold flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>تنبيه أمان:</span>
                  </p>
                  <p className="text-slate-300 text-[10px] leading-relaxed">
                    تم تأمين وحماية قاعدة البيانات. للاستمرار في العمل، يرجى إدخال كود الترخيص الرقمي المعتمد.
                  </p>
                </div>
              </div>

              {/* Left Column: Instant Encrypted Activation & WhatsApp Support */}
              <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-4 bg-slate-950">
                <div className="space-y-4">
                  <div className="space-y-1 text-right">
                    <h3 className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                      <Key className="w-4 h-4" />
                      تفعيل فوري وفك التجميد بكود الترخيص المشفر
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      أدخل كود الترخيص المشفر الممنوح لك ليتم فك القفل وتفعيل النظام فورياً.
                    </p>
                  </div>

                  {/* Instant Encrypted Code Activation inside Lock Screen */}
                  <form onSubmit={handleLockActivateCode} className="space-y-3 text-right">
                    {lockActivationError && (
                      <div className="text-[11px] bg-red-500/20 border border-red-500/50 text-red-300 p-2.5 rounded-xl font-bold">
                        {lockActivationError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        كود الترخيص الرقمي المشفر *
                      </label>
                      <input
                        type="text"
                        value={lockActivationCode}
                        onChange={(e) => setLockActivationCode(e.target.value)}
                        placeholder="ألصق كود الترخيص المشفر OMNI-LIC... أو ACT-..."
                        className="w-full bg-slate-900 border border-slate-700 text-amber-300 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-center focus:border-emerald-400 outline-none dir-ltr"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="submit"
                        disabled={!lockActivationCode.trim() || lockActivating}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                      >
                        {lockActivating ? "جاري التحقق والاعتماد..." : "اعتماد وتفعيل النظام الآن ✅"}
                      </button>

                      <a
                        href={`https://wa.me/967777146387?text=${encodeURIComponent(`السلام عليكم، تم إيقاف ترخيص النظام على الجهاز HWID: ${deviceHwid}. يرجى تزويدي بكود التفعيل.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs h-9 px-3 rounded-xl transition-colors shadow"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>طلب كود الترخيص عبر واتساب المطور</span>
                      </a>
                    </div>
                  </form>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>للدعم الفني والتراخيص:</span>
                  <a href="tel:777146387" className="text-amber-400 font-mono font-bold hover:underline dir-ltr">777146387</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lockSuccessModalData && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4 font-sans" dir="rtl">
          <div className="bg-white rounded-3xl border-4 border-emerald-500 shadow-2xl max-w-lg w-full overflow-hidden transform animate-in fade-in-50 zoom-in-95 duration-200 text-right">
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white p-6 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl shadow-inner animate-bounce">
                <Shield className="w-10 h-10 text-yellow-300" />
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
                  <span className="font-black text-slate-900">{lockSuccessModalData.clientName}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                  <span>تاريخ انتهاء الترخيص:</span>
                  <span className="font-mono font-black text-emerald-800">{lockSuccessModalData.expiresAt}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                  <span>عدد الأجهزة المسموح بها:</span>
                  <span className="font-black text-emerald-800">{lockSuccessModalData.devicesLimit} أجهزة</span>
                </div>
                <div className="flex justify-between border-t border-emerald-100 pt-1.5">
                  <span>بصمة الجهاز المعتمد:</span>
                  <span className="font-mono font-black text-slate-900 dir-ltr">{lockSuccessModalData.deviceId}</span>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                <div className="text-xs font-black text-yellow-400">بيانات تسجيل الدخول الافتراضية للنظام:</div>
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
              <button
                type="button"
                onClick={() => setLockSuccessModalData(null)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow"
              >
                حسناً، متابعة استخدام النظام 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
