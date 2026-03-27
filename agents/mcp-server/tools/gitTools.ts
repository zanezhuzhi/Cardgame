/**
 * 工具：Git 操作
 * 供 programmer/pm Agent 提交代码变更
 */

import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const exec = promisify(execCb);
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../');

export const gitStatusTool = {
  name: 'git_status',
  description: '查看当前 Git 工作区状态，了解哪些文件被修改、新增或删除。',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async handler(_args: Record<string, never>) {
    const { stdout } = await exec('git status --short', { cwd: PROJECT_ROOT });
    const { stdout: diffStat } = await exec('git diff --stat', { cwd: PROJECT_ROOT });
    return {
      status: stdout.trim(),
      diffStat: diffStat.trim(),
      hasChanges: stdout.trim().length > 0,
    };
  },
};

export const gitCommitTool = {
  name: 'git_commit',
  description: '将当前工作区的变更提交到 Git 仓库。使用语义化 commit message。',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'commit message，格式：feat(yokai): 实现唐纸伞妖效果',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: '要提交的文件列表（相对路径）。不填则提交所有变更（git add -A）。',
      },
    },
    required: ['message'],
  },
  async handler({ message, files }: { message: string; files?: string[] }) {
    // 添加文件
    if (files && files.length > 0) {
      const fileList = files.map(f => `"${f}"`).join(' ');
      await exec(`git add ${fileList}`, { cwd: PROJECT_ROOT });
    } else {
      await exec('git add -A', { cwd: PROJECT_ROOT });
    }

    // 提交
    const { stdout } = await exec(`git commit -m "${message}"`, {
      cwd: PROJECT_ROOT,
    });

    // 获取 commit hash
    const { stdout: hash } = await exec('git rev-parse --short HEAD', {
      cwd: PROJECT_ROOT,
    });

    return {
      success: true,
      commitHash: hash.trim(),
      message,
      output: stdout.trim(),
    };
  },
};
