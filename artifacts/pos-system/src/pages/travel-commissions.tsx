import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Coins,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Plane,
  Users,
  Hotel,
  ShieldCheck,
  Edit,
  Trash2,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  X,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Commission {
  id: number;
  commission_code: string;
  commission_type: 'airline' | 'hotel' | 'supplier' | 'employee' | 'agent' | 'branch';
  entity_id?: number;
  entity_name: string;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  currency: string;
  expected_amount: number;
  received_amount: number;
  due_amount: number;
  paid_amount: number;
  difference: number;
  status: 'pending' | 'partially_received' | 'received' | 'paid' | 'settled';
  due_date?: string;
  payment_date?: string;
  notes?: string;
  user_name?: string;
  created_at: string;
}

export default function TravelCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<Commission | null>(null);

  // Form state
  const [form, setForm] = useState({
    commission_type: "airline",
    entity_name: "",
    reference_type: "booking",
    reference_number: "",
    currency: "ريال",
    expected_amount: "",
    received_amount: "0",
    paid_amount: "0",
    due_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const [settleForm, setSettleForm] = useState({
    add_received: "",
    add_paid: "",
    notes: ""
  });

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      let url = "/api/travel/commissions?";
      if (typeFilter !== "all") url += `type=${typeFilter}&`;
      if (statusFilter !== "all") url += `status=${statusFilter}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const [resComms, resStats] = await Promise.all([
        fetch(url),
        fetch("/api/travel/commissions/stats")
      ]);

      if (resComms.ok) {
        const data = await resComms.json();
        setCommissions(data);
      }
      if (resStats.ok) {
        const sData = await resStats.json();
        setStats(sData);
      }
    } catch (e) {
      console.error("Failed to load commissions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [typeFilter, statusFilter, searchQuery]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/commissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          expected_amount: Number(form.expected_amount || 0),
          received_amount: Number(form.received_amount || 0),
          paid_amount: Number(form.paid_amount || 0)
        })
      });

      if (res.ok) {
        setIsAddOpen(false);
        setForm({
          commission_type: "airline",
          entity_name: "",
          reference_type: "booking",
          reference_number: "",
          currency: "ريال",
          expected_amount: "",
          received_amount: "0",
          paid_amount: "0",
          due_date: new Date().toISOString().slice(0, 10),
          notes: ""
        });
        fetchCommissions();
      } else {
        const err = await res.json();
        alert(err.error || "فشل حفظ بيانات العمولة");
      }
    } catch (e: any) {
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComm) return;

    const newReceived = selectedComm.received_amount + Number(settleForm.add_received || 0);
    const newPaid = selectedComm.paid_amount + Number(settleForm.add_paid || 0);
    const due = Math.max(0, selectedComm.expected_amount - newReceived);

    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/commissions/${selectedComm.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          received_amount: newReceived,
          paid_amount: newPaid,
          due_amount: due,
          payment_date: new Date().toISOString().slice(0, 10),
          notes: settleForm.notes ? `${selectedComm.notes || ''} | تسوية: ${settleForm.notes}` : selectedComm.notes
        })
      });

      if (res.ok) {
        setIsSettleOpen(false);
        setSelectedComm(null);
        setSettleForm({ add_received: "", add_paid: "", notes: "" });
        fetchCommissions();
      } else {
        alert("فشلت عملية التسوية");
      }
    } catch (e) {
      alert("خطأ في الاتصال بالخادم");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت أصلح في رغبتك بحذف هذا السجل؟")) return;
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/commissions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchCommissions();
    } catch (e) {
      console.error(e);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "airline":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"><Plane className="w-3.5 h-3.5" /> شركة طيران</span>;
      case "hotel":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"><Hotel className="w-3.5 h-3.5" /> فندق</span>;
      case "supplier":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"><Building2 className="w-3.5 h-3.5" /> مورد / ناقل</span>;
      case "employee":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><Users className="w-3.5 h-3.5" /> موظف</span>;
      case "agent":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"><ShieldCheck className="w-3.5 h-3.5" /> وكيل خارجي</span>;
      case "branch":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"><Building2 className="w-3.5 h-3.5" /> فرع مؤسسة</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">عمولة عامة</span>;
    }
  };

  const getStatusBadge = (status: string, diff: number) => {
    if (diff <= 0) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> مسواة بالكامل</span>;
    }
    if (status === "partially_received") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"><Clock className="w-3.5 h-3.5" /> محصلة جزئياً</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"><AlertCircle className="w-3.5 h-3.5" /> مستحقة / معلقة</span>;
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto dir-rtl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-6 rounded-2xl shadow-lg border border-slate-700">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
                <Coins className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">إدارة العمولات والربحية - Module 22</h1>
                <p className="text-slate-300 text-xs mt-1">
                  متابعة دقيقة لعمولات شركات الطيران، الفنادق، الموردين، الموظفين، الوكلاء، والفروع حسابياً.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              إضافة سجل عمولة جديد
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-all text-xs"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold">العمولة المتوقعة (Expected)</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {(stats.total_expected || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">إجمالي العمولات المفترضة من المبيعات</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold">المحصل / المستلم (Received)</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {(stats.total_received || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">المبالغ التي تم استلامها وإيداعها بالصندوق</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold">المستحق المتبقي (Due)</span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">
              {(stats.total_due || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">عمولات ما زالت في ذمة الموردين والشركات</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold">المدفوع للجهات (Paid)</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {(stats.total_paid || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">عمولات الموظفين والوكلاء الصادرة</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold">فوارق العمولات (Difference)</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">
              {(stats.total_difference || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">ريال</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">الفرق المتبقي الكلي بين المفترض والصافي</p>
          </div>
        </div>

        {/* Filters and Controls Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Type Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { id: "all", label: "جميع العمولات", icon: Coins },
                { id: "airline", label: "عمولة الطيران", icon: Plane },
                { id: "hotel", label: "عمولة الفنادق", icon: Hotel },
                { id: "supplier", label: "عمولة الموردين", icon: Building2 },
                { id: "employee", label: "عمولة الموظفين", icon: Users },
                { id: "agent", label: "عمولة الوكلاء", icon: ShieldCheck },
                { id: "branch", label: "عمولة الفروع", icon: Building2 }
              ].map((tab) => {
                const Icon = tab.icon;
                const active = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setTypeFilter(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                      active
                        ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث باسم الجهة، الكود، الملاحظات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3.5">الكود</th>
                  <th className="p-3.5">نوع العمولة</th>
                  <th className="p-3.5">الجهة / المانح أو المستحق</th>
                  <th className="p-3.5">رقم المرجع / الحجز</th>
                  <th className="p-3.5 text-center">المتوقعة (Expected)</th>
                  <th className="p-3.5 text-center">المحصلة (Received)</th>
                  <th className="p-3.5 text-center">المستحقة (Due)</th>
                  <th className="p-3.5 text-center">المدفوعة (Paid)</th>
                  <th className="p-3.5 text-center">الفرق (Diff)</th>
                  <th className="p-3.5 text-center">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      جاري تحميل بيانات العمولات...
                    </td>
                  </tr>
                ) : commissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400">
                      لا توجد سجلات عمولات مطابقة للفلتر المحدد.
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-slate-900 dark:text-white">
                        {c.commission_code}
                      </td>
                      <td className="p-3.5">
                        {getTypeBadge(c.commission_type)}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {c.entity_name}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {c.reference_number || "—"}
                      </td>
                      <td className="p-3.5 text-center font-bold text-blue-600 dark:text-blue-400">
                        {c.expected_amount.toLocaleString()} <span className="text-[10px]">{c.currency}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {c.received_amount.toLocaleString()} <span className="text-[10px]">{c.currency}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                        {c.due_amount.toLocaleString()} <span className="text-[10px]">{c.currency}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {c.paid_amount.toLocaleString()} <span className="text-[10px]">{c.currency}</span>
                      </td>
                      <td className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                        {c.difference.toLocaleString()} <span className="text-[10px]">{c.currency}</span>
                      </td>
                      <td className="p-3.5 text-center">
                        {getStatusBadge(c.status, c.difference)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedComm(c);
                              setIsSettleOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all"
                            title="تسوية وتحصيل عمولة"
                          >
                            تسوية
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl dir-rtl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  إضافة سجل عمولة جديد
                </h3>
                <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">نوع العمولة</label>
                  <select
                    value={form.commission_type}
                    onChange={(e) => setForm({ ...form, commission_type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="airline">عمولة شركة الطيران (Airline Commission)</option>
                    <option value="hotel">عمولة الفندق (Hotel Commission)</option>
                    <option value="supplier">عمولة المورد / الناقل (Supplier Commission)</option>
                    <option value="employee">عمولة الموظف (Employee Commission)</option>
                    <option value="agent">عمولة الوكيل الخارجي (Agent Commission)</option>
                    <option value="branch">عمولة الفرع (Branch Commission)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">اسم الجهة / المانح أو المستحق *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الخطوط السعودية / فندق أتلانتس / الموظف أحمد"
                    value={form.entity_name}
                    onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">نوع المرجع</label>
                    <select
                      value={form.reference_type}
                      onChange={(e) => setForm({ ...form, reference_type: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    >
                      <option value="booking">حجز رحلة / PNR</option>
                      <option value="invoice">فاتورة مبيعات</option>
                      <option value="procurement">أمر توريد مشتريات</option>
                      <option value="manual">تسوية يدوي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">رقم المرجع / الحجز</label>
                    <input
                      type="text"
                      placeholder="مثال: PNR-99880"
                      value={form.reference_number}
                      onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">العمولة المتوقعة *</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      value={form.expected_amount}
                      onChange={(e) => setForm({ ...form, expected_amount: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">المحصل / المستلم</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.received_amount}
                      onChange={(e) => setForm({ ...form, received_amount: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">العملة</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                    >
                      <option value="ريال">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">ملاحظات وشروط العمولة</label>
                  <textarea
                    rows={2}
                    placeholder="اكتب أي ملاحظات أو اتفاقيات عمولة..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md"
                  >
                    حفظ العمولة
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Settle Modal */}
        {isSettleOpen && selectedComm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl dir-rtl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  تسوية عمولة: {selectedComm.entity_name}
                </h3>
                <button onClick={() => setIsSettleOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSettleSubmit} className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>الكود:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedComm.commission_code}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>المتوقعة:</span>
                    <span className="font-bold text-blue-600">{selectedComm.expected_amount} {selectedComm.currency}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>المحصل حالياً:</span>
                    <span className="font-bold text-emerald-600">{selectedComm.received_amount} {selectedComm.currency}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>المتبقي المستحق:</span>
                    <span className="font-bold text-rose-600">{selectedComm.due_amount} {selectedComm.currency}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">المبلغ المحصل الإضافي (استلام عمولة من الشركة)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={settleForm.add_received}
                    onChange={(e) => setSettleForm({ ...settleForm, add_received: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">المبلغ المدفوع الإضافي (صرف عمولة للموظف/الوكيل)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={settleForm.add_paid}
                    onChange={(e) => setSettleForm({ ...settleForm, add_paid: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">بيان وملاحظات التسوية</label>
                  <textarea
                    rows={2}
                    placeholder="مثال: تم استلام الشيك رقم 4402 وبناءً عليه صفت العمولة..."
                    value={settleForm.notes}
                    onChange={(e) => setSettleForm({ ...settleForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                  >
                    تأكيد التسوية
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
