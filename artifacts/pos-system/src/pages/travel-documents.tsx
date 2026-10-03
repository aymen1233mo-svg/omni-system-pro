import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  FileText,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Download,
  Eye,
  Trash2,
  Upload,
  Calendar,
  UserCheck,
  Luggage,
  Clock,
  ExternalLink,
  ShieldAlert,
  CheckCircle2
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

export default function TravelDocumentsPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const [form, setForm] = useState({
    document_type: "جواز السفر",
    title: "",
    customer_id: "",
    passenger_id: "",
    expiry_date: "",
    notify_before_days: "30",
    file_url: "",
    file_name: "",
    notes: ""
  });

  const docTypes = [
    "جواز السفر",
    "الهوية الوطنية / الإقامة",
    "الصورة الشخصية",
    "التأشيرة Visa",
    "تذكرة السفر Flight Ticket",
    "حجز الفندق Hotel Voucher",
    "التأمين الصحي / السفر",
    "خطاب السفارة / العمل",
    "مستندات أخرى"
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docRes, paxRes, custRes] = await Promise.all([
        fetch("/api/travel/documents"),
        fetch("/api/travel/passengers"),
        fetch("/api/customers")
      ]);

      if (docRes.ok) setDocuments(await docRes.json());
      if (paxRes.ok) setPassengers(await paxRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      toast({ title: "خطأ", description: "عنوان المستند مطلوب", variant: "destructive" });
      return;
    }

    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch("/api/travel/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل حفظ الوثيقة");
      }

      toast({ title: "تم بنجاح", description: "تمت إضافة الوثيقة إلى المركز" });
      setModalOpen(false);
      setForm({
        document_type: "جواز السفر",
        title: "",
        customer_id: "",
        passenger_id: "",
        expiry_date: "",
        notify_before_days: "30",
        file_url: "",
        file_name: "",
        notes: ""
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذا المستند؟")) return;
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch(`/api/travel/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: "تم الحذف", description: "تم حذف الوثيقة بنجاح" });
        fetchData();
      }
    } catch (e) {}
  };

  // Filtered documents calculation
  const now = new Date();
  const filtered = documents.filter((doc) => {
    const matchesSearch =
      (doc.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (doc.passenger_name_ar || "").toLowerCase().includes(search.toLowerCase()) ||
      (doc.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (doc.passport_number || "").toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === "all" || doc.document_type === filterType;

    let isExpiring = false;
    if (doc.expiry_date) {
      const exp = new Date(doc.expiry_date);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
      isExpiring = diffDays <= Number(doc.notify_before_days || 30);
    }

    const matchesExpiring = !expiringOnly || isExpiring;

    return matchesSearch && matchesType && matchesExpiring;
  });

  // Calculate statistics
  const totalCount = documents.length;
  const passportCount = documents.filter((d) => d.document_type === "جواز السفر").length;
  const expiringCount = documents.filter((doc) => {
    if (!doc.expiry_date) return false;
    const exp = new Date(doc.expiry_date);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays <= Number(doc.notify_before_days || 30);
  }).length;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-emerald-600" />
              مركز إدارة الوثائق والمستندات
            </h1>
            <p className="text-slate-5-00 text-sm mt-1">
              أرشيف رقمي شامل لمستندات المسافرين وجوازات السفر والتأشيرات والتذاكر مع التنبيه الآلي بانتهاء الصلاحية
            </p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold px-5 py-2.5 rounded-xl shadow-md"
          >
            <Plus className="w-5 h-5" />
            رفع وثيقة جديدة
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-800">إجمالي الوثائق المؤرشفة</p>
              <h3 className="text-3xl font-extrabold text-emerald-950 mt-1">{totalCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200/60 p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">جوازات السفر المسجلة</p>
              <h3 className="text-3xl font-extrabold text-blue-950 mt-1">{passportCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Luggage className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">تنتهي قريباً (تنبيهات)</p>
              <h3 className="text-3xl font-extrabold text-amber-950 mt-1">{expiringCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Expiring Alert Banner if any */}
        {expiringCount > 0 && (
          <div className="bg-amber-50 border-r-4 border-amber-500 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-900">تنبيه انتهاء صلاحية الوثائق والجوازات</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  يوجد {expiringCount} وثائق أو جوازات سفر قريبة من انتهاء الصلاحية خلال فترة التنبيه المحددة!
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpiringOnly(!expiringOnly)}
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 font-medium"
            >
              {expiringOnly ? "عرض الجميع" : "عرض المنتهية قريباً فقط"}
            </Button>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث باسم المسافر، رقم الجواز، عنوان المستند..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 text-sm rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
              <Filter className="w-4 h-4" />
              نوع الوثيقة:
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">جميع الأنواع</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents Table / Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">جاري تحميل أرشيف الوثائق...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">لا توجد وثائق مطابقة للبحث</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-4">نوع الوثيقة والعنوان</th>
                    <th className="p-4">المسافر / العميل</th>
                    <th className="p-4">رقم الجواز / الهوية</th>
                    <th className="p-4">تاريخ الانتهاء</th>
                    <th className="p-4">حالة الصلاحية</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((doc) => {
                    let isExpiring = false;
                    let isExpired = false;
                    if (doc.expiry_date) {
                      const exp = new Date(doc.expiry_date);
                      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
                      if (diffDays <= 0) isExpired = true;
                      else if (diffDays <= Number(doc.notify_before_days || 30)) isExpiring = true;
                    }

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span className="block">{doc.title}</span>
                              <span className="text-xs text-slate-400 font-normal">{doc.document_type}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="text-slate-800 font-medium">
                            {doc.passenger_name_ar || doc.passenger_name_en || doc.customer_name || "غير محدد"}
                          </div>
                          {doc.customer_name && doc.passenger_name_ar && (
                            <div className="text-xs text-slate-400">العميل: {doc.customer_name}</div>
                          )}
                        </td>

                        <td className="p-4 font-mono text-slate-700">
                          {doc.passport_number || "—"}
                        </td>

                        <td className="p-4 text-slate-700">
                          {doc.expiry_date ? (
                            <span className="flex items-center gap-1.5 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {doc.expiry_date}
                            </span>
                          ) : (
                            <span className="text-slate-400">بدون تاريخ</span>
                          )}
                        </td>

                        <td className="p-4">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                              <AlertTriangle className="w-3 h-3" />
                              منتهية الصلاحية
                            </span>
                          ) : isExpiring ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" />
                              تنتهي قريباً
                            </span>
                          ) : doc.expiry_date ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              سارية المفعول
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">سارية</span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPreviewDoc(doc);
                                setPreviewModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              title="معاينة الملف"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc.id)}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              title="حذف"
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
        </div>

        {/* Upload Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                إضافة ورفع وثيقة جديدة للأرشيف
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الوثيقة *</label>
                  <select
                    value={form.document_type}
                    onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {docTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان الوثيقة *</label>
                  <Input
                    placeholder="مثال: جواز سفر علي الأحمد"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ربط بالمسافر</label>
                  <select
                    value={form.passenger_id}
                    onChange={(e) => setForm({ ...form, passenger_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختياري --</option>
                    {passengers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_ar} ({p.passport_number || "بدون جواز"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ربط بالعميل / الشركة</label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختياري --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ انتهاء الوثيقة</label>
                  <Input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">إرسال تنبيه قبل الانتهاء بـ (أيام)</label>
                  <Input
                    type="number"
                    value={form.notify_before_days}
                    onChange={(e) => setForm({ ...form, notify_before_days: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">رابط أو اسم الملف المرفق</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/file.pdf أو اسم الملف"
                    value={form.file_url}
                    onChange={(e) => setForm({ ...form, file_url: e.target.value, file_name: e.target.value.split('/').pop() || e.target.value })}
                    className="rounded-xl flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const dummyName = `doc_${Date.now()}.pdf`;
                      setForm({ ...form, file_url: `https://storage.travel.sys/${dummyName}`, file_name: dummyName });
                      toast({ title: "تم رفع الملف", description: `تم محاكاة رفع ${dummyName}` });
                    }}
                    className="rounded-xl text-xs gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    استعراض
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات توضيحية حول المستند..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  حفظ المستند
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
          <DialogContent className="max-w-lg text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                معاينة تفاصيل المستند
              </DialogTitle>
            </DialogHeader>

            {previewDoc && (
              <div className="space-y-4 text-sm mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">عنوان المستند:</span>
                  <span className="font-bold text-slate-900">{previewDoc.title}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">نوع الوثيقة:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.document_type}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">اسم المسافر:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.passenger_name_ar || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">اسم العميل/الشركة:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.customer_name || "—"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">تاريخ الانتهاء:</span>
                  <span className="font-mono font-semibold text-slate-800">{previewDoc.expiry_date || "—"}</span>
                </div>
                {previewDoc.notes && (
                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">الملاحظات:</span>
                    <p className="text-xs bg-white p-3 rounded-lg border text-slate-700">{previewDoc.notes}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button onClick={() => setPreviewModalOpen(false)} className="bg-slate-800 text-white">
                إغلاق المعاينة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
