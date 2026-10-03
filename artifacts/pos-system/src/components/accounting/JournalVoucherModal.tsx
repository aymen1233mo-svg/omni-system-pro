import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { tafqeet } from "@/lib/tafqeet";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { generateJournalVoucherA4Html } from "@/lib/printUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  Plus,
  Trash2,
  Printer,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Save,
  Edit3,
  RefreshCw,
  FileText,
  Copy,
  Eye,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Building2,
  Calendar,
  DollarSign,
  X,
  Sliders,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JournalLine {
  id?: number;
  account_code: string;
  currency: string;
  exchange_rate: number | string;
  foreign_amount: number | string;
  debit: number | string;
  credit: number | string;
  description: string;
  cost_center_id?: number | string;
}

interface JournalVoucherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntryId?: number | null;
  accountsList: any[];
  costCentersList?: any[];
}

const SUPPORTED_CURRENCIES = [
  { code: "YER", name: "ريال يمني (YER)", symbol: "ر.ي", defaultRate: 1.0 },
  { code: "SAR", name: "ريال سعودي (SAR)", symbol: "ر.س", defaultRate: 1.0 },
  { code: "USD", name: "دولار أمريكي (USD)", symbol: "$", defaultRate: 3.75 },
  { code: "EUR", name: "يورو أوروبي (EUR)", symbol: "€", defaultRate: 4.10 },
  { code: "AED", name: "درهم إماراتي (AED)", symbol: "د.إ", defaultRate: 1.02 },
  { code: "OMR", name: "ريال عماني (OMR)", symbol: "ر.ع", defaultRate: 9.75 },
  { code: "QAR", name: "ريال قطري (QAR)", symbol: "ر.ق", defaultRate: 1.03 },
  { code: "KWD", name: "دينار كويتي (KWD)", symbol: "د.ك", defaultRate: 12.25 },
];

const ENTRY_CLASSIFICATIONS = [
  { id: "عام", name: "عام / تسوية محاسبية" },
  { id: "رواتب", name: "رواتب ومستحقات موظفين" },
  { id: "مصاريف", name: "مصاريف وتشغيل" },
  { id: "إيرادات", name: "إيرادات وحجوزات" },
  { id: "طيران", name: "تذاكر وطيران GDS / BSP" },
  { id: "فنادق", name: "حجوزات وباقات سياحية" },
  { id: "افتتاحي", name: "قيد رصيد افتتاحي" },
  { id: "إقفال", name: "قيد إقفال وتدوير" },
];

export const JournalVoucherModal: React.FC<JournalVoucherModalProps> = ({
  open,
  onOpenChange,
  initialEntryId,
  accountsList,
  costCentersList = [],
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  // Form State
  const [currentEntryId, setCurrentEntryId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [entryNumber, setEntryNumber] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("YER");
  const [currencyRate, setCurrencyRate] = useState<number | string>(1.0);
  const [description, setDescription] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [costCenterId, setCostCenterId] = useState<string>("all");
  const [entryClass, setEntryClass] = useState("عام");
  const [txCode, setTxCode] = useState("");
  const [docType, setDocType] = useState("قيد عادي");
  const [activeTab, setActiveTab] = useState("details");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");

  // Lines
  const [lines, setLines] = useState<JournalLine[]>([
    {
      account_code: accountsList[0]?.code || "11100",
      currency: "YER",
      exchange_rate: 1.0,
      foreign_amount: "",
      debit: "",
      credit: "",
      description: "",
      cost_center_id: "all",
    },
    {
      account_code: accountsList[1]?.code || "21100",
      currency: "YER",
      exchange_rate: 1.0,
      foreign_amount: "",
      debit: "",
      credit: "",
      description: "",
      cost_center_id: "all",
    },
  ]);

  // Dialogs
  const [showSearchDlg, setShowSearchDlg] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFromDate, setSearchFromDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchDocType, setSearchDocType] = useState("all");
  const [showPreviewDlg, setShowPreviewDlg] = useState(false);
  const [printFormat, setPrintFormat] = useState<"standard" | "vertical" | "compact">("standard");
  const [showFullScreenReport, setShowFullScreenReport] = useState(false);
  const [fullScreenReportHtml, setFullScreenReportHtml] = useState("");

  const { data: docPrintSettings } = useQuery<any>({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings").catch(() => ({})),
    enabled: open,
  });

  const handleFullScreenPreview = () => {
    const mappedLines = lines.map((l, i) => {
      const acc = accountsList.find(a => String(a.code) === String(l.account_code));
      const cc = costCentersList.find(c => String(c.id) === String(l.cost_center_id));
      return {
        account_code: l.account_code || "",
        analytical: "",
        account_name: acc ? acc.name : (l.account_code || ""),
        description: l.description || description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
        cost_center: cc ? cc.name : "",
        currency: l.currency || currency || "SAR",
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0)
      };
    });

    const html = generateJournalVoucherA4Html({
      voucherNumber: entryNumber || (currentEntryId ? String(currentEntryId) : "3"),
      date: entryDate,
      docType: docType || "نوع الوثيقة",
      userName: "علي احمد محمد اليمني",
      description: description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
      currency: currency || "ريال سعودي",
      referenceNo: referenceNo || "8",
      lines: mappedLines,
      agencyName: docPrintSettings?.companyName || docPrintSettings?.headerRightText1 || "اسم النشاط التجاري",
      agencyAddress: docPrintSettings?.companySubtitle || docPrintSettings?.headerRightText2 || ""
    });

    setFullScreenReportHtml(html);
    setShowFullScreenReport(true);
  };

  // Fetch all entries for navigation & search
  const { data: allEntries = [], refetch: refetchEntries } = useQuery<any[]>({
    queryKey: ["journal-entries-list"],
    queryFn: () => apiGet("/api/accounting/journal-entries"),
    enabled: open,
  });

  // Load entry by ID
  const loadEntry = (entry: any) => {
    if (!entry) return;
    setCurrentEntryId(entry.id);
    setEntryNumber(entry.entry_number || `JV-${entry.id}`);
    setEntryDate(entry.entry_date || new Date().toISOString().slice(0, 10));
    setCurrency(entry.currency || "YER");
    setCurrencyRate(entry.currency_rate || 1.0);
    setDescription(entry.description || "");
    setReferenceNo(entry.reference_no || "");
    setCostCenterId(entry.cost_center_id ? String(entry.cost_center_id) : "all");
    setEntryClass(entry.entry_class || "عام");
    setTxCode(entry.tx_code || "");
    setDocType(entry.doc_type || "قيد عادي");

    try {
      if (entry.attachments) {
        setAttachments(typeof entry.attachments === "string" ? JSON.parse(entry.attachments) : entry.attachments);
      } else {
        setAttachments([]);
      }
    } catch {
      setAttachments([]);
    }

    if (entry.lines && entry.lines.length > 0) {
      setLines(
        entry.lines.map((l: any) => ({
          id: l.id,
          account_code: l.account_code || (accountsList.find((a: any) => a.id === l.account_id)?.code || ""),
          currency: l.currency || entry.currency || "YER",
          exchange_rate: l.exchange_rate || 1.0,
          foreign_amount: l.foreign_amount || "",
          debit: l.debit > 0 ? l.debit : "",
          credit: l.credit > 0 ? l.credit : "",
          description: l.description || "",
          cost_center_id: l.cost_center_id ? String(l.cost_center_id) : "all",
        }))
      );
    }
    setIsEditMode(false);
  };

  // Reset for New Entry
  const handleNewEntry = () => {
    setCurrentEntryId(null);
    setIsEditMode(false);
    const nextCount = allEntries.length + 1;
    setEntryNumber(`JV-${String(nextCount).padStart(5, "0")}`);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setCurrency("YER");
    setCurrencyRate(1.0);
    setDescription("");
    setReferenceNo("");
    setCostCenterId("all");
    setEntryClass("عام");
    setTxCode("");
    setDocType("قيد عادي");
    setAttachments([]);
    setLines([
      {
        account_code: accountsList[0]?.code || "11100",
        currency: "YER",
        exchange_rate: 1.0,
        foreign_amount: "",
        debit: "",
        credit: "",
        description: "",
        cost_center_id: "all",
      },
      {
        account_code: accountsList[1]?.code || "21100",
        currency: "YER",
        exchange_rate: 1.0,
        foreign_amount: "",
        debit: "",
        credit: "",
        description: "",
        cost_center_id: "all",
      },
    ]);
  };

  // Handle Initial Entry ID or first open
  useEffect(() => {
    if (open) {
      if (initialEntryId) {
        const found = allEntries.find((e) => e.id === initialEntryId);
        if (found) {
          loadEntry(found);
        } else {
          apiGet(`/api/accounting/journal-entries/${initialEntryId}`)
            .then((data) => loadEntry(data))
            .catch(() => handleNewEntry());
        }
      } else if (allEntries.length > 0 && !currentEntryId) {
        // Load latest entry by default or new
        loadEntry(allEntries[0]);
      } else if (!currentEntryId) {
        handleNewEntry();
      }
    }
  }, [open, initialEntryId, allEntries.length]);

  // Calculations
  const totalDebit = useMemo(() => {
    return (lines || []).reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return (lines || []).reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  }, [lines]);

  const difference = useMemo(() => {
    return Math.abs(totalDebit - totalCredit);
  }, [totalDebit, totalCredit]);

  const isBalanced = useMemo(() => {
    return totalDebit > 0 && totalCredit > 0 && difference < 0.01;
  }, [totalDebit, totalCredit, difference]);

  const amountInWords = useMemo(() => {
    const maxVal = Math.max(totalDebit, totalCredit);
    return tafqeet(maxVal, currency);
  }, [totalDebit, totalCredit, currency]);

  // Line Change Handlers
  const updateLine = (idx: number, field: keyof JournalLine, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };

    // Intelligent Side Handling (Fixes WhatsApp issue where filling both created confusion)
    if (field === "debit" && value !== "") {
      updated[idx].credit = "";
      if (updated[idx].exchange_rate && Number(updated[idx].exchange_rate) > 0) {
        updated[idx].foreign_amount = (Number(value) / Number(updated[idx].exchange_rate)).toFixed(2);
      }
    } else if (field === "credit" && value !== "") {
      updated[idx].debit = "";
      if (updated[idx].exchange_rate && Number(updated[idx].exchange_rate) > 0) {
        updated[idx].foreign_amount = (Number(value) / Number(updated[idx].exchange_rate)).toFixed(2);
      }
    } else if (field === "foreign_amount") {
      const rate = Number(updated[idx].exchange_rate) || 1.0;
      const baseVal = (Number(value) || 0) * rate;
      if (updated[idx].debit !== "") {
        updated[idx].debit = baseVal > 0 ? baseVal.toFixed(2) : "";
      } else if (updated[idx].credit !== "") {
        updated[idx].credit = baseVal > 0 ? baseVal.toFixed(2) : "";
      } else {
        // default to debit for row 0, credit for row 1+
        if (idx === 0) {
          updated[idx].debit = baseVal > 0 ? baseVal.toFixed(2) : "";
        } else {
          updated[idx].credit = baseVal > 0 ? baseVal.toFixed(2) : "";
        }
      }
    } else if (field === "currency") {
      const foundCurr = SUPPORTED_CURRENCIES.find((c) => c.code === value);
      if (foundCurr) {
        updated[idx].exchange_rate = foundCurr.defaultRate;
        if (updated[idx].foreign_amount) {
          const baseVal = (Number(updated[idx].foreign_amount) || 0) * foundCurr.defaultRate;
          if (updated[idx].debit !== "") updated[idx].debit = baseVal.toFixed(2);
          else if (updated[idx].credit !== "") updated[idx].credit = baseVal.toFixed(2);
        }
      }
    } else if (field === "exchange_rate") {
      const rate = Number(value) || 1.0;
      if (updated[idx].foreign_amount) {
        const baseVal = (Number(updated[idx].foreign_amount) || 0) * rate;
        if (updated[idx].debit !== "") updated[idx].debit = baseVal.toFixed(2);
        else if (updated[idx].credit !== "") updated[idx].credit = baseVal.toFixed(2);
      }
    }

    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        account_code: accountsList[0]?.code || "11100",
        currency: currency,
        exchange_rate: Number(currencyRate) || 1.0,
        foreign_amount: "",
        debit: "",
        credit: "",
        description: description,
        cost_center_id: costCenterId,
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) {
      toast({
        title: "تنبيه محاسبي",
        description: "يجب أن يحتوي القيد على بندين محاسبيين على الأقل (مدين ودائن).",
        variant: "destructive",
      });
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  // Auto balance button
  const handleAutoBalance = () => {
    if (totalDebit === totalCredit) {
      toast({ title: "القيد متزن تماماً", description: "إجمالي المدين يساوي إجمالي الدائن." });
      return;
    }

    const diff = Number((totalDebit - totalCredit).toFixed(2));
    const lastIdx = lines.length - 1;
    const updated = [...lines];

    if (diff > 0) {
      // Debit is higher, add to credit of last line or new line
      if (updated[lastIdx].debit === "" || Number(updated[lastIdx].credit) > 0) {
        const currentCredit = Number(updated[lastIdx].credit) || 0;
        updated[lastIdx].credit = (currentCredit + diff).toFixed(2);
        updated[lastIdx].debit = "";
      } else {
        updated.push({
          account_code: accountsList[1]?.code || "21100",
          currency: currency,
          exchange_rate: 1.0,
          foreign_amount: diff,
          debit: "",
          credit: diff.toFixed(2),
          description: "موازنة الطرف الدائن",
          cost_center_id: costCenterId,
        });
      }
    } else {
      // Credit is higher, add to debit of first or last line
      const absDiff = Math.abs(diff);
      if (updated[0].credit === "" || Number(updated[0].debit) > 0) {
        const currentDebit = Number(updated[0].debit) || 0;
        updated[0].debit = (currentDebit + absDiff).toFixed(2);
        updated[0].credit = "";
      } else {
        updated.push({
          account_code: accountsList[0]?.code || "11100",
          currency: currency,
          exchange_rate: 1.0,
          foreign_amount: absDiff,
          debit: absDiff.toFixed(2),
          credit: "",
          description: "موازنة الطرف المدين",
          cost_center_id: costCenterId,
        });
      }
    }
    setLines(updated);
    toast({ title: "تمت موازنة القيد", description: "تم تعديل المبالغ ليتطابق الطرفين المدين والدائن." });
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        entry_date: entryDate,
        description: description || "قيد يومية محاسبي عام",
        currency,
        currency_rate: Number(currencyRate) || 1.0,
        reference_no: referenceNo,
        doc_type: docType,
        cost_center_id: costCenterId !== "all" ? Number(costCenterId) : undefined,
        entry_class: entryClass,
        tx_code: txCode,
        attachments,
        lines: lines.map((l) => ({
          account_code: l.account_code,
          currency: l.currency || currency,
          exchange_rate: Number(l.exchange_rate) || 1.0,
          foreign_amount: Number(l.foreign_amount) || 0,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || description,
          cost_center_id: l.cost_center_id !== "all" ? Number(l.cost_center_id) : undefined,
        })),
      };

      if (currentEntryId && isEditMode) {
        return apiPut(`/api/accounting/journal-entries/${currentEntryId}`, payload);
      } else {
        return apiPost("/api/accounting/journal-entries", payload);
      }
    },
    onSuccess: (data) => {
      toast({
        title: currentEntryId && isEditMode ? "تم تعديل القيد بنجاح" : "تم ترحيل القيد بنجاح",
        description: `تم حفظ القيد رقم ${data.entry_number} وتحديث الحسابات المرتبطة.`,
      });
      queryClient.invalidateQueries({ queryKey: ["journal-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      loadEntry(data);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في حفظ القيد",
        description: err.message || "فشل تسجيل القيد المحاسبي. يرجى التحقق من التوازن والبيانات.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiDelete(`/api/accounting/journal-entries/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "تم حذف القيد",
        description: "تم حذف القيد المحاسبي وعكس أثره المالي من الأرصدة بنجاح.",
      });
      queryClient.invalidateQueries({ queryKey: ["journal-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
      refetchEntries().then((res) => {
        if (res.data && res.data.length > 0) {
          loadEntry(res.data[0]);
        } else {
          handleNewEntry();
        }
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في حذف القيد",
        description: err.message || "لا يمكن حذف هذا القيد.",
        variant: "destructive",
      });
    },
  });

  // Navigation index
  const currentIndex = useMemo(() => {
    if (!currentEntryId) return -1;
    return allEntries.findIndex((e) => e.id === currentEntryId);
  }, [allEntries, currentEntryId]);

  const handleNavFirst = () => {
    if (allEntries.length > 0) loadEntry(allEntries[0]);
  };
  const handleNavPrev = () => {
    if (currentIndex > 0) loadEntry(allEntries[currentIndex - 1]);
  };
  const handleNavNext = () => {
    if (currentIndex >= 0 && currentIndex < allEntries.length - 1) {
      loadEntry(allEntries[currentIndex + 1]);
    }
  };
  const handleNavLast = () => {
    if (allEntries.length > 0) loadEntry(allEntries[allEntries.length - 1]);
  };

  // Filtered entries for search
  const filteredSearchEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesText =
        !searchQuery ||
        e.entry_number?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.reference_no?.toLowerCase().includes(q) ||
        e.lines?.some((l: any) => l.account_name?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q));

      const matchesFromDate = !searchFromDate || e.entry_date >= searchFromDate;
      const matchesToDate = !searchToDate || e.entry_date <= searchToDate;
      const matchesDocType = searchDocType === "all" || e.doc_type === searchDocType;

      return matchesText && matchesFromDate && matchesToDate && matchesDocType;
    });
  }, [allEntries, searchQuery, searchFromDate, searchToDate, searchDocType]);

  // Print Handler
  const handlePrint = (format: "standard" | "vertical" | "compact") => {
    toast({ title: "جاري الطباعة..." });
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[96vw] md:max-w-6xl max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 shadow-2xl rounded-lg font-sans"
          dir="rtl"
        >
          {/* ───────────────────────────────────────────────────────────── */}
          {/* WINDOW HEADER (Onyx Pro Classic Toolbar Top) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700 select-none">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-600/80 rounded border border-indigo-400/40">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-white tracking-wide">
                    سند قيد يومية عامة (Journal Entry Voucher)
                  </h2>
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-5 font-mono px-2 ${
                      currentEntryId
                        ? isEditMode
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                        : "bg-sky-500/20 text-sky-300 border-sky-500/50"
                    }`}
                  >
                    {currentEntryId ? (isEditMode ? "وضع التعديل" : "قيد مرحل") : "قيد جديد (Ctrl+N)"}
                  </Badge>
                  {currentEntryId && (
                    <span className="text-xs text-slate-300 font-mono">
                      رقم: <strong className="text-amber-400">{entryNumber}</strong>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>النظام المحاسبي العام الموحد</span>
                  <span>•</span>
                  <span>متوافق مع معايير IATA وأنظمة السفر العالمية</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreviewDlg(true)}
                className="h-8 px-2.5 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                title="معاينة السند"
              >
                <Eye className="w-4 h-4 text-sky-400" />
                معاينة
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePrint("standard")}
                className="h-8 px-2.5 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                title="طباعة السند"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                طباعة
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TOP FORM CONTROLS (Onyx Pro Exact Voucher Header) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs">
              {/* Entry Number */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  رقم القيد
                </label>
                <Input
                  value={entryNumber}
                  onChange={(e) => setEntryNumber(e.target.value)}
                  placeholder="JV-00001"
                  className="h-8 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-700 dark:text-indigo-400"
                />
              </div>

              {/* Date */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  التاريخ
                </label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              {/* Base Currency */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center justify-between">
                  <span>عملة القيد</span>
                  <span className="text-[10px] text-indigo-600 font-normal">سعر الصرف</span>
                </label>
                <div className="flex gap-1">
                  <Select value={currency} onValueChange={(val) => {
                    setCurrency(val);
                    const found = SUPPORTED_CURRENCIES.find((c) => c.code === val);
                    if (found) setCurrencyRate(found.defaultRate);
                  }}>
                    <SelectTrigger className="h-8 text-xs w-28 bg-slate-50 dark:bg-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.001"
                    value={currencyRate}
                    onChange={(e) => setCurrencyRate(e.target.value)}
                    className="h-8 text-xs font-mono text-center w-20 bg-slate-50 dark:bg-slate-800"
                    placeholder="1.00"
                    title="سعر صرف العملة الأساسية"
                  />
                </div>
              </div>

              {/* Reference Number */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  رقم المرجع
                </label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="مثال: فاتورة / تذكرة 7788"
                  className="h-8 text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>

              {/* Cost Center */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  مركز التكلفة
                </label>
                <Select value={costCenterId} onValueChange={setCostCenterId}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-800">
                    <SelectValue placeholder="الكل / غير محدد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">عام / الإدارة العامة</SelectItem>
                    {costCentersList.map((cc: any) => (
                      <SelectItem key={cc.id} value={String(cc.id)}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Classification */}
              <div className="col-span-6 sm:col-span-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  تصنيف القيد
                </label>
                <Select value={entryClass} onValueChange={setEntryClass}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_CLASSIFICATIONS.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Narration and Document Description */}
            <div className="grid grid-cols-12 gap-2 text-xs pt-1">
              <div className="col-span-12 sm:col-span-9">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[70px]">
                    البيان العام:
                  </span>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="شرح وبيان القيد المحاسبي (مثال: إثبات عمولة وإيراد تذاكر طيران الخطوط الجوية لشهر 8)"
                    className="h-8 text-xs flex-1 bg-amber-50/40 dark:bg-amber-950/10 border-amber-300 dark:border-amber-900/40 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>
              </div>

              <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAutoBalance}
                  className="h-8 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  موازنة تلقائية
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addLine}
                  className="h-8 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة طرف
                </Button>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TABS (تفاصيل القيد، المرفقات، خيارات أخرى) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-slate-950 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-3 pt-2 bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 flex justify-between items-center">
                <TabsList className="bg-slate-300/80 dark:bg-slate-800 p-0.5 h-8">
                  <TabsTrigger value="details" className="text-xs h-7 px-4 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                    تفاصيل القيد المحاسبي
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="text-xs h-7 px-4 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                    <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                    المرفقات ({attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="options" className="text-xs h-7 px-4 gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    خيارات إضافية ومعلومات السند
                  </TabsTrigger>
                </TabsList>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                  <span>عدد البنود: <strong className="text-slate-800 dark:text-slate-200">{lines.length}</strong></span>
                  <span>•</span>
                  <span>العملة الافتراضية: <strong className="text-indigo-600 font-bold">{currency}</strong></span>
                </div>
              </div>

              {/* TAB 1: JOURNAL LINES GRID (The Onyx Pro Grid) */}
              <TabsContent value="details" className="flex-1 overflow-auto p-3 m-0 space-y-2">
                <div className="border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-bold">
                          <th className="py-2 px-2 text-center w-10 border-l border-slate-300 dark:border-slate-700">#</th>
                          <th className="py-2 px-2 w-[240px] border-l border-slate-300 dark:border-slate-700">اسم الحساب / الرمز المحاسبي</th>
                          <th className="py-2 px-1 text-center w-20 border-l border-slate-300 dark:border-slate-700">العملة</th>
                          <th className="py-2 px-1 text-center w-16 border-l border-slate-300 dark:border-slate-700">س.ص</th>
                          <th className="py-2 px-2 text-center w-24 border-l border-slate-300 dark:border-slate-700">مبلغ القيد</th>
                          <th className="py-2 px-2 text-center w-28 border-l border-slate-300 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                            مدين ({currency})
                          </th>
                          <th className="py-2 px-2 text-center w-28 border-l border-slate-300 dark:border-slate-700 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">
                            دائن ({currency})
                          </th>
                          <th className="py-2 px-2 border-l border-slate-300 dark:border-slate-700">البيان والملاحظة الخاصة بالطرف</th>
                          <th className="py-2 px-2 w-32 border-l border-slate-300 dark:border-slate-700">مركز التكلفة</th>
                          <th className="py-2 px-1 text-center w-10">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {lines.map((line, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                              idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/50"
                            }`}
                          >
                            {/* # Row Number */}
                            <td className="py-1 px-1 text-center font-mono text-slate-500 font-bold border-l border-slate-200 dark:border-slate-800">
                              {idx + 1}
                            </td>

                            {/* Account Dropdown */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Select
                                value={line.account_code}
                                onValueChange={(val) => updateLine(idx, "account_code", val)}
                              >
                                <SelectTrigger className="h-8 text-xs bg-transparent border-slate-300 dark:border-slate-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                  {accountsList.map((a: any) => (
                                    <SelectItem key={a.id} value={a.code} className="text-xs">
                                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold ml-1">
                                        [{a.code}]
                                      </span>{" "}
                                      {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Line Currency */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Select
                                value={line.currency || currency}
                                onValueChange={(val) => updateLine(idx, "currency", val)}
                              >
                                <SelectTrigger className="h-8 text-[11px] text-center px-1 border-slate-300 dark:border-slate-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUPPORTED_CURRENCIES.map((c) => (
                                    <SelectItem key={c.code} value={c.code} className="text-xs">
                                      {c.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Exchange Rate */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Input
                                type="number"
                                step="0.001"
                                value={line.exchange_rate}
                                onChange={(e) => updateLine(idx, "exchange_rate", e.target.value)}
                                className="h-8 text-[11px] font-mono text-center p-1 border-slate-300 dark:border-slate-700"
                                placeholder="1.0"
                              />
                            </td>

                            {/* Foreign Amount */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Input
                                type="number"
                                step="any"
                                value={line.foreign_amount}
                                onChange={(e) => updateLine(idx, "foreign_amount", e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-xs font-mono text-center p-1 font-semibold text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                              />
                            </td>

                            {/* Debit (Base Currency) */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/10">
                              <Input
                                type="number"
                                step="any"
                                value={line.debit}
                                onChange={(e) => updateLine(idx, "debit", e.target.value)}
                                placeholder="مدين"
                                className="h-8 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 bg-white dark:bg-slate-900"
                              />
                            </td>

                            {/* Credit (Base Currency) */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/10">
                              <Input
                                type="number"
                                step="any"
                                value={line.credit}
                                onChange={(e) => updateLine(idx, "credit", e.target.value)}
                                placeholder="دائن"
                                className="h-8 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800/60 bg-white dark:bg-slate-900"
                              />
                            </td>

                            {/* Description / Note for this specific side (Solves user's exact WhatsApp feedback) */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Input
                                value={line.description}
                                onChange={(e) => updateLine(idx, "description", e.target.value)}
                                placeholder={line.debit ? "بيان الطرف المدين..." : "بيان الطرف الدائن..."}
                                className="h-8 text-xs border-slate-300 dark:border-slate-700"
                              />
                            </td>

                            {/* Line Cost Center */}
                            <td className="p-1 border-l border-slate-200 dark:border-slate-800">
                              <Select
                                value={String(line.cost_center_id || "all")}
                                onValueChange={(val) => updateLine(idx, "cost_center_id", val)}
                              >
                                <SelectTrigger className="h-8 text-xs border-slate-300 dark:border-slate-700">
                                  <SelectValue placeholder="افتراضي" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">عام / كلي</SelectItem>
                                  {costCentersList.map((cc: any) => (
                                    <SelectItem key={cc.id} value={String(cc.id)}>
                                      {cc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Remove Action */}
                            <td className="p-1 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeLine(idx)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="حذف هذا السطر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center px-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addLine}
                    className="h-7 text-xs text-indigo-700 dark:text-indigo-300 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة طرف جديد للقيد
                  </Button>

                  <span className="text-[11px] text-slate-500">
                    💡 ملاحظة: عند كتابة المبلغ في الطرف المدين يتم مسح الطرف الدائن تلقائياً، والعكس صحيح لتسهيل الإدخال وتجنب الخطأ.
                  </span>
                </div>
              </TabsContent>

              {/* TAB 2: ATTACHMENTS */}
              <TabsContent value="attachments" className="flex-1 overflow-auto p-4 m-0 space-y-4">
                <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 space-y-3">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-amber-500" />
                    المستندات والمرفقات المؤيدة للقيد (إيصالات، تذاكر، فواتير)
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      value={newAttachmentUrl}
                      onChange={(e) => setNewAttachmentUrl(e.target.value)}
                      placeholder="رابط أو اسم المستند المؤيد (مثال: ticket-scan-0012.pdf أو صورة الإيصال)"
                      className="text-xs h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (newAttachmentUrl.trim()) {
                          setAttachments([...attachments, newAttachmentUrl.trim()]);
                          setNewAttachmentUrl("");
                        }
                      }}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      إرفاق مستند
                    </Button>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-md">
                      لا توجد مرفقات ملحقة بهذا السند حالياً.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                      {attachments.map((att, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border text-xs">
                          <span className="truncate flex-1 font-mono text-[11px]">{att}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                            className="h-6 w-6 p-0 text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: OPTIONS & AUDIT */}
              <TabsContent value="options" className="flex-1 overflow-auto p-4 m-0 space-y-4">
                <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold block mb-1">نوع المستند</label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="قيد عادي">قيد يومية عادي</SelectItem>
                        <SelectItem value="قيد انتظار">قيد انتظار (مسودة)</SelectItem>
                        <SelectItem value="قيد دوري">قيد دوري متكرر</SelectItem>
                        <SelectItem value="قيد تسوية">قيد تسوية وإقفال</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="font-bold block mb-1">رمز الحركة المحاسبية (Transaction Code)</label>
                    <Input value={txCode} onChange={(e) => setTxCode(e.target.value)} placeholder="مثال: GL-TRV-2026" className="h-8 text-xs" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* BOTTOM SUMMARY HIGHLIGHTS (Onyx Pro Yellow Highlights & Tafqeet) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center text-xs">
              {/* Type selector */}
              <div className="col-span-12 sm:col-span-2 flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">النوع:</span>
                <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                  {docType}
                </Badge>
              </div>

              {/* Total Debit Box (Yellow classic) */}
              <div className="col-span-4 sm:col-span-2 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded px-2 py-1 text-center">
                <div className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">إجمالي المدين</div>
                <div className="text-xs sm:text-sm font-black font-mono text-emerald-800 dark:text-emerald-300">
                  {totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Total Credit Box (Yellow classic) */}
              <div className="col-span-4 sm:col-span-2 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 rounded px-2 py-1 text-center">
                <div className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">إجمالي الدائن</div>
                <div className="text-xs sm:text-sm font-black font-mono text-blue-800 dark:text-blue-300">
                  {totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Difference Box */}
              <div
                className={`col-span-4 sm:col-span-2 rounded px-2 py-1 text-center border ${
                  difference < 0.01
                    ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 animate-pulse"
                }`}
              >
                <div className="text-[10px] font-bold">الفارق (Difference)</div>
                <div className="text-xs sm:text-sm font-black font-mono">
                  {difference.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Status Badge */}
              <div className="col-span-12 sm:col-span-4 flex items-center justify-end gap-2">
                <div className="flex items-center gap-1.5">
                  {isBalanced ? (
                    <Badge className="bg-emerald-600 text-white gap-1 py-1 px-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      متزن 100%
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 py-1 px-2.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      غير متزن بفارق ({difference.toFixed(2)})
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Tafqeet (Amount in words in Arabic) */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">المبلغ كتابة:</span>
              <span className="font-semibold text-indigo-900 dark:text-indigo-300">{amountInWords}</span>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ACTION BUTTONS TOOLBAR (Onyx Pro Standard Bottom Bar) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="bg-slate-200 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2 select-none">
            {/* Left Operations: New, Save, Edit, Delete, Duplicate */}
            <div className="flex items-center flex-wrap gap-1.5">
              <Button
                size="sm"
                onClick={handleNewEntry}
                className="h-8 text-xs bg-slate-700 hover:bg-slate-800 text-white gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                جديد (New)
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  if (!isBalanced) {
                    toast({ variant: "destructive", title: "القيد غير متزن", description: "يجب أن يتساوى إجمالي المدين مع إجمالي الدائن" });
                    return;
                  }
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? "جاري الحفظ..." : isEditMode ? "حفظ التعديلات" : "حفظ وترحيل"}
              </Button>

              {currentEntryId && (
                <Button
                  size="sm"
                  variant={isEditMode ? "secondary" : "outline"}
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`h-8 text-xs gap-1 ${
                    isEditMode
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  {isEditMode ? "إلغاء التعديل" : "تعديل القيد"}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSearchDlg(true)}
                className="h-8 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 gap-1"
              >
                <Search className="w-3.5 h-3.5 text-sky-600" />
                بحث في القيود
              </Button>

              {currentEntryId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من رغبتك في حذف هذا القيد المحاسبي وعكس أثره المالي؟")) {
                      deleteMutation.mutate(currentEntryId);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="h-8 text-xs text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900 gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </Button>
              )}
            </div>

            {/* Navigation Controls (`<<`, `<`, `>`, `>>`) */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded border border-slate-300 dark:border-slate-700">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNavFirst}
                disabled={currentIndex === 0 || allEntries.length === 0}
                className="h-7 w-7 p-0"
                title="القيد الأول"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNavPrev}
                disabled={currentIndex <= 0}
                className="h-7 w-7 p-0"
                title="السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-[11px] font-mono px-2 text-slate-600 dark:text-slate-300">
                {currentIndex >= 0 ? `${currentIndex + 1} / ${allEntries.length}` : `جديد`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNavNext}
                disabled={currentIndex < 0 || currentIndex >= allEntries.length - 1}
                className="h-7 w-7 p-0"
                title="التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNavLast}
                disabled={currentIndex === allEntries.length - 1 || allEntries.length === 0}
                className="h-7 w-7 p-0"
                title="القيد الأخير"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
            </div>

            {/* Right Controls: Print & Close */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={handleFullScreenPreview}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
                title="طباعة استعراض في الشاشة كاملة (مطابق للعملية 22)"
              >
                <Eye className="w-3.5 h-3.5" />
                طباعة استعراض في الشاشة كاملة
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrint("standard")}
                className="h-8 text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrint("vertical")}
                className="h-8 text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 gap-1"
              >
                طباعة طولي
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-300"
              >
                خروج
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SEARCH PAST JOURNAL ENTRIES MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={showSearchDlg} onOpenChange={setShowSearchDlg}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-4 dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              البحث في القيود اليومية السابقة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم القيد، البيان، المرجع، أو اسم الحساب..."
                  className="text-xs h-8"
                  autoFocus
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="date"
                  value={searchFromDate}
                  onChange={(e) => setSearchFromDate(e.target.value)}
                  className="text-xs h-8"
                  placeholder="من تاريخ"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="date"
                  value={searchToDate}
                  onChange={(e) => setSearchToDate(e.target.value)}
                  className="text-xs h-8"
                  placeholder="إلى تاريخ"
                />
              </div>
            </div>

            {/* Search Results Table */}
            <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs text-right divide-y">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">رقم القيد</th>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">البيان</th>
                    <th className="p-2 text-center">العملة</th>
                    <th className="p-2 text-center">المبلغ</th>
                    <th className="p-2 text-center">اختيار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSearchEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        لا توجد قيود تطابق معايير البحث.
                      </td>
                    </tr>
                  ) : (
                    filteredSearchEntries.map((e) => {
                      const entryDebit = (e.lines || []).reduce((s: number, l: any) => s + (l.debit || 0), 0);
                      return (
                        <tr
                          key={e.id}
                          className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer"
                          onClick={() => {
                            loadEntry(e);
                            setShowSearchDlg(false);
                          }}
                        >
                          <td className="p-2 font-mono font-bold text-indigo-600">{e.entry_number}</td>
                          <td className="p-2 font-mono text-slate-600">{e.entry_date}</td>
                          <td className="p-2 max-w-xs truncate">{e.description}</td>
                          <td className="p-2 text-center font-bold">{e.currency || "YER"}</td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-600">
                            {entryDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-center">
                            <Button size="sm" variant="ghost" onClick={() => toast({ title: "جاري تحميل المرفقات للسطر المحدد" })} className="h-6 text-xs text-indigo-600">
                              تحميل
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSearchDlg(false)} className="text-xs">
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PREVIEW & PRINT TEMPLATE (Official Voucher Layout) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={showPreviewDlg} onOpenChange={setShowPreviewDlg}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 dir-rtl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>معاينة سند قيد محاسبي معتمد</span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleFullScreenPreview} className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 font-bold">
                  <Eye className="w-3.5 h-3.5" />
                  استعراض شاشة كاملة
                </Button>
                <Button size="sm" onClick={() => handlePrint("standard")} className="h-7 text-xs bg-emerald-600 text-white gap-1">
                  <Printer className="w-3.5 h-3.5" />
                  طباعة A4
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrint("compact")} className="h-7 text-xs">
                  طباعة مدمجة
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Printable Voucher Sheet */}
          <div ref={printRef} className="bg-white text-slate-900 p-6 border rounded-lg shadow-sm space-y-4 font-sans print:border-0 print:shadow-none print:p-0">
            {/* Voucher Header */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <h1 className="text-lg font-black text-slate-900">شركة أومني فلاي لإدارة السفريات والسياحة</h1>
                <div className="text-xs text-slate-600">نظام إدارة وكالات السفر وإصدار التذاكر المعتمد IATA</div>
                <div className="text-[11px] text-slate-500">الرقم الضريبي: 300192847500003 • هاتف: 01-234567</div>
              </div>
              <div className="text-left" dir="ltr">
                <div className="text-base font-black text-indigo-900">OMNIFLY TRAVEL ERP</div>
                <div className="text-xs font-mono text-slate-600">General Journal Voucher</div>
                <div className="mt-1 inline-block border-2 border-slate-900 px-3 py-0.5 rounded font-mono font-bold text-xs bg-slate-100">
                  {entryNumber || "JV-DRAFT"}
                </div>
              </div>
            </div>

            {/* Voucher Metadata Bar */}
            <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">تاريخ القيد: </span>
                <strong className="font-mono">{entryDate}</strong>
              </div>
              <div>
                <span className="text-slate-500">عملة السند: </span>
                <strong>{currency} (سعر الصرف: {currencyRate})</strong>
              </div>
              <div>
                <span className="text-slate-500">رقم المرجع: </span>
                <strong>{referenceNo || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-500">نوع السند: </span>
                <strong>{docType}</strong>
              </div>
              <div className="col-span-4 pt-1 border-t border-slate-200">
                <span className="text-slate-500">البيان العام: </span>
                <strong className="text-slate-900">{description || "تسوية محاسبية"}</strong>
              </div>
            </div>

            {/* Voucher Grid Table */}
            <table className="w-full text-right text-xs border-collapse border border-slate-900">
              <thead>
                <tr className="bg-slate-200 text-slate-900 border-b border-slate-900 font-bold">
                  <th className="p-2 border-l border-slate-900 text-center w-10">#</th>
                  <th className="p-2 border-l border-slate-900 w-24">رمز الحساب</th>
                  <th className="p-2 border-l border-slate-900">اسم الحساب المحاسبي</th>
                  <th className="p-2 border-l border-slate-900">البيان الخاص بالطرف</th>
                  <th className="p-2 border-l border-slate-900 text-center w-16">العملة</th>
                  <th className="p-2 border-l border-slate-900 text-center w-24 bg-emerald-50 text-emerald-900">مدين ({currency})</th>
                  <th className="p-2 text-center w-24 bg-blue-50 text-blue-900">دائن ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {lines.map((l, idx) => {
                  const acc = accountsList.find((a: any) => a.code === l.account_code);
                  return (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-2 text-center font-mono font-bold border-l border-slate-900">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold border-l border-slate-900">{l.account_code}</td>
                      <td className="p-2 font-semibold border-l border-slate-900">{acc ? acc.name : l.account_code}</td>
                      <td className="p-2 border-l border-slate-900 text-slate-700">{l.description || description}</td>
                      <td className="p-2 text-center font-mono border-l border-slate-900">{l.currency || currency}</td>
                      <td className="p-2 text-center font-mono font-bold border-l border-slate-900 text-emerald-800">
                        {l.debit ? Number(l.debit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-blue-800">
                        {l.credit ? Number(l.credit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals Row */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                  <td colSpan={5} className="p-2 text-left border-l border-slate-900 pl-4">
                    الإجمالي العام للسند ({currency}):
                  </td>
                  <td className="p-2 text-center font-mono font-black text-emerald-900 border-l border-slate-900 bg-emerald-100/60">
                    {totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-center font-mono font-black text-blue-900 bg-blue-100/60">
                    {totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words */}
            <div className="p-2 bg-slate-50 border border-slate-300 rounded text-xs">
              <span className="text-slate-600">المبلغ كتابة: </span>
              <strong className="text-indigo-900">{amountInWords}</strong>
            </div>

            {/* Approval & Signatures */}
            <div className="grid grid-cols-4 gap-4 pt-6 text-center text-xs">
              <div className="border-t border-slate-400 pt-1">
                <div className="font-bold">المحاسب المسؤول</div>
                <div className="text-[10px] text-slate-500 mt-4">التوقيع: ____________</div>
              </div>
              <div className="border-t border-slate-400 pt-1">
                <div className="font-bold">المراجع المالي</div>
                <div className="text-[10px] text-slate-500 mt-4">التوقيع: ____________</div>
              </div>
              <div className="border-t border-slate-400 pt-1">
                <div className="font-bold">المدير المالي</div>
                <div className="text-[10px] text-slate-500 mt-4">التوقيع: ____________</div>
              </div>
              <div className="border-t border-slate-400 pt-1">
                <div className="font-bold">اعتماد الإدارة العامة</div>
                <div className="text-[10px] text-slate-500 mt-4">الختم والتوقيع: _________</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDlg(false)} className="text-xs">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-Screen Report Viewer (Image 22) */}
      <ReportViewerModal
        isOpen={showFullScreenReport}
        onClose={() => setShowFullScreenReport(false)}
        title={`استعراض سند قيد يومية رقم ${entryNumber || '3'} - شاشة كاملة`}
        htmlContent={fullScreenReportHtml}
      />
    </>
  );
};

export default JournalVoucherModal;
