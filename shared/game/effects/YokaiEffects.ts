
/**
 * 御魂传说 - 游荡妖怪效果数据
 * @file shared/game/effects/YokaiEffects.ts
 * 
 * 将游荡妖怪的文本效果转换为可执行的效果数组
 */

import type { Effect } from './types';

/** 游荡妖怪效果映射 */
export const YOKAI_EFFECTS: Record<string, Effect[]> = {
  
  // ============ 2费妖怪 ============
  
  // 赤舌 - 妨害：每位对手将灯笼鬼置于牌库顶
  'yokai_001': [
    { type: 'INTERFERE', target: 'OTHER_PLAYERS', subEffects: [
      { type: 'PUT_TOP', target: 'DISCARD_PILE', value: 1 }
    ]}
  ],
  
  // 唐纸伞妖 - 伤害+1，检视牌库顶
  'yokai_002': [
    { type: 'ATTACK_BONUS', value: 1, duration: 'turn' },
    { type: 'REVEAL', target: 'DECK_TOP', value: 1 }
  ],
  
  // 天邪鬼绿 - 立刻退治生命≤4的妖怪
  'yokai_003': [
    { type: 'DAMAGE', value: 4, target: 'YOKAI' }
  ],
  
  // 天邪鬼青 - 抓牌+1或鬼火+1
  'yokai_004': [
    { type: 'CHOICE', options: [
      { label: '抓牌+1', effects: [{ type: 'DRAW', value: 1 }] },
      { label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] }
    ]}
  ],
  
  // 天邪鬼赤 - 伤害+1，弃牌换牌
  'yokai_005': [
    { type: 'ATTACK_BONUS', value: 1, duration: 'turn' },
    { type: 'CUSTOM' }  // 弃置任意数量手牌，抓等量
  ],
  
  // 天邪鬼黄 - 抓牌+2，置顶1张
  'yokai_006': [
    { type: 'DRAW', value: 2 },
    { type: 'PUT_TOP', target: 'HAND_CARD', value: 1 }
  ],
  
  // ============ 3费妖怪 ============
  
  // 钟灵 - 抓牌+2，轮流交换手牌
  'yokai_007': [
    { type: 'DRAW', value: 2 },
    { type: 'INTERFERE', target: 'ALL_PLAYERS', subEffects: [
      { type: 'CUSTOM' }  // 交换手牌
    ]}
  ],
  
  // 魅妖 - 使用对手牌库顶牌
  'yokai_008': [
    { type: 'CUSTOM' }  // 特殊效果
  ],
  
  // 被服 - 鬼火+1，展示直到鬼火
  'yokai_009': [
    { type: 'GHOST_FIRE', value: 1 },
    { type: 'CUSTOM' }  // 展示直到鬼火
  ],
  
  // 树妖 - 抓1张牌（被弃置时抓2张）
  'yokai_010': [
    { type: 'DRAW', value: 1 }
  ],
  
  // 日女巳时 - 选择：抓牌+2/鬼火+2/伤害+2
  'yokai_011': [
    { type: 'CHOICE', options: [
      { label: '抓牌+2', effects: [{ type: 'DRAW', value: 2 }] },
      { label: '鬼火+2', effects: [{ type: 'GHOST_FIRE', value: 2 }] },
      { label: '伤害+2', effects: [{ type: 'ATTACK_BONUS', value: 2, duration: 'turn' }] }
    ]}
  ],
  
  // 蚌精 - 抓1张牌，游戏结束令牌+1
  'yokai_012': [
    { type: 'DRAW', value: 1 }
  ],
  
  // 鸣屋 - 伤害+2（弃牌堆空时+4）
  'yokai_013': [
    { type: 'ATTACK_BONUS', value: 2, duration: 'turn', condition: {
      type: 'DISCARD_COUNT', operator: '>', value: 0
    }},
    { type: 'ATTACK_BONUS', value: 4, duration: 'turn', condition: {
      type: 'DISCARD_COUNT', operator: '=', value: 0
    }}
  ],
  
  // 蝠翼 - 伤害+1，抓牌+1
  'yokai_014': [
    { type: 'ATTACK_BONUS', value: 1, duration: 'turn' },
    { type: 'DRAW', value: 1 }
  ],
  
  // 兵主部 - 伤害+2
  'yokai_015': [
    { type: 'ATTACK_BONUS', value: 2, duration: 'turn' }
  ],
  
  // ============ 4费妖怪 ============
  
  // 魍魉之匣 - 抓牌+1，伤害+1，妨害
  'yokai_016': [
    { type: 'DRAW', value: 1 },
    { type: 'ATTACK_BONUS', value: 1, duration: 'turn' },
    { type: 'INTERFERE', target: 'ALL_PLAYERS', subEffects: [
      { type: 'REVEAL', target: 'DECK_TOP', value: 1 }
    ]}
  ],
  
  // 骰子鬼 - 超度手牌，退治对应生命单位
  'yokai_017': [
    { type: 'CUSTOM' }
  ],
  
  // 涅槃之火 - 鬼火+1，灯笼鬼额外+1
  'yokai_018': [
    { type: 'GHOST_FIRE', value: 1 }
  ],
  
  // 雪幽魂 - 抓牌+2，妨害恶评
  'yokai_019': [
    { type: 'DRAW', value: 2 },
    { type: 'INTERFERE', target: 'OTHER_PLAYERS', subEffects: [
      { type: 'CUSTOM' }  // 弃恶评或获得恶评
    ]}
  ],
  
  // 轮入道 - 打出另一张御魂，效果执行2次
  'yokai_020': [
    { type: 'CUSTOM' }
  ],
  
  // 网切 - 所有卡生命-1，鬼王-2
  'yokai_021': [
    { type: 'CUSTOM' }
  ],
  
  // 铮 - 抓牌+1，伤害+2
  'yokai_022': [
    { type: 'DRAW', value: 1 },
    { type: 'ATTACK_BONUS', value: 2, duration: 'turn' }
  ],
  
  // 薙魂 - 使用3张御魂后鬼火+2
  'yokai_023': [
    { type: 'GHOST_FIRE', value: 2, condition: {
      type: 'CARDS_PLAYED', operator: '>=', value: 3
    }}
  ],
  
  // ============ 5费妖怪 ============
  
  // 狂骨 - 抓1张，式神技能额外+2伤害
  'yokai_024': [
    { type: 'DRAW', value: 1 }
  ],
  
  // 返魂香 - 抓牌+2，妨害弃牌或获得恶评
  'yokai_025': [
    { type: 'DRAW', value: 2 },
    { type: 'INTERFERE', target: 'OTHER_PLAYERS', subEffects: [
      { type: 'CHOICE', options: [
        { label: '弃置2张手牌', effects: [{ type: 'DISCARD', value: 2, target: 'HAND_CARD' }] },
        { label: '获得恶评', effects: [{ type: 'GAIN_CARD', target: 'SELF', value: 1 }] }
      ]}
    ]}
  ],
  
  // 镇墓兽 - 抓牌+1，伤害+2，鬼火+2
  'yokai_026': [
    { type: 'DRAW', value: 1 },
    { type: 'ATTACK_BONUS', value: 2, duration: 'turn' },
    { type: 'GHOST_FIRE', value: 2 }
  ],
  
  // 针女 - 抓牌+3，弃牌换攻击
  'yokai_027': [
    { type: 'DRAW', value: 3 }
  ],
  
  // 心眼 - 伤害+3
  'yokai_028': [
    { type: 'ATTACK_BONUS', value: 3, duration: 'turn' }
  ],
  
  // 涂佛 - 从弃牌堆取回3张鬼火/令牌
  'yokai_029': [
    { type: 'CUSTOM' }
  ],
  
  // 地藏像 - 抓牌+1，游戏结束每8张牌+1令牌
  'yokai_030': [
    { type: 'DRAW', value: 1 }
  ],
  
  // ============ 6费妖怪 ============
  
  // 飞缘魔 - 使用鬼王牌
  'yokai_031': [
    { type: 'CUSTOM' }
  ],
  
  // 破势 - 伤害+4，首攻掷骰
  'yokai_032': [
    { type: 'ATTACK_BONUS', value: 4, duration: 'turn' }
  ],
  
  // 镜姬 - 抓牌+2，伤害+1，鬼火+2
  'yokai_033': [
    { type: 'DRAW', value: 2 },
    { type: 'ATTACK_BONUS', value: 1, duration: 'turn' },
    { type: 'GHOST_FIRE', value: 2 }
  ],
  
  // 木魅 - 展示直到2张鬼火
  'yokai_034': [
    { type: 'CUSTOM' }
  ],
  
  // ============ 7费妖怪 ============
  
  // 幽谷响 - 使用所有对手牌库顶牌
  'yokai_035': [
    { type: 'CUSTOM' }
  ],
  
  // 伤魂鸟 - 超度手牌，退治等生命目标
  'yokai_036': [
    { type: 'CUSTOM' }
  ],
  
  // 阴摩罗 - 超度1张，退治生命+3以内
  'yokai_037': [
    { type: 'CUSTOM' }
  ],
  
  // ============ 8费妖怪 ============
  
  // 青女房 - 获得火灵置于牌库顶
  'yokai_038': [
    { type: 'CUSTOM' }
  ],
  
  // 三味 - 每张鬼火额外+2鬼火
  'yokai_039': [
    { type: 'CUSTOM' }
  ]
};

/**
 * 获取游荡妖怪效果
 */
export function getYokaiEffects(yokaiId: string): Effect[] {
  return YOKAI_EFFECTS[yokaiId] || [];
}
