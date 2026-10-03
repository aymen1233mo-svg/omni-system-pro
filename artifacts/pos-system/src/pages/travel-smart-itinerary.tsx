import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  Sparkles,
  Compass,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Car,
  Utensils,
  Camera,
  Users,
  DollarSign,
  Share2,
  Download,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
  Layers,
  FileText,
  RefreshCw,
  QrCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyPlan {
  day_number: number;
  title: string;
  city: string;
  morning_activity: string;
  afternoon_activity: string;
  evening_activity: string;
  hotel_name: string;
  transport_type: string;
  meals_included: string;
  highlights: string[];
  photo_url?: string;
}

interface SmartItinerary {
  id: number;
  title: string;
  destination: string;
  duration_days: number;
  travelers_count: number;
  theme: string;
  budget_tier: string;
  target_customer_name: string;
  daily_plans: DailyPlan[];
  estimated_cost_per_person: number;
  agency_markup_pct: number;
  total_price: number;
  proposal_pdf_url: string;
  created_at: string;
}

export default function TravelSmartItinerary() {
  const { toast } = useToast();
  const [itineraries, setItineraries] = useState<SmartItinerary[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<SmartItinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generator form
  const [formData, setFormData] = useState({
    destination: "تركيا - إسطنبول وطرابزون وبورصة",
    duration_days: 7,
    travelers_count: 4,
    theme: "عائلي",
    budget_tier: "فاخر 5 نجوم",
    target_customer_name: "عائلة آل فهد"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/travel/itineraries");
      const data = await res.json();
      if (data.success) {
        setItineraries(data.data);
        if (data.data.length > 0 && !selectedItinerary) {
          setSelectedItinerary(data.data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/travel/itineraries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم تصميم البرنامج السياحي الذكي بنجاح", description: data.message });
        setSelectedItinerary(data.data);
        loadData();
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل إنشاء البرنامج الذكي", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border border-indigo-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Compass className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">المساعد الذكي لتخطيط البرامج السياحية (AI Smart Itinerary)</h1>
                  <p className="text-slate-400 text-sm">
                    إنشاء وتوليد جداول يومية تفاعلية مخصصة (الأنشطة، الفنادق، النقل، والوجبات) وتصدير عروض تقديمية فاخرة للعملاء (PDF/Brochure)
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
                تحديث البرامج
              </button>
            </div>
          </div>
        </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Generator Form & Saved Programs List */}
        <div className="lg:col-span-4 space-y-5">
          {/* AI Generator Box */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-sm">توليد برنامج سياحي تفصيلي بالذكاء الاصطناعي</h3>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">الوجهة أو المسار السياحي:</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={e => setFormData(p => ({ ...p, destination: e.target.value }))}
                  placeholder="مثال: تركيا، ماليزيا، سويسرا، جورجيا..."
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground">اسم العميل المستهدف:</label>
                <input
                  type="text"
                  value={formData.target_customer_name}
                  onChange={e => setFormData(p => ({ ...p, target_customer_name: e.target.value }))}
                  placeholder="اسم العميل أو المجموعة"
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">مدة البرنامج (أيام):</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.duration_days}
                    onChange={e => setFormData(p => ({ ...p, duration_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">عدد المسافرين:</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.travelers_count}
                    onChange={e => setFormData(p => ({ ...p, travelers_count: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">طابع الرحلة:</label>
                  <select
                    value={formData.theme}
                    onChange={e => setFormData(p => ({ ...p, theme: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                  >
                    <option value="عائلي">عائلي وترفيهي</option>
                    <option value="شهر عسل">شهر عسل ورومانسي</option>
                    <option value="مغامرات واستكشاف">مغامرات وطبيعة</option>
                    <option value="ثقافي وتسوق">تاريخي وثقافي</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground">فئة الفنادق:</label>
                  <select
                    value={formData.budget_tier}
                    onChange={e => setFormData(p => ({ ...p, budget_tier: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl"
                  >
                    <option value="فاخر 5 نجوم">فاخر 5 نجوم (VIP)</option>
                    <option value="مميز 4 نجوم">مميز 4 نجوم</option>
                    <option value="اقتصادي 3 نجوم">اقتصادي 3 نجوم</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 pt-3"
              >
                <Sparkles className="w-4 h-4" />
                {generating ? "جارِ توليد وتنسيق البرنامج الذكي..." : "توليد البرنامج والتسعير الفوري"}
              </button>
            </form>
          </div>

          {/* Saved Programs List */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
              البرامج المحفوظة ({itineraries.length})
            </h4>

            <div className="space-y-2">
              {itineraries.map((itn) => (
                <div
                  key={itn.id}
                  onClick={() => setSelectedItinerary(itn)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedItinerary?.id === itn.id
                      ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 shadow-sm"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs">{itn.title}</h5>
                    <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded">
                      {itn.duration_days} أيام
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                    <span>{itn.target_customer_name}</span>
                    <span className="font-bold text-foreground">{itn.total_price.toLocaleString()} ريال</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Day-by-Day Presentation */}
        <div className="lg:col-span-8 space-y-5">
          {selectedItinerary ? (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-6">
              {/* Proposal Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-xs">
                      {selectedItinerary.theme} • {selectedItinerary.budget_tier}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      المسافرون: {selectedItinerary.travelers_count} أشخاص
                    </span>
                  </div>
                  <h2 className="text-xl font-bold mt-1.5">{selectedItinerary.title}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    المسار: {selectedItinerary.destination} | مقدم لصالح: {selectedItinerary.target_customer_name}
                  </p>
                </div>

                {/* Price & Export */}
                <div className="text-left bg-muted/40 p-3.5 rounded-2xl shrink-0 space-y-1">
                  <div className="text-xs text-muted-foreground">إجمالي قيمة البرنامج للمجموعة:</div>
                  <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedItinerary.total_price.toLocaleString()} ريال
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ({selectedItinerary.estimated_cost_per_person} ريال / للشخص)
                  </div>
                </div>
              </div>

              {/* Day by Day Cards */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  الجدول السياحي اليومي المفصل (Day-by-Day Breakdown):
                </h3>

                {(selectedItinerary.daily_plans || []).map((day) => (
                  <div
                    key={day.day_number}
                    className="border border-border/80 rounded-2xl p-5 bg-card hover:border-indigo-500/40 transition space-y-4 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow">
                          {day.day_number}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm">{day.title}</h4>
                          <span className="text-xs text-muted-foreground">{day.city}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {day.hotel_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-indigo-500" />
                          {day.transport_type}
                        </span>
                      </div>
                    </div>

                    {/* Morning / Afternoon / Evening Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                        <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5" />
                          الفترة الصباحية
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{day.morning_activity}</p>
                      </div>

                      <div className="p-3 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-1">
                        <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                          <Sunset className="w-3.5 h-3.5" />
                          فترة ما بعد الظهر
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{day.afternoon_activity}</p>
                      </div>

                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1">
                        <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5" />
                          الفترة المسائية
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{day.evening_activity}</p>
                      </div>
                    </div>

                    {/* Highlights & Meals */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {(day.highlights || []).map((h, i) => (
                          <span key={i} className="px-2 py-0.5 bg-muted text-foreground text-[11px] rounded-md font-medium">
                            • {h}
                          </span>
                        ))}
                      </div>
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Utensils className="w-3.5 h-3.5" />
                        الوجبات: {day.meals_included}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  تاريخ الإنشاء: {selectedItinerary.created_at?.slice(0, 10)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      toast({ title: "تم تجهيز البروشور", description: "يمكنك طباعة وحفظ عرض البرنامج السياحي كملف PDF فاخر للعميل" });
                      window.print();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <Download className="w-4 h-4" />
                    تصدير عرض السعر والبروشور (PDF Brochure)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground space-y-3">
              <Compass className="w-12 h-12 mx-auto text-muted-foreground/40 stroke-1" />
              <h4 className="font-bold text-base">لا يوجد برنامج سياحي محدد</h4>
              <p className="text-xs max-w-sm mx-auto">
                قم بتوليد برنامج جديد بواسطة الذكاء الاصطناعي من القائمة الجانبية أو اختر أحد البرامج المحفوظة
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </AdminLayout>
  );
}
