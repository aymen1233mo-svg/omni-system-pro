import React, { useState, useRef, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { PosLayout } from "@/components/pos-layout";
import { useQuery } from "@tanstack/react-query";
import {
  useGetProducts, useGetCategories, useCreateOrder, useGetSettings,
  useGetReceiptCopyConfigs, useGetDepartmentPrintConfigs, useCreatePrintLog,
  usePrintReceiptDirect, useGetPrinterSettings
} from "@workspace/api-client-react";
import type { Product, OrderItemInput, Order } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, ShoppingCart, X, UtensilsCrossed, Lock, KeyRound, ShieldCheck, Unlock, Camera, Search, FileText, Info, History, BarChart3, TrendingUp } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { cn } from "@/lib/utils";
import { ReceiptPreview, MasterReceiptSlip, DeptReceiptSlip, ReceiptPrintArea } from "@/components/receipt";
import { getOfflinePrintQueue, addOfflinePrintJob, removeOfflinePrintJob } from "@/lib/printQueue";
import { ScannerDiagnosticDialog, ScanDiagnosticLog } from "@/components/scanner-diagnostic-dialog";
import { EmployeeBalanceBlockModal } from "@/components/EmployeeBalanceBlockModal";
import { Bug } from "lucide-react";

type CartItem = {
  product: Product;
  quantity: number;
};

export interface PosOrderTab {
  id: string;
  name: string;
  cart: CartItem[];
  selectedCategory: number | null;
  selectedCartIndex: number;
  discount: number;
  supervisorAuthorized: boolean;
  orderType: OrderType;
  tableNumber: string;
  note: string;
  paymentMethod: "cash" | "card" | "mixed" | "credit";
  cashGiven: string;
  mealMode: boolean;
  empNumInput: string;
  foundEmployee: any;
  selectedCustomerId: number | null;
  selectedSupplierId: number | null;
  creditPartyType: "customer" | "supplier";
}

type OrderType = "dine-in" | "takeout" | "delivery";

type PrintPage =
  | { type: "master"; copyLabel: string }
  | { type: "dept"; dept: any; items: any[] };

type PrintJob =
  | { kind: "browser-master"; copyLabel: string; logData: any }
  | { kind: "browser-dept";   dept: any; items: any[]; logData: any }
  | { kind: "direct-dept";    dept: any; items: any[]; logData: any };

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  "dine-in": "محلي",
  "takeout": "سفري",
  "delivery": "توصيل",
};

function generateReceiptText(order: Order, settings: any, cashierName: string, printerSettings?: any): string {
  const lines: string[] = [];
  const w = Number(printerSettings?.charactersPerLine || settings?.charactersPerLine || 40);
  
  // Left margin in spaces
  const leftMarginSpaces = Math.max(0, Math.floor((printerSettings?.leftMargin ?? 0) / 1.5));
  const padLeft = " ".repeat(leftMarginSpaces);

  const center = (s: string) => {
    if (s.length >= w) return s;
    const padLen = Math.floor((w - s.length) / 2);
    return " ".repeat(padLen) + s;
  };
  const line = (ch = "-") => ch.repeat(w);
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";

  // Top margin in newlines
  const topMarginLines = Math.max(0, Math.floor((printerSettings?.topMargin ?? 0) / 4));
  for (let i = 0; i < topMarginLines; i++) {
    lines.push("");
  }

  lines.push(center(settings?.businessName ?? "المطعم"));
  if (settings?.address) lines.push(center(settings.address));
  lines.push(line("."));
  lines.push(center("فاتورة خاصة بالزبون"));
  lines.push(center(`الرقم المسلسل: [ ${cleanInvoiceNumber} ]`));
  lines.push(line("."));
  let s1 = String(order.createdAt || "").trim();
  if (s1.includes(" ")) s1 = s1.replace(" ", "T");
  if (s1 && !s1.endsWith("Z") && !s1.match(/[+-]\d{2}:\d{2}$/)) s1 += "Z";
  const d = new Date(s1 || new Date());
  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const timeStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  lines.push(`التاريخ: ${dateStr}  ${timeStr}`);
  lines.push(`نوع الطلب: ${ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي"}`);
  lines.push(`الطاولة: ${order.tableNumber || "0"}    ط`);
  lines.push(line("-"));
  
  // Dynamic columns calculation to prevent wrapping
  const priceW = Math.max(8, Math.floor(w * 0.25));
  const qtyW = Math.max(4, Math.floor(w * 0.15));
  const nameW = w - priceW - qtyW;

  lines.push(`${"الصنف".padEnd(nameW)}${"الكمية".padStart(qtyW)}${"السعر".padStart(priceW)}`);
  lines.push(line("-"));
  for (const item of order.items ?? []) {
    const name = item.productName.substring(0, Math.max(5, nameW - 1)).padEnd(nameW);
    const qty = String(item.quantity).padStart(qtyW);
    const price = String(item.unitPrice.toLocaleString()).padStart(priceW);
    lines.push(`${name}${qty}${price}`);
  }
  lines.push(line("-"));
  
  const totalStr = `الإجمالي: ${order.total.toFixed(2)} ${settings?.currency ?? "ريال"}`;
  lines.push(totalStr.padStart(w));
  lines.push(line("="));
  if (cashierName) lines.push(center(cashierName));
  if (order.note) lines.push(`ملاحظات: ${order.note}`);
  lines.push(line("-"));
  lines.push(center("الطلب لا يمكن استرجاعه أو إلغاؤه"));
  if (settings?.phone) lines.push(center(settings.phone));
  
  // Bottom margin in newlines
  const bottomMarginLines = Math.max(3, Math.floor((printerSettings?.bottomMargin ?? 8) / 2));
  for (let i = 0; i < bottomMarginLines; i++) {
    lines.push("");
  }

  // Prepend left margin to all lines
  return lines.map(l => l ? padLeft + l : l).join("\n");
}

function generateDeptReceiptText(order: Order, dept: any, items: any[], settings: any, printerSettings?: any): string {
  const lines: string[] = [];
  const w = Number(printerSettings?.charactersPerLine || settings?.charactersPerLine || 32);

  // Left margin in spaces
  const leftMarginSpaces = Math.max(0, Math.floor((printerSettings?.leftMargin ?? 0) / 1.5));
  const padLeft = " ".repeat(leftMarginSpaces);

  const center = (s: string) => {
    if (s.length >= w) return s;
    const padLen = Math.floor((w - s.length) / 2);
    return " ".repeat(padLen) + s;
  };
  const line = (ch = "-") => ch.repeat(w);
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";

  // Top margin in newlines
  const topMarginLines = Math.max(0, Math.floor((printerSettings?.topMargin ?? 0) / 4));
  for (let i = 0; i < topMarginLines; i++) {
    lines.push("");
  }

  lines.push(center(settings?.businessName ?? "المطعم"));
  lines.push(center(`قسم: ${dept.categoryName}`));
  lines.push(line("."));
  lines.push(center(`أمر صرف رقم: [ ${cleanInvoiceNumber} ]`));
  lines.push(line("-"));
  let s2 = String(order.createdAt || "").trim();
  if (s2.includes(" ")) s2 = s2.replace(" ", "T");
  if (s2 && !s2.endsWith("Z") && !s2.match(/[+-]\d{2}:\d{2}$/)) s2 += "Z";
  const d = new Date(s2 || new Date());
  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const timeStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  lines.push(`التاريخ: ${dateStr}  ${timeStr}`);
  lines.push(`نوع الطلب: ${ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي"}`);
  lines.push(`الطاولة: ${order.tableNumber || "0"}    ط`);
  lines.push(line("="));
  
  // Dynamic column layout
  const qtyW = Math.max(4, Math.floor(w * 0.15));
  const nameW = w - qtyW;

  for (const item of items) {
    const name = item.productName.substring(0, Math.max(5, nameW - 1)).padEnd(nameW);
    const qty = `x${item.quantity}`.padStart(qtyW);
    lines.push(`${name}${qty}`);
  }
  lines.push(line("="));
  if (order.note) lines.push(`ملاحظات: ${order.note}`);
  
  // Bottom margin in newlines
  const bottomMarginLines = Math.max(3, Math.floor((printerSettings?.bottomMargin ?? 8) / 2));
  for (let i = 0; i < bottomMarginLines; i++) {
    lines.push("");
  }

  // Prepend left margin to all lines
  return lines.map(l => l ? padLeft + l : l).join("\n");
}

export default function Pos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: products = [] } = useGetProducts({ show_in_pos: true });
  const { data: categories = [] } = useGetCategories();
  const { data: settings } = useGetSettings();
  const { data: printerSettings } = useGetPrinterSettings();
  const { data: receiptCopies = [] } = useGetReceiptCopyConfigs();
  const { data: deptConfigs = [] } = useGetDepartmentPrintConfigs();
  const { data: employees = [] } = useQuery({
    queryKey: ["pos-employees-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const resp = await fetch("/api/hr/employees", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) return [];
      return resp.json();
    }
  });
  const { data: safes = [] } = useQuery({
    queryKey: ["safes-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/safes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/customers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? "";
      const r = await fetch("/api/suppliers", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return [];
      return r.json();
    }
  });

  const createOrderMutation = useCreateOrder();
  const createPrintLog = useCreatePrintLog();
  const printReceiptDirect = usePrintReceiptDirect();

  const createNewTab = (tabIndex: number): PosOrderTab => ({
    id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `فاتورة ${tabIndex}`,
    cart: [],
    selectedCategory: null,
    selectedCartIndex: 0,
    discount: 0,
    supervisorAuthorized: false,
    orderType: "dine-in",
    tableNumber: "",
    note: "",
    paymentMethod: "cash",
    cashGiven: "",
    mealMode: false,
    empNumInput: "",
    foundEmployee: null,
    selectedCustomerId: null,
    selectedSupplierId: null,
    creditPartyType: "customer",
  });

  const [tabs, setTabs] = useState<PosOrderTab[]>(() => [
    {
      id: `tab_initial_${Date.now()}`,
      name: "فاتورة 1",
      cart: [],
      selectedCategory: null,
      selectedCartIndex: 0,
      discount: 0,
      supervisorAuthorized: false,
      orderType: "dine-in",
      tableNumber: "",
      note: "",
      paymentMethod: "cash",
      cashGiven: "",
      mealMode: false,
      empNumInput: "",
      foundEmployee: null,
      selectedCustomerId: null,
      selectedSupplierId: null,
      creditPartyType: "customer",
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || "tab-1");
  const [typedNumberBuffer, setTypedNumberBuffer] = useState("");
  const [isQtyEditing, setIsQtyEditing] = useState(false);
  const [qtyEditBuffer, setQtyEditBuffer] = useState("");
  const [lastEnterTimestamp, setLastEnterTimestamp] = useState(0);
  const [showSupervisorDialog, setShowSupervisorDialog] = useState(false);
  const [supervisorUsername, setSupervisorUsername] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [isAuthorizingSupervisor, setIsAuthorizingSupervisor] = useState(false);
  const [showScannerDiagnostics, setShowScannerDiagnostics] = useState(false);
  const [scannerDiagnosticLogs, setScannerDiagnosticLogs] = useState<ScanDiagnosticLog[]>([]);

  // ── استدعاء وإعادة طباعة آخر فاتورة مع التحكم بالصلاحيات ──
  const [showLastInvoiceModal, setShowLastInvoiceModal] = useState(false);
  const [lastInvoiceData, setLastInvoiceData] = useState<Order | null>(null);
  const [loadingLastInvoice, setLoadingLastInvoice] = useState(false);

  const parseLastInvoicePerm = useCallback((permRaw?: string | null) => {
    const p = String(permRaw || "all").trim().toLowerCase();
    if (p === "disabled" || p === "hide") {
      return { canOpen: false, canMaster: false, canDept: false, canAll: false, mode: "disabled" };
    }
    if (p === "none") {
      return { canOpen: true, canMaster: false, canDept: false, canAll: false, mode: "none" };
    }
    if (p === "all") {
      return { canOpen: true, canMaster: true, canDept: true, canAll: true, mode: "all" };
    }
    if (p === "master_only") {
      return { canOpen: true, canMaster: true, canDept: false, canAll: false, mode: "master_only" };
    }
    if (p === "departments_only" || p === "dept_only") {
      return { canOpen: true, canMaster: false, canDept: true, canAll: false, mode: "departments_only" };
    }
    if (p === "master_and_dept") {
      return { canOpen: true, canMaster: true, canDept: true, canAll: false, mode: "master_and_dept" };
    }
    if (p === "all_only") {
      return { canOpen: true, canMaster: false, canDept: false, canAll: true, mode: "all_only" };
    }
    const tokens = p.replace(/^custom:/, "").split(",").map(s => s.trim()).filter(Boolean);
    const canMaster = tokens.includes("master") || tokens.includes("master_only");
    const canDept = tokens.includes("dept") || tokens.includes("departments") || tokens.includes("departments_only") || tokens.includes("dept_only");
    const canAll = tokens.includes("all") || tokens.includes("all_only");
    return {
      canOpen: !tokens.includes("disabled") && !tokens.includes("hide"),
      canMaster,
      canDept,
      canAll,
      mode: "custom"
    };
  }, []);

  const effectiveLastInvoicePermStr = (() => {
    const userPerm = String((user as any)?.perm_last_invoice_reprint || "").trim();
    const sysPerm = String((settings as any)?.showLastInvoiceReprintButtons || "").trim();
    if (userPerm && userPerm !== "all") return userPerm;
    if (sysPerm && sysPerm !== "all") return sysPerm;
    return userPerm || sysPerm || "all";
  })();

  const lastInvoicePermFlags = parseLastInvoicePerm(effectiveLastInvoicePermStr);

  const fetchAndOpenLastInvoice = async () => {
    if (!lastInvoicePermFlags.canOpen) {
      toast({
        variant: "destructive",
        title: "🔒 غير مصرح",
        description: "تم إيقاف صلاحية استخدام زر آخر فاتورة لهذا المستخدم من قِبل إدارة النظام"
      });
      return;
    }
    setLoadingLastInvoice(true);
    try {
      const token = localStorage.getItem("pos_token") ?? sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/orders/last", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "لا توجد فواتير سابقة مسجلة");
      setLastInvoiceData(data);
      setShowLastInvoiceModal(true);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "تنبيه آخر فاتورة",
        description: err.message || "لا توجد فواتير صادرة سابقة"
      });
    } finally {
      setLoadingLastInvoice(false);
    }
  };

  const { data: lastInvoiceSummary, refetch: refetchLastInvoice } = useQuery({
    queryKey: ["last-invoice-summary"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/orders/last", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: nextInvoiceCounter, refetch: refetchNextInvoiceCounter } = useQuery({
    queryKey: ["next-pos-invoice-number"],
    queryFn: async () => {
      const token = localStorage.getItem("pos_token") ?? sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/orders/next-invoice-number", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 10000,
  });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateActiveTab = useCallback((patch: Partial<PosOrderTab> | ((prev: PosOrderTab) => PosOrderTab)) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== (activeTab?.id || prev[0]?.id)) return t;
      const updated = typeof patch === "function" ? patch(t) : { ...t, ...patch };
      return updated;
    }));
  }, [activeTab?.id]);

  const cart = activeTab.cart;
  const setCart = useCallback((action: React.SetStateAction<CartItem[]>) => {
    updateActiveTab(prev => ({
      ...prev,
      cart: typeof action === "function" ? action(prev.cart) : action
    }));
  }, [updateActiveTab]);

  const selectedCategory = activeTab.selectedCategory;
  const setSelectedCategory = useCallback((cat: number | null) => {
    updateActiveTab({ selectedCategory: cat });
  }, [updateActiveTab]);

  const selectedCartIndex = activeTab.selectedCartIndex;
  const setSelectedCartIndex = useCallback((action: React.SetStateAction<number>) => {
    updateActiveTab(prev => ({
      ...prev,
      selectedCartIndex: typeof action === "function" ? action(prev.selectedCartIndex) : action
    }));
  }, [updateActiveTab]);

  const discount = activeTab.discount;
  const setDiscount = useCallback((d: number) => {
    updateActiveTab({ discount: d });
  }, [updateActiveTab]);

  const supervisorAuthorized = activeTab.supervisorAuthorized;
  const setSupervisorAuthorized = useCallback((auth: boolean) => {
    updateActiveTab({ supervisorAuthorized: auth });
  }, [updateActiveTab]);

  const orderType = activeTab.orderType;
  const setOrderType = useCallback((ot: OrderType) => {
    updateActiveTab({ orderType: ot });
  }, [updateActiveTab]);

  const tableNumber = activeTab.tableNumber;
  const setTableNumber = useCallback((tn: string) => {
    updateActiveTab({ tableNumber: tn });
  }, [updateActiveTab]);

  const note = activeTab.note;
  const setNote = useCallback((n: string) => {
    updateActiveTab({ note: n });
  }, [updateActiveTab]);

  const paymentMethod = activeTab.paymentMethod;
  const setPaymentMethod = useCallback((pm: "cash" | "card" | "mixed") => {
    updateActiveTab({ paymentMethod: pm });
  }, [updateActiveTab]);

  const cashGiven = activeTab.cashGiven;
  const setCashGiven = useCallback((cg: string) => {
    updateActiveTab({ cashGiven: cg });
  }, [updateActiveTab]);

  const selectedCustomerId = activeTab.selectedCustomerId;
  const setSelectedCustomerId = useCallback((id: number | null) => {
    updateActiveTab({ selectedCustomerId: id });
  }, [updateActiveTab]);

  const selectedSupplierId = activeTab.selectedSupplierId;
  const setSelectedSupplierId = useCallback((id: number | null) => {
    updateActiveTab({ selectedSupplierId: id });
  }, [updateActiveTab]);

  const creditPartyType = activeTab.creditPartyType || "customer";
  const setCreditPartyType = useCallback((t: "customer" | "supplier") => {
    updateActiveTab({ creditPartyType: t });
  }, [updateActiveTab]);

  const mealMode = activeTab.mealMode;
  const setMealMode = useCallback((action: React.SetStateAction<boolean>) => {
    updateActiveTab(prev => ({
      ...prev,
      mealMode: typeof action === "function" ? action(prev.mealMode) : action
    }));
  }, [updateActiveTab]);

  const empNumInput = activeTab.empNumInput;
  const setEmpNumInput = useCallback((emp: string) => {
    updateActiveTab({ empNumInput: emp });
  }, [updateActiveTab]);

  const foundEmployee = activeTab.foundEmployee;
  const setFoundEmployee = useCallback((fe: any) => {
    updateActiveTab({ foundEmployee: fe });
  }, [updateActiveTab]);

  const userRole = user?.role as string;
  const isPrivilegedUser = userRole === "admin" || userRole === "developer" || userRole === "general_manager" || Boolean((user as any)?.is_system_admin);
  const userCanDiscount = isPrivilegedUser || Boolean(user?.can_discount || (user as any)?.perm_pos_discount);
  const allowCashierDiscount = settings?.allowCashierDiscount ?? false;
  const canApplyDiscount = isPrivilegedUser || userCanDiscount || (allowCashierDiscount && (user as any)?.perm_pos_discount !== false) || supervisorAuthorized;

  // Granular POS permission flags - evaluate system settings & cashier user permissions
  const userCanEmployeeMeal = isPrivilegedUser || Boolean((user as any)?.allow_meal_deduction || (user as any)?.perm_pos_employee_invoice);
  const canDineIn = ((settings as any)?.allowPosDineIn !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_dinein !== false) : ((user as any)?.perm_pos_dinein !== undefined ? Boolean((user as any)?.perm_pos_dinein) : true));
  const canTakeout = ((settings as any)?.allowPosTakeout !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_takeaway !== false) : ((user as any)?.perm_pos_takeaway !== undefined ? Boolean((user as any)?.perm_pos_takeaway) : true));
  const canDelivery = ((settings as any)?.allowPosDelivery !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_delivery !== false) : ((user as any)?.perm_pos_delivery !== undefined ? Boolean((user as any)?.perm_pos_delivery) : true));
  const canCash = ((settings as any)?.allowPosCash !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_cash !== false) : ((user as any)?.perm_pos_cash !== undefined ? Boolean((user as any)?.perm_pos_cash) : true));
  const canCard = ((settings as any)?.allowPosCard !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_card !== false) : ((user as any)?.perm_pos_card !== undefined ? Boolean((user as any)?.perm_pos_card) : true));
  const canMixed = ((settings as any)?.allowPosMixed !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_mixed !== false) : ((user as any)?.perm_pos_mixed !== undefined ? Boolean((user as any)?.perm_pos_mixed) : (canCash && canCard)));
  const canCredit = ((settings as any)?.allowPosCredit !== false) && (isPrivilegedUser ? ((user as any)?.perm_pos_credit !== false) : ((user as any)?.perm_pos_credit !== undefined ? Boolean((user as any)?.perm_pos_credit) : true));

  const availableOrderTypes: OrderType[] = (["dine-in", "takeout", "delivery"] as OrderType[]).filter(t => {
    if (t === "dine-in") return canDineIn;
    if (t === "takeout") return canTakeout;
    if (t === "delivery") return canDelivery;
    return true;
  });

  const availablePaymentMethods = (["cash", "card", "mixed", "credit"] as const).filter(m => {
    if (m === "cash") return canCash;
    if (m === "card") return canCard;
    if (m === "mixed") return canMixed;
    if (m === "credit") return canCredit;
    return true;
  });

  const handleAddNewTab = () => {
    const nextNum = tabs.length + 1;
    const newTab = createNewTab(nextNum);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    toast({ title: `📄 تم فتح ${newTab.name}`, description: "واجهة إضافية لإدخال فاتورة جديدة بالتوازي" });
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tabs.length <= 1) {
      updateActiveTab({
        cart: [],
        discount: 0,
        supervisorAuthorized: false,
        tableNumber: "",
        note: "",
        cashGiven: "",
        mealMode: false,
        empNumInput: "",
        foundEmployee: null,
        selectedCartIndex: 0
      });
      toast({ title: "🗑️ تم تفريغ الفاتورة الحالية" });
      return;
    }
    const target = tabs.find(t => t.id === tabId);
    if (target && target.cart.length > 0) {
      if (!confirm(`هل أنت متأكد من إغلاق ${target.name} وبها ${target.cart.length} صنف؟`)) {
        return;
      }
    }
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleAuthorizeSupervisor = async () => {
    if (!supervisorUsername.trim() || !supervisorPassword.trim()) {
      toast({ variant: "destructive", title: "بيانات غير مكتملة", description: "يرجى إدخال اسم المستخدم وكلمة المرور للمدير / المشرف" });
      return;
    }
    setIsAuthorizingSupervisor(true);
    try {
      const resp = await fetch("/api/auth/verify-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: supervisorUsername.trim(),
          password: supervisorPassword.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "فشل التحقق من صلاحية المدير");
      }
      setSupervisorAuthorized(true);
      setShowSupervisorDialog(false);
      setSupervisorUsername("");
      setSupervisorPassword("");
      toast({
        title: "🔓 تم منح إذن الخصم",
        description: `تمت الموافقة بنجاح بواسطة: ${data.name || "المدير"}`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل منح الإذن",
        description: err.message || "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    } finally {
      setIsAuthorizingSupervisor(false);
    }
  };

  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEmpPicker, setShowEmpPicker] = useState(false);
  const [empPickerSearch, setEmpPickerSearch] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [reprintReason, setReprintReason] = useState("");
  const [showReprintDialog, setShowReprintDialog] = useState(false);
  const [activePrintPage, setActivePrintPage] = useState<PrintPage | null>(null);
  const [selectedSafeId, setSelectedSafeId] = useState<number | null>(null);

  useEffect(() => {
    if (safes.length > 0 && selectedSafeId === null) {
      const active = safes.find(s => s.active);
      if (active) setSelectedSafeId(active.id);
      else setSelectedSafeId(safes[0].id);
    }
  }, [safes, selectedSafeId]);

  // ── وجبات الموظفين ──
  const [showMealConfirm, setShowMealConfirm] = useState(false);
  const [showBalanceBlockModal, setShowBalanceBlockModal] = useState(false);
  const [lookingUpEmp, setLookingUpEmp] = useState(false);
  const [offlineJobsCount, setOfflineJobsCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setOfflineJobsCount(getOfflinePrintQueue().length);
    };
    updateCount();
    window.addEventListener("print-queue-updated", (e: any) => {
      setOfflineJobsCount(e.detail?.count ?? getOfflinePrintQueue().length);
    });

    // Background auto-retry worker every 20 seconds
    const interval = setInterval(async () => {
      const queue = getOfflinePrintQueue();
      if (queue.length === 0) return;

      let successCount = 0;
      for (const job of queue) {
        try {
          const res: any = await new Promise((resolve) => {
            printReceiptDirect.mutate(
              { data: { printerName: job.printerName, content: job.content, copies: job.copies } },
              {
                onSuccess: (data) => resolve(data),
                onError: (err) => resolve({ ok: false, message: err?.message }),
              }
            );
          });
          if (res && res.ok) {
            removeOfflinePrintJob(job.id);
            successCount++;
          }
        } catch (e) {
          break;
        }
      }

      if (successCount > 0) {
        toast({
          title: "🖨️ تم طباعة الفواتير المعلقة بنجاح",
          description: `تم إرسال ${successCount} فاتورة معلقة للطابعة بعد استعادة الاتصال بها.`
        });
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const retryOfflineQueue = async () => {
    const queue = getOfflinePrintQueue();
    if (queue.length === 0) {
      toast({ title: "لا توجد فواتير معلقة" });
      return;
    }
    let successCount = 0;
    for (const job of queue) {
      try {
        const res: any = await new Promise((resolve) => {
          printReceiptDirect.mutate(
            { data: { printerName: job.printerName, content: job.content, copies: job.copies } },
            {
              onSuccess: (data) => resolve(data),
              onError: (err) => resolve({ ok: false, message: err?.message }),
            }
          );
        });
        if (res && res.ok) {
          removeOfflinePrintJob(job.id);
          successCount++;
        }
      } catch (e) {
        // continue
      }
    }

    if (successCount > 0) {
      toast({
        title: "🖨️ تم طباعة الفواتير المعلقة بنجاح",
        description: `تم إرسال ${successCount} فاتورة معلقة للطابعة بنجاح.`
      });
    } else {
      toast({
        variant: "destructive",
        title: "⚠️ تعذر الاتصال بالطابعة",
        description: "ما زالت الطابعة غير متصلة أو لا تستجيب. حاول مرة أخرى لاحقاً."
      });
    }
  };

  const taxRate = settings?.taxRate ?? 15;
  const currency = settings?.currency ?? "ريال";
  const autoPrintTrigger = settings?.autoPrintTrigger ?? "print_button";

  const filteredProducts = React.useMemo(() => {
    return [...products]
      .filter(p => {
        if (!p.active) return false;
        if (selectedCategory !== null && p.categoryId !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => {
        const orderA = (a as any).sort_order ?? a.number ?? a.id;
        const orderB = (b as any).sort_order ?? b.number ?? b.id;
        return Number(orderA) - Number(orderB);
      });
  }, [products, selectedCategory]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, [setCart]);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }, [setCart]);

  const changeQty = useCallback((productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? null : { ...i, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  }, [setCart]);

  const matchProductBarcode = (productBarcode: string | null | undefined, scannedCode: string): { matches: boolean; reason: string } => {
    if (!productBarcode) return { matches: false, reason: "المنتج لا يحتوي على باركود مسجل" };
    
    // Clean and normalize both strings
    const pCode = productBarcode.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim().toLowerCase();
    const sCode = scannedCode.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim().toLowerCase();
    
    if (pCode === sCode) {
      return { matches: true, reason: `تطابق تام ومباشر (${pCode} === ${sCode})` };
    }
    
    // Strip leading zeroes (UPC-A / EAN-13 conversions: 0768071007488 <=> 768071007488)
    const pNoZero = pCode.replace(/^0+/, "");
    const sNoZero = sCode.replace(/^0+/, "");
    if (pNoZero && sNoZero && pNoZero === sNoZero) {
      return { matches: true, reason: `تطابق بعد تجريد الأصفار البادئة: [${pCode}] <=> [${sCode}]` };
    }
    
    // Only check prefix/suffix for valid barcodes (8+ characters) to prevent single/double digits matching
    if (sCode.length >= 8 && pCode.length >= 8) {
      if (sCode.endsWith(pCode) || pCode.endsWith(sCode)) {
        return { matches: true, reason: `تطابق لاحقة/بادئة باركود (${pCode} ~ ${sCode})` };
      }
    }
    
    return { matches: false, reason: "لا يوجد تطابق" };
  };

  const findProductByScannedCode = useCallback((scannedCode: string): { product?: Product; matchReason: string } => {
    const raw = scannedCode.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    if (!raw) return { matchReason: "الرمز فارغ" };
    const num = parseInt(raw, 10);
    const isPureNumber = /^\d+$/.test(raw) && !isNaN(num);

    const activeProducts = products.filter(p => p.active !== false);

    // 1) First Priority for pure numbers: Match exact Meal / Product Number (p.number)
    if (isPureNumber) {
      const matchByNumber = activeProducts.find(p => p.number !== null && p.number !== undefined && (p.number === num || String(p.number) === raw));
      if (matchByNumber) {
        return { product: matchByNumber, matchReason: `تطابق تام مع رقم الوجبة (${matchByNumber.number})` };
      }
    }

    // 2) Match Barcode (for barcode scanners or manual barcode entry)
    for (const p of activeProducts) {
      const res = matchProductBarcode(p.barcode, raw);
      if (res.matches) {
        return { product: p, matchReason: res.reason };
      }
    }

    // 3) Match Product ID ONLY for products that do NOT have a custom meal number set (or p.number === p.id)
    if (isPureNumber) {
      const matchByIdOnly = activeProducts.find(p => 
        (p.number === null || p.number === undefined || p.number === 0 || p.number === p.id) &&
        p.id === num
      );
      if (matchByIdOnly) {
        return { product: matchByIdOnly, matchReason: `تطابق مع كود الصنف (ID: ${matchByIdOnly.id})` };
      }
    }

    // 4) Match Product Name (if text)
    if (!isPureNumber) {
      const rawLower = raw.toLowerCase();
      const exactName = activeProducts.find(p => p.name.toLowerCase().trim() === rawLower);
      if (exactName) {
        return { product: exactName, matchReason: `تطابق تام مع اسم الصنف (${exactName.name})` };
      }
    }

    return { matchReason: `الرقم أو الرمز "${raw}" غير مرتبط بأي منتج في النظام` };
  }, [products]);

  const handleBarcodeScan = useCallback((scannedCode: string) => {
    const raw = scannedCode.trim();
    if (!raw) return;
    
    const clean = raw.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    const timestampStr = new Date().toLocaleTimeString();

    // ── Diagnostic Console Logging ──
    console.group(`🔍 [POS Scanner Diagnostic] Scanned: "${clean}" (Raw length: ${raw.length}, Clean length: ${clean.length})`);
    console.log("Raw Scanned Input:", {
      rawInput: raw,
      cleanInput: clean,
      length: clean.length,
      charCodes: Array.from(clean).map((c, idx) => `[${idx}] '${c}' (ASCII ${c.charCodeAt(0)})`),
      timestamp: new Date().toISOString()
    });

    const { product: prod, matchReason } = findProductByScannedCode(clean);

    const logEntry: ScanDiagnosticLog = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timestampStr,
      rawCode: raw,
      cleanCode: clean,
      length: clean.length,
      matched: !!prod,
      matchedProduct: prod ? {
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        price: prod.price,
        stock: prod.stock,
        active: prod.active
      } : undefined,
      details: matchReason
    };

    setScannerDiagnosticLogs(prev => [logEntry, ...prev.slice(0, 49)]);

    if (prod) {
      console.info(`✅ MATCH SUCCESS! Product #${prod.id} "${prod.name}"`, {
        id: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        price: prod.price,
        stock: prod.stock,
        matchReason
      });
      console.log("Adding product to POS cart...");
      addToCart(prod);
      toast({ 
        title: "📷 تم مسح الباركود بنجاح", 
        description: `✅ تم إضافة ${prod.name} (${prod.price} ${currency}) إلى السلة` 
      });
    } else {
      console.warn(`❌ NO INVENTORY MATCH for scanned barcode: "${clean}".`, {
        attemptedBarcode: clean,
        totalInventoryProducts: products.length,
        activeProductsWithBarcode: products.filter(p => p.barcode && p.active !== false).map(p => ({ id: p.id, name: p.name, barcode: p.barcode }))
      });
      console.table(products.filter(p => p.barcode).map(p => ({ ID: p.id, Name: p.name, Barcode: p.barcode, Active: p.active })));
      toast({ 
        variant: "destructive", 
        title: "تنبيه: الباركود غير مضاف", 
        description: `الباركود (${clean}) غير مضاف أو غير مرتبط بمنتج في النظام` 
      });
    }
    console.groupEnd();
  }, [findProductByScannedCode, addToCart, currency, toast, products]);

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmt = Math.min(discount, subtotal);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmt;

  // ── Keyboard Shortcuts Integration ──────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPayDialog) setShowPayDialog(false);
        if (showReceipt) setShowReceipt(false);
        if (showMealConfirm) { setShowMealConfirm(false); setFoundEmployee(null); }
        if (showReprintDialog) setShowReprintDialog(false);
        setTypedNumberBuffer("");
        setIsQtyEditing(false);
        return;
      }

      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        const targetIndex = parseInt(e.key) - 1;
        if (targetIndex < tabs.length) {
          e.preventDefault();
          setActiveTabId(tabs[targetIndex].id);
          return;
        }
      }

      if ((e.ctrlKey && (e.key === "t" || e.key === "T")) || e.key === "F4") {
        e.preventDefault();
        handleAddNewTab();
        return;
      }

      if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        handleCloseTab(activeTabId);
        return;
      }

      if (["F1", "F2", "F3", "F4", "F5", "F7", "F8", "F9"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "F1") {
        setTypedNumberBuffer("");
        return;
      }

      if (e.key === "F2") {
        if (cart.length > 0 && !showPayDialog && !showReceipt && !showMealConfirm) {
          handlePay();
        }
        return;
      }

      if (e.key === "F3") {
        if (cart.length > 0 && !showPayDialog && !showReceipt && !showMealConfirm) {
          setCart([]);
          setDiscount(0);
          setSupervisorAuthorized(false);
          setSelectedCartIndex(0);
          toast({ title: "🗑️ تم إفراغ السلة", description: "تم مسح جميع المنتجات من السلة" });
        }
        return;
      }

      if (e.key === "F7") {
        if (!showPayDialog && !showReceipt && !showMealConfirm) {
          const types: OrderType[] = ["dine-in", "takeout", "delivery"];
          const currentIndex = types.indexOf(orderType);
          const nextIndex = (currentIndex + 1) % types.length;
          setOrderType(types[nextIndex]);
          toast({ title: "📋 نوع الطلب", description: `تم التغيير إلى: ${ORDER_TYPE_LABELS[types[nextIndex]]}` });
        }
        return;
      }

      if (e.key === "F5") {
        if (!showPayDialog && !showReceipt && !showMealConfirm) {
          setMealMode(prev => {
            const newVal = !prev;
            if (newVal) setEmpNumInput("");
            return newVal;
          });
        }
        return;
      }

      if (e.key === "F8") {
        if (!isPrivilegedUser) {
          toast({ variant: "destructive", title: "غير مصرح", description: "إعادة الطباعة مسموحة للمدير أو المحاسب فقط" });
          return;
        }
        if (lastOrder) {
          handleReprint();
        } else {
          toast({ variant: "destructive", title: "لا يوجد طلب سابق لإعادة طباعته" });
        }
        return;
      }

      if (e.key === "F9") {
        fetchAndOpenLastInvoice();
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      );

      if (isInputFocused && !showPayDialog) return;

      if (showPayDialog && e.key === "Enter") {
        e.preventDefault();
        confirmPay();
        return;
      }

      // Arrow Up
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cart.length > 0) {
          setIsQtyEditing(false);
          setSelectedCartIndex(prev => Math.max(0, prev - 1));
        }
        return;
      }

      // Arrow Down
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cart.length > 0) {
          setIsQtyEditing(false);
          setSelectedCartIndex(prev => Math.min(cart.length - 1, prev + 1));
        }
        return;
      }

      // Side Arrows (ArrowLeft / ArrowRight) to toggle Qty Editing
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          setIsQtyEditing(prev => {
            const next = !prev;
            if (next) {
              setQtyEditBuffer(String(cart[selectedCartIndex].quantity));
            }
            return next;
          });
        }
        return;
      }

      if (cart.length > 0) {
        const targetIdx = selectedCartIndex >= 0 && selectedCartIndex < cart.length ? selectedCartIndex : cart.length - 1;
        const targetItem = cart[targetIdx];
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          changeQty(targetItem.product.id, 1);
          return;
        } else if (e.key === "-") {
          e.preventDefault();
          changeQty(targetItem.product.id, -1);
          return;
        }
      }

      // Barcode / Number keys (0-9, A-Z, a-z, and hyphens)
      if (/^[0-9a-zA-Z\-_]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (isQtyEditing && cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          if (/^[0-9]$/.test(e.key)) {
            const newBuf = qtyEditBuffer + e.key;
            setQtyEditBuffer(newBuf);
            const val = parseInt(newBuf);
            if (!isNaN(val) && val > 0) {
              const targetItem = cart[selectedCartIndex];
              const diff = val - targetItem.quantity;
              if (diff !== 0) {
                changeQty(targetItem.product.id, diff);
              }
            }
          }
        } else {
          setTypedNumberBuffer(prev => prev + e.key);
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (isQtyEditing) {
          setQtyEditBuffer(prev => prev.slice(0, -1));
        } else {
          setTypedNumberBuffer(prev => prev.slice(0, -1));
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const rawBuffer = typedNumberBuffer.trim();
        if (rawBuffer) {
          const { product: prod, matchReason } = findProductByScannedCode(rawBuffer);
          if (prod) {
            addToCart(prod);
            setTypedNumberBuffer("");
            toast({ title: "🛒 تم إضافة الصنف إلى السلة", description: `✅ ${prod.name} (${prod.price} ${currency})` });
          } else {
            toast({ variant: "destructive", title: "الصنف غير موجود", description: `لم يتم العثور على أي وجبة أو صنف بالرمز (${rawBuffer})` });
            setTypedNumberBuffer("");
          }
        } else if (cart.length > 0) {
          const now = Date.now();
          if (now - lastEnterTimestamp < 600) {
            handlePay();
          }
          setLastEnterTimestamp(now);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const handlePay = () => {
    if (cart.length === 0) return;
    setShowPayDialog(true);
  };

  const getDeptGroups = (order: Order) => {
    // تجميع عناصر الطلب حسب التصنيف بشكل إلزامي بحيث تخرج لكل تصنيف فاتورة صغيرة منفصلة
    const categoryMap = new Map<string, {
      categoryId: number | null;
      categoryName: string | null;
      items: NonNullable<Order["items"]>;
      printOrder: number;
    }>();

    for (const item of order.items ?? []) {
      const matchedProduct = products.find(p => p.id === (item as any).productId);
      const resolvedCategoryId = item.categoryId ?? matchedProduct?.categoryId ?? null;
      const matchedCat = categories.find(c => c.id === resolvedCategoryId);
      const resolvedCategoryName = (item.categoryName && item.categoryName.trim())
        ? item.categoryName.trim()
        : (matchedCat?.name ?? "قسم التحضير");

      const key = resolvedCategoryId !== null
        ? `cat_${resolvedCategoryId}`
        : `name_${resolvedCategoryName}`;

      if (!categoryMap.has(key)) {
        const config = deptConfigs.find(d =>
          (resolvedCategoryId !== null && d.categoryId === resolvedCategoryId) ||
          (d.categoryName && d.categoryName.trim() === resolvedCategoryName)
        );
        categoryMap.set(key, {
          categoryId: resolvedCategoryId,
          categoryName: resolvedCategoryName,
          items: [],
          printOrder: config?.printOrder ?? 999,
        });
      }
      categoryMap.get(key)!.items.push({
        ...item,
        categoryId: resolvedCategoryId,
        categoryName: resolvedCategoryName,
      });
    }

    // لكل تصنيف في الطلب، أنشئ مجموعة مستقلة منفصلة عن الفاتورة الكبيرة وعن التصنيفات الأخرى
    return Array.from(categoryMap.values())
      .filter(g => g.items.length > 0)
      .sort((a, b) => a.printOrder - b.printOrder)
      .map((g, idx) => {
        const config = deptConfigs.find(d =>
          (g.categoryId !== null && d.categoryId === g.categoryId) ||
          (d.categoryName && d.categoryName.trim() === g.categoryName)
        );
        if (config && config.enabled === false) {
          return null;
        }
        return {
          dept: {
            id: config?.id ?? (g.categoryId ?? (idx + 1)),
            categoryId: g.categoryId,
            categoryName: g.categoryName ?? "قسم التحضير",
            printerName: config?.printerName ?? null,
            copies: Math.max(1, config?.copies ?? 1),
            enabled: true,
            printOrder: g.printOrder,
          },
          items: g.items,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── طباعة فواتير الطلب عبر المتصفح بحيث تخرج الفاتورة الكبيرة منفصلة تماماً عن فاتورة كل تصنيف ────────
  const browserPrintFullOrder = async (printFilter: "all" | "master_only" | "dept_only" = "all") => {
    // قراءة إعدادات الطابعة المحفوظة (مع دعم الكاش المحلي لضمان عدم ضياع الهوامش أبداً)
    let cachedPs: any = null;
    try {
      const raw = localStorage.getItem("pos_printer_settings_v1");
      if (raw) cachedPs = JSON.parse(raw);
    } catch {}
    const ps = printerSettings ?? cachedPs;

    const styleId = "__pos-dynamic-print__";
    const standaloneRootId = "__pos-standalone-print-root__";
    document.getElementById(styleId)?.remove();
    document.getElementById(standaloneRootId)?.remove();

    const pw = ps?.paperWidth ?? 80;
    const printableW = pw === 80 ? 72.1 : pw;
    // الهوامش الفعلية المحفوظة للمستخدم (الافتراضي 1mm لمقاس 80(72.1) × 297 mm)
    const lm = (ps?.leftMargin !== undefined && ps?.leftMargin !== null) ? Number(ps.leftMargin) : 1;
    const rm = (ps?.rightMargin !== undefined && ps?.rightMargin !== null) ? Number(ps.rightMargin) : 1;
    const tm = (ps?.topMargin !== undefined && ps?.topMargin !== null) ? Number(ps.topMargin) : 1;
    const bm = (ps?.bottomMargin !== undefined && ps?.bottomMargin !== null) ? Number(ps.bottomMargin) : 1;
    const fs = ps?.fontSize ?? 11;
    const ls = ps?.lineSpacing ?? 2;

    // إنشاء حاوية طباعة مستقلة مباشرة تحت body خارج أي flex/overflow لضمان فصل كل فاتورة في صفحة مستقلة
    const sourceArea = document.getElementById("receipt-print-area");
    if (sourceArea) {
      const standaloneRoot = document.createElement("div");
      standaloneRoot.id = standaloneRootId;
      standaloneRoot.setAttribute("dir", "rtl");

      const clonedArea = sourceArea.cloneNode(true) as HTMLElement;
      if (printFilter === "master_only") {
        clonedArea.querySelectorAll('.print-page[data-slip-type="dept"]').forEach(el => el.remove());
      } else if (printFilter === "dept_only") {
        clonedArea.querySelectorAll('.print-page[data-slip-type="master"]').forEach(el => el.remove());
      }
      standaloneRoot.appendChild(clonedArea);
      document.body.appendChild(standaloneRoot);
      document.body.classList.add("pos-printing-active");
    }

    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @page { size: ${pw}mm 297mm; margin: 0mm; }
      @media print {
        html, body {
          display: block !important;
          position: static !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        body.pos-printing-active > *:not(#${standaloneRootId}) {
          display: none !important;
        }
        #${standaloneRootId}, #${standaloneRootId} #receipt-print-area {
          display: block !important;
          position: static !important;
          width: 100% !important;
          max-width: ${printableW}mm !important;
          height: auto !important;
          overflow: visible !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
        }
        #${standaloneRootId} .print-page, .print-page {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          max-width: ${printableW}mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          page-break-before: always !important;
          break-before: page !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        #${standaloneRootId} .print-page:first-child, .print-page:first-child {
          page-break-before: avoid !important;
          break-before: avoid !important;
        }
        #${standaloneRootId} .print-page:last-child, .print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .receipt-slip, .receipt-dept-slip, .dept-receipt-slip {
          display: block !important;
          font-size: ${fs}px !important;
          line-height: ${1 + ls / 10} !important;
          padding: ${tm}mm ${rm}mm ${bm}mm ${lm}mm !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: ${printableW}mm !important;
          color: #000000 !important;
          background: #ffffff !important;
        }
      }
    `;
    document.head.appendChild(el);

    // الانتظار الفعلي حتى تحميل الشعار وباقي الصور في نافذة الطباعة لتجنب الطباعة قبل تحميل الشعار
    await new Promise<void>(resolve => {
      const targetSelector = document.getElementById(standaloneRootId)
        ? `#${standaloneRootId} img`
        : "#receipt-print-area img";
      const images = document.querySelectorAll(targetSelector);
      if (images.length === 0) {
        setTimeout(resolve, 120);
        return;
      }
      let loadedCount = 0;
      const onImageLoad = () => {
        loadedCount++;
        if (loadedCount >= images.length) {
          setTimeout(resolve, 100);
        }
      };
      images.forEach(img => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.complete) {
          onImageLoad();
        } else {
          htmlImg.addEventListener("load", onImageLoad, { once: true });
          htmlImg.addEventListener("error", onImageLoad, { once: true });
        }
      });
    });

    window.print();

    document.body.classList.remove("pos-printing-active");
    document.getElementById(standaloneRootId)?.remove();
    document.getElementById(styleId)?.remove();
  };

  // ── إرسال فاتورة قسم مباشرة عبر الطابعة ───────────────────────
  const directPrint = async (order: Order, dept: any, items: any[], printerOverride?: string): Promise<boolean> => {
    const content = generateDeptReceiptText(order, dept, items, settings, printerSettings);
    const printerName = printerOverride ?? dept.printerName;

    return new Promise<boolean>(resolve => {
      printReceiptDirect.mutate(
        { data: { printerName, content, copies: 1 } },
        {
          onSuccess: (res) => {
            if (!res || !res.ok) {
              console.error(`Direct print failed for dept ${dept.categoryName}:`, res?.message);
              addOfflinePrintJob({
                printerName: printerName || "Default",
                content,
                orderId: order.id,
                invoiceNumber: order.invoiceNumber,
                receiptType: "department",
                departmentName: dept.categoryName ?? "قسم",
                copies: 1,
              });
              resolve(false);
            } else {
              resolve(true);
            }
          },
          onError: (err: any) => {
            console.error(`Direct print error for dept ${dept.categoryName}:`, err);
            addOfflinePrintJob({
              printerName: printerName || "Default",
              content,
              orderId: order.id,
              invoiceNumber: order.invoiceNumber,
              receiptType: "department",
              departmentName: dept.categoryName ?? "قسم",
              copies: 1,
            });
            resolve(false);
          },
        }
      );
    });
  };

  // ── طباعة صامتة كاملة عبر الطابعة (الفاتورة الكبيرة منفصلة ثم فاتورة كل تصنيف منفصلة) ───────────
  const silentPrintAll = async (order: Order): Promise<boolean> => {
    const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
    const isDelivery = order.orderType === "delivery";
    const copiesCount = isDelivery ? 2 : (settings?.masterCopiesCount ?? 1);
    const enabledCopies = isDelivery
      ? [{ id: "cashier", label: "نسخة الكاشير", enabled: true }, { id: "driver", label: "نسخة للموصل", enabled: true }]
      : receiptCopies.filter(c => c.enabled);
    const deptGroups = getDeptGroups(order);

    const mainPrinterName = mainPrinter || "";
    let overallSuccess = true;

    // 1) الفاتورة الرئيسية الكبيرة → إرسال كأمر طباعة منفصل مع قطع الورق
    const masterText = generateReceiptText(order, settings, user?.name ?? "", printerSettings);
    for (let i = 0; i < copiesCount; i++) {
      const copyLabel = enabledCopies[i]?.label ?? (isDelivery ? (i === 0 ? "نسخة الكاشير" : "نسخة للموصل") : `نسخة ${i + 1}`);
      let isOk = false;

      try {
        const res = await new Promise<any>(resolve => {
          printReceiptDirect.mutate(
            { data: { printerName: mainPrinterName, content: masterText, copies: 1 } },
            {
              onSuccess: (data) => resolve(data),
              onError: (err: any) => resolve({ ok: false, message: err?.message }),
            }
          );
        });
        isOk = !!(res && res.ok);
      } catch (err: any) {
        isOk = false;
      }

      if (!isOk) {
        overallSuccess = false;
        addOfflinePrintJob({
          printerName: mainPrinterName || "Default",
          content: masterText,
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          receiptType: "master",
          departmentName: copyLabel,
          copies: 1,
        });
      }

      createPrintLog.mutate({ data: {
        orderId: order.id, invoiceNumber: order.invoiceNumber,
        receiptType: "master", departmentName: copyLabel,
        printerName: mainPrinterName || "الطابعة الافتراضية", copies: 1, 
        status: isOk ? "success" : "failed", reprintCount: 0,
      }});
      await sleep(350);
    }

    // 2) فواتير كل تصنيف (الفواتير الصغيرة) → كل تصنيف يطبع في أمر مستقل ومنفصل تماماً
    for (const { dept, items } of deptGroups) {
      if (!items.length) continue;
      const targetDeptPrinter = (dept.printerName && dept.printerName.trim())
        ? dept.printerName.trim()
        : mainPrinterName;
      if (!targetDeptPrinter) {
        continue;
      }
      for (let c = 0; c < dept.copies; c++) {
        const printedOk = await directPrint(order, dept, items, targetDeptPrinter);
        if (!printedOk) overallSuccess = false;

        createPrintLog.mutate({ data: {
          orderId: order.id, invoiceNumber: order.invoiceNumber,
          receiptType: "department", departmentName: dept.categoryName ?? "قسم",
          printerName: targetDeptPrinter, copies: 1, 
          status: printedOk ? "success" : "failed", reprintCount: 0,
        }});
        await sleep(350);
      }
    }

    return overallSuccess;
  };

  // ── طباعة فواتير الأقسام فقط بشكل مباشر ───────────
  const silentPrintDeptOnly = async (order: Order): Promise<boolean> => {
    const deptGroups = getDeptGroups(order);
    if (!deptGroups.length) {
      toast({ title: "تنبيه", description: "لا توجد أصناف تابعة لأقسام محددة للطباعة في هذه الفاتورة" });
      return true;
    }
    let overallSuccess = true;
    for (const { dept, items } of deptGroups) {
      if (!items.length) continue;
      const targetPrinter = dept.printerName || (printerSettings as any)?.mainPrinterName;
      for (let c = 0; c < (dept.copies || 1); c++) {
        const printedOk = await directPrint(order, dept, items, targetPrinter);
        if (!printedOk) overallSuccess = false;
        createPrintLog.mutate({ data: {
          orderId: order.id, invoiceNumber: order.invoiceNumber,
          receiptType: "department", departmentName: dept.categoryName ?? "قسم",
          printerName: targetPrinter || "طابعة القسم", copies: 1, 
          status: printedOk ? "success" : "failed", reprintCount: 1,
        }});
        if (c < (dept.copies || 1) - 1) await sleep(200);
      }
    }
    return overallSuccess;
  };

  // ── دالة الطباعة الرئيسية (الفاتورة الكبيرة في صفحة مستقلة + كل تصنيف في صفحة مستقلة) ──────────────────────────
  const triggerDirectPrint = async (
    order: Order,
    isReprint = false,
    reprintReasonText?: string,
    printFilter: "all" | "master_only" | "dept_only" = "all"
  ) => {
    setLastOrder(order);
    await sleep(220); // Wait for React to mount ReceiptPrintArea in DOM

    const isDelivery = order.orderType === "delivery";
    const enabledCopies = isDelivery
      ? [{ id: "cashier", label: "نسخة الكاشير", enabled: true }, { id: "driver", label: "نسخة للموصل", enabled: true }]
      : receiptCopies.filter(c => c.enabled);
    const copiesCount = isDelivery ? 2 : (settings?.masterCopiesCount ?? 1);
    const deptGroups = getDeptGroups(order);

    // 1) تسجيل عمليات الطباعة في السجل (نسخ الفاتورة الرئيسية)
    if (printFilter !== "dept_only") {
      for (let i = 0; i < copiesCount; i++) {
        const copyLabel = enabledCopies[i]?.label ?? (isDelivery ? (i === 0 ? "نسخة الكاشير" : "نسخة للموصل") : `نسخة ${i + 1}`);
        createPrintLog.mutate({
          data: {
            orderId: order.id,
            invoiceNumber: order.invoiceNumber,
            receiptType: isReprint ? "reprint" : "master",
            departmentName: copyLabel,
            printerName: "طابعة المتصفح",
            copies: 1,
            status: "success",
            reprintReason: isReprint ? (reprintReasonText ?? "إعادة طباعة") : null,
            reprintCount: isReprint ? 1 : 0,
          },
        });
      }
    }

    // 2) تسجيل عمليات الطباعة في السجل (فواتير الأقسام / التصنيفات)
    if (printFilter !== "master_only") {
      for (const { dept } of deptGroups) {
        createPrintLog.mutate({
          data: {
            orderId: order.id,
            invoiceNumber: order.invoiceNumber,
            receiptType: "department",
            departmentName: dept.categoryName ?? "قسم",
            printerName: dept.printerName ?? "طابعة المتصفح",
            copies: dept.copies,
            status: "success",
            reprintCount: isReprint ? 1 : 0,
          },
        });
      }
    }

    // 3) إرسال أمر الطباعة مع فصل الفاتورة الكبيرة عن فاتورة كل تصنيف
    await browserPrintFullOrder(printFilter);
  };

  // ── بحث عن موظف برقمه ──
  const lookupEmployee = async () => {
    if (!empNumInput.trim()) return;
    setLookingUpEmp(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const resp = await fetch(`/api/hr/employees/by-number/${encodeURIComponent(empNumInput.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const emp = await resp.json();
      setFoundEmployee(emp);

      const bal = Number(emp.balance || 0);
      const lim = emp.credit_limit !== null && emp.credit_limit !== undefined ? Number(emp.credit_limit) : 20000;
      const ded = Number(emp.meal_deductions_this_month || 0);
      const avail = bal + lim - ded;
      const allowExceed = Boolean(emp.allow_exceed_balance);
      const blockInsufficient = emp.block_insufficient_balance !== undefined ? Boolean(emp.block_insufficient_balance) : true;

      if (blockInsufficient && !allowExceed && !isPrivilegedUser && !supervisorAuthorized && total > avail && total > 0) {
        setShowBalanceBlockModal(true);
      } else {
        setShowMealConfirm(true);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "لم يتم العثور على الموظف", description: "تحقق من رقم الموظف" });
    } finally {
      setLookingUpEmp(false);
    }
  };

  // ── تأكيد تسجيل الوجبة ──
  const confirmMealDeduction = (options?: { admin_override?: boolean }) => {
    if (!foundEmployee || cart.length === 0 || createOrderMutation.isPending) return;

    const bal = Number(foundEmployee.balance || 0);
    const lim = foundEmployee.credit_limit !== null && foundEmployee.credit_limit !== undefined ? Number(foundEmployee.credit_limit) : 20000;
    const ded = Number(foundEmployee.meal_deductions_this_month || 0);
    const avail = bal + lim - ded;
    const allowExceed = Boolean(foundEmployee.allow_exceed_balance);
    const blockInsufficient = foundEmployee.block_insufficient_balance !== undefined ? Boolean(foundEmployee.block_insufficient_balance) : true;
    const isOverride = Boolean(options?.admin_override || isPrivilegedUser || supervisorAuthorized);

    if (blockInsufficient && !allowExceed && !isOverride && total > avail) {
      setShowMealConfirm(false);
      setShowBalanceBlockModal(true);
      return;
    }

    const mealNote = `وجبة موظف: ${foundEmployee.name} (${foundEmployee.employee_number})`;

    const items: OrderItemInput[] = cart.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
    }));

    createOrderMutation.mutate({
      data: {
        items,
        paymentMethod: "credit",
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        cashAmount: null,
        cardAmount: null,
        employeeId: foundEmployee.id,
        employee_id: foundEmployee.id,
        userId: user!.id,
        orderType: "takeout",
        tableNumber: null,
        note: mealNote,
        safeId: selectedSafeId,
        safe_id: selectedSafeId,
        admin_override: isOverride,
        supervisor_authorized: isOverride
      } as any
    }, {
      onSuccess: async (order) => {
        // تسجيل خصم الوجبة في سجل الموظف
        const token = localStorage.getItem("pos_token") ?? "";
        await fetch("/api/hr/meal-deductions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employee_id: foundEmployee.id,
            employee_name: foundEmployee.name,
            employee_number: foundEmployee.employee_number,
            order_id: order.id,
            invoice_number: order.invoiceNumber,
            amount: total,
            notes: `${cart.map(i => i.product.name).join(", ")}`,
            admin_override: isOverride,
            supervisor_authorized: isOverride
          }),
        });
        toast({ title: "✅ تم تسجيل وجبة الموظف", description: `${foundEmployee.name} — ${order.invoiceNumber}` });
        setLastOrder(order);
        setShowMealConfirm(false);
        setShowBalanceBlockModal(false);
        setCart([]);
        setDiscount(0);
        setSupervisorAuthorized(false);
        setEmpNumInput("");
        setFoundEmployee(null);
        refetchLastInvoice();
        refetchNextInvoiceCounter();

        const printMode = (settings as any)?.printMode ?? "browser";
        const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
        const hasMainPrinter = !!(mainPrinter && mainPrinter.trim());

        if (printMode === "browser" || !hasMainPrinter) {
          setTimeout(() => {
            triggerDirectPrint(order);
          }, 300);
        } else {
          silentPrintAll(order).then((success) => {
            if (!success) {
              setTimeout(() => {
                triggerDirectPrint(order);
              }, 500);
            }
          });
        }
      },
      onError: () => { toast({ variant: "destructive", title: "فشل في تسجيل الوجبة" }); },
    });
  };

  const isSubmittingRef = useRef(false);

  const confirmPay = () => {
    if (createOrderMutation.isPending || isSubmittingRef.current) return;
    
    if (paymentMethod === "credit" && creditPartyType === "customer" && !selectedCustomerId) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب تحديد العميل لعمليات الدفع الآجل" });
      return;
    }
    if (paymentMethod === "credit" && creditPartyType === "supplier" && !selectedSupplierId) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب تحديد المورد لعمليات الدفع الآجل" });
      return;
    }

    isSubmittingRef.current = true;

    const items: OrderItemInput[] = cart.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
    }));

    createOrderMutation.mutate({
      data: {
        items,
        paymentMethod,
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        cashAmount: paymentMethod === "cash" ? total : paymentMethod === "mixed" ? parseFloat(cashGiven) || 0 : null,
        cardAmount: paymentMethod === "card" ? total : paymentMethod === "mixed" ? total - (parseFloat(cashGiven) || 0) : null,
        userId: user!.id,
        customerId: paymentMethod === "credit" && creditPartyType === "customer" ? selectedCustomerId : null,
        supplierId: paymentMethod === "credit" && creditPartyType === "supplier" ? selectedSupplierId : null,
        orderType,
        tableNumber: tableNumber || null,
        note: note || null,
        safeId: selectedSafeId,
        safe_id: selectedSafeId
      }
    }, {
      onSuccess: (order) => {
        setLastOrder(order);
        setShowPayDialog(false);
        setCart([]);
        setDiscount(0);
        setSupervisorAuthorized(false);
        setCashGiven("");
        setPaymentMethod("cash");
        setNote("");
        setTableNumber("");
        isSubmittingRef.current = false;
        refetchLastInvoice();
        refetchNextInvoiceCounter();

        const printMode = (settings as any)?.printMode ?? "browser";
        const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
        const hasMainPrinter = !!(mainPrinter && mainPrinter.trim());

        if (printMode === "browser" || !hasMainPrinter) {
          // إذا كانت طريقة الطباعة هي المتصفح، أو لم يتم تحديد طابعة صامتة رئيسية، نستخدم طباعة المتصفح الرسومية الجميلة تلقائياً لتطبيق الشعار والشكل المثالي
          toast({ title: "✅ تم تأكيد الطلب", description: "جاري تحضير وإرسال الفاتورة للطباعة..." });
          setTimeout(() => {
            triggerDirectPrint(order);
          }, 500);
        } else {
          // طباعة صامتة فورية وتلقائية بالترتيب لجميع الفواتير دون أي نوافذ منبثقة أو حوارات معاينة
          toast({ title: "✅ تم تأكيد الطلب وطباعة الفاتورة", description: `${order.invoiceNumber} — جاري إرسال الأوامر للطباعة الصامتة...` });
          silentPrintAll(order).then((success) => {
            if (success) {
              toast({ title: "🖨️ تم إرسال الطباعة المباشرة", description: "تم إرسال كافة فواتير الأقسام والعميل للطابعة بنجاح" });
            } else {
              toast({
                variant: "destructive",
                title: "⚠️ تنبيه الطباعة المباشرة",
                description: "لم نتمكن من إتمام الطباعة التلقائية عبر الطابعات المسجلة بالخادم. جاري فتح طباعة المتصفح البديلة تلقائياً..."
              });
              // تشغيل طباعة المتصفح التفاعلية كبديل آمن
              setTimeout(() => {
                triggerDirectPrint(order);
              }, 1000);
            }
          });
        }
      },
      onError: (err: any) => {
        isSubmittingRef.current = false;
        toast({ 
          variant: "destructive", 
          title: "فشل في حفظ الفاتورة",
          description: err?.message || "حدث خطأ غير متوقع أثناء حفظ الفاتورة"
        });
      }
    });
  };

  const handleReprint = () => {
    if (!lastOrder) return;
    if (!isPrivilegedUser) {
      toast({ variant: "destructive", title: "غير مصرح", description: "إعادة الطباعة مسموحة للمدير أو المحاسب فقط" });
      return;
    }
    const maxReprint = settings?.maxReprintCount ?? 3;
    if (maxReprint > 0) {
      setShowReprintDialog(true);
    } else {
      triggerDirectPrint(lastOrder, true);
    }
  };

  const confirmReprint = () => {
    if (!lastOrder) return;
    triggerDirectPrint(lastOrder, true, reprintReason);
    setShowReprintDialog(false);
    setReprintReason("");
  };

  const change = parseFloat(cashGiven) - total;

  const enabledCopies = receiptCopies.filter(c => c.enabled);
  const masterCopiesCount = settings?.masterCopiesCount ?? 1;
  const deptGroups = lastOrder ? getDeptGroups(lastOrder) : [];
  const copyLabels = Array.from({ length: masterCopiesCount }, (_, i) => enabledCopies[i]?.label ?? (masterCopiesCount > 1 ? `نسخة ${i + 1}` : "نسخة العميل"));

  return (
    <PosLayout>
      {/* Hidden print area - يحتوي على جميع فواتير الطلب للطباعة دفعة واحدة بنواذة تأكيد واحدة */}
      <div className="hidden-print-container">
        {lastOrder && (
          <ReceiptPrintArea
            order={lastOrder}
            settings={settings ?? undefined}
            cashierName={user?.name}
            masterCopiesCount={masterCopiesCount}
            copyLabels={copyLabels}
            deptGroups={deptGroups}
          />
        )}
      </div>

      <div className="flex flex-col w-full h-full overflow-hidden bg-[#e8eaf0]" dir="rtl">

        {/* ══════════ MULTI-POS BILL TABS BAR ══════════ */}
        <div className="bg-[#0b162c] text-white border-b border-slate-700/80 px-3 py-1 flex items-center justify-between gap-2 shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[70vw] py-0.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 pl-2 shrink-0 border-l border-white/10">
              <span>📑</span>
              <span className="hidden sm:inline">فواتير الكاشير:</span>
            </div>

            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const tabItemsCount = tab.cart.reduce((s, i) => s + i.quantity, 0);
              const tabSubtotal = tab.cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
              const tabDiscount = Math.min(tab.discount, tabSubtotal);
              const tabTotal = (tabSubtotal - tabDiscount) * (1 + taxRate / 100);

              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    "group relative flex items-center gap-1.5 px-3 py-1 rounded-t-md text-xs font-bold transition-all cursor-pointer border-t-2 shrink-0",
                    isActive
                      ? "bg-[#16274e] text-white border-amber-400 shadow-md ring-1 ring-white/10"
                      : "bg-white/5 text-slate-300 border-transparent hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="text-[10px] text-amber-400 font-mono">#{index + 1}</span>
                  <span className="truncate max-w-[80px]">{tab.name}</span>

                  {tabItemsCount > 0 ? (
                    <span className={cn(
                      "px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold",
                      isActive ? "bg-amber-400 text-slate-900" : "bg-white/20 text-white"
                    )}>
                      {tabItemsCount} | {Math.round(tabTotal).toLocaleString()} {currency}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-normal">فارغة</span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded p-0.5 transition-colors"
                    title="إغلاق الفاتورة (Ctrl+W)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddNewTab}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-md transition-colors shrink-0 shadow-xs"
              title="فتح فاتورة / واجهة بيع جديدة بالتوازي (F4)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>فاتورة جديدة (F4)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-400/40 rounded text-emerald-300 font-bold text-xs select-none"
              title={`رقم الفاتورة القادمة ليوم العمل النشط (${nextInvoiceCounter?.activeBusinessDate || "اليوم"}) — يتم تصفير العداد تلقائياً إلى 1 عند تقليب يوم العمل (${nextInvoiceCounter?.cutoffTime || "03:00"})`}
            >
              <span className="text-[10px] text-emerald-200/90">الفاتورة القادمة:</span>
              <span className="font-mono font-black text-emerald-300">
                #{nextInvoiceCounter?.nextInvoiceNumber || "1"}
              </span>
            </div>

            <div
              onClick={fetchAndOpenLastInvoice}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded font-bold text-xs transition-colors shadow-xs select-none border",
                lastInvoicePermFlags.canOpen
                  ? "cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-300"
                  : "cursor-not-allowed bg-slate-800/60 border-slate-700 text-slate-400 opacity-70"
              )}
              title={lastInvoicePermFlags.canOpen ? "انقر هنا لعرض بيانات آخر فاتورة وإعادة الطباعة (F9)" : "زر آخر فاتورة مقفل حسب صلاحيات المستخدم"}
            >
              {!lastInvoicePermFlags.canOpen && <Lock className="w-3 h-3 text-red-400" />}
              <span className="text-[10px] text-amber-200/80">آخر فاتورة:</span>
              <span className="font-mono font-black text-amber-300">
                {lastInvoiceSummary?.total ? Number(lastInvoiceSummary.total).toLocaleString() : "0"} {currency}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/pos", "_blank", "width=1366,height=768,menubar=no,status=no,toolbar=no")}
              className="h-7 text-[11px] font-bold bg-white/10 hover:bg-white/20 text-slate-200 border-white/20 px-2.5 gap-1.5 shadow-xs"
              title="فتح شاشة كاشير إضافية في نافذة متصفح مستقلة"
            >
              <span>🗗</span>
              <span className="hidden sm:inline">نافذة مستقلة جديدة</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 w-full overflow-y-auto lg:overflow-hidden bg-[#e8eaf0]">

        {/* ═══ RIGHT PANEL: Categories + Cart ═══ */}
        <div className="w-full lg:w-[320px] flex flex-col bg-white border-l border-slate-300 shrink-0 shadow-md">

          {/* ── Categories bar ── */}
          <div className="bg-[#0f1e3c] px-2 py-1.5 shrink-0">
            <p className="text-[10px] text-blue-300 font-semibold mb-1.5 px-1 flex items-center justify-between">
              <span>المجموعات والأقسام</span>
              {selectedCategory !== null && (
                <span className="text-[9px] text-amber-300 cursor-pointer hover:underline" onClick={() => setSelectedCategory(null)}>
                  عرض الكل
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded-md font-bold transition-all flex items-center gap-1",
                  selectedCategory === null
                    ? "bg-amber-400 text-[#0f1e3c] shadow-xs"
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                <span>🏷️</span>
                <span>الكل</span>
              </button>
              {categories.map(cat => {
                const isCatActive = selectedCategory === cat.id;
                const catColor = cat.color || "#3b82f6";
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] rounded-md font-bold transition-all flex items-center gap-1 border",
                      isCatActive
                        ? "bg-amber-400 text-[#0f1e3c] border-amber-500 shadow-xs font-black"
                        : "bg-white/10 text-white border-white/10 hover:bg-white/20"
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: catColor }}
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Order type + table ── */}
          <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex items-center gap-1.5 shrink-0">
            {availableOrderTypes.map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={cn("flex-1 py-1 text-[11px] font-bold rounded border transition-colors",
                  orderType === t ? "bg-[#0f1e3c] text-white border-[#0f1e3c]" : "border-slate-300 text-slate-600 hover:border-[#0f1e3c]")}
              >{ORDER_TYPE_LABELS[t]}</button>
            ))}
            {orderType === "dine-in" && canDineIn && (
              <Input placeholder="طاولة" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                className="w-16 h-7 text-xs text-center border-slate-300" />
            )}
          </div>

          {/* ── Cart table header ── */}
          <div className="grid grid-cols-[1fr_40px_70px_24px] bg-[#0f1e3c] text-white text-[11px] font-bold px-2 py-1 shrink-0">
            <span>الصنف</span>
            <span className="text-center">الكمية</span>
            <span className="text-center">السعر</span>
            <span />
          </div>

          {/* ── Cart rows ── */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <ShoppingCart className="w-8 h-8 opacity-30" />
                <span>اضغط على منتج للإضافة</span>
              </div>
            )}
            {cart.map((item, idx) => (
              <div key={item.product.id}
                onClick={() => { setSelectedCartIndex(idx); setIsQtyEditing(false); }}
                className={cn("grid grid-cols-[1fr_40px_70px_24px] items-center px-2 py-1 gap-0.5 cursor-pointer transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-amber-50/60",
                  selectedCartIndex === idx && "bg-blue-100 ring-1 ring-blue-500 font-bold")}
              >
                <span className={cn("text-[11px] font-semibold text-slate-800 truncate leading-tight", selectedCartIndex === idx && "font-black text-blue-900")}>{item.product.name}</span>
                <div className={cn("flex flex-col items-center gap-0.5 rounded px-1 py-0.5", selectedCartIndex === idx && isQtyEditing && "bg-amber-300 ring-2 ring-amber-600 animate-pulse")}>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(idx); changeQty(item.product.id, 1); }}
                    className="w-5 h-4 bg-green-100 hover:bg-green-200 rounded text-green-700 flex items-center justify-center leading-none">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <span className="text-[12px] font-extrabold text-slate-800 tabular-nums">{item.quantity}</span>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(idx); changeQty(item.product.id, -1); }}
                    className="w-5 h-4 bg-blue-100 hover:bg-blue-200 rounded text-blue-600 flex items-center justify-center leading-none">
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                </div>
                <span className="text-[11px] font-bold text-amber-700 text-center tabular-nums">
                  {(item.product.price * item.quantity).toLocaleString()}
                </span>
                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}
                  className="w-5 h-5 rounded hover:bg-red-100 flex items-center justify-center text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Note ── */}
          {cart.length > 0 && (
            <div className="px-2 py-1.5 border-t border-slate-100">
              <Input placeholder="ملاحظة..." value={note} onChange={e => setNote(e.target.value)}
                className="h-7 text-xs border-slate-200" />
            </div>
          )}

          {/* ── Totals ── */}
          <div className="bg-slate-50 border-t border-slate-200 px-2 py-2 space-y-1 shrink-0">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>المجموع الفرعي</span>
              <span className="tabular-nums font-semibold">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-semibold">
                <span>الخصم</span>
                {!canApplyDiscount && (
                  <span className="text-[10px] text-red-500 flex items-center gap-0.5 font-bold" title="الخصم غير مسموح للكاشير بحسب إعدادات النظام">
                    <Lock className="w-2.5 h-2.5" /> مقفل
                  </span>
                )}
                {supervisorAuthorized && (
                  <span className="text-[10px] text-green-600 flex items-center gap-0.5 font-bold" title="تم فتح الخصم بإذن المشرف لهذا الطلب">
                    <Unlock className="w-2.5 h-2.5" /> بإذن
                  </span>
                )}
              </span>
              {canApplyDiscount ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={discount || ""}
                    placeholder="0"
                    onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-20 h-5 text-xs text-center font-bold text-slate-800 border-slate-300 p-0"
                    min={0}
                  />
                  {supervisorAuthorized && (
                    <button
                      type="button"
                      onClick={() => { setSupervisorAuthorized(false); setDiscount(0); }}
                      className="text-slate-400 hover:text-red-500 text-[10px]"
                      title="إلغاء إذن الخصم"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSupervisorDialog(true)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded border border-amber-300 transition-colors shadow-xs"
                  title="الخصم مقفل للكاشير - انقر لطلب إذن المدير"
                >
                  <KeyRound className="w-2.5 h-2.5 text-amber-700" />
                  <span>طلب إذن</span>
                </button>
              )}
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>ضريبة {taxRate}%</span>
                <span className="tabular-nums">{taxAmt.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm bg-[#0f1e3c] text-white rounded px-2 py-1 mt-1">
              <span>الإجمالي</span>
              <span className="tabular-nums text-amber-300">{total.toFixed(2)} {currency}</span>
            </div>

            {/* Payment method */}
            <div className="flex gap-1 pt-0.5">
              {availablePaymentMethods.map(m => (
                <button key={m} onClick={() => setPaymentMethod(m as any)}
                  className={cn("flex-1 py-1 text-[11px] rounded border font-bold transition-colors",
                    paymentMethod === m ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-600 hover:border-blue-500")}
                >{m === "cash" ? "نقدي" : m === "card" ? "شبكة" : m === "mixed" ? "مختلط" : "آجل"}</button>
              ))}
            </div>

            <div className="flex gap-1.5 pt-0.5">
              <button onClick={() => setCart([])} disabled={cart.length === 0}
                className="px-2.5 h-9 text-xs rounded border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 font-bold transition-colors">
                إلغاء
              </button>
              <button
                type="button"
                onClick={fetchAndOpenLastInvoice}
                disabled={loadingLastInvoice}
                className={cn(
                  "px-2.5 h-9 text-xs rounded border font-bold transition-colors flex items-center gap-1 shrink-0",
                  lastInvoicePermFlags.canOpen
                    ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    : "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed opacity-75"
                )}
                title={lastInvoicePermFlags.canOpen ? "عرض بيانات آخر فاتورة وإعادة الطباعة (F9)" : "زر آخر فاتورة مقفل حسب صلاحيات المستخدم"}
              >
                {lastInvoicePermFlags.canOpen ? <Printer className="w-3.5 h-3.5 text-amber-700" /> : <Lock className="w-3.5 h-3.5 text-red-500" />}
                <span>آخر فاتورة</span>
              </button>
              <Button
                className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm tracking-wide shadow"
                disabled={cart.length === 0 || createOrderMutation.isPending}
                onClick={handlePay}
              >
                دفع
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ MAIN: Products panel ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Top bar: quick status + meal mode ── */}
          <div className="bg-[#0f1e3c] border-b border-slate-700 flex items-center gap-3 px-3 py-1.5 shrink-0 flex-wrap">
            {!mealMode ? (
              <>
                {typedNumberBuffer ? (
                  <div className="flex items-center gap-1.5 bg-amber-400/20 px-2.5 py-1 rounded-md border border-amber-400/40 shadow-xs animate-pulse">
                    <span className="text-amber-300 text-xs font-black">⌨️ الرمز المدخل: <span className="text-white font-mono text-sm bg-amber-500/30 px-1.5 py-0.5 rounded border border-amber-400">{typedNumberBuffer}</span></span>
                    <button
                      type="button"
                      onClick={() => setTypedNumberBuffer("")}
                      className="text-amber-300 hover:text-white text-xs px-1 font-bold"
                      title="مسح الإدخال"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="text-white/60 text-xs font-medium">💡 أدخل رقم الوجبة أو امسح الباركود واضغط Enter للإضافة المباشرة</span>
                )}

                {cart.length > 0 && (
                  <span className="text-amber-300 text-xs font-bold">
                    {cart.length} صنف — {total.toFixed(0)} {currency}
                  </span>
                )}
                {offlineJobsCount > 0 && (
                  <button
                    onClick={retryOfflineQueue}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-white rounded animate-pulse hover:bg-amber-600 transition-colors"
                    title="انقر لإعادة محاولة طباعة الفواتير المعلقة"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>فواتير معلقة ({offlineJobsCount}) — إعادة طباعة</span>
                  </button>
                )}
                {userCanEmployeeMeal && (
                  <button
                    onClick={() => setMealMode(true)}
                    className="mr-auto flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/30 rounded hover:bg-amber-400/10 transition-colors"
                    title="وضع وجبات الموظفين"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5" />وجبة موظف
                  </button>
                )}
              </>
            ) : (
              <>
                <UtensilsCrossed className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-400 text-xs font-bold shrink-0">وجبة موظف:</span>
                <div className="relative flex items-center gap-2">
                  <Input
                    type="text"
                    list="pos-employees-list"
                    placeholder="اختر أو أدخل رقم الموظف"
                    value={empNumInput}
                    onChange={e => setEmpNumInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && lookupEmployee()}
                    className="w-48 h-7 text-sm text-center font-bold bg-amber-400/10 border-amber-400/40 text-amber-100 placeholder:text-amber-400/50 focus:bg-white focus:text-slate-900"
                    dir="rtl"
                    autoFocus
                  />
                  <datalist id="pos-employees-list">
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.employee_number}>
                        {emp.name}
                      </option>
                    ))}
                  </datalist>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEmpPicker(true)}
                    className="h-7 text-xs bg-amber-400 text-slate-950 font-black hover:bg-amber-300 border-amber-500 gap-1 shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    قائمة الموظفين
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={lookupEmployee}
                  disabled={lookingUpEmp || !empNumInput.trim() || cart.length === 0}
                  className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold"
                >
                  {lookingUpEmp ? "جاري البحث..." : "تأكيد الوجبة"}
                </Button>
                {cart.length === 0 && <span className="text-amber-400/70 text-xs">أضف أصناف أولاً</span>}
                <button
                  onClick={() => { setMealMode(false); setEmpNumInput(""); }}
                  className="mr-auto text-white/50 hover:text-white text-xs transition-colors"
                >
                  ✕ إلغاء وضع الوجبات
                </button>
              </>
            )}
          </div>

          {/* ── Product grid ── */}
          <div className="flex-1 overflow-y-auto p-2 bg-[#e8eaf0]">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filteredProducts.map(prod => {
                const prodCat = categories.find(c => c.id === prod.categoryId);
                const accentColor = prodCat?.color || "#f59e0b";
                return (
                  <button
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="bg-white hover:bg-amber-50/80 active:scale-95 border-2 border-slate-200 hover:border-amber-400 rounded-lg p-0 text-center transition-all duration-100 cursor-pointer flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md h-[92px] w-full relative group select-none"
                  >
                    {/* Top Category Accent Strip */}
                    <div
                      className="w-full h-1.5 shrink-0"
                      style={{ backgroundColor: accentColor }}
                    />

                    {/* Price + Meal/Product Number Banner */}
                    <div className="bg-slate-100 group-hover:bg-amber-100/70 w-full px-1.5 py-0.5 flex items-center justify-between border-b border-slate-200 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-1 rounded border border-slate-300">
                        #{prod.number || prod.id}
                      </span>
                      <span className="text-[12px] font-extrabold text-[#0f1e3c] tabular-nums leading-none">
                        {prod.price.toLocaleString()}
                        <span className="text-[9px] font-normal text-slate-500 mr-0.5">{currency}</span>
                      </span>
                    </div>

                    {/* Product Name */}
                    <div className="flex-1 flex items-center justify-center px-1.5 py-1">
                      <span className="text-[12px] font-bold text-slate-900 leading-tight text-center line-clamp-2 group-hover:text-blue-950">
                        {prod.name}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 text-sm">
                  لا توجد منتجات في هذه الفئة
                </div>
              )}
            </div>
          </div>

          {/* ── Keyboard Shortcuts Guide Bar ── */}
          <div className="bg-[#0b1528] text-white/70 text-[10px] px-3 py-1 flex items-center justify-between border-t border-slate-800 shrink-0 select-none overflow-x-auto gap-2">
            <span className="font-bold text-amber-400 shrink-0">⌨️ الاختصارات:</span>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
              <span><kbd className="bg-slate-800 text-amber-300 px-1 rounded text-[9px] font-mono border border-slate-700">F4</kbd> فاتورة جديدة</span>
              <span><kbd className="bg-slate-800 text-amber-300 px-1 rounded text-[9px] font-mono border border-slate-700">Ctrl+1..9</kbd> تنقل فواتير</span>
              <span><kbd className="bg-slate-800 text-amber-300 px-1 rounded text-[9px] font-mono border border-slate-700">F9</kbd> آخر فاتورة</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">رقم+Enter</kbd> إضافة صنف</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">↑↓</kbd> تنقل</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">←→</kbd> تعديل كمية</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F2</kbd> دفع</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F3</kbd> مسح</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F7</kbd> نوع الطلب</span>
              {isPrivilegedUser && <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F8</kbd> إعادة طباعة</span>}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between font-bold text-lg bg-amber-50 rounded-lg p-3 border border-amber-200">
              <span>المبلغ المطلوب</span>
              <span className="text-amber-600 tabular-nums">{total.toFixed(2)} {currency}</span>
            </div>
            {paymentMethod === "credit" && (
              <div className="space-y-2">
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={creditPartyType === "customer" ? "default" : "outline"}
                    onClick={() => setCreditPartyType("customer")}
                    className="flex-1 text-xs font-bold"
                  >
                    حساب عميل
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={creditPartyType === "supplier" ? "default" : "outline"}
                    onClick={() => setCreditPartyType("supplier")}
                    className="flex-1 text-xs font-bold"
                  >
                    حساب مورد
                  </Button>
                </div>
                {creditPartyType === "customer" ? (
                  <div className="space-y-1">
                    <label className="text-sm text-slate-500 font-bold">تحديد العميل (لآجل)</label>
                    <SearchableSelect
                      options={customers.map((c: any) => ({
                        value: String(c.id),
                        label: c.name,
                        sublabel: c.phone || "بدون رقم هاتف",
                        badge: c.balance ? `رصيد: ${c.balance}` : undefined
                      }))}
                      value={selectedCustomerId?.toString() || ""}
                      onChange={(val) => setSelectedCustomerId(Number(val))}
                      placeholder="اختر العميل من القائمة..."
                      searchPlaceholder="ابحث باسم العميل أو رقم الهاتف..."
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-sm text-slate-500 font-bold">تحديد المورد (لآجل)</label>
                    <SearchableSelect
                      options={suppliers.map((s: any) => ({
                        value: String(s.id),
                        label: s.name,
                        sublabel: s.phone || "بدون رقم هاتف",
                        badge: s.balance ? `رصيد: ${s.balance}` : undefined
                      }))}
                      value={selectedSupplierId?.toString() || ""}
                      onChange={(val) => setSelectedSupplierId(Number(val))}
                      placeholder="اختر المورد من القائمة..."
                      searchPlaceholder="ابحث باسم المورد أو رقم الهاتف..."
                    />
                  </div>
                )}
              </div>
            )}
            
            {(paymentMethod === "cash" || paymentMethod === "mixed") && (
              <div className="space-y-1">
                <label className="text-sm text-slate-500">المبلغ المدفوع نقداً</label>
                <Input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmPay();
                    }
                  }}
                  placeholder="0"
                  className="text-center text-xl font-bold h-12"
                  dir="ltr"
                  autoFocus
                />
                {parseFloat(cashGiven) >= total && (
                  <div className="flex justify-between text-sm font-bold bg-green-50 rounded p-2 text-green-700">
                    <span>الباقي</span>
                    <span className="tabular-nums">{change.toFixed(2)} {currency}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>إلغاء</Button>
            <Button
              onClick={confirmPay}
              disabled={createOrderMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent dir="rtl" className="max-w-md max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4 text-green-600" />
              <span>تمت العملية</span>
              {lastOrder && (
                <Badge variant="outline" className="text-xs mr-auto">{lastOrder.invoiceNumber}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {lastOrder && (
              <ReceiptPreview
                order={lastOrder}
                settings={settings ?? undefined}
                cashierName={user?.name}
                masterCopiesCount={masterCopiesCount}
                copyLabels={copyLabels}
                deptGroups={deptGroups}
              />
            )}
          </ScrollArea>

          <div className="px-4 py-3 border-t shrink-0 flex gap-2 justify-between">
            <Button variant="outline" size="sm" onClick={() => setShowReceipt(false)}>إغلاق</Button>
            <div className="flex gap-2">
              {lastOrder && isPrivilegedUser && (
                <Button variant="outline" size="sm" onClick={handleReprint} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  إعادة طباعة
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => { if (lastOrder) triggerDirectPrint(lastOrder); }}
                className="gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة
                {deptGroups.length > 0 && <span className="opacity-70">+ {deptGroups.length} قسم</span>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Balance Block Modal */}
      <EmployeeBalanceBlockModal
        open={showBalanceBlockModal}
        onClose={() => {
          setShowBalanceBlockModal(false);
        }}
        employee={foundEmployee}
        orderTotal={total}
        currency={currency}
        isPrivilegedUser={isPrivilegedUser}
        onAuthorizeAndProceed={(options) => {
          setShowBalanceBlockModal(false);
          if (foundEmployee) {
            if (options?.permanentAllow) {
              setFoundEmployee({ ...foundEmployee, allow_exceed_balance: 1 });
            }
            if (options?.newCreditLimit !== undefined) {
              setFoundEmployee({ ...foundEmployee, credit_limit: options.newCreditLimit });
            }
          }
          confirmMealDeduction({ admin_override: true });
        }}
      />

      {/* Meal Deduction Confirm Dialog */}
      <Dialog open={showMealConfirm} onOpenChange={v => { if (!v) { setShowMealConfirm(false); setFoundEmployee(null); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-amber-600" />تأكيد وجبة الموظف
            </DialogTitle>
          </DialogHeader>
          {foundEmployee && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="font-bold text-sm">{foundEmployee.name}</div>
                <div className="text-xs text-muted-foreground">رقم الموظف: {foundEmployee.employee_number}</div>
                {foundEmployee.department_name && <div className="text-xs text-muted-foreground">القسم: {foundEmployee.department_name}</div>}
                {foundEmployee.meal_deductions_this_month > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    خصم وجبات الشهر الحالي: {Number(foundEmployee.meal_deductions_this_month).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">الأصناف:</div>
                {cart.map(i => (
                  <div key={i.product.id} className="flex justify-between text-xs">
                    <span>{i.product.name} × {i.quantity}</span>
                    <span className="font-mono">{(i.product.price * i.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1">
                  <span>إجمالي الخصم:</span>
                  <span className="text-destructive font-mono">{total.toFixed(2)} {currency}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">سيُخصَم هذا المبلغ من راتب الموظف عند صرف الراتب.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMealConfirm(false); setFoundEmployee(null); }}>إلغاء</Button>
            <Button onClick={() => confirmMealDeduction()} disabled={createOrderMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              <UtensilsCrossed className="w-4 h-4 me-2" />تأكيد الوجبة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint Reason Dialog */}
      <Dialog open={showReprintDialog} onOpenChange={setShowReprintDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>سبب إعادة الطباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">يرجى إدخال سبب إعادة الطباعة (سيُسجَّل في سجل الطباعة)</p>
            <Input
              value={reprintReason}
              onChange={e => setReprintReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && reprintReason.trim()) {
                  e.preventDefault();
                  confirmReprint();
                }
              }}
              placeholder="مثال: الفاتورة تالفة، طلب العميل..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprintDialog(false)}>إلغاء</Button>
            <Button onClick={confirmReprint} disabled={!reprintReason.trim()}>
              <Printer className="w-4 h-4 me-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervisor Discount Authorization Dialog */}
      <Dialog open={showSupervisorDialog} onOpenChange={setShowSupervisorDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>إذن المشرف لفتح الخصم</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-lg leading-relaxed">
              خاصية الخصم مقفلة للكاشير في إعدادات النظام. يرجى إدخال بيانات اعتماد المدير أو المشرف للسماح بتطبيق الخصم على هذا الطلب.
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">اسم المستخدم (المدير / المشرف)</label>
              <Input
                value={supervisorUsername}
                onChange={e => setSupervisorUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">كلمة المرور</label>
              <Input
                type="password"
                value={supervisorPassword}
                onChange={e => setSupervisorPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAuthorizeSupervisor();
                  }
                }}
                placeholder="••••••"
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowSupervisorDialog(false); setSupervisorUsername(""); setSupervisorPassword(""); }}>
              إلغاء
            </Button>
            <Button
              onClick={handleAuthorizeSupervisor}
              disabled={isAuthorizingSupervisor || !supervisorUsername.trim() || !supervisorPassword.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isAuthorizingSupervisor ? "جاري التحقق..." : "تأكيد ومنح الخصم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* POS Scanner Diagnostic Dialog */}
      <ScannerDiagnosticDialog
        isOpen={showScannerDiagnostics}
        onClose={() => setShowScannerDiagnostics(false)}
        logs={scannerDiagnosticLogs}
        onClearLogs={() => setScannerDiagnosticLogs([])}
        products={products}
        onSimulateScan={handleBarcodeScan}
      />

      {/* Employee Selection Dialog for Meal Mode */}
      <Dialog open={showEmpPicker} onOpenChange={setShowEmpPicker}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] flex flex-col p-4 gap-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UtensilsCrossed className="w-5 h-5 text-amber-600" />
              اختيار موظف لوجبة الموظفين
            </DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <Input
              type="text"
              value={empPickerSearch}
              onChange={e => setEmpPickerSearch(e.target.value)}
              placeholder="ابحث باسم الموظف، الرقم الوظيفي، أو القسم..."
              className="pr-9 text-xs font-semibold h-9"
              autoFocus
            />
            {empPickerSearch && (
              <button
                type="button"
                onClick={() => setEmpPickerSearch("")}
                className="absolute left-3 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Scrollable Employees List */}
          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 border rounded-lg p-2 bg-slate-50">
            {employees
              .filter((emp: any) => {
                if (!empPickerSearch.trim()) return true;
                const q = empPickerSearch.toLowerCase().trim();
                return (
                  emp.name?.toLowerCase().includes(q) ||
                  String(emp.employee_number || "").includes(q) ||
                  emp.department_name?.toLowerCase().includes(q) ||
                  emp.position?.toLowerCase().includes(q)
                );
              })
              .map((emp: any) => (
                <div
                  key={emp.id}
                  onClick={() => {
                    setEmpNumInput(String(emp.employee_number || ""));
                    setFoundEmployee(emp);
                    setShowEmpPicker(false);
                    setEmpPickerSearch("");

                    const bal = Number(emp.balance || 0);
                    const lim = emp.credit_limit !== null && emp.credit_limit !== undefined ? Number(emp.credit_limit) : 20000;
                    const ded = Number(emp.meal_deductions_this_month || 0);
                    const avail = bal + lim - ded;
                    const allowExceed = Boolean(emp.allow_exceed_balance);
                    const blockInsufficient = emp.block_insufficient_balance !== undefined ? Boolean(emp.block_insufficient_balance) : true;

                    if (blockInsufficient && !allowExceed && !isPrivilegedUser && !supervisorAuthorized && total > avail && total > 0) {
                      setShowBalanceBlockModal(true);
                    } else {
                      setShowMealConfirm(true);
                    }
                  }}
                  className="bg-white border rounded-lg p-3 flex items-center justify-between gap-2 hover:border-amber-500 hover:bg-amber-50/50 transition-colors cursor-pointer shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>{emp.name}</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono border">
                        #{emp.employee_number || emp.id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      {emp.department_name && <span>القسم: <strong>{emp.department_name}</strong></span>}
                      {emp.position && <span>المسمى: <strong>{emp.position}</strong></span>}
                    </div>
                    {Number(emp.meal_deductions_this_month) > 0 && (
                      <div className="text-[11px] text-amber-700 font-bold mt-1">
                        إجمالي خصم الوجبات هذا الشهر: {Number(emp.meal_deductions_this_month).toLocaleString()} {currency}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0"
                  >
                    تحديد الموظف ↵
                  </Button>
                </div>
              ))}

            {employees.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">لا يوجد موظفين مسجلين بالنظام</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEmpPicker(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Last Invoice Modal with Granular User Permission Control ─── */}
      <Dialog open={showLastInvoiceModal} onOpenChange={setShowLastInvoiceModal}>
        <DialogContent dir="rtl" className="max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3.5 bg-gradient-to-r from-[#1e3a8a] to-[#0f172a] text-white shrink-0 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-400/20 rounded-md border border-amber-400/40">
                  <FileText className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    <span>بيانات آخر فاتورة تم إصدارها</span>
                    {lastInvoiceData && (
                      <Badge className="bg-amber-400 text-slate-950 font-mono font-bold text-xs">
                        {lastInvoiceData.invoiceNumber}
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-[11px] text-blue-200">استدعاء سريع ومعاينة تفاصيل الفاتورة وإعادة الطباعة مع تدقيق الصلاحيات</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-5 py-4 max-h-[60vh]">
            {lastInvoiceData ? (
              <div className="space-y-3.5 text-xs">
                {/* Metadata Header Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                  <div>
                    <span className="block text-[10px] text-slate-400">رقم الفاتورة:</span>
                    <strong className="font-mono text-xs text-blue-900">{lastInvoiceData.invoiceNumber}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">التاريخ والوقت:</span>
                    <strong className="font-mono text-[11px]">
                      {lastInvoiceData.createdAt ? new Date(lastInvoiceData.createdAt).toLocaleString("ar-SA") : "الآن"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">الكاشير:</span>
                    <strong>{lastInvoiceData.userName || user?.name || "الكاشير"}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">نوع الطلب:</span>
                    <span className="font-bold text-amber-700">
                      {ORDER_TYPE_LABELS[lastInvoiceData.orderType as OrderType] || lastInvoiceData.orderType}
                      {lastInvoiceData.tableNumber ? ` (طاولة ${lastInvoiceData.tableNumber})` : ""}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_50px_70px_80px] bg-slate-100 font-bold p-2 text-slate-700 text-[11px] border-b">
                    <span>الصنف</span>
                    <span className="text-center">الكمية</span>
                    <span className="text-center">السعر</span>
                    <span className="text-center">الإجمالي</span>
                  </div>
                  <div className="divide-y max-h-44 overflow-y-auto">
                    {lastInvoiceData.items?.map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-[1fr_50px_70px_80px] p-2 items-center hover:bg-slate-50 text-[11px]">
                        <span className="font-semibold text-slate-900">{item.productName}</span>
                        <span className="text-center font-mono font-bold bg-slate-100 py-0.5 rounded text-slate-800">x{item.quantity}</span>
                        <span className="text-center font-mono text-slate-600">{Number(item.unitPrice).toLocaleString()}</span>
                        <span className="text-center font-mono font-bold text-blue-950">{(item.quantity * item.unitPrice).toLocaleString()} {currency}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amounts Breakdown */}
                <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200/80 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono font-bold">{Number(lastInvoiceData.subtotal).toLocaleString()} {currency}</span>
                  </div>
                  {Number(lastInvoiceData.discount) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>الخصم المالي:</span>
                      <span className="font-mono">-{Number(lastInvoiceData.discount).toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {Number(lastInvoiceData.tax) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>ضريبة القيمة المضافة:</span>
                      <span className="font-mono">+{Number(lastInvoiceData.tax).toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-blue-950 border-t border-blue-200 pt-1.5 mt-1">
                    <span>صافي الفاتورة الإجمالي:</span>
                    <span className="font-mono text-base text-emerald-700">{Number(lastInvoiceData.total).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                    <span>طريقة السداد:</span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {lastInvoiceData.paymentMethod === "cash" ? "نقداً" : lastInvoiceData.paymentMethod === "card" ? "شبكة / بطاقة" : lastInvoiceData.paymentMethod === "mixed" ? "دفع مختلط" : "آجل"}
                    </Badge>
                  </div>
                </div>

                {/* Reprint Permission Feedback Banner */}
                {(() => {
                  const { canMaster, canDept, canAll } = lastInvoicePermFlags;
                  if (!canMaster && !canDept && !canAll) {
                    return (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                        <Lock className="w-4 h-4 text-red-600 shrink-0" />
                        <span>تنبيه: تم إيقاف صلاحية أزرار طباعة آخر فاتورة لهذا المستخدم من قِبل إدارة النظام (معاينة البيانات فقط).</span>
                      </div>
                    );
                  }
                  if (!canMaster || !canDept || !canAll) {
                    const allowedNames: string[] = [];
                    if (canMaster) allowedNames.push("طباعة الفاتورة الكبيرة");
                    if (canDept) allowedNames.push("طباعة فواتير التصنيفات");
                    if (canAll) allowedNames.push("طباعة الكل");
                    return (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>ملاحظة: الأزرار المسموحة لحسابك حسب صلاحيات المستخدم: ({allowedNames.join(" ، ")}).</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">لا توجد بيانات متاحة لآخر فاتورة</div>
            )}
          </ScrollArea>

          {/* Footer Actions based on User Permission */}
          <div className="px-5 py-3 border-t bg-slate-50 shrink-0 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowLastInvoiceModal(false)}>
              إغلاق
            </Button>

            {lastInvoiceData && (
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const { canMaster, canDept, canAll } = lastInvoicePermFlags;

                  if (!canMaster && !canDept && !canAll) {
                    return (
                      <Button disabled size="sm" variant="secondary" className="text-xs text-slate-400 gap-1.5 opacity-60">
                        <Lock className="w-3.5 h-3.5" />
                        أزرار الطباعة مقفلة حسب صلاحيات المستخدم
                      </Button>
                    );
                  }

                  return (
                    <>
                      {/* Button 1: Master Invoice Only */}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canMaster}
                        onClick={() => {
                          if (!canMaster) {
                            toast({ variant: "destructive", title: "غير مصرح", description: "ليس لديك صلاحية طباعة الفاتورة الكبيرة" });
                            return;
                          }
                          triggerDirectPrint(lastInvoiceData, true, "إعادة طباعة الفاتورة الكبيرة فقط", "master_only");
                          toast({ title: "🖨️ جاري طباعة الفاتورة الكبيرة فقط", description: lastInvoiceData.invoiceNumber });
                        }}
                        className={cn(
                          "text-xs font-bold gap-1.5 shadow-xs",
                          canMaster ? "text-slate-800 hover:bg-slate-100" : "text-slate-400 opacity-60 cursor-not-allowed"
                        )}
                        title={canMaster ? "طباعة الفاتورة الكبيرة للعميل فقط" : "مقفل حسب صلاحيات المستخدم"}
                      >
                        {canMaster ? <Printer className="w-3.5 h-3.5 text-blue-700" /> : <Lock className="w-3.5 h-3.5 text-red-500" />}
                        طباعة الفاتورة الكبيرة
                      </Button>

                      {/* Button 2: Department / Kitchen Slips Only */}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canDept}
                        onClick={() => {
                          if (!canDept) {
                            toast({ variant: "destructive", title: "غير مصرح", description: "ليس لديك صلاحية طباعة فواتير التصنيفات" });
                            return;
                          }
                          const printMode = (settings as any)?.printMode ?? "browser";
                          const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
                          if (printMode === "silent" && mainPrinter && mainPrinter.trim()) {
                            silentPrintDeptOnly(lastInvoiceData);
                          } else {
                            triggerDirectPrint(lastInvoiceData, true, "إعادة طباعة فواتير التصنيفات فقط", "dept_only");
                          }
                          toast({ title: "👨‍🍳 جاري طباعة فواتير التصنيفات / الأقسام منفصلة", description: lastInvoiceData.invoiceNumber });
                        }}
                        className={cn(
                          "text-xs font-bold gap-1.5 shadow-xs",
                          canDept ? "text-amber-900 border-amber-300 hover:bg-amber-50" : "text-slate-400 opacity-60 cursor-not-allowed"
                        )}
                        title={canDept ? "طباعة فواتير التصنيفات والأقسام فقط (كل تصنيف منفصل)" : "مقفل حسب صلاحيات المستخدم"}
                      >
                        {canDept ? <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-red-500" />}
                        طباعة فواتير التصنيفات
                      </Button>

                      {/* Button 3: Print All (Master + Dept) */}
                      <Button
                        size="sm"
                        disabled={!canAll}
                        onClick={() => {
                          if (!canAll) {
                            toast({ variant: "destructive", title: "غير مصرح", description: "ليس لديك صلاحية استخدام زر طباعة الكل" });
                            return;
                          }
                          triggerDirectPrint(lastInvoiceData, true, "إعادة طباعة شاملة لآخر فاتورة", "all");
                          toast({ title: "🖨️ جاري طباعة الكل (كل فاتورة منفصلة)", description: "الفاتورة الكبيرة + فواتير كل تصنيف منفصلة" });
                        }}
                        className={cn(
                          "text-xs font-bold gap-1.5 shadow-xs",
                          canAll ? "bg-blue-700 hover:bg-blue-800 text-white" : "bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                        )}
                        title={canAll ? "طباعة الفاتورة الكبيرة وفواتير كافة التصنيفات (كل فاتورة منفصلة)" : "مقفل حسب صلاحيات المستخدم"}
                      >
                        {canAll ? <Printer className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-red-500" />}
                        طباعة الكل (الكبيرة + التصنيفات)
                      </Button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
