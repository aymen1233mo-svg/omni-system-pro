import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, Plus, Save, RotateCcw, Trash2, Edit3, Printer, Search,
  HelpCircle, BookOpen, Layers, CheckCircle2, AlertTriangle, ShieldCheck,
  FolderTree, Tags, Info, Eye, Check
} from "lucide-react";

export interface ItemTypeRecord {
  id?: number;
  type_number: number;
  code: string;
  name: string;
  foreign_name: string;
  main_group_id: number;
  main_group_name: string;
  sub_group_id: number;
  sub_group_name: string;
  sub_sub_group_id: number;
  sub_sub_group_name: string;
  auxiliary_group_id: number;
  auxiliary_group_name: string;
  active: number;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

const emptyItemTypeForm = (): ItemTypeRecord => ({
  type_number: 1,
  code: "01",
  name: "",
  foreign_name: "",
  main_group_id: 1,
  main_group_name: "001 مجموعة المواد الغذائية والسلع",
  sub_group_id: 1,
  sub_group_name: "المجموعة الفرعية 1",
  sub_sub_group_id: 1,
  sub_sub_group_name: "تحت الفرعية 1",
  auxiliary_group_id: 1,
  auxiliary_group_name: "المساعدة 1",
  active: 1
});

export function ErpItemTypesScreen() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingType, setEditingType] = useState<ItemTypeRecord | null>(null);
  const [form, setForm] = useState<ItemTypeRecord>(emptyItemTypeForm());

  // Fetch Item Types
  const { data, isLoading } = useQuery({
    queryKey: ["item-types"],
    queryFn: async () => {
      const res = await fetch("/api/item-types");
      if (!res.ok) throw new Error("فشل تحميل أنواع الأصناف");
      return res.json();
    }
  });

  const itemTypes: ItemTypeRecord[] = data?.data || [];

  // Filtered Item Types
  const filteredTypes = useMemo(() => {
    return itemTypes.filter((t) => {
      return (
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase()) ||
        t.foreign_name.toLowerCase().includes(search.toLowerCase()) ||
        String(t.type_number).includes(search)
      );
    });
  }, [itemTypes, search]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: ItemTypeRecord) => {
      const res = await fetch("/api/item-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ نوع الصنف");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة نوع الصنف بنجاح", className: "bg-emerald-600 text-white font-bold" });
      setShowModal(false);
      setForm(emptyItemTypeForm());
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ItemTypeRecord }) => {
      const res = await fetch(`/api/item-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل تحديث نوع الصنف");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم تحديث نوع الصنف بنجاح", className: "bg-emerald-600 text-white font-bold" });
      setShowModal(false);
      setEditingType(null);
      setForm(emptyItemTypeForm());
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  // Delete Mutation (Enforces constraint from Image 2)
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/item-types/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حذف نوع الصنف");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حذف نوع الصنف بنجاح", className: "bg-emerald-600 text-white font-bold" });
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
    },
    onError: (err: any) => {
      toast({ title: "تعذر الحذف", description: err.message, variant: "destructive" });
    }
  });

  const handleOpenAdd = () => {
    setEditingType(null);
    const nextNum = itemTypes.length > 0 ? Math.max(...itemTypes.map(t => t.type_number)) + 1 : 1;
    setForm({
      ...emptyItemTypeForm(),
      type_number: nextNum,
      code: nextNum < 10 ? `0${nextNum}` : String(nextNum)
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t: ItemTypeRecord) => {
    setEditingType(t);
    setForm(t);
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.type_number || !form.name.trim()) {
      toast({ title: "تنبيه", description: "يرجى ملء رقم واسم نوع الصنف بشكل صحيح", variant: "destructive" });
      return;
    }

    if (editingType?.id) {
      updateMutation.mutate({ id: editingType.id, payload: form });
    } else {
      createMutation.mutate(form);
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
              <Tags className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">أنواع الأصناف وتصنيفاتها (نظام أومني سيستم برو)</h1>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-xs px-2.5 py-0.5">
                  تهيئة شجرة المخزون
                </Badge>
              </div>
              <p className="text-xs text-indigo-200/70 mt-1">
                إدراج أنواع الأصناف (سلعي، خدمي، تصنيعي، أمانات، مستهلكات) وربطها بالمجموعات الرئيسية والفرعية
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              إضافة نوع صنف (F2)
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              دليل وشرح الشاشة
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPrintModal(true)}
              className="bg-white/5 hover:bg-white/15 text-slate-200 border-white/20 text-xs h-8 px-3 gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-300" />
              طباعة الأنواع
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم، كود، أو اسم نوع الصنف..."
            className="pr-9 text-xs h-9"
          />
        </div>
        <div className="text-xs text-slate-500 font-bold">
          إجمالي أنواع الأصناف المعرفة: <span className="text-indigo-600 font-mono text-sm">{itemTypes.length}</span> نوع
        </div>
      </div>

      {/* Types Table Grid */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b">
                  <th className="p-3 w-16 text-center">رقم النوع</th>
                  <th className="p-3 w-20">كود النوع</th>
                  <th className="p-3">اسم نوع الصنف (عربي)</th>
                  <th className="p-3">الاسم الأجنبي (English)</th>
                  <th className="p-3">المجموعة الرئيسية المربوطة</th>
                  <th className="p-3">المجموعة الفرعية وتحت الفرعية</th>
                  <th className="p-3 text-center">الأصناف المرتبطة</th>
                  <th className="p-3 text-center w-20">الحالة</th>
                  <th className="p-3 text-center w-24">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">جاري تحميل أنواع الأصناف...</td>
                  </tr>
                ) : filteredTypes.length > 0 ? (
                  filteredTypes.map((t) => (
                    <tr key={t.id || t.type_number} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 text-center font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {t.type_number}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">{t.code}</Badge>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {t.name}
                      </td>
                      <td className="p-3 font-medium text-slate-500 font-sans">
                        {t.foreign_name || "—"}
                      </td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <FolderTree className="w-3.5 h-3.5 text-amber-600" />
                          {t.main_group_name || `المجموعة ${t.main_group_id}`}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {t.sub_group_name || "الفرعية 1"} / {t.sub_sub_group_name || "تحت الفرعية"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {t.usage_count || 0} صنف
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {t.active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">نشط</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 text-[10px]">معطل</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(t)}
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من رغبتك في حذف نوع الصنف (${t.name})؟`)) {
                                if (t.id) deleteMutation.mutate(t.id);
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
                      لا توجد أنواع أصناف مسجلة مطابقة لمعايير البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Modal: Create / Edit Item Type (Matching Image 2) ─── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Tags className="w-5 h-5 text-indigo-600" />
              {editingType ? `تعديل نوع الصنف: ${editingType.name}` : "إضافة وتعريف نوع صنف جديد"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border space-y-3">
              
              {/* Top Row: Type Number and Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    رقم نوع الصنف (Type ID): <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={form.type_number}
                    onChange={(e) => setForm(prev => ({ ...prev, type_number: parseInt(e.target.value) || 1 }))}
                    className="text-xs h-9 font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    كود رقم الصنف (Type Prefix/Code):
                  </label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="مثال: 01, SL, SV, MFG"
                    className="text-xs h-9 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Middle Row: Arabic and Foreign Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    اسم نوع الصنف (الاسم العربي): <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: سلعي، خدمي، تصنيعي، أمانات، خامات"
                    className="text-xs h-9 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    الاسم الأجنبي (Foreign / English Name):
                  </label>
                  <Input
                    value={form.foreign_name}
                    onChange={(e) => setForm(prev => ({ ...prev, foreign_name: e.target.value }))}
                    placeholder="e.g. Commercial Goods, Services, Raw Materials"
                    className="text-xs h-9 font-sans"
                  />
                </div>
              </div>

              {/* Bottom Row: Category Mapping Matrix (Matching Image 2) */}
              <div className="pt-3 border-t space-y-3">
                <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">
                  ربط المجموعات والتصنيفات الهرمية للصنف
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      رقم المجموعة (الرئيسية):
                    </label>
                    <select
                      value={form.main_group_name}
                      onChange={(e) => setForm(prev => ({ ...prev, main_group_name: e.target.value }))}
                      className="w-full text-xs h-8 rounded border bg-white px-2 dark:bg-slate-800"
                    >
                      <option value="001 مجموعة المواد الغذائية والسلع">001 مجموعة السكر والسلع</option>
                      <option value="002 مجموعة الخدمات والرسوم">002 مجموعة الخدمات</option>
                      <option value="003 مجموعة التصنيع والتجميع">003 مجموعة التصنيع</option>
                      <option value="004 مجموعة الخامات الأولية">004 مجموعة الخامات</option>
                      <option value="005 مجموعة بضائع الأمانات">005 مجموعة الأمانات</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      رقم م. الفرعية:
                    </label>
                    <Input
                      value={form.sub_group_name}
                      onChange={(e) => setForm(prev => ({ ...prev, sub_group_name: e.target.value }))}
                      placeholder="المجموعة الفرعية 1"
                      className="text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      رقم م. تحت الفرعية:
                    </label>
                    <Input
                      value={form.sub_sub_group_name}
                      onChange={(e) => setForm(prev => ({ ...prev, sub_sub_group_name: e.target.value }))}
                      placeholder="تحت الفرعية 1"
                      className="text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      م. المساعدة:
                    </label>
                    <Input
                      value={form.auxiliary_group_name}
                      onChange={(e) => setForm(prev => ({ ...prev, auxiliary_group_name: e.target.value }))}
                      placeholder="المساعدة 1"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>

            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
              >
                <Save className="w-4 h-4" />
                {editingType ? "حفظ التعديلات" : "إضافة وحفظ نوع الصنف"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Help / Documentation (Matching Image 2) ─── */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-600">
              <BookOpen className="w-5 h-5" />
              دليل شاشة أنواع الأصناف (نظام أومني سيستم برو)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto p-2">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
              <h4 className="font-bold text-indigo-950 dark:text-indigo-200 mb-1">تهدف الشاشة إلى:</h4>
              <p>
                من خلالها يتم إدراج أنواع الأصناف التي تتعامل بها المنشأة، ويمكن إدراج أي مسميات لأنواع الأصناف مثل نوع (سلعي) ونوع (خدمي) وتصنيعي وخامات ومستهلكات، وقد نضيف أكثر من نوع حسب استخدامها أو الغرض منها.
              </p>
            </div>

            <div className="space-y-1.5">
              <h5 className="font-bold text-slate-900 dark:text-slate-100">خطوات استخدام الشاشة:</h5>
              <ul className="list-disc list-inside space-y-1 pr-2">
                <li><strong>رقم النوع:</strong> ويستخدم هذا الحقل في إدخال رقم النوع (1، 2، 3...).</li>
                <li><strong>اسم النوع:</strong> ويتم في هذا الحقل إدراج اسم النوع مثل سلعي، خدمي، محلية، خارجية... إلخ، كما يمكن ربطه بالمجموعة الرئيسية والفرعية وتحت الفرعية للمخزون.</li>
                <li>تستخدم بشكل أساسي في <strong>بيانات الأصناف</strong> ولكنها تظهر في شاشات وتقارير المخزون والأرباح.</li>
                <li className="text-rose-600 font-bold">
                  قاعدة الأمان: لا يسمح بحذف وحدات الأنواع إذا كانت مستخدمة في شاشة بيانات الصنف لمنع كسر التكامل المرجعي.
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
              تقرير أنواع الأصناف وتصنيفاتها
            </DialogTitle>
          </DialogHeader>

          <div ref={printRef} className="p-6 bg-white text-slate-900 rounded-lg border space-y-4">
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black">مؤسسة الحلول الشاملة للأنظمة المتكاملة</h2>
                <h3 className="text-xs font-bold text-slate-600">دليل أنواع الأصناف والتصنيفات المخزنية</h3>
              </div>
              <span className="border border-slate-900 px-3 py-1 text-xs font-bold rounded">نسخة معتمدة</span>
            </div>

            <table className="w-full text-xs text-right border-collapse border">
              <thead>
                <tr className="bg-slate-100 border-b font-bold">
                  <th className="p-2 border text-center">رقم النوع</th>
                  <th className="p-2 border">كود النوع</th>
                  <th className="p-2 border">اسم نوع الصنف</th>
                  <th className="p-2 border">الاسم الأجنبي</th>
                  <th className="p-2 border">المجموعة الرئيسية</th>
                  <th className="p-2 border text-center">عدد الأصناف</th>
                </tr>
              </thead>
              <tbody>
                {itemTypes.map((t) => (
                  <tr key={t.id || t.type_number} className="border-b">
                    <td className="p-2 border text-center font-mono font-bold">{t.type_number}</td>
                    <td className="p-2 border font-mono">{t.code}</td>
                    <td className="p-2 border font-bold">{t.name}</td>
                    <td className="p-2 border">{t.foreign_name || "—"}</td>
                    <td className="p-2 border">{t.main_group_name}</td>
                    <td className="p-2 border text-center font-mono">{t.usage_count || 0}</td>
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
