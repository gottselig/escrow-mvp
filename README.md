# Escrow MVP

Это MVP проекта escrow на блокчейне, включающий смарт-контракты, бэкенд и фронтенд.

## Структура проекта

- `contracts/`: Смарт-контракты на Solidity с Foundry
- `backend/`: API сервер на Node.js с Express и Prisma
- `frontend/`: Веб-приложение на Next.js
- `docs/`: Документация

## Установка

1. Установите зависимости: `pnpm install`
2. Настройте переменные окружения в `.env` файлах
3. Запустите сервисы

## Разработка

- Контракты: `cd contracts && forge build`
- Бэкенд: `cd backend && pnpm dev`
- Фронтенд: `cd frontend && pnpm dev`
