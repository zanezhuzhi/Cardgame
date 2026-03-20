
"""
更新 cards.json 中式神和妖怪的多人标记、稀有度、声誉数据
数据来源：策划文档/202005_阴阳师+桌游+游戏反馈.xlsx
"""

import json
import os

# 获取项目根目录
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
cards_path = os.path.join(project_root, 'shared', 'data', 'cards.json')


with open(cards_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 式神多人标记和稀有度声誉 (来自Excel表格)
shikigami_updates = {
    '妖刀姬': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '大天狗': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '酒吞童子': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '茨木童子': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '花鸟卷': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '辉夜姬': {'rarity': 'SSR', 'charm': 3, 'multiPlayer': False},
    '书翁': {'rarity': 'SR', 'charm': 2, 'multiPlayer': False},
    '百目鬼': {'rarity': 'SR', 'charm': 2, 'multiPlayer': True},
    '鬼使白': {'rarity': 'SR', 'charm': 2, 'multiPlayer': False},
    '鬼使黑': {'rarity': 'SR', 'charm': 2, 'multiPlayer': False},
    '白狼': {'rarity': 'SR', 'charm': 2, 'multiPlayer': False},
    '姑获鸟': {'rarity': 'SR', 'charm': 2, 'multiPlayer': False},
    '鲤鱼精': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '萤草': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '独眼小僧': {'rarity': 'R', 'charm': 1, 'multiPlayer': True},
    '食发鬼': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '巫蛊师': {'rarity': 'R', 'charm': 1, 'multiPlayer': True},
    '山童': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '丑时之女': {'rarity': 'R', 'charm': 1, 'multiPlayer': True},
    '三尾狐': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '青蛙瓷器': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '铁鼠': {'rarity': 'R', 'charm': 1, 'multiPlayer': True},
    '青行灯': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
    '鬼女红叶': {'rarity': 'R', 'charm': 1, 'multiPlayer': False},
}

# 更新式神
shikigami_count = 0
for s in data['shikigami']:
    name = s['name']
    if name in shikigami_updates:
        s.update(shikigami_updates[name])
        shikigami_count += 1

# 妖怪声誉和多人标记 (来自Excel表格)
yokai_updates = {
    '赤舌': {'charm': 1, 'multiPlayer': False},
    '唐纸伞妖': {'charm': 0, 'multiPlayer': True},
    '天邪鬼绿': {'charm': 0, 'multiPlayer': False},
    '天邪鬼青': {'charm': 0, 'multiPlayer': True},
    '天邪鬼赤': {'charm': 0, 'multiPlayer': True},
    '天邪鬼黄': {'charm': 0, 'multiPlayer': True},
    '钟灵': {'charm': 0, 'multiPlayer': False},
    '魅妖': {'charm': 0, 'multiPlayer': False},
    '被服': {'charm': 0, 'multiPlayer': False},
    '树妖': {'charm': 0, 'multiPlayer': True},
    '日女巳时': {'charm': 0, 'multiPlayer': True},
    '蚌精': {'charm': 0, 'multiPlayer': True},
    '鸣屋': {'charm': 0, 'multiPlayer': True},
    '蝠翼': {'charm': 1, 'multiPlayer': True},
    '兵主部': {'charm': 1, 'multiPlayer': True},
    '魍魉之匣': {'charm': 0, 'multiPlayer': True},
    '骰子鬼': {'charm': 1, 'multiPlayer': False},
    '涅槃之火': {'charm': 1, 'multiPlayer': True},
    '雪幽魂': {'charm': 1, 'multiPlayer': True},
    '轮入道': {'charm': 0, 'multiPlayer': True},
    '网切': {'charm': 0, 'multiPlayer': True},
    '铮': {'charm': 0, 'multiPlayer': True},
    '薙魂': {'charm': 1, 'multiPlayer': True},
    '狂骨': {'charm': 0, 'multiPlayer': False},
    '返魂香': {'charm': 1, 'multiPlayer': True},
    '镇墓兽': {'charm': 1, 'multiPlayer': True},
    '针女': {'charm': 1, 'multiPlayer': True},
    '心眼': {'charm': 0, 'multiPlayer': True},
    '涂佛': {'charm': 0, 'multiPlayer': True},
    '地藏像': {'charm': 2, 'multiPlayer': False},
    '飞缘魔': {'charm': 1, 'multiPlayer': True},
    '破势': {'charm': 1, 'multiPlayer': True},
    '镜姬': {'charm': 1, 'multiPlayer': True},
    '木魅': {'charm': 1, 'multiPlayer': True},
    '幽谷响': {'charm': 1, 'multiPlayer': True},
    '伤魂鸟': {'charm': 1, 'multiPlayer': True},
    '阴摩罗': {'charm': 1, 'multiPlayer': True},
    '青女房': {'charm': 2, 'multiPlayer': False},
    '三味': {'charm': 2, 'multiPlayer': False},
}

# 更新妖怪
yokai_count = 0
for y in data['yokai']:
    name = y['name']
    if name in yokai_updates:
        y.update(yokai_updates[name])
        yokai_count += 1

# 保存
with open(cards_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Done! Updated {shikigami_count} shikigami and {yokai_count} yokai')
