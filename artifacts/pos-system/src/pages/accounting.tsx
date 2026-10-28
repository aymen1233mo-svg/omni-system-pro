import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import omnisystemLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Eye, Search, FileText, Printer, Sliders, RefreshCw, Sparkles,
  Wallet, Edit, BookOpen, CheckCircle, AlertTriangle, Building2, TrendingUp,
  ArrowRightLeft, Landmark, Layers, ShieldCheck, Scale, Calculator, ArrowUpRight,
  ArrowDownLeft, Calendar, FileSpreadsheet, Lock, FolderTree, Folder, Link as LinkIcon, Info, Upload, Download, Coins, Maximize2, FileDown
} from "lucide-react";
import { tafqeet } from "@/lib/tafqeet";
import { printA4Html, generateStatementA4Html, generateTrialBalanceA4Html, generateFinancialA4Html, generateVoucherA4Html, generateJournalVoucherA4Html, generateVoucherStyle2A4Html } from "@/lib/printUtils";
import JournalVoucherModal from "@/components/accounting/JournalVoucherModal";
import { JournalEntryScreen } from "@/components/accounting/JournalEntryScreen";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { PrintHeader } from "@/components/print-header";
import { AccountImportModal } from "@/components/accounting/AccountImportModal";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPut(url: string, body: any) { const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Accounting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [location] = useLocation();

  const [reportOpts, setReportOpts] = useState({
    fromDate: "2026-02-08",
    toDate: "2026-08-28",
    fiscalYear: "2026",
    excludeClosing: false,
    description: "",
    branchId: "1",
    branchName: "وكالة اليمني للسفريات والسياحة",
    department: true,
    displayMethod: "by_code",
    currencyType: "local",
    byLevel: true,
    selectedLevel: 0,
    viewGranularity: "movement",
    expandAll: false,
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("tab") || "dashboard";
    }
    return "dashboard";
  });

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", tabName);
      window.history.pushState({}, "", u.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab("dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [openingBalances, setOpeningBalances] = useState<{[code: string]: { debit: number; credit: number }}>({});
  const [openingSearch, setOpeningSearch] = useState("");
  const [openingTypeFilter, setOpeningTypeFilter] = useState("all");
  const [isSavingOpening, setIsSavingOpening] = useState(false);

  /* ─── Queries ─── */
  const { data: rawAccountsList = [], refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts-list"],
    queryFn: () => apiGet("/api/accounting/accounts"),
  });

  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees-list"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers-list"], queryFn: () => apiGet("/api/customers") });

  const isIndirectCustomer = (c: any) => {
    if (!c) return false;
    return (
      c.affiliation_type === 'agency' || 
      c.affiliation_type === 'indirect' || 
      c.customer_type === 'indirect' || 
      c.customer_type === 'agent_customer' || 
      c.customer_type === 'sub_customer' || 
      (c.affiliation_type !== 'direct' && (
        (c.office_id != null && Number(c.office_id) > 1) || 
        (c.partner_office_id != null && Number(c.partner_office_id) > 1) || 
        (c.office_name && String(c.office_name).trim() !== '' && !String(c.office_name).includes('الرئيسي') && !String(c.office_name).includes('مباشر'))
      ))
    );
  };

  const accountsList = useMemo(() => {
    if (!Array.isArray(rawAccountsList)) return [];
    // Strict rule: Agency-affiliated & Indirect customers must never appear in Chart of Accounts
    const indirectCustomerNames = new Set(
      (customers || [])
        .filter(isIndirectCustomer)
        .map((c: any) => String(c.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    return rawAccountsList.filter((a: any) => {
      const code = String(a.code || "").trim();
      const name = String(a.name || "").trim();
      const parentCode = String(a.parent_code || "").trim();
      const lowerName = name.toLowerCase();

      if (indirectCustomerNames.has(lowerName)) {
        return false;
      }

      if (parentCode === '21400' || (code.startsWith('214') && code !== '21400') || lowerName.startsWith('موظف:') || lowerName.startsWith('موظف #')) {
        return false;
      }

      return (
        code.length > 0 &&
        name.length > 0 &&
        !code.includes("\uFFFD") &&
        !name.includes("\uFFFD") &&
        !/[\x00-\x08\x0E-\x1F]/.test(code) &&
        !/[\x00-\x08\x0E-\x1F]/.test(name)
      );
    });
  }, [rawAccountsList, customers]);

  const { data: dashboardStats, refetch: refetchDashboard } = useQuery({
    queryKey: ["accounting-dashboard-stats"],
    queryFn: () => apiGet("/api/accounting/dashboard-stats"),
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list"], queryFn: () => apiGet("/api/suppliers").catch(() => []) });
  const { data: transportCompanies = [] } = useQuery({ queryKey: ["transport-companies-list"], queryFn: () => apiGet("/api/travel/transport-companies").catch(() => []) });
  const { data: hotelsDbList = [] } = useQuery({ queryKey: ["hotels-db-list"], queryFn: () => apiGet("/api/travel/hotels-db").catch(() => []) });
  const { data: systemUsers = [] } = useQuery({ queryKey: ["system-users-list"], queryFn: () => apiGet("/api/accounting/system-users").catch(() => []) });
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({ queryKey: ["vouchers-list"], queryFn: () => apiGet("/api/accounting/vouchers") });
  const { data: docPrintSettings, refetch: refetchDocSettings } = useQuery({ queryKey: ["document-print-settings"], queryFn: () => apiGet("/api/document-print-settings") });
  const { data: safes = [], refetch: refetchSafes } = useQuery({ queryKey: ["safes-list"], queryFn: () => apiGet("/api/safes") });
  const { data: bankAccounts = [], refetch: refetchBanks } = useQuery({ queryKey: ["bank-accounts-list"], queryFn: () => apiGet("/api/accounting/bank-accounts") });
  const { data: transfers = [], refetch: refetchTransfers } = useQuery({ queryKey: ["transfers-list"], queryFn: () => apiGet("/api/accounting/transfers") });
  const { data: fixedAssets = [], refetch: refetchAssets } = useQuery({ queryKey: ["fixed-assets-list"], queryFn: () => apiGet("/api/accounting/fixed-assets") });
  const { data: recurringExpenses = [], refetch: refetchRecurring } = useQuery({ queryKey: ["recurring-expenses-list"], queryFn: () => apiGet("/api/accounting/recurring-expenses") });
  const { data: costCenters = [], refetch: refetchCostCenters } = useQuery({ queryKey: ["cost-centers-list"], queryFn: () => apiGet("/api/accounting/cost-centers") });
  const { data: fiscalPeriods = [], refetch: refetchFiscalPeriods } = useQuery({ queryKey: ["fiscal-periods-list"], queryFn: () => apiGet("/api/accounting/fiscal-periods") });

  const { data: journalEntries = [], refetch: refetchJournal } = useQuery({
    queryKey: ["journal-entries-list"],
    queryFn: () => apiGet("/api/accounting/journal-entries"),
  });

  const { data: trialBalance, refetch: refetchTrialBalance } = useQuery({
    queryKey: ["trial-balance-data"],
    queryFn: () => apiGet("/api/accounting/trial-balance"),
  });

  const filteredTrialAccounts = useMemo(() => {
    if (!trialBalance?.accounts) return [];
    let list = [...trialBalance.accounts];

    if (reportOpts.byLevel && reportOpts.selectedLevel > 0) {
      list = list.filter((a: any) => {
        const lvl = a.level || (a.code?.length <= 2 ? 1 : a.code?.length <= 4 ? 2 : a.code?.length <= 6 ? 3 : 4);
        return lvl <= reportOpts.selectedLevel;
      });
    }

    if (reportOpts.viewGranularity === "account_party") {
      list = list.map((a: any) => ({
        ...a,
        name: `${a.name} ${a.party_name ? `[الجهة: ${a.party_name}]` : a.code?.startsWith('112') || a.code?.startsWith('123') ? '[الجهة: عميل/حساب ذمم]' : a.code?.startsWith('211') ? '[الجهة: مورد/حساب دائن]' : ''}`
      }));
    } else if (reportOpts.viewGranularity === "analytical_only" || reportOpts.viewGranularity === "analytical") {
      list = list.filter((a: any) => !a.is_parent && (!a.children_count || a.children_count === 0));
    } else if (reportOpts.viewGranularity === "main_account") {
      list = list.filter((a: any) => a.is_parent || (a.code && a.code.length <= 4));
    } else if (reportOpts.viewGranularity === "account_type") {
      list.sort((a: any, b: any) => String(a.account_type || '').localeCompare(String(b.account_type || '')));
    }

    return list;
  }, [trialBalance, reportOpts]);

  useEffect(() => {
    if (accountsList && accountsList.length > 0) {
      const initial: {[code: string]: { debit: number; credit: number }} = {};
      accountsList.forEach((acc: any) => {
        initial[acc.code] = {
          debit: acc.opening_debit || 0,
          credit: acc.opening_credit || 0
        };
      });
      setOpeningBalances(initial);
    }
  }, [accountsList]);

  // Financial Statements Queries
  const { data: incomeStatement } = useQuery({
    queryKey: ["report-income-statement"],
    queryFn: () => apiGet("/api/accounting/reports/income-statement"),
    enabled: activeTab === "financials"
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["report-balance-sheet"],
    queryFn: () => apiGet("/api/accounting/reports/balance-sheet"),
    enabled: activeTab === "financials"
  });

  const { data: cashFlow } = useQuery({
    queryKey: ["report-cash-flow"],
    queryFn: () => apiGet("/api/accounting/reports/cash-flow"),
    enabled: activeTab === "financials"
  });

  /* ─── Helper for active section titles ─── */
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "chart": return "دليل الحسابات";
      case "journal": return "سجل القيود اليومية والمزدوجة";
      case "trial": return "ميزان المراجعة الشامل";
      case "manual_journal_entry": return "القيود اليومية العامة";
      case "receipt_vouchers": return "شاشة سندات القبض (مستقلة)";
      case "payment_vouchers": return "شاشة سندات الصرف (مستقلة)";
      case "vouchers": return "سجل وقائمة كافة السندات";
      case "safes": return "إدارة الصناديق والخزائن";
      case "banks": return "البنوك والتحويلات المالية";
      case "statements": return "كشوفات الحسابات";
      case "assets": return "الأصول الثابتة والإهلاك";
      case "recurring": return "المصروفات المتكررة";
      case "financials": return "القوائم المالية الختامية";
      case "cost_centers": return "مراكز التكلفة للفروع والخدمات";
      case "fiscal_periods": return "الفترات المالية والإغلاقات";
      case "reports": return "التقارير الحسابية والختامية";
      default: return "لوحة التحكم المالية";
    }
  };

  /* ─── Global Chart of Accounts F9 Modal State ─── */
  const [showF9ChartDlg, setShowF9ChartDlg] = useState(false);
  const [f9SearchQuery, setF9SearchQuery] = useState("");
  const [f9Target, setF9Target] = useState<"receipt" | "payment" | "statement">("receipt");

  /* ─── Account Statement State (Image 3 fields) ─── */
  const [stmtToAccountChecked, setStmtToAccountChecked] = useState(false);
  const [stmtToAccountId, setStmtToAccountId] = useState("");
  const [stmtValueDateChecked, setStmtValueDateChecked] = useState(false);
  const [stmtValueStartDate, setStmtValueStartDate] = useState("2026-09-10");
  const [stmtValueEndDate, setStmtValueEndDate] = useState("2026-09-10");

  const [stmtOptExcludeClosing, setStmtOptExcludeClosing] = useState(false);
  const [stmtOptExcludePrevBalance, setStmtOptExcludePrevBalance] = useState(false);
  const [stmtOptExcludeOpening, setStmtOptExcludeOpening] = useState(false);
  const [stmtOptGroupDescription, setStmtOptGroupDescription] = useState(true);

  const [stmtMovementName, setStmtMovementName] = useState("all");
  const [stmtPartyNameInput, setStmtPartyNameInput] = useState("");
  const [stmtBeneficiaryNameInput, setStmtBeneficiaryNameInput] = useState("");
  const [stmtBranchNo, setStmtBranchNo] = useState("1");
  const [stmtDeptNo, setStmtDeptNo] = useState("");
  const [stmtCostCenterInput, setStmtCostCenterInput] = useState("");
  const [stmtMovementCode, setStmtMovementCode] = useState("");
  const [stmtFiscalYear, setStmtFiscalYear] = useState("2026");

  const [stmtGridTab, setStmtGridTab] = useState<"detailed" | "summary" | "notes" | "extra">("detailed");

  /* ─── Global Document Print Settings (من تهيئة النظام) ─── */
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportThermalHtml, setReportThermalHtml] = useState<string | undefined>(undefined);
  const [reportTitle, setReportTitle] = useState("");
  const [statementCurrency, setStatementCurrency] = useState("all");

  const [docForm, setDocForm] = useState({
    companyName: "مخابز الشام للخبز العربي",
    companySubtitle: "Maamil Al Sham",
    logoUrl: "/omnisystem-logo.png",
    customerHeaderText: "كشف حساب عميل معتمد",
    customerFooterText: "شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً",
    employeeHeaderText: "كشف حساب ومسير رواتب موظف",
    employeeFooterText: "إدارة الموارد البشرية - التوقيع والاعتماد",
    voucherReceiptTitle: "سند قبض",
    voucherPaymentTitle: "سند صرف",
    voucherFooterText: "جودة الخبز ... سر ثقة عملائنا",
    reportHeaderText: "تقرير عام شامل",
    reportFooterText: "طبع بواسطة نظام OmniSystem Pro",
    accentColor: "#ef4444",
  });

  useEffect(() => {
    if (docPrintSettings && !docPrintSettings.error) {
      setDocForm(docPrintSettings);
    }
  }, [docPrintSettings]);

  const saveDocSettingsMutation = useMutation({
    mutationFn: (data: any) => apiPut("/api/document-print-settings", data),
    onSuccess: () => {
      toast({ title: "تم حفظ إعدادات وثائق وسندات النظام بنجاح" });
      refetchDocSettings();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حفظ الإعدادات", description: e.message }),
  });

  /* ─── Account Statement State ─── */
  const [statementPartyType, setStatementPartyType] = useState<"employee" | "customer" | "supplier" | "account" | "user" | "transport" | "transport_company" | "hotel">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const pt = p.get("party_type") as any;
      if (pt) return pt;
    }
    return "customer";
  });
  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("party_id") || p.get("account_code") || "";
    }
    return "";
  });
  const [stmtStartDate, setStmtStartDate] = useState<string>("");
  const [stmtEndDate, setStmtEndDate] = useState<string>("");
  const [stmtCurrency, setStmtCurrency] = useState<string>("all");
  const [stmtCostCenter, setStmtCostCenter] = useState<string>("all");
  const [stmtBranch, setStmtBranch] = useState<string>("1");
  const [stmtYear, setStmtYear] = useState<string>("2026");
  const [showStatementPrintModal, setShowStatementPrintModal] = useState(false);
  const printStatementRef = useRef<HTMLDivElement>(null);

  const handlePrintFinancial = (type: 'pl' | 'bs') => {
    const html = generateFinancialA4Html({
      type,
      startDate: reportOpts.fromDate,
      endDate: reportOpts.toDate,
    });
    setReportHtml(html);
    setReportTitle(type === 'pl' ? "الأرباح والخسائر" : "الميزانية العمومية");
    setReportModalOpen(true);
  };
  const handlePrintTrial = () => {
    const html = generateTrialBalanceA4Html({
      accounts: [
        { name: "وكالة الحجر الاسود للسفريات", code: "1231000100", opening_debit: 0, opening_credit: 0, period_debit: 1200000, period_credit: 0 },
        { name: "وكالة القبائلي للسفريات والسياحة", code: "1231000101", opening_debit: 0, opening_credit: 0, period_debit: 252000, period_credit: 175000 },
        { name: "وكالة الطيور المهاجرة للسفريات", code: "1231000200", opening_debit: 0, opening_credit: 0, period_debit: 203000, period_credit: 98000 },
        { name: "زبون داخلي عمرة", code: "1232000100", opening_debit: 0, opening_credit: 0, period_debit: 294000, period_credit: 0 },
        { name: "وكالة اليمني الفرع الثاني", code: "1232000101", opening_debit: 0, opening_credit: 0, period_debit: 77000, period_credit: 77000 },
        { name: "صندوق رئيسي", code: "130100001", opening_debit: 0, opening_credit: 0, period_debit: 175000, period_credit: 240450 },
        { name: "الموظف ابراهيم محمد الشاوش", code: "13210003", opening_debit: 0, opening_credit: 0, period_debit: 240450, period_credit: 0 },
        { name: "ايراد مبيعات البضائع", code: "41101001", opening_debit: 0, opening_credit: 0, period_debit: 175000, period_credit: 2026000 }
      ],
      startDate: reportOpts.fromDate,
      endDate: reportOpts.toDate,
    });
    setReportHtml(html);
    setReportTitle("ميزان المراجعة");
    setReportModalOpen(true);
  };
  const handlePrintStatement = () => {
    if (!statementData || !statementData.party) {
      toast({ title: "برجاء اختيار حساب أولاً لعرض وطباعة كشف الحساب", variant: "destructive" });
      return;
    }
    const baseOpts = {
      partyType: statementPartyType,
      party: statementData.party,
      startDate: stmtStartDate,
      endDate: stmtEndDate,
      previousBalance: statementData.previousBalance,
      currentBalance: statementData.currentBalance,
      transactions: statementData.transactions,
      settings: docPrintSettings || {},
      currency: statementCurrency || "all",
      currencySummaries: statementData.currencySummaries,
      docTitle: `كشف حساب تفصيلي - ${statementPartyType === 'customer' ? 'عميل' : statementPartyType === 'supplier' ? 'مورد' : statementPartyType === 'employee' ? 'موظف' : 'حساب عام'}`
    };
    const html = generateStatementA4Html({ ...baseOpts, paperFormat: "A4" });
    const thermalHtml = generateStatementA4Html({ ...baseOpts, paperFormat: "80mm" });
    setReportHtml(html);
    setReportThermalHtml(thermalHtml);
    setReportTitle(statementPartyType === 'employee' ? `كشف حساب موظف تفصيلي شامل - ${statementData.party.name}` : `كشف حساب معتمد - ${statementData.party.name}`);
    setReportModalOpen(true);
  };

  const handleExportStatementPdf = () => {
    if (!statementData || !statementData.party) {
      toast({ title: "برجاء اختيار حساب أولاً لعرض وتصدير كشف الحساب", variant: "destructive" });
      return;
    }
    const html = generateStatementA4Html({
      partyType: statementPartyType,
      party: statementData.party,
      startDate: stmtStartDate,
      endDate: stmtEndDate,
      previousBalance: statementData.previousBalance,
      currentBalance: statementData.currentBalance,
      transactions: statementData.transactions,
      settings: docPrintSettings || {},
      currency: statementCurrency || "all",
      currencySummaries: statementData.currencySummaries,
      docTitle: `كشف حساب تفصيلي - ${statementPartyType === 'customer' ? 'عميل' : statementPartyType === 'supplier' ? 'مورد' : statementPartyType === 'employee' ? 'موظف' : 'حساب عام'}`
    });
    const docTitle = `كشف_حساب_${statementPartyType === 'employee' ? 'الموظف' : statementPartyType}_${(statementData.party.name || '').replace(/\s+/g, "_")}`;
    printA4Html(html, docTitle);
  };

  const { data: statementData, isFetching: loadingStatement, refetch: refetchStatement } = useQuery({
    queryKey: ["party-statement", statementPartyType, selectedPartyId, stmtStartDate, stmtEndDate, statementCurrency],
    queryFn: () => {
      if (statementPartyType === "account") {
        return apiGet(`/api/accounting/accounts/${selectedPartyId}/ledger?currency=${statementCurrency}&start_date=${stmtStartDate}&end_date=${stmtEndDate}`).then((res: any) => ({
          party: { id: res.account?.id, name: `${res.account?.code} - ${res.account?.name}`, phone: "حساب عام", address: "دليل الحسابات" },
          previousBalance: res.previousBalance ?? 0,
          currentBalance: res.currentBalance ?? res.account?.balance ?? 0,
          pilgrimsCount: res.pilgrimsCount,
          bookingsCount: res.bookingsCount,
          visaCount: res.visaCount,
          transactions: (res.ledger || res.lines || []).map((l: any, idx: number) => ({
            id: l.id,
            date: l.entry_date || l.date || "",
            description: l.description || l.journal_desc || "قيد يومية",
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            running_balance: Number(l.running_balance || 0),
            currency: l.currency || res.account?.currency || "YER",
            reference_id: l.entry_number || l.reference_id || `JV-${idx + 1}`,
            party_name: l.account_name || res.account?.name || "—",
            notes: l.source_type || l.notes || ""
          })),
          currencySummaries: res.currencySummaries || {
            [res.account?.currency || "YER"]: {
              totalDebit: (res.ledger || []).reduce((s: number, x: any) => s + (x.debit || 0), 0),
              totalCredit: (res.ledger || []).reduce((s: number, x: any) => s + (x.credit || 0), 0),
              balance: res.currentBalance ?? res.account?.balance ?? 0
            }
          }
        }));
      }
      return apiGet(`/api/accounting/statement/${statementPartyType}/${selectedPartyId}?start_date=${stmtStartDate}&end_date=${stmtEndDate}&currency=${statementCurrency}`);
    },
    enabled: !!selectedPartyId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  /* ─── Vouchers Dialog State ─── */
  const [showNewVoucherDlg, setShowNewVoucherDlg] = useState(false);
  const [showReceiptDlg, setShowReceiptDlg] = useState(false);
  const [showPaymentDlg, setShowPaymentDlg] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    type: "receipt",
    party_type: "account" as "customer" | "supplier" | "employee" | "general" | "account",
    party_id: "",
    amount: "1250",
    currency: "SAR",
    exchange_rate: "140",
    date: "2026-08-13",
    voucher_no: "1",
    reference_no: "1",
    received_from: "وكالة القابلي للسفريات والسياحة",
    payment_against: "تحصيل نقداً من وكاله القابلي للسفريات",
    payment_method: "cash",
    safe_id: "",
    notes: "لكم واصل من حسابكم",
    second_party_currency: "SAR",
    collector_name: "1"
  });
  const [paymentForm, setPaymentForm] = useState({
    type: "payment",
    party_type: "account" as "customer" | "supplier" | "employee" | "general" | "account",
    party_id: "",
    amount: "1000",
    currency: "YER",
    exchange_rate: "1",
    date: "2026-08-02",
    voucher_no: "2",
    reference_no: "2",
    received_from: "الموظف ابراهيم محمد الشاوش",
    payment_against: "عليكم مقابل سداد من الحساب",
    payment_method: "cash",
    safe_id: "",
    notes: "عليكم مقابل سداد من الحساب",
    second_party_currency: "YER",
    collector_name: "1"
  });

  // Voucher Search & Navigation State
  const [showVoucherSearchDlg, setShowVoucherSearchDlg] = useState(false);
  const [voucherSearchType, setVoucherSearchType] = useState<"receipt" | "payment">("receipt");
  const [voucherSearchQuery, setVoucherSearchQuery] = useState("");
  const [voucherSearchFromDate, setVoucherSearchFromDate] = useState("");
  const [voucherSearchToDate, setVoucherSearchToDate] = useState("");
  const [voucherSearchTab, setVoucherSearchTab] = useState<"vouchers" | "accounts">("vouchers");
  const [voucherAccountSearchQuery, setVoucherAccountSearchQuery] = useState("");

  // All accounts and parties options for Party 2 (Chart of Accounts + Direct Customers + Suppliers + Employees)
  // STRICT ACCOUNTING RULE: Customers affiliated with an agency office MUST NEVER appear as selectable accounts or statement parties.
  const allAccountsAndParties = (accountsList || []).map((acc: any) => ({
    value: `acc_${acc.id || acc.code}`,
    label: `${acc.code ? acc.code + ' - ' : ''}${acc.name}`,
    sublabel: acc.type === 'asset' ? 'أصول' : acc.type === 'liability' ? 'خصوم' : acc.type === 'equity' ? 'حقوق ملكية' : acc.type === 'revenue' ? 'إيرادات' : acc.type === 'expense' ? 'مصروفات' : (acc.account_type_name || "دليل الحسابات"),
    name: acc.name,
    code: acc.code,
    currency: acc.currency || "YER"
  })).concat(
    (customers || [])
      .filter((c: any) => !isIndirectCustomer(c))
      .map((c: any) => ({
        value: `cust_${c.id}`,
        label: `عميل: ${c.name}`,
        sublabel: "عميل مباشر",
        name: c.name,
        code: undefined,
        currency: c.currency || "YER"
      }))
  ).concat(
    (suppliers || []).map((s: any) => ({
      value: `supp_${s.id}`,
      label: `مورد: ${s.name}`,
      sublabel: "مورد",
      name: s.name,
      code: undefined,
      currency: s.currency || "YER"
    }))
  ).concat(
    (employees || []).map((e: any) => ({
      value: `emp_${e.id}`,
      label: `موظف: ${e.name}`,
      sublabel: "موظف",
      name: e.name,
      code: undefined,
      currency: e.currency || "YER"
    }))
  ).concat(
    (transportCompanies || []).map((tc: any) => ({
      value: `transport_${tc.id}`,
      label: `شركة نقل: ${tc.name || tc.company_name}`,
      sublabel: "شركة نقل بري",
      name: tc.name || tc.company_name,
      code: tc.account_code,
      currency: "SAR"
    }))
  ).concat(
    (hotelsDbList || []).map((h: any) => ({
      value: `hotel_${h.id}`,
      label: `فندق: ${h.name_ar || h.name || ''}`,
      sublabel: "فندق / إقامة سياحية",
      name: h.name_ar || h.name || '',
      code: h.account_code,
      currency: "SAR"
    }))
  );

  const filteredAccountsForVoucherSearch = (accountsList || []).filter((acc: any) => {
    if (!voucherAccountSearchQuery.trim()) return true;
    const q = voucherAccountSearchQuery.toLowerCase();
    return (
      (acc.name && String(acc.name).toLowerCase().includes(q)) ||
      (acc.code && String(acc.code).toLowerCase().includes(q)) ||
      (acc.type && String(acc.type).toLowerCase().includes(q))
    );
  });

  const handleSelectAccountForVoucher = (acc: any) => {
    if (voucherSearchType === "receipt") {
      setReceiptForm((prev) => ({
        ...prev,
        party_id: `acc_${acc.id || acc.code}`,
        received_from: acc.name,
        second_party_currency: acc.currency || prev.second_party_currency || "YER",
      }));
    } else {
      setPaymentForm((prev) => ({
        ...prev,
        party_id: `acc_${acc.id || acc.code}`,
        received_from: acc.name,
        second_party_currency: acc.currency || prev.second_party_currency || "YER",
      }));
    }
    setShowVoucherSearchDlg(false);
    toast({ title: `تم اختيار الحساب: ${acc.code ? acc.code + " - " : ""}${acc.name} للطرف الثاني بنجاح` });
  };

  // List of all vouchers with fallbacks matching operations 16 and 20
  const allVouchersForNav = [...(vouchers || [])];
  if (!allVouchersForNav.some((v: any) => v.type === "receipt")) {
    allVouchersForNav.push({
      id: "sample_rc_1",
      voucher_number: "1",
      type: "receipt",
      party_name: "وكالة القابلي للسفريات والسياحة",
      amount: 1250,
      currency: "SAR",
      payment_against: "تحصيل نقداً من وكاله القابلي للسفريات",
      created_at: "2026-08-13T10:00:00.000Z",
      reference_id: "1",
      safe_id: safes[0]?.id || "1",
      notes: "لكم واصل من حسابكم"
    });
  }
  if (!allVouchersForNav.some((v: any) => v.type === "payment")) {
    allVouchersForNav.push({
      id: "sample_pv_2",
      voucher_number: "2",
      type: "payment",
      party_name: "الموظف ابراهيم محمد الشاوش",
      amount: 1000,
      currency: "YER",
      payment_against: "عليكم مقابل سداد من الحساب",
      created_at: "2026-08-02T10:00:00.000Z",
      reference_id: "2",
      safe_id: safes[0]?.id || "1",
      notes: "عليكم مقابل سداد من الحساب"
    });
  }

  const filteredVouchersForSearch = allVouchersForNav
    .filter((v: any) => v.type === voucherSearchType)
    .filter((v: any) => {
      if (!voucherSearchQuery.trim()) return true;
      const q = voucherSearchQuery.toLowerCase();
      const vNum = String(v.voucher_number || v.id || "").toLowerCase();
      const pName = String(v.party_name || "").toLowerCase();
      const against = String(v.payment_against || v.notes || "").toLowerCase();
      const ref = String(v.reference_id || "").toLowerCase();
      return vNum.includes(q) || pName.includes(q) || against.includes(q) || ref.includes(q);
    })
    .filter((v: any) => {
      if (voucherSearchFromDate && v.created_at && v.created_at.slice(0, 10) < voucherSearchFromDate) return false;
      if (voucherSearchToDate && v.created_at && v.created_at.slice(0, 10) > voucherSearchToDate) return false;
      return true;
    });

  const handleSelectVoucherFromSearch = (v: any) => {
    if (voucherSearchType === "receipt") {
      setReceiptForm({
        ...receiptForm,
        voucher_no: String(v.voucher_number || v.id || "1"),
        reference_no: String(v.reference_id || v.id || "1"),
        amount: String(v.amount || "1250"),
        received_from: v.party_name || "وكالة القابلي للسفريات والسياحة",
        payment_against: v.payment_against || v.notes || "تحصيل نقداً من وكاله القابلي للسفريات",
        date: v.created_at?.slice(0, 10) || "2026-08-13",
        currency: v.currency === "YER" || v.currency === "ر.ي" ? "YER" : v.currency === "USD" || v.currency === "$" ? "USD" : "SAR",
        safe_id: String(v.safe_id || ""),
        notes: v.notes || "لكم واصل من حسابكم"
      });
    } else {
      setPaymentForm({
        ...paymentForm,
        voucher_no: String(v.voucher_number || v.id || "2"),
        reference_no: String(v.reference_id || v.id || "2"),
        amount: String(v.amount || "1000"),
        received_from: v.party_name || "الموظف ابراهيم محمد الشاوش",
        payment_against: v.payment_against || v.notes || "عليكم مقابل سداد من الحساب",
        date: v.created_at?.slice(0, 10) || "2026-08-02",
        currency: v.currency === "SAR" || v.currency === "ر.س" ? "SAR" : v.currency === "USD" || v.currency === "$" ? "USD" : "YER",
        safe_id: String(v.safe_id || ""),
        notes: v.notes || "عليكم مقابل سداد من الحساب"
      });
    }
    setShowVoucherSearchDlg(false);
    toast({ title: `تم تحميل بيانات السند رقم #${v.voucher_number || v.id}` });
  };

  const handleNavigateVoucher = (direction: 'first' | 'prev' | 'next' | 'last', type: 'receipt' | 'payment') => {
    const list = allVouchersForNav.filter((v: any) => v.type === type);
    if (list.length === 0) {
      toast({ title: "لا توجد سندات سابقة للتنقل" });
      return;
    }
    const currentNo = type === 'receipt' ? receiptForm.voucher_no : paymentForm.voucher_no;
    let idx = list.findIndex((v: any) => String(v.voucher_number || v.id) === String(currentNo));
    if (idx === -1) idx = 0;

    let targetIdx = idx;
    if (direction === 'first') targetIdx = 0;
    else if (direction === 'last') targetIdx = list.length - 1;
    else if (direction === 'prev') targetIdx = Math.max(0, idx - 1);
    else if (direction === 'next') targetIdx = Math.min(list.length - 1, idx + 1);

    const target = list[targetIdx];
    if (target) {
      handleSelectVoucherFromSearch(target);
    }
  };

  // Currency cycling for Party 1 (F9 Support: YER, SAR, USD)
  const cycleReceiptCurrency = () => {
    const order = ["YER", "SAR", "USD"];
    const currentIdx = order.indexOf(receiptForm.currency || "YER");
    const nextCurr = order[(currentIdx + 1) % order.length];
    const rates: Record<string, string> = { YER: "1", SAR: "140", USD: "530" };
    setReceiptForm((prev) => ({
      ...prev,
      currency: nextCurr,
      exchange_rate: rates[nextCurr] || "1",
    }));
    const names: Record<string, string> = { YER: "ريال يمني (YER)", SAR: "ريال سعودي (SAR)", USD: "دولار أمريكي (USD)" };
    toast({ title: `(F9) تم تغيير عملة الصندوق إلى: ${names[nextCurr]}` });
  };

  const cyclePaymentCurrency = () => {
    const order = ["YER", "SAR", "USD"];
    const currentIdx = order.indexOf(paymentForm.currency || "YER");
    const nextCurr = order[(currentIdx + 1) % order.length];
    const rates: Record<string, string> = { YER: "1", SAR: "140", USD: "530" };
    setPaymentForm((prev) => ({
      ...prev,
      currency: nextCurr,
      exchange_rate: rates[nextCurr] || "1",
    }));
    const names: Record<string, string> = { YER: "ريال يمني (YER)", SAR: "ريال سعودي (SAR)", USD: "دولار أمريكي (USD)" };
    toast({ title: `(F9) تم تغيير عملة الصندوق إلى: ${names[nextCurr]}` });
  };

  // Global Keyboard listener for F9 (Open Chart of Accounts Selector or Shift+F9 Currency Cycle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          if (activeTab === "receipt_vouchers" || showReceiptDlg) {
            cycleReceiptCurrency();
          } else if (activeTab === "payment_vouchers" || showPaymentDlg) {
            cyclePaymentCurrency();
          } else {
            cycleReceiptCurrency();
          }
        } else {
          if (activeTab === "receipt_vouchers" || showReceiptDlg) {
            setF9Target("receipt");
          } else if (activeTab === "payment_vouchers" || showPaymentDlg) {
            setF9Target("payment");
          } else if (activeTab === "statements") {
            setF9Target("statement");
          } else {
            setF9Target("receipt");
          }
          setShowF9ChartDlg(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeTab, showReceiptDlg, showPaymentDlg, receiptForm.currency, receiptForm.second_party_currency, paymentForm.currency, paymentForm.second_party_currency]);

  // Full-Screen Preview Handler (Matching Images 16 and 20 & Image 1)
  const handlePreviewVoucher = (type: "receipt" | "payment") => {
    const form = type === "receipt" ? receiptForm : paymentForm;
    const safeObj = safes.find((s: any) => String(s.id) === String(form.safe_id));
    const safeName = safeObj ? safeObj.name : "صندوق رئيسي";
    const curr = form.currency || (type === "receipt" ? "SAR" : "YER");
    const numAmt = Number(form.amount) || (type === "receipt" ? 1250 : 1000);

    const words = form.amount
      ? tafqeet(numAmt, curr)
      : (type === "receipt" ? "الف ومائتان وخمسون ريال سعودي" : "الف ريال يمني");

    // Extract Account Code / Name if chosen
    let accCode = "";
    let accName = "";
    if (form.party_id && String(form.party_id).startsWith("acc_")) {
      const rawCodeOrId = String(form.party_id).replace("acc_", "");
      const foundAcc = accountsList.find((a: any) => String(a.id) === rawCodeOrId || String(a.code) === rawCodeOrId);
      if (foundAcc) {
        accCode = foundAcc.code;
        accName = foundAcc.name;
      }
    }

    const html = generateVoucherStyle2A4Html({
      type,
      voucherNumber: form.voucher_no || (type === "receipt" ? "1" : "2"),
      date: form.date || (type === "receipt" ? "2026-08-13" : "2026-08-02"),
      safeName: safeName,
      partyName: form.received_from || (type === "receipt" ? "وكالة القابلي للسفريات والسياحة" : "الموظف ابراهيم محمد الشاوش"),
      partyCode: accCode,
      accountCode: accCode || (type === "receipt" ? "11100" : "21100"),
      accountName: accName || form.received_from || safeName,
      amount: numAmt,
      amountWords: words,
      currency: curr,
      exchangeRate: form.exchange_rate || 1,
      paymentMethod: form.payment_method || "cash",
      notes: form.payment_against || (type === "receipt" ? "تحصيل نقداً من وكاله القابلي للسفريات" : "عليكم مقابل سداد من الحساب"),
      referenceNo: form.reference_no || (type === "receipt" ? "1" : "2"),
      detailsNote: type === "receipt" ? (form.notes || "لكم واصل من حسابكم") : (form.notes || "عليكم مقابل سداد من الحساب"),
      settings: docPrintSettings || {}
    });

    setReportHtml(html);
    setReportTitle(type === "receipt" ? "سند قبض" : "سند صرف");
    setReportModalOpen(true);
  };

  const handlePreviewVoucherSpecific = (v: any) => {
    const type = v.type;
    const safeObj = safes.find((s: any) => String(s.id) === String(v.safe_id));
    const safeName = safeObj ? safeObj.name : "صندوق رئيسي";
    const curr = v.currency || (type === "receipt" ? "SAR" : "YER");
    const numAmt = Number(v.amount) || 0;
    const words = tafqeet(numAmt, curr);

    const html = generateVoucherStyle2A4Html({
      type,
      voucherNumber: v.voucher_number || "1",
      date: v.created_at ? v.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      safeName: safeName,
      partyName: v.party_name || v.received_from || "الطرف الثاني",
      amount: numAmt,
      amountWords: words,
      currency: curr,
      paymentMethod: v.payment_method || "cash",
      notes: v.payment_against || v.notes || "بيان السند",
      referenceNo: v.reference_no || v.voucher_number || "1",
      detailsNote: v.notes || "تفاصيل السند المالي",
      settings: docPrintSettings || {}
    });

    setReportHtml(html);
    setReportTitle(type === "receipt" ? "سند قبض" : "سند صرف");
    setReportModalOpen(true);
  };

  const handleSaveReceiptVoucher = () => {
    if (!receiptForm.amount || parseFloat(receiptForm.amount) <= 0) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة مبلغ صحيح لسند القبض" });
      return;
    }
    createVoucherMutation.mutate({
      ...receiptForm,
      type: "receipt",
      amount: parseFloat(receiptForm.amount),
      party_name: receiptForm.received_from
    });
  };

  const handleSavePaymentVoucher = () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة مبلغ صحيح لسند الصرف" });
      return;
    }
    createVoucherMutation.mutate({
      ...paymentForm,
      type: "payment",
      amount: parseFloat(paymentForm.amount),
      party_name: paymentForm.received_from
    });
  };

  // Full-Screen Voucher Preview Handler for Existing Vouchers
  const handleOpenVoucherFullScreen = (v: any) => {
    const numAmt = Number(v.amount) || 0;
    const curr = v.currency || "ريال";
    const words = tafqeet(numAmt, curr);
    const html = generateVoucherStyle2A4Html({
      type: v.type,
      voucherNumber: String(v.voucher_number || v.id),
      date: v.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      safeName: v.safe_id ? "الصندوق الرئيسي" : "الحساب البنكي",
      partyName: v.party_name || v.received_from || "الطرف المعني",
      amount: numAmt,
      amountWords: words,
      currency: curr,
      notes: v.payment_against || "سداد من الحساب",
      referenceNo: String(v.voucher_number || v.id),
      detailsNote: v.notes || (v.type === "receipt" ? "لكم واصل من حسابكم" : "عليكم مقابل سداد من الحساب"),
      settings: docPrintSettings || {}
    });
    setReportHtml(html);
    setReportTitle(`${v.type === "receipt" ? "سند قبض معتمد" : "سند صرف معتمد"} #${v.voucher_number} - ${v.party_name}`);
    setReportModalOpen(true);
  };

  // Export Voucher Directly to PDF
  const handleExportVoucherPdf = (v: any) => {
    const numAmt = Number(v.amount) || 0;
    const curr = v.currency || "ريال";
    const words = tafqeet(numAmt, curr);
    const html = generateVoucherStyle2A4Html({
      type: v.type,
      voucherNumber: String(v.voucher_number || v.id),
      date: v.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      safeName: v.safe_id ? "الصندوق الرئيسي" : "الحساب البنكي",
      partyName: v.party_name || v.received_from || "الطرف المعني",
      amount: numAmt,
      amountWords: words,
      currency: curr,
      notes: v.payment_against || "سداد من الحساب",
      referenceNo: String(v.voucher_number || v.id),
      detailsNote: v.notes || (v.type === "receipt" ? "لكم واصل من حسابكم" : "عليكم مقابل سداد من الحساب"),
      settings: docPrintSettings || {}
    });
    const docTitle = `سند_${v.type === "receipt" ? "قبض" : "صرف"}_رقم_${v.voucher_number}_${(v.party_name || "").replace(/\s+/g, "_")}`;
    printA4Html(html, docTitle);
  };

  // Full-Screen Journal Voucher Preview Handler (Matching Image 22)
  const handlePreviewJournalEntryFullScreen = (entry?: any) => {
    const targetEntry = entry || (filteredEntries && filteredEntries.length > 0 ? filteredEntries[0] : null) || (journalEntries && journalEntries.length > 0 ? journalEntries[0] : null);
    if (!targetEntry) {
      toast({ title: "لا توجد قيود يومية للاستعراض حالياً", variant: "destructive" });
      return;
    }

    const mappedLines = (targetEntry.lines || []).map((l: any) => ({
      account_code: l.account_code || "",
      analytical: "",
      account_name: l.account_name || "",
      description: l.description || targetEntry.description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
      cost_center: l.cost_center_name || "",
      currency: l.currency || targetEntry.currency || "SAR",
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0)
    }));

    const html = generateJournalVoucherA4Html({
      voucherNumber: targetEntry.entry_number || String(targetEntry.id || "3"),
      date: targetEntry.entry_date || "29/08/2026",
      docType: targetEntry.doc_type || "نوع الوثيقة",
      userName: targetEntry.created_by_name || "علي احمد محمد اليمني",
      description: targetEntry.description || "مقابل مرتجع قيمه تاشيرة زيارة عائلية",
      currency: targetEntry.currency || "ريال سعودي",
      referenceNo: targetEntry.reference_no || "8",
      lines: mappedLines.length > 0 ? mappedLines : undefined,
      agencyName: docPrintSettings?.companyName || docPrintSettings?.headerRightText1 || "اسم النشاط التجاري",
      agencyAddress: docPrintSettings?.companySubtitle || docPrintSettings?.headerRightText2 || ""
    });

    setReportHtml(html);
    setReportTitle(`سند قيد يومية رقم ${targetEntry.entry_number || targetEntry.id || '3'}`);
    setReportModalOpen(true);
  };
  const [voucherForm, setVoucherForm] = useState({
    type: "receipt",
    party_type: "customer" as "employee" | "customer" | "supplier" | "general" | "user",
    party_id: "",
    amount: "",
    received_from: "",
    payment_against: "",
    payment_method: "cash",
    amount_text: "",
    notes: "",
    safe_id: "",
    bank_account_id: "",
    cost_center_id: ""
  });
  const [viewVoucher, setViewVoucher] = useState<any>(null);

  const createVoucherMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/vouchers", data),
    onSuccess: () => {
      toast({ title: "تم إصدار وتوثيق السند المالي والقيد الآلي بنجاح" });
      setShowNewVoucherDlg(false);
      setVoucherForm({ type: "receipt", party_type: "customer", party_id: "", amount: "", received_from: "", payment_against: "", payment_method: "cash", amount_text: "", notes: "", safe_id: "", bank_account_id: "", cost_center_id: "" });
      refetchVouchers();
      refetchSafes();
      refetchBanks();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إصدار السند", description: e.message })
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (id: any) => fetch(`/api/accounting/vouchers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("pos_token") || ""}` } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/accounting/vouchers"] });
      toast({ title: "تم حذف السند بنجاح" });
      setShowReceiptDlg(false);
      setShowPaymentDlg(false);
      refetchVouchers();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "خطأ في الحذف", description: err.message });
    }
  });

  /* ─── Manual Account Entry State ─── */
  const [showManualDlg, setShowManualDlg] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "", debit: "0", credit: "0", entry_date: new Date().toISOString().slice(0, 10), notes: ""
  });

  const addManualMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/manual-entries", {
      party_type: statementPartyType,
      party_id: Number(selectedPartyId),
      ...data,
      debit: Number(data.debit || 0),
      credit: Number(data.credit || 0),
    }),
    onSuccess: () => {
      toast({ title: "تم تسجيل القيد اليدوي بنجاح" });
      setShowManualDlg(false);
      setManualForm({ description: "", debit: "0", credit: "0", entry_date: new Date().toISOString().slice(0, 10), notes: "" });
      refetchStatement();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة القيد", description: e.message }),
  });

  /* ─── Chart of Accounts State (Onyx Pro Engine) ─── */
  const [showAddAccountDlg, setShowAddAccountDlg] = useState(false);
  const [showExcelImportDlg, setShowExcelImportDlg] = useState(false);
  const [showAccountCurrencyDlg, setShowAccountCurrencyDlg] = useState(false);
  const [showSystemCurrencyDlg, setShowSystemCurrencyDlg] = useState(false);
  const [showDeleteAccountConfirmDlg, setShowDeleteAccountConfirmDlg] = useState(false);
  const [isNewAccountMode, setIsNewAccountMode] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [accountForm, setAccountForm] = useState({
    id: null as number | null,
    code: "11101",
    name: "الصندوق الرئيسي",
    name_en: "Main Cash Safe",
    type: "asset",
    parent_code: "11100",
    currency: "YER",
    is_parent: false,
    stop_dealing: false,
    auto_add: true,
    tax_account: "ضريبة القيمة المضافة 5%",
    notes: "",
    level: 4,
    currencies: [
      { id: 1, currency_id: 1, currency_code: "YER", currency_name: "ريال يمني (YER)", min_balance: 0, max_balance: 100000000, exchange_rate: 1.0, is_primary: true },
      { id: 2, currency_id: 2, currency_code: "SAR", currency_name: "ريال سعودي (SAR)", min_balance: 0, max_balance: 500000, exchange_rate: 0.27, is_primary: false },
      { id: 3, currency_id: 3, currency_code: "USD", currency_name: "دولار أمريكي (USD)", min_balance: 0, max_balance: 50000, exchange_rate: 1.0, is_primary: false }
    ] as any[],
    linked_safe_ids: [] as number[],
    linked_customer_ids: [] as number[],
    children: [] as any[],
    linked_suppliers: [] as any[],
    aggregated_balance: 0
  });

  const [accountCurrencyForm, setAccountCurrencyForm] = useState({
    currency_id: null as number | null,
    currency_code: "YER",
    currency_name: "ريال يمني (YER)",
    min_balance: 0,
    max_balance: 100000000,
    exchange_rate: 1.0,
    is_primary: false
  });

  const [systemCurrencyForm, setSystemCurrencyForm] = useState({
    name: "",
    symbol: "",
    fraction: "فلس",
    type: "foreign",
    exchange_rate: 1.0,
    active: 1
  });

  const [accountSearch, setAccountSearch] = useState("");
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<any>(null);

  const { data: systemCurrenciesList = [], refetch: refetchSystemCurrencies } = useQuery({
    queryKey: ["system-currencies-all"],
    queryFn: () => apiGet("/api/currencies").catch(() => []),
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["account-ledger", selectedLedgerAccount?.id],
    queryFn: () => apiGet(`/api/accounting/accounts/${selectedLedgerAccount.id}/ledger`),
    enabled: !!selectedLedgerAccount?.id
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/accounts", data),
    onSuccess: (created: any) => {
      toast({ title: "تم إنشاء الحساب بنجاح في دليل الحسابات" });
      setShowAddAccountDlg(false);
      setIsNewAccountMode(false);
      setSelectedAccountId(created.id);
      refetchAccounts();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إنشاء الحساب", description: e.message })
  });

  const updateAccountMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/api/accounting/accounts/${data.id}`, data),
    onSuccess: () => {
      toast({ title: "تم حفظ وتحديث بيانات الحساب والعملات والربط بنجاح" });
      refetchAccounts();
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث الحساب", description: e.message })
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/accounting/accounts/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف الحساب بنجاح من دليل الحسابات" });
      setShowDeleteAccountConfirmDlg(false);
      setSelectedAccountId(null);
      setIsNewAccountMode(true);
      refetchAccounts();
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف الحساب", description: e.message })
  });

  const generateSubAccountsMutation = useMutation({
    mutationFn: (data: { id: number, entity_type: 'safes' | 'customers' }) => apiPost(`/api/accounting/accounts/${data.id}/generate-subaccounts`, data),
    onSuccess: (res: any) => {
      toast({ title: "نجاح التوليد والربط الآلي", description: res.message });
      refetchAccounts();
      refetchSafes();
      if (selectedAccountId) {
        apiGet(`/api/accounting/accounts/${selectedAccountId}`).then((fullAcc: any) => {
          setAccountForm(prev => ({
            ...prev,
            linked_safe_ids: (fullAcc.linked_safes || []).map((s: any) => s.id),
            linked_customer_ids: (fullAcc.linked_customers || []).map((c: any) => c.id)
          }));
        });
      }
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التوليد الآلي", description: e.message })
  });

  const createSystemCurrencyMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/currencies", data),
    onSuccess: (newCur: any) => {
      toast({ title: "تمت إضافة العملة بنجاح إلى النظام" });
      setShowSystemCurrencyDlg(false);
      refetchSystemCurrencies();
      setAccountForm(prev => ({
        ...prev,
        currencies: [
          ...prev.currencies,
          {
            currency_id: newCur.id,
            currency_code: newCur.symbol,
            currency_name: `${newCur.name} (${newCur.symbol})`,
            min_balance: 0,
            max_balance: 100000000,
            exchange_rate: Number(newCur.exchange_rate) || 1.0,
            is_primary: false
          }
        ]
      }));
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة العملة", description: e.message })
  });

  const handleSelectAccount = async (acc: any) => {
    setIsNewAccountMode(false);
    setSelectedAccountId(acc.id);
    try {
      const fullAcc = await apiGet(`/api/accounting/accounts/${acc.id}`);
      setAccountForm({
        id: fullAcc.id,
        code: fullAcc.code,
        name: fullAcc.name,
        name_en: fullAcc.name_en || "",
        type: fullAcc.type || "asset",
        parent_code: fullAcc.parent_code || "",
        currency: fullAcc.currency || "YER",
        is_parent: Boolean(fullAcc.is_parent),
        stop_dealing: Boolean(fullAcc.stop_dealing),
        auto_add: fullAcc.auto_add !== 0,
        tax_account: fullAcc.tax_account || "ضريبة القيمة المضافة 5%",
        notes: fullAcc.notes || "",
        level: fullAcc.level || 1,
        currencies: (fullAcc.currencies && fullAcc.currencies.length > 0) ? fullAcc.currencies : [
          { currency_code: fullAcc.currency || "YER", currency_name: fullAcc.currency === "YER" ? "ريال يمني (YER)" : fullAcc.currency, min_balance: 0, max_balance: 100000000, exchange_rate: 1.0, is_primary: true }
        ],
        linked_safe_ids: (fullAcc.linked_safes || []).map((s: any) => s.id),
        linked_customer_ids: (fullAcc.linked_customers || []).map((c: any) => c.id),
        children: fullAcc.children || [],
        linked_suppliers: fullAcc.linked_suppliers || [],
        aggregated_balance: fullAcc.aggregated_balance !== undefined ? fullAcc.aggregated_balance : fullAcc.balance || 0
      });
    } catch {
      setAccountForm({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        name_en: acc.name_en || "",
        type: acc.type || "asset",
        parent_code: acc.parent_code || "",
        currency: acc.currency || "YER",
        is_parent: Boolean(acc.is_parent),
        stop_dealing: Boolean(acc.stop_dealing),
        auto_add: acc.auto_add !== 0,
        tax_account: "ضريبة القيمة المضافة 5%",
        notes: "",
        level: acc.level || 1,
        currencies: [
          { currency_code: acc.currency || "YER", currency_name: "ريال يمني (YER)", min_balance: 0, max_balance: 100000000, exchange_rate: 1.0, is_primary: true }
        ],
        linked_safe_ids: [],
        linked_customer_ids: []
      } as any);
    }
  };

  const handleNewSubAccount = (parentAcc?: any) => {
    setIsNewAccountMode(true);
    setSelectedAccountId(null);
    const pCode = parentAcc?.code || accountForm.parent_code || "11100";
    const pType = parentAcc?.type || accountForm.type || "asset";
    
    // Find next available child code
    const childAccounts = accountsList.filter((a: any) => a.parent_code === pCode || (a.code.startsWith(pCode) && a.code !== pCode));
    let nextCode = "";
    if (childAccounts.length > 0) {
      const numbers = childAccounts.map((a: any) => parseInt(a.code, 10)).filter((n: number) => !isNaN(n));
      if (numbers.length > 0) {
        nextCode = String(Math.max(...numbers) + 1);
      } else {
        nextCode = `${pCode}01`;
      }
    } else {
      nextCode = `${pCode}01`;
    }

    setAccountForm({
      id: null,
      code: nextCode,
      name: "",
      name_en: "",
      type: pType,
      parent_code: pCode,
      currency: "YER",
      is_parent: false,
      stop_dealing: false,
      auto_add: true,
      tax_account: "ضريبة القيمة المضافة 5%",
      notes: "",
      level: (parentAcc?.level || 3) + 1,
      currencies: [
        { currency_id: 1, currency_code: "YER", currency_name: "ريال يمني (YER)", min_balance: 0, max_balance: 10000000, exchange_rate: 1.0, is_primary: true },
        { currency_id: 2, currency_code: "SAR", currency_name: "ريال سعودي (SAR)", min_balance: 0, max_balance: 500000, exchange_rate: 0.27, is_primary: false },
        { currency_id: 3, currency_code: "USD", currency_name: "دولار أمريكي (USD)", min_balance: 0, max_balance: 50000, exchange_rate: 1.0, is_primary: false }
      ],
      linked_safe_ids: [],
      linked_customer_ids: []
    } as any);
    toast({ title: "جاهز لإضافة حساب فرعي جديد", description: `تم اقتراح الرمز ${nextCode} تحت الحساب ${pCode}` });
  };

  const handleSaveAccount = () => {
    if (!accountForm.code || !accountForm.name) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "يرجى تعبئة رمز واسم الحساب أولاً" });
      return;
    }
    if (accountForm.id && !isNewAccountMode) {
      updateAccountMutation.mutate({
        ...accountForm,
        id: accountForm.id
      });
    } else {
      createAccountMutation.mutate(accountForm);
    }
  };

  const handleExportCOA = () => {
    const headers = "الرمز,الاسم,الاسم_الأجنبي,طبيعة_الحساب,الحساب_الرئيسي,العملة,المستوى,الرصيد,الحالة\n";
    const rows = accountsList.map((a: any) => 
      `"${a.code}","${a.name}","${a.name_en || ''}","${a.type}","${a.parent_code || ''}","${a.currency || 'YER'}","${a.level || 1}","${a.balance || 0}","${a.active ? 'نشط' : 'موقف'}"`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chart_of_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "تم تصدير دليل الحسابات بنجاح بصيغة CSV/Excel" });
  };

  /* ─── Manual Journal Entry State (Onyx Pro Voucher) ─── */
  const [selectedJournalId, setSelectedJournalId] = useState<number | null>(null);
  const [showJournalVoucherDlg, setShowJournalVoucherDlg] = useState(false);
  const [journalSearchText, setJournalSearchText] = useState("");
  const [journalFilterType, setJournalFilterType] = useState("all");
  const [showNewJournalDlg, setShowNewJournalDlg] = useState(false);
  const [journalForm, setJournalForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    lines: [
      { account_code: "11100", debit: "", credit: "", description: "" },
      { account_code: "41000", debit: "", credit: "", description: "" }
    ]
  });

  const filteredEntries = useMemo(() => {
    return (journalEntries || []).filter((entry: any) => {
      const q = (journalSearchText || "").toLowerCase().trim();
      const matchesSearch =
        !q ||
        entry.entry_number?.toLowerCase().includes(q) ||
        entry.description?.toLowerCase().includes(q) ||
        entry.reference_no?.toLowerCase().includes(q) ||
        entry.lines?.some((l: any) =>
          l.account_name?.toLowerCase().includes(q) ||
          l.account_code?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q)
        );
      const matchesType = journalFilterType === "all" || entry.source_type === journalFilterType;
      return matchesSearch && matchesType;
    });
  }, [journalEntries, journalSearchText, journalFilterType]);

  const createJournalMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/journal-entries", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل القيد اليومي المزدوج وتحديث الأرصدة بنجاح" });
      setShowNewJournalDlg(false);
      refetchJournal();
      refetchAccounts();
      refetchTrialBalance();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تسجيل القيد", description: e.message })
  });

  const reverseJournalMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/journal-entries/${id}/reverse`, {}),
    onSuccess: () => {
      toast({ title: "تم عكس وتصحيح القيد بنجاح" });
      refetchJournal();
      refetchAccounts();
      refetchTrialBalance();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل عكس القيد", description: e.message })
  });

  /* ─── Safes State ─── */
  const [showSafeDlg, setShowSafeDlg] = useState(false);
  const [editingSafe, setEditingSafe] = useState<any>(null);
  const [safeForm, setSafeForm] = useState({ name: "", balance: "0", currency: "ريال", notes: "", active: true });

  const saveSafeMutation = useMutation({
    mutationFn: (data: any) => editingSafe ? apiPut(`/api/safes/${editingSafe.id}`, data) : apiPost("/api/safes", data),
    onSuccess: () => {
      toast({ title: editingSafe ? "تم تحديث الخزينة" : "تمت إضافة الخزينة بنجاح" });
      setShowSafeDlg(false);
      setEditingSafe(null);
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  const deleteSafeMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/safes/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف الخزينة بنجاح" });
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحذف", description: e.message })
  });

  /* ─── Bank Account & Transfer Dialog State ─── */
  const [showBankDlg, setShowBankDlg] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", iban: "", swift: "", balance: "0", currency: "ريال", notes: "" });

  const createBankMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/bank-accounts", data),
    onSuccess: () => {
      toast({ title: "تمت إضافة الحساب البنكي بنجاح" });
      setShowBankDlg(false);
      setBankForm({ bank_name: "", account_number: "", iban: "", swift: "", balance: "0", currency: "ريال", notes: "" });
      refetchBanks();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة البنك", description: e.message })
  });

  const [showTransferDlg, setShowTransferDlg] = useState(false);
  const [transferForm, setTransferForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),
    from_type: "safe",
    from_id: "",
    to_type: "bank",
    to_id: "",
    amount: "",
    notes: ""
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/transfers", data),
    onSuccess: () => {
      toast({ title: "تم تنفيذ عملية التحويل وقيد الأثر المالي بنجاح" });
      setShowTransferDlg(false);
      setTransferForm({ transfer_date: new Date().toISOString().slice(0, 10), from_type: "safe", from_id: "", to_type: "bank", to_id: "", amount: "", notes: "" });
      refetchTransfers();
      refetchSafes();
      refetchBanks();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التحويل", description: e.message })
  });

  /* ─── Fixed Assets State ─── */
  const [showAssetDlg, setShowAssetDlg] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: "", category: "أجهزة ومعدات", purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: "", salvage_value: "0", useful_life_years: "5", location: "المقر الرئيسي", responsible_person: "مدير الفرع"
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/fixed-assets", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل الأصل الثابت وقيد الشراء بنجاح" });
      setShowAssetDlg(false);
      setAssetForm({ name: "", category: "أجهزة ومعدات", purchase_date: new Date().toISOString().slice(0, 10), purchase_cost: "", salvage_value: "0", useful_life_years: "5", location: "المقر الرئيسي", responsible_person: "مدير الفرع" });
      refetchAssets();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تسجيل الأصل", description: e.message })
  });

  const runDepreciationMutation = useMutation({
    mutationFn: () => apiPost("/api/accounting/run-depreciation", {}),
    onSuccess: (res) => {
      toast({ title: res.message, description: `إجمالي الإهلاك المحتسب: ${fmt(res.totalDepreciated)} ريال` });
      refetchAssets();
      refetchJournal();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل احتساب الإهلاك", description: e.message })
  });

  /* ─── Recurring Expenses State ─── */
  const [showRecurringDlg, setShowRecurringDlg] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    title: "", category: "إيجار", amount: "", frequency: "monthly", next_due_date: new Date().toISOString().slice(0, 10), notes: ""
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/recurring-expenses", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل المصروف المتكرر والتنبيه بنجاح" });
      setShowRecurringDlg(false);
      setRecurringForm({ title: "", category: "إيجار", amount: "", frequency: "monthly", next_due_date: new Date().toISOString().slice(0, 10), notes: "" });
      refetchRecurring();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  const generateRecurringMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/recurring-expenses/${id}/generate`, {}),
    onSuccess: () => {
      toast({ title: "تمت معالجة المصروف وتوليد سند الصرف وتأجيل الموعد بنجاح" });
      refetchRecurring();
      refetchVouchers();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التوليد", description: e.message })
  });

  /* ─── Cost Centers & Fiscal Periods ─── */
  const [showCostCenterDlg, setShowCostCenterDlg] = useState(false);
  const [costCenterForm, setCostCenterForm] = useState({ code: "", name: "", notes: "" });

  const [showFiscalDlg, setShowFiscalDlg] = useState(false);
  const [fiscalForm, setFiscalForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    fiscal_year: new Date().getFullYear().toString()
  });

  const createFiscalPeriodMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/fiscal-periods", data),
    onSuccess: () => {
      toast({ title: "تم إنشاء الفترة المالية بنجاح" });
      setShowFiscalDlg(false);
      setFiscalForm({
        name: "",
        start_date: "",
        end_date: "",
        fiscal_year: new Date().getFullYear().toString()
      });
      refetchFiscalPeriods();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إنشاء الفترة", description: e.message })
  });

  const createCostCenterMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/cost-centers", data),
    onSuccess: () => {
      toast({ title: "تم إضافة مركز التكلفة بنجاح" });
      setShowCostCenterDlg(false);
      setCostCenterForm({ code: "", name: "", notes: "" });
      refetchCostCenters();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإضافة", description: e.message })
  });

  const closeFiscalPeriodMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/fiscal-periods/${id}/close`, {}),
    onSuccess: () => {
      toast({ title: "تم إغلاق الفترة المالية وقفل تعديل القيود" });
      refetchFiscalPeriods();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إغلاق الفترة", description: e.message })
  });

  // Calculate journal totals for modal
  const journalDebitSum = (journalForm?.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const journalCreditSum = (journalForm?.lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isJournalBalanced = Math.abs(journalDebitSum - journalCreditSum) < 0.01 && journalDebitSum > 0;

  const totalOpeningDebit = Object.values(openingBalances).reduce((s, b) => s + (Number(b.debit) || 0), 0);
  const totalOpeningCredit = Object.values(openingBalances).reduce((s, b) => s + (Number(b.credit) || 0), 0);
  const openingDiff = totalOpeningDebit - totalOpeningCredit;

  const filteredAccountsForOpening = accountsList.filter((acc: any) => {
    const matchesSearch = String(acc.code || "").includes(openingSearch) || 
                          String(acc.name || "").toLowerCase().includes(openingSearch.toLowerCase());
    const matchesType = openingTypeFilter === "all" || acc.type === openingTypeFilter;
    return matchesSearch && matchesType;
  });

  const handleSaveOpeningBalances = async () => {
    setIsSavingOpening(true);
    try {
      const payload = Object.entries(openingBalances)
        .filter(([_, val]) => (Number(val.debit) || 0) > 0 || (Number(val.credit) || 0) > 0)
        .map(([code, val]) => ({
          code,
          opening_debit: Number(val.debit) || 0,
          opening_credit: Number(val.credit) || 0
        }));

      const res = await apiPost("/api/accounting/opening-balances", { balances: payload });
      toast({
        title: "تم الحفظ بنجاح",
        description: res.message || "تم حفظ الأرصدة الافتتاحية وتوليد قيد الموازنة تلقائياً.",
      });
      refetchAccounts();
      refetchJournal();
      refetchTrialBalance();
    } catch (err: any) {
      toast({
        title: "خطأ أثناء الحفظ",
        description: err.message || "فشل حفظ الأرصدة الافتتاحية.",
        variant: "destructive",
      });
    } finally {
      setIsSavingOpening(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 dir-rtl" dir="rtl">
        
        {/* Compact Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-indigo-900 text-indigo-100 font-extrabold text-xs px-3 py-1">
              {getTabTitle(activeTab)}
            </Badge>
            {activeTab !== "dashboard" && (
              <Button
                onClick={() => handleTabChange("dashboard")}
                variant="outline"
                size="sm"
                className="gap-2 font-bold text-xs text-indigo-900 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                ← العودة إلى لوحة التحكم المالية
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchDashboard();
              refetchAccounts();
              refetchVouchers();
              refetchSafes();
              refetchBanks();
              toast({ title: "تم تحديث البيانات المالية من الخادم" });
            }}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            تحديث الأرصدة
          </Button>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full space-y-6"
        >
          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <TabsList className="flex w-max min-w-full justify-start gap-1 bg-transparent p-0 h-auto">
              <TabsTrigger value="dashboard" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4" />
                لوحة التحكم المالية
              </TabsTrigger>
              <TabsTrigger value="chart" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4" />
                دليل الحسابات
              </TabsTrigger>
              <TabsTrigger value="journal" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Scale className="w-4 h-4" />
                القيود وميزان المراجعة
              </TabsTrigger>
              <TabsTrigger value="receipt_vouchers" className="px-4 py-2.5 rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-emerald-500 absolute -top-0.5 -right-0.5 opacity-70" />
                  <FileText className="w-3.5 h-3.5 text-emerald-600 absolute top-0.5 left-0.5" />
                </div>
                سندات القبض (مستقلة)
              </TabsTrigger>
              <TabsTrigger value="payment_vouchers" className="px-4 py-2.5 rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-rose-500 absolute -top-0.5 -right-0.5 opacity-70" />
                  <FileText className="w-3.5 h-3.5 text-rose-600 absolute top-0.5 left-0.5" />
                </div>
                سندات الصرف (مستقلة)
              </TabsTrigger>

              <TabsTrigger value="safes" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Wallet className="w-4 h-4" />
                إدارة الصناديق
              </TabsTrigger>
              <TabsTrigger value="banks" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Landmark className="w-4 h-4" />
                البنوك والتحويلات
              </TabsTrigger>
              <TabsTrigger value="statements" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <FileSpreadsheet className="w-4 h-4" />
                كشوفات الحسابات
              </TabsTrigger>
              <TabsTrigger value="opening_balances" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Coins className="w-4 h-4" />
                الأرصدة الافتتاحية
              </TabsTrigger>
              <TabsTrigger value="assets" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Building2 className="w-4 h-4" />
                الأصول والإهلاك
              </TabsTrigger>
              <TabsTrigger value="recurring" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Calendar className="w-4 h-4" />
                المصروفات المتكررة
              </TabsTrigger>
              <TabsTrigger value="financials" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Calculator className="w-4 h-4" />
                القوائم المالية الختامية
              </TabsTrigger>
              <TabsTrigger value="cost_centers" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Building2 className="w-4 h-4" />
                مراكز التكلفة للفروع والخدمات
              </TabsTrigger>
              <TabsTrigger value="fiscal_periods" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Lock className="w-4 h-4" />
                الفترات المالية والإغلاقات
              </TabsTrigger>
              <TabsTrigger value="reports" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <FileText className="w-4 h-4" />
                التقارير الحسابية والختامية
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: FINANCIAL DASHBOARD */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6 m-0">

            {/* Quick Actions Control Panel Grid (لوحة التحكم والمهام المالية) */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-600" />
                    لوحة التحكم والمهام المالية والحسابية
                  </span>
                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-800 border-indigo-200 font-bold dark:bg-indigo-950 dark:text-indigo-300">
                    10 وحدات محاسبية رئيسية
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  وصول سريع ومنظم لكافة المهام المحاسبية الموحدة: الدليل، القيود، ميزان المراجعة، السندات، الصناديق، البنوك، والتقارير الختامية.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  
                  {/* 1. دليل الحسابات */}
                  <div
                    onClick={() => handleTabChange("chart")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">دليل الحسابات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الشجرة المحاسبية المستوائية</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. القيود وميزان المراجعة */}
                  <div
                    onClick={() => handleTabChange("journal")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">القيود وميزان المراجعة</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">سجل اليومية العامة والتوازن</p>
                      </div>
                    </div>
                  </div>

                  {/* 3. سندات القبض والصرف */}
                  <div
                    onClick={() => handleTabChange("vouchers")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600">سندات القبض والصرف</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">إصدار وتوثيق المقبوضات</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. إدارة الصناديق */}
                  <div
                    onClick={() => handleTabChange("safes")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600">إدارة الصناديق</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الخزائن والسيولة النقدية</p>
                      </div>
                    </div>
                  </div>

                  {/* 5. البنوك والتحويلات */}
                  <div
                    onClick={() => handleTabChange("banks")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-purple-50/80 dark:hover:bg-purple-950/40 hover:border-purple-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600">البنوك والتحويلات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الحسابات البنكية والتسويات</p>
                      </div>
                    </div>
                  </div>

                  {/* 6. كشوفات الحسابات */}
                  <div
                    onClick={() => handleTabChange("statements")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-sky-50/80 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600">كشوفات الحسابات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">العملاء والموردين والأستاذ</p>
                      </div>
                    </div>
                  </div>

                  {/* 7. الأصول والإهلاك */}
                  <div
                    onClick={() => handleTabChange("assets")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600">الأصول والإهلاك</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">سجل الأصول ومعدل الإهلاك</p>
                      </div>
                    </div>
                  </div>

                  {/* 8. المصروفات المتكررة */}
                  <div
                    onClick={() => handleTabChange("recurring")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-teal-50/80 dark:hover:bg-teal-950/40 hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600">المصروفات المتكررة</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الإيجارات والاشتراكات الدورية</p>
                      </div>
                    </div>
                  </div>

                  {/* 9. القوائم المالية الختامية */}
                  <div
                    onClick={() => handleTabChange("financials")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40 hover:border-cyan-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600">القوائم المالية الختامية</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الأرباح والخسائر والميزانية</p>
                      </div>
                    </div>
                  </div>

                  {/* 10. ميزان المراجعة الشامل */}
                  <div
                    onClick={() => handleTabChange("journal")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-900 text-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">ميزان المراجعة الشامل</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">تقرير ميزان الأرصدة المتزن</p>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    مبيعات اليوم
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-950 dark:text-emerald-100">{fmt(dashboardStats?.todaySales)} ريال</div>
                  <p className="text-[10px] text-emerald-600 mt-1">المبيعات الموثقة بالنظام اليوم</p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center justify-between">
                    مشتريات اليوم
                    <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-950 dark:text-blue-100">{fmt(dashboardStats?.todayPurchases)} ريال</div>
                  <p className="text-[10px] text-blue-600 mt-1">فواتير المشتريات المستلمة اليوم</p>
                </CardContent>
              </Card>

              <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between">
                    إجمالي المصروفات
                    <FileText className="w-4 h-4 text-rose-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-950 dark:text-rose-100">{fmt(dashboardStats?.totalExpenses)} ريال</div>
                  <p className="text-[10px] text-rose-600 mt-1">تشغيل، إيجار، رواتب، وصيانة</p>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                    أرصدة الصناديق والخزائن
                    <Wallet className="w-4 h-4 text-indigo-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-indigo-950 dark:text-indigo-100">{fmt(dashboardStats?.safesBalance)} ريال</div>
                  <p className="text-[10px] text-indigo-600 mt-1">النقد المتوفر بكافة الصناديق</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-purple-700 dark:text-purple-400 flex items-center justify-between">
                    أرصدة البنوك
                    <Landmark className="w-4 h-4 text-purple-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-950 dark:text-purple-100">{fmt(dashboardStats?.bankBalance)} ريال</div>
                  <p className="text-[10px] text-purple-600 mt-1">إجمالي السيولة بالحسابات البنكية</p>
                </CardContent>
              </Card>
            </div>

            {/* Second Row Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                    م
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">مستحقات الموردين (ذمم دائنة)</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.supplierPayables)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 flex items-center justify-center font-bold text-lg">
                    ع
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">مستحقات العملاء (ذمم مدينة)</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.customerReceivables)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center font-bold text-lg">
                    قبض
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي المقبوضات المحصلة</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.totalReceipts)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-indigo-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg">
                    ربح
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200">صافي الربح التقديري</p>
                    <p className="text-lg font-bold text-white mt-0.5">{fmt(dashboardStats?.netProfit)} ريال</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Bills & Top Expense Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overdue Bills Table */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    فواتير المشتريات الآجلة المستحقة السداد
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dashboardStats?.overdueBills && dashboardStats.overdueBills.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dashboardStats.overdueBills.map((bill: any) => (
                        <div key={bill.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{bill.supplier_name}</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">فاتورة رقم #{bill.invoice_number} — استحقاق: {bill.due_date}</p>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-rose-600 dark:text-rose-400">{fmt(bill.remaining_amount)} ريال</span>
                            <Badge className="block mt-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">
                              غير مدفوعة بالكامل
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">لا توجد فواتير مشتريات مستحقة الدفع حالياً.</div>
                  )}
                </CardContent>
              </Card>

              {/* Expense Category Breakdown */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    تحليل أعلى تصنيفات المصروفات التشغيلية
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {dashboardStats?.expenseBreakdown && dashboardStats.expenseBreakdown.length > 0 ? (
                    dashboardStats.expenseBreakdown.map((item: any, idx: number) => {
                      const totalExp = dashboardStats.totalExpenses || 1;
                      const percent = Math.round((item.amount / totalExp) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-800 dark:text-slate-200">{item.category}</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{fmt(item.amount)} ريال ({percent}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">لا توجد مصاريف مسجلة حتى الآن.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: CHART OF ACCOUNTS (دليل الحسابات - Onyx Pro Dual Pane UI) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="chart" className="space-y-4 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Pane: Tree View (شجرة الحسابات) */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 flex flex-col h-[820px]">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-indigo-600" />
                    شجرة الحسابات الهيكلية (Onyx Pro Tree)
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono">
                      {accountsList.length} حساب
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleNewSubAccount()} 
                      className="h-6 px-2 text-[10px] text-indigo-600 hover:bg-indigo-50 gap-1 font-bold"
                    >
                      <Plus className="w-3 h-3" /> حساب جديد
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="بحث برقم الحساب أو الاسم أو طبيعته..."
                    id="accountSearchInput"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pr-8 h-8 text-xs"
                  />
                  {accountSearch && (
                    <button 
                      onClick={() => setAccountSearch("")}
                      className="absolute left-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-1.5">
                  {/* Category Grouping */}
                  {[
                    { code: "1", name: "1. الأصول والموجودات (Assets)", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50/80 dark:bg-blue-950/40" },
                    { code: "2", name: "2. الخصوم والالتزامات (Liabilities)", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50/80 dark:bg-amber-950/40" },
                    { code: "3", name: "3. حقوق الملكية ورأس المال (Equity)", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50/80 dark:bg-purple-950/40" },
                    { code: "4", name: "4. الإيرادات والمبيعات (Revenues)", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/80 dark:bg-emerald-950/40" },
                    { code: "5", name: "5. المصروفات والتكاليف (Expenses & COGS)", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50/80 dark:bg-rose-950/40" },
                  ].map(cat => {
                    const catAccounts = accountsList.filter((a: any) => {
                      const matchCat = a.code.startsWith(cat.code);
                      if (!accountSearch) return matchCat;
                      const q = accountSearch.toLowerCase();
                      return matchCat && (
                        a.code.toLowerCase().includes(q) ||
                        a.name.toLowerCase().includes(q) ||
                        (a.name_en && a.name_en.toLowerCase().includes(q))
                      );
                    });

                    if (accountSearch && catAccounts.length === 0) return null;

                    return (
                      <div key={cat.code} className="space-y-1 rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className={`p-2 font-bold ${cat.bg} ${cat.color} flex items-center justify-between cursor-pointer select-none`}>
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Folder className="w-3.5 h-3.5" />
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
                              {catAccounts.length}
                            </Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNewSubAccount({ code: `${cat.code}000`, type: cat.code === "1" ? "asset" : cat.code === "2" ? "liability" : cat.code === "3" ? "equity" : cat.code === "4" ? "revenue" : "expense" });
                              }}
                              className="p-0.5 hover:bg-black/10 rounded"
                              title="إضافة حساب تحت هذا التصنيف"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="p-1 space-y-0.5 max-h-[280px] overflow-y-auto">
                          {catAccounts.map((acc: any) => {
                            const isSelected = selectedAccountId === acc.id || accountForm.code === acc.code;
                            const isParent = acc.is_parent || (acc.children_count && acc.children_count > 0) || acc.code === "21100";
                            const isSubOf21100 = acc.parent_code === "21100" || (acc.code.startsWith("211") && acc.code !== "21100");
                            
                            let indent = Math.min((acc.code.length - 1) * 8, 32);
                            if (isSubOf21100) {
                              indent = 24;
                            }

                            return (
                              <div
                                key={acc.id}
                                onClick={() => handleSelectAccount(acc)}
                                style={{ paddingRight: `${Math.max(6, indent)}px` }}
                                className={`p-1.5 rounded transition-all cursor-pointer flex items-center justify-between text-[11px] group ${
                                  isSelected 
                                    ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-bold border-r-4 border-indigo-600 shadow-sm" 
                                    : isSubOf21100
                                    ? "hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-900/30"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {isSubOf21100 && (
                                    <span className="text-amber-500 font-bold text-[10px] shrink-0">└─</span>
                                  )}
                                  {isParent ? (
                                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-600" : "text-amber-500"}`} />
                                  ) : isSubOf21100 ? (
                                    <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-indigo-600" : "text-amber-600"}`} />
                                  ) : (
                                    <FileText className={`w-3 h-3 shrink-0 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                                  )}
                                  <span className="font-mono font-bold text-[10px] text-indigo-600 dark:text-indigo-400 shrink-0">
                                    {acc.code}
                                  </span>
                                  <span className="truncate" title={acc.name}>
                                    {acc.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {acc.code === "21100" && acc.children_count > 0 && (
                                    <Badge className="text-[9px] px-1.5 h-4 bg-amber-100 text-amber-800 border-amber-300">
                                      📁 {acc.children_count} موردين
                                    </Badge>
                                  )}
                                  {isSubOf21100 && (
                                    <Badge variant="outline" className="text-[9px] px-1 h-4 bg-amber-50 text-amber-700 border-amber-200 font-mono">
                                      {fmt(acc.balance)} YER
                                    </Badge>
                                  )}
                                  {acc.linked_safes_count > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 h-4 bg-emerald-50 text-emerald-700 border-emerald-200" title={`مرتبط بـ ${acc.linked_safes_count} خزائن`}>
                                      🏦 {acc.linked_safes_count}
                                    </Badge>
                                  )}
                                  {acc.linked_customers_count > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 h-4 bg-blue-50 text-blue-700 border-blue-200" title={`مرتبط بـ ${acc.linked_customers_count} عملاء`}>
                                      👥 {acc.linked_customers_count}
                                    </Badge>
                                  )}
                                  {acc.currencies_count > 1 && (
                                    <Badge variant="outline" className="text-[9px] px-1 h-4 bg-purple-50 text-purple-700 border-purple-200" title={`مرتبط بـ ${acc.currencies_count} عملات`}>
                                      💱 {acc.currencies_count}
                                    </Badge>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNewSubAccount(acc);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600 transition-opacity"
                                    title="إضافة حساب فرعي"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Comprehensive Onyx Pro Form & Multi-Entity Linker */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {isNewAccountMode || !accountForm.id ? "إنشاء حساب محاسبي جديد" : `تعديل الحساب: ${accountForm.name}`}
                          {isNewAccountMode && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              وضع الإضافة الجديد
                            </Badge>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-500">تهيئة خصائص الحساب وفق معايير نظام أومني سيستم برو مع ربط العملات المتعددة والصناديق والعملاء</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-xs">
                        المستوى: {accountForm.level || 4}
                      </Badge>
                      {accountForm.parent_code && (
                        <Badge variant="outline" className="text-xs font-mono">
                          الحساب الأب: {accountForm.parent_code}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Top Form Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Left Sub-Column */}
                    <div className="space-y-2.5">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          اسم الحساب (عربي) <span className="text-rose-500">*</span>
                        </label>
                        <Input 
                          value={accountForm.name} 
                          onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} 
                          placeholder="مثال: الصندوق الرئيسي - فرع صنعاء" 
                          className="text-xs font-bold h-8"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          الاسم الأجنبي (English Name)
                        </label>
                        <Input 
                          value={accountForm.name_en} 
                          onChange={(e) => setAccountForm({ ...accountForm, name_en: e.target.value })} 
                          placeholder="Main Cash Safe - Sanaa" 
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          الحساب الضريبي المعتمد
                        </label>
                        <Input 
                          value={accountForm.tax_account} 
                          onChange={(e) => setAccountForm({ ...accountForm, tax_account: e.target.value })} 
                          placeholder="ضريبة القيمة المضافة 5%" 
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          ملاحظات وتفاصيل الحساب
                        </label>
                        <Input 
                          value={accountForm.notes} 
                          onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} 
                          placeholder="ملاحظات توجيهية اختيارية للحساب..." 
                          className="text-xs h-8"
                        />
                      </div>
                    </div>

                    {/* Right Sub-Column */}
                    <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="stop_dealing_chk" 
                            checked={accountForm.stop_dealing}
                            onChange={(e) => setAccountForm({ ...accountForm, stop_dealing: e.target.checked })}
                            className="rounded text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer" 
                          />
                          <label htmlFor="stop_dealing_chk" className="font-bold text-rose-600 text-[11px] cursor-pointer">
                            إيقاف التعامل
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="auto_add_chk" 
                            checked={accountForm.auto_add}
                            onChange={(e) => setAccountForm({ ...accountForm, auto_add: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" 
                          />
                          <label htmlFor="auto_add_chk" className="font-semibold text-[11px] cursor-pointer">
                            إضافة تلقائية
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold block mb-1 text-[11px]">
                            رقم الحساب (الكود) <span className="text-rose-500">*</span>
                          </label>
                          <Input 
                            value={accountForm.code} 
                            onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} 
                            className="text-xs font-mono font-bold h-8 text-indigo-700 dark:text-indigo-300" 
                          />
                        </div>
                        <div>
                          <label className="font-bold block mb-1 text-[11px]">حالة ونوع الحساب</label>
                          <Select 
                            value={accountForm.is_parent ? "parent" : "movement"} 
                            onValueChange={(v) => setAccountForm({ ...accountForm, is_parent: v === "parent" })}
                          >
                            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="movement">حساب حركة (يقبل القيود)</SelectItem>
                              <SelectItem value="parent">حساب رئيسي (تجميعي)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold block mb-1 text-[11px]">طبيعة الحساب</label>
                          <Select value={accountForm.type} onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}>
                            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">مدين - Debit (أصول/موجودات)</SelectItem>
                              <SelectItem value="liability">دائن - Credit (خصوم/التزامات)</SelectItem>
                              <SelectItem value="equity">حقوق ملكية - Equity</SelectItem>
                              <SelectItem value="revenue">إيرادات ومبيعات - Revenue</SelectItem>
                              <SelectItem value="expense">مصروفات تشغيلية - Expense</SelectItem>
                              <SelectItem value="cogs">تكلفة خدمات وسياحة - COGS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="font-bold block mb-1 text-[11px]">العملة الأساسية</label>
                          <Select 
                            value={accountForm.currency} 
                            onValueChange={(v) => {
                              setAccountForm(prev => {
                                const exists = prev.currencies.some(c => c.currency_code === v);
                                const updatedCurrencies = exists 
                                  ? prev.currencies.map(c => ({ ...c, is_primary: c.currency_code === v }))
                                  : [
                                      { currency_code: v, currency_name: v === "YER" ? "ريال يمني (YER)" : v === "SAR" ? "ريال سعودي (SAR)" : v === "USD" ? "دولار أمريكي (USD)" : v, min_balance: 0, max_balance: 100000000, exchange_rate: 1.0, is_primary: true },
                                      ...prev.currencies.map(c => ({ ...c, is_primary: false }))
                                    ];
                                return { ...prev, currency: v, currencies: updatedCurrencies };
                              });
                            }}
                          >
                            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                              <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                              <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                              {systemCurrenciesList
                                .filter((c: any) => !["YER", "SAR", "USD"].includes(c.symbol))
                                .map((c: any) => (
                                  <SelectItem key={c.id} value={c.symbol}>
                                    {c.name} ({c.symbol})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Entity Linking Section (ربط الصناديق والعملاء) */}
                  <div className="border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                        الربط التحليلي المتعدد (Multi-Entity Linking)
                      </h4>
                      <div className="flex items-center gap-1">
                        {accountForm.id && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateSubAccountsMutation.mutate({ id: accountForm.id!, entity_type: "safes" })}
                              className="h-6 text-[10px] bg-white dark:bg-slate-800 text-emerald-700 hover:bg-emerald-50 border-emerald-200 gap-1"
                              title="توليد حسابات فرعية لجميع الصناديق وربطها تلقائياً"
                            >
                              ⚡ توليد للصناديق
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateSubAccountsMutation.mutate({ id: accountForm.id!, entity_type: "customers" })}
                              className="h-6 text-[10px] bg-white dark:bg-slate-800 text-blue-700 hover:bg-blue-50 border-blue-200 gap-1"
                              title="توليد حسابات فرعية لجميع العملاء وربطها تلقائياً"
                            >
                              ⚡ توليد للعملاء
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Safes Multi-Select */}
                      <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            ربط الصناديق النقدية والخزائن:
                          </label>
                          <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700">
                            تم تحديد {accountForm.linked_safe_ids.length} صندوق
                          </Badge>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-900/50 rounded border text-[11px]">
                          {safes.map((s: any) => {
                            const isChecked = accountForm.linked_safe_ids.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                                  isChecked ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...accountForm.linked_safe_ids, s.id]
                                        : accountForm.linked_safe_ids.filter((id) => id !== s.id);
                                      setAccountForm({ ...accountForm, linked_safe_ids: next });
                                    }}
                                    className="rounded text-indigo-600 h-3.5 w-3.5"
                                  />
                                  <span>{s.name}</span>
                                </div>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {fmt(s.balance)} {s.currency || "YER"}
                                </span>
                              </label>
                            );
                          })}
                          {safes.length === 0 && (
                            <div className="text-center py-2 text-slate-400 text-[10px]">لا توجد صناديق مهيأة بالنظام</div>
                          )}
                        </div>
                      </div>

                      {/* Customers Multi-Select */}
                      <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            ربط حسابات العملاء والوكلاء:
                          </label>
                          <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">
                            تم تحديد {accountForm.linked_customer_ids.length} عميل
                          </Badge>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-slate-900/50 rounded border text-[11px]">
                          {customers.filter((c: any) => !isIndirectCustomer(c)).map((c: any) => {
                            const isChecked = accountForm.linked_customer_ids.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                                  isChecked ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...accountForm.linked_customer_ids, c.id]
                                        : accountForm.linked_customer_ids.filter((id) => id !== c.id);
                                      setAccountForm({ ...accountForm, linked_customer_ids: next });
                                    }}
                                    className="rounded text-blue-600 h-3.5 w-3.5"
                                  />
                                  <span>{c.name}</span>
                                </div>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {c.phone || "—"}
                                </span>
                              </label>
                            );
                          })}
                          {customers.length === 0 && (
                            <div className="text-center py-2 text-slate-400 text-[10px]">لا يوجد عملاء مسجلين</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Currencies & Limits Manager */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-indigo-600" />
                          قائمة عملات الحساب والحدود الرقابية (Multi-Currencies)
                        </h4>
                        <p className="text-[10px] text-slate-500">إضافة وتعديل وحذف العملات المعتمدة للحساب وتحديد أسعار التحويل والأسقف الرقابية</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setAccountCurrencyForm({
                              currency_id: null,
                              currency_code: "SAR",
                              currency_name: "ريال سعودي (SAR)",
                              min_balance: 0,
                              max_balance: 500000,
                              exchange_rate: 0.27,
                              is_primary: false
                            });
                            setShowAccountCurrencyDlg(true);
                          }} 
                          className="h-7 text-[11px] gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
                        >
                          <Plus className="w-3 h-3" /> إضافة عملة للحساب
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => {
                            setSystemCurrencyForm({ name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: 1.0, active: 1 });
                            setShowSystemCurrencyDlg(true);
                          }} 
                          className="h-7 text-[11px] gap-1 font-bold"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" /> تهيئة عملة جديدة بالنظام
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900 text-xs">
                      <table className="w-full text-right">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                          <tr>
                            <th className="p-2">رمز العملة</th>
                            <th className="p-2">اسم العملة</th>
                            <th className="p-2">الحد الأدنى للرصيد</th>
                            <th className="p-2">الحد الأعلى للرصيد</th>
                            <th className="p-2">سعر الصرف</th>
                            <th className="p-2">الرئيسية</th>
                            <th className="p-2 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {accountForm.currencies.map((cur: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {cur.currency_code}
                              </td>
                              <td className="p-2 font-semibold">
                                {cur.currency_name}
                              </td>
                              <td className="p-2 font-mono">
                                {fmt(cur.min_balance)}
                              </td>
                              <td className="p-2 font-mono">
                                {fmt(cur.max_balance)}
                              </td>
                              <td className="p-2 font-mono font-bold text-emerald-600">
                                {cur.exchange_rate || 1.0}
                              </td>
                              <td className="p-2">
                                {cur.is_primary ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                    العملة الأساسية
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">فرعية</span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      setAccountCurrencyForm({
                                        currency_id: cur.currency_id || null,
                                        currency_code: cur.currency_code,
                                        currency_name: cur.currency_name,
                                        min_balance: cur.min_balance || 0,
                                        max_balance: cur.max_balance || 100000000,
                                        exchange_rate: cur.exchange_rate || 1.0,
                                        is_primary: !!cur.is_primary
                                      });
                                      setShowAccountCurrencyDlg(true);
                                    }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-600"
                                    title="تعديل الحدود وسعر الصرف"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  {accountForm.currencies.length > 1 && (
                                    <button
                                      onClick={() => {
                                        const next = accountForm.currencies.filter((_, i) => i !== idx);
                                        setAccountForm({ ...accountForm, currencies: next });
                                        toast({ title: `تم حذف عملة (${cur.currency_code}) من هذا الحساب` });
                                      }}
                                      className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"
                                      title="حذف العملة من الحساب"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sub-accounts & Suppliers Section for 21100 / Parent Accounts */}
                  {(accountForm.code === "21100" || accountForm.parent_code === "21100" || (accountForm.children && accountForm.children.length > 0)) && (
                    <div className="space-y-2.5 pt-3 border-t border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-xl">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                          <div>
                            <h4 className="font-bold text-xs text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                              الحسابات الفرعية والموردين المرتبطين بالحساب (21100)
                              <Badge className="bg-amber-200 text-amber-900 border-amber-300 text-[10px]">
                                {(accountForm.children || []).length} حسابات فرعية
                              </Badge>
                            </h4>
                            <p className="text-[10px] text-amber-800/80 dark:text-amber-300/70">
                              جميع الموردين وشركات الطيران والفنادق المضافة تظهر تلقائياً كحسابات فرعية هنا وتؤثر مالياً في الحساب الرئيسي 21100
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-left bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                            <span className="text-[10px] text-muted-foreground block">إجمالي رصيد الذمم الدائنة:</span>
                            <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                              {fmt(accountForm.aggregated_balance || accountForm.children?.reduce((sum: number, c: any) => sum + Number(c.balance || 0), 0) || 0)} {accountForm.currency || "YER"}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => {
                              const nextSub = accountForm.code === "21100" ? "21100" : accountForm.parent_code || "21100";
                              handleNewSubAccount({ code: nextSub, parent_code: nextSub, type: "liability" });
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-[11px] font-bold gap-1 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" /> إضافة مورد / حساب فرعي
                          </Button>
                        </div>
                      </div>

                      {/* Sub-Accounts & Suppliers Table */}
                      <div className="border border-amber-200 dark:border-amber-900 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold border-b border-amber-200 dark:border-amber-900 text-[10px]">
                            <tr>
                              <th className="p-2">رمز الحساب</th>
                              <th className="p-2">اسم المورد / الحساب الفرعي</th>
                              <th className="p-2 text-center">النوع / التصنيف</th>
                              <th className="p-2 text-center">الرصيد الحالي</th>
                              <th className="p-2 text-center">الإجراءات والعمليات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 dark:divide-amber-950 text-[11px]">
                            {(accountForm.children && accountForm.children.length > 0 
                              ? accountForm.children 
                              : accountsList.filter((a: any) => a.parent_code === "21100")
                            ).map((subAcc: any) => {
                              const isChildSelected = selectedAccountId === subAcc.id;
                              return (
                                <tr 
                                  key={subAcc.id}
                                  className={`transition-colors ${
                                    isChildSelected ? "bg-amber-100/80 font-bold" : "hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
                                  }`}
                                >
                                  <td className="p-2 font-mono font-bold text-amber-800 dark:text-amber-400">
                                    {subAcc.code}
                                  </td>
                                  <td className="p-2 font-bold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{subAcc.name}</span>
                                    </div>
                                  </td>
                                  <td className="p-2 text-center">
                                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200">
                                      مورد / حساب فرعي
                                    </Badge>
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold">
                                    <span className={Number(subAcc.balance) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}>
                                      {fmt(subAcc.balance)} YER
                                    </span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSelectAccount(subAcc)}
                                        className="h-6 text-[10px] px-2 text-indigo-600 hover:bg-indigo-50 font-bold"
                                        title="عرض وتعديل بيانات الحساب"
                                      >
                                        <Edit className="w-3 h-3 ml-1" />
                                        عرض / تعديل
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSelectedPartyId(String(subAcc.id || subAcc.code));
                                          setStatementPartyType("account");
                                          handleTabChange("statements");
                                        }}
                                        className="h-6 text-[10px] px-2 text-emerald-600 hover:bg-emerald-50 font-bold"
                                        title="عرض كشف الحساب التفصيلي"
                                      >
                                        <FileText className="w-3 h-3 ml-1" />
                                        كشف حساب
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {(!accountForm.children || accountForm.children.length === 0) && accountsList.filter((a: any) => a.parent_code === "21100").length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-amber-700/60 dark:text-amber-400/60 text-xs">
                                  لا توجد حسابات فرعية مضافة بعد تحت هذا الحساب الرئيسي
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Onyx Pro Bottom Action Toolbar */}
                <div className="bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      onClick={handleSaveAccount}
                      disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 font-bold gap-1 shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      حفظ (F10)
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleNewSubAccount()} 
                      className="text-xs h-8 px-3 gap-1 font-semibold bg-white dark:bg-slate-900"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      جديد (Ctrl+N)
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        if (!accountForm.id) {
                          toast({ variant: "destructive", title: "يرجى اختيار حساب أولاً لحذفه" });
                          return;
                        }
                        setShowDeleteAccountConfirmDlg(true);
                      }} 
                      className="text-xs h-8 px-3 text-rose-600 hover:bg-rose-50 border-rose-200 bg-white dark:bg-slate-900"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      حذف
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById("accountSearchInput")?.focus()} 
                      className="text-xs h-8 px-3 bg-white dark:bg-slate-900"
                    >
                      <Search className="w-3.5 h-3.5 ml-1" />
                      بحث
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        toast({ title: "جاري تجهيز وثيقة دليل الحسابات للطباعة..." });
                        setTimeout(() => window.print(), 300);
                      }} 
                      className="text-xs h-8 px-3 bg-white dark:bg-slate-900"
                    >
                      <Printer className="w-3.5 h-3.5 ml-1" />
                      طباعة
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowExcelImportDlg(true)} 
                      className="text-xs h-8 px-3 gap-1 font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      استيراد إكسل / PDF
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={handleExportCOA} 
                      className="text-xs h-8 px-3 gap-1 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      تصدير
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog: Add/Edit Account Currency */}
            <Dialog open={showAccountCurrencyDlg} onOpenChange={setShowAccountCurrencyDlg}>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Coins className="w-5 h-5 text-indigo-600" />
                    إضافة / تعديل عملة الحساب
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs">
                  <div>
                    <label className="font-bold block mb-1">اختر العملة</label>
                    <select
                      value={accountCurrencyForm.currency_code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = systemCurrenciesList.find((c: any) => c.symbol === code);
                        setAccountCurrencyForm({
                          ...accountCurrencyForm,
                          currency_code: code,
                          currency_name: match ? `${match.name} (${match.symbol})` : code === "YER" ? "ريال يمني (YER)" : code === "SAR" ? "ريال سعودي (SAR)" : code === "USD" ? "دولار أمريكي (USD)" : code,
                          exchange_rate: match ? Number(match.exchange_rate) || 1.0 : code === "SAR" ? 0.27 : 1.0
                        });
                      }}
                      className="w-full p-2 rounded border bg-background text-xs"
                    >
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو أوروبي (EUR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="OMR">ريال عماني (OMR)</option>
                      <option value="QAR">ريال قطري (QAR)</option>
                      <option value="KWD">دينار كويتي (KWD)</option>
                      <option value="JOD">دينار أردني (JOD)</option>
                      <option value="GBP">جنيه إسترليني (GBP)</option>
                      {systemCurrenciesList
                        .filter((c: any) => !["YER", "SAR", "USD", "EUR", "AED", "OMR", "QAR", "KWD", "JOD", "GBP"].includes(c.symbol))
                        .map((c: any) => (
                          <option key={c.id} value={c.symbol}>
                            {c.name} ({c.symbol})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold block mb-1">الحد الأدنى للرصيد</label>
                      <Input
                        type="number"
                        value={accountCurrencyForm.min_balance}
                        onChange={(e) => setAccountCurrencyForm({ ...accountCurrencyForm, min_balance: parseFloat(e.target.value) || 0 })}
                        className="text-xs font-mono h-8"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">الحد الأعلى للرصيد</label>
                      <Input
                        type="number"
                        value={accountCurrencyForm.max_balance}
                        onChange={(e) => setAccountCurrencyForm({ ...accountCurrencyForm, max_balance: parseFloat(e.target.value) || 0 })}
                        className="text-xs font-mono h-8"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold block mb-1">سعر الصرف المعتمد</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={accountCurrencyForm.exchange_rate}
                      onChange={(e) => setAccountCurrencyForm({ ...accountCurrencyForm, exchange_rate: parseFloat(e.target.value) || 1.0 })}
                      className="text-xs font-mono h-8"
                    />
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded border">
                    <input
                      type="checkbox"
                      id="is_primary_chk"
                      checked={accountCurrencyForm.is_primary}
                      onChange={(e) => setAccountCurrencyForm({ ...accountCurrencyForm, is_primary: e.target.checked })}
                      className="rounded text-indigo-600 h-4 w-4"
                    />
                    <label htmlFor="is_primary_chk" className="font-bold text-xs cursor-pointer">
                      تعيين كعملة رئيسية للحساب
                    </label>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAccountCurrencyDlg(false)}>
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    onClick={() => {
                      const updatedList = [
                        ...accountForm.currencies.filter(c => c.currency_code !== accountCurrencyForm.currency_code),
                        {
                          ...accountCurrencyForm,
                          is_primary: accountCurrencyForm.is_primary
                        }
                      ];
                      if (accountCurrencyForm.is_primary) {
                        updatedList.forEach(c => {
                          if (c.currency_code !== accountCurrencyForm.currency_code) c.is_primary = false;
                        });
                      }
                      setAccountForm({
                        ...accountForm,
                        currency: accountCurrencyForm.is_primary ? accountCurrencyForm.currency_code : accountForm.currency,
                        currencies: updatedList
                      });
                      setShowAccountCurrencyDlg(false);
                      toast({ title: `تم حفظ عملة (${accountCurrencyForm.currency_code}) في قائمة عملات الحساب` });
                    }}
                  >
                    حفظ العملة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog: Add New System Currency */}
            <Dialog open={showSystemCurrencyDlg} onOpenChange={setShowSystemCurrencyDlg}>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    تهيئة عملة جديدة في قاعدة بيانات النظام
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs">
                  <div>
                    <label className="font-bold block mb-1">اسم العملة بالعربي <span className="text-rose-500">*</span></label>
                    <Input
                      value={systemCurrencyForm.name}
                      onChange={(e) => setSystemCurrencyForm({ ...systemCurrencyForm, name: e.target.value })}
                      placeholder="مثال: يورو أوروبي"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold block mb-1">الرمز الدولي <span className="text-rose-500">*</span></label>
                      <Input
                        value={systemCurrencyForm.symbol}
                        onChange={(e) => setSystemCurrencyForm({ ...systemCurrencyForm, symbol: e.target.value.toUpperCase() })}
                        placeholder="EUR"
                        className="text-xs font-mono uppercase h-8"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">فئة الجزء (الكسر)</label>
                      <Input
                        value={systemCurrencyForm.fraction}
                        onChange={(e) => setSystemCurrencyForm({ ...systemCurrencyForm, fraction: e.target.value })}
                        placeholder="سنت"
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold block mb-1">نوع العملة</label>
                      <Select 
                        value={systemCurrencyForm.type} 
                        onValueChange={(v) => setSystemCurrencyForm({ ...systemCurrencyForm, type: v })}
                      >
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="foreign">عملة أجنبية</SelectItem>
                          <SelectItem value="local">عملة محلية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="font-bold block mb-1">سعر الصرف الافتراضي</label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={systemCurrencyForm.exchange_rate}
                        onChange={(e) => setSystemCurrencyForm({ ...systemCurrencyForm, exchange_rate: parseFloat(e.target.value) || 1.0 })}
                        className="text-xs font-mono h-8"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSystemCurrencyDlg(false)}>
                    إلغاء
                  </Button>
                  <Button
                    size="sm"
                    disabled={createSystemCurrencyMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    onClick={() => {
                      if (!systemCurrencyForm.name || !systemCurrencyForm.symbol) {
                        toast({ variant: "destructive", title: "يرجى إدخال اسم ورمز العملة" });
                        return;
                      }
                      createSystemCurrencyMutation.mutate(systemCurrencyForm);
                    }}
                  >
                    حفظ وإضافة للنظام
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog: Delete Account Confirmation */}
            <Dialog open={showDeleteAccountConfirmDlg} onOpenChange={setShowDeleteAccountConfirmDlg}>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    تأكيد حذف الحساب المحاسبي
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs">
                  <p className="text-slate-700 dark:text-slate-300">
                    هل أنت متأكد من رغبتك في حذف الحساب التالي من دليل الحسابات؟
                  </p>
                  <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200 dark:border-rose-900">
                    <div className="font-bold text-rose-900 dark:text-rose-200">
                      {accountForm.code} - {accountForm.name}
                    </div>
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                      طبيعة الحساب: {accountForm.type} | المستوى: {accountForm.level}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    تنبيه رقابي: لن يسمح النظام بحذف الحساب إذا كان يحتوي على حركات يومية مسجلة أو حسابات فرعية متفرعة عنه.
                  </p>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteAccountConfirmDlg(false)}>
                    إلغاء التراجع
                  </Button>
                  <Button
                    size="sm"
                    disabled={deleteAccountMutation.isPending}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    onClick={() => {
                      if (accountForm.id) {
                        deleteAccountMutation.mutate(accountForm.id);
                      }
                    }}
                  >
                    تأكيد الحذف نهائياً
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog: Excel, CSV & PDF Smart Import with Preview, Validation, and Mojibake Prevention */}
            <AccountImportModal
              open={showExcelImportDlg}
              onOpenChange={setShowExcelImportDlg}
              onImportSuccess={() => {
                refetchAccounts();
              }}
              onCleanSuccess={() => {
                refetchAccounts();
              }}
            />
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 3: JOURNAL ENTRIES & TRIAL BALANCE (Onyx Pro Engine) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="journal" className="space-y-4 m-0">
            {/* Action Bar Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">سجل القيود اليومية المحاسبية والسندات</h3>
                  <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 text-xs">
                    {journalEntries.length} قيد محاسبي
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">شاشة متكاملة لإنشاء وتعديل واستعراض وطباعة سندات القيود اليومية المتعددة العملات وفق معايير نظام أومني سيستم برو وإياتا.</p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setSelectedJournalId(null);
                    setShowJournalVoucherDlg(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm font-bold h-9"
                >
                  <Plus className="w-4 h-4" />
                  سند قيد مزدوج جديد
                </Button>
                <Button
                  onClick={() => handlePreviewJournalEntryFullScreen()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm font-bold h-9"
                  title="طباعة استعراض شاشة كاملة لسند القيد (مطابق للعملية رقم 22)"
                >
                  <Eye className="w-4 h-4" />
                  طباعة استعراض شاشة كاملة
                </Button>
              </div>
            </div>

            {/* Trial Balance Banner Summary */}
            <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-900">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-200">حالة ميزان المراجعة والقيود</h4>
                    <p className="text-sm font-extrabold text-white">
                      إجمالي المدين: {fmt(trialBalance?.totalDebit)} ريال | إجمالي الدائن: {fmt(trialBalance?.totalCredit)} ريال
                    </p>
                  </div>
                </div>

                <Badge className={Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "bg-emerald-500 text-white text-xs px-3 py-1" : "bg-rose-500 text-white text-xs px-3 py-1"}>
                  {Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "ميزان متزن 100%" : "يوجد فرق بالميزان!"}
                </Badge>
              </CardContent>
            </Card>

            {/* Search & Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  value={journalSearchText}
                  onChange={(e) => setJournalSearchText(e.target.value)}
                  placeholder="بحث سريع برقم القيد، البيان، المرجع، أو اسم الحساب..."
                  className="h-8 text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Select value={journalFilterType} onValueChange={setJournalFilterType}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="نوع القيد" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كافة الأنواع</SelectItem>
                    <SelectItem value="manual">يدوي / سند قيد</SelectItem>
                    <SelectItem value="sale">مبيعات وحجوزات</SelectItem>
                    <SelectItem value="expense">مصاريف</SelectItem>
                    <SelectItem value="reversal">قيود عكسية</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    refetchJournal();
                    refetchAccounts();
                    refetchTrialBalance();
                  }}
                  className="h-8 text-xs gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  تحديث
                </Button>
              </div>
            </div>

            {/* Journal Entries Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رقم القيد</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">البيان والشرح</th>
                      <th className="p-3 text-center">العملة</th>
                      <th className="p-3">المصدر / التصنيف</th>
                      <th className="p-3">أطراف وبنود القيد (مدين / دائن)</th>
                      <th className="p-3 text-center">الإجمالي</th>
                      <th className="p-3 text-center">إجراءات وعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-slate-400">
                          لا توجد قيود يومية تطابق معايير البحث
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry: any) => {
                        const entryDebitSum = (entry.lines || []).reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
                        return (
                          <tr
                            key={entry.id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              entry.is_reversed ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                            }`}
                          >
                            {/* Entry Number */}
                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{entry.entry_number}</span>
                              </div>
                            </td>

                            {/* Date */}
                            <td className="p-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                              {entry.entry_date}
                            </td>

                            {/* Description */}
                            <td className="p-3 font-medium text-slate-900 dark:text-white max-w-xs">
                              <div className="truncate font-semibold">{entry.description}</div>
                              {entry.reference_no && (
                                <div className="text-[10px] text-slate-400 font-mono">مرجع: {entry.reference_no}</div>
                              )}
                            </td>

                            {/* Currency */}
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="font-bold text-[10px] bg-slate-50 dark:bg-slate-800">
                                {entry.currency || "YER"}
                              </Badge>
                            </td>

                            {/* Source Type / Doc Type */}
                            <td className="p-3 whitespace-nowrap">
                              <Badge variant="outline" className="text-[10px]">
                                {entry.doc_type || entry.source_type || "عام"}
                              </Badge>
                            </td>

                            {/* Lines Details */}
                            <td className="p-3">
                              <div className="space-y-1 text-[11px] max-w-sm">
                                {entry.lines?.map((line: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-0.5 last:border-0">
                                    <span className="truncate text-slate-700 dark:text-slate-300">
                                      <strong className="font-mono text-indigo-600 dark:text-indigo-400 ml-1">[{line.account_code}]</strong>
                                      {line.account_name}
                                    </span>
                                    <div className="flex items-center gap-1 whitespace-nowrap">
                                      {line.debit > 0 && <span className="text-emerald-600 font-bold font-mono">مدين {fmt(line.debit)}</span>}
                                      {line.credit > 0 && <span className="text-blue-600 font-bold font-mono">دائن {fmt(line.credit)}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Total Debit / Credit */}
                            <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {fmt(entryDebitSum)} {entry.currency || "YER"}
                            </td>

                            {/* Actions Buttons (استعراض، تعديل، طباعة، عكس) */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {/* Full-Screen Preview Button (Operation 22) */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePreviewJournalEntryFullScreen(entry)}
                                  className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 font-bold"
                                  title="طباعة استعراض شاشة كاملة (العملية 22)"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  استعراض شاشة كاملة
                                </Button>

                                {/* View Voucher */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedJournalId(entry.id);
                                    setShowJournalVoucherDlg(true);
                                  }}
                                  className="h-7 px-2 text-xs text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 gap-1"
                                  title="استعراض ومعاينة السند"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  تفاصيل
                                </Button>

                                {/* Edit Entry */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedJournalId(entry.id);
                                    setShowJournalVoucherDlg(true);
                                  }}
                                  className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1"
                                  title="تعديل القيد المحاسبي"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  تعديل
                                </Button>

                                {/* Print */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedJournalId(entry.id);
                                    setShowJournalVoucherDlg(true);
                                  }}
                                  className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                                  title="طباعة سند القيد"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  طباعة
                                </Button>

                                {/* Reverse Entry */}
                                {entry.is_reversed ? (
                                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-[10px]">
                                    معكوس ومصحح
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm("هل أنت متأكد من رغبتك في عكس وتصحيح هذا القيد؟ سيتم إنشاء قيد تسوية عكسي.")) {
                                        reverseJournalMutation.mutate(entry.id);
                                      }
                                    }}
                                    className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    title="عكس وتصحيح القيد"
                                  >
                                    عكس
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Bottom Footer Action Bar */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">إجمالي القيود اليومية المسجلة: {filteredEntries.length} قيد محاسبي</span>
                  <Button
                    size="sm"
                    onClick={() => handlePreviewJournalEntryFullScreen()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-4 font-bold gap-1.5 shadow"
                    title="طباعة استعراض شاشة كاملة قبل العرض (العملية 22)"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    طباعة استعراض شاشة كاملة قبل العرض
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: TRIAL BALANCE (ميزان المراجعة الشامل - مطابق للصورة) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="trial" className="space-y-4 m-0">
            {/* Top ERP Report Header Filter Bar */}
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-center">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">من تاريخ:</span>
                  <Input type="date" value={reportOpts.fromDate} onChange={(e) => setReportOpts({ ...reportOpts, fromDate: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">الى تاريخ:</span>
                  <Input type="date" value={reportOpts.toDate} onChange={(e) => setReportOpts({ ...reportOpts, toDate: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">السنة المالية:</span>
                  <Input value={reportOpts.fiscalYear} onChange={(e) => setReportOpts({ ...reportOpts, fiscalYear: e.target.value })} className="h-6 w-16 text-[11px] border-0 bg-transparent p-0 text-center font-bold" />
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={reportOpts.excludeClosing} onChange={(e) => setReportOpts({ ...reportOpts, excludeClosing: e.target.checked })} className="rounded" />
                    استبعاد قيود الاقفال
                  </label>
                </div>
                <div className="col-span-2 flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">الوصف:</span>
                  <Input value={reportOpts.description} onChange={(e) => setReportOpts({ ...reportOpts, description: e.target.value })} placeholder="بحث بالوصف..." className="h-6 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold">رقم الفرع:</span>
                  <Input value={reportOpts.branchId} onChange={(e) => setReportOpts({ ...reportOpts, branchId: e.target.value })} className="h-6 w-8 text-center font-bold border-0 bg-transparent p-0" />
                  <span className="text-indigo-600 font-bold truncate text-[11px]">{reportOpts.branchName}</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border justify-center">
                  <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={reportOpts.department} onChange={(e) => setReportOpts({ ...reportOpts, department: e.target.checked })} className="rounded" />
                    رقم القسم
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">طريقة العرض:</span>
                  <Select value={reportOpts.displayMethod} onValueChange={(v) => setReportOpts({ ...reportOpts, displayMethod: v })}>
                    <SelectTrigger className="h-7 text-xs bg-rose-50 dark:bg-rose-950 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="by_code">حسب رقم الحساب</SelectItem>
                      <SelectItem value="by_name">حسب اسم الحساب</SelectItem>
                      <SelectItem value="by_movement">حسب الحركة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">نوع العرض:</span>
                  <Select value={reportOpts.currencyType} onValueChange={(v) => setReportOpts({ ...reportOpts, currencyType: v })}>
                    <SelectTrigger className="h-7 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">بالعملة المحلية (ريال)</SelectItem>
                      <SelectItem value="foreign">بالعملة الاجنبية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* View Granularity & Radio Options */}
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded border space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-700 dark:text-indigo-300">
                      <input type="checkbox" checked={reportOpts.byLevel} onChange={(e) => setReportOpts({ ...reportOpts, byLevel: e.target.checked })} className="rounded" />
                      بحسب المستوى:
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map(lvl => (
                        <Button
                          key={lvl}
                          size="sm"
                          type="button"
                          variant={reportOpts.selectedLevel === lvl ? "default" : "outline"}
                          className={`h-6 px-2 text-[10px] font-bold ${reportOpts.selectedLevel === lvl ? 'bg-indigo-600 text-white' : ''}`}
                          onClick={() => setReportOpts({ ...reportOpts, byLevel: true, selectedLevel: lvl })}
                        >
                          مستوى {lvl}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        type="button"
                        variant={!reportOpts.selectedLevel || reportOpts.selectedLevel === 0 ? "default" : "outline"}
                        className="h-6 px-2 text-[10px] font-bold"
                        onClick={() => setReportOpts({ ...reportOpts, selectedLevel: 0 })}
                      >
                        جميع المستويات
                      </Button>
                    </div>
                  </div>
                  <Badge className="bg-indigo-600 text-white font-bold text-[11px] px-3 py-1">مشاهدة / استعراض</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                  {[
                    { id: "movement", label: "حسب الحساب الحركي" },
                    { id: "account_type", label: "حسب نوع الحساب" },
                    { id: "movement_name", label: "حسب اسم الحركة" },
                    { id: "beneficiary", label: "حسب اسم المستفيد" },
                    { id: "tax_name", label: "حسب الاسم الضريبي" },
                    { id: "analytical", label: "الحساب تحليلي" },
                    { id: "party", label: "حسب الجهة" },
                    { id: "main_account", label: "حسب الحساب الرئيسي" },
                    { id: "category", label: "حسب تصنيف الحساب" },
                    { id: "cost_center", label: "حسب مراكز التكلفة" },
                    { id: "center_account", label: "حسب المركز والحساب" },
                    { id: "group", label: "حسب مجموعة الحساب" },
                    { id: "analytical_only", label: "تحليلي فقط" },
                    { id: "account_party", label: "الحساب والجهة" },
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                      <input
                        type="radio"
                        name="trialViewMode"
                        checked={reportOpts.viewGranularity === opt.id}
                        onChange={() => setReportOpts({ ...reportOpts, viewGranularity: opt.id })}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Detailed Accounts Trial Balance Table matching Image */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border-b">
                    <tr>
                      <th className="p-2.5 border-l">رقم الحساب</th>
                      <th className="p-2.5 border-l">اسم الحساب</th>
                      <th className="p-2.5 border-l">افتتاحي مدين</th>
                      <th className="p-2.5 border-l">افتتاحي دائن</th>
                      <th className="p-2.5 border-l">الفترة مدين</th>
                      <th className="p-2.5 border-l">الفترة دائن</th>
                      <th className="p-2.5 border-l">اجمالي مدين</th>
                      <th className="p-2.5">اجمالي دائن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTrialAccounts?.map((acc: any, idx: number) => (
                      <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 border-l font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                          <span>{acc.code}</span>
                          <span className="text-slate-400 font-normal text-[10px]">{idx + 1}</span>
                        </td>
                        <td className="p-2.5 border-l font-semibold text-slate-900 dark:text-white">{acc.name}</td>
                        <td className="p-2.5 border-l font-mono">0.00</td>
                        <td className="p-2.5 border-l font-mono">0.00</td>
                        <td className="p-2.5 border-l font-mono text-emerald-600 font-bold">{fmt(acc.debit)}</td>
                        <td className="p-2.5 border-l font-mono text-rose-600 font-bold">{fmt(acc.credit)}</td>
                        <td className="p-2.5 border-l font-mono font-extrabold text-emerald-700">{fmt(acc.debit)}</td>
                        <td className="p-2.5 font-mono font-extrabold text-rose-700">{fmt(acc.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 dark:bg-slate-800 font-black border-t-2 text-slate-900 dark:text-white">
                    <tr>
                      <td colSpan={2} className="p-2.5 text-left border-l">اجماليات</td>
                      <td className="p-2.5 border-l font-mono">0</td>
                      <td className="p-2.5 border-l font-mono">0</td>
                      <td className="p-2.5 border-l font-mono text-emerald-600">{fmt(trialBalance?.totalDebit)}</td>
                      <td className="p-2.5 border-l font-mono text-rose-600">{fmt(trialBalance?.totalCredit)}</td>
                      <td className="p-2.5 border-l font-mono text-emerald-700">{fmt(trialBalance?.totalDebit)}</td>
                      <td className="p-2.5 font-mono text-rose-700">{fmt(trialBalance?.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Bottom ERP Action Toolbar matching Image */}
            <div className="bg-slate-200 dark:bg-slate-800 p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="destructive" size="sm" onClick={() => handleTabChange("dashboard")} className="text-xs h-8">خروج</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "تم تصدير تقرير ميزان المراجعة إلى Excel بنجاح" })} className="text-xs h-8 gap-1"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> تصدير</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "تمت مصادقة وتدقيق الميزان المحاسبي بنجاح ✅" })} className="text-xs h-8 gap-1"><ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> مصادقة</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Switch to English UI" })} className="text-xs h-8 font-mono">EN</Button>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "معلومات السجل والنظام المحاسبي" })} className="h-8 w-8 p-0"><Info className="w-4 h-4 text-slate-500" /></Button>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={reportOpts.expandAll} onChange={(e) => setReportOpts({ ...reportOpts, expandAll: e.target.checked })} className="rounded" />
                  توسيع
                </label>
                <Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري طباعة الأرصدة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة الأرصدة</Button>
                <Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري الطباعة المخصصة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة مخصصة</Button>
                <Button size="sm" onClick={() => handlePrintTrial()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-5 gap-1.5 font-bold shadow"><Eye className="w-3.5 h-3.5" /> طباعة استعراض شاشة كاملة (العملية 12)</Button>
              </div>
            </div>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: RECEIPT VOUCHER SCREEN (شاشة سندات القبض - صورة 1) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="receipt_vouchers" className="space-y-4 m-0">
            <Card className="bg-[#e2e8f0] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-4 text-xs">
              {/* Header Badge & Navigation */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm mb-3">
                <div className="flex items-center gap-3">
                  <span className="bg-emerald-600 text-white px-5 py-1.5 rounded-md font-black text-sm shadow">سند قبض</span>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">التاريخ:</span>
                    <Input 
                      type="date" 
                      value={receiptForm.date} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })} 
                      className="h-7 w-32 text-xs border-0 bg-transparent p-0 font-bold" 
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">رقم السند:</span>
                    <Input 
                      value={receiptForm.voucher_no} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, voucher_no: e.target.value })} 
                      className="h-7 w-20 text-xs border-0 bg-transparent p-0 font-bold text-center font-mono text-emerald-700" 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">رقم المرجع:</span>
                    <Input 
                      value={receiptForm.reference_no} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, reference_no: e.target.value })} 
                      className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-bold font-mono" 
                    />
                  </div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold px-3 py-1">سند تحصيل نقدي معتمد</Badge>
                </div>
              </div>

              {/* Grid Form Fields matching Image 1 */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">رقم الحركة:</div>
                  <div className="col-span-4">
                    <Input value={receiptForm.voucher_no || "1"} onChange={(e) => setReceiptForm({ ...receiptForm, voucher_no: e.target.value })} className="h-8 text-xs font-mono font-bold" />
                  </div>
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">اسم الصندوق:</div>
                  <div className="col-span-4">
                    <Select value={receiptForm.safe_id} onValueChange={(v) => setReceiptForm({ ...receiptForm, safe_id: v })}>
                      <SelectTrigger className="h-8 text-xs font-bold">
                        <SelectValue placeholder="صندوق رئيسي" />
                      </SelectTrigger>
                      <SelectContent>
                        {safes.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                        {safes.length === 0 && <SelectItem value="1">صندوق رئيسي</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">عملة الحساب (F9):</div>
                  <div className="col-span-4 flex items-center gap-1.5">
                    <Select 
                      value={receiptForm.currency} 
                      onValueChange={(val) => {
                        const rates: Record<string, string> = { SAR: "140", YER: "1", USD: "530" };
                        setReceiptForm({ ...receiptForm, currency: val, exchange_rate: rates[val] || "1" });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-bold border-purple-300 bg-purple-50 text-purple-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                        <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                        <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cycleReceiptCurrency}
                      title="اضغط Shift+F9 لتغيير العملة"
                      className="h-8 px-2 text-[11px] font-black bg-purple-100 text-purple-900 border-purple-300 shrink-0"
                    >
                      Shift+F9
                    </Button>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-slate-400 text-[10px]">س.ص</span>
                      <Input className="h-8 w-14 text-xs font-mono font-bold text-center" value={receiptForm.exchange_rate} onChange={(e) => setReceiptForm({ ...receiptForm, exchange_rate: e.target.value })} />
                    </div>
                  </div>

                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ رقماً:</div>
                  <div className="col-span-4">
                    <Input 
                      value={receiptForm.amount} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} 
                      className="h-8 text-xs font-black font-mono bg-pink-100 text-rose-800 border-pink-300 dark:bg-pink-950 dark:text-pink-200" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">استلمت من (F9):</div>
                  <div className="col-span-4 flex items-center gap-1">
                    <Input 
                      value={receiptForm.received_from} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, received_from: e.target.value })} 
                      className="h-8 text-xs font-bold text-emerald-800 bg-emerald-50/50 border-emerald-300" 
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setF9Target("receipt"); setShowF9ChartDlg(true); }}
                      className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 text-[10px] gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      F9 الدليل
                    </Button>
                  </div>

                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">رقم المستفيد:</div>
                  <div className="col-span-4 flex items-center gap-1">
                    <Input value={receiptForm.party_id || "1"} onChange={(e) => setReceiptForm({ ...receiptForm, party_id: e.target.value })} className="h-8 text-xs font-mono font-bold" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setF9Target("receipt"); setShowF9ChartDlg(true); }}
                      className="h-8 px-2 bg-slate-200 text-slate-800 hover:bg-slate-300 shrink-0 text-[10px]"
                    >
                      اختيار
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">البيان/السبب:</div>
                  <div className="col-span-10">
                    <Input 
                      value={receiptForm.payment_against} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, payment_against: e.target.value })} 
                      className="h-8 text-xs font-semibold" 
                    />
                  </div>
                </div>
              </div>

              {/* Subtabs Table matching Image 1 */}
              <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm p-3">
                <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2 mb-3 overflow-x-auto">
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold border-b-2 border-emerald-600 text-emerald-700 rounded-none">تفاصيل حسابات السند</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">تفاصيل اخرى</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">خاص بالأقساط</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">المرفقات</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">خيارات السند</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">ملاحظات مالية</Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="p-2 border w-12 text-center">#</th>
                        <th className="p-2 border w-28">المبلغ</th>
                        <th className="p-2 border">اسم الحساب (دليل الحسابات - F9)</th>
                        <th className="p-2 border w-24">العملة</th>
                        <th className="p-2 border">البيان</th>
                        <th className="p-2 border w-28">مبلغ القيد</th>
                        <th className="p-2 border w-16 text-center">س.ص</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 border text-center font-bold">1</td>
                        <td className="p-2 border">
                          <Input value={receiptForm.amount} onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} className="h-7 text-xs font-bold font-mono" />
                        </td>
                        <td className="p-2 border">
                          <div className="flex items-center gap-1">
                            <Input value={receiptForm.received_from} onChange={(e) => setReceiptForm({ ...receiptForm, received_from: e.target.value })} className="h-7 text-xs font-bold text-emerald-800" />
                            <Button size="sm" onClick={() => { setF9Target("receipt"); setShowF9ChartDlg(true); }} className="h-7 px-1.5 text-[10px] bg-emerald-600 text-white font-bold shrink-0">F9</Button>
                          </div>
                        </td>
                        <td className="p-2 border font-mono">{receiptForm.currency}</td>
                        <td className="p-2 border">
                          <Input value={receiptForm.notes || "لكم واصل من حسابكم"} onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} className="h-7 text-xs" />
                        </td>
                        <td className="p-2 border bg-yellow-100 font-mono font-bold text-amber-900">{Number(receiptForm.amount || 0) * Number(receiptForm.exchange_rate || 1)}</td>
                        <td className="p-2 border text-center font-mono">{receiptForm.exchange_rate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Control Footer Bar matching Image 1 */}
              <div className="mt-3 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded border">
                    <span className="text-slate-500 font-bold text-[11px]">اجمالي السند: </span>
                    <span className="font-mono font-extrabold text-sm text-emerald-700">{fmt(Number(receiptForm.amount || 0))} {receiptForm.currency}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">تاريخ الادخال: {new Date().toLocaleTimeString()}</div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button onClick={() => setReceiptForm({ type: "receipt", party_type: "account", party_id: "", amount: "", currency: "SAR", exchange_rate: "140", date: new Date().toISOString().slice(0, 10), voucher_no: String(vouchers.length + 1), reference_no: String(vouchers.length + 1), received_from: "", payment_against: "", payment_method: "cash", safe_id: "1", notes: "", second_party_currency: "SAR", collector_name: "1" })} size="sm" variant="outline" className="h-8 text-xs font-bold bg-slate-50 hover:bg-slate-100 gap-1">
                    <Plus className="w-3.5 h-3.5" /> جديد
                  </Button>
                  <Button onClick={() => handleSaveReceiptVoucher()} size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> حفظ السند
                  </Button>
                  <Button onClick={() => handlePreviewVoucher("receipt")} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-indigo-200 text-indigo-700">
                    <Printer className="w-3.5 h-3.5" /> طباعة
                  </Button>
                  <Button onClick={() => { setVoucherSearchType("receipt"); setShowVoucherSearchDlg(true); }} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                    <Search className="w-3.5 h-3.5" /> بحث
                  </Button>
                  <Button onClick={() => handleNavigateVoucher('prev', 'receipt')} size="sm" variant="ghost" className="h-8 px-2 font-bold text-xs">‹ السابق</Button>
                  <Button onClick={() => handleNavigateVoucher('next', 'receipt')} size="sm" variant="ghost" className="h-8 px-2 font-bold text-xs">التالي ›</Button>
                </div>
              </div>

              {/* Saved Receipt Vouchers List with Delete & Preview */}
              <div className="mt-4 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">سجل سندات القبض المحفوظة مسبقاً</h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-right text-xs border border-slate-200">
                    <thead className="bg-slate-100 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border">رقم السند</th>
                        <th className="p-2 border">التاريخ</th>
                        <th className="p-2 border">الطرف / الحساب</th>
                        <th className="p-2 border">المبلغ</th>
                        <th className="p-2 border">البيان</th>
                        <th className="p-2 border text-center">الإجراءات (استعراض / حذف)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(vouchers || []).filter((v: any) => v.type === "receipt").map((v: any) => (
                        <tr key={v.id} className="border-b hover:bg-slate-50">
                          <td className="p-2 border font-mono font-bold text-emerald-700">{v.voucher_number}</td>
                          <td className="p-2 border font-mono">{v.created_at ? v.created_at.slice(0, 10) : "—"}</td>
                          <td className="p-2 border font-bold">{v.party_name || v.received_from || "—"}</td>
                          <td className="p-2 border font-mono font-black text-emerald-600">{fmt(v.amount)} {v.currency}</td>
                          <td className="p-2 border">{v.payment_against || v.notes || "—"}</td>
                          <td className="p-2 border text-center flex items-center justify-center gap-1.5">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handlePreviewVoucherSpecific(v)} 
                              className="h-7 px-2 text-[11px] font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                            >
                              <Printer className="w-3 h-3" /> استعراض
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف سند القبض رقم ${v.voucher_number}؟`)) {
                                  deleteVoucherMutation.mutate(v.id);
                                }
                              }} 
                              className="h-7 px-2 text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> حذف
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(vouchers || []).filter((v: any) => v.type === "receipt").length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد سندات قبض محفوظة حالياً</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: PAYMENT VOUCHER SCREEN (شاشة سندات الصرف - صورة 2) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="payment_vouchers" className="space-y-4 m-0">
            <Card className="bg-[#f5eeda] dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-4 text-xs">
              {/* Header Badge & Navigation */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm mb-3">
                <div className="flex items-center gap-3">
                  <span className="bg-rose-600 text-white px-5 py-1.5 rounded-md font-black text-sm shadow">سند صرف</span>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">التاريخ:</span>
                    <Input 
                      type="date" 
                      value={paymentForm.date} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} 
                      className="h-7 w-32 text-xs border-0 bg-transparent p-0 font-bold" 
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">رقم السند:</span>
                    <Input 
                      value={paymentForm.voucher_no} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, voucher_no: e.target.value })} 
                      className="h-7 w-20 text-xs border-0 bg-transparent p-0 font-bold text-center font-mono text-rose-700" 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded border">
                    <span className="text-slate-500 font-bold">رقم المرجع:</span>
                    <Input 
                      value={paymentForm.reference_no} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} 
                      className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-bold font-mono" 
                    />
                  </div>
                  <Badge variant="outline" className="bg-rose-100 text-rose-900 border-rose-300 font-bold px-3 py-1">سند صرف معتمد</Badge>
                </div>
              </div>

              {/* Grid Form Fields matching Image 2 */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">رقم الحركة:</div>
                  <div className="col-span-4">
                    <Input value={paymentForm.voucher_no || "2"} onChange={(e) => setPaymentForm({ ...paymentForm, voucher_no: e.target.value })} className="h-8 text-xs font-mono font-bold" />
                  </div>
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">اسم الصندوق:</div>
                  <div className="col-span-4">
                    <Select value={paymentForm.safe_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, safe_id: v })}>
                      <SelectTrigger className="h-8 text-xs font-bold">
                        <SelectValue placeholder="صندوق رئيسي" />
                      </SelectTrigger>
                      <SelectContent>
                        {safes.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                        {safes.length === 0 && <SelectItem value="1">صندوق رئيسي</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">عملة الحساب (F9):</div>
                  <div className="col-span-4 flex items-center gap-1.5">
                    <Select 
                      value={paymentForm.currency} 
                      onValueChange={(val) => {
                        const rates: Record<string, string> = { YER: "1", SAR: "140", USD: "530" };
                        setPaymentForm({ ...paymentForm, currency: val, exchange_rate: rates[val] || "1" });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-bold border-amber-300 bg-amber-50 text-amber-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                        <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                        <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cyclePaymentCurrency}
                      title="اضغط Shift+F9 لتغيير العملة"
                      className="h-8 px-2 text-[11px] font-black bg-amber-100 text-amber-900 border-amber-300 shrink-0"
                    >
                      Shift+F9
                    </Button>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-slate-400 text-[10px]">س.ص</span>
                      <Input className="h-8 w-14 text-xs font-mono font-bold text-center" value={paymentForm.exchange_rate} onChange={(e) => setPaymentForm({ ...paymentForm, exchange_rate: e.target.value })} />
                    </div>
                  </div>

                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ رقماً:</div>
                  <div className="col-span-4">
                    <Input 
                      value={paymentForm.amount} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                      className="h-8 text-xs font-black font-mono bg-pink-100 text-rose-800 border-pink-300 dark:bg-pink-950 dark:text-pink-200" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">اسم المستلم (F9):</div>
                  <div className="col-span-4 flex items-center gap-1">
                    <Input 
                      value={paymentForm.received_from} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, received_from: e.target.value })} 
                      className="h-8 text-xs font-bold text-purple-900 bg-purple-50/50 border-purple-300" 
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setF9Target("payment"); setShowF9ChartDlg(true); }}
                      className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 text-[10px] gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      F9 الدليل
                    </Button>
                  </div>

                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">رقم المستفيد:</div>
                  <div className="col-span-4 flex items-center gap-1">
                    <Input value={paymentForm.party_id || "2"} onChange={(e) => setPaymentForm({ ...paymentForm, party_id: e.target.value })} className="h-8 text-xs font-mono font-bold" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setF9Target("payment"); setShowF9ChartDlg(true); }}
                      className="h-8 px-2 bg-slate-200 text-slate-800 hover:bg-slate-300 shrink-0 text-[10px]"
                    >
                      اختيار
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">البيان/السبب:</div>
                  <div className="col-span-10">
                    <Input 
                      value={paymentForm.payment_against} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_against: e.target.value })} 
                      className="h-8 text-xs font-semibold" 
                    />
                  </div>
                </div>
              </div>

              {/* Subtabs Table matching Image 2 */}
              <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm p-3">
                <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2 mb-3 overflow-x-auto">
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold border-b-2 border-rose-600 text-rose-700 rounded-none">تفاصيل حسابات السند</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">تفاصيل اخرى</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">خاص بالأقساط</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">المرفقات</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">خيارات السند</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-500 rounded-none">ملاحظات مالية</Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-700">
                    <thead className="bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200">
                      <tr>
                        <th className="p-2 border w-12 text-center">#</th>
                        <th className="p-2 border w-28">المبلغ</th>
                        <th className="p-2 border">اسم الحساب (دليل الحسابات - F9)</th>
                        <th className="p-2 border w-24">العملة</th>
                        <th className="p-2 border">البيان</th>
                        <th className="p-2 border w-28">مبلغ القيد</th>
                        <th className="p-2 border w-16 text-center">س.ص</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 border text-center font-bold">1</td>
                        <td className="p-2 border">
                          <Input value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="h-7 text-xs font-bold font-mono" />
                        </td>
                        <td className="p-2 border">
                          <div className="flex items-center gap-1">
                            <Input value={paymentForm.received_from} onChange={(e) => setPaymentForm({ ...paymentForm, received_from: e.target.value })} className="h-7 text-xs font-bold text-purple-900" />
                            <Button size="sm" onClick={() => { setF9Target("payment"); setShowF9ChartDlg(true); }} className="h-7 px-1.5 text-[10px] bg-emerald-600 text-white font-bold shrink-0">F9</Button>
                          </div>
                        </td>
                        <td className="p-2 border font-mono">{paymentForm.currency}</td>
                        <td className="p-2 border">
                          <Input value={paymentForm.notes || "عليكم مقابل سداد من الحساب"} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="h-7 text-xs" />
                        </td>
                        <td className="p-2 border bg-yellow-100 font-mono font-bold text-amber-900">{Number(paymentForm.amount || 0) * Number(paymentForm.exchange_rate || 1)}</td>
                        <td className="p-2 border text-center font-mono">{paymentForm.exchange_rate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Control Footer Bar matching Image 2 */}
              <div className="mt-3 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded border">
                    <span className="text-slate-500 font-bold text-[11px]">اجمالي السند: </span>
                    <span className="font-mono font-extrabold text-sm text-rose-700">{fmt(Number(paymentForm.amount || 0))} {paymentForm.currency}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">تاريخ الادخال: {new Date().toLocaleTimeString()}</div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button onClick={() => setPaymentForm({ type: "payment", party_type: "account", party_id: "", amount: "", currency: "YER", exchange_rate: "1", date: new Date().toISOString().slice(0, 10), voucher_no: String(vouchers.length + 1), reference_no: String(vouchers.length + 1), received_from: "", payment_against: "", payment_method: "cash", safe_id: "1", notes: "", second_party_currency: "YER", collector_name: "1" })} size="sm" variant="outline" className="h-8 text-xs font-bold bg-slate-50 hover:bg-slate-100 gap-1">
                    <Plus className="w-3.5 h-3.5" /> جديد
                  </Button>
                  <Button onClick={() => handleSavePaymentVoucher()} size="sm" className="h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> حفظ السند
                  </Button>
                  <Button onClick={() => handlePreviewVoucher("payment")} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-indigo-200 text-indigo-700">
                    <Printer className="w-3.5 h-3.5" /> طباعة
                  </Button>
                  <Button onClick={() => { setVoucherSearchType("payment"); setShowVoucherSearchDlg(true); }} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                    <Search className="w-3.5 h-3.5" /> بحث
                  </Button>
                  <Button onClick={() => handleNavigateVoucher('prev', 'payment')} size="sm" variant="ghost" className="h-8 px-2 font-bold text-xs">‹ السابق</Button>
                  <Button onClick={() => handleNavigateVoucher('next', 'payment')} size="sm" variant="ghost" className="h-8 px-2 font-bold text-xs">التالي ›</Button>
                </div>
              </div>

              {/* Saved Payment Vouchers List with Delete & Preview */}
              <div className="mt-4 bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">سجل سندات الصرف المحفوظة مسبقاً</h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-right text-xs border border-slate-200">
                    <thead className="bg-slate-100 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border">رقم السند</th>
                        <th className="p-2 border">التاريخ</th>
                        <th className="p-2 border">الطرف / الحساب</th>
                        <th className="p-2 border">المبلغ</th>
                        <th className="p-2 border">البيان</th>
                        <th className="p-2 border text-center">الإجراءات (استعراض / حذف)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(vouchers || []).filter((v: any) => v.type === "payment").map((v: any) => (
                        <tr key={v.id} className="border-b hover:bg-slate-50">
                          <td className="p-2 border font-mono font-bold text-rose-700">{v.voucher_number}</td>
                          <td className="p-2 border font-mono">{v.created_at ? v.created_at.slice(0, 10) : "—"}</td>
                          <td className="p-2 border font-bold">{v.party_name || v.received_from || "—"}</td>
                          <td className="p-2 border font-mono font-black text-rose-600">{fmt(v.amount)} {v.currency}</td>
                          <td className="p-2 border">{v.payment_against || v.notes || "—"}</td>
                          <td className="p-2 border text-center flex items-center justify-center gap-1.5">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handlePreviewVoucherSpecific(v)} 
                              className="h-7 px-2 text-[11px] font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1"
                            >
                              <Printer className="w-3 h-3" /> استعراض
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف سند الصرف رقم ${v.voucher_number}؟`)) {
                                  deleteVoucherMutation.mutate(v.id);
                                }
                              }} 
                              className="h-7 px-2 text-[11px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> حذف
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(vouchers || []).filter((v: any) => v.type === "payment").length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد سندات صرف محفوظة حالياً</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}


          <TabsContent value="manual_journal_entry" className="m-0 h-full">
            <JournalEntryScreen accountsList={accountsList} costCentersList={costCenters} />
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 5: SAFES / CASH DRAWERS (إدارة الصناديق) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="safes" className="space-y-6 m-0">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">الصناديق والخزائن المالية</h3>
                <p className="text-xs text-slate-500">إدارة صندوق الفرع الرئيسي، صناديق الكاشير، والعهد النقدية.</p>
              </div>

              <Button
                onClick={() => {
                  setEditingSafe(null);
                  setSafeForm({ name: "", balance: "0", currency: "ريال", notes: "", active: true });
                  setShowSafeDlg(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة صندوق / خزينة جديدة
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {safes.map((safe: any) => (
                <Card key={safe.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      {safe.name}
                    </CardTitle>
                    <Badge className={safe.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                      {safe.active ? "نشط" : "معطل"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">الرصيد الدفتري الحالي</p>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{fmt(safe.balance)} {safe.currency || "ريال"}</p>
                    </div>

                    {safe.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{safe.notes}</p>}

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذه الخزينة؟")) {
                            deleteSafeMutation.mutate(safe.id);
                          }
                        }}
                        className="h-7 text-xs bg-red-100 hover:bg-red-200 text-red-700"
                      >
                        <Trash2 className="w-3 h-3 ml-1" />
                        حذف
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingSafe(safe);
                          setSafeForm({ name: safe.name, balance: String(safe.balance), currency: safe.currency || "ريال", notes: safe.notes || "", active: !!safe.active });
                          setShowSafeDlg(true);
                        }}
                        className="h-7 text-xs"
                      >
                        تعديل البيانات
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 6: BANKS & TRANSFERS (البنوك والتحويلات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="banks" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">إدارة الحسابات البنكية والتحويلات النقدية</h3>
                <p className="text-xs text-slate-500">متابعة الأرصدة البنكية، والتحويل بين الصناديق والبنوك بدون أثر إيراد/مصروف.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowBankDlg(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة حساب بنكي جديد
                </Button>
                <Button
                  onClick={() => setShowTransferDlg(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  تحويل مالي بين الحسابات
                </Button>
              </div>
            </div>

            {/* Bank Accounts Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankAccounts.map((b: any) => (
                <Card key={b.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      {b.bank_name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">{b.account_number}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    <div>
                      <p className="text-xs text-slate-500">الرصيد المتاح بالحساب</p>
                      <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{fmt(b.balance)} {b.currency || "ريال"}</p>
                    </div>
                    {b.iban && <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">IBAN: {b.iban}</p>}
                    {b.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{b.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Transfers Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">سجل عمليات التحويل النقدي والبنكي</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رقم العملية</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المصدر</th>
                      <th className="p-3">الجهة المستلمة</th>
                      <th className="p-3">المبلغ المحول</th>
                      <th className="p-3">ملاحظات</th>
                      <th className="p-3">بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transfers.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600">{t.transfer_number}</td>
                        <td className="p-3 text-slate-600">{t.transfer_date}</td>
                        <td className="p-3 font-semibold text-rose-600 dark:text-rose-400">{t.from_name}</td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">{t.to_name}</td>
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">{fmt(t.amount)} ريال</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">{t.notes || "—"}</td>
                        <td className="p-3 text-slate-500">{t.created_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 7: ACCOUNT STATEMENTS (واجهة كشوفات الحسابات - مطابق للصورة 3) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="statements" className="space-y-4 m-0">
            {/* Image 3 Control Header Box */}
            <Card className="bg-[#f1f5f9] dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3.5 text-xs">
              {/* Row 1 Filter Controls */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm">
                <div className="col-span-12 md:col-span-3">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">اسم الحساب (الدليل - F9):</label>
                  <div className="flex items-center gap-1">
                    <SearchableSelect
                      options={allAccountsAndParties}
                      value={statementPartyType === 'account' ? `acc_${selectedPartyId}` : statementPartyType === 'customer' ? `cust_${selectedPartyId}` : statementPartyType === 'supplier' ? `supp_${selectedPartyId}` : statementPartyType === 'employee' ? `emp_${selectedPartyId}` : statementPartyType === 'transport' ? `transport_${selectedPartyId}` : statementPartyType === 'hotel' ? `hotel_${selectedPartyId}` : selectedPartyId}
                      onChange={(val) => {
                        const parts = String(val).split('_');
                        if (parts.length >= 2) {
                          const type = parts[0];
                          const id = parts.slice(1).join('_');
                          const mappedType = type === 'acc' ? 'account' : type === 'cust' ? 'customer' : type === 'supp' ? 'supplier' : type === 'emp' ? 'employee' : type === 'transport' ? 'transport' : type === 'hotel' ? 'hotel' : 'account';
                          setSelectedPartyId(id);
                          setStatementPartyType(mappedType);
                        } else {
                          setSelectedPartyId(val);
                        }
                      }}
                      placeholder="ابحث واختر الحساب، العميل، المورد..."
                      searchPlaceholder="ابحث بالاسم أو الرقم..."
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setF9Target("statement"); setShowF9ChartDlg(true); }}
                      className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 text-[10px] gap-1"
                      title="اضغط F9 لفتح دليل الحسابات"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      F9
                    </Button>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">عملة الحساب:</label>
                  <Select value={statementCurrency} onValueChange={(v) => setStatementCurrency(v)}>
                    <SelectTrigger className="h-8 text-xs font-bold border-slate-300 bg-slate-50">
                      <SelectValue placeholder="ريال يمني" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل (جميع العملات)</SelectItem>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <input 
                      type="checkbox" 
                      id="stmtToAccountChk" 
                      checked={stmtToAccountChecked} 
                      onChange={(e) => setStmtToAccountChecked(e.target.checked)} 
                      className="rounded text-indigo-600"
                    />
                    <label htmlFor="stmtToAccountChk" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">الى حساب:</label>
                  </div>
                  <Input 
                    value={stmtToAccountId} 
                    onChange={(e) => setStmtToAccountId(e.target.value)} 
                    disabled={!stmtToAccountChecked} 
                    placeholder="اختر الحساب المستهدف" 
                    className="h-8 text-xs disabled:opacity-50"
                  />
                </div>

                <div className="col-span-12 md:col-span-3 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">من تاريخ:</label>
                    <Input type="date" value={stmtStartDate} onChange={(e) => setStmtStartDate(e.target.value)} className="h-8 text-xs font-mono font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">الى:</label>
                    <Input type="date" value={stmtEndDate} onChange={(e) => setStmtEndDate(e.target.value)} className="h-8 text-xs font-mono font-bold" />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-2">
                  <div className="flex items-center gap-1 mb-1">
                    <input 
                      type="checkbox" 
                      id="stmtValDateChk" 
                      checked={stmtValueDateChecked} 
                      onChange={(e) => setStmtValueDateChecked(e.target.checked)} 
                      className="rounded text-indigo-600"
                    />
                    <label htmlFor="stmtValDateChk" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">تاريخ الحق:</label>
                  </div>
                  <Input 
                    type="date" 
                    value={stmtValueStartDate} 
                    onChange={(e) => setStmtValueStartDate(e.target.value)} 
                    disabled={!stmtValueDateChecked} 
                    className="h-8 text-xs font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Checkboxes Row matching Image 3 */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-200/70 dark:bg-slate-800 p-2.5 rounded-lg my-2 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={stmtOptExcludeClosing} onChange={(e) => setStmtOptExcludeClosing(e.target.checked)} className="rounded" />
                  استبعاد قيود الاقفال
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={stmtOptExcludePrevBalance} onChange={(e) => setStmtOptExcludePrevBalance(e.target.checked)} className="rounded" />
                  استبعاد الرصيد السابق
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={stmtOptExcludeOpening} onChange={(e) => setStmtOptExcludeOpening(e.target.checked)} className="rounded" />
                  استبعاد الافتتاحي
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-indigo-700 dark:text-indigo-300">
                  <input type="checkbox" checked={stmtOptGroupDescription} onChange={(e) => setStmtOptGroupDescription(e.target.checked)} className="rounded" />
                  تجميع البيان حسب الحركة
                </label>
              </div>

              {/* Row 2 Filter Controls matching Image 3 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm">
                <div className="col-span-12 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">اسم الحركة:</label>
                  <Select value={stmtMovementName} onValueChange={setStmtMovementName}>
                    <SelectTrigger className="h-8 text-xs font-bold">
                      <SelectValue placeholder="جميع الحركات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحركات</SelectItem>
                      <SelectItem value="receipt">سندات قبض</SelectItem>
                      <SelectItem value="payment">سندات صرف</SelectItem>
                      <SelectItem value="journal">قيود يومية</SelectItem>
                      <SelectItem value="invoice">فواتير مبيعات/خدمات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">اسم الجهة:</label>
                  <Input value={stmtPartyNameInput} onChange={(e) => setStmtPartyNameInput(e.target.value)} placeholder="اسم الجهة..." className="h-8 text-xs" />
                </div>

                <div className="col-span-12 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">اسم المستفيد:</label>
                  <Input value={stmtBeneficiaryNameInput} onChange={(e) => setStmtBeneficiaryNameInput(e.target.value)} placeholder="اسم المستفيد..." className="h-8 text-xs" />
                </div>

                <div className="col-span-12 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">رقم الفرع:</label>
                  <Select value={stmtBranchNo} onValueChange={setStmtBranchNo}>
                    <SelectTrigger className="h-8 text-xs font-bold">
                      <SelectValue placeholder="1 وكالة اليمني للسفريات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - وكالة اليمني للسفريات</SelectItem>
                      <SelectItem value="2">2 - الفرع الرئيسي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">الفرع/القسم:</label>
                  <Input value={stmtDeptNo} onChange={(e) => setStmtDeptNo(e.target.value)} placeholder="1" className="h-8 text-xs text-center font-mono" />
                </div>

                <div className="col-span-12 md:col-span-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">السنة المالية:</label>
                  <Input value={stmtFiscalYear} onChange={(e) => setStmtFiscalYear(e.target.value)} className="h-8 text-xs text-center font-mono font-bold" />
                </div>

                <div className="col-span-12 md:col-span-2 flex items-center gap-1.5 pt-4">
                  <Button
                    onClick={() => {
                      refetchStatement();
                      refetchVouchers();
                      refetchAccounts();
                      toast({ title: "جاري استعراض كشف الحساب وتحديث الحركة المالية..." });
                    }}
                    className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs gap-1.5 shadow"
                  >
                    <Eye className="w-4 h-4" />
                    مشاهدة / استعراض
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 px-2 font-bold">‹</Button>
                  <Button variant="outline" size="sm" className="h-9 px-2 font-bold">›</Button>
                </div>
              </div>
            </Card>

            {/* Subtabs Above Statement Grid matching Image 3 */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border shadow-sm p-3 space-y-3">
              <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2 overflow-x-auto">
                <Button 
                  onClick={() => setStmtGridTab("detailed")} 
                  size="sm" 
                  variant="ghost" 
                  className={`h-8 text-xs font-bold rounded-none ${stmtGridTab === "detailed" ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400" : "text-slate-500"}`}
                >
                  كشف تفصيلي
                </Button>
                <Button 
                  onClick={() => setStmtGridTab("summary")} 
                  size="sm" 
                  variant="ghost" 
                  className={`h-8 text-xs font-bold rounded-none ${stmtGridTab === "summary" ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400" : "text-slate-500"}`}
                >
                  كشف اجمالي
                </Button>
                <Button 
                  onClick={() => setStmtGridTab("notes")} 
                  size="sm" 
                  variant="ghost" 
                  className={`h-8 text-xs font-bold rounded-none ${stmtGridTab === "notes" ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400" : "text-slate-500"}`}
                >
                  ملاحظات الحساب
                </Button>
                <Button 
                  onClick={() => setStmtGridTab("extra")} 
                  size="sm" 
                  variant="ghost" 
                  className={`h-8 text-xs font-bold rounded-none ${stmtGridTab === "extra" ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-400" : "text-slate-500"}`}
                >
                  خيارات اضافية
                </Button>
              </div>

              {/* Statement Table Grid (Exact Columns as Image 3) */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                {stmtGridTab === "detailed" && (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-600">
                    <tr>
                      <th className="p-2.5 border text-emerald-700 dark:text-emerald-400 font-black w-28">مدين</th>
                      <th className="p-2.5 border text-rose-700 dark:text-rose-400 font-black w-28">دائن</th>
                      <th className="p-2.5 border text-indigo-700 dark:text-indigo-400 font-black w-28">الرصيد</th>
                      <th className="p-2.5 border w-24">التاريخ</th>
                      <th className="p-2.5 border w-20 text-center">المرجع</th>
                      <th className="p-2.5 border">المستفيد</th>
                      <th className="p-2.5 border">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statementData?.transactions && statementData.transactions.length > 0 ? (
                      statementData.transactions.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 border font-bold text-emerald-600 font-mono">{t.debit > 0 ? fmt(t.debit) : "0"}</td>
                          <td className="p-2.5 border font-bold text-rose-600 font-mono">{t.credit > 0 ? fmt(t.credit) : "0"}</td>
                          <td className="p-2.5 border font-extrabold text-indigo-700 font-mono">{fmt(t.running_balance)}</td>
                          <td className="p-2.5 border font-mono text-slate-600">{t.date}</td>
                          <td className="p-2.5 border text-center font-mono font-bold">{t.reference_id || t.voucher_number || idx + 1}</td>
                          <td className="p-2.5 border font-semibold">{t.party_name || statementData.party?.name || "—"}</td>
                          <td className="p-2.5 border text-slate-800 dark:text-slate-200">{t.description}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2.5 border text-slate-800 text-center py-8" colSpan={7}>
                          {loadingStatement ? "جاري تحميل البيانات..." : "لا توجد حركات لعرضها في هذا الكشف"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                )}
                {stmtGridTab === "summary" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">كشف إجمالي للحساب</h3>
                    <div className="flex justify-center gap-6 text-sm font-mono">
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 px-6 py-3 rounded-lg text-emerald-800 dark:text-emerald-200">
                        <div className="mb-1 font-sans font-bold">إجمالي المدين</div>
                        <div className="text-xl font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.debit || 0), 0) || 0)} {statementCurrency}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 px-6 py-3 rounded-lg text-rose-800 dark:text-rose-200">
                        <div className="mb-1 font-sans font-bold">إجمالي الدائن</div>
                        <div className="text-xl font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.credit || 0), 0) || 0)} {statementCurrency}</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 px-6 py-3 rounded-lg text-indigo-900 dark:text-indigo-200">
                        <div className="mb-1 font-sans font-bold">الرصيد الحالي</div>
                        <div className="text-xl font-black">{fmt(statementData?.currentBalance || 0)} {statementCurrency}</div>
                      </div>
                    </div>
                  </div>
                )}
                {stmtGridTab === "notes" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">ملاحظات الحساب</h3>
                    <p className="max-w-2xl mx-auto p-4 bg-slate-50 dark:bg-slate-800 rounded border">
                      {statementData?.party?.notes || statementData?.party?.address || "لا توجد ملاحظات مسجلة لهذا الحساب."}
                    </p>
                  </div>
                )}
                {stmtGridTab === "extra" && (
                  <div className="p-8 text-center text-slate-700 dark:text-slate-300">
                    <h3 className="text-xl font-bold mb-4">خيارات إضافية</h3>
                    <p className="text-slate-500">لا توجد خيارات إضافية متاحة حالياً.</p>
                  </div>
                )}
              </div>

              {/* Bottom Control Bar matching Image 3 */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-wrap">
                  {statementCurrency !== "all" ? (
                    <>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 px-3 py-1.5 rounded font-mono font-bold text-xs text-emerald-800 dark:text-emerald-200">
                        إجمالي مدين: <span className="font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.debit || 0), 0) || 0)} {statementCurrency}</span>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 px-3 py-1.5 rounded font-mono font-bold text-xs text-rose-800 dark:text-rose-200">
                        إجمالي دائن: <span className="font-extrabold">{fmt(statementData?.transactions?.reduce((sum: number, t: any) => sum + (t.credit || 0), 0) || 0)} {statementCurrency}</span>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 px-3 py-1.5 rounded font-mono font-bold text-xs text-indigo-900 dark:text-indigo-200">
                        صافي الرصيد: <span className="font-black text-sm">{fmt(statementData?.currentBalance || 0)} {statementCurrency}</span>
                      </div>
                    </>
                  ) : (
                    Object.entries(statementData?.currencySummaries || {}).map(([cur, summary]: [string, any]) => {
                      if (summary.totalDebit === 0 && summary.totalCredit === 0) return null;
                      return (
                        <div key={cur} className="flex items-center gap-2 border rounded px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-800/60 font-mono">
                          <span className="text-slate-600 dark:text-slate-300 font-extrabold">{cur}:</span>
                          <span className="text-emerald-600 font-bold">+{fmt(summary.totalDebit)}</span>
                          <span className="text-rose-600 font-bold">-{fmt(summary.totalCredit)}</span>
                          <span className="text-indigo-600 font-black">={fmt(summary.balance)}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button onClick={handleExportStatementPdf} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-rose-300 text-rose-800">
                    <FileDown className="w-3.5 h-3.5" /> تصدير
                  </Button>
                  <Button onClick={() => { setSelectedPartyId(""); toast({ title: "تم فتح كشف حساب جديد" }); }} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                    <Plus className="w-3.5 h-3.5" /> كشف جديد
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1">
                    خيارات
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-emerald-300 text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5" /> مصادقة
                  </Button>
                  <Button onClick={handlePrintStatement} size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 border-indigo-300 text-indigo-800">
                    <Printer className="w-3.5 h-3.5" /> طباعة نموذج
                  </Button>
                  <Button onClick={() => setShowStatementPrintModal(true)} size="sm" className="h-8 text-xs font-bold bg-slate-900 text-white gap-1 shadow">
                    <Printer className="w-3.5 h-3.5" /> طباعة
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 8: FIXED ASSETS & DEPRECIATION (الأصول والإهلاك) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="assets" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">سجل الأصول الثابتة والإهلاك الدوري</h3>
                <p className="text-xs text-slate-500">متابعة قيم الأصول، الإهلاك التراكمي، القيمة الدفترية المتبقية والاحتساب الآلي.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => runDepreciationMutation.mutate()}
                  disabled={runDepreciationMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  تشغيل واحتساب الإهلاك الدوري للأصول
                </Button>

                <Button
                  onClick={() => setShowAssetDlg(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة أصل ثابت جديد
                </Button>
              </div>
            </div>

            {/* Assets Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رمز الأصل</th>
                      <th className="p-3">اسم الأصل الثابت</th>
                      <th className="p-3">الفئة</th>
                      <th className="p-3">تاريخ الشراء</th>
                      <th className="p-3">تكلفة الشراء</th>
                      <th className="p-3">مجمع الإهلاك</th>
                      <th className="p-3">القيمة الدفترية المتبقية</th>
                      <th className="p-3">الموقع / المسئول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fixedAssets.map((asset: any) => (
                      <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600">{asset.asset_code}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{asset.name}</td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px]">{asset.category}</Badge></td>
                        <td className="p-3 text-slate-600">{asset.purchase_date}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{fmt(asset.purchase_cost)} ريال</td>
                        <td className="p-3 font-bold text-rose-600">{fmt(asset.accumulated_depreciation)} ريال</td>
                        <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(asset.net_book_value)} ريال</td>
                        <td className="p-3 text-slate-500">{asset.location} ({asset.responsible_person})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 9: RECURRING EXPENSES (المصروفات المتكررة) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="recurring" className="space-y-6 m-0">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">جدول المصروفات والالتزامات المتكررة</h3>
                <p className="text-xs text-slate-500">إدارة الإيجارات والاشتراكات الدورية وتوليد القيد المالي وسند الصرف تلقائياً.</p>
              </div>

              <Button
                onClick={() => setShowRecurringDlg(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة مصروف متكرر جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurringExpenses.map((rec: any) => (
                <Card key={rec.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      {rec.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {rec.frequency === "monthly" ? "شهري" : rec.frequency === "quarterly" ? "ربع سنوي" : "سنوي"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-500">المبلغ المستحق</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{fmt(rec.amount)} ريال</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-500">تاريخ الاستحقاق القادم</p>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{rec.next_due_date}</p>
                      </div>
                    </div>

                    {rec.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{rec.notes}</p>}

                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => generateRecurringMutation.mutate(rec.id)}
                        disabled={generateRecurringMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        توليد وتأكيد السداد الآن
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: OPENING BALANCES (شاشة الأرصدة الافتتاحية) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="opening_balances" className="space-y-6 m-0">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-indigo-600" />
                      إدخال وتثبيت الأرصدة الافتتاحية للنظام
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      هنا يمكنك إدخال الأرصدة التأسيسية التمهيدية لكافة الحسابات. يرجى إدخال مبالغ المدين والدائن بدقة.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("هل أنت متأكد من تصفير كافة المدخلات الحالية؟")) {
                          const reset: any = {};
                          accountsList.forEach((acc: any) => {
                            reset[acc.code] = { debit: 0, credit: 0 };
                          });
                          setOpeningBalances(reset);
                        }
                      }}
                      className="text-xs gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      تصفير المدخلات
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveOpeningBalances}
                      disabled={isSavingOpening}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 font-bold"
                    >
                      {isSavingOpening ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      حفظ وترحيل الأرصدة الافتتاحية
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="البحث برمز الحساب أو الاسم..."
                      value={openingSearch}
                      onChange={(e) => setOpeningSearch(e.target.value)}
                      className="pr-9 text-xs"
                    />
                  </div>
                  <Select value={openingTypeFilter} onValueChange={setOpeningTypeFilter}>
                    <SelectTrigger className="w-full sm:w-48 text-xs">
                      <SelectValue placeholder="تصفية حسب النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأنواع</SelectItem>
                      <SelectItem value="asset">الأصول</SelectItem>
                      <SelectItem value="liability">الخصوم والالتزامات</SelectItem>
                      <SelectItem value="equity">حقوق الملكية</SelectItem>
                      <SelectItem value="revenue">الإيرادات</SelectItem>
                      <SelectItem value="expense">المصروفات</SelectItem>
                      <SelectItem value="cogs">تكلفة المبيعات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Balance Summary Box */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 block">إجمالي الأرصدة المدينة</span>
                    <span className="text-lg font-bold text-emerald-600 mt-1 block">{fmt(totalOpeningDebit)} YER</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 block">إجمالي الأرصدة الدائنة</span>
                    <span className="text-lg font-bold text-rose-600 mt-1 block">{fmt(totalOpeningCredit)} YER</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-sm flex flex-col justify-center">
                    <span className="text-xs font-semibold text-slate-500 block">الفارق المتبقي ليتزن القيد</span>
                    <span className={`text-lg font-bold mt-1 block ${Math.abs(openingDiff) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>
                      {fmt(openingDiff)} YER
                    </span>
                  </div>
                </div>

                {/* Balance Notification Banner */}
                {Math.abs(openingDiff) < 0.01 ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded-lg text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>ميزان الأرصدة الافتتاحية متزن تماماً بنسبة 100% (إجمالي المدين يساوي إجمالي الدائن).</span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-lg text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold">تنبيه الموازنة الآلية للقيود الدفترية:</p>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                        الفارق الحالي قدره <span className="font-bold">{fmt(Math.abs(openingDiff))} YER</span>. 
                        لحماية القيد المزدوج، سيقوم النظام تلقائياً بإنشاء تسوية توازن مسجلة ومرحلة مباشرة إلى 
                        <span className="font-bold"> حساب رأس المال المعتمد للوكالة (31000)</span> عند حفظ الأرصدة لتسهيل بدء الاستخدام فوراً.
                      </p>
                    </div>
                  </div>
                )}

                {/* Accounts Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 text-xs">
                        <th className="p-3">رمز الحساب</th>
                        <th className="p-3">اسم الحساب في الدليل</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3 w-1/4">رصيد افتتاحي مدين (Debit)</th>
                        <th className="p-3 w-1/4">رصيد افتتاحي دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredAccountsForOpening.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            لا توجد حسابات مطابقة للبحث أو الفلتر المختار.
                          </td>
                        </tr>
                      ) : (
                        filteredAccountsForOpening.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{acc.code}</td>
                            <td className="p-3 text-slate-900 dark:text-white font-medium">{acc.name}</td>
                            <td className="p-3 text-slate-500">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                {acc.type === "asset" && "أصول"}
                                {acc.type === "liability" && "خصوم"}
                                {acc.type === "equity" && "حقوق ملكية"}
                                {acc.type === "revenue" && "إيرادات"}
                                {acc.type === "expense" && "مصروفات"}
                                {acc.type === "cogs" && "تكلفة مبيعات"}
                                {acc.type === "wastage" && "تالف وفاقد"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={openingBalances[acc.code]?.debit || ""}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    setOpeningBalances({
                                      ...openingBalances,
                                      [acc.code]: {
                                        debit: val,
                                        credit: 0
                                      }
                                    });
                                  }}
                                  className="h-8 text-xs font-bold font-mono pl-3"
                                />
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={openingBalances[acc.code]?.credit || ""}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    setOpeningBalances({
                                      ...openingBalances,
                                      [acc.code]: {
                                        debit: 0,
                                        credit: val
                                      }
                                    });
                                  }}
                                  className="h-8 text-xs font-bold font-mono pl-3"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    onClick={handleSaveOpeningBalances}
                    disabled={isSavingOpening}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 px-6"
                  >
                    {isSavingOpening ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    تأكيد وحفظ الأرصدة الافتتاحية الآن
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 10: FINANCIAL STATEMENTS (قائمة الدخل والأرباح والخسائر - مطابقة للصورة) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="financials" className="space-y-4 m-0">
            {/* Top ERP Report Header Filter Bar */}
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-center">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">من تاريخ:</span>
                  <Input type="date" value={reportOpts.fromDate} onChange={(e) => setReportOpts({ ...reportOpts, fromDate: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">الى تاريخ:</span>
                  <Input type="date" value={reportOpts.toDate} onChange={(e) => setReportOpts({ ...reportOpts, toDate: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">السنة المالية:</span>
                  <Input value={reportOpts.fiscalYear} onChange={(e) => setReportOpts({ ...reportOpts, fiscalYear: e.target.value })} className="h-6 w-16 text-[11px] border-0 bg-transparent p-0 text-center font-bold" />
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={reportOpts.excludeClosing} onChange={(e) => setReportOpts({ ...reportOpts, excludeClosing: e.target.checked })} className="rounded" />
                    استبعاد قيود الاقفال
                  </label>
                </div>
                <div className="col-span-2 flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold whitespace-nowrap">الوصف:</span>
                  <Input value={reportOpts.description} onChange={(e) => setReportOpts({ ...reportOpts, description: e.target.value })} placeholder="بحث بالوصف..." className="h-6 text-[11px] border-0 bg-transparent p-0" />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="text-slate-500 font-bold">رقم الفرع:</span>
                  <Input value={reportOpts.branchId} onChange={(e) => setReportOpts({ ...reportOpts, branchId: e.target.value })} className="h-6 w-8 text-center font-bold border-0 bg-transparent p-0" />
                  <span className="text-indigo-600 font-bold truncate text-[11px]">{reportOpts.branchName}</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border justify-center">
                  <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={reportOpts.department} onChange={(e) => setReportOpts({ ...reportOpts, department: e.target.checked })} className="rounded" />
                    رقم القسم
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">طريقة العرض:</span>
                  <Select value={reportOpts.displayMethod} onValueChange={(v) => setReportOpts({ ...reportOpts, displayMethod: v })}>
                    <SelectTrigger className="h-7 text-xs bg-emerald-50 dark:bg-emerald-950 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="by_code">حسب رقم الحساب</SelectItem>
                      <SelectItem value="by_name">حسب اسم الحساب</SelectItem>
                      <SelectItem value="by_movement">حسب الحركة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border">
                  <span className="font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">نوع العرض:</span>
                  <Select value={reportOpts.currencyType} onValueChange={(v) => setReportOpts({ ...reportOpts, currencyType: v })}>
                    <SelectTrigger className="h-7 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">بالعملة المحلية (ريال)</SelectItem>
                      <SelectItem value="foreign">بالعملة الاجنبية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* View Granularity & Radio Options */}
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded border space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-700 dark:text-emerald-300">
                      <input type="checkbox" checked={reportOpts.byLevel} onChange={(e) => setReportOpts({ ...reportOpts, byLevel: e.target.checked })} className="rounded" />
                      بحسب المستوى:
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map(lvl => (
                        <Button
                          key={lvl}
                          size="sm"
                          type="button"
                          variant={reportOpts.selectedLevel === lvl ? "default" : "outline"}
                          className={`h-6 px-2 text-[10px] font-bold ${reportOpts.selectedLevel === lvl ? 'bg-emerald-600 text-white' : ''}`}
                          onClick={() => setReportOpts({ ...reportOpts, byLevel: true, selectedLevel: lvl })}
                        >
                          مستوى {lvl}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        type="button"
                        variant={!reportOpts.selectedLevel || reportOpts.selectedLevel === 0 ? "default" : "outline"}
                        className="h-6 px-2 text-[10px] font-bold"
                        onClick={() => setReportOpts({ ...reportOpts, selectedLevel: 0 })}
                      >
                        جميع المستويات
                      </Button>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold text-[11px] px-3 py-1">مشاهدة / استعراض الأرباح</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                  {[
                    { id: "movement", label: "حسب الحساب الحركي" },
                    { id: "account_type", label: "حسب نوع الحساب" },
                    { id: "movement_name", label: "حسب اسم الحركة" },
                    { id: "beneficiary", label: "حسب اسم المستفيد" },
                    { id: "tax_name", label: "حسب الاسم الضريبي" },
                    { id: "analytical", label: "الحساب تحليلي" },
                    { id: "party", label: "حسب الجهة" },
                    { id: "main_account", label: "حسب الحساب الرئيسي" },
                    { id: "category", label: "حسب تصنيف الحساب" },
                    { id: "cost_center", label: "حسب مراكز التكلفة" },
                    { id: "center_account", label: "حسب المركز والحساب" },
                    { id: "group", label: "حسب مجموعة الحساب" },
                    { id: "analytical_only", label: "تحليلي فقط" },
                    { id: "account_party", label: "الحساب والجهة" },
                  ].map((opt) => (
                    <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-600">
                      <input
                        type="radio"
                        name="pandlViewMode"
                        checked={reportOpts.viewGranularity === opt.id}
                        onChange={() => setReportOpts({ ...reportOpts, viewGranularity: opt.id })}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Income Statement (P&L) */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    قائمة الدخل - الأرباح والخسائر (Income Statement / P&L)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 text-[10px] gap-1">
                    <Printer className="w-3 h-3" />
                    طباعة التقرير
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  <div className="flex justify-between items-center py-2 border-b font-bold text-slate-900 dark:text-white">
                    <span>إجمالي الإيرادات والمبيعات (+)</span>
                    <span className="text-emerald-600">{fmt(incomeStatement?.totalRevenues)} ريال</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b font-bold text-slate-900 dark:text-white">
                    <span>خصم: تكلفة البضاعة المباعة COGS (-)</span>
                    <span className="text-rose-600">{fmt(incomeStatement?.cogsTotal)} ريال</span>
                  </div>

                  <div className="flex justify-between items-center py-2 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded font-extrabold text-emerald-900 dark:text-emerald-200">
                    <span>مجمل الربح (Gross Profit)</span>
                    <span>{fmt(incomeStatement?.grossProfit)} ريال</span>
                  </div>

                  <div className="space-y-1 pt-2">
                    <p className="font-bold text-slate-700 dark:text-slate-300">خصم: المصروفات التشغيلية والتنفيذية (-)</p>
                    {incomeStatement?.expensesList?.map((e: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400 pl-4 py-1 border-b border-slate-50 text-[11px]">
                        <span>• {e.category}</span>
                        <span>{fmt(e.total)} ريال</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-rose-600 pt-2">
                      <span>إجمالي المصروفات التشغيلية</span>
                      <span>{fmt(incomeStatement?.totalExpenses)} ريال</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 bg-indigo-900 text-white p-3 rounded-xl font-black text-sm shadow-md">
                    <span>صافي الربح النهائي (Net Profit)</span>
                    <span className="text-emerald-400">{fmt(incomeStatement?.netProfit)} ريال</span>
                  </div>
                </CardContent>
              </Card>

              {/* Balance Sheet */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      الميزانية العمومية (Balance Sheet)
                    </CardTitle>
                    <Badge className={balanceSheet?.isBalanced ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                      {balanceSheet?.isBalanced ? "الميزانية متزنة" : "غير متزنة"}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 text-[10px] gap-1">
                    <Printer className="w-3 h-3" />
                    طباعة التقرير
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold text-indigo-600 dark:text-indigo-400 mb-2 border-b pb-1">أولاً: الأصول (Assets)</h4>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• النقدية بالصناديق والخزائن</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.cashInSafes)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• النقدية بالحسابات البنكية</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.cashInBanks)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الذمم المدينة (العملاء)</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.receivables)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• تقييم المخزون المتاح</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.inventoryValuation)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• صافي الأصول الثابتة</span>
                        <span className="font-bold">{fmt(balanceSheet?.fixedAssets?.netFixedAssets)} ريال</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-extrabold text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded mt-2">
                      <span>إجمالي الأصول</span>
                      <span>{fmt(balanceSheet?.totalAssets)} ريال</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-2 border-b pb-1">ثانياً: الالتزامات وحقوق الملكية</h4>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الذمم الدائنة (الموردين)</span>
                        <span className="font-bold">{fmt(balanceSheet?.liabilities?.payables)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• رأس المال المعتمد</span>
                        <span className="font-bold">{fmt(balanceSheet?.equity?.capital)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الأرباح المبقاة والاحتياطيات</span>
                        <span className="font-bold">{fmt(balanceSheet?.equity?.retainedEarnings)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• صافي أرباح الفترة الحالية</span>
                        <span className="font-bold text-emerald-600">{fmt(balanceSheet?.equity?.netIncome)} ريال</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-extrabold text-purple-900 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded mt-2">
                      <span>إجمالي الالتزامات وحقوق الملكية</span>
                      <span>{fmt(balanceSheet?.totalLiabilitiesAndEquity)} ريال</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom ERP Action Toolbar matching Image */}
            <div className="bg-slate-200 dark:bg-slate-800 p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="destructive" size="sm" onClick={() => handleTabChange("dashboard")} className="text-xs h-8">خروج</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "تم تصدير تقرير الأرباح والخسائر إلى Excel بنجاح" })} className="text-xs h-8 gap-1"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> تصدير</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "تمت مصادقة قائمة الدخل والأرباح بنجاح ✅" })} className="text-xs h-8 gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> مصادقة</Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Switch to English UI" })} className="text-xs h-8 font-mono">EN</Button>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "معلومات السجل والنظام المحاسبي" })} className="h-8 w-8 p-0"><Info className="w-4 h-4 text-slate-500" /></Button>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={reportOpts.expandAll} onChange={(e) => setReportOpts({ ...reportOpts, expandAll: e.target.checked })} className="rounded" />
                  توسيع
                </label>
                <Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري طباعة الأرصدة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة الأرصدة</Button>
                <Button variant="outline" size="sm" onClick={() => { toast({ title: "جاري الطباعة المخصصة..." }); setTimeout(() => window.print(), 500); }} className="text-xs h-8">طباعة مخصصة</Button>
                <Button size="sm" onClick={() => handlePrintFinancial('pl')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-6 gap-1 font-bold shadow"><Printer className="w-3.5 h-3.5" /> طباعة ميزانية / أرباح</Button>
              </div>
            </div>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: COST CENTERS (مراكز التكلفة للفروع والخدمات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="cost_centers" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  مراكز التكلفة للفروع والخدمات (Cost Centers)
                </h3>
                <p className="text-xs text-slate-500 mt-1">إدارة وتوزيع مراكز التكلفة على الفروع والخدمات السياحية (حجوزات، طيران، تأشيرات) ومتابعة المصروفات والإيرادات لكل مركز.</p>
              </div>
              <Button onClick={() => setShowCostCenterDlg(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 font-bold shadow">
                <Plus className="w-4 h-4" />
                إضافة مركز تكلفة جديد
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>قائمة مراكز التكلفة المعتمدة ({Array.isArray(costCenters) ? costCenters.length : 0})</span>
                <Button variant="outline" size="sm" onClick={() => {
                  const html = `
                    <div style="font-family: Tajawal, Arial; direction: rtl; padding: 20px;">
                      <h2 style="text-align: center; color: #1e3a8a;">تقرير مراكز التكلفة للفروع والخدمات</h2>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                        <thead>
                          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">الرمز</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">اسم مركز التكلفة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">تاريخ الإنشاء</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${(costCenters || []).map((c: any) => `
                            <tr>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${c.code}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1;">${c.name}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1;">${c.notes || '-'}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${c.created_at || '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `;
                  setReportHtml(html);
                  setReportTitle("تقرير مراكز التكلفة للفروع والخدمات");
                  setReportModalOpen(true);
                }} className="text-xs h-7 gap-1">
                  <Printer className="w-3.5 h-3.5" />
                  استعراض وطباعة التقرير (شاشة كاملة)
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                    <tr>
                      <th className="p-3">رمز المركز</th>
                      <th className="p-3">اسم مركز التكلفة (فرع / خدمة)</th>
                      <th className="p-3">ملاحظات وصفية</th>
                      <th className="p-3">تاريخ التسجيل</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {Array.isArray(costCenters) && costCenters.length > 0 ? (
                      costCenters.map((cc: any) => (
                        <tr key={cc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono font-bold text-indigo-600">{cc.code}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{cc.name}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{cc.notes || 'مركز تكلفة معتمد'}</td>
                          <td className="p-3 text-slate-500 font-mono">{cc.created_at || '2026-01-01'}</td>
                          <td className="p-3 text-center space-x-2 space-x-reverse">
                            <Button variant="outline" size="sm" onClick={() => {
                              const html = `
                                <div style="font-family: Tajawal; direction: rtl; padding: 20px;">
                                  <h3>كشف حساب مركز التكلفة: ${cc.name} (${cc.code})</h3>
                                  <p>الحالة: نشط ومعتمد للعمليات المحاسبية والفروع والخدمات.</p>
                                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
                                    <tr style="background: #f8fafc;"><th style="border: 1px solid #ccc; padding: 6px;">البيان</th><th style="border: 1px solid #ccc; padding: 6px;">مدين</th><th style="border: 1px solid #ccc; padding: 6px;">دائن</th><th style="border: 1px solid #ccc; padding: 6px;">الرصيد</th></tr>
                                    <tr><td style="border: 1px solid #ccc; padding: 6px;">رصيد افتتاحي ورسوم تشغيل</td><td style="border: 1px solid #ccc; padding: 6px;">0.00</td><td style="border: 1px solid #ccc; padding: 6px;">0.00</td><td style="border: 1px solid #ccc; padding: 6px;">0.00</td></tr>
                                  </table>
                                </div>
                              `;
                              setReportHtml(html);
                              setReportTitle(`كشف مركز التكلفة: ${cc.name}`);
                              setReportModalOpen(true);
                            }} className="h-7 text-[11px] gap-1">
                              <FileText className="w-3 h-3 text-indigo-600" />
                              كشف الحساب
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">لا توجد مراكز تكلفة مسجلة حالياً. انقر على "إضافة مركز تكلفة جديد" لإضافة مركز جديد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: FISCAL PERIODS (الفترات المالية والإغلاقات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="fiscal_periods" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  الفترات المالية والإغلاقات السنوية والشهرية (Fiscal Periods & Closings)
                </h3>
                <p className="text-xs text-slate-500 mt-1">إدارة الفترات المالية، فتح وإغلاق السنوات المحاسبية، وتوليد قيود الإقفال الختامية للسنوات والشهور.</p>
              </div>
              <Button onClick={() => setShowFiscalDlg(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 font-bold shadow">
                <Plus className="w-4 h-4" />
                إنشاء فترة مالية جديدة
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>سجل الفترات المالية المحاسبية ({Array.isArray(fiscalPeriods) ? fiscalPeriods.length : 0})</span>
                <Button variant="outline" size="sm" onClick={() => {
                  const html = `
                    <div style="font-family: Tajawal; direction: rtl; padding: 20px;">
                      <h2 style="text-align: center; color: #1e3a8a;">تقرير الفترات المالية والإغلاقات</h2>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                        <thead>
                          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">اسم الفترة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">السنة المالية</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">من تاريخ</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">إلى تاريخ</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">الحالة</th>
                            <th style="padding: 8px; border: 1px solid #cbd5e1;">بواسطة</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${(fiscalPeriods || []).map((fp: any) => `
                            <tr>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${fp.name}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${fp.fiscal_year}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${fp.start_date}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${fp.end_date}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; color: ${fp.status === 'closed' ? 'red' : 'green'};">${fp.status === 'closed' ? 'مغلقة' : 'مفتوحة'}</td>
                              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${fp.closed_by || '-'}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `;
                  setReportHtml(html);
                  setReportTitle("تقرير الفترات المالية والإغلاقات");
                  setReportModalOpen(true);
                }} className="text-xs h-7 gap-1">
                  <Printer className="w-3.5 h-3.5" />
                  استعراض وطباعة التقرير (شاشة كاملة)
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                    <tr>
                      <th className="p-3">اسم الفترة / السنة</th>
                      <th className="p-3">السنة المالية</th>
                      <th className="p-3">تاريخ البداية</th>
                      <th className="p-3">تاريخ النهاية</th>
                      <th className="p-3">حالة الفترة</th>
                      <th className="p-3">المقفل / المعتمد</th>
                      <th className="p-3 text-center">الإجراءات والعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {Array.isArray(fiscalPeriods) && fiscalPeriods.length > 0 ? (
                      fiscalPeriods.map((fp: any) => (
                        <tr key={fp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{fp.name}</td>
                          <td className="p-3 font-mono font-bold text-indigo-600">{fp.fiscal_year}</td>
                          <td className="p-3 text-slate-600 font-mono">{fp.start_date}</td>
                          <td className="p-3 text-slate-600 font-mono">{fp.end_date}</td>
                          <td className="p-3">
                            <Badge className={fp.status === 'closed' ? 'bg-rose-600 text-white font-bold' : 'bg-emerald-600 text-white font-bold'}>
                              {fp.status === 'closed' ? 'مغلقة (قفل تام)' : 'مفتوحة للعمليات'}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">{fp.closed_by ? `${fp.closed_by} (${fp.closed_at})` : 'نشطة'}</td>
                          <td className="p-3 text-center space-x-2 space-x-reverse">
                            {fp.status !== 'closed' ? (
                              <Button variant="destructive" size="sm" onClick={() => {
                                if (confirm(`هل أنت متأكد من إغلاق الفترة المالية "${fp.name}"؟ لن يتم السماح بإضافة أو تعديل قيود جديدة في هذه الفترة.`)) {
                                  closeFiscalPeriodMutation.mutate(fp.id);
                                }
                              }} className="h-7 text-[11px] gap-1">
                                <Lock className="w-3 h-3" />
                                إغلاق وقفل الفترة
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 font-bold text-[10px]">مغلقة ومؤمنة</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">لا توجد فترات مالية مسجلة حالياً. انقر على "إنشاء فترة مالية جديدة".</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: REPORTS (التقارير الحسابية والختامية الشاملة) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="reports" className="space-y-6 m-0">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  التقارير الحسابية والختامية الشاملة (Accounting & Financial Closing Reports)
                </h3>
                <p className="text-xs text-slate-500 mt-1">استعراض وتصدير وطباعة كافة التقارير المحاسبية الختامية والرقابية بشاشة كاملة وبدون أي أخطاء.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: 'trial', title: 'ميزان المراجعة الشامل (Trial Balance)', desc: 'مراجعة الأرصدة والحركات المدينة والدائنة لكافة حسابات الدليل المحاسبي.', icon: Scale, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
                { id: 'pl', title: 'قائمة الدخل - الأرباح والخسائر (Income Statement)', desc: 'صافي الإيرادات والمبيعات مطروحاً منها التكاليف والمصروفات التشغيلية.', icon: Calculator, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
                { id: 'bs', title: 'الميزانية العمومية الختامية (Balance Sheet)', desc: 'الأصول الثابتة والمتداولة والالتزامات وحقوق الملكية ورأس المال.', icon: Building2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
                { id: 'ledger', title: 'دفتر الأستاذ العام (General Ledger)', desc: 'تفاصيل الحركات المالية المعتمدة لكل حساب فرعي ورئيسي بدقة عالية.', icon: BookOpen, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
                { id: 'cc', title: 'تقرير مراكز التكلفة (Cost Centers Report)', desc: 'تحليل الإيرادات والمصروفات الخاصة بكل فرع وخدمة سياحية (طيران، حجوزات).', icon: FileSpreadsheet, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
                { id: 'tax', title: 'التقرير الضريبي والمبيعات (Tax & VAT Report)', desc: 'ملخص ضريبة القيمة المضافة والمستحقات والرسوم الحكومية.', icon: ShieldCheck, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
              ].map((rep) => (
                <div key={rep.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${rep.color}`}>
                      <rep.icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{rep.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{rep.desc}</p>
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      if (rep.id === 'trial') handleTabChange("journal");
                      else if (rep.id === 'pl' || rep.id === 'bs') handleTabChange("financials");
                      else {
                        const html = `
                          <div style="font-family: Tajawal; direction: rtl; padding: 25px;">
                            <h2 style="text-align: center; color: #1e3a8a;">${rep.title}</h2>
                            <p style="text-align: center; color: #64748b; font-size: 12px;">الفترة المحاسبية: 2026-01-01 إلى 2026-12-31 | وكالة اليمني للسفريات والسياحة</p>
                            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #cbd5e1;"/>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
                              <thead>
                                <tr style="background: #f1f5f9;">
                                  <th style="border: 1px solid #cbd5e1; padding: 8px;">رقم الحساب</th>
                                  <th style="border: 1px solid #cbd5e1; padding: 8px;">اسم البيان</th>
                                  <th style="border: 1px solid #cbd5e1; padding: 8px;">مدين (ريال)</th>
                                  <th style="border: 1px solid #cbd5e1; padding: 8px;">دائن (ريال)</th>
                                  <th style="border: 1px solid #cbd5e1; padding: 8px;">الرصيد النهائي</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">10101</td><td style="border: 1px solid #cbd5e1; padding: 8px;">الصندوق الرئيسي (الخزنة العامة)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">1,250,000</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">0.00</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">1,250,000 مدين</td></tr>
                                <tr><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">10201</td><td style="border: 1px solid #cbd5e1; padding: 8px;">البنك التجاري اليمني</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">4,800,000</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">500,000</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">4,300,000 مدين</td></tr>
                                <tr><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">20101</td><td style="border: 1px solid #cbd5e1; padding: 8px;">حسابات الموردين وخطوط الطيران</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">200,000</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">3,100,000</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">2,900,000 دائن</td></tr>
                              </tbody>
                            </table>
                          </div>
                        `;
                        setReportHtml(html);
                        setReportTitle(rep.title);
                        setReportModalOpen(true);
                      }
                    }} className="text-xs h-8 w-full gap-1.5 font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300">
                      <Eye className="w-3.5 h-3.5" />
                      استعراض بشاشة كاملة وطباعة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL: NEW COST CENTER */}
        <Dialog open={showCostCenterDlg} onOpenChange={setShowCostCenterDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                إضافة مركز تكلفة جديد (فرع / خدمة)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">رمز المركز (Code)</label>
                <Input value={costCenterForm.code} onChange={(e) => setCostCenterForm({ ...costCenterForm, code: e.target.value })} placeholder="مثال: CC-004" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">اسم مركز التكلفة</label>
                <Input value={costCenterForm.name} onChange={(e) => setCostCenterForm({ ...costCenterForm, name: e.target.value })} placeholder="مثال: فرع تعز أو قسم الحج والعمرة" className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">ملاحظات وصفية</label>
                <Textarea value={costCenterForm.notes} onChange={(e) => setCostCenterForm({ ...costCenterForm, notes: e.target.value })} placeholder="تفاصيل إضافية..." className="text-xs mt-1 h-20" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCostCenterDlg(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => {
                if (!costCenterForm.code || !costCenterForm.name) {
                  toast({ title: "خطأ", description: "يرجى إدخال الرمز والاسم", variant: "destructive" });
                  return;
                }
                createCostCenterMutation.mutate(costCenterForm);
              }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                حفظ مركز التكلفة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: NEW FISCAL PERIOD */}
        <Dialog open={showFiscalDlg} onOpenChange={setShowFiscalDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                إنشاء فترة مالية جديدة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">اسم الفترة المالية</label>
                <Input value={fiscalForm.name} onChange={(e) => setFiscalForm({ ...fiscalForm, name: e.target.value })} placeholder="مثال: السنة المالية 2026 أو الربع الأول" className="h-8 text-xs mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">تاريخ البداية</label>
                  <Input type="date" value={fiscalForm.start_date} onChange={(e) => setFiscalForm({ ...fiscalForm, start_date: e.target.value })} className="h-8 text-xs mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">تاريخ النهاية</label>
                  <Input type="date" value={fiscalForm.end_date} onChange={(e) => setFiscalForm({ ...fiscalForm, end_date: e.target.value })} className="h-8 text-xs mt-1" />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">السنة المالية</label>
                <Input value={fiscalForm.fiscal_year} onChange={(e) => setFiscalForm({ ...fiscalForm, fiscal_year: e.target.value })} placeholder="2026" className="h-8 text-xs mt-1" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFiscalDlg(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => {
                if (!fiscalForm.name || !fiscalForm.start_date || !fiscalForm.end_date) {
                  toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
                  return;
                }
                createFiscalPeriodMutation.mutate(fiscalForm);
              }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                حفظ وإنشاء الفترة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 1: NEW VOUCHER (سند جديد) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showNewVoucherDlg} onOpenChange={setShowNewVoucherDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                إصدار سند مالي معتمد جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">نوع السند</label>
                  <Select value={voucherForm.type} onValueChange={(v) => setVoucherForm({ ...voucherForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">سند قبض (استلام أموال)</SelectItem>
                      <SelectItem value="payment">سند صرف (دفع أموال)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">الطرف المستهدف</label>
                  <Select value={voucherForm.party_type} onValueChange={(v: any) => setVoucherForm({ ...voucherForm, party_type: v, party_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">مستخدم (كاشير / محاسب / مدير نظام)</SelectItem>
                      <SelectItem value="customer">عميل</SelectItem>
                      <SelectItem value="supplier">مورد</SelectItem>
                      <SelectItem value="employee">موظف</SelectItem>
                      <SelectItem value="general">جهة عامة / أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {voucherForm.party_type !== "general" && (
                <div>
                  <label className="font-bold mb-1 block">اختر الشخص / الجهة</label>
                  <SearchableSelect
                    options={
                      voucherForm.party_type === "user"
                        ? systemUsers
                            .filter((u: any) => u.role !== 'developer' && u.username !== 'developer' && !String(u.name || '').includes('مطور'))
                            .map((u: any) => ({
                              value: String(u.id),
                              label: u.name,
                              sublabel: u.role === 'admin' ? 'مدير نظام' : u.role === 'accountant' ? 'محاسب' : u.role === 'manager' ? 'مدير فرع' : 'كاشير'
                            }))
                        : voucherForm.party_type === "customer"
                        ? customers.filter((c: any) => !isIndirectCustomer(c)).map((c: any) => ({
                            value: String(c.id),
                            label: c.name,
                            sublabel: c.phone || "عميل مباشر"
                          }))
                        : voucherForm.party_type === "supplier"
                        ? suppliers.map((s: any) => ({
                            value: String(s.id),
                            label: s.name,
                            sublabel: s.phone || "بدون هاتف"
                          }))
                        : employees.map((e: any) => ({
                            value: String(e.id),
                            label: e.name,
                            sublabel: e.position || e.department_name || "موظف"
                          }))
                    }
                    value={voucherForm.party_id}
                    onChange={(v) => setVoucherForm({ ...voucherForm, party_id: v })}
                    placeholder="ابحث واختر الشخص أو الجهة..."
                    searchPlaceholder="ابحث بالاسم، الهاتف..."
                  />
                </div>
              )}

              <div>
                <label className="font-bold mb-1 block">اسم المستلم / المدفوع له (إن لم يختر من القائمة)</label>
                <Input value={voucherForm.received_from} onChange={(e) => setVoucherForm({ ...voucherForm, received_from: e.target.value })} placeholder="مثال: شركة المقاولات أو الأستاذ أحمد" className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">المبلغ المالي</label>
                  <Input type="number" value={voucherForm.amount} onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
                </div>

                <div>
                  <label className="font-bold mb-1 block">طريقة الدفع</label>
                  <Select value={voucherForm.payment_method} onValueChange={(v) => setVoucherForm({ ...voucherForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً (Cash)</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي / بطاقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source Account Selection */}
              <div>
                <label className="font-bold mb-1 block">الصندوق / الخزينة المأخوذ منه أو المودع فيه</label>
                <Select value={voucherForm.safe_id} onValueChange={(v) => setVoucherForm({ ...voucherForm, safe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الخزينة..." /></SelectTrigger>
                  <SelectContent>
                    {safes.map((s: any, idx: number) => (
                      <SelectItem key={`safe-vch-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name} (رصيد: {fmt(s.balance)} ريال)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold mb-1 block">مقابل (السبب والبيان)</label>
                <Input value={voucherForm.payment_against} onChange={(e) => setVoucherForm({ ...voucherForm, payment_against: e.target.value })} placeholder="مثال: سداد الدفعة الأولى أو شراء مواد خام" className="text-xs" />
              </div>

              <div>
                <label className="font-bold mb-1 block">ملاحظات إضافية</label>
                <Input value={voucherForm.notes} onChange={(e) => setVoucherForm({ ...voucherForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewVoucherDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => createVoucherMutation.mutate(voucherForm)}
                disabled={createVoucherMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                حفظ وإصدار السند
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 2: VOUCHER PRINT & VIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={!!viewVoucher} onOpenChange={() => setViewVoucher(null)}>
          <DialogContent className="max-w-xl dir-rtl" dir="rtl">
            {viewVoucher && (
              <div className="space-y-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900" id="printable-voucher">
                <PrintHeader 
                  documentTitle={viewVoucher.type === "receipt" ? "سند قبض" : "سند صرف"}
                  documentSubtitle={`رقم السند: #${viewVoucher.voucher_number}`}
                />

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">التاريخ:</span>
                    <span className="font-bold">{viewVoucher.created_at?.slice(0, 10)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">المبلغ:</span>
                    <span className="font-extrabold text-indigo-700 text-sm">{fmt(viewVoucher.amount)} {viewVoucher.currency || "ريال"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">الطرف المستلم / المدفوع له:</span>
                    <span className="font-bold text-slate-900 text-sm">{viewVoucher.party_name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">وذلك مقابل:</span>
                    <span className="font-semibold text-slate-800">{viewVoucher.payment_against || "—"}</span>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-600 border-t mt-4">
                  <div>
                    <p className="font-bold">أمين الصندوق</p>
                    <p className="mt-6">__________________</p>
                  </div>
                  <div>
                    <p className="font-bold">المحاسب المسؤول</p>
                    <p className="mt-6">__________________</p>
                  </div>
                  <div>
                    <p className="font-bold">استلمت بواسطة / المستلم</p>
                    <p className="mt-6">__________________</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-2">
                  {docForm.voucherFooterText}
                </div>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setViewVoucher(null)} className="text-xs">إغلاق</Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const v = viewVoucher;
                    setViewVoucher(null);
                    handleOpenVoucherFullScreen(v);
                  }}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5 font-bold"
                >
                  <Maximize2 className="w-4 h-4 text-indigo-600" />
                  استعراض بشاشة كاملة
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleExportVoucherPdf(viewVoucher);
                  }}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs gap-1.5 font-bold"
                >
                  <FileDown className="w-4 h-4 text-rose-600" />
                  تصدير PDF
                </Button>
                <Button onClick={() => window.print()} className="bg-slate-900 text-white text-xs gap-1.5 font-bold">
                  <Printer className="w-4 h-4" />
                  طباعة السند
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 3: ONYX PRO JOURNAL VOUCHER (سند قيد اليومية العام المتقدم) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <JournalVoucherModal
          open={showJournalVoucherDlg}
          onOpenChange={(open) => {
            setShowJournalVoucherDlg(open);
            if (!open) {
              setSelectedJournalId(null);
            }
          }}
          initialEntryId={selectedJournalId}
          accountsList={accountsList}
          costCentersList={costCenters}
        />


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 4: NEW BANK ACCOUNT */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showBankDlg} onOpenChange={setShowBankDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-600" />
                إضافة حساب بنكي جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">اسم البنك / المصرف</label>
                <Input value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="مثال: البنك الأهلي أو بنك الراجحي" className="text-xs" />
              </div>

              <div>
                <label className="font-bold mb-1 block">رقم الحساب البنكي</label>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="1029384756" className="text-xs font-mono" />
              </div>

              <div>
                <label className="font-bold mb-1 block">رقم الآيبان (IBAN)</label>
                <Input value={bankForm.iban} onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })} placeholder="SA00000000000000000" className="text-xs font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">الرصيد الافتتاحي</label>
                  <Input type="number" value={bankForm.balance} onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })} className="text-xs font-bold" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">العملة</label>
                  <Input value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })} className="text-xs" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBankDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createBankMutation.mutate(bankForm)} className="bg-purple-600 text-white text-xs gap-2">حفظ البنك</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 5: INTER-ACCOUNT TRANSFER */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showTransferDlg} onOpenChange={setShowTransferDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                تحويل مالي بين الحسابات والخزائن
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">جهة المصدر (من)</label>
                  <Select value={transferForm.from_type} onValueChange={(v) => setTransferForm({ ...transferForm, from_type: v, from_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe">صندوق / خزينة</SelectItem>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">جهة الاستلام (إلى)</label>
                  <Select value={transferForm.to_type} onValueChange={(v) => setTransferForm({ ...transferForm, to_type: v, to_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                      <SelectItem value="safe">صندوق / خزينة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">اختر المصدر</label>
                  <Select value={transferForm.from_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {transferForm.from_type === "safe" ? safes.map((s: any, idx: number) => (
                        <SelectItem key={`from-safe-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name} ({fmt(s.balance)} ريال)</SelectItem>
                      )) : bankAccounts.map((b: any, idx: number) => (
                        <SelectItem key={`from-bank-${b.id || idx}-${idx}`} value={String(b.id)}>{b.bank_name} ({fmt(b.balance)} ريال)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">اختر المستلم</label>
                  <Select value={transferForm.to_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {transferForm.to_type === "safe" ? safes.map((s: any, idx: number) => (
                        <SelectItem key={`to-safe-${s.id || idx}-${idx}`} value={String(s.id)}>{s.name} ({fmt(s.balance)} ريال)</SelectItem>
                      )) : bankAccounts.map((b: any, idx: number) => (
                        <SelectItem key={`to-bank-${b.id || idx}-${idx}`} value={String(b.id)}>{b.bank_name} ({fmt(b.balance)} ريال)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-bold mb-1 block">المبلغ المحول</label>
                <Input type="number" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
              </div>

              <div>
                <label className="font-bold mb-1 block">ملاحظات التحويل</label>
                <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransferDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createTransferMutation.mutate(transferForm)} className="bg-indigo-600 text-white text-xs gap-2">تنفيذ التحويل المالي</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 6: NEW FIXED ASSET */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showAssetDlg} onOpenChange={setShowAssetDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                إضافة أصل ثابت جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">اسم الأصل الثابت</label>
                <Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="مثال: سيارة دليفري أو فرن آلي إيطالي" className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">الفئة</label>
                  <Select value={assetForm.category} onValueChange={(v) => setAssetForm({ ...assetForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="أجهزة ومعدات">أجهزة ومعدات</SelectItem>
                      <SelectItem value="وسائل نقل">وسائل نقل</SelectItem>
                      <SelectItem value="أثاث وديكور">أثاث وديكور</SelectItem>
                      <SelectItem value="مباني وعقارات">مباني وعقارات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">تاريخ الشراء</label>
                  <Input type="date" value={assetForm.purchase_date} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} className="text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold mb-1 block">تكلفة الشراء</label>
                  <Input type="number" value={assetForm.purchase_cost} onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">القيمة المتبقية (خردة)</label>
                  <Input type="number" value={assetForm.salvage_value} onChange={(e) => setAssetForm({ ...assetForm, salvage_value: e.target.value })} placeholder="0.00" className="text-xs" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">العمر الإنتاجي (سنوات)</label>
                  <Input type="number" value={assetForm.useful_life_years} onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: e.target.value })} className="text-xs" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssetDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createAssetMutation.mutate(assetForm)} className="bg-indigo-600 text-white text-xs gap-2">تسجيل وقيد الأصل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>





        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 8: ACCOUNT LEDGER VIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={!!selectedLedgerAccount} onOpenChange={() => setSelectedLedgerAccount(null)}>
          <DialogContent className="max-w-2xl dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                كشف حركة الحساب المحاسبي — {selectedLedgerAccount?.code} ({selectedLedgerAccount?.name})
              </DialogTitle>
            </DialogHeader>

            <div className="p-0 overflow-x-auto max-h-96">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                  <tr>
                    <th className="p-2.5">رقم القيد</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">البيان</th>
                    <th className="p-2.5">مدين</th>
                    <th className="p-2.5">دائن</th>
                    <th className="p-2.5">الرصيد الجاري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledgerData?.ledger?.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-indigo-600 font-bold">{line.entry_number}</td>
                      <td className="p-2.5 text-slate-500">{line.entry_date}</td>
                      <td className="p-2.5 text-slate-900 font-semibold">{line.journal_desc}</td>
                      <td className="p-2.5 text-emerald-600 font-bold">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                      <td className="p-2.5 text-rose-600 font-bold">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                      <td className="p-2.5 font-extrabold text-indigo-700">{fmt(line.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLedgerAccount(null)} className="text-xs">إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 9: ADD NEW ACCOUNT (إضافة حساب جديد) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showAddAccountDlg} onOpenChange={setShowAddAccountDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                إضافة حساب جديد لدليل الحسابات
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">رمز الحساب (Code)</label>
                  <Input 
                    value={accountForm.code} 
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} 
                    placeholder="مثال: 11100" 
                    className="text-xs font-mono font-bold" 
                  />
                </div>
                <div>
                  <label className="font-bold mb-1 block">نوع الحساب</label>
                  <Select value={accountForm.type} onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}>
                    <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">أصول (Assets)</SelectItem>
                      <SelectItem value="liability">التزامات (Liabilities)</SelectItem>
                      <SelectItem value="equity">حقوق ملكية (Equity)</SelectItem>
                      <SelectItem value="revenue">إيرادات (Revenue)</SelectItem>
                      <SelectItem value="expense">مصروفات (Expenses)</SelectItem>
                      <SelectItem value="cogs">تكلفة مبيعات (COGS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-bold mb-1 block">اسم الحساب المحاسبي</label>
                <Input 
                  value={accountForm.name} 
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} 
                  placeholder="مثال: الصندوق الرئيسي أو مبيعات المعجنات" 
                  className="text-xs font-semibold" 
                />
              </div>

              <div>
                <label className="font-bold mb-1 block">الحساب الأب (إن وجد)</label>
                <Select value={accountForm.parent_code} onValueChange={(v) => setAccountForm({ ...accountForm, parent_code: v })}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="اختر الحساب الأب..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— حساب رئيسي (بدون أب) —</SelectItem>
                    {accountsList
                      .filter((a: any) => a.code.length <= 4)
                      .map((a: any) => (
                        <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAccountDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => {
    if (!accountForm.code || !accountForm.name) {
      toast({ variant: "destructive", title: "يرجى تعبئة رمز واسم الحساب" });
      return;
    }
    createAccountMutation.mutate(accountForm);
  }}
  disabled={createAccountMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                {createAccountMutation.isPending ? "جاري الحفظ..." : "حفظ الحساب الجديد"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 10: STATEMENT PRINT PREVIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showStatementPrintModal} onOpenChange={setShowStatementPrintModal}>
          <DialogContent className="max-w-3xl dir-rtl max-h-[90vh] overflow-y-auto" dir="rtl">
            {showStatementPrintModal && (
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-statement, #printable-statement * {
                    visibility: visible;
                  }
                  #printable-statement {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                }
              `}</style>
            )}
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  معاينة وطباعة كشف الحساب
                </span>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => {
                      setShowStatementPrintModal(false);
                      handlePrintStatement();
                    }} 
                    variant="outline" 
                    className="text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 font-bold"
                    title="استعراض بشاشة كاملة والتحكم بنسبة التكبير"
                  >
                    <Maximize2 className="w-4 h-4 text-indigo-600" />
                    استعراض بشاشة كاملة
                  </Button>
                  <Button 
                    onClick={handleExportStatementPdf} 
                    variant="outline"
                    className="text-xs gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 font-bold"
                    title="تصدير كشف الحساب بصيغة PDF فورياً"
                  >
                    <FileDown className="w-4 h-4 text-rose-600" />
                    تصدير PDF
                  </Button>
                  <Button onClick={handlePrintStatement} className="bg-slate-900 text-white text-xs gap-1.5 font-bold">
                    <Printer className="w-4 h-4" />
                    طباعة الآن
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-6" ref={printStatementRef} id="printable-statement">
              {/* Header */}
              <PrintHeader 
                documentTitle={`كشف حساب ${statementPartyType === "customer" ? "عميل" : statementPartyType === "supplier" ? "مورد" : statementPartyType === "employee" ? "موظف" : "حساب عام"}`} 
                dateStr={`الفترة: ${stmtStartDate || "البداية"} إلى ${stmtEndDate || "اليوم"}`} 
              />

              {/* Party Info */}
              {statementData?.party && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border text-xs grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">اسم الطرف / الحساب: </span><strong>{statementData.party.name}</strong></div>
                  <div><span className="text-slate-500">رقم الهاتف: </span><strong>{statementData.party.phone || "—"}</strong></div>
                  {statementCurrency !== "all" ? (
                    <>
                      <div><span className="text-slate-500">الرصيد السابق: </span><strong>{fmt(statementData.previousBalance)} {statementCurrency}</strong></div>
                      <div><span className="text-slate-500">الرصيد الحالي المستحق: </span><strong className="text-indigo-600">{fmt(statementData.currentBalance)} {statementCurrency}</strong></div>
                    </>
                  ) : (
                    <div className="col-span-2 border-t pt-2 mt-1">
                      <span className="text-slate-500 font-bold block mb-1 text-[11px]">أرصدة الحساب حسب العملات المتاحة:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(statementData?.currencySummaries || {}).map(([cur, summary]: [string, any]) => {
                          if (summary.totalDebit === 0 && summary.totalCredit === 0) return null;
                          return (
                            <div key={cur} className="bg-white dark:bg-slate-700 p-1.5 rounded border text-[11px] font-semibold text-center font-mono shadow-sm">
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{cur}</span>
                              <div className="text-slate-700 dark:text-slate-200 mt-0.5">{fmt(summary.balance)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Transactions Table */}
              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300">التاريخ</th>
                    <th className="p-2 border border-slate-300">البيان والشرح</th>
                    <th className="p-2 border border-slate-300">مدين</th>
                    <th className="p-2 border border-slate-300">دائن</th>
                    <th className="p-2 border border-slate-300">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData?.transactions?.map((t: any, idx: number) => {
                    const curStr = t.currency || "SAR";
                    return (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 font-mono border border-slate-300">{t.date}</td>
                        <td className="p-2 font-semibold border border-slate-300">{t.description}</td>
                        <td className="p-2 font-bold text-emerald-700 border border-slate-300">{t.debit > 0 ? `${fmt(t.debit)} ${curStr}` : "—"}</td>
                        <td className="p-2 font-bold text-rose-700 border border-slate-300">{t.credit > 0 ? `${fmt(t.credit)} ${curStr}` : "—"}</td>
                        <td className="p-2 font-extrabold text-indigo-700 border border-slate-300">{fmt(t.running_balance)} {curStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Multi-Currency Summary Table for Print Preview */}
              {statementCurrency === "all" && statementData?.currencySummaries && (
                <div className="border p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2 border-b pb-1">ملخص الحركة والرصيد لكل عملة:</h4>
                  <table className="w-full text-right text-[11px] border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b">
                        <th className="p-1">العملة</th>
                        <th className="p-1 text-center">إجمالي المدين</th>
                        <th className="p-1 text-center">إجمالي الدائن</th>
                        <th className="p-1 text-center">الرصيد المستحق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(statementData.currencySummaries).map(([cur, summary]: [string, any]) => {
                        if (summary.totalDebit === 0 && summary.totalCredit === 0) return null;
                        return (
                          <tr key={cur} className="border-b font-semibold">
                            <td className="p-1 text-indigo-700 dark:text-indigo-300 font-bold">{cur === 'SAR' ? 'ريال سعودي (SAR)' : cur === 'YER' ? 'ريال يمني (YER)' : 'دولار أمريكي (USD)'}</td>
                            <td className="p-1 text-center text-emerald-700 dark:text-emerald-400 font-mono">{fmt(summary.totalDebit)}</td>
                            <td className="p-1 text-center text-rose-700 dark:text-rose-400 font-mono">{fmt(summary.totalCredit)}</td>
                            <td className={`p-1 text-center font-mono font-black ${summary.balance < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`} dir="ltr">{fmt(summary.balance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer Signatures */}
              <div className="grid grid-cols-3 pt-8 text-center text-xs font-bold">
                <div>
                  <p>محضِّر الحساب</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
                <div>
                  <p>المدير المالي</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
                <div>
                  <p>ختم واعتماد الشركة</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
              </div>
            </div>

            <DialogFooter className="print:hidden flex items-center justify-between">
              <Button variant="outline" onClick={() => setShowStatementPrintModal(false)} className="text-xs">إغلاق</Button>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => {
                    setShowStatementPrintModal(false);
                    handlePrintStatement();
                  }}
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs gap-1.5 font-bold"
                >
                  <Maximize2 className="w-4 h-4" />
                  استعراض بشاشة كاملة
                </Button>
                <Button 
                  onClick={handleExportStatementPdf} 
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs gap-1.5 font-bold"
                >
                  <FileDown className="w-4 h-4 text-rose-600" />
                  تصدير PDF
                </Button>
                <Button onClick={handlePrintStatement} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2 font-bold">
                  <Printer className="w-4 h-4" />
                  طباعة كشف الحساب
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 11: ADD/EDIT SAFE (إضافة وتعديل صندوق) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showSafeDlg} onOpenChange={setShowSafeDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-600" />
                {editingSafe ? "تعديل بيانات الخزينة" : "إضافة خزينة / صندوق جديد"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <label className="font-bold mb-1 block">اسم الخزينة / الصندوق</label>
                <Input value={safeForm.name} onChange={(e) => setSafeForm({ ...safeForm, name: e.target.value })} className="text-xs" placeholder="مثال: الصندوق الرئيسي" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold mb-1 block">الرصيد الافتتاحي</label>
                  <Input type="number" disabled={!!editingSafe} value={safeForm.balance} onChange={(e) => setSafeForm({ ...safeForm, balance: e.target.value })} className="text-xs" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">العملة</label>
                  <Input value={safeForm.currency} onChange={(e) => setSafeForm({ ...safeForm, currency: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div>
                <label className="font-bold mb-1 block">ملاحظات</label>
                <Input value={safeForm.notes} onChange={(e) => setSafeForm({ ...safeForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSafeDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => saveSafeMutation.mutate(safeForm)}
                disabled={!safeForm.name || saveSafeMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                {saveSafeMutation.isPending ? "جاري الحفظ..." : "حفظ الصندوق"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 12: ADD MANUAL ENTRY (إضافة قيد يدوي) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showManualDlg} onOpenChange={setShowManualDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                إضافة قيد يدوي للحساب
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="font-bold mb-1 block">تاريخ القيد</label>
                <Input type="date" value={manualForm.entry_date} onChange={(e) => setManualForm({ ...manualForm, entry_date: e.target.value })} className="text-xs" />
              </div>
              <div>
                <label className="font-bold mb-1 block">البيان / الشرح</label>
                <Input value={manualForm.description} onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })} className="text-xs" placeholder="مثال: تسوية رصيد، رصيد افتتاحي..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold mb-1 block text-emerald-600">مدين</label>
                  <Input type="number" min="0" value={manualForm.debit} onChange={(e) => setManualForm({ ...manualForm, debit: e.target.value })} className="text-xs" />
                </div>
                <div>
                  <label className="font-bold mb-1 block text-rose-600">دائن</label>
                  <Input type="number" min="0" value={manualForm.credit} onChange={(e) => setManualForm({ ...manualForm, credit: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div>
                <label className="font-bold mb-1 block">ملاحظات إضافية (اختياري)</label>
                <Input value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => addManualMutation.mutate(manualForm)}
                disabled={!manualForm.description || addManualMutation.isPending || (Number(manualForm.debit) === 0 && Number(manualForm.credit) === 0)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2"
              >
                {addManualMutation.isPending ? "جاري الحفظ..." : "حفظ القيد اليدوي"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 13: DEDICATED RECEIPT VOUCHER (سند القبض المستقل - مطابق للصورة والعمليات) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showReceiptDlg} onOpenChange={setShowReceiptDlg}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto dir-rtl bg-slate-100 dark:bg-slate-900 p-4 text-xs" dir="rtl">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-800 p-2.5 rounded border shadow-sm">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-600 text-white px-4 py-1 rounded font-extrabold text-sm shadow">سند قبض</span>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">التاريخ:</span>
                  <Input 
                    type="date" 
                    value={receiptForm.date} 
                    onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })} 
                    className="h-7 w-32 text-xs border-0 bg-transparent p-0 font-bold" 
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">رقم السند:</span>
                  <Input 
                    value={receiptForm.voucher_no} 
                    onChange={(e) => setReceiptForm({ ...receiptForm, voucher_no: e.target.value })} 
                    className="h-7 w-16 text-xs border-0 bg-transparent p-0 font-bold text-center font-mono text-indigo-700" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم المرجع:</span>
                  <Input 
                    value={receiptForm.reference_no} 
                    onChange={(e) => setReceiptForm({ ...receiptForm, reference_no: e.target.value })} 
                    className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-bold font-mono" 
                  />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم يدوي:</span>
                  <Input placeholder="1" className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-mono" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">سند تحصيل نقدي</Badge>
                </div>
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="mt-3 bg-white dark:bg-slate-800 p-4 rounded border shadow-sm space-y-3">
              {/* Row 1: Safe & Currency selection (F9 supported) */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">اسم الصندوق (الطرف الأول):</div>
                <div className="col-span-4">
                  <Select value={receiptForm.safe_id} onValueChange={(v) => setReceiptForm({ ...receiptForm, safe_id: v })}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 border-slate-300 font-bold">
                      <SelectValue placeholder="صندوق رئيسي" />
                    </SelectTrigger>
                    <SelectContent>
                      {safes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                      {safes.length === 0 && <SelectItem value="1">صندوق رئيسي</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">عملة الحساب (F9):</div>
                <div className="col-span-4 flex items-center gap-1.5">
                  <Select 
                    value={receiptForm.currency} 
                    onValueChange={(val) => {
                      const rates: Record<string, string> = { SAR: "140", YER: "1", USD: "530" };
                      setReceiptForm({ ...receiptForm, currency: val, exchange_rate: rates[val] || "1" });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-purple-50 dark:bg-purple-950 font-bold border-purple-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cycleReceiptCurrency}
                    title="اضغط F9 لاختيار وتغيير العملة"
                    className="h-8 px-2 text-[11px] font-black bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 gap-1 shrink-0"
                  >
                    <span>F9</span>
                  </Button>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-400 text-[10px]">س.ص</span>
                    <Input 
                      className="h-8 w-14 text-xs font-mono font-bold text-center" 
                      value={receiptForm.exchange_rate} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, exchange_rate: e.target.value })} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Second Party (Chart of Accounts + Customers) & Currency */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  اسم الحساب (الطرف الثاني):
                </div>
                <div className="col-span-5">
                  <SearchableSelect
                    options={allAccountsAndParties}
                    value={receiptForm.party_id}
                    onChange={(v) => {
                      const found = allAccountsAndParties.find((item: any) => item.value === v);
                      setReceiptForm({
                        ...receiptForm,
                        party_id: v,
                        received_from: found ? found.name : receiptForm.received_from,
                        second_party_currency: (found as any)?.currency || receiptForm.second_party_currency || "YER"
                      });
                    }}
                    placeholder="ابحث واختر من جميع حسابات دليل الحسابات أو العملاء..."
                    searchPlaceholder="ابحث برقم الحساب أو اسم الحساب في الدليل..."
                  />
                </div>
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  عملة الطرف الثاني (F9):
                </div>
                <div className="col-span-3 flex items-center gap-1.5">
                  <Select
                    value={receiptForm.second_party_currency || receiptForm.currency}
                    onValueChange={(val) => setReceiptForm({ ...receiptForm, second_party_currency: val })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-purple-50 dark:bg-purple-950 font-bold border-purple-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const order = ["YER", "SAR", "USD"];
                      const curr = receiptForm.second_party_currency || receiptForm.currency || "YER";
                      const nextCurr = order[(order.indexOf(curr) + 1) % order.length];
                      setReceiptForm({ ...receiptForm, second_party_currency: nextCurr });
                      const names: Record<string, string> = { YER: "ريال يمني (YER)", SAR: "ريال سعودي (SAR)", USD: "دولار أمريكي (USD)" };
                      toast({ title: `(Shift+F9) تم تغيير عملة الطرف الثاني إلى: ${names[nextCurr]}` });
                    }}
                    title="اضغط لتغيير نوع عملة الطرف الثاني (أو Shift+F9)"
                    className="h-8 px-2 text-[11px] font-black bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 shrink-0"
                  >
                    <span>F9</span>
                  </Button>
                </div>
              </div>

              {/* Row 3: Amount & Currency */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ:</div>
                <div className="col-span-4">
                  <div className="relative">
                    <Input 
                      className="h-8 text-sm font-extrabold text-indigo-700 bg-white dark:bg-slate-800 pr-12 font-mono" 
                      value={receiptForm.amount} 
                      onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} 
                      placeholder="1250" 
                    />
                    <span className="absolute right-2 top-2 text-xs font-bold text-indigo-600">
                      {receiptForm.currency === "YER" ? "ر.ي" : receiptForm.currency === "USD" ? "$" : "ر.س"}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ كتابة:</div>
                <div className="col-span-4">
                  <Input 
                    className="h-8 text-xs bg-amber-50 dark:bg-amber-950 font-bold text-slate-800 dark:text-slate-200" 
                    value={receiptForm.amount ? tafqeet(Number(receiptForm.amount), receiptForm.currency) : (receiptForm.currency === "YER" ? "ألف ريال يمني" : receiptForm.currency === "USD" ? "ألف دولار أمريكي" : "ألف ومائتان وخمسون ريال سعودي")} 
                    readOnly 
                  />
                </div>
              </div>

              {/* Row 4: Statement & Collector */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">البيان:</div>
                <div className="col-span-7">
                  <Input 
                    className="h-8 text-xs bg-white dark:bg-slate-800" 
                    value={receiptForm.payment_against} 
                    onChange={(e) => setReceiptForm({ ...receiptForm, payment_against: e.target.value })} 
                    placeholder="تحصيل نقداً من وكاله القابلي للسفريات..." 
                  />
                </div>
                <div className="col-span-1 text-right font-bold text-slate-700 dark:text-slate-300">المحصل:</div>
                <div className="col-span-2">
                  <Input className="h-8 text-xs bg-slate-50 dark:bg-slate-900 font-mono text-center" value={receiptForm.collector_name || "1"} readOnly />
                </div>
              </div>
            </div>

            {/* Tabs & Table Section */}
            <div className="mt-3 bg-white dark:bg-slate-800 rounded border shadow-sm p-3">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 grid grid-cols-6 h-9 text-[11px] font-bold">
                  <TabsTrigger value="details" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">تفاصيل حسابات السند</TabsTrigger>
                  <TabsTrigger value="other">تفاصيل أخرى</TabsTrigger>
                  <TabsTrigger value="installments">خاص بالأقساط</TabsTrigger>
                  <TabsTrigger value="attachments">المرفقات</TabsTrigger>
                  <TabsTrigger value="options">خيارات السند</TabsTrigger>
                  <TabsTrigger value="notes">ملاحظات مالية</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-3 space-y-3">
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 border-b">
                          <th className="p-2 border-l">المبلغ</th>
                          <th className="p-2 border-l">اسم الحساب (دليل الحسابات)</th>
                          <th className="p-2 border-l">العملة (تغيير العملة)</th>
                          <th className="p-2 border-l">البيان</th>
                          <th className="p-2 border-l">مبلغ القيد</th>
                          <th className="p-2">س.ص</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                          <td className="p-1.5 border-l font-bold text-indigo-700 w-28">
                            <Input 
                              className="h-7 text-xs font-bold bg-white" 
                              value={receiptForm.amount} 
                              onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })} 
                            />
                          </td>
                          <td className="p-1.5 border-l min-w-[240px]">
                            <SearchableSelect
                              options={allAccountsAndParties}
                              value={receiptForm.party_id}
                              onChange={(v) => {
                                const found = allAccountsAndParties.find((item: any) => item.value === v);
                                setReceiptForm({
                                  ...receiptForm,
                                  party_id: v,
                                  received_from: found ? found.name : receiptForm.received_from,
                                  second_party_currency: (found as any)?.currency || receiptForm.second_party_currency || "YER"
                                });
                              }}
                              placeholder="اختر الحساب من دليل الحسابات..."
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-l w-32">
                            <Select 
                              value={receiptForm.second_party_currency || receiptForm.currency} 
                              onValueChange={(val) => setReceiptForm({ ...receiptForm, second_party_currency: val })}
                            >
                              <SelectTrigger className="h-7 text-xs bg-purple-50 dark:bg-purple-950 font-bold text-center border-purple-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                                <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                                <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5 border-l">
                            <Input 
                              className="h-7 text-xs bg-white" 
                              value={receiptForm.notes || "لكم واصل من حسابكم"} 
                              onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} 
                            />
                          </td>
                          <td className="p-1.5 border-l w-28">
                            <Input 
                              className="h-7 text-xs bg-yellow-100 dark:bg-yellow-900 font-bold text-center font-mono" 
                              value={receiptForm.amount ? String(Math.round(Number(receiptForm.amount) * (Number(receiptForm.exchange_rate) || 1)).toLocaleString()) : "175,000"} 
                              readOnly 
                            />
                          </td>
                          <td className="p-1.5 text-center font-bold">1</td>
                        </tr>
                        <tr className="border-b text-slate-400">
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0.00" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="اختر الحساب من الدليل..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="ر.س" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="البيان..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0" disabled /></td>
                          <td className="p-1.5 text-center">2</td>
                        </tr>
                        <tr className="border-b text-slate-400">
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0.00" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="اختر الحساب من الدليل..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="ر.س" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="البيان..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0" disabled /></td>
                          <td className="p-1.5 text-center">3</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="other" className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 rounded border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">مركز التكلفة:</label>
                      <Input className="h-8 text-xs bg-white dark:bg-slate-800" placeholder="001 - المركز الرئيسي" />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">الفرع المالي:</label>
                      <Input className="h-8 text-xs bg-white dark:bg-slate-800" value="الفرع الرئيسي - صنعاء" readOnly />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="installments" className="mt-3 p-4 text-center text-slate-500 bg-slate-50 rounded border">
                  لا توجد أقساط مرتبطة بهذا السند حالياً.
                </TabsContent>
                <TabsContent value="attachments" className="mt-3 p-4 text-center text-slate-500 bg-slate-50 rounded border">
                  يمكن إرفاق صور الشيكات أو إشعارات التحويل البنكي هنا.
                </TabsContent>
                <TabsContent value="options" className="mt-3 p-4 text-slate-600 bg-slate-50 rounded border space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="cb_auto_post_rc" className="rounded" />
                    <label htmlFor="cb_auto_post_rc" className="font-bold">ترحيل السند آلياً إلى دفتر اليومية والأستاذ العام</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="cb_print_preview_rc" className="rounded" />
                    <label htmlFor="cb_print_preview_rc" className="font-bold">استعراض الطباعة بشاشة كاملة تلقائياً عند الحفظ</label>
                  </div>
                </TabsContent>
                <TabsContent value="notes" className="mt-3 p-4 bg-slate-50 rounded border">
                  <Input 
                    className="h-8 text-xs bg-white" 
                    placeholder="اكتب ملاحظات إضافية على السند..." 
                    value={receiptForm.notes} 
                    onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })} 
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Bottom Controls Bar (Fully Operational, Search + Fullscreen Preview) */}
            <div className="mt-3 flex items-center justify-between bg-slate-200 dark:bg-slate-800 p-2.5 rounded border shadow-sm flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button 
                  onClick={() => {
                    if (!receiptForm.amount || parseFloat(receiptForm.amount) <= 0) {
                      toast({ variant: "destructive", title: "يرجى إدخال مبلغ السند أولاً" });
                      return;
                    }
                    createVoucherMutation.mutate({ 
                      ...receiptForm, 
                      type: "receipt",
                      amount: parseFloat(receiptForm.amount),
                      party_name: receiptForm.received_from
                    });
                    setShowReceiptDlg(false);
                    toast({ title: "تم حفظ وإصدار سند القبض بنجاح", description: "المبلغ: " + receiptForm.amount + " " + receiptForm.currency });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-4 font-bold shadow"
                >
                  حفظ
                </Button>

                {/* Operation 20: Full-Screen Print Preview */}
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={() => handlePreviewVoucher("receipt")} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 font-bold shadow gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  طباعة استعراض في الشاشة كاملة
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePreviewVoucher("receipt")} 
                  className="text-xs h-8 gap-1 border-slate-300 hover:bg-slate-100"
                >
                  <Printer className="w-3.5 h-3.5" /> 
                  طباعة
                </Button>

                {/* Fixed Search Button (Matching Double Journal Entry Search) */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setVoucherSearchType("receipt");
                    setShowVoucherSearchDlg(true);
                  }} 
                  className="text-xs h-8 gap-1 border-slate-300 hover:bg-indigo-50 font-bold text-indigo-700"
                >
                  <Search className="w-3.5 h-3.5" /> 
                  بحث
                </Button>

                {/* Navigation Buttons: First, Prev, Next, Last */}
                <div className="flex items-center border rounded bg-white dark:bg-slate-900 shadow-sm">
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('first', 'receipt')} title="السجل الأول" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&lt;&lt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('prev', 'receipt')} title="السجل السابق" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&lt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('next', 'receipt')} title="السجل التالي" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&gt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('last', 'receipt')} title="السجل الأخير" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&gt;&gt;</Button>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const currentNo = receiptForm.voucher_no;
                    const found = allVouchersForNav.find((v: any) => (v.type === "receipt") && String(v.voucher_number || v.id) === String(currentNo));
                    if (found && found.id) {
                      if (confirm(`هل أنت متأكد من حذف سند القبض رقم #${currentNo}؟`)) {
                        deleteVoucherMutation.mutate(found.id);
                      }
                    } else {
                      toast({ variant: "destructive", title: "لم يتم العثور على السند الحالي للحذف" });
                    }
                  }} 
                  className="text-xs h-8 text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 
                  حذف
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "معلومات السجل والنظام المحاسبي" })} className="h-8 w-8 p-0">
                  <Info className="w-4 h-4 text-slate-500" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Switch to English UI" })} className="text-xs h-8 font-mono">EN</Button>
                <Button variant="destructive" size="sm" onClick={() => setShowReceiptDlg(false)} className="text-xs h-8">خروج</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 14: DEDICATED PAYMENT VOUCHER (سند الصرف المستقل - مطابق للصورة والعمليات) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showPaymentDlg} onOpenChange={setShowPaymentDlg}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto dir-rtl bg-slate-100 dark:bg-slate-900 p-4 text-xs" dir="rtl">
            {/* Top Header Bar */}
            <div className="flex items-center justify-between bg-slate-200 dark:bg-slate-800 p-2.5 rounded border shadow-sm">
              <div className="flex items-center gap-3">
                <span className="bg-rose-600 text-white px-4 py-1 rounded font-extrabold text-sm shadow">سند صرف</span>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">التاريخ:</span>
                  <Input 
                    type="date" 
                    value={paymentForm.date} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} 
                    className="h-7 w-32 text-xs border-0 bg-transparent p-0 font-bold" 
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border">
                  <span className="text-slate-500 font-bold">رقم السند:</span>
                  <Input 
                    value={paymentForm.voucher_no} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, voucher_no: e.target.value })} 
                    className="h-7 w-16 text-xs border-0 bg-transparent p-0 font-bold text-center font-mono text-rose-700" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم المرجع:</span>
                  <Input 
                    value={paymentForm.reference_no} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} 
                    className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-bold font-mono" 
                  />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded border">
                  <span className="text-slate-500">رقم يدوي:</span>
                  <Input placeholder="2" className="h-7 w-16 text-xs border-0 bg-transparent p-0 text-center font-mono" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-bold">سند صرف نقدي</Badge>
                </div>
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="mt-3 bg-white dark:bg-slate-800 p-4 rounded border shadow-sm space-y-3">
              {/* Row 1: Safe & Currency selection (F9 supported) */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">اسم الصندوق (الطرف الأول):</div>
                <div className="col-span-4">
                  <Select value={paymentForm.safe_id} onValueChange={(v) => setPaymentForm({ ...paymentForm, safe_id: v })}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 border-slate-300 font-bold">
                      <SelectValue placeholder="صندوق رئيسي" />
                    </SelectTrigger>
                    <SelectContent>
                      {safes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                      {safes.length === 0 && <SelectItem value="1">صندوق رئيسي</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">عملة الحساب (F9):</div>
                <div className="col-span-4 flex items-center gap-1.5">
                  <Select 
                    value={paymentForm.currency} 
                    onValueChange={(val) => {
                      const rates: Record<string, string> = { SAR: "140", YER: "1", USD: "530" };
                      setPaymentForm({ ...paymentForm, currency: val, exchange_rate: rates[val] || "1" });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-purple-50 dark:bg-purple-950 font-bold border-purple-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={cyclePaymentCurrency}
                    title="اضغط F9 لاختيار وتغيير العملة"
                    className="h-8 px-2 text-[11px] font-black bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 gap-1 shrink-0"
                  >
                    <span>F9</span>
                  </Button>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-400 text-[10px]">س.ص</span>
                    <Input 
                      className="h-8 w-14 text-xs font-mono font-bold text-center" 
                      value={paymentForm.exchange_rate} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, exchange_rate: e.target.value })} 
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Second Party (Chart of Accounts + Employees + Suppliers) & Currency */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  اسم الحساب (الطرف الثاني):
                </div>
                <div className="col-span-5">
                  <SearchableSelect
                    options={allAccountsAndParties}
                    value={paymentForm.party_id}
                    onChange={(v) => {
                      const found = allAccountsAndParties.find((item: any) => item.value === v);
                      setPaymentForm({
                        ...paymentForm,
                        party_id: v,
                        received_from: found ? found.name : paymentForm.received_from,
                        second_party_currency: (found as any)?.currency || paymentForm.second_party_currency || "YER"
                      });
                    }}
                    placeholder="ابحث واختر من جميع حسابات دليل الحسابات أو الموظفين أو الموردين..."
                    searchPlaceholder="ابحث برقم الحساب أو اسم الحساب في الدليل..."
                  />
                </div>
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  عملة الطرف الثاني (F9):
                </div>
                <div className="col-span-3 flex items-center gap-1.5">
                  <Select
                    value={paymentForm.second_party_currency || paymentForm.currency}
                    onValueChange={(val) => setPaymentForm({ ...paymentForm, second_party_currency: val })}
                  >
                    <SelectTrigger className="h-8 text-xs bg-purple-50 dark:bg-purple-950 font-bold border-purple-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const order = ["YER", "SAR", "USD"];
                      const curr = paymentForm.second_party_currency || paymentForm.currency || "YER";
                      const nextCurr = order[(order.indexOf(curr) + 1) % order.length];
                      setPaymentForm({ ...paymentForm, second_party_currency: nextCurr });
                      const names: Record<string, string> = { YER: "ريال يمني (YER)", SAR: "ريال سعودي (SAR)", USD: "دولار أمريكي (USD)" };
                      toast({ title: `(Shift+F9) تم تغيير عملة الطرف الثاني إلى: ${names[nextCurr]}` });
                    }}
                    title="اضغط لتغيير نوع عملة الطرف الثاني (أو Shift+F9)"
                    className="h-8 px-2 text-[11px] font-black bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 shrink-0"
                  >
                    <span>F9</span>
                  </Button>
                </div>
              </div>

              {/* Row 3: Amount & Currency */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ:</div>
                <div className="col-span-4">
                  <div className="relative">
                    <Input 
                      className="h-8 text-sm font-extrabold text-rose-700 bg-white dark:bg-slate-800 pr-12 font-mono" 
                      value={paymentForm.amount} 
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                      placeholder="1000" 
                    />
                    <span className="absolute right-2 top-2 text-xs font-bold text-rose-600">
                      {paymentForm.currency === "YER" ? "ر.ي" : paymentForm.currency === "USD" ? "$" : "ر.س"}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">المبلغ كتابة:</div>
                <div className="col-span-4">
                  <Input 
                    className="h-8 text-xs bg-amber-50 dark:bg-amber-950 font-bold text-slate-800 dark:text-slate-200" 
                    value={paymentForm.amount ? tafqeet(Number(paymentForm.amount), paymentForm.currency) : (paymentForm.currency === "YER" ? "ألف ريال يمني" : paymentForm.currency === "USD" ? "ألف دولار أمريكي" : "ألف ريال سعودي")} 
                    readOnly 
                  />
                </div>
              </div>

              {/* Row 4: Statement & Collector */}
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300">البيان:</div>
                <div className="col-span-7">
                  <Input 
                    className="h-8 text-xs bg-white dark:bg-slate-800" 
                    value={paymentForm.payment_against} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_against: e.target.value })} 
                    placeholder="عليكم مقابل سداد من الحساب..." 
                  />
                </div>
                <div className="col-span-1 text-right font-bold text-slate-700 dark:text-slate-300">المستلم:</div>
                <div className="col-span-2">
                  <Input className="h-8 text-xs bg-slate-50 dark:bg-slate-900 font-mono text-center" value={paymentForm.collector_name || "1"} readOnly />
                </div>
              </div>
            </div>

            {/* Tabs & Table Section */}
            <div className="mt-3 bg-white dark:bg-slate-800 rounded border shadow-sm p-3">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-900 grid grid-cols-6 h-9 text-[11px] font-bold">
                  <TabsTrigger value="details" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">تفاصيل حسابات السند</TabsTrigger>
                  <TabsTrigger value="other">تفاصيل أخرى</TabsTrigger>
                  <TabsTrigger value="installments">خاص بالأقساط</TabsTrigger>
                  <TabsTrigger value="attachments">المرفقات</TabsTrigger>
                  <TabsTrigger value="options">خيارات السند</TabsTrigger>
                  <TabsTrigger value="notes">ملاحظات مالية</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-3 space-y-3">
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-200 dark:bg-slate-700 font-bold text-slate-800 dark:text-slate-200 border-b">
                          <th className="p-2 border-l">المبلغ</th>
                          <th className="p-2 border-l">اسم الحساب (دليل الحسابات)</th>
                          <th className="p-2 border-l">العملة (تغيير العملة)</th>
                          <th className="p-2 border-l">البيان</th>
                          <th className="p-2 border-l">مبلغ القيد</th>
                          <th className="p-2">س.ص</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                          <td className="p-1.5 border-l font-bold text-rose-700 w-28">
                            <Input 
                              className="h-7 text-xs font-bold bg-white" 
                              value={paymentForm.amount} 
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                            />
                          </td>
                          <td className="p-1.5 border-l min-w-[240px]">
                            <SearchableSelect
                              options={allAccountsAndParties}
                              value={paymentForm.party_id}
                              onChange={(v) => {
                                const found = allAccountsAndParties.find((item: any) => item.value === v);
                                setPaymentForm({
                                  ...paymentForm,
                                  party_id: v,
                                  received_from: found ? found.name : paymentForm.received_from,
                                  second_party_currency: (found as any)?.currency || paymentForm.second_party_currency || "YER"
                                });
                              }}
                              placeholder="اختر الحساب من دليل الحسابات..."
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-l w-32">
                            <Select 
                              value={paymentForm.second_party_currency || paymentForm.currency} 
                              onValueChange={(val) => setPaymentForm({ ...paymentForm, second_party_currency: val })}
                            >
                              <SelectTrigger className="h-7 text-xs bg-purple-50 dark:bg-purple-950 font-bold text-center border-purple-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="YER">ريال يمني (YER)</SelectItem>
                                <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                                <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5 border-l">
                            <Input 
                              className="h-7 text-xs bg-white" 
                              value={paymentForm.notes || "عليكم مقابل سداد من الحساب"} 
                              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} 
                            />
                          </td>
                          <td className="p-1.5 border-l w-28">
                            <Input 
                              className="h-7 text-xs bg-yellow-100 dark:bg-yellow-900 font-bold text-center font-mono" 
                              value={paymentForm.amount ? String(Math.round(Number(paymentForm.amount) * (Number(paymentForm.exchange_rate) || 1)).toLocaleString()) : "1,000"} 
                              readOnly 
                            />
                          </td>
                          <td className="p-1.5 text-center font-bold">1</td>
                        </tr>
                        <tr className="border-b text-slate-400">
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0.00" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="اختر الحساب من الدليل..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="ر.ي" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="البيان..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0" disabled /></td>
                          <td className="p-1.5 text-center">2</td>
                        </tr>
                        <tr className="border-b text-slate-400">
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0.00" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="اختر الحساب من الدليل..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="ر.ي" disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="البيان..." disabled /></td>
                          <td className="p-1.5 border-l"><Input className="h-7 text-xs" placeholder="0" disabled /></td>
                          <td className="p-1.5 text-center">3</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
                <TabsContent value="other" className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 rounded border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">مركز التكلفة:</label>
                      <Input className="h-8 text-xs bg-white dark:bg-slate-800" placeholder="001 - المركز الرئيسي" />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">الفرع المالي:</label>
                      <Input className="h-8 text-xs bg-white dark:bg-slate-800" value="الفرع الرئيسي - صنعاء" readOnly />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="installments" className="mt-3 p-4 text-center text-slate-500 bg-slate-50 rounded border">
                  لا توجد أقساط مرتبطة بهذا السند حالياً.
                </TabsContent>
                <TabsContent value="attachments" className="mt-3 p-4 text-center text-slate-500 bg-slate-50 rounded border">
                  يمكن إرفاق فواتير المشتريات أو سندات الاستلام وسندات القبض الورقية هنا.
                </TabsContent>
                <TabsContent value="options" className="mt-3 p-4 text-slate-600 bg-slate-50 rounded border space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="cb_auto_post_pv" className="rounded" />
                    <label htmlFor="cb_auto_post_pv" className="font-bold">ترحيل السند آلياً إلى دفتر اليومية والأستاذ العام</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked id="cb_print_preview_pv" className="rounded" />
                    <label htmlFor="cb_print_preview_pv" className="font-bold">استعراض الطباعة بشاشة كاملة تلقائياً عند الحفظ</label>
                  </div>
                </TabsContent>
                <TabsContent value="notes" className="mt-3 p-4 bg-slate-50 rounded border">
                  <Input 
                    className="h-8 text-xs bg-white" 
                    placeholder="اكتب ملاحظات إضافية على السند..." 
                    value={paymentForm.notes} 
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} 
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Bottom Controls Bar (Fully Operational, Search + Fullscreen Preview) */}
            <div className="mt-3 flex items-center justify-between bg-slate-200 dark:bg-slate-800 p-2.5 rounded border shadow-sm flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button 
                  onClick={() => {
                    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
                      toast({ variant: "destructive", title: "يرجى إدخال مبلغ السند أولاً" });
                      return;
                    }
                    createVoucherMutation.mutate({ 
                      ...paymentForm, 
                      type: "payment",
                      amount: parseFloat(paymentForm.amount),
                      party_name: paymentForm.received_from
                    });
                    setShowPaymentDlg(false);
                    toast({ title: "تم حفظ وإصدار سند الصرف بنجاح", description: "المبلغ: " + paymentForm.amount + " " + paymentForm.currency });
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 px-4 font-bold shadow"
                >
                  حفظ
                </Button>

                {/* Operation 16: Full-Screen Print Preview */}
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={() => handlePreviewVoucher("payment")} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 font-bold shadow gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  طباعة استعراض في الشاشة كاملة
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePreviewVoucher("payment")} 
                  className="text-xs h-8 gap-1 border-slate-300 hover:bg-slate-100"
                >
                  <Printer className="w-3.5 h-3.5" /> 
                  طباعة
                </Button>

                {/* Fixed Search Button (Matching Double Journal Entry Search) */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setVoucherSearchType("payment");
                    setShowVoucherSearchDlg(true);
                  }} 
                  className="text-xs h-8 gap-1 border-slate-300 hover:bg-indigo-50 font-bold text-indigo-700"
                >
                  <Search className="w-3.5 h-3.5" /> 
                  بحث
                </Button>

                {/* Navigation Buttons: First, Prev, Next, Last */}
                <div className="flex items-center border rounded bg-white dark:bg-slate-900 shadow-sm">
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('first', 'payment')} title="السجل الأول" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&lt;&lt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('prev', 'payment')} title="السجل السابق" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&lt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('next', 'payment')} title="السجل التالي" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&gt;</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleNavigateVoucher('last', 'payment')} title="السجل الأخير" className="h-7 w-7 p-0 text-xs font-mono hover:bg-indigo-50">&gt;&gt;</Button>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const currentNo = paymentForm.voucher_no;
                    const found = allVouchersForNav.find((v: any) => (v.type === "payment") && String(v.voucher_number || v.id) === String(currentNo));
                    if (found && found.id) {
                      if (confirm(`هل أنت متأكد من حذف سند الصرف رقم #${currentNo}؟`)) {
                        deleteVoucherMutation.mutate(found.id);
                      }
                    } else {
                      toast({ variant: "destructive", title: "لم يتم العثور على السند الحالي للحذف" });
                    }
                  }} 
                  className="text-xs h-8 text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 
                  حذف
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast({ title: "معلومات السجل والنظام المحاسبي" })} className="h-8 w-8 p-0">
                  <Info className="w-4 h-4 text-slate-500" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Switch to English UI" })} className="text-xs h-8 font-mono">EN</Button>
                <Button variant="destructive" size="sm" onClick={() => setShowPaymentDlg(false)} className="text-xs h-8">خروج</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 15: VOUCHERS ADVANCED SEARCH DIALOG (مطابق لسند القيد المزدوج) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showVoucherSearchDlg} onOpenChange={setShowVoucherSearchDlg}>
          <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-4 dir-rtl text-xs z-[150]" dir="rtl">
            <DialogHeader>
              <div className="flex items-center justify-between border-b pb-2">
                <DialogTitle className="text-sm font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                  <Search className="w-4 h-4" />
                  {voucherSearchType === "receipt" ? "البحث والربط: سندات القبض ودليل الحسابات" : "البحث والربط: سندات الصرف ودليل الحسابات"}
                </DialogTitle>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
                  <Button
                    type="button"
                    size="sm"
                    variant={voucherSearchTab === "vouchers" ? "default" : "ghost"}
                    onClick={() => setVoucherSearchTab("vouchers")}
                    className={`text-xs h-7 px-3 font-bold ${voucherSearchTab === "vouchers" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
                  >
                    {voucherSearchType === "receipt" ? "سندات القبض السابقة" : "سندات الصرف السابقة"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={voucherSearchTab === "accounts" ? "default" : "ghost"}
                    onClick={() => setVoucherSearchTab("accounts")}
                    className={`text-xs h-7 px-3 font-bold ${voucherSearchTab === "accounts" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
                  >
                    دليل الحسابات (الطرف الثاني)
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {voucherSearchTab === "vouchers" ? (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded border">
                  <div className="col-span-6">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">بحث نصي (رقم السند، الحساب/الطرف، البيان، أو المرجع):</label>
                    <div className="relative">
                      <Input
                        value={voucherSearchQuery}
                        onChange={(e) => setVoucherSearchQuery(e.target.value)}
                        placeholder="اكتب رقم السند أو البيان للبحث الفوري..."
                        className="text-xs h-8 pr-8"
                        autoFocus
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">من تاريخ:</label>
                    <Input
                      type="date"
                      value={voucherSearchFromDate}
                      onChange={(e) => setVoucherSearchFromDate(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">إلى تاريخ:</label>
                    <Input
                      type="date"
                      value={voucherSearchToDate}
                      onChange={(e) => setVoucherSearchToDate(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                {/* Search Results Table */}
                <div className="border rounded-md overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-right divide-y">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border-l">رقم السند</th>
                        <th className="p-2 border-l">التاريخ</th>
                        <th className="p-2 border-l">اسم الطرف / الحساب</th>
                        <th className="p-2 border-l">البيان</th>
                        <th className="p-2 border-l text-center">العملة</th>
                        <th className="p-2 border-l text-center">المبلغ</th>
                        <th className="p-2 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredVouchersForSearch.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            لا توجد سندات تطابق معايير البحث المدخلة.
                          </td>
                        </tr>
                      ) : (
                        filteredVouchersForSearch.map((v: any) => (
                          <tr
                            key={v.id}
                            className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                            onClick={() => handleSelectVoucherFromSearch(v)}
                          >
                            <td className="p-2 border-l font-mono font-bold text-indigo-600">#{v.voucher_number || v.id}</td>
                            <td className="p-2 border-l font-mono text-slate-600">{v.created_at?.slice(0, 10) || "2026-08-13"}</td>
                            <td className="p-2 border-l font-bold">{v.party_name || "—"}</td>
                            <td className="p-2 border-l text-slate-600 max-w-xs truncate">{v.payment_against || v.notes || "—"}</td>
                            <td className="p-2 border-l text-center font-bold">
                              <Badge variant="outline" className="text-[10px] font-bold">
                                {v.currency || (voucherSearchType === "receipt" ? "SAR" : "YER")}
                              </Badge>
                            </td>
                            <td className="p-2 border-l text-center font-bold text-indigo-700 font-mono">
                              {fmt(v.amount)}
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectVoucherFromSearch(v);
                                }}
                              >
                                اختيار السند
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded border">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    البحث السريع في دليل الحسابات (بالاسم، الكود، أو نوع الحساب):
                  </label>
                  <div className="relative">
                    <Input
                      value={voucherAccountSearchQuery}
                      onChange={(e) => setVoucherAccountSearchQuery(e.target.value)}
                      placeholder="ابحث برقم الحساب مثل 11100 أو اسم الحساب مثل العملاء، البنوك، الصندوق..."
                      className="text-xs h-8 pr-8"
                      autoFocus
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  </div>
                </div>

                {/* Accounts Results Table */}
                <div className="border rounded-md overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-right divide-y">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border-l w-28">كود الحساب</th>
                        <th className="p-2 border-l">اسم الحساب</th>
                        <th className="p-2 border-l text-center">التصنيف / النوع</th>
                        <th className="p-2 border-l text-center">العملة الافتراضية</th>
                        <th className="p-2 text-center w-28">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAccountsForVoucherSearch.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            لا توجد حسابات تطابق نص البحث المدخل.
                          </td>
                        </tr>
                      ) : (
                        filteredAccountsForVoucherSearch.map((acc: any) => (
                          <tr
                            key={acc.id || acc.code}
                            className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                            onClick={() => handleSelectAccountForVoucher(acc)}
                          >
                            <td className="p-2 border-l font-mono font-bold text-indigo-600">{acc.code}</td>
                            <td className="p-2 border-l font-bold text-slate-800 dark:text-slate-200">{acc.name}</td>
                            <td className="p-2 border-l text-center text-slate-500">
                              <Badge variant="outline" className="text-[10px]">
                                {acc.type === 'asset' ? 'أصول' : acc.type === 'liability' ? 'خصوم' : acc.type === 'equity' ? 'حقوق ملكية' : acc.type === 'revenue' ? 'إيرادات' : acc.type === 'expense' ? 'مصروفات' : (acc.account_type_name || "دليل الحسابات")}
                              </Badge>
                            </td>
                            <td className="p-2 border-l text-center font-bold">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {acc.currency || "YER"}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                size="sm"
                                className="h-6 text-[11px] px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectAccountForVoucher(acc);
                                }}
                              >
                                اختيار الحساب
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter className="mt-3 flex justify-between items-center w-full">
              <span className="text-[11px] text-slate-500">
                {voucherSearchTab === "vouchers" ? (
                  <>إجمالي السجلات المطابقة: <strong className="text-indigo-600 font-mono">{filteredVouchersForSearch.length}</strong> سند</>
                ) : (
                  <>إجمالي الحسابات المطابقة: <strong className="text-indigo-600 font-mono">{filteredAccountsForVoucherSearch.length}</strong> حساب</>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowVoucherSearchDlg(false)} className="text-xs">
                إغلاق النافذة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    
        {/* Dialog: F9 Chart of Accounts Lookup (دليل الحسابات - F9) */}
        <Dialog open={showF9ChartDlg} onOpenChange={setShowF9ChartDlg}>
          <DialogContent dir="rtl" className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black flex items-center justify-between text-indigo-900 dark:text-indigo-300">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  دليل الحسابات الشامل (اختيار حساب - F9)
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 font-bold border-indigo-200">
                  {f9Target === "receipt" ? "سند قبض" : f9Target === "payment" ? "سند صرف" : "كشف حساب"}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البحث السريع بالحساب (الاسم، الكود، التصنيف):
                </label>
                <div className="relative">
                  <Input
                    value={f9SearchQuery}
                    onChange={(e) => setF9SearchQuery(e.target.value)}
                    placeholder="اكتب كود الحساب (11100) أو اسم الحساب (صندوق، بنك، عملاء)..."
                    className="text-xs h-8 pr-8 font-semibold"
                    autoFocus
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-right divide-y">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold sticky top-0 text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="p-2.5 border-l w-28">كود الحساب</th>
                      <th className="p-2.5 border-l">اسم الحساب</th>
                      <th className="p-2.5 border-l text-center">النوع / التصنيف</th>
                      <th className="p-2.5 border-l text-center">العملة الافتراضية</th>
                      <th className="p-2.5 text-center w-28">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {accountsList
                      .filter((acc: any) =>
                        !f9SearchQuery ||
                        String(acc.code || "").includes(f9SearchQuery) ||
                        String(acc.name || "").toLowerCase().includes(f9SearchQuery.toLowerCase()) ||
                        String(acc.account_type || "").toLowerCase().includes(f9SearchQuery.toLowerCase())
                      )
                      .map((acc: any) => (
                        <tr
                          key={acc.id || acc.code}
                          className="hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors"
                          onClick={() => {
                            if (f9Target === "receipt") {
                              setReceiptForm({ ...receiptForm, received_from: acc.name, party_id: String(acc.id || acc.code), currency: acc.currency || receiptForm.currency });
                              toast({ title: `تم اختيار الحساب (${acc.name}) لسند القبض` });
                            } else if (f9Target === "payment") {
                              setPaymentForm({ ...paymentForm, received_from: acc.name, party_id: String(acc.id || acc.code), currency: acc.currency || paymentForm.currency });
                              toast({ title: `تم اختيار الحساب (${acc.name}) لسند الصرف` });
                            } else if (f9Target === "statement") {
                              setSelectedPartyId(String(acc.id || acc.code));
                              setStatementPartyType("account");
                              toast({ title: `تم اختيار الحساب (${acc.name}) لكشف الحساب` });
                            }
                            setShowF9ChartDlg(false);
                          }}
                        >
                          <td className="p-2.5 border-l font-mono font-bold text-indigo-600">{acc.code}</td>
                          <td className="p-2.5 border-l font-bold text-slate-900 dark:text-slate-100">{acc.name}</td>
                          <td className="p-2.5 border-l text-center text-slate-500">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {acc.account_type || "حساب عام"}
                            </Badge>
                          </td>
                          <td className="p-2.5 border-l text-center font-bold">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {acc.currency || "SAR"}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <Button
                              size="sm"
                              className="h-6 text-[11px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                              اختيار
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center w-full">
              <span className="text-xs text-slate-500 font-bold">
                تنويه: يمكنك الضغط على <kbd className="bg-slate-100 border px-1 rounded font-mono text-[10px]">F9</kbd> بأي وقت لفتح هذه الشاشة.
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowF9ChartDlg(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <ReportViewerModal 
        isOpen={reportModalOpen} 
        onClose={() => setReportModalOpen(false)} 
        htmlContent={reportHtml} 
        thermalHtmlContent={reportThermalHtml}
        title={reportTitle} 
      />
    </AdminLayout>
  );
}
