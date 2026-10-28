@echo off
title تشغيل نظام Omni System Pro ERP
cd /d "%~dp0"

:: تشغيل السيرفر مع تحديد المنفذ 3000
start cmd /k "set "ELECTRON_WORKER_PORT=3000" && npm run dev"

:: انتظار 5 ثواني
timeout /t 5 /nobreak >nul

:: فتح المتصفح
start "" "http://localhost:3000/"

echo =======================================================================
echo         نظام Omni System Pro ERP يعمل الآن على المنفذ 3000
echo         http://localhost:3000/
echo =======================================================================

exit