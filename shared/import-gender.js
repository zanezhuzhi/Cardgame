/**
 * 性别配置导入脚本
 * 将 gender_config.csv 中的性别配置写入 cards.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const csvPath = path.join(__dirname, '..', '策划文档', '卡牌数据', 'gender_config.csv');
const jsonPath = path.join(__dirname, 'data', 'cards.json');

// 读取 CSV 配置
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

// 读取并更新 cards.json
const cardsData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

let updated = 0;

// 更新式神
for (const card of cardsData.shikigami) {
  if (genderMap.has(card.id)) {
    card.gender = genderMap.get(card.id);
    updated++;
  }
}

// 更新鬼王
for (const card of cardsData.boss) {
  if (genderMap.has(card.id)) {
    card.gender = genderMap.get(card.id);
    updated++;
  }
}

// 更新妖怪
for (const card of cardsData.yokai) {
  if (genderMap.has(card.id)) {
    card.gender = genderMap.get(card.id);
    updated++;
  }
}

console.log(`✅ 更新了 ${updated} 张卡牌的性别属性`);

// 写入文件
fs.writeFileSync(jsonPath, JSON.stringify(cardsData, null, 2), 'utf-8');
console.log(`✅ 已保存到 ${jsonPath}`);

// 输出统计
const stats = { 0: 0, 1: 0, 2: 0, 3: 0 };
genderMap.forEach(g => stats[g]++);
console.log(`📊 统计: 无性别=${stats[0]}, 男性=${stats[1]}, 女性=${stats[2]}, 双性=${stats[3]}`);