/**
 * 工具：运行单元测试
 * 供 qa Agent 验证代码是否通过测试
 */

import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const exec = promisify(execCb);
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../');
const SHARED_DIR = path.join(PROJECT_ROOT, 'shared');

export const runTestsTool = {
  name: 'run_tests',
  description: '运行 shared 层的单元测试。可指定测试文件或卡牌名称。返回测试通过/失败详情。',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '测试匹配关键词，如"唐纸伞妖"、"BossEffects"、"YokaiEffects"。不填则运行全部测试。',
      },
      file: {
        type: 'string',
        description: '指定测试文件，如"BossEffects"。',
      },
    },
  },
  async handler({ pattern, file }: { pattern?: string; file?: string }) {
    const keyword = file || pattern || '';
    const cmd = keyword
      ? `npm test -- "${keyword}" --run`
      : `npm test -- --run`;

    try {
      const { stdout, stderr } = await exec(cmd, {
        cwd: SHARED_DIR,
        timeout: 60_000, // 最多60秒
      });

      // 解析测试结果
      const output = stdout + stderr;
      const passed = (output.match(/✓/g) || []).length;
      const failed = (output.match(/✗|×|FAIL/g) || []).length;
      const success = failed === 0 && passed > 0;

      return {
        success,
        passed,
        failed,
        output: output.slice(0, 3000), // 截断避免太长
        summary: success
          ? `✅ ${passed} 个测试全部通过`
          : `❌ ${failed} 个测试失败，${passed} 个通过`,
      };
    } catch (err: any) {
      // exec 在测试失败时也会抛出错误
      const output = (err.stdout || '') + (err.stderr || '');
      const passed = (output.match(/✓/g) || []).length;
      const failed = (output.match(/✗|×|FAIL/g) || []).length;

      return {
        success: false,
        passed,
        failed,
        output: output.slice(0, 3000),
        summary: `❌ 测试失败：${failed} 个失败，${passed} 个通过`,
        error: err.message,
      };
    }
  },
};
