@echo off
chcp 65001 >nul
title Omni System Pro ERP - بناء تطبيق سطح المكتب

echo.
echo =======================================================
echo    Omni System Pro ERP - بناء وتجهيز تطبيق سطح المكتب (.exe)
echo =======================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت على جهازك!
    echo يرجى تحميله وتثبيته من: https://nodejs.org
    pause
    exit /b 1
)

echo [1/4] جاري التحقق من الحزم والمكتبات وتثبيتها...
call npm install
if errorlevel 1 (
    echo [خطأ] فشل تثبيت الحزم والمكتبات.
    pause
    exit /b 1
)

echo.
echo [2/4] جاري بناء الواجهة والسيرفر الموحد (Vite + Express)...
call npm run build
if errorlevel 1 (
    echo [خطأ] فشل بناء الواجهة والسيرفر.
    pause
    exit /b 1
)

echo.
echo [3/4] جاري بناء مشغل سطح المكتب (Electron Main & Preload)...
call npm run build:electron
if errorlevel 1 (
    echo [خطأ] فشل بناء مشغل سطح المكتب.
    pause
    exit /b 1
)

echo.
echo [4/4] جاري تجميع وتغليف التطبيق المكتبي (.exe)...
call npm run electron:package
if errorlevel 1 (
    echo [تنبيه] فشل التجميع الكامل، جاري محاولة إنشاء النسخة المحمولة...
    call npm run electron:portable
    if errorlevel 1 (
        echo [خطأ] فشل بناء النسخة المحمولة.
        pause
        exit /b 1
    )
)

echo.
echo =======================================================
echo    تم بناء تطبيق سطح المكتب بنجاح تام!
echo    تجد التطبيق التنفيذي (.exe) جاهزاً داخل مجلد:
echo    dist-desktop\
echo =======================================================
echo.
pause
