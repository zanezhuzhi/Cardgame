/**
 * 工具：GitHub 操作
 * 供 Agent 发评论、创建 PR（即 Agent 间的通信媒介）
 */

import { Octokit } from '@octokit/rest';

// 从环境变量读取（GitHub Actions 中自动注入）
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'zanezhuzhi';
const REPO_NAME  = process.env.GITHUB_REPO_NAME  || 'Cardgame';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export const githubPostCommentTool = {
  name: 'github_post_comment',
  description: 'Agent 在 GitHub Issue 或 PR 上发评论。这是 Agent 间通信的核心方式——通过 @提及 触发下一个 Agent。',
  inputSchema: {
    type: 'object',
    properties: {
      issueNumber: {
        type: 'number',
        description: 'Issue 或 PR 编号',
      },
      body: {
        type: 'string',
        description: '评论内容。用 @designer/@programmer/@reviewer/@qa/@pm 触发对应 Agent。',
      },
    },
    required: ['issueNumber', 'body'],
  },
  async handler({ issueNumber, body }: { issueNumber: number; body: string }) {
    const { data } = await octokit.issues.createComment({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      body,
    });

    return {
      success: true,
      commentId: data.id,
      url: data.html_url,
    };
  },
};

export const githubCreatePRTool = {
  name: 'github_create_pr',
  description: '创建 Pull Request，将 Agent 实现的代码提交审核。由 pm Agent 在所有流程通过后调用。',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'PR 标题，如 "feat(yokai): 实现唐纸伞妖效果"',
      },
      body: {
        type: 'string',
        description: 'PR 描述，包含实现了什么、测试结果、迭代次数等',
      },
      head: {
        type: 'string',
        description: '源分支名，如 "agent/yokai-唐纸伞妖"',
      },
      base: {
        type: 'string',
        description: '目标分支，默认 "main"',
      },
    },
    required: ['title', 'body', 'head'],
  },
  async handler({ title, body, head, base = 'main' }: {
    title: string;
    body: string;
    head: string;
    base?: string;
  }) {
    const { data } = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title,
      body,
      head,
      base,
    });

    return {
      success: true,
      prNumber: data.number,
      url: data.html_url,
    };
  },
};
