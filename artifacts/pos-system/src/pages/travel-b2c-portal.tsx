import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCheck,
  Search,
  Plane,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Luggage,
  Calendar,
  Send,
  HelpCircle,
  Stamp,
  ArrowRight,
  ShieldCheck,
  Phone,
  Mail,
  RefreshCw,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers
    }
  }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ في الخادم");
    }
    return r.json();
  });
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TravelB2cPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("6X9ZKL");
  const [activeTab, setActiveTab] = useState("lookup");

  // Customer Request Form
  const [requestForm, setRequestForm] = useState({
    request_type: "change_date",
    customer_name: "",
    customer_phone: "",
    pnr_or_ticket: "",
    preferred_new_date: "",
    request_details: ""
  });

  // Lookup Query
  const { data: searchData, refetch: runSearch, isFetching: isSearching } = useQuery<any>({
    queryKey: ["b2c-lookup", searchQuery],
    queryFn: () => fetchWithAuth(`/api/travel/b2c/lookup?query=${encodeURIComponent(searchQuery)}`),
    enabled: false
  });

  // Visa Tracking Query (Sample parameter)
  const [visaParam, setVisaParam] = useState("VSA-992211");
  const { data: visaTrackData, refetch: runVisaTrack } = useQuery<any>({
    queryKey: ["visa-tracking", visaParam],
    queryFn: () => fetchWithAuth(`/api/travel/b2c/visa-tracking/${encodeURIComponent(visaParam)}`),
    enabled: true
  });

  // Agent Requests Query
  const { data: agentRequests } = useQuery<any[]>({
    queryKey: ["agent-b2c-requests"],
    queryFn: () => fetchWithAuth("/api/travel/b2c/agent-requests")
  });

  // Submit Customer Request Mutation
  const submitRequestMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth("/api/travel/b2c/requests", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["agent-b2c-requests"] });
      toast({
        title: "تم استلام طلبك بنجاح ✅",
        description: `رقم تتبع الطلب الخاص بك: ${res.request_code}`
      });
      setRequestForm({
        request_type: "change_date",
        customer_name: "",
        customer_phone: "",
        pnr_or_ticket: "",
        preferred_new_date: "",
        request_details: ""
      });
    },
    onError: (err: any) => toast({ title: "فشل إرسال الطلب", description: err.message, variant: "destructive" })
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    runSearch();
  };

  const booking = searchData?.bookings?.[0];

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-600/30 border border-emerald-400/30 rounded-xl">
                <UserCheck className="w-8 h-8 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">بوابة خدمة المسافرين الذاتية B2C Passenger Portal</h1>
                <p className="text-sm text-slate-300 mt-1">
                  الاستعلام عن الحجوزات والتذاكر، التتبع المباشر لمعاملات التأشيرات في السفارة، وتقديم طلبات تعديل الرحلات
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/travel-dashboard">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition shadow-md cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                الرجوع للواجهة الرئيسية
              </button>
            </Link>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1">
              خدمة المسافر الذاتية: متاح 24/7
            </Badge>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pr-10 h-12 text-base font-mono rounded-xl border-slate-300"
                  placeholder="ابحث برقم الحجز (PNR) أو رقم التذكرة الإلكترونية أو رقم الجواز..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl w-full sm:w-auto">
                {isSearching ? <RefreshCw className="w-5 h-5 animate-spin ml-2" /> : <Search className="w-5 h-5 ml-2" />}
                استعلام فوري
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="lookup" className="py-2.5 font-semibold flex items-center gap-2">
              <Plane className="w-4 h-4 text-emerald-600" />
              <span>بيانات الحجز والتذكرة الإلكترونية</span>
            </TabsTrigger>
            <TabsTrigger value="visa-tracker" className="py-2.5 font-semibold flex items-center gap-2">
              <Stamp className="w-4 h-4 text-indigo-600" />
              <span>متابعة خطوات التأشيرة بالسفارة (Live Tracker)</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="py-2.5 font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>تقديم ومتابعة طلبات التعديل والاسترجاع</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: BOOKING & E-TICKET DETAILS */}
          <TabsContent value="lookup" className="pt-4 space-y-4">
            {booking ? (
              <div className="space-y-4">
                {/* E-Ticket Boarding Style Card */}
                <Card className="border-2 border-emerald-600/30 overflow-hidden shadow-md">
                  <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                        ✈️
                      </div>
                      <div>
                        <div className="text-xs text-emerald-200 uppercase tracking-wider">التذكرة الإلكترونية الرسمية (E-TICKET RECEIPT)</div>
                        <h2 className="text-lg font-bold">{booking.airline_supplier}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/20 text-white font-mono text-sm">
                        PNR: {booking.pnr}
                      </Badge>
                      <Badge className="bg-emerald-500 text-white text-xs">
                        {booking.status === "confirmed" ? "حجز مؤكد ومصدر" : booking.status}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-6 bg-white">
                    {/* Passenger & Flight Details */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b">
                      <div>
                        <span className="text-xs text-slate-500 block">اسم المسافر الكريم:</span>
                        <span className="font-bold text-base text-slate-900">{booking.passenger_name_ar || booking.passenger_name}</span>
                        <span className="text-xs font-mono text-slate-500 block">{booking.passenger_name_en}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">رقم التذكرة الإلكترونية:</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{booking.ticket_number || "065-2415896321"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">رقم الجواز:</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{booking.passport_number || "K10928374"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">رقم الرحلة:</span>
                        <span className="font-mono font-bold text-indigo-700 text-sm">{booking.flight_number || "SV 112"}</span>
                      </div>
                    </div>

                    {/* Flight Path Graphic */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">محطة المغادرة</div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-1">{booking.origin_city || "الرياض (RUH)"}</div>
                        <div className="text-xs text-slate-600 font-mono mt-0.5">{booking.departure_date}</div>
                      </div>

                      <div className="flex-1 max-w-xs px-6 flex flex-col items-center">
                        <div className="text-xs text-emerald-700 font-semibold mb-1">رحلة مباشرة بدون توقف</div>
                        <div className="w-full h-1 bg-emerald-300 relative flex items-center justify-center">
                          <Plane className="w-5 h-5 text-emerald-700 rotate-90" />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">الدرجة السياحية • 1 حقيبة 23 كجم</div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs text-slate-500">محطة الوصول</div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-1">{booking.destination_city || "دبي (DXB)"}</div>
                        <div className="text-xs text-slate-600 font-mono mt-0.5">{booking.return_date || booking.departure_date}</div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500">
                        لأي تعديل أو إلغاء يرجى استخدام تبويب "تقديم طلب تعديل" أو التواصل عبر واتساب الوكالة.
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-slate-700"
                          onClick={() => {
                            setRequestForm({
                              request_type: "change_date",
                              customer_name: booking.passenger_name_ar || booking.passenger_name || "",
                              customer_phone: booking.customer_phone || "",
                              pnr_or_ticket: booking.pnr || booking.ticket_number || "",
                              preferred_new_date: "",
                              request_details: `طلب تغيير تاريخ الرحلة للحجز ${booking.pnr}`
                            });
                            setActiveTab("requests");
                          }}
                        >
                          طلب تعديل موعد الرحلة
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          onClick={() => window.print()}
                        >
                          <Download className="w-4 h-4 ml-1.5" />
                          تحميل وطباعة التذكرة (PDF)
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-white space-y-3">
                <Plane className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="font-bold text-slate-800">أدخل رقم الحجز PNR في شريط البحث أعلاه</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  يمكنك الاستعلام برقم الحجز مثل (6X9ZKL) أو رقم التذكرة لعرض التذكرة الإلكترونية وتفاصيل الأمتعة والمقاعد.
                </p>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: VISA TRACKER MILESTONE TIMELINE */}
          <TabsContent value="visa-tracker" className="pt-4 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b bg-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Stamp className="w-5 h-5 text-indigo-600" />
                      تتبع مسار معاملة التأشيرة في السفارة خطوة بخطوة (Visa Milestone Tracker)
                    </CardTitle>
                    <CardDescription>
                      متابعة حية لحالة التأشيرة وجواز السفر منذ استلام الوثائق حتى استلام الجواز مختوماً من السفارة
                    </CardDescription>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 self-start sm:self-auto">
                    رقم المعاملة: VSA-889921
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* 7-Steps Milestone Timeline */}
                <div className="relative">
                  <div className="hidden md:block absolute top-5 right-6 left-6 h-1 bg-slate-200 -z-0" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 relative z-10">
                    {[
                      { step: 1, title: "استلام الوثائق", desc: "فحص الجواز والصور", done: true },
                      { step: 2, title: "مراجعة الأبلكيشن", desc: "تعبئة النماذج وسداد الرسوم", done: true },
                      { step: 3, title: "تقديم للسفارة/VFS", desc: "تسليم الملف المعتمد", done: true },
                      { step: 4, title: "موعد البصمة", desc: "التبصيم في المركز", done: true },
                      { step: 5, title: "قيد الدراسة بالقنصلية", desc: "التدقيق الأمني النهائي", done: true, current: true },
                      { step: 6, title: "صدور التأشيرة", desc: "طباعة الاستيكر بالجواز", done: false },
                      { step: 7, title: "جاهز للتسليم", desc: "استلام الجواز من الفرع", done: false }
                    ].map((m) => (
                      <div key={m.step} className="flex flex-col items-center text-center space-y-2">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all ${
                            m.current
                              ? "bg-amber-500 text-white ring-4 ring-amber-200 animate-pulse"
                              : m.done
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {m.done && !m.current ? <CheckCircle2 className="w-5 h-5" /> : m.step}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${m.current ? "text-amber-700" : m.done ? "text-slate-900" : "text-slate-400"}`}>
                            {m.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Box */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-amber-900 text-sm">الحالة الراهنة: جواز السفر قيد المعالجة لدى السفارة (المرحلة 5 من 7)</div>
                    <p className="text-amber-800">
                      تم تسليم كامل الملف وبصمات المسافر بنجاح، ومدة المعالجة المتوقعة من قبل القنصلية هي من 3 إلى 5 أيام عمل. سيتم إشعاركم تلقائياً عبر رسالة واتساب فور وصول الجواز.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CUSTOMER REQUESTS & AGENT INBOX */}
          <TabsContent value="requests" className="pt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Submit New Request */}
              <div className="lg:col-span-5">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Send className="w-5 h-5 text-blue-600" />
                      تقديم طلب تعديل أو استرجاع أو استفسار
                    </CardTitle>
                    <CardDescription>
                      أرسل طلبك مباشرة إلى فريق عمليات الوكالة وسيقوم الموظف المختص بمراجعته فوراً
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">نوع الطلب:</label>
                      <select
                        className="w-full h-10 border rounded-lg px-3 bg-white text-sm"
                        value={requestForm.request_type}
                        onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}
                      >
                        <option value="change_date">تغيير تاريخ / موعد الرحلة (Reissue)</option>
                        <option value="refund_ticket">طلب استرجاع التذكرة (Refund)</option>
                        <option value="extra_baggage">إضافة حقائب وأمتعة إضافية</option>
                        <option value="seat_meal">اختيار مقعد أو وجبة خاصة</option>
                        <option value="general_inquiry">استفسار عام عن الحجز</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">اسم العميل:</label>
                      <Input
                        value={requestForm.customer_name}
                        onChange={(e) => setRequestForm({ ...requestForm, customer_name: e.target.value })}
                        placeholder="الاسم الكامل"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">رقم الهاتف (الواتساب للتواصل):</label>
                      <Input
                        value={requestForm.customer_phone}
                        onChange={(e) => setRequestForm({ ...requestForm, customer_phone: e.target.value })}
                        placeholder="050xxxxxxx"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold block mb-1">رقم PNR أو التذكرة:</label>
                        <Input
                          value={requestForm.pnr_or_ticket}
                          onChange={(e) => setRequestForm({ ...requestForm, pnr_or_ticket: e.target.value })}
                          placeholder="6X9ZKL"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">التاريخ الجديد المقترح:</label>
                        <Input
                          type="date"
                          value={requestForm.preferred_new_date}
                          onChange={(e) => setRequestForm({ ...requestForm, preferred_new_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">تفاصيل الطلب وملاحظات المسافر:</label>
                      <Textarea
                        rows={3}
                        value={requestForm.request_details}
                        onChange={(e) => setRequestForm({ ...requestForm, request_details: e.target.value })}
                        placeholder="يرجى كتابة أية تفاصيل إضافية هنا..."
                      />
                    </div>

                    {requestForm.request_type === "change_date" && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px]">
                        ℹ️ رسوم تعديل الحجز الإدارية: <strong>200 SAR</strong> (بالإضافة إلى فروقات أسعار خطوط الطيران إن وجدت).
                      </div>
                    )}

                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 text-sm mt-2"
                      onClick={() => submitRequestMutation.mutate(requestForm)}
                      disabled={submitRequestMutation.isPending}
                    >
                      {submitRequestMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                      إرسال الطلب لفريق العمل 🚀
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Agency Agent Live Inbox */}
              <div className="lg:col-span-7">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                    <CardTitle className="text-base font-bold">صندوق طلبات المسافرين الواردة (Agent Inbox)</CardTitle>
                    <CardDescription>الطلبات المقدمة أونلاين عبر البوابة الذاتية</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-slate-100/80 text-slate-700 border-b">
                          <tr>
                            <th className="p-3">كود الطلب</th>
                            <th className="p-3">اسم العميل</th>
                            <th className="p-3">نوع الطلب</th>
                            <th className="p-3">PNR / التذكرة</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {agentRequests?.map((reqItem: any) => (
                            <tr key={reqItem.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-indigo-600">{reqItem.request_code}</td>
                              <td className="p-3 font-semibold text-slate-900">
                                <div>{reqItem.customer_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{reqItem.customer_phone}</div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="bg-slate-50">
                                  {reqItem.request_type === "change_date"
                                    ? "تعديل تاريخ"
                                    : reqItem.request_type === "refund_ticket"
                                    ? "استرجاع"
                                    : "استفسار"}
                                </Badge>
                              </td>
                              <td className="p-3 font-mono">{reqItem.pnr_or_ticket || "—"}</td>
                              <td className="p-3">
                                <Badge
                                  className={
                                    reqItem.status === "actioned"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : reqItem.status === "rejected"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                  }
                                >
                                  {reqItem.status === "actioned" ? "تمت المعالجة" : reqItem.status === "rejected" ? "مرفوض" : "جديد قيد المراجعة"}
                                </Badge>
                              </td>
                              <td className="p-3 text-slate-500 font-mono">{reqItem.created_at?.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
