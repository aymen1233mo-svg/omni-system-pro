import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Plane,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  Percent,
  FileText,
  Edit2,
  Trash2,
  Globe2,
  CheckCircle2,
  XCircle
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

export default function TravelAirlinesPage() {
  const { toast } = useToast();
  const [airlines, setAirlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    iata_code: "",
    icao_code: "",
    country: "",
    phone: "",
    email: "",
    agent_name: "",
    default_commission_percent: "5",
    booking_conditions: "",
    notes: ""
  });

  const fetchAirlines = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/travel/airlines");
      if (res.ok) setAirlines(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirlines();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name_ar: "",
      name_en: "",
      iata_code: "",
      icao_code: "",
      country: "",
      phone: "",
      email: "",
      agent_name: "",
      default_commission_percent: "5",
      booking_conditions: "",
      notes: ""
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      name_ar: a.name_ar || "",
      name_en: a.name_en || "",
      iata_code: a.iata_code || "",
      icao_code: a.icao_code || "",
      country: a.country || "",
      phone: a.phone || "",
      email: a.email || "",
      agent_name: a.agent_name || "",
      default_commission_percent: String(a.default_commission_percent || 0),
      booking_conditions: a.booking_conditions || "",
      notes: a.notes || ""
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar || !form.iata_code) {
      toast({ title: "خطأ", description: "اسم الناقل وكود IATA مطلوبان", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("pos_token");
      const url = editingId ? `/api/travel/airlines/${editingId}` : "/api/travel/airlines";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ شركة الطيران");
      }

      toast({ title: "تم الحفظ", description: "تم تحديث دليل شركات الطيران" });
      setModalOpen(false);
      fetchAirlines();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف شركة الطيران؟")) return;
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch(`/api/travel/airlines/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "تم الحذف", description: "تم مسح الشركة" });
        fetchAirlines();
      }
    } catch (e) {}
  };

  const filtered = airlines.filter(
    (a) =>
      (a.name_ar || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.name_en || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.iata_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.country || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Plane className="w-7 h-7 text-sky-600" />
              دليل شركات الطيران والناقلين الجويين
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              قاعدة بيانات شركات الطيران، أكواد IATA/ICAO، نسب العمولات، وشروط وإجراءات الإصدار
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-semibold px-5 py-2.5 rounded-xl shadow-md"
          >
            <Plus className="w-5 h-5" />
            إضافة شركة طيران
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث بالاسم، كود IATA، الدولة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 text-sm rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            إجمالي الشركات: {airlines.length}
          </span>
        </div>

        {/* Airlines Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">جاري تحميل الشركات...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">لا توجد نتائج مطابقة</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {a.name_ar}
                        <span className="text-xs px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-mono font-bold">
                          {a.iata_code}
                        </span>
                      </h3>
                      {a.name_en && <p className="text-xs text-slate-400 mt-0.5">{a.name_en}</p>}
                    </div>
                    {a.country && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1 shrink-0">
                        <Globe2 className="w-3 h-3 text-slate-500" />
                        {a.country}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نسبة عمولة المبيعات:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        %{a.default_commission_percent || 0}
                      </span>
                    </div>

                    {a.agent_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">اسم الوكيل / المورد:</span>
                        <span className="font-medium text-slate-800">{a.agent_name}</span>
                      </div>
                    )}

                    {a.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">رقم الهاتف:</span>
                        <span className="font-mono text-slate-800">{a.phone}</span>
                      </div>
                    )}

                    {a.booking_conditions && (
                      <div className="pt-2 border-t mt-2">
                        <span className="text-slate-400 block mb-1">شروط الإصدار والتغيير:</span>
                        <p className="text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {a.booking_conditions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(a)}
                    className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 gap-1 rounded-xl"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(a.id)}
                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 gap-1 rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plane className="w-5 h-5 text-sky-600" />
                {editingId ? "تعديل بيانات شركة الطيران" : "إضافة شركة طيران جديدة"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم بالعربية *</label>
                  <Input
                    placeholder="مثال: الخطوط السعودية"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                  <Input
                    placeholder="Saudia"
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كود IATA (حرفين) *</label>
                  <Input
                    placeholder="SV"
                    maxLength={3}
                    value={form.iata_code}
                    onChange={(e) => setForm({ ...form, iata_code: e.target.value.toUpperCase() })}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كود ICAO (3 أحرف)</label>
                  <Input
                    placeholder="SVA"
                    maxLength={4}
                    value={form.icao_code}
                    onChange={(e) => setForm({ ...form, icao_code: e.target.value.toUpperCase() })}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نسبة العمولة (%)</label>
                  <Input
                    type="number"
                    value={form.default_commission_percent}
                    onChange={(e) => setForm({ ...form, default_commission_percent: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الدولة</label>
                  <Input
                    placeholder="السعودية"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الوكيل المعتمد</label>
                  <Input
                    placeholder="وكيل GDS أو مكتب المبيعات"
                    value={form.agent_name}
                    onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الهاتف</label>
                  <Input
                    placeholder="011xxxxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    placeholder="sales@airline.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">شروط وسسياسات الإصدار والتغيير والترجيع</label>
                <textarea
                  rows={2}
                  value={form.booking_conditions}
                  onChange={(e) => setForm({ ...form, booking_conditions: e.target.value })}
                  placeholder="سياسات الأمتعة، رسوم إلغاء التذاكر، مدة الاسترجاع..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                  حفظ البيانات
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
