import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Search, Edit2, Trash2, Printer, CheckCircle2, AlertCircle, RefreshCw, XCircle, DollarSign, Plane, Send } from "lucide-react";
import { FlightBookingFullscreenDialog } from "@/components/travel/flight-booking-fullscreen-dialog";

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

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  confirmed: { label: "مؤكد", class: "bg-blue-100 text-blue-800 border-blue-200" },
  issued: { label: "مصدرة", class: "bg-green-100 text-green-800 border-green-200" },
  pending_issue: { label: "بانتظار الإصدار", class: "bg-amber-100 text-amber-800 border-amber-200" },
  cancelled: { label: "ملغاة", class: "bg-red-100 text-red-800 border-red-200" },
  refunded: { label: "مسترجعة", class: "bg-purple-100 text-purple-800 border-purple-200" },
  reissued: { label: "معاد إصدارها", class: "bg-indigo-100 text-indigo-800 border-indigo-200" }
};

export default function TravelBookingsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [voucherModalBooking, setVoucherModalBooking] = useState<any | null>(null);

  const [form, setForm] = useState({
    booking_number: "",
    service_type: "flight",
    customer_id: "",
    passenger_id: "",
    airline_supplier: "",
    supplier_id: "",
    flight_number: "",
    origin_city: "",
    destination_city: "",
    departure_date: "",
    return_date: "",
    ticket_number: "",
    pnr: "",
    status: "confirmed",
    issue_date: new Date().toISOString().slice(0, 10),
    cost_price: "0",
    supplier_currency: "SAR",
    supplier_statement: "قيمة تذكرة طيران",
    selling_price: "0",
    customer_currency: "SAR",
    customer_statement: "قيمة تذكرة طيران",
    agency_commission: "0",
    commission_currency: "SAR",
    payment_status: "paid",
    payment_method: "cash",
    notes: ""
  });

  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-bookings", search, statusFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (statusFilter) q.set("status", statusFilter);
      return fetchWithAuth(`/api/travel/bookings?${q.toString()}`);
    }
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list"],
    queryFn: () => fetchWithAuth("/api/travel/passengers")
  });

  const { data: airlines = [] } = useQuery<any[]>({
    queryKey: ["travel-airlines-list"],
    queryFn: () => fetchWithAuth("/api/travel/sub-accounts/21100")
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const targetId = editingBooking?.id || (data.booking_number && bookings.find((b: any) => b.booking_number === data.booking_number)?.id);
      if (targetId) {
        return fetchWithAuth(`/api/travel/bookings/${targetId}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/travel/bookings", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
      setModalOpen(false);
      setEditingBooking(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/travel/bookings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
    }
  });

  const resetForm = () => {
    setEditingBooking(null);
    setForm({
      booking_number: `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      service_type: "flight",
      customer_id: "",
      passenger_id: "",
      airline_supplier: "",
      supplier_id: "",
      flight_number: "",
      origin_city: "",
      destination_city: "",
      departure_date: "",
      return_date: "",
      ticket_number: "",
      pnr: "",
      status: "confirmed",
      issue_date: new Date().toISOString().slice(0, 10),
      cost_price: "0",
      supplier_currency: "SAR",
      supplier_statement: "قيمة تذكرة طيران",
      selling_price: "0",
      customer_currency: "SAR",
      customer_statement: "قيمة تذكرة طيران",
      agency_commission: "0",
      commission_currency: "SAR",
      payment_status: "paid",
      payment_method: "cash",
      notes: ""
    });
  };

  const handleEdit = (bk: any) => {
    setEditingBooking(bk);
    setForm({
      booking_number: bk.booking_number || "",
      service_type: bk.service_type || "flight",
      customer_id: bk.customer_id ? String(bk.customer_id) : "",
      passenger_id: bk.passenger_id ? String(bk.passenger_id) : "",
      airline_supplier: bk.airline_supplier || "",
      supplier_id: bk.supplier_id ? String(bk.supplier_id) : "",
      flight_number: bk.flight_number || "",
      origin_city: bk.origin_city || "",
      destination_city: bk.destination_city || "",
      departure_date: bk.departure_date || "",
      return_date: bk.return_date || "",
      ticket_number: bk.ticket_number || "",
      pnr: bk.pnr || "",
      status: bk.status || "confirmed",
      issue_date: bk.issue_date || new Date().toISOString().slice(0, 10),
      cost_price: String(bk.cost_price || 0),
      supplier_currency: bk.supplier_currency || "SAR",
      supplier_statement: bk.supplier_statement || "قيمة تذكرة طيران",
      selling_price: String(bk.selling_price || 0),
      customer_currency: bk.customer_currency || "SAR",
      customer_statement: bk.customer_statement || "قيمة تذكرة طيران",
      agency_commission: String(bk.agency_commission || 0),
      commission_currency: bk.commission_currency || "SAR",
      payment_status: bk.payment_status || "paid",
      payment_method: bk.payment_method || "cash",
      notes: bk.notes || ""
    });
    setModalOpen(true);
  };

  const changeStatus = (bk: any, newStatus: string) => {
    fetchWithAuth(`/api/travel/bookings/${bk.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...bk, status: newStatus })
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["travel-bookings"] });
    });
  };

  const costVal = Number(form.cost_price || 0);
  const sellVal = Number(form.selling_price || 0);
  const commVal = sellVal - costVal;

  return (
    <AdminLayout>
      <div className="space-y-6 pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Ticket className="w-7 h-7 text-primary" />
              حجوزات وإصدار تذاكر الطيران (Flight Bookings)
            </h1>
            <p className="text-sm text-muted-foreground">
              إدارة التذاكر، إدخال الـ PNR، حساب عمولة المكتب تلقائياً وإصدار قسيمة السفر للعميل
            </p>
          </div>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 gap-2 font-bold">
            <Plus className="w-4 h-4" /> حجز تذكرة طيران جديدة
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="ابحث برقم التذكرة، الـ PNR، اسم العميل أو المسافر..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-48"
            >
              <option value="">جميع الحالات</option>
              <option value="confirmed">مؤكد</option>
              <option value="issued">مصدرة</option>
              <option value="pending_issue">بانتظار الإصدار</option>
              <option value="cancelled">ملغاة</option>
              <option value="refunded">مسترجعة</option>
              <option value="reissued">معاد إصدارها</option>
            </select>
          </div>
        </Card>

        {/* Bookings Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">جدول التذاكر والحجوزات ({bookings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل الحجوزات...</div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد حجوزات مطابقة للبحث</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">رقم الحجز/PNR</th>
                      <th className="p-3">العميل / المسافر</th>
                      <th className="p-3">شركة الطيران / الرحلة</th>
                      <th className="p-3">المسار (من - إلى)</th>
                      <th className="p-3">رقم التذكرة</th>
                      <th className="p-3">التكلفة / سعر البيع</th>
                      <th className="p-3">عمولة المكتب</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((bk, idx) => {
                      const badge = STATUS_BADGES[bk.status] || { label: bk.status, class: "bg-slate-100" };
                      return (
                        <tr key={`bk-${bk.id || idx}-${idx}`} onClick={() => setSelectedBooking(bk)} className={`border-b hover:bg-slate-50 transition-colors cursor-pointer ${selectedBooking?.id === bk.id ? "bg-blue-50/50 ring-1 ring-inset ring-blue-300" : ""}`}>
                          <td className="p-3">
                            <div className="font-bold font-mono text-primary">{bk.booking_number}</div>
                            {bk.pnr && (
                              <div className="text-xs font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded inline-block font-semibold">
                                PNR: {bk.pnr}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{bk.customer_name || "عميل عام"}</div>
                            <div className="text-xs text-muted-foreground">👤 {bk.passenger_name_ar || bk.passenger_name_en || "نفس العميل"}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="font-semibold text-slate-800">{bk.airline_supplier || "غير محدد"}</div>
                            <div className="font-mono text-muted-foreground">{bk.flight_number || "-"}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className="font-bold">{bk.origin_city || "-"} ⬅️ {bk.destination_city || "-"}</div>
                            <div className="text-[11px] text-muted-foreground">📅 المغادرة: {bk.departure_date || "-"}</div>
                          </td>
                          <td className="p-3 font-mono text-xs font-semibold">
                            {bk.ticket_number || "-"}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div className="text-muted-foreground">شراء: {Number(bk.cost_price || 0).toLocaleString()}</div>
                            <div className="font-bold text-slate-900">بيع: {Number(bk.selling_price || 0).toLocaleString()}</div>
                          </td>
                          <td className="p-3 font-mono text-xs font-bold text-emerald-700 bg-emerald-50/50">
                            +{Number(bk.commission || 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-700 hover:bg-slate-100" title="طباعة الفاتورة / القسيمة" onClick={() => setVoucherModalBooking(bk)}>
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="تعديل الحجز" onClick={() => handleEdit(bk)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {bk.status !== "issued" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="تأكيد وإصدار التذكرة" onClick={() => changeStatus(bk, "issued")}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                title="حذف الحجز"
                                onClick={() => {
                                  if (confirm(`هل أنت تأكد من حذف الحجز "${bk.booking_number}"؟`)) {
                                    deleteMutation.mutate(bk.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

        {/* Full-Screen Flight Booking Window */}
        <FlightBookingFullscreenDialog
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingBooking(null);
          }}
          booking={editingBooking}
          bookingsList={bookings}
          customers={customers}
          passengers={passengers}
          airlines={airlines}
          onSave={(data) => saveMutation.mutateAsync(data)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onPrintVoucher={(bk) => setVoucherModalBooking(bk)}
          isSaving={saveMutation.isPending}
          onCustomerAdded={() => qc.invalidateQueries({ queryKey: ["customers-list"] })}
        />

        {/* Voucher / Invoice Print Dialog */}
        <Dialog open={Boolean(voucherModalBooking)} onOpenChange={open => !open && setVoucherModalBooking(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>قسيمة حجز تذكرة طيران (Flight Ticket Voucher)</DialogTitle>
              <DialogDescription>معاينة قسيمة السفر الجاهزة للطباعة أو الإرسال للعميل عبر الواتساب</DialogDescription>
            </DialogHeader>

            {voucherModalBooking && (
              <div className="space-y-4 border p-4 rounded-lg bg-slate-50 text-slate-900" id="print-area">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-primary">شركة أومني لسفريات والسياحة</h2>
                    <p className="text-xs text-muted-foreground">تأكيد حجز وتذكرة طيران إلكترونية</p>
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-xs font-bold">رقم الحجز: {voucherModalBooking.booking_number}</p>
                    <p className="text-xs text-muted-foreground">PNR: {voucherModalBooking.pnr || "N/A"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="font-bold">العميل:</span> {voucherModalBooking.customer_name}</div>
                  <div><span className="font-bold">المسافر:</span> {voucherModalBooking.passenger_name_ar || voucherModalBooking.passenger_name_en || "نفس العميل"}</div>
                  <div><span className="font-bold">شركة الطيران:</span> {voucherModalBooking.airline_supplier}</div>
                  <div><span className="font-bold">رقم الرحلة:</span> {voucherModalBooking.flight_number || "-"}</div>
                  <div><span className="font-bold">من:</span> {voucherModalBooking.origin_city}</div>
                  <div><span className="font-bold">إلى:</span> {voucherModalBooking.destination_city}</div>
                  <div><span className="font-bold">تاريخ المغادرة:</span> {voucherModalBooking.departure_date}</div>
                  <div><span className="font-bold">رقم التذكرة:</span> {voucherModalBooking.ticket_number || "-"}</div>
                </div>

                <div className="border-t pt-2 flex items-center justify-between font-bold text-sm">
                  <span>إجمالي المبلغ المطلوب:</span>
                  <span className="text-primary font-mono">{Number(voucherModalBooking.selling_price || 0).toLocaleString()} ريال</span>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setVoucherModalBooking(null)}>إغلاق</Button>
              <Button onClick={() => window.print()} className="bg-primary hover:bg-primary/90 font-bold gap-2">
                <Printer className="w-4 h-4" /> طباعة القسيمة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        
      </div>

        {/* BOTTOM ACTION BAR */}
        <div className="fixed bottom-0 right-0 left-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] p-4 z-40">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">المعاملة المحددة حالياً:</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {selectedBooking ? `${selectedBooking.booking_number} - (${selectedBooking.passenger_name || selectedBooking.customer_name})` : "لم يتم تحديد معاملة"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                id="btn-bottom-add"
                onClick={() => { resetForm(); setModalOpen(true); }}
                className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 px-5 shadow-md shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                حجز جديد
              </Button>

              <Button
                id="btn-bottom-edit"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && handleEdit(selectedBooking)}
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-50 font-bold gap-2"
              >
                <Edit2 className="w-4 h-4" />
                تعديل ✏️
              </Button>
              
              <Button
                id="btn-bottom-search"
                onClick={() => document.getElementById("search-flight-bookings")?.focus()}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50 font-bold gap-2"
              >
                <Search className="w-4 h-4" />
                بحث 🔍
              </Button>

              <Button
                id="btn-bottom-print"
                disabled={!selectedBooking}
                onClick={() => selectedBooking && setVoucherModalBooking(selectedBooking)}
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold gap-2"
              >
                <Printer className="w-4 h-4" />
                طباعة القسيمة 🖨️
              </Button>

              <Button
                id="btn-bottom-delete"
                disabled={!selectedBooking}
                onClick={() => {
                  if (selectedBooking && confirm(`هل أنت متأكد من حذف الحجز "${selectedBooking.booking_number}"؟`)) {
                    deleteMutation.mutate(selectedBooking.id);
                    setSelectedBooking(null);
                  }
                }}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 font-bold gap-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف 🗑️
              </Button>
            </div>
          </div>
        </div>

    </AdminLayout>
  );
}
