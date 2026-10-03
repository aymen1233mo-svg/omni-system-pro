import { useState, useEffect } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import omnisystemLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";
import omnisystemLogoNew from "@/assets/images/omnisystem_pro_logo_1786236882687.jpg";

const LOGO_SOURCES = [
  omnisystemLogoNew,
  omnisystemLogo,
  "/omnisystem-logo.png",
  "/assets/images/omnisystem_pro_logo_1786236882687.jpg",
  "/assets/images/omnisystem_pro_logo_1784250216808.png",
  "/icon.png",
  "/app-logo.png"
];

const ICON_SOURCES = [
  omnisystemLogoNew,
  omnisystemLogo,
  "/omnisystem-logo.png",
  "/assets/images/omnisystem_pro_logo_1786236882687.jpg",
  "/assets/images/omnisystem_pro_logo_1784250216808.png",
  "/icon.png",
  "/app-icon.png"
];

interface LogoProps {
  src?: string;
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}

export function OmniVectorLogo({
  className = "w-full h-full",
  showText = true,
  style,
}: {
  className?: string;
  showText?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="omni-grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="omni-grad-ring" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="omni-grad-text" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0B192C" />
          <stop offset="60%" stopColor="#1E3E62" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id="omni-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0284C7" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Outer 3D Oval Ring */}
      <path
        d="M 45 185 C 30 120, 115 65, 235 105 C 275 118, 285 148, 255 180 C 215 220, 95 235, 45 185 Z"
        fill="none"
        stroke="url(#omni-grad-ring)"
        strokeWidth="16"
        strokeLinecap="round"
        filter="url(#omni-glow)"
      />

      {/* "i" Dot */}
      <circle cx="108" cy="55" r="15" fill="url(#omni-grad-main)" />

      {/* "i" Stem */}
      <path
        d="M 96 90 C 96 86, 120 80, 122 84 L 115 190 C 114 194, 91 194, 91 190 Z"
        fill="url(#omni-grad-main)"
      />

      {/* "S" Ribbon Swirl */}
      <path
        d="M 135 152 C 135 105, 185 80, 225 80 C 255 80, 265 100, 245 125 C 215 160, 140 148, 140 185 C 140 212, 182 222, 218 200 C 238 188, 258 168, 252 195 C 242 228, 175 238, 135 210 C 118 198, 115 175, 135 152 Z"
        fill="url(#omni-grad-main)"
      />

      {/* Lower decorative line and dots */}
      <path d="M 50 248 Q 150 258 250 248" stroke="url(#omni-grad-ring)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="135" cy="254" r="3" fill="#2563EB" />
      <circle cx="150" cy="255" r="4.5" fill="#0284C7" />
      <circle cx="165" cy="254" r="3" fill="#2563EB" />

      {/* Typography: Omni System Pro */}
      {showText && (
        <text
          x="150"
          y="288"
          textAnchor="middle"
          fill="url(#omni-grad-text)"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
          fontWeight="900"
          fontSize="24"
          letterSpacing="-0.5"
        >
          Omni System <tspan fill="#2563EB">Pro ERP</tspan>
        </text>
      )}
    </svg>
  );
}

/**
 * AppLogo - System Branding Logo (OmniSystem Pro)
 * STRICT RULE: Always represents the system platform software logo.
 */
export function AppLogo({
  src,
  className = "w-full h-full object-contain",
  alt = "OmniSystem Pro Logo",
  fallback,
  style,
  ...props
}: LogoProps) {
  const { data: settings } = useGetSettings();
  const [localDevLogo, setLocalDevLogo] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("omni_developer_system_logo") : null;
  });

  useEffect(() => {
    const handleUpdate = () => {
      setLocalDevLogo(typeof window !== "undefined" ? localStorage.getItem("omni_developer_system_logo") : null);
    };
    window.addEventListener("omni_logo_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("omni_logo_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const handleError = (failingSrc?: string) => {
    if (!failingSrc) return;
    setFailedSources((prev) => {
      if (prev.has(failingSrc)) return prev;
      const next = new Set(prev);
      next.add(failingSrc);
      return next;
    });
  };

  const devCustomLogo = localDevLogo || (settings as any)?.systemLogoUrl;

  const candidateSources = [
    src,
    devCustomLogo,
    ...LOGO_SOURCES
  ].filter((s): s is string => Boolean(s && typeof s === "string" && s.trim() !== "" && !failedSources.has(s)));

  const currentSrc = candidateSources[0];

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    return <OmniVectorLogo className={className} style={style} showText={true} />;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => handleError(currentSrc)}
      style={style}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}

/**
 * AppIcon - System Launcher Icon (OmniSystem Pro Launcher Icon)
 * STRICT RULE: Always represents the system platform software logo.
 */
export function AppIcon({
  src,
  className = "w-full h-full object-contain",
  alt = "OmniSystem Pro Icon",
  fallback,
  style,
  ...props
}: LogoProps) {
  const { data: settings } = useGetSettings();
  const [localDevLogo, setLocalDevLogo] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("omni_developer_system_logo") : null;
  });

  useEffect(() => {
    const handleUpdate = () => {
      setLocalDevLogo(typeof window !== "undefined" ? localStorage.getItem("omni_developer_system_logo") : null);
    };
    window.addEventListener("omni_logo_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("omni_logo_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const handleError = (failingSrc?: string) => {
    if (!failingSrc) return;
    setFailedSources((prev) => {
      if (prev.has(failingSrc)) return prev;
      const next = new Set(prev);
      next.add(failingSrc);
      return next;
    });
  };

  const devCustomLogo = localDevLogo || (settings as any)?.systemLogoUrl;

  // System icon sources
  const candidateSources = [
    src,
    devCustomLogo,
    ...ICON_SOURCES
  ].filter((s): s is string => Boolean(s && typeof s === "string" && s.trim() !== "" && !failedSources.has(s)));

  const currentSrc = candidateSources[0];

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    return <OmniVectorLogo className={className} style={style} showText={false} />;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => handleError(currentSrc)}
      style={style}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}

/**
 * BusinessLogo - Commercial Activity/Store Logo (شعار النشاط التجاري)
 * Used explicitly on invoices, receipts, and main interface business banners when showing activity logo.
 */
export function BusinessLogo({
  src,
  className = "w-full h-full object-contain",
  alt = "شعار النشاط التجاري",
  fallback,
  style,
  ...props
}: LogoProps) {
  const { data: settings } = useGetSettings();
  const businessLogoUrl = src || settings?.logoUrl;

  const [failed, setFailed] = useState(false);

  const currentSrc = !failed && businessLogoUrl && businessLogoUrl !== "null" && businessLogoUrl !== "" ? businessLogoUrl : null;

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center font-bold text-xs text-slate-700 bg-slate-100 rounded px-2 py-1 border border-slate-300">
        {settings?.businessName || "شعار النشاط"}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      style={style}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}
