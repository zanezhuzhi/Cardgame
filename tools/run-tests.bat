@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
:: 御魂传说 - 一键自动化测试脚本
:: 双击运行即可执行全部测试并输出报告
:: 优化：错误信息汇总到末尾，方便查看
:: ============================================================

title 🧪 御魂传说 - 自动化测试

:: 颜色定义
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "CYAN=[96m"
set "RESET=[0m"
set "BOLD=[1m"

:: 计时开始
set start_time=%time%

echo.
echo %CYAN%╔══════════════════════════════════════════════════════════════╗%RESET%
echo %CYAN%║          🧪 御魂传说 - 自动化测试套件                         ║%RESET%
echo %CYAN%╚══════════════════════════════════════════════════════════════╝%RESET%
echo.

:: 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo %RED%❌ 错误: 未找到 Node.js，请先安装 Node.js%RESET%
    goto :end
)

:: 切换到项目根目录 (tools 的上一级)
cd /d %~dp0..

:: 创建测试报告目录
if not exist "test-reports" mkdir test-reports

:: 初始化结果变量
set shared_result=0
set server_result=0

:: ============================================================
:: 1. Shared 测试
:: ============================================================
echo.
echo %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo %CYAN%📦 [1/2] 运行 Shared 测试...%RESET%
echo %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo.

cd shared
call npm test -- --reporter=verbose > ..\test-reports\shared-test.log 2>&1
set shared_result=%ERRORLEVEL%
type ..\test-reports\shared-test.log
cd ..

if %shared_result% equ 0 (
    echo.
    echo %GREEN%✅ Shared 测试通过%RESET%
) else (
    echo.
    echo %RED%❌ Shared 测试失败%RESET%
)

:: ============================================================
:: 2. Server 测试
:: ============================================================
echo.
echo %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo %CYAN%🖥️ [2/2] 运行 Server 测试...%RESET%
echo %CYAN%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
echo.

cd server
call npm test -- --reporter=verbose > ..\test-reports\server-test.log 2>&1
set server_result=%ERRORLEVEL%
type ..\test-reports\server-test.log
cd ..

if %server_result% equ 0 (
    echo.
    echo %GREEN%✅ Server 测试通过%RESET%
) else (
    echo.
    echo %RED%❌ Server 测试失败%RESET%
)

:: ============================================================
:: 汇总报告
:: ============================================================
echo.
echo %CYAN%╔══════════════════════════════════════════════════════════════╗%RESET%
echo %CYAN%║                     📊 测试结果汇总                           ║%RESET%
echo %CYAN%╚══════════════════════════════════════════════════════════════╝%RESET%
echo.

:: 计算总结果
set final_result=0

if %shared_result% equ 0 (
    echo   📦 Shared:  %GREEN%✅ 通过%RESET%
) else (
    echo   📦 Shared:  %RED%❌ 失败%RESET%
    set final_result=1
)

if %server_result% equ 0 (
    echo   🖥️ Server:  %GREEN%✅ 通过%RESET%
) else (
    echo   🖥️ Server:  %RED%❌ 失败%RESET%
    set final_result=1
)

echo.

:: 计时结束
set end_time=%time%
echo   ⏱️ 耗时: %start_time% - %end_time%
echo.

:: 输出最终结果
if %final_result% equ 0 (
    echo %GREEN%╔══════════════════════════════════════════════════════════════╗%RESET%
    echo %GREEN%║                  🎉 全部测试通过！                            ║%RESET%
    echo %GREEN%╚══════════════════════════════════════════════════════════════╝%RESET%
    goto :end
)

:: ============================================================
:: 🔴 失败时：在末尾显示所有错误详情
:: ============================================================
echo %RED%╔══════════════════════════════════════════════════════════════╗%RESET%
echo %RED%║                  ⚠️ 存在测试失败                              ║%RESET%
echo %RED%╚══════════════════════════════════════════════════════════════╝%RESET%
echo.

:: Shared 错误详情
if %shared_result% neq 0 (
    echo %RED%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
    echo %RED%📦 SHARED 测试失败详情:%RESET%
    echo %RED%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
    echo.
    echo %YELLOW%[失败的测试]%RESET%
    findstr /C:"FAIL" /C:"✗" /C:"×" test-reports\shared-test.log 2>nul
    echo.
    echo %YELLOW%[错误信息]%RESET%
    findstr /C:"AssertionError" /C:"Error:" /C:"expected" /C:"received" /C:"TypeError" test-reports\shared-test.log 2>nul
    echo.
    echo %YELLOW%📁 完整日志: test-reports\shared-test.log%RESET%
    echo.
)

:: Server 错误详情
if %server_result% neq 0 (
    echo %RED%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
    echo %RED%🖥️ SERVER 测试失败详情:%RESET%
    echo %RED%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%RESET%
    echo.
    echo %YELLOW%[失败的测试]%RESET%
    findstr /C:"FAIL" /C:"✗" /C:"×" test-reports\server-test.log 2>nul
    echo.
    echo %YELLOW%[错误信息]%RESET%
    findstr /C:"AssertionError" /C:"Error:" /C:"expected" /C:"received" /C:"TypeError" test-reports\server-test.log 2>nul
    echo.
    echo %YELLOW%📁 完整日志: test-reports\server-test.log%RESET%
    echo.
)

echo.
echo %CYAN%💡 提示: 以上为错误摘要，完整信息请查看日志文件%RESET%

:end
echo.
echo 按任意键退出...
pause >nul
exit /b %final_result%
