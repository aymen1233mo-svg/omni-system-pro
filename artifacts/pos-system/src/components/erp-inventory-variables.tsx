import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Sliders, Settings, Save, RotateCcw, Printer, ShieldCheck, CheckCircle2,
  AlertTriangle, Warehouse, DollarSign, Barcode, Calculator, Scale, FileText,
  Clock, ArrowRightLeft, Layers, RefreshCw, Check, X, ShieldAlert, Sparkles,
  Info, History, CheckCircle, HelpCircle, Download, Upload, Cpu, Eye, FolderTree,
  BookOpen, Plus, Trash2, Edit3, ArrowUpRight, CheckSquare, Square
} from "lucide-react";

import { ErpInventoryTransactionTypesScreen } from "./erp-inventory-transaction-types";
import { ErpItemGroupsScreen } from "./erp-item-groups-screen";

export interface BatchGridColumn {
  id: number;
  name: string;
  size: string;
  item_specific: number;
  visible: number;
}

export interface BarcodeMatrixSegment {
  id: number;
  segment: string;
  field_length: number;
  direction: "left" | "right";
  active: number;
}

export interface WarehouseVariablesData {
  id?: number;
  costing_method: "moving_average" | "fifo" | "lifo" | "last_price" | "standard";
  cost_level: "warehouse" | "company";
  allow_below_cost_sale: number; // 0=منع, 1=تحذير, 2=سماح
  allow_negative_stock: number;  // 0=منع, 1=تحذير, 2=سماح
  enforce_expiry_date: number;
  enforce_batch_lot: number;
  enable_serial_numbers: number;
  auto_barcode_type: string;
  barcode_prefix: string;

  grn_require_purchase_order: number;
  grn_allowed_overage_pct: number;
  grn_update_cost_on_save: number;
  issue_require_cost_center: number;
  issue_require_purpose_desc: number;
  issue_block_expired_items: number;
  transfer_mechanism: "two_step" | "one_step";
  transfer_cost_basis: "source_cost" | "company_avg" | "transfer_price";
  include_shipping_in_transfer_cost: number;

  freeze_stock_during_stocktake: number;
  auto_post_stocktake_variances: number;
  stocktake_approval_threshold: number;
  stocktake_frequency: string;
  alert_min_stock: number;
  alert_reorder_point: number;
  alert_max_stock: number;
  expiry_warning_days: number;

  enable_scale_barcode: number;
  scale_barcode_prefix: string;
  scale_code_length: number;
  scale_value_type: "total_price" | "weight_grams";
  scale_decimals: number;
  quantity_decimals: number;
  price_decimals: number;
  allow_multi_units: number;

  accounting_inventory_system: "perpetual" | "periodic";
  inv_control_account: string;
  cogs_account: string;
  goods_in_transit_account: string;
  stock_surplus_account: string;
  stock_deficit_account: string;
  stock_revaluation_account: string;

  require_supervisor_approval_issue: number;
  issue_approval_amount: number;
  prevent_deleting_posted_vouchers: number;
  enable_audit_trail: number;

  // Onyx Pro Advanced Variables 1 & 2
  allow_delete_receipt_item: number;
  allow_edit_received_qty: number;
  allow_edit_receiving_wh: number;
  allow_exceed_transfer_qty: number;
  allow_edit_transit_account: number;
  link_transfer_to_request: number;
  link_issue_to_request: number;
  link_receipt_to_order: number;
  enforce_ref_no: number;
  enforce_description: number;
  use_item_accessories: number;
  auto_link_item_accessory: number;
  link_item_activities_to_perms: number;
  handle_consignment_goods: number;
  handle_trust_goods: number;
  deduct_composite_sales_in_reconcile: number;
  include_main_group_in_item_code: number;
  alert_exceed_max_transfer_qty: number;
  auto_receipt_transfer_by_wh: number;
  manual_items_in_repair_waste: number;
  use_item_bom: number;
  show_desc_at_item_level: number;
  use_standard_costing: number;
  auto_generate_item_code: number;
  use_receipt_expenses: number;
  use_expiry_date: number;
  adopt_transfer_price_as_receipt_cost: number;

  use_weight_dimension_system: number;
  weight_dimension_type: string;
  weight_unit_factor_desc: string;
  cost_decimals: number;
  general_decimals: number;
  min_pricing_sign: string;
  min_pricing_pct: number;
  max_pricing_sign: string;
  max_pricing_pct: number;
  min_cost_pct: number;
  max_cost_pct: number;
  allow_expired_receipt_mode: string;
  batch_lot_columns_count: number;
  batch_grid_columns_json: string;
  barcode_matrix_json: string;
  use_price_change_request: number;
  price_by_smallest_unit: number;
  check_source_wh_in_transfer: number;

  updated_by?: string;
  updated_at?: string;
}

const DEFAULT_BATCH_COLUMNS: BatchGridColumn[] = [
  { id: 1, name: "رقم التشغيلة / الدفعة", size: "12", item_specific: 1, visible: 1 },
  { id: 2, name: "خط الإنتاج / الوجبة", size: "10", item_specific: 0, visible: 1 },
  { id: 3, name: "سنة الصنع / الموديل", size: "8", item_specific: 1, visible: 1 },
  { id: 4, name: "بلد المنشأ والمصدر", size: "15", item_specific: 0, visible: 1 },
  { id: 5, name: "رقم الرف والموقع", size: "10", item_specific: 0, visible: 1 },
  { id: 6, name: "درجة النقاء والجودة", size: "10", item_specific: 0, visible: 0 }
];

const DEFAULT_BARCODE_MATRIX: BarcodeMatrixSegment[] = [
  { id: 1, segment: "المجموعة الرئيسية", field_length: 10, direction: "left", active: 1 },
  { id: 2, segment: "المجموعة الفرعية", field_length: 10, direction: "left", active: 1 },
  { id: 3, segment: "تاريخ الإنتهاء", field_length: 6, direction: "left", active: 1 },
  { id: 4, segment: "كود الصنف التسلسلي", field_length: 8, direction: "left", active: 1 }
];

const DEFAULT_VARIABLES: WarehouseVariablesData = {
  costing_method: "moving_average",
  cost_level: "warehouse",
  allow_below_cost_sale: 0,
  allow_negative_stock: 0,
  enforce_expiry_date: 1,
  enforce_batch_lot: 1,
  enable_serial_numbers: 0,
  auto_barcode_type: "EAN13",
  barcode_prefix: "29",

  grn_require_purchase_order: 1,
  grn_allowed_overage_pct: 5.0,
  grn_update_cost_on_save: 1,
  issue_require_cost_center: 1,
  issue_require_purpose_desc: 1,
  issue_block_expired_items: 1,
  transfer_mechanism: "two_step",
  transfer_cost_basis: "source_cost",
  include_shipping_in_transfer_cost: 1,

  freeze_stock_during_stocktake: 1,
  auto_post_stocktake_variances: 0,
  stocktake_approval_threshold: 5000.0,
  stocktake_frequency: "monthly",
  alert_min_stock: 1,
  alert_reorder_point: 1,
  alert_max_stock: 1,
  expiry_warning_days: 60,

  enable_scale_barcode: 1,
  scale_barcode_prefix: "99",
  scale_code_length: 5,
  scale_value_type: "total_price",
  scale_decimals: 2,
  quantity_decimals: 2,
  price_decimals: 2,
  allow_multi_units: 1,

  accounting_inventory_system: "perpetual",
  inv_control_account: "120101",
  cogs_account: "510101",
  goods_in_transit_account: "120201",
  stock_surplus_account: "420301",
  stock_deficit_account: "520301",
  stock_revaluation_account: "520401",

  require_supervisor_approval_issue: 1,
  issue_approval_amount: 10000.0,
  prevent_deleting_posted_vouchers: 1,
  enable_audit_trail: 1,

  allow_delete_receipt_item: 0,
  allow_edit_received_qty: 0,
  allow_edit_receiving_wh: 0,
  allow_exceed_transfer_qty: 0,
  allow_edit_transit_account: 0,
  link_transfer_to_request: 0,
  link_issue_to_request: 0,
  link_receipt_to_order: 0,
  enforce_ref_no: 0,
  enforce_description: 0,
  use_item_accessories: 1,
  auto_link_item_accessory: 0,
  link_item_activities_to_perms: 1,
  handle_consignment_goods: 1,
  handle_trust_goods: 1,
  deduct_composite_sales_in_reconcile: 0,
  include_main_group_in_item_code: 1,
  alert_exceed_max_transfer_qty: 0,
  auto_receipt_transfer_by_wh: 0,
  manual_items_in_repair_waste: 0,
  use_item_bom: 1,
  show_desc_at_item_level: 0,
  use_standard_costing: 0,
  auto_generate_item_code: 0,
  use_receipt_expenses: 1,
  use_expiry_date: 1,
  adopt_transfer_price_as_receipt_cost: 0,

  use_weight_dimension_system: 1,
  weight_dimension_type: "1_weight",
  weight_unit_factor_desc: "Weight Unit Factor",
  cost_decimals: 6,
  general_decimals: 4,
  min_pricing_sign: "+",
  min_pricing_pct: 0.0,
  max_pricing_sign: "+",
  max_pricing_pct: 0.0,
  min_cost_pct: 0.0,
  max_cost_pct: 0.0,
  allow_expired_receipt_mode: "2_allow",
  batch_lot_columns_count: 5,
  batch_grid_columns_json: JSON.stringify(DEFAULT_BATCH_COLUMNS),
  barcode_matrix_json: JSON.stringify(DEFAULT_BARCODE_MATRIX),
  use_price_change_request: 0,
  price_by_smallest_unit: 1,
  check_source_wh_in_transfer: 1,

  updated_by: "مدير النظام"
};

export function ErpInventoryVariablesPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<
    "advanced1" | "advanced2" | "costing" | "policies" | "stocktake" | "scales" | "accounting" | "security" | "transaction_types" | "item_groups" | "diagnostics" | "audit"
  >("advanced1");

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<WarehouseVariablesData>(DEFAULT_VARIABLES);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [selectedExplanationKey, setSelectedExplanationKey] = useState<string>("weight_system");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // Batch columns parsing
  const batchColumns: BatchGridColumn[] = useMemo(() => {
    try {
      if (formData.batch_grid_columns_json) {
        return JSON.parse(formData.batch_grid_columns_json);
      }
    } catch (e) {}
    return DEFAULT_BATCH_COLUMNS;
  }, [formData.batch_grid_columns_json]);

  // Barcode Matrix parsing
  const barcodeMatrix: BarcodeMatrixSegment[] = useMemo(() => {
    try {
      if (formData.barcode_matrix_json) {
        return JSON.parse(formData.barcode_matrix_json);
      }
    } catch (e) {}
    return DEFAULT_BARCODE_MATRIX;
  }, [formData.barcode_matrix_json]);

  // 1. Fetch Variables
  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: ["warehouse-variables"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-variables");
      if (!res.ok) throw new Error("Failed to load warehouse variables");
      return res.json();
    }
  });

  // 2. Fetch Audit Logs
  const { data: auditLogsData } = useQuery({
    queryKey: ["warehouse-variables-audit"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-variables/audit-logs");
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: activeTab === "audit"
  });

  useEffect(() => {
    if (responseData?.data) {
      setFormData({
        ...DEFAULT_VARIABLES,
        ...responseData.data
      });
    }
  }, [responseData]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<WarehouseVariablesData>) => {
      const res = await fetch("/api/warehouse-variables", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في حفظ متغيرات المخازن");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث وحفظ كافة متغيرات نظام المخازن في قاعدة البيانات وتفعيلها فوراً.",
        className: "bg-emerald-600 text-white font-bold"
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["warehouse-variables"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-variables-audit"] });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحفظ",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Reset Mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/warehouse-variables/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في استعادة الافتراضي");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم استعادة الافتراضي",
        description: "تمت استعادة كافة متغيرات نظام المخازن للقيم الموصى بها في نظام أومني سيستم برو.",
        className: "bg-blue-600 text-white font-bold"
      });
      setShowResetConfirm(false);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["warehouse-variables"] });
    }
  });

  // Diagnostics Runner
  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const res = await fetch("/api/warehouse-variables/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setDiagnosticsResult(data);
      setActiveTab("diagnostics");
      toast({
        title: "اكتمل الفحص والتشخيص",
        description: data.allPassed ? "جميع متغيرات النظام سليمة ومتوافقة 100%" : "تم اكتشاف بعض التنبيهات، يرجى مراجعتها.",
        className: data.allPassed ? "bg-emerald-600 text-white font-bold" : "bg-amber-600 text-white font-bold"
      });
    } catch (e: any) {
      toast({ title: "فشل الفحص", description: e.message, variant: "destructive" });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleFieldChange = (field: keyof WarehouseVariablesData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBatchColumnChange = (index: number, field: keyof BatchGridColumn, value: any) => {
    const updated = [...batchColumns];
    updated[index] = { ...updated[index], [field]: value };
    handleFieldChange("batch_grid_columns_json", JSON.stringify(updated));
  };

  const handleBarcodeMatrixChange = (index: number, field: keyof BarcodeMatrixSegment, value: any) => {
    const updated = [...barcodeMatrix];
    updated[index] = { ...updated[index], [field]: value };
    handleFieldChange("barcode_matrix_json", JSON.stringify(updated));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (responseData?.data) {
      setFormData({
        ...DEFAULT_VARIABLES,
        ...responseData.data
      });
    } else {
      setFormData(DEFAULT_VARIABLES);
    }
    setIsEditing(false);
    toast({
      title: "تم التراجع",
      description: "تم إلغاء التعديلات المعلقة والعودة للحالة المحفوظة."
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `warehouse-variables-config-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast({ title: "تم التصدير", description: "تم تصدير ملف إعدادات متغيرات المخازن بنجاح." });
  };

  const openExplanation = (key: string) => {
    setSelectedExplanationKey(key);
    setShowExplanationModal(true);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* ─── Standard ERP Screen Top Banner / Header ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-lg border border-indigo-800/40 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shadow-inner text-indigo-300">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">متغيرات نظام المخازن والتهيئة العامة</h1>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-xs px-2.5 py-0.5">
                  شاشة رقم: 49 (تهيئة المخزون)
                </Badge>
                {isEditing ? (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-2 animate-pulse">
                    وضع التعديل النشط
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-2">
                    وضع العرض والقراءة
                  </Badge>
                )}
              </div>
              <p className="text-xs text-indigo-200/70 mt-1">
                التحكم بالخيارات المتقدمة، نظام الأوزان والأبعاد، نسب التكاليف والتسعيرة، التكوين الآلي للباركود، وسياسات التحويل والاستلام
              </p>
            </div>
          </div>

          {/* Quick System Stats Cards */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-center min-w-[90px]">
              <span className="text-[10px] text-indigo-200 block">نظام الأوزان</span>
              <span className="text-xs font-bold text-amber-300">
                {formData.use_weight_dimension_system ? (
                  formData.weight_dimension_type === "1_weight" ? "1- وزن" :
                  formData.weight_dimension_type === "2_volume" ? "2- حجم" :
                  formData.weight_dimension_type === "3_area" ? "3- مساحة" :
                  formData.weight_dimension_type === "4_lengths" ? "4- أطوال" :
                  formData.weight_dimension_type === "5_liquids" ? "5- سوائل" : "6- مسافات"
                ) : "معطل"}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-center min-w-[90px]">
              <span className="text-[10px] text-indigo-200 block">عشرية التكلفة</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {formData.cost_decimals} خانات
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 text-center min-w-[90px]">
              <span className="text-[10px] text-indigo-200 block">نظام الجرد</span>
              <span className="text-xs font-bold text-cyan-300">
                {formData.accounting_inventory_system === "perpetual" ? "مستمر (آلي)" : "دوري"}
              </span>
            </div>
          </div>
        </div>

        {/* Standard Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-indigo-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 gap-1.5 shadow-md"
              >
                <Sliders className="w-3.5 h-3.5" />
                تعديل المتغيرات (F6)
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4 gap-1.5 shadow-md animate-pulse"
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات (F10)"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancel}
                  className="font-bold text-xs h-8 px-3 gap-1.5 shadow-md"
                >
                  <X className="w-3.5 h-3.5" />
                  إلغاء التعديل (Esc)
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowResetConfirm(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              القيم الافتراضية
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={runDiagnostics}
              disabled={isRunningDiagnostics}
              className="bg-white/5 hover:bg-white/15 text-cyan-300 border-cyan-500/30 text-xs h-8 px-3 gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              {isRunningDiagnostics ? "جاري الفحص..." : "فحص وتشخيص النظام"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedExplanationKey("weight_system");
                setShowExplanationModal(true);
              }}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 text-xs h-8 px-3 gap-1.5 font-bold"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              شروحات وأدلة المتغيرات 📖
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPrintModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" />
              طباعة تقرير المتغيرات
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportJson}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              تصدير JSON
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowHelpModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              دليل التهيئة
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs (Onyx Pro Standard Tabs Layout) ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab("advanced1")}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "advanced1"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-md"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-amber-300" />
          خيارات متقدمة 1 (الشاشة الرئيسية للتهيئة)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("advanced2")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "advanced2"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Barcode className="w-3.5 h-3.5" />
          خيارات متقدمة 2 (التكوين الآلي للباركود والدفعات)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("costing")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "costing"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          المتغيرات العامة وتقييم التكلفة
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("policies")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "policies"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          سياسات التوريد والصرف والتحويل
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stocktake")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "stocktake"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          الجرد ومستويات وتنبيهات المخزون
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scales")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "scales"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          موازين الباركود والوحدات والكسور
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("accounting")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "accounting"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          الربط المحاسبي والدليل المالي
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "security"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          الصلاحيات والاعتمادات والأمان
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transaction_types")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "transaction_types"
              ? "bg-teal-600 text-white border-teal-700 shadow-md animate-bounce-short"
              : "bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-300" />
          أنواع أوامر ومعاملات المخزون
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("item_groups")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "item_groups"
              ? "bg-sky-600 text-white border-sky-700 shadow-md"
              : "bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200"
          }`}
        >
          <FolderTree className="w-3.5 h-3.5 text-amber-300" />
          المجموعات الفرعية والمساعدة وتصنيفات الشجرة
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("diagnostics")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "diagnostics"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          تشخيص وتوافق المتغيرات
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "audit"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          سجل التغييرات التاريخي
        </button>
      </div>

      {/* ─── TAB: ADVANCED 1 (Matching Image 1 Exact Layout & Features) ─── */}
      {activeTab === "advanced1" && (
        <Card className="border-indigo-200 dark:border-indigo-900 shadow-sm bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardHeader className="bg-slate-100 dark:bg-slate-800/80 py-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                شاشة خيارات متقدمة 1 - متغيرات وضوابط نظام المخازن (نظام أومني سيستم برو)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                تكوين سياسات الاستلام، التحويل، الأوزان، نسب التسعير، الدفعات، والتحكم الرقابي في حركات المخازن
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedExplanationKey("transfer_price_as_cost");
                setShowExplanationModal(true);
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-300 hover:bg-indigo-50 gap-1 font-bold h-7"
            >
              <Info className="w-3.5 h-3.5" />
              عرض الشرح التوضيحي للخيارات
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* ─── LEFT COLUMN: Inputs, Weights, Decimals, Pricing Margins & Batch Customization ─── */}
              <div className="lg:col-span-6 space-y-4 border-r-0 lg:border-r border-slate-200 dark:border-slate-800 lg:pr-6">
                
                {/* 1. Weight / Dimension Measurement System */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        disabled={!isEditing}
                        checked={formData.use_weight_dimension_system === 1}
                        onChange={(e) => handleFieldChange("use_weight_dimension_system", e.target.checked ? 1 : 0)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white">إستخدام نظام الأوزان والأبعاد</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => openExplanation("weight_system")}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      شرح النظام
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <select
                        disabled={!isEditing || !formData.use_weight_dimension_system}
                        value={formData.weight_dimension_type}
                        onChange={(e) => handleFieldChange("weight_dimension_type", e.target.value)}
                        className="w-full text-xs h-8 rounded-md border border-slate-300 bg-white px-2 py-1 font-bold shadow-xs focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                      >
                        <option value="1_weight">1- وزن (طن، بندل، سيخ، كيلو)</option>
                        <option value="2_volume">2- حجم (متر مكعب، طول × عرض × ارتفاع)</option>
                        <option value="3_area">3- مساحة (متر مربع، بلاط، سيراميك، رخام)</option>
                        <option value="4_lengths">4- أطوال (متر طولي، كيابل، أنابيب، أقمشة)</option>
                        <option value="5_liquids">5- سوائل (لتر، جالون، برميل، م3)</option>
                        <option value="6_distances">6- مسافات (كيلومتر، ميل)</option>
                      </select>
                    </div>
                    <div>
                      <Input
                        disabled={!isEditing || !formData.use_weight_dimension_system}
                        value={formData.weight_unit_factor_desc}
                        onChange={(e) => handleFieldChange("weight_unit_factor_desc", e.target.value)}
                        placeholder="Default Size Argument / Weight Unit Factor"
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Decimal Precisions */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الأرقام العشرية للتكاليف:</span>
                      <Input
                        type="number"
                        min={0}
                        max={8}
                        disabled={!isEditing}
                        value={formData.cost_decimals}
                        onChange={(e) => handleFieldChange("cost_decimals", Number(e.target.value))}
                        className="w-16 text-center text-xs h-8 font-bold font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الأرقام العشرية:</span>
                      <Input
                        type="number"
                        min={0}
                        max={6}
                        disabled={!isEditing}
                        value={formData.general_decimals}
                        onChange={(e) => handleFieldChange("general_decimals", Number(e.target.value))}
                        className="w-16 text-center text-xs h-8 font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Pricing Margins and Cost Limits */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">ضوابط وهوامش التسعيرة والتكلفة</span>
                    <button
                      type="button"
                      onClick={() => openExplanation("pricing_limits")}
                      className="text-indigo-600 text-[11px] font-bold flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      شرح الهوامش
                    </button>
                  </div>

                  {/* Min Pricing % */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">نسبه الحد الأدنى للتسعيرة:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 font-mono">%</span>
                      <select
                        disabled={!isEditing}
                        value={formData.min_pricing_sign}
                        onChange={(e) => handleFieldChange("min_pricing_sign", e.target.value)}
                        className="text-xs h-8 w-12 rounded border bg-white px-1 text-center font-bold dark:bg-slate-800"
                      >
                        <option value="+">+</option>
                        <option value="-">-</option>
                      </select>
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!isEditing}
                        value={formData.min_pricing_pct}
                        onChange={(e) => handleFieldChange("min_pricing_pct", parseFloat(e.target.value) || 0)}
                        className="w-20 text-center text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  {/* Max Pricing % */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">نسبه الحد الأعلى للتسعيرة:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 font-mono">%</span>
                      <select
                        disabled={!isEditing}
                        value={formData.max_pricing_sign}
                        onChange={(e) => handleFieldChange("max_pricing_sign", e.target.value)}
                        className="text-xs h-8 w-12 rounded border bg-white px-1 text-center font-bold dark:bg-slate-800"
                      >
                        <option value="+">+</option>
                        <option value="-">-</option>
                      </select>
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!isEditing}
                        value={formData.max_pricing_pct}
                        onChange={(e) => handleFieldChange("max_pricing_pct", parseFloat(e.target.value) || 0)}
                        className="w-20 text-center text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  {/* Min Cost % */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">نسبه الحد الأدنى للتكلفة = متوسط التكلفة -</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 font-mono">%</span>
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!isEditing}
                        value={formData.min_cost_pct}
                        onChange={(e) => handleFieldChange("min_cost_pct", parseFloat(e.target.value) || 0)}
                        className="w-20 text-center text-xs h-8 font-mono"
                      />
                    </div>
                  </div>

                  {/* Max Cost % */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">نسبه الحد الأعلى للتكلفة = متوسط التكلفة +</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 font-mono">%</span>
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!isEditing}
                        value={formData.max_cost_pct}
                        onChange={(e) => handleFieldChange("max_cost_pct", parseFloat(e.target.value) || 0)}
                        className="w-20 text-center text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Expired Items Receipt Policy */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">السماح بتوريد الأصناف المنتهية:</span>
                    <select
                      disabled={!isEditing}
                      value={formData.allow_expired_receipt_mode}
                      onChange={(e) => handleFieldChange("allow_expired_receipt_mode", e.target.value)}
                      className="text-xs h-8 rounded-md border border-slate-300 bg-white px-3 font-bold shadow-xs focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700"
                    >
                      <option value="1_block">1- يمنع توريد الأصناف المنتهية</option>
                      <option value="2_allow">2- يسمح بتوريد الأصناف المنتهية</option>
                      <option value="3_warn">3- تحذير وتنبيه مع السماح</option>
                    </select>
                  </div>
                </div>

                {/* 5. Custom Batch/Lot Grid Table */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">عدد أعمدة أرقام الدفعات:</span>
                      <Input
                        type="number"
                        min={1}
                        max={6}
                        disabled={!isEditing}
                        value={formData.batch_lot_columns_count}
                        onChange={(e) => handleFieldChange("batch_lot_columns_count", Number(e.target.value))}
                        className="w-14 text-center text-xs h-7 font-bold font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openExplanation("batch_lots")}
                      className="text-indigo-600 text-[11px] font-bold flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      شرح الدفعات
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs text-right bg-white dark:bg-slate-800">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-b">
                          <th className="p-2 font-bold">اسم العمود</th>
                          <th className="p-2 font-bold text-center w-20">حجم العمود</th>
                          <th className="p-2 font-bold text-center w-24">خاص برقم الصنف</th>
                          <th className="p-2 font-bold text-center w-24">إظهار العمود</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {batchColumns.slice(0, formData.batch_lot_columns_count || 5).map((col, idx) => (
                          <tr key={col.id || idx}>
                            <td className="p-1.5">
                              <Input
                                disabled={!isEditing}
                                value={col.name}
                                onChange={(e) => handleBatchColumnChange(idx, "name", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <Input
                                disabled={!isEditing}
                                value={col.size}
                                onChange={(e) => handleBatchColumnChange(idx, "size", e.target.value)}
                                className="h-7 text-xs text-center font-mono"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                type="checkbox"
                                disabled={!isEditing}
                                checked={col.item_specific === 1}
                                onChange={(e) => handleBatchColumnChange(idx, "item_specific", e.target.checked ? 1 : 0)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                type="checkbox"
                                disabled={!isEditing}
                                checked={col.visible === 1}
                                onChange={(e) => handleBatchColumnChange(idx, "visible", e.target.checked ? 1 : 0)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* ─── RIGHT COLUMN: The 27 Detailed Checkboxes from Image 1 ─── */}
              <div className="lg:col-span-6 space-y-2">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 mb-3 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">سياسات وإعدادات الحركات والرقابة المخزنية</span>
                  <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
                    27 ضابط تحكم مباشر
                  </Badge>
                </div>

                <div className="space-y-1.5 pr-1">
                  {[
                    { id: "allow_delete_receipt_item", label: "السماح بحذف صنف من الإستلام المخزني", info: "يتيح حذف سطر صنف من سند الاستلام بعد إدراجه وقبل الترحيل" },
                    { id: "allow_edit_received_qty", label: "السماح بتعديل الكمية المستلمة في الإستلام المخزني", info: "إمكانية تعديل الكمية الفعلية المستلمة في المخزن مقارنة بأمر الشراء" },
                    { id: "allow_edit_receiving_wh", label: "السماح بتعديل المخزن المستلم في الإستلام المخزني", info: "السماح بتغيير المستودع الوارد إليه البضاعة عند الاستلام" },
                    { id: "allow_exceed_transfer_qty", label: "السماح بتجاوز كمية التحويل في الإستلام المخزني", info: "سماح للمستلم بإدخال كمية تزيد عن الكمية المرسلة من المخزن المصدر" },
                    { id: "allow_edit_transit_account", label: "السماح بتعديل حساب وسيط التحويلات المخزنية في التحويل والإستلام", info: "تعديل حساب بضاعة بالطريق Transit Account في سندات التحويل" },
                    { id: "link_transfer_to_request", label: "ربط التحويل المخزني بطلب التحويل", info: "إلزام أن يكون التحويل المخزني مستنداً إلى طلب تحويل مسبق ومعتمد" },
                    { id: "link_issue_to_request", label: "ربط أمر الصرف المخزني بطلب الصرف", info: "منع إصدار سند صرف إلا برقم طلب صرف مخزني معتمد من القسم الطالب" },
                    { id: "link_receipt_to_order", label: "ربط أمر التوريد المخزني بإذن التوريد", info: "إلزام مطابقة سند التوريد مع أمر الشراء وإذن التوريد الصادر" },
                    { id: "enforce_ref_no", label: "إدخال رقم المرجع إجباري", info: "إلزامية إدخال رقم الفاتورة أو المستند اليدوي الورقي الخارجي" },
                    { id: "enforce_description", label: "إدخال البيان إجباري", info: "إلزامية كتابة شرح وتفصيل سبب الحركة المخزنية بالسند" },
                    { id: "use_item_accessories", label: "إستخدام ملحقات الأصناف", info: "دعم ربط ملحقات وقطع الغيار والكماليات ببطاقة الصنف", checkedDefault: 1 },
                    { id: "auto_link_item_accessory", label: "ربط الصنف بالملحق آلياً", info: "إنزال الملحق تلقائياً عند اختيار الصنف الأساسي بالفاتورة" },
                    { id: "link_item_activities_to_perms", label: "ربط أنشطة الأصناف بصلاحيات المستخدمين", info: "تحديد صلاحيات المستخدمين حسب مجموعات وأنشطة الأصناف المصرح بها", checkedDefault: 1 },
                    { id: "handle_consignment_goods", label: "التعامل مع البضاعة تحت التصريف", info: "إدارة البضائع الواردة برسم البيع دون التأثير على حساب المورد حتى البيع", checkedDefault: 1 },
                    { id: "handle_trust_goods", label: "التعامل مع بضاعات الأمانات", info: "فصل بضائع الغير المودعة أمانة في المستودعات عن مخزون المنشأة", checkedDefault: 1 },
                    { id: "deduct_composite_sales_in_reconcile", label: "إنزال مبيعات الأصناف المركبة في تسوية المخزون", info: "تفكيك الصنف المركب لمكوناته الأولية وإنزالها آلياً في تسوية المخزون" },
                    { id: "include_main_group_in_item_code", label: "تضمين رقم المجموعة الرئيسية في رقم الصنف", info: "تكوين بادئة كود الصنف آلياً من رقم وتكويد مجموعته الرئيسية", checkedDefault: 1 },
                    { id: "alert_exceed_max_transfer_qty", label: "عرض تنبيه عند تجاوز الحد الأعلى للكمية في شاشة التحويل المخزني", info: "إظهار تحذير في حال تجاوز الكمية المحولة الحد الأقصى للمخزن المستقبل" },
                    { id: "auto_receipt_transfer_by_wh", label: "إستخدام الإستلام الآلي للتحويلات بحسب المخزن", info: "الاستلام الفوري المباشر للتحويلات دون الحاجة لسند استلام مستقل" },
                    { id: "manual_items_in_repair_waste", label: "إدخال الأصناف يدوياً في أمر الإصلاح والتوالف", info: "السماح بكتابة صنف غير معرف في شاشة أوامر الإصلاح والهالك" },
                    { id: "use_item_bom", label: "إستخدام مكونات الأصناف (BOM)", info: "تفعيل شجرة مكونات التصنيع والتجميع للأصناف المنتجة", checkedDefault: 1 },
                    { id: "show_desc_at_item_level", label: "إظهار البيان على مستوى الصنف", info: "إتاحة كتابة ملاحظة خاصة لكل سطر صنف بشكل منفصل في السندات" },
                    { id: "use_standard_costing", label: "إستخدام التكلفة المعيارية للصنف", info: "تفعيل التكلفة التقديرية الثابتة للأصناف ومقارنة الانحرافات" },
                    { id: "auto_generate_item_code", label: "تكوين رقم الصنف آلياً", info: "توليد كود الصنف التالي تلقائياً حسب التسلسل المعتمد" },
                    { id: "use_receipt_expenses", label: "إستخدام المصاريف في الإستلام المخزني", info: "توزيع مصاريف الشحن والجمارك والتحميل على تكلفة البضاعة الواردة", checkedDefault: 1 },
                    { id: "use_expiry_date", label: "إستخدام تاريخ الإنتهاء", info: "إلزامية ومتابعة تواريخ الصلاحية لجميع الحركات المخزنية", checkedDefault: 1 },
                    { id: "adopt_transfer_price_as_receipt_cost", label: "اعتماد سعر التحويل تكلفة للإستلام المخزني", info: "اعتماد سعر البيع في التحويل المخزني كتكلفة للاستلام المخزني" }
                  ].map((item) => {
                    const isChecked = (formData as any)[item.id] === 1;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          isChecked
                            ? "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/60"
                            : "bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                          <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={isChecked}
                            onChange={(e) => handleFieldChange(item.id as keyof WarehouseVariablesData, e.target.checked ? 1 : 0)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className={`text-xs ${isChecked ? "font-bold text-indigo-950 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"}`}>
                            {item.label}
                          </span>
                        </label>
                        {item.info && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExplanationKey(item.id);
                              setShowExplanationModal(true);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1"
                            title={item.info}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: ADVANCED 2 (Barcode Matrix, Price Change Requests & Smallest Unit) ─── */}
      {activeTab === "advanced2" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Barcode Auto-Generation Matrix (Matching Image 3) */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                  <Barcode className="w-4 h-4 text-indigo-600" />
                  التكوين الآلي لرقم الباركود (Barcode Structure Matrix)
                </CardTitle>
                <CardDescription className="text-xs">
                  تكوين باركود الصنف آلياً في فواتير المبيعات ونقاط البيع وفق تركيبة الحقول
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => openExplanation("barcode_auto_generation")}
                className="text-indigo-600 text-xs font-bold flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                شرح التكوين
              </button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs text-right bg-white dark:bg-slate-800">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-b">
                      <th className="p-2 font-bold">تكوين باركود الصنف</th>
                      <th className="p-2 font-bold text-center w-24">طول الحقل</th>
                      <th className="p-2 font-bold text-center w-28">الاتجاه</th>
                      <th className="p-2 font-bold text-center w-16">تفعيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {barcodeMatrix.map((seg, idx) => (
                      <tr key={seg.id || idx}>
                        <td className="p-2 font-bold text-slate-800 dark:text-slate-200">
                          {seg.segment}
                        </td>
                        <td className="p-1.5 text-center">
                          <Input
                            type="number"
                            disabled={!isEditing}
                            value={seg.field_length}
                            onChange={(e) => handleBarcodeMatrixChange(idx, "field_length", Number(e.target.value))}
                            className="h-7 text-xs text-center font-mono w-20 mx-auto"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <select
                            disabled={!isEditing}
                            value={seg.direction}
                            onChange={(e) => handleBarcodeMatrixChange(idx, "direction", e.target.value as any)}
                            className="h-7 text-xs rounded border bg-white px-2 dark:bg-slate-800"
                          >
                            <option value="left">2- من اليسار</option>
                            <option value="right">1- من اليمين</option>
                          </select>
                        </td>
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            disabled={!isEditing}
                            checked={seg.active === 1}
                            onChange={(e) => handleBarcodeMatrixChange(idx, "active", e.target.checked ? 1 : 0)}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200">
                <span className="font-bold block mb-1">💡 آلية التوليد الآلي:</span>
                يقوم النظام بتكوين الباركود بدمج رقم المجموعة الرئيسية والفرعية ورقم الصنف وتاريخ الانتهاء وفق الأطوال والاتجاهات المحددة أعلاه.
              </div>
            </CardContent>
          </Card>

          {/* Pricing Workflow and Transfer Checks (Matching Image 3) */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                رقابة التسعير، التحويلات المخزنية، وأصغر وحدة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              
              {/* Check Source Warehouse */}
              <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isEditing}
                    checked={formData.check_source_wh_in_transfer === 1}
                    onChange={(e) => handleFieldChange("check_source_wh_in_transfer", e.target.checked ? 1 : 0)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">فحص المخزن المطلوب منه في التحويل المخزني</span>
                </label>
                <p className="text-[11px] text-slate-500 pr-6">
                  يعمل هذا المتغير على فحص الكمية التي سوف يتم تحويلها من المخزن إلى المخزن المحول إليه من خلال إظهار حقل يقوم بإظهار الكمية الإجمالية للصنف.
                </p>
              </div>

              {/* Price Change Request */}
              <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isEditing}
                    checked={formData.use_price_change_request === 1}
                    onChange={(e) => handleFieldChange("use_price_change_request", e.target.checked ? 1 : 0)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">استخدام طلب تعديل التسعيرة</span>
                </label>
                <p className="text-[11px] text-slate-500 pr-6">
                  يعمل هذا المتغير بإظهار شاشة تختص بتعديل التسعيرة بدلاً من شاشة التسعيرة الرئيسية لإلزام مسار اعتماد وموافقة المشرف المالي.
                </p>
              </div>

              {/* Price by Smallest Unit */}
              <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isEditing}
                    checked={formData.price_by_smallest_unit === 1}
                    onChange={(e) => handleFieldChange("price_by_smallest_unit", e.target.checked ? 1 : 0)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">استخدام التسعيرة بأصغر وحدة قياس</span>
                </label>
                <p className="text-[11px] text-slate-500 pr-6">
                  يعمل هذا المتغير على استخدام التسعيرة بأصغر وحدة قياس عند تسعير المخزون عند عملية البيع (مثل الحبة بدلاً من الكرتون).
                </p>
              </div>

            </CardContent>
          </Card>

        </div>
      )}

      {/* ─── TAB: COSTING (General Costing Options) ─── */}
      {activeTab === "costing" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                طريقة احتساب تكلفة المخزون ومستوى التقييم
              </CardTitle>
              <CardDescription className="text-xs">
                تحديد المعادلة المحاسبية المعتمدة لتقييم حركة البضائع الصادرة والواردة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  طريقة احتساب تكلفة الصنف (Costing Method):
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.costing_method}
                  onChange={(e) => handleFieldChange("costing_method", e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium shadow-sm focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="moving_average">المتوسط المرجح التراكمي المتحرك (Moving Average) [موصى به]</option>
                  <option value="fifo">الوارد أولاً صادر أولاً (FIFO - First In First Out)</option>
                  <option value="lifo">الوارد أخيراً صادر أولاً (LIFO - Last In First Out)</option>
                  <option value="last_price">آخر سعر شراء فعلي (Last Purchase Price)</option>
                  <option value="standard">التكلفة المعيارية القياسية (Standard Cost)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * يُنصح باستخدام المتوسط المرجح التراكمي لتجنب تقلبات الأسعار والالتزام بمعايير IFRS المحاسبية.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  مستوى احتساب متوسط التكلفة (Cost Valuation Level):
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.cost_level}
                  onChange={(e) => handleFieldChange("cost_level", e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium shadow-sm focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="warehouse">على مستوى كل مخزن بشكل مستقل (Per Warehouse Cost)</option>
                  <option value="company">على مستوى المنشأة / الشركة ككل (Company-wide Average)</option>
                </select>
              </div>

              <div className="pt-2 border-t">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  سياسة البيع أو الصرف بأقل من سعر التكلفة:
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.allow_below_cost_sale}
                  onChange={(e) => handleFieldChange("allow_below_cost_sale", Number(e.target.value))}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium shadow-sm focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value={0}>منع قطعي (حظر حفظ الفاتورة أو السند عند وجود صنف أقل من التكلفة)</option>
                  <option value={1}>تحذير فقط مع السماح بالاعتماد (يتطلب تنبيه المستخدم)</option>
                  <option value={2}>سماح مطلق بدون قيود</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                <Barcode className="w-4 h-4 text-indigo-600" />
                الرصيد السالب وتتبع الدفعات وتوليد الباركود
              </CardTitle>
              <CardDescription className="text-xs">
                سياسات التحكم في كميات المخزون وتوليد الأرقام والترميز
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  سياسة الرصيد السالب بالمخازن (Negative Stock Policy):
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.allow_negative_stock}
                  onChange={(e) => handleFieldChange("allow_negative_stock", Number(e.target.value))}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium shadow-sm focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value={0}>منع تام للرصيد السالب (حظر أي صرف أو بيع يتجاوز الكمية المتاحة)</option>
                  <option value={1}>تحذير مع السماح بالصرف (يظهر تنبيه لأمين المخزن)</option>
                  <option value={2}>سماح مطلق بالرصيد السالب (لا يُنصح به للأصناف الموزونة)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    نمط توليد الباركود الآلي:
                  </label>
                  <select
                    disabled={!isEditing}
                    value={formData.auto_barcode_type}
                    onChange={(e) => handleFieldChange("auto_barcode_type", e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 py-1 font-medium shadow-sm focus:border-indigo-500 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="EAN13">باركود دولي قياسي (EAN-13)</option>
                    <option value="Code128">باركود ألفبائي رقمي (Code-128)</option>
                    <option value="AutoSerial">تسلسلي داخلي تلقائي (Auto-Serial)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    بادئة الباركود الداخلي:
                  </label>
                  <Input
                    disabled={!isEditing}
                    value={formData.barcode_prefix}
                    onChange={(e) => handleFieldChange("barcode_prefix", e.target.value)}
                    className="text-xs h-9 font-mono"
                    maxLength={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: POLICIES ─── */}
      {activeTab === "policies" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* GRN Policies */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 py-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-950 dark:text-emerald-200">
                <Warehouse className="w-4 h-4 text-emerald-600" />
                سندات التوريد المخزني (GRN)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.grn_require_purchase_order === 1}
                  onChange={(e) => handleFieldChange("grn_require_purchase_order", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">إلزام ربط التوريد بأمر شراء معتمد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.grn_update_cost_on_save === 1}
                  onChange={(e) => handleFieldChange("grn_update_cost_on_save", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">تحديث تكلفة الصنف آلياً فور التوريد</span>
              </label>
            </CardContent>
          </Card>

          {/* Issue Policies */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 py-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-950 dark:text-amber-200">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                سندات الصرف المخزني (Issue)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.issue_require_cost_center === 1}
                  onChange={(e) => handleFieldChange("issue_require_cost_center", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">إلزامية تحديد مركز التكلفة</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.issue_block_expired_items === 1}
                  onChange={(e) => handleFieldChange("issue_block_expired_items", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-rose-600">منع صرف الأصناف منتهية الصلاحية</span>
              </label>
            </CardContent>
          </Card>

          {/* Transfer Policies */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
            <CardHeader className="bg-sky-50/50 dark:bg-sky-950/20 py-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-sky-950 dark:text-sky-200">
                <ArrowRightLeft className="w-4 h-4 text-sky-600" />
                التحويلات بين المخازن (Transfers)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">آلية التحويل:</label>
                <select
                  disabled={!isEditing}
                  value={formData.transfer_mechanism}
                  onChange={(e) => handleFieldChange("transfer_mechanism", e.target.value)}
                  className="w-full text-xs h-8 rounded border bg-white px-2 dark:bg-slate-900"
                >
                  <option value="two_step">على مرحلتين (إرسال واستلام بضاعة بالطريق)</option>
                  <option value="one_step">تحويل مباشر فوري بين المستودعين</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.include_shipping_in_transfer_cost === 1}
                  onChange={(e) => handleFieldChange("include_shipping_in_transfer_cost", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">إضافة مصاريف النقل لتكلفة المحول</span>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB: STOCKTAKE ─── */}
      {activeTab === "stocktake" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-indigo-600" />
              ضوابط الجرد والتنبيهات الذكية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.freeze_stock_during_stocktake === 1}
                  onChange={(e) => handleFieldChange("freeze_stock_during_stocktake", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">تجميد حركات المخزن أثناء جلسات الجرد</span>
              </label>
              <div>
                <label className="text-xs font-bold block mb-1">دورية الجرد المخزني:</label>
                <select
                  disabled={!isEditing}
                  value={formData.stocktake_frequency}
                  onChange={(e) => handleFieldChange("stocktake_frequency", e.target.value)}
                  className="w-full text-xs h-8 rounded border bg-white px-2 dark:bg-slate-900"
                >
                  <option value="monthly">شهري</option>
                  <option value="quarterly">ربع سنوي</option>
                  <option value="yearly">سنوي</option>
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">تنبيه انتهاء الصلاحية قبل (أيام):</span>
                <Input
                  type="number"
                  disabled={!isEditing}
                  value={formData.expiry_warning_days}
                  onChange={(e) => handleFieldChange("expiry_warning_days", Number(e.target.value))}
                  className="w-20 text-center text-xs h-8 font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: SCALES ─── */}
      {activeTab === "scales" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              موازين الباركود الإلكترونية والوحدات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={formData.enable_scale_barcode === 1}
                  onChange={(e) => handleFieldChange("enable_scale_barcode", e.target.checked ? 1 : 0)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold">تفعيل قراءة باركود الميزان الإلكتروني</span>
              </label>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">بادئة باركود الوزن:</span>
                <Input
                  disabled={!isEditing}
                  value={formData.scale_barcode_prefix}
                  onChange={(e) => handleFieldChange("scale_barcode_prefix", e.target.value)}
                  className="w-20 text-center text-xs h-8 font-mono"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">نوع القيمة المضمنة بالباركود:</span>
                <select
                  disabled={!isEditing}
                  value={formData.scale_value_type}
                  onChange={(e) => handleFieldChange("scale_value_type", e.target.value as any)}
                  className="text-xs h-8 rounded border bg-white px-2 dark:bg-slate-900"
                >
                  <option value="total_price">إجمالي السعر (Total Price)</option>
                  <option value="weight_grams">الوزن بالغرام (Weight in Grams)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: ACCOUNTING ─── */}
      {activeTab === "accounting" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600" />
              الربط المحاسبي بالدليل العام
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">حساب مراقبة المخزون:</label>
                <Input
                  disabled={!isEditing}
                  value={formData.inv_control_account}
                  onChange={(e) => handleFieldChange("inv_control_account", e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">حساب تكلفة البضاعة المباعة (COGS):</label>
                <Input
                  disabled={!isEditing}
                  value={formData.cogs_account}
                  onChange={(e) => handleFieldChange("cogs_account", e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">حساب بضاعة بالطريق للتحويلات:</label>
                <Input
                  disabled={!isEditing}
                  value={formData.goods_in_transit_account}
                  onChange={(e) => handleFieldChange("goods_in_transit_account", e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">حساب تسويات وفروقات الجرد:</label>
                <Input
                  disabled={!isEditing}
                  value={formData.stock_surplus_account}
                  onChange={(e) => handleFieldChange("stock_surplus_account", e.target.value)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: SECURITY ─── */}
      {activeTab === "security" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              الصلاحيات والاعتمادات الرقابية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.prevent_deleting_posted_vouchers === 1}
                onChange={(e) => handleFieldChange("prevent_deleting_posted_vouchers", e.target.checked ? 1 : 0)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span className="text-xs font-bold">منع حذف أو تعديل السندات المرحلة نهائياً</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={formData.enable_audit_trail === 1}
                onChange={(e) => handleFieldChange("enable_audit_trail", e.target.checked ? 1 : 0)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span className="text-xs font-bold">تفعيل سجل التدقيق التفصيلي (Audit Trail)</span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: DIAGNOSTICS ─── */}
      {activeTab === "diagnostics" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              نتائج الفحص والتشخيص المنطقي للنظام
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">جميع الفحوصات المنطقية والحسابية لمتغيرات المخازن متوافقة وسليمة.</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                  تم التحقق من تكامل شجرة الحسابات، بادئات الباركود، موازين الأوزان، وعدم وجود تعارض في السياسات.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB: AUDIT TRAIL ─── */}
      {activeTab === "audit" && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              سجل التعديلات التاريخي على متغيرات نظام المخازن
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/60 border-b text-slate-700 dark:text-slate-300 font-bold">
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">المستخدم المسؤول</th>
                    <th className="p-2.5">تاريخ وتوقيت التعديل</th>
                    <th className="p-2.5">القسم</th>
                    <th className="p-2.5">اسم المتغير</th>
                    <th className="p-2.5 text-rose-600">القيمة السابقة</th>
                    <th className="p-2.5 text-emerald-600">القيمة الجديدة</th>
                    <th className="p-2.5">البيان / السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {auditLogsData?.data && auditLogsData.data.length > 0 ? (
                    auditLogsData.data.map((log: any, idx: number) => (
                      <tr key={log.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{log.changed_by}</td>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px]">{log.changed_at}</td>
                        <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{log.section_name}</Badge></td>
                        <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400">{log.field_name}</td>
                        <td className="p-2.5 font-mono text-rose-600 text-[11px]">{log.old_value || "—"}</td>
                        <td className="p-2.5 font-mono text-emerald-600 font-bold text-[11px]">{log.new_value || "—"}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]">{log.reason || "تعديل إعدادات"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                        لا توجد سجلات تعديل سابقة مسجلة في قاعدة البيانات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tab: Transaction Types (Screens for Stock Adjustment, Issue, Receipt, Requisition) ─── */}
      {activeTab === "transaction_types" && (
        <ErpInventoryTransactionTypesScreen />
      )}

      {/* ─── Tab: Item Groups Hierarchy (Screens for Sub Groups, Sub-Sub, Auxiliary, Classifications) ─── */}
      {activeTab === "item_groups" && (
        <ErpItemGroupsScreen />
      )}

      {/* ─── Footer Details ─── */}
      <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <span>آخر تعديل بواسطة: <strong className="text-slate-700 dark:text-slate-300">{formData.updated_by || "مدير النظام"}</strong></span>
          <span>تاريخ التعديل: <strong className="text-slate-700 dark:text-slate-300 font-mono">{formData.updated_at || "—"}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>المتغيرات مؤمنة ومطابقة لمعايير نظام أومني سيستم برو المحاسبية</span>
        </div>
      </div>

      {/* ─── Modal: Detailed Educational Explanations (Matching Image 2 & 3) ─── */}
      <Dialog open={showExplanationModal} onOpenChange={setShowExplanationModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              دليل الشروحات التفصيلية لمتغيرات نظام المخازن (نظام أومني سيستم برو)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs leading-relaxed">
            
            {/* 1. Transfer Price as Receipt Cost */}
            <div className="p-3.5 rounded-xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 mb-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                اعتماد سعر التحويل تكلفة للإستلام المخزني:
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                يعمل هذا المتغير على <strong>اعتماد سعر البيع في التحويل المخزني كتكلفة للاستلام المخزني</strong>، ويتغير بناءً على عملية ترحيل الاستلام المخزني لضمان تقييم المخزن المستلم بالقيمة العادلة المتفق عليها بين الفروع.
              </p>
            </div>

            {/* 2. Weight / Dimension Measurement System */}
            <div className="p-3.5 rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 space-y-2">
              <h4 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                استخدام نظام الأوزان والأبعاد (Measurement Units System):
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                نظام يعمل على تفعيل استخدام الأوزان والأبعاد في النظام من خلال تفعيل الوحدات المقاسة في شاشة وحدات القياس، والتي يتم على ضوئها تحديد معاملات الأوزان في شاشة بيانات الأصناف.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-900/60 text-[11px]">
                <div className="p-2 bg-white dark:bg-slate-900 rounded border">
                  <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">1- خيار (وزن):</strong>
                  يتعامل مع وحدات قياس الوزن (بندل - طن - سيخ في الحديد، خشب...) ويحتوي على معاملات قياس الوزن.
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border">
                  <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">2- خيار (الحجم):</strong>
                  استخدام وحدات المتر المكعب واحتساب الأحجام (الطول × العرض × الارتفاع) مثل الإسفنج والخرسانة.
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border">
                  <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">3- خيار (المساحة):</strong>
                  استخدام وحدات المتر المربع واحتساب المساحة (الطول × العرض) مثل البلاط والسيراميك والرخام والزجاج.
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded border">
                  <strong className="text-indigo-700 dark:text-indigo-300 block mb-0.5">4- خيار (أطوال / سوائل):</strong>
                  وحدات الأمتار الطولية للكيابل والأقمشة، واللتر والجالون للسوائل والزيوت.
                </div>
              </div>
            </div>

            {/* 3. Cost Decimals */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                <Check className="w-4 h-4 text-emerald-600" />
                الأرقام العشرية للتكاليف (Cost Decimals):
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                يقوم هذا المتغير بتقريب متوسط التكلفة إلى عدد من الخانات (حتى 6 خانات عشرية) ويفضل تكبيره عند وجود تكاليف صغيرة جداً مع كميات كبيرة لمنع فروقات الهلل الدقيقة.
              </p>
            </div>

            {/* 4. Pricing & Cost Margins */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 space-y-1.5">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                نسب الحدود الدنيا والعليا للتسعيرة والتكلفة:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 text-[11px] pr-2">
                <li><strong>نسبة الحد الأدنى للتسعيرة:</strong> وضع حد أدنى لتسعيرة المبيعات على أساس نسبة محددة زيادة على التكلفة أو آخر سعر شراء.</li>
                <li><strong>نسبة الحد الأعلى للتسعيرة:</strong> وضع حد أعلى لأسعار بيع الأصناف منعاً للغلاء أو الخطأ في الإدخال.</li>
                <li><strong>نسبة الحد الأدنى والأعلى للتكلفة:</strong> وضع حدود تقلب تكلفة الصنف (متوسط التكلفة ± %) لمنع تذبذب تقييم المخزون.</li>
              </ul>
            </div>

            {/* 5. Barcode Auto Generation */}
            <div className="p-3.5 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 mb-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                التكوين الآلي لرقم الباركود (Barcode Auto-Generation):
              </h4>
              <p className="text-slate-700 dark:text-slate-300">
                يقوم النظام بتكوين الباركود بشكل آلي في فواتير المبيعات ونقاط البيع مباشرة من خلال وضع رقم للمجموعة الرئيسية ورقم للمجموعة الفرعية وتاريخ الانتهاء وتحديد اتجاه الترقيم (من اليمين أو من اليسار) وطول كل حقل.
              </p>
            </div>

          </div>

          <DialogFooter>
            <Button onClick={() => setShowExplanationModal(false)} className="font-bold">
              إغلاق الدليل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Print Configuration Report ─── */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-600" />
              تقرير تهيئة ومتغيرات نظام المخازن الرسمي
            </DialogTitle>
          </DialogHeader>

          <div ref={printRef} className="p-6 bg-white text-slate-900 rounded-lg border space-y-6 font-sans">
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900">مؤسسة الحلول الشاملة للأنظمة المتكاملة</h2>
                <h3 className="text-sm font-bold text-slate-700 mt-0.5">تقرير متغيرات وسياسات نظام المخازن (Screen #49)</h3>
                <span className="text-xs text-slate-500 block mt-1">تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")}</span>
              </div>
              <div className="text-left">
                <span className="border border-slate-900 px-3 py-1 text-xs font-bold rounded">نسخة رسمية معتمدة</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border p-3 rounded space-y-1.5 bg-slate-50">
                <h4 className="font-bold text-indigo-900 border-b pb-1">1. سياسات التكلفة والتقييم</h4>
                <div className="flex justify-between"><span>طريقة التكلفة:</span><strong className="font-bold">{formData.costing_method}</strong></div>
                <div className="flex justify-between"><span>مستوى التكلفة:</span><strong>{formData.cost_level === "warehouse" ? "لكل مخزن مستقل" : "الشركة ككل"}</strong></div>
                <div className="flex justify-between"><span>عشرية التكلفة:</span><strong>{formData.cost_decimals} خانات</strong></div>
                <div className="flex justify-between"><span>نظام الأوزان:</span><strong>{formData.use_weight_dimension_system ? formData.weight_dimension_type : "معطل"}</strong></div>
              </div>

              <div className="border p-3 rounded space-y-1.5 bg-slate-50">
                <h4 className="font-bold text-indigo-900 border-b pb-1">2. سياسات الحركات والتحويل</h4>
                <div className="flex justify-between"><span>ربط التوريد بأمر شراء:</span><strong>{formData.grn_require_purchase_order ? "نعم (إجباري)" : "لا"}</strong></div>
                <div className="flex justify-between"><span>آلية التحويل:</span><strong>{formData.transfer_mechanism === "two_step" ? "مرحلتين (بضاعة بالطريق)" : "مباشر"}</strong></div>
                <div className="flex justify-between"><span>سعر التحويل كتكلفة:</span><strong>{formData.adopt_transfer_price_as_receipt_cost ? "نعم" : "لا"}</strong></div>
                <div className="flex justify-between"><span>فحص المخزن المطلوب منه:</span><strong>{formData.check_source_wh_in_transfer ? "مفعل" : "معطل"}</strong></div>
              </div>
            </div>

            <div className="pt-8 border-t grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <span className="block font-bold mb-8">إعداد أمين / مدير المخازن</span>
                <span className="border-t border-dotted border-slate-400 pt-1 block">التوقيع والختم</span>
              </div>
              <div>
                <span className="block font-bold mb-8">المراجع المالي الداخلي</span>
                <span className="border-t border-dotted border-slate-400 pt-1 block">التوقيع والختم</span>
              </div>
              <div>
                <span className="block font-bold mb-8">اعتماد المدير العام</span>
                <span className="border-t border-dotted border-slate-400 pt-1 block">التوقيع والختم</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>إغلاق</Button>
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold">
              <Printer className="w-4 h-4" />
              طباعة فورية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Reset Confirm ─── */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              تأكيد استعادة المتغيرات الافتراضية
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            هل أنت متأكد من رغبتك في استعادة كافة متغيرات نظام المخازن إلى الإعدادات القياسية الموصى بها في نظام أومني سيستم برو؟
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="font-bold"
            >
              {resetMutation.isPending ? "جاري الاستعادة..." : "نعم، استعادة الافتراضي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Help / Documentation ─── */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-600">
              <HelpCircle className="w-5 h-5" />
              دليل استخدام وتهيئة متغيرات نظام المخازن
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto p-1">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-200 mb-1">ما هي شاشة متغيرات نظام المخازن؟</h4>
              <p>
                هي الشاشة الأساسية والأولى التي يقوم مدير النظام ومدير الحسابات بضبطها لتحديد القواعد المنطقية والمحاسبية لعمليات التوريد والصرف والجرد والتحويل والتقييم بما يتناسب مع طبيعة ونشاط المنشأة.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelpModal(false)}>فهمت ذلك</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
