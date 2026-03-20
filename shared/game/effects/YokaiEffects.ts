/**
 * 御魂传说 - 游荡妖怪效果数据 v2
 * @file shared/game/effects/YokaiEffects.ts
 *
 * 39 张游荡妖怪的效果定义，使用 CardEffectDef 结构
 * 数据来源：202005_阴阳师+桌游+游戏反馈.xlsx「妖怪」sheet
 */

import type { CardEffectDef } from './types';

export const YOKAI_EFFECT_DEFS: CardEffectDef[] = [

  // ===== 2 费妖怪 =====

  // 赤舌 - 妨害：所有对手将牌库顶1张置于弃牌堆（恶评牌放顶）
  {
    cardId: 'yokai_001',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '赤舌诅咒',
    effects: [{
      type: 'INTERFERE',
      target: 'OTHER_PLAYERS',
      subEffects: [{ type: 'DISCARD', count: 1, random: true }]
    }],
    description: '【妨害】所有对手弃置牌库顶1张牌',
  },

  // 唐纸伞妖 - 伤害+1，展示自己牌库顶1张
  {
    cardId: 'yokai_002',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '伞下窥视',
    effects: [
      { type: 'DAMAGE', value: 1 },
      { type: 'REVEAL_TOP' } as any, // REVEAL_TOP 不消耗只展示
    ],
    description: '伤害+1，展示牌库顶1张牌',
  },

  // 天邪鬼绿 - 直接退治生命≤4的妖怪
  {
    cardId: 'yokai_003',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '绿魔之力',
    effects: [{ type: 'KILL_YOKAI', maxHp: 4 }],
    description: '直接退治1个生命值不高于4的游荡妖怪',
  },

  // 天邪鬼青 - 抓牌+1 或 鬼火+1（二选一）
  {
    cardId: 'yokai_004',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '青魔赐福',
    effects: [{
      type: 'CHOICE',
      options: [
        { label: '抓牌+1', effects: [{ type: 'DRAW', count: 1 }] },
        { label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] },
      ]
    }],
    description: '选择：抓牌+1 或 鬼火+1',
  },

  // 天邪鬼赤 - 伤害+1，弃置任意手牌后抓等量
  {
    cardId: 'yokai_005',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '赤魔换牌',
    effects: [
      { type: 'DAMAGE', value: 1 },
      // 弃置任意数量然后抓等量——此为特殊逻辑，DISCARD count=0 表示"玩家自选任意数量"
      // 后续 EffectEngine 需专门处理 count=0 为"玩家决定数量"
      { type: 'DISCARD', count: 0, target: 'SELF' },
    ],
    description: '伤害+1，弃置任意张手牌后抓等量牌',
  },

  // 天邪鬼黄 - 抓牌+2，将1张手牌置于牌库顶
  {
    cardId: 'yokai_006',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '黄魔布局',
    effects: [
      { type: 'DRAW', count: 2 },
      { type: 'PUT_TOP' } as any,
    ],
    description: '抓牌+2，然后将1张手牌置于牌库顶',
  },

  // ===== 3 费妖怪 =====

  // 钟灵 - 抓牌+2，所有玩家交换手牌（顺时针各传1张）
  {
    cardId: 'yokai_007',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '钟声轮转',
    effects: [
      { type: 'DRAW', count: 2 },
      // 交换手牌是多玩家联动，标记为 CUSTOM 由 GameManager 处理
      { type: 'INTERFERE', target: 'ALL_PLAYERS', subEffects: [] },
    ],
    description: '抓牌+2，然后所有玩家顺时针各传递1张手牌',
  },

  // 魅妖 - 使用（打出）1名对手牌库顶的牌（效果照常）
  {
    cardId: 'yokai_008',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '魅惑窃牌',
    effects: [], // 特殊处理：从对手库顶拿1张使用
    description: '打出1名对手牌库顶的牌，效果照常结算',
  },

  // 被服 - 鬼火+1，展示牌库直到合计鬼火≥X
  {
    cardId: 'yokai_009',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '被服覆盖',
    effects: [
      { type: 'GHOST_FIRE', value: 1 },
      // 特殊展示效果，暂留 REVEAL_TOP 作占位
    ],
    description: '鬼火+1，展示牌库直到累计鬼火值等于当前鬼火数',
  },

  // 树妖 - 进入手牌时抓牌+2，打出时抓牌+1
  {
    cardId: 'yokai_010',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '木灵庇护',
    effects: [{ type: 'DRAW', count: 1 }],
    description: '抓牌+1（被弃置进手牌时改为抓牌+2）',
  },

  // 日女巳时 - 三选一：抓牌+2 / 鬼火+2 / 伤害+2
  {
    cardId: 'yokai_011',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '巳时祝福',
    effects: [{
      type: 'CHOICE',
      options: [
        { label: '抓牌+2', effects: [{ type: 'DRAW', count: 2 }] },
        { label: '鬼火+2', effects: [{ type: 'GHOST_FIRE', value: 2 }] },
        { label: '伤害+2', effects: [{ type: 'DAMAGE', value: 2 }] },
      ]
    }],
    description: '选择一项：抓牌+2 / 鬼火+2 / 伤害+2',
  },

  // 蚌精 - 抓牌+1（游戏结束每有此牌得1声誉，声誉已含）
  {
    cardId: 'yokai_012',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '珍珠心愿',
    effects: [{ type: 'DRAW', count: 1 }],
    description: '抓牌+1',
  },

  // 鸣屋 - 若弃牌堆为空则伤害+4，否则伤害+2
  {
    cardId: 'yokai_013',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '空屋鸣响',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'DISCARD_EMPTY', op: '=', value: 1 },
      thenEffects: [{ type: 'DAMAGE', value: 4 }],
      elseEffects: [{ type: 'DAMAGE', value: 2 }],
    }],
    description: '若自己弃牌堆为空：伤害+4，否则伤害+2',
  },

  // 蝶翼 - 伤害+1，抓牌+1
  {
    cardId: 'yokai_014',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '翼展夜巡',
    effects: [
      { type: 'DAMAGE', value: 1 },
      { type: 'DRAW', count: 1 },
    ],
    description: '伤害+1，抓牌+1',
  },

  // 兵主部 - 伤害+2
  {
    cardId: 'yokai_015',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '百鬼统领',
    effects: [{ type: 'DAMAGE', value: 2 }],
    description: '伤害+2',
  },

  // ===== 4 费妖怪 =====

  // 魍魉之匣 - 抓牌+1，伤害+1，【妨害】所有玩家弃牌库顶1张
  {
    cardId: 'yokai_016',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '匣中混沌',
    effects: [
      { type: 'DRAW', count: 1 },
      { type: 'DAMAGE', value: 1 },
      {
        type: 'INTERFERE',
        target: 'ALL_PLAYERS',
        subEffects: [{ type: 'DISCARD', count: 1, random: true }]
      },
    ],
    description: '抓牌+1，伤害+1，【妨害】所有玩家弃牌库顶1张',
  },

  // 骰子鬼 - 超度1张手牌，退治等生命的妖怪
  {
    cardId: 'yokai_017',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '骰命轮回',
    effects: [
      { type: 'EXILE_HAND', count: 1 },
      // KILL_YOKAI 的 maxHp 等于被超度牌的 HP，由 GameManager 动态传入
    ],
    description: '超度1张手牌，退治生命值等于该牌生命的游荡妖怪',
  },

  // 涅槃之火 - 鬼火+1；若本回合打出过御魂，再+1
  {
    cardId: 'yokai_018',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '涅槃重燃',
    effects: [
      { type: 'GHOST_FIRE', value: 1 },
      {
        type: 'CONDITIONAL',
        condition: { key: 'YOKAI_PLAYED_THIS_TURN', op: '>', value: 0 },
        thenEffects: [{ type: 'GHOST_FIRE', value: 1 }],
      },
    ],
    description: '鬼火+1；若本回合打出过御魂牌，再获得鬼火+1',
  },

  // 雪幽魂 - 抓牌+2，【妨害】对手弃牌或获得恶评
  {
    cardId: 'yokai_019',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '寒冬封印',
    effects: [
      { type: 'DRAW', count: 2 },
      {
        type: 'INTERFERE',
        target: 'OTHER_PLAYERS',
        subEffects: [
          // 对手自选：弃1张手牌 or 得1张恶评
          { type: 'DISCARD', count: 1, target: 'SELF' }, // 简化：对手被动弃1张
        ]
      },
    ],
    description: '抓牌+2，【妨害】每名对手弃1张手牌或获得1张恶评（对手选择）',
  },

  // 轮入道 - 再打出1张御魂并让效果执行2次
  {
    cardId: 'yokai_020',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '轮回复制',
    effects: [], // 特殊：打出的下1张御魂效果执行2次，由 GameManager 状态标记处理
    description: '本回合中，你打出的下1张御魂效果额外执行1次',
  },

  // 网切 - 场上所有妖怪生命-1，鬼王生命-2
  {
    cardId: 'yokai_021',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '网罗万灵',
    effects: [], // 全场AOE，GameManager 统一处理
    description: '场上所有妖怪生命-1，鬼王生命-2',
  },

  // 铮 - 抓牌+1，伤害+2
  {
    cardId: 'yokai_022',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '铮鸣斩魄',
    effects: [
      { type: 'DRAW', count: 1 },
      { type: 'DAMAGE', value: 2 },
    ],
    description: '抓牌+1，伤害+2',
  },

  // 薙魂 - 本回合如已打出3张以上御魂，鬼火+2
  {
    cardId: 'yokai_023',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '薙灵收割',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'YOKAI_PLAYED_THIS_TURN', op: '>=', value: 3 },
      thenEffects: [{ type: 'GHOST_FIRE', value: 2 }],
    }],
    description: '若本回合已打出3张或以上御魂（含本张），鬼火+2',
  },

  // ===== 5 费妖怪 =====

  // 狂骨 - 抓牌+1，本回合式神技能额外伤害+2
  {
    cardId: 'yokai_024',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '狂骨附体',
    effects: [
      { type: 'DRAW', count: 1 },
      // 标记本回合式神技能+2，由 GameManager 的 tempBuff 处理
    ],
    description: '抓牌+1，本回合你使用式神技能时额外伤害+2',
  },

  // 返魂香 - 抓牌+2，【妨害】每名对手弃2张手牌
  {
    cardId: 'yokai_025',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '返魂禁香',
    effects: [
      { type: 'DRAW', count: 2 },
      {
        type: 'INTERFERE',
        target: 'OTHER_PLAYERS',
        subEffects: [{ type: 'DISCARD', count: 2, target: 'SELF', random: false }]
      },
    ],
    description: '抓牌+2，【妨害】每名对手弃置2张手牌',
  },

  // 镇墓兽 - 抓牌+1，伤害+2，鬼火+2
  {
    cardId: 'yokai_026',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '墓守怒吼',
    effects: [
      { type: 'DRAW', count: 1 },
      { type: 'DAMAGE', value: 2 },
      { type: 'GHOST_FIRE', value: 2 },
    ],
    description: '抓牌+1，伤害+2，鬼火+2',
  },

  // 针女 - 抓牌+3，然后弃置1张手牌换伤害+2
  {
    cardId: 'yokai_027',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '针刺诅咒',
    effects: [
      { type: 'DRAW', count: 3 },
      { type: 'DISCARD', count: 1, target: 'SELF' }, // 弃置后获得伤害+2
      { type: 'DAMAGE', value: 2 },
    ],
    description: '抓牌+3，弃置1张手牌，然后伤害+2',
  },

  // 心眼 - 伤害+3
  {
    cardId: 'yokai_028',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '心眼洞察',
    effects: [{ type: 'DAMAGE', value: 3 }],
    description: '伤害+3',
  },

  // 涂佛 - 从弃牌堆取回至多3张阴阳术（置于手牌）
  {
    cardId: 'yokai_029',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '涂佛苏醒',
    effects: [], // 特殊：从弃牌区回收阴阳术，由 GameManager 处理
    description: '从你的弃牌堆取回至多3张阴阳术，置入手牌',
  },

  // 地藏像 - 抓牌+1（游戏结束每8张池牌额外+1声誉，声誉已由 charm 体现）
  {
    cardId: 'yokai_030',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '地藏庇护',
    effects: [{ type: 'DRAW', count: 1 }],
    description: '抓牌+1',
  },

  // ===== 6 费妖怪 =====

  // 飞缘魔 - 使用牌库顶的鬼王牌（若有）
  {
    cardId: 'yokai_031',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '飞缘召唤',
    effects: [], // 特殊：拿牌库顶的鬼王牌直接使用，GameManager 处理
    description: '使用你牌库顶1张鬼王牌的效果（若为鬼王牌则触发）',
  },

  // 破势 - 伤害+4；首次攻击掷骰得额外鬼火
  {
    cardId: 'yokai_032',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '破势冲锋',
    effects: [
      { type: 'DAMAGE', value: 4 },
      // 掷骰为游戏物理逻辑，暂不在引擎内处理
    ],
    description: '伤害+4（如为本回合首次攻击，可掷1颗鬼火骰获得额外鬼火）',
  },

  // 镜姬 - 抓牌+2，伤害+1，鬼火+2
  {
    cardId: 'yokai_033',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '镜中魔影',
    effects: [
      { type: 'DRAW', count: 2 },
      { type: 'DAMAGE', value: 1 },
      { type: 'GHOST_FIRE', value: 2 },
    ],
    description: '抓牌+2，伤害+1，鬼火+2',
  },

  // 木魅 - 展示牌库直到翻出2张鬼火牌（放入手牌）
  {
    cardId: 'yokai_034',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '木魅寻宝',
    effects: [], // 特殊展示逻辑，GameManager 处理
    description: '展示自己牌库，直到翻出2张鬼火牌并置入手牌',
  },

  // ===== 7 费妖怪 =====

  // 幽谷响 - 使用所有对手牌库顶牌
  {
    cardId: 'yokai_035',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '谷响回鸣',
    effects: [], // 特殊：从每名对手库顶取牌使用，GameManager 处理
    description: '使用所有对手牌库顶1张牌的效果',
  },

  // 伤魂鸟 - 超度手牌，退治等生命目标
  {
    cardId: 'yokai_036',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '伤魂裂啼',
    effects: [
      { type: 'EXILE_HAND', count: 1 },
      // KILL_YOKAI 的 maxHp 等于被超度牌的 HP，GameManager 动态传入
    ],
    description: '超度1张手牌，退治场上生命值恰好等于该牌生命的游荡妖怪',
  },

  // 阴摩罗 - 超度1张，退治生命+3以内
  {
    cardId: 'yokai_037',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '阴摩索魂',
    effects: [
      { type: 'EXILE_HAND', count: 1 },
      // KILL_YOKAI maxHp = exiledCard.hp + 3，GameManager 动态传入
    ],
    description: '超度1张手牌，退治生命不高于（该牌生命+3）的游荡妖怪',
  },

  // ===== 8 费妖怪 =====

  // 青女房 - 获得1张「火灵」符文牌置于牌库顶
  {
    cardId: 'yokai_038',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '青女降霜',
    effects: [{ type: 'GAIN_SPELL', tier: 'medium' }],
    description: '获得1张中级符咒并置于你的牌库顶',
  },

  // 三味 - 鬼火+2；本回合每使用1张鬼火牌额外+2鬼火
  {
    cardId: 'yokai_039',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '三味共鸣',
    effects: [
      { type: 'GHOST_FIRE', value: 2 },
      // 额外效果：本回合鬼火卡+2 bonus，标记在 GameManager tempBuff
    ],
    description: '鬼火+2，本回合你每使用1张鬼火相关牌额外获得鬼火+2',
  },
];

/** 根据 cardId 获取妖怪效果定义 */
export function getYokaiEffectDef(cardId: string): CardEffectDef | undefined {
  return YOKAI_EFFECT_DEFS.find(d => d.cardId === cardId);
}