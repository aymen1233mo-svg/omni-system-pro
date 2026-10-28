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

export function LeavesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: leaves = [], isLoading } = useQuery({ queryKey: ["hr-leaves"], queryFn: () => apiGet("/api/hr/leaves") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });

  const [showDlg, setShowDlg] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = { employee_id: "", start_date: today, end_date: today, type: "annual", status: "approved", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-leaves"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, employee_id: Number(f.employee_id) };
      return editing ? apiPut(`/api/hr/leaves/${editing.id}`, data) : apiPost("/api/hr/leaves", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم تسجيل الإجازة" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ في التسجيل" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/leaves/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowDlg(true); };
  const openEdit = (l: any) => { setEditing(l); setForm({ employee_id: String(l.employee_id), start_date: l.start_date, end_date: l.end_date, type: l.type, status: l.status, notes: l.notes ?? "" }); setShowDlg(true); };

  const handlePrint = () => {
    const html = `
      <h2 style="text-align:center; font-size:22px; margin-bottom:20px;">تقرير إجازات الموظفين</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;" border="1">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px; text-align:right;">الموظف</th>
            <th style="padding:8px; text-align:right;">نوع الإجازة</th>
            <th style="padding:8px; text-align:right;">من تاريخ</th>
            <th style="padding:8px; text-align:right;">إلى تاريخ</th>
            <th style="padding:8px; text-align:right;">الحالة</th>
            <th style="padding:8px; text-align:right;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${((leaves as any[]) || []).map((l: any) => `
            <tr>
              <td style="padding:8px;">${l.employee_name || '—'}</td>
              <td style="padding:8px;">${l.type}</td>
              <td style="padding:8px;">${l.start_date}</td>
              <td style="padding:8px;">${l.end_date}</td>
              <td style="padding:8px;">${l.status === 'approved' ? 'مقبولة' : l.status === 'pending' ? 'قيد الانتظار' : 'مرفوضة'}</td>
              <td style="padding:8px;">${l.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    printA4Html(html, "تقرير إجازات الموظفين");
  };

  const leaveTypes: Record<string, string> = { annual: "إجازة سنوية", sick: "مرضي", unpaid: "إجازة بدون راتب", maternity: "أمومة / رعاية", other: "أخرى" };
  const leaveColors: Record<string, string> = { annual: "bg-blue-100 text-blue-700", sick: "bg-red-100 text-red-700", unpaid: "bg-yellow-100 text-yellow-700", maternity: "bg-purple-100 text-purple-700" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">نظام الإجازات</h2>
          <p className="text-sm text-muted-foreground">تقديم وإدارة الإجازات المرضية والسنوية والطارئة للموظفين</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} size="sm" variant="outline" className="gap-2"><Printer className="w-4 h-4" />معاينة وطباعة التقرير</Button>
          <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />طلب إجازة</Button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-right p-3 font-semibold">الموظف</th>
                <th className="text-right p-3 font-semibold">نوع الإجازة</th>
                <th className="text-right p-3 font-semibold">تاريخ البدء</th>
                <th className="text-right p-3 font-semibold">تاريخ الانتهاء</th>
                <th className="text-right p-3 font-semibold">المدة (بالأيام)</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="text-right p-3 font-semibold">ملاحظات</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {((leaves as any[]) || []).map((l: any) => {
                const diff = Math.ceil((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{l.employee_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${leaveColors[l.type] ?? "bg-slate-100 text-slate-700"}`}>
                        {leaveTypes[l.type] ?? l.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{l.start_date}</td>
                    <td className="p-3 font-mono text-xs">{l.end_date}</td>
                    <td className="p-3 font-mono font-bold text-primary">{diff} يوم</td>
                    <td className="p-3">
                      <Badge variant={l.status === "approved" ? "default" : l.status === "pending" ? "secondary" : "destructive"}>
                        {l.status === "approved" ? "مقبولة" : l.status === "pending" ? "قيد الانتظار" : "مرفوضة"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{l.notes ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف سجل الإجازة؟") && delMut.mutate(l.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {((leaves as any[]) || []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد إجازات مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل طلب إجازة" : "تقديم طلب إجازة"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">الموظف طالب الإجازة *</label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">نوع الإجازة *</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">إجازة سنوية</SelectItem>
                  <SelectItem value="sick">إجازة مرضية</SelectItem>
                  <SelectItem value="unpaid">إجازة بدون راتب (خصم)</SelectItem>
                  <SelectItem value="maternity">إجازة أمومة / رعاية</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">تاريخ البدء *</label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" /></div>
              <div><label className="text-sm font-medium">تاريخ الانتهاء *</label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">حالة الطلب</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">مقبولة (معتمدة)</SelectItem>
                  <SelectItem value="pending">قيد الدراسة / معلقة</SelectItem>
                  <SelectItem value="rejected">مرفوضة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">السبب / ملاحظات</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="مثال: إجازة عائلية طارئة" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.employee_id || !form.start_date || !form.end_date || saveMut.isPending}>تقديم الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
