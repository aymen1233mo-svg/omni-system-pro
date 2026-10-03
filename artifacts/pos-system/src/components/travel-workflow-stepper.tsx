import { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export type BookingStatus = "draft" | "booked" | "paid" | "issued" | "confirmed" | "completed" | "cancelled" | "refunded";

interface WorkflowStepperProps {
  bookingId: number | string;
  currentStatus: BookingStatus;
  onStatusChange?: (newStatus: BookingStatus) => void;
  readOnly?: boolean;
}

const STEPS: { key: BookingStatus; label: string; description: string }[] = [
  { key: "draft", label: "طلب مبدئي", description: "استلام طلب العميل" },
  { key: "booked", label: "حجز مؤقت", description: "حجز المقعد PNR" },
  { key: "paid", label: "مسدد", description: "دفع قيمة التذكرة" },
  { key: "issued", label: "تم الإصدار", description: "إصدار التذكرة الرسمية" },
  { key: "completed", label: "مكتمل", description: "إتمام الرحلة بنجاح" },
];

export function TravelWorkflowStepper({
  bookingId,
  currentStatus,
  onStatusChange,
  readOnly = false
}: WorkflowStepperProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Determine current step index
  const isCancelled = currentStatus === "cancelled";
  const isRefunded = currentStatus === "refunded";

  const getStepIndex = (status: BookingStatus) => {
    switch (status) {
      case "draft": return 0;
      case "booked": return 1;
      case "paid": return 2;
      case "issued":
      case "confirmed": return 3;
      case "completed": return 4;
      default: return 0;
    }
  };

  const currentIdx = getStepIndex(currentStatus);

  const handleTransition = async (targetStatus: BookingStatus) => {
    if (readOnly) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem("pos_token") ?? "";
      const res = await fetch(`/api/travel/bookings/${bookingId}/workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_status: targetStatus,
          note: `تغيير الحالة يدوي بواسطة المستخدم إلى ${targetStatus}`
        })
      });

      if (res.ok) {
        toast({ title: "تم تحديث حالة العملية وتوثيقها في سجل التدقيق بنجاح" });
        if (onStatusChange) onStatusChange(targetStatus);
      } else {
        const err = await res.json();
        toast({ title: "خطأ", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            مسار دورة العمل الحالية (Workflow Lifecycle)
          </h4>
          <p className="text-[11px] text-slate-500">تتبع الخطوات وتغيير الحالة مع توثيق التدقيق الآلي</p>
        </div>

        {isCancelled ? (
          <span className="px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-xs font-bold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> ملغي Cancelled
          </span>
        ) : isRefunded ? (
          <span className="px-2.5 py-1 bg-orange-100 text-orange-800 border border-orange-200 rounded-full text-xs font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> مسترجع Refunded
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> قيد المتابعة النشطة
          </span>
        )}
      </div>

      {/* Stepper progress */}
      <div className="grid grid-cols-5 gap-2 relative">
        {STEPS.map((step, idx) => {
          const isDone = !isCancelled && !isRefunded && idx <= currentIdx;
          const isCurrent = !isCancelled && !isRefunded && idx === currentIdx;

          return (
            <div
              key={step.key}
              className={`p-2.5 rounded-lg border text-center relative transition-all ${
                isCurrent
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                  : isDone
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex justify-center mb-1">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className={`text-xs font-bold ${isCurrent ? "text-primary" : isDone ? "text-emerald-900" : "text-slate-600"}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">{step.description}</p>
            </div>
          );
        })}
      </div>

      {/* Action buttons to transition */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between pt-2 border-t gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold">الانتقال السريع إلى:</span>
            {currentIdx === 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => handleTransition("booked")}
                className="text-xs h-7 gap-1 text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
              >
                تأكيد الحجز (PNR)
              </Button>
            )}
            {currentIdx <= 1 && (
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => handleTransition("paid")}
                className="text-xs h-7 gap-1 text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
              >
                تسجيل السداد
              </Button>
            )}
            {currentIdx <= 2 && (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => handleTransition("issued")}
                className="text-xs h-7 gap-1 bg-primary hover:bg-primary/90 text-white"
              >
                إصدار التذكرة النهائية
              </Button>
            )}
            {currentIdx === 3 && (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => handleTransition("completed")}
                className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                إتمام الرحلة بنجاح
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isCancelled && !isRefunded && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => handleTransition("cancelled")}
                  className="text-xs h-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  إلغاء الحجز
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => handleTransition("refunded")}
                  className="text-xs h-7 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                >
                  استرجاع
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
