@echo off
chcp 65001 >nul
title 御魂传说 - 停止服务

echo.
echo ========================================
echo   御魂传说 - 停止开发服务器
echo ========================================
echo.

echo 正在停止所有 Node.js 进程...
taskkill /F /IM node.exe >nul 2>&1

if %errorlevel%==0 (
    echo.
    echo ✓ 所有服务已停止
) else (
    echo.
    echo ✓ 没有正在运行的服务
)

echo.
timeout /t 2 /nobreak >nul
