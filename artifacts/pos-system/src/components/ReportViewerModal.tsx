import React, { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, FileDown, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Check, CheckCircle2 } from "lucide-react";
import { printA4Html, saveA4PdfToFile } from "@/lib/printUtils";
import { useToast } from "@/hooks/use-toast";

export function ReportViewerModal({ 
  isOpen, 
  onClose, 
  htmlContent, 
  thermalHtmlContent,
  title = "استعراض التقرير" 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  htmlContent: string; 
  thermalHtmlContent?: string;
  title?: string;
}) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"a4" | "80mm">("a4");

  const activeHtml = viewMode === "80mm" && thermalHtmlContent ? thermalHtmlContent : htmlContent;

  // Inject styles into the iframe to match printUtils and ensure high-fidelity rendering
  const fullHtml = activeHtml.includes("<!DOCTYPE html>") ? activeHtml : `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');
    body {
      font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      color: #000000;
      background: #ffffff !important;
      margin: 0;
      padding: 20px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: auto; }
    th, td { border: 1px solid #000000; padding: 6px 10px; text-align: center; font-weight: 700; color: #000000; }
    th { background: #f1f5f9; font-weight: 900; color: #000000; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  </style>
</head>
<body>
  ${activeHtml}
</body>
</html>`;

  const buildThermalFallbackHtml = (rawHtml: string) => {
    if (thermalHtmlContent) return thermalHtmlContent;
    const thermalOverrideCss = `
      <style>
        @page { size: 80mm 297mm !important; margin: 0mm !important; }
        html, body {
          width: 72.1mm !important;
          max-width: 72.1mm !important;
          margin: 0 !important;
          padding: 1mm 1mm 1mm 1mm !important;
          font-size: 10px !important;
          color: #000000 !important;
          font-weight: 700 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page, .print-container {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .header { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 4px !important; padding-bottom: 6px !important; margin-bottom: 6px !important; }
        .doc-title-box, .company-box { text-align: center !important; width: 100% !important; }
        .info-bar, .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 4px !important; padding: 4px !important; }
        .signatures { grid-template-columns: 1fr !important; gap: 8px !important; margin-top: 10px !important; }
        table, th, td { font-size: 9.5px !important; padding: 3px 2px !important; word-break: break-word !important; border-color: #000 !important; color: #000 !important; font-weight: 800 !important; }
      </style>
    `;
    if (rawHtml.includes("</head>")) {
      return rawHtml.replace("</head>", `${thermalOverrideCss}</head>`);
    }
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title>${thermalOverrideCss}</head><body>${rawHtml}</body></html>`;
  };

  const handlePrint = () => {
    if (viewMode === "80mm") {
      printA4Html(buildThermalFallbackHtml(htmlContent), `${title} - 80mm`);
    } else {
      printA4Html(htmlContent, title);
    }
  };

  const handlePrintThermal80mm = () => {
    printA4Html(buildThermalFallbackHtml(htmlContent), `${title} - 80(72.1)x297mm`);
  };

  const handleExportPdf = async () => {
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "_").trim();
    setIsSaving(true);
    try {
      const res = await saveA4PdfToFile(htmlContent, cleanTitle, cleanTitle);
      if (res.canceled) {
        setIsSaving(false);
        return;
      }
      if (res.success) {
        toast({
          title: "تم حفظ ملف الـ PDF بنجاح",
          description: res.filePath ? `المسار: ${res.filePath}` : "تم تحميل المستند بنجاح"
        });
      } else if (res.error) {
        toast({
          title: "فشل حفظ الملف",
          description: res.error,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "خطأ غير متوقع",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-[100vw] w-full ${isFullScreen ? 'h-[100vh] max-h-[100vh]' : 'h-[92vh] max-h-[92vh] max-w-6xl'} m-0 p-0 rounded-none bg-slate-900/95 flex flex-col overflow-hidden [&>button]:hidden shadow-2xl`}>
        {/* TOP BAR */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between shadow-md z-10 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                {title}
              </h2>
              <p className="text-[11px] text-slate-400">
                معاينة رسمية مطابقة للمواصفات القياسية A4 • تدعم الطباعة والتصدير كملف PDF
              </p>
            </div>
          </div>

          {/* Zoom and Display Controls */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(prev => Math.max(prev - 10, 60))}
              disabled={zoom <= 60}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-mono font-bold text-slate-200 min-w-10 text-center">
              {zoom}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(prev => Math.min(prev + 10, 150))}
              disabled={zoom >= 150}
              className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom(100)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              title="إعادة ضبط الحجم (100%)"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            {thermalHtmlContent && (
              <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("a4")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    viewMode === "a4" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("80mm")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    viewMode === "80mm" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  80(72.1)×297mm
                </button>
              </div>
            )}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export PDF Button */}
            <Button 
              onClick={handleExportPdf} 
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2 font-bold px-3.5 h-9 shadow-md shadow-rose-600/30 text-xs sm:text-sm"
              title="تصدير وحفظ التقرير كملف PDF معتمد"
            >
              <FileDown className="w-4 h-4" />
              تصدير PDF
            </Button>

            {/* Thermal 80mm Print Button */}
            <Button
              onClick={handlePrintThermal80mm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-3.5 h-9 shadow-md shadow-emerald-600/30 text-xs sm:text-sm"
              title="طباعة حرارية عالية الوضوح بمقاس 80(72.1) × 297 mm"
            >
              <Printer className="w-4 h-4" />
              طباعة حرارية 80(72.1)×297mm
            </Button>

            {/* Print A4 Button */}
            <Button 
              onClick={() => printA4Html(htmlContent, title)} 
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold px-3.5 h-9 shadow-md shadow-blue-600/30 text-xs sm:text-sm"
              title="طباعة التقرير (A4)"
            >
              <Printer className="w-4 h-4" />
              طباعة A4
            </Button>

            {/* Toggle Fullscreen */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullScreen(prev => !prev)}
              className="h-9 px-2.5 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              title={isFullScreen ? "تصغير النافذة" : "شاشة كاملة"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            {/* Close Button */}
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-red-950/40 hover:text-red-400 hover:border-red-800 gap-1.5 font-bold px-3 h-9 text-xs sm:text-sm"
            >
              <X className="w-4 h-4" />
              إغلاق
            </Button>
          </div>
        </div>

        {/* HELPER BANNER */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-amber-200">
          <span>💡 نصيحة: يمكنك الطباعة مباشرة على ورق قياسي <strong>A4</strong> أو على الطابعات الحرارية بمقاس <strong>80(72.1) × 297 mm</strong> بوضوح ودقة عالية، أو الحفظ كملف PDF.</span>
          <span className="text-slate-400 font-mono">{viewMode === "80mm" ? "معاينة حرارية 80(72.1)×297mm" : "وضع المعاينة الشامل A4"}</span>
        </div>

        {/* IFRAME CONTAINER */}
        <div className="flex-1 overflow-auto bg-slate-950/70 p-4 sm:p-8 flex justify-center items-start">
          <div 
            style={{ 
              transform: `scale(${zoom / 100})`, 
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out" 
            }}
            className={`bg-white shadow-2xl ${viewMode === "80mm" && thermalHtmlContent ? "max-w-[340px]" : "max-w-[210mm]"} w-full min-h-[297mm] h-max border border-slate-700 rounded-sm overflow-hidden`}
          >
            <iframe 
              ref={iframeRef}
              srcDoc={fullHtml} 
              className="w-full border-none min-h-[297mm]" 
              style={{ minHeight: "297mm", height: "100%" }}
              title="Report Preview"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReportViewerModal;
