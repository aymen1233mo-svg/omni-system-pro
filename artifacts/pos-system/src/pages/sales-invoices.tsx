import React, { useState, useEffect, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Save, Edit2, Trash2, RefreshCw, Search, Printer, Download,
  ChevronFirst, ChevronLast, ChevronRight, ChevronLeft, FileText, CheckCircle2,
  XCircle, Clock, Building2, Layers, Check, AlertTriangle, RotateCcw,
  DollarSign, Percent, UserCheck, Eye, ArrowRight, ArrowLeft,
  Calendar, ShoppingBag, ShieldCheck, Tag, Hash, Calculator, Send,
  ZoomIn, ZoomOut, Maximize2, Warehouse as WarehouseIcon, BookOpen
} from "lucide-react";
import { printA4Html, saveA4HtmlAsPdf, generateWarehouseInvoiceA4Html } from "@/lib/printUtils";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {})
    }
  });
}

async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(url: string, body: any) {
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
  return r.json();
}

async function apiPut(url: string, body: any) {
  const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
  return r.json();
}

async function apiDel(url: string) {
  const r = await fetchAuth(url, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    let errText = await r.text();
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errText = parsed.error;
    } catch {}
    throw new Error(errText);
  }
}

interface InvoiceItem {
  id?: number;
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  price: number;
  cost_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  notes: string;
}

export default function WarehouseSalesInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["warehouse-sales-invoices"],
    queryFn: () => apiGet("/api/warehouse-invoices")
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () => apiGet("/api/customers")
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => apiGet("/api/products")
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-list"],
    queryFn: () => apiGet("/api/branches")
  });

  const { data: safes = [] } = useQuery({
    queryKey: ["safes-list"],
    queryFn: () => apiGet("/api/safes")
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: () => apiGet("/api/accounts")
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-list"],
    queryFn: () => apiGet("/api/warehouses")
  });

  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => apiGet("/api/settings").catch(() => ({}))
  });

  const { data: docPrintSettings } = useQuery({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings").catch(() => ({}))
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<"form" | "table">("form");

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewHtml, setPreviewHtml] = useState("");

  const [formData, setFormData] = useState<any>({
    invoice_no: "INV-0001",
    ref_no: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    invoice_time: new Date().toTimeString().slice(0, 5),
    branch_id: 1,
    warehouse_id: 1,
    account_code: "11400",
    customer_id: null,
    customer_name: "عميل نقدي عام",
    payment_type: "cash", // 'cash' | 'credit' | 'bank' | 'multiple'
    safe_id: null,
    salesman_name: "مسؤول المبيعات",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    currency: "YER",
    exchange_rate: 1.0,
    price_level: "جملة",
    notes: "",
    discount_percent: 0,
    tax_percent: 0,
    items: [] as InvoiceItem[]
  });

  const currentInvoice = invoices[currentIndex] || null;

  useEffect(() => {
    if (currentInvoice && !isNew && !isEditing) {
      setFormData({
        id: currentInvoice.id,
        invoice_no: currentInvoice.invoice_no,
        ref_no: currentInvoice.ref_no || "",
        invoice_date: currentInvoice.invoice_date || new Date().toISOString().slice(0, 10),
        invoice_time: currentInvoice.invoice_time || "12:00",
        branch_id: currentInvoice.branch_id || 1,
        customer_id: currentInvoice.customer_id || null,
        customer_name: currentInvoice.customer_name || "عميل عام",
        payment_type: currentInvoice.payment_type || "cash",
        safe_id: currentInvoice.safe_id || null,
        salesman_name: currentInvoice.salesman_name || "مسؤول المبيعات",
        due_date: currentInvoice.due_date || "",
        currency: currentInvoice.currency || "YER",
        exchange_rate: currentInvoice.exchange_rate || 1.0,
        price_level: currentInvoice.price_level || "جملة",
        notes: currentInvoice.notes || "",
        discount_percent: currentInvoice.discount_percent || 0,
        tax_percent: currentInvoice.tax_percent || 0,
        status: currentInvoice.status || "draft",
        is_posted: Boolean(currentInvoice.is_posted),
        posted_at: currentInvoice.posted_at,
        created_by: currentInvoice.created_by,
        created_at: currentInvoice.created_at,
        updated_by: currentInvoice.updated_by,
        updated_at: currentInvoice.updated_at,
        items: currentInvoice.items || []
      });
    }
  }, [currentInvoice, isNew, isEditing]);

  // Recalculate row totals
  const calculatedItems = useMemo(() => {
    return (formData.items || []).map((it: InvoiceItem) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      const discAmt = gross * ((Number(it.discount_percent) || 0) / 100);
      const afterDisc = gross - discAmt;
      const taxAmt = afterDisc * ((Number(it.tax_percent) || 0) / 100);
      const net = afterDisc + taxAmt;
      return {
        ...it,
        discount_amount: discAmt,
        tax_amount: taxAmt,
        total: net
      };
    });
  }, [formData.items]);

  // Summary calculations
  const invoiceSummary = useMemo(() => {
    const subtotal = calculatedItems.reduce((sum: number, it: any) => sum + (it.quantity * it.price), 0);
    const itemsDiscount = calculatedItems.reduce((sum: number, it: any) => sum + (it.discount_amount || 0), 0);
    const invoiceDiscount = (subtotal - itemsDiscount) * ((Number(formData.discount_percent) || 0) / 100);
    const totalDiscount = itemsDiscount + invoiceDiscount;
    const taxableAmount = subtotal - totalDiscount;
    const totalTax = taxableAmount * ((Number(formData.tax_percent) || 0) / 100);
    const netTotal = taxableAmount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      netTotal,
      itemsCount: calculatedItems.length,
      quantitiesCount: calculatedItems.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0)
    };
  }, [calculatedItems, formData.discount_percent, formData.tax_percent]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const body = {
        ...payload,
        items: calculatedItems,
        subtotal: invoiceSummary.subtotal,
        discount_amount: invoiceSummary.totalDiscount,
        tax_amount: invoiceSummary.totalTax,
        net_amount: invoiceSummary.netTotal,
        paid_amount: payload.payment_type === "cash" ? invoiceSummary.netTotal : 0,
        remaining_amount: payload.payment_type === "cash" ? 0 : invoiceSummary.netTotal
      };
      if (isNew) {
        return apiPost("/api/warehouse-invoices", body);
      } else {
        return apiPut(`/api/warehouse-invoices/${currentInvoice.id}`, body);
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-sales-invoices"] });
      toast({
        title: isNew ? "تم حفظ الفاتورة بنجاح" : "تم تحديث الفاتورة بنجاح",
        description: `فاتورة مبيعات رقم ${saved.invoice_no} محفوظة بالنظام.`
      });
      setIsNew(false);
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ أثناء الحفظ",
        description: err.message || "تعذر حفظ الفاتورة",
        variant: "destructive"
      });
    }
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiPost(`/api/warehouse-invoices/${id}/post`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast({
        title: "تم ترحيل الفاتورة بنجاح",
        description: "تم خصم الكميات من المخزن وإنشاء القيود المحاسبية الآلية."
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الترحيل",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const unpostMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiPost(`/api/warehouse-invoices/${id}/unpost`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-sales-invoices"] });
      toast({
        title: "تم إلغاء ترحيل الفاتورة",
        description: "تمت إعادة الكميات إلى المخزن وإلغاء القيد المحاسبي."
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في إلغاء الترحيل",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiDel(`/api/warehouse-invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-sales-invoices"] });
      toast({ title: "تم حذف الفاتورة" });
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحذف", description: err.message, variant: "destructive" });
    }
  });

  const handleNew = () => {
    const nextNum = (invoices.length > 0 ? Math.max(...invoices.map((inv: any) => Number(inv.id || 0))) : 0) + 1;
    const invNoStr = `INV-${String(nextNum).padStart(5, "0")}`;
    
    setFormData({
      invoice_no: invNoStr,
      ref_no: "",
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_time: new Date().toTimeString().slice(0, 5),
      branch_id: branches[0]?.id || 1,
      customer_id: customers[0]?.id || null,
      customer_name: customers[0]?.name || "عميل نقدي عام",
      payment_type: "cash",
      safe_id: safes[0]?.id || null,
      salesman_name: "مسؤول المبيعات",
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: "YER",
      exchange_rate: 1.0,
      price_level: "جملة",
      notes: "",
      discount_percent: 0,
      tax_percent: 0,
      items: [
        {
          product_id: products[0]?.id || 1,
          product_code: products[0]?.code || "PRD-01",
          product_name: products[0]?.name || "صنف تجريبي",
          unit: "حبة",
          quantity: 1,
          price: Number(products[0]?.price || 1000),
          cost_price: Number(products[0]?.cost_price || 800),
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          total: Number(products[0]?.price || 1000),
          notes: ""
        }
      ]
    });
    setIsNew(true);
    setIsEditing(true);
    setActiveView("form");
  };

  const handleAddItem = () => {
    const firstP = products[0] || { id: 1, code: "PRD-01", name: "صنف تجاري", price: 1000, cost_price: 800 };
    setFormData({
      ...formData,
      items: [
        ...(formData.items || []),
        {
          product_id: firstP.id,
          product_code: firstP.code || `PRD-${firstP.id}`,
          product_name: firstP.name,
          unit: "حبة",
          quantity: 1,
          price: Number(firstP.price || 0),
          cost_price: Number(firstP.cost_price || 0),
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          total: Number(firstP.price || 0),
          notes: ""
        }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleProductSelect = (index: number, prodId: number) => {
    const p = products.find((x: any) => x.id === Number(prodId));
    if (!p) return;
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      product_id: p.id,
      product_code: p.code || `PRD-${p.id}`,
      product_name: p.name,
      price: Number(p.price || 0),
      cost_price: Number(p.cost_price || 0),
      unit: p.unit || "حبة",
    };
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handlePreviewInvoice = (invoiceToPreview?: any) => {
    const targetInv = invoiceToPreview || currentInvoice || formData;
    const itemsToUse = (targetInv.items && targetInv.items.length > 0) ? targetInv.items : calculatedItems;
    
    // Get custom print settings from localStorage or API
    let printSettings: any = { ...(systemSettings || {}), ...(docPrintSettings || {}) };
    try {
      const savedDocSettings = localStorage.getItem("pos_doc_print_settings");
      if (savedDocSettings) {
        printSettings = { ...printSettings, ...JSON.parse(savedDocSettings) };
      }
    } catch {}

    const fullInvoiceData = {
      ...targetInv,
      items: itemsToUse,
      subtotal: targetInv.subtotal || invoiceSummary.subtotal,
      discount_amount: targetInv.discount_amount || invoiceSummary.totalDiscount,
      tax_amount: targetInv.tax_amount || invoiceSummary.totalTax,
      net_amount: targetInv.net_amount || invoiceSummary.netTotal,
      paid_amount: targetInv.paid_amount ?? (targetInv.payment_type === "cash" ? (targetInv.net_amount || invoiceSummary.netTotal) : 0),
      remaining_amount: targetInv.remaining_amount ?? (targetInv.payment_type === "cash" ? 0 : (targetInv.net_amount || invoiceSummary.netTotal)),
      customer_name: targetInv.customer_name || formData.customer_name || "عميل نقدي عام",
      warehouse_name: warehouses.find((w: any) => w.id === targetInv.warehouse_id)?.name || "المستودع الرئيسي",
      branch_name: branches.find((b: any) => b.id === targetInv.branch_id)?.name || "الفرع الرئيسي",
      account_code: targetInv.account_code || formData.account_code || "11400"
    };

    const html = generateWarehouseInvoiceA4Html(fullInvoiceData, printSettings);
    setPreviewHtml(html);
    setPreviewZoom(100);
    setPreviewOpen(true);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-full space-y-3 font-sans" dir="rtl">
        {/* ─── Top Main Onyx ERP Toolbar ─── */}
        <div className="bg-gradient-to-b from-[#1b3a4b] to-[#0d212d] text-white px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded text-amber-300 border border-white/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide">فاتورة المبيعات المخزنية (نقد / آجل)</h2>
                {formData.is_posted ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> مرحلة مخزنياً ومحاسبياً
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-300 border-amber-300/40 text-[10px] gap-1">
                    <Clock className="w-3 h-3" /> مسودة (غير مرحلة)
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                إصدار الفواتير الرسمية للعملاء، خصم المخزون الآلي، قيود الحسابات، وتحليل المبيعات والذمم
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-md border border-white/10">
            <Button
              size="sm"
              onClick={handleNew}
              disabled={isEditing}
              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة فاتورة
            </Button>

            <Button
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isEditing || !currentInvoice || currentInvoice.is_posted}
              className="h-7 px-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              تعديل
            </Button>

            <Button
              size="sm"
              onClick={() => saveMutation.mutate(formData)}
              disabled={!isEditing || saveMutation.isPending}
              className="h-7 px-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              حفظ
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setIsNew(false); setIsEditing(false); }}
              disabled={!isEditing}
              className="h-7 px-2 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إلغاء
            </Button>

            {/* Posting Buttons */}
            {currentInvoice && !currentInvoice.is_posted && (
              <Button
                size="sm"
                onClick={() => postMutation.mutate(currentInvoice.id)}
                disabled={isEditing || postMutation.isPending}
                className="h-7 px-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold gap-1"
                title="ترحيل الفاتورة وتأثيرها على المخزون والحسابات"
              >
                <Check className="w-3.5 h-3.5" />
                ترحيل
              </Button>
            )}

            {currentInvoice && currentInvoice.is_posted && (
              <Button
                size="sm"
                onClick={() => unpostMutation.mutate(currentInvoice.id)}
                disabled={isEditing || unpostMutation.isPending}
                className="h-7 px-2 bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold gap-1"
                title="إلغاء الترحيل لإعادة التعديل"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                فك الترحيل
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (currentInvoice && confirm(`هل تريد حذف الفاتورة ${currentInvoice.invoice_no}؟`)) {
                  deleteMutation.mutate(currentInvoice.id);
                }
              }}
              disabled={isEditing || !currentInvoice || currentInvoice.is_posted}
              className="h-7 px-2 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              حذف
            </Button>

            <div className="h-5 w-[1px] bg-white/20 mx-1" />

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={() => setCurrentIndex(0)}
              disabled={currentIndex === 0 || isEditing}
              className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
              title="الأول"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0 || isEditing}
              className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-white/10 rounded">
              {invoices.length > 0 ? `${currentIndex + 1} / ${invoices.length}` : "0 / 0"}
            </span>

            <button
              type="button"
              onClick={() => setCurrentIndex(prev => Math.min(invoices.length - 1, prev + 1))}
              disabled={currentIndex >= invoices.length - 1 || isEditing}
              className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex(invoices.length - 1)}
              disabled={currentIndex >= invoices.length - 1 || isEditing}
              className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-40"
              title="الأخير"
            >
              <ChevronLast className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-white/20 mx-1" />

            <button
              type="button"
              onClick={() => setActiveView(activeView === "form" ? "table" : "form")}
              className={`p-1 rounded text-white ${activeView === "table" ? "bg-white/30" : "hover:bg-white/20"}`}
              title="عرض جدول الفواتير"
            >
              <Layers className="w-4 h-4" />
            </button>

            <Button
              size="sm"
              onClick={() => handlePreviewInvoice()}
              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1 shadow-sm"
              title="استعراض الفاتورة الرسمية وتصديرها PDF"
            >
              <Eye className="w-3.5 h-3.5" />
              استعراض الفاتورة
            </Button>

            <button
              type="button"
              onClick={() => {
                const targetInv = currentInvoice || formData;
                let printSettings: any = systemSettings || {};
                try {
                  const saved = localStorage.getItem("pos_doc_print_settings");
                  if (saved) printSettings = { ...printSettings, ...JSON.parse(saved) };
                } catch {}
                const fullInv = {
                  ...targetInv,
                  items: (targetInv.items && targetInv.items.length > 0) ? targetInv.items : calculatedItems,
                  subtotal: targetInv.subtotal || invoiceSummary.subtotal,
                  discount_amount: targetInv.discount_amount || invoiceSummary.totalDiscount,
                  tax_amount: targetInv.tax_amount || invoiceSummary.totalTax,
                  net_amount: targetInv.net_amount || invoiceSummary.netTotal,
                  paid_amount: targetInv.paid_amount ?? (targetInv.payment_type === "cash" ? (targetInv.net_amount || invoiceSummary.netTotal) : 0),
                  remaining_amount: targetInv.remaining_amount ?? (targetInv.payment_type === "cash" ? 0 : (targetInv.net_amount || invoiceSummary.netTotal)),
                  customer_name: targetInv.customer_name || formData.customer_name || "عميل نقدي عام",
                  warehouse_name: warehouses.find((w: any) => w.id === targetInv.warehouse_id)?.name || "المستودع الرئيسي",
                  branch_name: branches.find((b: any) => b.id === targetInv.branch_id)?.name || "الفرع الرئيسي",
                  account_code: targetInv.account_code || formData.account_code || "11400"
                };
                const html = generateWarehouseInvoiceA4Html(fullInv, printSettings);
                printA4Html(html);
              }}
              className="p-1 rounded hover:bg-white/20 text-white"
              title="طباعة الفاتورة"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Invoices Table View Mode ─── */}
        {activeView === "table" ? (
          <div className="bg-white rounded-lg border border-slate-300 p-3 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800">قائمة فواتير المبيعات المخزنية</h3>
              <Button size="sm" onClick={() => setActiveView("form")} className="h-7 text-xs bg-slate-800">
                الرجوع لنموذج الفاتورة
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b text-slate-700 font-bold">
                  <tr>
                    <th className="p-2 text-right">رقم الفاتورة</th>
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">العميل</th>
                    <th className="p-2 text-right">طريقة الدفع</th>
                    <th className="p-2 text-right">المخزن / الفرع</th>
                    <th className="p-2 text-left">إجمالي الفاتورة</th>
                    <th className="p-2 text-center">الحالة</th>
                    <th className="p-2 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv: any, idx: number) => (
                    <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setCurrentIndex(idx); setActiveView("form"); }}>
                      <td className="p-2 font-mono font-bold text-blue-700">{inv.invoice_no}</td>
                      <td className="p-2 font-mono">{inv.invoice_date}</td>
                      <td className="p-2 font-bold">{inv.customer_name}</td>
                      <td className="p-2">
                        {inv.payment_type === "cash" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">نقداً</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">آجل / ذمم</Badge>
                        )}
                      </td>
                      <td className="p-2">{inv.warehouse_name || inv.branch_name || "المستودع الرئيسي"}</td>
                      <td className="p-2 text-left font-mono font-bold text-slate-900" dir="ltr">
                        {Number(inv.net_amount || 0).toLocaleString()} {inv.currency || "YER"}
                      </td>
                      <td className="p-2 text-center">
                        {inv.is_posted ? (
                          <span className="text-emerald-700 font-bold">مرحل</span>
                        ) : (
                          <span className="text-slate-400">مسودة</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewInvoice(inv);
                          }}
                          className="h-6 px-2 text-[10px] text-blue-700 hover:bg-blue-50 font-bold gap-1"
                        >
                          <Eye className="w-3 h-3" /> استعراض
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ─── Form View Mode (Classic ERP Invoice Screen) ─── */
          <div className="space-y-3">
            {/* Header Form Details */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                {/* Invoice No */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">رقم الفاتورة *</label>
                  <Input
                    type="text"
                    disabled={!isEditing}
                    value={formData.invoice_no}
                    onChange={e => setFormData({ ...formData, invoice_no: e.target.value })}
                    className="h-8 font-mono font-bold text-blue-800 border-slate-300 bg-slate-50"
                  />
                </div>

                {/* Reference No */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">الرقم المرجعي / السند</label>
                  <Input
                    type="text"
                    disabled={!isEditing}
                    value={formData.ref_no}
                    onChange={e => setFormData({ ...formData, ref_no: e.target.value })}
                    className="h-8 font-mono border-slate-300"
                    placeholder="PO-9921"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">تاريخ الفاتورة</label>
                  <Input
                    type="date"
                    disabled={!isEditing}
                    value={formData.invoice_date}
                    onChange={e => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="h-8 font-mono border-slate-300"
                  />
                </div>

                {/* Customer */}
                <div className="col-span-2">
                  <label className="block text-slate-600 font-semibold mb-1">العميل / الحساب المدين *</label>
                  <div className="flex gap-1">
                    <select
                      disabled={!isEditing}
                      value={formData.customer_id || ""}
                      onChange={e => {
                        const custId = e.target.value ? Number(e.target.value) : null;
                        const c = customers.find((x: any) => x.id === custId);
                        setFormData({
                          ...formData,
                          customer_id: custId,
                          customer_name: c ? c.name : "عميل نقدي عام",
                          account_code: c?.account_code || "11400"
                        });
                      }}
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      <option value="">-- عميل نقدي عام (بدون حساب) --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.account_code ? `[حساب: ${c.account_code}]` : ''} - {c.phone || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">طريقة الدفع *</label>
                  <select
                    disabled={!isEditing}
                    value={formData.payment_type}
                    onChange={e => setFormData({ ...formData, payment_type: e.target.value })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="cash">نقداً (Cash)</option>
                    <option value="credit">آجل / ذمم (Credit)</option>
                    <option value="bank">حوالة بنكية / شبكة</option>
                    <option value="multiple">دفع متعدد (جزئي)</option>
                  </select>
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">المستودع / المخزن *</label>
                  <select
                    disabled={!isEditing}
                    value={formData.warehouse_id || 1}
                    onChange={e => setFormData({ ...formData, warehouse_id: Number(e.target.value) })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                  >
                    {warehouses.length > 0 ? (
                      warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code || `WH-${w.id}`})</option>
                      ))
                    ) : (
                      <option value="1">المستودع الرئيسي (WH-01)</option>
                    )}
                  </select>
                </div>

                {/* Account from Chart of Accounts */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">حساب المدين / الدليل</label>
                  <select
                    disabled={!isEditing}
                    value={formData.account_code || "11400"}
                    onChange={e => setFormData({ ...formData, account_code: e.target.value })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-mono"
                  >
                    <option value="11400">11400 - ذمم العملاء (عام)</option>
                    <option value="11101">11101 - الصندوق الرئيسي (نقد)</option>
                    <option value="11200">11200 - الذمم المدينة والشركاء</option>
                    {accounts.filter((a: any) => a.code?.startsWith('11') || a.type === 'asset').map((a: any) => (
                      <option key={a.id || a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">الفرع التجاري</label>
                  <select
                    disabled={!isEditing}
                    value={formData.branch_id}
                    onChange={e => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Safe / Cashbox */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">صندوق القبض / الخزينة</label>
                  <select
                    disabled={!isEditing || formData.payment_type === "credit"}
                    value={formData.safe_id || ""}
                    onChange={e => setFormData({ ...formData, safe_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs disabled:bg-slate-100"
                  >
                    <option value="">-- الصندوق الرئيسي للفرع --</option>
                    {safes.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.currency || "YER"})</option>
                    ))}
                  </select>
                </div>

                {/* Due Date for Credit */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">تاريخ الاستحقاق للآجل</label>
                  <Input
                    type="date"
                    disabled={!isEditing || formData.payment_type !== "credit"}
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="h-8 font-mono border-slate-300 disabled:bg-slate-100"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">العملة</label>
                  <select
                    disabled={!isEditing}
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-mono"
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>

                {/* Price Level */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">مستوى التسعير</label>
                  <select
                    disabled={!isEditing}
                    value={formData.price_level}
                    onChange={e => setFormData({ ...formData, price_level: e.target.value })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="جملة">سعر الجملة</option>
                    <option value="تجزئة">سعر التجزئة</option>
                    <option value="خاص">سعر الموزع الخاص</option>
                  </select>
                </div>

                {/* Salesman */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">مسؤول المبيعات / المندوب</label>
                  <Input
                    type="text"
                    disabled={!isEditing}
                    value={formData.salesman_name}
                    onChange={e => setFormData({ ...formData, salesman_name: e.target.value })}
                    className="h-8 border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* ─── Items Detail Grid ─── */}
            <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-xs">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-700" />
                  أصناف ومحتويات الفاتورة المخزنية
                </h3>
                {isEditing && (
                  <Button size="sm" onClick={handleAddItem} className="h-6 px-2 text-xs bg-emerald-700 hover:bg-emerald-600 gap-1">
                    <Plus className="w-3 h-3" /> إضافة صنف
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#e9edf2] text-slate-700 border-b border-slate-300 font-bold">
                    <tr>
                      <th className="p-2 text-center w-10">م</th>
                      <th className="p-2 text-right min-w-[200px]">الصنف / البند</th>
                      <th className="p-2 text-center w-24">الوحدة</th>
                      <th className="p-2 text-center w-24">الكمية</th>
                      <th className="p-2 text-center w-28">سعر الوحدة</th>
                      <th className="p-2 text-center w-20">الخصم %</th>
                      <th className="p-2 text-center w-20">الضريبة %</th>
                      <th className="p-2 text-left w-28">الإجمالي الصافي</th>
                      <th className="p-2 text-right min-w-[150px]">ملاحظات الصنف</th>
                      {isEditing && <th className="p-2 text-center w-12"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {calculatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-slate-400">
                          لا توجد أصناف مدخلة في الفاتورة. اضغط على "إضافة صنف" للبدء.
                        </td>
                      </tr>
                    ) : (
                      calculatedItems.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-blue-50/50">
                          <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2">
                            {isEditing ? (
                              <select
                                value={it.product_id}
                                onChange={e => handleProductSelect(idx, Number(e.target.value))}
                                className="w-full h-7 px-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                              >
                                {products.map((p: any) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.code || `PRD-${p.id}`}) - متاح: {p.stock ?? 0}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-900">{it.product_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{it.product_code}</div>
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isEditing ? (
                              <Input
                                value={it.unit}
                                onChange={e => handleItemChange(idx, "unit", e.target.value)}
                                className="h-7 text-center text-xs"
                              />
                            ) : (
                              <span>{it.unit || "حبة"}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={e => handleItemChange(idx, "quantity", Number(e.target.value))}
                                className="h-7 text-center font-mono font-bold text-xs"
                              />
                            ) : (
                              <span className="font-mono font-bold">{it.quantity}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={it.price}
                                onChange={e => handleItemChange(idx, "price", Number(e.target.value))}
                                className="h-7 text-center font-mono font-bold text-xs"
                              />
                            ) : (
                              <span className="font-mono">{Number(it.price).toLocaleString()}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={it.discount_percent}
                                onChange={e => handleItemChange(idx, "discount_percent", Number(e.target.value))}
                                className="h-7 text-center font-mono text-xs"
                              />
                            ) : (
                              <span className="font-mono text-slate-500">{it.discount_percent || 0}%</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={it.tax_percent}
                                onChange={e => handleItemChange(idx, "tax_percent", Number(e.target.value))}
                                className="h-7 text-center font-mono text-xs"
                              />
                            ) : (
                              <span className="font-mono text-slate-500">{it.tax_percent || 0}%</span>
                            )}
                          </td>
                          <td className="p-2 text-left font-mono font-bold text-blue-900" dir="ltr">
                            {Number(it.total || 0).toLocaleString()} {formData.currency}
                          </td>
                          <td className="p-2">
                            {isEditing ? (
                              <Input
                                value={it.notes || ""}
                                onChange={e => handleItemChange(idx, "notes", e.target.value)}
                                className="h-7 text-xs"
                                placeholder="ملاحظات الصنف..."
                              />
                            ) : (
                              <span className="text-slate-500">{it.notes || "—"}</span>
                            )}
                          </td>
                          {isEditing && (
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded hover:bg-red-50 text-red-600"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ─── Summary & Totals Box ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Notes & Terms */}
              <div className="md:col-span-2 bg-white border border-slate-300 rounded-lg p-3 shadow-xs space-y-2">
                <label className="block text-slate-700 font-bold text-xs">الشروط والملاحظات العامة للفاتورة</label>
                <textarea
                  disabled={!isEditing}
                  value={formData.notes || ""}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
                  placeholder="اكتب هنا أي شروط خاصة بالتسليم، الضمان، أو الشروط المحاسبية..."
                />
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>عدد البنود: <strong className="text-slate-800 font-mono">{invoiceSummary.itemsCount}</strong></span>
                  <span>إجمالي الكميات: <strong className="text-slate-800 font-mono">{invoiceSummary.quantitiesCount}</strong></span>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-[#f8fafc] border border-slate-300 rounded-lg p-3 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>المجموع الإجمالي:</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {invoiceSummary.subtotal.toLocaleString()} {formData.currency}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1">
                    خصم إضافي:
                    {isEditing && (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.discount_percent}
                        onChange={e => setFormData({ ...formData, discount_percent: Number(e.target.value) })}
                        className="h-6 w-14 text-center font-mono text-[11px]"
                      />
                    )}
                  </span>
                  <span className="font-mono text-red-600" dir="ltr">
                    - {invoiceSummary.totalDiscount.toLocaleString()} {formData.currency}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>إجمالي الضريبة:</span>
                  <span className="font-mono text-slate-700" dir="ltr">
                    + {invoiceSummary.totalTax.toLocaleString()} {formData.currency}
                  </span>
                </div>

                <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">صافي الفاتورة النهائي:</span>
                  <span className="font-mono font-bold text-blue-800 text-base" dir="ltr">
                    {invoiceSummary.netTotal.toLocaleString()} {formData.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── Classic Onyx ERP Audit Footer Bar ─── */}
            <div className="bg-[#e2e7ee] border-t-2 border-slate-300 px-3 py-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] text-slate-700 rounded-b-lg">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
                <span className="text-slate-500 font-semibold">أدخلت بواسطة:</span>
                <span className="font-bold text-slate-800 truncate">{currentInvoice?.created_by || "مدير النظام"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
                <span className="text-slate-500 font-semibold">تاريخ الإدخال:</span>
                <span className="font-mono text-slate-800 truncate" dir="ltr">{currentInvoice?.created_at || "18/07/2026 07:30:00"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
                <span className="text-slate-500 font-semibold">عدلت بواسطة:</span>
                <span className="font-bold text-slate-800 truncate">{currentInvoice?.updated_by || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
                <span className="text-slate-500 font-semibold">تاريخ التعديل:</span>
                <span className="font-mono text-slate-800 truncate" dir="ltr">{currentInvoice?.updated_at || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 col-span-2 md:col-span-1">
                <span className="text-slate-500 font-semibold">حالة الترحيل:</span>
                <span className="font-bold text-blue-700">{currentInvoice?.is_posted ? "مرحل محاسبياً" : "غير مرحل"}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── A4 Invoice Preview Modal ─── */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-100" dir="rtl">
            <DialogHeader className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-row items-center justify-between border-b shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <DialogTitle className="text-sm font-bold text-white">استعراض ومعاينة فاتورة المبيعات الرسمية (A4)</DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-300">
                    معاينة حية دقيقة للفاتورة قبل الطباعة أو التصدير بتنسيق PDF
                  </DialogDescription>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-white/10 rounded border border-white/20 px-1 py-0.5 text-xs text-white">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                    className="p-1 hover:bg-white/20 rounded"
                    title="تصغير"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono text-[11px]">{previewZoom}%</span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                    className="p-1 hover:bg-white/20 rounded"
                    title="تكبير"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(100)}
                    className="px-1.5 py-0.5 text-[10px] hover:bg-white/20 rounded font-semibold text-amber-300"
                    title="إعادة ضبط الحجم"
                  >
                    100%
                  </button>
                </div>

                <Button
                  size="sm"
                  onClick={() => printA4Html(previewHtml)}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" /> طباعة
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    const invNo = currentInvoice?.invoice_no || formData.invoice_no || "فاتورة-مبيعات";
                    saveA4HtmlAsPdf(previewHtml, `${invNo}.pdf`);
                  }}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1 shadow"
                >
                  <Download className="w-3.5 h-3.5" /> تحميل PDF
                </Button>
              </div>
            </DialogHeader>

            {/* Rendered A4 Document Container */}
            <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-300/60">
              <div
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out"
                }}
                className="bg-white shadow-2xl rounded-sm my-2"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
