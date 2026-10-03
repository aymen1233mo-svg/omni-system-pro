import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiDel, fmt } from "./api";

export function PenaltiesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: penalties = [], isLoading } = useQuery({ queryKey: ["hr-penalties"], queryFn: () => apiGet("/api/hr/penalties") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });

  const [showDlg, setShowDlg] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { employee_id: "", violation_name: "", amount: "", date: today, notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-penalties"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      return apiPost("/api/hr/penalties", { ...f, employee_id: Number(f.employee_id), amount: Number(f.amount) });
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم تسجيل المخالفة بنجاح" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء التسجيل" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/penalties/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setForm(emptyForm); setShowDlg(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">جزاءات ومخالفات الموظفين</h2>
          <p className="text-sm text-muted-foreground">رصد وتسجيل المخالفات والتأخيرات والغرامات والجزاءات المالية على الموظفين</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />رصد مخالفة</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">نوع المخالفة / البيان</th>
                <th className="text-right p-3 font-semibold">قيمة الجزاء (خصم)</th>
                <th className="text-right p-3 font-semibold">تاريخ المخالفة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((penalties as any[]) || []).map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.employee_name}</td>
                  <td className="p-3 font-medium text-destructive">{p.violation_name}</td>
                  <td className="p-3 font-mono font-bold text-red-600">-{fmt(p.amount)}</td>
                  <td className="p-3 text-muted-foreground">{p.date}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.notes ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف سجل المخالفة؟") && delMut.mutate(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((penalties as any[]) || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد مخالفات مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل غرامة / جزاء مالي على موظف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">الموظف المخالف *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">نوع المخالفة / البيان *</label>
              <Select value={form.violation_name} onValueChange={v => setForm(f => ({ ...f, violation_name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر نوع المخالفة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="تأخير غير مبرر">تأخير غير مبرر</SelectItem>
                  <SelectItem value="غياب بدون عذر">غياب بدون عذر</SelectItem>
                  <SelectItem value="مخالفة قواعد السلامة">مخالفة قواعد السلامة / جودة الغذاء</SelectItem>
                  <SelectItem value="سوء سلوك">سوء سلوك / معاملة زبائن غير لائقة</SelectItem>
                  <SelectItem value="تقصير في أداء الواجبات">تقصير في أداء الواجبات</SelectItem>
                  <SelectItem value="أخرى">أخرى (كتابة يدوية بالأسفل)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.violation_name === "أخرى" && (
              <div>
                <label className="text-sm font-medium">تفصيل المخالفة يدويًا *</label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value, violation_name: e.target.value }))} className="mt-1" placeholder="اكتب اسم المخالفة بالتفصيل" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">مبلغ الخصم / الجزاء *</label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" placeholder="0" /></div>
              <div><label className="text-sm font-medium">تاريخ المخالفة *</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><label className="text-sm font-medium">تفاصيل المخالفة والملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="ملاحظات تفصيلية أو إجراء إداري تم اتخاذه" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.violation_name || !form.amount || saveMut.isPending}>رصد وإقرار الجزاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
