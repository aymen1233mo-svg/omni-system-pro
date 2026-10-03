import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Loader2, DollarSign, Plane, Ticket, Globe, Hotel, TrendingUp, AlertTriangle, Users, Wallet, ShieldAlert, Calendar, CheckCircle2, Bus, Luggage, RotateCcw, ArrowLeft, Sparkles, Building2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = (typeof window !== "undefined" ? (sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token")) : "") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLORS = ["#1e3a5f", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function TravelDashboardPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["travel-dashboard-stats"],
    queryFn: () => fetchWithAuth("/api/travel/dashboard-stats")
  });

  if (isLoading || !data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const kpis = data.kpis || {};
  const charts = data.charts || {};
  const alerts = data.alerts || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Plane className="w-7 h-7 text-primary" />
              لوحة قيادة شركة السفر والسياحة ERP
            </h1>
            <p className="text-sm text-muted-foreground">
              متابعة العمليات التشغيلية، مبيعات التذاكر، التأشيرات، الفنادق، أرباح العمولات والتنبيهات المباشرة
            </p>
          </div>
          <div className="text-sm text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-lg font-medium self-start sm:self-auto">
            📅 {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Row 1: Primary Financial & Travel KPIs */}
        <div>
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">المؤشرات التشغيلية والمالية الرئيسية</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border-r-4 border-r-primary shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">مبيعات اليوم</p>
                <p className="text-lg font-bold font-mono text-slate-900 mt-1">{fmt(kpis.todaySales)} ريال</p>
                <p className="text-[11px] text-muted-foreground">{kpis.todayBookings} حجز اليوم</p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-blue-500 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">مبيعات الشهر</p>
                <p className="text-lg font-bold font-mono text-blue-700 mt-1">{fmt(kpis.monthSales)} ريال</p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-emerald-500 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">عمولة المكتب (الشهر)</p>
                <p className="text-lg font-bold font-mono text-emerald-700 mt-1">{fmt(kpis.monthCommission)} ريال</p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-indigo-500 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">صافي الأرباح</p>
                <p className="text-lg font-bold font-mono text-indigo-700 mt-1">{fmt(kpis.netProfit)} ريال</p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-amber-500 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">مستحق على العملاء</p>
                <p className="text-lg font-bold font-mono text-amber-700 mt-1">{fmt(kpis.customerDebts)} ريال</p>
              </CardContent>
            </Card>

            <Card className="border-r-4 border-r-purple-500 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">رصيد الخزائن والصندوق</p>
                <p className="text-lg font-bold font-mono text-purple-700 mt-1">{fmt(kpis.safeBalance)} ريال</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 2: 5 Quick Access Shortcuts */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              اختصارات الوصول السريع لخدمات وشاشات النظام الرئيسية
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
              انقر على أي اختصار للانتقال الفوري للشاشة المطلوبة ⚡
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* الاختصار رقم 1: شاشة إدارة العملاء والشركات (نظام السفريات) */}
            <Link href="/customers" className="block focus:outline-none">
              <Card
                id="shortcut-card-1-customers"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-indigo-500/40 hover:border-indigo-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      اختصار 1
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/25 transition-all">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">نظام السفريات والسياحة</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors mt-0.5 line-clamp-1">
                      إدارة العملاء والشركات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-indigo-300">
                        {kpis.customersCount ?? 4}
                      </span>
                      <span className="text-[11px] text-slate-400">عميل / شركة</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-indigo-300 font-medium group-hover:text-indigo-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-indigo-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 2: شاشة معاملات وخدمات التأشيرات (خدمات وحجوزات السفر) */}
            <Link href="/travel-visas" className="block focus:outline-none">
              <Card
                id="shortcut-card-2-visas"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-teal-500/40 hover:border-teal-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30">
                      اختصار 2
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/25 transition-all">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-teal-200 transition-colors mt-0.5 line-clamp-1">
                      معاملات وخدمات التأشيرات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-teal-300">
                        {kpis.visaTransactions ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">معاملة تأشيرة</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-teal-300 font-medium group-hover:text-teal-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-teal-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 3: شاشة حجوزات النقل البري (خدمات وحجوزات السفر) */}
            <Link href="/travel-bus-tickets" className="block focus:outline-none">
              <Card
                id="shortcut-card-3-bus"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      اختصار 3
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all">
                      <Bus className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-200 transition-colors mt-0.5 line-clamp-1">
                      حجوزات النقل البري والباصات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-emerald-300">
                        {kpis.busBookingsCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">تذكرة وحجز</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-300 font-medium group-hover:text-emerald-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-emerald-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 4: شاشة إدارة المسافرين والجوازات (نظام السفريات) */}
            <Link href="/passengers" className="block focus:outline-none">
              <Card
                id="shortcut-card-4-passengers"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      اختصار 4
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/25 transition-all">
                      <Luggage className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">نظام السفريات والسياحة</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors mt-0.5 line-clamp-1">
                      إدارة المسافرين والجوازات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-amber-300">
                        {kpis.passengersCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">مسافر مسجل</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-300 font-medium group-hover:text-amber-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-amber-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* الاختصار رقم 5: شاشة فواتير ومردودات الخدمات والاسترجاع المعاملات (خدمات وحجوزات السفر) */}
            <Link href="/travel-refunds" className="block focus:outline-none">
              <Card
                id="shortcut-card-5-refunds"
                className="bg-slate-900 text-white hover:bg-slate-800 border border-rose-500/40 hover:border-rose-400 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl group relative overflow-hidden h-full flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
                <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30">
                      اختصار 5
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/25 transition-all">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">خدمات وحجوزات السفر</p>
                    <h3 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors mt-0.5 line-clamp-1">
                      فواتير ومردودات الخدمات
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-2xl font-bold font-mono text-rose-300">
                        {kpis.refundsCount ?? 0}
                      </span>
                      <span className="text-[11px] text-slate-400">عملية استرجاع</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-rose-300 font-medium group-hover:text-rose-200">
                    <span className="font-semibold">فتح الشاشة</span>
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform text-rose-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">أكثر شركات الطيران استخداماً</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.airlineStats || []} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [fmt(v), "المبيعات"]} />
                  <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">أكثر الوجهات والمدن طلبًا</CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.destStats || []} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, "عدد الحجوزات"]} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Smart Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alert 1: Expiring Passports */}
          <Card className="border-t-4 border-t-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                جوازات سفر تنتهي قريباً (خلال 6 أشهر)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {alerts.expiringPassports?.length === 0 ? (
                <p className="text-muted-foreground p-2">لا توجد جوازات تنتهي قريباً ✅</p>
              ) : (
                alerts.expiringPassports?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
                    <div>
                      <p className="font-bold text-slate-900">{p.name_ar}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.passport_number}</p>
                    </div>
                    <span className="font-mono text-amber-800 font-bold">{p.passport_expiry_date}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alert 2: Pending Visas */}
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                <Globe className="w-4 h-4 text-blue-600" />
                تأشيرات قيد المتابعة والوثائق الناقصة
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {alerts.pendingVisas?.length === 0 ? (
                <p className="text-muted-foreground p-2">لا توجد تأشيرات قيد الانتظار ✅</p>
              ) : (
                alerts.pendingVisas?.map((v: any) => (
                  <div key={v.id} className="p-2 bg-blue-50 rounded border border-blue-200 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{v.customer_name} ({v.country})</span>
                      <span className="font-mono text-[10px] bg-blue-200 px-1.5 py-0.5 rounded">{v.visa_number}</span>
                    </div>
                    {v.missing_docs && <p className="text-amber-800 font-bold">⚠️ نواقص: {v.missing_docs}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alert 3: Upcoming Flights */}
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-900">
                <Plane className="w-4 h-4 text-emerald-600" />
                رحلات قادمة (خلال الـ 7 أيام القادمة)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {alerts.upcomingFlights?.length === 0 ? (
                <p className="text-muted-foreground p-2">لا توجد مغادرات قريبة جداً ✅</p>
              ) : (
                alerts.upcomingFlights?.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                    <div>
                      <p className="font-bold text-slate-900">{f.customer_name} - {f.destination_city}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{f.airline_supplier} ({f.flight_number})</p>
                    </div>
                    <span className="font-mono text-emerald-800 font-bold">{f.departure_date}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
