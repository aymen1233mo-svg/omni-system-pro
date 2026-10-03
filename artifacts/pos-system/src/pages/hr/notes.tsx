import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, StickyNote } from "lucide-react";
import { apiGet, apiPost, apiDel } from "./api";

export function NotesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: notes = [], isLoading } = useQuery({ queryKey: ["hr-notes"], queryFn: () => apiGet("/api/hr/notes") });
  const { data: depts = [] } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });

  const [showDlg, setShowDlg] = useState(false);
  const emptyForm = { department_id: "", title: "", content: "" };
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr-notes"] });

  const saveMut = useMutation({
    mutationFn: (f: typeof form) => {
      const data = { ...f, department_id: f.department_id ? Number(f.department_id) : null };
      return apiPost("/api/hr/notes", data);
    },
    onSuccess: () => { invalidate(); setShowDlg(false); toast({ title: "تم إضافة الملاحظة بنجاح" }); },
    onError: () => toast({ variant: "destructive", title: "فشل الحفظ" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/notes/${id}`),
    onSuccess: invalidate,
  });

  const openAdd = () => { setForm(emptyForm); setShowDlg(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">ملاحظات ودفتر أحوال الأقسام</h2>
          <p className="text-sm text-muted-foreground">تسجيل الملاحظات، البلاغات، الطلبات، والتعليمات الخاصة بأقسام العمل والتشغيل</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة ملاحظة</Button>
      </div>

      {isLoading ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {((notes as any[]) || []).map((n: any) => (
            <div key={n.id} className="bg-card rounded-xl border border-border p-4 relative flex flex-col justify-between shadow-sm hover:shadow-md transition">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-amber-600">
                    <StickyNote className="w-5 h-5" />
                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">
                      {n.department_name ?? "عام / الإدارة"}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive w-8 h-8 -mt-2 -me-2" onClick={() => confirm("حذف الملاحظة؟") && delMut.mutate(n.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-md text-foreground">{n.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-4 pt-2 border-t border-border">
                {new Date(n.created_at).toLocaleString("ar-SA")}
              </div>
            </div>
          ))}
          {((notes as any[]) || []).length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              لا توجد ملاحظات أو بلاغات حالياً للأقسام
            </div>
          )}
        </div>
      )}

      <Dialog open={showDlg} onOpenChange={setShowDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل ملاحظة / بلاغ للأقسام</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">القسم المعني</label>
              <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر القسم (اتركه فارغاً لملاحظة عامة)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ملاحظة عامة لكافة الأقسام</SelectItem>
                  {((depts as any[]) || []).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">العنوان / بيان الملاحظة *</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" placeholder="مثال: تعطل ثلاجة التبريد رقم 3" /></div>
            <div><label className="text-sm font-medium">تفاصيل الملاحظة والتعليمات الإضافية</label><Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="mt-1 h-24" placeholder="اكتب بالتفصيل المشكلة أو الملاحظة أو التوصيات الخاصة بالإغلاق والفتح" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDlg(false)}>إلغاء</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={!form.title || saveMut.isPending}>نشر الملاحظة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
