# Neuronix 🚀

**Автономная ИТ компания на базе AI агентов**

Neuronix - это многоагентная система на Claude Agent SDK, которая принимает бриф от пользователя и выдаёт **готовый проект** с GitHub репозиторием и деплойментом на Vercel за 2-4 минуты.

![Neuronix Demo](https://img.shields.io/badge/Status-MVP-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204-purple)

## 🎯 Возможности

- ✨ **PM Agent** - генерирует Product Requirements Document (PRD) и план разработки
- 💻 **Dev Agent** - создаёт полный production-ready код проекта
- 📦 **GitHub Integration** - автоматически создаёт репозиторий и коммитит код через MCP
- 🚀 **Vercel Integration** - автоматический деплой на Vercel
- ⚙️ **CI/CD Setup** - настройка GitHub Actions для созданных проектов
- 📊 **Real-time Progress** - Server-Sent Events стриминг прогресса создания
- 🎨 **Modern UI** - Next.js 14 App Router + Tailwind CSS dark theme

## 🏗️ Архитектура

### Технологический стек

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Server-Sent Events
- **AI Agents**: Claude Sonnet 4 (Anthropic)
- **Integrations**: Model Context Protocol (MCP)
  - `@modelcontextprotocol/server-github` - GitHub operations
  - `@modelcontextprotocol/server-filesystem` - File system operations
- **Deployment**: Vercel SDK

### Агенты

1. **PM Agent** (`src/agents/PMAgent.ts`)
   - Входные данные: бриф пользователя
   - Выходные данные: PRD (Markdown) + план разработки (JSON)
   - Модель: Claude Sonnet 4.5
   - Max tokens: 8192

2. **Dev Agent** (`src/agents/DevAgent.ts`)
   - Входные данные: план разработки
   - Выходные данные: массив файлов с кодом
   - Модель: Claude Sonnet 4.5
   - Max tokens: 16000
   - Валидация: проверка на placeholder код, обязательные файлы

3. **Integration Agent** (`src/integrations/GitHubMCP.ts`)
   - Создание GitHub репозитория через MCP
   - Коммит всех файлов проекта
   - Настройка GitHub Secrets для CI/CD

4. **Vercel Integration** (`src/integrations/VercelMCP.ts`)
   - Автоматический деплой проекта на Vercel
   - Мониторинг статуса деплоя
   - Возврат production и preview URLs

### Оркестратор

`src/lib/orchestrator.ts` координирует работу всех агентов:

```
Бриф → PM Agent → Dev Agent → GitHub → Vercel → Готовый проект
         (20%)      (50%)     (70%)    (90%)      (100%)
```

## 🚀 Быстрый старт

### Требования

- Node.js 20+
- npm 10+
- GitHub Personal Access Token (с правами repo, workflow)
- Anthropic API Key (Claude)
- Vercel Token (опционально, для автоматического деплоя)

### Установка

1. **Клонируйте репозиторий:**

```bash
git clone https://github.com/your-username/neuronix-hackathon.git
cd neuronix-hackathon
```

2. **Установите зависимости:**

```bash
npm install
```

3. **Настройте переменные окружения:**

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните переменные:

```env
# Обязательные
ANTHROPIC_API_KEY=sk-ant-xxxxx        # https://console.anthropic.com/settings/keys
GITHUB_TOKEN=ghp_xxxxx                # https://github.com/settings/tokens

# Опциональные (для автоматического деплоя)
VERCEL_TOKEN=xxxxx                    # https://vercel.com/account/tokens
VERCEL_ORG_ID=team_xxxxx             # После первого деплоя
VERCEL_PROJECT_ID=prj_xxxxx          # После первого деплоя
```

**Требуемые права для GitHub Token:**
- `repo` (полный доступ к репозиториям)
- `workflow` (управление GitHub Actions)
- `write:packages` (опционально)

4. **Запустите dev сервер:**

```bash
npm run dev
```

Откройте [http://localhost:3003](http://localhost:3003)

## 📖 Использование

### Через Web UI

1. Откройте приложение в браузере
2. Введите бриф проекта в текстовое поле (или выберите один из примеров)
3. Нажмите "Создать проект"
4. Следите за прогрессом в реальном времени
5. Получите ссылки на GitHub репозиторий и live demo на Vercel

### Примеры брифов

- "Habit tracker с дневным трекингом и статистикой"
- "Landing page для SaaS продукта с pricing секцией"
- "Todo list с приоритетами и категориями"
- "Simple blog с Markdown поддержкой"

### Через API

```bash
curl -X POST http://localhost:3003/api/create \
  -H "Content-Type: application/json" \
  -d '{"brief": "Создай habit tracker с дневным трекингом"}'
```

Ответ будет в формате Server-Sent Events (SSE):

```
data: {"message": "🚀 Начинаю создание проекта...", "status": "idle", "progress": 0}
data: {"message": "🎯 PM Agent генерирует PRD и план...", "status": "generating_prd", "progress": 10}
...
data: {"message": "✅ Готово!", "status": "completed", "progress": 100, "result": {...}}
```

## 🏛️ Структура проекта

```
neuronix-hackathon/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── create/
│   │       └── route.ts         # POST /api/create - создание проекта (SSE)
│   ├── page.tsx                 # Главная страница с UI
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── src/
│   ├── agents/
│   │   ├── PMAgent.ts          # PM Agent - генерация PRD
│   │   ├── DevAgent.ts         # Dev Agent - генерация кода
│   │   └── types.ts            # TypeScript типы
│   ├── integrations/
│   │   ├── GitHubMCP.ts        # GitHub MCP клиент
│   │   └── VercelMCP.ts        # Vercel интеграция
│   └── lib/
│       └── orchestrator.ts     # Оркестратор агентов
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI для Neuronix
│       ├── deploy.yml          # Деплой Neuronix на Vercel
│       └── generated-project-ci.yml  # CI для генерируемых проектов
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## 🔧 Workflow выполнения

1. **Пользователь вводит бриф** в UI
2. **POST на `/api/create`** с брифом
3. **SSE стрим начинается**
4. **PM Agent** генерирует PRD и план → отправка статуса (20%)
5. **Dev Agent** генерирует код → отправка статуса (50%)
6. **GitHub MCP** создаёт репозиторий → отправка статуса (70%)
7. **Vercel MCP** запускает деплой → отправка статуса (90%)
8. **Финальное сообщение** с URLs → 100%
9. **UI показывает результат**

**Время выполнения:** 2-4 минуты для типового проекта

## 🧪 Тестирование

```bash
# Линтинг
npm run lint

# Type checking
npm run type-check

# Build
npm run build
```

## 📦 Деплой

### На Vercel (рекомендуется)

1. Установите Vercel CLI:
```bash
npm install -g vercel
```

2. Подключите проект:
```bash
vercel link
```

3. Добавьте environment variables в Vercel Dashboard:
   - `ANTHROPIC_API_KEY`
   - `GITHUB_TOKEN`
   - `VERCEL_TOKEN`

4. Деплой:
```bash
vercel --prod
```

### Через GitHub Actions

При пуше в `main` ветку автоматически запускается деплой через `.github/workflows/deploy.yml`

**Требуемые GitHub Secrets:**
- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## 🎨 Сгенерированные проекты

Каждый проект, созданный Neuronix, включает:

### Обязательные файлы:
- `package.json` - зависимости с актуальными версиями (2025)
- `tsconfig.json` - TypeScript strict mode
- `app/page.tsx` - главная страница (Next.js 14 App Router)
- `app/layout.tsx` - root layout с metadata
- `app/api/ping/route.ts` - health check endpoint
- `README.md` - документация с инструкциями
- `.gitignore` - правила игнорирования
- `.github/workflows/ci.yml` - автоматический CI/CD

### Гарантии качества:
- ✅ Код готов к запуску (`npm install && npm run dev`)
- ✅ TypeScript strict mode без ошибок
- ✅ Все импорты корректны
- ✅ Нет placeholder кода ("// TODO")
- ✅ Работающий health check endpoint
- ✅ GitHub Actions CI/CD настроен

## 🛠️ Технические детали

### PM Agent Промпт

Генерирует PRD и план с требованиями:
- Kebab-case имена проектов
- 5-15 файлов (реалистичный scope)
- Next.js 14 App Router структура
- Актуальные версии библиотек (2025)

### Dev Agent Промпт

Генерирует полный production-ready код:
- Strict TypeScript mode
- Все обязательные файлы
- Валидация package.json (scripts, dependencies)
- Проверка на placeholder код
- Health check endpoint обязателен

### MCP Integration

Использует Model Context Protocol для:
- Создания GitHub репозиториев
- Коммита файлов
- Настройки GitHub Secrets
- Работы с файловой системой

## 📊 Метрики и мониторинг

Оркестратор отслеживает:
- ⏱️ Время генерации PRD
- ⏱️ Время генерации кода
- ⏱️ Время создания репозитория
- ⏱️ Время деплоя на Vercel
- 📈 Общее время выполнения
- 📝 Количество сгенерированных файлов
- 📄 Количество строк кода

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📄 Лицензия

MIT License - see LICENSE file for details

## 🙏 Благодарности

- [Anthropic](https://www.anthropic.com/) - Claude Sonnet 4 API
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP SDK
- [Vercel](https://vercel.com/) - hosting and deployment
- [Next.js](https://nextjs.org/) - React framework

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте, что все environment variables настроены
2. Убедитесь, что GitHub Token имеет необходимые права
3. Проверьте логи в консоли браузера и терминале
4. Создайте Issue в GitHub репозитории

---

**Made with ❤️ by AI Agents**

Powered by Claude Sonnet 4, MCP, Next.js 14, GitHub & Vercel
