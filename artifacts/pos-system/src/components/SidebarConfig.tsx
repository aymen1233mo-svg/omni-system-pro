/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppConfig, Language, SplashTheme, LoaderType, ClientType, DatabaseType } from '../types';
import { Settings, Play, Database, ShieldAlert, Sliders, Layout, RefreshCw, Palette } from 'lucide-react';

interface SidebarConfigProps {
  config: AppConfig;
  onChange: (newConfig: AppConfig) => void;
  language: Language;
}

export const SidebarConfig: React.FC<SidebarConfigProps> = ({ config, onChange, language }) => {
  const t = {
    ar: {
      title: 'إعدادات مجمّع التطبيقات',
      appSettings: 'خصائص النظام',
      appName: 'اسم النظام التنفيذي (EXE)',
      clientPort: 'منفذ الواجهات (Vite Frontend)',
      apiPort: 'منفذ الخادم الخلفي (API Server)',
      clientType: 'طريقة تحميل الواجهة الرئيسية',
      clientLocal: 'تحميل ملفات ساكنة (موصى به للإنتاج offline)',
      clientDev: 'تحميل عبر سيرفر محلي (منفذ مباشر)',
      splashSettings: 'شاشة الانتظار والتحميل (Splash)',
      splashTitle: 'عنوان شاشة التحميل الرئيسي',
      splashSubtitle: 'الوصف أو التعليمات الفرعية',
      theme: 'النمط البصري (الألوان)',
      loaderType: 'مؤشر التحميل',
      loaderBar: 'شريط تقدم ممتد',
      loaderSpinner: 'حلقة دوران دائرية',
      loaderPulse: 'نبضات موجية ثلاثية',
      checkingSettings: 'مراقبة تشغيل السيرفر خلف الكواليس',
      checkInterval: 'معدل فحص جاهزية السيرفر (ميلي ثانية)',
      maxTimeout: 'مهلة الانتظار القصوى (بالثواني)',
      backendCommand: 'أمر تشغيل السيرفر الخلفي',
      offlineDb: 'محرك قاعدة البيانات المحمولة',
      sqlite: 'SQLite (ملف محلي مستقل)',
      lowdb: 'LowDB (ملف JSON خفيف)',
      postgresql: 'PostgreSQL (يتطلب سيرفر خارجي مثبت)',
      none: 'لا يوجد قاعدة بيانات / سحابي فقط'
    },
    en: {
      title: 'Packaging Configuration',
      appSettings: 'System Properties',
      appName: 'Application Name (EXE)',
      clientPort: 'Frontend Port (Vite)',
      apiPort: 'Backend API Port',
      clientType: 'Main View Loading Method',
      clientLocal: 'Static Files Loading (Recommended for Offline)',
      clientDev: 'Dev Server Loading (Direct Port)',
      splashSettings: 'Splash Screen Customization',
      splashTitle: 'Splash Main Title',
      splashSubtitle: 'Splash Subtitle/Instructions',
      theme: 'Visual Theme (Colors)',
      loaderType: 'Loading Indicator Style',
      loaderBar: 'Linear Progress Bar',
      loaderSpinner: 'Circular Spinner Ring',
      loaderPulse: 'Triple Pulsing Waves',
      checkingSettings: 'Server Check Configurations',
      checkInterval: 'Ping Server Interval (ms)',
      maxTimeout: 'Maximum Connection Timeout (sec)',
      backendCommand: 'Backend Server Launch Command',
      offlineDb: 'Portable Database Engine',
      sqlite: 'SQLite (Local self-contained file)',
      lowdb: 'LowDB (Lightweight JSON file)',
      postgresql: 'PostgreSQL (Requires external DB service)',
      none: 'No database / Cloud API'
    }
  }[language];

  const handleInputChange = (key: keyof AppConfig, value: any) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  const themes: { id: SplashTheme; labelAr: string; labelEn: string; color: string }[] = [
    { id: 'midnight', labelAr: 'الأزرق الليلي', labelEn: 'Midnight Blue', color: 'bg-indigo-950 border-indigo-500' },
    { id: 'emerald', labelAr: 'الزمردي الداكن', labelEn: 'Deep Emerald', color: 'bg-emerald-950 border-emerald-500' },
    { id: 'charcoal', labelAr: 'الفحمي الهادئ', labelEn: 'Charcoal Black', color: 'bg-neutral-900 border-neutral-400' },
    { id: 'purple', labelAr: 'الملكي الأرجواني', labelEn: 'Royal Purple', color: 'bg-purple-950 border-purple-500' },
    { id: 'amber', labelAr: 'العنبر الدافئ', labelEn: 'Amber Glow', color: 'bg-amber-950 border-amber-500' }
  ];

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-xs p-6 h-full overflow-y-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
        <div className="bg-white/5 text-[#f27d26] p-2 rounded-xl border border-white/5">
          <Settings className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-white font-serif tracking-tight">{t.title}</h2>
      </div>

      {/* 1. System Main Properties */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2">
          <Layout className="w-3.5 h-3.5 text-[#f27d26]/80" />
          {t.appSettings}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">{t.appName}</label>
            <input
              type="text"
              value={config.appName}
              onChange={(e) => handleInputChange('appName', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">{t.clientPort}</label>
              <input
                type="number"
                value={config.clientPort}
                onChange={(e) => handleInputChange('clientPort', parseInt(e.target.value) || 3000)}
                className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1">{t.apiPort}</label>
              <input
                type="number"
                value={config.apiPort}
                onChange={(e) => handleInputChange('apiPort', parseInt(e.target.value) || 8080)}
                className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">{t.clientType}</label>
            <div className="space-y-2">
              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                config.clientType === 'local' 
                  ? 'border-[#f27d26]/30 bg-[#f27d26]/5' 
                  : 'border-white/5 bg-[#0d0d0d] hover:bg-white/5'
              }`}>
                <input
                  type="radio"
                  name="clientType"
                  checked={config.clientType === 'local'}
                  onChange={() => handleInputChange('clientType', 'local')}
                  className="mt-1 text-[#f27d26] focus:ring-[#f27d26] accent-[#f27d26]"
                />
                <div>
                  <div className="text-xs font-medium text-white">{t.clientLocal}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Loads files from dist/index.html (Offline Native)</div>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                config.clientType === 'dev-server' 
                  ? 'border-[#f27d26]/30 bg-[#f27d26]/5' 
                  : 'border-white/5 bg-[#0d0d0d] hover:bg-white/5'
              }`}>
                <input
                  type="radio"
                  name="clientType"
                  checked={config.clientType === 'dev-server'}
                  onChange={() => handleInputChange('clientType', 'dev-server')}
                  className="mt-1 text-[#f27d26] focus:ring-[#f27d26] accent-[#f27d26]"
                />
                <div>
                  <div className="text-xs font-medium text-white">{t.clientDev}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Redirects to dev server URL localhost:5000</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Splash Customizer */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-[#f27d26]/80" />
          {t.splashSettings}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">{t.splashTitle}</label>
            <input
              type="text"
              value={config.splashTitle}
              onChange={(e) => handleInputChange('splashTitle', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              placeholder="جاري تحميل النظام..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">{t.splashSubtitle}</label>
            <textarea
              value={config.splashSubtitle}
              onChange={(e) => handleInputChange('splashSubtitle', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] resize-none transition-all"
              placeholder="يرجى الانتظار بينما يتم تهيئة ملفات السيرفر والتحقق من الاتصال..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2">{t.theme}</label>
            <div className="grid grid-cols-5 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleInputChange('splashTheme', theme.id)}
                  title={language === 'ar' ? theme.labelAr : theme.labelEn}
                  className={`h-10 rounded-xl border-2 transition-all flex items-center justify-center cursor-pointer ${theme.color} ${
                    config.splashTheme === theme.id ? 'ring-2 ring-[#f27d26] scale-105 shadow-md' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span className="text-[10px] text-white/50 select-none">Aa</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">{t.loaderType}</label>
            <select
              value={config.loaderType}
              onChange={(e) => handleInputChange('loaderType', e.target.value as LoaderType)}
              className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] cursor-pointer"
            >
              <option value="bar">{t.loaderBar}</option>
              <option value="spinner">{t.loaderSpinner}</option>
              <option value="pulse">{t.loaderPulse}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Port & Monitor Settings */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-[#f27d26]/80" />
          {t.checkingSettings}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-white/45 mb-1">{t.checkInterval}</label>
              <input
                type="number"
                step="100"
                min="100"
                max="5000"
                value={config.checkInterval}
                onChange={(e) => handleInputChange('checkInterval', parseInt(e.target.value) || 500)}
                className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-white/45 mb-1">{t.maxTimeout}</label>
              <input
                type="number"
                min="5"
                max="60"
                value={config.maxTimeout}
                onChange={(e) => handleInputChange('maxTimeout', parseInt(e.target.value) || 15)}
                className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">{t.backendCommand}</label>
            <input
              type="text"
              value={config.backendCommand}
              onChange={(e) => handleInputChange('backendCommand', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0d0d0d] border border-white/10 rounded-xl text-[#f27d26] focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] transition-all"
              placeholder="node ./api-server/dist/index.mjs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-white/40" />
              {t.offlineDb}
            </label>
            <select
              value={config.databaseType}
              onChange={(e) => handleInputChange('databaseType', e.target.value as DatabaseType)}
              className="w-full px-3 py-2 text-sm bg-[#0d0d0d] border border-white/10 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-[#f27d26]/20 focus:border-[#f27d26] cursor-pointer"
            >
              <option value="sqlite">{t.sqlite}</option>
              <option value="lowdb">{t.lowdb}</option>
              <option value="postgresql">{t.postgresql}</option>
              <option value="none">{t.none}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
