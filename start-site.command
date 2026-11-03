#!/bin/bash
# Запуск сайту Maya Cake на вашому комп'ютері.
# Двічі клацніть цей файл — відкриється браузер із сайтом.
# Щоб зупинити — закрийте вікно Терміналу.
cd "$(dirname "$0")"
PORT=8000
echo "Сайт Maya Cake працює за адресою http://localhost:$PORT"
echo "Щоб відкрити на телефоні (та сама Wi-Fi мережа): http://$(ipconfig getifaddr en0 2>/dev/null || echo 'IP-адреса-ноутбука'):$PORT"
echo "Щоб зупинити — закрийте це вікно."
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT --bind 0.0.0.0
