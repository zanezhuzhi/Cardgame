#!/usr/bin/env npx tsx
/**
 * agents/runner.ts
 * Agent 启动脚本 — 读取 System Prompt + Issue 上下文，调用 Claude CLI 执行任务
 *
 * 用法:
 *   npx tsx agents/runner.ts --agent designer --issue-body "..." --issue-number 42
 *
 * 环境变量:
 *   ANTHROPIC_API_KEY  — Claude API Key
 *   GITHUB_TOKEN       — 用于回写评论
 *   GITHUB_REPO        — 格式: owner/repo
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

// ─── 参数解析 ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) {
    throw new Error(`缺少必要参数: --${name}`);
  }
  return args[idx + 1];
}

function getArgOptional(name: string, defaultValue = ''): string {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

// ─── 主逻辑 ───────────────────────────────────────────────────────────────────

async function main() {
  const agentName   = getArg('agent');           // designer / programmer / reviewer / qa / pm
  const issueNumber = getArg('issue-number');    // GitHub Issue 编号
  const issueBody   = getArgOptional('issue-body');    // Issue 正文
  const commentBody = getArgOptional('comment-body');  // 触发评论内容
  const repo        = process.env.GITHUB_REPO ?? '';

  console.log(`\n🤖 启动 Agent: ${agentName}  |  Issue #${issueNumber}`);
  console.log(`📂 Working dir: ${process.cwd()}`);

  // 1. 读取 System Prompt
  const promptPath = resolve(join('agents', 'prompts', `${agentName}.md`));
  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(promptPath, 'utf-8');
  } catch {
    throw new Error(`System Prompt 不存在: ${promptPath}`);
  }

  // 2. 拼装用户消息（任务上下文）
  const userMessage = buildUserMessage(agentName, {
    issueNumber,
    issueBody,
    commentBody,
    repo,
  });

  // 3. 写入临时 prompt 文件（claude CLI 通过 stdin 读取）
  const fullPrompt = `<system>\n${systemPrompt}\n</system>\n\n<user>\n${userMessage}\n</user>`;

  console.log(`\n📝 发送给 Claude 的 Prompt 预览（前200字）:\n${fullPrompt.slice(0, 200)}...\n`);

  // 4. 调用 Claude CLI
  const result = callClaude(fullPrompt);

  console.log(`\n✅ Claude 返回（前500字）:\n${result.slice(0, 500)}\n`);

  // 5. 如果包含 github_post_comment 指令，解析并执行
  await flushGithubComments(result, issueNumber, repo);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function buildUserMessage(
  agentName: string,
  ctx: { issueNumber: string; issueBody: string; commentBody: string; repo: string }
): string {
  const lines: string[] = [
    `## 当前任务上下文`,
    ``,
    `- **GitHub Repo**: ${ctx.repo}`,
    `- **Issue 编号**: #${ctx.issueNumber}`,
  ];

  if (ctx.issueBody) {
    lines.push(``, `### Issue 正文`, ``, ctx.issueBody);
  }

  if (ctx.commentBody) {
    lines.push(``, `### 触发评论`, ``, ctx.commentBody);
  }

  // 根据 agent 类型补充提示
  const hints: Record<string, string> = {
    pm: '请解析上方 Issue 内容，启动 pipeline。',
    designer: '请读取策划文档并生成技术规格，完成后在 Issue 中通知 @programmer。',
    programmer: '请读取技术规格文档，实现卡牌效果，完成后通知 @reviewer。',
    reviewer: '请读取代码和规格，进行审查，根据结果通知 @programmer 或 @qa。',
    qa: '请运行测试，根据结果通知 @programmer 或 @pm。',
  };

  lines.push(``, `---`, ``, hints[agentName] ?? '请根据你的职责继续执行。');

  return lines.join('\n');
}

/**
 * 查找 claude CLI 的可执行路径
 * 按优先级尝试: PATH > npm global bin > 常见安装路径
 */
function findClaudePath(): string {
  // 1. 先试 PATH 中的 claude
  try {
    const where = spawnSync('where', ['claude'], { encoding: 'utf-8', timeout: 5000 });
    if (where.status === 0 && where.stdout.trim()) {
      const first = where.stdout.trim().split(/\r?\n/)[0];
      console.log(`🔍 在 PATH 中找到 claude: ${first}`);
      return first;
    }
  } catch { /* ignore */ }

  // 2. 常见 npm global 安装路径（Windows）
  const candidates = [
    join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
    join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    'C:\\Users\\zhuzhi\\AppData\\Roaming\\npm\\claude.cmd',
  ];

  for (const p of candidates) {
    try {
      if (require('fs').existsSync(p)) {
        console.log(`🔍 在常见路径找到 claude: ${p}`);
        return p;
      }
    } catch { /* ignore */ }
  }

  // 3. fallback: 直接返回 'claude'，让系统自己找
  console.log('🔍 未找到 claude 完整路径，尝试直接调用...');
  return 'claude';
}

/**
 * 调用本地 Claude CLI（claude 命令行工具）
 * 需要先安装: npm install -g @anthropic-ai/claude-code
 * 或使用 claude 官方 CLI: https://docs.anthropic.com/zh-CN/docs/claude-cli
 */
function callClaude(prompt: string): string {
  const claudePath = findClaudePath();
  // 使用 claude -p 模式（print mode，非交互）
  const result = spawnSync(
    claudePath,
    ['-p', '--output-format', 'text'],
    {
      input: prompt,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout: 5 * 60 * 1000, // 5分钟超时
      maxBuffer: 10 * 1024 * 1024,
      shell: true, // 用 shell 执行以支持 .cmd 文件
    }
  );

  if (result.error) {
    throw new Error(`调用 Claude CLI 失败: ${result.error.message}\nclaude 路径: ${claudePath}\n提示: 请确认已安装 claude CLI 并配置 ANTHROPIC_API_KEY`);
  }

  if (result.status !== 0) {
    console.error('Claude stderr:', result.stderr);
    throw new Error(`Claude 返回非零退出码: ${result.status}`);
  }

  return result.stdout ?? '';
}

/**
 * 解析 Claude 返回内容中的 github_post_comment 块并执行
 * 支持格式:
 *   <!-- github_post_comment -->
 *   评论内容
 *   <!-- /github_post_comment -->
 */
async function flushGithubComments(
  claudeOutput: string,
  issueNumber: string,
  repo: string
) {
  // 匹配 <!-- github_post_comment --> ... <!-- /github_post_comment -->
  const regex = /<!--\s*github_post_comment\s*-->([\s\S]*?)<!--\s*\/github_post_comment\s*-->/g;
  const matches = [...claudeOutput.matchAll(regex)];

  if (matches.length === 0) {
    console.log('ℹ️  未检测到 github_post_comment 指令，跳过评论回写。');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('⚠️  GITHUB_TOKEN 未设置，无法回写评论。');
    return;
  }

  const [owner, repoName] = repo.split('/');

  for (const match of matches) {
    const body = match[1].trim();
    console.log(`📤 发布 GitHub 评论到 #${issueNumber}...`);

    const response = execSync(
      `curl -s -X POST \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d ${JSON.stringify(JSON.stringify({ body }))} \
        "https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}/comments"`,
      { encoding: 'utf-8' }
    );

    const parsed = JSON.parse(response);
    if (parsed.id) {
      console.log(`✅ 评论发布成功，ID: ${parsed.id}`);
    } else {
      console.error('❌ 评论发布失败:', response);
    }
  }
}

// ─── 入口 ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n❌ Agent Runner 出错:', err.message);
  process.exit(1);
});
