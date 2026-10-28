import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDel, fmt } from "./api";

export function TempEmployeesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tempEmployees = [], isLoading } = useQuery({ queryKey: ["hr-temp-employees"], queryFn: () => apiGet("/api/hr/temp-employees") });

  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { name: "", phone: "", position: "", daily_rate: "", hire_date: today, active: true };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-temp-employees"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, daily_rate: Number(f.daily_rate) };
      return editing ? apiPut(`/api/hr/temp-employees/${editing.id}`, data) : apiPost("/api/hr/temp-employees", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم حفظ بيانات الموظف المؤقت" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الحفظ" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/temp-employees/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowDlg(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name, phone: t.phone ?? "", position: t.position ?? "", daily_rate: String(t.daily_rate), hire_date: t.hire_date ?? today, active: Boolean(t.active) }); setShowDlg(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">الموظفون المؤقتون والمستقلون</h2>
          <p className="text-sm text-muted-foreground">إدارة العاملين بالساعة أو باليومية (مثل السائقين الخارجيين، العمال المؤقتين في المناسبات)</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة متعاقد مؤقت</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الاسم</th>
                <th className="text-right p-3 font-semibold">طبيعة العمل / المنصب</th>
                <th className="text-right p-3 font-semibold">رقم الهاتف</th>
                <th className="text-right p-3 font-semibold">اليومية الكلية</th>
                <th className="text-right p-3 font-semibold">تاريخ البدء</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((tempEmployees as any[]) || []).map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-muted-foreground">{t.position ?? "متعاقد"}</td>
                  <td className="p-3 font-mono text-xs">{t.phone ?? "—"}</td>
                  <td className="p-3 font-mono font-bold text-primary">{fmt(t.daily_rate)}</td>
                  <td className="p-3 font-mono text-xs">{t.hire_date}</td>
                  <td className="p-3">
                    <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "نشط" : "غير نشط"}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف الموظف المؤقت؟") && delMut.mutate(t.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((tempEmployees as any[]) || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا يوجد موظفون مؤقتون مسجلون حالياً</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل بيانات المتعاقد المؤقت" : "إضافة متعاقد مؤقت جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">الاسم الكامل *</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="اسم الموظف أو المتعاقد" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">رقم الهاتف</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" placeholder="05xxxxxxxx" /></div>
              <div><label className="text-sm font-medium">طبيعة العمل / المنصب</label><Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="mt-1" placeholder="مثال: سائق توصيل مؤقت" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">معدل اليومية *</label><Input type="number" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} className="mt-1" placeholder="0" /></div>
              <div><label className="text-sm font-medium">تاريخ المباشرة</label><Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} id="temp-active" className="w-4 h-4" />
              <label htmlFor="temp-active" className="text-sm font-medium">نشط ويعمل حالياً</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.name || !form.daily_rate || saveMut.isPending}>حفظ المتعاقد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
