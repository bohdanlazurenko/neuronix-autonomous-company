/**
 * PM Agent - Product Manager Agent
 * Generates Product Requirements Document (PRD) and development plan from user brief
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  PMAgentResult,
  AgentError,
  ValidationError,
  PMAgentConfig,
} from './types';

// Default configuration
const DEFAULT_CONFIG: PMAgentConfig = {
  model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-4.6', // Use GLM-4.6 via Z.AI
  maxTokens: 8192,
  temperature: 0.7,
  timeout: 60000, // 60 seconds
  minFiles: 5,
  maxFiles: 15,
};

// System prompt for PM Agent
const SYSTEM_PROMPT = `Ты - продакт-менеджер автономной ИТ компании Neuronix.

ЗАДАЧА: Преобразовать бриф в PRD и план разработки.

ФОРМАТ ВЫВОДА (строго JSON):
{
  "prd": "# PRD\\n## Цель\\n[описание]\\n## Фичи\\n[список]\\n## Технические требования\\n[список]",
  "plan": {
    "project_name": "kebab-case-name",
    "stack": {
      "framework": "Next.js 14",
      "language": "TypeScript",
      "styling": "Tailwind CSS"
    },
    "files": [
      {"path": "app/page.tsx", "purpose": "Main page"},
      {"path": "app/layout.tsx", "purpose": "Root layout"},
      {"path": "package.json", "purpose": "Dependencies"},
      {"path": "tsconfig.json", "purpose": "TypeScript config"},
      {"path": ".gitignore", "purpose": "Git ignore rules"},
      {"path": "README.md", "purpose": "Documentation"}
    ]
  }
}

ТРЕБОВАНИЯ:
- Конкретные пути файлов в формате Next.js 14 App Router (app/, lib/, components/)
- Актуальные версии библиотек (2025 год)
- Минимум 5, максимум 15 файлов
- Реалистичный проект (выполнимый за 10-15 минут)
- project_name ОБЯЗАТЕЛЬНО в kebab-case
- ОБЯЗАТЕЛЬНЫЕ файлы: package.json, tsconfig.json, app/page.tsx, app/layout.tsx, README.md, .gitignore
- Для API endpoints используй app/api/[route]/route.ts
- Для компонентов используй components/ директорию
- PRD должен быть детальным с конкретными фичами

ЗАПРЕЩЕНО:
- Placeholder имена типа "my-app" или "project-name"
- Более 15 файлов
- Устаревшие пути (pages/, _app.tsx)
- Неконкретные описания ("какой-то функционал")`;

export class PMAgent {
  private client: Anthropic;
  private config: PMAgentConfig;

  constructor(apiKey: string, config: Partial<PMAgentConfig> = {}) {
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
   * Generate PRD and development plan from brief
   */
  async generatePRD(brief: string): Promise<PMAgentResult> {
    console.log('[PM Agent] Starting PRD generation...');
    console.log('[PM Agent] Brief:', brief.substring(0, 100) + '...');

    // Validate input
    if (!brief || brief.trim().length === 0) {
      throw new ValidationError('Brief cannot be empty', 'brief');
    }

    if (brief.length < 10) {
      throw new ValidationError(
        'Brief is too short. Please provide more details.',
        'brief',
        brief.length
      );
    }

    try {
      // Create message with timeout
      const response = await this.createMessageWithTimeout(brief);

      // Parse response
      const result = this.parseResponse(response);

      // Validate result
      this.validateResult(result);

      console.log('[PM Agent] PRD generated successfully');
      console.log('[PM Agent] Project name:', result.plan.project_name);
      console.log('[PM Agent] Files count:', result.plan.files.length);

      return result;
    } catch (error) {
      if (error instanceof AgentError || error instanceof ValidationError) {
        throw error;
      }

      console.error('[PM Agent] Error:', error);
      throw new AgentError(
        `Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PM',
        error
      );
    }
  }

  /**
   * Create message with timeout
   */
  private async createMessageWithTimeout(brief: string): Promise<Anthropic.Message> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Бриф: ${brief}\n\nСоздай PRD и план разработки. Ответь ТОЛЬКО JSON без дополнительного текста.`,
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
   * Parse response and extract JSON
   */
  private parseResponse(response: Anthropic.Message): PMAgentResult {
    // Extract text from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AgentError('No text content in response', 'PM');
    }

    const text = textContent.text.trim();
    console.log('[PM Agent] Raw response:', text.substring(0, 200) + '...');

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
      return parsed as PMAgentResult;
    } catch (error) {
      console.error('[PM Agent] Failed to parse JSON:', jsonText);
      throw new AgentError(
        'Failed to parse PM Agent response as JSON',
        'PM',
        error
      );
    }
  }

  /**
   * Validate the result
   */
  private validateResult(result: PMAgentResult): void {
    // Validate PRD
    if (!result.prd || typeof result.prd !== 'string') {
      throw new ValidationError('PRD must be a non-empty string', 'prd', result.prd);
    }

    if (result.prd.length < 50) {
      throw new ValidationError('PRD is too short', 'prd', result.prd.length);
    }

    // Validate plan
    if (!result.plan || typeof result.plan !== 'object') {
      throw new ValidationError('Plan must be an object', 'plan', result.plan);
    }

    // Validate project name
    if (!result.plan.project_name || typeof result.plan.project_name !== 'string') {
      throw new ValidationError(
        'Project name must be a non-empty string',
        'plan.project_name',
        result.plan.project_name
      );
    }

    // Validate kebab-case
    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!kebabCaseRegex.test(result.plan.project_name)) {
      throw new ValidationError(
        'Project name must be in kebab-case format',
        'plan.project_name',
        result.plan.project_name
      );
    }

    // Validate stack
    if (!result.plan.stack || typeof result.plan.stack !== 'object') {
      throw new ValidationError('Stack must be an object', 'plan.stack', result.plan.stack);
    }

    if (!result.plan.stack.framework || !result.plan.stack.language || !result.plan.stack.styling) {
      throw new ValidationError(
        'Stack must include framework, language, and styling',
        'plan.stack',
        result.plan.stack
      );
    }

    // Validate files
    if (!Array.isArray(result.plan.files)) {
      throw new ValidationError('Files must be an array', 'plan.files', result.plan.files);
    }

    if (result.plan.files.length < (this.config.minFiles || 5)) {
      throw new ValidationError(
        `Too few files. Minimum: ${this.config.minFiles}`,
        'plan.files',
        result.plan.files.length
      );
    }

    if (result.plan.files.length > (this.config.maxFiles || 15)) {
      throw new ValidationError(
        `Too many files. Maximum: ${this.config.maxFiles}`,
        'plan.files',
        result.plan.files.length
      );
    }

    // Validate each file
    const requiredFiles = ['package.json', 'tsconfig.json', 'app/page.tsx', 'app/layout.tsx', 'README.md', '.gitignore'];
    const filePaths = result.plan.files.map((f) => f.path);

    for (const requiredFile of requiredFiles) {
      if (!filePaths.includes(requiredFile)) {
        throw new ValidationError(
          `Missing required file: ${requiredFile}`,
          'plan.files',
          filePaths
        );
      }
    }

    // Validate file structure
    for (const file of result.plan.files) {
      if (!file.path || typeof file.path !== 'string') {
        throw new ValidationError(
          'Each file must have a path',
          'plan.files[].path',
          file
        );
      }

      if (!file.purpose || typeof file.purpose !== 'string') {
        throw new ValidationError(
          'Each file must have a purpose',
          'plan.files[].purpose',
          file
        );
      }
    }

    console.log('[PM Agent] Validation passed');
  }
}

// Export singleton instance creator
export function createPMAgent(apiKey?: string, config?: Partial<PMAgentConfig>): PMAgent {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ValidationError(
      'ANTHROPIC_API_KEY environment variable is required',
      'apiKey'
    );
  }

  return new PMAgent(key, config);
}
