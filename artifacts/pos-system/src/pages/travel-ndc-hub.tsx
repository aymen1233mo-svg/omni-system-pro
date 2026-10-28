import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import {
  Plane,
  Sparkles,
  Radio,
  Wifi,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Plus,
  RefreshCw,
  FileCode,
  Tag,
  ShieldCheck,
  Luggage,
  Utensils,
  Armchair,
  Clock,
  Send,
  Terminal,
  ExternalLink,
  Layers,
  ChevronRight,
  Sliders,
  DollarSign,
  Download,
  Info,
  Check,
  UploadCloud
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NdcGateway {
  id: number;
  provider_name: string;
  airline_code: string;
  api_endpoint: string;
  ndc_version: string;
  auth_type: string;
  status: string;
  fee_discount_pct: number;
}

interface NdcOffer {
  id: number;
  offer_id: string;
  airline_code: string;
  airline_name: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  flight_no: string;
  cabin_class: string;
  base_fare: number;
  taxes: number;
  total_fare: number;
  ndc_savings: number;
  seat_selection_available: number;
  baggage_allowance_kg: number;
  meal_options: string;
  ancillaries: Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    selected?: boolean;
  }>;
}

interface AirMirFile {
  id: number;
  file_name: string;
  file_type: string;
  pnr: string;
  ticket_numbers: string;
  airline_code: string;
  passenger_names: string;
  total_amount: number;
  currency: string;
  status: string;
  processed_at: string;
  parsed_data?: any;
}

interface AirMirListener {
  id: number;
  listener_name: string;
  protocol: string;
  host: string;
  remote_path: string;
  is_running: number;
  files_processed_count: number;
}

export default function TravelNdcHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ndc_offers" | "gateways" | "air_mir_listener">("ndc_offers");
  
  // NDC Offers state
  const [offers, setOffers] = useState<NdcOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [searchParams, setSearchParams] = useState({
    origin: "",
    destination: "",
    cabin_class: "Economy",
    airline: ""
  });
  const [selectedOffer, setSelectedOffer] = useState<NdcOffer | null>(null);
  const [selectedAncillaries, setSelectedAncillaries] = useState<Record<string, boolean>>({});
  const [bookingPassenger, setBookingPassenger] = useState({
    name: "ALOTAIBI / ABDULLAH MR",
    passport: "P99881122",
    email: "passenger@example.com",
    phone: "0501234567"
  });
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Gateways state
  const [gateways, setGateways] = useState<NdcGateway[]>([]);
  const [testingGatewayId, setTestingGatewayId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  // AIR / MIR Listener state
  const [listeners, setListeners] = useState<AirMirListener[]>([]);
  const [airFiles, setAirFiles] = useState<AirMirFile[]>([]);
  const [rawAirInput, setRawAirInput] = useState("");
  const [uploadingAir, setUploadingAir] = useState(false);

  // Load Initial Data
  const loadNdcData = async () => {
    setLoadingOffers(true);
    try {
      const [resOffers, resGw, resList, resFiles] = await Promise.all([
        fetch("/api/travel/ndc/offers").then(r => r.json()),
        fetch("/api/travel/ndc/gateways").then(r => r.json()),
        fetch("/api/travel/air-mir/listeners").then(r => r.json()),
        fetch("/api/travel/air-mir/files").then(r => r.json())
      ]);

      if (resOffers.success) setOffers(resOffers.data);
      if (resGw.success) setGateways(resGw.data);
      if (resList.success) setListeners(resList.data);
      if (resFiles.success) setAirFiles(resFiles.data);
    } catch (e: any) {
      console.error("Failed to load NDC data:", e);
    } finally {
      setLoadingOffers(false);
    }
  };

  useEffect(() => {
    loadNdcData();
  }, []);

  const handleTestGateway = async (gw: NdcGateway) => {
    setTestingGatewayId(gw.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/travel/ndc/gateways/${gw.id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTestResult({ ...data.data, gwName: gw.provider_name });
        toast({ title: "اتصال ناجح", description: data.data.message });
      }
    } catch (e) {
      toast({ title: "فشل الاختبار", description: "تعذر التحقق من البوابة", variant: "destructive" });
    } finally {
      setTestingGatewayId(null);
    }
  };

  const handleToggleListener = async (listener: AirMirListener) => {
    try {
      const res = await fetch(`/api/travel/air-mir/listeners/${listener.id}/toggle`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setListeners(prev => prev.map(l => l.id === listener.id ? { ...l, is_running: data.is_running } : l));
        toast({ title: "تحديث الخدمة", description: data.message });
      }
    } catch (e) {
      toast({ title: "خطأ", description: "تعذر تحديث حالة المستمع", variant: "destructive" });
    }
  };

  const handleProcessRawAirFile = async () => {
    if (!rawAirInput.trim()) {
      toast({ title: "تنبيه", description: "يرجى لصق نص ملف AIR أو MIR أو BFM", variant: "destructive" });
      return;
    }
    setUploadingAir(true);
    try {
      const res = await fetch("/api/travel/air-mir/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: rawAirInput })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "تمت المعالجة الفورية بنجاح", description: data.message });
        setRawAirInput("");
        loadNdcData();
      } else {
        toast({ title: "خطأ بالتحليل", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشلت معالجة الملف", variant: "destructive" });
    } finally {
      setUploadingAir(false);
    }
  };

  const handleBookNdcOffer = async () => {
    if (!selectedOffer) return;
    setBookingLoading(true);
    setBookingResult(null);

    const activeAncillaries = (selectedOffer.ancillaries || []).filter(a => selectedAncillaries[a.id]);

    try {
      const res = await fetch("/api/travel/ndc/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: selectedOffer.offer_id,
          passenger_name: bookingPassenger.name,
          passport_no: bookingPassenger.passport,
          selected_ancillaries: activeAncillaries
        })
      });
      const data = await res.json();
      if (data.success) {
        setBookingResult(data.data);
        toast({ title: "تم إصدار التذكرة بنجاح", description: data.message });
      } else {
        toast({ title: "فشل الإصدار", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "خطأ", description: "فشل استدعاء واجهة NDC", variant: "destructive" });
    } finally {
      setBookingLoading(false);
    }
  };

  // Calculate dynamic pricing with ancillaries
  const ancillariesTotal = selectedOffer ? (selectedOffer.ancillaries || [])
    .filter(a => selectedAncillaries[a.id])
    .reduce((sum, a) => sum + a.price, 0) : 0;

  const totalNdcPrice = selectedOffer ? selectedOffer.total_fare + ancillariesTotal : 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border border-sky-800/40 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl">
                  <Plane className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">بوابة بروتوكول IATA NDC ومستمع ملفات AIR / MIR التلقائي</h1>
                  <p className="text-slate-400 text-sm">
                    الربط المباشر مع واجهات خطوط الطيران (New Distribution Capability) لتجاوز رسوم الـ GDS والتقاط التذاكر لحظياً
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
                onClick={loadNdcData}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOffers ? "animate-spin" : ""}`} />
                تحديث العروض والخدمات
              </button>
            </div>
          </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab("ndc_offers")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "ndc_offers"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            عروض NDC الحية والخدمات الإضافية (Ancillaries)
          </button>
          <button
            onClick={() => setActiveTab("gateways")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "gateways"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Radio className="w-4 h-4" />
            بوابات الربط المباشر (Direct NDC Gateways)
          </button>
          <button
            onClick={() => setActiveTab("air_mir_listener")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === "air_mir_listener"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4" />
            خدمة الاستماع لملفات AIR / MIR / BFM
          </button>
        </div>
      </div>

      {/* TAB 1: NDC Offers & Direct Booking */}
      {activeTab === "ndc_offers" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main: Offers List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">عروض رحلات NDC المتوفرة بالربط المباشر</span>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20">
                توفير رسوم GDS بنسبة تصل إلى 6%
              </span>
            </div>

            {offers.map((offer) => {
              const isSelected = selectedOffer?.id === offer.id;
              return (
                <div
                  key={offer.id}
                  onClick={() => {
                    setSelectedOffer(offer);
                    setBookingResult(null);
                    // Reset selected ancillaries
                    const initial: Record<string, boolean> = {};
                    (offer.ancillaries || []).forEach(a => {
                      if (a.selected) initial[a.id] = true;
                    });
                    setSelectedAncillaries(initial);
                  }}
                  className={`cursor-pointer rounded-2xl border p-5 transition relative ${
                    isSelected
                      ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-500 shadow-md ring-2 ring-sky-500/20"
                      : "bg-card border-border hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow">
                        {offer.airline_code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">{offer.airline_name}</h3>
                          <span className="text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-medium">
                            {offer.flight_no}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{offer.cabin_class}</p>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                        {offer.total_fare.toLocaleString()} ريال
                      </div>
                      <div className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        وفرت: {offer.ndc_savings} ريال
                      </div>
                    </div>
                  </div>

                  {/* Route & Times */}
                  <div className="grid grid-cols-3 items-center mt-4 bg-muted/40 p-3 rounded-xl text-center">
                    <div className="text-right">
                      <div className="font-bold text-sm">{offer.origin}</div>
                      <div className="text-xs text-muted-foreground">{offer.departure_time}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-muted-foreground font-mono">مباشر Direct</span>
                      <div className="w-full flex items-center justify-center my-1">
                        <div className="h-[2px] w-12 bg-sky-400/50"></div>
                        <Plane className="w-3.5 h-3.5 text-sky-500 mx-1 -rotate-90" />
                        <div className="h-[2px] w-12 bg-sky-400/50"></div>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium">NDC Certified</span>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm">{offer.destination}</div>
                      <div className="text-xs text-muted-foreground">{offer.arrival_time}</div>
                    </div>
                  </div>

                  {/* Included Perquisites */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Luggage className="w-3.5 h-3.5 text-slate-500" />
                      الأمتعة: {offer.baggage_allowance_kg} كجم مشمول
                    </span>
                    <span className="flex items-center gap-1">
                      <Utensils className="w-3.5 h-3.5 text-amber-500" />
                      {offer.meal_options}
                    </span>
                    <span className="flex items-center gap-1">
                      <Armchair className="w-3.5 h-3.5 text-blue-500" />
                      اختيار المقعد متاح
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Booking Panel & Ancillaries Selection */}
          <div className="lg:col-span-5 space-y-4">
            {selectedOffer ? (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-5">
                <div className="border-b border-border pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-sky-500" />
                      تفاصيل عرض NDC والإصدار الفوري
                    </h3>
                    <span className="text-xs font-mono bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded">
                      {selectedOffer.offer_id}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedOffer.airline_name} - رحلة {selectedOffer.flight_no} ({selectedOffer.origin} ⬅️ {selectedOffer.destination})
                  </p>
                </div>

                {/* Ancillaries Add-ons */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    الخدمات الإضافية المتاحة (NDC Ancillaries):
                  </label>

                  <div className="space-y-2">
                    {(selectedOffer.ancillaries || []).map((anc) => {
                      const isChecked = !!selectedAncillaries[anc.id];
                      return (
                        <div
                          key={anc.id}
                          onClick={() => setSelectedAncillaries(p => ({ ...p, [anc.id]: !p[anc.id] }))}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            isChecked
                              ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-200"
                              : "bg-muted/30 border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border ${isChecked ? "bg-sky-600 border-sky-600 text-white" : "border-slate-400"}`}>
                              {isChecked && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs font-medium">{anc.name}</span>
                          </div>
                          <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                            {anc.price > 0 ? `+${anc.price} ${anc.currency}` : "مجاناً"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Passenger Info */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    بيانات المسافر:
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={bookingPassenger.name}
                      onChange={e => setBookingPassenger(p => ({ ...p, name: e.target.value }))}
                      placeholder="اسم المسافر بالإنجليزية كما في الجواز"
                      className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl font-mono"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={bookingPassenger.passport}
                        onChange={e => setBookingPassenger(p => ({ ...p, passport: e.target.value }))}
                        placeholder="رقم جواز السفر"
                        className="px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl font-mono"
                      />
                      <input
                        type="text"
                        value={bookingPassenger.phone}
                        onChange={e => setBookingPassenger(p => ({ ...p, phone: e.target.value }))}
                        placeholder="رقم الجوال"
                        className="px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="bg-muted/40 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>السعر الأساسي للتذكرة:</span>
                    <span>{selectedOffer.base_fare} ريال</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>الضرائب والرسوم الحكومية:</span>
                    <span>{selectedOffer.taxes} ريال</span>
                  </div>
                  {ancillariesTotal > 0 && (
                    <div className="flex justify-between text-xs text-sky-600 font-medium">
                      <span>الخدمات الإضافية المختارة:</span>
                      <span>+{ancillariesTotal} ريال</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-emerald-600 font-medium">
                    <span>وفر رسوم توزيع GDS التنافسية:</span>
                    <span>-{selectedOffer.ndc_savings} ريال</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="text-base text-sky-600 dark:text-sky-400">{totalNdcPrice} ريال</span>
                  </div>
                </div>

                {/* Issue Button */}
                <button
                  onClick={handleBookNdcOffer}
                  disabled={bookingLoading}
                  className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {bookingLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جارِ إنشاء طلب NDC وإصدار التذكرة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      إصدار تذكرة NDC فورية وتأكيد الـ PNR
                    </>
                  )}
                </button>

                {/* Booking Success Output */}
                {bookingResult && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      تم إنشاء الحجز وإصدار التذكرة الإلكترونية بنجاح!
                    </div>
                    <div className="text-xs space-y-1 font-mono">
                      <div>رقم الحجز PNR: <span className="font-bold text-emerald-800 dark:text-emerald-300">{bookingResult.pnr}</span></div>
                      <div>رقم التذكرة: {bookingResult.ticket_number}</div>
                      <div>المقعد المؤكد: {bookingResult.seat}</div>
                    </div>
                    <a
                      href={bookingResult.ticket_pdf_url}
                      className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline font-semibold mt-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل وطباعة التذكرة الإلكترونية (PDF)
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground space-y-3">
                <Plane className="w-12 h-12 mx-auto text-muted-foreground/40 stroke-1" />
                <h4 className="font-bold text-base">اختر رحلة لعرض خيارات NDC</h4>
                <p className="text-xs max-w-xs mx-auto">
                  قم بالنقر على أي عرض من القائمة لتخصيص المقاعد والأمتعة والوجبات وإصدار التذكرة بنقرة واحدة
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NDC Gateways Config */}
      {activeTab === "gateways" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gateways.map((gw) => (
              <div key={gw.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-sky-950 text-sky-400 font-bold flex items-center justify-center text-sm border border-sky-800/40">
                    {gw.airline_code}
                  </span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-600 font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {gw.status === "active" ? "متصل ونشط" : "غير نشط"}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm">{gw.provider_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{gw.api_endpoint}</p>
                </div>

                <div className="bg-muted/40 p-3 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">معيار NDC:</span>
                    <span className="font-bold font-mono">v{gw.ndc_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">نوع التوثيق:</span>
                    <span className="font-mono">{gw.auth_type}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>نسبة الوفر المكتسبة:</span>
                    <span>{gw.fee_discount_pct}%</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTestGateway(gw)}
                  disabled={testingGatewayId === gw.id}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Wifi className={`w-3.5 h-3.5 ${testingGatewayId === gw.id ? "animate-pulse text-sky-500" : ""}`} />
                  {testingGatewayId === gw.id ? "جارِ فحص الـ Handshake..." : "فحص الاتصال الحي (Ping)"}
                </button>
              </div>
            ))}
          </div>

          {/* Test Handshake Results Dialog Box */}
          {testResult && (
            <div className="bg-slate-950 border border-sky-500/40 rounded-2xl p-5 text-white space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  نتيجة فحص الاتصال ببوابة: {testResult.gwName}
                </div>
                <span className="text-xs font-mono bg-sky-900/50 text-sky-300 px-2 py-0.5 rounded">
                  Latency: {testResult.latency_ms} ms
                </span>
              </div>
              <p className="text-xs text-slate-300">{testResult.message}</p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
                {testResult.active_endpoints.map((ep: string, idx: number) => (
                  <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {ep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AIR / MIR / BFM Listener & Spooler */}
      {activeTab === "air_mir_listener" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Listeners status */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-500" />
                  خوادم الاستماع اللحظي للتذاكر (AIR/MIR/BFM)
                </h3>
              </div>

              <div className="space-y-3">
                {listeners.map((listener) => (
                  <div key={listener.id} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{listener.listener_name}</span>
                      <button
                        onClick={() => handleToggleListener(listener)}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${
                          listener.is_running
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        }`}
                      >
                        {listener.is_running ? "● يعمل حالياً" : "○ متوقف"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                      <div>البروتوكول: <span className="font-bold text-foreground">{listener.protocol}</span></div>
                      <div>تمت معالجة: <span className="font-bold text-sky-600">{listener.files_processed_count} تذكرة</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manual Spooler Input */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                تحليل فوري لنص تذكرة (AIR / MIR / BFM Spooler)
              </h4>
              <p className="text-xs text-muted-foreground">
                يمكنك لصق محتوى ملف التذكرة الصادر من Amadeus أو Sabre لتحليله وترحيل القيد المحاسبي فورياً
              </p>
              <textarea
                value={rawAirInput}
                onChange={e => setRawAirInput(e.target.value)}
                placeholder="RP/RUH1A0988/RUH1A0988... أو محتوى MIR / BFM..."
                rows={5}
                className="w-full p-3 text-xs bg-slate-950 text-emerald-400 font-mono rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleProcessRawAirFile}
                disabled={uploadingAir}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                {uploadingAir ? "جارِ التحليل والترحيل المحاسبي..." : "معالجة ملف التذكرة وترحيل الحسابات"}
              </button>
            </div>
          </div>

          {/* Processed Files Feed */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-500" />
                سجل التذاكر الإلكترونية الملتقطة آلياً
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {airFiles.length} ملف مسجل
              </span>
            </div>

            <div className="space-y-2.5">
              {airFiles.map((file) => (
                <div key={file.id} className="bg-card border border-border rounded-xl p-4 hover:border-sky-500/40 transition space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-bold rounded">
                        {file.file_type}
                      </span>
                      <span className="font-bold text-xs">{file.file_name}</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم الترحيل للمالية
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">رقم الحجز PNR</span>
                      <span className="font-bold text-sky-600">{file.pnr}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">أرقام التذاكر</span>
                      <span className="truncate block">{file.ticket_numbers}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">القيمة الإجمالية</span>
                      <span className="font-bold">{file.total_amount} {file.currency}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">تاريخ المعالجة</span>
                      <span className="text-[11px]">{file.processed_at?.slice(0, 16)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
