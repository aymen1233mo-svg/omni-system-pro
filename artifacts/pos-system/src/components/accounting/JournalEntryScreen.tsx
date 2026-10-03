import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { tafqeet } from "@/lib/tafqeet";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { generateJournalVoucherA4Html } from "@/lib/printUtils";
import { Card, CardContent } from "@/components/ui/card";
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
  X,
  Sliders,
  FileSpreadsheet,
  FileDown,
  ArrowRightLeft,
  SearchIcon,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

interface JournalEntryScreenProps {
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

export const JournalEntryScreen: React.FC<JournalEntryScreenProps> = ({
  accountsList,
  costCentersList = [],
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [docType, setDocType] = useState("قيد عادي");
  const [activeTab, setActiveTab] = useState("details");
  const [attachments, setAttachments] = useState<string[]>([]);

  // Lines
  const [lines, setLines] = useState<JournalLine[]>([
    {
      account_code: accountsList[0]?.code || "",
      currency: "YER",
      exchange_rate: 1.0,
      foreign_amount: "",
      debit: "",
      credit: "",
      description: "",
      cost_center_id: "all",
    },
    {
      account_code: accountsList[1]?.code || "",
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
  const [showPreviewDlg, setShowPreviewDlg] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Fetch all entries for navigation & search
  const { data: allEntries = [], refetch: refetchEntries } = useQuery<any[]>({
    queryKey: ["journal-entries-list"],
    queryFn: () => apiGet("/api/accounting/journal-entries"),
  });

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
    setDocType(entry.doc_type || "قيد عادي");

    if (entry.lines && entry.lines.length > 0) {
      setLines(
        entry.lines.map((l: any) => ({
          id: l.id,
          account_code: l.account_code || "",
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
    setDocType("قيد عادي");
    setLines([
      {
        account_code: accountsList[0]?.code || "",
        currency: "YER",
        exchange_rate: 1.0,
        foreign_amount: "",
        debit: "",
        credit: "",
        description: "",
        cost_center_id: "all",
      },
      {
        account_code: accountsList[1]?.code || "",
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

  useEffect(() => {
    if (allEntries.length > 0 && !currentEntryId) {
      loadEntry(allEntries[0]);
    } else if (!currentEntryId) {
      handleNewEntry();
    }
  }, [allEntries.length]);

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

  const updateLine = (idx: number, field: keyof JournalLine, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };

    if (field === "debit" && value !== "") {
      updated[idx].credit = "";
    } else if (field === "credit" && value !== "") {
      updated[idx].debit = "";
    } else if (field === "currency") {
        const foundCurr = SUPPORTED_CURRENCIES.find((c) => c.code === value);
        if (foundCurr) {
            updated[idx].exchange_rate = foundCurr.defaultRate;
        }
    }

    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        account_code: "",
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
        description: "يجب أن يحتوي القيد على بندين محاسبيين على الأقل.",
        variant: "destructive",
      });
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleAutoBalance = () => {
    if (totalDebit === totalCredit) return;
    const diff = Number((totalDebit - totalCredit).toFixed(2));
    const lastIdx = lines.length - 1;
    const updated = [...lines];
    if (diff > 0) {
        if (updated[lastIdx].debit === "") {
            updated[lastIdx].credit = (Number(updated[lastIdx].credit || 0) + diff).toFixed(2);
        } else {
            updated.push({
                account_code: "",
                currency: currency,
                exchange_rate: 1.0,
                foreign_amount: diff,
                debit: "",
                credit: diff.toFixed(2),
                description: "موازنة تلقائية",
                cost_center_id: costCenterId,
            });
        }
    } else {
        const absDiff = Math.abs(diff);
        if (updated[lastIdx].credit === "") {
            updated[lastIdx].debit = (Number(updated[lastIdx].debit || 0) + absDiff).toFixed(2);
        } else {
            updated.push({
                account_code: "",
                currency: currency,
                exchange_rate: 1.0,
                foreign_amount: absDiff,
                debit: absDiff.toFixed(2),
                credit: "",
                description: "موازنة تلقائية",
                cost_center_id: costCenterId,
            });
        }
    }
    setLines(updated);
  };

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
      toast({ title: "تم حفظ القيد بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["journal-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-list"] });
      loadEntry(data);
    },
    onError: (err: any) => {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    },
  });

  const handlePreview = () => {
    const mappedLines = lines.map((l) => {
      const acc = accountsList.find(a => String(a.code) === String(l.account_code));
      return {
        account_code: l.account_code || "",
        analytical: "",
        account_name: acc ? acc.name : (l.account_code || ""),
        description: l.description || description || "قيد يومية",
        cost_center: "",
        currency: l.currency || currency || "SAR",
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0)
      };
    });

    const html = generateJournalVoucherA4Html({
      voucherNumber: entryNumber || String(currentEntryId || "3"),
      date: entryDate,
      docType: docType || "قيد عادي",
      userName: "المستخدم الحالي",
      description: description || "قيد يومية",
      currency: currency || "ريال",
      referenceNo: referenceNo || "",
      lines: mappedLines,
      agencyName: "وكالة اليمني للسفريات والسياحة",
      agencyAddress: "اليمن - رداع"
    });

    setReportHtml(html);
    setReportTitle(`سند قيد رقم ${entryNumber}`);
    setShowPreviewDlg(true);
  };

  const currentIndex = allEntries.findIndex((e) => e.id === currentEntryId);

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 p-2 font-sans overflow-hidden" dir="rtl">
      {/* Horizontal Toolbar matching Onyx Pro Image */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mb-2">
        <CardContent className="p-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded text-white shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-sm text-slate-800 dark:text-white">شاشة القيود اليومية (Journal Entry)</h2>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold px-3">
              {currentEntryId ? (isEditMode ? "وضع التعديل" : "قيد مرحل") : "قيد جديد"}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={handleNewEntry} className="h-8 gap-1.5 text-xs font-bold text-indigo-700 border-indigo-200">
              <Plus className="w-4 h-4" /> جديد
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} disabled={!currentEntryId || isEditMode} className="h-8 gap-1.5 text-xs font-bold text-amber-700 border-amber-200">
              <Edit3 className="w-4 h-4" /> تعديل
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Save className="w-4 h-4" /> حفظ (F10)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSearchDlg(true)} className="h-8 gap-1.5 text-xs font-bold">
              <SearchIcon className="w-4 h-4" /> بحث
            </Button>
            <Button variant="outline" size="sm" onClick={handlePreview} className="h-8 gap-1.5 text-xs font-bold text-indigo-700">
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <div className="flex items-center gap-0.5 mx-1 border-r border-l px-1">
               <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => currentIndex > 0 && loadEntry(allEntries[0])} disabled={currentIndex <= 0}><ChevronsRight className="w-4 h-4" /></Button>
               <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => currentIndex > 0 && loadEntry(allEntries[currentIndex - 1])} disabled={currentIndex <= 0}><ChevronRight className="w-4 h-4" /></Button>
               <span className="text-[10px] font-mono font-bold px-1">{currentIndex + 1} / {allEntries.length}</span>
               <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => currentIndex < allEntries.length - 1 && loadEntry(allEntries[currentIndex + 1])} disabled={currentIndex >= allEntries.length - 1}><ChevronLeft className="w-4 h-4" /></Button>
               <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => currentIndex < allEntries.length - 1 && loadEntry(allEntries[allEntries.length - 1])} disabled={currentIndex >= allEntries.length - 1}><ChevronsLeft className="w-4 h-4" /></Button>
            </div>
            <Button variant="destructive" size="sm" onClick={() => { if(confirm("هل متأكد؟")) apiDelete(`/api/accounting/journal-entries/${currentEntryId}`).then(() => { toast({title: "تم الحذف"}); refetchEntries(); handleNewEntry(); }) }} disabled={!currentEntryId} className="h-8 gap-1.5 text-xs font-bold">
              <Trash2 className="w-4 h-4" /> حذف
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Entry Header Form */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm mb-2">
        <CardContent className="p-3">
           <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم القيد</label>
                <Input value={entryNumber} onChange={(e) => setEntryNumber(e.target.value)} className="h-8 text-xs font-mono font-bold text-indigo-700" readOnly={!isEditMode && !!currentEntryId} />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تاريخ القيد</label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="h-8 text-xs font-bold" />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">العملة الأساسية</label>
                <Select value={currency} onValueChange={(v) => { setCurrency(v); const f = SUPPORTED_CURRENCIES.find(c => c.code === v); if(f) setCurrencyRate(f.defaultRate); }}>
                  <SelectTrigger className="h-8 text-xs bg-slate-50 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">س.ص</label>
                <Input value={currencyRate} onChange={(e) => setCurrencyRate(e.target.value)} className="h-8 text-xs font-mono text-center" />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم المرجع</label>
                <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="md:col-span-3">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">البيان العام</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح تفصيلي للقيد..." className="h-8 text-xs bg-amber-50/30 border-amber-200" />
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Grid Toolbar */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
           <Button size="sm" variant="outline" onClick={addLine} className="h-7 text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><Plus className="w-3 h-3" /> إضافة طرف</Button>
           <Button size="sm" variant="outline" onClick={handleAutoBalance} className="h-7 text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200 gap-1"><Sliders className="w-3 h-3" /> موازنة تلقائية</Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold">
           <span className="flex items-center gap-1.5">إجمالي مدين: <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[11px] font-mono">{fmt(totalDebit)}</Badge></span>
           <span className="flex items-center gap-1.5">إجمالي دائن: <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[11px] font-mono">{fmt(totalCredit)}</Badge></span>
           <span className={`flex items-center gap-1.5 ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>الفارق: <Badge variant={isBalanced ? "outline" : "destructive"} className={`text-[11px] font-mono ${isBalanced ? 'bg-emerald-50' : ''}`}>{fmt(difference)}</Badge></span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-auto shadow-inner">
        <table className="w-full text-right text-xs border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-slate-200 dark:bg-slate-800 z-10 font-black border-b border-slate-300 shadow-sm">
            <tr>
              <th className="p-2 border-l text-center w-12">#</th>
              <th className="p-2 border-l w-64">الحساب (F9)</th>
              <th className="p-2 border-l w-20 text-center">العملة</th>
              <th className="p-2 border-l w-20 text-center">س.ص</th>
              <th className="p-2 border-l w-24 text-center">مبلغ</th>
              <th className="p-2 border-l w-28 text-center bg-emerald-50 text-emerald-800">مدين ({currency})</th>
              <th className="p-2 border-l w-28 text-center bg-blue-50 text-blue-800">دائن ({currency})</th>
              <th className="p-2 border-l">البيان التحليلي للطرف</th>
              <th className="p-2 border-l w-32">مركز التكلفة</th>
              <th className="p-2 text-center w-12">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-1 border-l text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                <td className="p-1 border-l">
                  <Select value={line.account_code} onValueChange={(v) => updateLine(idx, "account_code", v)}>
                    <SelectTrigger className="h-7 text-[11px] bg-transparent border-0 focus:ring-0 font-bold text-indigo-700"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {accountsList.map(a => <SelectItem key={a.id} value={a.code} className="text-xs">[{a.code}] - {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1 border-l">
                   <Select value={line.currency} onValueChange={(v) => updateLine(idx, "currency", v)}>
                     <SelectTrigger className="h-7 text-[10px] text-center bg-transparent border-0 p-0"><SelectValue /></SelectTrigger>
                     <SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c.code} value={c.code} className="text-[10px]">{c.code}</SelectItem>)}</SelectContent>
                   </Select>
                </td>
                <td className="p-1 border-l">
                  <Input value={line.exchange_rate} onChange={(e) => updateLine(idx, "exchange_rate", e.target.value)} className="h-7 text-[11px] font-mono text-center border-0 bg-transparent p-0" />
                </td>
                <td className="p-1 border-l">
                  <Input 
                    value={line.foreign_amount} 
                    onChange={(e) => {
                      const v = e.target.value;
                      const rate = Number(line.exchange_rate) || 1;
                      const base = Number(v) * rate;
                      const updated = [...lines];
                      updated[idx].foreign_amount = v;
                      if (idx === 0 || Number(line.debit) > 0) updated[idx].debit = base.toFixed(2);
                      else updated[idx].credit = base.toFixed(2);
                      setLines(updated);
                    }} 
                    className="h-7 text-xs font-mono font-bold text-center border-0 bg-transparent" 
                  />
                </td>
                <td className="p-1 border-l bg-emerald-50/30">
                   <Input value={line.debit} onChange={(e) => updateLine(idx, "debit", e.target.value)} className="h-7 text-xs font-mono font-black text-emerald-700 bg-white border-emerald-200 text-center" />
                </td>
                <td className="p-1 border-l bg-blue-50/30">
                   <Input value={line.credit} onChange={(e) => updateLine(idx, "credit", e.target.value)} className="h-7 text-xs font-mono font-black text-blue-700 bg-white border-blue-200 text-center" />
                </td>
                <td className="p-1 border-l">
                   <Input value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} className="h-7 text-[11px] border-0 bg-transparent" placeholder={description || "بيان الطرف..."} />
                </td>
                <td className="p-1 border-l">
                   <Select value={String(line.cost_center_id)} onValueChange={(v) => updateLine(idx, "cost_center_id", v)}>
                     <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        {costCentersList.map(cc => <SelectItem key={cc.id} value={String(cc.id)} className="text-[10px]">{cc.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                </td>
                <td className="p-1 text-center">
                   <Button variant="ghost" size="sm" onClick={() => removeLine(idx)} className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-slate-200 dark:bg-slate-800 font-black border-t shadow-sm">
            <tr>
              <td colSpan={5} className="p-2 text-left">الإجماليات:</td>
              <td className="p-2 text-center font-mono text-emerald-800 border-l">{fmt(totalDebit)}</td>
              <td className="p-2 text-center font-mono text-blue-800 border-l">{fmt(totalCredit)}</td>
              <td colSpan={3} className="p-2 text-xs font-bold text-slate-500 italic">
                {tafqeet(Math.max(totalDebit, totalCredit), currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer Info Area */}
      <div className="mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 flex items-center justify-between text-[10px] text-slate-500 shadow-sm">
         <div className="flex items-center gap-4">
            <span>تاريخ الإنشاء: <strong className="text-slate-800 dark:text-slate-200 font-mono">2026-09-12 14:30</strong></span>
            <span>بواسطة: <strong className="text-slate-800 dark:text-slate-200 font-bold">علي احمد اليمني</strong></span>
            <span>الفرع: <strong className="text-indigo-600 font-bold">فرع مكة المكرمة</strong></span>
         </div>
         <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> القيد متزن</span>
            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" /> يحتاج مراجعة (اختياري)</span>
         </div>
      </div>

      {/* Search Dialog */}
      <Dialog open={showSearchDlg} onOpenChange={setShowSearchDlg}>
        <DialogContent className="max-w-2xl bg-slate-50 dark:bg-slate-900" dir="rtl">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-indigo-700"><Search className="w-5 h-5" /> بحث عن قيد يومية</DialogTitle>
           </DialogHeader>
           <div className="space-y-3 p-2">
              <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-xs font-bold block mb-1">من تاريخ</label><Input type="date" value={searchFromDate} onChange={e => setSearchFromDate(e.target.value)} className="h-8 text-xs" /></div>
                 <div><label className="text-xs font-bold block mb-1">الى تاريخ</label><Input type="date" value={searchToDate} onChange={e => setSearchToDate(e.target.value)} className="h-8 text-xs" /></div>
              </div>
              <Input placeholder="ابحث برقم القيد أو البيان..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-9 text-xs" />
              <div className="max-h-64 overflow-y-auto border rounded bg-white divide-y">
                 {allEntries.filter(e => {
                    const q = searchQuery.toLowerCase();
                    return (!searchQuery || e.entry_number?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)) &&
                           (!searchFromDate || e.entry_date >= searchFromDate) &&
                           (!searchToDate || e.entry_date <= searchToDate);
                 }).map(e => (
                    <div key={e.id} onClick={() => { loadEntry(e); setShowSearchDlg(false); }} className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between">
                       <div className="flex flex-col">
                          <span className="font-bold text-xs text-indigo-700">{e.entry_number}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[300px]">{e.description}</span>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-black">{fmt(e.total_amount || 0)} {e.currency}</span>
                          <span className="text-[10px] text-slate-400">{e.entry_date}</span>
                       </div>
                    </div>
                 ))}
                 {allEntries.length === 0 && <div className="p-4 text-center text-slate-400 text-xs">لا توجد سجلات مطابقة</div>}
              </div>
           </div>
        </DialogContent>
      </Dialog>

      <ReportViewerModal isOpen={showPreviewDlg} onClose={() => setShowPreviewDlg(false)} htmlContent={reportHtml} title={reportTitle} />
    </div>
  );
};

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
