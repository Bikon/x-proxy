# Framer X Feed (Pro/Free, Proxy, Cache)

Плагин (Framer Code Component) для вывода ленты X (Twitter):
- Proxy (Vercel) с CORS и секретами
- Free: максимум 5 постов
- Pro (по License Key): до 100 постов и настройка `Display Count`
- Кэширование: клиент (localStorage, по `cacheMinutes`) + CDN (Vercel, `s-maxage`)
- Метрики (лайки/ретвиты/реплаи/цитаты), кликабельные ссылки/@/#
- Тема light/dark, шапка профиля (аватар + ник)

## Установка
1) `code/XFeed.tsx` → в папку `/code` проекта Framer.
2) `api/x.js` и `api/license.js` → в репозиторий Vercel.
3) На Vercel: добавить переменную `X_BEARER_TOKEN` (Settings → Environment Variables).
4) Деплой. Получится URL вида: `https://<project>.vercel.app/api/x`.

## Настройка в Framer
- **Proxy Mode**: ON (обязательно)
- **Proxy URL**: `https://<project>.vercel.app/api/x`
- **Username**: ник в X без `@`
- **Display Count**: кол-во постов (free → реально будет 5)
- **Cache (min)**: клиентский кэш (0 — отключить)
- **Show user info**: шапка с аватаркой
- **Metrics**: Likes/Replies/Retweets/Quotes
- **Theme**: light/dark
- **License Key**: введите PRO-ключ (заглушка принимает формат `PRO-XXXXXXXX`)
- **Buy Pro URL**: ссылка на покупку

## Проверка прокси
```bash
curl "https://<host>/api/x?path=/users/by/username/elonmusk&user.fields=name,username"
curl "https://<host>/api/x?path=/users/44196397/tweets&max_results=5&tweet.fields=created_at,text"
