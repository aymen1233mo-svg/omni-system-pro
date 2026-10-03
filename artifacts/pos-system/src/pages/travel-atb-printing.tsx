import React, { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Ticket,
  FileText,
  Download,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Sliders,
  Plane,
  Eye,
  ArrowRight
} from "lucide-react";

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function TravelAtbPrintingPage() {
  const [selectedBookingId, setSelectedBookingId] = useState<number>(1);
  const [activeFormat, setActiveFormat] = useState<"atb" | "thermal80">("atb");

  // Query Bookings
  const { data: bookings } = useQuery<any[]>({
    queryKey: ["travel-bookings-list"],
    queryFn: () => fetchWithAuth("/api/travel/bookings")
  });

  const activeId = selectedBookingId || bookings?.[0]?.id || 1;

  // Query Rendered ATB Data
  const { data: atbData, isLoading } = useQuery<any>({
    queryKey: ["atb-render-data", activeId],
    queryFn: () => fetchWithAuth(`/api/travel/atb/render-data/${activeId}`),
    enabled: !!activeId
  });

  const handlePrint = () => {
    window.print();
  };

  const booking = atbData || {
    airline_name: "الخطوط السعودية (Saudia)",
    airline_code: "SV",
    passenger_name: "ALOTAIBI/ABDULLAH MR",
    eticket_number: "065-2415896321",
    pnr: "6X9ZKL",
    flight_number: "SV 112",
    booking_class: "Y",
    origin_code: "RUH",
    origin_name: "الرياض (King Khalid Intl)",
    destination_code: "DXB",
    destination_name: "دبي (Dubai Intl)",
    departure_date: "10 SEP 2026",
    boarding_time: "07:30",
    departure_time: "08:10",
    gate: "14B",
    seat: "12A",
    group: "GROUP 2",
    sequence_number: "048",
    baggage_allowance: "1 PC / 23 KG",
    barcode_string: "M1ALOTAIBI/ABDULLAH   E6X9ZKL RUHDXBSV 0112 253Y012A0048 100"
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-zinc-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-600/30 border border-amber-400/30 rounded-xl">
                <Printer className="w-8 h-8 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">محرك طباعة التذاكر وبطاقات الصعود ATB & Thermal Printing</h1>
                <p className="text-sm text-slate-300 mt-1">
                  طباعة بطاقات صعود الطائرة القياسية IATA ATB2، الباركود الثنائي PDF417، وفواتير الطابعات الحرارية 80mm
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
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer" onClick={handlePrint}>
              <Printer className="w-4 h-4 ml-2" />
              طباعة فورية للطابعة المجهزة
            </Button>
          </div>
        </div>

        {/* Controls & Selector Strip */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">اختر التذكرة المراد طباعتها:</label>
              <select
                className="h-10 border rounded-lg px-3 bg-white text-xs font-medium min-w-[280px]"
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(Number(e.target.value))}
              >
                {bookings?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.pnr} - {b.passenger_name || "مسافر"} ({b.flight_number || "SV"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={activeFormat === "atb" ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setActiveFormat("atb")}
              >
                <Ticket className="w-4 h-4 ml-1.5" />
                بطاقة صعود الطائرة (IATA ATB Pass)
              </Button>
              <Button
                variant={activeFormat === "thermal80" ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setActiveFormat("thermal80")}
              >
                <FileText className="w-4 h-4 ml-1.5" />
                إيصال حراري (80mm Thermal Receipt)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PRINT CANVAS DISPLAY */}
        {activeFormat === "atb" ? (
          /* REALISTIC IATA ATB2 BOARDING PASS CARD */
          <div className="flex justify-center p-4 bg-slate-100 rounded-2xl overflow-x-auto print:bg-white print:p-0">
            <div
              className="w-[850px] bg-[#fbf9f4] border-2 border-slate-400 rounded-xl shadow-2xl p-6 font-mono text-slate-900 relative print:border-none print:shadow-none print:w-full"
              style={{ minHeight: "280px" }}
            >
              {/* Magnetic Stripe Simulation on Back/Top */}
              <div className="h-4 bg-slate-900 rounded-t -mt-6 -mx-6 mb-4 opacity-90" />

              <div className="grid grid-cols-12 gap-4">
                {/* Main Body (Left 8 Cols) */}
                <div className="col-span-8 border-l-2 border-dashed border-slate-400 pl-4 space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h2 className="text-base font-black uppercase text-indigo-950">{booking.airline_name}</h2>
                      <div className="text-[10px] text-slate-500">ELECTRONIC BOARDING PASS / PASSENGER TICKET</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono">PNR: {booking.pnr}</div>
                      <div className="text-[10px] text-slate-500">TKT: {booking.eticket_number}</div>
                    </div>
                  </div>

                  {/* Passenger Name & Flight Details */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="col-span-2">
                      <div className="text-[9px] text-slate-500 uppercase">PASSENGER NAME / اسم المسافر</div>
                      <div className="text-sm font-black tracking-wide">{booking.passenger_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase">CLASS / الفئة</div>
                      <div className="text-sm font-black">{booking.booking_class} (ECONOMY)</div>
                    </div>
                  </div>

                  {/* Route & Times */}
                  <div className="grid grid-cols-4 gap-2 text-xs bg-slate-200/60 p-2.5 rounded">
                    <div>
                      <div className="text-[9px] text-slate-500">FROM / من</div>
                      <div className="font-black text-sm">{booking.origin_code}</div>
                      <div className="text-[9px] text-slate-600 truncate">{booking.origin_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">TO / إلى</div>
                      <div className="font-black text-sm">{booking.destination_code}</div>
                      <div className="text-[9px] text-slate-600 truncate">{booking.destination_name}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">FLIGHT / الرحلة</div>
                      <div className="font-black text-sm text-indigo-900">{booking.flight_number}</div>
                      <div className="text-[9px] text-slate-600">{booking.departure_date}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">BOARDING / الصعود</div>
                      <div className="font-black text-sm text-emerald-800">{booking.boarding_time}</div>
                    </div>
                  </div>

                  {/* Gate, Seat, Group, Sequence */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 border-2 border-slate-800 rounded bg-white">
                      <div className="text-[9px] text-slate-500">GATE / البوابة</div>
                      <div className="text-base font-black">{booking.gate}</div>
                    </div>
                    <div className="p-2 border-2 border-indigo-900 rounded bg-indigo-50 text-indigo-950">
                      <div className="text-[9px] text-indigo-700">SEAT / المقعد</div>
                      <div className="text-base font-black">{booking.seat}</div>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <div className="text-[9px] text-slate-500">GROUP / المجموعة</div>
                      <div className="text-xs font-bold">{booking.group}</div>
                    </div>
                    <div className="p-2 border rounded bg-white">
                      <div className="text-[9px] text-slate-500">SEQ / التسلسل</div>
                      <div className="text-xs font-bold">{booking.sequence_number}</div>
                    </div>
                  </div>

                  {/* Barcode Mockup */}
                  <div className="pt-1 flex items-center justify-between">
                    <div className="text-[9px] font-mono text-slate-400 truncate max-w-sm">
                      {booking.barcode_string}
                    </div>
                    <div className="bg-white p-1 border rounded shadow-sm">
                      <QrCode className="w-12 h-12 text-slate-900" />
                    </div>
                  </div>
                </div>

                {/* Tear-off Passenger Coupon Stub (Right 4 Cols) */}
                <div className="col-span-4 space-y-3 pr-2 text-xs">
                  <div className="border-b pb-1">
                    <div className="text-[9px] font-black uppercase text-indigo-950">{booking.airline_code} PASSENGER STUB</div>
                    <div className="text-[8px] text-slate-400">قسيمة المسافر</div>
                  </div>

                  <div>
                    <div className="text-[8px] text-slate-500">NAME</div>
                    <div className="font-bold text-[11px] truncate">{booking.passenger_name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <div className="text-[8px] text-slate-500">FLIGHT</div>
                      <div className="font-bold">{booking.flight_number}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">DATE</div>
                      <div className="font-bold">{booking.departure_date?.slice(0, 6)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <div className="text-[8px] text-slate-500">FROM</div>
                      <div className="font-bold">{booking.origin_code}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">TO</div>
                      <div className="font-bold">{booking.destination_code}</div>
                    </div>
                  </div>

                  <div className="p-2 border border-slate-900 rounded bg-white flex justify-between items-center">
                    <div>
                      <div className="text-[8px] text-slate-500">SEAT</div>
                      <div className="font-black text-sm">{booking.seat}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-slate-500">GATE</div>
                      <div className="font-bold text-xs">{booking.gate}</div>
                    </div>
                  </div>

                  <div className="text-[8px] text-slate-500 pt-2 border-t text-center">
                    BAGGAGE: {booking.baggage_allowance}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 80mm THERMAL RECEIPT LAYOUT */
          <div className="flex justify-center p-4 bg-slate-100 rounded-2xl print:bg-white">
            <div className="w-[340px] bg-white border border-slate-300 p-6 shadow-xl font-mono text-xs text-slate-900 space-y-4 rounded-lg">
              <div className="text-center space-y-1 border-b pb-3">
                <h2 className="font-bold text-sm">وكالة أومني فلاي للسفر والسياحة</h2>
                <div className="text-[10px] text-slate-500">OMNIFLY PRO ERP TRAVEL AGENCY</div>
                <div className="text-[10px]">الرقم الضريبي: 310928374600003</div>
                <div className="text-[10px]">الهاتف: 9200887766</div>
              </div>

              <div className="space-y-1 text-[11px] border-b pb-3">
                <div className="flex justify-between">
                  <span>رقم الحجز (PNR):</span>
                  <span className="font-bold">{booking.pnr}</span>
                </div>
                <div className="flex justify-between">
                  <span>رقم التذكرة:</span>
                  <span>{booking.eticket_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>اسم المسافر:</span>
                  <span className="font-bold">{booking.passenger_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>الرحلة:</span>
                  <span>{booking.flight_number} ({booking.origin_code} ✈️ {booking.destination_code})</span>
                </div>
                <div className="flex justify-between">
                  <span>تاريخ السفر:</span>
                  <span>{booking.departure_date}</span>
                </div>
                <div className="flex justify-between">
                  <span>المقعد:</span>
                  <span className="font-bold">{booking.seat} (بوابة {booking.gate})</span>
                </div>
              </div>

              <div className="flex justify-center py-2">
                <QrCode className="w-24 h-24 text-slate-900" />
              </div>

              <div className="text-center text-[10px] text-slate-500 border-t pt-2 space-y-1">
                <div>يرجى التواجد في المطار قبل الإقلاع بـ 3 ساعات</div>
                <div>نتمنى لكم رحلة سعيدة وموفقة!</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
