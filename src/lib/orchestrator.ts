/**
 * Orchestrator - Coordinates all agents and integrations
 * Manages the complete workflow from brief to deployed project
 */

import { createPMAgent } from '../agents/PMAgent';
import { createDevAgent } from '../agents/DevAgent';
import { GitHubDirect } from '../integrations/GitHubDirect';
import { createVercelIntegration } from '../integrations/VercelMCP';
import {
  ProjectResult,
  ProjectStatus,
  StatusUpdate,
  AgentError,
  ValidationError,
} from '../agents/types';

export interface OrchestratorConfig {
  anthropicApiKey?: string;
  githubToken?: string;
  vercelToken?: string;
  enableVercelDeploy?: boolean;
  workspaceDir?: string;
}

export type StatusCallback = (update: StatusUpdate) => void;

export class ProjectOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      enableVercelDeploy: config.vercelToken ? true : false,
      ...config,
    };
  }

  /**
   * Create complete project from brief
   */
  async createProject(
    brief: string,
    onStatus?: StatusCallback
  ): Promise<ProjectResult> {
    const startTime = Date.now();
    console.log('[Orchestrator] Starting project creation workflow...');
    console.log('[Orchestrator] Brief:', brief.substring(0, 100) + '...');

    try {
      // Validate brief
      if (!brief || brief.trim().length === 0) {
        throw new ValidationError('Brief cannot be empty', 'brief');
      }

      // Step 1: Generate PRD and Plan (PM Agent)
      this.emitStatus('generating_prd', '🎯 PM Agent генерирует PRD и план...', 10, onStatus);
      const pmAgent = createPMAgent(this.config.anthropicApiKey);
      const { prd, plan } = await pmAgent.generatePRD(brief);

      this.emitStatus(
        'generating_prd',
        `✅ PRD готов: проект "${plan.project_name}"`,
        20,
        onStatus
      );

      // Step 2: Generate Code (Dev Agent)
      this.emitStatus(
        'generating_code',
        '💻 Dev Agent генерирует код проекта...',
        30,
        onStatus
      );
      const devAgent = createDevAgent(this.config.anthropicApiKey);
      const codeResult = await devAgent.generateCode(plan);

      this.emitStatus(
        'generating_code',
        `✅ Код сгенерирован: ${codeResult.files.length} файлов, ${codeResult.metadata?.linesOfCode} строк`,
        50,
        onStatus
      );

      // Step 3: Create GitHub Repository
      this.emitStatus(
        'creating_repo',
        '📦 Создаю GitHub репозиторий и загружаю код...',
        60,
        onStatus
      );
      const githubIntegration = new GitHubDirect({
        githubToken: this.config.githubToken!,
        owner: process.env.GITHUB_USERNAME || 'neuronix-user',
        workspaceDir: this.config.workspaceDir,
      });
      const githubResult = await githubIntegration.createProject(
        plan.project_name,
        codeResult.files,
        `Project: ${plan.project_name}`
      );

      this.emitStatus(
        'creating_repo',
        `✅ Репозиторий создан: ${githubResult.repoUrl}`,
        70,
        onStatus
      );

      // Step 4: Deploy to Vercel (optional)
      let vercelResult;
      if (this.config.enableVercelDeploy && this.config.vercelToken) {
        this.emitStatus(
          'deploying',
          '🚀 Деплою на Vercel...',
          80,
          onStatus
        );

        try {
          const vercelIntegration = createVercelIntegration({
            token: this.config.vercelToken,
          });
          
          console.log('[Orchestrator] Starting Vercel deployment...');
          console.log('[Orchestrator] Repo URL:', githubResult.repoUrl);
          console.log('[Orchestrator] Project name:', plan.project_name);
          
          vercelResult = await vercelIntegration.deployProject(
            githubResult.repoUrl,
            plan.project_name,
            plan.stack.framework.toLowerCase().includes('next') ? 'nextjs' : 'other'
          );

          console.log('[Orchestrator] Vercel deployment successful:', vercelResult);
          
          this.emitStatus(
            'deploying',
            `✅ Деплой завершен: ${vercelResult.deployUrl}`,
            90,
            onStatus
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('[Orchestrator] Vercel deployment failed:', error);
          console.error('[Orchestrator] Error message:', errorMsg);
          console.error('[Orchestrator] Error stack:', error instanceof Error ? error.stack : 'No stack');
          
          this.emitStatus(
            'deploying',
            `⚠️ Деплой на Vercel не удался: ${errorMsg}`,
            90,
            onStatus
          );
        }
      }

      // Step 5: CI/CD setup skipped for now (can be added later)
      // GitHub Actions workflows are included in generated files

      // Calculate total duration
      const totalDuration = Math.round((Date.now() - startTime) / 1000);

      // Final result
      const result: ProjectResult = {
        prd,
        plan,
        repoUrl: githubResult.repoUrl,
        deployUrl: vercelResult?.deployUrl,
        previewUrl: vercelResult?.previewUrl,
        deployTime: vercelResult?.deployTime,
        totalDuration,
        createdAt: new Date(),
      };

      this.emitStatus(
        'completed',
        `🎉 Проект готов! Время: ${totalDuration}с`,
        100,
        onStatus
      );

      console.log('[Orchestrator] Project creation completed successfully');
      console.log('[Orchestrator] Total duration:', totalDuration, 'seconds');
      console.log('[Orchestrator] Repository:', result.repoUrl);
      if (result.deployUrl) {
        console.log('[Orchestrator] Deploy URL:', result.deployUrl);
      }

      return result;
    } catch (error) {
      console.error('[Orchestrator] Project creation failed:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      this.emitStatus(
        'error',
        `❌ Ошибка: ${errorMessage}`,
        0,
        onStatus,
        errorMessage
      );

      if (error instanceof AgentError || error instanceof ValidationError) {
        throw error;
      }

      throw new AgentError(
        `Project creation failed: ${errorMessage}`,
        'GitHub', // Default to GitHub as it's usually the last step
        error
      );
    }
  }

  /**
   * Create project with streaming updates
   */
  async *createProjectStream(brief: string): AsyncGenerator<StatusUpdate, ProjectResult, unknown> {
    const updates: StatusUpdate[] = [];

    const onStatus = (update: StatusUpdate) => {
      updates.push(update);
    };

    // Start project creation
    const resultPromise = this.createProject(brief, onStatus);

    // Yield updates as they come
    let lastIndex = 0;
    while (true) {
      // Yield new updates
      while (lastIndex < updates.length) {
        yield updates[lastIndex];
        lastIndex++;
      }

      // Check if completed
      try {
        const result = await Promise.race([
          resultPromise,
          new Promise((resolve) => setTimeout(() => resolve(null), 100)),
        ]);

        if (result !== null) {
          // Yield any remaining updates
          while (lastIndex < updates.length) {
            yield updates[lastIndex];
            lastIndex++;
          }

          return result as ProjectResult;
        }
      } catch (error) {
        // Yield any remaining updates before throwing
        while (lastIndex < updates.length) {
          yield updates[lastIndex];
          lastIndex++;
        }
        throw error;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Emit status update
   */
  private emitStatus(
    status: ProjectStatus,
    message: string,
    progress: number,
    callback?: StatusCallback,
    error?: string
  ): void {
    const update: StatusUpdate = {
      status,
      message,
      progress,
      timestamp: new Date(),
      error,
    };

    console.log(`[Orchestrator] ${message}`);

    if (callback) {
      callback(update);
    }
  }
}

// Export factory function
export function createOrchestrator(config?: OrchestratorConfig): ProjectOrchestrator {
  return new ProjectOrchestrator({
    anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    githubToken: config?.githubToken || process.env.GITHUB_TOKEN,
    vercelToken: config?.vercelToken || process.env.VERCEL_TOKEN,
    ...config,
  });
}
