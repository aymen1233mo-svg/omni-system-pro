import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ReportViewerModal } from "@/components/ReportViewerModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Trash2,
  ArrowRight,
  Send,
  Calendar,
  DollarSign,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function TravelQuotationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openPrintModal, setOpenPrintModal] = useState(false);
  const [selectedQuo, setSelectedQuo] = useState<any>(null);
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [reportTitle, setReportTitle] = useState("");

  // Form State
  const [customerName, setCustomerName] = useState("فاطمة علي الزهراني");
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [terms, setTerms] = useState("العرض ساري لمدة 7 أيام والتأكيد يعتمد على إتاحة التذاكر والفنادق وقت الصدور");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<any[]>([
    {
      service_type: "flight",
      description: "تذكرة طيران الرياض -> باريس (الخطوط الفرنسية)",
      cost_price: 3200,
      service_fees: 100,
      selling_price: 3800
    },
    {
      service_type: "visa",
      description: "تأشيرة شنغن فرنسا شاملة الموعد للبصمة",
      cost_price: 450,
      service_fees: 50,
      selling_price: 650
    }
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        service_type: "hotel",
        description: "إقامة فندق باريس 10 ليالي",
        cost_price: 8000,
        service_fees: 200,
        selling_price: 10000
      }
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Queries
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["/api/travel/quotations"],
    queryFn: async () => {
      const res = await fetch("/api/travel/quotations");
      return res.json();
    }
  });

  const { data: quoDetails } = useQuery({
    queryKey: ["/api/travel/quotations", selectedQuo?.id],
    queryFn: async () => {
      if (!selectedQuo?.id) return null;
      const res = await fetch(`/api/travel/quotations/${selectedQuo.id}`);
      return res.json();
    },
    enabled: !!selectedQuo?.id
  });

  // Mutations
  const createQuoMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("فشل إنشاء عرض السعر");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/quotations"] });
      toast({ title: "نجاح", description: "تم إنشاء عرض السعر بنجاح ✅" });
      setOpenCreateModal(false);
    }
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: async (quoId: number) => {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/quotations/${quoId}/convert`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("فشل تحويل عرض السعر إلى فاتورة");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/travel/invoices"] });
      toast({ title: "تم التحويل بنجاح", description: data.message });
    }
  });

  const totalCost = (items || []).reduce((sum, i) => sum + Number(i.cost_price || 0), 0);
  const totalFees = (items || []).reduce((sum, i) => sum + Number(i.service_fees || 0), 0);
  const totalSelling = (items || []).reduce((sum, i) => sum + Number(i.selling_price || 0), 0);

  const filtered = quotations.filter((q: any) =>
    q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-800">إدارة عروض الأسعار (Travel Quotations)</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              إعداد عروض الأسعار للعملاء وإرسال الاقتراحات وتحويل العرض المقبول بنقرة واحدة إلى فاتورة مبيعات معتمدة
            </p>
          </div>
          <Button onClick={() => setOpenCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> إنشاء عرض سعر جديد
          </Button>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم عرض السعر، اسم العميل..."
              className="pr-9"
            />
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">رقم العرض</th>
                  <th className="p-3.5">العميل والتاريخ</th>
                  <th className="p-3.5">تاريخ الصلاحية</th>
                  <th className="p-3.5">إجمالي العرض للعميل</th>
                  <th className="p-3.5">الربح المتوقع</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">خيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center p-8 text-slate-400">جاري تحميل عروض الأسعار...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-slate-400">لا توجد عروض أسعار مسجلة بعد</td></tr>
                ) : (
                  filtered.map((q: any) => (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{q.quotation_number}</td>
                      <td className="p-3.5 text-xs">
                        <div className="font-bold text-slate-800">{q.customer_name}</div>
                        <div className="text-slate-500">{q.quotation_date}</div>
                      </td>
                      <td className="p-3.5 text-xs text-amber-700 font-medium">{q.valid_until}</td>
                      <td className="p-3.5 text-xs font-bold text-emerald-700 font-mono">
                        {q.total_selling?.toLocaleString()} ريال
                      </td>
                      <td className="p-3.5 text-xs font-bold text-blue-700 font-mono">
                        +{q.total_profit?.toLocaleString()} ريال
                      </td>
                      <td className="p-3.5">
                        {q.status === 'accepted' ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">مقبول وتَم التحويل ✅</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">مرسل للعميل 📩</span>
                        )}
                      </td>
                      <td className="p-3.5 flex gap-2">
                        {q.status !== 'accepted' && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                            onClick={() => convertToInvoiceMutation.mutate(q.id)}
                            disabled={convertToInvoiceMutation.isPending}
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> تحويل لفاتورة
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1 border-slate-200"
                          onClick={() => { setSelectedQuo(q); setOpenPrintModal(true); }}
                        >
                          <Printer className="w-3.5 h-3.5" /> طباعة
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Create Quotation */}
        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-indigo-600" /> إعداد عرض سعر رحلة سياحية جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
                <div className="space-y-1">
                  <Label>اسم العميل *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسم العميل الرباعي" />
                </div>
                <div className="space-y-1">
                  <Label>ساري حتى تاريخ</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-sm">بنود العرض المقدم للعميل:</h4>
                  <Button size="sm" onClick={addItem} variant="outline" className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" /> إضافة بند
                  </Button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs items-center">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[11px]">الوصف</Label>
                      <Input className="h-8 text-xs" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">التكلفة</Label>
                      <Input className="h-8 text-xs font-mono" type="number" value={item.cost_price} onChange={(e) => updateItem(idx, "cost_price", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">سعر العرض</Label>
                      <Input className="h-8 text-xs font-mono font-bold text-indigo-700" type="number" value={item.selling_price} onChange={(e) => updateItem(idx, "selling_price", Number(e.target.value))} />
                    </div>
                    {items.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1 mt-5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl flex justify-between font-bold text-slate-800 text-xs">
                <span>إجمالي العرض النهائي: {totalSelling.toLocaleString()} ريال سعودي</span>
                <span className="text-blue-700">الربح المتوقع: +{(totalSelling - (totalCost + totalFees)).toLocaleString()} ريال</span>
              </div>

              <div className="space-y-1">
                <Label>الشروط والأحكام الخاصة بالعرض</Label>
                <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="شروط الصلاحية والإلغاء..." />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setOpenCreateModal(false)}>إلغاء</Button>
              <Button
                onClick={() => createQuoMutation.mutate({
                  customer_name: customerName,
                  valid_until: validUntil,
                  terms_conditions: terms,
                  notes,
                  items
                })}
                disabled={createQuoMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                حفظ وإرسال عرض السعر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Printable Proposal Modal */}
        <Dialog open={openPrintModal} onOpenChange={setOpenPrintModal}>
          <DialogContent className="max-w-2xl font-sans" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">عرض سعر رحلة سياحية - Proposal</DialogTitle>
            </DialogHeader>

            <div id="printable-quotation" className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-xs font-sans">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="font-bold text-xl text-slate-800">عرض سعر خِدمات سفر ورحلة سياحية</h2>
                  <p className="text-indigo-700 font-mono font-bold">{quoDetails?.quotation_number || selectedQuo?.quotation_number}</p>
                </div>
                <div className="text-left text-slate-600">
                  <div>العميل: <strong>{selectedQuo?.customer_name}</strong></div>
                  <div>ساري حتى: <strong className="text-amber-700">{selectedQuo?.valid_until}</strong></div>
                </div>
              </div>

              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold border-b">
                    <th className="p-2">تفاصيل الخدمة</th>
                    <th className="p-2">المبلغ المالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quoDetails?.items?.map((it: any) => (
                    <tr key={it.id}>
                      <td className="p-2">{it.description}</td>
                      <td className="p-2 font-mono font-bold">{it.selling_price?.toLocaleString()} ريال</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t pt-3 flex justify-between font-bold text-base text-slate-900">
                <span>الإجمالي الكلي المالي للعرض:</span>
                <span className="text-indigo-700">{selectedQuo?.total_selling?.toLocaleString()} ريال سعودي</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-600">
                <strong>الشروط والأحكام:</strong> {selectedQuo?.terms_conditions}
              </div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setOpenPrintModal(false)}>إغلاق</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const elem = document.getElementById("printable-quotation");
                  if (elem) {
                    setReportHtml(elem.innerHTML);
                    setReportTitle(`عرض سعر - ${selectedQuo?.quotation_number || ""}`);
                    setReportViewerOpen(true);
                  }
                }}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5 font-bold"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                استعراض قبل الطباعة
              </Button>
              <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold">
                <Printer className="w-4 h-4" /> طباعة مباشرة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ReportViewerModal
          isOpen={reportViewerOpen}
          onClose={() => setReportViewerOpen(false)}
          htmlContent={reportHtml}
          title={reportTitle}
        />
      </div>
    </AdminLayout>
  );
}
