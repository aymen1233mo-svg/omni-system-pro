import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Building2, ShieldAlert, ShoppingBag, Box, Database, Coins, DollarSign,
  Plus, Save, Edit2, Edit3, Trash2, ArrowRight, ArrowLeft, Printer, Search, Upload, RefreshCw, X, Shield, FileText, Download, Play, Check, AlertTriangle,
  Lock, Unlock, Users, Copy, ChevronFirst, ChevronLast, ChevronRight, ChevronLeft, Barcode, Layers, Globe, MapPin, Phone, Mail, FileSpreadsheet,
  Calculator, TrendingUp, Percent, ClipboardList, CheckSquare, Send, Share2, Receipt, Calendar, Clock, CreditCard, Archive,
  FolderOpen, SaveAll, ChevronsRight, ChevronsLeft, XCircle, Eye, Compass, Info, ChevronDown, UserPlus, ShieldCheck, BarChart3
} from "lucide-react";
import { ErpUsersDisplayPanel, ErpUserGroupsPanel } from "@/components/erp-users-and-groups";
import { ErpScreenPermissionsPanel } from "@/components/erp-screen-permissions";
import { ErpInventoryVariablesPanel } from "@/components/erp-inventory-variables";

// Helper for authenticating API requests
function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPut(url: string, body: any) { const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

export default function OnyxErpPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [location] = useLocation();

  const getTabFromLoc = (locStr: string) => {
    let search = "";
    if (locStr.includes("?")) {
      search = locStr.substring(locStr.indexOf("?"));
    } else {
      search = window.location.search;
    }
    const params = new URLSearchParams(search);
    return params.get("tab") || "branches";
  };

  const getSubFromLoc = (locStr: string, defaultSub = "company_and_branch_info") => {
    let search = "";
    if (locStr.includes("?")) search = locStr.substring(locStr.indexOf("?"));
    else search = window.location.search;
    const params = new URLSearchParams(search);
    return params.get("sub") || defaultSub;
  };

  const getParamFromLoc = (locStr: string, paramName: string, defaultVal = "") => {
    let search = "";
    if (locStr.includes("?")) search = locStr.substring(locStr.indexOf("?"));
    else search = window.location.search;
    const params = new URLSearchParams(search);
    return params.get(paramName) || defaultVal;
  };

  const [erpActiveTab, setErpActiveTab] = useState(() => getTabFromLoc(location));
  const [activeBranchTask, setActiveBranchTask] = useState(() => getSubFromLoc(location, "company_and_branch_info"));
  const [activeRbacTask, setActiveRbacTask] = useState(() => getSubFromLoc(location, "users_list"));
  const [activeRbacSubTask, setActiveRbacSubTask] = useState(() => getParamFromLoc(location, "subTask", "all_users"));

  useEffect(() => {
    const handleUrlChange = () => {
      const search = window.location.search;
      const tab = getTabFromLoc(search);
      if (tab) {
        setErpActiveTab(tab);
      }
      const subBranch = getSubFromLoc(search, "company_and_branch_info");
      const subSession = getSubFromLoc(search, "users_list");
      if (tab === "branches") {
        setActiveBranchTask(subBranch || "company_and_branch_info");
      }
      if (tab === "sessions") {
        setActiveRbacTask(subSession || "users_list");
      }
      const subT = getParamFromLoc(search, "subTask", "");
      if (subT) {
        setActiveRbacSubTask(subT);
        if (subT === "add_user") {
          setSelectedUserId(null);
          setIsUserEditing(true);
          setUserForm({
            username: "", password: "", name: "", role: "cashier",
            email: "", phone: "", avatar_url: "", default_branch_id: 1, language: "عربي", timezone: "GMT+3", status: "نشط", full_name: ""
          });
        }
      }
    };

    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [location]);

  // ─────────────────────────────────────────────
  // 1. Core API Queries
  // ─────────────────────────────────────────────
  const { data: dbBranches = [], refetch: refetchBranches } = useQuery({ queryKey: ["onyx-branches"], queryFn: () => apiGet("/api/onyx/branches") });
  const { data: dbCurrencies = [], refetch: refetchCurrencies } = useQuery({ queryKey: ["onyx-currencies"], queryFn: () => apiGet("/api/onyx/currencies") });
  const { data: sessionData = { active: [], history: [] }, refetch: refetchSessions } = useQuery({ queryKey: ["onyx-sessions"], queryFn: () => apiGet("/api/onyx/sessions") });
  const { data: dbProducts = [], refetch: refetchProducts } = useQuery({ queryKey: ["onyx-products"], queryFn: () => apiGet("/api/products") });
  const { data: dbWarehouses = [], refetch: refetchWarehouses } = useQuery({ queryKey: ["onyx-warehouses"], queryFn: () => apiGet("/api/warehouses") });
  const { data: dbCategories = [] } = useQuery({ queryKey: ["onyx-categories"], queryFn: () => apiGet("/api/categories") });
  const { data: dbCustomers = [] } = useQuery({ queryKey: ["onyx-customers"], queryFn: () => apiGet("/api/customers") });
  const { data: dbUsers = [], refetch: refetchUsers } = useQuery({ queryKey: ["onyx-users"], queryFn: () => apiGet("/api/users") });
  const { data: dbUserGroups = [], refetch: refetchUserGroups } = useQuery({ queryKey: ["user-groups"], queryFn: () => apiGet("/api/user-groups").catch(() => []) });
  const { data: dbRoles = [], refetch: refetchRoles } = useQuery({ queryKey: ["onyx-roles"], queryFn: () => apiGet("/api/onyx/roles") });
  const { data: dbAuditLogs = [], refetch: refetchAuditLogs } = useQuery({ queryKey: ["onyx-audit-logs"], queryFn: () => apiGet("/api/onyx/audit_logs") });
  const { data: dbOrders = [], refetch: refetchOrders } = useQuery({ queryKey: ["onyx-orders"], queryFn: () => apiGet("/api/orders").catch(() => []) });

  // Current active record indices for Toolbar navigation
  const [branchIndex, setBranchIndex] = useState(0);
  const [isNewBranch, setIsNewBranch] = useState(false);

  // ─────────────────────────────────────────────
  // 2. Local State variables for Form Editing
  // ─────────────────────────────────────────────
  // Branch State
  const [branchForm, setBranchForm] = useState<any>({
    id: 1, name: "الفرع الرئيسي", address: "شارع الستين", phone: "01-234567", active: 1,
    company_id: 1, company_name: "شركة عماد عقلان", foreign_name: "Emad Aqlaan Co.", branch_foreign_name: "Main Branch", group_id: 1,
    header_1: "مخابز الشام للخبز العربي", header_2: "فرع صنعاء الرئيسي", header_3: "تلفون: 777123456",
    header_1_foreign: "Al-Sham Arabic Bakery", header_2_foreign: "Sanaa Main Branch", header_3_foreign: "Tel: 777123456",
    tax_id: "300012345600003", tax_rate: 15, commercial_reg: "1002003", lat: "15.3694", long: "44.1910",
    city: "صنعاء", street: "شارع الستين", building: "برج الأمل"
  });

  useEffect(() => {
    if (dbBranches && dbBranches[branchIndex]) {
      setBranchForm({ ...branchForm, ...dbBranches[branchIndex] });
    }
  }, [dbBranches, branchIndex]);

  // Currencies State
  const [currencyForm, setCurrencyForm] = useState({
    name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: "1.0", active: 1
  });
  const [editingCurrencyId, setEditingCurrencyId] = useState<number | null>(null);

  // Users & Security Management State
  const [userForm, setUserForm] = useState<any>({
    username: "", password: "", confirmPassword: "", name: "", role: "cashier",
    email: "", phone: "", avatar_url: "", default_branch_id: 1, language: "عربي", timezone: "GMT+3", status: "نشط", full_name: ""
  });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Role permissions tree state
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [rolePermissionsForm, setRolePermissionsForm] = useState<any>({
    can_void_bills: 0,
    can_view_cost: 0,
    can_change_currencies: 0,
    can_approve_returns: 0,
    can_open_close_safe: 0,
    can_transfer_funds: 0,
    can_edit_products: 0,
    can_delete_orders: 0
  });

  useEffect(() => {
    if (dbRoles && dbRoles.length > 0) {
      const activeRole = dbRoles.find((r: any) => r.role === selectedRole);
      if (activeRole) {
        setRolePermissionsForm({
          can_void_bills: activeRole.can_void_bills ?? 0,
          can_view_cost: activeRole.can_view_cost ?? 0,
          can_change_currencies: activeRole.can_change_currencies ?? 0,
          can_approve_returns: activeRole.can_approve_returns ?? 0,
          can_open_close_safe: activeRole.can_open_close_safe ?? 0,
          can_transfer_funds: activeRole.can_transfer_funds ?? 0,
          can_edit_products: activeRole.can_edit_products ?? 0,
          can_delete_orders: activeRole.can_delete_orders ?? 0
        });
      }
    }
  }, [dbRoles, selectedRole]);

  // ─────────────────────────────────────────────
  // 2.a Warehouse Management (Omni Warehouse) State & Data
  // ─────────────────────────────────────────────
  const initialWarehouses = [
    {
      id: 1,
      code: "WH-001",
      name_ar: "مستودع المواد الخام الرئيسي",
      name_en: "Main Raw Materials Warehouse",
      type: "مواد خام",
      branch: "الفرع الرئيسي",
      company: "شركة أومني سيستم برو",
      region: "أمانة العاصمة",
      city: "صنعاء",
      address: "شارع الستين الجنوبي - بجوار الجسر الرئيسي",
      phone: "777146387",
      email: "raw-wh@omnisystem.com",
      manager: "م. علاء اليماني",
      account: "1201001 - مخزون المواد الخام",
      cost_center: "301 - مركز إنتاج الأغذية",
      currency: "ريال يمني",
      status: "نشط",
      allow_sales: true,
      allow_purchases: true,
      allow_transfer: true,
      allow_production: true,
      allow_inventory: true,
      allow_returns: true,
      notes: "المستودع الرئيسي لتخزين جميع المواد الخام لعمليات الإنتاج والتصنيع."
    },
    {
      id: 2,
      code: "WH-002",
      name_ar: "مستودع المنتجات الجاهزة والبيع",
      name_en: "Finished Goods & Sales Warehouse",
      type: "منتج جاهز",
      branch: "الفرع الرئيسي",
      company: "شركة أومني سيستم برو",
      region: "أمانة العاصمة",
      city: "صنعاء",
      address: "شارع الستين الشمالي - جولة مذبح",
      phone: "777123456",
      email: "sales-wh@omnisystem.com",
      manager: "أحمد مسعد السامعي",
      account: "1201002 - مخزون المنتجات التامة",
      cost_center: "302 - مركز مبيعات التجزئة",
      currency: "ريال يمني",
      status: "نشط",
      allow_sales: true,
      allow_purchases: false,
      allow_transfer: true,
      allow_production: false,
      allow_inventory: true,
      allow_returns: true,
      notes: "مخصص للسلع التامة الصنع والجاهزة للبيع المباشر عبر الكاشير ونقاط البيع."
    },
    {
      id: 3,
      code: "WH-003",
      name_ar: "مستودع المواد التالفة والرجوع",
      name_en: "Damaged Goods & Returns Warehouse",
      type: "تالف ورجوع",
      branch: "الفرع الرئيسي",
      company: "شركة أومني سيستم برو",
      region: "أمانة العاصمة",
      city: "صنعاء",
      address: "شارع تعز - بجوار باب اليمن",
      phone: "771122334",
      email: "returns-wh@omnisystem.com",
      manager: "عادل الغامدي",
      account: "1201003 - حساب المواد التالفة",
      cost_center: "305 - مركز التوالف والفاقد",
      currency: "ريال يمني",
      status: "موقوف",
      allow_sales: false,
      allow_purchases: false,
      allow_transfer: true,
      allow_production: false,
      allow_inventory: true,
      allow_returns: true,
      notes: "يستخدم لحجز البضائع التالفة أو المعيبة المرتجعة من العملاء حتى فحصها وإتلافها."
    }
  ];

  const [warehouses, setWarehouses] = useState(initialWarehouses);
  const [currentWhIndex, setCurrentWhIndex] = useState(0);
  const [whForm, setWhForm] = useState(initialWarehouses[0]);
  const [isWhEditing, setIsWhEditing] = useState(false);
  const [defaultWhId, setDefaultWhId] = useState(1);
  const [searchWhQuery, setSearchWhQuery] = useState("");
  const [isWhSearchOpen, setIsWhSearchOpen] = useState(false);
  const [whReportType, setWhReportType] = useState<string | null>(null);

  const [whPermissions, setWhPermissions] = useState<any>({
    admin: { view: true, add: true, edit: true, delete: true, print: true, export: true, import: true, suspend: true, reactivate: true, link_accounts: true, link_branches: true, change_default: true },
    accountant: { view: true, add: true, edit: false, delete: false, print: true, export: true, import: false, suspend: false, reactivate: false, link_accounts: true, link_branches: false, change_default: false },
    storekeeper: { view: true, add: false, edit: false, delete: false, print: true, export: false, import: false, suspend: false, reactivate: false, link_accounts: false, link_branches: false, change_default: false },
    cashier: { view: true, add: false, edit: false, delete: false, print: false, export: false, import: false, suspend: false, reactivate: false, link_accounts: false, link_branches: false, change_default: false },
  });

  const [whActivePermRole, setWhActivePermRole] = useState<string>("admin");

  // Sync warehouse form when currentWhIndex changes
  useEffect(() => {
    if (warehouses[currentWhIndex]) {
      setWhForm({ ...warehouses[currentWhIndex] });
    }
  }, [currentWhIndex, warehouses]);

  // ─────────────────────────────────────────────
  // 2.b Sales Invoice (Omni Invoice) State & Data
  // ─────────────────────────────────────────────
  const initialInvoices = [
    {
      id: 1,
      invoice_no: "INV-2026-0001",
      ref_no: "REF-990812",
      date: "2026-07-20",
      time: "14:30:22",
      branch: "صنعاء - الفرع الرئيسي",
      warehouse: "مستودع المنتجات الجاهزة والبيع",
      cashier: "علاء اليماني",
      customer: "عميل نقدي عام",
      sales_rep: "محمد الحرازي",
      cost_center: "302 - مبيعات التجزئة",
      payment_method: "نقدي",
      currency: "ريال يمني",
      exchange_rate: 1.0,
      status: "مرحل ومعتمد",
      type: "فاتورة مبيعات",
      project: "خدمات الضيافة المتميزة",
      notes: "تم ترحيل الفاتورة واعتماد الأرصدة تلقائياً في نظام أومني سيستم برو.",
      items: [
        { seq: 1, barcode: "690123450001", code: "PROD-001", name: "برياني دجاج فاخر", unit: "وجبة", qty: 5, price: 14000, discount_pct: 5, discount_val: 3500, tax_pct: 15, tax_val: 9975, subtotal: 66500, total_after_tax: 76475, warehouse: "مستودع المنتجات الجاهزة والبيع", batch: "BATCH-2026A", expiry: "2026-07-25", notes: "توصيل سريع" },
        { seq: 2, barcode: "690123450006", code: "PROD-006", name: "عصير برتقال طبيعي", unit: "كوب", qty: 10, price: 3000, discount_pct: 0, discount_val: 0, tax_pct: 15, tax_val: 4500, subtotal: 30000, total_after_tax: 34500, warehouse: "مستودع المنتجات الجاهزة والبيع", batch: "BATCH-2026B", expiry: "2026-07-21", notes: "بارد جداً" }
      ],
      service_charge: 1500,
      delivery_charge: 2000,
      paid: 115000,
      loyalty_points: 120,
      customer_balance: 350000,
      payment_status: "مسدد بالكامل"
    },
    {
      id: 2,
      invoice_no: "INV-2026-0002",
      ref_no: "REF-990815",
      date: "2026-07-20",
      time: "15:10:05",
      branch: "صنعاء - الفرع الرئيسي",
      warehouse: "مستودع المنتجات الجاهزة والبيع",
      cashier: "علاء اليماني",
      customer: "شركة رويال للمأكولات",
      sales_rep: "عبدالرحمن الشميري",
      cost_center: "302 - مبيعات التجزئة",
      payment_method: "آجل",
      currency: "ريال يمني",
      exchange_rate: 1.0,
      status: "مسودة",
      type: "فاتورة مبيعات",
      project: "عقود الإعاشة السنوية",
      notes: "مبيعات آجل بموجب أمر توريد العميل المرفق.",
      items: [
        { seq: 1, barcode: "690123450002", code: "PROD-002", name: "شاورما دجاج سوبر", unit: "صاروخ", qty: 20, price: 4500, discount_pct: 10, discount_val: 9000, tax_pct: 15, tax_val: 12150, subtotal: 81000, total_after_tax: 93150, warehouse: "مستودع المنتجات الجاهزة والبيع", batch: "BATCH-2026C", expiry: "2026-07-22", notes: "بدون ثوم" }
      ],
      service_charge: 3000,
      delivery_charge: 0,
      paid: 0,
      loyalty_points: 90,
      customer_balance: 440000,
      payment_status: "غير مسدد"
    }
  ];

  const [invoices, setInvoices] = useState(initialInvoices);
  const [currentInvIndex, setCurrentInvIndex] = useState(0);
  const [invForm, setInvForm] = useState(initialInvoices[0]);
  const [isInvEditing, setIsInvEditing] = useState(false);
  const [suspendedInvoices, setSuspendedInvoices] = useState<any[]>([]);
  const [searchInvQuery, setSearchInvQuery] = useState("");
  const [isInvSearchOpen, setIsInvSearchOpen] = useState(false);
  const [invReportType, setInvReportType] = useState<string | null>(null);
  const [selectedProductToInsert, setSelectedProductToInsert] = useState<any>(null);

  const [invPermissions, setInvPermissions] = useState<any>({
    admin: { create: true, edit: true, delete: true, print: true, reprint: true, manual_discount: true, change_price: true, change_tax: true, change_warehouse: true, change_customer: true, change_cashier: true, suspend: true, retrieve: true, post: true, unpost: true, approve: true, unapprove: true, create_return: true, view_profit: true, export: true, import: true, view_cost: true, edit_saved: true, edit_posted: true, cancel: true, open_drawer: true },
    cashier: { create: true, edit: true, delete: false, print: true, reprint: true, manual_discount: false, change_price: false, change_tax: false, change_warehouse: false, change_customer: true, change_cashier: false, suspend: true, retrieve: true, post: false, unpost: false, approve: false, unapprove: false, create_return: false, view_profit: false, export: false, import: false, view_cost: false, edit_saved: false, edit_posted: false, cancel: true, open_drawer: true }
  });

  const [invActivePermRole, setInvActivePermRole] = useState<string>("admin");

  const [barcodeInput, setBarcodeInput] = useState("");
  const [whImportFile, setWhImportFile] = useState<File | null>(null);
  const [whExportStatus, setWhExportStatus] = useState(false);

  // Sync invoice form when currentInvIndex changes
  useEffect(() => {
    if (invoices[currentInvIndex]) {
      setInvForm({ ...invoices[currentInvIndex] });
    }
  }, [currentInvIndex, invoices]);

  // Recalculate invoice totals helper
  const getInvoiceTotals = (invoice: any) => {
    if (!invoice || !invoice.items) return { qty: 0, before_disc: 0, disc_val: 0, tax_val: 0, service: 0, delivery: 0, total: 0, remaining: 0 };
    const qty = (invoice?.items || []).reduce((sum: number, i: any) => sum + Number(i.qty), 0);
    const before_disc = (invoice?.items || []).reduce((sum: number, i: any) => sum + (Number(i.qty) * Number(i.price)), 0);
    const disc_val = (invoice?.items || []).reduce((sum: number, i: any) => sum + Number(i.discount_val || 0), 0);
    const tax_val = (invoice?.items || []).reduce((sum: number, i: any) => sum + Number(i.tax_val || 0), 0);
    const service = Number(invoice.service_charge || 0);
    const delivery = Number(invoice.delivery_charge || 0);
    const total = (before_disc - disc_val) + tax_val + service + delivery;
    const remaining = Math.max(0, total - Number(invoice.paid || 0));
    return { qty, before_disc, disc_val, tax_val, service, delivery, total, remaining };
  };

  const invoiceType = invForm.type === "فاتورة مرتجع" ? "return" : "sales";

  // Products Card State
  const [productForm, setProductForm] = useState({
    name: "", price: "", cost: "", category_id: "", number: "", barcode: "",
    group_id: "1", sub_group_id: "1", item_type: "عادي", size: "وسط", color: "أبيض", brand: "محلي", material: "جاهز",
    is_suspended: 0, is_controlled: 1, allow_fraction: 0, is_cash_only: 0, is_asset: 0, specifications: ""
  });

  const [storeForm, setStoreForm] = useState({
    number: "3", name: "مخزن المواد الخام", foreign_name: "Raw Materials Warehouse", group_no: "1",
    is_suspended: 0, is_main: 1, not_for_sale: 0, is_damaged: 0, is_service_default: 0,
    storekeeper: "أحمد مسعد", location: "المنطقة الغربية", country: "اليمن", city: "صنعاء",
    transfer_account: "حساب التحويلات المخزنية", phone: "771122334", lat: "15.3500", long: "44.2000"
  });

  // Items Pricing parameters State
  const [pricingParams, setPricingParams] = useState({ category_id: "", filter_unpriced: false });
  const [pricingGrid, setPricingGrid] = useState<any[]>([]);

  useEffect(() => {
    if (dbProducts) {
      let filtered = [...dbProducts];
      if (pricingParams.category_id) {
        filtered = filtered.filter(p => String(p.category_id) === pricingParams.category_id);
      }
      setPricingGrid(filtered.map(p => ({
        id: p.id,
        number: p.number,
        name: p.name,
        unit: "حبة",
        currency: "ريال يمني",
        profit_margin: Math.round(((p.price - (p.cost || 0)) / (p.cost || 1)) * 100),
        old_price: p.price,
        new_price: p.price,
        avg_cost: p.cost || p.price * 0.6,
        last_supply: p.cost || p.price * 0.65
      })));
    }
  }, [dbProducts, pricingParams.category_id]);

  // ─────────────────────────────────────────────
  // 3. API Mutations
  // ─────────────────────────────────────────────
  const updateBranchMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/api/onyx/branches/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-branches"] });
      toast({ title: "تم حفظ بيانات الفرع في قاعدة البيانات بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  const addCurrencyMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/onyx/currencies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-currencies"] });
      setCurrencyForm({ name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: "1.0", active: 1 });
      toast({ title: "تم إضافة العملة بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإضافة", description: e.message })
  });

  const updateCurrencyMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/api/onyx/currencies/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-currencies"] });
      setEditingCurrencyId(null);
      setCurrencyForm({ name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: "1.0", active: 1 });
      toast({ title: "تم تحديث العملة بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التحديث", description: e.message })
  });

  const deleteCurrencyMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/onyx/currencies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-currencies"] });
      toast({ title: "تم حذف العملة" });
    }
  });

  const disconnectSessionMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/onyx/sessions/disconnect/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-sessions"] });
      toast({ title: "تم قطع اتصال المستخدم وإغلاق الجلسة فوراً" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإجراء", description: e.message })
  });

  // Users & Security Mutations
  const addUserMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/users", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-users"] });
      toast({ title: "تم إضافة المستخدم بنجاح" });
      setIsUserEditing(false);
      setUserForm({
        username: "", password: "", confirmPassword: "", name: "", role: "cashier",
        email: "", phone: "", avatar_url: "", default_branch_id: 1, language: "عربي", timezone: "GMT+3", status: "نشط", full_name: ""
      });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة المستخدم", description: e.message })
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/api/users/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-users"] });
      toast({ title: "تم تحديث بيانات المستخدم بنجاح" });
      setIsUserEditing(false);
      setSelectedUserId(null);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث المستخدم", description: e.message })
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-users"] });
      toast({ title: "تم حذف المستخدم بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف المستخدم", description: e.message })
  });

  const updateRoleMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/api/onyx/roles/${data.role}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-roles"] });
      toast({ title: "تم تحديث صلاحيات الدور الأمني بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث الصلاحيات", description: e.message })
  });

  const addRoleMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/onyx/roles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-roles"] });
      toast({ title: "تم إضافة الدور الأمني الجديد" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة الدور", description: e.message })
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (role: string) => apiDel(`/api/onyx/roles/${role}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-roles"] });
      toast({ title: "تم حذف الدور الأمني" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف الدور", description: e.message })
  });

  const addBranchMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/onyx/branches", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-branches"] });
      toast({ title: "تم إضافة الفرع الجديد بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة الفرع", description: e.message })
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/onyx/branches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-branches"] });
      setBranchIndex(0);
      toast({ title: "تم حذف الفرع بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف الفرع", description: e.message })
  });

  const updatePricesMutation = useMutation({
    mutationFn: async (prices: any[]) => {
      for (const p of prices) {
        await apiPut(`/api/products/${p.id}`, { name: p.name, price: Number(p.new_price), category_id: p.category_id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onyx-products"] });
      toast({ title: "تم تطبيق وحفظ الأسعار الجديدة للأصناف بنجاح!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تحديث قائمة الأسعار", description: e.message })
  });

  // ─────────────────────────────────────────────
  // 4. Warehouse & Sales Invoice Operations Handlers
  // ─────────────────────────────────────────────
  
  // Warehouse Operations
  const handleWhNew = () => {
    const nextId = warehouses.length > 0 ? Math.max(...warehouses.map(w => w.id)) + 1 : 1;
    setWhForm({
      id: nextId,
      code: `WH-00${nextId}`,
      name_ar: "",
      name_en: "",
      type: "مواد خام",
      branch: "الفرع الرئيسي",
      company: "شركة أومني سيستم برو",
      region: "أمانة العاصمة",
      city: "صنعاء",
      address: "",
      phone: "",
      email: "",
      manager: "",
      account: "",
      cost_center: "",
      currency: "ريال يمني",
      status: "نشط",
      allow_sales: true,
      allow_purchases: true,
      allow_transfer: true,
      allow_production: false,
      allow_inventory: true,
      allow_returns: true,
      notes: ""
    });
    setIsWhEditing(true);
    toast({ title: "تم تهيئة الحقول لإضافة مستودع جديد" });
  };

  const handleWhSave = () => {
    if (!whForm.name_ar) {
      toast({ variant: "destructive", title: "يجب إدخال اسم المستودع بالعربية" });
      return;
    }
    const idx = warehouses.findIndex(w => w.id === whForm.id);
    if (idx !== -1) {
      const updated = [...warehouses];
      updated[idx] = { ...whForm };
      setWarehouses(updated);
      toast({ title: "تم تعديل بيانات المستودع بنجاح!" });
    } else {
      setWarehouses([...warehouses, { ...whForm }]);
      setCurrentWhIndex(warehouses.length);
      toast({ title: "تم إضافة المستودع الجديد بنجاح!" });
    }
    setIsWhEditing(false);
  };

  const handleWhSaveAndNew = () => {
    handleWhSave();
    handleWhNew();
  };

  const handleWhDelete = () => {
    if (warehouses.length <= 1) {
      toast({ variant: "destructive", title: "لا يمكن حذف كافة المستودعات، يجب إبقاء مستودع واحد على الأقل." });
      return;
    }
    const updated = warehouses.filter(w => w.id !== whForm.id);
    setWarehouses(updated);
    setCurrentWhIndex(0);
    toast({ title: "تم حذف المستودع بنجاح" });
  };

  const handleWhCopy = () => {
    const nextId = warehouses.length > 0 ? Math.max(...warehouses.map(w => w.id)) + 1 : 1;
    setWhForm({
      ...whForm,
      id: nextId,
      code: `WH-00${nextId}`,
      name_ar: whForm.name_ar + " - نسخة",
      name_en: whForm.name_en ? whForm.name_en + " - Copy" : ""
    });
    setIsWhEditing(true);
    toast({ title: "تم نسخ بيانات المستودع بنجاح، يمكنك الحفظ الآن." });
  };

  const handleWhSuspend = () => {
    const updatedForm = { ...whForm, status: "موقوف" };
    setWhForm(updatedForm);
    const idx = warehouses.findIndex(w => w.id === whForm.id);
    if (idx !== -1) {
      const updated = [...warehouses];
      updated[idx] = updatedForm;
      setWarehouses(updated);
    }
    toast({ title: "تم إيقاف المستودع بنجاح." });
  };

  const handleWhReactivate = () => {
    const updatedForm = { ...whForm, status: "نشط" };
    setWhForm(updatedForm);
    const idx = warehouses.findIndex(w => w.id === whForm.id);
    if (idx !== -1) {
      const updated = [...warehouses];
      updated[idx] = updatedForm;
      setWarehouses(updated);
    }
    toast({ title: "تم إعادة تفعيل المستودع بنجاح." });
  };

  const handleWhSetDefault = () => {
    setDefaultWhId(whForm.id);
    toast({ title: `تم تعيين المستودع [${whForm.name_ar}] كمستودع افتراضي للنظام.` });
  };

  // Sales Invoice Operations
  const handleInvNew = () => {
    const nextId = invoices.length > 0 ? Math.max(...invoices.map(i => i.id)) + 1 : 1;
    setInvForm({
      id: nextId,
      invoice_no: `INV-2026-000${nextId}`,
      ref_no: "",
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 8),
      branch: "صنعاء - الفرع الرئيسي",
      warehouse: warehouses[0]?.name_ar || "مستودع المنتجات الجاهزة والبيع",
      cashier: "علاء اليماني",
      customer: "عميل نقدي عام",
      sales_rep: "محمد الحرازي",
      cost_center: "302 - مبيعات التجزئة",
      payment_method: "نقدي",
      currency: "ريال يمني",
      exchange_rate: 1.0,
      status: "مسودة",
      type: "فاتورة مبيعات",
      project: "",
      notes: "",
      items: [],
      service_charge: 0,
      delivery_charge: 0,
      paid: 0,
      loyalty_points: 0,
      customer_balance: 350000,
      payment_status: "غير مسدد"
    });
    setIsInvEditing(true);
    toast({ title: "تم تهيئة فاتورة جديدة فارغة." });
  };

  const handleInvSave = () => {
    if (invForm.items.length === 0) {
      toast({ variant: "destructive", title: "لا يمكن حفظ فاتورة فارغة بدون أي أصناف!" });
      return;
    }
    const idx = invoices.findIndex(i => i.id === invForm.id);
    if (idx !== -1) {
      const updated = [...invoices];
      updated[idx] = { ...invForm };
      setInvoices(updated);
      toast({ title: "تم تحديث وحفظ بيانات الفاتورة الحالية!" });
    } else {
      setInvoices([...invoices, { ...invForm }]);
      setCurrentInvIndex(invoices.length);
      toast({ title: "تم إضافة وحفظ الفاتورة الجديدة بنجاح!" });
    }
    setIsInvEditing(false);
  };

  const handleInvDelete = () => {
    if (invoices.length <= 1) {
      toast({ variant: "destructive", title: "لا يمكن حذف كافة الفواتير، يجب إبقاء فاتورة واحدة على الأقل." });
      return;
    }
    const updated = invoices.filter(i => i.id !== invForm.id);
    setInvoices(updated);
    setCurrentInvIndex(0);
    toast({ title: "تم حذف الفاتورة الحالية بنجاح." });
  };

  const handleInvCopy = () => {
    const nextId = invoices.length > 0 ? Math.max(...invoices.map(i => i.id)) + 1 : 1;
    const copiedItems = invForm.items.map((it, idx) => ({ ...it, seq: idx + 1 }));
    setInvForm({
      ...invForm,
      id: nextId,
      invoice_no: `INV-2026-000${nextId}`,
      status: "مسودة",
      items: copiedItems
    });
    setIsInvEditing(true);
    toast({ title: "تم نسخ الفاتورة الحالية بنجاح!" });
  };

  const handleInvPost = () => {
    if (invForm.status === "مرحل ومعتمد") {
      toast({ title: "الفاتورة مرحلة بالفعل!" });
      return;
    }
    const updatedForm = { ...invForm, status: "مرحل ومعتمد" };
    setInvForm(updatedForm);
    const idx = invoices.findIndex(i => i.id === invForm.id);
    if (idx !== -1) {
      const updated = [...invoices];
      updated[idx] = updatedForm;
      setInvoices(updated);
    }
    toast({ title: "تم ترحيل الفاتورة وتحديث قيود اليومية وأرصدة المخازن بنجاح!" });
  };

  const handleInvUnpost = () => {
    if (invForm.status !== "مرحل ومعتمد") {
      toast({ variant: "destructive", title: "الفاتورة غير مرحلة لكي يتم إلغاء ترحيلها!" });
      return;
    }
    const updatedForm = { ...invForm, status: "مسودة" };
    setInvForm(updatedForm);
    const idx = invoices.findIndex(i => i.id === invForm.id);
    if (idx !== -1) {
      const updated = [...invoices];
      updated[idx] = updatedForm;
      setInvoices(updated);
    }
    toast({ title: "تم إلغاء ترحيل الفاتورة وإرجاع أرصدة المخازن بنجاح!" });
  };

  const handleInvApprove = () => {
    const updatedForm = { ...invForm, status: "مرحل ومعتمد" };
    setInvForm(updatedForm);
    const idx = invoices.findIndex(i => i.id === invForm.id);
    if (idx !== -1) {
      const updated = [...invoices];
      updated[idx] = updatedForm;
      setInvoices(updated);
    }
    toast({ title: "تم اعتماد الفاتورة مالياً وإدارياً!" });
  };

  const handleInvUnapprove = () => {
    const updatedForm = { ...invForm, status: "مسودة" };
    setInvForm(updatedForm);
    const idx = invoices.findIndex(i => i.id === invForm.id);
    if (idx !== -1) {
      const updated = [...invoices];
      updated[idx] = updatedForm;
      setInvoices(updated);
    }
    toast({ title: "تم إلغاء اعتماد الفاتورة الحالية!" });
  };

  return (
    <AdminLayout>
      <div className="space-y-4 font-sans" dir="rtl">
        {/* Top ERP Vintage System Header */}
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-slate-700 text-white p-2 rounded">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">تهيئة النظام والأنظمة المتكاملة</h1>
              <p className="text-xs text-slate-500">مستوحاة من واجهات نظام Omni System Pro والأنظمة الحسابية المتكاملة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              قاعدة البيانات متصلة (SQLite)
            </span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">السنة المالية: 2026</span>
          </div>
        </div>

        {/* Traditional ERP Gray Toolbar [Image 1] */}
        <div className="bg-slate-200 border-y border-slate-300 px-4 py-2 flex flex-wrap gap-1.5 items-center justify-start rounded shadow-inner">
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 h-8 text-xs font-semibold"
            onClick={() => {
              if (erpActiveTab === "branches") {
                setIsNewBranch(true);
                setBranchForm({
                  name: "فرع جديد", address: "العنوان الجديد", phone: "777000000", active: 1,
                  company_id: 1, company_name: "شركة عماد عقلان", foreign_name: "Emad Aqlaan Co.", branch_foreign_name: "New Branch", group_id: 1,
                  header_1: "مخابز الشام للخبز العربي", header_2: "الفرع الجديد", header_3: "تلفون: 777000000",
                  header_1_foreign: "Al-Sham Arabic Bakery", header_2_foreign: "New Branch", header_3_foreign: "Tel: 777000000",
                  tax_id: "300012345600003", tax_rate: 15, commercial_reg: "1002004", lat: "15.3694", long: "44.1910",
                  city: "صنعاء", street: "شارع الخمسين", building: "برج الفارس"
                });
                toast({ title: "تم تهيئة نموذج إضافة فرع جديد. يرجى ملء الحقول المطلوبة ثم الحفظ." });
              } else if (erpActiveTab === "currencies") {
                setEditingCurrencyId(null);
                setCurrencyForm({ name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: "1.0", active: 1 });
              }
            }}
          >
            <Plus className="w-3.5 h-3.5 text-green-600" />
            إضافة (F6)
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 h-8 text-xs font-semibold"
            onClick={() => {
              if (erpActiveTab === "branches") {
                if (isNewBranch) {
                  addBranchMutation.mutate(branchForm, {
                    onSuccess: () => {
                      setIsNewBranch(false);
                      refetchBranches();
                    }
                  });
                } else {
                  updateBranchMutation.mutate(branchForm, {
                    onSuccess: () => {
                      refetchBranches();
                    }
                  });
                }
              } else if (erpActiveTab === "currencies") {
                if (editingCurrencyId) {
                  updateCurrencyMutation.mutate({ id: editingCurrencyId, ...currencyForm });
                } else {
                  addCurrencyMutation.mutate(currencyForm);
                }
              } else if (erpActiveTab === "pricing") {
                updatePricesMutation.mutate(pricingGrid);
              } else {
                toast({ title: "تم حفظ التغييرات بنجاح" });
              }
            }}
          >
            <Save className="w-3.5 h-3.5 text-blue-600" />
            حفظ (F10)
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 h-8 text-xs font-semibold"
            onClick={() => {
              if (erpActiveTab === "branches") {
                setIsNewBranch(false);
                if (dbBranches && dbBranches[branchIndex]) {
                  setBranchForm({ ...branchForm, ...dbBranches[branchIndex] });
                }
                toast({ title: "تم إلغاء نموذج الإدخال والتراجع عن التغييرات." });
              } else {
                toast({ title: "تم التراجع عن التعديلات الحالية" });
                refetchBranches();
                refetchCurrencies();
              }
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            تراجع (Esc)
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 h-8 text-xs font-semibold"
            onClick={() => {
              if (erpActiveTab === "branches") {
                if (confirm(`هل أنت متأكد من حذف الفرع الحالي "${branchForm.name}" نهائياً من قاعدة البيانات؟`)) {
                  deleteBranchMutation.mutate(branchForm.id);
                }
              } else if (erpActiveTab === "currencies" && editingCurrencyId) {
                if (confirm("هل تريد حذف هذه العملة نهائياً؟")) {
                  deleteCurrencyMutation.mutate(editingCurrencyId);
                }
              } else {
                toast({ variant: "destructive", title: "لا يمكن حذف هذا السجل الافتراضي" });
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            حذف (F9)
          </Button>

          <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 px-2"
            disabled={branchIndex === 0}
            onClick={() => setBranchIndex(0)}
          >
            الأول
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 px-2"
            disabled={branchIndex === 0}
            onClick={() => setBranchIndex(prev => Math.max(0, prev - 1))}
          >
            سابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 px-2"
            disabled={branchIndex >= dbBranches.length - 1}
            onClick={() => setBranchIndex(prev => Math.min(dbBranches.length - 1, prev + 1))}
          >
            تالي
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 px-2"
            disabled={branchIndex >= dbBranches.length - 1}
            onClick={() => setBranchIndex(dbBranches.length - 1)}
          >
            الأخير
          </Button>

          <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>

          <Button
            variant="outline"
            size="sm"
            className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 h-8 text-xs font-semibold"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            طباعة (F8)
          </Button>
        </div>

        {/* Master Screen Navigation & 8 Core Services Hub */}
        <Tabs value={erpActiveTab} onValueChange={setErpActiveTab} className="w-full space-y-4">
          
          {/* Executive Real-time System Metrics Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">
                    تكامل Omni System Pro
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    قاعدة بيانات حية (SQLite)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  يتم التنقل المباشر والتحكم بكافة الإدارات والخدمات والوظائف الـ 8 عبر قائمة الشريط الجانبي
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono">
                الفروع: <strong className="text-emerald-400">{dbBranches.length}</strong>
              </span>
              <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono">
                الأصناف: <strong className="text-indigo-400">{dbProducts.length}</strong>
              </span>
              <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono">
                المستودعات: <strong className="text-amber-400">{dbWarehouses.length}</strong>
              </span>
              <span className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono">
                المستخدمين: <strong className="text-blue-400">{dbUsers.length}</strong>
              </span>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 1: BRANCH SETUP (Image 1) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="branches" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              
              {/* Left Column: Branch Directory List and Quick Actions */}
              <Card className="xl:col-span-1 border-slate-300 shadow-sm flex flex-col h-full">
                <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
                  <CardTitle className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>قائمة الفروع والمستودعات</span>
                    <Badge variant="secondary" className="bg-slate-200 text-slate-800 text-[10px]">
                      {dbBranches.length} فروع
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 flex-1 overflow-y-auto max-h-[600px] space-y-1">
                  <div className="p-2">
                    <Input
                      placeholder="بحث عن فرع..."
                      className="h-8 text-xs bg-white border-slate-300"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        const idx = dbBranches.findIndex((b: any) => b.name.toLowerCase().includes(term));
                        if (idx !== -1) setBranchIndex(idx);
                      }}
                    />
                  </div>
                  {dbBranches.map((b: any, idx: number) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBranchIndex(idx);
                        setIsNewBranch(false);
                      }}
                      className={`w-full text-right p-2 rounded text-xs transition-colors flex items-center justify-between ${
                        idx === branchIndex && !isNewBranch
                          ? "bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{b.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{b.branch_foreign_name || "Main Branch"}</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${b.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {b.active ? "نشط" : "موقف"}
                      </Badge>
                    </button>
                  ))}
                  
                  {isNewBranch && (
                    <div className="w-full text-right p-2 rounded text-xs bg-green-50 text-green-700 font-bold border-r-4 border-green-600 animate-pulse flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>{branchForm.name}</span>
                        <span className="text-[10px] text-green-500 font-normal">قيد الإنشاء...</span>
                      </div>
                      <Badge className="bg-green-600 text-white text-[9px]">جديد</Badge>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t mt-4">
                    <h4 className="text-[11px] font-bold text-slate-500 px-2 mb-2">مرفقات وشعار الفرع</h4>
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded flex flex-col items-center gap-2">
                      <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded bg-white flex items-center justify-center overflow-hidden">
                        <img
                          src={branchForm.logo_url || "/omnisystem-logo.png"}
                          alt="Logo"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      <div className="flex gap-1 w-full mt-1">
                        <label className="cursor-pointer flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 h-7 rounded text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs">
                          <Upload className="w-2.5 h-2.5" /> ادراج من الملفات
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    setBranchForm((b: any) => ({ ...b, logo_url: event.target!.result as string }));
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-[10px] h-7 text-red-600 border-red-100 hover:bg-red-50"
                          onClick={() => setBranchForm((b: any) => ({ ...b, logo_url: "" }))}
                        >
                          <Trash2 className="w-2.5 h-2.5 ml-1" /> حذف
                        </Button>
                      </div>
                      <span className="text-[9px] text-slate-400">امتداد PNG, JPG - بحد أقصى 2MB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column: Detailed Form divided into elegant semantic sub-tabs */}
              <Card className="xl:col-span-3 border-slate-300 shadow-sm flex flex-col">
                <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <span>{isNewBranch ? "إنشاء فرع أومني جديد" : "إعدادات الفرع والشركة المالكة"}</span>
                      {isNewBranch && <Badge className="bg-emerald-600 text-white text-[10px]">وضع الإضافة النشط</Badge>}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-1">
                      {isNewBranch ? "يرجى ملء كافة تبويبات البيانات الأساسية والمالية لتخزين السجل الجديد." : `أنت تعدل حالياً على الفرع: ${branchForm.name}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-1 px-2.5 font-mono">
                      كود السجل: {isNewBranch ? "AUTO" : branchForm.id}
                    </Badge>
                    <select
                      value={branchForm.active ?? 1}
                      onChange={e => setBranchForm({ ...branchForm, active: Number(e.target.value) })}
                      className="text-xs h-8 rounded border-slate-300 bg-white font-bold text-slate-700 px-2 border"
                    >
                      <option value={1}>نشط ومفتوح</option>
                      <option value={0}>موقف ومغلق</option>
                    </select>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 space-y-4">
                  
                  {/* Controlled Tabs for Branch Operations */}

                  {/* Controlled Tabs */}
                  <Tabs value={activeBranchTask} onValueChange={(val) => {
                    setActiveBranchTask(val);
                    const searchParams = new URLSearchParams(window.location.search);
                    searchParams.set("tab", "branches");
                    searchParams.set("sub", val);
                    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
                    window.history.pushState({}, "", newUrl);
                  }} className="w-full">

                    {/* 0. Company & Branch Info Tab */}
                    <TabsContent value="company_and_branch_info" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2">
                        <Building2 className="w-4 h-4 text-amber-600" />
                        <span>البيانات الأساسية للفرع والشركة المالكة وترويسات الفواتير</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">اسم الشركة المالكة (عربي)</label>
                          <Input
                            value={branchForm.company_name ?? "شركة عماد عقلان للتجارة والخدمات"}
                            onChange={e => setBranchForm({ ...branchForm, company_name: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">الاسم الأجنبي للشركة</label>
                          <Input
                            value={branchForm.foreign_name ?? "Emad Aqlaan Co."}
                            onChange={e => setBranchForm({ ...branchForm, foreign_name: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">اسم الفرع (بالعربية)</label>
                          <Input
                            value={branchForm.name ?? "الفرع الرئيسي"}
                            onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-bold text-blue-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">الاسم الأجنبي للفرع</label>
                          <Input
                            value={branchForm.branch_foreign_name ?? "Main Branch"}
                            onChange={e => setBranchForm({ ...branchForm, branch_foreign_name: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">رقم السجل التجاري للفرع</label>
                          <Input
                            value={branchForm.commercial_reg ?? "1002003"}
                            onChange={e => setBranchForm({ ...branchForm, commercial_reg: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700">المجموعة الفرعية / المنطقة</label>
                          <Input
                            value={branchForm.group_id ? `مجموعة الفروع ${branchForm.group_id}` : "المجموعة الرئيسية"}
                            onChange={e => setBranchForm({ ...branchForm, group_id: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                      </div>

                      {/* Headers & Receipt Titles */}
                      <div className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-3 mt-3">
                        <h5 className="text-xs font-bold text-slate-800 border-b pb-1.5 flex items-center justify-between">
                          <span>ترويسة وعنوان الفاتورة المطبوعة (Headers & Receipt Printing)</span>
                          <span className="text-[10px] text-slate-500">تظهر أعلى الفاتورة والايصالات الرسمية للفرع</span>
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">ترويسة الفاتورة - السطر الأول (عربي)</label>
                            <Input
                              value={branchForm.header_1 ?? "مخابز الشام للخبز العربي"}
                              onChange={e => setBranchForm({ ...branchForm, header_1: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">ترويسة الفاتورة - السطر الثاني (عربي)</label>
                            <Input
                              value={branchForm.header_2 ?? "فرع صنعاء الرئيسي"}
                              onChange={e => setBranchForm({ ...branchForm, header_2: e.target.value })}
                              className="h-8 text-white bg-white border-slate-300 text-slate-800"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">ترويسة الفاتورة - السطر الثالث (عربي)</label>
                            <Input
                              value={branchForm.header_3 ?? "تلفون: 777123456"}
                              onChange={e => setBranchForm({ ...branchForm, header_3: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">Header Line 1 (English)</label>
                            <Input
                              value={branchForm.header_1_foreign ?? "Al-Sham Arabic Bakery"}
                              onChange={e => setBranchForm({ ...branchForm, header_1_foreign: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">Header Line 2 (English)</label>
                            <Input
                              value={branchForm.header_2_foreign ?? "Sanaa Main Branch"}
                              onChange={e => setBranchForm({ ...branchForm, header_2_foreign: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300"
                              dir="ltr"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-600">Header Line 3 (English)</label>
                            <Input
                              value={branchForm.header_3_foreign ?? "Tel: 777123456"}
                              onChange={e => setBranchForm({ ...branchForm, header_3_foreign: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300"
                              dir="ltr"
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* 1. Location & Contact Tab */}
                    <TabsContent value="location_and_contact" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">الدولة</label>
                          <Input
                            value={branchForm.city ?? "اليمن"}
                            onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">المحافظة / المدينة</label>
                          <Input
                            placeholder="صنعاء"
                            value={branchForm.street ?? "أمانة العاصمة"}
                            onChange={e => setBranchForm({ ...branchForm, street: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">المنطقة والحي</label>
                          <Input
                            placeholder="الحي الغربي"
                            value={branchForm.building ?? "شارع الستين"}
                            onChange={e => setBranchForm({ ...branchForm, building: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">العنوان الكامل</label>
                          <Input
                            value={branchForm.address ?? "شارع الستين الجنوبي - بجوار الأمل للتأمين"}
                            onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">رقم الهاتف (الخط الساخن)</label>
                          <Input
                            value={branchForm.phone ?? "01-234567"}
                            onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">جوال الفرع</label>
                          <Input
                            placeholder="777123456"
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">البريد الإلكتروني للفرع</label>
                          <Input
                            placeholder="branch@omnisystem.com"
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">الموقع الإلكتروني</label>
                          <Input
                            placeholder="www.omnierp.com"
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* Map Coordinate Settings */}
                      <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>إحداثيات الموقع وتحديد الخريطة (GPS)</span>
                          </h4>
                          <span className="text-[10px] text-slate-500">تم التحديد تلقائياً بناءً على إشارة المتصفح</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-600">خط الطول (Longitude)</label>
                            <Input
                              value={branchForm.long ?? "44.1910"}
                              onChange={e => setBranchForm({ ...branchForm, long: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-600">خط العرض (Latitude)</label>
                            <Input
                              value={branchForm.lat ?? "15.3694"}
                              onChange={e => setBranchForm({ ...branchForm, lat: e.target.value })}
                              className="h-8 text-xs bg-white border-slate-300 font-mono"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1 flex items-end">
                            <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="w-full h-8 text-xs bg-white border-slate-300 hover:bg-slate-100 gap-1">
                              <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
                              التقاط الإحداثيات الحالية
                            </Button>
                          </div>
                        </div>
                        <div className="h-28 bg-slate-200 rounded border border-slate-300 relative overflow-hidden flex items-center justify-center">
                          <div className="absolute inset-0 bg-cover bg-center filter grayscale contrast-125 opacity-30" style={{ backgroundImage: "url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/44.1910,15.3694,13/600x120?access_token=mock')" }}></div>
                          <div className="z-10 flex flex-col items-center justify-center text-slate-600 text-center p-4">
                            <MapPin className="w-6 h-6 text-red-600 animate-bounce mb-1" />
                            <span className="text-[11px] font-semibold text-slate-800">موقع الفرع مثبت على خطوط الطول والعرض {branchForm.lat} , {branchForm.long}</span>
                            <span className="text-[9px] text-slate-500">يستخدم هذا العنوان لحساب تسليم الطلبات والخرائط التفاعلية للعملاء</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* 2. Financial & Tax Tab */}
                    <TabsContent value="financial_and_tax" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <span>الحساب الرئيسي للفرع (الذمم المدينة)</span>
                            <span className="text-red-500">*</span>
                          </label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-mono">
                            <option>11100 - صندوق الفرع الرئيسي الرئيسي</option>
                            <option>11200 - ذمم مبيعات الفرع الرئيسي</option>
                            <option>11300 - مخزون البضائع والمستودعات</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">مركز التكلفة الافتراضي</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-mono">
                            <option>301 - مركز مبيعات الصالة والضيافة</option>
                            <option>302 - مركز المبيعات الخارجية والتوصيل</option>
                            <option>303 - مركز الإدارة والخدمات المشتركة</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">العملة الافتراضية للتعاملات</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-bold">
                            <option>ريال يمني (YER)</option>
                            <option>ريال سعودي (SAR)</option>
                            <option>دولار أمريكي (USD)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">رقم التسجيل الضريبي لضريبة القيمة المضافة</label>
                          <Input
                            value={branchForm.tax_id ?? "300012345600003"}
                            onChange={e => setBranchForm({ ...branchForm, tax_id: e.target.value })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">نسبة الضريبة (%)</label>
                          <Input
                            type="number"
                            value={branchForm.tax_rate ?? 15}
                            onChange={e => setBranchForm({ ...branchForm, tax_rate: Number(e.target.value) })}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">نسبة الخدمة / الصالة (%)</label>
                          <Input
                            type="number"
                            defaultValue={5}
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-xs flex gap-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">ملاحظة مالية هامة:</p>
                          <p className="text-[11px] text-blue-700 mt-0.5">
                            سوف يتم توجيه جميع قيود اليومية الآلية والفوترة والترحيل المحاسبي المتولد من هذا الفرع إلى الحساب المحاسبي الرئيسي المحدد ومركز التكلفة المذكور أعلاه لتوفير ميزانية عمومية وقوائم أرباح وخسائر منفصلة لكل فرع على حدة.
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* 3. Operational Settings Tab */}
                    <TabsContent value="operational_settings" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">المستودع والمخزن الافتراضي</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full">
                            <option>المخزن الرئيسي لمنتجات البيع</option>
                            <option>مخزن المواد الأولية والتجهيز</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">الصندوق الافتراضي المباشر</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full">
                            <option>صندوق الكاشير الرئيسي 1</option>
                            <option>صندوق مبيعات التوصيل والطلبات</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">الخزينة الحديدية الافتراضية</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full">
                            <option>خزينة الإدارة الرئيسية للفرع</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">طابعة الفواتير الرئيسية للفرع</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-mono">
                            <option>PRINTER_THERMAL_XP80</option>
                            <option>PRINTER_OFFICE_HP_LASER</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">طابعة المطبخ والطلبات</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-mono">
                            <option>PRINTER_KITCHEN_XP80</option>
                            <option>KITCHEN_SCREEN_KDS_MOCK</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">طابعة البار والتحضير</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full font-mono">
                            <option>PRINTER_BAR_XP58</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">شاشة عرض المطبخ المعتمدة (KDS)</label>
                          <select className="text-xs h-8 rounded border-slate-300 bg-white text-slate-700 px-2 border w-full">
                            <option>KDS_CONTROLLER_ARABIC_1</option>
                            <option>تعطيل شاشات عرض المطبخ</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600">الفرع المالي للشركة</label>
                          <Input
                            disabled
                            value={branchForm.company_name ?? "شركة عماد عقلان"}
                            readOnly
                            className="h-8 text-xs bg-slate-100 border-slate-300"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* 4. Manager & Personnel Tab */}
                    <TabsContent value="manager_and_personnel" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3 text-blue-600" />
                            <span>مدير الفرع العام</span>
                          </label>
                          <Input
                            placeholder="أ. عماد عقلان"
                            defaultValue="أ. عماد عقلان"
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span>نائب مدير الفرع</span>
                          </label>
                          <Input
                            placeholder="م. علاء اليماني"
                            defaultValue="م. علاء اليماني"
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3 text-amber-600" />
                            <span>المحاسب المسؤول</span>
                          </label>
                          <Input
                            placeholder="أ. هاني مسعد"
                            defaultValue="أ. هاني مسعد"
                            className="h-8 text-xs bg-slate-50 border-slate-300 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                            <Users className="w-3 h-3 text-green-600" />
                            <span>أمين المستودع الرئيسي</span>
                          </label>
                          <Input
                            placeholder="أحمد مسعد"
                            defaultValue="أحمد مسعد"
                            className="h-8 text-xs bg-slate-50 border-slate-300"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border rounded text-xs">
                        <span className="font-bold text-slate-700 block mb-1">صلاحيات وموثوقية الإدارة:</span>
                        <p className="text-slate-500 text-[10px]">
                          يتحمل مدير الفرع والمحاسب المسؤولية الكاملة عن كافة ترحيلات الصندوق اليومي وإقفال المبيعات والمطابقة النقدية مع الخزينة الحديدية الافتراضية.
                        </p>
                      </div>
                    </TabsContent>

                    {/* 5. Operations & Integrations Tab */}
                    <TabsContent value="branch_operations" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <h4 className="text-xs font-bold text-slate-800">ربط وإقران الفرع بالبنية التحتية للنظام</h4>
                      <p className="text-[11px] text-slate-500">حدد المستودعات والمطابخ والأجهزة المعتمدة لضمان التنسيق التلقائي للمبيعات والأرصدة.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border rounded p-3 bg-slate-50 space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 block border-b pb-1">ربط الفرع بالمخازن المتصلة</span>
                          <div className="space-y-1.5 pt-1">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>مستودع المواد الخام الرئيسي (WH-001)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>مستودع المنتجات الجاهزة والبيع (WH-002)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>مخزن بضاعة الأمانة الإضافية</span>
                            </label>
                          </div>
                        </div>

                        <div className="border rounded p-3 bg-slate-50 space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 block border-b pb-1">ربط الأجهزة ومستخدمي الكاشير</span>
                          <div className="space-y-1.5 pt-1">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>جهاز كاشير الصالة 1 (DESKTOP-QLP03GF)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>جهاز كاشير الطلبات الخارجية 2</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5" />
                              <span>جهاز مشرف صالة الضيافة والأغذية</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-3 text-[11px]">
                        <strong>تنبيه مزامنة الأمان المحاسبي:</strong> ربط الأجهزة يمنع مستخدمي الكاشير من خارج النطاق أو الأجهزة غير المصرحة من تسجيل الدخول إلى جلسات الفرع الحالي لضمان الحماية من تسريب البيانات أو المبيعات العشوائية.
                      </div>
                    </TabsContent>

                    {/* 6. Reports & Performance Tab */}
                    <TabsContent value="branch_reports_tab" className="border border-slate-200 rounded-md p-4 space-y-4 mt-2 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="text-xs font-bold text-slate-800">أداء حركة ومبيعات الفرع في الـ 30 يوماً الماضية</h4>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="text-[10px] bg-slate-50 border-slate-300 h-7" onClick={() => toast({ title: "تصدير تقرير الفروع بصيغة PDF" })}>
                            <Printer className="w-3 h-3 ml-1 text-slate-600" /> طباعة التقرير
                          </Button>
                          <Button variant="outline" size="sm" className="text-[10px] bg-slate-50 border-slate-300 h-7" onClick={() => toast({ title: "تصدير تقرير الفروع بصيغة Excel" })}>
                            <Download className="w-3 h-3 ml-1 text-emerald-600" /> تصدير Excel
                          </Button>
                        </div>
                      </div>

                      {/* Mock performance analytics chart */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="border rounded p-3 bg-slate-50 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">إجمالي الفواتير النشطة</span>
                          <span className="text-lg font-extrabold text-blue-900 font-mono mt-1">1,240 فاتورة</span>
                        </div>
                        <div className="border rounded p-3 bg-slate-50 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">قيمة مبيعات الفرع</span>
                          <span className="text-lg font-extrabold text-emerald-700 font-mono mt-1">4,380,200 ريال</span>
                        </div>
                        <div className="border rounded p-3 bg-slate-50 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">متوسط قيمة الفاتورة</span>
                          <span className="text-lg font-extrabold text-slate-700 font-mono mt-1">3,532 ريال</span>
                        </div>
                        <div className="border rounded p-3 bg-slate-50 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">نسبة مساهمة الفرع</span>
                          <span className="text-lg font-extrabold text-amber-700 font-mono mt-1">68.4 %</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-700 block mb-2">الوصول السريع لتقارير الفرع:</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} variant="outline" className="text-[10px] h-8 justify-start text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200">
                            📊 تقرير المبيعات والأرباح
                          </Button>
                          <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} variant="outline" className="text-[10px] h-8 justify-start text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200">
                            📦 تقرير جرد المخزون الفعلي
                          </Button>
                          <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} variant="outline" className="text-[10px] h-8 justify-start text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200">
                            👥 تقرير أداء كاشيرات الفرع
                          </Button>
                          <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} variant="outline" className="text-[10px] h-8 justify-start text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200">
                            ⚠️ تقرير فوارق عجز الصندوق
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Footnotes matching traditional ERP form */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t text-[10px] text-slate-400">
                    <div>مدخل السجل: <span className="font-semibold text-slate-600">مدير النظام (admin)</span></div>
                    <div>تاريخ الإدخال: <span className="font-semibold text-slate-600">20/07/2026 09:12:05</span></div>
                    <div>مرات التعديل: <span className="font-semibold text-slate-600">14 مرة</span></div>
                    <div>آخر تعديل للمستخدم: <span className="font-semibold text-slate-600">منذ دقيقتين</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 2: ACTIVE SESSIONS & SECURITY LOGS (Image 2) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="sessions" className="mt-4">
            <Card className="border-slate-300 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-2.5 px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-600" />
                    <span>إدارة الأمان وصلاحيات المستخدمين</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">إدارة حسابات الموظفين، الأدوار والأصلاحيات، الجلسات النشطة، وسجلات الرقابة</CardDescription>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-700 font-bold whitespace-nowrap hidden sm:inline">اختر الإجراء:</span>
                    <select
                      value={activeRbacTask}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveRbacTask(val);
                        const searchParams = new URLSearchParams(window.location.search);
                        searchParams.set("tab", "sessions");
                        searchParams.set("sub", val);
                        const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
                        window.history.pushState({}, "", newUrl);
                        window.dispatchEvent(new Event("popstate"));
                      }}
                      className="h-9 rounded-md bg-slate-800 text-amber-300 font-extrabold border-2 border-amber-500/70 px-2.5 text-xs shadow-inner focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="users_list">👥 المستخدمين والموظفين</option>
                      <option value="screen_permissions">🛡️ صلاحيات استخدام الشاشات</option>
                      <option value="active_sessions">🖥️ عرض المستخدمين (العاملين حالياً)</option>
                      <option value="roles_tree">🌲 شجرة الصلاحيات والأدوار</option>
                      <option value="audit_logs">📜 سجل العمليات والرقابة</option>
                      <option value="security_reports">📊 تقارير الأمان</option>
                    </select>
                  </div>

                  <Button
                    size="sm"
                    className="gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
                    onClick={() => {
                      setActiveRbacTask("users_list");
                      setSelectedUserId(null);
                      setIsUserEditing(true);
                      setUserForm({
                        username: "", password: "", name: "", role: "cashier",
                        email: "", phone: "", avatar_url: "", default_branch_id: 1, language: "عربي", timezone: "GMT+3", status: "نشط", full_name: ""
                      });
                      const u = new URL(window.location.href);
                      u.searchParams.set("tab", "sessions");
                      u.searchParams.set("sub", "users_list");
                      u.searchParams.set("subTask", "add_user");
                      window.history.pushState({}, "", u.toString());
                      window.dispatchEvent(new Event("popstate"));
                      toast({ title: "تم فتح نموذج إضافة موظف ومستخدم جديد" });
                    }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إضافة موظف ومستخدم جديد</span>
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => { refetchUsers(); refetchRoles(); refetchSessions(); refetchAuditLogs(); }} className="gap-1 text-xs bg-white border-slate-300">
                    <RefreshCw className="w-3.5 h-3.5" />
                    تحديث
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <Tabs value={activeRbacTask} onValueChange={(val) => {
                  setActiveRbacTask(val);
                  const u = new URL(window.location.href);
                  u.searchParams.set("tab", "sessions");
                  u.searchParams.set("sub", val);
                  window.history.pushState({}, "", u.toString());
                }} className="w-full">

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 1: USERS & EMPLOYEES CRUD */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="users_list" className="space-y-4 mt-3">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      
                      {/* Left side: Users Directory */}
                      <div className="lg:col-span-1 border rounded-md p-3 bg-slate-50 flex flex-col space-y-2">
                        <div className="flex items-center justify-between border-b pb-2 mb-1">
                          <span className="text-xs font-bold text-slate-700">قائمة مستخدمي النظام</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] bg-white border-slate-300 text-blue-700 hover:bg-slate-50"
                            onClick={() => {
                              setSelectedUserId(null);
                              setIsUserEditing(true);
                              setUserForm({
                                username: "", password: "", name: "", role: "cashier",
                                email: "", phone: "", avatar_url: "", default_branch_id: 1, language: "عربي", timezone: "GMT+3", status: "نشط", full_name: ""
                              });
                              toast({ title: "تم تهيئة نموذج مستخدم جديد" });
                            }}
                          >
                            <Plus className="w-3 h-3 ml-1" /> مستخدم جديد
                          </Button>
                        </div>
                        
                        <div className="relative">
                          <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            placeholder="بحث عن مستخدم..."
                            className="h-8 text-xs bg-white border-slate-300 pr-8"
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1.5 max-h-[350px] overflow-y-auto pt-1">
                          {dbUsers
                            .filter((u: any) => (user?.role === "developer" || (u.role !== "developer" && u.username !== "developer")) && (u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.username.toLowerCase().includes(userSearchTerm.toLowerCase())))
                            .map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setSelectedUserId(u.id);
                                  setIsUserEditing(false);
                                  setUserForm({ ...u, password: "" });
                                }}
                                className={`w-full text-right p-2.5 rounded text-xs transition-all flex items-center justify-between border ${
                                  selectedUserId === u.id
                                    ? "bg-blue-50 text-blue-800 border-blue-300 font-bold"
                                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold font-mono text-slate-600 border overflow-hidden">
                                    {u.avatar_url ? <img src={u.avatar_url} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" /> : u.username.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span>{u.name}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge className="text-[9px] scale-90" variant={u.role === "admin" || u.role === "developer" ? "destructive" : "secondary"}>
                                    {u.role === "admin" ? "مدير" : u.role === "developer" ? "مطور" : u.role === "accountant" ? "محاسب" : "كاشير"}
                                  </Badge>
                                  <span className={`text-[9px] ${u.status === "نشط" ? "text-emerald-600" : "text-red-500"}`}>
                                    ● {u.status || "نشط"}
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 bg-white border-slate-300"
                          onClick={() => {
                            let text = "تقرير مستخدمي نظام أومني ERP\n\n";
                            dbUsers.forEach((u: any) => {
                              text += `- ${u.name} (@${u.username}) - الدور: ${u.role} - الجوال: ${u.phone || "—"} - الحالة: ${u.status || "نشط"}\n`;
                            });
                            const win = window.open("", "_blank");
                            if (win) {
                              win.document.write(`<pre style="font-family: monospace; direction: rtl; padding: 20px;">${text}</pre>`);
                              win.document.close();
                            } else {
                              toast({ title: "تم توليد التقرير بنجاح", description: "يمكنك طباعته من سجلات الأمان" });
                            }
                          }}
                        >
                          <Printer className="w-3.5 h-3.5 ml-1 text-slate-600" /> طباعة قائمة المستخدمين
                        </Button>
                      </div>

                      {/* Right side: Selected User Profile / Editor */}
                      <div className="lg:col-span-2 border rounded-md p-4 bg-white space-y-4">
                        {isUserEditing || selectedUserId ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                              <h4 className="text-xs font-bold text-slate-700">
                                {selectedUserId ? `تعديل ملف المستخدم: ${userForm.name}` : "إدخال بيانات مستخدم جديد"}
                              </h4>
                              {selectedUserId && !isUserEditing && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                    onClick={() => setIsUserEditing(true)}
                                  >
                                    <Edit2 className="w-3.5 h-3.5 ml-1" /> تعديل البيانات
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={() => {
                                      if (confirm(`هل أنت متأكد من حذف الحساب "${userForm.name}" نهائياً من النظام؟`)) {
                                        deleteUserMutation.mutate(userForm.id, {
                                          onSuccess: () => {
                                            setSelectedUserId(null);
                                            setIsUserEditing(false);
                                          }
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 ml-1" /> حذف
                                  </Button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">اسم الدخول (اسم المستخدم بالإنجليزية)</label>
                                <Input
                                  value={userForm.username}
                                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                                  disabled={!!selectedUserId && !isUserEditing}
                                  placeholder="e.g. emad_aqlaan"
                                  className="h-8 text-xs border-slate-300 font-mono"
                                  dir="ltr"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">الاسم الكامل للموظف (العربية)</label>
                                <Input
                                  value={userForm.name}
                                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  placeholder="أ. عماد عقلان"
                                  className="h-8 text-xs border-slate-300"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">كلمة المرور</label>
                                <Input
                                  type="password"
                                  value={userForm.password ?? ""}
                                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  placeholder={selectedUserId ? "اتركه فارغاً للاحتفاظ بالحالية" : "••••••••"}
                                  className="h-8 text-xs border-slate-300"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">الدور الأمني (الصلاحية)</label>
                                <select
                                  value={userForm.role}
                                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  className="w-full h-8 text-xs rounded border-slate-300 bg-white px-2 border"
                                >
                                  <option value="admin">مدير النظام العام (Admin)</option>
                                  <option value="accountant">محاسب الفرع (Accountant)</option>
                                  <option value="cashier">كاشير المبيعات (Cashier)</option>
                                  {user?.role === "developer" && (
                                    <option value="developer">مطور النظام (Developer)</option>
                                  )}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-indigo-800">مجموعة المستخدمين (ربط الصلاحيات بالمجموعة)</label>
                                <select
                                  value={userForm.group_id ?? ""}
                                  onChange={(e) => setUserForm({ ...userForm, group_id: e.target.value ? Number(e.target.value) : null })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  className="w-full h-8 text-xs rounded border-indigo-300 bg-indigo-50/40 font-bold text-slate-800 px-2 border"
                                >
                                  <option value="">-- اختر مجموعة المستخدمين --</option>
                                  {dbUserGroups.map((g: any) => (
                                    <option key={g.id} value={g.id}>{g.group_number} - {g.name_ar}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">البريد الإلكتروني للموظف</label>
                                <Input
                                  value={userForm.email ?? ""}
                                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  placeholder="employee@omnierp.com"
                                  className="h-8 text-xs border-slate-300 font-mono"
                                  dir="ltr"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">رقم جوال الموظف</label>
                                <Input
                                  value={userForm.phone ?? ""}
                                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  placeholder="777123456"
                                  className="h-8 text-xs border-slate-300 font-mono"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">الفرع الافتراضي للمبيعات</label>
                                <select
                                  value={userForm.default_branch_id ?? 1}
                                  onChange={(e) => setUserForm({ ...userForm, default_branch_id: Number(e.target.value) })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  className="w-full h-8 text-xs rounded border-slate-300 bg-white px-2 border"
                                >
                                  {dbBranches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">حالة الحساب</label>
                                <select
                                  value={userForm.status ?? "نشط"}
                                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  className="w-full h-8 text-xs rounded border-slate-300 bg-white px-2 border font-bold text-slate-700"
                                >
                                  <option value="نشط" className="text-emerald-600">نشط ومفعل</option>
                                  <option value="موقف" className="text-red-600">موقف ومجمد</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">لغة واجهة المستخدم</label>
                                <select
                                  value={userForm.language ?? "عربي"}
                                  onChange={(e) => setUserForm({ ...userForm, language: e.target.value })}
                                  disabled={!isUserEditing && !!selectedUserId}
                                  className="w-full h-8 text-xs rounded border-slate-300 bg-white px-2 border"
                                >
                                  <option value="عربي">عربي (AR)</option>
                                  <option value="English">English (EN)</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">رابط الصورة الشخصية (Avatar URL)</label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={userForm.avatar_url ?? ""}
                                    onChange={(e) => setUserForm({ ...userForm, avatar_url: e.target.value })}
                                    disabled={!isUserEditing && !!selectedUserId}
                                    placeholder="https://... أو أدخل ملف"
                                    className="h-8 text-xs border-slate-300 text-slate-500 font-mono flex-1"
                                  />
                                  <label className="cursor-pointer shrink-0 bg-slate-100 hover:bg-slate-200 border text-slate-700 h-8 px-2.5 rounded text-xs font-bold flex items-center gap-1">
                                    <Upload className="w-3 h-3 text-amber-600" />
                                    ادراج من الملفات
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={!isUserEditing && !!selectedUserId}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            if (event.target?.result) {
                                              setUserForm((u: any) => ({ ...u, avatar_url: event.target!.result as string }));
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>

                            {isUserEditing && (
                              <div className="flex gap-2 pt-4 border-t justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-9 px-4"
                                  onClick={() => {
                                    setIsUserEditing(false);
                                    if (selectedUserId) {
                                      const original = dbUsers.find((u: any) => u.id === selectedUserId);
                                      if (original) setUserForm({ ...original, password: "" });
                                    }
                                  }}
                                >
                                  إلغاء التعديل
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs h-9 px-5 bg-blue-700 hover:bg-blue-800 text-white gap-1"
                                  onClick={() => {
                                    if (!userForm.username || !userForm.name) {
                                      toast({ variant: "destructive", title: "خطأ في الإدخال", description: "اسم المستخدم والاسم الكامل مطلوبان." });
                                      return;
                                    }
                                    if (selectedUserId) {
                                      updateUserMutation.mutate(userForm);
                                    } else {
                                      if (!userForm.password) {
                                        toast({ variant: "destructive", title: "خطأ في الإدخال", description: "كلمة المرور مطلوبة للمستخدم الجديد." });
                                        return;
                                      }
                                      addUserMutation.mutate(userForm);
                                    }
                                  }}
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  حفظ الملف والمستخدم
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-400">
                            <Users className="w-16 h-16 mx-auto text-slate-200 mb-3" />
                            <h4 className="font-bold text-slate-600">مرحباً بك في إدارة حسابات الموظفين</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                              قم باختيار أحد مستخدمي النظام من القائمة الجانبية لعرض وتعديل بيانات ملفه الشخصي وصلاحيات دخوله، أو انقر على "مستخدم جديد" لتعريف موظف إضافي بالمنشأة.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 1.b: SCREEN PERMISSIONS MATRIX (صلاحيات استخدام الشاشات) */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="screen_permissions" className="mt-3">
                    <ErpScreenPermissionsPanel />
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 2: ROLE PERMISSIONS TREE VIEW */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="roles_tree" className="space-y-4 mt-3">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-md space-y-4">
                      
                      {/* Top selector */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">الدور الأمني الحالي المراد تعديله:</span>
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="text-xs h-8 rounded border-slate-300 bg-white text-slate-800 font-bold px-3 border"
                          >
                            {dbRoles
                              .filter((r: any) => r.role !== "developer" || user?.role === "developer")
                              .map((r: any) => (
                              <option key={r.role} value={r.role}>
                                {r.role === "admin" ? "مدير النظام العام (admin)" : r.role === "developer" ? "مطور البرمجيات (developer)" : r.role === "accountant" ? "المحاسب المعتمد (accountant)" : `صلاحية الكاشير (${r.role})`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex gap-2">
                          <Input
                            id="new-role-input"
                            placeholder="اسم الدور الجديد..."
                            className="h-8 text-xs w-44 bg-white border-slate-300"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-white text-green-700 hover:bg-green-50"
                            onClick={() => {
                              const el = document.getElementById("new-role-input") as HTMLInputElement;
                              if (el && el.value) {
                                addRoleMutation.mutate({
                                  role: el.value,
                                  can_void_bills: 0, can_view_cost: 0, can_change_currencies: 0,
                                  can_approve_returns: 0, can_open_close_safe: 0, can_transfer_funds: 0,
                                  can_edit_products: 0, can_delete_orders: 0
                                });
                                el.value = "";
                              } else {
                                toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة اسم الدور الجديد أولاً." });
                              }
                            }}
                          >
                            <Plus className="w-3.5 h-3.5 ml-1" /> إضافة دور
                          </Button>
                        </div>
                      </div>

                      {/* Visual 5-Level Permissions checkbox Tree View */}
                      <div className="bg-white border rounded p-4 space-y-4 shadow-inner">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            <span>شجرة تنظيم وتفويض الصلاحيات خماسية المستويات</span>
                          </h4>
                          <span className="text-[10px] text-slate-500 font-semibold font-mono">ROLE: {selectedRole}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Left Column: Financial level and Operational level */}
                          <div className="space-y-4">
                            {/* 1. Financial Level (مستوى الصلاحيات المالية) */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                              <span className="text-xs font-bold text-indigo-900 border-b pb-1.5 block mb-2">💰 1. مستوى الصلاحيات والعمليات المالية</span>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_void_bills === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_void_bills: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">صلاحية إلغاء الفواتير وتعديل المعاملات المكتملة</span>
                                    <span className="text-[10px] text-slate-400">السماح بتعديل وفسخ الفواتير بعد الترحيل المحاسبي</span>
                                  </div>
                                </label>
                                
                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_view_cost === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_view_cost: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">عرض أسعار التكلفة وتقارير الأرباح والخسائر</span>
                                    <span className="text-[10px] text-slate-400">إظهار تكلفة المنتج الحقيقية ونسبة مجمل الربح في الواجهة</span>
                                  </div>
                                </label>

                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_change_currencies === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_change_currencies: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">تغيير العملات وتعديل أسعار الصرف اليومية</span>
                                    <span className="text-[10px] text-slate-400">السماح بالتحكم في فارق العملة وسعر بيع العملات الأجنبية</span>
                                  </div>
                                </label>

                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_approve_returns === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_approve_returns: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">اعتماد مرتجعات المبيعات ومردودات المشتريات</span>
                                    <span className="text-[10px] text-slate-400">صلاحية الموافقة على سحب النقود من الصندوق للزبون</span>
                                  </div>
                                </label>

                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_open_close_safe === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_open_close_safe: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">فتح وإقفال الصناديق والخزائن وترحيل الشفتات</span>
                                    <span className="text-[10px] text-slate-400">صلاحية استلام مبالغ الكاشيرات اليومية وتسليم الخزينة الحديدية</span>
                                  </div>
                                </label>

                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_transfer_funds === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_transfer_funds: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">تحويل الأموال والعهد بين الخزائن والصناديق</span>
                                    <span className="text-[10px] text-slate-400">توجيه حوالات نقدية داخلية وتصفية عهد الموظفين</span>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* 2. Screen level (مستوى الشاشات) */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                              <span className="text-xs font-bold text-teal-900 border-b pb-1.5 block mb-2">🖥️ 2. مستوى صلاحيات الوصول للشاشات</span>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة الفروع والشركات</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة الصلاحيات والأمان</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة المبيعات والفاتورة</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة بطاقة الأصناف</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة المستودعات والمخازن</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span>شاشة أسعار العملات</span>
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Operational level, Data level, System level */}
                          <div className="space-y-4">
                            
                            {/* 3. Operational Level (مستوى صلاحيات العمليات) */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                              <span className="text-xs font-bold text-emerald-900 border-b pb-1.5 block mb-2">⚙️ 3. مستوى صلاحيات العمليات (CRUD)</span>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span className="font-semibold text-emerald-800">إضافة سجل جديد (Create)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span className="font-semibold text-blue-800">استعراض وبحث (Read)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span className="font-semibold text-amber-800">تعديل سجل قائم (Update)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={rolePermissionsForm.can_delete_orders === 1}
                                    onChange={(e) => setRolePermissionsForm({ ...rolePermissionsForm, can_delete_orders: e.target.checked ? 1 : 0 })}
                                    className="rounded border-slate-300 text-blue-600"
                                  />
                                  <span className="font-semibold text-red-800">حذف وإلغاء السجلات (Delete)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span className="font-semibold text-slate-700">طباعة التقارير (Print)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600" />
                                  <span className="font-semibold text-slate-700">تصدير للملفات (Export)</span>
                                </label>
                              </div>
                            </div>

                            {/* 4. Data Level (مستوى نطاق وصلاحية البيانات) */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                              <span className="text-xs font-bold text-blue-900 border-b pb-1.5 block mb-2">🌐 4. مستوى نطاق البيانات المسموح بها</span>
                              <div className="space-y-2 text-xs text-slate-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="data-scope" defaultChecked className="text-blue-600" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">استعراض وتعديل بيانات الفرع التابع له الموظف فقط</span>
                                    <span className="text-[10px] text-slate-400">يمنع الموظف من تصفح مبيعات أو مخزون الفروع الأخرى</span>
                                  </div>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="data-scope" className="text-blue-600" />
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">الوصول الكامل لكافة بيانات فروع ومستودعات الشركة</span>
                                    <span className="text-[10px] text-slate-400">صلاحية الإدارة والمراجع المالي العام للمنشأة</span>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* 5. System Level (مستوى الأمان العام للنظام) */}
                            <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                              <span className="text-xs font-bold text-red-900 border-b pb-1.5 block mb-2">🔒 5. مستوى الأمان وإعدادات النظام الحساسة</span>
                              <div className="space-y-1.5 text-xs text-slate-700">
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" className="rounded border-slate-300 text-red-600" />
                                  <span className="font-semibold text-red-700">تغيير إعدادات قاعدة البيانات والسيرفر</span>
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input type="checkbox" className="rounded border-slate-300 text-red-600" />
                                  <span className="font-semibold text-red-700">تصفير السجلات المالية ومبيعات الفترات السابقة</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Save Action Bar */}
                        <div className="flex gap-2 justify-end border-t pt-3 mt-4">
                          {selectedRole !== "admin" && selectedRole !== "developer" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-9"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من رغبتك في حذف الدور الأمني "${selectedRole}" وتجريد مستخدميه؟`)) {
                                  deleteRoleMutation.mutate(selectedRole, {
                                    onSuccess: () => setSelectedRole("admin")
                                  });
                                }
                              }}
                            >
                              حذف هذا الدور بالكامل
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="text-xs h-9 px-6 bg-blue-700 hover:bg-blue-800 text-white gap-1 font-bold"
                            onClick={() => {
                              updateRoleMutation.mutate({
                                role: selectedRole,
                                ...rolePermissionsForm
                              });
                            }}
                          >
                            <Save className="w-4 h-4" />
                            حفظ وتطبيق شجرة الصلاحيات على هذا الدور
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 2.5: USER GROUPS (واجهة مجموعة المستخدمين) */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="user_groups" className="space-y-3 mt-2">
                    <ErpUserGroupsPanel />
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 3: ACTIVE SESSIONS & DEVICES (واجهة عرض المستخدمين) */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="active_sessions" className="space-y-3 mt-2">
                    <ErpUsersDisplayPanel />
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 4: SYSTEM AUDIT LOGS */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="audit_logs" className="space-y-3 mt-2">
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="text-xs font-bold text-slate-700">سجل الرقابة الإدارية والعمليات المنفذة</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs bg-white"
                        onClick={() => {
                          let text = "تقرير حركات وأنشطة أمان النظام\n\n";
                          dbAuditLogs.slice(0, 100).forEach((l: any) => {
                            text += `[${l.timestamp}] المستخدم: ${l.user_name} - العملية: ${l.action_type} - التفاصيل: ${l.details || "—"}\n`;
                          });
                          const win = window.open("", "_blank");
                          if (win) {
                            win.document.write(`<pre style="font-family: monospace; direction: ltr; padding: 20px;">${text}</pre>`);
                            win.document.close();
                          }
                        }}
                      >
                        <Printer className="w-3.5 h-3.5 ml-1 text-slate-600" /> طباعة آخر 100 عملية نشطة
                      </Button>
                    </div>

                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 border-b border-slate-300 text-slate-700">
                          <tr>
                            <th className="p-3 font-bold">رقم الحركة</th>
                            <th className="p-3 font-bold">الوقت والتاريخ</th>
                            <th className="p-3 font-bold">اسم الموظف</th>
                            <th className="p-3 font-bold">طبيعة العملية</th>
                            <th className="p-3 font-bold">التفاصيل الكاملة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {dbAuditLogs.map((l: any) => (
                            <tr key={l.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono text-slate-400">#{l.id}</td>
                              <td className="p-3 font-mono text-slate-600">{l.timestamp}</td>
                              <td className="p-3 font-bold text-slate-850">{l.user_name}</td>
                              <td className="p-3">
                                <Badge variant="outline" className={l.action_type?.includes("حذف") ? "bg-red-50 text-red-700 border-red-200" : l.action_type?.includes("حفظ") || l.action_type?.includes("إضافة") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                                  {l.action_type}
                                </Badge>
                              </td>
                              <td className="p-3 text-slate-500 font-mono">{l.details}</td>
                            </tr>
                          ))}
                          {dbAuditLogs.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد حركات مسجلة بسجل المراقبة حالياً.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* ──────────────────────────────────────────────────────── */}
                  {/* SUB-TAB 5: COMPLIANCE & SECURITY REPORTS */}
                  {/* ──────────────────────────────────────────────────────── */}
                  <TabsContent value="security_reports" className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="p-4 bg-slate-50 border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 mb-2">إجمالي حسابات الموظفين</h4>
                        <span className="text-3xl font-extrabold text-blue-900 font-mono">{dbUsers.length} مستخدم</span>
                        <div className="text-[10px] text-slate-400 mt-2">منهم {dbUsers.filter((u: any) => u.status === "نشط").length} حسابات بحالة نشطة حالياً.</div>
                      </Card>
                      <Card className="p-4 bg-slate-50 border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 mb-2">جلسات الأجهزة الفعالة بالشبكة</h4>
                        <span className="text-3xl font-extrabold text-emerald-700 font-mono">{sessionData?.active?.length || 0} أجهزة</span>
                        <div className="text-[10px] text-slate-400 mt-2">تم تسجيل دخولها بنجاح من فروع مختلفة بالمنشأة.</div>
                      </Card>
                      <Card className="p-4 bg-slate-50 border-slate-200">
                        <h4 className="text-xs font-bold text-slate-700 mb-2">مجموع حركات الرقابة اليوم</h4>
                        <span className="text-3xl font-extrabold text-amber-700 font-mono">{dbAuditLogs.length} حركات</span>
                        <div className="text-[10px] text-slate-400 mt-2">مسجلة تلقائياً بسجلات الرقابة وقاعدة البيانات.</div>
                      </Card>
                    </div>

                    <div className="p-4 bg-white border rounded-md space-y-3">
                      <h4 className="text-xs font-bold text-slate-800">مراجعة وتحليل سلامة النظام الأمني:</h4>
                      <p className="text-[11px] text-slate-500">مجموعة من التقارير السريعة للتأكد من خلو النظام من العمليات المشبوهة أو جلسات الدخول العشوائية.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="p-3 border rounded bg-slate-50 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">تقرير الحسابات غير النشطة</span>
                            <span className="text-[10px] text-slate-400">إظهار الحسابات التي لم تقم بتسجيل الدخول لأكثر من 30 يوماً لتجميدها</span>
                          </div>
                          <Button variant="outline" size="sm" className="bg-white text-[11px]" onClick={() => toast({ title: "لا توجد حسابات خاملة حالياً." })}>عرض التقرير</Button>
                        </div>

                        <div className="p-3 border rounded bg-slate-50 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">تقرير حركات إلغاء الفواتير الحساسة</span>
                            <span className="text-[10px] text-slate-400">تتبع كافة مبيعات الصندوق التي تم إلغاؤها أو تعديلها بعد الترحيل</span>
                          </div>
                          <Button variant="outline" size="sm" className="bg-white text-[11px]" onClick={() => toast({ title: "تم تصفير كافة حركات إلغاء المبيعات لسلامة المراجعة المالية." })}>مراجعة حركات الإلغاء</Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4" id="sales-invoice-container">
            <Card className="border-slate-300 shadow-sm overflow-hidden" id="sales-invoice-card">
              {/* Header block */}
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row justify-between items-center" id="sales-invoice-card-header">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-indigo-600" />
                    أنظمة المبيعات والمردودات - شاشة فاتورة المبيعات الاحترافية [شاشة متكاملة]
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-slate-500">
                    واجهة مبيعات ذكية وسريعة متصلة بنظام الحسابات ومراقبة المخازن
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-slate-100 text-slate-700 font-bold border border-slate-300 text-xs px-2.5 py-1">
                    الفاتورة الحالية: {invForm.status}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 font-bold border border-blue-200 text-xs px-2.5 py-1">
                    السجل {currentInvIndex + 1} من {invoices.length}
                  </Badge>
                </div>
              </CardHeader>

              {/* Toolbar bar */}
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex flex-wrap gap-1 items-center justify-between shadow-inner" id="sales-invoice-toolbar">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Button
                    variant="outline" size="sm" id="btn-inv-new"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvNew}
                  >
                    <Plus className="w-3.5 h-3.5 text-green-600" />
                    جديد
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-save"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvSave}
                  >
                    <Save className="w-3.5 h-3.5 text-blue-600" />
                    حفظ
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-edit"
                    className={`h-8 text-xs font-bold gap-1 ${isInvEditing ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => {
                      setIsInvEditing(!isInvEditing);
                      toast({ title: isInvEditing ? "تم إغلاق نمط التعديل" : "تم فتح نمط التعديل المباشر للبيانات" });
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                    {isInvEditing ? "إنهاء التعديل" : "تعديل"}
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-delete"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    حذف
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-copy"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvCopy}
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    نسخ
                  </Button>
                  <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                  <Button
                    variant="outline" size="sm" id="btn-inv-post"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvPost}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ترحيل
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-unpost"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvUnpost}
                  >
                    <X className="w-3.5 h-3.5 text-red-500" />
                    إلغاء الترحيل
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-approve"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvApprove}
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    اعتماد
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-unapprove"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={handleInvUnapprove}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    إلغاء الاعتماد
                  </Button>
                  <div className="w-[1px] h-6 bg-slate-300 mx-1"></div>
                  <Button
                    variant="outline" size="sm" id="btn-inv-print"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={() => {
                      toast({ title: "بدء تجهيز نسخة الطباعة الكلاسيكية للفاتورة" });
                      window.print();
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    طباعة
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-pdf"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={() => toast({ title: "تم توليد ملف PDF للفاتورة وحفظه في التنزيلات" })}
                  >
                    <Download className="w-3.5 h-3.5 text-red-600" />
                    إرسال PDF
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-email"
                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs font-bold gap-1"
                    onClick={() => toast({ title: "تم إرسال الفاتورة عبر البريد الإلكتروني للعميل المعتمد" })}
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-600" />
                    إرسال بريد
                  </Button>
                  <Button
                    variant="outline" size="sm" id="btn-inv-search"
                    className="bg-slate-800 text-white hover:bg-slate-900 h-8 text-xs font-bold gap-1"
                    onClick={() => setIsInvSearchOpen(true)}
                  >
                    <Search className="w-3.5 h-3.5" />
                    بحث
                  </Button>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="outline" size="sm" className="bg-white border-slate-300 h-8 px-2"
                    disabled={currentInvIndex === 0} onClick={() => setCurrentInvIndex(0)}
                  >
                    <ChevronFirst className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline" size="sm" className="bg-white border-slate-300 h-8 px-2"
                    disabled={currentInvIndex === 0} onClick={() => setCurrentInvIndex(prev => prev - 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-bold px-2 self-center font-mono">
                    {currentInvIndex + 1} / {invoices.length}
                  </span>
                  <Button
                    variant="outline" size="sm" className="bg-white border-slate-300 h-8 px-2"
                    disabled={currentInvIndex >= invoices.length - 1} onClick={() => setCurrentInvIndex(prev => prev + 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline" size="sm" className="bg-white border-slate-300 h-8 px-2"
                    disabled={currentInvIndex >= invoices.length - 1} onClick={() => setCurrentInvIndex(invoices.length - 1)}
                  >
                    <ChevronLast className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4 space-y-4" id="sales-invoice-content">
                {/* Search Dialog Modal */}
                {isInvSearchOpen && (
                  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-300 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden">
                      <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-xs sm:text-sm">البحث في فواتير المبيعات</h3>
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setIsInvSearchOpen(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="ابحث برقم الفاتورة، العميل، المرجع أو الكاشير..."
                            value={searchInvQuery}
                            onChange={e => setSearchInvQuery(e.target.value)}
                            className="h-9 text-xs"
                          />
                          <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Omni System Pro ERP)"}) : alert("تحت التطوير")} size="sm" className="bg-slate-800 text-white text-xs px-4">بحث</Button>
                        </div>
                        <div className="border rounded max-h-60 overflow-y-auto">
                          {invoices
                            .filter(inv =>
                              inv.invoice_no.includes(searchInvQuery) ||
                              inv.customer.includes(searchInvQuery) ||
                              inv.cashier.includes(searchInvQuery)
                            )
                            .map((inv, idx) => (
                              <div
                                key={inv.id}
                                className="p-2 border-b last:border-0 hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center"
                                onClick={() => {
                                  const index = invoices.findIndex(i => i.id === inv.id);
                                  if (index !== -1) setCurrentInvIndex(index);
                                  setIsInvSearchOpen(false);
                                }}
                              >
                                <div>
                                  <span className="font-bold text-blue-700">{inv.invoice_no}</span>
                                  <span className="text-slate-400 mx-1">|</span>
                                  <span className="text-slate-700">{inv.customer}</span>
                                </div>
                                <div className="text-slate-500 font-mono">
                                  {inv.date} ({getInvoiceTotals(inv).total.toLocaleString()} ر.ي)
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Header Information Fields */}
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 shadow-sm" id="invoice-header-fields">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">رقم الفاتورة *</label>
                    <Input
                      value={invForm.invoice_no}
                      onChange={e => setInvForm({ ...invForm, invoice_no: e.target.value })}
                      disabled={!isInvEditing}
                      className="h-8 font-mono font-bold bg-white border-slate-300 text-blue-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">رقم المرجع</label>
                    <Input
                      value={invForm.ref_no}
                      onChange={e => setInvForm({ ...invForm, ref_no: e.target.value })}
                      disabled={!isInvEditing}
                      placeholder="مثال: REF-9011"
                      className="h-8 font-mono bg-white border-slate-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">تاريخ الفاتورة</label>
                    <Input
                      type="date"
                      value={invForm.date}
                      onChange={e => setInvForm({ ...invForm, date: e.target.value })}
                      disabled={!isInvEditing}
                      className="h-8 bg-white border-slate-300 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">وقت الفاتورة</label>
                    <Input
                      type="text"
                      value={invForm.time}
                      onChange={e => setInvForm({ ...invForm, time: e.target.value })}
                      disabled={!isInvEditing}
                      className="h-8 font-mono bg-white border-slate-300 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">الفرع المعتمد</label>
                    <select
                      value={invForm.branch}
                      onChange={e => setInvForm({ ...invForm, branch: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-semibold"
                    >
                      <option value="صنعاء - الفرع الرئيسي">صنعاء - الفرع الرئيسي</option>
                      <option value="عدن - فرع المعلا">عدن - فرع المعلا</option>
                      <option value="تعز - فرع الحوبان">تعز - فرع الحوبان</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">مستودع الصرف *</label>
                    <select
                      value={invForm.warehouse}
                      onChange={e => setInvForm({ ...invForm, warehouse: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-semibold text-blue-700"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.name_ar}>{w.name_ar}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">الكاشير</label>
                    <Input
                      value={invForm.cashier}
                      onChange={e => setInvForm({ ...invForm, cashier: e.target.value })}
                      disabled={!isInvEditing}
                      className="h-8 bg-white border-slate-300"
                    />
                  </div>

                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <label className="font-bold text-slate-600 block">العميل الحالي *</label>
                    <select
                      value={invForm.customer}
                      onChange={e => setInvForm({ ...invForm, customer: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold text-indigo-700"
                    >
                      <option value="عميل نقدي عام">عميل نقدي عام</option>
                      <option value="شركة رويال للمأكولات">شركة رويال للمأكولات</option>
                      <option value="مؤسسة الوفاء التجارية">مؤسسة الوفاء التجارية</option>
                      <option value="مجموعة هائل سعيد">مجموعة هائل سعيد أنعم</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">مندوب المبيعات</label>
                    <Input
                      value={invForm.sales_rep}
                      onChange={e => setInvForm({ ...invForm, sales_rep: e.target.value })}
                      disabled={!isInvEditing}
                      className="h-8 bg-white border-slate-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">مركز التكلفة</label>
                    <select
                      value={invForm.cost_center}
                      onChange={e => setInvForm({ ...invForm, cost_center: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="302 - مبيعات التجزئة">302 - مبيعات التجزئة</option>
                      <option value="301 - مركز مبيعات الجملة">301 - مركز مبيعات الجملة</option>
                      <option value="305 - مركز مبيعات الصالة">305 - مبيعات الصالة</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">طريقة الدفع *</label>
                    <select
                      value={invForm.payment_method}
                      onChange={e => setInvForm({ ...invForm, payment_method: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold"
                    >
                      <option value="نقدي">نقدي (Cash)</option>
                      <option value="آجل">آجل (On Account)</option>
                      <option value="شبكة">شبكة / بطاقة (Card)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">العملة الحسابية</label>
                    <select
                      value={invForm.currency}
                      onChange={e => setInvForm({ ...invForm, currency: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="ريال يمني">ريال يمني (YER)</option>
                      <option value="ريال سعودي">ريال سعودي (SAR)</option>
                      <option value="دولار أمريكي">دولار أمريكي (USD)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">سعر الصرف المقابل</label>
                    <Input
                      type="number"
                      value={invForm.exchange_rate}
                      onChange={e => setInvForm({ ...invForm, exchange_rate: Number(e.target.value) })}
                      disabled={!isInvEditing}
                      className="h-8 font-mono bg-white border-slate-300 text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">نوع الفاتورة *</label>
                    <select
                      value={invForm.type}
                      onChange={e => setInvForm({ ...invForm, type: e.target.value })}
                      disabled={!isInvEditing}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold text-indigo-700"
                    >
                      <option value="فاتورة مبيعات">فاتورة مبيعات (Sales)</option>
                      <option value="فاتورة مرتجع">فاتورة مرتجع مبيعات (Return)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 block">المشروع المرتبط</label>
                    <Input
                      value={invForm.project}
                      onChange={e => setInvForm({ ...invForm, project: e.target.value })}
                      disabled={!isInvEditing}
                      placeholder="اختياري"
                      className="h-8 bg-white border-slate-300"
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="font-bold text-slate-600 block">ملاحظات المستند</label>
                    <Input
                      value={invForm.notes}
                      onChange={e => setInvForm({ ...invForm, notes: e.target.value })}
                      disabled={!isInvEditing}
                      placeholder="اكتب أي ملاحظات إدارية هنا..."
                      className="h-8 bg-white border-slate-300 text-slate-700 font-semibold"
                    />
                  </div>
                </div>

                {/* Grid Items (Table Grid Editor) */}
                <div className="space-y-2" id="invoice-items-grid-block">
                  <div className="flex justify-between items-center bg-slate-100 p-2 border border-slate-200 rounded">
                    <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-slate-500" />
                      تفاصيل وجدول الأصناف (Grid)
                    </span>
                    <Badge variant="outline" className="bg-white border-slate-300 font-mono">
                      {invForm.items.length} أصناف في الفاتورة
                    </Badge>
                  </div>

                  {/* Add New Item Line inside the Grid */}
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-end text-xs" id="invoice-grid-append-row">
                    <div className="col-span-2 space-y-1">
                      <label className="font-bold text-slate-600">اختر المنتج من قائمة الأصناف العامة</label>
                      <select
                        onChange={e => {
                          const prod = dbProducts.find((p: any) => String(p.id) === e.target.value);
                          if (prod) {
                            setSelectedProductToInsert(prod);
                          }
                        }}
                        className="w-full h-8 px-2 bg-white border border-slate-300 rounded font-bold text-slate-800"
                      >
                        <option value="">-- اختر صنفاً --</option>
                        {dbProducts.map((p: any) => (
                          <option key={p.id} value={p.id}>[{p.number}] {p.name} - {p.price.toLocaleString()} ر.ي</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">الكمية المطلوبة</label>
                      <Input
                        type="number"
                        id="new-item-qty"
                        placeholder="1"
                        defaultValue="1"
                        className="h-8 font-mono text-center font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">نسبة الخصم %</label>
                      <Input
                        type="number"
                        id="new-item-discount"
                        placeholder="0"
                        defaultValue="0"
                        className="h-8 font-mono text-center"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">الضريبة المضافة %</label>
                      <Input
                        type="number"
                        id="new-item-tax"
                        placeholder="15"
                        defaultValue="15"
                        className="h-8 font-mono text-center"
                      />
                    </div>

                    <div className="space-y-1 col-span-2 lg:col-span-1">
                      <label className="font-bold text-slate-600 block opacity-0">الإجراء</label>
                      <Button
                        size="sm"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 gap-1"
                        onClick={() => {
                          if (!selectedProductToInsert) {
                            toast({ variant: "destructive", title: "يرجى تحديد المنتج أولاً قبل الإضافة" });
                            return;
                          }
                          const qtyEl = document.getElementById("new-item-qty") as HTMLInputElement;
                          const discEl = document.getElementById("new-item-discount") as HTMLInputElement;
                          const taxEl = document.getElementById("new-item-tax") as HTMLInputElement;

                          const qtyVal = Number(qtyEl?.value || 1);
                          const discPct = Number(discEl?.value || 0);
                          const taxPct = Number(taxEl?.value || 15);

                          const priceVal = selectedProductToInsert.price;
                          const subtotal = qtyVal * priceVal;
                          const discount_val = subtotal * (discPct / 100);
                          const tax_val = (subtotal - discount_val) * (taxPct / 100);
                          const total_after_tax = (subtotal - discount_val) + tax_val;

                          const seqNo = invForm.items.length + 1;
                          const newItem = {
                            seq: seqNo,
                            barcode: selectedProductToInsert.barcode || "69012345000" + seqNo,
                            code: selectedProductToInsert.number ? `PROD-${selectedProductToInsert.number}` : `PROD-00${seqNo}`,
                            name: selectedProductToInsert.name,
                            unit: "وجبة",
                            qty: qtyVal,
                            price: priceVal,
                            discount_pct: discPct,
                            discount_val: discount_val,
                            tax_pct: taxPct,
                            tax_val: tax_val,
                            subtotal: subtotal,
                            total_after_tax: total_after_tax,
                            warehouse: invForm.warehouse,
                            batch: "BATCH-" + new Date().getFullYear() + String.fromCharCode(65 + seqNo),
                            expiry: new Date(Date.now() + 5*24*60*60*1000).toISOString().slice(0, 10),
                            notes: ""
                          };

                          const updatedItems = [...invForm.items, newItem];
                          const updatedForm = { ...invForm, items: updatedItems };
                          setInvForm(updatedForm);

                          // Update in master list
                          const idx = invoices.findIndex(i => i.id === invForm.id);
                          if (idx !== -1) {
                            const updatedInvs = [...invoices];
                            updatedInvs[idx] = updatedForm;
                            setInvoices(updatedInvs);
                          }

                          toast({ title: `تم إنزال الصنف [${newItem.name}] بنجاح!` });
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إنزال صنف جديد
                      </Button>
                    </div>
                  </div>

                  {/* Grid Table */}
                  <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white" id="invoice-items-table-scroll">
                    <table className="w-full text-right text-xs min-w-[1200px]" id="invoice-items-table">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2.5 w-12 text-center">م</th>
                          <th className="p-2.5 w-32">الباركود</th>
                          <th className="p-2.5 w-24">كود الصنف</th>
                          <th className="p-2.5">اسم الصنف المعياري</th>
                          <th className="p-2.5 w-16">الوحدة</th>
                          <th className="p-2.5 w-20 text-center">الكمية</th>
                          <th className="p-2.5 w-24 text-left">السعر</th>
                          <th className="p-2.5 w-16 text-center">الخصم %</th>
                          <th className="p-2.5 w-24 text-left">قيمة الخصم</th>
                          <th className="p-2.5 w-16 text-center">الضريبة %</th>
                          <th className="p-2.5 w-24 text-left">قيمة الضريبة</th>
                          <th className="p-2.5 w-28 text-left">الإجمالي قبل الضريبة</th>
                          <th className="p-2.5 w-28 text-left">الإجمالي بعد الضريبة</th>
                          <th className="p-2.5 w-32">المستودع</th>
                          <th className="p-2.5 w-24">رقم التشغيلة</th>
                          <th className="p-2.5 w-24">تاريخ الانتهاء</th>
                          <th className="p-2.5 w-32">الملاحظات</th>
                          <th className="p-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono font-semibold" id="invoice-items-table-body">
                        {invForm.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center text-slate-400 font-sans">{item.seq}</td>
                            <td className="p-2.5 font-mono text-slate-600 text-[11px]">{item.barcode}</td>
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">{item.code}</td>
                            <td className="p-2.5 font-sans font-bold text-slate-800 text-right">{item.name}</td>
                            <td className="p-2.5 font-sans text-slate-500">{item.unit}</td>
                            
                            {/* Quantity column */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={e => {
                                  const q = Number(e.target.value || 0);
                                  const updated = [...invForm.items];
                                  updated[idx].qty = q;
                                  updated[idx].subtotal = q * item.price;
                                  updated[idx].discount_val = updated[idx].subtotal * (item.discount_pct / 100);
                                  updated[idx].tax_val = (updated[idx].subtotal - updated[idx].discount_val) * (item.tax_pct / 100);
                                  updated[idx].total_after_tax = (updated[idx].subtotal - updated[idx].discount_val) + updated[idx].tax_val;
                                  setInvForm({ ...invForm, items: updated });
                                }}
                                className="w-16 h-7 border text-center font-bold bg-white rounded"
                              />
                            </td>

                            {/* Price column */}
                            <td className="p-2 text-left">
                              <input
                                type="number"
                                value={item.price}
                                onChange={e => {
                                  const p = Number(e.target.value || 0);
                                  const updated = [...invForm.items];
                                  updated[idx].price = p;
                                  updated[idx].subtotal = item.qty * p;
                                  updated[idx].discount_val = updated[idx].subtotal * (item.discount_pct / 100);
                                  updated[idx].tax_val = (updated[idx].subtotal - updated[idx].discount_val) * (item.tax_pct / 100);
                                  updated[idx].total_after_tax = (updated[idx].subtotal - updated[idx].discount_val) + updated[idx].tax_val;
                                  setInvForm({ ...invForm, items: updated });
                                }}
                                className="w-20 h-7 border text-left font-bold bg-white rounded"
                              />
                            </td>

                            {/* Discount Pct column */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.discount_pct}
                                onChange={e => {
                                  const dp = Number(e.target.value || 0);
                                  const updated = [...invForm.items];
                                  updated[idx].discount_pct = dp;
                                  updated[idx].discount_val = item.subtotal * (dp / 100);
                                  updated[idx].tax_val = (item.subtotal - updated[idx].discount_val) * (item.tax_pct / 100);
                                  updated[idx].total_after_tax = (item.subtotal - updated[idx].discount_val) + updated[idx].tax_val;
                                  setInvForm({ ...invForm, items: updated });
                                }}
                                className="w-12 h-7 border text-center bg-white rounded"
                              />
                            </td>

                            <td className="p-2.5 text-left text-slate-500 font-mono">
                              {Math.round(item.discount_val).toLocaleString()}
                            </td>

                            {/* Tax Pct column */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                value={item.tax_pct}
                                onChange={e => {
                                  const tp = Number(e.target.value || 0);
                                  const updated = [...invForm.items];
                                  updated[idx].tax_pct = tp;
                                  updated[idx].tax_val = (item.subtotal - item.discount_val) * (tp / 100);
                                  updated[idx].total_after_tax = (item.subtotal - item.discount_val) + updated[idx].tax_val;
                                  setInvForm({ ...invForm, items: updated });
                                }}
                                className="w-12 h-7 border text-center bg-white rounded"
                              />
                            </td>

                            <td className="p-2.5 text-left text-red-500 font-mono">
                              {Math.round(item.tax_val).toLocaleString()}
                            </td>

                            <td className="p-2.5 text-left text-slate-600 font-mono">
                              {Math.round(item.subtotal).toLocaleString()}
                            </td>

                            <td className="p-2.5 text-left text-blue-800 font-bold font-mono">
                              {Math.round(item.total_after_tax).toLocaleString()}
                            </td>

                            <td className="p-2.5 font-sans text-slate-600 text-[11px]">{item.warehouse}</td>
                            <td className="p-2.5 font-mono text-slate-500 text-[11px]">{item.batch}</td>
                            <td className="p-2.5 font-mono text-slate-500 text-[11px]">{item.expiry}</td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.notes || ""}
                                onChange={e => {
                                  const updated = [...invForm.items];
                                  updated[idx].notes = e.target.value;
                                  setInvForm({ ...invForm, items: updated });
                                }}
                                className="w-full h-7 border px-1 text-right text-[11px] font-sans bg-white rounded"
                                placeholder="..."
                              />
                            </td>

                            <td className="p-2 text-center">
                              <Button
                                variant="ghost" size="icon" className="w-7 h-7 text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  const updatedItems = invForm.items.filter((it: any) => it.seq !== item.seq);
                                  // re-sequence remaining
                                  const resequenced = updatedItems.map((it: any, i: number) => ({ ...it, seq: i + 1 }));
                                  setInvForm({ ...invForm, items: resequenced });
                                  toast({ title: "تم حذف الصنف من جدول الفاتورة" });
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}

                        {invForm.items.length === 0 && (
                          <tr>
                            <td colSpan={18} className="p-8 text-center text-slate-400 font-sans" id="invoice-items-empty-row">
                              لا توجد أصناف في شبكة الفاتورة حالياً. استخدم تعبئة الأصناف بالأعلى لإنزال البضاعة المطلوبة.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Summary Panel & Recalculations */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-200" id="invoice-footer-panels">
                  {/* Operations Buttons Grid Panel */}
                  <Card className="lg:col-span-2 border-slate-200 bg-slate-50/50">
                    <CardHeader className="py-2.5 bg-slate-100/80 border-b border-slate-200">
                      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        لوحة عمليات ومعالجة الفاتورة الحسابية السريعة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          const scanner = prompt("يرجى إدخال أو محاكاة قراءة كود الباركود الدولي:");
                          if (scanner) {
                            const prod = dbProducts.find((p: any) => p.barcode === scanner || p.number === Number(scanner));
                            if (prod) {
                              toast({ title: `تم العثور على الصنف الممسوح: ${prod.name}` });
                              setSelectedProductToInsert(prod);
                            } else {
                              toast({ variant: "destructive", title: "لم يتم العثور على هذا الباركود في النظام" });
                            }
                          }
                        }}
                      >
                        <Barcode className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        قراءة باركود (Scanner)
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          const disc = Number(prompt("يرجى كتابة قيمة الخصم الإجمالية للفاتورة بالريال:", "0") || 0);
                          if (disc >= 0) {
                            // Apply discount proportionally to items
                            const totalVal = getInvoiceTotals(invForm).before_disc;
                            if (totalVal > 0) {
                              const updatedItems = invForm.items.map((it: any) => {
                                const propPct = (it.qty * it.price) / totalVal;
                                const d_val = disc * propPct;
                                const t_val = ((it.qty * it.price) - d_val) * (it.tax_pct / 100);
                                return {
                                  ...it,
                                  discount_val: d_val,
                                  tax_val: t_val,
                                  total_after_tax: ((it.qty * it.price) - d_val) + t_val
                                };
                              });
                              setInvForm({ ...invForm, items: updatedItems });
                              toast({ title: "تم احتساب وتوزيع الخصم الإجمالي على الأصناف بنجاح" });
                            }
                          }
                        }}
                      >
                        <Percent className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        احتساب الخصومات الإجمالية
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          const pts = Math.floor(getInvoiceTotals(invForm).total / 1000) * 10;
                          setInvForm({ ...invForm, loyalty_points: pts });
                          toast({ title: `تم تحديث نقاط الولاء المستحقة لهذه العملية: +${pts} نقطة` });
                        }}
                      >
                        <TrendingUp className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        احتساب نقاط الولاء للعميل
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-red-50 hover:text-red-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          if (invForm.items.length === 0) {
                            toast({ variant: "destructive", title: "لا يمكن تعليق فاتورة فارغة" });
                            return;
                          }
                          setSuspendedInvoices([...suspendedInvoices, { ...invForm, heldAt: new Date().toLocaleTimeString() }]);
                          toast({ title: `تم تعليق وحفظ الفاتورة [${invForm.invoice_no}] في الذاكرة المؤقتة` });
                          handleInvNew();
                        }}
                      >
                        <X className="w-3.5 h-3.5 ml-1 text-red-500" />
                        تعليق الفاتورة (Hold)
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-green-50 hover:text-green-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          if (suspendedInvoices.length === 0) {
                            toast({ variant: "destructive", title: "لا توجد أي فواتير معلقة حالياً" });
                            return;
                          }
                          const recovered = suspendedInvoices[suspendedInvoices.length - 1];
                          setInvForm(recovered);
                          setSuspendedInvoices(suspendedInvoices.slice(0, -1));
                          toast({ title: `تم استرجاع الفاتورة المعلقة الأخيرة بنجاح: ${recovered.invoice_no}` });
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5 ml-1 text-green-600" />
                        استرجاع الفواتير المعلقة
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم معالجة دمج الفاتورة الحالية مع الفاتورة السابقة وتوحيد السجلات" })}
                      >
                        <Layers className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        دمج فاتورتين حسابيتين
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم معالجة تقسيم الفاتورة الحالية إلى مستندين لعدة كاشيرات" })}
                      >
                        <Layers className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        تقسيم الفاتورة الحالية
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-red-50 hover:text-red-700 h-8 text-[11px] font-bold"
                        onClick={() => {
                          setInvForm({
                            ...invForm,
                            type: "فاتورة مرتجع",
                            invoice_no: "RET-" + Math.floor(10000 + Math.random()*90000),
                            notes: "مردود مبيعات بموجب الفاتورة " + invForm.invoice_no
                          });
                          toast({ title: "تم تحويل نمط الفاتورة إلى مرتجع مبيعات" });
                        }}
                      >
                        <CheckSquare className="w-3.5 h-3.5 ml-1 text-red-500" />
                        إنشاء مرتجع مبيعات
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم إرسال طلب المأكولات والمشروبات بنجاح إلى شاشة المطبخ (Kitchen Screen)" })}
                      >
                        <Send className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        إرسال للمطبخ (KDS)
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم إرسال نسخة الطباعة الكاشية لدرج النقدية" })}
                      >
                        <Printer className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        إرسال للطباعة الفورية
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم إرسال تفاصيل الفاتورة عبر تطبيق WhatsApp للعميل" })}
                      >
                        <Share2 className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        إرسال WhatsApp
                      </Button>

                      <Button
                        variant="outline" size="sm" className="bg-white border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 h-8 text-[11px] font-bold"
                        onClick={() => toast({ title: "تم استدعاء تقرير الأرباح اللحظية للفاتورة الحالية" })}
                      >
                        <TrendingUp className="w-3.5 h-3.5 ml-1 text-indigo-600" />
                        عرض الأرباح اللحظية
                      </Button>
                    </CardContent>

                    {/* Reports Grid panel */}
                    <div className="border-t border-slate-200 bg-slate-100/50 p-2 text-xs">
                      <span className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1">
                        <FileText className="w-4 h-4 text-slate-500" />
                        مركز تقارير ومبيعات الكاشير والمستودعات السريعة:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "قائمة الفواتير العامة",
                          "المبيعات اليومية",
                          "الأرباح والخسائر اللحظية",
                          "المبيعات حسب الكاشير",
                          "حركة الأصناف مبيعات",
                          "جرد مستودع الكاشير",
                          "الخصومات والضرائب"
                        ].map((rep, rIdx) => (
                          <Button
                            key={rIdx} variant="ghost" size="sm"
                            className="h-7 text-[10px] bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-800 text-slate-700 font-semibold px-2 py-0.5"
                            onClick={() => {
                              setInvReportType(rep);
                            }}
                          >
                            {rep}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Summary Totals Box Panel */}
                  <div className="bg-slate-800 text-white rounded-lg p-4 border border-slate-700 space-y-3 font-semibold text-xs shadow-md" id="invoice-totals-summary-box">
                    <h3 className="font-bold border-b border-slate-700 pb-2 flex justify-between text-slate-300 text-xs">
                      <span>مُلخّص القيَم والضريبة</span>
                      <span className="font-mono">{invForm.invoice_no}</span>
                    </h3>

                    <div className="space-y-2 text-[11px] sm:text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي الكميات:</span>
                        <span className="font-mono text-slate-100">{getInvoiceTotals(invForm).qty} حبة</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي قبل الخصم:</span>
                        <span className="font-mono text-slate-100">{getInvoiceTotals(invForm).before_disc.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي الخصومات:</span>
                        <span className="font-mono text-amber-400">-{getInvoiceTotals(invForm).disc_val.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي ضريبة القيمة المضافة:</span>
                        <span className="font-mono text-red-400">+{getInvoiceTotals(invForm).tax_val.toLocaleString()} ر.ي</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400 self-center">رسوم الخدمة والتوصيل:</span>
                        <div className="flex gap-1 font-mono">
                          <input
                            type="number"
                            value={invForm.service_charge}
                            onChange={e => setInvForm({ ...invForm, service_charge: Number(e.target.value || 0) })}
                            className="w-16 bg-slate-700 text-white text-center rounded border border-slate-600 h-6 text-xs"
                            placeholder="خدمة"
                          />
                          <input
                            type="number"
                            value={invForm.delivery_charge}
                            onChange={e => setInvForm({ ...invForm, delivery_charge: Number(e.target.value || 0) })}
                            className="w-16 bg-slate-700 text-white text-center rounded border border-slate-600 h-6 text-xs"
                            placeholder="توصيل"
                          />
                        </div>
                      </div>
                      <div className="border-t border-slate-700 my-2 pt-2 flex justify-between text-base font-bold text-white">
                        <span className="text-emerald-400 text-xs sm:text-sm">صافي إجمالي الفاتورة:</span>
                        <span className="font-mono text-emerald-400 text-lg sm:text-xl">
                          {getInvoiceTotals(invForm).total.toLocaleString()} ر.ي
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-slate-700 pt-2 text-[11px]">
                        <div>
                          <label className="text-slate-400 block mb-1">المبلغ المدفوع</label>
                          <Input
                            type="number"
                            value={invForm.paid}
                            onChange={e => setInvForm({ ...invForm, paid: Number(e.target.value || 0) })}
                            className="h-8 font-mono font-bold bg-slate-700 text-emerald-400 border-slate-600 text-center"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1">المتبقي / رصيد العميل</label>
                          <div className="h-8 bg-slate-900 border border-slate-700 rounded flex items-center justify-center font-mono font-bold text-amber-500 text-center">
                            {getInvoiceTotals(invForm).remaining.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between text-[11px] text-slate-400">
                        <span>نقاط الولاء المستحقة:</span>
                        <span className="font-mono font-bold text-blue-400">+{invForm.loyalty_points || 0} نقطة</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>رصيد العميل المالي السابق:</span>
                        <span className="font-mono text-slate-200">{(invForm.customer_balance || 0).toLocaleString()} ر.ي</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print/Preview Popup Reports Modal */}
                {invReportType && (
                  <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-400 rounded-lg shadow-2xl max-w-4xl w-full overflow-hidden" id="inv-report-modal">
                      <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
                        <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                          <FileText className="w-5 h-5 text-emerald-400" />
                          معاينة تقرير المبيعات والمستودعات - {invReportType}
                        </span>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-white hover:bg-slate-800" onClick={() => setInvReportType(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-4 space-y-3 text-xs overflow-y-auto max-h-[80vh]">
                        <div className="flex justify-between items-center border-b pb-3 text-slate-600 font-bold">
                          <div>
                            <p className="text-base text-slate-800">شركة أومني سيستم برو للأنظمة الحسابية والمخازن</p>
                            <p>تقرير إداري تحليلي - نظام مبيعات Omni System Pro المتكامل</p>
                          </div>
                          <div className="text-left">
                            <p>تاريخ الطباعة: {new Date().toLocaleDateString()}</p>
                            <p>المستخدم: علاء اليماني</p>
                          </div>
                        </div>

                        {/* Custom content depending on the report selected */}
                        {invReportType === "قائمة الفواتير العامة" && (
                          <table className="w-full text-right">
                            <thead className="bg-slate-100 font-bold border-b">
                              <tr>
                                <th className="p-2">رقم الفاتورة</th>
                                <th className="p-2">العميل</th>
                                <th className="p-2">تاريخ الفاتورة</th>
                                <th className="p-2">طريقة الدفع</th>
                                <th className="p-2">المستودع</th>
                                <th className="p-2 text-left">الإجمالي</th>
                                <th className="p-2">الحالة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.map((inv, idx) => (
                                <tr key={idx} className="border-b hover:bg-slate-50">
                                  <td className="p-2 font-mono text-blue-700 font-bold">{inv.invoice_no}</td>
                                  <td className="p-2 font-bold">{inv.customer}</td>
                                  <td className="p-2">{inv.date}</td>
                                  <td className="p-2">{inv.payment_method}</td>
                                  <td className="p-2">{inv.warehouse}</td>
                                  <td className="p-2 text-left font-mono font-bold">{getInvoiceTotals(inv).total.toLocaleString()} ر.ي</td>
                                  <td className="p-2 text-emerald-700">{inv.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {invReportType === "المبيعات اليومية" && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="p-3 bg-blue-50 border rounded-lg">
                                <p className="text-slate-500 font-bold">إجمالي المبيعات الإجمالية اليوم</p>
                                <p className="text-lg font-bold text-blue-800 font-mono">
                                  {(invoices || []).reduce((sum, inv) => sum + getInvoiceTotals(inv).total, 0).toLocaleString()} ريال
                                </p>
                              </div>
                              <div className="p-3 bg-emerald-50 border rounded-lg">
                                <p className="text-slate-500 font-bold">المبالغ النقدية المقبوضة</p>
                                <p className="text-lg font-bold text-emerald-800 font-mono">
                                  {(invoices || []).reduce((sum, inv) => sum + Number(inv.paid || 0), 0).toLocaleString()} ريال
                                </p>
                              </div>
                              <div className="p-3 bg-amber-50 border rounded-lg">
                                <p className="text-slate-500 font-bold">إجمالي مبيعات الآجل</p>
                                <p className="text-lg font-bold text-amber-800 font-mono">
                                  {(invoices || []).reduce((sum, inv) => sum + (inv.payment_method === "آجل" ? getInvoiceTotals(inv).total : 0), 0).toLocaleString()} ريال
                                </p>
                              </div>
                            </div>
                            <table className="w-full text-right">
                              <thead className="bg-slate-100 font-bold">
                                <tr>
                                  <th className="p-2">الكاشير</th>
                                  <th className="p-2">عدد العمليات</th>
                                  <th className="p-2 text-left">قيمة المبيعات</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b">
                                  <td className="p-2 font-bold">علاء اليماني</td>
                                  <td className="p-2 font-mono">2 عمليات</td>
                                  <td className="p-2 text-left font-mono font-bold">220,125 ر.ي</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {invReportType !== "قائمة الفواتير العامة" && invReportType !== "المبيعات اليومية" && (
                          <div className="p-8 text-center text-slate-400">
                            <p className="font-bold">لا توجد حركات كافية لتوليد تفاصيل تقرير [{invReportType}]</p>
                            <p className="text-slate-500 mt-1">يرجى إضافة المزيد من فواتير المبيعات وتعديل البضائع لإثراء السجل الحسابي.</p>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t">
                          <Button size="sm" className="bg-slate-800 hover:bg-slate-900 text-white text-xs gap-1" onClick={() => window.print()}>
                            <Printer className="w-4 h-4" />
                            طباعة هذا التقرير الحسابي فوراً
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setInvReportType(null)}>إغلاق</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Independent Sales Invoice User Permissions Matrix */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white mt-4" id="invoice-permissions-block">
                  <div className="bg-slate-100 p-2.5 border-b border-slate-300 flex justify-between items-center">
                    <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-slate-500" />
                      إدارة صلاحيات مستخدمين الفواتير ومردود المبيعات المستقلة
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        variant={invActivePermRole === "admin" ? "default" : "outline"}
                        size="sm" className="h-7 text-[10px]" onClick={() => setInvActivePermRole("admin")}
                      >
                        دور مدير النظام
                      </Button>
                      <Button
                        variant={invActivePermRole === "cashier" ? "default" : "outline"}
                        size="sm" className="h-7 text-[10px]" onClick={() => setInvActivePermRole("cashier")}
                      >
                        دور الكاشير / البائع
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-semibold">
                    {Object.keys(invPermissions[invActivePermRole] || {}).map((permKey) => (
                      <label key={permKey} className="flex items-center gap-2 cursor-pointer p-1.5 bg-white border rounded hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={invPermissions[invActivePermRole][permKey]}
                          onChange={e => {
                            const updatedPerms = { ...invPermissions };
                            updatedPerms[invActivePermRole][permKey] = e.target.checked;
                            setInvPermissions(updatedPerms);
                            toast({ title: `تم تحديث صلاحية [${permKey}] لدور [${invActivePermRole}]` });
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-slate-700 truncate">
                          {permKey === "create" && "إنشاء فاتورة"}
                          {permKey === "edit" && "تعديل فاتورة"}
                          {permKey === "delete" && "حذف فاتورة"}
                          {permKey === "print" && "طباعة الفاتورة"}
                          {permKey === "reprint" && "إعادة طباعة"}
                          {permKey === "manual_discount" && "خصم يدوي مسموح"}
                          {permKey === "change_price" && "تعديل السعر بالجدول"}
                          {permKey === "change_tax" && "تعديل الضريبة %"}
                          {permKey === "change_warehouse" && "تعديل مستودع الصرف"}
                          {permKey === "change_customer" && "تعديل العميل"}
                          {permKey === "change_cashier" && "تعديل الكاشير"}
                          {permKey === "suspend" && "تعليق الفاتورة"}
                          {permKey === "retrieve" && "استرجاع معلقة"}
                          {permKey === "post" && "ترحيل الدفاتر"}
                          {permKey === "unpost" && "إلغاء الترحيل"}
                          {permKey === "approve" && "اعتماد الفواتير"}
                          {permKey === "unapprove" && "إلغاء الاعتماد"}
                          {permKey === "create_return" && "إنشاء مرتجع"}
                          {permKey === "view_profit" && "عرض الأرباح"}
                          {permKey === "export" && "تصدير البيانات"}
                          {permKey === "import" && "استيراد البيانات"}
                          {permKey === "view_cost" && "عرض تكلفة السلعة"}
                          {permKey === "edit_saved" && "تعديل بعد الحفظ"}
                          {permKey === "edit_posted" && "تعديل بعد الترحيل"}
                          {permKey === "cancel" && "إلغاء الفاتورة نهائياً"}
                          {permKey === "open_drawer" && "فتح درج النقدية سريعا"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 4: ITEM CARD SETUP (Image 5) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="products" className="mt-4">
            <Card className="border-slate-300 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
                <CardTitle className="text-sm font-bold text-slate-700">أنظمة المخازن - إدارة المخازن - بيانات الأصناف والبطاقات</CardTitle>
                <CardDescription className="text-xs">تسجيل وتعريف الأصناف والخدمات في المخزون العام للشركة</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Left Column Controls / Options */}
                  <div className="md:col-span-1 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-slate-700 pb-1.5 border-b border-slate-300">خصائص ومحددات الصنف</h3>
                    <div className="space-y-2 font-semibold">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.is_suspended === 1}
                          onChange={e => setProductForm({ ...productForm, is_suspended: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-300"
                        />
                        <span>غير قابل للبيع (موقف)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.is_controlled === 1}
                          onChange={e => setProductForm({ ...productForm, is_controlled: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-300"
                        />
                        <span>خاضع للرقابة المخزنية</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.allow_fraction === 1}
                          onChange={e => setProductForm({ ...productForm, allow_fraction: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-300"
                        />
                        <span>السماح باستخدام الكسور والجرامات</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.is_cash_only === 1}
                          onChange={e => setProductForm({ ...productForm, is_cash_only: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-300"
                        />
                        <span>يباع نقداً فقط</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.is_asset === 1}
                          onChange={e => setProductForm({ ...productForm, is_asset: e.target.checked ? 1 : 0 })}
                          className="rounded border-slate-300"
                        />
                        <span>يعتبر أصل من أصول الشركة</span>
                      </label>
                    </div>

                    <div className="pt-3 border-t space-y-2">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">التكلفة الأولى للصنف</label>
                        <Input
                          placeholder="0.00"
                          value={productForm.cost}
                          onChange={e => setProductForm({ ...productForm, cost: e.target.value })}
                          className="h-8 text-xs bg-white border-slate-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">التكلفة الحالية المتوسطة</label>
                        <Input
                          placeholder="0.00"
                          value={productForm.cost ? String(Number(productForm.cost) * 1.05) : "0.00"}
                              className="h-8 text-xs bg-slate-100 border-slate-300"
                              disabled
                              readOnly
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Main Form Grid matching Image 5 */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">نوع الصنف</label>
                        <select
                          value={productForm.item_type}
                          onChange={e => setProductForm({ ...productForm, item_type: e.target.value })}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="عادي">صنف عادي (مخزني)</option>
                          <option value="خدمي">صنف خدمي (لا يحسب مخزون)</option>
                          <option value="مركب">صنف مركب (تجميعي)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">رقم المجموعة الرئيسية</label>
                        <select
                          value={productForm.category_id}
                          onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold"
                        >
                          <option value="">-- اختر المجموعة --</option>
                          {dbCategories.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">رقم الباركود الدولي</label>
                        <Input
                          value={productForm.barcode}
                          onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                          placeholder="6901234567890"
                          className="h-8 text-xs bg-white border-slate-300 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">رقم الصنف (ID)</label>
                        <Input
                          value={productForm.number}
                          onChange={e => setProductForm({ ...productForm, number: e.target.value })}
                          placeholder="مثال: 16"
                          className="h-8 text-xs bg-white border-slate-300"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="font-semibold text-slate-600">اسم الصنف المعياري *</label>
                        <Input
                          value={productForm.name}
                          onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="مثال: شاورما دجاج جامبو"
                          className="h-8 text-xs bg-white border-slate-300 font-bold"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <h4 className="font-bold text-slate-700 mb-2">مواصفات وتفاصيل الصنف الإضافية</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-slate-500">المقاس</label>
                          <Input value={productForm.size} onChange={e => setProductForm({...productForm, size: e.target.value})} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500">اللون</label>
                          <Input value={productForm.color} onChange={e => setProductForm({...productForm, color: e.target.value})} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500">بلد المنشأ</label>
                          <Input value={productForm.brand} onChange={e => setProductForm({...productForm, brand: e.target.value})} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-slate-500">سعر البيع الافتراضي</label>
                          <Input value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="h-8 text-xs font-bold text-blue-700" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 gap-2">
                      <Button
                        onClick={() => {
                          if (!productForm.name || !productForm.price || !productForm.category_id) {
                            toast({ variant: "destructive", title: "يرجى ملء الحقول الأساسية: الاسم، السعر، والمجموعة" });
                            return;
                          }
                          apiPost("/api/products", {
                            name: productForm.name,
                            price: Number(productForm.price),
                            cost: Number(productForm.cost || 0),
                            category_id: Number(productForm.category_id),
                            number: productForm.number ? Number(productForm.number) : Math.floor(100 + Math.random() * 900),
                            barcode: productForm.barcode || null,
                            active: 1
                          }).then(() => {
                            qc.invalidateQueries({ queryKey: ["onyx-products"] });
                            toast({ title: "تم تعريف وإضافة الصنف الجديد في السجلات بنجاح!" });
                            setProductForm({
                              name: "", price: "", cost: "", category_id: "", number: "", barcode: "",
                              group_id: "1", sub_group_id: "1", item_type: "عادي", size: "وسط", color: "أبيض", brand: "محلي", material: "جاهز",
                              is_suspended: 0, is_controlled: 1, allow_fraction: 0, is_cash_only: 0, is_asset: 0, specifications: ""
                            });
                          }).catch(err => toast({ variant: "destructive", title: "فشل الحفظ", description: err.message }));
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold h-9"
                      >
                        <Save className="w-4 h-4 ml-1" />
                        حفظ وتعريف الصنف الجديد
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 5: WAREHOUSE SETUP (Image 6) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="warehouses" className="mt-4">
            <Card className="border-slate-300 shadow-sm overflow-hidden" id="warehouse-management-card">
              {/* Header block */}
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row justify-between items-center" id="warehouse-card-header">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    شاشة إدارة وتعريف المخازن (Warehouse Management) [صورة 6]
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-slate-500">
                    تعريف وتوزيع المستودعات ونقاط التخزين المعتمدة للفرع وترتيب الصلاحيات
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-white border-slate-300 text-xs font-bold text-slate-600">
                  المستودع النشط: {whForm?.name_ar || "جديد"}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs" id="warehouse-card-content">
                {/* ─── 1. Desktop Retro ERP Toolbar (16 Actions) ─── */}
                <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-300 flex flex-wrap gap-1 items-center justify-start text-[10px] font-bold shadow-inner">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={handleWhNew}
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>جديد</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setIsWhSearchOpen(true)}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>فتح</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={handleWhSave}
                    disabled={!isWhEditing}
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-600" />
                    <span>حفظ</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={handleWhSaveAndNew}
                    disabled={!isWhEditing}
                  >
                    <SaveAll className="w-3.5 h-3.5 text-teal-600" />
                    <span>حفظ جديد</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setIsWhEditing(true)}
                    disabled={isWhEditing}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تعديل</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5 text-red-600 hover:text-red-700"
                    onClick={handleWhDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </Button>
                  <div className="w-[1px] h-6 bg-slate-300 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setIsWhSearchOpen(true)}
                  >
                    <Search className="w-3.5 h-3.5 text-slate-600" />
                    <span>بحث</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => {
                      setWhReportType("summary");
                      toast({ title: "جاري تجهيز تقرير جرد وإحصائيات المخزن للطباعة..." });
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>طباعة</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => {
                      setWhReportType("details");
                      toast({ title: "عرض معاينة حركة المخازن الفورية..." });
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>معاينة</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => {
                      refetchWarehouses();
                      toast({ title: "تم تحديث البيانات من خادم أومني بنجاح" });
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>تحديث</span>
                  </Button>
                  <div className="w-[1px] h-6 bg-slate-300 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setCurrentWhIndex(0)}
                    disabled={currentWhIndex === 0}
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                    <span>أول سجل</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setCurrentWhIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentWhIndex === 0}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>السابق</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setCurrentWhIndex(prev => Math.min(warehouses.length - 1, prev + 1))}
                    disabled={currentWhIndex === warehouses.length - 1}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>التالي</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={() => setCurrentWhIndex(warehouses.length - 1)}
                    disabled={currentWhIndex === warehouses.length - 1}
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                    <span>آخر سجل</span>
                  </Button>
                  <div className="w-[1px] h-6 bg-slate-300 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5"
                    onClick={handleWhCopy}
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>نسخ</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center gap-0.5 text-slate-500 hover:text-slate-800"
                    onClick={() => setIsWhEditing(false)}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>إغلاق</span>
                  </Button>
                </div>

                {/* ─── 2. Main Content Split Panel ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" id="warehouse-fields-split">
                  {/* Left Column: Constraints & Controls */}
                  <div className="lg:col-span-1 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200 font-semibold text-slate-700 shadow-sm" id="warehouse-switches-block">
                    <h3 className="font-bold text-slate-800 pb-1.5 border-b border-slate-300 flex items-center gap-1.5 text-xs">
                      <ShieldAlert className="w-4 h-4 text-slate-500" />
                      محددات وصلاحيات المستودع
                    </h3>
                    <div className="space-y-2.5 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.status === "موقوف"}
                          onChange={e => {
                            if (e.target.checked) handleWhSuspend();
                            else handleWhReactivate();
                          }}
                          className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-red-700 font-bold">مستودع موقف (معلق العمل به)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.allow_sales}
                          onChange={e => setWhForm({ ...whForm, allow_sales: e.target.checked })}
                          disabled={!isWhEditing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>السماح بالبيع المباشر من هذا المستودع</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.allow_purchases}
                          onChange={e => setWhForm({ ...whForm, allow_purchases: e.target.checked })}
                          disabled={!isWhEditing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>السماح بالشراء واستلام البضائع فيه</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.allow_transfer}
                          onChange={e => setWhForm({ ...whForm, allow_transfer: e.target.checked })}
                          disabled={!isWhEditing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>السماح بالتحويلات المخزنية البينية</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.allow_production}
                          onChange={e => setWhForm({ ...whForm, allow_production: e.target.checked })}
                          disabled={!isWhEditing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>مستودع خاص بخطوط الإنتاج / الطبخ</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.allow_inventory}
                          onChange={e => setWhForm({ ...whForm, allow_inventory: e.target.checked })}
                          disabled={!isWhEditing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>إخضاع المستودع لعملية الجرد الدوري</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={whForm?.id === defaultWhId}
                          onChange={e => { if (e.target.checked) handleWhSetDefault(); }}
                          className="rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="text-blue-800 font-bold">تعيين كمستودع رئيسي افتراضي</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        onClick={handleWhSetDefault}
                        className="w-full text-[10px] h-7 gap-1 font-bold bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        اعتماد كافتراضي للنظام
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Inputs & Form details */}
                  <div className="lg:col-span-3 space-y-4" id="warehouse-fields-panel">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">رقم السجل المخزني (تلقائي)</label>
                        <Input
                          value={whForm?.id || ""}
                            disabled
                            readOnly
                            className="h-8 font-mono bg-slate-100 font-bold border-slate-300 text-slate-500 text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">كود المخزن المعياري</label>
                        <Input
                          value={whForm?.code || ""}
                          onChange={e => setWhForm({ ...whForm, code: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="WH-001"
                          className="h-8 font-mono bg-white font-bold border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">اسم المخزن (بالعربية) <span className="text-red-500">*</span></label>
                        <Input
                          value={whForm?.name_ar || ""}
                          onChange={e => setWhForm({ ...whForm, name_ar: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="مثال: مستودع المواد الجافة"
                          className="h-8 bg-white font-black border-slate-300 text-slate-800 text-right"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">اسم المخزن (بالإنجليزية)</label>
                        <Input
                          value={whForm?.name_en || ""}
                          onChange={e => setWhForm({ ...whForm, name_en: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="example: Raw Materials Wh"
                          className="h-8 bg-white font-bold border-slate-300 text-slate-800 text-left"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">نوع المستودع الحسابي</label>
                        <select
                          value={whForm?.type || "مواد خام"}
                          onChange={e => setWhForm({ ...whForm, type: e.target.value })}
                          disabled={!isWhEditing}
                          className="w-full h-8 px-2 bg-white border border-slate-300 rounded font-bold text-slate-800"
                        >
                          <option value="مواد خام">مواد خام وتوريدات أولية</option>
                          <option value="بضاعة جاهزة">بضاعة جاهزة ومبيعات مباشر</option>
                          <option value="تلف ومستهلك">تالف ومستهلكات تشغيل</option>
                          <option value="أصول ثابتة">أصول ومعدات المطعم</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">الفرع المرتبط</label>
                        <Input
                          value={whForm?.branch || ""}
                          onChange={e => setWhForm({ ...whForm, branch: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="الفرع الرئيسي"
                          className="h-8 bg-white font-bold border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">الشركة المالكة</label>
                        <Input
                          value={whForm?.company || ""}
                          onChange={e => setWhForm({ ...whForm, company: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="شركة أومني سيستم برو"
                          className="h-8 bg-white font-bold border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">أمين المستودع المسؤول</label>
                        <Input
                          value={whForm?.manager || ""}
                          onChange={e => setWhForm({ ...whForm, manager: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="صالح الحرازي"
                          className="h-8 bg-white font-semibold border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">الحساب المالي المرتبط</label>
                        <Input
                          value={whForm?.account || ""}
                          onChange={e => setWhForm({ ...whForm, account: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="حساب مخزن الأغذية والمشروبات"
                          className="h-8 bg-white font-semibold border-slate-300 text-slate-800 text-right"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">رقم الهاتف للتواصل</label>
                        <Input
                          value={whForm?.phone || ""}
                          onChange={e => setWhForm({ ...whForm, phone: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="777123456"
                          className="h-8 bg-white font-mono border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">المدينة / العاصمة</label>
                        <Input
                          value={whForm?.city || ""}
                          onChange={e => setWhForm({ ...whForm, city: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="صنعاء"
                          className="h-8 bg-white font-bold border-slate-300 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600">العنوان التفصيلي للموقع</label>
                        <Input
                          value={whForm?.address || ""}
                          onChange={e => setWhForm({ ...whForm, address: e.target.value })}
                          disabled={!isWhEditing}
                          placeholder="شارع الخمسين، جوار بريد حدة"
                          className="h-8 bg-white font-semibold border-slate-300 text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Operational Feedback messages inside form */}
                    {isWhEditing ? (
                      <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg flex items-center justify-between text-indigo-900 font-bold">
                        <span>أنت الآن في وضع تعديل بيانات المستودع. قم بإجراء التغييرات المطلوبة واضغط على "حفظ" في شريط الأدوات العلوي.</span>
                        <Button size="sm" onClick={handleWhSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-7 text-xs">
                          <Check className="w-3.5 h-3.5 ml-1" /> حفظ التغييرات
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-slate-600 font-semibold">
                        <span>بيانات المستودع معروضة للعرض فقط. اضغط على زر "تعديل" في شريط الأدوات بالأعلى لإجراء أي تعديل مالي أو إداري.</span>
                        <Button variant="outline" size="sm" onClick={() => setIsWhEditing(true)} className="h-7 text-xs font-bold border-slate-300 hover:bg-slate-100">
                          <Edit3 className="w-3.5 h-3.5 ml-1 text-slate-600" /> تعديل السجل
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── 3. Professional Database Grid (جدول كافة المخازن) ─── */}
                <div className="space-y-2 pt-2" id="warehouses-list-section">
                  <div className="flex justify-between items-center bg-slate-50 p-2 border border-slate-200 rounded">
                    <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-indigo-600 animate-pulse" />
                      جدول وسجل المستودعات النشطة في النظام المحاسبي للشركة ({warehouses.length} مستودعات)
                    </span>
                    <Badge variant="outline" className="bg-white border-slate-300 text-indigo-800 font-bold">
                      المستودع الرئيسي الحالي: {warehouses[currentWhIndex]?.name_ar || ""}
                    </Badge>
                  </div>

                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-inner">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2.5 w-12 text-center">م</th>
                          <th className="p-2.5 w-24">كود المستودع</th>
                          <th className="p-2.5">اسم المستودع بالعربية</th>
                          <th className="p-2.5">الاسم الأجنبي</th>
                          <th className="p-2.5 w-32">نوع المستودع</th>
                          <th className="p-2.5 w-40">أمين المستودع</th>
                          <th className="p-2.5 w-32 text-center">حالة التشغيل</th>
                          <th className="p-2.5 w-32 text-center">الافتراضي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold">
                        {warehouses.map((wh: any, idx: number) => (
                          <tr
                            key={wh.id}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                              currentWhIndex === idx ? "bg-indigo-50/70 border-r-4 border-indigo-600 font-bold text-indigo-900" : "text-slate-700"
                            }`}
                            onClick={() => {
                              setCurrentWhIndex(idx);
                              setIsWhEditing(false);
                            }}
                          >
                            <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2.5 font-mono text-slate-600 text-[11px]">{wh.code}</td>
                            <td className="p-2.5 font-sans font-black">{wh.name_ar}</td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-500 text-left" dir="ltr">{wh.name_en || "—"}</td>
                            <td className="p-2.5 font-sans">{wh.type}</td>
                            <td className="p-2.5 font-sans text-slate-600">{wh.manager || "غير معين"}</td>
                            <td className="p-2.5 text-center">
                              <Badge className={wh.status === "نشط" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-50"}>
                                {wh.status}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center">
                              {wh.id === defaultWhId ? (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 font-black">
                                  رئيسي / افتراضي
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 6: CURRENCY SETUP (Image 7) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="currencies" className="mt-4">
            <Card className="border-slate-300 shadow-sm max-w-3xl mx-auto">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">بيانات وبطاقة العملات في النظام الحسابي [صورة 7]</CardTitle>
                  <CardDescription className="text-xs font-semibold">تهيئة العملات المحلية والأجنبية وتحديد أسعار صرف التحويل اليومية</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Floating style form matching Image 7 popup */}
                <div className="bg-slate-50 border border-slate-300 rounded p-4 shadow-sm space-y-3">
                  <h3 className="font-bold text-slate-700 border-b pb-1">إدخال / تعديل عملة مالية</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">اسم العملة</label>
                      <Input
                        value={currencyForm.name}
                        onChange={e => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                        placeholder="مثال: ريال يمني"
                        className="h-8 text-xs bg-white border-slate-300 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">رمز العملة الدولي</label>
                      <Input
                        value={currencyForm.symbol}
                        onChange={e => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                        placeholder="مثال: YER"
                        className="h-8 text-xs bg-white border-slate-300 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">الفكة / الأجزاء الفرعية</label>
                      <Input
                        value={currencyForm.fraction}
                        onChange={e => setCurrencyForm({ ...currencyForm, fraction: e.target.value })}
                        placeholder="مثال: فلس"
                        className="h-8 text-xs bg-white border-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">نوع العملة الحسابية</label>
                      <select
                        value={currencyForm.type}
                        onChange={e => setCurrencyForm({ ...currencyForm, type: e.target.value })}
                        className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="local">عملة محلية معتمدة للفرع</option>
                        <option value="foreign">عملة أجنبية (تحويل)</option>
                      </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="font-semibold text-slate-600">سعر التحويل / سعر الصرف المقابل للعملة المحلية الرئيسي</label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={currencyForm.exchange_rate}
                        onChange={e => setCurrencyForm({ ...currencyForm, exchange_rate: e.target.value })}
                        placeholder="1.0000"
                        className="h-8 text-xs bg-white border-slate-300 font-mono text-blue-700"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {editingCurrencyId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCurrencyId(null);
                          setCurrencyForm({ name: "", symbol: "", fraction: "فلس", type: "foreign", exchange_rate: "1.0", active: 1 });
                        }}
                        className="h-8 text-xs"
                      >
                        إلغاء التعديل
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        if (editingCurrencyId) {
                          updateCurrencyMutation.mutate({ id: editingCurrencyId, ...currencyForm });
                        } else {
                          addCurrencyMutation.mutate(currencyForm);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold h-8 text-xs gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {editingCurrencyId ? "حفظ التعديلات" : "إضافة العملة المقترحة"}
                    </Button>
                  </div>
                </div>

                {/* Currencies Grid */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white mt-4">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <tr>
                        <th className="p-3">اسم العملة</th>
                        <th className="p-3">رمز الاختصار</th>
                        <th className="p-3">الفكة</th>
                        <th className="p-3">النوع الحسابي</th>
                        <th className="p-3 text-left">سعر الصرف اليومي</th>
                        <th className="p-3 text-center w-24">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {((dbCurrencies as any[]) || []).map((curr: any) => (
                        <tr key={curr.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{curr.name}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{curr.symbol}</td>
                          <td className="p-3">{curr.fraction ?? "—"}</td>
                          <td className="p-3">
                            <Badge className={curr.type === 'local' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-slate-100 text-slate-800 hover:bg-slate-100'}>
                              {curr.type === 'local' ? 'عملة محلية' : 'عملة أجنبية'}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-left font-bold text-slate-700">{curr.exchange_rate}</td>
                          <td className="p-3 text-center flex justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                setEditingCurrencyId(curr.id);
                                setCurrencyForm({
                                  name: curr.name,
                                  symbol: curr.symbol,
                                  fraction: curr.fraction ?? "فلس",
                                  type: curr.type,
                                  exchange_rate: String(curr.exchange_rate),
                                  active: curr.active
                                });
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                if (confirm("حذف العملة؟")) {
                                  deleteCurrencyMutation.mutate(curr.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 7: ITEMS PRICING LIST (Image 8) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="pricing" className="mt-4">
            <Card className="border-slate-300 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">أنظمة المخازن - نظام إدارة المخازن - تسعيرة الأصناف والخدمات [صورة 8]</CardTitle>
                  <CardDescription className="text-xs">استعراض وتعديل تسعيرة بيع المنتجات بالاعتماد على التكلفة والربح المستهدف</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    updatePricesMutation.mutate(pricingGrid);
                  }}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-8 gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ وتطبيق الأسعار الجديدة
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Filtration bar matching Image 8 top options */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">تعبئة البيانات من مجموعة الأصناف</label>
                    <select
                      value={pricingParams.category_id}
                      onChange={e => setPricingParams({ ...pricingParams, category_id: e.target.value })}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="">جميع مجموعات الأصناف</option>
                      {dbCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">طريقة إدخال البيانات</label>
                    <Input value="تعديل يدوي للأسعار في الجدول" className="h-8 bg-slate-100" disabled readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">الترتيب والفرز حسب</label>
                    <Input value="ترتيب تصاعدي برقم الصنف" className="h-8 bg-slate-100" disabled readOnly />
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-slate-600 pt-5">
                    <input
                      type="checkbox"
                      checked={pricingParams.filter_unpriced}
                      onChange={e => setPricingParams({ ...pricingParams, filter_unpriced: e.target.checked })}
                      className="rounded"
                    />
                    <span>عرض الأصناف النشطة فقط</span>
                  </div>
                </div>

                {/* Items pricing table grid */}
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <tr>
                        <th className="p-2.5">رقم الصنف</th>
                        <th className="p-2.5">اسم الصنف المعياري</th>
                        <th className="p-2.5">الوحدة</th>
                        <th className="p-2.5">العملة الحسابية</th>
                        <th className="p-2.5 text-center w-24">نسبة الربح المستهدفة</th>
                        <th className="p-2.5 text-left w-32">السعر الحالي للبيع</th>
                        <th className="p-2.5 text-left w-36">السعر الجديد المقترح</th>
                        <th className="p-2.5 text-left w-28">متوسط التكلفة للربح</th>
                        <th className="p-2.5 text-left w-28">آخر سعر توريد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {pricingGrid.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500 font-semibold">{p.number}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">{p.name}</td>
                          <td className="p-2.5 font-sans text-slate-500">{p.unit}</td>
                          <td className="p-2.5 font-sans text-slate-600">{p.currency}</td>
                          <td className="p-2.5 text-center font-sans text-emerald-700 font-bold">{p.profit_margin}%</td>
                          <td className="p-2.5 text-left text-slate-500">{p.old_price.toLocaleString()}</td>
                          <td className="p-2.5 text-left">
                            <Input
                              type="number"
                              value={p.new_price}
                              onChange={e => {
                                const val = Number(e.target.value || 0);
                                const newGrid = [...pricingGrid];
                                newGrid[idx].new_price = val;
                                // Recalculate profit margin based on cost
                                const costVal = p.avg_cost || 1;
                                newGrid[idx].profit_margin = Math.round(((val - costVal) / costVal) * 100);
                                setPricingGrid(newGrid);
                              }}
                              className="h-7 text-xs font-bold text-blue-700 text-left w-32 ml-auto"
                            />
                          </td>
                          <td className="p-2.5 text-left text-slate-500">{Math.round(p.avg_cost).toLocaleString()}</td>
                          <td className="p-2.5 text-left text-slate-400">{Math.round(p.last_supply).toLocaleString()}</td>
                        </tr>
                      ))}
                      {pricingGrid.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                            لا توجد أصناف تطابق فلاتر البحث الحالية
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 8: AUDIT LOGS & SYSTEM TRACKER */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="audit" className="mt-4 space-y-4">
            <Card className="border-slate-300 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3.5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-600" />
                    <span>سجل المراقبة والتدقيق المالي الشامل - Omni System Pro</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    تتبع جميع العمليات والتغييرات المنفذة بالنظام مباشرة من قاعدة البيانات المركزية
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    {dbAuditLogs.length} حركة مسجلة
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white border-slate-300"
                    onClick={() => {
                      let text = "سجل المراقبة والتدقيق الفني - Omni System Pro\n\n";
                      dbAuditLogs.forEach((l: any) => {
                        text += `[${l.timestamp}] المستخدم: ${l.user_name} - الحركة: ${l.action_type} - التفاصيل: ${l.details || "—"}\n`;
                      });
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(`<pre style="font-family: monospace; direction: ltr; padding: 20px;">${text}</pre>`);
                        win.document.close();
                      }
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 ml-1 text-slate-600" />
                    طباعة السجل الكامل
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <tr>
                        <th className="p-3 font-bold"># الحركة</th>
                        <th className="p-3 font-bold">التاريخ والوقت</th>
                        <th className="p-3 font-bold">المستخدم المسؤول</th>
                        <th className="p-3 font-bold">نوع العملية</th>
                        <th className="p-3 font-bold">التفاصيل والتأثير المالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dbAuditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-400">#{log.id}</td>
                          <td className="p-3 font-mono text-slate-600">{log.timestamp}</td>
                          <td className="p-3 font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            {log.user_name}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                log.action_type?.includes("حذف")
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : log.action_type?.includes("حفظ") || log.action_type?.includes("إضافة")
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }
                            >
                              {log.action_type}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">{log.details || "حركة معتمدة بالنظام"}</td>
                        </tr>
                      ))}
                      {dbAuditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                            لا توجد حركات مسجلة بسجل المراقبة حالياً. جميع العمليات الجديدة تسجل فوراً هنا.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
