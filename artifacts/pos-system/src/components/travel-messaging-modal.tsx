import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Copy, Check, MessageCircle, Mail, Phone, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MessagingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string;
  phone?: string;
  customerId?: number;
  referenceType?: string;
  referenceId?: string | number;
  initialType?: "flight_confirmation" | "visa_update" | "hotel_voucher" | "payment_receipt" | "general_reminder";
  data?: any;
}

export function TravelMessagingModal({
  open,
  onOpenChange,
  customerName = "",
  phone = "",
  customerId = 1,
  referenceType = "booking",
  referenceId = "",
  initialType = "flight_confirmation",
  data = {}
}: MessagingModalProps) {
  const { toast } = useToast();
  const [recipientPhone, setRecipientPhone] = useState(phone);
  const [msgType, setMsgType] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [template, setTemplate] = useState(initialType);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  // Generate dynamic Arabic message content
  const generateMessage = () => {
    const cName = customerName || "العميل الكريم";
    const agencyName = "وكالة الإتقان للسفريات والسياحة";
    const contactNumber = "0501234567";

    switch (template) {
      case "flight_confirmation":
        return `مرحباً بك ${cName} ✈️
يسعدنا إعلامك بأنه تم تأكيد وإصدار تذكرة طيرانك بنجاح.
📌 رقم الحجز (PNR): ${data?.pnr || "X78Y90"}
🎫 رقم التذكرة: ${data?.ticket_number || "065-2415896321"}
🛫 خط الرحلة: ${data?.origin_city || "الرياض"} ⬅️ ${data?.destination_city || "دبي"}
🗓️ تاريخ المغادرة: ${data?.departure_date || "2026-09-10"}
✈️ الخطوط الجوية: ${data?.airline_supplier || "الخطوط السعودية"}
نتمنى لك رحلة ممتعة وآمنة!
_${agencyName}_`;

      case "hotel_voucher":
        return `مرحباً بك ${cName} 🏨
تم تأكيد حجز الفندق الخاص بكم:
🏨 الفندق: ${data?.hotel_name || "فندق أتلانتس دبي"}
📍 المدينة: ${data?.city_country || "دبي"}
🗓️ تاريخ الدخول: ${data?.check_in || "2026-09-10"}
🗓️ تاريخ الخروج: ${data?.check_out || "2026-09-18"}
🔑 نوع الغرفة: ${data?.room_type || "جناح ديلوكس"}
🔖 رقم الحجز: ${data?.booking_ref || "HTL-7701"}
نتمنى لك إقامة هانئة وسعيدة!
_${agencyName}_`;

      case "visa_update":
        return `عزيزنا ${cName} 🛂
بخصوص طلب تأشيرة السفر إلى (${data?.country || "فرنسا"}):
الحالة الحالية: ${data?.status === "approved" ? "✅ تم الإصدار بنجاح وجاهزة للتسليم" : "⏳ قيد المعالجة بالسفارة"}
رقم المعاملة: ${data?.visa_number || "VSA-9901"}
لأي استفسار يرجى التواصل معنا على: ${contactNumber}.
_${agencyName}_`;

      case "payment_receipt":
        return `عزيزنا ${cName} 💳
تم استلام دفعتكم بنجاح:
💰 المبلغ: ${data?.amount || data?.selling_price || "1500"} ريال
🧾 رقم السند/الفاتورة: ${referenceId || "REC-2026-101"}
✅ طريقة الدفع: ${data?.payment_method || "نقداً"}
شكراً لتعاملكم معنا ويسعدنا خدمتكم دائماً.
_${agencyName}_`;

      case "general_reminder":
      default:
        return `تذكير موعد السفر ✈️
عزيزنا ${cName}، نود تذكيركم بموعد رحلتكم القادمة بتاريخ ${data?.departure_date || "قريباً"}.
يرجى التأكد من صلاحية الجواز والتواجد في المطار قبل الإقلاع بـ 3 ساعات على الأقل.
رافقتكم السلامة!
_${agencyName}_`;
    }
  };

  const [customText, setCustomText] = useState(generateMessage());

  // Handle template change
  const handleTemplateChange = (t: any) => {
    setTemplate(t);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    toast({ title: "تم نسخ النص إلى الحافظة بنجاح" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const token = sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch("/api/travel/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName,
          phone: recipientPhone || phone,
          message_type: msgType,
          template_name: template,
          content: customText,
          reference_type: referenceType,
          reference_id: referenceId
        })
      });

      const json = await res.json();
      if (res.ok) {
        toast({ title: "تم تسجيل وإرسال الإشعار بنجاح" });
        if (msgType === "whatsapp" && json.whatsapp_url) {
          window.open(json.whatsapp_url, "_blank");
        }
        onOpenChange(false);
      } else {
        toast({ title: "خطأ", description: json.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 bg-slate-900 text-white flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-white">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            مركز المراسلات والإشعارات للعميل
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Channel selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={msgType === "whatsapp" ? "default" : "outline"}
              onClick={() => setMsgType("whatsapp")}
              className={`flex-1 text-xs gap-1.5 h-9 ${msgType === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              <MessageCircle className="w-4 h-4" />
              واتساب (WhatsApp)
            </Button>
            <Button
              type="button"
              variant={msgType === "sms" ? "default" : "outline"}
              onClick={() => setMsgType("sms")}
              className="flex-1 text-xs gap-1.5 h-9"
            >
              <Phone className="w-4 h-4" />
              رسالة نصية (SMS)
            </Button>
            <Button
              type="button"
              variant={msgType === "email" ? "default" : "outline"}
              onClick={() => setMsgType("email")}
              className="flex-1 text-xs gap-1.5 h-9"
            >
              <Mail className="w-4 h-4" />
              بريد إلكتروني
            </Button>
          </div>

          {/* Recipient info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold mb-1 block">العميل</label>
              <Input
                value={customerName}
                disabled
                readOnly
                className="bg-slate-50 text-xs h-8"
              />
            </div>
            <div>
              <label className="text-slate-600 font-semibold mb-1 block">رقم الهاتف / الواتساب</label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="text-xs h-8 font-mono"
              />
            </div>
          </div>

          {/* Template select */}
          <div>
            <label className="text-xs text-slate-600 font-semibold mb-1 block">اختر قالب الرسالة</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "flight_confirmation", label: "✈️ تأكيد تذكرة الطيران" },
                { id: "hotel_voucher", label: "🏨 تأكيد فندق وفو Voucher" },
                { id: "visa_update", label: "🛂 إشعار حالة التأشيرة" },
                { id: "payment_receipt", label: "💳 سند استلام دفعة" },
                { id: "general_reminder", label: "⏰ تذكير موعد السفر" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    handleTemplateChange(t.id);
                    setCustomText(generateMessage());
                  }}
                  className={`text-right p-2 rounded border text-xs transition-colors ${
                    template === t.id
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-600 font-semibold">نص الرسالة</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-900"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? "تم النسخ" : "نسخ النص"}
              </Button>
            </div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={6}
              className="w-full text-xs p-2.5 rounded border border-slate-200 focus:ring-1 focus:ring-primary focus:outline-none leading-relaxed bg-slate-50 font-sans"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !recipientPhone}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "جاري الإرسال..." : "إرسال وتسجيل بالسجل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
