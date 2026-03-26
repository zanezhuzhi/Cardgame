/**
 * 批量更新卡牌文档，添加性别属性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 性别代码转中文
const genderName = {
  0: '无',
  1: '男',
  2: '女',
  3: '双性'
};

// 读取 CSV 配置
const csvPath = path.join(__dirname, '..', '策划文档', '卡牌数据', 'gender_config.csv');
const docPath = path.join(__dirname, '..', '策划文档', '卡牌数据', '卡牌具体文档');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => !line.startsWith('#') && line.trim());

// 解析性别映射
const genderMap = new Map();
for (const line of lines) {
  const parts = line.split(',');
  if (parts.length >= 4 && parts[0] !== '类型') {
    const id = parts[1].trim();
    const gender = parseInt(parts[3].trim());
    if (!isNaN(gender)) {
      genderMap.set(id, gender);
    }
  }
}

console.log(`✅ 解析到 ${genderMap.size} 个性别配置`);

// 获取所有文档
const files = fs.readdirSync(docPath).filter(f => f.endsWith('.md') && !f.startsWith('TEMPLATE'));

let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(docPath, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 从文件名提取 ID
  const match = file.match(/^(yokai_\d+|shikigami_\d+|boss_\d+)/);
  if (!match) {
    console.log(`⏭️ 跳过 ${file} (无法识别ID)`);
    skipped++;
    continue;
  }
  
  const cardId = match[1];
  const gender = genderMap.get(cardId);
  
  if (gender === undefined) {
    console.log(`⏭️ 跳过 ${file} (无性别配置)`);
    skipped++;
    continue;
  }
  
  // 检查是否已有性别行
  if (content.includes('| 性别 |')) {
    console.log(`⏭️ 跳过 ${file} (已有性别)`);
    skipped++;
    continue;
  }
  
  // 在基础信息表格中插入性别行
  // 查找 "| HP |" 或 "| 声望 |" 行，在其前面插入性别行
  const genderRow = `| 性别 | ${genderName[gender]} |\n`;
  
  // 尝试在 HP 行之前插入
  if (content.includes('| HP |')) {
    content = content.replace(/(\| HP \|)/g, genderRow + '$1');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ 更新 ${file} → 性别: ${genderName[gender]}`);
    updated++;
  } else if (content.includes('| 声誉 |')) {
    // 如果没有 HP 行，在声誉行前插入
    content = content.replace(/(\| 声誉 \|)/g, genderRow + '$1');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ 更新 ${file} → 性别: ${genderName[gender]}`);
    updated++;
  } else {
    console.log(`⚠️ ${file} 找不到插入位置`);
    skipped++;
  }
}

console.log(`\n📊 统计: 更新 ${updated} 个文档, 跳过 ${skipped} 个文档`);
