/**
 * Dev Agent - Senior Full-Stack Developer Agent
 * Generates complete, production-ready code for the entire project
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  DevelopmentPlan,
  DevAgentResult,
  GeneratedFile,
  AgentError,
  ValidationError,
  DevAgentConfig,
} from './types';

// Default configuration
const DEFAULT_CONFIG: DevAgentConfig = {
  model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-4.6', // Use GLM-4.6 via Z.AI
  maxTokens: 16000,
  temperature: 0.5,
  timeout: 120000, // 120 seconds
  requiredFiles: [
    'package.json',
    'tsconfig.json',
    'app/page.tsx',
    'app/layout.tsx',
    'app/api/ping/route.ts',
    'README.md',
    '.gitignore',
  ],
  validateImports: true,
};

// System prompt for Dev Agent
const SYSTEM_PROMPT = `Ты - senior full-stack разработчик автономной ИТ компании Neuronix.

ЗАДАЧА: Сгенерировать ВСЕ файлы проекта по спецификации.

ФОРМАТ ВЫВОДА (строго JSON):
{
  "files": [
    {"path": "package.json", "content": "{...}"},
    {"path": "app/page.tsx", "content": "export default..."},
    {"path": "app/layout.tsx", "content": "export default..."}
  ]
}

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:

1. КОД ГОТОВ К ЗАПУСКУ:
   - npm install && npm run dev должен работать БЕЗ ОШИБОК
   - Все импорты корректны и существуют
   - TypeScript strict mode без ошибок
   - Нет placeholder кода ("// TODO", "// Add logic here")

2. ОБЯЗАТЕЛЬНЫЕ ФАЙЛЫ:
   - package.json - с правильными версиями зависимостей (2025)
   - tsconfig.json - strict TypeScript конфигурация
   - app/page.tsx - главная страница (Next.js 14 App Router)
   - app/layout.tsx - root layout с metadata
   - app/api/ping/route.ts - health check endpoint:
     export async function GET() {
       return Response.json({ ok: true, timestamp: new Date().toISOString() });
     }
   - README.md - документация с инструкциями по запуску
   - .gitignore - стандартный Next.js gitignore
   - next.config.js - конфигурация Next.js
   - tailwind.config.ts - если используется Tailwind
   - postcss.config.js - если используется Tailwind

3. СТРУКТУРА NEXT.JS 14 APP ROUTER:
   - app/ - все страницы и layouts
   - app/api/ - API routes
   - components/ - React компоненты
   - lib/ - утилиты и helpers
   - public/ - статические файлы (при необходимости)

4. PACKAGE.JSON ТРЕБОВАНИЯ:
   {
     "name": "[project-name]",
     "version": "0.1.0",
     "private": true,
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint"
     },
     "dependencies": {
       "next": "14.2.18",
       "react": "^18.3.1",
       "react-dom": "^18.3.1"
     },
     "devDependencies": {
       "@types/node": "^20",
       "@types/react": "^18",
       "@types/react-dom": "^18",
       "typescript": "^5",
       "eslint": "^8",
       "eslint-config-next": "14.2.18"
     }
   }

5. TSCONFIG.JSON:
   {
     "compilerOptions": {
       "lib": ["dom", "dom.iterable", "esnext"],
       "allowJs": true,
       "skipLibCheck": true,
       "strict": true,
       "noEmit": true,
       "esModuleInterop": true,
       "module": "esnext",
       "moduleResolution": "bundler",
       "resolveJsonModule": true,
       "isolatedModules": true,
       "jsx": "preserve",
       "incremental": true,
       "plugins": [{"name": "next"}],
       "paths": {
         "@/*": ["./src/*"]
       }
     },
     "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
     "exclude": ["node_modules"]
   }

6. APP/LAYOUT.TSX ШАБЛОН:
   import type { Metadata } from 'next'
   import './globals.css'

   export const metadata: Metadata = {
     title: '[Project Title]',
     description: '[Description]',
   }

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en">
         <body>{children}</body>
       </html>
     )
   }

7. СТИЛИ:
   - Если Tailwind CSS: создай app/globals.css с директивами
   - Если обычный CSS: создай минимальные стили
   - Всегда импортируй стили в layout.tsx

8. ЗАПРЕЩЕНО:
   - localStorage/sessionStorage (используй серверные компоненты или API)
   - Неработающие импорты
   - Placeholder код
   - Устаревшие пути (pages/, _app.tsx)
   - Синтаксические ошибки
   - Несуществующие зависимости

9. README.MD СОДЕРЖАНИЕ:
   # [Project Name]

   [Description]

   ## Getting Started

   \`\`\`bash
   npm install
   npm run dev
   \`\`\`

   Open [http://localhost:3000](http://localhost:3000)

   ## Features

   - [List features]

   ## Tech Stack

   - Next.js 14
   - TypeScript
   - [Other dependencies]

ОТВЕТ ДОЛЖЕН СОДЕРЖАТЬ ТОЛЬКО JSON, без дополнительного текста.`;

export class DevAgent {
  private client: Anthropic;
  private config: DevAgentConfig;

  constructor(apiKey: string, config: Partial<DevAgentConfig> = {}) {
    if (!apiKey) {
      throw new ValidationError('API key is required', 'apiKey');
    }

    // Use Z.AI API endpoint (Anthropic-compatible)
    this.client = new Anthropic({ 
      apiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic'
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate complete code for the project
   */
  async generateCode(plan: DevelopmentPlan): Promise<DevAgentResult> {
    console.log('[Dev Agent] Starting code generation...');
    console.log('[Dev Agent] Project:', plan.project_name);
    console.log('[Dev Agent] Files to generate:', plan.files.length);

    // Validate input
    this.validatePlan(plan);

    try {
      // Create message with timeout
      const response = await this.createMessageWithTimeout(plan);

      // Parse response
      const result = this.parseResponse(response);

      // Validate result
      this.validateResult(result, plan);

      // Add metadata
      const devResult: DevAgentResult = {
        files: result.files,
        metadata: {
          totalFiles: result.files.length,
          linesOfCode: this.countLinesOfCode(result.files),
          generatedAt: new Date(),
        },
      };

      console.log('[Dev Agent] Code generated successfully');
      console.log('[Dev Agent] Total files:', devResult.metadata?.totalFiles);
      console.log('[Dev Agent] Lines of code:', devResult.metadata?.linesOfCode);

      return devResult;
    } catch (error) {
      if (error instanceof AgentError || error instanceof ValidationError) {
        throw error;
      }

      console.error('[Dev Agent] Error:', error);
      throw new AgentError(
        `Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Dev',
        error
      );
    }
  }

  /**
   * Validate development plan
   */
  private validatePlan(plan: DevelopmentPlan): void {
    if (!plan || typeof plan !== 'object') {
      throw new ValidationError('Plan must be an object', 'plan', plan);
    }

    if (!plan.project_name) {
      throw new ValidationError('Plan must have a project_name', 'plan.project_name');
    }

    if (!plan.stack || !plan.stack.framework) {
      throw new ValidationError('Plan must have a stack with framework', 'plan.stack');
    }

    if (!Array.isArray(plan.files) || plan.files.length === 0) {
      throw new ValidationError('Plan must have files array', 'plan.files');
    }
  }

  /**
   * Create message with timeout
   */
  private async createMessageWithTimeout(plan: DevelopmentPlan): Promise<Anthropic.Message> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const planDescription = this.formatPlanDescription(plan);

      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `План разработки:\n${planDescription}\n\nСгенерируй ВСЕ файлы проекта. Ответ ТОЛЬКО JSON.`,
            },
          ],
        },
        {
          signal: controller.signal as AbortSignal,
        }
      );

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Format plan description for the prompt
   */
  private formatPlanDescription(plan: DevelopmentPlan): string {
    return `
Название проекта: ${plan.project_name}
Стек: ${plan.stack.framework}, ${plan.stack.language}, ${plan.stack.styling}

Файлы для генерации:
${plan.files.map((f) => `- ${f.path}: ${f.purpose}`).join('\n')}

Фичи: ${plan.features?.join(', ') || 'Стандартная функциональность'}
`.trim();
  }

  /**
   * Parse response and extract JSON
   */
  private parseResponse(response: Anthropic.Message): { files: GeneratedFile[] } {
    // Extract text from response
    const textContent = response.content.find((block: any) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AgentError('No text content in response', 'Dev');
    }

    const text = textContent.text.trim();
    console.log('[Dev Agent] Raw response length:', text.length);

    // Try to extract JSON from response
    let jsonText = text;

    // Remove markdown code blocks if present
    if (text.includes('```json')) {
      const match = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1];
      }
    } else if (text.includes('```')) {
      const match = text.match(/```\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonText = match[1];
      }
    }

    // Parse JSON
    try {
      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (error) {
      console.error('[Dev Agent] Failed to parse JSON');
      console.error('[Dev Agent] First 500 chars:', jsonText.substring(0, 500));
      throw new AgentError('Failed to parse Dev Agent response as JSON', 'Dev', error);
    }
  }

  /**
   * Validate the result
   */
  private validateResult(result: { files: GeneratedFile[] }, plan: DevelopmentPlan): void {
    // Validate files array
    if (!Array.isArray(result.files)) {
      throw new ValidationError('Result must have files array', 'files', result.files);
    }

    if (result.files.length === 0) {
      throw new ValidationError('Files array cannot be empty', 'files', result.files.length);
    }

    // Validate each file
    const filePaths = new Set<string>();
    for (const file of result.files) {
      if (!file.path || typeof file.path !== 'string') {
        throw new ValidationError('Each file must have a path', 'files[].path', file);
      }

      if (!file.content || typeof file.content !== 'string') {
        throw new ValidationError(
          `File ${file.path} must have content`,
          'files[].content',
          file.path
        );
      }

      // Check for duplicates
      if (filePaths.has(file.path)) {
        throw new ValidationError(`Duplicate file path: ${file.path}`, 'files[].path', file.path);
      }
      filePaths.add(file.path);

      // Check for placeholder code
      if (this.hasPlaceholderCode(file.content)) {
        throw new ValidationError(
          `File ${file.path} contains placeholder code (TODO, etc)`,
          'files[].content',
          file.path
        );
      }
    }

    // Validate required files
    const requiredFiles = this.config.requiredFiles || DEFAULT_CONFIG.requiredFiles!;
    for (const requiredFile of requiredFiles) {
      if (!filePaths.has(requiredFile)) {
        throw new ValidationError(
          `Missing required file: ${requiredFile}`,
          'files',
          Array.from(filePaths)
        );
      }
    }

    // Validate package.json
    this.validatePackageJson(result.files, plan);

    console.log('[Dev Agent] Validation passed');
  }

  /**
   * Check if content has placeholder code
   */
  private hasPlaceholderCode(content: string): boolean {
    const placeholders = [
      '// TODO',
      '// FIXME',
      '// Add logic here',
      '// Implement',
      '/* TODO',
      'throw new Error("Not implemented")',
      'console.log("TODO")',
    ];

    return placeholders.some((placeholder) =>
      content.toLowerCase().includes(placeholder.toLowerCase())
    );
  }

  /**
   * Validate package.json content
   */
  private validatePackageJson(files: GeneratedFile[], plan: DevelopmentPlan): void {
    const packageJsonFile = files.find((f) => f.path === 'package.json');
    if (!packageJsonFile) {
      throw new ValidationError('package.json is required', 'files', 'package.json');
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);

      // Validate name
      if (packageJson.name !== plan.project_name) {
        throw new ValidationError(
          `package.json name must match project name: ${plan.project_name}`,
          'package.json.name',
          packageJson.name
        );
      }

      // Validate scripts
      const requiredScripts = ['dev', 'build', 'start', 'lint'];
      for (const script of requiredScripts) {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          throw new ValidationError(
            `package.json must have "${script}" script`,
            'package.json.scripts',
            script
          );
        }
      }

      // Validate dependencies
      if (!packageJson.dependencies || !packageJson.dependencies.next) {
        throw new ValidationError(
          'package.json must have next dependency',
          'package.json.dependencies',
          'next'
        );
      }

      if (!packageJson.dependencies.react || !packageJson.dependencies['react-dom']) {
        throw new ValidationError(
          'package.json must have react and react-dom dependencies',
          'package.json.dependencies',
          'react'
        );
      }

      // Validate devDependencies
      if (!packageJson.devDependencies || !packageJson.devDependencies.typescript) {
        throw new ValidationError(
          'package.json must have typescript in devDependencies',
          'package.json.devDependencies',
          'typescript'
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        'package.json has invalid JSON',
        'package.json',
        packageJsonFile.content
      );
    }
  }

  /**
   * Count total lines of code
   */
  private countLinesOfCode(files: GeneratedFile[]): number {
    return files.reduce((total, file) => {
      return total + file.content.split('\n').length;
    }, 0);
  }
}

// Export singleton instance creator
export function createDevAgent(apiKey?: string, config?: Partial<DevAgentConfig>): DevAgent {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ValidationError('ANTHROPIC_API_KEY environment variable is required', 'apiKey');
  }

  return new DevAgent(key, config);
}
