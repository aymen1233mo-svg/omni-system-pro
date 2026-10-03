import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Utensils, Plus, Trash2, ArrowRightLeft } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

export default function TablesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [section, setSection] = useState("الصالات الرئيسية");

  const [showTransfer, setShowTransfer] = useState(false);
  const [fromTable, setFromTable] = useState("");
  const [toTable, setToTable] = useState("");

  const { data: tables = [] } = useQuery({ queryKey: ["restaurant-tables"], queryFn: () => apiGet("/api/tables") });

  const addTable = useMutation({
    mutationFn: () => apiPost("/api/tables", { table_number: tableNumber, capacity: Number(capacity), section }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant-tables"] }); setTableNumber(""); toast({ title: "تم إضافة الطاولة" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const transferMut = useMutation({
    mutationFn: () => apiPost("/api/tables/transfer", { from_table: fromTable, to_table: toTable }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant-tables"] }); setShowTransfer(false); toast({ title: "تم نقل الطاولة بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delTable = useMutation({
    mutationFn: (id: number) => apiDel(`/api/tables/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant-tables"] }); toast({ title: "تم الحذف" }); }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Utensils className="w-6 h-6" />إدارة طاولات المطعم</h1>
          <Button onClick={() => setShowTransfer(true)} variant="outline" className="gap-2"><ArrowRightLeft className="w-4 h-4" />نقل طاولة</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">إضافة طاولة جديدة</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-4 gap-3">
            <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="رقم / اسم الطاولة (مثال: 7 أو VIP-2)" />
            <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="السعة (عدد الأشخاص)" />
            <Input value={section} onChange={e => setSection(e.target.value)} placeholder="القسم" />
            <Button onClick={() => addTable.mutate()} disabled={!tableNumber.trim()} className="gap-1"><Plus className="w-4 h-4" />إضافة طاولة</Button>
          </CardContent>
        </Card>

        {/* عرض الطاولات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {((tables as any[]) || []).map(t => (
            <Card key={t.id} className={`border-2 ${t.status === "occupied" ? "border-amber-500 bg-amber-50/30" : "border-green-500 bg-green-50/30"}`}>
              <CardContent className="p-4 flex flex-col justify-between h-36">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">طاولة {t.table_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.status === "occupied" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                    {t.status === "occupied" ? "مشغولة" : "متاحة"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>السعة: {t.capacity} أشخاص</div>
                  <div>القسم: {t.section}</div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => confirm("حذف الطاولة؟") && delTable.mutate(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* نافذة نقل الطاولة */}
        <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>نقل الطلب من طاولة لأخرى</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">من الطاولة الحالية:</label>
                <select value={fromTable} onChange={e => setFromTable(e.target.value)} className="w-full border rounded-md p-2 bg-background">
                  <option value="">اختر الطاولة المصدر</option>
                  {((tables as any[]) || []).map(t => <option key={t.id} value={t.table_number}>طاولة {t.table_number}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">إلى الطاولة الجديدة:</label>
                <select value={toTable} onChange={e => setToTable(e.target.value)} className="w-full border rounded-md p-2 bg-background">
                  <option value="">اختر الطاولة الوجهة</option>
                  {((tables as any[]) || []).map(t => <option key={t.id} value={t.table_number}>طاولة {t.table_number}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransfer(false)}>إلغاء</Button>
              <Button onClick={() => transferMut.mutate()} disabled={!fromTable || !toTable || fromTable === toTable}>تنفيذ النقل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
