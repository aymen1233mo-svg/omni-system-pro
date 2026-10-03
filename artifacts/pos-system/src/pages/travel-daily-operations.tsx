import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, Plane, Hotel, Car, CheckCircle2, Clock,
  AlertTriangle, ArrowUpRight, ArrowDownLeft, FileText, CheckSquare,
  ShieldCheck, RefreshCw, Plus, Phone, Search, Users, ExternalLink,
  DollarSign, Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }

export default function TravelDailyOperationsPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<"flights" | "hotels" | "transports" | "visas" | "tasks">("flights");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: opsData, isLoading, refetch } = useQuery({
    queryKey: ["travel-daily-operations", selectedDate],
    queryFn: () => apiGet(`/api/travel/daily-operations?date=${selectedDate}`),
    refetchInterval: 30000
  });

  const flights = opsData?.flights || [];
  const hotels = opsData?.hotels || [];
  const transports = opsData?.transports || [];
  const visas = opsData?.visas || [];
  const tasks = opsData?.tasks || [];
  const financial = opsData?.financial || {};
  const safes = opsData?.safes || [];

  const filterItems = (list: any[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => 
      (item.customer_name || "").toLowerCase().includes(q) ||
      (item.passenger_name_ar || "").toLowerCase().includes(q) ||
      (item.title || "").toLowerCase().includes(q) ||
      (item.ticket_number || "").toLowerCase().includes(q) ||
      (item.pnr || "").toLowerCase().includes(q) ||
      (item.hotel_name || "").toLowerCase().includes(q)
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-2xl p-6 text-white shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/30 rounded-xl">
                <Calendar className="w-7 h-7 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  مركز العمليات والمتابعة اليومية
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Operations
                  </span>
                </h1>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  غرفة التحكم المركزية لكافة الرحلات، الفنادق، النقل، التأشيرات، والمهام المستحقة اليوم
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-xs text-slate-300 font-bold whitespace-nowrap">تاريخ العمليات:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white border-0 focus:outline-none font-mono"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="bg-indigo-600/30 hover:bg-indigo-600/50 border-indigo-400/40 text-white text-xs h-9"
            >
              <RefreshCw className="w-3.5 h-3.5 ml-1.5 animate-spin-reverse" />
              تحديث البيانات
            </Button>
          </div>
        </div>

        {/* Top KPIs Metric Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-indigo-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">رحلات اليوم</span>
              <Plane className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{flights.length}</div>
            <span className="text-[10px] text-slate-400 font-medium">مغادرة ووصول</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">حركات الفنادق</span>
              <Hotel className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{hotels.length}</div>
            <span className="text-[10px] text-slate-400 font-medium">دخول ومغادرة</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">النقل والمواصلات</span>
              <Car className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{transports.length}</div>
            <span className="text-[10px] text-slate-400 font-medium">استقبال وتوصيل</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-purple-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">تأشيرات قيد المتابعة</span>
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{visas.length}</div>
            <span className="text-[10px] text-slate-400 font-medium">سفارات ومواعيد</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-rose-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">مهام مستحقة</span>
              <CheckSquare className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{tasks.length}</div>
            <span className="text-[10px] text-rose-500 font-semibold">متابعات الموظفين</span>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700">مبيعات اليوم</span>
              <DollarSign className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="text-2xl font-black text-indigo-900 mt-2">
              {Number(financial.total_ticket_sales || 0).toLocaleString()} <span className="text-xs font-bold">ريال</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">
              ربح: {Number(financial.total_ticket_profit || 0).toLocaleString()} ريال
            </span>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab("flights")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "flights"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Plane className="w-4 h-4" />
              رحلات الطيران اليوم ({flights.length})
            </button>

            <button
              onClick={() => setActiveTab("visas")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "visas"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              متابعات التأشيرات ({visas.length})
            </button>

            <button
              onClick={() => setActiveTab("hotels")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "hotels"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Hotel className="w-4 h-4" />
              الفنادق والتسكين ({hotels.length})
            </button>

            <button
              onClick={() => setActiveTab("transports")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "transports"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Car className="w-4 h-4" />
              النقل والمطارات ({transports.length})
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "tasks"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              مهام الموظفين ({tasks.length})
            </button>
          </div>

          <div className="w-full md:w-64">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <Input
                placeholder="بحث في عمليات اليوم..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pr-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Content Tab Details */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400 font-bold">جاري تحميل العمليات اليومية...</div>
        ) : (
          <div>
            {/* 1. FLIGHTS TAB */}
            {activeTab === "flights" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Plane className="w-4 h-4 text-blue-600" />
                    جدول رحلات وتذاكر اليوم (مغادرة / عودة / إصدار)
                  </h3>
                  <Link href="/travel/bookings">
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs h-8">
                      سجل الحجوزات الكامل
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/70 border-b text-slate-600">
                      <tr>
                        <th className="p-3 text-right">رقم PNR / التذكرة</th>
                        <th className="p-3 text-right">العميل / المسافر</th>
                        <th className="p-3 text-right">الناقل ورقم الرحلة</th>
                        <th className="p-3 text-right">خط السير والوجهة</th>
                        <th className="p-3 text-center">التوقيت</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3 text-left">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {filterItems(flights).map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-700">
                            <div>{b.pnr || "—"}</div>
                            <div className="text-[10px] text-slate-400">{b.ticket_number || b.booking_number}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{b.customer_name || "عميل عام"}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              {b.passenger_name_ar || b.passenger_name_en || "مسافر"}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold">{b.airline_name || "طيران"}</span>
                            {b.flight_number && <span className="text-[10px] text-slate-500 block font-mono">{b.flight_number}</span>}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{b.routing_details || `${b.origin_city || ''} -> ${b.destination_city || ''}`}</div>
                            <div className="text-[10px] text-slate-400">{b.travel_class || "اقتصادية"}</div>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <div className="text-slate-800 font-bold">{b.departure_time || "—"}</div>
                            <div className="text-[10px] text-slate-400">{b.departure_date}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                              b.status === 'refunded' ? 'bg-amber-100 text-amber-800' :
                              b.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {b.status === 'confirmed' ? 'مؤكد' : b.status === 'refunded' ? 'مسترجع' : b.status === 'cancelled' ? 'ملغي' : b.status}
                            </span>
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-slate-900">
                            {Number(b.selling_price || 0).toLocaleString()} ريال
                          </td>
                        </tr>
                      ))}
                      {flights.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400">
                            لا توجد رحلات مجدولة في تاريخ {selectedDate}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. VISAS TAB */}
            {activeTab === "visas" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    متابعات معاملات التأشيرات والمواعيد القادمة
                  </h3>
                  <Link href="/travel/visas">
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs h-8">
                      إدارة التأشيرات
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/70 border-b text-slate-600">
                      <tr>
                        <th className="p-3 text-right">رقم الطلب / الدولة</th>
                        <th className="p-3 text-right">العميل / المسافر</th>
                        <th className="p-3 text-right">نوع التأشيرة</th>
                        <th className="p-3 text-center">تاريخ التقديم / المتوقع</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3 text-right">ملاحظات ومتابعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {filterItems(visas).map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-indigo-700 font-mono">{v.application_number || `VSA-${v.id}`}</div>
                            <div className="text-[11px] font-bold text-slate-800">{v.country}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{v.customer_name || "عميل"}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{v.passport_number || v.passenger_name_ar}</div>
                          </td>
                          <td className="p-3 font-semibold">{v.visa_type || "سياحة"}</td>
                          <td className="p-3 text-center font-mono">
                            <div className="text-slate-800 font-bold">{v.submission_date || "—"}</div>
                            <div className="text-[10px] text-indigo-600">المتوقع: {v.expected_issue_date || "قريباً"}</div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {v.status || "قيد المعالجة"}
                            </span>
                          </td>
                          <td className="p-3 max-w-[200px] truncate text-slate-500">
                            {v.notes || "لا توجد ملاحظات"}
                          </td>
                        </tr>
                      ))}
                      {visas.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400">
                            لا توجد معاملات تأشيرات قيد المتابعة اليوم
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. HOTELS TAB */}
            {activeTab === "hotels" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Hotel className="w-4 h-4 text-amber-600" />
                    حركات دخول ومغادرة الفنادق اليوم (Check-in / Check-out)
                  </h3>
                  <Link href="/travel/hotels">
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs h-8">
                      حجوزات الفنادق
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/70 border-b text-slate-600">
                      <tr>
                        <th className="p-3 text-right">الفندق والمدينة</th>
                        <th className="p-3 text-right">العميل والنزلاء</th>
                        <th className="p-3 text-center">الدخول (Check-in)</th>
                        <th className="p-3 text-center">المغادرة (Check-out)</th>
                        <th className="p-3 text-center">الغرف / الليالي</th>
                        <th className="p-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {filterItems(hotels).map((h: any) => (
                        <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{h.hotel_name}</div>
                            <div className="text-[10px] text-slate-500">{h.city} - {h.room_type || "غرفة قياسية"}</div>
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            {h.customer_name || "عميل"}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-700">
                            {h.check_in_date}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-rose-700">
                            {h.check_out_date}
                          </td>
                          <td className="p-3 text-center font-mono">
                            {h.rooms_count || 1} غرف / {h.nights_count || 1} ليالي
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {h.status || "مؤكد"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {hotels.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400">
                            لا توجد حركات فنادق مسجلة لتاريخ {selectedDate}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. TRANSPORTS TAB */}
            {activeTab === "transports" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Car className="w-4 h-4 text-emerald-600" />
                    خدمات الاستقبال والتوصيل والنقل السياحي اليوم
                  </h3>
                  <Link href="/travel/transport">
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs h-8">
                      إدارة النقل
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100/70 border-b text-slate-600">
                      <tr>
                        <th className="p-3 text-right">العميل</th>
                        <th className="p-3 text-right">نوع الخدمة والمركبة</th>
                        <th className="p-3 text-right">نقطة الانطلاق إلى الوصول</th>
                        <th className="p-3 text-center">التاريخ والوقت</th>
                        <th className="p-3 text-right">السائق / المورد</th>
                        <th className="p-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700">
                      {filterItems(transports).map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-900">{t.customer_name || "عميل"}</td>
                          <td className="p-3">
                            <span className="font-bold">{t.transport_type || "توصيل مطار"}</span>
                            <span className="text-[10px] text-slate-400 block">{t.vehicle_type || "سيارة خاصة"}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-700">
                            {t.pickup_location || "المطار"} ← {t.dropoff_location || "الفندق"}
                          </td>
                          <td className="p-3 text-center font-mono">
                            <span className="font-bold text-slate-800">{t.pickup_time || "—"}</span>
                            <span className="text-[10px] text-slate-400 block">{t.pickup_date}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-800">{t.driver_name || t.supplier_name || "شركة النقل"}</span>
                            {t.driver_phone && <span className="text-[10px] text-slate-400 block font-mono">{t.driver_phone}</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {t.status || "مجدول"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {transports.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400">
                            لا توجد خدمات نقل مسجلة لتاريخ {selectedDate}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. TASKS TAB */}
            {activeTab === "tasks" && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                    المهام والمتابعات اليومية المستحقة
                  </h3>
                  <Link href="/travel/tasks">
                    <Button onClick={() => typeof toast !== 'undefined' ? toast({title: "هذه الميزة تحت التطوير (Onyx ERP)"}) : alert("تحت التطوير")} variant="outline" size="sm" className="text-xs h-8">
                      مركز المهام الكامل
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                    </Button>
                  </Link>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filterItems(tasks).map((tsk: any) => (
                    <div
                      key={tsk.id}
                      className={`p-4 rounded-xl border transition-all ${
                        tsk.priority === 'urgent' ? 'bg-rose-50/60 border-rose-200' :
                        tsk.priority === 'high' ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          tsk.priority === 'urgent' ? 'bg-rose-600 text-white' :
                          tsk.priority === 'high' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {tsk.priority === 'urgent' ? 'عاجل جداً' : tsk.priority === 'high' ? 'أولوية عالية' : 'عادي'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          استحقاق: {tsk.due_date || "اليوم"}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs mb-1">{tsk.title}</h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                        {tsk.description || "لا يوجد وصف إضافي"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200/70">
                        <span>المسؤول: <strong>{tsk.assigned_to_name || "الكل"}</strong></span>
                        <span className="font-semibold text-indigo-700">{tsk.status === 'completed' ? 'مكتمل' : 'قيد المتابعة'}</span>
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="col-span-3 p-12 text-center text-slate-400">
                      لا توجد مهام مستحقة في تاريخ {selectedDate}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
