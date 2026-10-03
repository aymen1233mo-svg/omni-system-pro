/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppConfig, Language } from '../types';
import { generateElectronMain, generateSplashHtml, generatePackageJson, generateElectronBuilderYml } from '../utils/codeGenerators';
import { FileCode, Clipboard, Check, Info, FileText, Package, Cpu } from 'lucide-react';

interface CodeExporterProps {
  config: AppConfig;
  language: Language;
}

type ActiveCodeFile = 'main' | 'splash' | 'package' | 'builder';

export const CodeExporter: React.FC<CodeExporterProps> = ({ config, language }) => {
  const [activeFile, setActiveFile] = useState<ActiveCodeFile>('main');
  const [copied, setCopied] = useState(false);

  const getCodeContent = (): string => {
    switch (activeFile) {
      case 'main':
        return generateElectronMain(config);
      case 'splash':
        return generateSplashHtml(config);
      case 'package':
        return generatePackageJson(config);
      case 'builder':
        return generateElectronBuilderYml(config);
    }
  };

  const getFilePath = (): string => {
    switch (activeFile) {
      case 'main':
        return 'electron/main.js';
      case 'splash':
        return 'electron/splash.html';
      case 'package':
        return 'package.json';
      case 'builder':
        return 'electron-builder.yml';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const t = {
    ar: {
      copyBtn: 'نسخ الكود الكلي',
      copied: 'تم النسخ!',
      mainTab: 'ملف التشغيل الرئيسي (main.js)',
      splashTab: 'واجهة السبلاش (splash.html)',
      packageTab: 'الحزم والاعتمادات (package.json)',
      builderTab: 'إعدادات التجميع (electron-builder.yml)',
      fileLocation: 'مسار الملف المقترح إنشاءه في مشروعك:',
      explanationTitle: 'شرح مبسط لكيفية عمل هذا الملف:',
      mainDesc: 'ملف الإدخال الأساسي للـ Electron. يتحكم بدورة حياة البرنامج، يشغل سيرفر الـ API كعملية فرعية، ويدمج السبلاش قبل فتح صفحة البيع الأساسية.',
      splashDesc: 'صفحة الويب الساكنة التي تظهر للمستخدم فور النقر على البرنامج، صممت بأكواد CSS خفيفة ومتحركة لا تستهلك أي موارد لعرض تقدم التشغيل.',
      packageDesc: 'مجموعة المخططات والمحركات التي تضيف حزم Electron لمشروعك مع تزويده بأوامر البناء والتصدير لنظام التشغيل ويندوز.',
      builderDesc: 'ملف إعدادات electron-builder الذي يحول المشروع بالكامل لملف EXE مستقل (تثبيت NSIS أو نسخة محمولة Portable تعمل فوراً).'
    },
    en: {
      copyBtn: 'Copy Full Code',
      copied: 'Copied!',
      mainTab: 'Main Script (main.js)',
      splashTab: 'Splash Interface (splash.html)',
      packageTab: 'Dependencies (package.json)',
      builderTab: 'Build Configurations (electron-builder.yml)',
      fileLocation: 'Suggested file path in your codebase:',
      explanationTitle: 'Brief explanation of this file:',
      mainDesc: 'The primary Electron script. Spawns Node API server, monitors background port connectivity, manages windows and shuts down API server on exit.',
      splashDesc: 'A lightweight static HTML splash page with styled CSS animations displaying dynamic progress messages while waiting for backend boot.',
      packageDesc: 'Includes the required packaging dependencies and build command scripts configured to compile frontend & backend into desktop setups.',
      builderDesc: 'Settings file for electron-builder to pack everything into a fully standalone, single executable (NSIS Installer or Portable EXE).'
    }
  }[language];

  const fileExplanations = {
    main: t.mainDesc,
    splash: t.splashDesc,
    package: t.packageDesc,
    builder: t.builderDesc
  };

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-2xl overflow-hidden flex flex-col h-full min-h-[500px]">
      
      {/* File Select Tabs */}
      <div className="bg-[#0d0d0d] p-2 border-b border-white/5 flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveFile('main'); setCopied(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeFile === 'main' ? 'bg-[#141414] text-[#f27d26] shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{t.mainTab}</span>
        </button>

        <button
          onClick={() => { setActiveFile('splash'); setCopied(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeFile === 'splash' ? 'bg-[#141414] text-[#f27d26] shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>{t.splashTab}</span>
        </button>

        <button
          onClick={() => { setActiveFile('package'); setCopied(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeFile === 'package' ? 'bg-[#141414] text-[#f27d26] shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>{t.packageTab}</span>
        </button>

        <button
          onClick={() => { setActiveFile('builder'); setCopied(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeFile === 'builder' ? 'bg-[#141414] text-[#f27d26] shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t.builderTab}</span>
        </button>
      </div>

      {/* Code Path Info Banner */}
      <div className="bg-[#080808] border-b border-white/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-white/70">
          <Info className="w-4 h-4 text-[#f27d26] shrink-0" />
          <div>
            <span className="font-semibold text-white/60">{t.fileLocation}</span>{' '}
            <code className="bg-[#141414] px-2 py-0.5 rounded-md border border-white/5 text-[#f27d26] font-mono font-semibold">
              {getFilePath()}
            </code>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="bg-[#f27d26] hover:bg-[#e06d1c] text-black font-bold uppercase tracking-wider px-4 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer text-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Clipboard className="w-3.5 h-3.5 text-black" />}
          <span>{copied ? t.copied : t.copyBtn}</span>
        </button>
      </div>

      {/* Explanation Banner */}
      <div className="px-5 py-3 bg-[#0d0d0d] border-b border-white/5 text-xs text-white/50 leading-relaxed text-right" dir="rtl">
        <span className="font-bold text-white ml-1">{t.explanationTitle}</span>
        {fileExplanations[activeFile]}
      </div>

      {/* Code Editor Preview Panel */}
      <div className="flex-1 relative bg-[#050505] p-4 font-mono text-xs overflow-auto text-left" dir="ltr">
        <pre className="text-white/80 select-all overflow-x-auto whitespace-pre leading-relaxed font-mono">
          {getCodeContent()}
        </pre>
      </div>
    </div>
  );
};
