/**
 * 工具：读取策划文档
 * 供 designer Agent 读取卡牌效果定义
 */

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

// 项目根目录（相对于 agents/mcp-server/）
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../');
const PLANNING_DIR = path.join(PROJECT_ROOT, '策划文档');

export const readPlanningDocTool = {
  name: 'read_planning_doc',
  description: '读取策划文档内容。可按卡牌名称搜索，也可直接指定文件路径。用于获取卡牌效果的策划原文。',
  inputSchema: {
    type: 'object',
    properties: {
      cardName: {
        type: 'string',
        description: '卡牌名称，如"唐纸伞妖"、"八岐大蛇"。会在策划文档目录下模糊搜索匹配文件。',
      },
      filePath: {
        type: 'string',
        description: '直接指定文件路径（相对于策划文档目录），如"卡牌数据/妖怪卡.md"。与 cardName 二选一。',
      },
    },
  },
  async handler({ cardName, filePath }: { cardName?: string; filePath?: string }) {
    // 直接指定路径
    if (filePath) {
      const fullPath = path.join(PLANNING_DIR, filePath);
      const content = await readFile(fullPath, 'utf-8');
      return { path: fullPath, content };
    }

    // 按卡牌名搜索
    if (cardName) {
      // 先找具体文档（卡牌具体文档目录）
      const specificFiles = await glob(`**/*${cardName}*.md`, {
        cwd: PLANNING_DIR,
        absolute: true,
      });

      if (specificFiles.length > 0) {
        const content = await readFile(specificFiles[0], 'utf-8');
        return { path: specificFiles[0], content, source: '具体文档' };
      }

      // 找不到具体文档，在主文档中搜索
      const mainDocs = [
        '卡牌数据/妖怪卡.md',
        '卡牌数据/鬼王卡.md',
        '卡牌数据/式神卡.md',
        '卡牌数据/阴阳术卡.md',
      ];

      for (const doc of mainDocs) {
        const fullPath = path.join(PLANNING_DIR, doc);
        try {
          const content = await readFile(fullPath, 'utf-8');
          // 检查文档中是否包含该卡牌名
          if (content.includes(cardName)) {
            // 提取包含卡牌名的段落（前后各200字符）
            const idx = content.indexOf(cardName);
            const excerpt = content.slice(Math.max(0, idx - 100), idx + 500);
            return {
              path: fullPath,
              content: excerpt,
              source: `${doc}（片段）`,
              hint: '如需完整文档请使用 filePath 参数',
            };
          }
        } catch {
          // 文件不存在跳过
        }
      }

      return { error: `未找到卡牌"${cardName}"的策划文档` };
    }

    return { error: '请提供 cardName 或 filePath 参数' };
  },
};

export const listPlanningDocsTool = {
  name: 'list_planning_docs',
  description: '列出策划文档目录下的所有文档，了解有哪些可读取的策划资料。',
  inputSchema: {
    type: 'object',
    properties: {
      subDir: {
        type: 'string',
        description: '子目录名，如"卡牌数据"、"卡牌具体文档"。不填则列出顶层目录。',
      },
    },
  },
  async handler({ subDir }: { subDir?: string }) {
    const targetDir = subDir
      ? path.join(PLANNING_DIR, subDir)
      : PLANNING_DIR;

    const files = await glob('**/*.md', { cwd: targetDir });
    return { dir: targetDir, files };
  },
};
