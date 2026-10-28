import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Search,
  User,
  Phone,
  Calendar,
  MapPin,
  Clock,
  Printer,
  Trash2,
  Building2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Bus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function TravelTransportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("transports");
  const [search, setSearch] = useState("");

  // Modals
  const [openBookModal, setOpenBookModal] = useState(false);
  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [openDriverModal, setOpenDriverModal] = useState(false);
  const [openCompanyModal, setOpenCompanyModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [openStmtModal, setOpenStmtModal] = useState(false);
  const [companyStmtData, setCompanyStmtData] = useState<any>(null);
  const [selectedTransport, setSelectedTransport] = useState<any>(null);

  const loadCompanyStatement = async (comp: any) => {
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/transport-companies/${comp.id}/statement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyStmtData(data);
        setOpenStmtModal(true);
      } else {
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل كشف حساب شركة النقل" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "حدث خطأ أثناء الاتصال بالخادم" });
    }
  };

  // Form States
  const [bookForm, setBookForm] = useState({
    service_type: "استقبال مطار",
    customer_id: 1,
    vehicle_id: "",
    driver_id: "",
    company_id: "",
    pickup_location: "",
    dropoff_location: "",
    pickup_datetime: new Date().toISOString().slice(0, 16),
    flight_number: "",
    cost_price: 200,
    selling_price: 350,
    commission: 150,
    notes: ""
  });

  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    vehicle_type: "سيارة",
    plate_number: "",
    model_year: "2025",
    capacity: 4,
    company_name: "الأسطول السياحي"
  });

  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    license_number: "",
    nationality: "سعودي"
  });

  const [companyForm, setCompanyForm] = useState({
    name: "",
    phone: "",
    email: "",
    contact_person: "",
    address: ""
  });

  // Queries
  const { data: transports = [], isLoading: loadTrn } = useQuery({
    queryKey: ["/api/travel/transports"],
    queryFn: async () => {
      const res = await fetch("/api/travel/transports");
      return res.json();
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/travel/vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/travel/vehicles");
      return res.json();
    }
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["/api/travel/drivers"],
    queryFn: async () => {
      const res = await fetch("/api/travel/drivers");
      return res.json();
    }
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["/api/travel/transport-companies"],
    queryFn: async () => {
      const res = await fetch("/api/travel/transport-companies");
      return res.json();
    }
  });

  // Mutations
  const bookTransportMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/transports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل حجز النقل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/transports"] });
      toast({ title: "تم بنجاح", description: "تم تسجيل حجز خدمة النقل والمواصلات ✅" });
      setOpenBookModal(false);
    }
  });

  const addVehicleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة المركبة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/vehicles"] });
      toast({ title: "نجاح", description: "تم إضافة المركبة إلى الأسطول ✅" });
      setOpenVehicleModal(false);
    }
  });

  const addDriverMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة السائق");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/drivers"] });
      toast({ title: "نجاح", description: "تم إضافة السائق بنجاح ✅" });
      setOpenDriverModal(false);
    }
  });

  const addCompanyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/transport-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إضافة شركة النقل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/transport-companies"] });
      toast({ title: "نجاح", description: "تم تسجيل شركة النقل بنجاح ✅" });
      setOpenCompanyModal(false);
    }
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة النقل والمواصلات (Logistics)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              إدارة أسطول السيارات والباصات والسائقين وشركات النقل وحجوزات التوصيل والاستقبال من المطار
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/travel-bus-tickets">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-sm">
                <Bus className="w-4 h-4" />
                حجوزات تذاكر النقل البري والباصات 🚌
              </Button>
            </Link>
            <Button onClick={() => setOpenBookModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-medium">
              <Plus className="w-4 h-4" /> حجز رحلة نقل جديدة
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border p-1 rounded-xl">
            <TabsTrigger value="transports" className="gap-2">
              <Clock className="w-4 h-4" /> رحلات النقل والتوصيل
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">
              <Truck className="w-4 h-4" /> أسطول المركبات والباصات ({vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <User className="w-4 h-4" /> السائقين ({drivers.length})
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" /> شركات النقل ({companies.length})
            </TabsTrigger>
          </TabsList>

          {/* Transports Tab */}
          <TabsContent value="transports" className="mt-4 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث برقم التوصيلة، موقع التحرك، المطار، العميل..."
                  className="pr-9"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">رقم الرحلة</th>
                      <th className="p-3.5">نوع الخدمة</th>
                      <th className="p-3.5">نقطة الانطلاق إلى الوصول</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5">السائق والمركبة</th>
                      <th className="p-3.5">التكلفة / البيع / الربح</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transports.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center p-8 text-slate-400">لا توجد رحلات نقل مسجلة بعد</td>
                      </tr>
                    ) : (
                      transports.map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-blue-700">{t.transport_number}</td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                              {t.service_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs text-slate-700">
                            <div><strong>من:</strong> {t.pickup_location || "غير محدد"}</div>
                            <div><strong>إلى:</strong> {t.dropoff_location || "غير محدد"}</div>
                          </td>
                          <td className="p-3.5 text-xs text-slate-600 font-mono">{t.pickup_datetime}</td>
                          <td className="p-3.5 text-xs">
                            <div><strong>سائق:</strong> {t.driver_name || "غير معين"}</div>
                            <div className="text-slate-500">مركبة: {t.vehicle_name || "سيارة VIP"}</div>
                          </td>
                          <td className="p-3.5 text-xs">
                            <div className="text-slate-500">تكلفة: {t.cost_price} ريال</div>
                            <div className="font-bold text-emerald-700">بيع: {t.selling_price} ريال</div>
                            <div className="text-blue-600 font-bold">ربح: +{t.profit} ريال</div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                              مجدولة ✅
                            </span>
                          </td>
                          <td className="p-3.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => { setSelectedTransport(t); setOpenPrintModal(true); }}
                            >
                              <Printer className="w-3.5 h-3.5" /> سند نقل
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Vehicles Fleet Tab */}
          <TabsContent value="vehicles" className="mt-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
              <h3 className="font-bold text-slate-800">أسطول المركبات والباصات السياحية</h3>
              <Button onClick={() => setOpenVehicleModal(true)} className="bg-emerald-600 text-white text-xs gap-1">
                <Plus className="w-4 h-4" /> إضافة مركبة جديدة
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicles.map((v: any) => (
                <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800">{v.name}</h4>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs rounded">{v.vehicle_type}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>لوحة السيارة: <strong>{v.plate_number || "غ/م"}</strong></div>
                    <div>الموديل: {v.model_year} | السعة: {v.capacity} ركاب</div>
                    <div>الشركة: {v.company_name || "مملوكة"}</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="mt-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
              <h3 className="font-bold text-slate-800">دليل السائقين المعتمدين</h3>
              <Button onClick={() => setOpenDriverModal(true)} className="bg-indigo-600 text-white text-xs gap-1">
                <Plus className="w-4 h-4" /> إضافة سائق جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {drivers.map((d: any) => (
                <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800">{d.name}</h4>
                    <span className="text-xs text-slate-500">{d.nationality}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>الهاتف: <strong dir="ltr">{d.phone || "غ/م"}</strong></div>
                    <div>رخصة القيادة: {d.license_number || "سارية"}</div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="mt-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100">
              <h3 className="font-bold text-slate-800">شركات ومتعهدي النقل</h3>
              <Button onClick={() => setOpenCompanyModal(true)} className="bg-blue-600 text-white text-xs gap-1">
                <Plus className="w-4 h-4" /> تسجيل شركة نقل
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companies.map((c: any) => (
                <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800">{c.name}</h4>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-mono">رمز: {c.account_code || "—"}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>مسؤول التواصل: {c.contact_person || "غير محدد"}</div>
                    <div>الهاتف: <strong dir="ltr">{c.phone || "غ/م"}</strong></div>
                    <div>العنوان: {c.address || "السعودية"}</div>
                  </div>
                  <div className="pt-2 border-t flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadCompanyStatement(c)} className="text-xs gap-1 h-8">
                      <Printer className="w-3.5 h-3.5 text-blue-600" /> كشف الحساب
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Book Transport */}
        <Dialog open={openBookModal} onOpenChange={setOpenBookModal}>
          <DialogContent className="max-w-xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" /> حجز رحلة نقل ومواصلات جديدة
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <Label>نوع خدمة النقل</Label>
                <Select value={bookForm.service_type} onValueChange={(v) => setBookForm({ ...bookForm, service_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="استقبال مطار">استقبال مطار VIP</SelectItem>
                    <SelectItem value="توصيل فندق">توصيل للفندق</SelectItem>
                    <SelectItem value="جولة سياحية">جولة سياحية بالمدينة</SelectItem>
                    <SelectItem value="نقل بين المدن">نقل وتوصيل بين المدن</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>رقم الرحلة / الطائرة</Label>
                <Input value={bookForm.flight_number} onChange={(e) => setBookForm({ ...bookForm, flight_number: e.target.value })} placeholder="مثال: SV-120" />
              </div>

              <div className="space-y-1">
                <Label>مكان التحرك (Pickup)</Label>
                <Input value={bookForm.pickup_location} onChange={(e) => setBookForm({ ...bookForm, pickup_location: e.target.value })} placeholder="مطار دبي T3" />
              </div>

              <div className="space-y-1">
                <Label>مكان الوصول (Dropoff)</Label>
                <Input value={bookForm.dropoff_location} onChange={(e) => setBookForm({ ...bookForm, dropoff_location: e.target.value })} placeholder="فندق أتلانتس النخيل" />
              </div>

              <div className="space-y-1 col-span-2">
                <Label>التاريخ والوقت المطلوب</Label>
                <Input type="datetime-local" value={bookForm.pickup_datetime} onChange={(e) => setBookForm({ ...bookForm, pickup_datetime: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label>التكلفة من شركة النقل (ريال)</Label>
                <Input type="number" value={bookForm.cost_price} onChange={(e) => setBookForm({ ...bookForm, cost_price: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label>سعر البيع للعميل (ريال)</Label>
                <Input type="number" value={bookForm.selling_price} onChange={(e) => setBookForm({ ...bookForm, selling_price: Number(e.target.value) })} />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setOpenBookModal(false)}>إلغاء</Button>
              <Button onClick={() => bookTransportMutation.mutate(bookForm)} className="bg-blue-600 hover:bg-blue-700 text-white">
                تأكيد حجز النقل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Add Vehicle */}
        <Dialog open={openVehicleModal} onOpenChange={setOpenVehicleModal}>
          <DialogContent className="max-w-md font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">إضافة مركبة للأسطول</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div><Label>اسم المركبة / الطراز</Label><Input value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} placeholder="تويوتا جرانفيا VIP" /></div>
              <div><Label>نوع المركبة</Label><Input value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })} placeholder="فان / باص / سيارة" /></div>
              <div><Label>رقم اللوحة</Label><Input value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })} placeholder="ر ي ض 101" /></div>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => addVehicleMutation.mutate(vehicleForm)} className="bg-emerald-600 text-white">حفظ المركبة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Add Driver */}
        <Dialog open={openDriverModal} onOpenChange={setOpenDriverModal}>
          <DialogContent className="max-w-md font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">تسجيل سائق جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div><Label>اسم السائق الثلاثي</Label><Input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} placeholder="سعيد أحمد باحويرث" /></div>
              <div><Label>رقم الجوال</Label><Input value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="0501122334" /></div>
              <div><Label>رخصة القيادة</Label><Input value={driverForm.license_number} onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })} placeholder="DL-998811" /></div>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => addDriverMutation.mutate(driverForm)} className="bg-indigo-600 text-white">حفظ السائق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Add Company */}
        <Dialog open={openCompanyModal} onOpenChange={setOpenCompanyModal}>
          <DialogContent className="max-w-md font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">تسجيل شركة نقل</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div><Label>اسم الشركة</Label><Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="شركة الأفق للنقل السياحي" /></div>
              <div><Label>الهاتف</Label><Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="0112233445" /></div>
              <div><Label>المسؤول</Label><Input value={companyForm.contact_person} onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })} placeholder="أحمد سعيد" /></div>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => addCompanyMutation.mutate(companyForm)} className="bg-blue-600 text-white">حفظ شركة النقل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Printable Transport Voucher Modal */}
        <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
          <DialogContent className="max-w-lg font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">سند خدمة النقل والمواصلات</DialogTitle>
            </DialogHeader>
            <div id="printable-transport" className="p-6 bg-white border rounded-xl space-y-4 text-xs font-sans">
              <div className="text-center border-b pb-3">
                <h2 className="font-bold text-lg text-slate-800">قسيمة خدمة النقل والمواصلات (Transfer Voucher)</h2>
                <p className="text-blue-700 font-mono font-bold">{selectedTransport?.transport_number}</p>
              </div>

              <div className="space-y-2">
                <div><strong>نوع الخدمة:</strong> {selectedTransport?.service_type}</div>
                <div><strong>مكان الاستقبال:</strong> {selectedTransport?.pickup_location}</div>
                <div><strong>مكان التوصيل:</strong> {selectedTransport?.dropoff_location}</div>
                <div><strong>التاريخ والتوقيت:</strong> {selectedTransport?.pickup_datetime}</div>
                <div><strong>رقم الطيران:</strong> {selectedTransport?.flight_number || "غير محدد"}</div>
              </div>

              <div className="border-t pt-3 flex justify-between font-bold text-sm text-slate-800">
                <span>المبلغ المستحق:</span>
                <span>{selectedTransport?.selling_price?.toLocaleString()} ريال سعودي</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => window.print()} className="bg-blue-600 text-white gap-2">
                <Printer className="w-4 h-4" /> طباعة القسيمة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Company Statement Modal */}
        <Dialog open={openStmtModal} onOpenChange={setOpenStmtModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center justify-between">
                <span>كشف حساب شركة النقل: {companyStmtData?.company?.name}</span>
                <Button onClick={() => window.print()} className="bg-emerald-600 text-white text-xs gap-1.5">
                  <Printer className="w-4 h-4" /> طباعة الكشف
                </Button>
              </DialogTitle>
            </DialogHeader>

            {companyStmtData && (
              <div id="printable-statement" className="space-y-6 p-4 bg-white text-xs font-sans">
                <div className="flex justify-between border-b pb-4">
                  <div>
                    <h3 className="font-bold text-base text-slate-800">{companyStmtData.company.name}</h3>
                    <p className="text-slate-500">رقم الحساب: <span className="font-mono">{companyStmtData.company.account_code || "—"}</span></p>
                    <p className="text-slate-500">الهاتف: {companyStmtData.company.phone || "—"}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-700">تاريخ الاستخراج: {new Date().toLocaleDateString("ar-SA")}</p>
                    <p className="text-slate-500">الرصيد الختامي: <strong className="text-blue-600 font-mono">{companyStmtData.summary?.balance?.toLocaleString()} ريال</strong></p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <div className="text-slate-500">إجمالي التكاليف</div>
                    <div className="text-base font-bold font-mono text-slate-800">{companyStmtData.summary?.totalCost?.toLocaleString()} ر.س</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <div className="text-slate-500">إجمالي المدين</div>
                    <div className="text-base font-bold font-mono text-slate-800">{companyStmtData.summary?.totalDebits?.toLocaleString()} ر.س</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <div className="text-slate-500">إجمالي الدائن (المستحق)</div>
                    <div className="text-base font-bold font-mono text-emerald-600">{companyStmtData.summary?.totalCredits?.toLocaleString()} ر.س</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-700">حركات القيود المحاسبية المرتبطة بالحساب</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b">
                        <tr>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">رقم المرجع</th>
                          <th className="p-2.5">البيان والشرح</th>
                          <th className="p-2.5">مدين</th>
                          <th className="p-2.5">دائن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(companyStmtData.journalEntries || []).map((jel: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono">{jel.entry_date}</td>
                            <td className="p-2.5 font-mono">{jel.reference_number || "—"}</td>
                            <td className="p-2.5">{jel.description || jel.je_desc}</td>
                            <td className="p-2.5 font-mono">{jel.debit > 0 ? jel.debit.toLocaleString() : "—"}</td>
                            <td className="p-2.5 font-mono font-bold text-emerald-600">{jel.credit > 0 ? jel.credit.toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                        {(!companyStmtData.journalEntries || companyStmtData.journalEntries.length === 0) && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">لا توجد حركات مالية مسجلة بعد لهذه الشركة</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-700">حجوزات النقل والسيارات الخاصة</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b">
                        <tr>
                          <th className="p-2.5">رقم السند</th>
                          <th className="p-2.5">نوع الخدمة</th>
                          <th className="p-2.5">التحرك إلى الوصول</th>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(companyStmtData.transports || []).map((tr: any) => (
                          <tr key={tr.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold">{tr.transport_number}</td>
                            <td className="p-2.5">{tr.service_type}</td>
                            <td className="p-2.5">{tr.pickup_location} إلى {tr.dropoff_location}</td>
                            <td className="p-2.5 font-mono">{tr.pickup_datetime?.slice(0, 10)}</td>
                            <td className="p-2.5 font-mono font-bold">{tr.cost_price?.toLocaleString()} ر.س</td>
                          </tr>
                        ))}
                        {(!companyStmtData.transports || companyStmtData.transports.length === 0) && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">لا توجد حجوزات سيارات خاصة مسجلة لهذه الشركة</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-700">حجوزات وتذاكر النقل البري والباصات</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 border-b">
                        <tr>
                          <th className="p-2.5">رقم التذكرة</th>
                          <th className="p-2.5">المسار (من إلى)</th>
                          <th className="p-2.5">اسم المسافر</th>
                          <th className="p-2.5">تاريخ الرحلة</th>
                          <th className="p-2.5">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(companyStmtData.busBookings || []).map((b: any) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold">{b.ticket_number || b.booking_number}</td>
                            <td className="p-2.5">{b.origin_city} إلى {b.destination_city}</td>
                            <td className="p-2.5">{b.passenger_name || b.customer_name}</td>
                            <td className="p-2.5 font-mono">{b.departure_date}</td>
                            <td className="p-2.5 font-mono font-bold">{Number(b.cost_price || 0).toLocaleString()} ر.س</td>
                          </tr>
                        ))}
                        {(!companyStmtData.busBookings || companyStmtData.busBookings.length === 0) && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">لا توجد حجز تذاكر باصات أو نقل بري مسجلة لهذه الشركة</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
