#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите его с https://nodejs.org"
  read -p "Нажмите Enter для выхода"; exit 1
fi
[ -f .env ] || cp .env.example .env
echo "Запускаю InvestStart: http://localhost:3000 (остановить: Ctrl+C)"
( sleep 3; (open http://localhost:3000 || xdg-open http://localhost:3000) >/dev/null 2>&1 ) &
node server/server.js
read -p "Сервер остановлен. Нажмите Enter для выхода"
