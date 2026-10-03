import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Sliders, Plus, Save, Trash2, Edit3, Printer, RefreshCw, CheckCircle2,
  SlidersHorizontal, Layers, ArrowRightLeft, FileText, ClipboardList, Package,
  Info, Check, Sparkles, Utensils, Download, Search, AlertCircle
} from "lucide-react";

export type TransactionCategory = "adjustments" | "issues" | "receipts" | "requisitions";

export interface StockAdjustmentType {
  id: number;
  type_number: number;
  name: string;
  foreign_name: string;
  active: number;
  created_at?: string;
}

export interface StockIssueType {
  id: number;
  type_number: number;
  name: string;
  foreign_name: string;
  is_restaurant: number;
  active: number;
  created_at?: string;
}

export interface StockReceiptType {
  id: number;
  type_number: number;
  name: string;
  foreign_name: string;
  active: number;
  created_at?: string;
}

export interface StockRequisitionType {
  id: number;
  type_number: number;
  name: string;
  foreign_name: string;
  requisition_effect_type: "issue" | "transfer" | "all";
  active: number;
  created_at?: string;
}

interface Props {
  initialCategory?: TransactionCategory;
}

export function ErpInventoryTransactionTypesScreen({ initialCategory = "adjustments" }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<TransactionCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [typeNumber, setTypeNumber] = useState<number>(1);
  const [name, setName] = useState<string>("");
  const [foreignName, setForeignName] = useState<string>("");
  const [isRestaurant, setIsRestaurant] = useState<boolean>(false);
  const [requisitionEffect, setRequisitionEffect] = useState<"issue" | "transfer" | "all">("all");

  // Fetch all transaction types
  const { data: allTypesResponse, isLoading, refetch } = useQuery({
    queryKey: ["inventory-types-all"],
    queryFn: async () => {
      const res = await fetch("/api/inventory-types/all");
      if (!res.ok) throw new Error("فشل تحميل أنواع معاملات المخزون");
      return res.json();
    }
  });

  const adjustmentsData: StockAdjustmentType[] = allTypesResponse?.data?.adjustments || [];
  const issuesData: StockIssueType[] = allTypesResponse?.data?.issues || [];
  const receiptsData: StockReceiptType[] = allTypesResponse?.data?.receipts || [];
  const requisitionsData: StockRequisitionType[] = allTypesResponse?.data?.requisitions || [];

  // Set default next number when tab or dataset changes
  useEffect(() => {
    handleResetForm();
  }, [activeCategory, allTypesResponse]);

  const handleResetForm = () => {
    setEditingId(null);
    setName("");
    setForeignName("");
    setIsRestaurant(false);
    setRequisitionEffect("all");

    let maxNum = 0;
    if (activeCategory === "adjustments") {
      maxNum = Math.max(0, ...adjustmentsData.map(d => d.type_number || 0));
      setName("تسوية مخزون جديدة");
      setForeignName("Stock Adjustment");
    } else if (activeCategory === "issues") {
      maxNum = Math.max(0, ...issuesData.map(d => d.type_number || 0));
      setName("أمر صرف مخزني جديد");
      setForeignName("Outgoing");
    } else if (activeCategory === "receipts") {
      maxNum = Math.max(0, ...receiptsData.map(d => d.type_number || 0));
      setName("أمر توريد مخزني جديد");
      setForeignName("Incoming");
    } else if (activeCategory === "requisitions") {
      maxNum = Math.max(0, ...requisitionsData.map(d => d.type_number || 0));
      setName("طلب مخزني جديد");
      setForeignName("Store Requisition");
    }
    setTypeNumber(maxNum + 1);
  };

  const handleEditRow = (item: any) => {
    setEditingId(item.id);
    setTypeNumber(item.type_number);
    setName(item.name || "");
    setForeignName(item.foreign_name || "");
    if (activeCategory === "issues") {
      setIsRestaurant(Boolean(item.is_restaurant));
    } else if (activeCategory === "requisitions") {
      setRequisitionEffect(item.requisition_effect_type || "all");
    }
  };

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name || name.trim() === "") throw new Error("يرجى إدخال اسم الشاشة / النوع");

      const endpoint = `/api/inventory-types/${activeCategory}${editingId ? `/${editingId}` : ""}`;
      const method = editingId ? "PUT" : "POST";

      const bodyPayload: any = {
        type_number: typeNumber,
        name: name.trim(),
        foreign_name: foreignName.trim(),
        active: 1
      };

      if (activeCategory === "issues") {
        bodyPayload.is_restaurant = isRestaurant ? 1 : 0;
      } else if (activeCategory === "requisitions") {
        bodyPayload.requisition_effect_type = requisitionEffect;
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل حفظ البيانات");
      return resData;
    },
    onSuccess: (resData) => {
      toast({
        title: "حفظ ناجح ✅",
        description: resData.message || "تم حفظ البيانات بنجاح"
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-types-all"] });
      handleResetForm();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الحفظ ❌",
        description: error.message || "فشلت العملية",
        variant: "destructive"
      });
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/inventory-types/${activeCategory}/${id}`, {
        method: "DELETE"
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل الحذف");
      return resData;
    },
    onSuccess: () => {
      toast({
        title: "تم الحذف 🗑️",
        description: "تم حذف السجل بنجاح"
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-types-all"] });
      handleResetForm();
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الحذف",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Print list
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 dir-rtl text-right font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/30 rounded-2xl border border-indigo-400/30 text-indigo-300">
              <SlidersHorizontal className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">تهيئة أنواع معاملات وأوامر المخزون</h1>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-400/40 px-3 py-1">
                  نظام أومني سيستم برو ERP
                </Badge>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                تقسيم وإدارة أنواع التسويات الصرف التوريد والطلبات المخزنية للتحكم بالترقيم والتسلسل التلقائي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <Printer className="w-4 h-4 ml-2" />
              طباعة النماذج
            </Button>
          </div>
        </div>

        {/* Categories Tab Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => setActiveCategory("adjustments")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeCategory === "adjustments"
                ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-5 h-5 text-sky-400" />
              <span>أنواع تسوية المخزون</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{adjustmentsData.length}</Badge>
          </button>

          <button
            onClick={() => setActiveCategory("issues")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeCategory === "issues"
                ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>أنواع الصرف</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{issuesData.length}</Badge>
          </button>

          <button
            onClick={() => setActiveCategory("receipts")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeCategory === "receipts"
                ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30 font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-purple-300" />
              <span>أنواع التوريد</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{receiptsData.length}</Badge>
          </button>

          <button
            onClick={() => setActiveCategory("requisitions")}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-right ${
              activeCategory === "requisitions"
                ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30 font-bold scale-[1.02]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ArrowRightLeft className="w-5 h-5 text-amber-300" />
              <span>أنواع الطلبات</span>
            </div>
            <Badge className="bg-white/20 text-white border-none">{requisitionsData.length}</Badge>
          </button>
        </div>
      </div>

      {/* Guide & Goals Section (طريقة الاستخدام الشرح بالصور) */}
      <Card className="border-cyan-200 bg-cyan-50/50 dark:bg-slate-900/50 dark:border-cyan-900/50">
        <CardContent className="p-5">
          {activeCategory === "adjustments" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-200 font-bold text-base">
                <Info className="w-5 h-5 text-cyan-600" />
                <span>أنواع تسوية المخزون - تهدف الشاشة إلى:</span>
              </div>
              <p className="text-sm text-cyan-950 dark:text-cyan-300 leading-relaxed">
                من خلال هذه الشاشة يمكنك <strong>تقسيم التسويات المخزنية إلى أكثر من نوع حسب أي اعتبار</strong>، وممكن أيضاً أن يكون تسلسل التسويات المخزنية بحسب النوع.
              </p>
              <div className="text-xs text-cyan-800 dark:text-cyan-400 pt-2 border-t border-cyan-200/60 dark:border-cyan-800/60">
                <strong>خطوات الاستخدام:</strong> يتم إدخال رقم التسلسل (مثل 1, 2) ثم اسم التسوية (مثل: تسوية مخزون، تسوية جرد سنوي) والاسم الأجنبي. تستخدم الشاشة بشكل أساسي في التسويات المخزنية وتظهر في تقارير التسويات المخزنية.
              </div>
            </div>
          )}

          {activeCategory === "issues" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-base">
                <Info className="w-5 h-5 text-emerald-600" />
                <span>أنواع الصرف المخزني - تهدف الشاشة إلى:</span>
              </div>
              <p className="text-sm text-emerald-950 dark:text-emerald-300 leading-relaxed">
                من خلال هذه الشاشة يمكنك <strong>تقسيم أوامر الصرف المخزنية إلى أكثر من نوع</strong> بحيث يتم التحكم بتسلسل الصرف بحسب النوع أو المخزن.
              </p>
              <div className="text-xs text-emerald-800 dark:text-emerald-400 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div>
                  <strong>خطوات الاستخدام:</strong> إدخال رقم نوع امر الصرف واسمه العربي والأجنبي (مثال: أمر صرف مخزني الإدارة). تستخدم الشاشة في الصرف المخزني وتظهر في تقارير الصرف.
                </div>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 shrink-0">
                  <Utensils className="w-3.5 h-3.5 ml-1" />
                  خيارات نظام المطاعم متوفرة
                </Badge>
              </div>
            </div>
          )}

          {activeCategory === "receipts" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-base">
                <Info className="w-5 h-5 text-purple-600" />
                <span>أنواع التوريد المخزني - تهدف الشاشة إلى:</span>
              </div>
              <p className="text-sm text-purple-950 dark:text-purple-300 leading-relaxed">
                من خلال هذه الشاشة يمكنك <strong>تقسيم أوامر التوريد المخزنية إلى أكثر من نوع</strong> بحيث يتم التحكم بتسلسل التوريد بحسب النوع والمخزن.
              </p>
              <div className="text-xs text-purple-800 dark:text-purple-400 pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                <strong>خطوات الاستخدام:</strong> إدخال رقم أمر التوريد والاسم (مثل: أمر توريد مخزني صنعاء) والاسم الأجنبي (Incoming). تستخدم في التوريد المخزني وتظهر في تقارير التوريد.
              </div>
            </div>
          )}

          {activeCategory === "requisitions" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-base">
                <Info className="w-5 h-5 text-amber-600" />
                <span>أنواع الطلبات المخزنية - تهدف الشاشة إلى:</span>
              </div>
              <p className="text-sm text-amber-950 dark:text-amber-300 leading-relaxed">
                <strong>تقسيم أنواع الطلبات إلى أكثر من نوع</strong> بحيث يتم التحكم بتسلسل الطلبات بحسب النوع، والتحكم في نوع التأثير (طلب صرف مخزني، طلب تحويل مخزني، أو كلي).
              </p>
              <div className="text-xs text-amber-800 dark:text-amber-400 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                <strong>تأثير نوع الطلب:</strong> إذا تم تحديد (صرف) يظهر الطلب فقط في شاشة الصرف. وإذا تم تحديد (تحويل) يظهر فقط في شاشة التحويل. وإذا كان (كلي) يظهر في الصرف والتحويل معاً.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Grid: Screen Form Mockup (Matching Image Design) & Interactive Data Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Panel (Screen Box Mockup with Light Teal Background like User Image) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-2 border-teal-600/40 bg-[#c2ecee] dark:bg-slate-900 dark:border-teal-800 shadow-md">
            <CardHeader className="bg-teal-700 text-white p-4 rounded-t-lg flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {editingId ? <Edit3 className="w-5 h-5 text-amber-300" /> : <Plus className="w-5 h-5 text-emerald-300" />}
                {activeCategory === "adjustments" && (editingId ? "تعديل نوع تسوية مخزون" : "إضافة نوع تسوية مخزون")}
                {activeCategory === "issues" && (editingId ? "تعديل نوع أمر صرف مخزني" : "إضافة نوع أمر صرف مخزني")}
                {activeCategory === "receipts" && (editingId ? "تعديل نوع أمر توريد مخزني" : "إضافة نوع أمر توريد مخزني")}
                {activeCategory === "requisitions" && (editingId ? "تعديل نوع طلب مخزني" : "إضافة نوع طلب مخزني")}
              </CardTitle>
              {editingId && (
                <Button size="sm" variant="ghost" className="text-white hover:bg-teal-800" onClick={handleResetForm}>
                  إلغاء التعديل
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-5 text-slate-900 dark:text-slate-100">
              {/* Field 1: الرقم (Number) */}
              <div className="grid grid-cols-12 items-center gap-3">
                <Label className="col-span-4 text-sm font-bold text-slate-900 dark:text-slate-200">
                  الرقم <span className="text-red-600">*</span>:
                </Label>
                <div className="col-span-8">
                  <Input
                    type="number"
                    value={typeNumber}
                    onChange={(e) => setTypeNumber(Number(e.target.value))}
                    className="bg-amber-50 dark:bg-slate-800 border-teal-400 font-bold text-center text-lg shadow-inner text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Field 2: الاسم (Name) */}
              <div className="grid grid-cols-12 items-center gap-3">
                <Label className="col-span-4 text-sm font-bold text-slate-900 dark:text-slate-200">
                  الاسم <span className="text-red-600">*</span>:
                </Label>
                <div className="col-span-8">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      activeCategory === "adjustments" ? "مثل: تسوية مخزون" :
                      activeCategory === "issues" ? "مثل: أمر صرف مخزني الإدارة" :
                      activeCategory === "receipts" ? "مثل: أمر توريد مخزني صنعاء" :
                      "مثل: طلب مخزني الحديدة"
                    }
                    className="bg-amber-50 dark:bg-slate-800 border-teal-400 font-semibold shadow-inner text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Field 3: الاسم الأجنبي (Foreign Name) */}
              <div className="grid grid-cols-12 items-center gap-3">
                <Label className="col-span-4 text-sm font-bold text-slate-900 dark:text-slate-200">
                  الاسم الأجنبي:
                </Label>
                <div className="col-span-8">
                  <Input
                    type="text"
                    value={foreignName}
                    onChange={(e) => setForeignName(e.target.value)}
                    placeholder={
                      activeCategory === "adjustments" ? "Stock Adjustment" :
                      activeCategory === "issues" ? "Outgoing" :
                      activeCategory === "receipts" ? "Incoming" :
                      "Store Requisition"
                    }
                    className="bg-white dark:bg-slate-800 border-teal-400 dir-ltr text-left text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Special Input for Stock Issue Types (Image 2: خاص بنظام المطاعم) */}
              {activeCategory === "issues" && (
                <div className="pt-2 border-t border-teal-300 dark:border-slate-700 flex items-center gap-3 bg-white/60 dark:bg-slate-800/60 p-3 rounded-lg">
                  <Checkbox
                    id="is_restaurant_chk"
                    checked={isRestaurant}
                    onCheckedChange={(c) => setIsRestaurant(Boolean(c))}
                    className="w-5 h-5 border-teal-600 data-[state=checked]:bg-teal-700"
                  />
                  <Label htmlFor="is_restaurant_chk" className="font-bold text-sm text-teal-950 dark:text-slate-200 cursor-pointer">
                    خاص بنظام المطاعم (صرف مطبخ وتجهيز وجبات)
                  </Label>
                </div>
              )}

              {/* Special Input for Stock Requisition Types (Image 4: Radio Buttons صرف / تحويل / كلي) */}
              {activeCategory === "requisitions" && (
                <div className="pt-3 border-t border-teal-300 dark:border-slate-700 space-y-2 bg-white/60 dark:bg-slate-800/60 p-3.5 rounded-lg">
                  <Label className="font-bold text-sm text-teal-950 dark:text-slate-200 block mb-1">
                    نوع التأثير والإتاحة للشاشات:
                  </Label>
                  <RadioGroup
                    value={requisitionEffect}
                    onValueChange={(val: any) => setRequisitionEffect(val)}
                    className="flex items-center justify-around gap-2 pt-1"
                  >
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-md border border-teal-300">
                      <RadioGroupItem value="issue" id="r_issue" />
                      <Label htmlFor="r_issue" className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">
                        صرف
                      </Label>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-md border border-teal-300">
                      <RadioGroupItem value="transfer" id="r_transfer" />
                      <Label htmlFor="r_transfer" className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">
                        تحويل
                      </Label>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-md border border-teal-300">
                      <RadioGroupItem value="all" id="r_all" />
                      <Label htmlFor="r_all" className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">
                        كلي (صرف وتحويل)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Control Action Buttons */}
              <div className="pt-4 border-t border-teal-300 dark:border-slate-700 flex items-center justify-end gap-2">
                <Button
                  onClick={handleResetForm}
                  variant="outline"
                  className="bg-white dark:bg-slate-800 border-teal-400 hover:bg-teal-50"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  جديد
                </Button>

                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-6 shadow-md"
                >
                  {saveMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <Save className="w-4 h-4 ml-2" />
                  )}
                  {editingId ? "تحديث (F10)" : "حفظ (F10)"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table Panel */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="shadow-md border-slate-200 dark:border-slate-800">
            <CardHeader className="p-4 flex flex-row items-center justify-between border-b bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-base font-bold">
                  سجل وقائمة الأنواع المعرفة في النظام
                </CardTitle>
              </div>

              {/* Search Bar */}
              <div className="relative w-48 md:w-64">
                <Search className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="بحث في الأنواع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 text-xs h-9 bg-white dark:bg-slate-800"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-right border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b text-xs">
                  <tr>
                    <th className="p-3 w-16 text-center">الرقم</th>
                    <th className="p-3">اسم النوع / الشاشة</th>
                    <th className="p-3">الاسم الأجنبي</th>
                    {activeCategory === "issues" && <th className="p-3 text-center">نظام المطاعم</th>}
                    {activeCategory === "requisitions" && <th className="p-3 text-center">نوع التأثير</th>}
                    <th className="p-3 w-28 text-center">العمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Table Rows for Adjustments */}
                  {activeCategory === "adjustments" && adjustmentsData
                    .filter(a => a.name.includes(searchQuery) || a.foreign_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{item.type_number}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 text-slate-500 text-xs dir-ltr text-right">{item.foreign_name || "-"}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditRow(item)}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Table Rows for Issues */}
                  {activeCategory === "issues" && issuesData
                    .filter(i => i.name.includes(searchQuery) || i.foreign_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{item.type_number}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 text-slate-500 text-xs dir-ltr text-right">{item.foreign_name || "-"}</td>
                        <td className="p-3 text-center">
                          {item.is_restaurant ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                              <Utensils className="w-3 h-3 ml-1" /> نعم
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">لا</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditRow(item)}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Table Rows for Receipts */}
                  {activeCategory === "receipts" && receiptsData
                    .filter(r => r.name.includes(searchQuery) || r.foreign_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center font-bold text-purple-600 dark:text-purple-400">{item.type_number}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 text-slate-500 text-xs dir-ltr text-right">{item.foreign_name || "-"}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditRow(item)}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Table Rows for Requisitions */}
                  {activeCategory === "requisitions" && requisitionsData
                    .filter(req => req.name.includes(searchQuery) || req.foreign_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">{item.type_number}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{item.name}</td>
                        <td className="p-3 text-slate-500 text-xs dir-ltr text-right">{item.foreign_name || "-"}</td>
                        <td className="p-3 text-center">
                          {item.requisition_effect_type === "issue" && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300">صرف فقط</Badge>
                          )}
                          {item.requisition_effect_type === "transfer" && (
                            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300">تحويل فقط</Badge>
                          )}
                          {item.requisition_effect_type === "all" && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">كلي (صرف وتحويل)</Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditRow(item)}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {/* Empty state */}
                  {((activeCategory === "adjustments" && adjustmentsData.length === 0) ||
                    (activeCategory === "issues" && issuesData.length === 0) ||
                    (activeCategory === "receipts" && receiptsData.length === 0) ||
                    (activeCategory === "requisitions" && requisitionsData.length === 0)) && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        لا توجد سجلات معرفة حالياً في هذه الشاشة. يمكنك البدء بإضافة نوع جديد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
