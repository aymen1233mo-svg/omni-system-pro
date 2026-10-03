import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Warehouse, Plus, Trash2 } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

export default function BranchesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseBranchId, setWarehouseBranchId] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");

  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: () => apiGet("/api/branches") });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => apiGet("/api/warehouses") });

  const addBranch = useMutation({
    mutationFn: () => apiPost("/api/branches", { name: branchName, address: branchAddress, phone: branchPhone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); setBranchName(""); setBranchAddress(""); setBranchPhone(""); toast({ title: "تم إضافة الفرع بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delBranch = useMutation({
    mutationFn: (id: number) => apiDel(`/api/branches/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); toast({ title: "تم الحذف" }); }
  });

  const addWarehouse = useMutation({
    mutationFn: () => apiPost("/api/warehouses", { branch_id: warehouseBranchId ? Number(warehouseBranchId) : null, name: warehouseName, location: warehouseLocation }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setWarehouseName(""); setWarehouseLocation(""); toast({ title: "تم إضافة المستودع بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delWarehouse = useMutation({
    mutationFn: (id: number) => apiDel(`/api/warehouses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); toast({ title: "تم الحذف" }); }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building className="w-6 h-6" />إدارة الفروع والمستودعات</h1>

        <Tabs defaultValue="branches">
          <TabsList>
            <TabsTrigger value="branches">الفروع</TabsTrigger>
            <TabsTrigger value="warehouses">المستودعات</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">إضافة فرع جديد</CardTitle></CardHeader>
              <CardContent className="flex gap-3">
                <Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="اسم الفرع" />
                <Input value={branchAddress} onChange={e => setBranchAddress(e.target.value)} placeholder="العنوان" />
                <Input value={branchPhone} onChange={e => setBranchPhone(e.target.value)} placeholder="الهاتف" />
                <Button onClick={() => addBranch.mutate()} disabled={!branchName.trim()} className="gap-1"><Plus className="w-4 h-4" />إضافة</Button>
              </CardContent>
            </Card>

            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold">اسم الفرع</th>
                    <th className="text-right p-3 font-semibold">العنوان</th>
                    <th className="text-right p-3 font-semibold">الهاتف</th>
                    <th className="p-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {((branches as any[]) || []).map(b => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{b.name}</td>
                      <td className="p-3 text-muted-foreground">{b.address ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{b.phone ?? "—"}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف الفرع؟") && delBranch.mutate(b.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))}
                  {branches.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد فروع مضافة</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="warehouses" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">إضافة مستودع جديد</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-4 gap-3">
                <Input value={warehouseName} onChange={e => setWarehouseName(e.target.value)} placeholder="اسم المستودع" />
                <select value={warehouseBranchId} onChange={e => setWarehouseBranchId(e.target.value)} className="border rounded-md px-3 bg-background text-sm">
                  <option value="">اختر الفرع التابع له</option>
                  {((branches as any[]) || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Input value={warehouseLocation} onChange={e => setWarehouseLocation(e.target.value)} placeholder="الموقع / الوصف" />
                <Button onClick={() => addWarehouse.mutate()} disabled={!warehouseName.trim()} className="gap-1"><Plus className="w-4 h-4" />إضافة مستودع</Button>
              </CardContent>
            </Card>

            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold">المستودع</th>
                    <th className="text-right p-3 font-semibold">الفرع التابع</th>
                    <th className="text-right p-3 font-semibold">الموقع</th>
                    <th className="p-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {((warehouses as any[]) || []).map(w => (
                    <tr key={w.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium flex items-center gap-2"><Warehouse className="w-4 h-4 text-primary" />{w.name}</td>
                      <td className="p-3 text-muted-foreground">{w.branch_name ?? "عام"}</td>
                      <td className="p-3 text-muted-foreground">{w.location ?? "—"}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف المستودع؟") && delWarehouse.mutate(w.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد مستودعات مضافة</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
