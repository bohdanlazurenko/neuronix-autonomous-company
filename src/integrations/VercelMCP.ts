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
      const fullRepoName = `${owner}/${repo}`;

      console.log('[Vercel] Full repo name:', fullRepoName);

      // Check if project already exists
      let project;
      try {
        project = await this.getExistingProject(projectName);
        console.log('[Vercel] Using existing project:', project.id);
      } catch {
        // Create new project and link to GitHub
        project = await this.createProjectWithGitHub(projectName, fullRepoName, framework);
        console.log('[Vercel] Created new project:', project.id);
      }

      // Trigger deployment from main branch
      const deployment = await this.triggerDeploymentFromGitHub(project.id, fullRepoName);
      console.log('[Vercel] Deployment triggered:', deployment.uid);

      // Wait for deployment to complete
      const finalDeployment = await this.waitForDeployment(deployment.uid);
      console.log('[Vercel] Deployment completed:', finalDeployment.readyState);

      const deployTime = Math.round((Date.now() - startTime) / 1000);

      const deployUrl = finalDeployment.url || `https://${projectName}.vercel.app`;

      const result: VercelResult = {
        deployUrl: deployUrl.startsWith('http') ? deployUrl : `https://${deployUrl}`,
        previewUrl: finalDeployment.url,
        projectId: project.id,
        deploymentId: deployment.uid,
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
      console.error('[Vercel] Error details:', JSON.stringify(error, null, 2));
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
   * Create new Vercel project with GitHub integration
   */
  private async createProjectWithGitHub(
    name: string,
    fullRepoName: string,
    framework: string
  ): Promise<any> {
    console.log('[Vercel] Creating new project with GitHub link...');
    console.log('[Vercel] Project name:', name);
    console.log('[Vercel] GitHub repo:', fullRepoName);

    try {
      const response = await this.client.projects.createProject({
        name,
        framework: framework as any,
        gitRepository: {
          type: 'github',
          repo: fullRepoName,
        } as any,
        buildCommand: framework.toLowerCase().includes('next') ? 'npm run build' : undefined,
        devCommand: framework.toLowerCase().includes('next') ? 'npm run dev' : undefined,
        installCommand: 'npm install',
        outputDirectory: framework.toLowerCase().includes('next') ? '.next' : undefined,
        publicSource: false,
        teamId: this.config.orgId,
      } as any);

      console.log('[Vercel] Project created:', response);
      return response;
    } catch (error) {
      console.error('[Vercel] Failed to create project:', error);
      console.error('[Vercel] Error details:', JSON.stringify(error, null, 2));
      throw new AgentError('Failed to create Vercel project', 'Vercel', error);
    }
  }

  /**
   * Trigger deployment from GitHub repository
   */
  private async triggerDeploymentFromGitHub(projectId: string, fullRepoName: string): Promise<any> {
    console.log('[Vercel] Triggering deployment from GitHub...');
    console.log('[Vercel] Project ID:', projectId);
    console.log('[Vercel] Repo:', fullRepoName);

    try {
      // Use a simple approach - just trigger a deployment via hook or API
      // First, try to use the project's git integration
      const deployment = await this.client.deployments.createDeployment({
        name: projectId,
        gitSource: {
          type: 'github',
          ref: 'main',
          repo: fullRepoName,
        } as any,
        target: 'production',
        teamId: this.config.orgId,
      } as any);

      console.log('[Vercel] Deployment triggered:', deployment);
      return deployment;
    } catch (error) {
      console.error('[Vercel] Failed to trigger deployment:', error);
      console.error('[Vercel] Error details:', JSON.stringify(error, null, 2));
      
      // Fallback: try to get latest deployment
      try {
        console.log('[Vercel] Trying fallback - check for existing deployments...');
        const deployments = await this.client.deployments.getDeployments({
          projectId,
          teamId: this.config.orgId,
          limit: 1,
        });

        if (deployments.deployments && deployments.deployments.length > 0) {
          console.log('[Vercel] Found existing deployment:', deployments.deployments[0]);
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
    maxWaitTime: number = 300000 // 5 minutes for build time
  ): Promise<any> {
    console.log('[Vercel] Waiting for deployment to complete...');
    console.log('[Vercel] Deployment ID:', deploymentId);

    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const deployment = await this.client.deployments.getDeployment(deploymentId as any, {
          teamId: this.config.orgId,
        } as any);

        const state = (deployment as any).readyState || (deployment as any).state;
        console.log('[Vercel] Deployment state:', state);

        if (state === 'READY' || state === 'ready') {
          console.log('[Vercel] Deployment is ready!');
          return deployment;
        }

        if (state === 'ERROR' || state === 'error' || state === 'CANCELED' || state === 'canceled') {
          console.error('[Vercel] Deployment failed with state:', state);
          throw new AgentError(
            `Deployment failed with state: ${state}`,
            'Vercel'
          );
        }

        // Still building...
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[Vercel] Still building... (${elapsed}s elapsed)`);

        // Wait before polling again
        await this.sleep(pollInterval);
      } catch (error) {
        if (error instanceof AgentError) {
          throw error;
        }
        console.error('[Vercel] Error checking deployment status:', error);
        
        // If deployment not found yet, keep waiting
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed < 30000) { // First 30 seconds, be patient
          console.log('[Vercel] Deployment may still be initializing...');
          await this.sleep(pollInterval);
          continue;
        }
        
        throw error;
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
