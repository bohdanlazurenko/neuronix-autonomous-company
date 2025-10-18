/**
 * Vercel Integration
 * Deploys projects to Vercel automatically using REST API
 */

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
  private token: string;
  private config: VercelConfig;
  private baseUrl = 'https://api.vercel.com';

  constructor(config: VercelConfig) {
    if (!config.token) {
      throw new ValidationError('Vercel token is required', 'token');
    }

    this.token = config.token;
    this.config = config;
  }

  /**
   * Make API request to Vercel
   */
  private async apiRequest(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    if (this.config.orgId) {
      headers['X-Team-Id'] = this.config.orgId;
    }

    console.log(`[Vercel API] ${method} ${url}`);
    if (body) {
      console.log('[Vercel API] Body:', JSON.stringify(body, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    console.log('[Vercel API] Response status:', response.status);
    console.log('[Vercel API] Response:', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`Vercel API error (${response.status}): ${responseText}`);
    }

    return responseText ? JSON.parse(responseText) : {};
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
      console.log('[Vercel] Looking for existing project:', projectName);
      const response = await this.apiRequest('GET', `/v9/projects/${projectName}`);
      console.log('[Vercel] Found existing project:', response.id);
      return response;
    } catch (error) {
      console.log('[Vercel] Project not found, will create new');
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
      const projectData: any = {
        name,
        gitRepository: {
          type: 'github',
          repo: fullRepoName,
        },
      };

      // Add framework-specific settings
      if (framework.toLowerCase().includes('next')) {
        projectData.framework = 'nextjs';
        projectData.buildCommand = 'npm run build';
        projectData.devCommand = 'npm run dev';
        projectData.installCommand = 'npm install';
        projectData.outputDirectory = '.next';
      }

      const response = await this.apiRequest('POST', '/v10/projects', projectData);
      
      console.log('[Vercel] Project created:', response.id);
      return response;
    } catch (error) {
      console.error('[Vercel] Failed to create project:', error);
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
      // Step 1: Create a deploy hook if not exists
      console.log('[Vercel] Creating deploy hook...');
      let deployHook;
      try {
        const hooks = await this.apiRequest(
          'POST',
          `/v1/integrations/deploy/${projectId}/hook`,
          { name: 'neuronix-auto-deploy' }
        );
        deployHook = hooks.url;
        console.log('[Vercel] Deploy hook created:', deployHook);
      } catch (error) {
        console.log('[Vercel] Could not create hook, trying to get existing hooks...');
        // Hook might already exist, try to get it
        const project = await this.apiRequest('GET', `/v9/projects/${projectId}`);
        if (project.link?.deployHooks && project.link.deployHooks.length > 0) {
          deployHook = project.link.deployHooks[0].url;
          console.log('[Vercel] Using existing deploy hook');
        }
      }

      // Step 2: Trigger deployment via hook
      if (deployHook) {
        console.log('[Vercel] Triggering deployment via hook...');
        await fetch(deployHook, { method: 'POST' });
        console.log('[Vercel] Deploy hook triggered');
        await this.sleep(3000); // Give Vercel time to start deployment
      } else {
        console.log('[Vercel] No deploy hook available, waiting for auto-deploy...');
        await this.sleep(10000); // Wait longer for auto-deployment
      }
      
      // Step 3: Poll for deployment
      for (let i = 0; i < 6; i++) {
        console.log(`[Vercel] Checking for deployment (attempt ${i + 1}/6)...`);
        const deployments = await this.apiRequest(
          'GET',
          `/v6/deployments?projectId=${projectId}&limit=1`
        );

        if (deployments.deployments && deployments.deployments.length > 0) {
          const deployment = deployments.deployments[0];
          console.log('[Vercel] Found deployment:', deployment.uid);
          return deployment;
        }

        await this.sleep(5000); // Wait 5 seconds between checks
      }

      throw new Error('No deployment found after 30 seconds');
    } catch (error) {
      console.error('[Vercel] Failed to trigger deployment:', error);
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
        const deployment = await this.apiRequest(
          'GET',
          `/v13/deployments/${deploymentId}`
        );

        const state = deployment.readyState || deployment.state;
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
        const elapsed = Date.now() - startTime;
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
      const response = await this.apiRequest(
        'GET',
        `/v2/deployments/${deploymentId}/events`
      );

      if (Array.isArray(response)) {
        return response.map((log: any) => log.text || log.message || '').filter(Boolean);
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
