/**
 * 工具：读写代码文件
 * 供 programmer/reviewer Agent 读取和修改代码
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../');

// 允许访问的目录白名单（安全限制）
const ALLOWED_DIRS = [
  'shared/game/effects',
  'shared/types',
  'shared/data',
  'server/src/game',
  'agents/prompts',
  'docs',
  '策划文档/卡牌数据/卡牌具体文档',
];

function isAllowed(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWED_DIRS.some(dir => normalized.startsWith(dir));
}

export const readFileTool = {
  name: 'read_file',
  description: '读取项目中的代码或文档文件内容。支持 .ts/.md/.json 等格式。路径相对于项目根目录。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径，如 "shared/game/effects/YokaiEffects.ts"',
      },
      startLine: {
        type: 'number',
        description: '从第几行开始读（可选，默认从头）',
      },
      endLine: {
        type: 'number',
        description: '读到第几行结束（可选，默认到尾）',
      },
    },
    required: ['path'],
  },
  async handler({ path: filePath, startLine, endLine }: {
    path: string;
    startLine?: number;
    endLine?: number;
  }) {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    const content = await readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    if (startLine !== undefined || endLine !== undefined) {
      const start = (startLine ?? 1) - 1;
      const end = endLine ?? lines.length;
      const sliced = lines.slice(start, end).join('\n');
      return {
        path: filePath,
        content: sliced,
        totalLines: lines.length,
        shownLines: `${start + 1}-${end}`,
      };
    }

    return { path: filePath, content, totalLines: lines.length };
  },
};

export const writeFileTool = {
  name: 'write_file',
  description: '写入内容到项目代码文件。仅允许修改 shared/game/effects、shared/types 等指定目录。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径',
      },
      content: {
        type: 'string',
        description: '要写入的完整文件内容',
      },
      append: {
        type: 'boolean',
        description: '是否追加模式（默认false=覆盖）',
      },
    },
    required: ['path', 'content'],
  },
  async handler({ path: filePath, content, append = false }: {
    path: string;
    content: string;
    append?: boolean;
  }) {
    // 安全检查
    if (!isAllowed(filePath)) {
      return {
        error: `禁止写入该路径: ${filePath}。允许的目录: ${ALLOWED_DIRS.join(', ')}`,
      };
    }

    const fullPath = path.join(PROJECT_ROOT, filePath);

    if (append) {
      const existing = await readFile(fullPath, 'utf-8').catch(() => '');
      await writeFile(fullPath, existing + '\n' + content, 'utf-8');
    } else {
      await writeFile(fullPath, content, 'utf-8');
    }

    return { success: true, path: filePath, bytes: content.length };
  },
};

export const listFilesTool = {
  name: 'list_files',
  description: '列出指定目录下的文件。用于了解项目结构，找到需要修改的文件。',
  inputSchema: {
    type: 'object',
    properties: {
      dir: {
        type: 'string',
        description: '相对于项目根目录的目录路径，如 "shared/game/effects"',
      },
      pattern: {
        type: 'string',
        description: 'glob 匹配模式，如 "*.ts"（默认列出所有文件）',
      },
    },
    required: ['dir'],
  },
  async handler({ dir, pattern = '*' }: { dir: string; pattern?: string }) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    const files = await glob(pattern, { cwd: fullDir });
    return { dir, files };
  },
};
