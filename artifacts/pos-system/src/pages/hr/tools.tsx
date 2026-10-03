import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDel } from "./api";

export function ToolsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tools = [], isLoading: loadTools } = useQuery({ queryKey: ["hr-tools"], queryFn: () => apiGet("/api/hr/tools") });
  const { data: movements = [], isLoading: loadMoves } = useQuery({ queryKey: ["hr-movements"], queryFn: () => apiGet("/api/hr/tools/movements") });
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });

  const [showToolDlg, setShowToolDlg] = useState(false);
  const [editingTool, setEditingTool] = useState<any>(null);
  const [toolForm, setToolForm] = useState({ name: "", serial_number: "", quantity: "1", notes: "" });

  const [showMoveDlg, setShowMoveDlg] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [moveForm, setMoveForm] = useState({ tool_id: "", employee_id: "", type: "out", quantity: "1", date: today, notes: "" });

  const toolMut = useMutation({
    mutationFn: (f: typeof toolForm) => {
      const data = { ...f, quantity: Number(f.quantity), available_qty: Number(f.quantity) };
      return editingTool ? apiPut(`/api/hr/tools/${editingTool.id}`, data) : apiPost("/api/hr/tools", data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-tools"] }); setShowToolDlg(false); toast({ title: "تم الحفظ بنجاح" }); },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ أثناء الحفظ" }),
  });

  const moveMut = useMutation({
    mutationFn: (f: typeof moveForm) => {
      return apiPost("/api/hr/tools/movements", { ...f, tool_id: Number(f.tool_id), employee_id: Number(f.employee_id), quantity: Number(f.quantity) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-tools"] });
      qc.invalidateQueries({ queryKey: ["hr-movements"] });
      setShowMoveDlg(false);
      toast({ title: "تم تسجيل الحركة بنجاح" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في تسجيل الحركة", description: e.message }),
  });

  const delToolMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/hr/tools/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-tools"] }),
  });

  const openAddTool = () => { setEditingTool(null); setToolForm({ name: "", serial_number: "", quantity: "1", notes: "" }); setShowToolDlg(true); };
  const openEditTool = (t: any) => { setEditingTool(t); setToolForm({ name: t.name, serial_number: t.serial_number ?? "", quantity: String(t.quantity), notes: t.notes ?? "" }); setShowToolDlg(true); };
  const openMove = (type: "out" | "in") => { setMoveForm({ tool_id: "", employee_id: "", type, quantity: "1", date: today, notes: "" }); setShowMoveDlg(true); };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="inventory" dir="rtl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="inventory">مستودع الأدوات</TabsTrigger>
            <TabsTrigger value="history">حركات خروج وعودة الأدوات</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button onClick={() => openMove("out")} size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-600 hover:bg-amber-50"><ArrowUpRight className="w-4 h-4" />خروج أدوات</Button>
            <Button onClick={() => openMove("in")} size="sm" variant="outline" className="gap-1 text-green-600 border-green-600 hover:bg-green-50"><ArrowDownLeft className="w-4 h-4" />عودة أدوات</Button>
            <Button onClick={openAddTool} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة أداة جديدة</Button>
          </div>
        </div>

        <TabsContent value="inventory" className="mt-4">
          {loadTools ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right p-3 font-semibold">اسم الأداة / العتاد</th>
                    <th className="text-right p-3 font-semibold">الرقم التسلسلي</th>
                    <th className="text-right p-3 font-semibold">الكمية الكلية</th>
                    <th className="text-right p-3 font-semibold">الكمية المتاحة</th>
                    <th className="text-right p-3 font-semibold">ملاحظات</th>
                    <th className="p-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((tools as any[]) || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{t.name}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{t.serial_number ?? "—"}</td>
                      <td className="p-3 font-mono">{t.quantity}</td>
                      <td className="p-3 font-mono">
                        <Badge variant={t.available_qty > 0 ? "default" : "destructive"}>
                          {t.available_qty} متبقي
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{t.notes ?? "—"}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditTool(t)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف الأداة؟") && delToolMut.mutate(t.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {((tools as any[]) || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">مستودع الأدوات فارغ</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {loadMoves ? <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right p-3 font-semibold">نوع الحركة</th>
                    <th className="text-right p-3 font-semibold">الأداة / العتاد</th>
                    <th className="text-right p-3 font-semibold">الموظف</th>
                    <th className="text-right p-3 font-semibold">الكمية</th>
                    <th className="text-right p-3 font-semibold">تاريخ الحركة</th>
                    <th className="text-right p-3 font-semibold">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((movements as any[]) || []).map((m: any) => (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <Badge variant={m.type === "out" ? "destructive" : "default"} className="gap-1">
                          {m.type === "out" ? "خروج / عهدة" : "عودة / استلام"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{m.tool_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{m.tool_serial}</div>
                        </div>
                      </td>
                      <td className="p-3">{m.employee_name}</td>
                      <td className="p-3 font-mono font-bold">{m.quantity}</td>
                      <td className="p-3 text-muted-foreground">{m.date}</td>
                      <td className="p-3 text-muted-foreground text-xs">{m.notes ?? "—"}</td>
                    </tr>
                  ))}
                  {((movements as any[]) || []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد حركات مسجلة للأدوات</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* حوار الأدوات */}
      <Dialog open={showToolDlg} onOpenChange={setShowToolDlg}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>{editingTool ? "تعديل بيانات أداة" : "إضافة أداة جديدة للمستودع"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">اسم الأداة *</label><Input value={toolForm.name} onChange={e => setToolForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="مثال: جهاز بيجر، ميزان حرارة" /></div>
            <div><label className="text-sm font-medium">الرقم التسلسلي / الباركود</label><Input value={toolForm.serial_number} onChange={e => setToolForm(f => ({ ...f, serial_number: e.target.value }))} className="mt-1" placeholder="أو رقم تصنيفي فريد" /></div>
            <div><label className="text-sm font-medium">الكمية الكلية *</label><Input type="number" value={toolForm.quantity} onChange={e => setToolForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1" min="1" /></div>
            <div><label className="text-sm font-medium">ملاحظات وصفية</label><Input value={toolForm.notes} onChange={e => setToolForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="حالة الأداة أو مواصفاتها" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToolDlg(false)}>إلغاء</Button>
            <Button onClick={() => toolMut.mutate(toolForm)} disabled={!toolForm.name || toolMut.isPending}>حفظ الأداة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تسجيل الحركات */}
      <Dialog open={showMoveDlg} onOpenChange={setShowMoveDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{moveForm.type === "out" ? "تسجيل خروج أداة (عهدة موظف)" : "تسجيل استلام / عودة أداة من موظف"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">اختر الأداة / العتاد *</label>
              <Select value={moveForm.tool_id} onValueChange={v => setMoveForm(f => ({ ...f, tool_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الأداة" /></SelectTrigger>
                <SelectContent>
                  {((tools as any[]) || []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} (المتاح: {t.available_qty} من {t.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">الموظف المستلم / المرجع *</label>
              <Select value={moveForm.employee_id} onValueChange={v => setMoveForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{((employees as any[]) || []).filter((e: any) => e.active).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">الكمية *</label><Input type="number" value={moveForm.quantity} onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1" min="1" /></div>
              <div><label className="text-sm font-medium">تاريخ الحركة *</label><Input type="date" value={moveForm.date} onChange={e => setMoveForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><label className="text-sm font-medium">ملاحظات / حالة التسليم</label><Input value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" placeholder="مثال: تم تسليمها سليمة" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDlg(false)}>إلغاء</Button>
            <Button onClick={() => moveMut.mutate(moveForm)} disabled={!moveForm.tool_id || !moveForm.employee_id || moveMut.isPending}>
              {moveForm.type === "out" ? "تأكيد التسليم" : "تأكيد الاسترجاع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
