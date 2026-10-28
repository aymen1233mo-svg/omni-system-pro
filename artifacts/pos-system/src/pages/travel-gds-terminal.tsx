import React, { useState, useRef, useEffect } from "react";
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
  Terminal,
  Sparkles,
  Plane,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  Download,
  Upload,
  RefreshCw,
  Ticket,
  Luggage,
  DollarSign,
  User,
  ShieldCheck,
  Send,
  HelpCircle,
  Layers,
  Zap,
  Globe
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

export default function TravelGdsTerminalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("parser");

  // Terminal State
  const [selectedGds, setSelectedGds] = useState<"amadeus" | "sabre" | "galileo">("amadeus");
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: "input" | "output"; text: string; time: string }>>([
    {
      type: "output",
      text: `OMNIFLY PRO GDS ENTERPRISE TERMINAL v4.8\nCONNECTED TO: AMADEUS GDS (1A) / SABRE (1S) / TRAVELPORT (1G) ACTIVE LINK\nREADY FOR CRYPTIC COMMANDS... TYPE 'HELP' OR 'AN25OCTRUHDXB'`,
      time: new Date().toLocaleTimeString()
    }
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Parser State
  const [pnrRawInput, setPnrRawInput] = useState(`RP/RUH1A0988/RUH1A0988            AA/SU   22AUG26/1420Z   6X9ZKL
1.ALOTAIBI/ABDULLAH MR  2.ALOTAIBI/SARAH MRS
 2  SV 112 Y 10SEP 4 RUHDXB HK2  0810 1055   *1A/E*
 3  SV 113 Y 18SEP 5 DXBRUH HK2  1830 1930   *1A/E*
 4 AP RUH +966 50 5544332 - AL-ALAMIYA TRAVEL
 5 TK OK22AUG/RUH1A0988//ET
 6 FA PAX 065-2415896321/ETSV/SAR1500.00/10SEP/RUH/S1-2
 7 FA PAX 065-2415896322/ETSV/SAR1500.00/10SEP/RUH/S1-2`);
  const [parsedPnrResult, setParsedPnrResult] = useState<any>(null);

  // NDC Search State
  const [ndcOrigin, setNdcOrigin] = useState("RUH");
  const [ndcDest, setNdcDest] = useState("DXB");
  const [ndcDate, setNdcDate] = useState("2026-09-15");
  const [ndcClass, setNdcClass] = useState("economy");
  const [ndcResults, setNdcResults] = useState<any>(null);
  const [isSearchingNdc, setIsSearchingNdc] = useState(false);

  // Queries
  const { data: gdsHistory } = useQuery<any[]>({
    queryKey: ["gds-pnr-history"],
    queryFn: () => fetchWithAuth("/api/travel/gds/history")
  });

  // Execute Terminal Command Mutation
  const executeCommandMutation = useMutation({
    mutationFn: (cmd: string) =>
      fetchWithAuth<any>("/api/travel/gds/execute", {
        method: "POST",
        body: JSON.stringify({ command: cmd, gds_system: selectedGds })
      }),
    onSuccess: (data) => {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "input", text: `> ${data.command}`, time: new Date().toLocaleTimeString() },
        { type: "output", text: data.output, time: new Date().toLocaleTimeString() }
      ]);
      if (data.parsed) {
        setParsedPnrResult(data.parsed);
      }
    },
    onError: (err: any) => {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "output", text: `ERROR: ${err.message}`, time: new Date().toLocaleTimeString() }
      ]);
    }
  });

  const handleRunCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!terminalInput.trim()) return;
    const cmd = terminalInput;
    setTerminalInput("");
    executeCommandMutation.mutate(cmd);
  };

  // Parse PNR Mutation
  const parsePnrMutation = useMutation({
    mutationFn: (text: string) =>
      fetchWithAuth<any>("/api/travel/gds/parse-pnr", {
        method: "POST",
        body: JSON.stringify({ raw_text: text, gds_system: selectedGds })
      }),
    onSuccess: (data) => {
      setParsedPnrResult(data);
      queryClient.invalidateQueries({ queryKey: ["gds-pnr-history"] });
      toast({
        title: "تم تفكيك نص الـ PNR بنجاح ✅",
        description: `تم استخراج ${data.passengers?.length || 0} مسافر و ${data.segments?.length || 0} خط سير برقم الحجز ${data.pnr_code}`
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل تفكيك PNR", description: err.message, variant: "destructive" });
    }
  });

  // Auto-Import PNR Mutation
  const importPnrMutation = useMutation({
    mutationFn: (data: any) =>
      fetchWithAuth<any>("/api/travel/gds/import-pnr", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["gds-pnr-history"] });
      queryClient.invalidateQueries({ queryKey: ["travel-bookings"] });
      toast({
        title: "تم استيراد الحجز وإصدار الفاتورة بنجاح! 🚀",
        description: res.message
      });
    },
    onError: (err: any) => {
      toast({ title: "فشل استيراد الحجز", description: err.message, variant: "destructive" });
    }
  });

  // NDC Search Handler
  const handleNdcSearch = async () => {
    setIsSearchingNdc(true);
    try {
      const res = await fetchWithAuth<any>("/api/travel/ndc/search", {
        method: "POST",
        body: JSON.stringify({
          origin: ndcOrigin,
          destination: ndcDest,
          departure_date: ndcDate,
          travel_class: ndcClass
        })
      });
      setNdcResults(res);
    } catch (e: any) {
      toast({ title: "خطأ في البحث عبر NDC", description: e.message, variant: "destructive" });
    } finally {
      setIsSearchingNdc(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/30 border border-indigo-400/30 rounded-xl">
                <Terminal className="w-8 h-8 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">محلل ومحاكي أنظمة التوزيع العالمية GDS & NDC</h1>
                <p className="text-sm text-slate-300 mt-1">
                  تفكيك نصوص PNR من Amadeus و Sabre و Galileo آلياً مع محاكي الشاشة السوداء والربط المباشر NDC
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
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              GDS Gateway: متصل ومفعل
            </Badge>
          </div>
        </div>

        {/* Tabs System */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-slate-100 p-1 rounded-xl h-auto">
            <TabsTrigger value="parser" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>محلل PNR الذكي والاستيراد الآلي</span>
            </TabsTrigger>
            <TabsTrigger value="terminal" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              <span>شاشة الأوامر المشفرة GDS Terminal</span>
            </TabsTrigger>
            <TabsTrigger value="ndc" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>محرك البحث والربط المباشر NDC & LCC</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>سجل الحجوزات المستوردة</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PNR PARSER & AUTO IMPORT */}
          <TabsContent value="parser" className="space-y-6 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Raw PNR Input */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        لصق نص PNR الخام (Amadeus / Sabre / Galileo)
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={selectedGds === "amadeus" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setSelectedGds("amadeus")}
                        >
                          Amadeus
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedGds === "sabre" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setSelectedGds("sabre")}
                        >
                          Sabre
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedGds === "galileo" ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setSelectedGds("galileo")}
                        >
                          Galileo
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      الصق النص الكامل لبيانات الحجز من الشاشة السوداء ليتم تفكيكه وحفظه تلقائياً دون إدخال يدوي.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      rows={12}
                      className="font-mono text-xs leading-relaxed bg-slate-950 text-emerald-400 p-3 rounded-lg border-slate-800"
                      value={pnrRawInput}
                      onChange={(e) => setPnrRawInput(e.target.value)}
                      placeholder="الصق نص PNR هنا..."
                    />

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                        onClick={() => parsePnrMutation.mutate(pnrRawInput)}
                        disabled={parsePnrMutation.isPending}
                      >
                        {parsePnrMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 ml-2 text-amber-300" />
                        )}
                        تفكيك وتحليل الـ PNR الآن
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPnrRawInput(`RP/RUH1A0988/RUH1A0988            AA/SU   22AUG26/1420Z   6X9ZKL
1.ALOTAIBI/ABDULLAH MR  2.ALOTAIBI/SARAH MRS
 2  SV 112 Y 10SEP 4 RUHDXB HK2  0810 1055   *1A/E*
 3  SV 113 Y 18SEP 5 DXBRUH HK2  1830 1930   *1A/E*
 4 AP RUH +966 50 5544332 - AL-ALAMIYA TRAVEL
 5 TK OK22AUG/RUH1A0988//ET
 6 FA PAX 065-2415896321/ETSV/SAR1500.00/10SEP/RUH/S1-2
 7 FA PAX 065-2415896322/ETSV/SAR1500.00/10SEP/RUH/S1-2`);
                        }}
                      >
                        نموذج تجريبي
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Parsed Results & One-Click Import */}
              <div className="lg:col-span-7 space-y-4">
                {parsedPnrResult ? (
                  <div className="space-y-4">
                    {/* Header Summary Card */}
                    <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-600 text-white font-mono text-sm px-2.5 py-0.5">
                                PNR: {parsedPnrResult.pnr_code}
                              </Badge>
                              <Badge variant="outline" className="text-slate-700 bg-white font-medium">
                                نظام: {parsedPnrResult.gds_system.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-emerald-700 bg-emerald-100/80 border-emerald-300">
                                الحالة: {parsedPnrResult.ticketing.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              إجمالي المسافرين: <span className="font-bold">{parsedPnrResult.passengers.length}</span> | عدد قطاعات الرحلة: <span className="font-bold">{parsedPnrResult.segments.length}</span>
                            </p>
                          </div>
                          <div className="text-left">
                            <div className="text-xs text-slate-500">إجمالي قيمة التذاكر:</div>
                            <div className="text-xl font-black text-emerald-700 font-mono">
                              {fmt(parsedPnrResult.fares.total_fare)} {parsedPnrResult.fares.currency}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Passengers List */}
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="py-3 px-4 bg-slate-50/70 border-b">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <User className="w-4 h-4 text-indigo-600" />
                          قائمة المسافرين المستخرجين ({parsedPnrResult.passengers.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {parsedPnrResult.passengers.map((pax: any, idx: number) => (
                            <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-900 font-mono">{pax.full_name}</div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>النوع: {pax.passenger_type === "ADT" ? "بالغ (Adult)" : "طفل"}</span>
                                    <span>•</span>
                                    <span className="font-mono text-indigo-600">التذكرة: {pax.ticket_number || "غير مصدرة"}</span>
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-slate-100 text-xs">
                                {pax.title || "MR"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Flight Segments */}
                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="py-3 px-4 bg-slate-50/70 border-b">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Plane className="w-4 h-4 text-blue-600" />
                          خطوط السير والقطاعات ({parsedPnrResult.segments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {parsedPnrResult.segments.map((seg: any, idx: number) => (
                            <div key={idx} className="p-3 space-y-2 hover:bg-slate-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-slate-800 text-white font-mono">{seg.flight_number}</Badge>
                                  <span className="text-sm font-semibold text-slate-800">{seg.airline_name}</span>
                                </div>
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                                  {seg.status}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs bg-slate-100/80 p-2.5 rounded-lg">
                                <div className="text-center">
                                  <div className="font-bold text-sm font-mono text-slate-800">{seg.origin}</div>
                                  <div className="text-slate-500 font-mono">{seg.departure_time}</div>
                                  <div className="text-slate-600">{seg.departure_date}</div>
                                </div>
                                <div className="flex flex-col items-center px-4">
                                  <div className="text-[10px] text-slate-500">فئة: {seg.booking_class}</div>
                                  <div className="w-24 h-0.5 bg-slate-300 relative my-1">
                                    <div className="w-2 h-2 rounded-full bg-indigo-600 absolute -top-0.5 right-1/2 translate-x-1/2" />
                                  </div>
                                  <div className="text-[10px] text-indigo-600 font-medium">أمتعة: {seg.baggage}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold text-sm font-mono text-slate-800">{seg.destination}</div>
                                  <div className="text-slate-500 font-mono">{seg.arrival_time}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Fare & Import Action */}
                    <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-white rounded border">
                            <div className="text-slate-500">السعر الأساسي (Base)</div>
                            <div className="font-bold font-mono text-slate-800">{fmt(parsedPnrResult.fares.base_fare)} SAR</div>
                          </div>
                          <div className="p-2 bg-white rounded border">
                            <div className="text-slate-500">الضرائب والرسوم (Taxes)</div>
                            <div className="font-bold font-mono text-slate-800">{fmt(parsedPnrResult.fares.taxes)} SAR</div>
                          </div>
                          <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                            <div className="text-emerald-700 font-medium">العمولة المتوقعة</div>
                            <div className="font-bold font-mono text-emerald-700">{fmt(parsedPnrResult.fares.commission_estimated)} SAR</div>
                          </div>
                        </div>

                        <Button
                          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
                          onClick={() => importPnrMutation.mutate(parsedPnrResult)}
                          disabled={importPnrMutation.isPending}
                        >
                          {importPnrMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 ml-2" />
                          )}
                          استيراد وحفظ في الحجوزات وإصدار الفاتورة فوراً 🚀
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">بانتظار لصق وتفكيك نص PNR</h3>
                    <p className="text-sm text-slate-500 max-w-md mt-1">
                      قم بلصق بيانات الحجز في الحقل الجانبي واضغط "تفكيك وتحليل" لعرض تفاصيل التذاكر والركاب واستيرادها بنقرة واحدة.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CRYPTIC COMMAND TERMINAL */}
          <TabsContent value="terminal" className="space-y-4 pt-4">
            <Card className="border-slate-800 bg-black text-green-400 font-mono shadow-2xl overflow-hidden rounded-2xl">
              {/* Terminal Top Bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                  <div className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  <span className="font-semibold text-slate-200 ml-2">GDS CRYPTIC BLACK SCREEN TERMINAL</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>SYSTEM: <strong className="text-emerald-400">{selectedGds.toUpperCase()}</strong></span>
                  <span>OFFICE ID: <strong className="text-yellow-400">RUH1A0988</strong></span>
                  <span>STATUS: <strong className="text-emerald-400">ONLINE</strong></span>
                </div>
              </div>

              {/* Quick Command Toolbar */}
              <div className="bg-slate-950/90 border-b border-slate-800 p-2 flex flex-wrap gap-1.5 text-xs">
                <span className="text-slate-400 self-center text-[11px] ml-1">أوامر سريعة:</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("AN25OCTRUHDXB")}
                >
                  إتاحة (AN25OCTRUHDXB)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("SS1Y1")}
                >
                  حجز مقعد (SS1Y1)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("NM1ALOTAIBI/ABDULLAH MR")}
                >
                  إضافة مسافر (NM1)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-emerald-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("FXP")}
                >
                  تسعير TST (FXP)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-amber-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("ET")}
                >
                  حفظ PNR وإنهاء (ET)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-blue-400 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("RT6X9ZKL")}
                >
                  استرجاع (RT6X9ZKL)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
                  onClick={() => executeCommandMutation.mutate("HELP")}
                >
                  المساعدة (HELP)
                </Button>
              </div>

              {/* Terminal Screen Body */}
              <div className="p-4 h-96 overflow-y-auto space-y-3 font-mono text-xs leading-relaxed">
                {terminalLogs.map((log, i) => (
                  <div key={i} className={log.type === "input" ? "text-yellow-300 font-bold" : "text-emerald-400 whitespace-pre-wrap"}>
                    {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Terminal Prompt Input */}
              <form onSubmit={handleRunCommand} className="bg-slate-900 border-t border-slate-800 p-2 flex items-center gap-2">
                <span className="text-yellow-400 font-bold px-2">{">"}</span>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm uppercase placeholder-slate-600"
                  placeholder="أدخل أمر GDS واضغط Enter (مثال: AN15SEPRUHDXB أو FXP)..."
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                  <Send className="w-3.5 h-3.5 ml-1" />
                  إرسال
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* TAB 3: NDC & DIRECT AIRLINE APIS */}
          <TabsContent value="ndc" className="space-y-6 pt-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  محرك البحث وحجز عروض خطوط الطيران المباشرة (NDC Direct & Low-Cost Carriers)
                </CardTitle>
                <CardDescription>
                  اتصال مباشر مع بوابات الخطوط السعودية (Saudia NDC)، طيران ناس، طيران أديل، وطيران الإمارات للحصول على أسعار فورية وأوزان مخصصة.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">من (Origin):</label>
                    <Input value={ndcOrigin} onChange={(e) => setNdcOrigin(e.target.value.toUpperCase())} className="font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">إلى (Destination):</label>
                    <Input value={ndcDest} onChange={(e) => setNdcDest(e.target.value.toUpperCase())} className="font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">تاريخ المغادرة:</label>
                    <Input type="date" value={ndcDate} onChange={(e) => setNdcDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">الدرجة:</label>
                    <select
                      className="w-full h-10 border rounded-md px-3 text-sm bg-white"
                      value={ndcClass}
                      onChange={(e) => setNdcClass(e.target.value)}
                    >
                      <option value="economy">الدرجة السياحية (Economy)</option>
                      <option value="business">درجة رجال الأعمال (Business)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      onClick={handleNdcSearch}
                      disabled={isSearchingNdc}
                    >
                      {isSearchingNdc ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : <Search className="w-4 h-4 ml-2" />}
                      بحث مباشر NDC
                    </Button>
                  </div>
                </div>

                {/* NDC Results Grid */}
                {ndcResults && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                      <span>نتائج الرحلات المتوفرة عبر الربط المباشر ({ndcResults.offers_count} رحلة)</span>
                      <Badge variant="outline" className="text-blue-700 bg-blue-50">
                        محدث بأسعار اليوم الحية
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ndcResults.offers.map((offer: any) => (
                        <Card key={offer.id} className="border hover:border-blue-400 transition shadow-sm overflow-hidden">
                          <div className="bg-slate-50 p-3 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-900 text-white font-mono">{offer.carrier_code}</Badge>
                              <span className="font-bold text-sm text-slate-800">{offer.carrier_name}</span>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                              {offer.provider}
                            </Badge>
                          </div>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-center">
                                <div className="text-lg font-bold font-mono text-slate-900">{offer.departure_time}</div>
                                <div className="text-xs font-semibold text-slate-600">{offer.origin}</div>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-500">{offer.duration}</span>
                                <div className="w-20 h-0.5 bg-slate-300 relative my-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 absolute -top-0.5 right-1/2 translate-x-1/2" />
                                </div>
                                <span className="text-[10px] text-emerald-600">{offer.stops}</span>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold font-mono text-slate-900">{offer.arrival_time}</div>
                                <div className="text-xs font-semibold text-slate-600">{offer.destination}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 text-xs text-slate-600 pt-1">
                              <Badge variant="outline" className="bg-slate-100 text-[11px]">
                                🧳 أمتعة: {offer.baggage_allowance}
                              </Badge>
                              <Badge variant="outline" className="bg-slate-100 text-[11px]">
                                💺 مقاعد متاحة: {offer.seats_available}
                              </Badge>
                            </div>

                            <div className="pt-2 border-t flex items-center justify-between">
                              <div>
                                <div className="text-xs text-slate-500">السعر الإجمالي شامل الضريبة:</div>
                                <div className="text-xl font-black text-blue-700 font-mono">
                                  {fmt(offer.total_price)} {offer.currency}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                onClick={() => {
                                  // Convert NDC offer to PNR struct and import
                                  const pnrStruct = {
                                    pnr_code: "NDC" + Math.random().toString(36).substring(2, 6).toUpperCase(),
                                    gds_system: "ndc",
                                    passengers: [
                                      { full_name: "ALOTAIBI/ABDULLAH MR", first_name: "ABDULLAH", last_name: "ALOTAIBI", title: "MR", passenger_type: "ADT" }
                                    ],
                                    segments: [
                                      {
                                        airline_code: offer.carrier_code,
                                        airline_name: offer.carrier_name,
                                        flight_number: offer.flight_number,
                                        booking_class: "Y",
                                        origin: offer.origin,
                                        destination: offer.destination,
                                        departure_date: ndcDate,
                                        departure_time: offer.departure_time,
                                        arrival_time: offer.arrival_time,
                                        status: "مؤكد NDC",
                                        baggage: offer.baggage_allowance
                                      }
                                    ],
                                    fares: {
                                      currency: offer.currency,
                                      base_fare: offer.base_fare,
                                      taxes: offer.taxes,
                                      total_fare: offer.total_price,
                                      commission_estimated: Math.round(offer.total_price * 0.08)
                                    },
                                    ticketing: {
                                      status: "ISSUED_NDC",
                                      ticket_numbers: [`${offer.carrier_code === "SV" ? "065" : "176"}-${Math.floor(1000000000 + Math.random() * 9000000000)}`]
                                    }
                                  };
                                  importPnrMutation.mutate(pnrStruct);
                                }}
                              >
                                حجز وإصدار فوري
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: IMPORT HISTORY */}
          <TabsContent value="history" className="space-y-4 pt-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-700" />
                  سجل عمليات استيراد وتفكيك PNR السابقة
                </CardTitle>
                <CardDescription>
                  جميع سجلات الـ PNR التي تم استيرادها وتحويلها إلى حجوزات وفواتير مبيعات في النظام.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-100/80 text-slate-700 border-y">
                      <tr>
                        <th className="p-3">رقم الحجز PNR</th>
                        <th className="p-3">نظام GDS</th>
                        <th className="p-3">اسم المسافر</th>
                        <th className="p-3">رقم الرحلة وخط السير</th>
                        <th className="p-3">تاريخ السفر</th>
                        <th className="p-3">رقم التذكرة</th>
                        <th className="p-3">الإجمالي</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">بواسطة</th>
                        <th className="p-3">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gdsHistory?.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold font-mono text-indigo-600">{row.pnr_code}</td>
                          <td className="p-3 uppercase font-semibold text-slate-700">{row.gds_system}</td>
                          <td className="p-3 font-mono font-medium">{row.passenger_name}</td>
                          <td className="p-3">{row.flight_number} ({row.route})</td>
                          <td className="p-3">{row.departure_date}</td>
                          <td className="p-3 font-mono text-slate-600">{row.ticket_number || "—"}</td>
                          <td className="p-3 font-bold font-mono text-emerald-700">{fmt(row.total_fare)} {row.currency}</td>
                          <td className="p-3">
                            <Badge className={row.status === "imported" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                              {row.status === "imported" ? "مستورد وفاتورة صادرة" : "تم التفكيك"}
                            </Badge>
                          </td>
                          <td className="p-3">{row.created_by}</td>
                          <td className="p-3 text-slate-500 font-mono">{row.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
