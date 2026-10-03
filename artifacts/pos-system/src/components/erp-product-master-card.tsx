import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Save, Trash2, Edit3, Printer, RefreshCw, Layers,
  Search, Info, Check, Sparkles, Image as ImageIcon, Camera, Upload,
  Scale, Calendar, BarChart3, TrendingUp, History, ArrowRightLeft,
  FileText, ShieldCheck, DollarSign, Calculator, Lock, Eye, X
} from "lucide-react";

export interface Props {
  productId?: number;
  onClose?: () => void;
  onSaveSuccess?: () => void;
}

export function ErpProductMasterCardScreen({ productId, onClose, onSaveSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "main" | "units" | "other" | "suppliers" | "limits" | "movements" | "turnover" | "analytics" | "prices" | "warehouses" | "substitutes"
  >("main");

  // Form State matching Image 1
  const [itemType, setItemType] = useState<string>("1- سلعي");
  const [mainGroupCode, setMainGroupCode] = useState<string>("080");
  const [mainGroupName, setMainGroupName] = useState<string>("مجموعة الساعات");
  const [subGroupCode, setSubGroupCode] = useState<string>("001");
  const [subGroupName, setSubGroupName] = useState<string>("ساعات كاسيو");
  const [subSubGroupCode, setSubSubGroupCode] = useState<string>("001");
  const [subSubGroupName, setSubSubGroupName] = useState<string>("ساعات جلد كاسيو");
  const [itemNumber, setItemNumber] = useState<string>("080-0001");
  const [itemName, setItemName] = useState<string>("ساعات كاسيو 220");
  const [foreignName, setForeignName] = useState<string>("CASIO 220");
  const [barcode, setBarcode] = useState<string>("080-0001");
  const [auxGroupCode, setAuxGroupCode] = useState<string>("001");
  const [auxGroupName, setAuxGroupName] = useState<string>("ساعات رجالي");
  const [detailGroupCode, setSubDetailGroupCode] = useState<string>("1");
  const [detailGroupName, setSubDetailGroupName] = useState<string>("الساعات الذهبية");
  const [brandName, setBrandName] = useState<string>("CASIO");
  const [refNumber, setRefNumber] = useState<string>("REF-9920");
  const [imageUrl, setImageUrl] = useState<string>("");

  // Tab 1: البيانات الرئيسية Fields (Image 1)
  const [specifications, setSpecifications] = useState<string>("ساعات يابانية جلدية مقاومة للماء");
  const [initialCost, setInitialCost] = useState<number>(10.0);
  const [defaultUnit, setDefaultUnit] = useState<string>("حبة");
  const [itemActivity, setActivity] = useState<string>("3- نشاط الكمبيوتر");
  const [itemGrade, setGrade] = useState<string>("2- جيد");
  const [sizeSpec, setSizeSpec] = useState<string>("بوصلة");
  const [colorSpec, setColorSpec] = useState<string>("ذهبي");
  const [seasonSpec, setSeasonSpec] = useState<string>("2025");
  const [materialSpec, setMaterialSpec] = useState<string>("ممتازة");
  const [brandSpec, setBrandSpec] = useState<string>("كاسيو");
  const [manufacturer, setManufacturer] = useState<string>("كاسيو اليابانية");
  const [countryOfOrigin, setCountryOfOrigin] = useState<string>("اليابان");
  const [purchInvoiceNum, setPurchInvoiceNum] = useState<string>("INV-10029");
  const [returnPeriodDays, setReturnPeriodDays] = useState<number>(14);
  const [lengthMm, setLengthMm] = useState<number>(0);
  const [widthMm, setWidthMm] = useState<number>(0);
  const [heightMm, setHeightMm] = useState<number>(0);
  const [volumeM3, setVolumeM3] = useState<number>(0);
  const [areaM2, setAreaM2] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<number>(0.25);
  const [mfgNumber, setMfgNumber] = useState<string>("2345");
  const [substituteItem, setSubstituteItem] = useState<string>("");

  // Checkboxes matching Image 1
  const [useWeight, setUseWeight] = useState<boolean>(false);
  const [allowDecimals, setAllowDecimals] = useState<boolean>(true);
  const [nonReturnable, setNonReturnable] = useState<boolean>(false);
  const [isService, setIsService] = useState<boolean>(false);
  const [sellCashOnly, setSellCashOnly] = useState<boolean>(false);
  const [isFixedAsset, setIsFixedAsset] = useState<boolean>(false);
  const [isImported, setIsImported] = useState<boolean>(true);
  const [useExpiryDate, setUseExpiryDate] = useState<boolean>(false);
  const [useBatchLot, setUseBatchLot] = useState<boolean>(true);
  const [useAccessories, setUseBatchAccessories] = useState<boolean>(false);

  // Storage section
  const [storageStatus, setStorageStatus] = useState<string>("مخزن");
  const [packageQty, setPackageQty] = useState<number>(1);
  const [stoppingDate, setStoppingDate] = useState<string>("");
  const [stoppingReason, setStoppingReason] = useState<string>("");
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [currentQty, setCurrentQty] = useState<number>(100);
  const [avgCost, setAvgCost] = useState<number>(10.0);

  // Tab 2: الحدود Fields (Image 2)
  const [maxStock, setMaxStock] = useState<number>(500);
  const [reorderPoint, setReorderPoint] = useState<number>(20);
  const [defaultReorderQty, setDefaultReorderQty] = useState<number>(50);
  const [safetyStock, setSafetyStock] = useState<number>(10);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(7);

  // Movement Filter (Image 2)
  const [fromDateFilter, setFromDateFilter] = useState<string>("2025-01-01");
  const [toDateFilter, setToDateFilter] = useState<string>("2025-12-31");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("جميع المخازن");

  // Fetch product analytics data if editing existing product
  const { data: analyticsRes, refetch: refetchAnalytics } = useQuery({
    queryKey: ["product-analytics", productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await fetch(`/api/products/${productId}/analytics`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(productId)
  });

  const analytics = analyticsRes;

  // Load product if editing
  useEffect(() => {
    if (productId) {
      fetch(`/api/products/${productId}`)
        .then((res) => res.json())
        .then((p) => {
          if (p && !p.error) {
            setItemName(p.name || "");
            setItemNumber(String(p.number || "080-0001"));
            setBarcode(p.barcode || "");
            setInitialCost(p.cost || 10.0);
            setDefaultUnit(p.unit || "حبة");
            setCurrentQty(p.stock || 0);
            setMaxStock(p.max_stock || 500);
            setReorderPoint(p.min_stock || 20);
            setImageUrl(p.image_url || "");
          }
        })
        .catch(() => {});
    }
  }, [productId]);

  // Save Handler
  const handleSave = () => {
    if (!itemName || itemName.trim() === "") {
      toast({ title: "يرجى تعبئة اسم الصنف", variant: "destructive" });
      return;
    }

    const payload = {
      name: itemName,
      number: Number(itemNumber.replace(/\D/g, "")) || 800001,
      price: lastSalePrice,
      cost: initialCost,
      barcode,
      stock: currentQty,
      min_stock: reorderPoint,
      max_stock: maxStock,
      unit: defaultUnit,
      image_url: imageUrl
    };

    const token = localStorage.getItem("pos_token") ?? "";
    const endpoint = productId ? `/api/products/${productId}` : `/api/products`;
    const method = productId ? "PUT" : "POST";

    fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "فشل حفظ الصنف");
        return data;
      })
      .then((data) => {
        toast({ title: "تم حفظ بطاقة الصنف بنجاح ✅", description: `تم تسجيل الصنف (${data.name || itemName}) وإتاحته في المخازن والمبيعات` });
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["onyx-products"] });
        if (onSaveSuccess) onSaveSuccess();
      })
      .catch((err) => {
        toast({ title: "فشل الحفظ", description: err.message, variant: "destructive" });
      });
  };

  const pricingStats = analytics?.pricing || {
    maxSalePrice: 10.0,
    minSalePrice: 10.0,
    lastSalePrice: 10.0,
    avgSalePrice: 10.0,
    lastInvoiceNumber: "1001",
    lastInvoiceType: "نقد / آجل",
    lastInvoiceDate: "2025-11-01",
    firstReceiptDate: "2025-01-01",
    lastReceiptDate: "2025-11-01",
    firstIssueDate: "2025-01-05",
    lastIssueDate: "2025-11-01"
  };

  const lastSalePrice = pricingStats.lastSalePrice || 10.0;

  const quantitiesAndCosts = analytics?.quantitiesAndCosts || {
    initialCost: 10.0,
    lastReceiptCost: 10.0,
    avgCost: 10.0,
    availableStock: currentQty || 100,
    totalIncomingQty: 500,
    totalOutgoingQty: 100,
    totalProductionQty: 0,
    netSalesQty: 10000,
    openPurchaseOrdersQty: 20000,
    inTransitQty: 10000,
    availableForWarehouseQty: 10000,
    unreceivedTransfersQty: 0
  };

  const turnoverAndAge = analytics?.turnoverAndAge || {
    inventoryTurnoverRatio: 1.5,
    salesTurnoverRatio: 50.0,
    stockAgeDays: 365,
    dailySalesAvg: 2.5,
    expectedStockoutDays: 40
  };

  const movements = analytics?.movements || [
    {
      id: 1,
      document_number: "2",
      created_at: "2025-11-02",
      type_desc: "فاتورة مشتريات",
      warehouse_id: 1,
      incoming_qty: 100,
      outgoing_qty: 0,
      cost: 18.433180,
      sale_price: 100,
      currency: "YER",
      balance: 100
    }
  ];

  return (
    <div className="space-y-4 dir-rtl text-right font-sans bg-slate-100 dark:bg-slate-950 p-3 md:p-5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-xl">
      
      {/* Screen Title & Quick Actions */}
      <div className="bg-gradient-to-r from-teal-800 via-slate-900 to-indigo-950 text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 border border-teal-500/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/20 rounded-xl border border-teal-400/30 text-teal-300">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black">شاشة بطاقة الصنف والمواصفات الكاملة (Screen #50)</h1>
              <Badge className="bg-teal-500/30 text-teal-200 border-teal-400/40">نظام أومني سيستم برو ERP</Badge>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              إدخال وتوصيف المنتجات، المجموعات الهرمية، الرتب، أبعاد الصنف، حدود المخزون، وتحليلات معدل الدوران
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 text-white font-bold h-9 px-5 gap-1.5 shadow-md">
            <Save className="w-4 h-4" />
            حفظ بطاقة الصنف (F10)
          </Button>

          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10 h-9 px-3">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Screen Header Box (Matching Image 1 Header Exactly) */}
      <Card className="border-2 border-teal-600/40 bg-[#c2ecee] dark:bg-slate-900 dark:border-teal-800 shadow-inner">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-slate-900 dark:text-slate-100">
            
            {/* Left Box: Photo Upload Box (صورة الصنف - Image 1) */}
            <div className="md:col-span-3 flex flex-col items-center justify-center p-2 bg-white/80 dark:bg-slate-800 rounded-lg border border-teal-400">
              <div className="w-28 h-28 border-2 border-dashed border-teal-500 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50 relative group">
                {imageUrl ? (
                  <img src={imageUrl} alt="الصنف" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <Camera className="w-8 h-8 mx-auto mb-1 text-teal-600" />
                    <span className="text-[10px] font-bold block">صورة الصنف</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-[10px] bg-white" onClick={() => setImageUrl("/omnisystem-logo.png")}>
                  رفع صورة
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600 bg-white" onClick={() => setImageUrl("")}>
                  مسح
                </Button>
              </div>
            </div>

            {/* Right Fields: Header Inputs (Image 1) */}
            <div className="md:col-span-9 space-y-2 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">نوع الصنف:</Label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger className="h-8 bg-amber-50 font-bold border-teal-400"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1- سلعي">1- سلعي</SelectItem>
                      <SelectItem value="2- خدمي">2- خدمي</SelectItem>
                      <SelectItem value="3- تصنيعي">3- تصنيعي / مركب (BOM)</SelectItem>
                      <SelectItem value="4- خام">4- مادة خام مخزنية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">رقم المجموعة:</Label>
                  <Input value={mainGroupCode} onChange={(e) => setMainGroupCode(e.target.value)} className="w-16 h-8 bg-amber-50 font-bold text-center border-teal-400" />
                  <Input value={mainGroupName} onChange={(e) => setMainGroupName(e.target.value)} className="h-8 bg-amber-50 font-bold border-teal-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">رقم م. الفرعية:</Label>
                  <Input value={subGroupCode} onChange={(e) => setSubGroupCode(e.target.value)} className="w-16 h-8 bg-amber-50 font-bold text-center border-teal-400" />
                  <Input value={subGroupName} onChange={(e) => setSubGroupName(e.target.value)} className="h-8 bg-amber-50 font-bold border-teal-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">رقم م. تحت الفرعية:</Label>
                  <Input value={subSubGroupCode} onChange={(e) => setSubSubGroupCode(e.target.value)} className="w-16 h-8 bg-amber-50 font-bold text-center border-teal-400" />
                  <Input value={subSubGroupName} onChange={(e) => setSubSubGroupName(e.target.value)} className="h-8 bg-amber-50 font-bold border-teal-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0 text-red-600">رقم الصنف *:</Label>
                  <Input value={itemNumber} onChange={(e) => setItemNumber(e.target.value)} className="h-8 bg-amber-50 font-mono font-bold text-indigo-900 border-teal-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0 text-red-600">اسم الصنف *:</Label>
                  <Input value={itemName} onChange={(e) => setItemName(e.target.value)} className="h-8 bg-amber-50 font-black text-slate-900 border-teal-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">رقم الباركود:</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="h-8 bg-white font-mono border-teal-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">الاسم الأجنبي:</Label>
                  <Input value={foreignName} onChange={(e) => setForeignName(e.target.value)} className="h-8 bg-white dir-ltr text-left border-teal-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-24 font-bold shrink-0">م. المساعدة:</Label>
                  <Input value={auxGroupCode} onChange={(e) => setAuxGroupCode(e.target.value)} className="w-16 h-8 bg-white text-center border-teal-400" />
                  <Input value={auxGroupName} onChange={(e) => setAuxGroupName(e.target.value)} className="h-8 bg-white border-teal-400" />
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Navigation Bar (Matching Image 1 Toolbar Exactly) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-teal-300 dark:border-slate-800 scrollbar-thin text-xs">
        <button
          onClick={() => setActiveTab("main")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "main" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          البيانات الرئيسية (Image 1)
        </button>

        <button
          onClick={() => setActiveTab("units")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "units" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          Items Unit (الوحدات)
        </button>

        <button
          onClick={() => setActiveTab("limits")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "limits" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          الحدود (Image 2)
        </button>

        <button
          onClick={() => setActiveTab("movements")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "movements" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          الحركة (Image 2)
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "analytics" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          بيانات تحليلية (Images 3 & 4)
        </button>

        <button
          onClick={() => setActiveTab("turnover")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "turnover" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          معدل دوران المبيعات
        </button>

        <button
          onClick={() => setActiveTab("prices")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "prices" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          الأسعار والقوائم
        </button>

        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-3.5 py-2 rounded-t-lg font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "suppliers" ? "bg-teal-700 text-white border-teal-800 shadow" : "bg-white text-slate-700 hover:bg-teal-50"
          }`}
        >
          الموردين والمشتريات
        </button>
      </div>

      {/* TAB 1: البيانات الرئيسية (Image 1 Body Specs) */}
      {activeTab === "main" && (
        <Card className="border-2 border-teal-500/30 bg-[#c2ecee] dark:bg-slate-900 shadow-md">
          <CardContent className="p-5 space-y-4 text-xs text-slate-900 dark:text-slate-100">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Left Column: Dimensions, Specs & Storage */}
              <div className="md:col-span-8 space-y-3">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="w-28 font-bold shrink-0">مواصفات الصنف:</Label>
                    <Input value={specifications} onChange={(e) => setSpecifications(e.target.value)} className="h-8 bg-white border-teal-400 font-semibold" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="w-28 font-bold shrink-0">التكلفة الأولية:</Label>
                    <Input type="number" value={initialCost} onChange={(e) => setInitialCost(Number(e.target.value))} className="h-8 bg-amber-50 font-mono font-bold text-emerald-800 border-teal-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-24 font-bold shrink-0">الوحدة الافتراضية:</Label>
                    <Select value={defaultUnit} onValueChange={setDefaultUnit}>
                      <SelectTrigger className="h-8 bg-white border-teal-400"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="حبة">حبة / قطعة</SelectItem>
                        <SelectItem value="كرتون">كرتون</SelectItem>
                        <SelectItem value="درزن">درزن</SelectItem>
                        <SelectItem value="كجم">كجم</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="w-24 font-bold shrink-0">نشاط الصنف:</Label>
                    <Select value={itemActivity} onValueChange={setActivity}>
                      <SelectTrigger className="h-8 bg-white border-teal-400"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3- نشاط الكومبيوتر">3- نشاط الكومبيوتر والساعات</SelectItem>
                        <SelectItem value="1- نشاط تجاري">1- نشاط تجاري عام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="w-24 font-bold shrink-0">الرتبة:</Label>
                    <Select value={itemGrade} onValueChange={setGrade}>
                      <SelectTrigger className="h-8 bg-white border-teal-400"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2- جيد">2- ممتازة وجيد جداً</SelectItem>
                        <SelectItem value="1- ممتاز">1- درجات ممتازة أصلية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Specs Attributes: المقاس، اللون، الموسم، الخامات، الماركة */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-white/60 p-3 rounded-lg border border-teal-300">
                  <div>
                    <Label className="font-bold block mb-1">المقاس:</Label>
                    <Input value={sizeSpec} onChange={(e) => setSizeSpec(e.target.value)} className="h-8 bg-white" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">اللون:</Label>
                    <Input value={colorSpec} onChange={(e) => setColorSpec(e.target.value)} className="h-8 bg-white" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">الموسم:</Label>
                    <Input value={seasonSpec} onChange={(e) => setSeasonSpec(e.target.value)} className="h-8 bg-white" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">الخامة:</Label>
                    <Input value={materialSpec} onChange={(e) => setMaterialSpec(e.target.value)} className="h-8 bg-white" />
                  </div>
                </div>

                {/* Dimensions: الطول والعرض والارتفاع والحجم والوزن */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-white/60 p-3 rounded-lg border border-teal-300">
                  <div>
                    <Label className="font-bold block mb-1">الطول (مم):</Label>
                    <Input type="number" value={lengthMm} onChange={(e) => setLengthMm(Number(e.target.value))} className="h-8 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">العرض (مم):</Label>
                    <Input type="number" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} className="h-8 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">الارتفاع (مم):</Label>
                    <Input type="number" value={heightMm} onChange={(e) => setHeightMm(Number(e.target.value))} className="h-8 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">الحجم (م³):</Label>
                    <Input type="number" value={volumeM3} onChange={(e) => setVolumeM3(Number(e.target.value))} className="h-8 bg-white font-mono" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">الوزن (كيلو جرام):</Label>
                    <Input type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} className="h-8 bg-white font-mono font-bold text-indigo-900" />
                  </div>
                </div>

                {/* Stock Balances Row */}
                <div className="grid grid-cols-3 gap-2 bg-amber-50 p-3 rounded-lg border border-amber-300">
                  <div>
                    <Label className="font-bold block mb-1">المخزون الافتتاحي:</Label>
                    <Input type="number" value={openingStock} onChange={(e) => setOpeningStock(Number(e.target.value))} className="h-8 bg-white font-mono font-bold" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1 text-emerald-800">الكمية الحالية المتوفرة:</Label>
                    <Input type="number" value={currentQty} onChange={(e) => setCurrentQty(Number(e.target.value))} className="h-8 bg-emerald-100 font-mono font-black text-emerald-900 text-center text-sm" />
                  </div>
                  <div>
                    <Label className="font-bold block mb-1">متوسط التكلفة الحسابي:</Label>
                    <Input type="number" value={avgCost} onChange={(e) => setAvgCost(Number(e.target.value))} className="h-8 bg-white font-mono font-bold" />
                  </div>
                </div>

              </div>

              {/* Right Column: Checkboxes Panel (Matching Image 1 Checkbox List) */}
              <div className="md:col-span-4 bg-white/70 dark:bg-slate-800 p-4 rounded-xl border border-teal-300 space-y-2.5">
                <Label className="font-black text-teal-900 dark:text-teal-200 block border-b pb-1 text-sm">
                  خيارات وسياسات الصنف (Checkboxes):
                </Label>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="use_weight" checked={useWeight} onCheckedChange={(c) => setUseWeight(Boolean(c))} />
                    <Label htmlFor="use_weight" className="cursor-pointer font-semibold">Use Weight (استخدام الميزان)</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="allow_dec" checked={allowDecimals} onCheckedChange={(c) => setAllowDecimals(Boolean(c))} />
                    <Label htmlFor="allow_dec" className="cursor-pointer font-semibold">السماح باستخدام الكسور</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="non_ret" checked={nonReturnable} onCheckedChange={(c) => setNonReturnable(Boolean(c))} />
                    <Label htmlFor="non_ret" className="cursor-pointer font-semibold">غير قابل للإرجاع</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="is_serv" checked={isService} onCheckedChange={(c) => setIsService(Boolean(c))} />
                    <Label htmlFor="is_serv" className="cursor-pointer font-semibold">صنف خدمي</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="sell_cash" checked={sellCashOnly} onCheckedChange={(c) => setSellCashOnly(Boolean(c))} />
                    <Label htmlFor="sell_cash" className="cursor-pointer font-semibold">يباع نقداً فقط</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="is_asset" checked={isFixedAsset} onCheckedChange={(c) => setIsFixedAsset(Boolean(c))} />
                    <Label htmlFor="is_asset" className="cursor-pointer font-semibold">أصل ثابت</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="is_imp" checked={isImported} onCheckedChange={(c) => setIsImported(Boolean(c))} />
                    <Label htmlFor="is_imp" className="cursor-pointer font-semibold">مستورد من الخارج</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="use_exp" checked={useExpiryDate} onCheckedChange={(c) => setUseExpiryDate(Boolean(c))} />
                    <Label htmlFor="use_exp" className="cursor-pointer font-semibold">استخدام تاريخ الانتهاء</Label>
                  </div>

                  <div className="flex items-center gap-2 bg-amber-100 p-1.5 rounded border border-amber-300">
                    <Checkbox id="use_batch" checked={useBatchLot} onCheckedChange={(c) => setUseBatchLot(Boolean(c))} />
                    <Label htmlFor="use_batch" className="cursor-pointer font-bold text-amber-900">☑️ استخدام رقم الدفعة / التشغيلة</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="use_acc" checked={useAccessories} onCheckedChange={(c) => setUseBatchAccessories(Boolean(c))} />
                    <Label htmlFor="use_acc" className="cursor-pointer font-semibold">استخدام الملحقات والأصناف البديلة</Label>
                  </div>
                </div>
              </div>

            </div>

          </CardContent>
        </Card>
      )}

      {/* TAB 2: الحدود والرقابة (Image 2 - Min/Max/Reorder Point Limits) */}
      {activeTab === "limits" && (
        <Card className="border-2 border-teal-500/30 bg-white shadow-md">
          <CardHeader className="bg-slate-50 border-b p-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
              <Scale className="w-5 h-5 text-indigo-600" />
              تحديد حدود ومستويات الرقابة على المخزون (Min / Max / Reorder Point)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-2">
                <Label className="font-bold text-rose-900 block text-sm">الحد الأعلى للمخزون (Max Stock):</Label>
                <Input type="number" value={maxStock} onChange={(e) => setMaxStock(Number(e.target.value))} className="bg-white font-mono font-bold text-rose-900 text-lg" />
                <p className="text-[11px] text-rose-700 leading-normal">
                  الحد الأقصى الذي يمكن توفره في المخازن من هذا الصنف طبقا لسياسة المنشأة وحركة الصنف.
                </p>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                <Label className="font-bold text-amber-900 block text-sm">حد الطلب (Reorder Point):</Label>
                <Input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} className="bg-white font-mono font-bold text-amber-900 text-lg" />
                <p className="text-[11px] text-amber-700 leading-normal">
                  نقطة إعادة الطلب من هذا الصنف التي يتم عندها تقديم طلب توريد كمية جديدة بواسطة أمين المخزن.
                </p>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-2">
                <Label className="font-bold text-emerald-900 block text-sm">كمية الطلب الافتراضية (Default Reorder Qty):</Label>
                <Input type="number" value={defaultReorderQty} onChange={(e) => setDefaultReorderQty(Number(e.target.value))} className="bg-white font-mono font-bold text-emerald-900 text-lg" />
                <p className="text-[11px] text-emerald-700 leading-normal">
                  الكمية التي يتم طلبها عند الشراء في كل مرة وتنزل تلقائياً في طلبات الشراء.
                </p>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: الحركة (Image 2 Movement Log Table) */}
      {activeTab === "movements" && (
        <Card className="border-2 border-teal-500/30 bg-white shadow-md">
          <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600" />
              سجل ورقابة حركة الصنف والكمية الواردة والمنصرفة والرصيد
            </CardTitle>

            <div className="flex items-center gap-2 text-xs">
              <span>من تاريخ:</span>
              <Input type="date" value={fromDateFilter} onChange={(e) => setFromDateFilter(e.target.value)} className="w-32 h-8 bg-white" />
              <span>إلى تاريخ:</span>
              <Input type="date" value={toDateFilter} onChange={(e) => setToDateFilter(e.target.value)} className="w-32 h-8 bg-white" />
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100 font-bold border-b">
                <tr>
                  <th className="p-2.5">رقم المستند</th>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">نوع المستند</th>
                  <th className="p-2.5 text-center">المخزن</th>
                  <th className="p-2.5 text-center text-emerald-700">الكمية الواردة</th>
                  <th className="p-2.5 text-center text-rose-700">الكمية المنصرفة</th>
                  <th className="p-2.5 text-center">التكلفة</th>
                  <th className="p-2.5 text-center">سعر البيع</th>
                  <th className="p-2.5 text-center">العملة</th>
                  <th className="p-2.5 text-center font-bold text-indigo-900">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-indigo-700">{m.document_number || `DOC-${m.id}`}</td>
                    <td className="p-2.5 font-mono">{m.created_at?.slice(0, 10) || "2025-11-02"}</td>
                    <td className="p-2.5 font-semibold">{m.type_desc || "فاتورة مشتريات"}</td>
                    <td className="p-2.5 text-center font-bold">{m.warehouse_id || 1}</td>
                    <td className="p-2.5 text-center font-bold text-emerald-700 font-mono">{m.incoming_qty || 100}</td>
                    <td className="p-2.5 text-center font-bold text-rose-700 font-mono">{m.outgoing_qty || 0}</td>
                    <td className="p-2.5 text-center font-mono">{m.cost || "18.43"}</td>
                    <td className="p-2.5 text-center font-mono">{m.sale_price || "100.00"}</td>
                    <td className="p-2.5 text-center">YER</td>
                    <td className="p-2.5 text-center font-black text-indigo-900 font-mono">{m.balance || "100"} YER</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: بيانات تحليلية (Images 3 & 4 Analytics Grid) */}
      {activeTab === "analytics" && (
        <Card className="border-2 border-teal-500/30 bg-[#c2ecee] dark:bg-slate-900 shadow-md">
          <CardHeader className="bg-teal-700 text-white p-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-300" />
              بيانات تحليلية شاملة - أسعار المبيعات والتكلفة والكميات (Images 3 & 4)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs text-slate-900 dark:text-slate-100">
            
            {/* Sales Prices Analytics Grid (Image 4 Top Box) */}
            <div className="bg-white/80 dark:bg-slate-800 p-4 rounded-xl border border-teal-300 space-y-3">
              <h3 className="font-black text-indigo-900 dark:text-indigo-200 border-b pb-1 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                1. استعراض حالة أسعار المبيعات (Sales Prices Status):
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-2.5 rounded border text-center">
                  <span className="text-slate-500 block">أعلى سعر بيع:</span>
                  <strong className="text-sm font-bold font-mono text-emerald-800">{pricingStats.maxSalePrice} YER</strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border text-center">
                  <span className="text-slate-500 block">أقل سعر بيع:</span>
                  <strong className="text-sm font-bold font-mono text-indigo-800">{pricingStats.minSalePrice} YER</strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border text-center">
                  <span className="text-slate-500 block">آخر سعر بيع:</span>
                  <strong className="text-sm font-bold font-mono text-amber-800">{pricingStats.lastSalePrice} YER</strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border text-center">
                  <span className="text-slate-500 block">متوسط سعر البيع:</span>
                  <strong className="text-sm font-bold font-mono text-cyan-800">{pricingStats.avgSalePrice} YER</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-[11px]">
                <div><span>رقم آخر فاتورة:</span> <strong className="font-mono">{pricingStats.lastInvoiceNumber}</strong></div>
                <div><span>نوع الفاتورة:</span> <strong>{pricingStats.lastInvoiceType}</strong></div>
                <div><span>تاريخ أول توريد:</span> <strong className="font-mono">{pricingStats.firstReceiptDate}</strong></div>
                <div><span>تاريخ آخر توريد:</span> <strong className="font-mono">{pricingStats.lastReceiptDate}</strong></div>
              </div>
            </div>

            {/* Quantity & Cost Analytics Grid (Image 4 Bottom Box) */}
            <div className="bg-white/80 dark:bg-slate-800 p-4 rounded-xl border border-teal-300 space-y-3">
              <h3 className="font-black text-indigo-900 dark:text-indigo-200 border-b pb-1 text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-600" />
                2. الكمية والتكلفة والمخزون المتوفر بالفرع (Quantity & Cost Analytics):
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-amber-50 p-2.5 rounded border">
                  <span className="text-slate-600 block">التكلفة الأولية:</span>
                  <strong className="font-mono font-bold text-amber-900">{quantitiesAndCosts.initialCost} YER</strong>
                </div>

                <div className="bg-emerald-50 p-2.5 rounded border">
                  <span className="text-slate-600 block">آخر سعر توريد:</span>
                  <strong className="font-mono font-bold text-emerald-900">{quantitiesAndCosts.lastReceiptCost} YER</strong>
                </div>

                <div className="bg-indigo-50 p-2.5 rounded border">
                  <span className="text-slate-600 block">متوسط التكلفة:</span>
                  <strong className="font-mono font-bold text-indigo-900">{quantitiesAndCosts.avgCost} YER</strong>
                </div>

                <div className="bg-cyan-50 p-2.5 rounded border">
                  <span className="text-slate-600 block">الكمية المتوفرة حالياً:</span>
                  <strong className="font-mono font-black text-cyan-900 text-sm">{quantitiesAndCosts.availableStock} حبة</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] bg-slate-50 p-3 rounded border">
                <div><span>إجمالي الكميات الواردة:</span> <strong className="font-mono">{quantitiesAndCosts.totalIncomingQty}</strong></div>
                <div><span>إجمالي الكميات المنصرفة:</span> <strong className="font-mono">{quantitiesAndCosts.totalOutgoingQty}</strong></div>
                <div><span>صافي المبيعات:</span> <strong className="font-mono">{quantitiesAndCosts.netSalesQty}</strong></div>
                <div><span>كميات أوامر الشراء المفتوحة:</span> <strong className="font-mono">{quantitiesAndCosts.openPurchaseOrdersQty}</strong></div>
                <div><span>الكمية في الطريق:</span> <strong className="font-mono">{quantitiesAndCosts.inTransitQty}</strong></div>
                <div><span>الكمية المتوفرة للمخزن:</span> <strong className="font-mono">{quantitiesAndCosts.availableForWarehouseQty}</strong></div>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* TAB 5: معدل دوران المبيعات (Images 3 & 4 Turnover Rates) */}
      {activeTab === "turnover" && (
        <Card className="border-2 border-teal-500/30 bg-white shadow-md">
          <CardHeader className="bg-slate-50 border-b p-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              معدل دوران الصنف في المخازن وعمر المخزون (Turnover & Age Analysis)
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-emerald-800 font-bold block">معدل دوران الصنف في المبيعات:</span>
                <strong className="text-2xl font-black font-mono text-emerald-900">{turnoverAndAge.salesTurnoverRatio}%</strong>
                <p className="text-[11px] text-emerald-700">نسبة دوران ونفاذ الكمية مقارنة بالمبيعات الكلية.</p>
              </div>

              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 space-y-1">
                <span className="text-indigo-800 font-bold block">عمر المخزون باليوم (Stock Age):</span>
                <strong className="text-2xl font-black font-mono text-indigo-900">{turnoverAndAge.stockAgeDays} يوم</strong>
                <p className="text-[11px] text-indigo-700">متوسط بقاء وجاهزية الصنف في المخزن.</p>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-1">
                <span className="text-amber-800 font-bold block">معدل البيع اليومي:</span>
                <strong className="text-2xl font-black font-mono text-amber-900">{turnoverAndAge.dailySalesAvg} حبة/يوم</strong>
                <p className="text-[11px] text-amber-700">الفترة المتوقعة لنفاذ الكمية: {turnoverAndAge.expectedStockoutDays} يوم.</p>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
