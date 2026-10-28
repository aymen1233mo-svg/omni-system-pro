import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  Building2,
  Sparkles,
  Search,
  Sliders,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  RefreshCw,
  Clock,
  ShieldCheck,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Aggregator {
  id: number;
  supplier_code: string;
  supplier_name: string;
  api_endpoint: string;
  status: string;
  avg_latency_ms: number;
  currency: string;
  credit_balance: number;
}

interface MarkupRule {
  id: number;
  rule_name: string;
  channel: string;
  service_type: string;
  destination_country: string;
  airline_or_chain: string;
  markup_type: string;
  markup_value: number;
  discount_value: number;
  priority: number;
  is_active: number;
  notes?: string;
}

interface HotelResult {
  id: string;
  name: string;
  city: string;
  rating: number;
  supplier: string;
  board_type: string;
  room_type: string;
  cancellation: string;
  base_rate_usd: number;
  base_rate_sar: number;
  sell_rate_sar: number;
  markup_applied_pct: number;
  agent_margin_sar: number;
  applied_rule: string;
  image_url: string;
}

export default function TravelHotelAggregator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"search" | "markup_matrix" | "suppliers">("search");

  // Search state
  const [cityQuery, setCityQuery] = useState("مكة المكرمة");
  const [selectedChannel, setSelectedChannel] = useState("b2c_web");
  const [searchResults, setSearchResults] = useState<HotelResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<HotelResult | null>(null);
  const [bookingGuest, setBookingGuest] = useState({ name: "محمد العتيبي", phone: "0551122334" });
  const [bookedSuccess, setBookedSuccess] = useState<any | null>(null);

  // Markup Rules state
  const [markupRules, setMarkupRules] = useState<MarkupRule[]>([]);
  const [suppliers, setSuppliers] = useState<Aggregator[]>([]);
  const [newRuleModal, setNewRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    rule_name: "",
    channel: "all",
    service_type: "hotel",
    destination_country: "all",
    airline_or_chain: "all",
    markup_type: "percentage",
    markup_value: 5.0,
    discount_value: 0.0,
    priority: 1,
    notes: ""
  });

  const loadData = async () => {
    try {
      const [resRules, resSupp] = await Promise.all([
        fetch("/api/travel/markup-rules").then(r => r.json()),
        fetch("/api/travel/hotel-aggregators").then(r => r.json())
      ]);
      if (resRules.success) setMarkupRules(resRules.data);
      if (resSupp.success) setSuppliers(resSupp.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    handleSearchHotels();
  }, []);

  const handleSearchHotels = async () => {
    setIsSearching(true);
    setSelectedHotel(null);
    setBookedSuccess(null);
    try {
      const res = await fetch("/api/travel/hotel-aggregators/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cityQuery,
          channel: selectedChannel
        })
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل استعلام مجمعات الفنادق", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.rule_name) return;
    try {
      const res = await fetch("/api/travel/markup-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleForm)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحفظ بنجاح", description: data.message });
        setNewRuleModal(false);
        setRuleForm({
          rule_name: "",
          channel: "all",
          service_type: "hotel",
          destination_country: "all",
          airline_or_chain: "all",
          markup_type: "percentage",
          markup_value: 5.0,
          discount_value: 0.0,
          priority: 1,
          notes: ""
        });
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر حفظ قاعدة التسعير", variant: "destructive" });
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/travel/markup-rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم الحذف", description: data.message });
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر حذف القاعدة", variant: "destructive" });
    }
  };

  const handleBookHotel = () => {
    if (!selectedHotel) return;
    const confCode = "HTL-" + Math.floor(100000 + Math.random() * 900000);
    setBookedSuccess({
      confirmation_code: confCode,
      hotel_name: selectedHotel.name,
      guest_name: bookingGuest.name,
      supplier: selectedHotel.supplier,
      amount: selectedHotel.sell_rate_sar,
      voucher_url: `/api/travel/vouchers/${confCode}`
    });
    toast({ title: "تم تأكيد الحجز الفندقي", description: `رقم التأكيد: ${confCode} عبر ${selectedHotel.supplier}` });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                  <Building2 className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">مجمع الفنادق العالمي ومحرك الهامش الديناميكي</h1>
                  <p className="text-slate-400 text-sm">
                    البحث الموحد عبر كبرى بنوك الغرف العالمية (Hotelbeds, WebBeds, TBO, Expedia) مع إدارة هوامش الربح وقواعد الخصم التلقائية
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
                onClick={() => setNewRuleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة قاعدة تسعير وهامش ربح
              </button>
            </div>
          </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "search"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Search className="w-4 h-4" />
            محرك البحث والمقارنة المباشر
          </button>
          <button
            onClick={() => setActiveTab("markup_matrix")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "markup_matrix"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Percent className="w-4 h-4" />
            مصفوفة هوامش الأرباح (Markup Rules)
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "suppliers"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            بوابات المزودين العالميين ({suppliers.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Search & Booking */}
      {activeTab === "search" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-xs font-bold text-muted-foreground">المدينة أو الوجهة السياحية:</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  value={cityQuery}
                  onChange={e => setCityQuery(e.target.value)}
                  placeholder="ابحث بالمدينة (مكة، دبي، إسطنبول، طرابزون...)"
                  className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-bold text-muted-foreground">قناة التسعير (Channel Markup):</label>
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl font-medium"
              >
                <option value="b2c_web">مبيعات الأفراد B2C Web Portal (+7.5%)</option>
                <option value="b2b_platinum">وكيل B2B بلاتيني معتمد (+2.0% - خصم 1.5%)</option>
                <option value="b2b_gold">وكيل B2B ذهبي (+3.5%)</option>
                <option value="walk_in">مبيعات الفرع المباشرة Walk-In (+8.0%)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                onClick={handleSearchHotels}
                disabled={isSearching}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {isSearching ? "جارِ مقارنة المزودين..." : "بحث ومقارنة الأسعار"}
              </button>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              {searchResults.map((hotel) => {
                const isSelected = selectedHotel?.id === hotel.id;
                return (
                  <div
                    key={hotel.id}
                    onClick={() => {
                      setSelectedHotel(hotel);
                      setBookedSuccess(null);
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 transition flex flex-col sm:flex-row gap-4 ${
                      isSelected
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <img
                      src={hotel.image_url}
                      alt={hotel.name}
                      referrerPolicy="no-referrer"
                      className="w-full sm:w-36 h-32 object-cover rounded-xl shrink-0"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-amber-500">
                            {Array.from({ length: hotel.rating }).map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-current" />
                            ))}
                          </div>
                          <h3 className="font-bold text-sm mt-0.5">{hotel.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-500" />
                            {hotel.city} - {hotel.room_type}
                          </p>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-white font-bold block mb-1">
                            {hotel.supplier}
                          </span>
                          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                            {hotel.sell_rate_sar.toLocaleString()} ريال
                          </div>
                          <div className="text-[10px] text-muted-foreground line-through">
                            التكلفة: {hotel.base_rate_sar} ريال
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
                        <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-medium">
                          {hotel.board_type}
                        </span>
                        <span className="bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded font-medium">
                          {hotel.cancellation}
                        </span>
                        <span className="text-muted-foreground text-[11px] mr-auto">
                          هامش الربح: +{hotel.agent_margin_sar} ريال ({hotel.markup_applied_pct}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Instant Hotel Booking & Voucher Generation */}
            <div className="lg:col-span-5 space-y-4">
              {selectedHotel ? (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="border-b border-border pb-3">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      تأكيد حجز الفندق وإصدار الفاوتشر المباشر
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      المزود المعتمد: <span className="font-bold text-foreground">{selectedHotel.supplier}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs">
                      <div className="font-bold text-sm text-foreground">{selectedHotel.name}</div>
                      <div className="text-muted-foreground">نوع الغرفة: {selectedHotel.room_type}</div>
                      <div className="text-emerald-600 font-medium">نظام الوجبات: {selectedHotel.board_type}</div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground">بيانات النزيل الرئيسي:</label>
                      <input
                        type="text"
                        value={bookingGuest.name}
                        onChange={e => setBookingGuest(p => ({ ...p, name: e.target.value }))}
                        placeholder="اسم النزيل الثلاثي"
                        className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl font-medium"
                      />
                      <input
                        type="text"
                        value={bookingGuest.phone}
                        onChange={e => setBookingGuest(p => ({ ...p, phone: e.target.value }))}
                        placeholder="رقم الجوال لتلقي الفاوتشر وتفاصيل الحجز"
                        className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl"
                      />
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
                        <span>إجمالي سعر البيع:</span>
                        <span>{selectedHotel.sell_rate_sar} ريال</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>ربح الوكالة الصافي:</span>
                        <span>+{selectedHotel.agent_margin_sar} ريال</span>
                      </div>
                    </div>

                    <button
                      onClick={handleBookHotel}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      تأكيد الحجز الفوري وإصدار الفاوتشر (Direct Voucher)
                    </button>

                    {bookedSuccess && (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500 rounded-xl space-y-2 animate-in fade-in">
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          تم تأكيد الحجز برقم: {bookedSuccess.confirmation_code}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          المزود: {bookedSuccess.supplier} | النزيل: {bookedSuccess.guest_name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground space-y-2">
                  <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40 stroke-1" />
                  <h4 className="font-bold text-sm">اختر فندقاً لعرض تفاصيل الحجز الفوري</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Markup Matrix */}
      {activeTab === "markup_matrix" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-500" />
                قواعد تسعير الهوامش والخصومات السياحية (Dynamic Markup Rules)
              </h3>
              <span className="text-xs text-muted-foreground">{markupRules.length} قواعد معرفة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">اسم القاعدة</th>
                    <th className="p-3">القناة المستهدفة</th>
                    <th className="p-3">نوع الخدمة</th>
                    <th className="p-3">الوجهة / السلسلة</th>
                    <th className="p-3">الهامش المضاف</th>
                    <th className="p-3">الخصم الترويجي</th>
                    <th className="p-3">الأولوية</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {markupRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30 transition">
                      <td className="p-3 font-bold">{rule.rule_name}</td>
                      <td className="p-3 font-mono">{rule.channel}</td>
                      <td className="p-3">{rule.service_type}</td>
                      <td className="p-3">{rule.destination_country}</td>
                      <td className="p-3 font-bold text-emerald-600">
                        {rule.markup_type === "percentage" ? `${rule.markup_value}%` : `${rule.markup_value} ريال`}
                      </td>
                      <td className="p-3 font-bold text-sky-600">
                        {rule.discount_value > 0 ? `${rule.discount_value}%` : "-"}
                      </td>
                      <td className="p-3 font-mono">{rule.priority}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium text-[11px]">
                          نشط
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Suppliers Gateways */}
      {activeTab === "suppliers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supp) => (
            <div key={supp.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-400 font-bold text-xs border border-emerald-800/40">
                  {supp.supplier_code.toUpperCase()}
                </span>
                <span className="text-xs bg-emerald-500/10 text-emerald-600 font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {supp.status === "connected" ? "متصل ومتاح" : "غير متاح"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm">{supp.supplier_name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{supp.api_endpoint}</p>
              </div>

              <div className="bg-muted/40 p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">سرعة الاستجابة:</span>
                  <span className="font-bold font-mono">{supp.avg_latency_ms} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الرصيد الائتماني المتاح:</span>
                  <span className="font-bold text-emerald-600">{supp.credit_balance.toLocaleString()} {supp.currency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Rule Modal */}
      {newRuleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-base border-b border-border pb-3">إضافة قاعدة تسعير وهامش ربح جديدة</h3>
            <form onSubmit={handleAddRule} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">اسم القاعدة:</label>
                <input
                  type="text"
                  required
                  value={ruleForm.rule_name}
                  onChange={e => setRuleForm(p => ({ ...p, rule_name: e.target.value }))}
                  placeholder="مثال: هامش عطلات الصيف للأفراد"
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">القناة المستهدفة:</label>
                  <select
                    value={ruleForm.channel}
                    onChange={e => setRuleForm(p => ({ ...p, channel: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                  >
                    <option value="all">كافة القنوات</option>
                    <option value="b2c_web">مبيعات الأفراد B2C</option>
                    <option value="b2b_gold">وكلاء B2B Gold</option>
                    <option value="b2b_platinum">وكلاء B2B Platinum</option>
                    <option value="walk_in">مبيعات الفرع Walk-In</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">نوع الخدمة:</label>
                  <select
                    value={ruleForm.service_type}
                    onChange={e => setRuleForm(p => ({ ...p, service_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                  >
                    <option value="all">كافة الخدمات</option>
                    <option value="hotel">حجوزات الفنادق</option>
                    <option value="flight">تذاكر الطيران</option>
                    <option value="package">البرامج السياحية</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">نسبة الهامش (%):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={ruleForm.markup_value}
                    onChange={e => setRuleForm(p => ({ ...p, markup_value: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">الأولوية:</label>
                  <input
                    type="number"
                    value={ruleForm.priority}
                    onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition"
                >
                  حفظ القاعدة
                </button>
                <button
                  type="button"
                  onClick={() => setNewRuleModal(false)}
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition"
                >
                  إلغاء
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
