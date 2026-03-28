@echo off
chcp 65001 >nul
cd /d %~dp0

echo.
echo 🧪 启动御魂传说测试工具...
echo.

:: 检查是否已安装依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

:: 启动 Electron
echo 🚀 启动测试界面...
call npm start
