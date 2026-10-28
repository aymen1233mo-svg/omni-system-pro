import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Search, Filter, Eye, FileText, UserCheck, ShieldAlert, ArrowLeftRight, Check, X
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

const TYPE_NAMES: Record<string, string> = {
  ticket_refund: "استرجاع تذكرة طيران",
  hotel_cancellation: "إلغاء حجز فندقي",
  invoice_void: "إلغاء فاتورة معتمدة",
  price_override: "تجاوز السعر بأقل من التكلفة",
  credit_limit_exceed: "تجاوز الحد الائتماني للعميل",
  ticket_reissue: "إعادة إصدار تذكرة مع غرامة"
};

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  pending: { label: "قيد المراجعة والانتظار", class: "bg-amber-100 text-amber-800 border-amber-300" },
  approved: { label: "تمت الموافقة والاعتماد", class: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected: { label: "مرفوض", class: "bg-red-100 text-red-800 border-red-300" }
};

export default function TravelApprovalsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeModal, setActiveModal] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: approvals = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-approvals", statusFilter, typeFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (typeFilter) q.set("type", typeFilter);
      return fetchWithAuth(`/api/travel/approvals?${q.toString()}`);
    }
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: "approved" | "rejected"; note: string }) => {
      return fetchWithAuth(`/api/travel/approvals/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status, note })
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-approvals"] });
      setActiveModal(null);
      setReviewNote("");
    }
  });

  const filteredApprovals = approvals.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (item.request_code && item.request_code.toLowerCase().includes(s)) ||
      (item.requested_by_name && item.requested_by_name.toLowerCase().includes(s)) ||
      (item.reason && item.reason.toLowerCase().includes(s))
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <ShieldCheck className="w-7 h-7 text-primary" />
              نظام الموافقات وسلسلة الاعتمادات (Approval Workflow & Exceptions)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة واعتماد العمليات الحساسة (استرجاع المبالغ، بيع بأقل من التكلفة، إلغاء الفواتير وتجاوز الائتمان)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-full font-bold">
              صلاحية مدير النظام والمشرفين
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم الطلب، اسم الموظف أو السبب..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">جميع الحالات</option>
              <option value="pending">قيد المراجعة (Pending)</option>
              <option value="approved">تمت الموافقة (Approved)</option>
              <option value="rejected">المرفوضة (Rejected)</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">جميع أنواع الطلبات</option>
              <option value="ticket_refund">استرجاع تذكرة طيران</option>
              <option value="hotel_cancellation">إلغاء حجز فندقي</option>
              <option value="price_override">بيع بأقل من التكلفة</option>
              <option value="credit_limit_exceed">تجاوز الحد الائتماني</option>
              <option value="invoice_void">إلغاء فاتورة معتمدة</option>
            </select>
          </div>
        </Card>

        {/* Approvals Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">طلبات الاعتماد المعلقة والمؤرشفة ({filteredApprovals.length})</CardTitle>
            <CardDescription>عرض تفاصيل الاستثناء والتحقق من المبررات قبل اتخاذ قرار القبول أو الرفض</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل طلبات الموافقة...</div>
            ) : filteredApprovals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد طلبات موافقة مطابقة للمعايير المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold text-xs">
                      <th className="p-3">رقم الطلب</th>
                      <th className="p-3">نوع العملية الحساسة</th>
                      <th className="p-3">الموظف الطالب</th>
                      <th className="p-3">المبلغ المالي المعني</th>
                      <th className="p-3">السبب / المبرر</th>
                      <th className="p-3">تاريخ الطلب</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApprovals.map((app) => {
                      const badge = STATUS_BADGES[app.status] || { label: app.status, class: "bg-slate-100" };
                      return (
                        <tr key={app.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-primary text-xs">
                            {app.request_code || `REQ-${app.id}`}
                          </td>
                          <td className="p-3 font-bold text-slate-900 text-xs">
                            {TYPE_NAMES[app.approval_type] || app.approval_type}
                          </td>
                          <td className="p-3 text-xs">
                            <div className="font-semibold text-slate-800">{app.requested_by_name || "موظف مبيعات"}</div>
                          </td>
                          <td className="p-3 font-mono text-xs font-bold">
                            {Number(app.amount || 0) > 0 ? (
                              <span className="text-blue-700">{Number(app.amount).toLocaleString()} ريال</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-slate-600 max-w-xs truncate">
                            {app.reason || "لا يوجد مبرر مسجل"}
                          </td>
                          <td className="p-3 text-xs font-mono text-muted-foreground">
                            {app.created_at ? app.created_at.slice(0, 10) : "اليوم"}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveModal(app);
                                setReviewNote("");
                              }}
                              className="text-xs font-bold gap-1.5 h-8"
                            >
                              <Eye className="w-3.5 h-3.5" /> فحص واتخاذ قرار
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={Boolean(activeModal)} onOpenChange={o => !o && setActiveModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                مراجعة طلب اعتماد: {activeModal && (TYPE_NAMES[activeModal.approval_type] || activeModal.approval_type)}
              </DialogTitle>
              <DialogDescription>
                التحقق من بيانات المعاملة وأخذ الإجراء الإداري المحاسبي
              </DialogDescription>
            </DialogHeader>

            {activeModal && (
              <div className="space-y-4 text-sm py-2">
                <div className="bg-slate-50 border rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الموظف مقدم الطلب:</span>
                    <span className="font-bold">{activeModal.requested_by_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ المالي المعني:</span>
                    <span className="font-mono font-bold text-blue-700">{Number(activeModal.amount || 0).toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">حالة الطلب الحالية:</span>
                    <span className="font-bold">{STATUS_BADGES[activeModal.status]?.label || activeModal.status}</span>
                  </div>
                  <div className="border-t pt-2">
                    <span className="text-muted-foreground block mb-1">سبب ومبرر الاستثناء:</span>
                    <p className="font-medium text-slate-800 bg-white p-2.5 rounded border leading-relaxed">
                      {activeModal.reason || "لم يذكر سبب تفصيلي"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ملاحظات وقرار المشرف / المدير المعتمد:</label>
                  <Input
                    placeholder="اكتب سبب القبول أو الرفض ليتم تسجيله في سجل التدقيق..."
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex sm:justify-between gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setActiveModal(null)}
                className="font-bold text-xs"
              >
                إغلاق
              </Button>

              {activeModal?.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      reviewMutation.mutate({ id: activeModal.id, status: "rejected", note: reviewNote });
                    }}
                    disabled={reviewMutation.isPending}
                    className="font-bold text-xs gap-1.5"
                  >
                    <X className="w-4 h-4" /> رفض الطلب
                  </Button>
                  <Button
                    onClick={() => {
                      reviewMutation.mutate({ id: activeModal.id, status: "approved", note: reviewNote });
                    }}
                    disabled={reviewMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                  >
                    <Check className="w-4 h-4" /> اعتماد وموافقة
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
