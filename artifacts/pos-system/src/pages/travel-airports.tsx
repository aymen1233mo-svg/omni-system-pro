import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  MapPin,
  Plus,
  Search,
  Globe2,
  Building,
  Edit2,
  Trash2,
  Compass
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

export default function TravelAirportsPage() {
  const { toast } = useToast();
  const [airports, setAirports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    country: "",
    city: "",
    airport_name_ar: "",
    airport_name_en: "",
    iata_code: "",
    icao_code: ""
  });

  const fetchAirports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/travel/airports");
      if (res.ok) setAirports(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirports();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      country: "",
      city: "",
      airport_name_ar: "",
      airport_name_en: "",
      iata_code: "",
      icao_code: ""
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      country: a.country || "",
      city: a.city || "",
      airport_name_ar: a.airport_name_ar || "",
      airport_name_en: a.airport_name_en || "",
      iata_code: a.iata_code || "",
      icao_code: a.icao_code || ""
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.country || !form.city || !form.airport_name_ar || !form.iata_code) {
      toast({ title: "خطأ", description: "جميع الحقول الأساسية مطلوبة", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("pos_token");
      const url = editingId ? `/api/travel/airports/${editingId}` : "/api/travel/airports";
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
        throw new Error(err.error || "فشل حفظ المطار");
      }

      toast({ title: "تم الحفظ", description: "تمت إضافة/تحديث المطار بنجاح" });
      setModalOpen(false);
      fetchAirports();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذا المطار؟")) return;
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch(`/api/travel/airports/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "تم الحذف", description: "تم حذف المطار بنجاح" });
        fetchAirports();
      }
    } catch (e) {}
  };

  const filtered = airports.filter(
    (a) =>
      (a.airport_name_ar || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.airport_name_en || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.city || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.country || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.iata_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-7 h-7 text-indigo-600" />
              دليل المطارات والوجهات السياحية
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              قاعدة بيانات المطارات العالمية والمدن والرموز المعتمدة لخطوط السفر IATA / ICAO
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold px-5 py-2.5 rounded-xl shadow-md"
          >
            <Plus className="w-5 h-5" />
            إضافة مطار جديد
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث باسم المطار، المدينة، الدولة، أو رمز IATA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 text-sm rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium hidden md:inline">
            إجمالي المطارات: {airports.length}
          </span>
        </div>

        {/* Airports Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">جاري تحميل المطارات...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">لا توجد مطارات مطابقة للبحث</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-4">رمز IATA</th>
                    <th className="p-4">اسم المطار (عربي/إنجليزي)</th>
                    <th className="p-4">المدينة</th>
                    <th className="p-4">الدولة</th>
                    <th className="p-4">رمز ICAO</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-mono font-bold text-base border border-indigo-200/50">
                          {a.iata_code}
                        </span>
                      </td>

                      <td className="p-4 font-semibold text-slate-900">
                        <div>{a.airport_name_ar}</div>
                        {a.airport_name_en && (
                          <div className="text-xs text-slate-400 font-normal">{a.airport_name_en}</div>
                        )}
                      </td>

                      <td className="p-4 font-medium text-slate-800">{a.city}</td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                          <Globe2 className="w-3.5 h-3.5 text-slate-400" />
                          {a.country}
                        </span>
                      </td>

                      <td className="p-4 font-mono text-slate-500">{a.icao_code || "—"}</td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(a)}
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(a.id)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                {editingId ? "تعديل بيانات المطار" : "إضافة مطار جديد"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الدولة *</label>
                  <Input
                    placeholder="مصر"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المدينة *</label>
                  <Input
                    placeholder="القاهرة"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المطار بالعربية *</label>
                <Input
                  placeholder="مطار القاهرة الدولي"
                  value={form.airport_name_ar}
                  onChange={(e) => setForm({ ...form, airport_name_ar: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المطار بالإنجليزية</label>
                <Input
                  placeholder="Cairo International Airport"
                  value={form.airport_name_en}
                  onChange={(e) => setForm({ ...form, airport_name_en: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كود IATA (3 أحرف) *</label>
                  <Input
                    placeholder="CAI"
                    maxLength={3}
                    value={form.iata_code}
                    onChange={(e) => setForm({ ...form, iata_code: e.target.value.toUpperCase() })}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">كود ICAO (4 أحرف)</label>
                  <Input
                    placeholder="HECA"
                    maxLength={4}
                    value={form.icao_code}
                    onChange={(e) => setForm({ ...form, icao_code: e.target.value.toUpperCase() })}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
