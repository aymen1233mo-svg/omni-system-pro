import React from "react";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export function PageLoader({ message = "جاري تحميل النظام والبيانات...", fullScreen = true }: PageLoaderProps) {
  return (
    <div className={`${fullScreen ? "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md" : "w-full py-20"} flex flex-col items-center justify-center p-6 text-center animate-fade-in`}>
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute w-20 h-20 rounded-full bg-sky-500/10 animate-ping" />
        <div className="absolute w-28 h-28 rounded-full bg-blue-500/5 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-white mb-2 tracking-wide font-arabic">Omni System Pro</h3>
      <p className="text-slate-300 text-sm max-w-sm font-medium">{message}</p>
      <div className="mt-6 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"></span>
      </div>
    </div>
  );
}
export default PageLoader;
