/**
 * 测试文件拆分脚本
 * 将 YokaiEffects.test.ts 按 HP 分组拆分为多个文件
 */
const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../YokaiEffects.test.ts');
const outputDir = __dirname;

// 读取源文件
const content = fs.readFileSync(sourceFile, 'utf8');
const lines = content.split('\n');

// HP分组配置 (行号从1开始，对应实际文件行)
const groups = {
  'HP1-3': {
    desc: '招福达摩~兵主部',
    cards: '招福达摩、天邪鬼系列、唐纸伞妖、赤舌、魅妖、灯笼鬼、树妖、日女巳时、鸣屋、蚌精、兵主部',
    start: 57,  // 从第一个describe前的注释开始
    end: 1704
  },
  'HP4-5': {
    desc: '骰子鬼~镜姬',
    cards: '骰子鬼、涅槃之火、铮、网切、魍魉之匣、狂骨、心眼、针女、破势、镜姬',
    start: 1705,
    end: 2615
  },
  'HP6+': {
    desc: '伤魂鸟~幽谷响',
    cards: '伤魂鸟、青女房、三味、雪幽魂、轮入道、阴摩罗、薙魂、飞缘魔、木魅、幽谷响',
    start: 2616,
    end: lines.length
  }
};

// 公共头部
const commonHeader = `import { describe, it, expect, beforeEach } from 'vitest';
import { 
  executeYokaiEffect, 
  aiDecide_唐纸伞妖, 
  aiSelect_天邪鬼绿,
  aiDecide_天邪鬼赤,
  aiDecide_天邪鬼黄,
  aiDecide_魅妖
} from '../YokaiEffects';
import { createTestPlayer, createTestGameState, createTestCard, createYokaiCard, createSpellCard, createOpponent } from './testUtils';
import type { CardInstance, PlayerState, GameState } from '../../../types';
`;

// 修复动态导入路径
function fixDynamicImports(content) {
  return content
    .replace(/await import\('\.\/YokaiEffects'\)/g, "await import('../YokaiEffects')")
    .replace(/from '\.\/YokaiEffects'/g, "from '../YokaiEffects'");
}

// 生成拆分文件
for (const [groupName, config] of Object.entries(groups)) {
  const groupLines = lines.slice(config.start - 1, config.end);
  let groupContent = groupLines.join('\n');
  
  // 修复动态导入路径
  groupContent = fixDynamicImports(groupContent);
  
  const fileContent = `/**
 * 妖怪御魂效果测试 - ${groupName} (${config.desc})
 * 包含: ${config.cards}
 */

${commonHeader}

${groupContent}
`;
  
  const outputPath = path.join(outputDir, `YokaiEffects.${groupName}.test.ts`);
  fs.writeFileSync(outputPath, fileContent, 'utf8');
  console.log(`✅ 生成 ${outputPath} (${groupLines.length} 行)`);
}

console.log('\n拆分完成！');
