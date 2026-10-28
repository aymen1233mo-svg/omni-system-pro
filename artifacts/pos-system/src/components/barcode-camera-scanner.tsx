import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff, X, Scan, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackgroundCameraScannerProps {
  isEnabled: boolean;
  onToggle: () => void;
  onScan: (barcode: string) => void;
}

export function BackgroundCameraScanner({ isEnabled, onToggle, onScan }: BackgroundCameraScannerProps) {
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [scanFlash, setScanFlash] = useState<boolean>(false);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>("");
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const lastScanTimestampRef = useRef<number>(0);
  const containerId = "pos-barcode-camera-stream-container";

  const safeStopScanner = useCallback(async () => {
    const scanner = scannerInstanceRef.current;
    if (!scanner) {
      setCameraStatus("idle");
      return;
    }

    try {
      if (isTransitioningRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop().catch(() => {});
      }

      try {
        scanner.clear();
      } catch (e) {
        // Ignore safe clear
      }
    } catch (e) {
      // Safe catch
    } finally {
      scannerInstanceRef.current = null;
      isTransitioningRef.current = false;
      setCameraStatus("idle");
    }
  }, []);

  const startScanner = useCallback(async () => {
    let isMounted = true;
    setErrorMessage(null);
    setCameraStatus("starting");

    // Ensure DOM element is mounted and ready
    await new Promise((resolve) => setTimeout(resolve, 200));

    const container = document.getElementById(containerId);
    if (!container) {
      setErrorMessage("عنصر الكاميرا غير متوفر في الصفحة");
      setCameraStatus("error");
      return;
    }

    await safeStopScanner();

    try {
      isTransitioningRef.current = true;
      const qrCodeScanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });

      scannerInstanceRef.current = qrCodeScanner;

      const scanSuccessCallback = (decodedText: string, result: any) => {
        if (!decodedText) return;
        const now = Date.now();
        
        console.log("📷 [Html5Qrcode Raw Decoded Frame]:", {
          rawDecodedText: decodedText,
          length: decodedText.length,
          format: result?.result?.format?.formatName || "BARCODE",
          timestamp: new Date().toISOString()
        });

        // Debounce duplicate reads within 250ms for lightning-fast responsiveness
        if (now - lastScanTimestampRef.current < 250) return;
        lastScanTimestampRef.current = now;

        // Visual flash
        setScanFlash(true);
        setTimeout(() => setScanFlash(false), 300);

        // Confirmation sound
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 1880;
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
          }
        } catch (e) {}

        const cleanCode = decodedText.trim();
        setLastScannedCode(cleanCode);
        onScan(cleanCode);

        setTimeout(() => {
          setLastScannedCode(null);
        }, 2000);
      };

      const scanConfig = {
        fps: 30,
        // Full-frame scanning without restrictive qrbox boundaries for instant capture
        rememberLastUsedCamera: true,
      };

      let started = false;

      // Strategy 1: Check available camera devices
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const rearCam = devices.find(d => /back|rear|environment|خلفية/i.test(d.label));
          const chosenCam = rearCam || devices[0];
          setActiveCameraLabel(chosenCam.label || "كاميرا الحاسوب");
          await qrCodeScanner.start(chosenCam.id, scanConfig, scanSuccessCallback, () => {});
          started = true;
        }
      } catch (devErr: any) {
        console.warn("Device enumeration failed, falling back to facingMode:", devErr);
      }

      // Strategy 2: Fallback to environment facingMode
      if (!started) {
        try {
          await qrCodeScanner.start({ facingMode: "environment" }, scanConfig, scanSuccessCallback, () => {});
          setActiveCameraLabel("الكاميرا الخلفية");
          started = true;
        } catch (envErr: any) {
          console.warn("FacingMode environment failed:", envErr);
        }
      }

      // Strategy 3: Fallback to user facingMode (Laptop integrated webcams)
      if (!started) {
        try {
          await qrCodeScanner.start({ facingMode: "user" }, scanConfig, scanSuccessCallback, () => {});
          setActiveCameraLabel("كاميرا الويب");
          started = true;
        } catch (userErr: any) {
          console.warn("FacingMode user failed:", userErr);
        }
      }

      if (started) {
        setCameraStatus("active");
        setErrorMessage(null);
      } else {
        throw new Error("تعذر فتح أي كاميرا. يرجى التأكد من توصيل الكاميرا ومنح الإذن في المتصفح.");
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      let msg = "تعذر فتح الكاميرا.";
      if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
        msg = "تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح ثم إعادة المحاولة.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        msg = "لم يتم العثور على أي كاميرا متصلة بالحاسوب.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        msg = "الكاميرا مستخدمة حالياً من قبل تطبيق آخر أو المتصفح. يرجى إغلاق التطبيقات الأخرى.";
      } else if (err?.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
      setCameraStatus("error");
    } finally {
      isTransitioningRef.current = false;
    }
  }, [safeStopScanner, onScan]);

  useEffect(() => {
    if (isEnabled) {
      startScanner();
    } else {
      safeStopScanner();
    }

    return () => {
      safeStopScanner();
    };
  }, [isEnabled, startScanner, safeStopScanner]);

  return (
    <div className="flex items-center gap-2 select-none">
      {/* ── Fixed Bottom-Left Camera Widget Window ── */}
      {isEnabled && (
        <div
          className={cn(
            "fixed bottom-4 left-4 z-50 w-72 bg-slate-950 rounded-2xl border-2 shadow-2xl overflow-hidden pointer-events-auto transition-all duration-200",
            showPreview ? "h-64" : "h-11",
            scanFlash
              ? "border-emerald-400 ring-4 ring-emerald-400/50"
              : cameraStatus === "error"
              ? "border-red-500/80 ring-2 ring-red-500/30"
              : "border-amber-400/80 ring-1 ring-amber-400/30"
          )}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-slate-900/95 px-3 py-2 text-xs text-white border-b border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Scan className="w-4 h-4 animate-pulse text-amber-400" />
              <span>قارئ الباركود</span>
              {activeCameraLabel && (
                <span className="text-[10px] text-slate-400 font-normal truncate max-w-[90px]">
                  ({activeCameraLabel})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className="p-1 hover:bg-white/20 rounded-md text-slate-300 hover:text-white transition-colors"
                title={showPreview ? "تصغير نافذة المعاينة" : "تكبير نافذة المعاينة"}
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="p-1 hover:bg-red-500/40 rounded-md text-red-300 hover:text-red-100 transition-colors"
                title="إيقاف الكاميرا"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Camera Viewport Body */}
          {showPreview && (
            <div className="relative w-full h-[calc(100%-38px)] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
              {/* html5-qrcode pure container */}
              <div id={containerId} className="w-full h-full" />

              {/* Full-Frame Scan Guideline Overlay */}
              {cameraStatus === "active" && (
                <>
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-3 z-10">
                    {/* Full-width laser scanner beam */}
                    <div className="w-full h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse"></div>
                  </div>

                  {/* Subtitle helper */}
                  <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-950/90 backdrop-blur-xs px-2.5 py-1.5 text-[10px] text-slate-200 border-t border-white/10 flex items-center justify-between">
                    <span className="truncate font-bold text-amber-300">⚡ مسح ضوئي سريع (مرر الباركود بأي اتجاه)</span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                      فوري
                    </span>
                  </div>
                </>
              )}

              {/* Loading State Overlay */}
              {cameraStatus === "starting" && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 p-4 text-amber-300 text-xs z-30">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span className="font-semibold text-center">جاري فتح وتشغيل الكاميرا...</span>
                  <span className="text-[10px] text-slate-400 text-center">يرجى الموافقة على طلب إذن الكاميرا إن ظهر</span>
                </div>
              )}

              {/* Error State Overlay */}
              {cameraStatus === "error" && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-3 text-center gap-2 text-red-300 text-xs z-30">
                  <AlertCircle className="w-7 h-7 text-red-400 shrink-0" />
                  <span className="font-medium leading-relaxed">{errorMessage || "تعذر فتح الكاميرا"}</span>
                  <button
                    type="button"
                    onClick={startScanner}
                    className="mt-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                  >
                    🔄 إعادة المحاولة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar Button ── */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded border transition-all shadow-xs",
          isEnabled && cameraStatus === "active"
            ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/30"
            : isEnabled && cameraStatus === "starting"
            ? "bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse"
            : isEnabled && cameraStatus === "error"
            ? "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
        )}
        title={
          isEnabled
            ? "الكاميرا تعمل وتقرأ الباركود تلقائياً - انقر لإيقافها"
            : "انقر لتشغيل كاميرا الحاسوب لقراءة الباركود وإدراجه في السلة فوراً"
        }
      >
        {isEnabled && cameraStatus === "active" ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">كاميرا الباركود: نشطة</span>
          </>
        ) : isEnabled && cameraStatus === "starting" ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>جاري تشغيل الكاميرا...</span>
          </>
        ) : isEnabled && cameraStatus === "error" ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <span>خطأ بالكاميرا (انقر للمحاولة)</span>
          </>
        ) : (
          <>
            <CameraOff className="w-3.5 h-3.5 text-slate-400" />
            <span>تشغيل كاميرا الباركود</span>
          </>
        )}
      </button>

      {/* Real-time Last Scanned confirmation badge */}
      {lastScannedCode && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/60 text-emerald-200 text-[11px] font-bold animate-in fade-in zoom-in-95 duration-150 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>تم إدراج الباركود:</span>
          <span className="font-mono text-white font-black" dir="ltr">{lastScannedCode}</span>
        </div>
      )}
    </div>
  );
}
