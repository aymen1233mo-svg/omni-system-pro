import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Plus,
  Search,
  User,
  FileText,
  Calendar,
  Globe,
  Printer,
  Trash2,
  DollarSign,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function TravelInsurancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);

  const [form, setForm] = useState({
    policy_number: "",
    insurance_company: "شركة التعاونية للتأمين",
    passenger_name: "",
    passport_number: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    duration_days: 30,
    coverage_type: "تأمين طبي وسياحي وحالات الطوارئ",
    destination_country: "الإمارات العربية المتحدة",
    cost_price: 120,
    selling_price: 200,
    commission: 80,
    notes: ""
  });

  const { data: insurances = [], isLoading } = useQuery({
    queryKey: ["/api/travel/insurances"],
    queryFn: async () => {
      const res = await fetch("/api/travel/insurances");
      return res.json();
    }
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إصدار بوليصة التأمين");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/insurances"] });
      toast({ title: "نجاح", description: "تم إصدار بوليصة التأمين بنجاح ✅" });
      setOpenModal(false);
      setForm({
        policy_number: "", insurance_company: "شركة التعاونية للتأمين",
        passenger_name: "", passport_number: "",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        duration_days: 30, coverage_type: "تأمين طبي وسياحي وحالات الطوارئ",
        destination_country: "الإمارات العربية المتحدة", cost_price: 120, selling_price: 200, commission: 80, notes: ""
      });
    }
  });

  const filtered = insurances.filter((i: any) =>
    i.policy_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.passenger_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.insurance_company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-teal-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة التأمين الصحي والسياحي (Travel Insurance)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              إصدار وإدارة وثائق التأمين الطبي والسفر للمسافرين والعملاء وحساب العمولات والأرباح
            </p>
          </div>
          <Button onClick={() => setOpenModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> إصدار بوليصة تأمين جديدة
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم البوليصة، اسم المسافر، شركة التأمين..."
              className="pr-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم البوليصة</th>
                  <th className="p-3.5">شركة التأمين</th>
                  <th className="p-3.5">اسم المسافر وجواز السفر</th>
                  <th className="p-3.5">الدولة والمدة</th>
                  <th className="p-3.5">التغطية التأمينية</th>
                  <th className="p-3.5">التكلفة / البيع / الربح</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center p-8 text-slate-400">جاري تحميل وثائق التأمين...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center p-8 text-slate-400">لا توجد وثائق تأمين مسجلة</td></tr>
                ) : (
                  filtered.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-teal-700">{item.policy_number}</td>
                      <td className="p-3.5 font-bold text-slate-800">{item.insurance_company}</td>
                      <td className="p-3.5 text-xs">
                        <div className="font-bold text-slate-800">{item.passenger_name || item.customer_name || "عبدالله العتيبي"}</div>
                        <div className="text-slate-500 font-mono">جواز: {item.passport_number || "A12345678"}</div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-700">
                        <div><strong>الوجهة:</strong> {item.destination_country || "عام"}</div>
                        <div className="text-slate-500">المدة: {item.duration_days} يوم ({item.start_date})</div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {item.coverage_type}
                      </td>
                      <td className="p-3.5 text-xs">
                        <div className="text-slate-500">تكلفة: {item.cost_price} ريال</div>
                        <div className="font-bold text-teal-700">بيع: {item.selling_price} ريال</div>
                        <div className="text-blue-600 font-bold">ربح: +{item.profit} ريال</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                          مفعلة ✅
                        </span>
                      </td>
                      <td className="p-3.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-slate-200"
                          onClick={() => { setSelectedPolicy(item); setOpenPrintModal(true); }}
                        >
                          <Printer className="w-3.5 h-3.5" /> شهادة التأمين
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Issue Policy */}
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogContent className="max-w-xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" /> إصدار وثيقة تأمين سفر جديدة
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1 col-span-2">
                <Label>شركة التأمين المعتمدة *</Label>
                <Input value={form.insurance_company} onChange={(e) => setForm({ ...form, insurance_company: e.target.value })} placeholder="شركة التعاونية / تكافل الراجحي / Bupa" />
              </div>

              <div className="space-y-1">
                <Label>اسم المسافر *</Label>
                <Input value={form.passenger_name} onChange={(e) => setForm({ ...form, passenger_name: e.target.value })} placeholder="عبدالله محمد العتيبي" />
              </div>

              <div className="space-y-1">
                <Label>رقم جواز السفر *</Label>
                <Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} placeholder="A12345678" />
              </div>

              <div className="space-y-1">
                <Label>تاريخ بداية التغطية</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label>تاريخ نهاية التغطية</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label>دولة الوجهة / السفر</Label>
                <Input value={form.destination_country} onChange={(e) => setForm({ ...form, destination_country: e.target.value })} placeholder="الإمارات / شنغن / بريطانيا" />
              </div>

              <div className="space-y-1">
                <Label>نوع التغطية التأمينية</Label>
                <Input value={form.coverage_type} onChange={(e) => setForm({ ...form, coverage_type: e.target.value })} placeholder="تأمين طبي وسياحي وحالات الطوارئ" />
              </div>

              <div className="space-y-1">
                <Label>التكلفة الفعلية (ريال)</Label>
                <Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} />
              </div>

              <div className="space-y-1">
                <Label>سعر البيع للعميل (ريال)</Label>
                <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setOpenModal(false)}>إلغاء</Button>
              <Button onClick={() => createPolicyMutation.mutate(form)} className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
                حفظ وإصدار الوثيقة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Printable Certificate Modal */}
        <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
          <DialogContent className="max-w-lg font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">شهادة بوليصة التأمين الطبي والسياحي</DialogTitle>
            </DialogHeader>
            <div id="printable-policy" className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-xs font-sans">
              <div className="text-center border-b pb-3">
                <h2 className="font-bold text-lg text-teal-800">{selectedPolicy?.insurance_company}</h2>
                <p className="text-slate-500 font-mono">Travel & Medical Insurance Certificate</p>
                <div className="mt-1 font-bold text-sm text-teal-700">رقم الوثيقة: {selectedPolicy?.policy_number}</div>
              </div>

              <div className="space-y-2 text-slate-700">
                <div><strong>اسم المسافر:</strong> {selectedPolicy?.passenger_name || "عبدالله محمد العتيبي"}</div>
                <div><strong>رقم جواز السفر:</strong> {selectedPolicy?.passport_number || "A12345678"}</div>
                <div><strong>الوجهة:</strong> {selectedPolicy?.destination_country || "الإمارات العربية المتحدة"}</div>
                <div><strong>فترة التغطية:</strong> من {selectedPolicy?.start_date} إلى {selectedPolicy?.end_date} ({selectedPolicy?.duration_days} يوم)</div>
                <div><strong>نوع التغطية:</strong> {selectedPolicy?.coverage_type}</div>
              </div>

              <div className="border-t pt-3 flex justify-between font-bold text-sm text-teal-900">
                <span>إجمالي الرسوم المدفوعة:</span>
                <span>{selectedPolicy?.selling_price?.toLocaleString()} ريال سعودي</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <Printer className="w-4 h-4" /> طباعة الشهادة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
