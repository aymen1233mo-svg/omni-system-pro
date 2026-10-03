import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Printer } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDel } from "./api";
import { printA4Html } from "@/lib/printUtils";

export function CustodiesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: custodies = [], isLoading } = useQuery({ queryKey: ["hr-custodies"], queryFn: () => apiGet("/api/hr/custodies") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });

  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { employee_id: "", item_name: "", received_date: today, returned_date: "", status: "held", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-custodies"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, employee_id: Number(f.employee_id) };
      return editing ? apiPut(`/api/hr/custodies/${editing.id}`, data) : apiPost("/api/hr/custodies", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم حفظ العهدة" }); },
    onError: () => toast({ variant: "destructive", title: "فشل في الحفظ" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/custodies/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowDlg(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ employee_id: String(c.employee_id), item_name: c.item_name, received_date: c.received_date, returned_date: c.returned_date ?? "", status: c.status, notes: c.notes ?? "" }); setShowDlg(true); };

  const handlePrint = () => {
    const html = `
      <h2 style="text-align:center; font-size:22px; margin-bottom:20px;">تقرير عهد وممتلكات الموظفين</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;" border="1">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px; text-align:right;">الموظف المستلم</th>
            <th style="padding:8px; text-align:right;">بيان العهدة</th>
            <th style="padding:8px; text-align:right;">تاريخ الاستلام</th>
            <th style="padding:8px; text-align:right;">تاريخ الإعادة</th>
            <th style="padding:8px; text-align:right;">الحالة</th>
            <th style="padding:8px; text-align:right;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${((custodies as any[]) || []).map((c: any) => `
            <tr>
              <td style="padding:8px;">${c.employee_name || '—'}</td>
              <td style="padding:8px;">${c.item_name}</td>
              <td style="padding:8px;">${c.received_date}</td>
              <td style="padding:8px;">${c.returned_date || '—'}</td>
              <td style="padding:8px;">${c.status === 'held' ? 'في حوزة الموظف' : 'تم الإعادة'}</td>
              <td style="padding:8px;">${c.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printA4Html(html, "تقرير عهد الموظفين");
  };

  const statusLabel: Record<string, string> = { held: "في حوزة الموظف", returned: "تم إعادتها للمستودع" };
  const statusVariant: Record<string, any> = { held: "destructive", returned: "default" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">عهود الموظفين والممتلكات</h2>
          <p className="text-sm text-muted-foreground">تتبع عهد ومستلزمات العمل المسلمة للموظفين (أجهزة، مفاتيح، ملابس وغيرها)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} size="sm" variant="outline" className="gap-2"><Printer className="w-4 h-4" />معاينة وطباعة التقرير</Button>
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />تسليم عهدة</Button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف المستلم</th>
                <th className="text-right p-3 font-semibold">بيان العهدة</th>
                <th className="text-right p-3 font-semibold">تاريخ الاستلام</th>
                <th className="text-right p-3 font-semibold">تاريخ الإعادة</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((custodies as any[]) || []).map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{c.employee_name}</td>
                  <td className="p-3 font-medium text-amber-700">{c.item_name}</td>
                  <td className="p-3 font-mono text-xs">{c.received_date}</td>
                  <td className="p-3 font-mono text-xs">{c.returned_date ?? "—"}</td>
                  <td className="p-3"><Badge variant={statusVariant[c.status]}>{statusLabel[c.status] ?? c.status}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{c.notes ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف سجل العهدة؟") && delMut.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((custodies as any[]) || []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد عهد مسجلة حالياً</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل بيانات عهدة" : "تسجيل تسليم عهدة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">الموظف المستلم *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">بيان العهدة (اسم الجهاز / المفتاح / السيارة) *</label><Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} className="mt-1" placeholder="مثال: لابتوب ديل 2026، مفاتيح الفرع الرئيسي" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">تاريخ الاستلام *</label><Input type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} className="mt-1" /></div>
              <div><label className="text-sm font-medium">تاريخ الإرجاع (إن وجد)</label><Input type="date" value={form.returned_date} onChange={e => setForm(f => ({ ...f, returned_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">الحالة</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="held">في حوزة الموظف (نشطة)</SelectItem>
                  <SelectItem value="returned">تم استرجاعها للمستودع (مغلقة)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">ملاحظات على حالة العهدة</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="مثال: خدوش بسيطة على الظهر" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.item_name || !form.received_date || saveMut.isPending}>تسجيل العهدة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
