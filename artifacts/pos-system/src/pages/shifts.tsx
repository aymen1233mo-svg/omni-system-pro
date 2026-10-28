import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShieldAlert, Lock, Unlock } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [startingCash, setStartingCash] = useState("500");
  const [actualCash, setActualCash] = useState("");
  const [withdrawals, setWithdrawals] = useState("0");
  const [deposits, setDeposits] = useState("0");

  const { data: activeShift, isLoading } = useQuery({ queryKey: ["active-shift"], queryFn: () => apiGet("/api/shifts/active") });

  const openShift = useMutation({
    mutationFn: () => apiPost("/api/shifts/open", { starting_cash: Number(startingCash) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["active-shift"] }); toast({ title: "تم فتح الوردية بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const closeShift = useMutation({
    mutationFn: () => apiPost("/api/shifts/close", { shift_id: activeShift.id, actual_cash: Number(actualCash), withdrawals: Number(withdrawals), deposits: Number(deposits) }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["active-shift"] });
      toast({ title: "تم إغلاق الوردية", description: `العجز/الزيادة: ${fmt(data.difference)}` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  if (isLoading) return <AdminLayout><div className="text-center py-20 text-muted-foreground">جاري التحميل...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="w-6 h-6" />إدارة ورديات الصندوق (Cash Drawer)</h1>

        {!activeShift ? (
          <Card className="border-2 border-primary/30">
            <CardHeader><CardTitle className="flex items-center gap-2"><Unlock className="w-5 h-5 text-primary" />فتح وردية جديدة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">رصيد الافتتاح (المبلغ النقدي في الدرج بداية الوردية)</label>
                <Input type="number" value={startingCash} onChange={e => setStartingCash(e.target.value)} className="text-lg font-bold" />
              </div>
              <Button onClick={() => openShift.mutate()} className="w-full text-base py-6 gap-2">
                <Unlock className="w-5 h-5" />فتح الوردية والبدء
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-green-500/30">
            <CardHeader><CardTitle className="flex items-center gap-2 text-green-700"><Lock className="w-5 h-5" />الوردية الحالية مفتوحة (منذ {new Date(activeShift.start_time).toLocaleTimeString("ar-SA")})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/50 p-4 rounded-xl text-xs">
                <div>
                  <div className="text-muted-foreground">رصيد الافتتاح</div>
                  <div className="text-base font-bold">{fmt(activeShift.starting_cash)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">إجمالي مبيعات النقدي</div>
                  <div className="text-base font-bold text-amber-600">{fmt(activeShift.gross_cash_sales ?? activeShift.cash_sales)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-rose-600">المرتجعات النقدية</div>
                  <div className="text-base font-bold text-rose-600">-{fmt(activeShift.cash_returns ?? 0)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-emerald-600">الصافي المتوقع بالدرج</div>
                  <div className="text-base font-bold text-emerald-600">{fmt(activeShift.expected_cash ?? (activeShift.starting_cash + (activeShift.cash_sales ?? 0)))}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">المبلغ الفعلي الموجود في الدرج عند الإغلاق</label>
                  <Input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} placeholder="أدخل المبلغ العددي الفعلي" className="text-lg font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">المسحوبات (مصروفات نقدية من الدرج)</label>
                    <Input type="number" value={withdrawals} onChange={e => setWithdrawals(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">الإيداعات (مبالغ مضافة للدرج)</label>
                    <Input type="number" value={deposits} onChange={e => setDeposits(e.target.value)} />
                  </div>
                </div>
              </div>

              <Button onClick={() => closeShift.mutate()} variant="destructive" className="w-full text-base py-6 gap-2">
                <Lock className="w-5 h-5" />إغلاق الوردية وجرد الصندوق
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
