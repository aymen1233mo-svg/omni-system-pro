import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  useGetCurrencies,
  useCreateCurrency,
  useUpdateCurrency,
  useDeleteCurrency
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Coins, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type CurrencyForm = {
  name: string;
  symbol: string;
  fraction: string;
  type: "local" | "foreign";
  exchange_rate: number;
  active: boolean;
};

export default function CurrenciesPage() {
  const { user } = useAuth();
  const { data: currencies = [], isLoading } = useGetCurrencies();
  const createMutation = useCreateCurrency();
  const updateMutation = useUpdateCurrency();
  const deleteMutation = useDeleteCurrency();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CurrencyForm>({
    name: "",
    symbol: "",
    fraction: "",
    type: "foreign",
    exchange_rate: 1.0,
    active: true
  });

  // Currency Converter Quick Calculator States
  const [calcFromId, setCalcFromId] = useState<number | null>(null);
  const [calcToId, setCalcToId] = useState<number | null>(null);
  const [calcAmount, setCalcAmount] = useState<number>(100);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      symbol: "",
      fraction: "",
      type: "foreign",
      exchange_rate: 1.0,
      active: true
    });
    setShowDialog(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name,
      symbol: c.symbol,
      fraction: c.fraction || "",
      type: c.type,
      exchange_rate: c.exchange_rate,
      active: c.active === 1 || c.active === true
    });
    setShowDialog(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["currencies"] });
  };

  const handleSave = () => {
    if (!form.name || !form.symbol || !form.exchange_rate) {
      toast({ variant: "destructive", title: "يرجى ملء جميع الحقول المطلوبة" });
      return;
    }

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: form },
        {
          onSuccess: () => {
            invalidate();
            setShowDialog(false);
            toast({ title: "تم تحديث العملة بنجاح" });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "فشل في تحديث العملة", description: err.message });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: form },
        {
          onSuccess: () => {
            invalidate();
            setShowDialog(false);
            toast({ title: "تم إضافة العملة بنجاح" });
          },
          onError: (err: any) => {
            toast({ variant: "destructive", title: "فشل في إضافة العملة", description: err.message });
          }
        }
      );
    }
  };

  const handleDelete = (c: any) => {
    if (!confirm(`هل أنت متأكد من حذف العملة "${c.name}"؟`)) return;
    deleteMutation.mutate(
      { id: c.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "تم حذف العملة بنجاح" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "فشل في حذف العملة", description: err.message });
        }
      }
    );
  };

  // Safe Calculator calculation
  const getCalculatedRate = () => {
    if (currencies.length === 0) return 0;
    const fromCur = currencies.find(c => c.id === (calcFromId || currencies[0].id));
    const toCur = currencies.find(c => c.id === (calcToId || currencies[1]?.id || currencies[0].id));
    if (!fromCur || !toCur) return 0;

    // Rate is relative to USD usually or base. 
    // Convert 'fromAmount' to base first, then base to 'toCur'
    // baseValue = amount * fromCur.exchange_rate (if exchange_rate is multiplying to USD, or dividing)
    // Here we'll treat exchange_rate as relative to the local currency (where local is 1.0)
    // E.g., if local currency is YER, SAR is 0.27? Or SAR = 3.75 USD.
    // Let's do simple formula: amount * (fromCur.exchange_rate / toCur.exchange_rate)
    return calcAmount * (toCur.exchange_rate / fromCur.exchange_rate);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="w-6 h-6 text-primary" />
              تهيئة وإدارة العملات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              تعريف العملات المحلية والأجنبية، تحديد أسعار الصرف، والكسور المئوية المعتمدة بالنظام.
            </p>
          </div>
          {user?.role === "admin" || user?.role === "developer" ? (
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة عملة جديدة
            </Button>
          ) : null}
        </div>

        {/* Currency Grid and Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">قائمة العملات المعتمدة</h2>
            
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border">جاري التحميل...</div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold">اسم العملة</th>
                      <th className="p-3 font-semibold">الرمز الدولى</th>
                      <th className="p-3 font-semibold">فئة الجزء (الكسر)</th>
                      <th className="p-3 font-semibold">النوع</th>
                      <th className="p-3 font-semibold">معامل الصرف (الأساسي)</th>
                      <th className="p-3 font-semibold">الحالة</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currencies.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold text-primary">{c.name}</td>
                        <td className="p-3 font-mono font-medium">{c.symbol}</td>
                        <td className="p-3 text-muted-foreground">{c.fraction || "—"}</td>
                        <td className="p-3">
                          <Badge variant={c.type === "local" ? "default" : "outline"}>
                            {c.type === "local" ? "عملة محلية أساسية" : "عملة أجنبية"}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-bold text-green-600">
                          {c.exchange_rate}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={c.active === 1 || c.active === true ? "outline" : "destructive"}
                            className={c.active === 1 || c.active === true ? "text-green-600 border-green-600 bg-green-50" : ""}
                          >
                            {c.active === 1 || c.active === true ? "نشط" : "موقوف"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-end">
                            {(user?.role === "admin" || user?.role === "developer") && (
                              <>
                                <button
                                  onClick={() => openEdit(c)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="تعديل"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {c.type !== "local" && (
                                  <button
                                    onClick={() => handleDelete(c)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {currencies.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          لا يوجد عملات مضافة حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Currency Converter Side-Panel */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">محاسب العملات المباشر</h2>
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">المبلغ المراد تحويله</label>
                <Input
                  type="number"
                  value={calcAmount}
                  onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)}
                  className="font-mono text-lg font-bold text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">من عملة</label>
                  <select
                    value={calcFromId || (currencies[0]?.id ?? "")}
                    onChange={e => setCalcFromId(parseInt(e.target.value) || null)}
                    className="w-full p-2 rounded border bg-background text-sm"
                  >
                    {currencies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>

                <div className="p-2 mt-4 shrink-0 rounded bg-muted">
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">إلى عملة</label>
                  <select
                    value={calcToId || (currencies[1]?.id ?? currencies[0]?.id ?? "")}
                    onChange={e => setCalcToId(parseInt(e.target.value) || null)}
                    className="w-full p-2 rounded border bg-background text-sm"
                  >
                    {currencies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-1">
                <span className="text-xs text-muted-foreground">القيمة المقابلة التقريبية بالصرف الحالى</span>
                <div className="text-2xl font-black text-primary font-mono" dir="ltr">
                  {getCalculatedRate().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
                  <span className="text-sm font-bold">
                    {currencies.find(c => c.id === (calcToId || currencies[1]?.id || currencies[0]?.id))?.symbol || ""}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-muted-foreground">
                  * تستند هذه الأسعار تلقائياً لمعاملات الصرف المعتمدة لليوم ضمن النظام لإغلاق الصناديق بدقة.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "تعديل العملة الحالية" : "إضافة عملة جديدة"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">اسم العملة *</label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: ريال سعودي، دولار أمريكي"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">الرمز الدولي *</label>
                  <Input
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                    placeholder="مثال: SAR, USD"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">اسم الجزء (الكسر)</label>
                  <Input
                    value={form.fraction}
                    onChange={e => setForm({ ...form, fraction: e.target.value })}
                    placeholder="مثال: هللة، سنت"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">نوع العملة</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as any })}
                    className="w-full p-2 rounded border border-input bg-background text-sm"
                  >
                    <option value="foreign">عملة أجنبية</option>
                    <option value="local">عملة محلية أساسية</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">معامل تحويل الصرف *</label>
                  <Input
                    type="number"
                    step="any"
                    value={form.exchange_rate}
                    onChange={e => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 0 })}
                    className="font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">تنشيط العملة بالنظام</label>
                  <p className="text-xs text-muted-foreground">عند الإيقاف، لا تظهر العملة في السندات والصناديق.</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={v => setForm({ ...form, active: v })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave}>
                {editing ? "تعديل العملة" : "حفظ وإضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
