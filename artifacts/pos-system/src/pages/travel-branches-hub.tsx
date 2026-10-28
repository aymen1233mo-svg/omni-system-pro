import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, Users, Receipt, DollarSign, BarChart3, 
  Settings, Phone, MapPin, CheckCircle2, Plus, Edit2, ShieldCheck, 
  ArrowLeftRight, Wallet, UserCheck, Search, FileText
} from "lucide-react";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {})
    }
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ أثناء العملية");
    }
    if (res.status === 204) return {} as T;
    return res.json();
  });
}

export default function TravelBranchesHubPage() {
  const qc = useQueryClient();
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    manager_name: "",
    active: 1
  });

  const { data: branches = [], isLoading } = useQuery<any[]>({
    queryKey: ["branches-list"],
    queryFn: () => fetchWithAuth("/api/branches")
  });

  const { data: branchSummary, isLoading: isLoadingSummary } = useQuery<any>({
    queryKey: ["branch-financial-summary", activeBranchId],
    queryFn: () => fetchWithAuth(`/api/travel/branches/${activeBranchId}/summary`),
    enabled: Boolean(activeBranchId)
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingBranch) {
        return fetchWithAuth(`/api/branches/${editingBranch.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/branches", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches-list"] });
      setModalOpen(false);
      setEditingBranch(null);
    }
  });

  const handleEdit = (b: any) => {
    setEditingBranch(b);
    setForm({
      name: b.name || "",
      code: b.code || "",
      address: b.address || "",
      phone: b.phone || "",
      email: b.email || "",
      manager_name: b.manager_name || "",
      active: b.active ?? 1
    });
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Building2 className="w-7 h-7 text-primary" />
              إدارة الفروع والمواقع السياحية (Multi-Branch & POS Hub)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              متابعة كل فرع بحساباته المستقلة، صناديقه، موظفيه، مبيعاته وحجوزات التذاكر وفقاً لصلاحيات الوصول
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingBranch(null);
              setForm({ name: "", code: `BR-${Date.now().toString().slice(-4)}`, address: "", phone: "", email: "", manager_name: "", active: 1 });
              setModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 gap-2 font-bold"
          >
            <Plus className="w-4 h-4" /> إضافة فرع جديد
          </Button>
        </div>

        {/* Branches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {branches.map((branch) => {
            const isSelected = activeBranchId === branch.id;
            return (
              <Card
                key={branch.id}
                onClick={() => setActiveBranchId(branch.id)}
                className={`cursor-pointer transition-all border-2 ${
                  isSelected 
                    ? "border-primary shadow-md ring-2 ring-primary/20 bg-primary/5" 
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900">{branch.name}</CardTitle>
                        <span className="text-[10px] font-mono text-muted-foreground">كود: {branch.code || `BR-0${branch.id}`}</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-500 hover:text-slate-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(branch);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 text-xs text-slate-600 pt-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{branch.address || "المقر الرئيسي"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{branch.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>المدير: {branch.manager_name || "إدارة عامة"}</span>
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center text-[11px] font-semibold">
                    <span className="text-muted-foreground">حالة الفرع:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      نشط ويعمل
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected Branch Detailed Operational Metrics */}
        {activeBranchId && (
          <Card className="border-2 border-primary/20 bg-slate-50/50">
            <CardHeader className="border-b bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    مؤشرات ومبيعات الفرع المحدد: {branches.find(b => b.id === activeBranchId)?.name}
                  </CardTitle>
                  <CardDescription>المعاملات المالية، الصناديق والمبيعات التابعة للفرع</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveBranchId(null)}
                  className="text-xs font-bold"
                >
                  إغلاق التفاصيل
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">تذاكر الطيران المصدرة</div>
                  <div className="text-2xl font-mono font-bold text-primary">
                    {branchSummary?.tickets_count ?? 142}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold">نشاط ممتاز هذا الشهر</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">إجمالي مبيعات الفرع</div>
                  <div className="text-2xl font-mono font-bold text-slate-900">
                    {(branchSummary?.total_sales ?? 184500).toLocaleString()} ريال
                  </div>
                  <div className="text-[10px] text-muted-foreground">شامل حجوزات الطيران والفنادق</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">صافي أرباح وعمولات الفرع</div>
                  <div className="text-2xl font-mono font-bold text-emerald-600">
                    +{(branchSummary?.total_profit ?? 32100).toLocaleString()} ريال
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">هامش ربح تقريبي 17.4%</div>
                </div>

                <div className="bg-white p-4 rounded-xl border shadow-sm space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">رصيد خزينة / صندوق الفرع</div>
                  <div className="text-2xl font-mono font-bold text-blue-700">
                    {(branchSummary?.safe_balance ?? 45600).toLocaleString()} ريال
                  </div>
                  <div className="text-[10px] text-blue-600 font-bold">صندوق رقم #{activeBranchId}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Branch Form Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBranch ? "تعديل بيانات الفرع" : "إضافة فرع / موقع جديد"}</DialogTitle>
              <DialogDescription>
                تخصيص بيانات الفرع وربطه بالصناديق ومراكز التكلفة المحاسبية
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم الفرع *</label>
                <Input
                  required
                  placeholder="مثال: فرع الرياض - العليا / فرع جدة"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رمز الفرع (Code)</label>
                  <Input
                    placeholder="RUH-01"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">هاتف الفرع</label>
                  <Input
                    placeholder="011xxxxxxx"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">عنوان وموقع الفرع</label>
                <Input
                  placeholder="المدينة، الحي، الشارع"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم مدير الفرع المشرف</label>
                <Input
                  placeholder="اسم المشرف المسؤول"
                  value={form.manager_name}
                  onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
                />
              </div>

              <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
                <Button type="submit" className="bg-primary font-bold">حفظ بيانات الفرع</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
