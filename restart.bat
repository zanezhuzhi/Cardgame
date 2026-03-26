@echo off
chcp 65001 >nul
title 御魂传说 - 开发服务器

echo.
echo ========================================
echo   御魂传说 - 一键重启开发服务器
echo ========================================
echo.

REM 1. 终止现有 Node 进程
echo [1/4] 正在停止现有服务...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo      ✓ 已停止

REM 2. 启动服务端（测试环境：禁用回合倒计时）
echo [2/4] 正在启动服务端 (端口 3002)...
cd /d %~dp0server
start "CardGame-Server" cmd /k "title 服务端[3002] && set DISABLE_TURN_TIMEOUT=1 && npx tsx watch src/index.ts"
cd /d %~dp0

REM 3. 启动客户端
echo [3/4] 正在启动客户端 (端口 5173)...
cd /d %~dp0client
start "CardGame-Client" cmd /k "title 客户端[5173] && npm run dev"
cd /d %~dp0

REM 4. 等待服务启动后打开浏览器
echo [4/4] 等待服务启动...
timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo   ✓ 启动完成！
echo ========================================
echo.
echo   服务端: http://localhost:3002
echo   客户端: http://localhost:5173
echo   GM模式: http://localhost:5173/?gm=1
echo.
echo   正在打开 GM 测试页面...
echo.

start http://localhost:5173/?gm=1

echo.
echo   按任意键关闭此窗口（服务会继续运行）
echo.
pause >nul
