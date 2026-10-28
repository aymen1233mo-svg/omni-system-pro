import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  Plane,
  Building2,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  DollarSign,
  Plus,
  RefreshCw,
  AlertCircle,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CharterBlock {
  id: number;
  block_code: string;
  airline_code: string;
  origin: string;
  destination: string;
  flight_number: string;
  departure_date: string;
  return_date: string;
  total_seats: number;
  sold_seats: number;
  cost_per_seat: number;
  selling_price_per_seat: number;
  status: string;
  break_even_seats: number;
  break_even_pct: number;
  occupancy_pct: number;
  is_profitable: boolean;
  total_revenue: number;
  total_profit: number;
}

interface HotelAllotment {
  id: number;
  allotment_code: string;
  hotel_name: string;
  city: string;
  room_category: string;
  valid_from: string;
  valid_to: string;
  contracted_rooms: number;
  sold_rooms: number;
  release_days: number;
  release_deadline: string;
  cost_per_night: number;
  sell_per_night: number;
  status: string;
  unsold_risk_rooms: number;
  days_until_release: number;
  occupancy_pct: number;
}

export default function TravelCharterAllotments() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"charter" | "hotel_allotments">("charter");

  const [charters, setCharters] = useState<CharterBlock[]>([]);
  const [allotments, setAllotments] = useState<HotelAllotment[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Allocate Modal State
  const [allocateCharterId, setAllocateCharterId] = useState<number | null>(null);
  const [seatsToSell, setSeatsToSell] = useState(1);
  const [allocateAllotmentId, setAllocateAllotmentId] = useState<number | null>(null);
  const [roomsToSell, setRoomsToSell] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resCharter, resAllot] = await Promise.all([
        fetch("/api/travel/charter-blocks").then(r => r.json()),
        fetch("/api/travel/hotel-allotments").then(r => r.json())
      ]);
      if (resCharter.success) setCharters(resCharter.data);
      if (resAllot.success) setAllotments(resAllot.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSellSeats = async (charterId: number) => {
    try {
      const res = await fetch(`/api/travel/charter-blocks/${charterId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats_count: seatsToSell })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم تخصيص المقاعد بنجاح", description: data.message });
        setAllocateCharterId(null);
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل تخصيص المقاعد", variant: "destructive" });
    }
  };

  const handleSellRooms = async (allotmentId: number) => {
    try {
      const res = await fetch(`/api/travel/hotel-allotments/${allotmentId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms_count: roomsToSell })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم حجز الغرف من البلوك", description: data.message });
        setAllocateAllotmentId(null);
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل حجز الغرف", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border border-amber-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                  <Layers className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">إدارة المقاعد العارضة (Charter Blocks) والغرف الموسمية (Allotments)</h1>
                  <p className="text-slate-400 text-sm">
                    مراقبة نسب الإشغال (Load Factor)، نقطة التعادل المالي (Break-even)، والتنبيه التلقائي لمواعيد تحرير الغرف غير المباعة (Auto-Release)
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
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                تحديث البيانات
              </button>
            </div>
          </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("charter")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "charter"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Plane className="w-4 h-4" />
            بلوكات الطيران العارض ({charters.length})
          </button>
          <button
            onClick={() => setActiveTab("hotel_allotments")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "hotel_allotments"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            عقود الغرف الفندقية الموسمية ({allotments.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Charter Flight Blocks */}
      {activeTab === "charter" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charters.map((blk) => (
              <div key={blk.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-xs border border-amber-500/20">
                      {blk.airline_code}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm">{blk.origin} ⬅️ {blk.destination}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{blk.block_code} • {blk.flight_number}</span>
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    blk.is_profitable
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  }`}>
                    {blk.is_profitable ? "مربح (تجاوز التعادل)" : "تحت نقطة التعادل"}
                  </span>
                </div>

                {/* Progress Bar & Seat Counts */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>نسبة المبيعات والإشغال:</span>
                    <span className="font-mono">{blk.sold_seats} / {blk.total_seats} مقعد ({blk.occupancy_pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all ${blk.is_profitable ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(blk.occupancy_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>نقطة التعادل المطلوبة: {blk.break_even_seats} مقعد ({blk.break_even_pct}%)</span>
                    <span>المتبقي للبيع: {blk.total_seats - blk.sold_seats} مقعد</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-muted/40 p-3 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">سعر الشراء</span>
                    <span className="font-bold">{blk.cost_per_seat} ريال</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">سعر البيع المقترح</span>
                    <span className="font-bold text-sky-600">{blk.selling_price_per_seat} ريال</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">صافي الربح المتوقع</span>
                    <span className={`font-bold ${blk.total_profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {blk.total_profit.toLocaleString()} ريال
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    المغادرة: {blk.departure_date}
                  </span>
                  <button
                    onClick={() => {
                      setAllocateCharterId(blk.id);
                      setSeatsToSell(1);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" />
                    بيع مقاعد من البلوك
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Hotel Allotments & Risk Release Tracker */}
      {activeTab === "hotel_allotments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allotments.map((alt) => {
              const isUrgent = alt.days_until_release <= 7;
              return (
                <div key={alt.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{alt.hotel_name}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{alt.allotment_code} • {alt.city}</span>
                    </div>

                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      isUrgent
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse"
                        : "bg-sky-500/10 text-sky-600 border-sky-500/20"
                    }`}>
                      {isUrgent ? `⚠️ متبقي ${alt.days_until_release} أيام للتحرير` : `تحرير خلال ${alt.days_until_release} يوم`}
                    </span>
                  </div>

                  {/* Room Category & Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>الغرف المباعة ({alt.room_category}):</span>
                      <span className="font-mono">{alt.sold_rooms} / {alt.contracted_rooms} غرفة ({alt.occupancy_pct}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${Math.min(alt.occupancy_pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                      <span className="text-rose-600 font-bold">غرف تحت خطر الخسارة (Risk): {alt.unsold_risk_rooms} غرفة</span>
                      <span>موعد التحرير النهائي: {alt.release_deadline}</span>
                    </div>
                  </div>

                  <div className="bg-muted/40 p-3 rounded-xl grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">سعر الشراء / ليلة</span>
                      <span className="font-bold">{alt.cost_per_night} ريال</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">سعر البيع / ليلة</span>
                      <span className="font-bold text-sky-600">{alt.sell_per_night} ريال</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground font-mono">
                      صلاحية العقد: {alt.valid_from} ⬅️ {alt.valid_to}
                    </span>
                    <button
                      onClick={() => {
                        setAllocateAllotmentId(alt.id);
                        setRoomsToSell(1);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      حجز غرف من العقد
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allocate Seats Modal */}
      {allocateCharterId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base border-b border-border pb-2">بيع مقاعد من البلوك العارض</h3>
            <div className="space-y-2 text-xs">
              <label className="font-bold text-muted-foreground">عدد المقاعد المراد بيعها:</label>
              <input
                type="number"
                min={1}
                max={50}
                value={seatsToSell}
                onChange={e => setSeatsToSell(Number(e.target.value))}
                className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono text-center font-bold text-base"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleSellSeats(allocateCharterId)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow transition"
              >
                تأكيد التخصيص
              </button>
              <button
                onClick={() => setAllocateCharterId(null)}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Rooms Modal */}
      {allocateAllotmentId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base border-b border-border pb-2">حجز غرف من عقد الألوتمنت</h3>
            <div className="space-y-2 text-xs">
              <label className="font-bold text-muted-foreground">عدد الغرف:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={roomsToSell}
                onChange={e => setRoomsToSell(Number(e.target.value))}
                className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono text-center font-bold text-base"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleSellRooms(allocateAllotmentId)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow transition"
              >
                تأكيد الخصم من العقد
              </button>
              <button
                onClick={() => setAllocateAllotmentId(null)}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
