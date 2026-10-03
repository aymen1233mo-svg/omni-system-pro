import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Compass,
  Plus,
  Search,
  Calendar,
  MapPin,
  Hotel,
  Bus,
  DollarSign,
  Printer,
  Trash2,
  Edit,
  Clock,
  Sparkles,
  CheckCircle2,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function TravelPackagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openItineraryModal, setOpenItineraryModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    title: "",
    destination: "",
    days_count: 5,
    nights_count: 4,
    hotels_info: "",
    trips_info: "",
    transport_info: "",
    meals_info: "",
    activities_info: "",
    tour_guide: "",
    insurance_info: "",
    cost_price: 3000,
    selling_price: 4500,
    commission: 1500,
    notes: ""
  });

  // Itinerary Form State
  const [itinForm, setItinForm] = useState({
    day_number: 1,
    title: "",
    description: "",
    activity_time: "09:00",
    location: "",
    notes: ""
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["/api/travel/packages"],
    queryFn: async () => {
      const res = await fetch("/api/travel/packages");
      if (!res.ok) throw new Error("فشل جلب برامج الرحلات");
      return res.json();
    }
  });

  const { data: activePackageDetails, refetch: refetchPkgDetails } = useQuery({
    queryKey: ["/api/travel/packages", selectedPackage?.id],
    queryFn: async () => {
      if (!selectedPackage?.id) return null;
      const res = await fetch(`/api/travel/packages/${selectedPackage.id}`);
      if (!res.ok) throw new Error("فشل جلب تفاصيل البرنامج");
      return res.json();
    },
    enabled: !!selectedPackage?.id
  });

  const createPkgMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل إضافة البرنامج");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/packages"] });
      toast({ title: "نجاح", description: "تم إنشاء البرنامج السياحي بنجاح ✅" });
      setOpenAddModal(false);
      setForm({
        title: "", destination: "", days_count: 5, nights_count: 4,
        hotels_info: "", trips_info: "", transport_info: "", meals_info: "",
        activities_info: "", tour_guide: "", insurance_info: "",
        cost_price: 3000, selling_price: 4500, commission: 1500, notes: ""
      });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  });

  const addItinDayMutation = useMutation({
    mutationFn: async ({ pkgId, payload }: { pkgId: number; payload: any }) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/packages/${pkgId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة اليوم للمسار");
      return res.json();
    },
    onSuccess: () => {
      refetchPkgDetails();
      toast({ title: "تم الإضافة", description: "تم تحديث جدول اليوم بنجاح ✅" });
      setItinForm({ day_number: (activePackageDetails?.itinerary?.length || 0) + 2, title: "", description: "", activity_time: "09:00", location: "", notes: "" });
    }
  });

  const deleteItinDayMutation = useMutation({
    mutationFn: async (dayId: number) => {
      const token = localStorage.getItem("pos_token") ?? "";
      await fetch(`/api/travel/packages/itinerary/${dayId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      refetchPkgDetails();
      toast({ title: "حذف", description: "تم حذف اليوم من المسار" });
    }
  });

  const filtered = packages.filter((p: any) =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.destination?.toLowerCase().includes(search.toLowerCase()) ||
    p.package_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-8 h-8 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-800">برامج الرحلات السياحية (Packages)</h1>
            </div>
            <p className="text-slate-5-0 text-sm mt-1">
              تصميم وبناء البرامج السياحية المتكاملة وشاملة الفنادق والأنشطة والمسار اليومي (Itinerary) مع حساب التكلفة والأرباح
            </p>
          </div>
          <Button onClick={() => setOpenAddModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> إنشاء برنامج سياحي جديد
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم البرنامج، الوجهة، أو كود الباقة..."
              className="pr-9"
            />
          </div>
        </div>

        {/* Packages Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">جاري تحميل برامج الرحلات...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
            لا توجد برامج سياحية مسجلة. اضغط زر إنشاء برنامج سياحي لإضافة باقة جديدة.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((pkg: any) => (
              <div key={pkg.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-50 text-emerald-700 rounded-lg">
                      {pkg.package_code}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                      {pkg.days_count} أيام / {pkg.nights_count} ليالي
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-snug">{pkg.title}</h3>
                    <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-1">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span>{pkg.destination}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    {pkg.hotels_info && (
                      <div className="flex items-center gap-2">
                        <Hotel className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{pkg.hotels_info}</span>
                      </div>
                    )}
                    {pkg.tour_guide && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>مرشد: {pkg.tour_guide}</span>
                      </div>
                    )}
                  </div>

                  {/* Profit Formula Display */}
                  <div className="grid grid-cols-3 gap-2 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-center text-xs">
                    <div>
                      <div className="text-slate-500">التكلفة</div>
                      <div className="font-bold text-slate-700">{pkg.cost_price?.toLocaleString()} ريال</div>
                    </div>
                    <div>
                      <div className="text-slate-500">سعر البيع</div>
                      <div className="font-bold text-emerald-700">{pkg.selling_price?.toLocaleString()} ريال</div>
                    </div>
                    <div>
                      <div className="text-slate-500">الربح الصافي</div>
                      <div className="font-bold text-blue-700">+{pkg.profit?.toLocaleString()} ريال</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => { setSelectedPackage(pkg); setOpenItineraryModal(true); }}
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" /> المسار اليومي ({pkg.itinerary_days_count || 0})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 border-slate-200"
                    onClick={() => { setSelectedPackage(pkg); setOpenPrintModal(true); }}
                  >
                    <Printer className="w-3.5 h-3.5" /> طباعة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Package Modal */}
        <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Compass className="w-6 h-6 text-emerald-600" /> إنشاء برنامج سياحي جديد
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
              <div className="space-y-1 md:col-span-2">
                <Label>اسم البرنامج السياحي *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: برنامج دبي الذهبي العائلي الشامل" />
              </div>

              <div className="space-y-1">
                <Label>الوجهة / البلد والمدينة *</Label>
                <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="مثال: دبي - الإمارات" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>عدد الأيام</Label>
                  <Input type="number" value={form.days_count} onChange={(e) => setForm({ ...form, days_count: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>عدد الليالي</Label>
                  <Input type="number" value={form.nights_count} onChange={(e) => setForm({ ...form, nights_count: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>الفنادق المقترحة</Label>
                <Input value={form.hotels_info} onChange={(e) => setForm({ ...form, hotels_info: e.target.value })} placeholder="اسم الفندق، تصنيف النجومات، المدينة" />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>الرحلات والجولات السياحية</Label>
                <Input value={form.trips_info} onChange={(e) => setForm({ ...form, trips_info: e.target.value })} placeholder="جولات المتاحف، السفاري، الشواطئ..." />
              </div>

              <div className="space-y-1">
                <Label>النقل والمواصلات</Label>
                <Input value={form.transport_info} onChange={(e) => setForm({ ...form, transport_info: e.target.value })} placeholder="سيارات VIP، باص مكيف..." />
              </div>

              <div className="space-y-1">
                <Label>الوجبات المشمولة</Label>
                <Input value={form.meals_info} onChange={(e) => setForm({ ...form, meals_info: e.target.value })} placeholder="إفطار يومي + عشاء فاخر" />
              </div>

              <div className="space-y-1">
                <Label>المرشد السياحي</Label>
                <Input value={form.tour_guide} onChange={(e) => setForm({ ...form, tour_guide: e.target.value })} placeholder="مرشد عربي / إنجليزي متخصص" />
              </div>

              <div className="space-y-1">
                <Label>التأمين الطبي والسفر</Label>
                <Input value={form.insurance_info} onChange={(e) => setForm({ ...form, insurance_info: e.target.value })} placeholder="تأمين سفر شامل للرحلة" />
              </div>

              {/* Financial Calculations */}
              <div className="md:col-span-2 grid grid-cols-3 gap-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700">التكلفة الفعلية (ريال)</Label>
                  <Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700">سعر البيع للعميل (ريال)</Label>
                  <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-emerald-800 font-bold">الربح الصافي (تلقائي)</Label>
                  <div className="h-10 flex items-center justify-center font-bold text-emerald-700 bg-white rounded-md border border-emerald-200">
                    {(form.selling_price - form.cost_price).toLocaleString()} ريال
                  </div>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>ملاحظات وشروط إضافية</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي شروط إلغاء أو تفاصيل تهم العميل..." />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenAddModal(false)}>إلغاء</Button>
              <Button
                onClick={() => createPkgMutation.mutate(form)}
                disabled={createPkgMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                حفظ البرنامج السياحي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Itinerary Manager Modal */}
        <Dialog open={openItineraryModal} onOpenChange={setOpenItineraryModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-indigo-600" />
                المسار اليومي للبرنامج: {selectedPackage?.title}
              </DialogTitle>
            </DialogHeader>

            {/* Add Itinerary Day Form */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" /> إضافة يوم جدديد للمسار
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <Label>رقم اليوم</Label>
                  <Input type="number" value={itinForm.day_number} onChange={(e) => setItinForm({ ...itinForm, day_number: Number(e.target.value) })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>عنوان النشاط (مثال: الوصول والاستقبال)</Label>
                  <Input value={itinForm.title} onChange={(e) => setItinForm({ ...itinForm, title: e.target.value })} placeholder="عنوان جذاب لليوم..." />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label>تفاصيل البرنامج السياحي لهذا اليوم</Label>
                  <Textarea value={itinForm.description} onChange={(e) => setItinForm({ ...itinForm, description: e.target.value })} placeholder="شرح التحركات والأماكن المزارة وتوقيتات الجولة..." />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => addItinDayMutation.mutate({ pkgId: selectedPackage.id, payload: itinForm })}
                disabled={!itinForm.title || addItinDayMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1"
              >
                إضافة اليوم إلى المسار
              </Button>
            </div>

            {/* Existing Itinerary Days List */}
            <div className="space-y-3 mt-4">
              <h4 className="font-bold text-sm text-slate-800">جدول الأيام الحالي:</h4>
              {!activePackageDetails?.itinerary || activePackageDetails.itinerary.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 bg-white rounded-xl border border-slate-100">
                  لا يوجد مسار يومي مضاف بعد. أضف أيام البرنامج أعلاه.
                </div>
              ) : (
                activePackageDetails.itinerary.map((day: any) => (
                  <div key={day.id} className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">
                          اليوم {day.day_number}
                        </span>
                        <h5 className="font-bold text-slate-800 text-sm">{day.title}</h5>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">{day.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                      onClick={() => deleteItinDayMutation.mutate(day.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Printable Package Voucher Modal */}
        <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
          <DialogContent className="max-w-2xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" /> طباعة برنامج الرحلة السياحية
              </DialogTitle>
            </DialogHeader>

            <div id="printable-package" className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-sm font-sans">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="font-bold text-xl text-slate-800">{selectedPackage?.title}</h2>
                  <p className="text-xs text-slate-500">كود البرنامج: {selectedPackage?.package_code} | الوجهة: {selectedPackage?.destination}</p>
                </div>
                <div className="text-left font-mono font-bold text-emerald-700">
                  {selectedPackage?.days_count} أيام / {selectedPackage?.nights_count} ليالي
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                <div><strong>الفنادق:</strong> {selectedPackage?.hotels_info || "غير محدد"}</div>
                <div><strong>النقل:</strong> {selectedPackage?.transport_info || "مشمول"}</div>
                <div><strong>الوجبات:</strong> {selectedPackage?.meals_info || "إفطار يومي"}</div>
                <div><strong>المرشد السياحي:</strong> {selectedPackage?.tour_guide || "متوفر"}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-700 border-b pb-1">المسار اليومي المعتمد:</h4>
                {activePackageDetails?.itinerary?.map((day: any) => (
                  <div key={day.id} className="text-xs border-r-2 border-emerald-500 pr-3 py-1">
                    <span className="font-bold text-emerald-800">اليوم {day.day_number}: {day.title}</span>
                    <p className="text-slate-600 mt-0.5">{day.description}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t font-bold text-emerald-800">
                <span>سعر البرنامج الإجمالي للعميل:</span>
                <span className="text-lg">{selectedPackage?.selling_price?.toLocaleString()} ريال سعودي</span>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <Printer className="w-4 h-4" /> طباعة الآن
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
