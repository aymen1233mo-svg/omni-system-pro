import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Download, CheckCircle, Plane, Building2, Globe, QrCode } from "lucide-react";
import { getEffectiveDocPrintSettings } from "@/lib/printUtils";

interface PrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "ticket" | "hotel_voucher" | "visa_card" | "invoice" | "quotation";
  data: any;
}

export function TravelPrintModal({
  open,
  onOpenChange,
  documentType,
  data
}: PrintModalProps) {
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal">("a4");
  const eff = getEffectiveDocPrintSettings();
  const accent = eff.accentColor || "#1e293b";

  const handlePrint = () => {
    if (printFormat === "thermal") {
      const styleId = "__travel-thermal-print__";
      document.getElementById(styleId)?.remove();
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @page { size: 80mm auto; margin: 0; padding: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #printable-travel-document, #printable-travel-document * { visibility: visible !important; }
          #printable-travel-document {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 2mm 4mm 2mm 8mm !important;
            box-sizing: border-box !important;
            background: white !important;
            font-size: 11px !important;
            z-index: 999999 !important;
          }
        }
      `;
      document.head.appendChild(style);
      window.print();
      setTimeout(() => {
        document.getElementById(styleId)?.remove();
      }, 1000);
    } else {
      window.print();
    }
  };

  const agency = {
    name: eff.headerRightText1 || eff.companyName || "شركة الإتقان للسفريات والسياحة وخدمات العمرة",
    nameEn: eff.headerLeftText1 || eff.companySubtitle || "OMNISYSTEM PRO TRAVEL & TOURISM",
    license: eff.headerRightText2 || eff.address || "ترخيص هيئة الطيران المدني",
    taxNumber: eff.taxNumber || "300000000000003",
    address: eff.address || "المملكة العربية السعودية",
    phone: eff.phone || eff.headerRightText3 || "—",
    logoUrl: eff.showLogo ? eff.logoUrl : ""
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-4xl p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 bg-slate-900 text-white flex flex-row items-center justify-between print:hidden">
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <Printer className="w-4 h-4 text-primary" />
            معاينة وطباعة المستند الاحترافي (Professional Document Print)
          </DialogTitle>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 rounded p-0.5 text-xs">
              <button
                onClick={() => setPrintFormat("a4")}
                className={`px-3 py-1 rounded transition-colors ${printFormat === "a4" ? "bg-primary text-white font-bold" : "text-slate-300"}`}
              >
                صفحة A4
              </button>
              <button
                onClick={() => setPrintFormat("thermal")}
                className={`px-3 py-1 rounded transition-colors ${printFormat === "thermal" ? "bg-primary text-white font-bold" : "text-slate-300"}`}
              >
                حراري 80mm
              </button>
            </div>
            <Button size="sm" onClick={handlePrint} className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Printer className="w-3.5 h-3.5" />
              طباعة الآن
            </Button>
          </div>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto p-6 bg-slate-100/60 print:p-0 print:bg-white print:max-h-none">
          {/* Printable Document Container */}
          <div
            id="printable-travel-document"
            className={`mx-auto bg-white border border-slate-200 shadow-lg rounded-xl print:shadow-none print:border-none print:m-0 ${
              printFormat === "a4" ? "max-w-2xl p-8" : "max-w-xs p-4 text-[11px]"
            }`}
          >
            {/* Header / Agency Banner */}
            <div className="pb-4 mb-4 flex items-start justify-between" style={{ borderBottom: `2px solid ${accent}` }}>
              <div>
                <h2 className="font-extrabold text-base text-slate-900 leading-snug">{agency.name}</h2>
                <p className="text-[11px] text-slate-600 font-sans tracking-wide uppercase">{agency.nameEn}</p>
                <p className="text-[10px] text-slate-500 mt-1">{agency.license}{eff.showTaxNumber && agency.taxNumber ? ` | الرقم الضريبي: ${agency.taxNumber}` : ""}</p>
                <p className="text-[10px] text-slate-500">هاتف: {agency.phone}</p>
              </div>
              <div className="text-left">
                {agency.logoUrl ? (
                  <img src={agency.logoUrl} alt="Logo" className="max-h-16 max-w-[120px] object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <div className="w-16 h-16 border-2 border-primary/20 rounded-lg flex flex-col items-center justify-center bg-primary/5 text-primary">
                    <Plane className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-1">TRAVEL</span>
                  </div>
                )}
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-white py-1.5 px-3 rounded text-center mb-5 flex items-center justify-between" style={{ backgroundColor: accent }}>
              <span className="text-xs font-bold font-mono">NO: {data?.booking_number || data?.ticket_number || data?.invoice_number || "DOC-2026-001"}</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {documentType === "ticket" ? "تذكرة سفر إلكترونية وجدول رحلة (E-TICKET / ITINERARY)" :
                 documentType === "hotel_voucher" ? "قسيمة حجز فندقي (HOTEL CONFIRMATION VOUCHER)" :
                 documentType === "visa_card" ? "بطاقة متابعة تأشيرة سفر (VISA CARD)" :
                 (eff.invoiceHeaderText || "فاتورة وسند سياحي معتمد (TAX INVOICE)")}
              </span>
              <span className="text-xs font-mono">{new Date().toISOString().slice(0, 10)}</span>
            </div>

            {/* Document Specific Content */}
            {documentType === "ticket" && (
              <div className="space-y-4">
                {/* Passenger Info Grid */}
                <div className="bg-slate-50 border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم المسافر (Passenger):</span>
                    <strong className="text-slate-900">{data?.passenger_name || data?.customer_name || "عبدالله محمد العتيبي"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم الجواز (Passport):</span>
                    <strong className="font-mono text-slate-900">{data?.passport_number || "A12345678"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم الحجز (PNR):</span>
                    <strong className="font-mono text-blue-700 font-bold">{data?.pnr || "X78Y90"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم التذكرة (Ticket No):</span>
                    <strong className="font-mono text-slate-900">{data?.ticket_number || "065-2415896321"}</strong>
                  </div>
                </div>

                {/* Flight Route Details */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-white p-2 text-xs font-bold flex justify-between">
                    <span>تفاصيل رحلة الطيران (Flight Details)</span>
                    <span>{data?.airline_supplier || "الخطوط السعودية Saudia"}</span>
                  </div>
                  <div className="p-3 grid grid-cols-3 gap-2 text-xs text-center divide-x divide-x-reverse">
                    <div>
                      <span className="text-[10px] text-slate-400 block">محطة الإقلاع (From)</span>
                      <strong className="text-sm text-slate-900 block mt-0.5">{data?.origin_city || "الرياض (RUH)"}</strong>
                      <span className="text-[11px] text-slate-600 block mt-1">🗓️ {data?.departure_date || "2026-09-10"}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-primary font-bold">✈️ {data?.flight_number || "SV-112"}</span>
                      <span className="text-[10px] text-slate-400">درجة السفر: {data?.travel_class || "سياحية"}</span>
                      <span className="text-[10px] text-slate-400">الأمتعة: 2 × 23 كجم</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">محطة الوصول (To)</span>
                      <strong className="text-sm text-slate-900 block mt-0.5">{data?.destination_city || "دبي (DXB)"}</strong>
                      <span className="text-[11px] text-slate-600 block mt-1">🗓️ {data?.return_date || "2026-09-18"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {documentType === "hotel_voucher" && (
              <div className="space-y-4">
                <div className="bg-slate-50 border rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم النزيل الرئيسي:</span>
                    <strong className="text-slate-900">{data?.passenger_name || data?.customer_name || "عبدالله محمد العتيبي"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم حجز الفندق:</span>
                    <strong className="font-mono text-blue-700">{data?.booking_ref || "HTL-7701"}</strong>
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-bold text-sm text-slate-900">🏨 {data?.hotel_name || "فندق أتلانتس دبي"}</span>
                    <span className="text-slate-500">{data?.city_country || "دبي - الإمارات"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block">تاريخ الدخول (Check-in)</span>
                      <strong className="text-slate-900">{data?.check_in || "2026-09-10"}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">الليالي (Nights)</span>
                      <strong className="text-slate-900">{data?.nights || 8} ليالٍ</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">تاريخ الخروج (Check-out)</span>
                      <strong className="text-slate-900">{data?.check_out || "2026-09-18"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="mt-4 border-t pt-3 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">حالة السداد:</span>
                <span className="font-bold text-emerald-700">مسدد بالكامل (Paid in Full)</span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px]">المبلغ الإجمالي:</span>
                <span className="text-base font-black text-slate-900">{(data?.selling_price || data?.total_amount || 1500).toLocaleString()} ريال</span>
              </div>
            </div>

            {/* Terms & Footer Barcode */}
            <div className="mt-6 border-t pt-3 text-[9px] text-slate-500 space-y-1">
              {eff.termsAndConditions && <p>• {eff.termsAndConditions}</p>}
              <p>• يرجى التواجد في المطار قبل 3 ساعات من موعد إقلاع الرحلات الدولية وساعتين للرحلات الداخلية.</p>
              <p>• تطبق الشروط والأحكام الخاصة بسياسة الإلغاء والاسترجاع لشركة الطيران الناقلة.</p>
              <div className="pt-2 flex justify-between items-center text-slate-400 font-mono text-[8px]">
                <span>{eff.invoiceFooterText || `تم الإصدار بواسطة ${agency.name}`}</span>
                <span>VERIFIED ELECTRONIC DOCUMENT</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
