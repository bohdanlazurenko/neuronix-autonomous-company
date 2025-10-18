# Neuronix - Инструкция по первому запуску

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
cp .env.example .env
```

Заполните переменные:

```env
# === ОБЯЗАТЕЛЬНЫЕ ===

# Anthropic API Key
# Получить: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-xxxxx

# GitHub Personal Access Token
# Получить: https://github.com/settings/tokens
# Требуемые права: repo, workflow, write:packages
GITHUB_TOKEN=ghp_xxxxx

# === ОПЦИОНАЛЬНЫЕ (для автоматического деплоя) ===

# Vercel Token
# Получить: https://vercel.com/account/tokens
VERCEL_TOKEN=xxxxx

# Vercel Organization ID (получится после первого деплоя)
VERCEL_ORG_ID=team_xxxxx

# Vercel Project ID (получится после первого деплоя)
VERCEL_PROJECT_ID=prj_xxxxx
```

## Шаг 3: Запуск dev сервера

```bash
npm run dev
```

Откройте [http://localhost:3003](http://localhost:3003)

## Шаг 4: Тестирование

1. Введите бриф в текстовое поле (или выберите пример)
2. Нажмите "Создать проект"
3. Следите за прогрессом
4. Получите ссылки на GitHub и Vercel

## Возможные проблемы

### Ошибка: "ANTHROPIC_API_KEY is required"

**Решение:** Убедитесь, что файл `.env` создан и содержит корректный API ключ

### Ошибка: "GitHub token is required"

**Решение:** 
1. Создайте Personal Access Token на GitHub
2. Убедитесь, что токен имеет права: `repo`, `workflow`
3. Добавьте токен в `.env`

### Ошибка при деплое на Vercel

**Решение:**
- Vercel деплой опционален
- Если не нужен, оставьте `VERCEL_TOKEN` пустым
- Проект всё равно будет создан на GitHub

### TypeScript ошибки при первом запуске

Это нормально! После `npm install` все зависимости установятся и ошибки исчезнут.

## Следующие шаги

После успешного запуска:

1. Протестируйте создание проекта с разными брифами
2. Настройте GitHub Actions (если нужен CI/CD)
3. Настройте Vercel для автоматического деплоя

## Поддержка

Если проблемы не решились:
1. Проверьте логи в консоли браузера (F12)
2. Проверьте логи в терминале
3. Создайте Issue на GitHub
