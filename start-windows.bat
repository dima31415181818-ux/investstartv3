@echo off
chcp 65001 >nul
title InvestStart
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите его с https://nodejs.org и перезагрузите компьютер.
  start "" https://nodejs.org
  pause
  exit /b 1
)
if not exist ".env" copy ".env.example" ".env" >nul
echo Запускаю сервер InvestStart...
echo Сайт откроется в браузере: http://localhost:3000
echo Чтобы остановить сервер, закройте это окно.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server\server.js
echo.
echo Сервер остановлен. Если выше есть ошибка, пришлите её текст.
pause
