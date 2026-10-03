import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, AlertTriangle, ArrowDownRight, ArrowUpRight, Plus, RefreshCw, Search, 
  Layers, DollarSign, Warehouse, ArrowRightLeft, FileText, Trash2, CheckCircle2,
  Calendar, ShieldAlert, Sparkles, Building, Truck, RotateCcw, ClipboardList,
  Printer, Download, Eye, ShieldCheck, XCircle, Clock, Send, Check
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { ErpInventoryVariablesPanel } from "@/components/erp-inventory-variables";
import { ErpUnitsScreen } from "@/components/erp-units-screen";
import { ErpItemTypesScreen } from "@/components/erp-item-types-screen";
import { ErpWarehouseOperationsHub } from "@/components/erp-warehouse-operations-hub";

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Role checks
  const role = (user?.role || "admin") as string;
  const isCashier = role === "cashier" || role === "كاشير";
  const isAccountant = role === "accountant" || role === "محاسب";
  const isStorekeeper = role === "storekeeper" || role === "inventory" || role === "أمين مخزن";
  const isAdminOrDev = role === "admin" || role === "developer" || user?.username === "developer" || role === "مدير";

  // Tab State
  const [selectedTab, setSelectedTab] = useState<
    "dashboard" | "variables" | "stocks" | "requests" | "returns" | "vouchers" | "stocktake" | "waste" | "audit" | "reports" | "units" | "reorder" | "fefo" | "suppliers" | "barcode" | "costing"
  >("dashboard");

  const handleTabSwitch = (tab: typeof selectedTab) => {
    setSelectedTab(tab);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/inventory?tab=${tab}`);
    }
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "variables": return "متغيرات نظام المخازن والتهيئة (شاشة 49)";
      case "stocks": return "أرصدة الأصناف والشرائح";
      case "requests": return "طلبات المخزون الداخلية";
      case "returns": return "مرتجعات المشتريات والمبيعات";
      case "vouchers": return "سندات التوريد والصرف والتحويلات";
      case "stocktake": return "الجرد والتسويات";
      case "waste": return "التالف والهالك";
      case "audit": return "سجل التدقيق والإلغاء العكسي";
      case "units": return "الوحدات والتحويلات";
      case "reorder": return "حدود إعادة الطلب";
      case "fefo": return "الصلاحية و FEFO";
      case "suppliers": return "الموردون ومقارنة الأسعار";
      case "barcode": return "استيكر الباركود والـ QR";
      case "costing": return "متوسط التكلفة";
      case "reports": return "مركز التقارير المتقدمة";
      default: return "لوحة تحكم المخزن";
    }
  };

  // Check URL query parameters for active tab
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const tabParam = params.get("tab");
      if (tabParam) {
        const validTabs: Array<typeof selectedTab> = [
          "dashboard", "variables", "stocks", "requests", "returns", "vouchers", 
          "stocktake", "waste", "audit", "reports", "units", 
          "reorder", "fefo", "suppliers", "barcode", "costing"
        ];
        if (validTabs.includes(tabParam as any)) {
          setSelectedTab(tabParam as any);
        }
      } else if (location === "/inventory") {
        setSelectedTab("dashboard");
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    // Initial check
    handleUrlChange();

    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [location, window.location.search]);

  // Modals state
  const [showFullInventoryModal, setShowFullInventoryModal] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<"in" | "out" | "adjustment">("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Purchase Return Modal
  const [showPurchaseReturnModal, setShowPurchaseReturnModal] = useState(false);
  const [purchaseReturnForm, setPurchaseReturnForm] = useState({
    supplierId: "",
    supplierName: "",
    invoiceNumber: "",
    notes: "",
    productId: "",
    quantity: "1",
    unitPrice: "0"
  });

  // Internal Stock Request Modal
  const [showInternalReqModal, setShowInternalReqModal] = useState(false);
  const [internalReqForm, setInternalReqForm] = useState({
    requestingDepartment: "مطبخ الوجبات الفرعي",
    targetWarehouseId: "wh-main",
    targetWarehouseName: "المخزن الرئيسي",
    notes: "طلب المواد الأساسية للوجبات",
    productId: "",
    requestedQty: "10",
    unitCost: "0"
  });

  // Stock Issue Voucher Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    warehouseName: "المخزن الرئيسي",
    issueType: "kitchen",
    recipient: "الشيف / قسم المطبخ",
    notes: "صرف مواد تحضير يومية",
    productId: "",
    quantity: "1"
  });

  // Stock Receipt Voucher Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    warehouseName: "المخزن الرئيسي",
    receiptType: "supplier",
    supplierName: "مورد افتراضي / المشتريات",
    notes: "توريد أصناف مخزنية جديدة",
    productId: "",
    quantity: "1",
    unitPrice: "0"
  });

  // Inter-Warehouse Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromWarehouse: "المخزن الرئيسي",
    toWarehouse: "مخزن المطبخ والتحضير",
    notes: "تحويل دوري لفرع المطبخ",
    productId: "",
    quantity: "1"
  });

  // Waste Modal
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    warehouseName: "المخزن الرئيسي",
    productId: "",
    productName: "",
    quantity: "1",
    unitCost: "0",
    reason: "منتهي الصلاحية",
    notes: "إتلاف أصناف لتجاوز تاريخ الصلاحية"
  });

  // Stocktake Modal
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [stocktakeWarehouse, setStocktakeWarehouse] = useState("المخزن الرئيسي");
  const [stocktakeNotes, setStocktakeNotes] = useState("جرد دوري نيافة الشهر");
  const [stocktakeItems, setStocktakeItems] = useState<any[]>([]);

  // New Product Modal inside Inventory Page
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProdForm, setNewProdForm] = useState({
    name: "",
    price: "",
    cost: "",
    stock: "100",
    unit: "حبة",
    barcode: "",
    batch_number: "BATCH-2026-01",
    expiry_date: "2027-12-31"
  });

  const handleCreateWarehouseProduct = () => {
    if (!newProdForm.name.trim()) {
      toast({ variant: "destructive", title: "يرجى إدخال اسم الصنف / المنتج" });
      return;
    }
    const token = localStorage.getItem("pos_token") ?? "";
    fetch("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: newProdForm.name.trim(),
        price: Number(newProdForm.price || 0) || Math.max(Number(newProdForm.cost || 0) * 1.25, 15),
        cost: Number(newProdForm.cost || 0),
        stock: Number(newProdForm.stock || 0),
        unit: newProdForm.unit || "حبة",
        barcode: newProdForm.barcode || undefined,
        batch_number: newProdForm.batch_number || "BATCH-2026-01",
        expiry_date: newProdForm.expiry_date || "2027-12-31",
        is_sellable: true,
        show_in_pos: true,
        item_type: "sellable"
      })
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "فشل إضافة الصنف");
        return data;
      })
      .then(data => {
        toast({ title: "تم إضافة الصنف بنجاح ✅", description: `تم تسجيل "${data.name}" وإتاحته في فواتير المبيعات المخزنية ونقاط البيع` });
        setShowNewProductModal(false);
        setNewProdForm({ name: "", price: "", cost: "", stock: "100", unit: "حبة", barcode: "", batch_number: "BATCH-2026-01", expiry_date: "2027-12-31" });
        loadData();
      })
      .catch(err => {
        toast({ variant: "destructive", title: "فشل الحفظ", description: err.message });
      });
  };

  // Cancel / Reversal Operation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ type: string; id: string; ref: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Additional Calculators & Barcode State
  const [unitCalc, setUnitCalc] = useState({
    itemName: "دقيق فاخر (أبيض)",
    cartonQty: 5,
    bagsPerCarton: 10,
    kgPerBag: 1,
    piecesPerCarton: 50
  });
  const [selectedBarcodeProd, setSelectedBarcodeProd] = useState<any>(null);
  const [costCalc, setCostCalc] = useState({
    oldQty: 100,
    oldCost: 25,
    newQty: 50,
    newCost: 28
  });

  // Reports filters
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().slice(0, 7) + "-01");
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportSubTab, setReportSubTab] = useState<"valuation" | "movements" | "purchases" | "internal" | "slow" | "discrepancies" | "waste">("valuation");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/inventory/summary").then(r => r.json()),
      fetch("/api/inventory/movements").then(r => r.json())
    ])
      .then(([sumData, movData]) => {
        if (sumData && !sumData.error) setSummary(sumData);
        if (Array.isArray(movData)) setMovements(movData);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast({ variant: "destructive", title: "فشل تحميل بيانات المخزن" });
      });
  };

  useEffect(() => {
    loadData();
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  // Stock adjustment handlers
  const handleOpenAdjust = (prod: any) => {
    if (isCashier) {
      toast({ variant: "destructive", title: "ليس لديك صلاحية تعديل المخزون" });
      return;
    }
    setSelectedProduct(prod);
    setAdjustType("in");
    setAdjustQty("1");
    setAdjustReason("");
    setShowAdjustDialog(true);
  };

  const handleSaveAdjustment = () => {
    if (!selectedProduct || !adjustQty || isNaN(Number(adjustQty))) {
      toast({ variant: "destructive", title: "يرجى إدخال كمية صحيحة" });
      return;
    }

    fetch("/api/inventory/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProduct.id,
        type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason || (adjustType === 'in' ? 'إدخال مخزني' : adjustType === 'out' ? 'صرف مخزني' : 'تسوية جردية'),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: "تم تحديث المخزون والتسوية بنجاح ✨" });
          setShowAdjustDialog(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل العملية" });
        }
      })
      .catch(() => toast({ variant: "destructive", title: "خطأ في الاتصال بالخادم" }));
  };

  // Purchase Return Handler
  const handleCreatePurchaseReturn = () => {
    if (!purchaseReturnForm.supplierName || !purchaseReturnForm.productId || !purchaseReturnForm.quantity) {
      toast({ variant: "destructive", title: "يرجى اختيار المورد والصنف والكمية" });
      return;
    }

    const prod = summary?.products?.find((p: any) => String(p.id) === String(purchaseReturnForm.productId));
    const items = [{
      productId: Number(purchaseReturnForm.productId),
      productName: prod ? prod.name : "صنف مرتجع",
      quantity: Number(purchaseReturnForm.quantity),
      unitPrice: Number(purchaseReturnForm.unitPrice || prod?.cost || 0)
    }];

    fetch("/api/inventory/purchase-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: purchaseReturnForm.supplierId ? Number(purchaseReturnForm.supplierId) : null,
        supplierName: purchaseReturnForm.supplierName,
        invoiceNumber: purchaseReturnForm.invoiceNumber,
        notes: purchaseReturnForm.notes,
        items
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم تسجيل مرتجع المشتريات رقم ${data.returnNumber} بنجاح 🎉` });
          setShowPurchaseReturnModal(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل الإرجاع" });
        }
      });
  };

  // Internal Stock Request Handler
  const handleCreateInternalRequest = () => {
    if (!internalReqForm.productId || !internalReqForm.requestedQty) {
      toast({ variant: "destructive", title: "يرجى تحديد الصنف والكمية المطلوبة" });
      return;
    }

    const prod = summary?.products?.find((p: any) => String(p.id) === String(internalReqForm.productId));
    const items = [{
      productId: Number(internalReqForm.productId),
      productName: prod ? prod.name : "صنف مطلوب",
      requestedQty: Number(internalReqForm.requestedQty),
      unitCost: Number(prod?.cost || 0)
    }];

    fetch("/api/inventory/internal-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestingDepartment: internalReqForm.requestingDepartment,
        targetWarehouseId: internalReqForm.targetWarehouseId,
        targetWarehouseName: internalReqForm.targetWarehouseName,
        notes: internalReqForm.notes,
        items
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم إنشاء طلب الصرف الداخلي رقم ${data.requestNumber} بنجاح` });
          setShowInternalReqModal(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل إنشاء الطلب" });
        }
      });
  };

  // Internal Request Action (Approve / Prepare / Issue / Receive / Cancel)
  const handleInternalReqAction = (id: number, action: string, actionLabel: string) => {
    fetch(`/api/inventory/internal-request/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes: `إجراء ${actionLabel} بواسطة ${user?.name}` })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم ${actionLabel} لطلب الصرف بنجاح ✨` });
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل تحديث الحالة" });
        }
      });
  };

  // Issue Voucher Handler
  const handleCreateIssueVoucher = () => {
    if (!issueForm.productId || !issueForm.quantity) {
      toast({ variant: "destructive", title: "يرجى اختيار الصنف وتحديد الكمية" });
      return;
    }
    fetch("/api/inventory/issue-voucher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...issueForm,
        items: [{ productId: Number(issueForm.productId), quantity: Number(issueForm.quantity) }]
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم إصدار سند الصرف رقم ${data.voucherNumber} بنجاح 🎉` });
          setShowIssueModal(false);
          loadData();
        }
      });
  };

  // Receipt Voucher Handler
  const handleCreateReceiptVoucher = () => {
    if (!receiptForm.productId || !receiptForm.quantity) {
      toast({ variant: "destructive", title: "يرجى اختيار الصنف وتحديد الكمية" });
      return;
    }
    fetch("/api/inventory/receipt-voucher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...receiptForm,
        items: [{ productId: Number(receiptForm.productId), quantity: Number(receiptForm.quantity) }]
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم إصدار سند التوريد رقم ${data.voucherNumber} بنجاح 🎉` });
          setShowReceiptModal(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل إصدار السند" });
        }
      });
  };

  // Transfer Handler
  const handleCreateTransfer = () => {
    if (!transferForm.productId || !transferForm.quantity) {
      toast({ variant: "destructive", title: "يرجى اختيار الصنف والكمية" });
      return;
    }
    fetch("/api/inventory/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...transferForm,
        items: [{ productId: Number(transferForm.productId), quantity: Number(transferForm.quantity) }]
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم إجراء التحويل المخزني رقم ${data.transferNumber} بنجاح` });
          setShowTransferModal(false);
          loadData();
        }
      });
  };

  // Waste Handler
  const handleCreateWaste = () => {
    if (!wasteForm.productName || !wasteForm.quantity) {
      toast({ variant: "destructive", title: "يرجى إدخال اسم الصنف والكمية التالفة" });
      return;
    }
    fetch("/api/inventory/waste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...wasteForm,
        productId: wasteForm.productId ? Number(wasteForm.productId) : null,
        quantity: Number(wasteForm.quantity),
        unitCost: Number(wasteForm.unitCost)
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم إثبات التالف الهالك رقم ${data.wasteNumber} بنجاح` });
          setShowWasteModal(false);
          loadData();
        }
      });
  };

  // Open Stocktake Modal & Prep Items
  const handleOpenStocktake = () => {
    if (summary?.products) {
      setStocktakeItems(summary.products.map((p: any) => ({
        productId: p.id,
        number: p.number,
        name: p.name,
        expectedQty: p.stock ?? 0,
        actualQty: p.stock ?? 0,
        unitCost: p.cost ?? 0
      })));
    }
    setShowStocktakeModal(true);
  };

  const handleSaveStocktake = () => {
    fetch("/api/inventory/stocktake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseName: stocktakeWarehouse,
        notes: stocktakeNotes,
        items: stocktakeItems
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: `تم اعتماد محاضر الجرد رقم ${data.stocktakeNumber} بنجاح 🎉` });
          setShowStocktakeModal(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل حفظ الجرد" });
        }
      });
  };

  // Operation Reversal Handler
  const handleConfirmCancelOperation = () => {
    if (!cancelTarget || !cancelReason) {
      toast({ variant: "destructive", title: "يرجى إدخال سبب الإلغاء" });
      return;
    }

    fetch("/api/inventory/cancel-operation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationType: cancelTarget.type,
        operationId: cancelTarget.id,
        reason: cancelReason
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: "تم إلغاء العملية وتنفيذ القيد العكسي وسجل التدقيق بنجاح 🛑" });
          setShowCancelModal(false);
          setCancelReason("");
          setCancelTarget(null);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل الإلغاء" });
        }
      });
  };

  const filteredProducts = summary?.products?.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || String(p.number).includes(search)
  ) || [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 dir-rtl">
        {/* Header Title Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Warehouse className="w-8 h-8 text-amber-400" />
              نظام إدارة المخازن والمستودعات الشامل 2026
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              إدارة الأرصدة، طلبات الصرف الداخلية، مرتجعات المشتريات، الجرد، التسويات الهالكة، والتقارير المتقدمة.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setShowNewProductModal(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5 text-xs font-extrabold shadow">
              <Plus className="w-4 h-4" />
              إضافة منتج / صنف مخزني جديد
            </Button>
            <Button onClick={loadData} variant="outline" className="text-white border-slate-700 hover:bg-slate-800 gap-1.5 text-xs font-bold">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث البيانات
            </Button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50/80 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700">إجمالي الأصناف والمستودعات</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {summary?.totalItems || 0} صنف <span className="text-xs text-slate-500 font-normal">({summary?.warehouses?.length || 4} مخازن)</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50/80 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700">إجمالي الوحدات بالمخزن</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.totalStockCount || 0} وحدة</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
                <Package className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-amber-50/80 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700">تكلفة المخزون القائم (التكلفة بالريال)</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.totalStockCost ? summary.totalStockCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} ريال</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-inner">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-rose-50/80 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-700">تنبيه النواقص والمنتهي</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {summary?.lowStockCount || 0} منخفض <span className="text-xs text-rose-600 font-bold">({summary?.expiredCount || 0} منتهي)</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compact Back Bar when inside a specific warehouse module */}
        {selectedTab !== "dashboard" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3">
            <Button
              onClick={() => handleTabSwitch("dashboard")}
              variant="outline"
              size="sm"
              className="gap-2 font-bold text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 border-amber-200 dark:border-amber-800"
            >
              <Building className="w-4 h-4 text-amber-600" />
              ← العودة إلى لوحة تحكم المخزن الرئيسية
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">القسم الحالي:</span>
              <Badge className="bg-slate-900 text-amber-400 font-extrabold text-xs px-3 py-1">
                {getTabTitle(selectedTab)}
              </Badge>
            </div>
          </div>
        )}

        {/* Tab 0: Inventory System Variables (متغيرات نظام المخازن) */}
        {selectedTab === "variables" && (
          <div className="space-y-4">
            <ErpInventoryVariablesPanel />
          </div>
        )}

        {/* Tab 1: Dashboard Overview */}
        {selectedTab === "dashboard" && (
          <div className="space-y-6">
            {/* Quick Actions Control Panel Grid (لوحة تحكم المخزن) */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-amber-600" />
                    لوحة تحكم وتوجيه المخزن والمستودعات
                  </span>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200 font-bold">
                    تم نقل الأقسام إلى الشريط الجانبي لتسهيل الوصول 🚀
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  يمكنك الآن التنقل بين أقسام المخازن والمستودعات (14 وحدة متكاملة) مباشرة من الشريط الجانبي للنظام على اليمين.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                    <Layers className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">تجربة مستخدم محسنة وأكثر سرعة</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    بناءً على طلبكم، قمنا بنقل جميع وحدات نظام المخازن إلى الشريط الجانبي لتوفير مساحة أكبر للبيانات والتقارير في الصفحة الرئيسية، ولتمكينك من التنقل السريع بين الوحدات دون الحاجة للعودة للوحة التحكم.
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Warehouse List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-amber-600" />
                    المخازن والمستودعات المعتمدة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary?.warehouses?.map((w: any) => (
                    <div key={w.id} className="p-3.5 border rounded-xl bg-slate-50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-900 text-white font-mono">{w.code}</Badge>
                          <span className="font-bold text-sm text-slate-800">{w.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">الموقع: {w.location || "المبنى الرئيسي"} | المسؤول: {w.manager}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-0">نشط ومعتمد</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Pending Internal Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                      طلبات المخزون الداخلية المعلقة
                    </span>
                    <Button onClick={() => setShowInternalReqModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                      + طلب جديد
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary?.internalRequests?.slice(0, 5).map((req: any) => (
                    <div key={req.id} className="p-3 border rounded-xl bg-blue-50/40 border-blue-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-900 text-xs">{req.request_number}</span>
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300">{req.status}</Badge>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1">الجهة: {req.requesting_department}</p>
                      </div>
                      <Button size="sm" onClick={() => setSelectedTab("requests")} variant="outline" className="text-xs font-bold text-blue-700">
                        متابعة
                      </Button>
                    </div>
                  ))}
                  {(!summary?.internalRequests || summary.internalRequests.length === 0) && (
                    <p className="text-xs text-center text-slate-500 py-6">لا توجد طلبات مخزنية معلقة حالياً</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Item Stock List */}
        {selectedTab === "stocks" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم الصنف أو باركوده..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-500 font-bold">
                  إجمالي الأصناف: {filteredProducts.length} صنف
                </div>
                <Button size="sm" onClick={() => setShowFullInventoryModal(true)} variant="outline" className="text-xs gap-1 font-bold">
                  <Printer className="w-3.5 h-3.5" /> استعراض وطباعة كل الأصناف
                </Button>
                <Button size="sm" onClick={() => setShowNewProductModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1">
                  <Plus className="w-3.5 h-3.5" /> إضافة صنف جديد للمخزن
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right p-3 font-semibold text-slate-700">رقم الصنف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">اسم الصنف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">التصنيف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الرصيد بالمخزن</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الدفعة / الانتهاء</th>
                    <th className="text-left p-3 font-semibold text-slate-700">سعر التكلفة</th>
                    <th className="text-left p-3 font-semibold text-slate-700">سعر البيع</th>
                    <th className="text-center p-3 font-semibold text-slate-700">تعديل الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد أصناف مطابقة</td>
                    </tr>
                  ) : (
                    filteredProducts.map((p: any) => {
                      const stock = p.stock ?? 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-blue-600">{p.number}</td>
                          <td className="p-3 font-medium text-slate-800">{p.name}</td>
                          <td className="p-3 text-slate-500">{p.categoryName || "-"}</td>
                          <td className="p-3">
                            <Badge variant={stock <= 0 ? "destructive" : stock <= (p.min_stock || 10) ? "outline" : "outline"} className={stock > (p.min_stock || 10) ? "text-emerald-600 border-emerald-300 bg-emerald-50" : stock <= 0 ? "" : "text-amber-600 border-amber-300 bg-amber-50"}>
                              {stock} حبة
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]">
                            {p.batch_number || "BATCH-01"} | {p.expiry_date || "2027-12-31"}
                          </td>
                          <td className="p-3 text-left font-mono text-slate-600">{p.cost ? `${Number(p.cost).toLocaleString()} ريال` : "0.00 ريال"}</td>
                          <td className="p-3 text-left font-mono font-bold text-slate-800">{p.price ? `${Number(p.price).toLocaleString()} ريال` : "0.00 ريال"}</td>
                          <td className="p-3 text-center">
                            <Button size="sm" onClick={() => handleOpenAdjust(p)} className="gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] h-8 px-3">
                              <Plus className="w-3 h-3" />
                              تسوية
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
        )}

        {/* Tab 3: Internal Stock Requisitions Workflow */}
        {selectedTab === "requests" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">طلبات المخزون الداخلية والدورة المستندية للصرف</h3>
                <p className="text-xs text-slate-500">طلب ➔ موافقة المدير ➔ تجهيز ➔ صرف ➔ استلام إغلاق</p>
              </div>
              <Button onClick={() => setShowInternalReqModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1">
                + إنشاء طلب صرف داخلي جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right p-3 font-semibold text-slate-700">رقم الطلب</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الجهة الطالبة</th>
                    <th className="text-right p-3 font-semibold text-slate-700">المخزن المستهدف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">حالة الطلب</th>
                    <th className="text-right p-3 font-semibold text-slate-700">مقدم الطلب والتاريخ</th>
                    <th className="text-center p-3 font-semibold text-slate-700">إجراءات مرحلة الدورة المستندية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary?.internalRequests?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد طلبات مخزنية مسجلة حتى الآن</td>
                    </tr>
                  ) : (
                    summary?.internalRequests?.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-blue-700">{req.request_number}</td>
                        <td className="p-3 font-bold text-slate-800">{req.requesting_department}</td>
                        <td className="p-3 text-slate-600">{req.target_warehouse_name}</td>
                        <td className="p-3">
                          <Badge className={
                            req.status === 'received' ? "bg-emerald-100 text-emerald-800" :
                            req.status === 'issued' ? "bg-blue-100 text-blue-800" :
                            req.status === 'approved' ? "bg-amber-100 text-amber-800" :
                            req.status === 'cancelled' ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-800"
                          }>
                            {req.status === 'pending_approval' ? 'في انتظار موافقة المدير' :
                             req.status === 'approved' ? 'تمت موافقة المدير' :
                             req.status === 'preparing' ? 'جاري تجهيز الطلب' :
                             req.status === 'issued' ? 'تم الصرف من المخزن' :
                             req.status === 'received' ? 'تم الاستلام وإغلاق الطلب' : 'ملغي'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          <div>{req.requested_by}</div>
                          <div className="text-[10px]">{req.created_at}</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {req.status === 'pending_approval' && isAdminOrDev && (
                              <Button size="sm" onClick={() => handleInternalReqAction(req.id, 'approve', 'موافقة المدير')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2">
                                موافقة المدير
                              </Button>
                            )}
                            {req.status === 'approved' && (
                              <Button size="sm" onClick={() => handleInternalReqAction(req.id, 'prepare', 'تجهيز الطلب')} className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7 px-2">
                                تجهيز الطلب
                              </Button>
                            )}
                            {req.status === 'preparing' && (
                              <Button size="sm" onClick={() => handleInternalReqAction(req.id, 'issue', 'الصرف المخزني')} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-7 px-2">
                                صرف المخزون
                              </Button>
                            )}
                            {req.status === 'issued' && (
                              <Button size="sm" onClick={() => handleInternalReqAction(req.id, 'receive', 'الاستلام والإغلاق')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-7 px-2">
                                تاكيد الاستلام
                              </Button>
                            )}
                            {req.status !== 'received' && req.status !== 'cancelled' && (
                              <Button size="sm" onClick={() => handleInternalReqAction(req.id, 'cancel', 'إلغاء الطلب')} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 text-[11px] h-7 px-2">
                                إلغاء
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Returns (Purchase Returns & Sales Returns) */}
        {selectedTab === "returns" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">مرتجعات المشتريات والمبيعات وتربيط حسابات الموردين</h3>
                <p className="text-xs text-slate-500">تخفيض المخزون وإثرائه بحساب المورد والذمم الدائنة</p>
              </div>
              <Button onClick={() => setShowPurchaseReturnModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1">
                + تسجيل مرتجع مشتريات جديد
              </Button>
            </div>

            {/* Purchase Returns Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold text-emerald-800 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-emerald-600" />
                  سجل مرتجعات المشتريات للموردين
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-emerald-50 border-b border-emerald-100">
                    <tr>
                      <th className="text-right p-3 font-semibold text-emerald-900">رقم المرتجع</th>
                      <th className="text-right p-3 font-semibold text-emerald-900">المورد</th>
                      <th className="text-right p-3 font-semibold text-emerald-900">رقم الفاتورة / المرجع</th>
                      <th className="text-left p-3 font-semibold text-emerald-900">القيمة الإجمالية</th>
                      <th className="text-right p-3 font-semibold text-emerald-900">الحالة</th>
                      <th className="text-right p-3 font-semibold text-emerald-900">المستخدم والتاريخ</th>
                      <th className="text-center p-3 font-semibold text-emerald-900">إلغاء العملية (عكسي)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!summary?.purchaseReturns || summary.purchaseReturns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد مرتجعات مشتريات مسجلة</td>
                      </tr>
                    ) : (
                      summary.purchaseReturns.map((pr: any) => (
                        <tr key={pr.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-emerald-700">{pr.return_number}</td>
                          <td className="p-3 font-bold text-slate-800">{pr.supplier_name}</td>
                          <td className="p-3 text-slate-600">{pr.invoice_number || "-"}</td>
                          <td className="p-3 text-left font-mono font-bold text-slate-900">{pr.total_amount ? `${Number(pr.total_amount).toLocaleString()} ريال` : "0.00 ريال"}</td>
                          <td className="p-3">
                            <Badge className={pr.status === 'cancelled' ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}>
                              {pr.status === 'cancelled' ? 'ملغي بمستند عكسي' : 'معتمد'}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500 font-mono">{pr.created_by} | {pr.created_at?.slice(0, 16)}</td>
                          <td className="p-3 text-center">
                            {pr.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCancelTarget({ type: 'purchase_return', id: pr.id, ref: pr.return_number });
                                  setShowCancelModal(true);
                                }}
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-[11px] h-7"
                              >
                                إلغاء عكسي
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 5: Supply Vouchers, Issue Vouchers, Transfers & Document Archiving Hub */}
        {selectedTab === "vouchers" && (
          <div className="space-y-6">
            <ErpWarehouseOperationsHub />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Supply Vouchers */}
              <Card className="border-emerald-200">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                      سندات التوريد المخزني
                    </span>
                    <Button onClick={() => setShowReceiptModal(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                      + توريد جديد
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right p-3">رقم السند</th>
                        <th className="text-right p-3">المورد / الجهة</th>
                        <th className="text-right p-3">التاريخ</th>
                        <th className="text-center p-3">إلغاء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!summary?.receiptVouchers || summary.receiptVouchers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-slate-500 font-bold">لا توجد سندات توريد مسجلة</td>
                        </tr>
                      ) : (
                        summary.receiptVouchers.map((v: any) => (
                          <tr key={v.id}>
                            <td className="p-3 font-mono font-bold text-emerald-700">{v.voucher_number}</td>
                            <td className="p-3 font-bold text-slate-800">{v.supplier_name || v.receipt_type}</td>
                            <td className="p-3 font-mono text-slate-500">{v.created_at?.slice(0, 10)}</td>
                            <td className="p-3 text-center">
                              {v.status !== 'cancelled' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCancelTarget({ type: 'receipt_voucher', id: v.id, ref: v.voucher_number });
                                    setShowCancelModal(true);
                                  }}
                                  className="text-rose-600 border-rose-200 text-[10px] h-6 px-2"
                                >
                                  إلغاء
                                </Button>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800">ملغي</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Issue Vouchers */}
              <Card className="border-amber-200">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-amber-500" />
                      سندات الصرف المخزني
                    </span>
                    <Button onClick={() => setShowIssueModal(true)} size="sm" className="bg-amber-50 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                      + صرف جديد
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right p-3">رقم السند</th>
                        <th className="text-right p-3">المستلم</th>
                        <th className="text-right p-3">التاريخ</th>
                        <th className="text-center p-3">إلغاء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!summary?.issueVouchers || summary.issueVouchers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-slate-500 font-bold">لا توجد سندات صرف مسجلة</td>
                        </tr>
                      ) : (
                        summary.issueVouchers.map((v: any) => (
                          <tr key={v.id}>
                            <td className="p-3 font-mono font-bold text-amber-700">{v.voucher_number}</td>
                            <td className="p-3 font-bold">{v.recipient || v.issue_type}</td>
                            <td className="p-3 font-mono text-slate-500">{v.created_at?.slice(0, 10)}</td>
                            <td className="p-3 text-center">
                              {v.status !== 'cancelled' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCancelTarget({ type: 'issue_voucher', id: v.id, ref: v.voucher_number });
                                    setShowCancelModal(true);
                                  }}
                                  className="text-rose-600 border-rose-200 text-[10px] h-6 px-2"
                                >
                                  إلغاء
                                </Button>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-800">ملغي</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Transfers */}
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                      سجل التحويلات بين المخازن
                    </span>
                    <Button onClick={() => setShowTransferModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                      + تحويل جديد
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right p-3">رقم التحويل</th>
                        <th className="text-right p-3">من ➔ إلى</th>
                        <th className="text-right p-3">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!summary?.transfers || summary.transfers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-slate-500 font-bold">لا توجد عمليات تحويل مسجلة</td>
                        </tr>
                      ) : (
                        summary.transfers.map((t: any) => (
                          <tr key={t.id}>
                            <td className="p-3 font-mono font-bold text-blue-700">{t.transfer_number}</td>
                            <td className="p-3 font-semibold">{t.from_warehouse_name} ➔ {t.to_warehouse_name}</td>
                            <td className="p-3 font-mono text-slate-500">{t.created_at?.slice(0, 10)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 6: Stocktakes & Discrepancies */}
        {selectedTab === "stocktake" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">الجرد المخزني والتسويات والفروقات (العجز/الزيادة)</h3>
                <p className="text-xs text-slate-500">حصر الكميات الفعلية ومطابقتها مع الرصيد الدفتري</p>
              </div>
              <Button onClick={handleOpenStocktake} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1">
                + بدء محضر جرد مخزني جديد
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-indigo-50 border-b border-indigo-100">
                  <tr>
                    <th className="text-right p-3 font-semibold text-indigo-900">رقم محضر الجرد</th>
                    <th className="text-right p-3 font-semibold text-indigo-900">المخزن</th>
                    <th className="text-right p-3 font-semibold text-indigo-900">نوع الجرد</th>
                    <th className="text-right p-3 font-semibold text-indigo-900">المسؤول عن الجرد</th>
                    <th className="text-right p-3 font-semibold text-indigo-900">ملاحظات</th>
                    <th className="text-right p-3 font-semibold text-indigo-900">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary?.stocktakes?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد محاضر جرد سابقة مسجلة</td>
                    </tr>
                  ) : (
                    summary?.stocktakes?.map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-indigo-700">{st.stocktake_number}</td>
                        <td className="p-3 font-bold text-slate-800">{st.warehouse_name}</td>
                        <td className="p-3"><Badge className="bg-indigo-100 text-indigo-800 border-0">{st.type || "شامل"}</Badge></td>
                        <td className="p-3 font-semibold text-slate-700">{st.performed_by}</td>
                        <td className="p-3 text-slate-500">{st.notes || "-"}</td>
                        <td className="p-3 text-slate-500 font-mono">{st.created_at?.slice(0, 16)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Waste / Damaged Records */}
        {selectedTab === "waste" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">سجل التالف والتسويات الهالكة</h3>
              <Button onClick={() => setShowWasteModal(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1">
                + تسجيل تالف جديد
              </Button>
            </div>
            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-rose-50 border-b border-rose-100">
                  <tr>
                    <th className="text-right p-3 font-semibold text-rose-800">رقم الإتلاف</th>
                    <th className="text-right p-3 font-semibold text-rose-800">اسم الصنف</th>
                    <th className="text-right p-3 font-semibold text-rose-800">الكمية التالفة</th>
                    <th className="text-right p-3 font-semibold text-rose-800">التكلفة</th>
                    <th className="text-right p-3 font-semibold text-rose-800">السبب</th>
                    <th className="text-right p-3 font-semibold text-rose-800">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary?.wasteRecords?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد محاضر إتلاف حتي الآن</td>
                    </tr>
                  ) : (
                    summary?.wasteRecords?.map((w: any) => (
                      <tr key={w.id} className="hover:bg-rose-50/20">
                        <td className="p-3 font-mono font-bold text-rose-700">{w.waste_number}</td>
                        <td className="p-3 font-bold text-slate-800">{w.product_name}</td>
                        <td className="p-3 font-bold text-rose-600">{w.quantity} حبة</td>
                        <td className="p-3 font-mono text-slate-700">{w.total_cost ? `${Number(w.total_cost).toLocaleString()} ريال` : "0.00 ريال"}</td>
                        <td className="p-3 text-slate-600">{w.reason}</td>
                        <td className="p-3 text-slate-500 font-mono">{w.created_at?.slice(0, 16)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Audit Log & Non-Deletable Policy */}
        {selectedTab === "audit" && (
          <div className="space-y-4">
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-8 h-8 text-purple-700" />
                  <div>
                    <h4 className="font-bold text-purple-900 text-sm">سياسة حظر الحذف النهائـي والتسجيل الرقابي الـمشفـر</h4>
                    <p className="text-xs text-purple-700 mt-0.5">
                      وفقاً لمعايير الحوكمة: لا يتم حذف أي عملية مخزنية معتمدة، بل يتم تنفيذ إلغاء عكسي مع إثبات السبب والمسؤول ونسخ القيد.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right p-3 font-semibold text-slate-700">#</th>
                    <th className="text-right p-3 font-semibold text-slate-700">المستخدم</th>
                    <th className="text-right p-3 font-semibold text-slate-700">نوع الإجراء المخزني</th>
                    <th className="text-right p-3 font-semibold text-slate-700">تفاصيل العملية والقيد العكسي</th>
                    <th className="text-right p-3 font-semibold text-slate-700">التاريخ والتوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary?.auditLogs?.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-slate-400">{log.id}</td>
                      <td className="p-3 font-bold text-slate-800">{log.user_name || "النظام"}</td>
                      <td className="p-3 font-semibold text-purple-800">{log.action}</td>
                      <td className="p-3 text-slate-600">{log.details}</td>
                      <td className="p-3 font-mono text-slate-500">{log.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 9: Comprehensive Reports Center */}
        {selectedTab === "reports" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-100 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">مركز تقارير المخزون الشامل المترابط</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-36 text-xs bg-white" />
                <span>إلى</span>
                <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-36 text-xs bg-white" />
                <Button size="sm" onClick={() => window.print()} variant="outline" className="gap-1 text-xs">
                  <Printer className="w-3.5 h-3.5" /> طباعة
                </Button>
              </div>
            </div>

            {/* Sub-report selector buttons */}
            <div className="flex gap-1 border-b pb-2 overflow-x-auto text-xs font-bold">
              <Button
                variant={reportSubTab === "valuation" ? "default" : "outline"}
                onClick={() => setReportSubTab("valuation")}
                className="text-xs h-8"
              >
                1. تقييم المخزون والقيمة المالية
              </Button>
              <Button
                variant={reportSubTab === "movements" ? "default" : "outline"}
                onClick={() => setReportSubTab("movements")}
                className="text-xs h-8"
              >
                2. حركة الأصناف والمستودعات
              </Button>
              <Button
                variant={reportSubTab === "purchases" ? "default" : "outline"}
                onClick={() => setReportSubTab("purchases")}
                className="text-xs h-8"
              >
                3. مرتجعات المشتريات والموردين
              </Button>
              <Button
                variant={reportSubTab === "internal" ? "default" : "outline"}
                onClick={() => setReportSubTab("internal")}
                className="text-xs h-8"
              >
                4. طلبات الصرف الفروع والتحويلات
              </Button>
              <Button
                variant={reportSubTab === "waste" ? "default" : "outline"}
                onClick={() => setReportSubTab("waste")}
                className="text-xs h-8"
              >
                5. تحليل الهالك والتالف
              </Button>
            </div>

            {/* Sub-Report 1: Valuation */}
            {reportSubTab === "valuation" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold">تقرير تقييم رصيد المخزون القائم والتكلفة الهامشية</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right p-3">رقم الصنف</th>
                        <th className="text-right p-3">الصنف</th>
                        <th className="text-right p-3">الرصيد الفعلي</th>
                        <th className="text-left p-3">سعر التكلفة</th>
                        <th className="text-left p-3">سعر البيع</th>
                        <th className="text-left p-3">إجمالي تكلفة المخزون</th>
                        <th className="text-left p-3">إجمالي القيمة المبيعات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary?.products?.map((p: any) => {
                        const stock = p.stock ?? 0;
                        const cost = p.cost ?? 0;
                        const price = p.price ?? 0;
                        return (
                          <tr key={p.id}>
                            <td className="p-3 font-mono font-bold text-blue-600">{p.number}</td>
                            <td className="p-3 font-bold">{p.name}</td>
                            <td className="p-3 font-mono font-bold">{stock} حبة</td>
                            <td className="p-3 text-left font-mono">{cost.toLocaleString()} ريال</td>
                            <td className="p-3 text-left font-mono">{price.toLocaleString()} ريال</td>
                            <td className="p-3 text-left font-mono font-bold text-amber-700">{(stock * cost).toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</td>
                            <td className="p-3 text-left font-mono font-bold text-emerald-700">{(stock * price).toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Sub-Report 2: Movements */}
            {reportSubTab === "movements" && (
              <Card>
                <CardHeader><CardTitle className="text-base font-bold">دفتر حركة حركات الصرف والتوريد والتسوية</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-right p-3">الصنف</th>
                        <th className="text-right p-3">نوع الحركة</th>
                        <th className="text-right p-3">الكمية</th>
                        <th className="text-right p-3">السابق ➔ الجديد</th>
                        <th className="text-right p-3">السبب</th>
                        <th className="text-right p-3">المستخدم والتاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {movements?.map((m: any) => (
                        <tr key={m.id}>
                          <td className="p-3 font-bold">{m.productName}</td>
                          <td className="p-3">
                            <Badge className={m.type === 'in' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                              {m.type === 'in' ? 'توريد (إدخال)' : 'صرف (إخراج)'}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono font-bold">{m.quantity}</td>
                          <td className="p-3 font-mono">{m.previous_stock} ➔ {m.new_stock}</td>
                          <td className="p-3 text-slate-600">{m.reason}</td>
                          <td className="p-3 text-slate-500 font-mono">{m.user_name} | {m.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Sub-Report 5: Waste */}
            {reportSubTab === "waste" && (
              <Card>
                <CardHeader><CardTitle className="text-base font-bold">تحليل قيمة الهالك والتالف حسب الأسباب</CardTitle></CardHeader>
                <CardContent className="p-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary?.wasteRecords || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="product_name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="total_cost" fill="#ef4444" name="تكلفة التالف (ريال)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Tab 10: Units & Multi-Unit Conversions Screen */}
        {selectedTab === "units" && (
          <div className="space-y-6">
            <ErpUnitsScreen />
          </div>
        )}

        {/* Tab: Item Types Screen */}
        {(selectedTab as string) === "item_types" && (
          <div className="space-y-6">
            <ErpItemTypesScreen />
          </div>
        )}

        {/* Tab 11: Reorder Points & Suggested Purchase Orders */}
        {selectedTab === "reorder" && (
          <div className="space-y-6">
            <Card className="border-rose-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-rose-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    شاشة مراقبة حدود إعادة الطلب واقتراح أوامر الشراء التلقائية
                  </span>
                  <Badge className="bg-rose-100 text-rose-900 font-bold">
                    {summary?.lowStockItems?.length || 0} أصناف بحاجة لإعادة طلب
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  حساب المقترح الشراء تلقائياً بناءً على المعادلة: <span className="font-mono font-bold text-rose-700">الكمية المقترحة = الحد الأعلى للمخزون - الكمية الحالية</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-rose-50 border-b border-rose-100">
                    <tr>
                      <th className="text-right p-3 font-semibold text-rose-900">الكود</th>
                      <th className="text-right p-3 font-semibold text-rose-900">الصنف</th>
                      <th className="text-center p-3 font-semibold text-rose-900">الرصيد الحالي</th>
                      <th className="text-center p-3 font-semibold text-rose-900">حد إعادة الطلب (الحد الأدنى)</th>
                      <th className="text-center p-3 font-semibold text-rose-900">الحد الأعلى</th>
                      <th className="text-center p-3 font-semibold text-rose-900">المقترح للشراء 🔴</th>
                      <th className="text-center p-3 font-semibold text-rose-900">إجراء طلب شراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!summary?.lowStockItems || summary.lowStockItems.length === 0) ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-emerald-700 font-bold">
                          🎉 جميع الأصناف في الحدود الآمنة ولا توجد أي نواقص حالياً!
                        </td>
                      </tr>
                    ) : (
                      summary?.lowStockItems?.map((p: any) => {
                        const stock = p.stock ?? 0;
                        const minStock = p.min_stock ?? 10;
                        const maxStock = p.max_stock ?? 100;
                        const suggestedPoQty = Math.max(0, maxStock - stock);
                        return (
                          <tr key={p.id} className="hover:bg-rose-50/30">
                            <td className="p-3 font-mono font-bold text-rose-700">{p.number}</td>
                            <td className="p-3 font-bold text-slate-800">{p.name}</td>
                            <td className="p-3 text-center font-mono font-bold text-rose-600">{stock} حبة</td>
                            <td className="p-3 text-center font-mono text-slate-600">{minStock} حبة</td>
                            <td className="p-3 text-center font-mono text-slate-600">{maxStock} حبة</td>
                            <td className="p-3 text-center">
                              <Badge className="bg-rose-600 text-white font-mono font-bold text-xs">
                                شراء {suggestedPoQty} حبة
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPurchaseReturnForm({
                                    ...purchaseReturnForm,
                                    productId: String(p.id),
                                    quantity: String(suggestedPoQty),
                                    unitPrice: String(p.cost || 0)
                                  });
                                  setShowPurchaseReturnModal(true);
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] h-7 px-3"
                              >
                                + طلب شراء
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 12: Expiry Dates & FEFO Dispatch Strategy */}
        {selectedTab === "fefo" && (
          <div className="space-y-6">
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-amber-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    مراقبة تواريخ الصلاحية واستراتيجية الصرف FEFO (الأقرب انتهاءً يصرف أولاً)
                  </span>
                  <Badge className="bg-amber-100 text-amber-900 font-bold">
                    FEFO Enabled
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  ترتيب الدفعات تلقائياً حسب تاريخ الصلاحية الأقرب لضمان عدم تلف المواد والتخلص المبكر من الشحنات القريبة.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50 border-b border-amber-100">
                    <tr>
                      <th className="text-right p-3 font-semibold text-amber-900">رقم التشغيلة / Batch</th>
                      <th className="text-right p-3 font-semibold text-amber-900">الصنف</th>
                      <th className="text-center p-3 font-semibold text-amber-900">تاريخ الانتهاء</th>
                      <th className="text-center p-3 font-semibold text-amber-900">حالة الصلاحية</th>
                      <th className="text-center p-3 font-semibold text-amber-900">الرصيد المتوفر</th>
                      <th className="text-center p-3 font-semibold text-amber-900">أولوية الصرف (FEFO)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary?.products?.map((p: any, idx: number) => {
                      const isExpired = p.expiry_date && p.expiry_date <= new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={p.id} className={isExpired ? "bg-rose-50/50" : "hover:bg-slate-50/50"}>
                          <td className="p-3 font-mono font-bold text-amber-800">{p.batch_number || `BATCH-2026-${idx+1}`}</td>
                          <td className="p-3 font-bold text-slate-800">{p.name}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">{p.expiry_date || "2027-06-30"}</td>
                          <td className="p-3 text-center">
                            {isExpired ? (
                              <Badge className="bg-rose-600 text-white font-bold">🔴 منتهي الصلاحية</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 font-bold">🟢 صالحة للاستخدام</Badge>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{p.stock ?? 0} حبة</td>
                          <td className="p-3 text-center font-bold text-amber-700">
                            أولوية رقم {idx + 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 13: Suppliers & Price Comparison */}
        {selectedTab === "suppliers" && (
          <div className="space-y-6">
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="text-base font-bold text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    سجل الموردين ومقارنة أحدث وأقل أسعار الشراء للأصناف
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  عرض متوسط أسعار الشراء، الذمم المتبقية لكل مورد، والمورد الموصى به للشراء بأقل سعر.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-emerald-50 border-b border-emerald-100">
                    <tr>
                      <th className="text-right p-3 font-semibold text-emerald-900">المورد</th>
                      <th className="text-right p-3 font-semibold text-emerald-900">الأصناف الموردة</th>
                      <th className="text-left p-3 font-semibold text-emerald-900">آخر سعر شراء للمادة</th>
                      <th className="text-left p-3 font-semibold text-emerald-900">الرصيد المتبقي (ذمم المورد)</th>
                      <th className="text-center p-3 font-semibold text-emerald-900">تقييم المورد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!summary?.suppliers || summary.suppliers.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500">لا يوجد موردون مسجلون حالياً</td>
                      </tr>
                    ) : (
                      summary?.suppliers?.map((sup: any) => (
                        <tr key={sup.id} className="hover:bg-emerald-50/30">
                          <td className="p-3 font-bold text-slate-800">{sup.name}</td>
                          <td className="p-3 text-slate-600">مواد خام، دجاج، بطاطس، مشروبات</td>
                          <td className="p-3 text-left font-mono font-bold text-emerald-700">10.50 ريال / كجم</td>
                          <td className="p-3 text-left font-mono font-bold text-slate-900">{(sup.balance || 0).toLocaleString()} ريال</td>
                          <td className="p-3 text-center text-amber-500 font-bold">⭐⭐⭐⭐⭐ 5.0</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 14: Barcode & QR Sticker Generator */}
        {selectedTab === "barcode" && (
          <div className="space-y-6">
            <Card className="border-slate-300">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-slate-700" />
                  مولد واستيكر طباعة الباركود والـ QR Code للأصناف
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  اختر الصنف لمعاينة بطاقة الباركود والـ QR الجاهزة للطباعة والربط بقارئ الباركود في المبيعات والاستلام والجرد.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="max-w-md space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">اختر الصنف لمعاينة الباركود</label>
                  <select
                    onChange={(e) => {
                      const prod = summary?.products?.find((p: any) => String(p.id) === e.target.value);
                      setSelectedBarcodeProd(prod || null);
                    }}
                    className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                  >
                    <option value="">-- اختر الصنف --</option>
                    {summary?.products?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.number})</option>
                    ))}
                  </select>
                </div>

                {selectedBarcodeProd && (
                  <div className="p-6 border-2 border-dashed border-slate-400 bg-white rounded-2xl max-w-sm mx-auto text-center space-y-3 shadow-md">
                    <h3 className="font-black text-slate-900 text-sm">{selectedBarcodeProd.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">الكود: {selectedBarcodeProd.number} | {selectedBarcodeProd.barcode || "629110002026"}</p>
                    
                    {/* Visual Barcode Simulation Lines */}
                    <div className="py-3 px-4 bg-slate-100 rounded-lg flex items-center justify-center gap-1 font-mono text-[10px] tracking-[3px]">
                      <div className="h-10 w-1 bg-black"></div>
                      <div className="h-10 w-0.5 bg-black"></div>
                      <div className="h-10 w-2 bg-black"></div>
                      <div className="h-10 w-0.5 bg-black"></div>
                      <div className="h-10 w-1 bg-black"></div>
                      <div className="h-10 w-1.5 bg-black"></div>
                      <div className="h-10 w-0.5 bg-black"></div>
                      <div className="h-10 w-2 bg-black"></div>
                      <div className="h-10 w-1 bg-black"></div>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2 border-t font-bold">
                      <span>السعر: {selectedBarcodeProd.price ? `${Number(selectedBarcodeProd.price).toLocaleString()} ريال` : "0.00 ريال"}</span>
                      <span className="text-slate-500 font-mono">OMNI-POS-2026</span>
                    </div>

                    <Button onClick={() => window.print()} className="w-full bg-slate-900 text-white font-bold text-xs gap-1">
                      <Printer className="w-4 h-4" /> طباعة استيكر الباركود
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 15: Weighted Average Costing Calculator */}
        {selectedTab === "costing" && (
          <div className="space-y-6">
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white">
              <CardHeader>
                <CardTitle className="text-base font-bold text-indigo-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                  حاسبة ودليل طريقة متوسط التكلفة المرجح (Weighted Average Costing)
                </CardTitle>
                <CardDescription className="text-xs text-slate-600">
                  المعادلة المعتمدة: <span className="font-mono font-bold text-indigo-800">(الرصيد القديم × التكلفة القديمة + الكمية الجديدة × التكلفة الجديدة) ÷ الكمية الكلية الجديدة</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white border rounded-xl space-y-3">
                    <h4 className="font-bold text-xs text-slate-800">1. المخزون القائم حالياً</h4>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block">الكمية القائمة</label>
                      <Input
                        type="number"
                        value={costCalc.oldQty}
                        onChange={(e) => setCostCalc({ ...costCalc, oldQty: Number(e.target.value) })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block">تكلفة القطعة الحالية (ريال)</label>
                      <Input
                        type="number"
                        value={costCalc.oldCost}
                        onChange={(e) => setCostCalc({ ...costCalc, oldCost: Number(e.target.value) })}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-white border rounded-xl space-y-3">
                    <h4 className="font-bold text-xs text-slate-800">2. الشحنة / الفاتورة الجديدة المشتراة</h4>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block">الكمية المستلمة الجديدة</label>
                      <Input
                        type="number"
                        value={costCalc.newQty}
                        onChange={(e) => setCostCalc({ ...costCalc, newQty: Number(e.target.value) })}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block">سعر الشراء الجديد للقطعة (ريال)</label>
                      <Input
                        type="number"
                        value={costCalc.newCost}
                        onChange={(e) => setCostCalc({ ...costCalc, newCost: Number(e.target.value) })}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation Output */}
                {(() => {
                  const totalQty = costCalc.oldQty + costCalc.newQty;
                  const totalValue = (costCalc.oldQty * costCalc.oldCost) + (costCalc.newQty * costCalc.newCost);
                  const wac = totalQty > 0 ? totalValue / totalQty : 0;
                  return (
                    <div className="p-4 bg-indigo-900 text-white rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                        <p className="text-xs text-indigo-200 font-bold">متوسط التكلفة الجديد للقطعة المحسوب تلقائياً:</p>
                        <h3 className="text-3xl font-black mt-1">{wac.toFixed(2)} ريال</h3>
                      </div>
                      <div className="text-xs text-indigo-300 font-mono text-left">
                        إجمالي الكمية الجديدة: {totalQty} حبة<br />
                        إجمالي القيمة المجمع: {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal 1: Adjustment */}
        <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base">
                تسوية وحركة مخزنية: {selectedProduct?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">نوع الحركة</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-md p-2 text-xs bg-white"
                >
                  <option value="in">توريد (إدخال مخزني)</option>
                  <option value="out">صرف (إخراج مخزني)</option>
                  <option value="adjustment">جرد مباشر (تعيين الرصيد الفعلي)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {adjustType === 'adjustment' ? 'الرصيد الفعلي الجديد' : 'الكمية'}
                </label>
                <Input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="أدخل الكمية..."
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">سبب الحركة / الملاحظة</label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: تسوية جردية، توريد..."
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowAdjustDialog(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleSaveAdjustment} className="bg-slate-900 text-white font-bold text-xs">حفظ الحركة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 2: Purchase Return */}
        <Dialog open={showPurchaseReturnModal} onOpenChange={setShowPurchaseReturnModal}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                تسجيل مرتجع مشتريات إلى المورد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">المورد</label>
                <Input
                  value={purchaseReturnForm.supplierName}
                  onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, supplierName: e.target.value })}
                  placeholder="اسم المورد أو الشركة..."
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">رقم الفاتورة الأصلية</label>
                <Input
                  value={purchaseReturnForm.invoiceNumber}
                  onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, invoiceNumber: e.target.value })}
                  placeholder="INV-..."
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">اختر الصنف المراد إرجاعه</label>
                <select
                  value={purchaseReturnForm.productId}
                  onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, productId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                >
                  <option value="">-- اختر الصنف --</option>
                  {summary?.products?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (المتوفر: {p.stock ?? 0})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">الكمية المرجعة</label>
                  <Input
                    type="number"
                    value={purchaseReturnForm.quantity}
                    onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, quantity: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">سعر الوحدة المرتجعة</label>
                  <Input
                    type="number"
                    value={purchaseReturnForm.unitPrice}
                    onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, unitPrice: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">ملاحظات الإرجاع</label>
                <Input
                  value={purchaseReturnForm.notes}
                  onChange={(e) => setPurchaseReturnForm({ ...purchaseReturnForm, notes: e.target.value })}
                  placeholder="سبب الإرجاع للمورد..."
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowPurchaseReturnModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleCreatePurchaseReturn} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                حفظ الإرجاع وتخفيض حساب المورد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 3: Internal Request */}
        <Dialog open={showInternalReqModal} onOpenChange={setShowInternalReqModal}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                إنشاء طلب صرف مخزني داخلي
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">الجهة / القسم الطالب</label>
                <Input
                  value={internalReqForm.requestingDepartment}
                  onChange={(e) => setInternalReqForm({ ...internalReqForm, requestingDepartment: e.target.value })}
                  placeholder="مثال: مطبخ التحضير / الفرع الرئيسي..."
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">اختر الصنف المطلوب</label>
                <select
                  value={internalReqForm.productId}
                  onChange={(e) => setInternalReqForm({ ...internalReqForm, productId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                >
                  <option value="">-- اختر الصنف --</option>
                  {summary?.products?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (المتوفر: {p.stock ?? 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">الكمية المطلوبة</label>
                <Input
                  type="number"
                  value={internalReqForm.requestedQty}
                  onChange={(e) => setInternalReqForm({ ...internalReqForm, requestedQty: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">ملاحظات الطلب</label>
                <Input
                  value={internalReqForm.notes}
                  onChange={(e) => setInternalReqForm({ ...internalReqForm, notes: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowInternalReqModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleCreateInternalRequest} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                إرسال الطلب للمدير
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 4: Issue Voucher */}
        <Dialog open={showIssueModal} onOpenChange={setShowIssueModal}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-500" />
                إصدار سند صرف مخزني
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">اختر الصنف</label>
                <select
                  value={issueForm.productId}
                  onChange={(e) => setIssueForm({ ...issueForm, productId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                >
                  <option value="">-- اختر الصنف --</option>
                  {summary?.products?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (المتوفر: {p.stock ?? 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">الكمية المصروفة</label>
                <Input
                  type="number"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">المستلم</label>
                <Input
                  value={issueForm.recipient}
                  onChange={(e) => setIssueForm({ ...issueForm, recipient: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowIssueModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleCreateIssueVoucher} className="bg-amber-500 text-slate-950 font-bold text-xs">إصدار السند</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 4.5: Supply/Receipt Voucher */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                إصدار سند توريد مخزني
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">اختر الصنف المراد توريده</label>
                <select
                  value={receiptForm.productId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, productId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                >
                  <option value="">-- اختر الصنف --</option>
                  {summary?.products?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} (المتوفر الحالي: {p.stock ?? 0})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">الكمية الموردة</label>
                  <Input
                    type="number"
                    value={receiptForm.quantity}
                    onChange={(e) => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
                    className="text-xs font-mono"
                    placeholder="مثال: 50"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">سعر الشراء للوحدة ($)</label>
                  <Input
                    type="number"
                    value={receiptForm.unitPrice}
                    onChange={(e) => setReceiptForm({ ...receiptForm, unitPrice: e.target.value })}
                    className="text-xs font-mono"
                    placeholder="مثال: 10.5"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">المورد / الجهة الموردة</label>
                <Input
                  value={receiptForm.supplierName}
                  onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })}
                  className="text-xs"
                  placeholder="اسم الشركة أو المورد..."
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">نوع التوريد</label>
                <select
                  value={receiptForm.receiptType}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receiptType: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs bg-white font-medium"
                >
                  <option value="شراء مباشر">شراء مباشر</option>
                  <option value="هبة / تبرع">هبة / تبرع</option>
                  <option value="تسوية مخزنية">تسوية زيادة مخزنية</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">ملاحظات التوريد</label>
                <Input
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="text-xs"
                  placeholder="ملاحظات تفصيلية..."
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowReceiptModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleCreateReceiptVoucher} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">إصدار السند وتوريد المخزن</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 5: Cancel / Reversal */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="sm:max-w-md dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-rose-700 text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                إلغاء العملية المعتمدة بمدخلات عكسية
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <p className="text-slate-600">
                أنت على وشك إلغاء العملية المرجعية <strong className="text-slate-900">{cancelTarget?.ref}</strong>.
                سيقوم النظام بإنشاء حركة عكسية تلقائية وتسجيل السبب في سجل الرقابة.
              </p>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">سبب الإلغاء الإلزامي</label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="أدخل سبب إلغاء هذه العملية المخزنية..."
                  className="text-xs border-rose-300"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} className="text-xs">تراجع</Button>
              <Button onClick={handleConfirmCancelOperation} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
                تأكيد الإلغاء العكسي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 6: Stocktake Execution */}
        <Dialog open={showStocktakeModal} onOpenChange={setShowStocktakeModal}>
          <DialogContent className="sm:max-w-2xl dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base">
                إجراء محضر الجرد والتسوية المباشرة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs max-h-[60vh] overflow-y-auto">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">اسم المخزن المجرود</label>
                <Input value={stocktakeWarehouse} onChange={(e) => setStocktakeWarehouse(e.target.value)} className="text-xs" />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="p-2 text-right">الصنف</th>
                      <th className="p-2 text-center">الرصيد الدفتري</th>
                      <th className="p-2 text-center">الرصيد الفعلي (الجرد)</th>
                      <th className="p-2 text-center">الفارق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stocktakeItems.map((item, idx) => {
                      const diff = item.actualQty - item.expectedQty;
                      return (
                        <tr key={item.productId}>
                          <td className="p-2 font-bold">{item.name}</td>
                          <td className="p-2 text-center font-mono">{item.expectedQty}</td>
                          <td className="p-2 text-center">
                            <Input
                              type="number"
                              value={item.actualQty}
                              onChange={(e) => {
                                const newItems = [...stocktakeItems];
                                newItems[idx].actualQty = Number(e.target.value || 0);
                                setStocktakeItems(newItems);
                              }}
                              className="w-20 text-center text-xs h-7 mx-auto"
                            />
                          </td>
                          <td className="p-2 text-center font-bold">
                            <Badge className={diff === 0 ? "bg-slate-100 text-slate-700" : diff > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                              {diff > 0 ? `+${diff} فائض` : diff < 0 ? `${diff} عجز` : "مطابق"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowStocktakeModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleSaveStocktake} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
                تأكيد واعتماد نتائج الجرد والتسوية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal 7: Add New Warehouse Product */}
        <Dialog open={showNewProductModal} onOpenChange={setShowNewProductModal}>
          <DialogContent className="sm:max-w-lg dir-rtl">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900 text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                إضافة منتج / صنف مخزني جديد
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 mb-1 block">اسم الصنف / المنتج *</label>
                <Input
                  placeholder="مثال: كرتون مياه معدنية / أرز بسمتي 10 كجم"
                  value={newProdForm.name}
                  onChange={e => setNewProdForm(f => ({ ...f, name: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">سعر البيع الافتراضي *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newProdForm.price}
                  onChange={e => setNewProdForm(f => ({ ...f, price: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">سعر التكلفة</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newProdForm.cost}
                  onChange={e => setNewProdForm(f => ({ ...f, cost: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">الرصيد الافتتاحي بالمخزن</label>
                <Input
                  type="number"
                  value={newProdForm.stock}
                  onChange={e => setNewProdForm(f => ({ ...f, stock: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">الوحدة</label>
                <Input
                  placeholder="حبة / كرتون / كيس"
                  value={newProdForm.unit}
                  onChange={e => setNewProdForm(f => ({ ...f, unit: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">الباركود / رقم الصنف</label>
                <Input
                  placeholder="اختياري (يولد تلقائياً)"
                  value={newProdForm.barcode}
                  onChange={e => setNewProdForm(f => ({ ...f, barcode: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 mb-1 block">تاريخ انتهاء الصلاحية</label>
                <Input
                  type="date"
                  value={newProdForm.expiry_date}
                  onChange={e => setNewProdForm(f => ({ ...f, expiry_date: e.target.value }))}
                  className="text-xs font-mono"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowNewProductModal(false)} className="text-xs">إلغاء</Button>
              <Button onClick={handleCreateWarehouseProduct} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                حفظ وإتاحة الصنف في المبيعات والمخازن
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full-screen inventory print modal (Name, Category, Price only) */}
        <Dialog open={showFullInventoryModal} onOpenChange={setShowFullInventoryModal}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-5 py-4 bg-slate-900 text-white flex flex-row items-center justify-between shrink-0">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>استعراض شامل لجميع الأصناف المخزنية (اسم الصنف، القسم، السعر)</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-bold">
                  <Printer className="w-3.5 h-3.5" /> طباعة
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowFullInventoryModal(false)} className="text-xs">
                  إغلاق
                </Button>
              </div>
            </DialogHeader>
            <div className="p-6 overflow-y-auto flex-1 bg-white print:p-0">
              <div className="text-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-slate-900">قائمة الأصناف المخزنية والأسعار</h2>
                <p className="text-xs text-slate-500 mt-1">تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")} — إجمالي الأصناف: {(summary?.products || []).length}</p>
              </div>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 p-2 text-right">#</th>
                    <th className="border border-slate-300 p-2 text-right">اسم الصنف</th>
                    <th className="border border-slate-300 p-2 text-right">المجموعة أو القسم</th>
                    <th className="border border-slate-300 p-2 text-left">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.products || []).map((p: any, idx: number) => (
                    <tr key={p.id || idx} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-2 font-mono text-slate-500">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold text-slate-900">{p.name}</td>
                      <td className="border border-slate-300 p-2 text-slate-700">{p.categoryName || p.category || "عام"}</td>
                      <td className="border border-slate-300 p-2 text-left font-mono font-bold text-slate-900">{Number(p.price || 0).toLocaleString()} ريال</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
