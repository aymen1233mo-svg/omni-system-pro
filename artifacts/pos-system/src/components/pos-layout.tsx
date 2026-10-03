import { useAuth } from "@/components/auth-provider";
import { useLogout, useGetSettings } from "@workspace/api-client-react";
import { LogOut, Clock, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { AppIcon } from "@/components/AppLogo";

export function PosLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: settings } = useGetSettings();
  const logoutMutation = useLogout();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        sessionStorage.removeItem("pos_token");
        window.location.href = "/login";
      }
    });
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden" dir="rtl">
      {/* Topbar */}
      <header className="h-14 bg-[#0f1e3c] text-white flex items-center justify-between px-2 sm:px-4 shrink-0 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <AppIcon className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl object-contain bg-white/10 p-0.5 border border-white/20 shrink-0" />
          <div className="leading-tight min-w-0">
            <div className="text-xs sm:text-sm font-black text-white tracking-wide truncate">Omni System Pro</div>
            <div className="text-[9px] sm:text-[10px] text-amber-400 font-bold truncate hidden xs:block">النظام المتكامل من إتقان سوفت</div>
          </div>
          <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-white/70">
            <Clock className="w-3.5 h-3.5" />
            <span dir="ltr" className="tabular-nums font-mono text-xs">{time.toLocaleTimeString('ar-SA')}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {(user?.role === "admin" || (user?.role as string) === "general_manager" || user?.role === "developer") && (
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white text-[11px] sm:text-xs h-8 px-2 sm:px-3">
                <LayoutDashboard className="w-3.5 h-3.5 ml-1" />
                <span className="hidden sm:inline">لوحة القيادة</span>
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user?.name ? user.name.charAt(0) : "م"}
            </div>
            <div className="text-right leading-tight hidden xs:block">
              <p className="text-xs font-semibold text-white truncate max-w-[90px]">{user?.name}</p>
              <p className="text-[10px] text-white/50">{user?.role === 'admin' ? 'مدير' : 'كاشير'}</p>
            </div>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-white/70 hover:bg-red-600/30 hover:text-red-300 w-8 h-8"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
