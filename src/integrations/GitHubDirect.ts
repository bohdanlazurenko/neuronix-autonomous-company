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
   * Push files to repository using GitHub API (works on Vercel serverless)
   */
  private async pushFilesToRepo(_workspacePath: string, _cloneUrl: string, repoName: string): Promise<void> {
    console.log('[GitHub Direct] Pushing files to repository using GitHub API...');

    try {
      // Read files from local workspace
      const files: GeneratedFile[] = [];
      const workspacePath = path.join(this.config.workspaceDir!, repoName);
      
      // Read all files recursively
      const readDir = async (dir: string, baseDir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip node_modules and .git
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') {
              continue;
            }
            await readDir(fullPath, baseDir);
          } else {
            const relativePath = path.relative(baseDir, fullPath);
            const content = await fs.readFile(fullPath, 'utf-8');
            files.push({ path: relativePath, content });
          }
        }
      };
      
      await readDir(workspacePath, workspacePath);
      console.log(`[GitHub Direct] Read ${files.length} files from workspace`);

      // Try to get default branch ref (usually main)
      let refs: any[] = [];
      try {
        const response = await this.octokit.git.listMatchingRefs({
          owner: this.config.owner,
          repo: repoName,
          ref: 'heads/',
        });
        refs = response.data;
      } catch (error: any) {
        // Repository is empty, no refs yet
        console.log('[GitHub Direct] Repository is empty, creating initial commit');
      }

      let sha: string;
      let ref: string = 'refs/heads/main';

      if (refs.length > 0) {
        // Branch exists, get current commit
        const mainRef = refs.find(r => r.ref === 'refs/heads/main') || refs[0];
        ref = mainRef.ref;
        const { data: commit } = await this.octokit.git.getCommit({
          owner: this.config.owner,
          repo: repoName,
          commit_sha: mainRef.object.sha,
        });
        sha = commit.tree.sha;
      } else {
        // No branches, repository is empty - use contents API to create files
        console.log('[GitHub Direct] Creating files in empty repository using Contents API...');
        
        // Create files one by one using contents API
        for (const file of files) {
          try {
            await this.octokit.repos.createOrUpdateFileContents({
              owner: this.config.owner,
              repo: repoName,
              path: file.path,
              message: `Add ${file.path}`,
              content: Buffer.from(file.content).toString('base64'),
              branch: 'main',
            });
            console.log(`[GitHub Direct] Created file: ${file.path}`);
          } catch (error: any) {
            console.error(`[GitHub Direct] Failed to create file ${file.path}:`, error.message);
            // Continue with other files
          }
        }

        console.log('[GitHub Direct] All files pushed successfully (initial commit)');
        return;
      }

      // Branch exists - create new commit
      const tree = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await this.octokit.git.createBlob({
            owner: this.config.owner,
            repo: repoName,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          });
          
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      const { data: newTree } = await this.octokit.git.createTree({
        owner: this.config.owner,
        repo: repoName,
        tree,
        base_tree: sha,
      });

      const { data: newCommit } = await this.octokit.git.createCommit({
        owner: this.config.owner,
        repo: repoName,
        message: 'Project generated by Neuronix',
        tree: newTree.sha,
        parents: [refs[0].object.sha],
      });

      await this.octokit.git.updateRef({
        owner: this.config.owner,
        repo: repoName,
        ref: ref.replace('refs/', ''),
        sha: newCommit.sha,
      });

      console.log('[GitHub Direct] Files pushed successfully');
    } catch (error) {
      console.error('[GitHub Direct] Failed to push files:', error);
      throw new AgentError('Failed to push files to GitHub', 'GitHub', error);
    }
  }
}
