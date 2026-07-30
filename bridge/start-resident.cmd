@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 无 --run 时：只开一个最小化窗，然后退出（避免前台再闪一窗）
if /i not "%~1"=="--run" (
  start "烂笔头 Agent 桥" /min cmd.exe /k "%~f0" --run
  exit /b 0
)

set LANBITOU_BRIDGE_LAUNCHER=resident-min
set LANBITOU_AGENT_BRIDGE_PORT=39281
set LANBITOU_AGENT_BRIDGE_HOST=127.0.0.1
title 烂笔头 Agent 桥 :39281

REM 已有监听则直接退出，避免再开第二个窗口（用 netstat，避免 PowerShell 闪窗）
netstat -ano | findstr /R /C:":39281 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [烂笔头] 端口 39281 已在监听，不再重复启动。
  timeout /t 2 /nobreak >nul
  exit /b 0
)

echo [烂笔头] Agent 桥常驻服务（最小化窗口，请勿关闭）
echo 监听 127.0.0.1:39281 ，关闭本窗口即停止。
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，请先安装并加入 PATH。
  pause
  exit /b 1
)

if not exist "node_modules\@cursor\sdk\" (
  echo 正在安装依赖…
  if exist "package-lock.json" (
    call npm ci --omit=dev
  ) else (
    call npm install --omit=dev
  )
  if errorlevel 1 (
    echo 依赖安装失败。
    pause
    exit /b 1
  )
)

node server.js
echo.
echo 服务已退出。
pause
