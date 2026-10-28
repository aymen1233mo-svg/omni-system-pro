import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  FileText, 
  Calendar, 
  Building2, 
  Users, 
  Ticket, 
  Globe, 
  DollarSign, 
  Printer, 
  Download, 
  Filter, 
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

function fetchAuth(url: string) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

export default function TravelReportsPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "tickets" | "financials" | "visas_hotels" | "employees" | "branches">("sales");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Fetch branches
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["branches-list"],
    queryFn: () => fetchAuth("/api/branches")
  });

  // Fetch comprehensive report data
  const { data: report, isLoading, refetch } = useQuery<any>({
    queryKey: ["travel-reports-comp", startDate, endDate, selectedBranch],
    queryFn: () => fetchAuth(`/api/travel/reports/comprehensive?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`)
  });

  // Fetch branch summary
  const { data: branchSummaries = [] } = useQuery<any[]>({
    queryKey: ["travel-branches-summary"],
    queryFn: () => fetchAuth("/api/travel/branches/summary")
  });

  const handlePrint = () => {
    window.print();
  };

  const overall = report?.overall_stats || {};
  const salesByService = report?.sales_by_service || [];
  const ticketOps = report?.ticket_operations || [];
  const airlineRep = report?.airline_report || [];
  const employeePerf = report?.employee_performance || [];
  const visasSummary = report?.visas_summary || [];
  const hotelsSummary = report?.hotels_summary || [];

  return (
    <AdminLayout>
      <div className="space-y-6 print:space-y-4" dir="rtl">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 bg-white p-4 rounded-xl shadow-sm print:shadow-none print:border-b-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              مركز تقارير السفريات والسياحة الشامل (Reports Center)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              تقارير تفصيلية تحليلية للمبيعات، التذاكر، الأرباح، الحسابات، التأشيرات، الموظفين، والفروع
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex items-center gap-1 bg-slate-50 border rounded-lg p-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-7 text-xs border-0 bg-transparent w-28 px-1"
              />
              <span className="text-slate-400">إلى</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-7 text-xs border-0 bg-transparent w-28 px-1"
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="h-9 text-xs border rounded-lg px-2.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">🏢 كافة الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-9 text-xs gap-1.5 border-slate-300 shadow-sm hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة التقرير (A4)
            </Button>
          </div>
        </div>

        {/* Global Summary KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500">إجمالي المبيعات (Gross Sales)</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{(overall.grand_sales || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">{overall.total_records || 0} عملية مسجلة</p>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500">التكلفة الإجمالية (Cost of Sales)</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{(overall.grand_cost || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">تكلفة الموردين والخطوط</p>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500">صافي ربح الوكالة (Net Profit)</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{(overall.grand_profit || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span></p>
            <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
              هامش الربح: {overall.grand_sales > 0 ? ((overall.grand_profit / overall.grand_sales) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500">الذمم غير المحصلة (Receivables)</p>
            <p className="text-lg font-bold text-amber-600 mt-1">{(overall.unpaid_receivables || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span></p>
            <p className="text-[10px] text-amber-700 mt-0.5">مبالغ مؤجلة على العملاء</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto print:hidden">
          {[
            { id: "sales", label: "📊 تقرير المبيعات الشامل", icon: TrendingUp },
            { id: "tickets", label: "✈️ تقرير التذاكر وشركات الطيران", icon: Ticket },
            { id: "financials", label: "💰 تقرير الأرباح والحسابات", icon: DollarSign },
            { id: "visas_hotels", label: "🛂 التأشيرات والفنادق", icon: Globe },
            { id: "employees", label: "👤 أداء الموظفين والوكلاء", icon: Users },
            { id: "branches", label: "🏢 مقارنة أداء الفروع", icon: Building2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: SALES REPORT */}
        {activeTab === "sales" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales by Service Chart */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <PieChartIcon className="w-4 h-4 text-primary" />
                  توزيع المبيعات حسب نوع الخدمة (Sales by Service)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByService}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="service_type" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => `${Number(value).toLocaleString()} ريال`} />
                      <Bar dataKey="total_sales" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_profit" name="الأرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table Breakdown */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  جدول تفصيلي لحجم المبيعات والعمولات
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 font-semibold">نوع الخدمة</th>
                        <th className="p-2 font-semibold">العمليات</th>
                        <th className="p-2 font-semibold">المبيعات</th>
                        <th className="p-2 font-semibold">التكلفة</th>
                        <th className="p-2 font-semibold">صافي الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {salesByService.map((s: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold text-slate-800">{s.service_type || "خدمة"}</td>
                          <td className="p-2">{s.total_count}</td>
                          <td className="p-2 font-semibold text-blue-600">{Number(s.total_sales).toLocaleString()} ريال</td>
                          <td className="p-2 text-slate-600">{Number(s.total_cost).toLocaleString()} ريال</td>
                          <td className="p-2 font-bold text-emerald-600">{Number(s.total_profit).toLocaleString()} ريال</td>
                        </tr>
                      ))}
                      {salesByService.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد بيانات للفترة المحددة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TICKETS REPORT */}
        {activeTab === "tickets" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Airline Performance */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-primary" />
                  مبيعات وأرباح شركات الطيران (Airline Sales)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 font-semibold">شركة الطيران</th>
                        <th className="p-2 font-semibold">عدد التذاكر</th>
                        <th className="p-2 font-semibold">إجمالي المبيعات</th>
                        <th className="p-2 font-semibold">أرباح الوكالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {airlineRep.map((a: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold text-slate-800">✈️ {a.airline}</td>
                          <td className="p-2">{a.ticket_count} تذكرة</td>
                          <td className="p-2 font-semibold text-blue-600">{Number(a.total_sales).toLocaleString()} ريال</td>
                          <td className="p-2 font-bold text-emerald-600">{Number(a.total_profit).toLocaleString()} ريال</td>
                        </tr>
                      ))}
                      {airlineRep.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400">لا توجد تذاكر طيران مسجلة</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ticket Status Breakdown */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  حركة التذاكر (مصدرة، ملغاة، مسترجعة)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {ticketOps.map((op: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 border rounded-lg">
                      <span className="text-[11px] font-semibold text-slate-600 block capitalize">
                        الحالة: {op.status === "issued" ? "مصدرة" : op.status === "confirmed" ? "مؤكدة" : op.status === "cancelled" ? "ملغاة" : op.status === "refunded" ? "مسترجعة" : op.status}
                      </span>
                      <p className="text-base font-bold text-slate-900 mt-1">{op.count} تذكرة</p>
                      <p className="text-xs font-semibold text-primary mt-0.5">{Number(op.sales_amount).toLocaleString()} ريال</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIALS REPORT */}
        {activeTab === "financials" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-900">إجمالي الأرباح الصافية المحققة</h4>
                <p className="text-xl font-black text-emerald-700 mt-2">{(overall.grand_profit || 0).toLocaleString()} ريال</p>
                <p className="text-[10px] text-emerald-600 mt-1">شاملة العمولات ورسوم الخدمات</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="text-xs font-bold text-blue-900">إجمالي المبيعات الإجمالية</h4>
                <p className="text-xl font-black text-blue-700 mt-2">{(overall.grand_sales || 0).toLocaleString()} ريال</p>
                <p className="text-[10px] text-blue-600 mt-1">حجم التداول المالي للفترة</p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <h4 className="text-xs font-bold text-amber-900">المستحقات والذمم المدينة</h4>
                <p className="text-xl font-black text-amber-700 mt-2">{(overall.unpaid_receivables || 0).toLocaleString()} ريال</p>
                <p className="text-[10px] text-amber-600 mt-1">مبالغ قيد التحصيل من العملاء والشركات</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VISAS & HOTELS */}
        {activeTab === "visas_hotels" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Visas */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-amber-600" />
                  تقرير التأشيرات حسب الدولة والحالة
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 font-semibold">الدولة</th>
                        <th className="p-2 font-semibold">الحالة</th>
                        <th className="p-2 font-semibold">العدد</th>
                        <th className="p-2 font-semibold">المبيعات</th>
                        <th className="p-2 font-semibold">الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visasSummary.map((v: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold text-slate-800">{v.country}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px]">
                              {v.status}
                            </span>
                          </td>
                          <td className="p-2 font-semibold">{v.count}</td>
                          <td className="p-2 text-blue-600 font-semibold">{Number(v.total_sales).toLocaleString()} ريال</td>
                          <td className="p-2 text-emerald-600 font-bold">{Number(v.total_profit).toLocaleString()} ريال</td>
                        </tr>
                      ))}
                      {visasSummary.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">لا توجد تأشيرات للفترة</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hotels */}
              <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  تقرير مبيعات وأرباح الفنادق
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 font-semibold">الفندق</th>
                        <th className="p-2 font-semibold">الليالي</th>
                        <th className="p-2 font-semibold">المبيعات</th>
                        <th className="p-2 font-semibold">الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {hotelsSummary.map((h: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold text-slate-800">🏨 {h.hotel_name}</td>
                          <td className="p-2">{h.total_nights} ليلة</td>
                          <td className="p-2 font-semibold text-blue-600">{Number(h.total_sales).toLocaleString()} ريال</td>
                          <td className="p-2 font-bold text-emerald-600">{Number(h.total_profit).toLocaleString()} ريال</td>
                        </tr>
                      ))}
                      {hotelsSummary.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-400">لا توجد حجوزات فنادق</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: EMPLOYEES REPORT */}
        {activeTab === "employees" && (
          <div className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              تقرير إنتاجية ومبيعات الموظفين والوكلاء (Employee Productivity)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="p-2 font-semibold">الموظف / الوكيل</th>
                    <th className="p-2 font-semibold">عدد العمليات</th>
                    <th className="p-2 font-semibold">إجمالي المبيعات</th>
                    <th className="p-2 font-semibold">صافي الربح المحقق</th>
                    <th className="p-2 font-semibold">العمليات الملغاة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employeePerf.map((emp: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2 font-bold text-slate-800 flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                          {emp.agent_name?.[0] || "م"}
                        </div>
                        {emp.agent_name}
                      </td>
                      <td className="p-2 font-semibold">{emp.bookings_count} عملية</td>
                      <td className="p-2 font-bold text-blue-600">{Number(emp.total_sales).toLocaleString()} ريال</td>
                      <td className="p-2 font-bold text-emerald-600">{Number(emp.total_profit).toLocaleString()} ريال</td>
                      <td className="p-2 text-red-600 font-semibold">{emp.cancelled_count || 0}</td>
                    </tr>
                  ))}
                  {employeePerf.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-400">لا توجد بيانات موظفين</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: BRANCHES REPORT */}
        {activeTab === "branches" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {branchSummaries.map((b: any) => (
                <div key={b.id} className="bg-white p-4 border rounded-xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      {b.name}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      نشط
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">حجم المبيعات:</span>
                      <span className="font-bold text-blue-600">{Number(b.total_sales).toLocaleString()} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">صافي الأرباح:</span>
                      <span className="font-bold text-emerald-600">{Number(b.total_profit).toLocaleString()} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">رصيد الصندوق:</span>
                      <span className="font-bold text-slate-800">{Number(b.safe_balance).toLocaleString()} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">عدد الحجوزات:</span>
                      <span className="font-semibold">{b.bookings_count} حجز</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الموظفون:</span>
                      <span className="font-semibold">{b.employees_count} موظف</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
