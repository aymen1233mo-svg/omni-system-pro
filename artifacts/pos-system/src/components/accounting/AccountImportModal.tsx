import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { extractTextFromPdf } from "@/lib/pdfExtractor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  ArrowRight,
  RefreshCw,
  Eye,
  ShieldAlert,
  Search,
  Check,
  FileDown
} from "lucide-react";

export interface ParsedAccountRow {
  code: string;
  name: string;
  type: string;
  parent_code: string | null;
  currency: string;
  balance: number;
  isValid: boolean;
  hasCorruptedSymbols: boolean;
  errorReason?: string;
}

interface AccountImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (count: number) => void;
  onCleanSuccess?: () => void;
}

// Check for corrupted encoding, replacement characters, or control characters
function checkCorruptedSymbols(str: string): { isCorrupted: boolean; reason?: string } {
  if (!str) return { isCorrupted: false };

  // 1. Check for unicode replacement character \uFFFD (the black diamond )
  if (str.includes("\uFFFD")) {
    return { isCorrupted: true, reason: "يحتوي على رمز تالف (\uFFFD) نتيجة تشفير غير صالح" };
  }

  // 2. Check for binary control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str)) {
    return { isCorrupted: true, reason: "يحتوي على رموز تحكم ثنائية غير مقروءة" };
  }

  // 3. Check for pure question marks or weird mojibake
  if (/^[\?\s\uFFFD\.\-_]+$/.test(str) && str.length > 0) {
    return { isCorrupted: true, reason: "الاسم يتكون من علامات استفهام أو رموز فارغة" };
  }

  return { isCorrupted: false };
}

// Normalize accounting type string
function normalizeAccountType(rawType: string, code: string): string {
  const t = (rawType || "").trim().toLowerCase();
  if (t.includes("أصول") || t.includes("اصول") || t.includes("أصل") || t === "asset") return "asset";
  if (t.includes("خصوم") || t.includes("التزام") || t.includes("إلتزام") || t === "liability") return "liability";
  if (t.includes("حقوق") || t.includes("رأس مال") || t.includes("راس مال") || t === "equity") return "equity";
  if (t.includes("إيراد") || t.includes("ايراد") || t.includes("مبيع") || t === "revenue") return "revenue";
  if (t.includes("مصروف") || t.includes("مصاريف") || t.includes("تكاليف") || t === "expense") return "expense";

  // Infer from code first digit
  const firstDigit = String(code).trim().charAt(0);
  if (firstDigit === "1") return "asset";
  if (firstDigit === "2") return "liability";
  if (firstDigit === "3") return "equity";
  if (firstDigit === "4") return "revenue";
  if (firstDigit === "5") return "expense";

  return "asset";
}

function getAccountTypeLabel(type: string): string {
  switch (type) {
    case "asset": return "أصول";
    case "liability": return "خصوم";
    case "equity": return "حقوق ملكية";
    case "revenue": return "إيرادات";
    case "expense": return "مصروفات";
    default: return "أصول";
  }
}

export function AccountImportModal({
  open,
  onOpenChange,
  onImportSuccess,
  onCleanSuccess,
}: AccountImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<"upload" | "preview">("upload");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; type: string } | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAccountRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "invalid">("all");
  const [importOnlyValid, setImportOnlyValid] = useState(true);

  // Reset state on close or open
  const resetState = () => {
    setCurrentStep("upload");
    setFileInfo(null);
    setParsedRows([]);
    setPastedText("");
    setSearchFilter("");
    setStatusFilter("all");
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  // Validate a parsed row
  const validateRow = (
    code: string,
    name: string,
    rawType: string,
    parentCode: string | null,
    currency: string,
    balance: number
  ): ParsedAccountRow => {
    const trimmedCode = String(code ?? "").trim();
    const trimmedName = String(name ?? "").trim();

    const codeCheck = checkCorruptedSymbols(trimmedCode);
    const nameCheck = checkCorruptedSymbols(trimmedName);

    let isValid = true;
    let hasCorruptedSymbols = false;
    let errorReason = "";

    if (codeCheck.isCorrupted) {
      isValid = false;
      hasCorruptedSymbols = true;
      errorReason = `كود الحساب تالف: ${codeCheck.reason}`;
    } else if (!trimmedCode || trimmedCode.length === 0) {
      isValid = false;
      errorReason = "كود الحساب مفقود أو فارغ";
    } else if (trimmedCode.length > 30) {
      isValid = false;
      errorReason = "كود الحساب طويل جداً";
    }

    if (isValid) {
      if (nameCheck.isCorrupted) {
        isValid = false;
        hasCorruptedSymbols = true;
        errorReason = `اسم الحساب تالف: ${nameCheck.reason}`;
      } else if (!trimmedName || trimmedName.length === 0) {
        isValid = false;
        errorReason = "اسم الحساب مفقود أو فارغ";
      } else if (trimmedName.length < 2) {
        isValid = false;
        errorReason = "اسم الحساب قصير جداً";
      }
    }

    const normalizedType = normalizeAccountType(rawType, trimmedCode);

    return {
      code: trimmedCode,
      name: trimmedName,
      type: normalizedType,
      parent_code: parentCode ? String(parentCode).trim() : null,
      currency: currency ? String(currency).trim().toUpperCase() : "YER",
      balance: Number(balance) || 0,
      isValid,
      hasCorruptedSymbols,
      errorReason: errorReason || undefined,
    };
  };

  // 1. Process Excel / CSV files
  const processExcelFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: "array", raw: false, cellDates: true });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("ملف الإكسل لا يحتوي على أي صفحات");
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("ملف الإكسل فارغ ولا يحتوي على بيانات");
      }

      // Find header row or default column positions
      let headerRowIndex = -1;
      let codeCol = -1;
      let nameCol = -1;
      let typeCol = -1;
      let parentCol = -1;
      let currencyCol = -1;
      let balanceCol = -1;

      // Scan top 10 rows for headers
      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        row.forEach((cell, idx) => {
          const val = String(cell || "").trim().toLowerCase();
          if (
            val.includes("كود") ||
            val.includes("رمز") ||
            val.includes("رقم الحساب") ||
            val === "code" ||
            val === "acc code" ||
            val === "account code"
          ) {
            codeCol = idx;
            headerRowIndex = r;
          }
          if (
            val.includes("اسم الحساب") ||
            val.includes("الاسم") ||
            val.includes("اسم") ||
            val === "name" ||
            val === "account name" ||
            val === "description"
          ) {
            nameCol = idx;
            headerRowIndex = r;
          }
          if (
            val.includes("نوع الحساب") ||
            val.includes("التصنيف") ||
            val.includes("النوع") ||
            val === "type" ||
            val === "account type"
          ) {
            typeCol = idx;
          }
          if (
            val.includes("الحساب الأب") ||
            val.includes("الرئيسي") ||
            val.includes("كود الأب") ||
            val.includes("parent")
          ) {
            parentCol = idx;
          }
          if (val.includes("عملة") || val === "currency") {
            currencyCol = idx;
          }
          if (
            val.includes("رصيد") ||
            val.includes("الرصيد") ||
            val === "balance"
          ) {
            balanceCol = idx;
          }
        });

        if (codeCol !== -1 && nameCol !== -1) {
          break;
        }
      }

      // If no explicit headers found, guess columns
      if (codeCol === -1 || nameCol === -1) {
        codeCol = 0;
        nameCol = 1;
        typeCol = 2;
        parentCol = 3;
        headerRowIndex = -1; // start from row 0
      }

      const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
      const parsed: ParsedAccountRow[] = [];

      for (let r = startIndex; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row) || row.every((c) => !c || String(c).trim() === "")) {
          continue; // skip completely empty rows
        }

        const rawCode = String(row[codeCol] ?? "").trim();
        const rawName = String(row[nameCol] ?? "").trim();
        const rawType = typeCol !== -1 ? String(row[typeCol] ?? "").trim() : "";
        const rawParent = parentCol !== -1 ? String(row[parentCol] ?? "").trim() : null;
        const rawCurr = currencyCol !== -1 ? String(row[currencyCol] ?? "").trim() : "YER";
        const rawBal = balanceCol !== -1 ? parseFloat(String(row[balanceCol])) || 0 : 0;

        // Skip if this row is just repeating header text
        if (
          rawCode.toLowerCase() === "code" ||
          rawCode === "كود الحساب" ||
          rawCode === "الرمز"
        ) {
          continue;
        }

        parsed.push(validateRow(rawCode, rawName, rawType, rawParent, rawCurr, rawBal));
      }

      if (parsed.length === 0) {
        throw new Error("لم يتم العثور على أي صفوف قابلة للاستيراد في الملف");
      }

      setFileInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.name.endsWith(".csv") ? "CSV Spreadsheet" : "Excel Spreadsheet",
      });
      setParsedRows(parsed);
      setCurrentStep("preview");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ أثناء قراءة ملف الإكسل",
        description: err.message || "تأكد من سلامة الملف وتنسيقه",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Process PDF files
  const processPdfFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const extractedText = await extractTextFromPdf(buffer);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("لم يتم العثور على نصوص قابلة للقراءة في ملف PDF. يرجى التأكد من أن المستند غير مشفر أو ممسوح كصورة فقط.");
      }

      const lines = extractedText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const parsed: ParsedAccountRow[] = [];

      for (const line of lines) {
        // Skip common PDF title / header lines
        if (
          line.includes("دليل الحسابات") ||
          line.includes("شجرة الحسابات") ||
          line.includes("تقرير") ||
          line.includes("الصفحة") ||
          line.includes("اسم الحساب") ||
          line.includes("كود الحساب") ||
          line.startsWith("===") ||
          line.startsWith("---")
        ) {
          continue;
        }

        // Try comma or pipe separation first
        if (line.includes(",") || line.includes("|") || line.includes("\t")) {
          const sep = line.includes(",") ? "," : line.includes("|") ? "|" : "\t";
          const parts = line.split(sep).map((p) => p.trim());
          if (parts.length >= 2) {
            const rawCode = parts[0];
            const rawName = parts[1];
            const rawType = parts[2] || "";
            const rawParent = parts[3] || null;
            const rawCurr = parts[4] || "YER";
            const rawBal = parseFloat(parts[5]) || 0;

            if (rawCode && rawName) {
              parsed.push(validateRow(rawCode, rawName, rawType, rawParent, rawCurr, rawBal));
              continue;
            }
          }
        }

        // Try Regex match: Account Code at beginning (digits/dots/dashes) followed by account name
        // Example: "11101 الصندوق الرئيسي أصول" or "11101 - الصندوق الرئيسي"
        const match = line.match(/^([0-9\.\-]{1,20})[\s\t\-:\|]+(.+)$/);
        if (match) {
          const rawCode = match[1].trim();
          const rest = match[2].trim();

          // Split rest into name and possible trailing type/currency
          const words = rest.split(/\s+/);
          let rawName = rest;
          let rawType = "";
          let rawParent: string | null = null;
          let rawCurr = "YER";

          // If last word is known type
          const lastWord = words[words.length - 1];
          if (["أصول", "خصوم", "التزامات", "إيرادات", "مصروفات", "حقوق"].some((k) => lastWord.includes(k))) {
            rawType = lastWord;
            rawName = words.slice(0, words.length - 1).join(" ");
          }

          if (rawCode && rawName) {
            parsed.push(validateRow(rawCode, rawName, rawType, rawParent, rawCurr, 0));
          }
        }
      }

      if (parsed.length === 0) {
        throw new Error(
          "لم يتم العثور على أسطر حسابات واضحة داخل ملف PDF. يرجى التأكد من أن الملف يحتوي على أرقام وأسماء الحسابات بوضوح."
        );
      }

      setFileInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: "PDF Document",
      });
      setParsedRows(parsed);
      setCurrentStep("preview");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ أثناء قراءة ملف PDF",
        description: err.message || "تعذر استخراج بيانات الحسابات من المستند",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Process pasted CSV text
  const processPastedText = () => {
    if (!pastedText.trim()) {
      toast({ variant: "destructive", title: "يرجى لصق بيانات الحسابات أولاً" });
      return;
    }

    const lines = pastedText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: ParsedAccountRow[] = [];

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length >= 2) {
        const rawCode = parts[0];
        const rawName = parts[1];
        if (rawCode.toLowerCase() === "code" || rawCode === "كود الحساب" || rawCode === "الرمز") {
          continue;
        }
        const rawType = parts[2] || "";
        const rawParent = parts[3] || null;
        const rawCurr = parts[4] || "YER";
        const rawBal = parseFloat(parts[5]) || 0;

        parsed.push(validateRow(rawCode, rawName, rawType, rawParent, rawCurr, rawBal));
      }
    }

    if (parsed.length === 0) {
      toast({
        variant: "destructive",
        title: "لم يتم التعرف على أي أسطر صالحة",
        description: "يرجى استخدام الصيغة: كود_الحساب,اسم_الحساب,النوع,الحساب_الأب",
      });
      return;
    }

    setFileInfo({
      name: "بيانات نصية ملصوقة (Pasted CSV)",
      size: `${(pastedText.length / 1024).toFixed(1)} KB`,
      type: "Direct Text Entry",
    });
    setParsedRows(parsed);
    setCurrentStep("preview");
  };

  // Handle file selection from input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const name = file.name.toLowerCase();

      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
        processExcelFile(file);
      } else if (name.endsWith(".pdf")) {
        processPdfFile(file);
      } else {
        toast({
          variant: "destructive",
          title: "نوع الملف غير مدعوم",
          description: "يرجى اختيار ملف إكسل (.xlsx, .xls, .csv) أو مستند PDF (.pdf)",
        });
      }
    }
  };

  // Download Excel (.xlsx) template
  const downloadExcelTemplate = () => {
    const sampleData = [
      {
        "كود الحساب": "11101",
        "اسم الحساب": "صندوق الكاشير 1",
        "نوع الحساب": "أصول",
        "الحساب الأب": "11100",
        "العملة": "YER",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "11102",
        "اسم الحساب": "صندوق الصالة الرئيسي",
        "نوع الحساب": "أصول",
        "الحساب الأب": "11100",
        "العملة": "SAR",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "11201",
        "اسم الحساب": "شركة الأفق للسفريات",
        "نوع الحساب": "أصول",
        "الحساب الأب": "11200",
        "العملة": "USD",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "21101",
        "اسم الحساب": "شركة الخطوط الجوية العربية",
        "نوع الحساب": "خصوم",
        "الحساب الأب": "21100",
        "العملة": "SAR",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "31001",
        "اسم الحساب": "رأس المال المدفوع",
        "نوع الحساب": "حقوق ملكية",
        "الحساب الأب": "31000",
        "العملة": "YER",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "41001",
        "اسم الحساب": "إيرادات خدمات العمرة والتأشيرات",
        "نوع الحساب": "إيرادات",
        "الحساب الأب": "41000",
        "العملة": "SAR",
        "الرصيد الافتتاحي": 0,
      },
      {
        "كود الحساب": "51001",
        "اسم الحساب": "مصروفات ضيافة وبوفيه",
        "نوع الحساب": "مصروفات",
        "الحساب الأب": "51000",
        "العملة": "YER",
        "الرصيد الافتتاحي": 0,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دليل الحسابات");
    XLSX.writeFile(wb, "قالب_استيراد_دليل_الحسابات_OmniSystemProERP.xlsx");

    toast({ title: "تم تنزيل نموذج إكسل المعتمد بنجاح" });
  };

  // Download CSV template
  const downloadCsvTemplate = () => {
    const csvContent =
      "كود الحساب,اسم الحساب,نوع الحساب,الحساب الأب,العملة,الرصيد\n" +
      "11101,صندوق الكاشير 1,asset,11100,YER,0\n" +
      "11102,صندوق الصالة الرئيسي,asset,11100,SAR,0\n" +
      "11201,شركة الأفق للسفريات,asset,11200,USD,0\n" +
      "21101,شركة خطوط الطيران,liability,21100,SAR,0\n" +
      "41001,إيرادات خدمات العمرة,revenue,41000,SAR,0\n" +
      "51001,مصروفات كهرباء وإنارة,expense,51000,YER,0";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "قالب_استيراد_دليل_الحسابات.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "تم تنزيل نموذج CSV المعتمد بنجاح" });
  };

  // Clean corrupted accounts from database
  const handleCleanCorruptedAccounts = async () => {
    if (!confirm("هل أنت متأكد من تنظيف وحذف كافة الحسابات التالفة والتي تحتوي على رموز مشوهة أو أكواد مفرغة من دليل الحسابات؟")) {
      return;
    }

    setIsCleaning(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/accounting/accounts/clean-corrupted", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const res = await r.json();

      if (!r.ok) throw new Error(res.error || "فشل تنظيف الحسابات التالفة");

      toast({
        title: "اكتمل تنظيف دليل الحسابات",
        description: `تم إزالة ${res.cleanedCount} حساب تالف ومعطوب بنجاح`,
      });

      if (onCleanSuccess) onCleanSuccess();
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل التنظيف", description: e.message });
    } finally {
      setIsCleaning(false);
    }
  };

  // Submit bulk import
  const handleExecuteImport = async () => {
    const rowsToImport = importOnlyValid
      ? parsedRows.filter((r) => r.isValid)
      : parsedRows;

    if (rowsToImport.length === 0) {
      toast({
        variant: "destructive",
        title: "لا توجد أي حسابات صالحة للاستيراد",
        description: "يرجى تصحيح الأخطاء أو استخدام القالب المعتمد",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const accountsPayload = rowsToImport.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        parent_code: r.parent_code,
        currency: r.currency,
        balance: r.balance,
      }));

      const r = await fetch("/api/accounting/accounts/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accounts: accountsPayload }),
      });

      const res = await r.json();

      if (!r.ok) {
        throw new Error(res.error || "فشل استيراد الحسابات");
      }

      toast({
        title: "تم الاستيراد بنجاح",
        description: `تم استيراد ${res.importedCount} حساب بنجاح في شجرة ودليل الحسابات`,
      });

      onImportSuccess(res.importedCount);
      handleClose();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل استيراد الحسابات",
        description: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Statistics
  const totalRows = parsedRows.length;
  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);
  const corruptedRows = parsedRows.filter((r) => r.hasCorruptedSymbols);

  // Severe file unsuitability detection:
  // If 0 valid rows OR all rows are invalid/corrupted
  const isFileUnsuitable = totalRows > 0 && validRows.length === 0;
  const hasSevereCorruption = corruptedRows.length > 0 && corruptedRows.length === totalRows;

  // Filter preview table rows
  const filteredRows = parsedRows.filter((row) => {
    if (statusFilter === "valid" && !row.isValid) return false;
    if (statusFilter === "invalid" && row.isValid) return false;

    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const codeMatch = row.code.toLowerCase().includes(q);
      const nameMatch = row.name.toLowerCase().includes(q);
      const typeMatch = row.type.toLowerCase().includes(q) || getAccountTypeLabel(row.type).includes(q);
      return codeMatch || nameMatch || typeMatch;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(true))}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden font-sans">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-slate-50/80 dark:bg-slate-900/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  استيراد دليل الحسابات الذكي (Excel & PDF)
                  <Badge variant="outline" className="text-[11px] font-mono text-indigo-700 bg-indigo-50 dark:bg-indigo-950 border-indigo-200">
                    معاينة وتحقق أمني
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  استيراد مباشر لشجرة الحسابات مع فحص المحتوى ومنع الرموز المعطوبة قبل الحفظ
                </p>
              </div>
            </div>
            {currentStep === "preview" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep("upload")}
                className="text-xs gap-1.5 h-8 border-slate-300"
              >
                <ArrowRight className="w-3.5 h-3.5" /> اختيار ملف آخر
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {currentStep === "upload" ? (
            /* ───────────────────────────────────────────────────────────── */
            /* STEP 1: UPLOAD & TEMPLATES                                    */
            /* ───────────────────────────────────────────────────────────── */
            <div className="space-y-5">
              {/* Instructions and safety banner */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  ميزة المعاينة قبل الاستيراد والحماية من الرموز المعطوبة
                </div>
                <p className="text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
                  يقوم النظام الآن بعرض ومعاينة كامل بيانات الملف المستورد وفحص كل سجل للتأكد من وجود كود الحساب والاسم الصحيح وخلوه من الرموز التالفة () أو المحارف الثنائية غير الصالحة، لمنع حدوث أي تشويه في دليل الحسابات.
                </p>
              </div>

              {/* Template Download & Cleanup Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadExcelTemplate}
                  className="h-10 text-xs font-semibold gap-2 border-emerald-200 hover:bg-emerald-50 text-emerald-700 dark:hover:bg-emerald-950/40 justify-center"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  تحميل قالب إكسل المعتمد (.xlsx)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCsvTemplate}
                  className="h-10 text-xs font-semibold gap-2 border-blue-200 hover:bg-blue-50 text-blue-700 dark:hover:bg-blue-950/40 justify-center"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  تحميل قالب CSV المعتمد (.csv)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCleaning}
                  onClick={handleCleanCorruptedAccounts}
                  className="h-10 text-xs font-semibold gap-2 border-rose-200 hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/40 justify-center"
                >
                  {isCleaning ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  )}
                  تنظيف الرموز التالفة القديمة من الدليل
                </Button>
              </div>

              {/* Drag & Drop File Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 dark:border-indigo-800/60 dark:hover:border-indigo-600 bg-slate-50/50 hover:bg-indigo-50/20 dark:bg-slate-900/30 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="account-file-uploader"
                  className="hidden"
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/pdf"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-inner">
                    {isProcessing ? (
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    ) : (
                      <Upload className="w-7 h-7" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {isProcessing ? "جاري قراءة وتحليل بيانات الملف..." : "انقر لاختيار ملف إكسل أو PDF من جهازك"}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      يدعم جداول الإكسل (.xlsx, .xls, .csv) ومستندات كشف الحسابات (PDF)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600">
                      Excel (.xlsx)
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600">
                      Spreadsheet (.csv)
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600">
                      Document (.pdf)
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Or Paste Raw Text */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    أو الصق بيانات الحسابات نصياً بتنسيق CSV:
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (كود_الحساب,اسم_الحساب,النوع,الحساب_الأب)
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="11101,صندوق الصالة,asset,11100&#10;11205,عميل سفريات VIP,asset,11200"
                  className="w-full p-2.5 text-xs font-mono border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={processPastedText}
                  disabled={!pastedText.trim()}
                  className="w-full text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900"
                >
                  <Eye className="w-3.5 h-3.5 ml-1" />
                  معاينة البيانات الملصوقة
                </Button>
              </div>
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* STEP 2: INTERACTIVE PREVIEW & SECURITY VERIFICATION          */
            /* ───────────────────────────────────────────────────────────── */
            <div className="space-y-4">
              {/* File Info & Stats Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg text-indigo-600">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {fileInfo?.name}
                      <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800">
                        {fileInfo?.type}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">الحجم: {fileInfo?.size}</div>
                  </div>
                </div>

                {/* Badges metrics */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono py-1 px-2.5">
                    إجمالي الصفوف: {totalRows}
                  </Badge>

                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 font-mono py-1 px-2.5">
                    صالحة للاستيراد: {validRows.length}
                  </Badge>

                  {invalidRows.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 font-mono py-1 px-2.5">
                      غير صالحة / معطوبة: {invalidRows.length}
                    </Badge>
                  )}
                </div>
              </div>

              {/* CRITICAL SECURITY / CORRUPTION ALERT */}
              {isFileUnsuitable ? (
                <div className="bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-900 p-4 rounded-xl flex items-start gap-3 text-rose-900 dark:text-rose-200">
                  <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-bold text-sm text-rose-700 dark:text-rose-300">
                      ⛔ تم منع استيراد هذا الملف لحماية النظام
                    </h5>
                    <p className="text-xs leading-relaxed text-rose-800 dark:text-rose-200">
                      الملف المرفق لا يحتوي على أي حسابات صالحة أو يحتوي على رموز تالفة وتشفير مشوه، ولا يتطابق مع هيكل دليل الحسابات. تم إيقاف عملية الاستيراد تلقائياً لحماية قاعدة البيانات من التلف.
                    </p>
                    <p className="text-xs font-semibold text-rose-700 mt-2">
                      💡 الحل: يرجى تحميل "قالب إكسل المعتمد" من الشاشة السابقة وتعبئة بيانات الحسابات داخله ثم إعادة رفعه.
                    </p>
                  </div>
                </div>
              ) : invalidRows.length > 0 ? (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3.5 rounded-xl flex items-start justify-between gap-3 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-xs text-amber-800 dark:text-amber-300">
                        تنبيه: تم العثور على {invalidRows.length} سجل يحتوي على أخطاء أو رموز تالفة
                      </h5>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                        سيتم استيراد الحسابات الصالحة فقط ({validRows.length} حساب) واستبعاد السجلات التالفة لحماية دليل الحسابات.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={importOnlyValid}
                      onChange={(e) => setImportOnlyValid(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>استيراد الصالح فقط</span>
                  </label>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 rounded-xl flex items-center gap-2.5 text-emerald-900 dark:text-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold">
                    ممتاز! تم التحقق بنجاح من كافة السجلات ({validRows.length} حساب) وهي جاهزة للاستيراد في دليل الحسابات.
                  </span>
                </div>
              )}

              {/* Table Search and Filters */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="بحث في المعاينة..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pr-8 h-8 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={statusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStatusFilter("all")}
                    className={`h-7 text-xs px-2.5 ${statusFilter === "all" ? "bg-indigo-600 text-white" : ""}`}
                  >
                    الكل ({totalRows})
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "valid" ? "default" : "outline"}
                    onClick={() => setStatusFilter("valid")}
                    className={`h-7 text-xs px-2.5 ${statusFilter === "valid" ? "bg-emerald-600 text-white" : ""}`}
                  >
                    الصالحة ({validRows.length})
                  </Button>
                  {invalidRows.length > 0 && (
                    <Button
                      size="sm"
                      variant={statusFilter === "invalid" ? "default" : "outline"}
                      onClick={() => setStatusFilter("invalid")}
                      className={`h-7 text-xs px-2.5 ${statusFilter === "invalid" ? "bg-rose-600 text-white" : ""}`}
                    >
                      التالفة / أخطاء ({invalidRows.length})
                    </Button>
                  )}
                </div>
              </div>

              {/* Interactive Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10 text-slate-700 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5 w-24">كود الحساب</th>
                        <th className="p-2.5 min-w-[180px]">اسم الحساب</th>
                        <th className="p-2.5 w-24">النوع</th>
                        <th className="p-2.5 w-24">الحساب الأب</th>
                        <th className="p-2.5 w-20">العملة</th>
                        <th className="p-2.5 w-24">الرصيد</th>
                        <th className="p-2.5 w-32 text-center">حالة السجل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                            لا توجد بيانات مطابقة لخيارات الفلترة
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              !row.isValid
                                ? "bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/50"
                                : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                              {row.code ? (
                                row.code
                              ) : (
                                <span className="text-rose-500 italic text-[11px]">فارغ</span>
                              )}
                            </td>
                            <td className="p-2.5 font-medium text-slate-900 dark:text-white">
                              {row.name ? (
                                row.name
                              ) : (
                                <span className="text-rose-500 italic text-[11px]">غير مسمى</span>
                              )}
                              {row.errorReason && (
                                <div className="text-[10px] text-rose-600 font-normal mt-0.5">
                                  {row.errorReason}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[10px] py-0 font-normal">
                                {getAccountTypeLabel(row.type)}
                              </Badge>
                            </td>
                            <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                              {row.parent_code || "—"}
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-600">
                              {row.currency}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600 text-[11px]">
                              {Number(row.balance).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">
                              {row.isValid ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 text-[10px] gap-1 font-semibold">
                                  <Check className="w-3 h-3" /> صالح للاستيراد
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100 text-[10px] gap-1 font-semibold">
                                  <XCircle className="w-3 h-3" /> غير صالح / تالف
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between flex-shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="text-xs h-9"
          >
            إلغاء
          </Button>

          {currentStep === "preview" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep("upload")}
                className="text-xs h-9"
              >
                تغيير الملف
              </Button>

              <Button
                size="sm"
                disabled={isSubmitting || isFileUnsuitable || validRows.length === 0}
                onClick={handleExecuteImport}
                className={`text-xs font-bold h-9 px-4 gap-2 text-white shadow-sm ${
                  isFileUnsuitable || validRows.length === 0
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    جاري الاستيراد...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    تأكيد واستيراد الحسابات ({validRows.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
