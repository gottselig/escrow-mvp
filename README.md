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

### Backend quickstart

1. Скопируйте `backend/.env.example` в `backend/.env.local` и заполните значения.
2. Примените миграции: `cd backend && pnpm prisma migrate dev`
3. Запустите API + индексер: `cd backend && pnpm dev`
4. Прогоните тесты: `cd backend && pnpm test`

## Деплой контрактов (Foundry)

1. Скопируйте `.env.example` в `.env` и заполните `PRIVATE_KEY`, `LOCAL_RPC_URL`, `SEPOLIA_RPC_URL`.
2. Для локального dev-деплоя запустите Anvil: `anvil`
3. Выполните деплой:

- Dev (локально): `cd contracts && FOUNDRY_PROFILE=dev forge script script/DeployFactory.s.sol:DeployFactory --broadcast`
- Prod (Sepolia): `cd contracts && FOUNDRY_PROFILE=prod forge script script/DeployFactory.s.sol:DeployFactory --broadcast`
