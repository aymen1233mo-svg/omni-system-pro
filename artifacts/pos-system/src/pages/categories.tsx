import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useGetProducts } from "@workspace/api-client-react";
import type { Category, CategoryInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tags, Package, ArrowRight, ShoppingBag, Warehouse, Info, Layers } from "lucide-react";

export default function Categories() {
  const { data: categories = [], isLoading } = useGetCategories();
  const { data: products = [] } = useGetProducts();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryInput>({ name: "", color: "#f59e0b" });

  const openAdd = () => { setEditing(null); setForm({ name: "", color: "#f59e0b" }); setShowDialog(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setForm({ name: cat.name, color: cat.color ?? "#f59e0b" }); setShowDialog(true); };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة اسم التصنيف أو القسم" });
      return;
    }
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.refetchQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.refetchQueries({ queryKey: ["products"] });
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { ...form, name: form.name.trim() } }, {
        onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "تم تحديث التصنيف / القسم بنجاح" }); },
        onError: () => toast({ variant: "destructive", title: "فشل في التحديث" })
      });
    } else {
      createMutation.mutate({ data: { ...form, name: form.name.trim() } }, {
        onSuccess: () => { invalidate(); setShowDialog(false); toast({ title: "تمت إضافة التصنيف / القسم بنجاح" }); },
        onError: () => toast({ variant: "destructive", title: "فشل في الإضافة" })
      });
    }
  };

  const handleDelete = (cat: Category) => {
    const linkedCount = products.filter(p => p.categoryId === cat.id).length;
    const confirmMsg = linkedCount > 0 
      ? `تحذير: هذا القسم مرتبط به (${linkedCount}) صنف! هل أنت متأكد من حذف تصنيف "${cat.name}"؟`
      : `هل أنت متأكد من حذف تصنيف / قسم "${cat.name}"؟`;
    
    if (!confirm(confirmMsg)) return;
    deleteMutation.mutate({ id: cat.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["categories"] });
        qc.refetchQueries({ queryKey: ["categories"] });
        qc.invalidateQueries({ queryKey: ["products"] });
        toast({ title: "تم حذف التصنيف / القسم بنجاح" });
      },
      onError: () => toast({ variant: "destructive", title: "فشل في الحذف" })
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-lg"><Tags className="w-5 h-5" /></span>
              <h1 className="text-2xl font-black text-slate-800">إضافة تصنيفات أو أقسام</h1>
            </div>
            <p className="text-xs text-slate-500">
              تهيئة وتصنيف أقسام المبيعات والمنتجات، وربطها بنقاط البيع POS، فواتير الأقسام، والمطابخ، وتوجيه الطباعة المستقلة.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/products"} 
              className="border-slate-300 text-slate-700 hover:text-blue-700 font-bold gap-1.5 text-xs h-9"
            >
              <Package className="w-4 h-4 text-blue-600" />
              بطاقة وقائمة المنتجات
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/pos"} 
              className="border-slate-300 text-slate-700 hover:text-emerald-700 font-bold gap-1.5 text-xs h-9"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
              شاشة الكاشير POS
            </Button>
            <Button 
              onClick={openAdd} 
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black gap-2 h-9 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              إضافة تصنيف أو قسم جديد
            </Button>
          </div>
        </div>

        {/* Guidance and Workflow Info Card */}
        <div className="bg-gradient-to-l from-blue-50 to-amber-50/50 p-4 rounded-xl border border-blue-200/80 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5"><Info className="w-4 h-4" /></span>
            <div className="text-xs space-y-2 text-slate-700">
              <div className="font-bold text-slate-900 text-sm">💡 دليل إضافة الأصناف وربطها بالتصنيفات والأقسام:</div>
              <p className="leading-relaxed">
                في هذا النظام يمكنك إضافة وتعديل المنتجات من <strong>عدة أماكن متكاملة</strong> تصب جميعها في قاعدة بيانات موحدة:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-blue-700 flex items-center gap-1.5 mb-1">
                    <Package className="w-3.5 h-3.5" /> 1. بطاقة الأصناف والمنتجات (شاشة 50)
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    المكان الشامل لتعريف الصنف بدقة (الاسم، الباركود، السعر، التكلفة، ربطه بالقسم، وصفات BOM المركبة، وتفعيل ظهوره في POS).
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                    <Warehouse className="w-3.5 h-3.5" /> 2. إدارة المخازن والمستودعات
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    من تبويب <strong>أرصدة المخزون</strong> يمكنك النقر على <strong>إضافة صنف جديد للمخزن</strong> لإدخال الرصيد الافتتاحي وكميات التخزين مباشرة.
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="font-bold text-amber-700 flex items-center gap-1.5 mb-1">
                    <ShoppingBag className="w-3.5 h-3.5" /> 3. نقطة البيع السريعة POS
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    تظهر فيها هذه الأقسام والمنتجات فوراً، كما يتوفر زر <strong>إضافة صنف سريع</strong> في شاشة الكاشير لسرعة البيع دون مقاطعة العمل.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              الأقسام والتصنيفات المسجلة في النظام ({categories.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground bg-white rounded-xl border">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {categories.map(cat => {
                const linkedProducts = products.filter(p => p.categoryId === cat.id);
                const catColor = cat.color ?? "#f59e0b";
                return (
                  <div 
                    key={cat.id} 
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 left-0 h-1.5" style={{ backgroundColor: catColor }} />
                    
                    <div className="flex items-center gap-3 pt-1">
                      <div 
                        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold shadow-xs border border-black/10" 
                        style={{ backgroundColor: catColor }}
                      >
                        <Tags className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-extrabold text-slate-900 block truncate text-sm">{cat.name}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {linkedProducts.length} صنف / منتج مرتبط
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <button 
                        onClick={() => window.location.href = `/products?categoryId=${cat.id}`}
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <span>أصناف القسم</span>
                        <ArrowRight className="w-3 h-3 rotate-180" />
                      </button>
                      
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => openEdit(cat)} 
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="تعديل هذا القسم"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat)} 
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف هذا القسم"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-muted-foreground space-y-2">
                  <Tags className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold">لا توجد تصنيفات أو أقسام مسجلة حالياً</p>
                  <p className="text-xs">اضغط على زر "إضافة تصنيف أو قسم جديد" للبدء في تقسيم مبيعاتك ومنتجاتك</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog for Category Add / Edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5 text-amber-500" />
              {editing ? "تعديل التصنيف أو القسم" : "إضافة تصنيف أو قسم جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اسم التصنيف أو القسم *</label>
              <Input 
                placeholder="مثال: وجبات سريعة، مشروبات ساخنة، مقبلات، مواد تموينية..." 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                className="h-10 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">لون تمييز القسم (لشاشة الكاشير والطباعة)</label>
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input 
                  type="color" 
                  value={form.color ?? "#f59e0b"} 
                  onChange={e => setForm({ ...form, color: e.target.value })} 
                  className="w-10 h-10 rounded cursor-pointer border border-border shrink-0" 
                />
                <div className="text-xs">
                  <span className="font-mono font-bold text-slate-800">{form.color}</span>
                  <p className="text-[11px] text-slate-500">يظهر هذا اللون كشريط تمييز لمنتجات القسم في شاشة POS</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button 
              onClick={handleSave} 
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : "حفظ القسم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
