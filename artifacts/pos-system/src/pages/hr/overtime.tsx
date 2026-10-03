import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiDel, fmt } from "./api";

export function OvertimeTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: overtime = [], isLoading } = useQuery({ queryKey: ["hr-overtime"], queryFn: () => apiGet("/api/hr/overtime") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });

  const [showDlg, setShowDlg] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { employee_id: "", hours: "", rate: "20", date: today, notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-overtime"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      return apiPost("/api/hr/overtime", { ...f, employee_id: Number(f.employee_id), hours: Number(f.hours), rate: Number(f.rate) });
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم تسجيل ساعات العمل الإضافي بنجاح" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء التسجيل" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/overtime/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setForm(emptyForm); setShowDlg(true); };

  const totalHours = ((overtime as any[]) || []).reduce((s, o) => s + o.hours, 0);
  const totalAmount = ((overtime as any[]) || []).reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">العمل الإضافي للموظفين</h2>
          <p className="text-sm text-muted-foreground">رصد ساعات العمل الإضافي وحساب البدلات تلقائياً لإضافتها إلى المرتب</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="bg-muted px-3 py-1 rounded-lg text-xs font-semibold">إجمالي الساعات: <span className="font-bold text-primary font-mono">{totalHours} ساعة</span></div>
          <div className="bg-muted px-3 py-1 rounded-lg text-xs font-semibold">إجمالي المستحق: <span className="font-bold text-green-600 font-mono">{fmt(totalAmount)}</span></div>
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />رصد ساعات عمل إضافي</Button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">التاريخ</th>
                <th className="text-right p-3 font-semibold">عدد الساعات الإضافية</th>
                <th className="text-right p-3 font-semibold">سعر الساعة</th>
                <th className="text-right p-3 font-semibold">إجمالي البديل المستحق</th>
                <th className="text-right p-3 font-semibold">ملاحظات / بيان المهمة</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((overtime as any[]) || []).map((o: any) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{o.employee_name}</td>
                  <td className="p-3 text-muted-foreground">{o.date}</td>
                  <td className="p-3 font-mono font-bold text-primary">{o.hours} ساعة</td>
                  <td className="p-3 font-mono text-muted-foreground">{fmt(o.rate)} / ساعة</td>
                  <td className="p-3 font-mono font-bold text-green-600">+{fmt(o.total_amount)}</td>
                  <td className="p-3 text-muted-foreground text-xs">{o.notes ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف سجل العمل الإضافي؟") && delMut.mutate(o.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((overtime as any[]) || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد ساعات عمل إضافي مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل ساعات عمل إضافي لموظف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">الموظف المستحق *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">عدد الساعات الإضافية *</label><Input type="number" step="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} className="mt-1" placeholder="مثال: 3" /></div>
              <div><label className="text-sm font-medium">سعر الساعة الإضافية *</label><Input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} className="mt-1" placeholder="20" /></div>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center font-bold">
              مبلغ البديل الإضافي الكلي: <span className="text-green-600 text-lg font-mono">{fmt((Number(form.hours) || 0) * (Number(form.rate) || 0))}</span>
            </div>
            <div><label className="text-sm font-medium">التاريخ *</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
            <div><label className="text-sm font-medium">بيان العمل الإضافي / الملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="مثال: تغطية مناوبة العشاء أو العمل في عطلة نهاية الأسبوع" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.hours || !form.rate || saveMut.isPending}>تأكيد وحفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
