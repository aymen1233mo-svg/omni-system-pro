@echo off
chcp 65001 >nul
title Omni System Pro ERP - بناء النظام الشامل

echo =======================================================
echo    Omni System Pro ERP - بناء النظام الشامل (الواجهة + السيرفر + سطح المكتب)
echo =======================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت!
    echo يرجى تثبيت Node.js من: https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] تثبيت التبعيات...
call npm install
if errorlevel 1 (
    echo [خطأ] فشل تثبيت التبعيات.
    pause
    exit /b 1
)

echo.
echo [2/3] بناء الواجهة الأمامية وسيرفر الـ Backend...
call npm run build
if errorlevel 1 (
    echo [خطأ] فشل بناء المشروع.
    pause
    exit /b 1
)

echo.
echo [3/3] بناء مشغل Electron لسطح المكتب...
call npm run build:electron
if errorlevel 1 (
    echo [تحذير] تعذر بناء مشغل Electron، تأكد من إعدادات electron.
)

echo.
echo =======================================================
echo    اكتملت عملية البناء بنجاح!
echo    يمكنك تشغيل النظام الآن عبر:
echo    1. start.bat (لتشغيل السيرفر والواجهة عبر المتصفح)
echo    2. BUILD-DESKTOP.bat (لتجميع ملف التثبيت المكتبي .exe)
echo =======================================================
echo.
pause
