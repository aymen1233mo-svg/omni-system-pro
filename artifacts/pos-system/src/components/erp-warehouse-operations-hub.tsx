import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRightLeft, FileCheck, Layers, FileText, CheckCircle2,
  Printer, Download, Plus, Trash2, Edit3, Save, RefreshCw,
  Search, ShieldAlert, FolderArchive, ArrowDownRight, ArrowUpRight,
  Calculator, Check, FileSpreadsheet, Eye, HelpCircle, Split, FileUp, ExternalLink,
  Maximize2, X, Filter, Tag, LayoutGrid, List
} from "lucide-react";
import { useGetProducts, useGetCategories } from "@workspace/api-client-react";
import { printA4Html } from "@/lib/printUtils";

export function ErpWarehouseOperationsHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    "archiving" | "multi_transfer" | "standard_transfer" | "transfer_receipt" | "stock_adjustment"
  >("archiving");

  // Full screen browser states
  const [showFullBrowser, setShowFullBrowser] = useState(false);
  const [showSafeBrowser, setShowSafeBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: allProducts = [] } = useGetProducts();
  const { data: allCategories = [] } = useGetCategories();

  const ITEM_TYPES = [
    { value: "sellable", label: "منتج للبيع المباشر", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "composite", label: "منتج مركب ذو وصفة (BOM)", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { value: "semi_finished", label: "صنف نصف مصنع", color: "bg-orange-50 text-orange-700 border-orange-200" },
    { value: "raw_material", label: "مادة خام مخزنية", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "packaging", label: "مواد تعبئة وتغليف", color: "bg-pink-50 text-pink-700 border-pink-200" },
    { value: "supplies", label: "مستلزمات تشغيل", color: "bg-slate-50 text-slate-700 border-slate-200" },
  ];

  const printPriceDirectory = () => {
    const grouped: Record<string, any[]> = {};
    
    const filteredProducts = (allProducts || []).filter((prod: any) => {
      const matchesSearch = searchQuery
        ? prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (prod.barcode && prod.barcode.includes(searchQuery)) ||
          String(prod.number).includes(searchQuery)
        : true;
        
      const matchesCategory = selectedCategory && selectedCategory !== "all"
        ? String(prod.categoryId) === String(selectedCategory)
        : true;

      const matchesItemType = selectedItemType && selectedItemType !== "all"
        ? prod.item_type === selectedItemType
        : true;
        
      return matchesSearch && matchesCategory && matchesItemType;
    });

    filteredProducts.forEach((prod: any) => {
      const catName = prod.categoryName || "أصناف عامة غير مصنفة";
      if (!grouped[catName]) {
        grouped[catName] = [];
      }
      grouped[catName].push(prod);
    });

    let contentHtml = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #0d9488; font-size: 20px; font-weight: 900;">دليل الأسعار وقائمة المنتجات الشاملة</h2>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">نظام أومني سيستم برو لإدارة المخازن والمستودعات والتركيبات</p>
      </div>
      
      <div style="margin-bottom: 15px; font-size: 11px; color: #475569; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        <div><strong>عدد الأصناف الإجمالي:</strong> ${filteredProducts.length} صنف متاح</div>
        <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString("ar-YE")} - ${new Date().toLocaleTimeString("ar-YE")}</div>
      </div>
    `;

    Object.entries(grouped).forEach(([catName, items]) => {
      contentHtml += `
        <div style="margin-top: 25px; margin-bottom: 10px; page-break-inside: avoid;">
          <h3 style="background-color: #0f766e; color: #ffffff; padding: 6px 12px; margin: 0; border-radius: 6px; font-size: 13px; font-weight: bold; display: inline-block;">
            📁 تصنيف: ${catName} (${items.length} منتج)
          </h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 100px;">رقم الصنف</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">اسم الصنف / المنتج</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 80px;">الوحدة</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 80px;">نوع الصنف</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 100px;">المخزون الحالي</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 110px;">سعر البيع</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 110px;">التكلفة</th>
            </tr>
          </thead>
          <tbody>
      `;

      items.forEach((item: any) => {
        const typeObj = ITEM_TYPES.find(t => t.value === item.item_type);
        const typeLabel = typeObj ? typeObj.label.split(" ")[0] : "سلعي";
        
        contentHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0; hover:background-color: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace; font-weight: bold; color: #0f766e;">${item.number || "—"}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e293b;">${item.name}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #475569;">${item.unit || "حبة"}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;"><span style="font-size: 10px; padding: 2px 6px; background-color: #f1f5f9; border-radius: 4px; color: #475569;">${typeLabel}</span></td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${(item.stock || 0) <= 0 ? '#dc2626' : '#16a34a'};">${item.stock || 0}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 900; color: #0d9488;" dir="ltr">${Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: bold; color: #475569;" dir="ltr">${item.cost ? Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س' : '—'}</td>
          </tr>
        `;
      });

      contentHtml += `
          </tbody>
        </table>
      `;
    });

    const signatureBlock = `
      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid;">
        <div style="text-align: center; width: 30%;">
          <p style="margin: 0; font-weight: bold;">أمين المستودع</p>
          <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 80%; margin-left: auto; margin-right: auto;"></div>
        </div>
        <div style="text-align: center; width: 30%;">
          <p style="margin: 0; font-weight: bold;">المراقب المالي</p>
          <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 80%; margin-left: auto; margin-right: auto;"></div>
        </div>
        <div style="text-align: center; width: 30%;">
          <p style="margin: 0; font-weight: bold;">مدير الفروع والمخازن</p>
          <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 80%; margin-left: auto; margin-right: auto;"></div>
        </div>
      </div>
    `;

    const cleanContent = contentHtml + signatureBlock;
    printA4Html(cleanContent, "دليل_الأسعار_والأصناف_أومني_سيستم_برو");
    toast({ title: "تم توليد ملف PDF بنجاح", description: "جاري فتح نافذة الطباعة لتوليد وحفظ ملف PDF" });
  };

  const printPublicPriceList = () => {
    const contentHtml = `
      <html>
        <head><title>دليل أسعار المنتجات</title>
        <style>
          body { font-family: sans-serif; direction: rtl; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
          h1 { text-align: center; }
        </style>
        </head>
        <body>
          <h1>دليل أسعار المنتجات</h1>
          <table>
            <thead><tr><th>اسم المنتج / الصنف</th><th>السعر</th></tr></thead>
            <tbody>
              ${allProducts.map((p: any) => `<tr><td>${p.name}</td><td>${p.price}</td></tr>`).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printA4Html(contentHtml, "دليل_أسعار_عام");
  };

  // --------------------------------------------------------------------------
  // TAB 1: DOCUMENT ARCHIVING & EXCEL EXPORT (Image 1)
  // --------------------------------------------------------------------------
  const [docSearch, setDocSearch] = useState("");
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedFilePreview, setSelectedFilePreview] = useState<any>(null);

  const [docFormData, setDocFormData] = useState({
    voucher_type: "1-9 أمر صرف مخزني",
    voucher_id: 1,
    file_no: "",
    file_date: new Date().toISOString().slice(0, 10),
    file_description: "",
    file_notes: "",
    document_type_code: "1-9 أمر صرف مخزني",
    file_name: "",
    file_size: "1.2 MB",
    file_mime: "application/msword"
  });

  const { data: archivedDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["document-archives", docSearch],
    queryFn: async () => {
      const res = await fetch(`/api/warehouse-hub/documents?search=${encodeURIComponent(docSearch)}`);
      if (!res.ok) throw new Error("فشل تحميل الأرشيف");
      return res.json();
    }
  });

  const addDocMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/warehouse-hub/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل إضافة الوثيقة");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الأرشفة", description: "تم أرشفة الوثيقة وإرفاقها بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["document-archives"] });
      setShowDocModal(false);
      setDocFormData({
        voucher_type: "1-9 أمر صرف مخزني",
        voucher_id: 1,
        file_no: "",
        file_date: new Date().toISOString().slice(0, 10),
        file_description: "",
        file_notes: "",
        document_type_code: "1-9 أمر صرف مخزني",
        file_name: "",
        file_size: "1.2 MB",
        file_mime: "application/msword"
      });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/warehouse-hub/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل حذف الوثيقة");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف الوثيقة المؤرشفة" });
      queryClient.invalidateQueries({ queryKey: ["document-archives"] });
    }
  });

  // Simulated Journal Grid for Excel Export (Matching Image 1)
  const sampleJournalRows = [
    { account_no: "2311010001", account_name: "نبيل الجعدي", analytical: "1001", debit: 0, credit: 6772500, f_debit: 0, f_credit: 31500, memo: "لكم أمر توريد مخزني" },
    { account_no: "1141010001", account_name: "مخزون الإدارة العامة صنعاء", analytical: "1001", debit: 6772500, credit: 0, f_debit: 31500, f_credit: 0, memo: "لكم أمر توريد مخزني" }
  ];

  const exportJournalToExcel = () => {
    let csv = "رقم الحساب,الاسم,الحساب التحليلي,مدين,دائن,مدين أجنبي,دائن أجنبي,البيان\n";
    sampleJournalRows.forEach(r => {
      csv += `"${r.account_no}","${r.account_name}","${r.analytical}",${r.debit},${r.credit},${r.f_debit},${r.f_credit},"${r.memo}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير_قيد_مستند_الصرف_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: "تصدير ناجح", description: "تم تصدير الجدول إلى إكسل بنجاح كما في الصورة 1" });
  };

  // --------------------------------------------------------------------------
  // TAB 2: MULTI-WAREHOUSE TRANSFER (Image 2)
  // --------------------------------------------------------------------------
  const { data: multiTransfers, isLoading: loadingMulti } = useQuery({
    queryKey: ["multi-transfers"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-hub/multi-transfers");
      if (!res.ok) throw new Error("فشل تحميل التحويلات المتعددة");
      return res.json();
    }
  });

  const [multiHeader, setMultiHeader] = useState({
    id: null,
    transfer_no: 33,
    transfer_date: "2015-11-29",
    branch_name: "1-الإدارة العامة",
    transfer_type: "1-تحويل مخزني",
    ref_no: "22",
    default_cost_center: "1101-المبيعات المعارض",
    default_warehouse_name: "1-مخزن التحرير",
    reason: "تغطية احتياجات الفروع والمستودعات الإقليمية",
    inv_reg_no: "215",
    project_no: "1201-مشروع المعارض",
    activity_no: "1101-نشاط المبيعات",
    statement: "تحويل مخزني متعدد من مخزن التحرير إلى عدة مخازن فرعية"
  });

  const [multiItems, setMultiItems] = useState<any[]>([
    { seq: 1, item_code: "001-1002", item_name: "سكر هندي عام 50 كيلو", from_warehouse_name: "1-مخزن التحرير", to_warehouse_name: "2-مخزن الحصبة", expiry_date: "2026-12-31", batch_no: "B-SUGAR-50", quantity: 100, supplier_code: "1001", supplier_name: "نبيل الجعدي" },
    { seq: 2, item_code: "001-1002", item_name: "سكر هندي عام 50 كيلو", from_warehouse_name: "1-مخزن التحرير", to_warehouse_name: "3-مخزن المعارض", expiry_date: "2026-12-31", batch_no: "B-SUGAR-50", quantity: 100, supplier_code: "1001", supplier_name: "نبيل الجعدي" }
  ]);

  const saveMultiMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/warehouse-hub/multi-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ التحويل المتعدد");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "تم الحفظ", description: "تم حفظ سند التحويل المخزني المتعدد بنجاح" });
      if (data?.id) {
        setMultiHeader(prev => ({ ...prev, id: data.id, transfer_no: data.transfer_no }));
      }
      queryClient.invalidateQueries({ queryKey: ["multi-transfers"] });
    }
  });

  const convertMultiMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/warehouse-hub/multi-transfers/${id}/convert`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل إنزال التحويل المتعدد");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "إنزال آلي بنجاح", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["multi-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["standard-transfers"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  // --------------------------------------------------------------------------
  // TAB 3: STANDARD WAREHOUSE TRANSFER (Image 3)
  // --------------------------------------------------------------------------
  const { data: stdTransfers } = useQuery({
    queryKey: ["standard-transfers"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-hub/standard-transfers");
      if (!res.ok) throw new Error("فشل تحميل التحويلات القياسية");
      return res.json();
    }
  });

  const [stdHeader, setStdHeader] = useState({
    id: null,
    transfer_no: 7,
    transfer_date: "2015-12-01",
    branch_name: "1-الإدارة العامة",
    from_warehouse_name: "1-مخزن التحرير",
    to_warehouse_name: "2-مخزن الحصبة",
    transfer_type: "1-تحويل مخزني",
    costing_method: "1-التكلفة",
    cost_center: "1101-المبيعات المعارض",
    activity_no: "1101-نافذة بيع كمبيوترات حدة",
    ref_no: "222",
    inv_reg_no: "215",
    project_no: "1201-مشروع الكمبيوترات",
    customer_name: "1010003-علي العمراني",
    statement: "تحويل أجهزة PC من مخزن التحرير إلى مخزن الحصبة حسب توجيه الإدارة العامة",
    reason: "وجود منافسة للمبتدئين وتلبية طلب المعرض",
    variance_account: "1168010001-وسيط التحويلات المخزنية",
    is_posted: false,
    is_deferred: false,
    is_pending: true,
    close_transferred_qty: false,
    receipt_type: "1-استلام مباشر"
  });

  const [stdItems, setStdItems] = useState<any[]>([
    { seq: 1, item_code: "000-0080", item_name: "جهاز PC ذكي متكامل", unit: "حبة", quantity: 22, package_size: 1, expiry_date: "2027-01-01", batch_no: "B-PC-100", supplier_code: "1001", supplier_name: "نبيل الجعدي", unit_cost: 204.55, total_cost: 4500.0 }
  ]);

  const saveStdMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/warehouse-hub/standard-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ التحويل المخزني");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "تم الحفظ", description: "تم حفظ سند التحويل المخزني القياسي بنجاح" });
      if (data?.id) {
        setStdHeader(prev => ({ ...prev, id: data.id, transfer_no: data.transfer_no }));
      }
      queryClient.invalidateQueries({ queryKey: ["standard-transfers"] });
    }
  });

  const postStdMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/warehouse-hub/standard-transfers/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error("فشل ترحيل سند التحويل");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم الترحيل المحاسبي", description: data.message });
      setStdHeader(prev => ({ ...prev, is_posted: true, is_pending: false }));
      queryClient.invalidateQueries({ queryKey: ["standard-transfers"] });
    }
  });

  // --------------------------------------------------------------------------
  // TAB 4: WAREHOUSE TRANSFER RECEIPT / GRN (Image 4)
  // --------------------------------------------------------------------------
  const { data: transferReceipts } = useQuery({
    queryKey: ["transfer-receipts"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-hub/transfer-receipts");
      if (!res.ok) throw new Error("فشل تحميل الاستلامات المخزنية");
      return res.json();
    }
  });

  const [rcptHeader, setRcptHeader] = useState({
    id: null,
    receipt_no: 10,
    receipt_date: "2015-12-02",
    branch_name: "1-الإدارة العامة",
    to_warehouse_name: "2-مخزن الحصبة",
    from_warehouse_name: "1-مخزن التحرير",
    ref_no: "215",
    cost_center: "1101-المبيعات المعارض",
    activity_no: "210-محطة طريق المطار",
    transfer_order_no: 7,
    intermediate_account: "1168010001-وسيط التحويلات المخزنية",
    receipt_type: "2-استلام / مرتجع",
    project_no: "1101-مشروع الحصبة",
    customer_name: "1110003-علي العمراني",
    statement: "استلام كميات أجهزة الكمبيوتر المحولة بموجب أمر التحويل رقم 7",
    received_by: "نبيل الجعدي - أمين مخزن الحصبة",
    is_posted: false
  });

  const [rcptItems, setRcptItems] = useState<any[]>([
    { seq: 1, item_code: "001-1003", item_name: "سكر السعيد 10 كيلو", unit: "حبة", transferred_qty: 22, received_qty: 22, expiry_date: "2026-06-30", batch_no: "B-SUGAR-10", supplier_code: "1001", supplier_name: "نبيل الجعدي" }
  ]);

  const autoLoadReceiptItems = async (orderNo: number) => {
    try {
      const res = await fetch(`/api/warehouse-hub/transfer-receipts/auto-load/${orderNo}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "لم يتم العثور على أمر التحويل المطلوب");
      }
      const data = await res.json();
      setRcptItems(data.loaded_items);
      toast({ title: "إنزال آلي ناجح", description: `تم إنزال أصناف أمر التحويل رقم ${orderNo} بنجاح` });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const saveRcptMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/warehouse-hub/transfer-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ سند الاستلام");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "تم الحفظ", description: "تم حفظ سند استلام التحويل المخزني بنجاح" });
      if (data?.id) {
        setRcptHeader(prev => ({ ...prev, id: data.id, receipt_no: data.receipt_no }));
      }
      queryClient.invalidateQueries({ queryKey: ["transfer-receipts"] });
    }
  });

  const postRcptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/warehouse-hub/transfer-receipts/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error("فشل ترحيل الاستلام");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم الترحيل بنجاح", description: data.message });
      setRcptHeader(prev => ({ ...prev, is_posted: true }));
      queryClient.invalidateQueries({ queryKey: ["transfer-receipts"] });
    }
  });

  // --------------------------------------------------------------------------
  // TAB 5: STOCK ADJUSTMENTS (Image 5)
  // --------------------------------------------------------------------------
  const { data: stockAdjustments } = useQuery({
    queryKey: ["stock-adjustments"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse-hub/stock-adjustments");
      if (!res.ok) throw new Error("فشل تحميل التسويات المخزنية");
      return res.json();
    }
  });

  const [adjHeader, setAdjHeader] = useState({
    id: null,
    adjustment_no: 1,
    adjustment_date: "2015-12-05",
    branch_name: "1-الإدارة العامة",
    account_no: "021130008-فروقات أرباح وخسائر / تسويات جردية",
    currency: "1-ريال يمني",
    exchange_rate: 215.0,
    adjustment_type: "2-تسوية مخزنية (كمية / تكلفة)",
    statement: "معالجة فروقات الزيادة والنقص الكمي والتكلفي بين الجرد الفعلي وأستاذ المخازن",
    batch_no: "B-2015-ADJ",
    contract_no: "215",
    cost_center: "1101-المبيعات المعارض",
    activity_no: "1101-نشاط عام",
    total_adjustment_amount: 671895.50,
    is_posted: false
  });

  const [adjItems, setAdjItems] = useState<any[]>([
    { seq: 1, item_code: "001-1001", item_name: "سكر برزيلي 50 كغم", unit_cost: 200.0, batch_no: "B-01", average_cost: 6997.50, book_qty: 2500, actual_qty: 2000, variance_qty: -500, adjustment_qty: -500, variance_amount: -100000.0, supplier_code: "1001", supplier_name: "جمال المحمودي" },
    { seq: 2, item_code: "001-1002", item_name: "مخلفات كنسة سكر", unit_cost: 700.0, batch_no: "B-02", average_cost: 100.0, book_qty: 800, actual_qty: 700, variance_qty: -100, adjustment_qty: -100, variance_amount: -70000.0, supplier_code: "1001", supplier_name: "جمال المحمودي" },
    { seq: 3, item_code: "001-1003", item_name: "سكر هندي عام 50كيلو", unit_cost: 150.0, batch_no: "B-03", average_cost: 1.6154, book_qty: 130, actual_qty: 150, variance_qty: 20, adjustment_qty: 20, variance_amount: 3000.0, supplier_code: "1001", supplier_name: "جمال المحمودي" },
    { seq: 4, item_code: "001-1005", item_name: "سكر سوداني 50كغم", unit_cost: 500.0, batch_no: "B-04", average_cost: 229.411, book_qty: 500, actual_qty: 1000, variance_qty: 500, adjustment_qty: 500, variance_amount: 250000.0, supplier_code: "1001", supplier_name: "جمال المحمودي" },
    { seq: 5, item_code: "001-3001", item_name: "سكر صيدلاني", unit_cost: 300.0, batch_no: "B-05", average_cost: 100.0, book_qty: 100, actual_qty: 300, variance_qty: 200, adjustment_qty: 200, variance_amount: 60000.0, supplier_code: "1001", supplier_name: "جمال المحمودي" },
    { seq: 6, item_code: "001-3003", item_name: "سكر تسجيلات", unit_cost: 210.0, batch_no: "B-06", average_cost: 124.838, book_qty: 220, actual_qty: 210, variance_qty: -10, adjustment_qty: -10, variance_amount: -2100.0, supplier_code: "1001", supplier_name: "نبيل الجعدي" },
    { seq: 7, item_code: "001-5001", item_name: "سكر لهناء ممتاز 50كيلو", unit_cost: 400.0, batch_no: "B-07", average_cost: 4.484, book_qty: 300, actual_qty: 800, variance_qty: 500, adjustment_qty: 500, variance_amount: 200000.0, supplier_code: "1001", supplier_name: "نبيل الجعدي" },
    { seq: 8, item_code: "002-0001", item_name: "عتبة تركي رقم 14", unit_cost: 1000.0, batch_no: "B-08", average_cost: 1.000, book_qty: 100, actual_qty: 300, variance_qty: 200, adjustment_qty: 200, variance_amount: 200000.0, supplier_code: "1001", supplier_name: "نبيل الجعدي" }
  ]);

  const autoRecalculateAdjustments = () => {
    const updated = adjItems.map(itm => {
      const vQty = (Number(itm.actual_qty) || 0) - (Number(itm.book_qty) || 0);
      const uCost = Number(itm.unit_cost) || 0;
      return {
        ...itm,
        variance_qty: vQty,
        adjustment_qty: vQty,
        variance_amount: vQty * uCost
      };
    });

    const sum = updated.reduce((acc, curr) => acc + curr.variance_amount, 0);
    setAdjItems(updated);
    setAdjHeader(prev => ({ ...prev, total_adjustment_amount: sum }));
    toast({ title: "احتساب آلي", description: "تم إعادة حساب الفروقات الكمية والمبالغ بناءً على الجرد الفعلي" });
  };

  const saveAdjMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/warehouse-hub/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ سند التسوية");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "تم الحفظ", description: "تم حفظ سند التسوية المخزنية بنجاح" });
      if (data?.id) {
        setAdjHeader(prev => ({ ...prev, id: data.id, adjustment_no: data.adjustment_no }));
      }
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    }
  });

  const postAdjMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/warehouse-hub/stock-adjustments/${id}/post`, { method: "POST" });
      if (!res.ok) throw new Error("فشل ترحيل سند التسوية");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم الترحيل بنجاح", description: data.message });
      setAdjHeader(prev => ({ ...prev, is_posted: true }));
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    }
  });

  return (
    <div className="space-y-4 font-sans text-right" dir="rtl">
      
      {/* Top Banner Navigation Bar (Teal ERP Design Theme) */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 text-white p-4 rounded-xl shadow-md border border-teal-600/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-xs border border-white/20">
              <ArrowRightLeft className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide flex items-center gap-2">
                مركز عمليات التحويلات والتسويات والأرشفة المخزنية
                <Badge variant="outline" className="text-[10px] text-teal-100 border-teal-400/50 bg-teal-900/40">
                  نظام أومني سيستم برو ERP
                </Badge>
              </h1>
              <p className="text-xs text-teal-100/90 mt-0.5">
                شاشات التحويل المتعدد، التحويل المباشر، الاستلام المخزني، التسويات الجردية، وأرشفة الوثائق الإلكترونية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowFullBrowser(true)}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black gap-1.5 text-xs h-8 shadow-md"
            >
              <Maximize2 className="w-4 h-4" />
              استعراض كامل
            </Button>
            <Button
              onClick={() => setShowSafeBrowser(true)}
              size="sm"
              className="bg-white hover:bg-gray-100 text-teal-800 font-bold gap-1.5 text-xs h-8 shadow-md border"
            >
              <Eye className="w-4 h-4" />
              استعراض عام
            </Button>
            <Button
              onClick={printPublicPriceList}
              size="sm"
              className="bg-white hover:bg-gray-100 text-teal-800 font-bold gap-1.5 text-xs h-8 shadow-md border"
            >
              <Printer className="w-4 h-4" />
              PDF عام
            </Button>
            <Button
              onClick={() => setShowDocModal(true)}
              size="sm"
              className="bg-teal-500 hover:bg-teal-600 text-white font-bold gap-1 text-xs h-8 shadow-sm"
            >
              <FolderArchive className="w-4 h-4" />
              أرشفة وثيقة جديدة
            </Button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-teal-600/50 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowFullBrowser(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shrink-0 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md cursor-pointer animate-pulse"
          >
            <Maximize2 className="w-4 h-4 text-slate-950" />
            استعراض الأصناف والأسعار (شاشة كاملة)
          </button>

          <button
            onClick={() => setActiveTab("archiving")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "archiving" ? "bg-white text-teal-900 shadow-sm" : "bg-teal-900/40 text-teal-100 hover:bg-teal-800/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            1. أرشفة الوثائق وتصدير Excel (صورة 1)
          </button>

          <button
            onClick={() => setActiveTab("multi_transfer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "multi_transfer" ? "bg-white text-teal-900 shadow-sm" : "bg-teal-900/40 text-teal-100 hover:bg-teal-800/60"
            }`}
          >
            <Split className="w-4 h-4" />
            2. التحويل المخزني المتعدد (صورة 2)
          </button>

          <button
            onClick={() => setActiveTab("standard_transfer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "standard_transfer" ? "bg-white text-teal-900 shadow-sm" : "bg-teal-900/40 text-teal-100 hover:bg-teal-800/60"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            3. التحويل المخزني المباشر (صورة 3)
          </button>

          <button
            onClick={() => setActiveTab("transfer_receipt")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "transfer_receipt" ? "bg-white text-teal-900 shadow-sm" : "bg-teal-900/40 text-teal-100 hover:bg-teal-800/60"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            4. استلام التحويل المخزني (صورة 4)
          </button>

          <button
            onClick={() => setActiveTab("stock_adjustment")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "stock_adjustment" ? "bg-white text-teal-900 shadow-sm" : "bg-teal-900/40 text-teal-100 hover:bg-teal-800/60"
            }`}
          >
            <Calculator className="w-4 h-4" />
            5. التسويات المخزنية والجرد (صورة 5)
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: DOCUMENT ARCHIVING & EXCEL EXPORT (Image 1) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "archiving" && (
        <div className="space-y-4">
          
          {/* Top Section: Excel Export & Journal Accounting Entry Grid (Matching Image 1) */}
          <Card className="border-teal-200 dark:border-teal-900 shadow-xs">
            <CardHeader className="bg-teal-50/70 dark:bg-teal-950/30 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-teal-950 dark:text-teal-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  جدول الترحيل والقيد المحاسبي لسندات الصرف/التوريد مع أداة التصدير المباشر لـ Excel
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  من خلال أيقونة الإكسل يتم تصدير مستند الصرف والتوريد المخزني بإنزال كافة الحقول بنفس الترتيب (طابق صورة 1)
                </CardDescription>
              </div>

              <Button
                onClick={exportJournalToExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                تصدير إكسل (.CSV / .XLS)
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-teal-700 text-white font-bold">
                    <tr>
                      <th className="p-2.5 border-r border-teal-600">رقم الحساب</th>
                      <th className="p-2.5 border-r border-teal-600">الاسم</th>
                      <th className="p-2.5 border-r border-teal-600">الحساب التحليلي</th>
                      <th className="p-2.5 border-r border-teal-600 text-center">مدين</th>
                      <th className="p-2.5 border-r border-teal-600 text-center">دائن</th>
                      <th className="p-2.5 border-r border-teal-600 text-center">مدين أجنبي</th>
                      <th className="p-2.5 border-r border-teal-600 text-center">دائن أجنبي</th>
                      <th className="p-2.5">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sampleJournalRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 font-medium">
                        <td className="p-2.5 font-mono text-indigo-700 dark:text-indigo-400 font-bold">{r.account_no}</td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{r.account_name}</td>
                        <td className="p-2.5 font-mono text-center">{r.analytical}</td>
                        <td className="p-2.5 font-mono text-center text-emerald-700 dark:text-emerald-400 font-bold">{r.debit.toLocaleString()}</td>
                        <td className="p-2.5 font-mono text-center text-rose-700 dark:text-rose-400 font-bold">{r.credit.toLocaleString()}</td>
                        <td className="p-2.5 font-mono text-center">{r.f_debit.toLocaleString()}</td>
                        <td className="p-2.5 font-mono text-center">{r.f_credit.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{r.memo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Section: Document Archiving Records Table (Matching Image 1 Document Archive Window) */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-teal-600" />
                  أرشيف الوثائق والمستندات الإلكترونية المرفقة (Document Archiving)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  ربط وثائق الصرف والتوريد والتحويل بملفات أرشيفية وحفظ تاريخ ورقم الملف والملاحظات
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 w-64">
                <Input
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="بحث في الوثائق والأرشيف..."
                  className="text-xs h-8"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-y font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">رقم الملف</th>
                      <th className="p-2.5">تاريخ الملف</th>
                      <th className="p-2.5">وصف الملف / عنوان المستند</th>
                      <th className="p-2.5">نوع الوثيقة</th>
                      <th className="p-2.5">اسم الملف المرفق</th>
                      <th className="p-2.5">الحجم</th>
                      <th className="p-2.5">ملاحظات</th>
                      <th className="p-2.5 text-center">إجراءات (Open/Load)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {archivedDocs && archivedDocs.length > 0 ? (
                      archivedDocs.map((doc: any) => (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-2.5 font-mono font-bold text-indigo-600">{doc.file_no}</td>
                          <td className="p-2.5 font-mono">{doc.file_date}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{doc.file_description}</td>
                          <td className="p-2.5"><Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-800 border-teal-300">{doc.voucher_type}</Badge></td>
                          <td className="p-2.5 font-mono text-teal-700 dark:text-teal-400 font-bold">{doc.file_name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{doc.file_size}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{doc.file_notes || "—"}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                onClick={() => setSelectedFilePreview(doc)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 text-teal-700 border-teal-300 hover:bg-teal-50 font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Open (فتح)
                              </Button>
                              <Button
                                onClick={() => deleteDocMutation.mutate(doc.id)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                          لا توجد وثائق مؤرشفة حالياً. انقر فوق زر "أرشفة وثيقة جديدة" لإعادة الإرفاق.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: MULTI-WAREHOUSE TRANSFER (Image 2) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "multi_transfer" && (
        <Card className="border-teal-200 dark:border-teal-900 shadow-xs">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <Split className="w-4 h-4 text-teal-600" />
                شاشة التحويل المخزني المتعدد (Multi-Warehouse Transfer - صورة 2)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                تحويل الأصناف من مخزن إلى أكثر من مخزن، ثم إنزاله آلياً إلى عدة تحويلات فردية حسب كل مخزن
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => multiHeader.id && convertMultiMutation.mutate(multiHeader.id)}
                disabled={!multiHeader.id || convertMultiMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Split className="w-4 h-4" />
                إنزال آلي وتقسيم التحويل حسب المخزن
              </Button>
              <Button
                onClick={() => saveMultiMutation.mutate({ ...multiHeader, items: multiItems })}
                disabled={saveMultiMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ المستند
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            
            {/* Form Header Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">الفرع:</Label>
                <Input
                  value={multiHeader.branch_name}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, branch_name: e.target.value }))}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">نوع التحويل:</Label>
                <Input
                  value={multiHeader.transfer_type}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, transfer_type: e.target.value }))}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم التحويل المتعدد:</Label>
                <Input
                  type="number"
                  value={multiHeader.transfer_no}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, transfer_no: Number(e.target.value) }))}
                  className="h-8 text-xs font-bold font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">تاريخ التحويل:</Label>
                <Input
                  type="date"
                  value={multiHeader.transfer_date}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, transfer_date: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">المخزن الافتراضي المحول منه:</Label>
                <Input
                  value={multiHeader.default_warehouse_name}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, default_warehouse_name: e.target.value }))}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">المركز الافتراضي:</Label>
                <Input
                  value={multiHeader.default_cost_center}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, default_cost_center: e.target.value }))}
                  className="h-8 text-xs font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم المرجع:</Label>
                <Input
                  value={multiHeader.ref_no}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, ref_no: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">س.ت المخزون:</Label>
                <Input
                  value={multiHeader.inv_reg_no}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, inv_reg_no: e.target.value }))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="md:col-span-4">
                <Label className="font-bold text-slate-700 mb-1 block">البيان / السبب:</Label>
                <Input
                  value={multiHeader.statement}
                  onChange={(e) => setMultiHeader(prev => ({ ...prev, statement: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Items Table Grid */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-teal-700 text-white font-bold">
                  <tr>
                    <th className="p-2 border-r border-teal-600">م</th>
                    <th className="p-2 border-r border-teal-600">رقم الصنف</th>
                    <th className="p-2 border-r border-teal-600">اسم الصنف</th>
                    <th className="p-2 border-r border-teal-600">من المخزن</th>
                    <th className="p-2 border-r border-teal-600">إلى المخزن المحول إليه</th>
                    <th className="p-2 border-r border-teal-600">تاريخ الانتهاء</th>
                    <th className="p-2 border-r border-teal-600">رقم الدفعة</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية</th>
                    <th className="p-2 border-r border-teal-600">رقم المورد</th>
                    <th className="p-2 border-r border-teal-600">اسم المورد</th>
                    <th className="p-2 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {multiItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2 font-mono text-center">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-indigo-600">{itm.item_code}</td>
                      <td className="p-2 font-bold">{itm.item_name}</td>
                      <td className="p-2 text-slate-700">{itm.from_warehouse_name}</td>
                      <td className="p-2 font-bold text-teal-800 dark:text-teal-300">{itm.to_warehouse_name}</td>
                      <td className="p-2 font-mono">{itm.expiry_date}</td>
                      <td className="p-2 font-mono">{itm.batch_no}</td>
                      <td className="p-2 font-mono text-center font-bold text-emerald-700">{itm.quantity}</td>
                      <td className="p-2 font-mono">{itm.supplier_code}</td>
                      <td className="p-2">{itm.supplier_name}</td>
                      <td className="p-2 text-center">
                        <Button
                          onClick={() => setMultiItems(prev => prev.filter((_, i) => i !== idx))}
                          size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={() => setMultiItems(prev => [...prev, {
                seq: prev.length + 1,
                item_code: "001-1002",
                item_name: "صنف تحويل إضافي",
                from_warehouse_name: multiHeader.default_warehouse_name,
                to_warehouse_name: "3-مخزن المعارض",
                expiry_date: "2026-12-31",
                batch_no: "B-2025",
                quantity: 50,
                supplier_code: "1001",
                supplier_name: "نبيل الجعدي"
              }])}
              size="sm" variant="outline" className="text-xs font-bold gap-1 text-teal-700 border-teal-300"
            >
              <Plus className="w-4 h-4" />
              إضافة صف تحويل فرعي جديد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: STANDARD WAREHOUSE TRANSFER (Image 3) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "standard_transfer" && (
        <Card className="border-teal-200 dark:border-teal-900 shadow-xs">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-teal-600" />
                شاشة التحويل المخزني المباشر (Standard Warehouse Transfer - صورة 3)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                تحويل مباشر من مخزن إلى آخر مع خيارات الترحيل المحاسبي [مرحل / مؤجل / معلق / إقفال الكمية]
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => stdHeader.id && postStdMutation.mutate(stdHeader.id)}
                disabled={!stdHeader.id || stdHeader.is_posted || postStdMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {stdHeader.is_posted ? "مرحل محاسبياً" : "ترحيل القيد المخزني"}
              </Button>
              <Button
                onClick={() => saveStdMutation.mutate({ ...stdHeader, items: stdItems })}
                disabled={saveStdMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            
            {/* Status Checkboxes Row (Matching Image 3 Top Status Bar) */}
            <div className="flex flex-wrap items-center gap-6 p-3 bg-teal-900/10 border border-teal-300 dark:border-teal-800 rounded-lg text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stdHeader.is_posted}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, is_posted: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <span className="text-teal-900 dark:text-teal-200">مرحل (Posted)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stdHeader.is_deferred}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, is_deferred: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span className="text-amber-800 dark:text-amber-300">مؤجل (Deferred)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stdHeader.is_pending}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, is_pending: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-indigo-800 dark:text-indigo-300">معلق (Pending)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stdHeader.close_transferred_qty}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, close_transferred_qty: e.target.checked }))}
                  className="w-4 h-4 text-rose-600 rounded"
                />
                <span className="text-rose-800 dark:text-rose-300">إقفال الكمية المحولة</span>
              </label>
            </div>

            {/* Header Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم التحويل:</Label>
                <Input
                  type="number"
                  value={stdHeader.transfer_no}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, transfer_no: Number(e.target.value) }))}
                  className="h-8 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">تاريخ التحويل:</Label>
                <Input
                  type="date"
                  value={stdHeader.transfer_date}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, transfer_date: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">من مخزن المحول منه:</Label>
                <Input
                  value={stdHeader.from_warehouse_name}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, from_warehouse_name: e.target.value }))}
                  className="h-8 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">إلى مخزن المحول إليه:</Label>
                <Input
                  value={stdHeader.to_warehouse_name}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, to_warehouse_name: e.target.value }))}
                  className="h-8 font-bold text-teal-800 dark:text-teal-300"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">مركز التكلفة:</Label>
                <Input
                  value={stdHeader.cost_center}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, cost_center: e.target.value }))}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">طريقة تكاليف التحويل:</Label>
                <Input
                  value={stdHeader.costing_method}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, costing_method: e.target.value }))}
                  className="h-8 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">حساب الفارق:</Label>
                <Input
                  value={stdHeader.variance_account}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, variance_account: e.target.value }))}
                  className="h-8 font-mono text-[11px]"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">العميل المرتبط:</Label>
                <Input
                  value={stdHeader.customer_name}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, customer_name: e.target.value }))}
                  className="h-8"
                />
              </div>

              <div className="md:col-span-4">
                <Label className="font-bold text-slate-700 mb-1 block">البيان الرسمي:</Label>
                <Input
                  value={stdHeader.statement}
                  onChange={(e) => setStdHeader(prev => ({ ...prev, statement: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>

            {/* Detail Items Grid */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-teal-700 text-white font-bold">
                  <tr>
                    <th className="p-2 border-r border-teal-600">م</th>
                    <th className="p-2 border-r border-teal-600">رقم الصنف</th>
                    <th className="p-2 border-r border-teal-600">اسم الصنف</th>
                    <th className="p-2 border-r border-teal-600">الوحدة</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية</th>
                    <th className="p-2 border-r border-teal-600 text-center">الشد</th>
                    <th className="p-2 border-r border-teal-600">تاريخ الانتهاء</th>
                    <th className="p-2 border-r border-teal-600">رقم الدفعة</th>
                    <th className="p-2 border-r border-teal-600 text-center">سعر التكلفة</th>
                    <th className="p-2 border-r border-teal-600 text-center">إجمالي التكلفة</th>
                    <th className="p-2">اسم المورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stdItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2 font-mono text-center">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-indigo-600">{itm.item_code}</td>
                      <td className="p-2 font-bold">{itm.item_name}</td>
                      <td className="p-2">{itm.unit}</td>
                      <td className="p-2 font-mono text-center font-bold text-emerald-700">{itm.quantity}</td>
                      <td className="p-2 font-mono text-center">{itm.package_size}</td>
                      <td className="p-2 font-mono">{itm.expiry_date}</td>
                      <td className="p-2 font-mono">{itm.batch_no}</td>
                      <td className="p-2 font-mono text-center">{itm.unit_cost}</td>
                      <td className="p-2 font-mono text-center font-bold">{itm.total_cost}</td>
                      <td className="p-2">{itm.supplier_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: WAREHOUSE TRANSFER RECEIPT / GRN (Image 4) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "transfer_receipt" && (
        <Card className="border-teal-200 dark:border-teal-900 shadow-xs">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-teal-600" />
                شاشة الاستلام والتحويل المخزني (Warehouse Transfer Receipt - صورة 4)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                إدخال الاستلام المخزني للبضاعة المحولة وقيدها في حساب المخزون من وسيط التحويلات
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => autoLoadReceiptItems(rcptHeader.transfer_order_no)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Download className="w-4 h-4" />
                إنزال آلي للتحويل رقم ({rcptHeader.transfer_order_no})
              </Button>
              <Button
                onClick={() => rcptHeader.id && postRcptMutation.mutate(rcptHeader.id)}
                disabled={!rcptHeader.id || rcptHeader.is_posted || postRcptMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {rcptHeader.is_posted ? "مرحل" : "ترحيل سند الاستلام"}
              </Button>
              <Button
                onClick={() => saveRcptMutation.mutate({ ...rcptHeader, items: rcptItems })}
                disabled={saveRcptMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            
            {/* Header Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم سند الاستلام:</Label>
                <Input
                  type="number"
                  value={rcptHeader.receipt_no}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, receipt_no: Number(e.target.value) }))}
                  className="h-8 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">تاريخ الاستلام:</Label>
                <Input
                  type="date"
                  value={rcptHeader.receipt_date}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, receipt_date: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم أمر التحويل المرجع:</Label>
                <Input
                  type="number"
                  value={rcptHeader.transfer_order_no}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, transfer_order_no: Number(e.target.value) }))}
                  className="h-8 font-mono font-bold text-indigo-700"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">المخزن المستلم (إلى مخزن):</Label>
                <Input
                  value={rcptHeader.to_warehouse_name}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, to_warehouse_name: e.target.value }))}
                  className="h-8 font-bold text-emerald-800 dark:text-emerald-300"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">المخزن المحول منه:</Label>
                <Input
                  value={rcptHeader.from_warehouse_name}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, from_warehouse_name: e.target.value }))}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">حساب وسيط التحويلات:</Label>
                <Input
                  value={rcptHeader.intermediate_account}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, intermediate_account: e.target.value }))}
                  className="h-8 font-mono text-[11px]"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">نوع الاستلام:</Label>
                <Input
                  value={rcptHeader.receipt_type}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, receipt_type: e.target.value }))}
                  className="h-8 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">اسم المستلم الرسمي:</Label>
                <Input
                  value={rcptHeader.received_by}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, received_by: e.target.value }))}
                  className="h-8 font-bold"
                />
              </div>

              <div className="md:col-span-4">
                <Label className="font-bold text-slate-700 mb-1 block">البيان:</Label>
                <Input
                  value={rcptHeader.statement}
                  onChange={(e) => setRcptHeader(prev => ({ ...prev, statement: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>

            {/* Receipt Items Grid */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-teal-700 text-white font-bold">
                  <tr>
                    <th className="p-2 border-r border-teal-600">م</th>
                    <th className="p-2 border-r border-teal-600">رقم الصنف</th>
                    <th className="p-2 border-r border-teal-600">اسم الصنف</th>
                    <th className="p-2 border-r border-teal-600">الوحدة</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية المحولة</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية المستلمة الفعلية</th>
                    <th className="p-2 border-r border-teal-600">تاريخ الانتهاء</th>
                    <th className="p-2 border-r border-teal-600">رقم الدفعة</th>
                    <th className="p-2">اسم المورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {rcptItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2 font-mono text-center">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-indigo-600">{itm.item_code}</td>
                      <td className="p-2 font-bold">{itm.item_name}</td>
                      <td className="p-2">{itm.unit}</td>
                      <td className="p-2 font-mono text-center text-slate-500 font-bold">{itm.transferred_qty}</td>
                      <td className="p-2 font-mono text-center font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                        <input
                          type="number"
                          value={itm.received_qty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRcptItems(prev => prev.map((row, i) => i === idx ? { ...row, received_qty: val } : row));
                          }}
                          className="w-16 text-center border rounded bg-white dark:bg-slate-800 font-bold"
                        />
                      </td>
                      <td className="p-2 font-mono">{itm.expiry_date}</td>
                      <td className="p-2 font-mono">{itm.batch_no}</td>
                      <td className="p-2">{itm.supplier_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: STOCK ADJUSTMENTS (Image 5) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "stock_adjustment" && (
        <Card className="border-teal-200 dark:border-teal-900 shadow-xs">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-teal-600" />
                شاشة التسويات المخزنية ومعالجة فروقات الجرد (Stock Adjustments - صورة 5)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                معالجة فروقات الجرد الفعلي (كميات ومبالغ وتكاليف) وتثبيتها في الحسابات والأستاذ
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={autoRecalculateAdjustments}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Calculator className="w-4 h-4" />
                احتساب الفروقات من الجرد آلياً
              </Button>
              <Button
                onClick={() => adjHeader.id && postAdjMutation.mutate(adjHeader.id)}
                disabled={!adjHeader.id || adjHeader.is_posted || postAdjMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {adjHeader.is_posted ? "مرحل" : "ترحيل قيد التسوية"}
              </Button>
              <Button
                onClick={() => saveAdjMutation.mutate({ ...adjHeader, items: adjItems })}
                disabled={saveAdjMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 gap-1.5"
              >
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            
            {/* Header Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم سند التسوية:</Label>
                <Input
                  type="number"
                  value={adjHeader.adjustment_no}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, adjustment_no: Number(e.target.value) }))}
                  className="h-8 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">تاريخ التسوية:</Label>
                <Input
                  type="date"
                  value={adjHeader.adjustment_date}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, adjustment_date: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">حساب فروقات التسوية المخزنية:</Label>
                <Input
                  value={adjHeader.account_no}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, account_no: e.target.value }))}
                  className="h-8 font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">نوع التسوية:</Label>
                <Input
                  value={adjHeader.adjustment_type}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, adjustment_type: e.target.value }))}
                  className="h-8 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">العملة وسعر التحويل:</Label>
                <div className="flex gap-1">
                  <Input value={adjHeader.currency} readOnly className="h-8 w-24 text-[11px]" />
                  <Input type="number" value={adjHeader.exchange_rate} readOnly className="h-8 font-mono text-[11px]" />
                </div>
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">رقم الدفعة / العقد:</Label>
                <Input
                  value={adjHeader.batch_no}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, batch_no: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">مركز التكلفة والنشاط:</Label>
                <Input
                  value={adjHeader.cost_center}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, cost_center: e.target.value }))}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">إجمالي مبلغ التسوية الجردية:</Label>
                <div className="h-8 flex items-center justify-center bg-teal-100 dark:bg-teal-950/80 border border-teal-300 rounded px-2 font-mono font-black text-teal-900 dark:text-teal-200">
                  {adjHeader.total_adjustment_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال
                </div>
              </div>

              <div className="md:col-span-4">
                <Label className="font-bold text-slate-700 mb-1 block">بيان وتفاصيل سبب التسوية:</Label>
                <Input
                  value={adjHeader.statement}
                  onChange={(e) => setAdjHeader(prev => ({ ...prev, statement: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>

            {/* Adjustment Detail Table Grid (Matching Image 5) */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-teal-700 text-white font-bold">
                  <tr>
                    <th className="p-2 border-r border-teal-600">م</th>
                    <th className="p-2 border-r border-teal-600">رقم الصنف</th>
                    <th className="p-2 border-r border-teal-600">اسم الصنف</th>
                    <th className="p-2 border-r border-teal-600 text-center">سعر التكلفة</th>
                    <th className="p-2 border-r border-teal-600">رقم الدفعة</th>
                    <th className="p-2 border-r border-teal-600 text-center">متوسط التكلفة</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية الدفترية</th>
                    <th className="p-2 border-r border-teal-600 text-center">الكمية الفعلية</th>
                    <th className="p-2 border-r border-teal-600 text-center">كمية الفارق</th>
                    <th className="p-2 border-r border-teal-600 text-center">مبلغ التسوية</th>
                    <th className="p-2">اسم المورد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {adjItems.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2 font-mono text-center">{idx + 1}</td>
                      <td className="p-2 font-mono font-bold text-indigo-600">{itm.item_code}</td>
                      <td className="p-2 font-bold">{itm.item_name}</td>
                      <td className="p-2 font-mono text-center">{itm.unit_cost.toLocaleString()}</td>
                      <td className="p-2 font-mono">{itm.batch_no}</td>
                      <td className="p-2 font-mono text-center">{itm.average_cost}</td>
                      <td className="p-2 font-mono text-center text-slate-500 font-bold">{itm.book_qty}</td>
                      <td className="p-2 font-mono text-center font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                        <input
                          type="number"
                          value={itm.actual_qty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAdjItems(prev => prev.map((row, i) => {
                              if (i === idx) {
                                const vQty = val - row.book_qty;
                                return {
                                  ...row,
                                  actual_qty: val,
                                  variance_qty: vQty,
                                  adjustment_qty: vQty,
                                  variance_amount: vQty * row.unit_cost
                                };
                              }
                              return row;
                            }));
                          }}
                          className="w-16 text-center border rounded bg-white dark:bg-slate-800 font-bold"
                        />
                      </td>
                      <td className={`p-2 font-mono text-center font-bold ${itm.variance_qty < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {itm.variance_qty > 0 ? `+${itm.variance_qty}` : itm.variance_qty}
                      </td>
                      <td className={`p-2 font-mono text-center font-bold ${itm.variance_amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {itm.variance_amount.toLocaleString()}
                      </td>
                      <td className="p-2">{itm.supplier_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border font-bold text-xs">
              <span>إجمالي قيمة التسويات المخزنية الجردية:</span>
              <span className="text-base font-mono font-black text-teal-800 dark:text-teal-300">
                {adjHeader.total_adjustment_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ريال يمني
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Modal: Document Preview / Open Window (Matching Image 1) ─── */}
      <Dialog open={!!selectedFilePreview} onOpenChange={() => setSelectedFilePreview(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-teal-700">
              <FolderArchive className="w-5 h-5" />
              معاينة الوثيقة المؤرشفة ({selectedFilePreview?.file_name})
            </DialogTitle>
          </DialogHeader>

          {selectedFilePreview && (
            <div className="space-y-3 text-xs bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border">
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-500">رقم الملف:</span>
                <strong className="font-mono">{selectedFilePreview.file_no}</strong>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-500">تاريخ الملف:</span>
                <strong className="font-mono">{selectedFilePreview.file_date}</strong>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-500">وصف المستند:</span>
                <strong className="font-bold">{selectedFilePreview.file_description}</strong>
              </div>
              <div className="flex justify-between border-b pb-1.5">
                <span className="text-slate-500">حجم الملف:</span>
                <strong className="font-mono">{selectedFilePreview.file_size}</strong>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">الملاحظات:</span>
                <p className="p-2 bg-white dark:bg-slate-800 rounded border text-slate-700 dark:text-slate-300">
                  {selectedFilePreview.file_notes || "لا توجد ملاحظات إضافية"}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSelectedFilePreview(null)}>إغلاق المعاينة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Add/Upload New Document Archive ─── */}
      <Dialog open={showDocModal} onOpenChange={setShowDocModal}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-teal-700">
              <FileUp className="w-5 h-5 text-teal-600" />
              أرشفة وإرفاق وثيقة إلكترونية جديدة (Image 1 Archiving)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold mb-1 block">رقم الملف:</Label>
                <Input
                  placeholder="تلقائي / 1"
                  value={docFormData.file_no}
                  onChange={(e) => setDocFormData(prev => ({ ...prev, file_no: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>
              <div>
                <Label className="font-bold mb-1 block">تاريخ الملف:</Label>
                <Input
                  type="date"
                  value={docFormData.file_date}
                  onChange={(e) => setDocFormData(prev => ({ ...prev, file_date: e.target.value }))}
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold mb-1 block">وصف الملف / عنوان الوثيقة:</Label>
              <Input
                placeholder="مثال: أمر صرف مخزني - للمواد السلعية المنصرفة"
                value={docFormData.file_description}
                onChange={(e) => setDocFormData(prev => ({ ...prev, file_description: e.target.value }))}
                className="h-8"
              />
            </div>

            <div>
              <Label className="font-bold mb-1 block">نوع الوثيقة والمستند:</Label>
              <select
                value={docFormData.voucher_type}
                onChange={(e) => setDocFormData(prev => ({ ...prev, voucher_type: e.target.value, document_type_code: e.target.value }))}
                className="w-full text-xs h-8 rounded border bg-white dark:bg-slate-800 px-2 font-bold"
              >
                <option value="1-9 أمر صرف مخزني">1-9 أمر صرف مخزني</option>
                <option value="2-1 أمر توريد مخزني">2-1 أمر توريد مخزني</option>
                <option value="3-1 أمر تحويل مخزني">3-1 أمر تحويل مخزني</option>
                <option value="4-1 سند تسوية مخزنية">4-1 سند تسوية مخزنية</option>
              </select>
            </div>

            <div>
              <Label className="font-bold mb-1 block">اسم الملف المرفق (.doc / .pdf):</Label>
              <Input
                placeholder="للمواد السلعية المنصرفة.doc"
                value={docFormData.file_name}
                onChange={(e) => setDocFormData(prev => ({ ...prev, file_name: e.target.value }))}
                className="h-8 font-mono"
              />
            </div>

            <div>
              <Label className="font-bold mb-1 block">ملاحظات الملف:</Label>
              <Input
                placeholder="ملاحظات توثيقية إضافية..."
                value={docFormData.file_notes}
                onChange={(e) => setDocFormData(prev => ({ ...prev, file_notes: e.target.value }))}
                className="h-8"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDocModal(false)}>إلغاء</Button>
            <Button
              onClick={() => addDocMutation.mutate(docFormData)}
              disabled={addDocMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold"
            >
              {addDocMutation.isPending ? "جاري الأرشفة..." : "أرشفة وإرفاق الوثيقة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showFullBrowser && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col p-4 md:p-6 text-right dir-rtl select-none animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 rounded-2xl flex-1 flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header Bar */}
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">مستكشف دليل الأصناف الشامل</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-bold">
                  استعراض فوري لكافة التصنيفات، مجموعات الأصناف والأسعار الحالية مع أداة تصدير PDF والطباعة المباشرة
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={printPriceDirectory}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 gap-2 shadow px-4"
                >
                  <Printer className="w-4 h-4" />
                  طباعة دليل الأسعار (A4 PDF)
                </Button>
                <Button
                  onClick={() => {
                    setShowFullBrowser(false);
                    setSearchQuery("");
                    setSelectedCategory("all");
                    setSelectedItemType("all");
                  }}
                  variant="outline"
                  className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 h-9 gap-1.5 text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                  إغلاق الاستعراض
                </Button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-100/50 dark:bg-slate-900/30 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="البحث باسم الصنف، الباركود، الرقم..."
                    className="pr-9 h-9 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Category Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">التصنيف:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs px-2.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="all">كل التصنيفات والأقسام</option>
                    {(allCategories || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Item Type Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">نوع الصنف:</span>
                  <select
                    value={selectedItemType}
                    onChange={(e) => setSelectedItemType(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs px-2.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="all">كل الأنواع والمستويات</option>
                    {ITEM_TYPES.map((t: any) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View Switcher (Grid/List) */}
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/40">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "grid" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  title="عرض شبكي"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  title="عرض قائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Content Pane (Sidebar Categories + Products Grid) */}
            <div className="flex-1 flex overflow-hidden">
              {/* Category Sidebar */}
              <div className="w-64 border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 p-4 overflow-y-auto hidden md:block">
                <h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-amber-500" />
                  قائمة الفلاتر السريعة
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${selectedCategory === "all" ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                  >
                    <span>جميع المنتجات</span>
                    <Badge variant="outline" className={`text-[10px] ${selectedCategory === "all" ? "border-slate-900 text-slate-900" : "text-slate-400 border-slate-200"}`}>
                      {(allProducts || []).length}
                    </Badge>
                  </button>

                  {(allCategories || []).map((cat: any) => {
                    const count = (allProducts || []).filter((p: any) => String(p.categoryId) === String(cat.id)).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(String(cat.id))}
                        className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${String(selectedCategory) === String(cat.id) ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${String(selectedCategory) === String(cat.id) ? "border-slate-900 text-slate-900" : "text-slate-400 border-slate-200"}`}>
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products Display Container */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/20">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(() => {
                      const list = (allProducts || []).filter((p: any) => {
                        const matchesSearch = searchQuery
                          ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.barcode && p.barcode.includes(searchQuery)) ||
                            String(p.number).includes(searchQuery)
                          : true;
                        const matchesCategory = selectedCategory && selectedCategory !== "all"
                          ? String(p.categoryId) === String(selectedCategory)
                          : true;
                        const matchesItemType = selectedItemType && selectedItemType !== "all"
                          ? p.item_type === selectedItemType
                          : true;
                        return matchesSearch && matchesCategory && matchesItemType;
                      });

                      if (list.length === 0) {
                        return (
                          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                            <Search className="w-12 h-12 text-slate-300 dark:text-slate-700 animate-bounce" />
                            <p className="text-sm font-bold">لم نجد أي منتجات تطابق شروط البحث والفرز الحالية</p>
                            <p className="text-xs text-slate-500">جرب البحث بكلمة أخرى أو تصفير الفلاتر النشطة</p>
                          </div>
                        );
                      }

                      return list.map((item: any) => {
                        const typeObj = ITEM_TYPES.find(t => t.value === item.item_type);
                        const typeColor = typeObj ? typeObj.color : "bg-slate-50 text-slate-700 border-slate-200";
                        const typeLabel = typeObj ? typeObj.label : "منتج قياسي";
                        
                        return (
                          <Card key={item.id} className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-200 group relative flex flex-col justify-between overflow-hidden bg-white dark:bg-slate-950">
                            <CardContent className="p-4 flex flex-col justify-between flex-1">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className="font-mono text-[10px] bg-slate-900 text-white border-0">{item.number || "—"}</Badge>
                                  <Badge variant="outline" className={`text-[9px] border px-2 py-0.5 rounded-md ${typeColor}`}>
                                    {typeLabel}
                                  </Badge>
                                </div>
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors line-clamp-2">{item.name}</h4>
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-slate-300" />
                                  <span>التصنيف: {item.categoryName || "أصناف عامة"}</span>
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <span className="text-[9px] font-bold text-slate-400 block">سعر البيع</span>
                                  <span className="text-sm font-black text-teal-600 dark:text-teal-400" dir="ltr">
                                    {Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] font-bold text-slate-500">ر.س</span>
                                  </span>
                                </div>
                                
                                {item.cost !== undefined && item.cost !== null && (
                                  <div className="space-y-0.5 text-left">
                                    <span className="text-[9px] font-bold text-slate-400 block">التكلفة</span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400" dir="ltr">
                                      {Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[9px]">ر.س</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                            <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500">
                              <span>الوحدة: {item.unit || "حبة"}</span>
                              <span className={`font-mono font-bold ${(item.stock || 0) <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                المخزون: {item.stock || 0}
                              </span>
                            </div>
                          </Card>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="p-3 text-right">رقم الصنف</th>
                          <th className="p-3 text-right">اسم الصنف / المنتج</th>
                          <th className="p-3 text-right">التصنيف</th>
                          <th className="p-3 text-center">الوحدة</th>
                          <th className="p-3 text-center">نوع الصنف</th>
                          <th className="p-3 text-center">المخزون الحالي</th>
                          <th className="p-3 text-left">سعر البيع</th>
                          <th className="p-3 text-left">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(() => {
                          const list = (allProducts || []).filter((p: any) => {
                            const matchesSearch = searchQuery
                              ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (p.barcode && p.barcode.includes(searchQuery)) ||
                                String(p.number).includes(searchQuery)
                              : true;
                            const matchesCategory = selectedCategory && selectedCategory !== "all"
                              ? String(p.categoryId) === String(selectedCategory)
                              : true;
                            const matchesItemType = selectedItemType && selectedItemType !== "all"
                              ? p.item_type === selectedItemType
                              : true;
                            return matchesSearch && matchesCategory && matchesItemType;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} className="p-16 text-center text-slate-400">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Search className="w-10 h-10 text-slate-300" />
                                    <p className="font-bold">لا توجد نتائج تطابق شروط الفلترة</p>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return list.map((item: any) => {
                            const typeObj = ITEM_TYPES.find(t => t.value === item.item_type);
                            const typeLabel = typeObj ? typeObj.label.split(" ")[0] : "سلعي";
                            
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{item.number || "—"}</td>
                                <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                                <td className="p-3 font-medium text-slate-500">{item.categoryName || "أصناف عامة"}</td>
                                <td className="p-3 text-center text-slate-600">{item.unit || "حبة"}</td>
                                <td className="p-3 text-center">
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {typeLabel}
                                  </span>
                                </td>
                                <td className={`p-3 text-center font-mono font-bold ${(item.stock || 0) <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{item.stock || 0}</td>
                                <td className="p-3 text-left font-black text-teal-600 dark:text-teal-400" dir="ltr">{Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</td>
                                <td className="p-3 text-left font-medium text-slate-500" dir="ltr">{item.cost ? Number(item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س' : '—'}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showSafeBrowser && (
        <Dialog open={showSafeBrowser} onOpenChange={setShowSafeBrowser}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader><DialogTitle>استعراض المنتجات والأسعار (عرض آمن)</DialogTitle></DialogHeader>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-gray-100"><th className="p-2 border">اسم المنتج</th><th className="p-2 border">السعر</th></tr></thead>
              <tbody>
                {allProducts.map((p: any) => <tr key={p.id}><td className="p-2 border">{p.name}</td><td className="p-2 border">{p.price}</td></tr>)}
              </tbody>
            </table>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
