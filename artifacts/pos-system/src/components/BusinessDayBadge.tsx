import React, { useState } from "react";
import { useBusinessDay } from "../lib/business-day";
import { Clock, Calendar, Moon, Sun, ChevronDown, CheckCircle, Info } from "lucide-react";
import { Link } from "wouter";

export function BusinessDayBadge() {
  const { businessDate, calendarDate, calendarTime, isPastMidnight, cutoffTime, enabled } = useBusinessDay();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-xs">
      <button
        onClick={() => setOpen(!open)}
        type="button"
        title="حالة توقيت يوم العمل المالي وتقليب التاريخ"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-all ${
          isPastMidnight
            ? "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/50 shadow-sm animate-pulse"
            : "bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800"
        }`}
      >
        {isPastMidnight ? (
          <Moon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        ) : (
          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        <span className="hidden sm:inline text-muted-foreground">يوم العمل:</span>
        <span className="font-bold text-white font-mono">{businessDate}</span>
        {isPastMidnight && (
          <span className="bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded text-[10px] hidden md:inline">
            تمديد بعد 12:00 ليل
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 z-50 text-right text-slate-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                توقيت يوم العمل والتقليب
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                  enabled ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-slate-800 text-slate-400"
                }`}
              >
                {enabled ? "مفعّل" : "منتصف الليل 12:00"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="text-slate-400">تاريخ العمل المعتمد حالياً:</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">{businessDate}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">التاريخ التقويمي الفعلي:</span>
                <span className="font-mono text-slate-300">{calendarDate}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">الساعة الحالية:</span>
                <span className="font-mono text-slate-300">{calendarTime}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">وقت تقليب اليوم الجديد:</span>
                <span className="font-mono font-bold text-amber-400">{cutoffTime} فجراً</span>
              </div>

              {isPastMidnight ? (
                <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/30 text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
                  <Moon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>فترة التمديد الليلي نشطة:</strong>
                    <br />
                    أنت تعمل الآن بعد الساعة 12:00 منتصف الليل، وسيتم احتساب كافة الفواتير والحجوزات والقيود تحت تاريخ{" "}
                    <span className="underline font-bold text-white">{businessDate}</span> حتى حلول الساعة{" "}
                    <span className="font-bold text-white">{cutoffTime}</span>.
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-slate-950/50 border border-slate-800 text-slate-400 text-[11px] leading-relaxed flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  يقلب تاريخ النظام تلقائياً كل ليلة عند الساعة {cutoffTime} فجراً.
                </div>
              )}
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="text-primary hover:underline font-semibold"
              >
                تعديل وقت التقليب في الإعدادات ←
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
