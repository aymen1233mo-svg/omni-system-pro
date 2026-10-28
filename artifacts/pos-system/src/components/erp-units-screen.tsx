import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Scale, Plus, Save, RotateCcw, Trash2, Edit3, Printer, Search,
  HelpCircle, BookOpen, Layers, CheckCircle2, AlertTriangle, ArrowRightLeft,
  Sliders, Info, Sparkles, Filter, X
} from "lucide-react";

export interface UnitConversion {
  id?: number;
  unit_id?: number;
  from_unit: string;
  to_unit: string;
  factor: number;
  operation: "multiply" | "divide";
}

export interface UnitOfMeasurement {
  id?: number;
  code: string;
  name: string;
  default_package: number;
  is_package_locked: number;
  unit_type: "numerical" | "measured"; // 1- عددية, 2- مقاسة
  category: "weight" | "volume" | "area" | "lengths" | "liquids" | "distances"; // 1- وزن, 2- حجم, 3- مساحة, 4- أطوال, 5- سوائل, 6- مسافات
  conversion_factor: number;
  base_unit: string;
  notes: string;
  conversions?: UnitConversion[];
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_CONVERSIONS_BY_CATEGORY: Record<string, UnitConversion[]> = {
  weight: [
    { from_unit: "كجم", to_unit: "جم", factor: 0.001, operation: "multiply" },
    { from_unit: "كجم", to_unit: "طن", factor: 1000.0, operation: "divide" }
  ],
  volume: [
    { from_unit: "m³", to_unit: "cm³", factor: 0.01, operation: "multiply" },
    { from_unit: "m³", to_unit: "mlm³", factor: 0.001, operation: "multiply" }
  ],
  area: [
    { from_unit: "m²", to_unit: "cm²", factor: 0.01, operation: "multiply" },
    { from_unit: "m²", to_unit: "yd²", factor: 0.83612736, operation: "multiply" },
    { from_unit: "m²", to_unit: "mi²", factor: 2589988.110336, operation: "multiply" },
    { from_unit: "m²", to_unit: "mlm²", factor: 0.001, operation: "multiply" }
  ],
  lengths: [
    { from_unit: "m", to_unit: "cm", factor: 0.01, operation: "multiply" },
    { from_unit: "m", to_unit: "mlm", factor: 0.001, operation: "multiply" },
    { from_unit: "m", to_unit: "yd", factor: 0.83612736, operation: "multiply" },
    { from_unit: "m", to_unit: "mi", factor: 2589988.110336, operation: "multiply" }
  ],
  liquids: [
    { from_unit: "لتر", to_unit: "مل", factor: 0.001, operation: "multiply" },
    { from_unit: "لتر", to_unit: "جالون", factor: 3.78541, operation: "divide" }
  ],
  distances: [
    { from_unit: "كم", to_unit: "متر", factor: 1000.0, operation: "multiply" },
    { from_unit: "كم", to_unit: "ميل", factor: 1.60934, operation: "divide" }
  ]
};

const emptyUnitForm = (): UnitOfMeasurement => ({
  code: "",
  name: "",
  default_package: 1.0,
  is_package_locked: 0,
  unit_type: "numerical",
  category: "weight",
  conversion_factor: 1.0,
  base_unit: "حبة",
  notes: "",
  conversions: []
});

export function ErpUnitsScreen() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasurement | null>(null);
  const [form, setForm] = useState<UnitOfMeasurement>(emptyUnitForm());
  const [customConversions, setCustomConversions] = useState<UnitConversion[]>([]);

  // Fetch Units
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["units-of-measurement"],
    queryFn: async () => {
      const res = await fetch("/api/units-of-measurement");
      if (!res.ok) throw new Error("فشل تحميل وحدات القياس");
      return res.json();
    }
  });

  const units: UnitOfMeasurement[] = data?.data || [];

  // Filtered Units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchesSearch = 
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || u.unit_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [units, search, filterType]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: UnitOfMeasurement) => {
      const res = await fetch("/api/units-of-measurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل إضافة وحدة القياس");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة وحدة القياس بنجاح", className: "bg-emerald-600 text-white font-bold" });
      setShowModal(false);
      setForm(emptyUnitForm());
      queryClient.invalidateQueries({ queryKey: ["units-of-measurement"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: UnitOfMeasurement }) => {
      const res = await fetch(`/api/units-of-measurement/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل تحديث وحدة القياس");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث وحدة القياس بنجاح", className: "bg-emerald-600 text-white font-bold" });
      setShowModal(false);
      setEditingUnit(null);
      setForm(emptyUnitForm());
      queryClient.invalidateQueries({ queryKey: ["units-of-measurement"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/units-of-measurement/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حذف وحدة القياس");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حذف وحدة القياس بنجاح", className: "bg-emerald-600 text-white font-bold" });
      queryClient.invalidateQueries({ queryKey: ["units-of-measurement"] });
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحذف", description: err.message, variant: "destructive" });
    }
  });

  const handleOpenAdd = () => {
    setEditingUnit(null);
    const newForm = emptyUnitForm();
    setForm(newForm);
    setCustomConversions(DEFAULT_CONVERSIONS_BY_CATEGORY.weight);
    setShowModal(true);
  };

  const handleOpenEdit = (unit: UnitOfMeasurement) => {
    setEditingUnit(unit);
    setForm({
      ...unit,
      conversions: unit.conversions || []
    });
    setCustomConversions(unit.conversions && unit.conversions.length > 0 ? unit.conversions : (DEFAULT_CONVERSIONS_BY_CATEGORY[unit.category] || []));
    setShowModal(true);
  };

  const handleCategoryChange = (cat: any) => {
    setForm(prev => ({ ...prev, category: cat }));
    if (DEFAULT_CONVERSIONS_BY_CATEGORY[cat]) {
      setCustomConversions(DEFAULT_CONVERSIONS_BY_CATEGORY[cat]);
    }
  };

  const handleConversionRowChange = (index: number, field: keyof UnitConversion, val: any) => {
    const next = [...customConversions];
    next[index] = { ...next[index], [field]: val };
    setCustomConversions(next);
  };

  const handleAddConversionRow = () => {
    setCustomConversions(prev => [
      ...prev,
      { from_unit: form.code || "الوحدة", to_unit: "", factor: 1.0, operation: "multiply" }
    ]);
  };

  const handleRemoveConversionRow = (idx: number) => {
    setCustomConversions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "تنبيه", description: "يرجى ملء رمز واسم الوحدة بشكل صحيح", variant: "destructive" });
      return;
    }

    const payload: UnitOfMeasurement = {
      ...form,
      conversions: form.unit_type === "measured" ? customConversions : []
    };

    if (editingUnit?.id) {
      updateMutation.mutate({ id: editingUnit.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-md border border-indigo-800/40 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">تهيئة وتعريف وحدات القياس (شاشة رقم 51)</h1>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-xs px-2.5 py-0.5">
                  معايير نظام أومني سيستم برو ERP
                </Badge>
              </div>
              <p className="text-xs text-indigo-200/70 mt-1">
                إدارة الوحدات العددية (كرتون، حبة، باكت) والوحدات المقاسة (وزن، حجم، مساحة، أطوال، سوائل، مسافات) ومعاملات التحويل
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              إضافة وحدة قياس (F2)
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              شرح ودليل الشاشة
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPrintModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" />
              طباعة الوحدات
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برمز أو اسم الوحدة..."
            className="pr-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Button
            size="sm"
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className="text-xs h-8 font-bold"
          >
            كافة الوحدات ({units.length})
          </Button>
          <Button
            size="sm"
            variant={filterType === "numerical" ? "default" : "outline"}
            onClick={() => setFilterType("numerical")}
            className="text-xs h-8 font-bold"
          >
            وحدات عددية (1- عددية)
          </Button>
          <Button
            size="sm"
            variant={filterType === "measured" ? "default" : "outline"}
            onClick={() => setFilterType("measured")}
            className="text-xs h-8 font-bold"
          >
            وحدات مقاسة (2- مقاسة وأوزان)
          </Button>
        </div>
      </div>

      {/* Units Table Grid */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">رمز الوحدة</th>
                  <th className="p-3">اسم الوحدة</th>
                  <th className="p-3 text-center">نوع الوحدة</th>
                  <th className="p-3 text-center">التصنيف</th>
                  <th className="p-3 text-center">العبوة الافتراضية</th>
                  <th className="p-3 text-center">معاملات التحويل</th>
                  <th className="p-3">ملاحظات وبيان</th>
                  <th className="p-3 text-center w-24">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">جاري تحميل وحدات القياس...</td>
                  </tr>
                ) : filteredUnits.length > 0 ? (
                  filteredUnits.map((u, idx) => (
                    <tr key={u.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold font-mono text-indigo-700 dark:text-indigo-300">
                        <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950 font-bold">{u.code}</Badge>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{u.name}</td>
                      <td className="p-3 text-center">
                        {u.unit_type === "numerical" ? (
                          <Badge className="bg-blue-100 text-blue-800 border-0 text-[11px]">1- عددية</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-0 text-[11px]">2- مقاسة</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          {u.category === "weight" ? "1- وزن" :
                           u.category === "volume" ? "2- حجم" :
                           u.category === "area" ? "3- مساحة" :
                           u.category === "lengths" ? "4- أطوال" :
                           u.category === "liquids" ? "5- سوائل" : "6- مسافات"}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        {u.default_package} {u.is_package_locked ? <span className="text-[10px] text-slate-400 font-normal">(ثابتة)</span> : ""}
                      </td>
                      <td className="p-3 text-center">
                        {u.conversions && u.conversions.length > 0 ? (
                          <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                            {u.conversions.length} معاملات تحويل
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">{u.notes || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(u)}
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من رغبتك في حذف وحدة القياس (${u.name})؟`)) {
                                if (u.id) deleteMutation.mutate(u.id);
                              }
                            }}
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400 text-xs">
                      لا توجد وحدات قياس مسجلة مطابقة لمعايير البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Modal: Create / Edit Unit of Measurement (Matching Image 1) ─── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Scale className="w-5 h-5 text-indigo-600" />
              {editingUnit ? `تعديل وحدة القياس: ${editingUnit.name}` : "إضافة وتعريف وحدة قياس جديدة"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border">
              
              {/* Unit Code */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  رمز الوحدة (Unit Symbol / Code): <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="مثال: الكرتون، كجم، m³، حبة"
                  className="text-xs h-9 font-bold"
                  required
                />
              </div>

              {/* Unit Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  اسم الوحدة (Unit Name): <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: الكرتون، كيلو جرام، متر مكعب"
                  className="text-xs h-9 font-bold"
                  required
                />
              </div>

              {/* Default Package */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  العبوة الافتراضية (Default Package / Factor):
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={form.default_package}
                    onChange={(e) => setForm(prev => ({ ...prev, default_package: parseFloat(e.target.value) || 1 }))}
                    className="text-xs h-9 font-mono font-bold"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={form.is_package_locked === 1}
                      onChange={(e) => setForm(prev => ({ ...prev, is_package_locked: e.target.checked ? 1 : 0 }))}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    غير قابل للتعديل
                  </label>
                </div>
              </div>

              {/* Unit Type */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  نوع الوحدة (Unit Type):
                </label>
                <select
                  value={form.unit_type}
                  onChange={(e) => setForm(prev => ({ ...prev, unit_type: e.target.value as any }))}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 font-bold shadow-xs dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="numerical">1- عددية (أصناف عادية كرتون، حبة، باكت، درزن)</option>
                  <option value="measured">2- مقاسة (تتعامل مع نظام الأوزان والأبعاد)</option>
                </select>
              </div>

              {/* Unit Category (Active when unit_type is measured) */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  تصنيف الوحدة المقاسة (Measurement Category):
                </label>
                <select
                  disabled={form.unit_type !== "measured"}
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-3 font-bold shadow-xs disabled:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="weight">1- وزن (طن، كجم، جرام، بندل، سيخ)</option>
                  <option value="volume">2- حجم (متر مكعب m³، خرسانة، إسفنج)</option>
                  <option value="area">3- مساحة (متر مربع m²، بلاط، سيراميك، رخام)</option>
                  <option value="lengths">4- أطوال (متر طولي m، كيابل، أنابيب، أقمشة)</option>
                  <option value="liquids">5- سوائل (لتر، جالون، برميل)</option>
                  <option value="distances">6- مسافات (كيلومتر، ميل)</option>
                </select>
              </div>
            </div>

            {/* ─── Conversions Matrix Grid (Matching Image 1) ─── */}
            {form.unit_type === "measured" && (
              <div className="space-y-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                    جدول معاملات تحويل الوحدات المقاسة (Conversion Table Matrix)
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddConversionRow}
                    className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    إضافة معامل
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border bg-white dark:bg-slate-800">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-b">
                        <th className="p-2 w-12 text-center">الرقم</th>
                        <th className="p-2">الوحدة الأساسية</th>
                        <th className="p-2">الوحدة المقابلة (المقابل)</th>
                        <th className="p-2 text-center">معامل التحويل</th>
                        <th className="p-2 text-center">العملية</th>
                        <th className="p-2 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {customConversions.map((conv, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-1.5">
                            <Input
                              value={conv.from_unit}
                              onChange={(e) => handleConversionRowChange(idx, "from_unit", e.target.value)}
                              className="h-7 text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              value={conv.to_unit}
                              onChange={(e) => handleConversionRowChange(idx, "to_unit", e.target.value)}
                              placeholder="مثال: cm, yd, mlm"
                              className="h-7 text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <Input
                              type="number"
                              step="0.000001"
                              value={conv.factor}
                              onChange={(e) => handleConversionRowChange(idx, "factor", parseFloat(e.target.value) || 1)}
                              className="h-7 text-xs text-center font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <select
                              value={conv.operation}
                              onChange={(e) => handleConversionRowChange(idx, "operation", e.target.value as any)}
                              className="h-7 text-xs rounded border bg-white px-2 dark:bg-slate-700"
                            >
                              <option value="multiply">ضرب (×)</option>
                              <option value="divide">قسمة (÷)</option>
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveConversionRow(idx)}
                              className="h-6 w-6 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                ملاحظات واستخدامات الوحدة:
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="بيان استخدامات الوحدة في المستودعات والمبيعات..."
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
              >
                <Save className="w-4 h-4" />
                {editingUnit ? "حفظ التعديلات" : "إضافة وحفظ الوحدة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Help / Screen Documentation (Matching Image 1) ─── */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-600">
              <BookOpen className="w-5 h-5" />
              خطوات استخدام شاشة وحدات القياس (دليل نظام أومني سيستم برو)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto p-2">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-200 mb-1">خطوات استخدام الشاشة بعد النقر على زر إضافة:</h4>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <li><strong>رمز الوحدة:</strong> ويستخدم هذا الحقل في إدخال رمز الوحدة مثل (كرتون) أو الكيلوجرام... إلخ.</li>
                <li><strong>اسم الوحدة:</strong> ويتم في هذا الحقل إدراج اسم الوحدة التي تم إدراج اسمها في رمز الوحدة، ومثال ذلك (كرتون... إلخ).</li>
                <li>
                  <strong>نوع الوحدة:</strong> في هذا المتغير يوجد لدينا نوعان:
                  <div className="mt-1 pr-4 space-y-1">
                    <p>• <strong>نوع الوحدة (عددية):</strong> من خلاله يتم تعريف الأصناف العادية مثل كرتون، كيلو، جرام، حبة، درزن.</p>
                    <p>• <strong>نوع الوحدة (مقاسة):</strong> نقوم بتحديد التصنيف للوحدة وهي بحسب الخيارات الموجودة إما <strong>وزن، حجم، مساحة، أطوال، سوائل، مسافات</strong>، نقوم بعدها بتحديد الوحدات العددية المرتبطة بالوحدة المقاسة ولتكن مثلاً حبة ونحدد أنها وحدة افتراضية. وسوف يتم استخدام الوحدات المقاسة عند استخدام نظام الأوزان في بيانات الأصناف.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHelpModal(false)}>فهمت ذلك</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Print View ─── */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-600" />
              تقرير وحدات القياس والتحويلات المعتمدة
            </DialogTitle>
          </DialogHeader>

          <div ref={printRef} className="p-6 bg-white text-slate-900 rounded-lg border space-y-4">
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black">مؤسسة الحلول الشاملة للأنظمة المتكاملة</h2>
                <h3 className="text-xs font-bold text-slate-600">دليل وحدات القياس ومعاملات التحويل للمخازن</h3>
              </div>
              <span className="border border-slate-900 px-3 py-1 text-xs font-bold rounded">نسخة رسمية</span>
            </div>

            <table className="w-full text-xs text-right border-collapse border">
              <thead>
                <tr className="bg-slate-100 border-b font-bold">
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">رمز الوحدة</th>
                  <th className="p-2 border">اسم الوحدة</th>
                  <th className="p-2 border">النوع</th>
                  <th className="p-2 border">التصنيف</th>
                  <th className="p-2 border">العبوة الافتراضية</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u, i) => (
                  <tr key={u.id || i} className="border-b">
                    <td className="p-2 border text-center">{i + 1}</td>
                    <td className="p-2 border font-bold font-mono">{u.code}</td>
                    <td className="p-2 border font-bold">{u.name}</td>
                    <td className="p-2 border">{u.unit_type === "numerical" ? "عددية" : "مقاسة"}</td>
                    <td className="p-2 border">{u.category}</td>
                    <td className="p-2 border text-center font-mono">{u.default_package}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>إغلاق</Button>
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5">
              <Printer className="w-4 h-4" />
              طباعة فورية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
