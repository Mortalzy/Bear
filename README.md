# Bear

Основа сайта на React + Express.

## Статус

Начальный этап архитектуры. Дизайн, фотографии, загрузка файлов и отправка писем будут добавлены отдельно.
Приём заявок сейчас отключён: API возвращает 503, кнопка отправки недоступна.
Секреты и реальные контактные данные в репозитории не размещаются.

## Запуск

Требуются Node.js 24 LTS и npm.

```bash
git clone https://github.com/Mortalzy/Bear.git
cd Bear
npm install
npm run dev
```

Клиент: http://localhost:5173. API: http://127.0.0.1:3001/api/health.

```bash
npm test
npm run build
```

Сборка: client/dist. npm start запускает только API.
Production-размещение будет настроено отдельным этапом.

## Структура

- client — React, Vite и CSS Modules.
- server — Express API.
- shared — общие правила и проверки.
- docs — описание архитектуры.
- .github/workflows — тестирование и сборка.

npm install создаёт package-lock.json. Lockfile пока не зафиксирован: его нужно проверить и добавить при первом доступном запуске, затем использовать npm ci.
server/.env.example содержит только пример настройки. Секреты храните в server/.env, исключённом из Git.
