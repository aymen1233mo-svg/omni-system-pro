import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Hotel,
  Plus,
  Search,
  Star,
  MapPin,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Building2,
  Globe2
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

export default function TravelHotelsDbPage() {
  const { toast } = useToast();
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    country: "",
    city: "",
    star_rating: "5",
    address: "",
    phone: "",
    email: "",
    supplier_name: "",
    default_commission_percent: "10",
    notes: ""
  });

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/travel/hotels-db");
      if (res.ok) setHotels(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      name_ar: "",
      name_en: "",
      country: "",
      city: "",
      star_rating: "5",
      address: "",
      phone: "",
      email: "",
      supplier_name: "",
      default_commission_percent: "10",
      notes: ""
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (h: any) => {
    setEditingId(h.id);
    setForm({
      name_ar: h.name_ar || "",
      name_en: h.name_en || "",
      country: h.country || "",
      city: h.city || "",
      star_rating: String(h.star_rating || 5),
      address: h.address || "",
      phone: h.phone || "",
      email: h.email || "",
      supplier_name: h.supplier_name || "",
      default_commission_percent: String(h.default_commission_percent || 10),
      notes: h.notes || ""
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar || !form.country || !form.city) {
      toast({ title: "خطأ", description: "اسم الفندق والدولة والمدينة مطلوبة", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("pos_token");
      const url = editingId ? `/api/travel/hotels-db/${editingId}` : "/api/travel/hotels-db";
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
        throw new Error(err.error || "فشل حفظ الفندق");
      }

      toast({ title: "تم الحفظ", description: "تم تحديث دليل الفنادق" });
      setModalOpen(false);
      fetchHotels();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const filtered = hotels.filter(
    (h) =>
      (h.name_ar || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.name_en || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.city || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.country || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Hotel className="w-7 h-7 text-amber-600" />
              دليل الفنادق وأماكن الإقامة Catalog
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              قاعدة بيانات الفنادق الشريكة، تقييم النجوم، العناوين، ونسب العمولة المعتمدة مع الموردين
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold px-5 py-2.5 rounded-xl shadow-md"
          >
            <Plus className="w-5 h-5" />
            إضافة فندق جديد
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث باسم الفندق، المدينة، الدولة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 text-sm rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            إجمالي الفنادق المسجلة: {hotels.length}
          </span>
        </div>

        {/* Hotels Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">جاري تحميل الفنادق...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">لا توجد فنادق مطابقة للبحث</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {h.name_ar}
                      </h3>
                      {h.name_en && <p className="text-xs text-slate-400 mt-0.5">{h.name_en}</p>}
                    </div>

                    <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200/50 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {h.star_rating} نجوم
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{h.city} - {h.country}</span>
                    </div>

                    {h.address && (
                      <p className="text-slate-500 text-xs pr-5">{h.address}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <span className="text-slate-400">العمولة المعتمدة:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        %{h.default_commission_percent || 0}
                      </span>
                    </div>

                    {h.supplier_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">المورد / الوسيط:</span>
                        <span className="font-medium text-slate-800">{h.supplier_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(h)}
                    className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 gap-1 rounded-xl"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Hotel className="w-5 h-5 text-amber-600" />
                {editingId ? "تعديل بيانات الفندق" : "إضافة فندق جديد للدليل"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الفندق بالعربية *</label>
                  <Input
                    placeholder="فندق مكة هيلتون"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الفندق بالإنجليزية</label>
                  <Input
                    placeholder="Makkah Hilton"
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الدولة *</label>
                  <Input
                    placeholder="السعودية"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المدينة *</label>
                  <Input
                    placeholder="مكة المكرمة"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">النجوم (التقييم)</label>
                  <select
                    value={form.star_rating}
                    onChange={(e) => setForm({ ...form, star_rating: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="5">5 نجوم (فاخر)</option>
                    <option value="4">4 نجوم (ممتاز)</option>
                    <option value="3">3 نجوم (جيد جداً)</option>
                    <option value="2">2 نجوم</option>
                    <option value="1">1 نجمة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المورد / الوسيط</label>
                  <Input
                    placeholder="Booking / Agoda / Supplier"
                    value={form.supplier_name}
                    onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                    className="rounded-xl"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الهاتف</label>
                  <Input
                    placeholder="+966 12 xxxxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    placeholder="reservations@hotel.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">العنوان التفصيلي</label>
                <Input
                  placeholder="شارع أجياد - أمام الحرم المكي"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                  حفظ الفندق
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
