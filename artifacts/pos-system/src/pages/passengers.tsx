import React, { useState, useEffect, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Luggage, Plus, Search, Edit2, Trash2, Calendar, CreditCard, User, Globe, 
  Phone, Mail, FileText, CheckCircle2, AlertTriangle, Clock, Printer, ShieldAlert,
  Download, Eye, Share2, Compass, Check, Filter, RefreshCw, Sparkles, Building2,
  FileSpreadsheet, Upload, MessageCircle, Maximize2, Minimize2, ZoomIn, ZoomOut, X,
  ArrowUpDown, CheckSquare, Info, FileDown, Laptop, Monitor, Pause, Play, Square,
  ExternalLink, FileCheck, History, Send, CheckCheck, BellRing
} from "lucide-react";
import { 
  generateVisitorsStatusReportA4Html, 
  generatePassengersDirectoryA4Html, 
  generateSinglePassengerCardA4Html, 
  printA4Html,
  saveA4PdfToFile
} from "@/lib/printUtils";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { 
  extractTextFromPdf, 
  parsePassengersFromText, 
  generateSamplePassengerPdfHtml 
} from "@/lib/pdfExtractor";
import { WhatsAppAutomationModal } from "@/components/travel/WhatsAppAutomationModal";
import { WhatsAppSkippedModal, SkippedItem } from "@/components/travel/WhatsAppSkippedModal";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("pos_token") ?? "";
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

// Utility to calculate exit date given entry date and duration days
function calcExitDate(entryDateStr: string, duration: number | string): string {
  if (!entryDateStr || !duration) return "";
  const d = new Date(entryDateStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(duration));
  return d.toISOString().slice(0, 10);
}

// Utility to calculate remaining days relative to today or a reference date
function calcRemainingDays(exitDateStr: string, refDateStr?: string): number | null {
  if (!exitDateStr) return null;
  const exitDate = new Date(exitDateStr);
  if (isNaN(exitDate.getTime())) return null;
  const refDate = refDateStr ? new Date(refDateStr) : new Date();
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const exit = new Date(exitDate.getFullYear(), exitDate.getMonth(), exitDate.getDate());
  const diffTime = exit.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Utility to calculate days spent in Makkah
function calcDaysSpent(entryDateStr: string, refDateStr?: string): number {
  if (!entryDateStr) return 0;
  const entryDate = new Date(entryDateStr);
  if (isNaN(entryDate.getTime())) return 0;
  const refDate = refDateStr ? new Date(refDateStr) : new Date();
  const diffTime = refDate.getTime() - entryDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// Utility to reliably compute remaining days for any passenger
function getPaxRemainingDays(p: any, refDateStr?: string): number | null {
  if (p.remaining_days !== null && p.remaining_days !== undefined && p.remaining_days !== "") {
    const num = Number(p.remaining_days);
    if (!isNaN(num)) return num;
  }
  if (p.expected_exit_date) {
    return calcRemainingDays(p.expected_exit_date, refDateStr);
  }
  if (p.travel_date) {
    const duration = Number(p.program_duration_days) || 90;
    const entryDate = new Date(p.travel_date);
    if (!isNaN(entryDate.getTime())) {
      const exitDate = new Date(entryDate);
      exitDate.setDate(exitDate.getDate() + duration);
      return calcRemainingDays(exitDate.toISOString().split("T")[0], refDateStr);
    }
  }
  return null;
}

export default function PassengersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"umrah_monitor" | "all_passengers" | "visitors_report">("umrah_monitor");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "warning_15" | "urgent" | "warning" | "overstayed" | "safe">("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [visaFilter, setVisaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [statsModalType, setStatsModalType] = useState<"totalUmrah" | "urgent" | "warning" | "warning_15" | "totalPassengers" | null>(null);
  
  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [excelImportModalOpen, setExcelImportModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [editingPax, setEditingPax] = useState<any | null>(null);

  // Advanced Report Viewer (Full-Screen, Zoom, Safe PDF Export)
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportViewerHtml, setReportViewerHtml] = useState("");
  const [reportViewerTitle, setReportViewerTitle] = useState("استعراض التقرير");

  // Saved File Notification & Actions Toast/Modal
  const [savedFileToast, setSavedFileToast] = useState<{
    open: boolean;
    filePath?: string;
    fileName?: string;
  } | null>(null);

  // Full screen preview controls
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // WhatsApp dialog state
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>("");
  const [whatsAppCustomText, setWhatsAppCustomText] = useState<string>("");
  const [targetPaxForWhatsApp, setTargetPaxForWhatsApp] = useState<any | null>(null);
  const [whatsappFormat, setWhatsappFormat] = useState<"text" | "pdf">("text");

  // WhatsApp Advanced Permissions & Anti-Ban Controls
  const [whatsappAuthorized, setWhatsappAuthorized] = useState<boolean>(() => {
    return localStorage.getItem("pos_whatsapp_authorized") === "true";
  });
  const [whatsappPermissionModalOpen, setWhatsappPermissionModalOpen] = useState(false);
  const [whatsappSendMode, setWhatsappSendMode] = useState<"manual" | "auto">("manual");
  const [whatsappDelaySec, setWhatsappDelaySec] = useState<number>(3);
  const [whatsappBatchSending, setWhatsappBatchSending] = useState(false);
  const [whatsappBatchProgress, setWhatsappBatchProgress] = useState({ current: 0, total: 0, status: "", successCount: 0, failCount: 0 });
  const [agencyWhatsAppSender, setAgencyWhatsAppSender] = useState<string>(() => {
    return localStorage.getItem("pos_agency_whatsapp_sender") || "966500000000";
  });
  const [autoSendTargetGroup, setAutoSendTargetGroup] = useState<"all" | "urgent_only" | "warning_and_urgent">("all");
  const [autoMessageTemplate, setAutoMessageTemplate] = useState<string>("default");
  const [whatsappSkippedModalOpen, setWhatsappSkippedModalOpen] = useState(false);
  const [whatsappSkippedList, setWhatsappSkippedList] = useState<SkippedItem[]>([]);
  const [whatsappSuccessList, setWhatsappSuccessList] = useState<any[]>([]);
  const [whatsappSuccessCount, setWhatsappSuccessCount] = useState<number>(0);

  // Document & PDF import state
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [importCustomerId, setImportCustomerId] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string>("");
  const [importSourceType, setImportSourceType] = useState<"pdf" | "excel">("pdf");
  const [isParsingDocument, setIsParsingDocument] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    customer_id: "",
    name_ar: "",
    name_en: "",
    title: "Mr",
    dob: "",
    gender: "ذكر",
    nationality: "يمني",
    passport_number: "",
    passport_issue_date: "",
    passport_expiry_date: "",
    passport_issue_place: "",
    passport_type: "عادي",
    national_id: "",
    phone: "",
    email: "",
    special_notes: "",
    // Umrah and Stay Monitoring Fields
    visa_type: "تأشيرة عمره",
    travel_date: "", // تاريخ السفر / الدخول
    program_duration_days: "90", // مدة البرنامج بالأيام (يدوي 90 أو 86 أو 85)
    expected_exit_date: "", // تاريخ الخروج المتوقع
    remaining_days: "", // الأيام المتبقية
    travel_status: "داخل مكة"
  });

  const { data: passengers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["travel-passengers", search, selectedCustomerId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCustomerId) params.set("customer_id", selectedCustomerId);
      return fetchWithAuth(`/api/travel/passengers?${params.toString()}`);
    }
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: subAccounts11200 = [] } = useQuery<any[]>({
    queryKey: ["sub-accounts-11200"],
    queryFn: async () => {
      try {
        const res = await fetchWithAuth("/api/travel/sub-accounts/11200");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    }
  });

  const allCustomerOptions = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    customers.forEach((c: any) => {
      if (c.name) {
        seen.add(c.name.trim().toLowerCase());
        list.push({
          id: c.id,
          name: c.name,
          account_code: c.account_code || "",
          label: `${c.name} ${c.phone ? `(${c.phone})` : ""}`
        });
      }
    });

    subAccounts11200.forEach((acc: any) => {
      if (acc.name && !seen.has(acc.name.trim().toLowerCase()) && acc.code !== "11200") {
        seen.add(acc.name.trim().toLowerCase());
        list.push({
          id: acc.id,
          name: acc.name,
          account_code: acc.code,
          label: `📊 [دليل الحسابات - ذمم مدينة ${acc.code}] ${acc.name}`
        });
      }
    });

    return list;
  }, [customers, subAccounts11200]);

  // Calculate live exit date and remaining days in form
  const liveExitDate = useMemo(() => {
    return calcExitDate(form.travel_date, form.program_duration_days);
  }, [form.travel_date, form.program_duration_days]);

  const liveRemainingDays = useMemo(() => {
    if (!liveExitDate) return null;
    return calcRemainingDays(liveExitDate);
  }, [liveExitDate]);

  const liveDaysSpent = useMemo(() => {
    if (!form.travel_date) return 0;
    return calcDaysSpent(form.travel_date);
  }, [form.travel_date]);

  // Scheduled Automation Background Watcher (يرصد وقت الإرسال المجدول في أي يوم ويطلق الأتمتة تلقائياً)
  useEffect(() => {
    const checkScheduledAutomation = async () => {
      try {
        const token = sessionStorage.getItem("pos_token") || "";
        const cfgRes = await fetch("/api/travel/whatsapp/automation-config", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const cfg = await cfgRes.json();
        if (!cfg || !cfg.is_active || cfg.schedule_mode === "immediate") return;

        const now = new Date();
        const currentHhMm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const targetHhMm = (cfg.scheduled_time || "22:00").trim();

        if (currentHhMm === targetHhMm) {
          const todayDateKey = `${now.toISOString().slice(0, 10)}_${targetHhMm}`;
          const lastTriggered = localStorage.getItem("pos_last_whatsapp_scheduled_trigger");
          if (lastTriggered !== todayDateKey) {
            localStorage.setItem("pos_last_whatsapp_scheduled_trigger", todayDateKey);
            toast({
              title: "⏰ حان موعد أتمتة إرسال الواتساب للمسافرين!",
              description: `جاري تشغيل الإرسال التلقائي المبرمج اليومي (${targetHhMm}) عبر واتساب ويندوز...`,
            });
            setTargetPaxForWhatsApp(null);
            setWhatsAppModalOpen(true);
          }
        }
      } catch (err) {
        // silent background monitor
      }
    };

    const timer = setInterval(checkScheduledAutomation, 30000);
    return () => clearInterval(timer);
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const nameAr = (data.name_ar || data.name_en || "").trim();
      const nameEn = (data.name_en || data.name_ar || "").trim();
      const payload = {
        ...data,
        name_ar: nameAr,
        name_en: nameEn,
        customer_id: data.customer_id ? Number(data.customer_id) || data.customer_id : null,
        program_duration_days: data.program_duration_days ? Number(data.program_duration_days) : 90,
        expected_exit_date: liveExitDate || data.expected_exit_date || null,
        remaining_days: liveRemainingDays !== null ? liveRemainingDays : (data.remaining_days !== undefined && data.remaining_days !== "" ? Number(data.remaining_days) : null)
      };
      if (editingPax) {
        return fetchWithAuth(`/api/travel/passengers/${editingPax.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return fetchWithAuth("/api/travel/passengers", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async (savedPax: any) => {
      qc.invalidateQueries({ queryKey: ["travel-passengers"] });
      setModalOpen(false);
      const isNew = !editingPax;
      resetForm();
      toast({
        title: "تم الحفظ بنجاح",
        description: isNew ? "تم حفظ بيانات المسافر بنجاح في النظام" : "تم تحديث بيانات المسافر بنجاح",
      });

      // Auto-apply WhatsApp Automation settings seamlessly on new passenger registration
      if (isNew && savedPax && savedPax.id) {
        try {
          const cfgRes: any = await fetchWithAuth("/api/travel/whatsapp/automation-config");
          const isAutoActive = !cfgRes || (cfgRes.is_active !== 0 && cfgRes.auto_apply_on_new_passenger !== 0);
          if (isAutoActive) {
            const sendRes: any = await fetchWithAuth("/api/travel/whatsapp/send-passenger", {
              method: "POST",
              body: JSON.stringify({ passenger_id: savedPax.id }),
            });
            if (sendRes && sendRes.success) {
              if (sendRes.messageText && navigator.clipboard) {
                try {
                  await navigator.clipboard.writeText(sendRes.messageText);
                } catch (e) {}
              }
              const clientType = localStorage.getItem("pos_whatsapp_client_type") || cfgRes?.client_type || "desktop";
              const targetUri = clientType === "web" ? sendRes.whatsappWebUri : (sendRes.whatsappAppUri || sendRes.whatsappWebUri);
              if (targetUri) {
                const a = document.createElement("a");
                a.href = targetUri;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  try { if (document.body.contains(a)) document.body.removeChild(a); } catch (e) {}
                }, 1000);
              }
              toast({
                title: "🚀 تم تنفيذ أتمتة إرسال الواتساب للمسافر تلقائياً!",
                description: `تم الدخول إلى واتساب وإرسال مستندات وبيانات المسافر (${savedPax.name_ar || savedPax.name_en}) إلى رقم العميل بدون أي تدخل منك بنجاح ✓`,
              });
            } else if (sendRes && sendRes.skipped) {
              toast({
                title: "تنبيه أتمتة الواتساب",
                description: `تم تخطي إرسال الواتساب تلقائياً: ${sendRes.reason || sendRes.error || "رقم الهاتف غير مسجل في بيانات المسافر"}`,
              });
            }
          }
        } catch (err) {
          console.warn("Auto-apply WhatsApp error on new pax:", err);
        }
      }
    },
    onError: (err: any) => {
      toast({
        title: "خطأ أثناء الحفظ",
        description: err.message || "حدث خطأ أثناء حفظ بيانات المسافر",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/passengers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-passengers"] });
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف سجل المسافر بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحذف",
        description: err.message || "حدث خطأ أثناء حذف المسافر",
        variant: "destructive"
      });
    }
  });

  const bulkImportMutation = useMutation({
    mutationFn: (data: { passengers: any[]; customer_id?: number }) => 
      fetchWithAuth("/api/travel/passengers/bulk-import", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["travel-passengers"] });
      setExcelImportModalOpen(false);
      setImportedRows([]);
      toast({
        title: "تم الاستيراد بنجاح",
        description: `تم استيراد ${res?.count ?? ""} مسافر بنجاح`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ أثناء الاستيراد",
        description: err.message || "حدث خطأ أثناء استيراد بيانات المسافرين",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setEditingPax(null);
    setForm({
      customer_id: selectedCustomerId || "",
      name_ar: "",
      name_en: "",
      title: "Mr",
      dob: "",
      gender: "ذكر",
      nationality: "يمني",
      passport_number: "",
      passport_issue_date: "",
      passport_expiry_date: "",
      passport_issue_place: "",
      passport_type: "عادي",
      national_id: "",
      phone: "",
      email: "",
      special_notes: "",
      visa_type: "تأشيرة عمره",
      travel_date: "",
      program_duration_days: "90",
      expected_exit_date: "",
      remaining_days: "",
      travel_status: "داخل مكة"
    });
  };

  const handleEdit = (pax: any) => {
    setEditingPax(pax);
    setForm({
      customer_id: pax.customer_id ? String(pax.customer_id) : "",
      name_ar: pax.name_ar || "",
      name_en: pax.name_en || "",
      title: pax.title || "Mr",
      dob: pax.dob || "",
      gender: pax.gender || "ذكر",
      nationality: pax.nationality || "يمني",
      passport_number: pax.passport_number || "",
      passport_issue_date: pax.passport_issue_date || "",
      passport_expiry_date: pax.passport_expiry_date || "",
      passport_issue_place: pax.passport_issue_place || "",
      passport_type: pax.passport_type || "عادي",
      national_id: pax.national_id || "",
      phone: pax.phone || "",
      email: pax.email || "",
      special_notes: pax.special_notes || "",
      visa_type: pax.visa_type || "تأشيرة عمره",
      travel_date: pax.travel_date || "",
      program_duration_days: pax.program_duration_days ? String(pax.program_duration_days) : "90",
      expected_exit_date: pax.expected_exit_date || "",
      remaining_days: pax.remaining_days !== null && pax.remaining_days !== undefined ? String(pax.remaining_days) : "",
      travel_status: pax.travel_status || "داخل مكة"
    });
    setModalOpen(true);
  };

  // Filter passengers based on active selections (sorted by days spent descending: largest to smallest)
  const filteredPassengers = useMemo(() => {
    const list = passengers.filter(p => {
      if (visaFilter !== "all" && p.visa_type !== visaFilter) return false;
      if (statusFilter !== "all" && p.travel_status !== statusFilter) return false;
      return true;
    });
    return list.sort((a, b) => calcDaysSpent(b.travel_date) - calcDaysSpent(a.travel_date));
  }, [passengers, visaFilter, statusFilter]);

  // Umrah specific list (sorted by days spent descending: largest to smallest)
  const umrahPassengers = useMemo(() => {
    let list = passengers.filter(p => (p.visa_type || "").includes("عمر") || p.travel_date);
    if (filterStatus !== "all") {
      list = list.filter(p => {
        const remaining = getPaxRemainingDays(p);
        if (remaining === null) return false;
        if (filterStatus === "warning_15") return remaining <= 15;
        if (filterStatus === "urgent") return remaining <= 3;
        if (filterStatus === "warning") return remaining <= 10;
        if (filterStatus === "overstayed") return remaining < 0;
        if (filterStatus === "safe") return remaining > 10;
        return true;
      });
    }
    return list.sort((a, b) => calcDaysSpent(b.travel_date) - calcDaysSpent(a.travel_date));
  }, [passengers, filterStatus]);
  
  const originalUmrahPassengers = useMemo(() => {
    const list = passengers.filter(p => (p.visa_type || "").includes("عمر") || p.travel_date);
    return list.sort((a, b) => calcDaysSpent(b.travel_date) - calcDaysSpent(a.travel_date));
  }, [passengers]);

  // Statistics for top cards & click previews
  const statsModalData = useMemo(() => {
    switch(statsModalType) {
      case "totalUmrah": return originalUmrahPassengers;
      case "urgent": return originalUmrahPassengers.filter(p => {
        const rem = getPaxRemainingDays(p);
        return rem !== null && rem <= 3;
      });
      case "warning": return originalUmrahPassengers.filter(p => {
        const rem = getPaxRemainingDays(p);
        return rem !== null && rem > 3 && rem <= 10;
      });
      case "warning_15": return originalUmrahPassengers.filter(p => {
        const rem = getPaxRemainingDays(p);
        return rem !== null && rem > 10 && rem <= 15;
      });
      case "totalPassengers": return filteredPassengers;
      default: return [];
    }
  }, [statsModalType, originalUmrahPassengers, filteredPassengers]);

  const stats = useMemo(() => {
    const totalUmrah = originalUmrahPassengers.length;
    const inMakkah = originalUmrahPassengers.filter(p => p.travel_status === "داخل مكة" || !p.travel_status).length;
    
    let urgentCount = 0; // <= 3 days remaining (including overdue / negative days)
    let warningCount = 0; // 4 to 10 days remaining
    let warning15Count = 0; // 11 to 15 days remaining
    let overstayedCount = 0; // < 0 days

    originalUmrahPassengers.forEach(p => {
      const rem = getPaxRemainingDays(p);
      if (rem !== null) {
        if (rem < 0) {
          overstayedCount++;
          urgentCount++; // Overstayed is critical urgent exit!
        } else if (rem <= 3) {
          urgentCount++;
        } else if (rem <= 10) {
          warningCount++;
        } else if (rem <= 15) {
          warning15Count++;
        }
      }
    });

    return { 
      totalUmrah, 
      inMakkah, 
      urgentCount, 
      warningCount, 
      warning15Count,
      overstayedCount, 
      totalPassengers: passengers.length 
    };
  }, [originalUmrahPassengers, passengers]);

  // Find customer name for report
  const selectedCustomerObj = customers.find(c => String(c.id) === String(selectedCustomerId));
  const currentCustomerName = selectedCustomerObj ? selectedCustomerObj.name : "محمد اليمني";

  // Handle direct A4 print
  const handlePrintVisitorsReport = (targetList?: any[], custName?: string, customReportTitle?: string) => {
    const listToPrint = targetList || (selectedCustomerId ? filteredPassengers : umrahPassengers);
    const title = customReportTitle || "تقرير حالة الزائرين";
    const html = generateVisitorsStatusReportA4Html(listToPrint, {
      customerName: custName || currentCustomerName,
      reportDate: reportDate.replace(/-/g, "/"),
      companyName: "نظام إدارة المسافرين وتأشيرات العمرة",
      filterTitle: title
    });
    printA4Html(html);
  };

  // Handle direct passengers directory landscape print
  const handlePrintPassengersDirectory = (targetList?: any[], custName?: string) => {
    const listToPrint = targetList || (selectedCustomerId ? filteredPassengers : passengers);
    const html = generatePassengersDirectoryA4Html(listToPrint, {
      customerName: custName || currentCustomerName,
      reportDate: reportDate.replace(/-/g, "/"),
      companyName: "Omni System Pro — إدارة المسافرين والجوازات والرحلات"
    });
    printA4Html(html);
  };

  // Export / Save Visitors Status Report as PDF directly to file
  const handleExportToPdf = async (targetList?: any[], custName?: string, customReportTitle?: string) => {
    const listToPrint = targetList || (selectedCustomerId ? filteredPassengers : umrahPassengers);
    const title = customReportTitle || "تقرير حالة الزائرين";
    const docTitle = `${title.replace(/\s+/g, "_")}_${(custName || currentCustomerName).replace(/\s+/g, "_")}_${reportDate}`;
    const html = generateVisitorsStatusReportA4Html(listToPrint, {
      customerName: custName || currentCustomerName,
      reportDate: reportDate.replace(/-/g, "/"),
      companyName: "نظام إدارة المسافرين وتأشيرات العمرة",
      filterTitle: title
    });
    
    try {
      const res = await saveA4PdfToFile(html, docTitle, docTitle);
      if (res.canceled) return;
      if (res.success) {
        setSavedFileToast({
          open: true,
          filePath: res.filePath,
          fileName: res.fileName || `${docTitle}.pdf`
        });
        toast({
          title: "تم حفظ ملف PDF بنجاح",
          description: res.filePath ? `تم الحفظ في: ${res.filePath}` : "تم حفظ وتنزيل الملف بنجاح"
        });
      } else if (res.error) {
        toast({
          title: "فشل حفظ الملف",
          description: res.error,
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "خطأ في التصدير",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  // Export Passengers & Passports Directory as PDF directly to file
  const handleExportPassengersDirectoryToPdf = async (targetList?: any[], custName?: string) => {
    const listToPrint = targetList || (selectedCustomerId ? filteredPassengers : passengers);
    const docTitle = `سجل_بيانات_المسافرين_والجوازات_${(custName || currentCustomerName).replace(/\s+/g, "_")}_${reportDate}`;
    const html = generatePassengersDirectoryA4Html(listToPrint, {
      customerName: custName || currentCustomerName,
      reportDate: reportDate.replace(/-/g, "/"),
      companyName: "Omni System Pro — إدارة المسافرين والجوازات والرحلات"
    });
    
    try {
      const res = await saveA4PdfToFile(html, docTitle, docTitle);
      if (res.canceled) return;
      if (res.success) {
        setSavedFileToast({
          open: true,
          filePath: res.filePath,
          fileName: res.fileName || `${docTitle}.pdf`
        });
        toast({
          title: "تم حفظ ملف PDF بنجاح",
          description: res.filePath ? `تم الحفظ في: ${res.filePath}` : "تم حفظ وتنزيل الملف بنجاح"
        });
      } else if (res.error) {
        toast({
          title: "فشل حفظ الملف",
          description: res.error,
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "خطأ في التصدير",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  // Export Single Passenger & Passport Card as PDF directly to file
  const handleExportSinglePassengerToPdf = async (pax: any) => {
    const paxName = pax.name_ar || pax.name_en || pax.passport_number || "مسافر";
    const docTitle = `بطاقة_مسافر_وجواز_${paxName.replace(/\s+/g, "_")}`;
    const html = generateSinglePassengerCardA4Html(pax, {
      companyName: "Omni System Pro — إدارة المسافرين والجوازات والرحلات"
    });
    
    try {
      const res = await saveA4PdfToFile(html, docTitle, docTitle);
      if (res.canceled) return;
      if (res.success) {
        setSavedFileToast({
          open: true,
          filePath: res.filePath,
          fileName: res.fileName || `${docTitle}.pdf`
        });
        toast({
          title: "تم حفظ ملف PDF بنجاح",
          description: res.filePath ? `تم الحفظ في: ${res.filePath}` : "تم حفظ وتنزيل الملف بنجاح"
        });
      } else if (res.error) {
        toast({
          title: "فشل حفظ الملف",
          description: res.error,
          variant: "destructive"
        });
      }
    } catch (e: any) {
      toast({
        title: "خطأ في التصدير",
        description: e.message,
        variant: "destructive"
      });
    }
  };

  // Open Full-Screen Preview Modal (No printing errors, includes zoom and PDF export)
  const handleOpenFullScreenPreview = (type: "visitors" | "directory" | "single", targetData?: any, customTitle?: string) => {
    if (type === "directory") {
      const list = targetData || (selectedCustomerId ? filteredPassengers : passengers);
      const titleToUse = customTitle || "سجل المسافرين ووثائق الجوازات (A4 PDF)";
      const html = generatePassengersDirectoryA4Html(list, {
        customerName: currentCustomerName,
        reportDate: reportDate.replace(/-/g, "/"),
        companyName: "Omni System Pro — إدارة المسافرين والجوازات والرحلات",
        filterTitle: titleToUse
      });
      setReportViewerHtml(html);
      setReportViewerTitle(`${titleToUse} - ${currentCustomerName}`);
    } else if (type === "single" && targetData) {
      const html = generateSinglePassengerCardA4Html(targetData, {
        companyName: "Omni System Pro — إدارة المسافرين والجوازات والرحلات"
      });
      setReportViewerHtml(html);
      setReportViewerTitle(`استمارة وبطاقة المسافر والجواز - ${targetData.name_ar || targetData.name_en || targetData.passport_number}`);
    } else {
      const list = targetData || (selectedCustomerId ? filteredPassengers : umrahPassengers);
      const titleToUse = customTitle || "تقرير حالة الزائرين والمعتمرين";
      const html = generateVisitorsStatusReportA4Html(list, {
        customerName: currentCustomerName,
        reportDate: reportDate.replace(/-/g, "/"),
        companyName: "نظام إدارة المسافرين وتأشيرات العمرة",
        filterTitle: titleToUse
      });
      setReportViewerHtml(html);
      setReportViewerTitle(`${titleToUse} - ${currentCustomerName}`);
    }
    setReportViewerOpen(true);
  };

  // Export to PDF (Replaced Excel export)
  const handleExportToExcel = () => {
    handleExportToPdf();
  };

  // Download Sample Excel Template
  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        "اسم المعتمر": "علي عبدالله علي الشهابي",
        "الاسم بالانجليزي": "Ali Abdullah Ali Al-Shehabi",
        "رقم الجواز": "14800339",
        "نوع التأشيرة": "تأشيرة عمره",
        "مدة البرنامج بالأيام": 86,
        "تاريخ السفر": "2026-06-16",
        "الجنسية": "يمني",
        "رقم الهاتف": "0555123456",
        "ملاحظات": "معتمر وصول مكة"
      },
      {
        "اسم المعتمر": "يوسف محمد سود الشريف",
        "الاسم بالانجليزي": "Youssef Mohammed Sood Al-Sharif",
        "رقم الجواز": "10270557",
        "نوع التأشيرة": "تأشيرة عمره",
        "مدة البرنامج بالأيام": 85,
        "تاريخ السفر": "2026-06-22",
        "الجنسية": "يمني",
        "رقم الهاتف": "0555987654",
        "ملاحظات": ""
      },
      {
        "اسم المعتمر": "عبدالله علي صالح الشهابي",
        "الاسم بالانجليزي": "Abdullah Ali Saleh Al-Shehabi",
        "رقم الجواز": "14800340",
        "نوع التأشيرة": "تأشيرة عمره",
        "مدة البرنامج بالأيام": 86,
        "تاريخ السفر": "2026-06-16",
        "الجنسية": "يمني",
        "رقم الهاتف": "0555112233",
        "ملاحظات": ""
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "نموذج استيراد معتمرين");
    XLSX.writeFile(workbook, "نموذج_استيراد_المعتمرين_OmniSystemPro.xlsx");
  };

  // Download Blank Passenger Manifest PDF Template
  const handleDownloadSamplePdf = () => {
    const html = generateSamplePassengerPdfHtml();
    printA4Html(html, "نموذج_كشف_بيان_ركاب_وجوازات_فارغ");
  };

  // Handle Document File Upload & Parse (Primary PDF support + Excel compatibility)
  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      setIsParsingDocument(true);
      setImportSourceType("pdf");
      try {
        const arrayBuffer = await file.arrayBuffer();
        const extractedText = await extractTextFromPdf(arrayBuffer);
        const parsedPassengers = parsePassengersFromText(extractedText);

        if (!parsedPassengers || parsedPassengers.length === 0) {
          alert("لم يتم العثور على سجلات مسافرين تلقائياً في ملف الـ PDF المرفوع. يرجى التأكد من أن المستند يحتوي على نص يمكن قراءته وليس صوراً، أو استخدام نموذج الكشف المعتمد.");
          return;
        }

        setImportedRows(parsedPassengers);
        setExcelImportModalOpen(true);
      } catch (err: any) {
        alert("فشل في استخراج بيانات ملف الـ PDF: " + (err.message || "خطأ غير متوقع"));
      } finally {
        setIsParsingDocument(false);
        if (e.target) e.target.value = "";
      }
    } else {
      // Excel / CSV File fallback
      setImportSourceType("excel");
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

          if (!rawJson || rawJson.length === 0) {
            alert("الملف لا يحتوي على بيانات أو الصفوف فارغة");
            return;
          }

          const parsedPassengers = rawJson.map((row) => {
            const nameAr = row["اسم المعتمر"] || row["الاسم بالعربي"] || row["الاسم"] || row["Name"] || row["name_ar"] || "";
            const nameEn = row["الاسم بالانجليزي"] || row["Name EN"] || row["name_en"] || nameAr;
            const passportNo = String(row["رقم الجواز"] || row["الجواز"] || row["Passport"] || row["passport_number"] || "").trim();
            const visaType = row["نوع التأشيرة"] || row["النوع"] || row["Visa Type"] || "تأشيرة عمره";
            const progDays = Number(row["مدة البرنامج بالأيام"] || row["مدة البرنامج"] || row["مده السفر"] || row["Duration"] || 90);
            
            let travelDate = row["تاريخ السفر"] || row["تاريخ الدخول"] || row["تاريخ الدخول(السفر)"] || row["Travel Date"] || "";
            if (typeof travelDate === "number") {
              const dateObj = new Date(Math.round((travelDate - 25569) * 86400 * 1000));
              travelDate = dateObj.toISOString().slice(0, 10);
            } else if (typeof travelDate === "string") {
              travelDate = travelDate.replace(/\//g, "-").trim();
            }

            const exitDate = calcExitDate(travelDate, progDays);
            const remaining = calcRemainingDays(exitDate);

            return {
              name_ar: nameAr,
              name_en: nameEn,
              passport_number: passportNo,
              visa_type: visaType,
              program_duration_days: progDays,
              travel_date: travelDate,
              expected_exit_date: exitDate,
              remaining_days: remaining,
              nationality: row["الجنسية"] || "يمني",
              phone: String(row["رقم الهاتف"] || row["الجوال"] || row["Phone"] || "").trim(),
              travel_status: "داخل مكة"
            };
          }).filter(p => p.name_ar || p.passport_number);

          setImportedRows(parsedPassengers);
          setExcelImportModalOpen(true);
        } catch (err: any) {
          alert("فشل في قراءة ملف الإكسل: " + err.message);
        } finally {
          if (e.target) e.target.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Open WhatsApp Dialog for client report or individual pilgrim
  const handleOpenWhatsAppDialog = (pax?: any) => {
    const listToSend = pax ? [pax] : (selectedCustomerId ? filteredPassengers : umrahPassengers);
    
    // 1. Automatic Customer / Passenger Phone Number Extraction with comprehensive fallbacks
    let phone = "";
    if (pax) {
      phone = pax.phone || pax.mobile || pax.contact_phone || pax.customer_phone || "";
      if (!phone && (pax.customer_id || pax.customer_name)) {
        const matchedCust = customers.find((c: any) => 
          (pax.customer_id && String(c.id) === String(pax.customer_id)) || 
          (pax.customer_name && c.name && c.name.trim() === pax.customer_name.trim())
        );
        if (matchedCust) {
          phone = matchedCust.phone || matchedCust.mobile || "";
        }
      }
    } else {
      const cust = selectedCustomerObj || customers.find((c: any) => String(c.id) === String(selectedCustomerId));
      phone = cust?.phone || cust?.mobile || (filteredPassengers.length > 0 ? filteredPassengers[0].phone : "") || "";
    }

    setTargetPaxForWhatsApp(pax || null);
    setWhatsAppPhone(phone || "");

    let message = "";
    const agencySig = `\n━━━━━━━━━━━━━━━━━━━━\n🕋 *رقم الوكالة / المكتب المرسل:* ${agencyWhatsAppSender}\n*Omni System Pro - نظام الرقابة والمتابعة*`;

    if (pax) {
      message = `*تذكير متابعة تأشيرة معتمر - مكة المكرمة*\n`;
      message += `----------------------------------------\n`;
      message += `👤 *الاسم:* ${pax.name_ar || pax.name_en}\n`;
      message += `📄 *رقم الجواز:* ${pax.passport_number}\n`;
      message += `🕋 *النوع:* ${pax.visa_type || 'تأشيرة عمره'}\n`;
      message += `⏳ *مدة البرنامج:* ${pax.program_duration_days || 90} يوم\n`;
      message += `🛫 *تاريخ الدخول:* ${(pax.travel_date || '').replace(/-/g, '/')}\n`;
      message += `📅 *تاريخ الخروج المتوقع:* ${(pax.expected_exit_date || '').replace(/-/g, '/')}\n`;
      message += `⚠️ *الأيام المتبقية على الخروج:* ${pax.remaining_days !== null ? `${pax.remaining_days} يوم` : 'غير محدد'}\n`;
      message += `----------------------------------------\n`;
      message += `نرجو الالتزام بموعد المغادرة المحدد لتفادي أي غرامات أو مخالفات.`;
      message += agencySig;
    } else {
      message = `📋 *تقرير حالة الزائرين والمعتمرين*\n`;
      message += `👤 *العميل:* ${currentCustomerName}\n`;
      message += `📅 *التاريخ:* ${reportDate.replace(/-/g, '/')}\n`;
      message += `📊 *إجمالي المعتمرين:* ${listToSend.length}\n`;
      message += `----------------------------------------\n`;

      listToSend.forEach((p, idx) => {
        const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? Number(p.remaining_days) : null;
        const alertIcon = remaining !== null && remaining <= 3 ? "🔴 [إنذار عاجل]" : remaining !== null && remaining <= 10 ? "🟡 [اقتراب]" : "🟢";
        message += `${idx + 1}. *${p.name_ar || p.name_en}* (واتساب: ${p.phone || 'غير متوفر'})\n`;
        message += `   • الجواز: ${p.passport_number || '---'} | البرنامج: ${p.program_duration_days || 90} يوم\n`;
        message += `   • تاريخ الدخول: ${(p.travel_date || '').replace(/-/g, '/')}\n`;
        message += `   • الأيام المتبقية: ${remaining !== null ? `${remaining} يوم` : '---'} ${alertIcon}\n`;
        message += `   • تاريخ الخروج: ${(p.expected_exit_date || '').replace(/-/g, '/')}\n\n`;
      });

      message += `----------------------------------------\n`;
      message += `⚠️ يرجى متابعة المعتمرين الذين اقترب موعد خروجهم لضمان سلاسة إجراءات السفر.`;
      message += agencySig;
    }

    setWhatsAppCustomText(message);
    setWhatsAppModalOpen(true);
  };

  // Launch WhatsApp with pre-filled message directly or activate Windows desktop app
  const handleSendWhatsApp = async () => {
    if (!whatsappAuthorized) {
      setWhatsappPermissionModalOpen(true);
      return;
    }

    if (whatsappFormat === "pdf") {
       alert("سيتم توليد وحفظ تقرير PDF لاختيار مسار حفظه وإرفاقه بالرسالة.");
       await handleExportToPdf(targetPaxForWhatsApp ? [targetPaxForWhatsApp] : (selectedCustomerId ? filteredPassengers : umrahPassengers));
    }

    let cleanPhone = (whatsAppPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      alert("يرجى إدخال رقم هاتف المستلم بصيغة صحيحة قبل الإرسال.");
      return;
    }

    if (cleanPhone.startsWith("0")) {
      cleanPhone = "966" + cleanPhone.slice(1);
    } else if (cleanPhone.length === 9) {
      cleanPhone = "966" + cleanPhone;
    }

    const encodedMsg = encodeURIComponent(whatsAppCustomText);
    const whatsappAppUri = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
    const whatsappWebUri = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

    // 1. Electron Desktop Environment: Activate installed Windows WhatsApp Application directly
    if (typeof window !== "undefined" && (window as any).electronAPI?.openExternal) {
      try {
        await (window as any).electronAPI.openExternal(whatsappAppUri);
      } catch (e) {
        await (window as any).electronAPI.openExternal(whatsappWebUri);
      }
    } else {
      // 2. Web Browser: Launch Protocol & Web WhatsApp
      try {
        const link = document.createElement("a");
        link.href = whatsappAppUri;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          window.open(whatsappWebUri, "_blank");
        }, 500);
      } catch (e) {
        window.open(whatsappWebUri, "_blank");
      }
    }

    setWhatsAppModalOpen(false);
  };

  // Automated batch sending with rate limiting and Windows/Electron background integration
  const handleAutoSendBatchWhatsApp = async () => {
    if (!whatsappAuthorized) {
      setWhatsappPermissionModalOpen(true);
      return;
    }

    let baseList = selectedCustomerId ? filteredPassengers : umrahPassengers;

    // Apply target group filter
    if (autoSendTargetGroup === "urgent_only") {
      baseList = baseList.filter(p => {
        const rem = p.remaining_days !== null && p.remaining_days !== undefined ? Number(p.remaining_days) : null;
        return rem !== null && rem <= 3;
      });
    } else if (autoSendTargetGroup === "warning_and_urgent") {
      baseList = baseList.filter(p => {
        const rem = p.remaining_days !== null && p.remaining_days !== undefined ? Number(p.remaining_days) : null;
        return rem !== null && rem <= 10;
      });
    }

    if (baseList.length === 0) {
      alert("لا توجد سجلات تطابق الفئة المحددة للإرسال الآلي.");
      return;
    }

    // Save configuration
    localStorage.setItem("pos_agency_whatsapp_sender", agencyWhatsAppSender);

    setWhatsAppModalOpen(false);
    setWhatsappBatchSending(true);
    setWhatsappBatchProgress({ 
      current: 0, 
      total: baseList.length, 
      status: "بدء حفظ الإعدادات وتنفيذ الأتمتة التلقائية في الخلفية...",
      successCount: 0,
      failCount: 0
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < baseList.length; i++) {
      const p = baseList[i];
      const rawPhone = p.phone || "";
      let cleanPhone = rawPhone.replace(/\D/g, "");

      if (!cleanPhone) {
        failCount++;
        setWhatsappBatchProgress(prev => ({
          ...prev,
          current: i + 1,
          failCount,
          status: `تخطي المعتمر ${p.name_ar || p.name_en} (لا يوجد رقم هاتف مسجل)`
        }));
        continue;
      }

      if (cleanPhone.startsWith("0")) {
        cleanPhone = "966" + cleanPhone.slice(1);
      } else if (cleanPhone.length === 9) {
        cleanPhone = "966" + cleanPhone;
      }

      const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? `${p.remaining_days} يوم` : 'غير محدد';
      const exitDate = (p.expected_exit_date || '').replace(/-/g, '/');
      const entryDate = (p.travel_date || '').replace(/-/g, '/');

      let msg = "";
      if (autoMessageTemplate === "urgent") {
        msg = `🔴 *تنبيه عاجل بمغادرة مكة المكرمة*\n` +
              `المعتمر الكريم: *${p.name_ar || p.name_en}*\n` +
              `رقم الجواز: ${p.passport_number || '---'}\n` +
              `المتبقي على انتهاء البرنامج: *${remaining}*\n` +
              `تاريخ المغادرة المتوقع: ${exitDate}\n` +
              `نرجو التواصل فوراً لتأكيد إجراءات السفر والعودة.\n` +
              `📞 الوكالة: ${agencyWhatsAppSender}`;
      } else {
        msg = `🕋 *تذكير متابعة تأشيرة العمرة - مكة المكرمة*\n` +
              `المعتمر الكريم: *${p.name_ar || p.name_en}*\n` +
              `رقم الجواز: ${p.passport_number || '---'}\n` +
              `تاريخ الدخول: ${entryDate} | المدة: ${p.program_duration_days || 90} يوم\n` +
              `الأيام المتبقية: *${remaining}* (تاريخ الخروج: ${exitDate})\n` +
              `تقبل الله طاعتكم ونتمنى لكم رحلة عودة آمنة.\n` +
              `📞 الوكالة: ${agencyWhatsAppSender}`;
      }

      const encodedMsg = encodeURIComponent(msg);
      const whatsappAppUri = `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}`;
      const whatsappWebUri = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

      let dispatchedOk = false;
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI?.openExternal) {
          try {
            await (window as any).electronAPI.openExternal(whatsappAppUri);
            dispatchedOk = true;
          } catch {
            await (window as any).electronAPI.openExternal(whatsappWebUri);
            dispatchedOk = true;
          }
        } else {
          const win = window.open(whatsappWebUri, "_blank");
          if (win && !win.closed) {
            dispatchedOk = true;
          } else {
            const a = document.createElement("a");
            a.href = whatsappWebUri;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              if (document.body.contains(a)) document.body.removeChild(a);
            }, 500);
            dispatchedOk = true;
          }
        }
      } catch (e) {
        dispatchedOk = false;
      }

      if (dispatchedOk) {
        successCount++;
      } else {
        failCount++;
      }

      setWhatsappBatchProgress({
        current: i + 1,
        total: baseList.length,
        successCount,
        failCount,
        status: `تم معالجة وإرسال تنبيه (${i + 1}/${baseList.length}) للمعتمر: ${p.name_ar || p.name_en}`
      });

      // Anti-ban safe delay between dispatches
      if (i < baseList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.max(2000, whatsappDelaySec * 1000)));
      }
    }

    setWhatsappBatchSending(false);
    if (failCount > 0) {
      alert(`اكتملت الأتمتة التلقائية:\n- إجمالي السجلات: ${baseList.length}\n- الناجحة: ${successCount}\n- المتعثرة: ${failCount}\n\nتنبيه: إذا تعذر إرسال بعض السجلات، يرجى التأكد من تشغيل تطبيق واتساب على جهازك والسماح بالنوافذ المنبثقة.`);
    } else {
      alert(`اكتملت الأتمتة التلقائية بنجاح:\n- إجمالي السجلات: ${baseList.length}\n- الناجحة: ${successCount}\n- تم إرسال وتوجيه كافة الرسائل لواتساب بنجاح ✓`);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-xl border shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <Luggage className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  إدارة المسافرين والجوازات
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    رقابة تأشيرات المعتمرين
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  تسجيل المسافرين، احتساب ومتابعة مدة البرنامج وتاريخ الخروج المتوقع للمعتمرين داخل مكة المكرمة بدقة عالية
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* WhatsApp Client Report Button */}
            <Button
              variant="outline"
              onClick={() => handleOpenWhatsAppDialog()}
              className="gap-2 font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-sm"
              title="إعدادات وأتمتة إرسال الواتساب للمسافرين والمعتمرين"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              إعدادات وأتمتة الواتساب
            </Button>

            {/* Test Time Immediate Dispatch Button */}
            <Button
              variant="outline"
              onClick={() => {
                setTargetPaxForWhatsApp(null);
                setWhatsAppModalOpen(true);
                toast({
                  title: "⚡ وضع اختبار وقت الأتمتة",
                  description: "تم فتح نافذة الأتمتة، يمكنك الضغط على 'اختبار وقت الإرسال الآن' للتشغيل الفوري اللحظي للمسافرين.",
                });
              }}
              className="gap-2 font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 shadow-sm"
              title="اختبار وقت الإرسال التلقائي ومراسلة المسافرين مؤتمتاً ولحظياً"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              اختبار وقت الإرسال الآن
            </Button>

            {/* Excel Export Button */}
            {/* PDF Export Button (Replacing Excel export as requested) */}
            <Button
              variant="outline"
              onClick={() => {
                if (activeTab === "all_passengers") {
                  handleExportPassengersDirectoryToPdf();
                } else {
                  handleExportToPdf();
                }
              }}
              className="gap-2 font-bold border-red-300 text-red-700 hover:bg-red-50 shadow-sm"
              title="توليد وتصدير ملف PDF معتمد للطباعة والحفظ"
            >
              <FileDown className="w-4 h-4 text-red-600" />
              تصدير PDF
            </Button>

            {/* PDF Import Button (Replacing Excel import as requested) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleDocumentFileUpload}
              accept=".pdf, .xlsx, .xls, .csv"
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingDocument}
              className="gap-2 font-bold border-rose-300 text-rose-700 hover:bg-rose-50 shadow-sm"
              title="استيراد قائمة مسافرين ومعتمرين من ملف PDF أو كشف جوازات"
            >
              <Upload className="w-4 h-4 text-rose-600" />
              {isParsingDocument ? "جاري قراءة مستند الـ PDF..." : "استيراد PDF"}
            </Button>

            {/* Full Screen Report Preview Button */}
            <Button
              variant="outline"
              onClick={() => {
                if (activeTab === "all_passengers") {
                  handleOpenFullScreenPreview("directory");
                } else {
                  handleOpenFullScreenPreview("visitors");
                }
              }}
              className="gap-2 font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50 shadow-sm"
              title="استعراض التقرير بشاشة كاملة مع التحكم بالتكبير والتصدير وتجنب مشاكل الطباعة"
            >
              <Maximize2 className="w-4 h-4 text-indigo-600" />
              استعراض بشاشة كاملة
            </Button>

            {/* Add Passenger Button */}
            <Button
              onClick={() => {
                resetForm();
                setModalOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white gap-2 font-black shadow-sm"
            >
              <Plus className="w-4 h-4" />
              إضافة تسجيل مسافر جديد
            </Button>
          </div>
        </div>

        {/* Real-Time WhatsApp Batch Sending Active Banner */}
        {whatsappBatchSending && (
          <div className="bg-emerald-800 text-white p-4 rounded-xl border border-emerald-700 shadow-md flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  جاري تنفيذ الأتمتة التلقائية الآمنة للإرسال عبر واتساب ({whatsappBatchProgress.current} من {whatsappBatchProgress.total})
                </h4>
                <p className="text-xs text-emerald-100 mt-0.5">{whatsappBatchProgress.status}</p>
              </div>
            </div>
            <div className="text-left text-xs font-mono font-bold bg-black/20 px-3 py-1.5 rounded-lg">
              ناجح: {whatsappBatchProgress.successCount} | تعذر: {whatsappBatchProgress.failCount}
            </div>
          </div>
        )}

        {/* Top Operational Monitor KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-emerald-300" onClick={() => setStatsModalType("totalUmrah")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي معتمري مكة (البرنامج)</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.totalUmrah}</h3>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">داخل مكة: {stats.inMakkah} معتمر</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFullScreenPreview("visitors", originalUmrahPassengers, "تقرير حالة الزائرين - إجمالي معتمري مكة (البرنامج)");
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors mt-2"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-3 h-3 text-emerald-700" />
                  استعراض الكشف
                </button>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Luggage className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/40 shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-red-400" onClick={() => setStatsModalType("urgent")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-600">إنذار خروج عاجل (≤ 3 أيام)</p>
                <h3 className="text-2xl font-black text-red-700 mt-1">{stats.urgentCount}</h3>
                <p className="text-xs text-red-600/80 font-semibold mt-0.5">يتطلب تأكيد المغادرة فوراً</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const urgentList = originalUmrahPassengers.filter(p => {
                      const rem = getPaxRemainingDays(p);
                      return rem !== null && rem <= 3;
                    });
                    handleOpenFullScreenPreview("visitors", urgentList, "تقرير حالة الزائرين - إنذار خروج عاجل (≤ 3 أيام)");
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/90 hover:bg-red-200 px-2 py-0.5 rounded transition-colors mt-2"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-3 h-3 text-red-700" />
                  استعراض الكشف
                </button>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-700">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/40 shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-amber-400" onClick={() => setStatsModalType("warning")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600">اقتراب موعد الخروج (4 - 10 أيام)</p>
                <h3 className="text-2xl font-black text-amber-700 mt-1">{stats.warningCount}</h3>
                <p className="text-xs text-amber-600/80 font-semibold mt-0.5">تجهيز وترتيب حجوزات العودة</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const warningList = originalUmrahPassengers.filter(p => {
                      const rem = getPaxRemainingDays(p);
                      return rem !== null && rem > 3 && rem <= 10;
                    });
                    handleOpenFullScreenPreview("visitors", warningList, "تقرير حالة الزائرين - اقتراب موعد الخروج (4 - 10 أيام)");
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/90 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors mt-2"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-3 h-3 text-amber-700" />
                  استعراض الكشف
                </button>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-indigo-400" onClick={() => setStatsModalType("warning_15")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-600">إنذار خروج (15 يوم)</p>
                <h3 className="text-2xl font-black text-indigo-700 mt-1">{stats.warning15Count}</h3>
                <p className="text-xs text-indigo-600/80 font-semibold mt-0.5">إشعار واستعداد (11 - 15 يوم)</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const warning15List = originalUmrahPassengers.filter(p => {
                      const rem = getPaxRemainingDays(p);
                      return rem !== null && rem > 10 && rem <= 15;
                    });
                    handleOpenFullScreenPreview("visitors", warning15List, "تقرير حالة الزائرين - إنذار خروج 15 يوم (11 - 15 يوم)");
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded transition-colors mt-2"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-3 h-3 text-indigo-700" />
                  استعراض الكشف
                </button>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <BellRing className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow cursor-pointer hover:border-blue-300" onClick={() => setStatsModalType("totalPassengers")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي المسافرين بالنظام</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.totalPassengers}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">شامل كافة الرحلات والتأشيرات</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFullScreenPreview("visitors", filteredPassengers, "تقرير حالة الزائرين - إجمالي المسافرين بالنظام");
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded transition-colors mt-2"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-3 h-3 text-blue-700" />
                  استعراض الكشف
                </button>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <User className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("umrah_monitor")}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${
              activeTab === "umrah_monitor"
                ? "border-emerald-600 text-emerald-700 bg-emerald-50/30 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            شاشة الرقابة على أيام المعتمرين بمكة
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-black">
              {umrahPassengers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("visitors_report")}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${
              activeTab === "visitors_report"
                ? "border-primary text-primary bg-primary/5 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Printer className="w-4 h-4" />
            معاينة تقرير حالة الزائرين (A4 PDF)
          </button>

          <button
            onClick={() => setActiveTab("all_passengers")}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-colors ${
              activeTab === "all_passengers"
                ? "border-slate-800 text-slate-900 bg-slate-100/50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Luggage className="w-4 h-4" />
            سجل كافة المسافرين
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {passengers.length}
            </span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <Input
                placeholder="بحث باسم المعتمر، رقم الجواز، الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 text-sm"
              />
            </div>

            {/* Filter by Customer / Agent */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="h-9 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">كافة العملاء والوكلاء</option>
                {allCustomerOptions.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.label || c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كافة الحالات</option>
              <option value="داخل مكة">داخل مكة المكرمة</option>
              <option value="مغادر">غادر</option>
              <option value="متأخر">متأخر عن الخروج</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 shadow-xs">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">فئة المعتمرين المستهدفين:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="h-7 px-2 rounded border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="all">كافة المسافرين ({originalUmrahPassengers.length})</option>
                <option value="warning_15">فترة الإشعار المبكر (≤ 15 يوم)</option>
                <option value="warning">الإنذار والاقتراب فقط (≤ 10 أيام)</option>
                <option value="urgent">الحالات العاجلة فقط (≤ 3 أيام)</option>
                <option value="overstayed">المتجاوزون (المتأخرون عن المغادرة)</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1 text-xs font-bold text-slate-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث
            </Button>
          </div>
        </div>

        {/* TAB 1: UMRAH MONITOR (الرقابة على أيام المعتمرين بمكة) */}
        {activeTab === "umrah_monitor" && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-emerald-600" />
                  جدول الرقابة والمتابعة اليومية لمعتمري مكة المكرمة
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  احتساب آلي للمدة المتبقية وتاريخ الخروج المتوقع بناءً على تاريخ السفر وفترة البرنامج
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenFullScreenPreview("visitors", umrahPassengers)}
                  className="gap-1.5 text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  title="استعراض جدول الرقابة بشاشة كاملة مع خيارات التكبير والطباعة الآمنة"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  استعراض بشاشة كاملة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportToPdf(umrahPassengers)}
                  className="gap-1.5 text-xs font-bold border-red-300 text-red-700 hover:bg-red-50"
                  title="تصدير وحفظ التقرير كملف PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-red-600" />
                  تصدير PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePrintVisitorsReport(umrahPassengers)}
                  className="gap-1.5 text-xs font-bold border-slate-300"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  طباعة A4
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenWhatsAppDialog()}
                  className="gap-1.5 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  واتساب
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">الاسم بالعربي</th>
                      <th className="py-3 px-4">الاسم بالإنجليزي</th>
                      <th className="py-3 px-4">رقم الجواز</th>
                      <th className="py-3 px-4">الجنسية</th>
                      <th className="py-3 px-4">نوع التأشيرة</th>
                      <th className="py-3 px-4 text-center">حالة المعتمر</th>
                      <th className="py-3 px-4 text-center">ملاحظات</th>
                      <th className="py-3 px-4 text-center">مدة السفر</th>
                      <th className="py-3 px-4 text-center">تاريخ الدخول</th>
                      <th className="py-3 px-4 text-center">الأيام المنقضية</th>
                      <th className="py-3 px-4 text-center">الأيام المتبقية</th>
                      <th className="py-3 px-4 text-center">تاريخ الخروج المتوقع</th>
                      <th className="py-3 px-4">رقم الهاتف</th>
                      <th className="py-3 px-4">العميل / الوكيل</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isLoading ? (
                      <tr>
                        <td colSpan={16} className="text-center py-8 text-slate-400">جاري تحميل بيانات المعتمرين...</td>
                      </tr>
                    ) : umrahPassengers.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="text-center py-10 text-slate-400">
                          لا يوجد معتمرين مسجلين حالياً. اضغط على "إضافة تسجيل مسافر جديد" لإضافة أول معتمر.
                        </td>
                      </tr>
                    ) : (
                      umrahPassengers.map((p, idx) => {
                        const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? Number(p.remaining_days) : null;
                        const daysSpent = calcDaysSpent(p.travel_date);
                        
                        const isRed = daysSpent >= 80;
                        const isYellow = daysSpent >= 70 && daysSpent < 80;
                        
                        const isUrgent = remaining !== null && remaining <= 3;
                        const isWarning = remaining !== null && remaining > 3 && remaining <= 10;
                        const isSafe = remaining !== null && remaining > 10;
                        const isOverstayed = remaining !== null && remaining < 0;

                        return (
                          <tr 
                            key={p.id} 
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isRed ? "bg-[#ffd2d2]! text-black font-semibold" : isYellow ? "bg-[#ffff00]! text-black font-semibold" : isUrgent ? "bg-red-50/40" : isWarning ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{p.name_ar}</td>
                            <td className="py-3 px-4 text-slate-600 font-mono">{p.name_en || "---"}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700">
                              {p.passport_number || "---"}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{p.nationality || "يمني"}</td>
                            <td className="py-3 px-4 text-slate-600">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border">
                                {p.visa_type || "تأشيرة عمره"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-1 rounded text-[11px] font-bold ${p.travel_status === "داخل مكة" ? "bg-indigo-100 text-indigo-800" : p.travel_status === "غادر" ? "bg-emerald-100 text-emerald-800" : p.travel_status === "مخالف" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                                {p.travel_status || "غير محدد"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-[11px] text-slate-500 max-w-[120px] truncate" title={p.notes}>
                              {p.notes || "---"}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-mono text-xs font-extrabold border border-slate-200">
                                {p.program_duration_days || 90} يوم
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-700 font-semibold">
                              {(p.travel_date || "---").replace(/-/g, "/")}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-blue-900 font-mono">
                              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-md text-xs">
                                {calcDaysSpent(p.travel_date)} يوم
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {remaining === null ? (
                                <span className="text-slate-400">---</span>
                              ) : isOverstayed ? (
                                <span className="bg-red-600 text-white font-black px-2.5 py-1 rounded-full text-xs animate-pulse">
                                  متجاوز ({Math.abs(remaining)} يوم)
                                </span>
                              ) : isUrgent ? (
                                <span className="bg-red-100 text-red-700 border border-red-300 font-black px-3 py-1 rounded-full text-xs flex items-center justify-center gap-1 mx-auto w-max">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {remaining} أيام (عاجل)
                                </span>
                              ) : isWarning ? (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1 rounded-full text-xs">
                                  {remaining} أيام
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-full text-xs">
                                  {remaining} يوم
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                              {(p.expected_exit_date || "---").replace(/-/g, "/")}
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-600" dir="ltr">
                              {p.phone || "---"}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                              {p.customer_name || "محمد اليمني"}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExportToPdf([p], p.customer_name || currentCustomerName)}
                                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  title="طباعة وتصدير PDF لهذا المعتمر"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenWhatsAppDialog(p)}
                                  className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                  title="إرسال تذكير واتساب للمعتمر"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(p)}
                                  className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                  title="تعديل بيانات المعتمر"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("هل أنت متأكد من حذف هذا السجل؟")) {
                                      deleteMutation.mutate(p.id);
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  title="حذف"
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
            </CardContent>
          </Card>
        )}

        {/* TAB 2: VISITORS REPORT PREVIEW (معاينة تقرير حالة الزائرين) */}
        {activeTab === "visitors_report" && (
          <div className="space-y-4">
            {/* Report Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">تاريخ التقرير:</span>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-8 w-40 text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenWhatsAppDialog()}
                  className="gap-1.5 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  إرسال للعميل عبر WhatsApp
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleOpenFullScreenPreview("visitors")}
                  className="gap-1.5 text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  title="استعراض التقرير بشاشة كاملة ومعاينة تفصيلية قبل الطباعة بدون أخطاء"
                >
                  <Maximize2 className="w-4 h-4 text-indigo-600" />
                  استعراض بشاشة كاملة
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleExportToPdf()}
                  className="gap-1.5 text-xs font-bold border-red-300 text-red-700 hover:bg-red-50"
                  title="تصدير وحفظ التقرير كملف PDF"
                >
                  <FileDown className="w-4 h-4 text-red-600" />
                  تصدير PDF
                </Button>

                <Button
                  onClick={() => handlePrintVisitorsReport()}
                  className="bg-primary hover:bg-primary/90 text-white gap-2 font-black text-xs shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  طباعة التقرير A4 (Print)
                </Button>
              </div>
            </div>

            {/* A4 Paper Screen Representation Matching User Image Exactly */}
            <div className="bg-slate-100 p-4 sm:p-8 rounded-xl border border-slate-200 flex justify-center">
              <div className="bg-white p-8 sm:p-12 w-full max-w-[850px] shadow-lg rounded-sm border border-slate-300 font-sans text-black">
                {/* Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-black mb-2 tracking-tight">تقرير حالة الزائرين</h2>
                  <div className="text-base font-bold text-black mb-1">العميل {currentCustomerName}</div>
                  <div className="text-sm font-bold text-black">التاريخ : {reportDate.replace(/-/g, "/")}</div>
                </div>

                {/* Table matching user screenshot format */}
                <table className="w-full border-collapse border-[1.5px] border-black text-center text-sm">
                  <thead>
                    <tr className="border-b-[1.5px] border-black bg-white">
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold text-right">اسم المعتمر</th>
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold">رقم الجواز</th>
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold">النوع</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">مدة السفر<br/>(فترة البرنامج)</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">تاريخ الدخول<br/>(السفر)</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">الأيام المنقضية<br/>داخل مكة</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">الأيام المتبقية<br/>على الخروج</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">تاريخ الخروج<br/>المتوقع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCustomerId ? filteredPassengers : umrahPassengers).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="border-[1.5px] border-black py-6 text-slate-500">لا يوجد بيانات للعرض</td>
                      </tr>
                    ) : (
                      (selectedCustomerId ? filteredPassengers : umrahPassengers).map((p) => {
                        const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? p.remaining_days : "---";
                        const daysSpent = calcDaysSpent(p.travel_date);
                        const isRed = daysSpent >= 80;
                        const isYellow = daysSpent >= 70 && daysSpent < 80;
                        const rowBgClass = isRed ? "bg-[#ffd2d2]! text-black font-semibold" : isYellow ? "bg-[#ffff00]! text-black font-semibold" : "";
                        return (
                          <tr key={p.id} className={`border-b-[1.5px] border-black ${rowBgClass}`}>
                            <td className="border-[1.5px] border-black py-2.5 px-3 font-bold text-right text-black">{p.name_ar || p.name_en}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-3 font-mono font-bold text-black">{p.passport_number || "---"}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-3 text-black">{p.visa_type || "تأشيرة عمره"}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-black">{p.program_duration_days || 90} يوم</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-mono text-black">{(p.travel_date || "---").replace(/-/g, "/")}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-blue-900 font-mono">{daysSpent} يوم</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-black">{remaining}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-mono text-black">{(p.expected_exit_date || "---").replace(/-/g, "/")}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
                  <div>إجمالي عدد المعتمرين: <strong>{(selectedCustomerId ? filteredPassengers : umrahPassengers).length}</strong></div>
                  <div>نظام متابعة تأشيرات المعتمرين والرقابة</div>
                  <div>صفحة 1 من 1</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ALL PASSENGERS (سجل كافة المسافرين) */}
        {activeTab === "all_passengers" && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-200 p-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  سجل المسافرين العام
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  كافة المسافرين المسجلين في النظام مع بيانات الجوازات والرحلات
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenFullScreenPreview("directory", filteredPassengers)}
                  className="gap-1.5 text-xs font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  title="استعراض سجل المسافرين والجوازات بشاشة كاملة قبل الطباعة"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  استعراض بشاشة كاملة
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportPassengersDirectoryToPdf(filteredPassengers)}
                  className="gap-1.5 text-xs font-bold border-red-300 text-red-700 hover:bg-red-50"
                  title="توليد وتصدير سجل الجوازات والمسافرين كملف PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-red-600" />
                  تصدير سجل الجوازات PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs font-bold border-b border-slate-200">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">الاسم بالعربي</th>
                      <th className="py-3 px-4">الاسم بالإنجليزي</th>
                      <th className="py-3 px-4">رقم الجواز</th>
                      <th className="py-3 px-4">الجنسية</th>
                      <th className="py-3 px-4">نوع التأشيرة</th>
                      <th className="py-3 px-4 text-center">حالة المعتمر</th>
                      <th className="py-3 px-4 text-center">ملاحظات</th>
                      <th className="py-3 px-4">مدة السفر</th>
                      <th className="py-3 px-4">تاريخ الدخول</th>
                      <th className="py-3 px-4">الأيام المنقضية</th>
                      <th className="py-3 px-4">رقم الهاتف</th>
                      <th className="py-3 px-4">العميل / الوكيل</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredPassengers.map((p, idx) => {
                    const daysSpent = calcDaysSpent(p.travel_date);
                    const rowClass = daysSpent >= 80 ? "bg-[#ffd2d2]! text-black font-semibold" : daysSpent >= 70 ? "bg-[#ffff00]! text-black font-semibold" : "";
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${rowClass}`}>
                          <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{p.name_ar}</td>
                          <td className="py-3 px-4 text-slate-600 font-mono">{p.name_en}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">{p.passport_number || "---"}</td>
                          <td className="py-3 px-4 text-slate-600">{p.nationality || "يمني"}</td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border">
                              {p.visa_type || "تأشيرة عمره"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-[11px] font-bold ${p.travel_status === "داخل مكة" ? "bg-indigo-100 text-indigo-800" : p.travel_status === "غادر" ? "bg-emerald-100 text-emerald-800" : p.travel_status === "مخالف" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                              {p.travel_status || "غير محدد"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-[11px] text-slate-500 max-w-[120px] truncate" title={p.notes}>
                            {p.notes || "---"}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 text-center">
                            {p.program_duration_days ? `${p.program_duration_days} يوم` : "---"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-center">
                            {p.travel_date ? p.travel_date.replace(/-/g, "/") : "---"}
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-900 text-center font-mono">
                            {calcDaysSpent(p.travel_date)} يوم
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">{p.phone || "---"}</td>
                          <td className="py-3 px-4 text-slate-700 font-semibold">{p.customer_name || "---"}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenFullScreenPreview("single", p)}
                                className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50"
                                title="استعراض بطاقة الجواز والمسافر بشاشة كاملة"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportSinglePassengerToPdf(p)}
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                              title="تصدير بطاقة المسافر والجواز كملف PDF"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenWhatsAppDialog(p)}
                              className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50"
                              title="إرسال وأتمتة الواتساب لهذا المسافر (نص / PDF / جدولة)"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(p)}
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا المسافر؟")) {
                                  deleteMutation.mutate(p.id);
                                }
                              }}
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 1. ADD / EDIT PASSENGER MODAL WITH REAL-TIME STAY CALCULATION */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Luggage className="w-5 h-5 text-primary" />
                {editingPax ? "تعديل بيانات المسافر والمعتمر" : "إضافة تسجيل مسافر جديد"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                أدخل بيانات المعتمر والجواز مع تحديد مدة البرنامج وتاريخ السفر ليتم احتساب تاريخ الخروج والأيام المتبقية آلياً
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
              {/* Right Column: Program details & Live Calculation */}
              <div className="space-y-5">
                {/* Client & Visa Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <label className="text-xs font-black text-slate-700 mb-1.5 block">العميل / الوكيل التابع له</label>
                    <select
                      value={form.customer_id}
                      onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">اختر العميل من دليل الحسابات (افتراضي: محمد اليمني)</option>
                      {allCustomerOptions.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.label || c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700 mb-1.5 block">نوع التأشيرة</label>
                    <select
                      value={form.visa_type}
                      onChange={(e) => setForm({ ...form, visa_type: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="تأشيرة عمره">تأشيرة عمره (متابعة أيام مكة)</option>
                      <option value="تأشيرة سياحية">تأشيرة سياحية</option>
                      <option value="تأشيرة زيارة">تأشيرة زيارة</option>
                      <option value="تأشيرة عمل">تأشيرة عمل</option>
                      <option value="تأشيرة علاجية">تأشيرة علاجية</option>
                    </select>
                  </div>
                </div>

                {/* CORE STAY & MONITORING SECTION (مدة البرنامج وتاريخ السفر والاحتساب التفاعلي) */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border-2 border-emerald-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="text-sm font-black text-emerald-900 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-emerald-700" />
                      بيانات الرقابة والمدة داخل مكة المكرمة
                    </span>
                    <span className="text-[11px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                      احتساب فوري مباشر
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Field 1: مدة البرنامج بالأيام (يدوي) */}
                    <div>
                      <label className="text-xs font-black text-emerald-950 mb-1 flex items-center justify-between">
                        <span>مدة البرنامج (بالأيام يدوي) *</span>
                        <span className="text-[10px] text-emerald-700 font-bold">أدخل الأيام يدوياً</span>
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="مثال: 90 أو 86 أو 85"
                          value={form.program_duration_days}
                          onChange={(e) => setForm({ ...form, program_duration_days: e.target.value })}
                          className="font-bold text-base h-11 border-emerald-300 bg-white focus:border-emerald-500 focus:ring-emerald-200"
                          min="1"
                          max="365"
                        />
                        <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">يوم</span>
                      </div>

                      {/* Quick Selection Buttons */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-500 font-bold">اختيار سريع:</span>
                        {["86", "90", "85", "30", "15"].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setForm({ ...form, program_duration_days: d })}
                            className={`text-[11px] px-2 py-0.5 rounded border font-bold transition-colors ${
                              form.program_duration_days === d
                                ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                                : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                            }`}
                          >
                            {d} يوم
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Field 2: تاريخ السفر (تاريخ الدخول) */}
                    <div>
                      <label className="text-xs font-black text-emerald-950 mb-1 flex items-center justify-between">
                        <span>تاريخ السفر (تاريخ الدخول) *</span>
                        <span className="text-[10px] text-emerald-700 font-bold">تاريخ الوصول إلى مكة</span>
                      </label>
                      <Input
                        type="date"
                        value={form.travel_date}
                        onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
                        className="font-bold text-base h-11 border-emerald-300 bg-white focus:border-emerald-500 focus:ring-emerald-200"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">تاريخ دخول المعتمر الفعلي</p>
                    </div>
                  </div>

                  {/* Live Calculated Results Box */}
                  {form.travel_date && form.program_duration_days && (
                    <div className="bg-white p-3.5 rounded-lg border border-emerald-300 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">
                        <span className="text-[10px] font-bold text-slate-500 block">تاريخ الخروج المتوقع</span>
                        <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                          {liveExitDate.replace(/-/g, "/") || "---"}
                        </span>
                      </div>

                      <div className={`p-2.5 rounded border text-center ${
                        liveRemainingDays !== null && liveRemainingDays <= 3 
                          ? "bg-red-50 border-red-300 text-red-800" 
                          : liveRemainingDays !== null && liveRemainingDays <= 10
                          ? "bg-amber-50 border-amber-300 text-amber-800"
                          : "bg-emerald-50 border-emerald-300 text-emerald-800"
                      }`}>
                        <span className="text-[10px] font-bold block">الأيام المتبقية على الخروج</span>
                        <span className="text-base font-black font-mono block mt-0.5">
                          {liveRemainingDays !== null ? `${liveRemainingDays} يوم` : "---"}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-center">
                        <span className="text-[10px] font-bold text-slate-500 block">الأيام المنقضية داخل مكة</span>
                        <span className="text-base font-black text-blue-900 font-mono block mt-0.5">
                          {liveDaysSpent} يوم
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Left Column: Personal details & notes */}
              <div className="space-y-4">
                {/* Personal & Passport Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">اسم المعتمر / المسافر (بالعربي) *</label>
                    <Input
                      placeholder="مثال: علي عبدالله علي الشهابي"
                      value={form.name_ar}
                      onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                      className="font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">الاسم بالإنجليزية (حسب الجواز) *</label>
                    <Input
                      placeholder="Ali Abdullah Ali Al-Shehabi"
                      value={form.name_en}
                      onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                      dir="ltr"
                      className="font-mono text-left font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">رقم الجواز *</label>
                    <Input
                      placeholder="مثال: 14800339"
                      value={form.passport_number}
                      onChange={(e) => setForm({ ...form, passport_number: e.target.value })}
                      className="font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">الجنسية</label>
                    <Input
                      placeholder="يمني"
                      value={form.nationality}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">رقم الواتساب الفعال (مطلوب للتنبيهات) *</label>
                    <Input
                      placeholder="مثال: 966500000000 أو 0555123456"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      dir="ltr"
                      className="font-mono text-left font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">حالة المعتمر</label>
                    <select
                      value={form.travel_status}
                      onChange={(e) => setForm({ ...form, travel_status: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-800"
                    >
                      <option value="داخل مكة">داخل مكة المكرمة</option>
                      <option value="مغادر">غادر المملكة</option>
                      <option value="متأخر">متأخر عن الخروج</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ملاحظات إضافية</label>
                  <Input
                    placeholder="ملاحظات عن السكن، الفندق، النقل، جهة الاستقبال..."
                    value={form.special_notes}
                    onChange={(e) => setForm({ ...form, special_notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (!form.name_ar?.trim() && !form.name_en?.trim()) {
                    alert("يرجى إدخال اسم المسافر (بالعربي أو بالإنجليزي)");
                    return;
                  }
                  saveMutation.mutate(form);
                }}
                disabled={saveMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white font-black"
              >
                {saveMutation.isPending ? "جاري الحفظ..." : editingPax ? "تحديث السجل" : "حفظ وتسجيل المسافر"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. FULL-SCREEN VISITORS REPORT & PRINT PREVIEW MODAL */}
        <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
          <DialogContent className={`${isFullScreen ? "max-w-full h-screen w-screen m-0 rounded-none" : "max-w-5xl max-h-[92vh]"} overflow-y-auto p-0`} dir="rtl">
            {/* Header Control Toolbar */}
            <div className="sticky top-0 z-20 bg-slate-900 text-white p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-black text-white">استعراض ومعاينة تقرير حالة الزائرين (A4)</h3>
                  <p className="text-[11px] text-slate-300">مطابق تماماً للتنسيق الرسمي المعتمد</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 text-xs text-white">
                  <button
                    onClick={() => setPreviewZoom(Math.max(70, previewZoom - 10))}
                    className="px-2 py-1 hover:bg-slate-700 rounded"
                    title="تصغير"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono font-bold text-[11px]">{previewZoom}%</span>
                  <button
                    onClick={() => setPreviewZoom(Math.min(140, previewZoom + 10))}
                    className="px-2 py-1 hover:bg-slate-700 rounded"
                    title="تكبير"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Toggle Fullscreen */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="text-white hover:bg-slate-800 h-8 px-2.5 text-xs"
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>

                {/* WhatsApp Button */}
                <Button
                  size="sm"
                  onClick={() => handleOpenWhatsAppDialog()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  إرسال للواتساب
                </Button>

                {/* Export PDF Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportToPdf()}
                  className="bg-red-700 hover:bg-red-600 text-white border-red-600 gap-1.5 text-xs font-bold"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  تصدير PDF
                </Button>

                {/* Direct Print Button */}
                <Button
                  size="sm"
                  onClick={() => handlePrintVisitorsReport()}
                  className="bg-primary hover:bg-primary/90 text-white gap-1.5 text-xs font-black shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  طباعة فورية (Print A4)
                </Button>

                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReportModalOpen(false)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Document Body */}
            <div className="p-6 bg-slate-200 flex justify-center min-h-[500px]">
              <div 
                style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: "top center" }}
                className="bg-white p-10 w-full max-w-[850px] shadow-2xl rounded-sm border border-slate-400 font-sans text-black transition-transform"
              >
                {/* Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-black mb-2 tracking-tight">تقرير حالة الزائرين</h2>
                  <div className="text-base font-bold text-black mb-1">العميل {currentCustomerName}</div>
                  <div className="text-sm font-bold text-black">التاريخ : {reportDate.replace(/-/g, "/")}</div>
                </div>

                {/* Table matching user screenshot format */}
                <table className="w-full border-collapse border-[1.5px] border-black text-center text-sm">
                  <thead>
                    <tr className="border-b-[1.5px] border-black bg-white">
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold text-right">اسم المعتمر</th>
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold">رقم الجواز</th>
                      <th className="border-[1.5px] border-black py-2.5 px-3 font-bold">النوع</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">مدة السفر<br/>(فترة البرنامج)</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">تاريخ الدخول<br/>(السفر)</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">الأيام المنقضية<br/>داخل مكة</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">الأيام المتبقية<br/>على الخروج</th>
                      <th className="border-[1.5px] border-black py-2.5 px-2 font-bold leading-tight">تاريخ الخروج<br/>المتوقع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCustomerId ? filteredPassengers : umrahPassengers).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="border-[1.5px] border-black py-6 text-slate-500">لا يوجد بيانات للعرض</td>
                      </tr>
                    ) : (
                      (selectedCustomerId ? filteredPassengers : umrahPassengers).map((p) => {
                        const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? p.remaining_days : "---";
                        const daysSpent = calcDaysSpent(p.travel_date);
                        const isRed = daysSpent >= 80;
                        const isYellow = daysSpent >= 70 && daysSpent < 80;
                        const rowBgClass = isRed ? "bg-[#ffd2d2]! text-black font-semibold" : isYellow ? "bg-[#ffff00]! text-black font-semibold" : "";
                        return (
                          <tr key={p.id} className={`border-b-[1.5px] border-black ${rowBgClass}`}>
                            <td className="border-[1.5px] border-black py-2.5 px-3 font-bold text-right text-black">{p.name_ar || p.name_en}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-3 font-mono font-bold text-black">{p.passport_number || "---"}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-3 text-black">{p.visa_type || "تأشيرة عمره"}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-black">{p.program_duration_days || 90} يوم</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-mono text-black">{(p.travel_date || "---").replace(/-/g, "/")}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-blue-900 font-mono">{daysSpent} يوم</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-bold text-black">{remaining}</td>
                            <td className="border-[1.5px] border-black py-2.5 px-2 font-mono text-black">{(p.expected_exit_date || "---").replace(/-/g, "/")}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
                  <div>إجمالي عدد المعتمرين: <strong>{(selectedCustomerId ? filteredPassengers : umrahPassengers).length}</strong></div>
                  <div>نظام متابعة تأشيرات المعتمرين والرقابة</div>
                  <div>صفحة 1 من 1</div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 3. WHATSAPP PRO AUTOMATION MODAL */}
        <WhatsAppAutomationModal
          open={whatsAppModalOpen}
          onOpenChange={setWhatsAppModalOpen}
          targetPax={targetPaxForWhatsApp}
          allPassengers={selectedCustomerId ? filteredPassengers : umrahPassengers}
          selectedCustomerId={selectedCustomerId}
          currentCustomerName={currentCustomerName}
          onBatchComplete={(result) => {
            setWhatsappSuccessCount(result.successCount);
            setWhatsappSkippedList(result.skippedDetails || []);
            setWhatsappSuccessList(result.successList || []);
            setWhatsappSkippedModalOpen(true);
            if (result.successCount > 0 && result.skippedCount === 0) {
              toast({
                title: "تم اكتمال أتمتة الواتساب بنجاح 100% ✓",
                description: `تم إنجاز إرسال التنبيهات وحفظ ملفات الـ PDF لـ ${result.successCount} مسافر دون أية أخطاء.`,
              });
            }
          }}
          onEditPassenger={(paxId) => {
            const found = passengers.find((p: any) => String(p.id) === String(paxId));
            if (found) {
              handleEdit(found);
            }
          }}
        />

        {/* 3.1 WHATSAPP FULL AUTOMATION & SKIPPED REPORT MODAL */}
        <WhatsAppSkippedModal
          open={whatsappSkippedModalOpen}
          onOpenChange={setWhatsappSkippedModalOpen}
          skippedList={whatsappSkippedList}
          successCount={whatsappSuccessCount}
          successList={whatsappSuccessList}
          onEditPassenger={(paxId) => {
            const found = passengers.find((p: any) => String(p.id) === String(paxId));
            if (found) {
              handleEdit(found);
            }
          }}
        />

        {/* 4. PDF & DOCUMENT IMPORT PREVIEW & CONFIRMATION MODAL */}
        <Dialog open={excelImportModalOpen} onOpenChange={setExcelImportModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                استيراد بيانات المسافرين والمعتمرين من ملف PDF
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                معاينة السجلات المستخرجة من المستند ({importedRows.length} مسافر) واحتساب التواريخ والأيام المتبقية تلقائياً قبل الحفظ
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-rose-50/60 p-3 rounded-lg border border-rose-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-rose-600" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">
                      تم استخراج {importedRows.length} مسافر بنجاح {uploadedFileName ? `من ملف: ${uploadedFileName}` : "من مستند PDF"}
                    </h4>
                    <p className="text-[11px] text-rose-700">تم احتساب تواريخ الخروج المتوقعة والأيام المتبقية تلقائياً لكل مسافر</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadSamplePdf}
                    className="text-xs font-bold border-rose-300 text-rose-800 hover:bg-rose-100 gap-1.5"
                    title="تحميل وطباعة نموذج كشف وبيان ركاب فارغ"
                  >
                    <Download className="w-3.5 h-3.5" />
                    نموذج PDF فارغ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
                    title="تغيير الملف ورفع ملف PDF آخر"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    رفع ملف آخر
                  </Button>
                </div>
              </div>

              {/* Destination Customer Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">تعيين العميل / الوكيل لكافة السجلات المستوردة (اختياري)</label>
                <select
                  value={importCustomerId}
                  onChange={(e) => setImportCustomerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-xs font-bold bg-white text-slate-800"
                >
                  <option value="">استخدام العميل المحدد بالملف (أو محمد اليمني)</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-72">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">اسم المعتمر</th>
                      <th className="py-2.5 px-3">رقم الجواز</th>
                      <th className="py-2.5 px-3 text-center">البرنامج</th>
                      <th className="py-2.5 px-3 text-center">تاريخ الدخول</th>
                      <th className="py-2.5 px-3 text-center">تاريخ الخروج المتوقع</th>
                      <th className="py-2.5 px-3 text-center">الأيام المتبقية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{row.name_ar || row.name_en}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{row.passport_number || "---"}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">{row.program_duration_days} يوم</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">{(row.travel_date || "---").replace(/-/g, "/")}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">{(row.expected_exit_date || "---").replace(/-/g, "/")}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">{row.remaining_days !== null ? `${row.remaining_days} يوم` : "---"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setExcelImportModalOpen(false)}>إلغاء</Button>
              <Button
                onClick={() => {
                  bulkImportMutation.mutate({
                    passengers: importedRows,
                    customer_id: importCustomerId ? Number(importCustomerId) : undefined
                  });
                }}
                disabled={bulkImportMutation.isPending || importedRows.length === 0}
                className="bg-rose-700 hover:bg-rose-600 text-white font-black gap-1.5"
              >
                <Check className="w-4 h-4" />
                {bulkImportMutation.isPending ? "جاري الاستيراد والحفظ..." : `تأكيد واستيراد ${importedRows.length} مسافر`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full-Screen Professional Report Viewer Modal (Zero-error print/PDF preview) */}

        <Dialog open={!!statsModalType} onOpenChange={(open) => !open && setStatsModalType(null)}>
          <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-800">
                {statsModalType === "totalUmrah" && "إجمالي معتمري مكة (البرنامج)"}
                {statsModalType === "urgent" && "المعتمرون الذين اقترب موعد خروجهم (إنذار عاجل ≤ 3 أيام)"}
                {statsModalType === "warning" && "المعتمرون الذين اقترب موعد خروجهم (تنبيه مسبق 4 - 10 أيام)"}
                {statsModalType === "warning_15" && "المعتمرون في فترة إنذار الخروج (11 - 15 يوم)"}
                {statsModalType === "totalPassengers" && "إجمالي المسافرين بالنظام"}
                <span className="mr-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{statsModalData.length} مسافر</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm text-right border-collapse whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-sm z-10">
                  <tr className="text-xs">
                    <th className="py-3 px-4 border-b border-slate-200">#</th>
                    <th className="py-3 px-4 border-b border-slate-200">الاسم بالعربي</th>
                    <th className="py-3 px-4 border-b border-slate-200">الاسم بالإنجليزي</th>
                    <th className="py-3 px-4 border-b border-slate-200">رقم الجواز</th>
                    <th className="py-3 px-4 border-b border-slate-200">الجنسية</th>
                    <th className="py-3 px-4 border-b border-slate-200">نوع التأشيرة</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">حالة المعتمر</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">ملاحظات</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">مدة السفر</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">تاريخ الدخول</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">الأيام المنقضية</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">الأيام المتبقية</th>
                    <th className="py-3 px-4 border-b border-slate-200 text-center">الخروج المتوقع</th>
                    <th className="py-3 px-4 border-b border-slate-200">رقم الهاتف</th>
                    <th className="py-3 px-4 border-b border-slate-200">العميل / الوكيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  { [...statsModalData].sort((a, b) => calcDaysSpent(b.travel_date) - calcDaysSpent(a.travel_date)).map((p, idx) => {
                    const remaining = p.remaining_days !== null && p.remaining_days !== undefined ? Number(p.remaining_days) : null;
                    const daysSpent = calcDaysSpent(p.travel_date);
                    const rowClass = daysSpent >= 80 ? "bg-[#ffd2d2]! text-black font-semibold" : daysSpent >= 70 ? "bg-[#ffff00]! text-black font-semibold" : "";
                    
                    const alertBadge = remaining !== null && remaining <= 3 
                      ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold">عاجل</span>
                      : remaining !== null && remaining <= 10 
                      ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">قريباً</span>
                      : null;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${rowClass}`}>
                        <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{p.name_ar}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{p.name_en || "---"}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{p.passport_number || "---"}</td>
                        <td className="py-3 px-4 text-slate-600">{p.nationality || "يمني"}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border">
                            {p.visa_type || "تأشيرة عمره"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-[11px] font-bold ${p.travel_status === "داخل مكة" ? "bg-indigo-100 text-indigo-800" : p.travel_status === "غادر" ? "bg-emerald-100 text-emerald-800" : p.travel_status === "مخالف" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                            {p.travel_status || "غير محدد"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-[11px] text-slate-500 max-w-[120px] truncate" title={p.notes}>
                          {p.notes || "---"}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 text-center">
                          {p.program_duration_days ? `${p.program_duration_days} يوم` : "---"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-center">
                          {p.travel_date ? p.travel_date.replace(/-/g, "/") : "---"}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-900 text-center font-mono">
                          {daysSpent} يوم
                        </td>
                        <td className="py-3 px-4 text-center">
                          {remaining === null ? (
                            <span className="text-slate-400">---</span>
                          ) : remaining < 0 ? (
                            <span className="bg-red-600 text-white font-black px-2 py-0.5 rounded text-[10px]">
                              متجاوز ({Math.abs(remaining)})
                            </span>
                          ) : (
                            <span className={`font-bold ${remaining <= 3 ? "text-rose-600" : remaining <= 10 ? "text-amber-600" : "text-emerald-600"}`}>
                              {remaining} يوم {alertBadge}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-center">
                          {p.expected_exit_date ? p.expected_exit_date.replace(/-/g, "/") : "---"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">{p.phone || "---"}</td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">{p.customer_name || "---"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter className="mt-4 pt-3 border-t flex items-center justify-between">
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    const title = statsModalType === "urgent" 
                      ? "تقرير حالة الزائرين - إنذار خروج عاجل (≤ 3 أيام)" 
                      : statsModalType === "warning" 
                      ? "تقرير حالة الزائرين - اقتراب موعد الخروج (4 - 10 أيام)" 
                      : statsModalType === "warning_15"
                      ? "تقرير حالة الزائرين - إنذار خروج 15 يوم (11 - 15 يوم)"
                      : statsModalType === "totalUmrah" 
                      ? "تقرير حالة الزائرين - إجمالي معتمري مكة (البرنامج)" 
                      : "تقرير حالة الزائرين - إجمالي المسافرين بالنظام";
                    handleExportToPdf(statsModalData, currentCustomerName, title);
                  }}
                  variant="outline"
                  className="gap-1.5 font-bold border-red-300 text-red-700 hover:bg-red-50"
                >
                  <FileDown className="w-4 h-4 text-red-600" />
                  تصدير PDF
                </Button>
                <Button 
                  onClick={() => {
                    const title = statsModalType === "urgent" 
                      ? "تقرير حالة الزائرين - إنذار خروج عاجل (≤ 3 أيام)" 
                      : statsModalType === "warning" 
                      ? "تقرير حالة الزائرين - اقتراب موعد الخروج (4 - 10 أيام)" 
                      : statsModalType === "warning_15"
                      ? "تقرير حالة الزائرين - إنذار خروج 15 يوم (11 - 15 يوم)"
                      : statsModalType === "totalUmrah" 
                      ? "تقرير حالة الزائرين - إجمالي معتمري مكة (البرنامج)" 
                      : "تقرير حالة الزائرين - إجمالي المسافرين بالنظام";
                    setStatsModalType(null);
                    setTimeout(() => {
                      handleOpenFullScreenPreview("visitors", statsModalData, title);
                    }, 50);
                  }}
                  variant="outline"
                  className="gap-1.5 font-bold border-indigo-300 text-indigo-700 hover:bg-indigo-50 shadow-sm"
                  title="استعراض الكشف بشاشة كاملة بنفس شكل وإعدادات الاستعراض المعتمد تماماً"
                >
                  <Maximize2 className="w-4 h-4 text-indigo-600" />
                  استعراض بشاشة كاملة
                </Button>
                <Button 
                  onClick={() => {
                     const title = statsModalType === "urgent" 
                      ? "تقرير حالة الزائرين - إنذار خروج عاجل (≤ 3 أيام)" 
                      : statsModalType === "warning" 
                      ? "تقرير حالة الزائرين - اقتراب موعد الخروج (4 - 10 أيام)" 
                      : statsModalType === "warning_15"
                      ? "تقرير حالة الزائرين - إنذار خروج 15 يوم (11 - 15 يوم)"
                      : statsModalType === "totalUmrah" 
                      ? "تقرير حالة الزائرين - إجمالي معتمري مكة (البرنامج)" 
                      : "تقرير حالة الزائرين - إجمالي المسافرين بالنظام";
                     handlePrintVisitorsReport(statsModalData, currentCustomerName, title);
                  }}
                  variant="outline"
                  className="gap-1.5 font-bold"
                >
                  <Printer className="w-4 h-4" />
                  طباعة
                </Button>
              </div>
              <Button onClick={() => setStatsModalType(null)} variant="default">إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportViewerHtml}
          title={reportViewerTitle}
        />

        {/* PDF SAVED CONFIRMATION & FILE ACTIONS MODAL */}
        <Dialog open={!!savedFileToast?.open} onOpenChange={(open) => !open && setSavedFileToast(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                تم حفظ مستند الـ PDF بنجاح
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                تم تصدير وحفظ الملف بالكامل في جهازك بدون أي أخطاء وبدون طباعة ورقية
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-rose-600" />
                  اسم الملف:
                </div>
                <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border break-all">
                  {savedFileToast?.fileName || "مستند.pdf"}
                </div>

                {savedFileToast?.filePath && (
                  <>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mt-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      مسار وموقع الحفظ في جهازك:
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded border break-all">
                      {savedFileToast?.filePath}
                    </div>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 border-t pt-3 flex-row-reverse sm:flex-row-reverse">
              <Button variant="outline" onClick={() => setSavedFileToast(null)}>
                إغلاق
              </Button>

              {savedFileToast?.filePath && typeof window !== "undefined" && (window as any).electronAPI?.showItemInFolder && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    (window as any).electronAPI.showItemInFolder(savedFileToast.filePath);
                  }}
                  className="gap-1.5 font-bold text-xs"
                >
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                  عرض في المجلد
                </Button>
              )}

              {savedFileToast?.filePath && typeof window !== "undefined" && (window as any).electronAPI?.openPath && (
                <Button
                  onClick={() => {
                    (window as any).electronAPI.openPath(savedFileToast.filePath);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs"
                >
                  <Eye className="w-4 h-4" />
                  فتح ملف الـ PDF
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
