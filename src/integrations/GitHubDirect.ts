/**
 * Direct GitHub Integration using Octokit REST API
 * Simpler and more reliable than MCP for Z.AI
 */

import { Octokit } from '@octokit/rest';
import { GeneratedFile, GitHubResult, AgentError, ValidationError } from '../agents/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface GitHubDirectConfig {
  githubToken: string;
  owner: string; // GitHub username
  workspaceDir?: string;
}

export class GitHubDirect {
  private config: GitHubDirectConfig;
  private octokit: Octokit;

  constructor(config: GitHubDirectConfig) {
    if (!config.githubToken) {
      throw new ValidationError('GitHub token is required', 'githubToken');
    }
    if (!config.owner) {
      throw new ValidationError('GitHub owner/username is required', 'owner');
    }

    this.config = {
      ...config,
      workspaceDir: config.workspaceDir || '/tmp/neuronix-projects',
    };

    this.octokit = new Octokit({
      auth: config.githubToken,
    });
  }

  /**
   * Create GitHub repository and push all files
   */
  async createProject(
    projectName: string,
    files: GeneratedFile[],
    description?: string
  ): Promise<GitHubResult> {
    console.log('[GitHub Direct] Starting project creation...');
    console.log('[GitHub Direct] Project name:', projectName);
    console.log('[GitHub Direct] Files count:', files.length);

    // Validate inputs
    if (!projectName || projectName.trim().length === 0) {
      throw new ValidationError('Project name is required', 'projectName');
    }

    if (!files || files.length === 0) {
      throw new ValidationError('Files array cannot be empty', 'files');
    }

    try {
      // Create GitHub repository
      const repo = await this.createRepository(projectName, description || `Project: ${projectName}`);
      console.log('[GitHub Direct] Repository created:', repo.html_url);

      // Create local workspace
      const workspacePath = await this.createLocalWorkspace(projectName, files);

      // Push files using git commands
      await this.pushFilesToRepo(workspacePath, repo.clone_url, projectName);

      const result: GitHubResult = {
        repoUrl: repo.html_url,
        repoName: projectName,
        owner: this.config.owner,
        defaultBranch: 'main',
        createdAt: new Date(repo.created_at),
      };

      console.log('[GitHub Direct] Project created successfully');
      return result;
    } catch (error) {
      console.error('[GitHub Direct] Failed to create project:', error);
      throw new AgentError('Failed to create GitHub project', 'GitHub', error);
    }
  }

  /**
   * Create GitHub repository using REST API
   */
  private async createRepository(name: string, description: string): Promise<any> {
    console.log('[GitHub Direct] Creating repository:', name);

    try {
      const response = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: false,
        auto_init: false, // We'll push code manually
        has_issues: true,
        has_projects: true,
        has_wiki: false,
      });

      return response.data;
    } catch (error: any) {
      if (error.status === 422 && error.message?.includes('name already exists')) {
        console.warn('[GitHub Direct] Repository already exists, will try to use it');
        const response = await this.octokit.repos.get({
          owner: this.config.owner,
          repo: name,
        });
        return response.data;
      }
      throw error;
    }
  }

  /**
   * Create local workspace with files
   */
  private async createLocalWorkspace(projectName: string, files: GeneratedFile[]): Promise<string> {
    const workspacePath = path.join(this.config.workspaceDir!, projectName);
    console.log('[GitHub Direct] Creating local workspace:', workspacePath);

    try {
      // Remove old workspace if exists
      try {
        await fs.rm(workspacePath, { recursive: true, force: true });
      } catch (e) {
        // Ignore if doesn't exist
      }

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
        console.log('[GitHub Direct] Created file:', file.path);
      }

      console.log('[GitHub Direct] Local workspace created successfully');
      return workspacePath;
    } catch (error) {
      console.error('[GitHub Direct] Failed to create local workspace:', error);
      throw new AgentError('Failed to create local workspace', 'GitHub', error);
    }
  }

  /**
   * Push files to repository using git commands
   */
  private async pushFilesToRepo(workspacePath: string, cloneUrl: string, _repoName: string): Promise<void> {
    console.log('[GitHub Direct] Pushing files to repository...');

    try {
      const { execSync } = await import('child_process');

      // Configure git with token authentication
      const authUrl = cloneUrl.replace('https://', `https://${this.config.githubToken}@`);

      // Initialize git repository
      execSync('git init', { cwd: workspacePath, stdio: 'pipe' });
      execSync('git config user.email "neuronix@example.com"', { cwd: workspacePath, stdio: 'pipe' });
      execSync('git config user.name "Neuronix Agent"', { cwd: workspacePath, stdio: 'pipe' });

      // Add all files
      execSync('git add .', { cwd: workspacePath, stdio: 'pipe' });

      // Commit
      execSync('git commit -m "Initial commit: Project generated by Neuronix"', {
        cwd: workspacePath,
        stdio: 'pipe',
      });

      // Create main branch
      execSync('git branch -M main', { cwd: workspacePath, stdio: 'pipe' });

      // Add remote
      execSync(`git remote add origin "${authUrl}"`, { cwd: workspacePath, stdio: 'pipe' });

      // Push to GitHub
      execSync('git push -u origin main --force', {
        cwd: workspacePath,
        stdio: 'pipe',
        timeout: 30000, // 30 seconds timeout
      });

      console.log('[GitHub Direct] Files pushed successfully');
    } catch (error) {
      console.error('[GitHub Direct] Failed to push files:', error);
      throw new AgentError('Failed to push files to GitHub', 'GitHub', error);
    }
  }
}
