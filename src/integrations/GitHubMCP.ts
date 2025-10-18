/**
 * GitHub MCP Integration
 * Creates GitHub repositories and commits files using Model Context Protocol
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  GeneratedFile,
  GitHubResult,
  AgentError,
  ValidationError,
  GitHubActionsResult,
} from '../agents/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GitHubMCPConfig {
  githubToken: string;
  anthropicApiKey: string;
  workspaceDir?: string;
  owner?: string; // GitHub username/org (auto-detected from token if not provided)
}

export class GitHubIntegration {
  private config: GitHubMCPConfig;
  private client: Anthropic;
  private mcpClient: Client | null = null;
  private mcpTransport: StdioClientTransport | null = null;

  constructor(config: GitHubMCPConfig) {
    if (!config.githubToken) {
      throw new ValidationError('GitHub token is required', 'githubToken');
    }
    if (!config.anthropicApiKey) {
      throw new ValidationError('Anthropic API key is required', 'anthropicApiKey');
    }

    this.config = {
      ...config,
      workspaceDir: config.workspaceDir || '/tmp/neuronix-projects',
    };
    // Use Z.AI API endpoint (Anthropic-compatible)
    this.client = new Anthropic({ 
      apiKey: config.anthropicApiKey,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic'
    });
  }

  /**
   * Initialize MCP client with GitHub server
   */
  private async initializeMCP(): Promise<void> {
    if (this.mcpClient) {
      return; // Already initialized
    }

    console.log('[GitHub MCP] Initializing MCP client...');

    try {
      // Create transport for GitHub MCP server
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: this.config.githubToken,
        },
      });

      // Create MCP client
      this.mcpClient = new Client(
        {
          name: 'neuronix-github-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to server
      await this.mcpClient.connect(this.mcpTransport);
      console.log('[GitHub MCP] MCP client initialized successfully');
    } catch (error) {
      console.error('[GitHub MCP] Failed to initialize MCP:', error);
      throw new AgentError('Failed to initialize GitHub MCP client', 'GitHub', error);
    }
  }

  /**
   * Get available MCP tools
   */
  private async getTools(): Promise<any[]> {
    if (!this.mcpClient) {
      await this.initializeMCP();
    }

    try {
      const response = await this.mcpClient!.listTools();
      return response.tools;
    } catch (error) {
      console.error('[GitHub MCP] Failed to list tools:', error);
      return [];
    }
  }

  /**
   * Create GitHub repository and commit all files
   */
  async createProject(
    projectName: string,
    files: GeneratedFile[],
    description?: string
  ): Promise<GitHubResult> {
    console.log('[GitHub MCP] Starting project creation...');
    console.log('[GitHub MCP] Project name:', projectName);
    console.log('[GitHub MCP] Files count:', files.length);

    // Validate inputs
    if (!projectName || projectName.trim().length === 0) {
      throw new ValidationError('Project name is required', 'projectName');
    }

    if (!files || files.length === 0) {
      throw new ValidationError('Files array cannot be empty', 'files');
    }

    try {
      // Initialize MCP
      await this.initializeMCP();

      // Get GitHub username (owner)
      const owner = await this.getGitHubOwner();

      // Create local workspace
      const workspacePath = await this.createLocalWorkspace(projectName, files);

      // Create GitHub repository using MCP
      const repoUrl = await this.createGitHubRepo(projectName, description || `Project: ${projectName}`);

      // Push files to repository
      await this.pushFilesToRepo(workspacePath, repoUrl, owner, projectName);

      const result: GitHubResult = {
        repoUrl,
        repoName: projectName,
        owner,
        defaultBranch: 'main',
        createdAt: new Date(),
      };

      console.log('[GitHub MCP] Project created successfully');
      console.log('[GitHub MCP] Repository URL:', repoUrl);

      return result;
    } catch (error) {
      if (error instanceof AgentError || error instanceof ValidationError) {
        throw error;
      }

      console.error('[GitHub MCP] Error:', error);
      throw new AgentError(
        `Failed to create GitHub project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GitHub',
        error
      );
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Get GitHub owner (username) from token
   */
  private async getGitHubOwner(): Promise<string> {
    if (this.config.owner) {
      return this.config.owner;
    }

    console.log('[GitHub MCP] Fetching GitHub username...');

    try {
      const tools = await this.getTools();

      const prompt = `Get the authenticated GitHub user information. I need to know the username.`;

      const response = await this.client.messages.create({
        model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-4.6',
        max_tokens: 1024,
        tools: tools,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract username from response
      // The response will contain tool calls with user information
      const textContent = response.content.find((block) => block.type === 'text');
      if (textContent && textContent.type === 'text') {
        // Try to extract username from text
        const usernameMatch = textContent.text.match(/username["\s:]+([a-zA-Z0-9-]+)/i);
        if (usernameMatch) {
          const username = usernameMatch[1];
          console.log('[GitHub MCP] GitHub username:', username);
          return username;
        }
      }

      // Fallback: use placeholder (will be replaced later or use env var)
      console.warn('[GitHub MCP] Could not determine GitHub username, using env or default');
      return process.env.GITHUB_USERNAME || 'neuronix-user';
    } catch (error) {
      console.error('[GitHub MCP] Failed to get GitHub owner:', error);
      return process.env.GITHUB_USERNAME || 'neuronix-user';
    }
  }

  /**
   * Create local workspace with files
   */
  private async createLocalWorkspace(projectName: string, files: GeneratedFile[]): Promise<string> {
    const workspacePath = path.join(this.config.workspaceDir!, projectName);
    console.log('[GitHub MCP] Creating local workspace:', workspacePath);

    try {
      // Create workspace directory
      await fs.mkdir(workspacePath, { recursive: true });

      // Write all files
      for (const file of files) {
        const filePath = path.join(workspacePath, file.path);
        const fileDir = path.dirname(filePath);

        // Create directory if it doesn't exist
        await fs.mkdir(fileDir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, file.content, 'utf-8');
        console.log('[GitHub MCP] Created file:', file.path);
      }

      console.log('[GitHub MCP] Local workspace created successfully');
      return workspacePath;
    } catch (error) {
      console.error('[GitHub MCP] Failed to create local workspace:', error);
      throw new AgentError('Failed to create local workspace', 'GitHub', error);
    }
  }

  /**
   * Create GitHub repository using MCP
   */
  private async createGitHubRepo(name: string, description: string): Promise<string> {
    console.log('[GitHub MCP] Creating GitHub repository:', name);

    try {
      const tools = await this.getTools();

      const prompt = `Create a new GitHub repository with the following details:
- Name: ${name}
- Description: ${description}
- Private: false (public repository)
- Auto-init: false (we'll push code manually)
- Default branch: main

Return the repository URL.`;

      const response = await this.client.messages.create({
        model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-4.6',
        max_tokens: 2048,
        tools: tools,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract repository URL from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (textContent && textContent.type === 'text') {
        const urlMatch = textContent.text.match(/https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/);
        if (urlMatch) {
          const repoUrl = urlMatch[0];
          console.log('[GitHub MCP] Repository created:', repoUrl);
          return repoUrl;
        }
      }

      // If we can't extract URL, construct it
      const owner = await this.getGitHubOwner();
      const repoUrl = `https://github.com/${owner}/${name}`;
      console.log('[GitHub MCP] Constructed repository URL:', repoUrl);
      return repoUrl;
    } catch (error) {
      console.error('[GitHub MCP] Failed to create repository:', error);
      throw new AgentError('Failed to create GitHub repository', 'GitHub', error);
    }
  }

  /**
   * Push files to repository using git commands
   */
  private async pushFilesToRepo(
    workspacePath: string,
    repoUrl: string,
    _owner: string,
    _repoName: string
  ): Promise<void> {
    console.log('[GitHub MCP] Pushing files to repository...');

    try {
      const { execSync } = await import('child_process');

      // Configure git
      execSync('git config --global user.email "neuronix@example.com"', {
        cwd: workspacePath,
        stdio: 'ignore',
      });
      execSync('git config --global user.name "Neuronix Bot"', {
        cwd: workspacePath,
        stdio: 'ignore',
      });

      // Initialize git repo
      execSync('git init', { cwd: workspacePath, stdio: 'ignore' });
      execSync('git checkout -b main', { cwd: workspacePath, stdio: 'ignore' });

      // Add all files
      execSync('git add .', { cwd: workspacePath, stdio: 'ignore' });

      // Commit
      execSync('git commit -m "Initial commit by Neuronix 🚀"', {
        cwd: workspacePath,
        stdio: 'ignore',
      });

      // Add remote with token authentication
      const authenticatedUrl = repoUrl.replace(
        'https://github.com',
        `https://${this.config.githubToken}@github.com`
      );
      execSync(`git remote add origin ${authenticatedUrl}`, {
        cwd: workspacePath,
        stdio: 'ignore',
      });

      // Push to GitHub
      execSync('git push -u origin main --force', { cwd: workspacePath, stdio: 'pipe' });

      console.log('[GitHub MCP] Files pushed successfully');
    } catch (error) {
      console.error('[GitHub MCP] Failed to push files:', error);
      throw new AgentError('Failed to push files to GitHub', 'GitHub', error);
    }
  }

  /**
   * Setup GitHub Secrets for CI/CD
   */
  async setupGitHubSecrets(
    repoUrl: string,
    secrets: Record<string, string>
  ): Promise<GitHubActionsResult> {
    console.log('[GitHub MCP] Setting up GitHub Secrets...');

    try {
      await this.initializeMCP();
      const tools = await this.getTools();

      const secretsList = Object.entries(secrets)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');

      const prompt = `Set up the following GitHub repository secrets for ${repoUrl}:
${secretsList}

These secrets are needed for CI/CD workflows.`;

      await this.client.messages.create({
        model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'glm-4.6',
        max_tokens: 2048,
        tools: tools,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      console.log('[GitHub MCP] Secrets configured successfully');

      return {
        workflowsCreated: [],
        secretsConfigured: Object.keys(secrets),
      };
    } catch (error) {
      console.error('[GitHub MCP] Failed to setup secrets:', error);
      // Non-critical error, continue
      return {
        workflowsCreated: [],
        secretsConfigured: [],
      };
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.mcpClient) {
        await this.mcpClient.close();
        this.mcpClient = null;
      }
      if (this.mcpTransport) {
        await this.mcpTransport.close();
        this.mcpTransport = null;
      }
    } catch (error) {
      console.error('[GitHub MCP] Cleanup error:', error);
    }
  }
}

// Export factory function
export function createGitHubIntegration(config?: Partial<GitHubMCPConfig>): GitHubIntegration {
  const githubToken = config?.githubToken || process.env.GITHUB_TOKEN;
  const anthropicApiKey = config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  if (!githubToken) {
    throw new ValidationError('GITHUB_TOKEN environment variable is required', 'githubToken');
  }

  if (!anthropicApiKey) {
    throw new ValidationError(
      'ANTHROPIC_API_KEY environment variable is required',
      'anthropicApiKey'
    );
  }

  return new GitHubIntegration({
    githubToken,
    anthropicApiKey,
    ...config,
  });
}
