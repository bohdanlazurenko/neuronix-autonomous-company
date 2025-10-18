/**
 * Vercel Integration
 * Deploys projects to Vercel automatically
 */

import { Vercel } from '@vercel/sdk';
import {
  VercelResult,
  AgentError,
  ValidationError,
} from '../agents/types';

export interface VercelConfig {
  token: string;
  orgId?: string;
  projectId?: string;
}

export class VercelIntegration {
  private client: Vercel;
  private config: VercelConfig;

  constructor(config: VercelConfig) {
    if (!config.token) {
      throw new ValidationError('Vercel token is required', 'token');
    }

    this.config = config;
    this.client = new Vercel({ bearerToken: config.token });
  }

  /**
   * Deploy project to Vercel
   */
  async deployProject(
    repoUrl: string,
    projectName: string,
    framework: string = 'nextjs'
  ): Promise<VercelResult> {
    console.log('[Vercel] Starting deployment...');
    console.log('[Vercel] Repository:', repoUrl);
    console.log('[Vercel] Project name:', projectName);

    const startTime = Date.now();

    try {
      // Extract owner and repo from GitHub URL
      const { owner, repo } = this.parseGitHubUrl(repoUrl);

      // Check if project already exists
      let project;
      try {
        project = await this.getExistingProject(projectName);
        console.log('[Vercel] Using existing project:', project.id);
      } catch {
        // Create new project
        project = await this.createProject(projectName, owner, repo, framework);
        console.log('[Vercel] Created new project:', project.id);
      }

      // Trigger deployment
      const deployment = await this.triggerDeployment(project.id);
      console.log('[Vercel] Deployment triggered:', deployment.id);

      // Wait for deployment to complete
      const finalDeployment = await this.waitForDeployment(deployment.id);
      console.log('[Vercel] Deployment completed:', finalDeployment.readyState);

      const deployTime = Math.round((Date.now() - startTime) / 1000);

      const result: VercelResult = {
        deployUrl: `https://${projectName}.vercel.app`,
        previewUrl: finalDeployment.url,
        projectId: project.id,
        deploymentId: deployment.id,
        deployTime,
        status: finalDeployment.readyState === 'READY' ? 'ready' : 'error',
      };

      console.log('[Vercel] Deployment successful');
      console.log('[Vercel] Deploy URL:', result.deployUrl);
      console.log('[Vercel] Deploy time:', deployTime, 'seconds');

      return result;
    } catch (error) {
      if (error instanceof AgentError || error instanceof ValidationError) {
        throw error;
      }

      console.error('[Vercel] Deployment error:', error);
      throw new AgentError(
        `Failed to deploy to Vercel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Vercel',
        error
      );
    }
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  private parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
    // https://github.com/owner/repo
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new ValidationError('Invalid GitHub URL format', 'repoUrl', repoUrl);
    }

    return {
      owner: match[1],
      repo: match[2].replace('.git', ''),
    };
  }

  /**
   * Get existing project by name
   */
  private async getExistingProject(projectName: string): Promise<any> {
    try {
      // List all projects and find by name
      const projects = await this.client.projects.getProjects({
        teamId: this.config.orgId,
      });

      const project = projects.projects.find((p: any) => p.name === projectName);
      if (!project) {
        throw new Error('Project not found');
      }

      return project;
    } catch (error) {
      throw new Error('Project not found');
    }
  }

  /**
   * Create new Vercel project
   */
  private async createProject(
    _name: string,
    owner: string,
    repo: string,
    framework: string
  ): Promise<any> {
    console.log('[Vercel] Creating new project...');

    try {
      const response = await this.client.projects.createProject({
        framework: framework as any,
        gitRepository: {
          type: 'github',
          repo: `${owner}/${repo}`,
        } as any,
        buildCommand: 'npm run build',
        devCommand: 'npm run dev',
        installCommand: 'npm install',
        outputDirectory: '.next',
        publicSource: false,
        teamId: this.config.orgId,
      } as any);

      return response;
    } catch (error) {
      console.error('[Vercel] Failed to create project:', error);
      throw new AgentError('Failed to create Vercel project', 'Vercel', error);
    }
  }

  /**
   * Trigger new deployment
   */
  private async triggerDeployment(projectId: string): Promise<any> {
    console.log('[Vercel] Triggering deployment...');

    try {
      // Get project details
      const projects = await this.client.projects.getProjects({
        teamId: this.config.orgId,
      });
      
      const project = projects.projects.find((p: any) => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Create deployment
      const deployment = await this.client.deployments.createDeployment({
        project: projectId,
        target: 'production',
        gitSource: {
          type: 'github',
          ref: 'main',
          repoId: (project as any).link?.repoId || 0,
        } as any,
        teamId: this.config.orgId,
      } as any);

      return deployment;
    } catch (error) {
      console.error('[Vercel] Failed to trigger deployment:', error);
      
      // Fallback: try to get latest deployment
      try {
        const deployments = await this.client.deployments.getDeployments({
          projectId,
          teamId: this.config.orgId,
          limit: 1,
        });

        if (deployments.deployments && deployments.deployments.length > 0) {
          return deployments.deployments[0];
        }
      } catch (fallbackError) {
        console.error('[Vercel] Fallback also failed:', fallbackError);
      }

      throw new AgentError('Failed to trigger Vercel deployment', 'Vercel', error);
    }
  }

  /**
   * Wait for deployment to complete
   */
  private async waitForDeployment(
    deploymentId: string,
    maxWaitTime: number = 180000 // 3 minutes
  ): Promise<any> {
    console.log('[Vercel] Waiting for deployment to complete...');

    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const deployment = await this.client.deployments.getDeployment(deploymentId as any, {
          teamId: this.config.orgId,
        } as any);

        console.log('[Vercel] Deployment state:', (deployment as any).readyState);

        if ((deployment as any).readyState === 'READY') {
          return deployment;
        }

        if ((deployment as any).readyState === 'ERROR' || (deployment as any).readyState === 'CANCELED') {
          throw new AgentError(
            `Deployment failed with state: ${(deployment as any).readyState}`,
            'Vercel'
          );
        }

        // Wait before polling again
        await this.sleep(pollInterval);
      } catch (error) {
        if (error instanceof AgentError) {
          throw error;
        }
        console.error('[Vercel] Error checking deployment status:', error);
        await this.sleep(pollInterval);
      }
    }

    throw new AgentError('Deployment timeout - exceeded maximum wait time', 'Vercel');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get deployment logs (optional, for debugging)
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    try {
      const logs: any = await this.client.deployments.getDeploymentEvents(deploymentId as any, {
        teamId: this.config.orgId,
      } as any);

      if (Array.isArray(logs)) {
        return logs.map((log: any) => log.text || log.message || '').filter(Boolean);
      }
      return [];
    } catch (error) {
      console.error('[Vercel] Failed to get deployment logs:', error);
      return [];
    }
  }
}

// Export factory function
export function createVercelIntegration(config?: Partial<VercelConfig>): VercelIntegration {
  const token = config?.token || process.env.VERCEL_TOKEN;

  if (!token) {
    throw new ValidationError('VERCEL_TOKEN environment variable is required', 'token');
  }

  return new VercelIntegration({
    token,
    orgId: config?.orgId || process.env.VERCEL_ORG_ID,
    projectId: config?.projectId || process.env.VERCEL_PROJECT_ID,
  });
}
