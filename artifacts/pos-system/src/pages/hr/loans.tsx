import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Printer } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDel, fmt } from "./api";
import { printA4Html } from "@/lib/printUtils";

export function LoansTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: loans = [], isLoading } = useQuery({ queryKey: ["hr-loans"], queryFn: () => apiGet("/api/hr/loans") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  
  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { employee_id: "", amount: "", type: "loan", request_date: today, status: "approved", repayment_terms: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-loans"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, employee_id: Number(f.employee_id), amount: Number(f.amount) };
      return editing ? apiPut(`/api/hr/loans/${editing.id}`, data) : apiPost("/api/hr/loans", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم الحفظ بنجاح" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الحفظ" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/loans/${id}`),
    onSuccess: invalidate,
    onError: () => toast({ variant: "destructive", title: "فشل الحذف" }),
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowDlg(true); };
  const openEdit = (l: any) => { setEditing(l); setForm({ employee_id: String(l.employee_id), amount: String(l.amount), type: l.type, request_date: l.request_date, status: l.status, repayment_terms: l.repayment_terms ?? "", notes: l.notes ?? "" }); setShowDlg(true); };

  const handlePrint = () => {
    const html = `
      <h2 style="text-align:center; font-size:22px; margin-bottom:20px;">تقرير سلف وقروض الموظفين</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;" border="1">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px; text-align:right;">الموظف</th>
            <th style="padding:8px; text-align:right;">النوع</th>
            <th style="padding:8px; text-align:right;">المبلغ</th>
            <th style="padding:8px; text-align:right;">تاريخ الطلب</th>
            <th style="padding:8px; text-align:right;">شروط السداد</th>
            <th style="padding:8px; text-align:right;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${((loans as any[]) || []).map((l: any) => `
            <tr>
              <td style="padding:8px;">${l.employee_name || '—'}</td>
              <td style="padding:8px;">${l.type === 'loan' ? 'قرض مستمر' : 'سلفة مؤقتة'}</td>
              <td style="padding:8px;">${fmt(l.amount)}</td>
              <td style="padding:8px;">${l.request_date}</td>
              <td style="padding:8px;">${l.repayment_terms || '—'}</td>
              <td style="padding:8px;">${l.status === 'approved' ? 'موافق عليه' : l.status === 'pending' ? 'معلق' : 'مرفوض'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printA4Html(html, "تقرير السلف والقروض");
  };

  const typeLabel: Record<string, string> = { loan: "قرض مستمر", temporary: "سلفة مؤقتة" };
  const statusLabel: Record<string, string> = { pending: "معلق", approved: "موافق عليه", rejected: "مرفوض" };
  const statusVariant: Record<string, any> = { pending: "secondary", approved: "default", rejected: "destructive" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">سلف الموظفين</h2>
          <p className="text-sm text-muted-foreground">إدارة القروض المستمرة والسلف المؤقتة للموظفين</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} size="sm" variant="outline" className="gap-2"><Printer className="w-4 h-4" />معاينة وطباعة التقرير</Button>
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة طلب</Button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">النوع</th>
                <th className="text-right p-3 font-semibold">المبلغ</th>
                <th className="text-right p-3 font-semibold">تاريخ الطلب</th>
                <th className="text-right p-3 font-semibold">شروط السداد</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((loans as any[]) || []).map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{l.employee_name}</td>
                  <td className="p-3 text-muted-foreground">{typeLabel[l.type] ?? l.type}</td>
                  <td className="p-3 font-mono font-bold text-primary">{fmt(l.amount)}</td>
                  <td className="p-3 text-muted-foreground">{l.request_date}</td>
                  <td className="p-3 text-muted-foreground">{l.repayment_terms ?? "—"}</td>
                  <td className="p-3"><Badge variant={statusVariant[l.status]}>{statusLabel[l.status] ?? l.status}</Badge></td>
                  <td className="p-3 text-muted-foreground text-xs">{l.notes ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("هل أنت متأكد من الحذف؟") && delMut.mutate(l.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {((loans as any[]) || []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد طلبات سلف أو قروض مضافة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل طلب سلفة / قرض" : "إضافة طلب سلفة / قرض"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">الموظف *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">النوع *</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan">قرض مستمر</SelectItem>
                    <SelectItem value="temporary">سلفة مؤقتة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium">المبلغ *</label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">التاريخ *</label><Input type="date" value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} className="mt-1" /></div>
              <div>
                <label className="text-sm font-medium">الحالة</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">موافق عليه</SelectItem>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium">شروط السداد (مثال: خصم شهري بقيمة 200 ريال)</label><Input value={form.repayment_terms} onChange={e => setForm(f => ({ ...f, repayment_terms: e.target.value }))} className="mt-1" placeholder="اكتب شروط أو أقساط السداد" /></div>
            <div><label className="text-sm font-medium">ملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="ملاحظات إضافية" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.amount || saveMut.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
