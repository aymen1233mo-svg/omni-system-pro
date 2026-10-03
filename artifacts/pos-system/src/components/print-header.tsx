import React, { useState, useEffect } from 'react';
import { getEffectiveDocPrintSettings } from '@/lib/printUtils';

interface PrintHeaderProps {
  documentTitle?: string;
  documentSubtitle?: string;
  dateStr?: string;
}

export function PrintHeader({ documentTitle, documentSubtitle, dateStr }: PrintHeaderProps) {
  const [docSettings, setDocSettings] = useState<any>(() => getEffectiveDocPrintSettings());

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch('/api/document-print-settings').then(res => res.ok ? res.json() : {}),
        fetch('/api/settings').then(res => res.ok ? res.json() : {})
      ])
      .then(([docData, genData]) => {
        setDocSettings(getEffectiveDocPrintSettings({ ...genData, ...docData }));
      })
      .catch(() => {
        setDocSettings(getEffectiveDocPrintSettings());
      });
    };
    load();
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail) {
        setDocSettings(getEffectiveDocPrintSettings(ce.detail));
      } else {
        load();
      }
    };
    window.addEventListener('doc-print-settings-updated', handler);
    return () => window.removeEventListener('doc-print-settings-updated', handler);
  }, []);

  const eff = getEffectiveDocPrintSettings(docSettings);
  const accent = eff.accentColor || '#000000';
  const bName = eff.headerRightText1 || eff.companyName;
  const bSubtitle = eff.companySubtitle;
  const bAddress = eff.headerRightText2 || eff.address;
  const bPhone = eff.headerRightText3 || eff.phone;
  const bTax = eff.showTaxNumber ? eff.taxNumber : '';
  const logo = eff.showLogo ? eff.logoUrl : '';

  return (
    <div className="w-full bg-white print:bg-white mb-6">
      <div className="flex justify-between items-start pb-4" style={{ borderBottom: `2.5px solid ${accent}` }}>
        {/* Right Section (Text aligned right) */}
        <div className="text-right flex-1" style={{ width: '33%' }}>
          {bName && <h2 className="font-bold text-lg text-black">{bName}</h2>}
          {bSubtitle && <p className="font-bold text-xs text-slate-700">{bSubtitle}</p>}
          {bAddress && <p className="font-bold text-sm text-black">{bAddress}</p>}
          {bPhone && <p className="font-bold text-sm text-black">{bPhone}</p>}
          {bTax && <p className="font-bold text-sm text-black">الرقم الضريبي: {bTax}</p>}
        </div>

        {/* Center Section (Logo) */}
        <div className="flex-1 flex justify-center items-center" style={{ width: '34%' }}>
          {logo && (
            <img 
              src={logo} 
              alt="Logo" 
              className="max-h-24 max-w-[160px] object-contain" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>

        {/* Left Section (Text aligned left) */}
        <div className="text-left flex-1" style={{ width: '33%' }}>
          {eff.headerLeftText1 && <h2 className="font-bold text-lg text-black">{eff.headerLeftText1}</h2>}
          {eff.headerLeftText2 && <p className="font-bold text-sm text-black">{eff.headerLeftText2}</p>}
          {eff.headerLeftText3 && <p className="font-bold text-sm text-black">{eff.headerLeftText3}</p>}
        </div>
      </div>
      
      {/* Document Title */}
      {(documentTitle || documentSubtitle) && (
        <div className="text-center mt-3 pb-2" style={{ borderBottom: `1.5px solid ${accent}` }}>
          {documentTitle && <h1 className="text-xl font-bold" style={{ color: accent }}>{documentTitle}</h1>}
          {documentSubtitle && <h2 className="text-lg font-bold text-black mt-1">{documentSubtitle}</h2>}
        </div>
      )}

      {/* Date Row */}
      {dateStr && (
        <div className="text-center mt-2 pb-2">
          <p className="text-md font-bold text-black">{dateStr}</p>
        </div>
      )}
    </div>
  );
}
