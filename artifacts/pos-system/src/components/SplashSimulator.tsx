/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, Language, TerminalLog } from '../types';
import { getThemeColors } from '../utils/codeGenerators';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCw, Terminal, Monitor, Laptop, Power, AlertCircle, ShoppingCart, Check, CreditCard, RefreshCw, Layers, ShieldCheck } from 'lucide-react';

interface SplashSimulatorProps {
  config: AppConfig;
  language: Language;
}

export const SplashSimulator: React.FC<SplashSimulatorProps> = ({ config, language }) => {
  const [bootState, setBootState] = useState<'idle' | 'splash' | 'loaded' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentLabelAr, setCurrentLabelAr] = useState('');
  const [currentLabelEn, setCurrentLabelEn] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [cart, setCart] = useState<{ id: number; name: string; price: number; quantity: number }[]>([]);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Sound-like simulated logs
  const arLabels = [
    'جاري بدء عملية Electron Main Process...',
    'جاري تحميل ملفات شاشة السبلاش (splash.html)...',
    `جاري تشغيل الخادم الخلفي: "${config.backendCommand}"...`,
    `جاري فتح محرك قاعدة البيانات المحمولة (${config.databaseType.toUpperCase()})...`,
    `جاري فحص الاتصال وقابلية استجابة الخوادم على المنفذ ${config.apiPort}...`,
    'الخادم الخلفي يستجيب بنجاح! كود الحالة 200.',
    'تم التوصيل بقواعد البيانات والتحقق من التراخيص المحلية.',
    'إغلاق شاشة السبلاش وتمرير التحكم للنافذة الرئيسية...',
    'جاري تحميل واجهة نقطة البيع (POS Interface)...',
    'النظام جاهز للعمل بالكامل!'
  ];

  const enLabels = [
    'Initializing Electron Main Process...',
    'Loading splash screen resources (splash.html)...',
    `Spawning Node.js backend process: "${config.backendCommand}"...`,
    `Initializing portable database (${config.databaseType.toUpperCase()})...`,
    `Checking backend server status on port ${config.apiPort}...`,
    'Backend server responded successfully on port 8080 with status 200.',
    'Database connections verified, client permissions authenticated.',
    'Closing splash window and launching main window...',
    'Loading main POS user interface views...',
    'POS System fully loaded and operational.'
  ];

  const colors = getThemeColors(config.splashTheme);

  // Trigger terminal logs
  const appendLog = (
    source: TerminalLog['source'],
    type: TerminalLog['type'],
    ar: string,
    en: string
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const newLog: TerminalLog = {
      id: Math.random().toString(),
      time: timeStr,
      source,
      type,
      messageAr: ar,
      messageEn: en
    };
    setTerminalLogs((prev) => [...prev, newLog]);
  };

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const startSimulation = () => {
    setBootState('splash');
    setProgress(0);
    setTerminalLogs([]);
    setCart([]);
    setShowCheckoutSuccess(false);

    appendLog('system', 'info', 'بدء محاكاة تشغيل التطبيق التنفيذي لسطح المكتب...', 'Starting simulated execution of the POS standalone application...');
    appendLog('electron', 'info', 'جاري إظهار نافذة السبلاش سكرين المنبثقة Frameless Splash Screen...', 'Spawning frameless Splash Screen window at coordinates center.');
  };

  useEffect(() => {
    if (bootState !== 'splash') return;

    let currentStep = 0;
    const totalSteps = arLabels.length;
    const stepInterval = 800; // time per step in ms

    setCurrentLabelAr(arLabels[0]);
    setCurrentLabelEn(enLabels[0]);

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep < totalSteps) {
        setProgress(Math.floor((currentStep / totalSteps) * 100));
        setCurrentLabelAr(arLabels[currentStep]);
        setCurrentLabelEn(enLabels[currentStep]);

        // Add corresponding technical terminal logs
        if (currentStep === 2) {
          appendLog('backend', 'info', 'السيرفر الخلفي: جاري الاتصال وتدشين منافذ الاتصال...', 'API server: Bootstrapping listeners and environment checks...');
        } else if (currentStep === 3) {
          appendLog('backend', 'success', `السيرفر الخلفي: تم الاتصال بقاعدة بيانات ${config.databaseType.toUpperCase()} بنجاح.`, `API server: Connected successfully to database ${config.databaseType.toUpperCase()}.`);
        } else if (currentStep === 5) {
          appendLog('electron', 'success', `إلكترون: تم استقبال استجابة صحيحة من العنوان http://localhost:${config.apiPort}/api/health.`, `Electron: Received valid ping response from http://localhost:${config.apiPort}/api/health.`);
        } else if (currentStep === 7) {
          appendLog('electron', 'info', 'إلكترون: جاري إنهاء شاشة السبلاش وعرض النافذة الكبرى المقواة.', 'Electron: Closing frameless splash window, transitioning focus.');
        } else {
          appendLog('system', 'info', arLabels[currentStep], enLabels[currentStep]);
        }
      } else {
        setProgress(100);
        clearInterval(timer);
        setTimeout(() => {
          setBootState('loaded');
          appendLog('electron', 'success', 'إلكترون: تم تفعيل واجهات النظام بنجاح داخل نافذة التطبيق.', 'Electron: App interface rendered successfully. Full features unlocked.');
        }, 600);
      }
    }, stepInterval);

    return () => clearInterval(timer);
  }, [bootState]);

  // POS Mock Data
  const products = [
    { id: 1, nameAr: 'وجبة برجر لحم دوبل', nameEn: 'Double Beef Burger', price: 35.00, emoji: '🍔', category: 'meals' },
    { id: 2, nameAr: 'شاورما دجاج سوبر', nameEn: 'Super Chicken Shawarma', price: 22.00, emoji: '🌯', category: 'meals' },
    { id: 3, nameAr: 'بيتزا إيطالية رقيقة', nameEn: 'Thin Italian Pizza', price: 40.00, emoji: '🍕', category: 'meals' },
    { id: 4, nameAr: 'بطاطس مقلية مع الجبن', nameEn: 'Cheese French Fries', price: 12.00, emoji: '🍟', category: 'sides' },
    { id: 5, nameAr: 'سلطة السيزر بالدجاج', nameEn: 'Chicken Caesar Salad', price: 18.00, emoji: '🥗', category: 'sides' },
    { id: 6, nameAr: 'عصير برتقال طبيعي', nameEn: 'Fresh Orange Juice', price: 10.00, emoji: '🍹', category: 'drinks' },
    { id: 7, nameAr: 'كابتشينو إيطالي دافئ', nameEn: 'Hot Cappuccino', price: 12.00, emoji: '☕', category: 'drinks' },
    { id: 8, nameAr: 'قطعة كعكة شوكولاتة', nameEn: 'Chocolate Cake Slice', price: 15.00, emoji: '🍰', category: 'desserts' }
  ];

  const addToCart = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: language === 'ar' ? product.nameAr : product.nameEn, price: product.price, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    setShowCheckoutSuccess(true);
    appendLog('backend', 'info', `تم تسجيل عملية مبيعات بقيمة ${cartTotal.toFixed(2)} ر.س بقاعدة بيانات ${config.databaseType.toUpperCase()}`, `API: Logged sales transaction of ${cartTotal.toFixed(2)} USD in ${config.databaseType.toUpperCase()}`);
    setTimeout(() => {
      setCart([]);
      setShowCheckoutSuccess(false);
    }, 2500);
  };

  const t = {
    ar: {
      desktopTitle: 'محاكي تطبيق سطح المكتب (Electron EXE Screen)',
      launcherBtn: 'تشغيل محاكي التطبيق (.exe)',
      launcherDesc: 'اضغط لمشاهدة دورة التشغيل الكاملة: من شاشة السبلاش، والتحقق من السيرفر، إلى فتح نظام المبيعات بنجاح.',
      resetBtn: 'إعادة المحاكاة',
      exitBtn: 'إغلاق البرنامج',
      consoleTitle: 'نافذة مراقبة مخرجات التطبيق المجمّع (Terminal Console Logs)',
      productTitle: 'قائمة الوجبات والمشروبات المتاحة',
      cartTitle: 'سلة المبيعات والطلب الحالي',
      cartEmpty: 'السلة فارغة، اختر من الوجبات الجانبية لبدء الطلب.',
      totalPrice: 'إجمالي الحساب:',
      checkoutBtn: 'دفع وإصدار الفاتورة',
      checkoutSuccess: 'تم تسجيل المبيعات بنجاح وطباعة الفاتورة!',
      dbStatus: 'حالة محرك قاعدة البيانات:',
      dbActive: 'نشط وموصول محلياً',
      serverSync: 'الاتصال بالخادم الخلفي (API):',
      serverSyncActive: 'متصل بنجاح على المنفذ',
      currency: 'ر.س'
    },
    en: {
      desktopTitle: 'Desktop App Simulator (Electron EXE Screen)',
      launcherBtn: 'Run Desktop App Simulator (.exe)',
      launcherDesc: 'Click to watch the full boot cycle: showing splash, checking the backend API, and loading the POS views.',
      resetBtn: 'Restart Simulation',
      exitBtn: 'Exit Application',
      consoleTitle: 'Bundled App Terminal Output (Console Logs)',
      productTitle: 'Available Products & Meals',
      cartTitle: 'Active Order Sales Cart',
      cartEmpty: 'The cart is empty. Click on items on the left to add.',
      totalPrice: 'Grand Total:',
      checkoutBtn: 'Pay & Issue Invoice',
      checkoutSuccess: 'Order processed successfully! Invoice printed.',
      dbStatus: 'Local Database Status:',
      dbActive: 'Active & Connected',
      serverSync: 'Backend Server Connection:',
      serverSyncActive: 'Connected on Port',
      currency: '$'
    }
  }[language];

  return (
    <div className="space-y-6">
      {/* Main Desktop Display Screen */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative">
        {/* Desktop Title Bar */}
        <div className="bg-[#0d0d0d] px-4 py-2.5 flex items-center justify-between text-xs text-white/40 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-[#f27d26]/70" />
            <span className="font-mono text-[11px] font-medium tracking-wide">{t.desktopTitle}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10 block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white/10 block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-white/10 block"></span>
          </div>
        </div>

        {/* Screen Stage Container */}
        <div className="min-h-[460px] bg-[#080808] flex flex-col items-center justify-center relative transition-all">
          
          {/* STAGE 1: IDLE */}
          {bootState === 'idle' && (
            <div className="max-w-md text-center p-8 flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-[#f27d26]/5 border border-[#f27d26]/10 flex items-center justify-center text-[#f27d26] mb-6 relative">
                <Laptop className="w-10 h-10" />
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 w-3.5 h-3.5 rounded-full border-2 border-[#080808]"></span>
              </div>
              <h3 className="text-white font-serif italic text-xl mb-2">{config.appName}</h3>
              <p className="text-white/40 text-xs leading-relaxed mb-6">{t.launcherDesc}</p>
              
              <button
                onClick={startSimulation}
                className="bg-[#f27d26] hover:bg-[#e06d1c] text-black font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-lg shadow-[#f27d26]/10 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
              >
                <Play className="w-4 h-4 fill-black text-black" />
                {t.launcherBtn}
              </button>
            </div>
          )}

          {/* STAGE 2: SPLASH SCREEN (SIMULATED WINDOW) */}
          {bootState === 'splash' && (
            <div className={`w-full max-w-[550px] p-8 rounded-2xl shadow-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} flex flex-col items-center justify-center relative`}>
              {/* App Icon */}
              <div className="relative mb-6 flex justify-center items-center">
                <motion.div
                  animate={{ scale: [0.95, 1.15, 0.95], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-20 h-20 rounded-full bg-white/5"
                />
                <div className={`w-16 h-16 rounded-2xl bg-white/5 border border-white/20 text-white font-bold flex items-center justify-center text-xl shadow-lg z-10`}>
                  POS
                </div>
              </div>

              {/* Title & Subtitle */}
              <h2 className="text-white font-bold text-xl mb-1 text-center">{config.splashTitle}</h2>
              <p className="text-slate-300 text-xs font-light text-center max-w-sm mb-6 leading-relaxed">
                {config.splashSubtitle}
              </p>

              {/* Loader Type: Progress Bar */}
              {config.loaderType === 'bar' && (
                <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full overflow-hidden mb-6">
                  <motion.div
                    className={`h-full bg-indigo-500`}
                    style={{ width: `${progress}%` }}
                    animate={{ backgroundColor: colors.hexAccent }}
                  />
                </div>
              )}

              {/* Loader Type: Spinner */}
              {config.loaderType === 'spinner' && (
                <div className="mb-6 relative">
                  <div className={`w-10 h-10 rounded-full border-4 border-white/10 border-t-indigo-500 animate-spin`} style={{ borderTopColor: colors.hexAccent }}></div>
                </div>
              )}

              {/* Loader Type: Triple Pulse */}
              {config.loaderType === 'pulse' && (
                <div className="flex gap-2 justify-center mb-6">
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce bg-indigo-400" style={{ backgroundColor: colors.hexAccent, animationDelay: '0ms' }}></span>
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce bg-indigo-400" style={{ backgroundColor: colors.hexAccent, animationDelay: '150ms' }}></span>
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce bg-indigo-400" style={{ backgroundColor: colors.hexAccent, animationDelay: '300ms' }}></span>
                </div>
              )}

              {/* Bottom Label (Arabic/English) */}
              <div className="text-center text-[11px] text-white/50 animate-pulse font-mono leading-relaxed px-4">
                {language === 'ar' ? currentLabelAr : currentLabelEn}
              </div>

              {/* Top Bar Simulated Window Controls */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between opacity-50 text-[10px] text-white/50 font-mono">
                <span>Standalone EXE Process</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px]">Splash</span>
              </div>
            </div>
          )}

          {/* STAGE 3: POS MAIN APPLICATION VIEW */}
          {bootState === 'loaded' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full min-h-[460px] bg-[#0c0c0c] text-[#e0d8d0] flex flex-col text-right"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              {/* POS App Bar */}
              <div className="bg-[#141414] px-4 py-3 border-b border-white/5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#f27d26] flex items-center justify-center font-bold text-black text-sm">
                    POS
                  </div>
                  <div>
                    <h1 className="text-xs font-bold leading-tight text-white">{config.appName}</h1>
                    <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block animate-ping"></span>
                      <span>{t.dbStatus} {t.dbActive} ({config.databaseType})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-[#f27d26]/10 text-[#f27d26] px-2 py-1 rounded-md border border-[#f27d26]/20">
                    {t.serverSync} {t.serverSyncActive} {config.apiPort}
                  </span>
                  
                  <button
                    onClick={() => setBootState('idle')}
                    className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/30 hover:text-white transition-colors p-1.5 rounded-lg flex items-center justify-center cursor-pointer"
                    title={t.exitBtn}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* POS Main Content Grid */}
              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* 1. Sidebar Cart Panel */}
                <div className="w-80 border-l border-white/5 bg-[#0d0d0d] p-4 flex flex-col shrink-0">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-3 text-xs font-semibold text-white/70">
                    <ShoppingCart className="w-4 h-4 text-[#f27d26]" />
                    <span>{t.cartTitle}</span>
                  </div>

                  {/* Cart Item List */}
                  <div className="flex-1 overflow-y-auto min-h-0 space-y-2 py-1">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <ShoppingCart className="w-8 h-8 text-white/10 mb-2 stroke-1" />
                        <span className="text-[11px] text-white/30 max-w-[180px] leading-relaxed">
                          {t.cartEmpty}
                        </span>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.id} className="bg-[#141414] border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs gap-2">
                          <div className="flex-1 text-right">
                            <h4 className="font-semibold text-white">{item.name}</h4>
                            <span className="text-[10px] text-[#f27d26] mt-0.5 block">
                              {item.price.toFixed(2)} {t.currency}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-[#080808] border border-white/5 rounded-lg p-1 shrink-0">
                            <button
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="w-5 h-5 flex items-center justify-center bg-[#141414] hover:bg-white/5 rounded text-white/60 hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-mono font-medium text-white text-[11px]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="w-5 h-5 flex items-center justify-center bg-[#141414] hover:bg-white/5 rounded text-white/60 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Cart Grand Total & Checkout */}
                  {cart.length > 0 && (
                    <div className="pt-3 border-t border-white/5 space-y-3 shrink-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40">{t.totalPrice}</span>
                        <span className="font-bold text-sm text-[#f27d26] font-mono">
                          {cartTotal.toFixed(2)} {t.currency}
                        </span>
                      </div>

                      <AnimatePresence mode="wait">
                        {showCheckoutSuccess ? (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-emerald-950/20 border border-emerald-800/30 text-emerald-400 text-[11px] py-2 px-3 rounded-xl text-center flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t.checkoutSuccess}</span>
                          </motion.div>
                        ) : (
                          <button
                            onClick={handleCheckout}
                            className="w-full bg-[#f27d26] hover:bg-[#e06d1c] text-black text-xs font-bold uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-lg shadow-[#f27d26]/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{t.checkoutBtn}</span>
                          </button>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* 2. Menu Items Bento Grid */}
                <div className="flex-1 p-4 overflow-y-auto min-h-0">
                  <h3 className="text-xs font-semibold text-white/40 mb-3 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#f27d26]" />
                    <span>{t.productTitle}</span>
                  </h3>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="bg-[#0d0d0d] hover:bg-[#141414] border border-white/5 hover:border-[#f27d26]/30 rounded-2xl p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer hover:scale-[1.02] shadow-sm duration-300"
                      >
                        <span className="text-3xl mb-2.5 filter drop-shadow-md select-none">{product.emoji}</span>
                        <h4 className="text-xs font-medium text-white/80 line-clamp-1 mb-1">
                          {language === 'ar' ? product.nameAr : product.nameEn}
                        </h4>
                        <span className="text-[11px] font-semibold text-[#f27d26] font-mono">
                          {product.price.toFixed(2)} {t.currency}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* Simulated Developer Terminal / Log Console */}
      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
          className="w-full px-4 py-3 bg-[#0d0d0d] flex items-center justify-between text-xs text-white/40 font-mono border-b border-white/5 select-none cursor-pointer hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#f27d26]" />
            <span className="font-bold text-white/75">{t.consoleTitle}</span>
            <span className="bg-white/5 border border-white/5 text-[9px] px-1.5 py-0.5 rounded text-white/50">{terminalLogs.length} logs</span>
          </div>
          <span className="text-white/30 text-[10px]">{isConsoleExpanded ? '[-]' : '[+]'}</span>
        </button>

        {isConsoleExpanded && (
          <div className="p-4 h-44 overflow-y-auto bg-[#080808] font-mono text-xs space-y-1 text-right" dir="ltr">
            {terminalLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/20 italic text-[11px]">
                {language === 'ar' ? 'قم بتشغيل محاكي التطبيق لمشاهدة المخرجات التقنية وسجلات الاتصال بالسيرفر...' : 'Start the simulator to capture technical process output logs...'}
              </div>
            ) : (
              terminalLogs.map((log) => {
                const sourceColor =
                  log.source === 'electron'
                    ? 'text-[#f27d26]'
                    : log.source === 'backend'
                    ? 'text-amber-500'
                    : 'text-white/40';
                
                const typeColor =
                  log.type === 'success'
                    ? 'text-emerald-400'
                    : log.type === 'error'
                    ? 'text-rose-400'
                    : log.type === 'warn'
                    ? 'text-yellow-400'
                    : 'text-white/80';

                return (
                  <div key={log.id} className="leading-relaxed hover:bg-white/5 px-2 py-0.5 rounded">
                    <span className="text-white/20 text-[11px] mr-2">[{log.time}]</span>
                    <span className={`font-semibold mr-2 ${sourceColor}`}>[{log.source.toUpperCase()}]</span>
                    <span className={typeColor}>
                      {language === 'ar' ? log.messageAr : log.messageEn}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};
