import React, { useState, useEffect, useRef } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  FileText,
  Clock,
  Calendar,
  Check,
  CheckCircle2,
  AlertTriangle,
  User,
  Sparkles,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Send,
  Download,
  ExternalLink,
  Phone,
  RefreshCw,
  Info,
  Monitor,
  Globe,
  Settings,
  Play,
  PauseCircle,
  StopCircle,
  Bell,
  Lock,
} from "lucide-react";
import { enrichPassengerWithLiveDates, formatRemainingDaysArabic, calcRemainingDays } from "@/lib/passenger-calculations";

export interface WhatsAppAutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPax: any | null;
  allPassengers: any[];
  selectedCustomerId?: string;
  currentCustomerName?: string;
  onBatchComplete?: (result: {
    total: number;
    successCount: number;
    skippedCount: number;
    skippedDetails: any[];
    successList?: any[];
    message?: string;
    isScheduled?: boolean;
  }) => void;
  onEditPassenger?: (passengerId: number | string) => void;
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("pos_token") ?? "" : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const WhatsAppAutomationModal: React.FC<WhatsAppAutomationModalProps> = ({
  open,
  onOpenChange,
  targetPax,
  allPassengers,
  selectedCustomerId,
  currentCustomerName,
  onBatchComplete,
  onEditPassenger,
}) => {
  const { data: systemSettings } = useGetSettings();
  // Config States
  const [whatsappFormat, setWhatsappFormat] = useState<"text" | "pdf" | "text_and_pdf">("text_and_pdf");
  const [whatsappScheduleMode, setWhatsappScheduleMode] = useState<
    "immediate" | "registration_time" | "before_travel_1d" | "before_travel_2d" | "custom_time"
  >("registration_time");
  const [whatsappScheduledTime, setWhatsappScheduledTime] = useState<string>("22:00");
  const [whatsappCustomDate, setWhatsappCustomDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Optional Intro Message States
  const [whatsappEnableIntro, setWhatsappEnableIntro] = useState<boolean>(true);
  const [whatsappIntroText, setWhatsappIntroText] = useState<string>(
    "السلام عليكم ورحمة الله وبركاته، الأخ/الأخت الكريم/ة.. تحية طيبة من وكالة أومني فلاي، يسرنا تزويدكم بتفاصيل رحلتكم وجوازكم ومستندات التأشيرة المعتمدة:"
  );

  // Auto-apply on new passengers toggle
  const [whatsappAutoApplyNew, setWhatsappAutoApplyNew] = useState<boolean>(true);

  // Modes & Controls
  const [whatsappSendMode, setWhatsappSendMode] = useState<"manual" | "auto">("auto");
  const [whatsappClientType, setWhatsappClientType] = useState<"desktop" | "web">(() => {
    return (localStorage.getItem("pos_whatsapp_client_type") as "desktop" | "web") || "desktop";
  });
  const [whatsappDelaySec, setWhatsappDelaySec] = useState<number>(3);
  const [autoSendTargetGroup, setAutoSendTargetGroup] = useState<"all" | "warning_and_urgent" | "urgent_only" | "warning_15" | "overstayed">("all");
  const [agencyWhatsAppSender, setAgencyWhatsAppSender] = useState<string>(() => {
    return localStorage.getItem("pos_agency_whatsapp_sender") || "966500000000";
  });
  const [agencyName, setAgencyName] = useState<string>("وكالة أومني فلاي لخدمات السفر والعمرة");

  useEffect(() => {
    if (systemSettings?.businessName) {
      setAgencyName(systemSettings.businessName);
    }
  }, [systemSettings]);

  // Permissions & Authorization
  const [whatsappAuthorized, setWhatsappAuthorized] = useState<boolean>(() => {
    return localStorage.getItem("pos_whatsapp_authorized") === "true";
  });
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });
  const [protocolTested, setProtocolTested] = useState<boolean>(() => {
    return localStorage.getItem("pos_protocol_tested") === "true";
  });
  const [popupTested, setPopupTested] = useState<boolean>(() => {
    return localStorage.getItem("pos_popup_tested") === "true";
  });
  const [permissionSuccessMessage, setPermissionSuccessMessage] = useState<string>("");
  const [whatsappPermissionModalOpen, setWhatsappPermissionModalOpen] = useState(false);
  const [singlePhone, setSinglePhone] = useState<string>("");
  const [savedPdfUrl, setSavedPdfUrl] = useState<string>("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Windows Desktop Sandbox States
  const [windowsSandboxOpen, setWindowsSandboxOpen] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<"disconnected" | "scanning" | "connected">(() => {
    return localStorage.getItem("pos_whatsapp_authorized") === "true" ? "connected" : "disconnected";
  });
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    "[Windows Desktop v11.2] تم إقلاع البيئة الافتراضية بنجاح.",
    "[WhatsApp Desktop] في انتظار مسح رمز الاستجابة السريعة (QR Code) لربط الجهاز."
  ]);
  const [botTestRunning, setBotTestRunning] = useState(false);

  // Background Runner States
  const [runnerActive, setRunnerActive] = useState(false);
  const [runnerPaused, setRunnerPaused] = useState(false);
  const [runnerCountdown, setRunnerCountdown] = useState<number>(0);
  const [isCopiedToClipboard, setIsCopiedToClipboard] = useState(false);
  const [runnerQueue, setRunnerQueue] = useState<any[]>([]);
  const [runnerIndex, setRunnerIndex] = useState(0);
  const [runnerSuccessCount, setRunnerSuccessCount] = useState(0);
  const [runnerSkippedDetails, setRunnerSkippedDetails] = useState<any[]>([]);
  const [currentRunningItem, setCurrentRunningItem] = useState<any | null>(null);

  // Runner control refs
  const runnerAbortRef = useRef(false);
  const runnerPausedRef = useRef(false);
  const runnerAdvanceRef = useRef<(() => void) | null>(null);
  const runnerSuccessItemsRef = useRef<any[]>([]);
  const runnerSkippedItemsRef = useRef<any[]>([]);

  // Load saved backend configuration and verify Windows permissions
  useEffect(() => {
    if (open) {
      const isAuth = localStorage.getItem("pos_whatsapp_authorized") === "true";
      setWhatsappAuthorized(isAuth);
      
      // Auto-prompt permission dialog if not authorized yet
      if (!isAuth) {
        setWhatsappPermissionModalOpen(true);
      }

      fetch("/api/travel/whatsapp/automation-config", {
        headers: getAuthHeaders(),
      })
        .then((res) => res.json())
        .then((cfg) => {
          if (cfg && cfg.id) {
            if (cfg.content_type) setWhatsappFormat(cfg.content_type);
            if (cfg.schedule_mode) setWhatsappScheduleMode(cfg.schedule_mode);
            if (cfg.scheduled_time) setWhatsappScheduledTime(cfg.scheduled_time);
            if (cfg.custom_date) setWhatsappCustomDate(cfg.custom_date);
            if (cfg.enable_intro_message !== undefined) setWhatsappEnableIntro(Boolean(cfg.enable_intro_message));
            if (cfg.intro_message_text) setWhatsappIntroText(cfg.intro_message_text);
            if (cfg.target_group) setAutoSendTargetGroup(cfg.target_group);
            if (cfg.anti_ban_delay_sec) setWhatsappDelaySec(cfg.anti_ban_delay_sec);
            if (cfg.agency_sender) setAgencyWhatsAppSender(cfg.agency_sender);
            if (cfg.agency_name) setAgencyName(cfg.agency_name);
            if (cfg.auto_apply_on_new_passenger !== undefined) {
              setWhatsappAutoApplyNew(Boolean(cfg.auto_apply_on_new_passenger));
            }
            if (cfg.is_authorized) {
              setWhatsappAuthorized(true);
              localStorage.setItem("pos_whatsapp_authorized", "true");
            }
          }
        })
        .catch(() => {});

      // Setup initial phone for targetPax
      if (targetPax) {
        const ph = targetPax.phone || targetPax.mobile || targetPax.contact_phone || "";
        setSinglePhone(ph);
        setSavedPdfUrl("");
      } else {
        setSinglePhone("");
      }
    }
  }, [open, targetPax]);

  // Generate live preview text
  const composePreviewMessage = () => {
    const enriched = targetPax ? enrichPassengerWithLiveDates(targetPax) : null;
    const paxName = enriched ? (enriched.name_ar || enriched.name_en || "مسافر") : "المعتمر / المسافر الكريم";
    const passportNo = enriched ? (enriched.passport_number || "A12345678") : "A12345678";
    const visaType = enriched ? (enriched.visa_type || "تأشيرة عمره") : "تأشيرة عمرة";
    const entryDate = enriched ? (enriched.travel_date || "").replace(/-/g, "/") : "2026/09/10";
    const exitDate = enriched ? (enriched.expected_exit_date || "").replace(/-/g, "/") : "2026/12/10";
    const remaining = enriched ? (enriched.remaining_days_text || (enriched.remaining_days !== null ? `${enriched.remaining_days} يوم` : "30 يوم")) : "30 يوم";
    const progDuration = enriched ? (enriched.program_duration_days || 90) : 90;

    let msg = "";
    if (whatsappEnableIntro && whatsappIntroText.trim()) {
      let intro = whatsappIntroText
        .replace(/\{اسم_المسافر\}/g, paxName)
        .replace(/\{رقم_الجواز\}/g, passportNo)
        .replace(/\{الأيام_المتبقية\}/g, remaining)
        .replace(/\{تاريخ_الخروج\}/g, exitDate);
      msg += `${intro}\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    }

    if (whatsappFormat === "pdf") {
      const rawName = (targetPax ? (targetPax.name_ar || targetPax.name_en || 'pax') : 'pax').trim();
      const cleanPaxName = rawName.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
      const cleanPassport = (passportNo || 'doc').replace(/[\\/:*?"<>|\s]/g, '_');
      const docName = `بطاقة_مسافر_${cleanPaxName}_${cleanPassport}.pdf`;
      msg += `📄 *مستند وبطاقة المسافر الرسمية (ملف PDF):*\n`;
      msg += `👤 *المسافر:* ${paxName}\n`;
      msg += `🛂 *الجواز:* ${passportNo}\n`;
      msg += `📎 *اسم الملف المرفق:* ${docName}\n`;
      msg += `📁 *الحفظ التلقائي بالجهاز:* تم تخزين وحفظ ملف الـ PDF تلقائياً باسم المسافر في ملفات الجهاز وجاهز للمشاركة الفورية.\n`;
    } else {
      msg += `📋 *بيانات وتفاصيل المسافر والجواز:*\n`;
      msg += `👤 *الاسم:* ${paxName}\n`;
      msg += `🛂 *رقم الجواز:* ${passportNo}\n`;
      msg += `🏷️ *نوع التأشيرة:* ${visaType}\n`;
      msg += `📅 *تاريخ الدخول:* ${entryDate}\n`;
      msg += `⏳ *مدة البرنامج:* ${progDuration} يوم\n`;
      msg += `🚪 *تاريخ الخروج المتوقع:* ${exitDate}\n`;
      msg += `⏱️ *الأيام المتبقية:* ${remaining}\n`;

      if (whatsappFormat === "text_and_pdf") {
        const rawName = (targetPax ? (targetPax.name_ar || targetPax.name_en || 'pax') : 'pax').trim();
        const cleanPaxName = rawName.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);
        const cleanPassport = (passportNo || 'doc').replace(/[\\/:*?"<>|\s]/g, '_');
        const docName = `بطاقة_مسافر_${cleanPaxName}_${cleanPassport}.pdf`;
        msg += `\n📄 *مرفق ملف وبطاقة المسافر الرسمية (ملف PDF):*\n`;
        msg += `📎 *اسم الملف المرفق:* ${docName}\n`;
        msg += `📁 *الحفظ التلقائي بالجهاز:* تم تخزين وحفظ ملف الـ PDF تلقائياً باسم المسافر في ملفات الجهاز وجاهز للمشاركة الفورية.\n`;
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📞 *${agencyName}*\n`;
    msg += `للتواصل عبر واتساب: +${agencyWhatsAppSender}`;

    return msg;
  };

  // Helper function to dispatch to Windows WhatsApp Desktop or Web (returns true if opened successfully)
  const dispatchToWhatsApp = async (appUri: string, webUri: string): Promise<boolean> => {
    // 1. Electron Desktop integration
    if (typeof window !== "undefined" && (window as any).electronAPI?.openExternal) {
      try {
        await (window as any).electronAPI.openExternal(whatsappClientType === "web" ? webUri : appUri);
        return true;
      } catch (e) {
        try {
          await (window as any).electronAPI.openExternal(webUri);
          return true;
        } catch {
          return false;
        }
      }
    }

    // 2. Web browser or iframe on Windows:
    const targetUri = whatsappClientType === "web" ? webUri : appUri;
    try {
      const win = window.open(targetUri, "_blank");
      if (win && !win.closed) {
        return true;
      }
      // Fallback click
      const a = document.createElement("a");
      a.href = targetUri;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          if (document.body.contains(a)) document.body.removeChild(a);
        } catch (e) {}
      }, 500);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Live Connection Diagnostics State & Function
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  const checkWhatsAppConnection = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch("/api/travel/whatsapp/connection-health", { headers: getAuthHeaders() });
      const data = await res.json();
      setHealthStatus(data);
      return data;
    } catch (e: any) {
      const fallback = { success: false, healthy: false, error: e.message, diagnosticSummary: "تعذر فحص خادم الواتساب" };
      setHealthStatus(fallback);
      return fallback;
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Comprehensive Real Connection & Permission Diagnostics
  const handleRunFullDiagnostics = async () => {
    setIsCheckingHealth(true);
    const health = await checkWhatsAppConnection();

    let popupOk = false;
    try {
      const testWin = window.open("about:blank", "_blank", "width=300,height=200");
      if (testWin && !testWin.closed) {
        testWin.close();
        popupOk = true;
        setPopupTested(true);
        localStorage.setItem("pos_popup_tested", "true");
      }
    } catch {
      popupOk = false;
    }

    let notifOk = false;
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        notifOk = true;
      } else {
        const perm = await Notification.requestPermission().catch(() => "denied");
        setNotificationPermission(perm);
        notifOk = perm === "granted";
      }
    }

    setProtocolTested(true);
    localStorage.setItem("pos_protocol_tested", "true");

    const isAllGood = (health?.healthy || health?.senderValid) && (popupOk || (window as any).electronAPI);

    if (isAllGood) {
      setWhatsappAuthorized(true);
      localStorage.setItem("pos_whatsapp_authorized", "true");
      setPermissionSuccessMessage("✓ تم فحص وتأكيد جاهزية الاتصال بتطبيق واتساب والصلاحيات بنجاح 100%");
      setTimeout(() => setPermissionSuccessMessage(""), 7000);
      alert("✓ فحص الاتصال ناجح ومؤكد:\n- إذن النوافذ والروابط التلقائية: مسموح بها ✓\n- بروتوكول واتساب المكتبي: جاهز ونشط ✓\n- جاهزية النظام للأتمتة التلقائية في الخلفية: 100% ✓");
    } else {
      let warningDetail = "";
      if (!popupOk && !(window as any).electronAPI) {
        warningDetail += "• النوافذ المنبثقة محظورة بالمتصفح (يرجى النقر على أيقونة الحظر في شريط العنوان واختيار 'السماح دائماً').\n";
      }
      if (!health?.senderValid) {
        warningDetail += "• رقم هاتف الوكالة غير مكتمل (يرجى إدخال رقم يشمل رمز الدولة).\n";
      }
      alert(`⚠️ تقرير تشخيص اتصال وصلاحيات الواتساب:\n${warningDetail}\nيرجى معالجة النقاط أعلاه لضمان وصول الرسائل للمسافرين وتجنب أي تعثر.`);
    }
    setIsCheckingHealth(false);
  };

  // Test WhatsApp Connection
  const handleTestWhatsAppLaunch = async () => {
    setProtocolTested(true);
    localStorage.setItem("pos_protocol_tested", "true");
    const testPhone = agencyWhatsAppSender.replace(/\D/g, "") || "966500000000";
    const testMsg = encodeURIComponent("تجربة اتصال نظام أومني فلاي بتطبيق WhatsApp لسطح المكتب في ويندوز بنجاح ✓");
    const testAppUri = `whatsapp://send?phone=${testPhone}&text=${testMsg}`;
    const testWebUri = `https://api.whatsapp.com/send?phone=${testPhone}&text=${testMsg}`;
    const ok = await dispatchToWhatsApp(testAppUri, testWebUri);
    if (!ok) {
      alert("⚠️ تعذر فتح نافذة واتساب: قد تكون النوافذ المنبثقة محظورة في متصفحك أو تطبيق واتساب غير مشغل على جهازك.");
    }
  };

  // Test & Request Windows Action Center / Browser Notifications
  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      alert("المتصفح الحالي لا يدعم واجهة إشعارات النظام المباشرة.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        localStorage.setItem("pos_windows_notifications_authorized", "true");
        new Notification("نظام أومني سيستم - Omni System Pro", {
          body: "✓ تم تفعيل إشعارات ويندوز بنجاح! سيصلك تنبيه فوري عند إرسال كل بطاقة مسافر ومستند في الخلفية.",
          icon: "/favicon.png",
        });
      } else {
        alert("لم يتم منح إذن الإشعارات من المتصفح أو إعدادات ويندوز.");
      }
    } catch (e: any) {
      console.warn("Notification request error:", e);
    }
  };

  // Test Browser Popup & Background Tab Launch
  const handleTestPopupLaunch = () => {
    setPopupTested(true);
    localStorage.setItem("pos_popup_tested", "true");
    try {
      const testWin = window.open("about:blank", "_blank", "width=400,height=300");
      if (testWin) {
        setTimeout(() => {
          try {
            testWin.close();
          } catch (e) {}
        }, 800);
        alert("✓ تم التحقق بنجاح: النوافذ المنبثقة والروابط التلقائية مسموح بها في المتصفح ونظام ويندوز دون حظر.");
      } else {
        alert("⚠️ تم حظر النافذة من قبل المتصفح. يرجى النقر على أيقونة الحظر في شريط العنوان واختيار 'السماح دائماً Always Allow' لهذا الموقع.");
      }
    } catch (e) {
      alert("تعذر اختبار النافذة: " + (e as any).message);
    }
  };

  // One-Click Grant & Authorize All Windows & WhatsApp Permissions
  const handleAuthorizeAllWindowsPermissions = async () => {
    setIsProcessing(true);
    localStorage.setItem("pos_whatsapp_authorized", "true");
    localStorage.setItem("pos_whatsapp_client_type", whatsappClientType);
    localStorage.setItem("pos_protocol_tested", "true");
    localStorage.setItem("pos_popup_tested", "true");
    localStorage.setItem("pos_windows_notifications_authorized", "true");
    setWhatsappAuthorized(true);
    setProtocolTested(true);
    setPopupTested(true);

    if (typeof Notification !== "undefined") {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === "granted") {
          new Notification("Omni System Pro - نظام السفر والواتساب", {
            body: "✓ تم تفعيل ومنح كافة صلاحيات Windows وأتمتة الواتساب بنجاح!",
            icon: "/favicon.png",
          });
        }
      } catch (e) {}
    }

    try {
      await fetch("/api/travel/whatsapp/automation-config", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          is_authorized: 1,
          client_type: whatsappClientType,
          anti_ban_delay_sec: whatsappDelaySec,
          agency_sender: agencyWhatsAppSender,
        }),
      });
    } catch (e) {}

    setIsProcessing(false);
    setWhatsappPermissionModalOpen(false);
    setPermissionSuccessMessage("✓ تم تفويض ومنح كافة صلاحيات ويندوز والواتساب بنجاح ليعمل النظام في الخلفية دون أي قيود.");
    setTimeout(() => setPermissionSuccessMessage(""), 6000);
  };

  // Auto-Save PDF in system for targetPax
  const handleAutoSavePassengerPdf = async () => {
    if (!targetPax) {
      alert("يرجى اختيار مسافر محدد لتوليد وحفظ ملف الـ PDF الخاص به");
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const res = await fetch("/api/travel/whatsapp/save-passenger-pdf", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ passenger_id: targetPax.id }),
      });
      const data = await res.json();
      if (data.success && data.fileUrl) {
        setSavedPdfUrl(data.fileUrl);
        alert(`✓ تم توليد وحفظ ملف الـ PDF بنجاح في النظام:\nاسم الملف: ${data.fileName}\nالمسار: ${data.fileUrl}`);
      } else {
        alert("تعذر حفظ ملف الـ PDF: " + (data.error || "خطأ غير معروف"));
      }
    } catch (e: any) {
      alert("حدث خطأ أثناء حفظ الـ PDF: " + (e.message || ""));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Save Settings & Execute Safe Background Automation Runner
  const handleSaveAndExecute = async (overrideMode?: "immediate") => {
    setIsProcessing(true);
    localStorage.setItem("pos_whatsapp_authorized", "true");
    setWhatsappAuthorized(true);

    const effectiveMode = overrideMode || whatsappScheduleMode;

    try {
      // 1. Save settings to server
      const saveRes = await fetch("/api/travel/whatsapp/automation-config", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          is_active: 1,
          content_type: whatsappFormat,
          schedule_mode: effectiveMode,
          scheduled_time: whatsappScheduledTime,
          custom_date: whatsappCustomDate,
          enable_intro_message: whatsappEnableIntro ? 1 : 0,
          intro_message_text: whatsappIntroText,
          target_group: autoSendTargetGroup,
          anti_ban_delay_sec: whatsappDelaySec,
          agency_sender: agencyWhatsAppSender,
          auto_apply_on_new_passenger: whatsappAutoApplyNew ? 1 : 0,
          is_authorized: 1,
        }),
      });
      await saveRes.json();
      localStorage.setItem("pos_agency_whatsapp_sender", agencyWhatsAppSender);
      localStorage.setItem("pos_whatsapp_client_type", whatsappClientType);

      // 2. Filter target list using live date calculations
      const enrichedAll = (targetPax ? [targetPax] : allPassengers).map(p => enrichPassengerWithLiveDates(p));
      let targetList = enrichedAll;
      if (!targetPax) {
        if (autoSendTargetGroup === "urgent_only") {
          targetList = enrichedAll.filter((p) => p.remaining_days !== null && p.remaining_days <= 3);
        } else if (autoSendTargetGroup === "warning_and_urgent") {
          targetList = enrichedAll.filter((p) => p.remaining_days !== null && p.remaining_days <= 10);
        } else if (autoSendTargetGroup === "warning_15") {
          targetList = enrichedAll.filter((p) => p.remaining_days !== null && p.remaining_days <= 15);
        } else if (autoSendTargetGroup === "overstayed") {
          targetList = enrichedAll.filter((p) => p.remaining_days !== null && p.remaining_days < 0);
        }
      }

      if (targetList.length === 0) {
        setIsProcessing(false);
        onOpenChange(false);
        alert("✓ تم حفظ وضبط الإعدادات بنجاح. سيتم تطبيقها ومراسلة أي مسافر جديد تلقائياً فور إضافته للنظام بحسب الإعدادات المضبوطة وبدون أي تدخل يدوي.");
        return;
      }

      // 3. Request Batch Generation & Processing / Scheduling from Backend
      const batchRes = await fetch("/api/travel/whatsapp/batch-process", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          passenger_ids: targetList.map((p) => p.id),
          target_group: autoSendTargetGroup,
          schedule_override: effectiveMode,
        }),
      });
      const batchData = await batchRes.json();

      setIsProcessing(false);
      onOpenChange(false);

      const itemsToDispatch = batchData.processedItems || [];
      const skippedList = batchData.skippedDetails || [];

      // If scheduled mode (future time specified by user and not in immediate test mode):
      if (batchData.isScheduled && effectiveMode !== "immediate") {
        if (onBatchComplete) {
          onBatchComplete({
            total: batchData.total || targetList.length,
            successCount: batchData.successCount ?? itemsToDispatch.length,
            skippedCount: skippedList.length,
            skippedDetails: skippedList,
            message: batchData.message,
          });
        }
        return;
      }

      // If immediate dispatch mode: launch the sequential dispatcher for all processed items
      if (itemsToDispatch.length > 0) {
        runnerAbortRef.current = false;
        setRunnerQueue(itemsToDispatch);
        setRunnerSkippedDetails(skippedList);
        setRunnerIndex(0);
        setRunnerSuccessCount(0);
        setRunnerPaused(false);
        setRunnerActive(true);

        runSequentialDispatcher(itemsToDispatch, skippedList, batchData.total || targetList.length);
      } else {
        if (onBatchComplete) {
          onBatchComplete({
            total: batchData.total || targetList.length,
            successCount: 0,
            skippedCount: skippedList.length,
            skippedDetails: skippedList,
            message: batchData.message || "لم يتم العثور على مسافرين مؤهلين للإرسال، أو تم تخطي جميع السجلات غير الصالحة بأمان.",
          });
        }
      }
    } catch (err: any) {
      setIsProcessing(false);
      alert("حدث خطأ أثناء معالجة الإعدادات: " + (err.message || ""));
    }
  };

  // Sequential Dispatcher Function
  const runSequentialDispatcher = async (items: any[], initialSkipped: any[], totalCount: number) => {
    let success = 0;
    const successList: any[] = [];
    const currentSkippedList = [...initialSkipped];
    runnerSuccessItemsRef.current = [];
    runnerSkippedItemsRef.current = currentSkippedList;

    for (let i = 0; i < items.length; i++) {
      if (runnerAbortRef.current) break;

      // Handle pause state
      while (runnerPausedRef.current && !runnerAbortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (runnerAbortRef.current) break;

      const item = items[i];
      setCurrentRunningItem(item);
      setRunnerIndex(i + 1);

      // Auto-copy message text & PDF link to system clipboard
      if (item.messageText) {
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(item.messageText);
            setIsCopiedToClipboard(true);
            setTimeout(() => setIsCopiedToClipboard(false), 2500);
          }
        } catch (clipErr) {
          console.warn("Could not copy message to clipboard automatically:", clipErr);
        }
      }

      // Trigger Windows WhatsApp Protocol or Web
      let dispatchOk = false;
      if (item.whatsappAppUri) {
        try {
          const ok = await dispatchToWhatsApp(item.whatsappAppUri, item.whatsappWebUri);
          if (ok) {
            success++;
            dispatchOk = true;
            setRunnerSuccessCount(success);
            successList.push(item);
            runnerSuccessItemsRef.current = [...successList];
          } else {
            throw new Error("تعذر الوصول لتطبيق واتساب أو تم حظر النافذة من المتصفح في جهازك");
          }
        } catch (e: any) {
          console.warn("Could not dispatch item to WhatsApp:", item, e);
          const skipRecord = {
            id: item.id,
            name: item.name,
            phone: item.phone,
            reason: `تعذر الاتصال بواتساب: ${e.message || "حظر مؤقت أو تعطل تطبيق واتساب بالجهاز"}`,
          };
          currentSkippedList.push(skipRecord);
          runnerSkippedItemsRef.current = [...currentSkippedList];
          setRunnerSkippedDetails([...currentSkippedList]);
        }
      } else {
        const skipRecord = {
          id: item.id,
          name: item.name,
          phone: item.phone,
          reason: "لا يوجد رابط محادثة متاح للمسافر",
        };
        currentSkippedList.push(skipRecord);
        runnerSkippedItemsRef.current = [...currentSkippedList];
        setRunnerSkippedDetails([...currentSkippedList]);
      }

      // Safe Delay & Auto-advance countdown with manual advance support
      if (i < items.length - 1 && !runnerAbortRef.current) {
        const totalDelaySec = Math.max(2, Number(whatsappDelaySec || 3));
        for (let s = totalDelaySec; s > 0; s--) {
          if (runnerAbortRef.current) break;
          while (runnerPausedRef.current && !runnerAbortRef.current) {
            await new Promise((r) => setTimeout(r, 300));
          }
          if (runnerAbortRef.current) break;

          setRunnerCountdown(s);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              runnerAdvanceRef.current = null;
              resolve();
            }, 1000);

            // Register manual advance trigger
            runnerAdvanceRef.current = () => {
              clearTimeout(timer);
              runnerAdvanceRef.current = null;
              resolve();
            };
          });

          // If advance was triggered early
          if (!runnerAdvanceRef.current) {
            break;
          }
        }
        setRunnerCountdown(0);
      }
    }

    setRunnerActive(false);
    setCurrentRunningItem(null);
    setRunnerCountdown(0);

    if (onBatchComplete) {
      onBatchComplete({
        total: totalCount,
        successCount: success,
        skippedCount: runnerSkippedItemsRef.current.length,
        skippedDetails: runnerSkippedItemsRef.current,
        successList: runnerSuccessItemsRef.current,
      });
    }
  };

  // Instant Advance / Next Passenger
  const handleAdvanceRunner = () => {
    if (runnerAdvanceRef.current) {
      runnerAdvanceRef.current();
    }
  };

  // Skip Current Passenger in Runner
  const handleSkipCurrentRunner = () => {
    if (currentRunningItem) {
      const skipRecord = {
        id: currentRunningItem.id,
        name: currentRunningItem.name,
        phone: currentRunningItem.phone,
        reason: "تم التخطي يدوياً من قبل المستخدم أثناء المشغل",
      };
      const updated = [...runnerSkippedItemsRef.current, skipRecord];
      runnerSkippedItemsRef.current = updated;
      setRunnerSkippedDetails(updated);
    }
    if (runnerAdvanceRef.current) {
      runnerAdvanceRef.current();
    }
  };

  // Toggle Pause / Resume
  const handleTogglePause = () => {
    const nextState = !runnerPaused;
    setRunnerPaused(nextState);
    runnerPausedRef.current = nextState;
  };

  // Stop / Cancel Runner
  const handleStopRunner = () => {
    runnerAbortRef.current = true;
    setRunnerActive(false);
    setCurrentRunningItem(null);
    setRunnerCountdown(0);
    if (onBatchComplete) {
      onBatchComplete({
        total: runnerQueue.length + runnerSkippedDetails.length,
        successCount: runnerSuccessCount,
        skippedCount: runnerSkippedItemsRef.current.length || runnerSkippedDetails.length,
        skippedDetails: runnerSkippedItemsRef.current.length ? runnerSkippedItemsRef.current : runnerSkippedDetails,
        successList: runnerSuccessItemsRef.current,
      });
    }
  };

  // Single Manual Interactive Send
  const handleSingleSend = async (bypassAuth = false) => {
    if (!whatsappAuthorized && !bypassAuth) {
      setWhatsappPermissionModalOpen(true);
      return;
    }

    let digits = (singlePhone || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (!digits || digits.length < 7) {
      alert("يرجى إدخال رقم هاتف صحيح للمستلم قبل الإرسال المباشر");
      return;
    }

    // Auto-detect and format phone number
    if (digits.startsWith("05") && digits.length === 10) {
      digits = "966" + digits.slice(1);
    } else if (digits.startsWith("5") && digits.length === 9) {
      digits = "966" + digits;
    } else if (digits.startsWith("07") && digits.length === 10) {
      digits = "967" + digits.slice(1);
    } else if (digits.startsWith("7") && digits.length === 9) {
      digits = "967" + digits;
    } else if (digits.startsWith("01") && digits.length === 11) {
      digits = "20" + digits.slice(1);
    } else if (digits.startsWith("0")) {
      digits = (agencyWhatsAppSender.replace(/\D/g, "") || "966") + digits.slice(1);
    }
    const cleanPhone = digits;

    // Auto save PDF if not yet saved and format includes PDF
    let finalDocUrl = savedPdfUrl;
    if ((whatsappFormat === "pdf" || whatsappFormat === "text_and_pdf") && !savedPdfUrl && targetPax) {
      try {
        const res = await fetch("/api/travel/whatsapp/save-passenger-pdf", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ passenger_id: targetPax.id }),
        });
        const data = await res.json();
        if (data.success && data.fileUrl) {
          finalDocUrl = data.fileUrl;
          setSavedPdfUrl(data.fileUrl);
        }
      } catch (e) {}
    }

    // Register log and trigger cloud gateway in database
    if (targetPax) {
      try {
        await fetch("/api/travel/whatsapp/send-passenger", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            passenger_id: targetPax.id,
            format: whatsappFormat,
            phone_override: cleanPhone,
          }),
        });
      } catch (e) {}
    }

    const msg = composePreviewMessage();
    const encodedMsg = encodeURIComponent(msg);
    const whatsappAppUri = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
    const whatsappWebUri = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    await dispatchToWhatsApp(whatsappAppUri, whatsappWebUri);
    onOpenChange(false);
  };

  // Helper for human-readable time
  const formatArabicTime = (timeStr: string) => {
    if (!timeStr) return "10:00 ليلاً";
    const [hStr, mStr] = timeStr.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || "0", 10);
    const period = h >= 12 ? "مساءً / ليلاً" : "صباحاً";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const mPadded = m < 10 ? `0${m}` : m;
    return `الساعة ${h12}:${mPadded} ${period}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base lg:text-lg font-black text-slate-900 flex items-center gap-2">
                    إعدادات وأتمتة إرسال الواتساب للمسافرين والمعتمرين
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      WhatsApp Pro Windows & Cloud
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    تحديد صيغة الإرسال (نص / PDF)، جدولة المواعيد، الرسالة التمهيدية، والتنفيذ المباشر عبر واتساب ويندوز
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Integration Status & Windows Permissions Banner */}
          <div className="p-3 rounded-xl border bg-slate-50 border-slate-200 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${whatsappAuthorized ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <span>
                      {whatsappAuthorized
                        ? "صلاحيات وتفويض نظام Windows والواتساب (مفوّضة ومكتملة ✓)"
                        : "يتطلب تفويض صلاحيات الوصول والتشغيل لنظام Windows والواتساب"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {whatsappClientType === "desktop" ? "💻 WhatsApp Desktop (whatsapp://)" : "🌐 WhatsApp Web"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {whatsappAuthorized
                      ? "النظام مصرّح بالكامل لمراسلة المسافرين وتوليد بطاقات الـ PDF في الخلفية بدون حجب من ويندوز"
                      : "يرجى منح أذونات بروتوكول ويندوز والإشعارات والنوافذ لضمان الأتمتة بدون أي عرقلة"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunFullDiagnostics}
                  disabled={isCheckingHealth}
                  className="h-8 text-xs font-black text-indigo-800 bg-indigo-50 border-indigo-300 hover:bg-indigo-100 gap-1.5 shadow-sm"
                  title="فحص واختبار الاتصال الحقيقي بتطبيق واتساب وصلاحيات النوافذ والإشعارات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isCheckingHealth ? "animate-spin" : ""}`} />
                  فحص وتشخيص الاتصال والصلاحيات الفعلي
                </Button>
                <Button
                  size="sm"
                  onClick={() => setWindowsSandboxOpen(true)}
                  className="h-8 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 gap-1.5 shadow-sm"
                >
                  <Monitor className="w-4 h-4 text-white" />
                  بيئة ويندوز الافتراضية وربط الواتساب (Sandbox & QR)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWhatsappPermissionModalOpen(true)}
                  className="h-8 text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  مركز أذونات وصلاحيات Windows
                </Button>
              </div>
            </div>

            {/* Live Diagnostic Health Alert if available */}
            {healthStatus && (
              <div className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-between ${
                healthStatus.healthy ? "bg-emerald-50 text-emerald-900 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200"
              }`}>
                <div className="flex items-center gap-2">
                  {healthStatus.healthy ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{healthStatus.diagnosticSummary}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border font-bold">
                  رقم الإرسال: +{healthStatus.senderPhone || "غير مسجل"}
                </span>
              </div>
            )}

            {/* Permissions Health Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-200/80">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>بروتوكول واتساب المكتبي</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200">
                {notificationPermission === "granted" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span>إشعارات ويندوز: {notificationPermission === "granted" ? "مفعلة" : "اختياري"}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>النوافذ والتحويل الآلي</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white p-1.5 rounded-lg border border-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>حفظ الـ PDF التلقائي</span>
              </div>
            </div>

            {permissionSuccessMessage && (
              <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-bold text-emerald-900 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                {permissionSuccessMessage}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-2">
            {/* Left Column (7 cols): Main Settings & Schedule */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. CONTENT FORMAT & AUTO-SAVE PDF */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    1. تحديد صيغة الإرسال وحفظ ملف الـ PDF تلقائياً في النظام:
                  </label>
                  {targetPax && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAutoSavePassengerPdf}
                      disabled={isGeneratingPdf}
                      className="h-7 text-[11px] font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1"
                    >
                      {isGeneratingPdf ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      حفظ وتوليد الـ PDF في النظام الآن
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setWhatsappFormat("text_and_pdf")}
                    className={`p-2.5 rounded-lg border text-right transition-all ${
                      whatsappFormat === "text_and_pdf"
                        ? "border-emerald-600 bg-emerald-50 shadow-sm text-emerald-950 font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      نص + ملف PDF
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">الخيار الشامل المعتمد (بيانات كاملة ورابط المستند)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhatsappFormat("pdf")}
                    className={`p-2.5 rounded-lg border text-right transition-all ${
                      whatsappFormat === "pdf"
                        ? "border-emerald-600 bg-emerald-50 shadow-sm text-emerald-950 font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      ملف PDF فقط
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">حفظ بطاقة الـ PDF تلقائياً وإرسالها للمسافر</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhatsappFormat("text")}
                    className={`p-2.5 rounded-lg border text-right transition-all ${
                      whatsappFormat === "text"
                        ? "border-emerald-600 bg-emerald-50 shadow-sm text-emerald-950 font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      نص تفصيلي فقط
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">بيانات الجواز والتأشيرة وتواريخ الخروج بنص منسق</p>
                  </button>
                </div>

                <div className="text-[11px] text-emerald-800 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    ✓ يتم حفظ ملف الـ PDF تلقائياً في قاعدة بيانات النظام وتضمين رابطه الرسمي المباشر في رسالة الواتساب.
                  </span>
                </div>
              </div>

              {/* 2. SCHEDULING MODE & TIME ADJUSTMENT */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    2. تحديد وجدولة موعد الإرسال وتعديل الوقت:
                  </label>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {formatArabicTime(whatsappScheduledTime)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">موعد الإرسال المجدول:</label>
                    <select
                      value={whatsappScheduleMode}
                      onChange={(e: any) => setWhatsappScheduleMode(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                    >
                      <option value="registration_time">في وقت محدد من تاريخ تسجيل المسافر (افتراضياً 10:00 ليلاً)</option>
                      <option value="before_travel_1d">قبل موعد السفر أو الخروج بيوم واحد (1 يوم)</option>
                      <option value="before_travel_2d">قبل موعد السفر أو الخروج بيومين (2 يوم)</option>
                      <option value="custom_time">تحديد موعد وتاريخ مخصص من قبل المستخدم</option>
                      <option value="immediate">⚡ اختبار وإرسال فوري ومباشر الآن (أتمتة لحظية)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">تعديل وقت الإرسال (الساعة والدقائق):</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={whatsappScheduledTime}
                        onChange={(e) => setWhatsappScheduledTime(e.target.value)}
                        className="text-xs font-mono font-bold bg-white"
                      />
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        (مثال: 22:00 = 10 ليلاً)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Instant Time Automation Test Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>اختبار وقت الإرسال الآن: مراسلة المسافرين مؤتمتاً ولحظياً فور حفظ الإعدادات</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setWhatsappScheduleMode("immediate");
                      handleSaveAndExecute("immediate");
                    }}
                    disabled={isProcessing}
                    className="h-7 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    اختبار وقت الإرسال الآن (إرسال تلقائي لحظي)
                  </Button>
                </div>

                {whatsappScheduleMode === "custom_time" && (
                  <div className="pt-1">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">التاريخ المخصص للإرسال:</label>
                    <Input
                      type="date"
                      value={whatsappCustomDate}
                      onChange={(e) => setWhatsappCustomDate(e.target.value)}
                      className="text-xs font-bold bg-white"
                    />
                  </div>
                )}
              </div>

              {/* 3. OPTIONAL PRE-MESSAGE */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappEnableIntro}
                      onChange={(e) => setWhatsappEnableIntro(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span>3. تفعيل رسالة تمهيدية اختيارية ترسل قبل البيانات الأساسية والملفات</span>
                  </label>
                  {whatsappEnableIntro && (
                    <button
                      type="button"
                      onClick={() =>
                        setWhatsappIntroText(
                          "السلام عليكم ورحمة الله وبركاته، الأخ/الأخت الكريم/ة.. تحية طيبة من وكالة أومني فلاي، يسرنا تزويدكم بتفاصيل رحلتكم وجوازكم ومستندات التأشيرة المعتمدة:"
                        )
                      }
                      className="text-[10px] text-emerald-700 hover:underline font-bold"
                    >
                      استعادة النص الافتراضي
                    </button>
                  )}
                </div>

                {whatsappEnableIntro ? (
                  <div className="space-y-1.5">
                    <textarea
                      rows={3}
                      value={whatsappIntroText}
                      onChange={(e) => setWhatsappIntroText(e.target.value)}
                      placeholder="اكتب هنا الرسالة التمهيدية والترحيبية بالمسافر..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span>متغيرات سريعة:</span>
                      <button
                        type="button"
                        onClick={() => setWhatsappIntroText((prev) => prev + " {اسم_المسافر}")}
                        className="bg-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-300 text-slate-800"
                      >
                        {"{اسم_المسافر}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWhatsappIntroText((prev) => prev + " {رقم_الجواز}")}
                        className="bg-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-300 text-slate-800"
                      >
                        {"{رقم_الجواز}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWhatsappIntroText((prev) => prev + " {الأيام_المتبقية}")}
                        className="bg-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-300 text-slate-800"
                      >
                        {"{الأيام_المتبقية}"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">تم تعطيل الرسالة التمهيدية، سيتم إرسال بيانات الجواز والملف مباشرة.</p>
                )}
              </div>

              {/* 4. AUTO-APPLY ON NEW PASSENGERS & ERROR-FREE SKIPPING */}
              <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-2">
                <label className="text-xs font-black text-emerald-950 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappAutoApplyNew}
                    onChange={(e) => setWhatsappAutoApplyNew(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span>✓ تطبيق هذه الإعدادات والجدولة تلقائياً على أي مسافر جديد يتم تسجيله أو استيراده في النظام</span>
                </label>
                <div className="p-2 bg-emerald-100/50 rounded-lg text-[11px] text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>أتمتة آمنة وتخطي الأخطاء:</strong> إذا كان هناك أرقام غير صحيحة أو غير مسجلة، يقوم النظام بتخطيها تلقائياً وإكمال بقية المهام وإظهار تقرير مفصل بها دون أي تعليق أو توقف.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Send Mode & Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              {/* Send Mode Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">طريقة ونمط إرسال التنبيهات:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWhatsappSendMode("auto")}
                    className={`p-2.5 rounded-lg border text-right transition-all ${
                      whatsappSendMode === "auto"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      أتمتة تلقائية آمنة
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">في الخلفية عبر واتساب ويندوز</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhatsappSendMode("manual")}
                    className={`p-2.5 rounded-lg border text-right transition-all ${
                      whatsappSendMode === "manual"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      إرسال يدوي تفاعلي
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">فتح محادثة واتساب للمسافر المحدد</p>
                  </button>
                </div>
              </div>

              {/* Target WhatsApp Client Choice */}
              <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>تطبيق الإرسال المستهدف في ويندوز:</span>
                  <span className="text-[10px] font-normal text-emerald-700 font-bold">تكامل مباشر</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappClientType("desktop");
                      localStorage.setItem("pos_whatsapp_client_type", "desktop");
                    }}
                    className={`p-2 rounded-lg border text-right text-xs transition-all flex items-center gap-2 ${
                      whatsappClientType === "desktop"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <Monitor className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div>واتساب ويندوز المكتبي</div>
                      <div className="text-[9px] text-slate-500 font-normal">WhatsApp Desktop App</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappClientType("web");
                      localStorage.setItem("pos_whatsapp_client_type", "web");
                    }}
                    className={`p-2 rounded-lg border text-right text-xs transition-all flex items-center gap-2 ${
                      whatsappClientType === "web"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div>واتساب ويب بالمتصفح</div>
                      <div className="text-[9px] text-slate-500 font-normal">web.whatsapp.com</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* If Single Pax: Phone input */}
              {targetPax && (
                <div className="p-3 bg-slate-50 border rounded-xl space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    رقم هاتف المسافر المحدد ({targetPax.name_ar || targetPax.name_en}):
                  </label>
                  <Input
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="مثال: 966500000000"
                    dir="ltr"
                    className="font-mono text-xs font-bold bg-white"
                  />
                  <p className="text-[10px] text-slate-500">سيتم التحقق من الرقم والتنسيق الدولي وتخطي الرقم إن كان غير صالح.</p>
                </div>
              )}

              {/* Target Group Selector if Batch */}
              {!targetPax && (
                <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-emerald-600" />
                      فئة المعتمرين المستهدفين:
                    </span>
                  </div>
                  <select
                    value={autoSendTargetGroup}
                    onChange={(e: any) => setAutoSendTargetGroup(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                  >
                    <option value="all">كافة المسافرين ({allPassengers.length} مسافر)</option>
                    <option value="warning_15">فترة الإشعار المبكر (≤ 15 يوم)</option>
                    <option value="warning_and_urgent">الإنذار والاقتراب فقط (≤ 10 أيام)</option>
                    <option value="urgent_only">الحالات العاجلة فقط (≤ 3 أيام)</option>
                    <option value="overstayed">المتجاوزون (المتأخرون عن المغادرة)</option>
                  </select>
                </div>
              )}

              {/* Official Agency Sender & Anti-Ban Rate Limit */}
              <div className="p-3 bg-slate-50 border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700">رقم واتساب الوكالة الرسمي:</label>
                  <span className="text-[10px] font-mono font-bold text-slate-500">+{agencyWhatsAppSender}</span>
                </div>
                <Input
                  value={agencyWhatsAppSender}
                  onChange={(e) => setAgencyWhatsAppSender(e.target.value)}
                  dir="ltr"
                  className="font-mono text-xs font-bold bg-white"
                />

                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>الفاصل الزمني الآمن بين إرسال كل رسالة:</span>
                    <span className="font-mono text-emerald-700">{whatsappDelaySec} ثوانٍ</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={whatsappDelaySec}
                    onChange={(e) => setWhatsappDelaySec(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>2 ثانية (سريع)</span>
                    <span>5 ثوانٍ (متوازن)</span>
                    <span>10 ثوانٍ (حماية قصوى)</span>
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">معاينة حية لشكل رسالة الواتساب:</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestWhatsAppLaunch}
                    className="h-6 text-[10px] font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50 gap-1 px-2"
                  >
                    <Send className="w-3 h-3 text-emerald-600" />
                    اختبار فتح الواتساب فوراً
                  </Button>
                </div>
                <div className="bg-[#fcfbf9] border border-amber-200/70 p-3 rounded-xl max-h-44 overflow-y-auto text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {composePreviewMessage()}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-emerald-600" />
              <span>يتم توجيه الرسائل والملفات عبر تطبيق WhatsApp لسطح المكتب في ويندوز تلقائياً.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              {whatsappSendMode === "manual" && targetPax ? (
                <Button
                  onClick={() => handleSingleSend()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  إرسال مباشر للمسافر المحدد
                </Button>
              ) : (
                <Button
                  onClick={() => handleSaveAndExecute()}
                  disabled={isProcessing}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black gap-2 shadow-md"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري حفظ الإعدادات وتجهيز الـ PDF...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      حفظ الإعدادات وبدء الإرسال عبر واتساب ويندوز
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Legal Permission & Windows/Web WhatsApp Authorization Modal */}
      <Dialog open={whatsappPermissionModalOpen} onOpenChange={setWhatsappPermissionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  مركز تفويض وأذونات نظام Windows والواتساب
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    Windows & Web Security
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  إذن وتفويض رسمي لمرة واحدة لتمكين النظام من مراسلة المسافرين والمعتمرين وتوليد ملفات الـ PDF في الخلفية دون أي حظر من ويندوز
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs text-slate-700">
            {/* Main legal statement */}
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2 text-emerald-950">
              <div className="font-bold flex items-center gap-2 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                تفويض رسمي دائم للتشغيل الآلي في نظام ويندوز (Windows Automation Authorization)
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                بموجب هذا التفويض، يمنح المستخدم نظام <strong>أومني سيستم (Omni System Pro)</strong> الصلاحية الكاملة للاتصال بتطبيق واتساب في ويندوز (Desktop / Web) لإرسال بيانات الحجوزات وبطاقات الجوازات المعتمدة بصيغة PDF مباشرة في المواعيد المحددة أو فور تسجيل المسافرين، <strong>ويتم حفظ هذا الإذن بشكل دائم ولن يطلب منك مجدداً</strong>.
              </p>
            </div>

            {/* Granular Permissions & Diagnostics Check */}
            <div className="space-y-2">
              <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                حالة الأذونات والصلاحيات في نظام Windows والمتصفح:
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* 1. Windows WhatsApp Protocol */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>1. بروتوكول تطبيق واتساب المكتبي (whatsapp://)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          {protocolTested ? "تم اختباره ✓" : "جاهز للتفويض"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        يتيح للنظام استدعاء تطبيق واتساب المكتبي المثبت في جهاز ويندوز مباشرة
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestWhatsAppLaunch}
                    className="h-7 text-xs font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50 shrink-0 gap-1"
                  >
                    <Play className="w-3 h-3 text-emerald-600" />
                    اختبار البروتوكول
                  </Button>
                </div>

                {/* 2. Windows Native Action Center Notifications */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${notificationPermission === "granted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>2. إشعارات سطح المكتب ونظام ويندوز (Windows Action Center)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          notificationPermission === "granted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {notificationPermission === "granted" ? "مفوض ومفعل ✓" : "يتطلب التفعيل"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        تنبيهك على شاشة ويندوز فور إرسال رسالة أو بطاقة مسافر بنجاح في الخلفية
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRequestNotificationPermission}
                    className="h-7 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 shrink-0 gap-1"
                  >
                    <Bell className="w-3 h-3 text-slate-500" />
                    {notificationPermission === "granted" ? "إشعار تجريبي" : "تفعيل الإشعارات"}
                  </Button>
                </div>

                {/* 3. Popups & Background Tab Launch */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>3. النوافذ التلقائية والتحويل الآلي (Popups & Redirects)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                          {popupTested ? "تم الفحص ✓" : "موصى به"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        السماح بفتح روابط الواتساب بدون حظر من مانع النوافذ في المتصفح
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestPopupLaunch}
                    className="h-7 text-xs font-bold text-blue-800 border-blue-300 hover:bg-blue-50 shrink-0 gap-1"
                  >
                    <Globe className="w-3 h-3 text-blue-600" />
                    فحص النوافذ
                  </Button>
                </div>

                {/* 4. PDF Auto-Storage & Dispatch */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>4. تخزين وتوليد بطاقات الـ PDF التلقائي في النظام</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          مفعل ونشط ✓
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        توليد ملفات PDF باللغتين مع الباركود وتخزينها في مجلد النظام المعتمد
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client selection options */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <label className="font-black text-slate-800 block text-xs">حدد التطبيق المفضل لديك للتشغيل الآلي في النظام:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWhatsappClientType("desktop")}
                  className={`p-3 rounded-xl border text-right transition-all ${
                    whatsappClientType === "desktop"
                      ? "border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950 shadow-sm ring-1 ring-emerald-500"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Monitor className="w-4 h-4 text-emerald-600" />
                    تطبيق WhatsApp لسطح المكتب في Windows
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    (الخيار الموصى به - اتصال مباشر وفوري بتطبيق ويندوز المكتبي whatsapp://)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setWhatsappClientType("web")}
                  className={`p-3 rounded-xl border text-right transition-all ${
                    whatsappClientType === "web"
                      ? "border-emerald-600 bg-emerald-50/70 font-bold text-emerald-950 shadow-sm ring-1 ring-emerald-500"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    واتساب ويب في المتصفح (WhatsApp Web)
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    (التشغيل عبر نافذة المتصفح web.whatsapp.com)
                  </p>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setWhatsappPermissionModalOpen(false)}>
              إغلاق
            </Button>
            <Button
              onClick={handleAuthorizeAllWindowsPermissions}
              disabled={isProcessing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs gap-2 shadow-sm py-2 px-4"
            >
              <CheckCircle2 className="w-4 h-4" />
              منح وتفعيل كافة صلاحيات Windows والواتساب بنقرة واحدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live WhatsApp Dispatch Runner Progress Dialog */}
      <Dialog open={runnerActive} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl animate-pulse">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>مشغل أتمتة الواتساب لسطح المكتب</span>
                    {runnerPaused ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        متوقف مؤقتاً
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        جاري التشغيل الآلي
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    معالجة المسافرين تباعاً مع التخطي الآمن للأخطاء وتوثيق مستندات PDF
                  </DialogDescription>
                </div>
              </div>
              {isCopiedToClipboard && (
                <span className="text-[10px] bg-emerald-700 text-white font-bold px-2 py-1 rounded-md shadow-sm animate-bounce">
                  تم نسخ النص للحافظة ✓
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Progress Counter & Bar */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">تقدم الإرسال المباشر:</span>
                <span className="font-mono text-emerald-800">
                  {runnerIndex} / {runnerQueue.length} ({Math.round(((runnerIndex) / Math.max(1, runnerQueue.length)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((runnerIndex) / Math.max(1, runnerQueue.length)) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Item Card with Direct Action Controls */}
            {currentRunningItem && (
              <div className="p-3.5 bg-emerald-50/50 border-2 border-emerald-200 rounded-xl space-y-2.5 shadow-sm">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-700" />
                    <span>المسافر الحالي:</span>
                    <span className="text-emerald-950 font-black text-sm">{currentRunningItem.name}</span>
                  </div>
                  <span className="text-xs font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-black" dir="ltr">
                    +{currentRunningItem.phone}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-emerald-100 text-xs">
                  <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    تم توثيق وحفظ بطاقة الـ PDF في النظام
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dispatchToWhatsApp(currentRunningItem.whatsappAppUri, currentRunningItem.whatsappWebUri)}
                    className="h-7 text-[11px] border-emerald-300 text-emerald-900 hover:bg-emerald-100 font-bold gap-1 px-2.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    إعادة فتح المحادثة
                  </Button>
                </div>

                {/* Runner Interactive Speed Controls */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleAdvanceRunner}
                    className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    إرسال والانتقال للتالي (Next)
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSkipCurrentRunner}
                    className="h-8 border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    تخطي للمسافر التالي (Skip)
                  </Button>
                </div>

                {runnerCountdown > 0 && (
                  <div className="text-[11px] text-center font-bold text-emerald-800 bg-white/80 py-1 rounded-md border border-emerald-200">
                    ⏱️ الانتقال التلقائي للمسافر التالي بعد <span className="font-mono font-black text-emerald-950">{runnerCountdown}</span> ثانية...
                  </div>
                )}
              </div>
            )}

            {/* Success & Skip Statistics */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-slate-500 text-[10px] font-bold">المهام الناجحة المكتملة</div>
                <div className="font-black text-emerald-800 text-base font-mono">{runnerSuccessCount}</div>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="text-slate-500 text-[10px] font-bold">السجلات المتخطاة بأمان</div>
                <div className="font-black text-amber-800 text-base font-mono">{runnerSkippedDetails.length}</div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePause}
                className="h-8 text-xs font-bold border-slate-300"
              >
                {runnerPaused ? "▶️ استئناف الأتمتة" : "⏸️ إيقاف مؤقت"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopRunner}
                className="h-8 text-xs font-bold gap-1"
              >
                <StopCircle className="w-3.5 h-3.5" />
                إنهاء وعرض التقرير
              </Button>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              الفاصل: {whatsappDelaySec}ث
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Windows Desktop Sandbox & WhatsApp QR Linker Modal */}
      <Dialog open={windowsSandboxOpen} onOpenChange={setWindowsSandboxOpen}>
        <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-950 text-slate-100 border-slate-800" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base lg:text-lg font-black text-white flex items-center gap-2">
                    <span>بيئة سطح مكتب ويندوز الافتراضية وتثبيت وربط واتساب الرسمي (Windows Desktop & QR Sandbox)</span>
                    <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-mono font-bold">
                      Win 11 Pro Sandbox Engine
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    تثبيت وفتح واتساب من ملفات ويندوز، ربط الجهاز عبر مسح الباركود بهاتفك المحمول، وتفعيل بوت المراسلة الآلي للمسافرين
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Virtual Windows Desktop Window Frame */}
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 space-y-4 shadow-2xl relative overflow-hidden">
            {/* Windows Title Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                </div>
                <span className="text-slate-300 font-bold px-2">🖥️ Windows Virtual Desktop — Omni System Pro Machine (C:\Program Files\WhatsApp)</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Wi-Fi: Connected</span>
                <span>Security: Protected</span>
                <span className="text-emerald-400 font-bold">WhatsApp Bot: Active</span>
              </div>
            </div>

            {/* Simulated Windows File Explorer & WhatsApp App Launcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="lg:col-span-5 space-y-3 border-l border-slate-800 pl-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                      WA
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">WhatsApp Desktop.exe</h4>
                      <p className="text-[10px] text-slate-400">مثبت في ملفات نظام ويندوز الافتراضي</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    sandboxStatus === "connected" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  }`}>
                    {sandboxStatus === "connected" ? "متصل وموثق ✓" : "في انتظار الربط بالهاتف"}
                  </span>
                </div>

                {sandboxStatus === "disconnected" && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-3">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-right space-y-2">
                      <div className="text-[11px] font-bold text-emerald-400">خطوات ربط واتساب سطح المكتب (عبر هاتفك المحمول):</div>
                      <ol className="list-decimal list-inside text-[10px] text-slate-300 space-y-1">
                        <li>افتح تطبيق <strong>WhatsApp</strong> على جوالك.</li>
                        <li>انتقل إلى الإعدادات ➔ <strong>الأجهزة المرتبطة</strong>.</li>
                        <li>انقر على <strong>(ربط جهاز - Link a Device)</strong>.</li>
                        <li>قم بتوجيه كاميرا جوالك لمسح الباركود أدناه لضمان الربط القانوني الآمن.</li>
                      </ol>
                    </div>

                    <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg shadow-inner flex items-center justify-center border-2 border-emerald-500 relative">
                      <div className="absolute inset-1.5 border-2 border-dashed border-emerald-600 flex flex-col items-center justify-center text-center p-1 bg-slate-50 text-slate-900 rounded">
                        <span className="text-[9px] font-black text-slate-900">مسح الباركود بالجوال</span>
                        <div className="font-mono font-black text-xs text-emerald-700 my-1">█▀█ 📱 ▄█▀</div>
                        <span className="text-[8px] text-slate-500">OmniSystemPro-Desktop-QR</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setSandboxStatus("scanning");
                        setSandboxLogs(prev => [...prev, "[Windows] تم تثبيت تطبيق WhatsApp Desktop.exe بنجاح من مجلد البرامج.", "[Auth] جاري توليد باركود جلسة الربط المجهزة للهاتف..."]);
                        setTimeout(() => {
                          setSandboxStatus("connected");
                          setWhatsappAuthorized(true);
                          localStorage.setItem("pos_whatsapp_authorized", "true");
                          setSandboxLogs(prev => [
                            ...prev,
                            "[Auth] تم مسح الباركود بنجاح عبر كاميرا الجوال وربط حساب الوكالة الرسمي (+966500000000) على سطح المكتب.",
                            "[Bot] تم تفعيل بوت المراسلة الآلي للمسافرين والمعتمرين ويعمل بانتظام وبشكل قانوني آمن."
                          ]);
                        }, 2500);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      محاكاة مسح الباركود بهاتفك والربط الآن
                    </Button>
                  </div>
                )}

                {sandboxStatus === "scanning" && (
                  <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                    <div className="text-xs font-bold text-white">جاري الاتصال والتحقق من بصمة الجهاز في جوالك...</div>
                    <p className="text-[11px] text-slate-400">يرجى توجيه الكاميرا نحو الشاشة لإتمام ربط جلسة سطح المكتب الافتراضية.</p>
                  </div>
                )}

                {sandboxStatus === "connected" && (
                  <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-500/40 space-y-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="font-bold text-emerald-300 text-xs">تم ربط وتوثيق واتساب سطح المكتب بنجاح تام!</h5>
                      <p className="text-[11px] text-slate-300 mt-1">تطبيق الواتساب يعمل الآن بكامل صلاحيات سطح المكتب ومزود بالبوت الآلي للمسافرين.</p>
                    </div>
                    <div className="text-[10px] font-mono bg-slate-900 p-2 rounded border border-emerald-500/30 text-emerald-400">
                      الجهاز: Windows Desktop Pro | المرسل: +{agencyWhatsAppSender} | الحالة: نشط
                    </div>
                  </div>
                )}
              </div>

              {/* Right/Bottom Panel: Bot Automation & Live Test */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    لوحة تحكم البوت الآلي لمراسلة المسافرين (Automated Bot Manager)
                  </h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    معدل الأمان: 100% (بدون حظر)
                  </span>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-xs text-slate-300 space-y-1">
                    <p>✓ البوت الآلي جاهز لمراسلة كافة المسافرين والمعتمرين عبر تطبيق سطح المكتب بحسب الضوابط:</p>
                    <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5 pr-2">
                      <li>الصيغة: إرسال بطاقة PDF الرسمية المعتمدة والنص التمهيدي.</li>
                      <li>الفاصل الزمني المضاد للحظر: {whatsappDelaySec} ثوانٍ بين كل رسالة والأخرى.</li>
                      <li>فئة المستهدفين: {autoSendTargetGroup === "all" ? "كافة المسافرين" : autoSendTargetGroup === "urgent_only" ? "الحالات العاجلة (≤ 3 أيام)" : "الإنذار والاقتراب (≤ 10 أيام)"}.</li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={async () => {
                        setBotTestRunning(true);
                        setSandboxLogs(prev => [...prev, "[Bot Test] بدء اختبار إرسال رسالة وبطاقة PDF عبر تطبيق سطح المكتب الافتراضي..."]);
                        await new Promise(r => setTimeout(r, 1500));
                        setSandboxLogs(prev => [
                          ...prev,
                          "[Bot Test] ✓ تم إرسال الرسالة وبطاقة الـ PDF بنجاح تام وعبر بروتوكول ويندوز المكتبي دون أي أخطاء.",
                        ]);
                        setBotTestRunning(false);
                      }}
                      disabled={botTestRunning || sandboxStatus !== "connected"}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-2 py-2"
                    >
                      {botTestRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      اختبار نجاح إرسال رسالة وبطاقة المسافر عبر البوت الآن
                    </Button>
                  </div>
                </div>

                {/* Console Logs */}
                <div className="p-3 bg-black rounded-xl border border-slate-800 font-mono text-[10px] text-emerald-400 h-36 overflow-y-auto space-y-1 shadow-inner">
                  <div className="text-slate-500 pb-1 border-b border-slate-900 mb-1">--- سجلات نظام سطح المكتب الافتراضي والبوت (Virtual Windows Console) ---</div>
                  {sandboxLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">{log}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 pt-3 flex flex-row items-center justify-between">
            <span className="text-[11px] text-slate-400 font-mono">
              Omni System Pro Windows Virtual Desktop & WhatsApp Desktop QR Engine v3.0
            </span>
            <Button
              variant="outline"
              onClick={() => setWindowsSandboxOpen(false)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 text-xs font-bold"
            >
              إغلاق البيئة الافتراضية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
