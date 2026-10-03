import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  RefreshCw,
  Plus,
  Search,
  Ticket,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

export default function TravelModificationsPage() {
  const { toast } = useToast();
  const [modifications, setModifications] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    booking_id: "",
    pnr: "",
    modification_type: "تغيير تاريخ الرحلة Date Change",
    old_flight_details: "",
    new_flight_details: "",
    fare_difference: "0",
    airline_reissue_fee: "50",
    office_modification_fee: "15",
    notes: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [modRes, bkRes] = await Promise.all([
        fetch("/api/travel/modifications"),
        fetch("/api/travel/bookings")
      ]);
      if (modRes.ok) setModifications(await modRes.json());
      if (bkRes.ok) setBookings(await bkRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectBooking = (bkId: string) => {
    const bk = bookings.find((b) => String(b.id) === bkId);
    if (bk) {
      setForm({
        ...form,
        booking_id: String(bk.id),
        pnr: bk.pnr || "",
        old_flight_details: `${bk.origin_city || ''} إلى ${bk.destination_city || ''} [تاريخ: ${bk.departure_date || 'غير محدد'}]`
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pnr) {
      toast({ title: "خطأ", description: "رمز الحجز PNR مطلوب", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch("/api/travel/modifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل تسجيل تعديل الحجز");
      }

      toast({ title: "تم بنجاح", description: "تم تحديث التعديل وإعادة إصدار التذكرة" });
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const fareDiff = Number(form.fare_difference || 0);
  const reissueFee = Number(form.airline_reissue_fee || 0);
  const officeFee = Number(form.office_modification_fee || 0);
  const totalCharge = fareDiff + reissueFee + officeFee;

  const filtered = modifications.filter(
    (m) =>
      (m.pnr || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.modification_type || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-7 h-7 text-sky-600" />
              تعديل وإعادة إصدار التذاكر Reissue & Modifications
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              تسجيل التعديلات على الرحلات، فروق الأسعار، رسوم إعادة الإصدار، والتحصيل التفصيلي من المسافرين
            </p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-semibold px-5 py-2.5 rounded-xl shadow-md"
          >
            <Plus className="w-5 h-5" />
            تعديل حجز / إعادة إصدار
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث بالرمز PNR، نوع التعديل، الملاحظات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 text-sm rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            إجمالي عمليات التعديل: {modifications.length}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">جاري تحميل سجل التعديلات...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">لا توجد عمليات تعديل مطابقة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-4">PNR</th>
                    <th className="p-4">نوع التعديل</th>
                    <th className="p-4">تفاصيل خط السير الجديد</th>
                    <th className="p-4">فرق الدرجة</th>
                    <th className="p-4">رسوم إعادة الإصدار</th>
                    <th className="p-4">رسوم المكتب</th>
                    <th className="p-4">إجمالي المبلغ المحصل</th>
                    <th className="p-4">الموظف المسؤول</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-sky-800">{m.pnr || "—"}</td>

                      <td className="p-4 font-semibold text-slate-900">{m.modification_type}</td>

                      <td className="p-4 text-xs text-slate-600 max-w-xs">
                        {m.new_flight_details || m.old_flight_details || "—"}
                      </td>

                      <td className="p-4 font-mono text-slate-700">${m.fare_difference || 0}</td>

                      <td className="p-4 font-mono text-slate-700">${m.airline_reissue_fee || 0}</td>

                      <td className="p-4 font-mono text-slate-700">${m.office_modification_fee || 0}</td>

                      <td className="p-4 font-mono font-bold text-emerald-700 bg-emerald-50/50">
                        ${m.total_additional_charge_to_customer || 0}
                      </td>

                      <td className="p-4 text-xs text-slate-500">{m.user_name || "النظام"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-sky-600" />
                تعديل رحلة أو تاريخ / إعادة إصدار التذكرة Reissue
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اختر الحجز المراد تعديله</label>
                <select
                  value={form.booking_id}
                  onChange={(e) => handleSelectBooking(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- اختر الحجز من القائمة --</option>
                  {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.pnr || "بدون PNR"} | {b.passenger_name_ar || b.customer_name} | {b.origin_city} إلى {b.destination_city}
                      </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رمز الحجز PNR *</label>
                  <Input
                    placeholder="PNR Code"
                    value={form.pnr}
                    onChange={(e) => setForm({ ...form, pnr: e.target.value.toUpperCase() })}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نوع التعديل *</label>
                  <select
                    value={form.modification_type}
                    onChange={(e) => setForm({ ...form, modification_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="تغيير تاريخ الرحلة Date Change">تغيير تاريخ الرحلة Date Change</option>
                    <option value="تغيير مسار الرحلة Route Change">تغيير مسار الرحلة Route Change</option>
                    <option value="تعديل اسم المسافر Name Modification">تعديل اسم المسافر Name Modification</option>
                    <option value="ترقية الدرجة Upgradation">ترقية الدرجة Upgradation</option>
                    <option value="إضافة أمتعة إضافية Extra Baggage">إضافة أمتعة إضافية Extra Baggage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تفاصيل خط السير الجديد والتاريخ المعدل</label>
                <Input
                  placeholder="مثال: جدة إلى القاهرة - المغادرة 25 أغسطس الساعة 10:00 صباحاً"
                  value={form.new_flight_details}
                  onChange={(e) => setForm({ ...form, new_flight_details: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">فرق الدرجة / Fare Diff</label>
                  <Input
                    type="number"
                    value={form.fare_difference}
                    onChange={(e) => setForm({ ...form, fare_difference: e.target.value })}
                    className="rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">غرامة إعادة الإصدار</label>
                  <Input
                    type="number"
                    value={form.airline_reissue_fee}
                    onChange={(e) => setForm({ ...form, airline_reissue_fee: e.target.value })}
                    className="rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رسوم خدمات المكتب</label>
                  <Input
                    type="number"
                    value={form.office_modification_fee}
                    onChange={(e) => setForm({ ...form, office_modification_fee: e.target.value })}
                    className="rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-sky-800 font-semibold block">إجمالي المبلغ المحصل الإضافي من العميل:</span>
                  <span className="text-2xl font-black text-sky-950 font-mono mt-0.5 block">
                    ${totalCharge}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات التعديل</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات توضيحية لعملية إعادة الإصدار..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold">
                  حفظ وتحديث الحجز
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
