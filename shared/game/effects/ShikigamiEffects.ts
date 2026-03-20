/**
 * 御魂传说 - 式神效果数据 v2
 * @file shared/game/effects/ShikigamiEffects.ts
 *
 * 29 张式神的效果定义（每张式神可有多个 CardEffectDef）
 * 数据来源：202005_阴阳师+桌游+游戏反馈.xlsx「式神」sheet
 */

import type { CardEffectDef } from './types';

export const SHIKIGAMI_EFFECT_DEFS: CardEffectDef[] = [

  // ===== SSR 式神 =====

  // 妖刀姬「杀戮」
  // 【启】鬼火-2：抓牌+1，伤害+1。可额外鬼火-1，重复一次效果。
  {
    cardId: 'shikigami_001',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '杀戮',
    cost: { ghostFire: 2 },
    effects: [
      { type: 'DRAW', count: 1 },
      { type: 'DAMAGE', value: 1 },
      // 额外支付鬼火-1 可再触发：由 GameManager 处理"可选重复"逻辑
    ],
    description: '【启】鬼火-2：抓牌+1，伤害+1。可额外鬼火-1，重复一次效果',
  },

  // 大天狗「羽刃暴风」
  // 【启】鬼火-2：本回合中选择1个目标。当你对其他目标造成N伤害时，对选定目标造成N-2伤害。
  {
    cardId: 'shikigami_002',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '羽刃暴风',
    cost: { ghostFire: 2 },
    effects: [],
    // 需要 GameManager 在当前回合维护"联动目标"状态，后续伤害触发时额外结算
    description: '【启】鬼火-2：选1个目标，本回合对其他目标造成N点伤害时，对该目标额外造成N-2点伤害',
  },

  // 酒吞童子「酒葫芦」
  // 【启】鬼火-2：超度1张手牌，放置1枚「酒气」（上限3）
  // 【启】移除N枚「酒气」：伤害+N
  {
    cardId: 'shikigami_003',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '酒葫芦·储酒',
    cost: { ghostFire: 2 },
    effects: [
      { type: 'EXILE_HAND', count: 1 },
      { type: 'MARKER_ADD', markerKey: 'sake', count: 1, max: 3 },
    ],
    description: '【启】鬼火-2：超度1张手牌，放置1枚「酒气」指示物（上限3）',
  },
  {
    cardId: 'shikigami_003',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '酒葫芦·释放',
    cost: { ghostFire: 0 },
    effects: [
      // 消耗N枚酒气换N点伤害：由 GameManager 动态确定N
      { type: 'MARKER_REMOVE', markerKey: 'sake', count: 'ALL' },
      // 伤害=移除数量，GameManager 在执行前读取标记数
    ],
    description: '【启】移除N枚「酒气」指示物：伤害+N',
  },

  // 茨木童子「迁怒」
  // 【启】鬼火-2：本回合每超度或退治1个妖怪，获得伤害+2
  {
    cardId: 'shikigami_004',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '迁怒',
    cost: { ghostFire: 2 },
    effects: [],
    // GameManager 设置 tempBuff: 每次超度/退治 +2 damage
    description: '【启】鬼火-2：本回合你每超度或退治1个妖怪，获得伤害+2',
  },

  // 花鸟卷「画境」
  // 【自】受妨害时鬼火-1：抓牌+2，置顶1张手牌，然后结算妨害
  // 【启】鬼火-2：抓牌+3，然后将1张手牌置于牌库底
  {
    cardId: 'shikigami_005',
    effectType: '自',
    trigger: 'ON_INTERFERE',
    skillName: '画境·护符',
    cost: { ghostFire: 1 },
    effects: [
      { type: 'DRAW', count: 2 },
      { type: 'PUT_TOP' } as any,
    ],
    description: '【自】受到妨害效果时，鬼火-1：抓牌+2，将1张手牌置于牌库顶，然后结算妨害',
  },
  {
    cardId: 'shikigami_005',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '画境·探索',
    cost: { ghostFire: 2 },
    effects: [
      { type: 'DRAW', count: 3 },
      { type: 'PUT_BOTTOM' } as any,
    ],
    description: '【启】鬼火-2：抓牌+3，然后将1张手牌置于牌库底',
  },

  // ===== SR 式神 =====

  // 书翁「万象之书」
  // 【启】鬼火-N：伤害+N+1（N不能为0）
  {
    cardId: 'shikigami_007',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '万象之书',
    cost: { ghostFire: 1 },
    effects: [
      // 伤害 = N + 1，其中 N 为玩家自定义的鬼火消耗量
      // GameManager 需在执行前询问 N
    ],
    description: '【启】鬼火-N（N≥1）：伤害+N+1',
  },

  // 百目鬼「诅咒之眼」
  // 【启】[妨害] 鬼火-1：所有玩家弃置1张手牌，然后你抓牌+1
  {
    cardId: 'shikigami_008',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '诅咒之眼',
    cost: { ghostFire: 1 },
    effects: [
      {
        type: 'INTERFERE',
        target: 'ALL_PLAYERS',
        subEffects: [{ type: 'DISCARD', count: 1, random: false, target: 'SELF' }],
      },
      { type: 'DRAW', count: 1 },
    ],
    description: '【启】[妨害] 鬼火-1：所有玩家弃置1张手牌，然后你抓牌+1',
  },

  // 鬼使白「魂狩」
  // 【启】鬼火-1：本回合首次退治生命≤6的妖怪时，可置入手牌
  {
    cardId: 'shikigami_009',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '魂狩',
    cost: { ghostFire: 1 },
    effects: [
      // 效果：标记"本回合首次退治生命≤6妖怪时，可将其置入手牌而非弃牌堆"
      // 通过 GameManager tempBuff 记录
    ],
    description: '【启】鬼火-1：本回合首次退治生命值不高于6的妖怪时，可将其置入手牌',
  },

  // 般若「嫉恨之心」
  // 【启】[妨害] 鬼火-1：所有玩家弃置牌库顶牌，你可以将自己弃置的牌置入手牌或超度
  {
    cardId: 'shikigami_010',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '嫉恨之心',
    cost: { ghostFire: 1 },
    effects: [
      {
        type: 'INTERFERE',
        target: 'OTHER_PLAYERS',
        subEffects: [{ type: 'DISCARD', count: 1, random: true }],
      },
      // 自己也弃置牌库顶1张，然后可选：置入手牌 or 超度
      { type: 'DISCARD', count: 1, random: true, target: 'SELF' },
      {
        type: 'CHOICE',
        options: [
          { label: '置入手牌', effects: [] }, // GameManager 需将刚弃的牌移回手牌
          { label: '超度该牌', effects: [] }, // GameManager 需将刚弃的牌移入 exiled
        ],
      },
    ],
    description: '【启】[妨害] 鬼火-1：所有玩家弃置牌库顶1张，你可以将自己弃置的牌置入手牌或超度',
  },

  // 追月神「明月潮升」
  // 【触】回合中因卡牌效果抓牌达到3张时，可选：鬼火+1 / 伤害+1 / 超度1张手牌
  {
    cardId: 'shikigami_011',
    effectType: '触',
    trigger: 'ON_DRAW',
    skillName: '明月潮升',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'CARDS_PLAYED_THIS_TURN', op: '>=', value: 3 },
      thenEffects: [{
        type: 'CHOICE',
        options: [
          { label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] },
          { label: '伤害+1', effects: [{ type: 'DAMAGE', value: 1 }] },
          { label: '超度1张手牌', effects: [{ type: 'EXILE_HAND', count: 1 }] },
        ],
      }],
    }],
    description: '【触】回合中因卡牌效果抓牌累计达到3张时，可选：鬼火+1 / 伤害+1 / 超度1张手牌',
  },

  // 白狼「冥想」
  // 【启】鬼火-1，弃置N张手牌：伤害+N
  {
    cardId: 'shikigami_012',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '冥想',
    cost: { ghostFire: 1 },
    effects: [
      { type: 'DISCARD', count: 0, target: 'SELF' }, // count=0 表示玩家自定义数量
      // 伤害 = 弃置数，GameManager 动态结算
    ],
    description: '【启】鬼火-1，弃置N张手牌：伤害+N',
  },

  // 食梦貘「沉睡」
  // 【启】鬼火-1：抓牌+4，立即结束行动并跳过弃牌与补牌阶段，进入[沉睡]状态
  // 【触】在[沉睡]状态下受到妨害时，先弃置1张手牌
  {
    cardId: 'shikigami_013',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '沉睡·入眠',
    cost: { ghostFire: 1 },
    effects: [
      { type: 'DRAW', count: 4 },
      { type: 'SKIP_CLEANUP' } as any,
      { type: 'MARKER_ADD', markerKey: 'sleep', count: 1 },
    ],
    description: '【启】鬼火-1：抓牌+4，立即结束行动并跳过弃牌与补牌阶段，进入[沉睡]状态',
  },
  {
    cardId: 'shikigami_013',
    effectType: '触',
    trigger: 'ON_INTERFERE',
    skillName: '沉睡·梦护',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'MARKER_COUNT', markerKey: 'sleep', op: '>', value: 0 },
      thenEffects: [{ type: 'DISCARD', count: 1, target: 'SELF', random: false }],
    }],
    description: '【触】在[沉睡]状态下受到妨害效果时，先弃置1张手牌',
  },

  // ===== R 式神 =====

  // 鲤鱼精「泡泡之盾」
  // 【自】回合内首次退治妖怪或鬼王时，可将其放置在牌库顶
  {
    cardId: 'shikigami_015',
    effectType: '自',
    trigger: 'ON_KILL_YOKAI',
    skillName: '泡泡之盾',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'YOKAI_PLAYED_THIS_TURN', op: '=', value: 1 }, // 首次
      thenEffects: [{ type: 'PUT_TOP' } as any],
    }],
    description: '【自】回合内首次退治妖怪或鬼王时，可将其放置在你的牌库顶',
  },

  // 萤草「生花」
  // 【启】鬼火-1或弃置1张妖怪牌：放置1枚「祝福种子」（各1次）
  // 【触】回合开始时可移除所有「种子」，每移除1枚：抓牌+1或伤害+1
  // 【触】受妨害时移除1枚种子，若移除则不受妨害
  {
    cardId: 'shikigami_016',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '生花·播种',
    cost: { ghostFire: 1 },
    effects: [{ type: 'MARKER_ADD', markerKey: 'seed', count: 1 }],
    description: '【启】鬼火-1：放置1枚「祝福种子」（本回合限1次）',
  },
  {
    cardId: 'shikigami_016',
    effectType: '触',
    trigger: 'ON_TURN_START',
    skillName: '生花·开花',
    effects: [{
      type: 'CHOICE',
      options: [
        { label: '移除所有种子：每枚抓牌+1', effects: [
          { type: 'MARKER_REMOVE', markerKey: 'seed', count: 'ALL' },
          { type: 'DRAW', count: 1 }, // count 由 GameManager 乘以种子数
        ]},
        { label: '移除所有种子：每枚伤害+1', effects: [
          { type: 'MARKER_REMOVE', markerKey: 'seed', count: 'ALL' },
          { type: 'DAMAGE', value: 1 }, // value 由 GameManager 乘以种子数
        ]},
        { label: '保留种子', effects: [] },
      ],
    }],
    description: '【触】回合开始时可移除所有「祝福种子」，每枚：抓牌+1或伤害+1',
  },
  {
    cardId: 'shikigami_016',
    effectType: '触',
    trigger: 'ON_INTERFERE',
    skillName: '生花·护盾',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'MARKER_COUNT', markerKey: 'seed', op: '>', value: 0 },
      thenEffects: [{ type: 'MARKER_REMOVE', markerKey: 'seed', count: 1 }],
      // elseEffects: 正常结算妨害（由调用者控制）
    }],
    description: '【触】受到妨害效果时，移除1枚「祝福种子」，若成功则不受妨害效果影响',
  },

  // 独眼小僧「金刚经」
  // 【永】你的回合外，所有生命低于5的妖怪生命+1
  {
    cardId: 'shikigami_019',
    effectType: '永',
    trigger: 'PASSIVE',
    skillName: '金刚经',
    effects: [], // 被动效果，GameManager 在回合结束时检查并执行
    description: '【永】在非你的回合结束时，场上所有生命值低于5的游荡妖怪生命+1',
  },

  // 食发鬼「真实之颜」
  // 【启】鬼火-1：选择至多3个场上妖怪置于妖怪牌库底，立刻补充妖怪且其生命-1
  {
    cardId: 'shikigami_020',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '真实之颜',
    cost: { ghostFire: 1 },
    effects: [
      // 选择至多3个妖怪并刷新，GameManager 处理槽位补充与-1生命
      { type: 'KILL_YOKAI', maxHp: 999 }, // 可退治任意妖怪（送回底部）
    ],
    description: '【启】鬼火-1：将场上至多3个游荡妖怪置于牌库底，立即补充新妖怪且其生命-1',
  },

  // 巫蛊师「迷魂蛊」
  // 【触】当你超度1张手牌时，鬼火-1：令1名对手展示手牌，用1张牌交换其中1张（生命差≤2）
  {
    cardId: 'shikigami_021',
    effectType: '触',
    trigger: 'ON_EXILE',
    skillName: '迷魂蛊',
    cost: { ghostFire: 1 },
    effects: [],
    // 复杂的展示+交换逻辑，由 GameManager 处理
    description: '【触】当你超度1张手牌时，鬼火-1：令1名对手展示手牌并用1张牌交换其中1张（生命差≤2）',
  },

  // 山童「怪力」
  // 【启】鬼火-1：本回合中你使用的前2张阴阳术额外伤害+1
  {
    cardId: 'shikigami_022',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '怪力',
    cost: { ghostFire: 1 },
    effects: [],
    // GameManager 设置 tempBuff: 前2张阴阳术 +1 damage
    description: '【启】鬼火-1：本回合你使用的前2张阴阳术额外伤害+1',
  },

  // 丑时之女「草人替身」
  // 【触】本回合首次进行妨害时，抓牌+1
  // 【启】[妨害] 鬼火-2：选1张手牌给1名对手，其他对手各得1张「恶评」
  {
    cardId: 'shikigami_023',
    effectType: '触',
    trigger: 'ON_PLAY',
    skillName: '草人替身·触',
    effects: [{
      type: 'CONDITIONAL',
      condition: { key: 'IS_FIRST_CARD', op: '=', value: 1 },
      thenEffects: [{ type: 'DRAW', count: 1 }],
    }],
    description: '【触】本回合首次进行妨害时，抓牌+1',
  },
  {
    cardId: 'shikigami_023',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '草人替身·替换',
    cost: { ghostFire: 2 },
    effects: [
      // 将1张手牌给指定对手，其他对手各得恶评
      { type: 'GAIN_PENALTY', penaltyType: 'farmer', target: 'OTHER_PLAYERS' },
    ],
    description: '【启】[妨害] 鬼火-2：选1张手牌给1名对手，其他对手各获得1张「恶评」',
  },

  // 三尾狐「诱惑」
  // 【永】回合内首次对非女性目标造成的伤害+1（娱乐向）
  {
    cardId: 'shikigami_025',
    effectType: '永',
    trigger: 'PASSIVE',
    skillName: '诱惑',
    effects: [{ type: 'DAMAGE', value: 1 }],
    description: '【永】回合内首次对非女性目标造成的伤害+1',
  },

  // 青蛙瓷器「岭上开花」
  // 【启】鬼火-1：投掷1颗鬼火骰，若结果为4-5或鬼面，则伤害+2
  {
    cardId: 'shikigami_026',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '岭上开花',
    cost: { ghostFire: 1 },
    effects: [
      // 掷骰逻辑由 GameManager 执行，结果为 4/5/6 时 DAMAGE+2
      {
        type: 'CONDITIONAL',
        condition: { key: 'GHOST_FIRE', op: '>=', value: 0 }, // placeholder
        thenEffects: [{ type: 'DAMAGE', value: 2 }],
      },
    ],
    description: '【启】鬼火-1：投掷1颗鬼火骰，结果为4-5或鬼面则伤害+2',
  },

  // 铁鼠「横财护身」
  // 【启】[妨害] 鬼火-2：每名对手弃置牌库顶2张，若含阴阳术则可取1张置入弃牌区
  {
    cardId: 'shikigami_027',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '横财护身',
    cost: { ghostFire: 2 },
    effects: [
      {
        type: 'INTERFERE',
        target: 'OTHER_PLAYERS',
        subEffects: [{ type: 'DISCARD', count: 2, random: true, target: 'SELF' }],
      },
      // 若弃置中含阴阳术：可取1张进自己弃牌区，GameManager 处理
    ],
    description: '【启】[妨害] 鬼火-2：每名对手弃置牌库顶2张，若其中含阴阳术，你可取1张置入自己弃牌堆',
  },

  // 座敷童子「魂之火」
  // 【启】弃置1张妖怪牌：鬼火+1
  {
    cardId: 'shikigami_028',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '魂之火',
    effects: [
      { type: 'DISCARD', count: 1, target: 'SELF', random: false },
      // 只有弃置妖怪牌才能触发 +1 鬼火，GameManager 验证弃置的牌类型
      { type: 'GHOST_FIRE', value: 1 },
    ],
    description: '【启】弃置1张妖怪牌（御魂）：鬼火+1',
  },

  // 山兔「兔子舞」
  // 【启】鬼火-1：抓牌+1，然后弃置1张牌。若弃置了妖怪牌，则伤害+1
  {
    cardId: 'shikigami_029',
    effectType: '启',
    trigger: 'ON_PLAY',
    skillName: '兔子舞',
    cost: { ghostFire: 1 },
    effects: [
      { type: 'DRAW', count: 1 },
      { type: 'DISCARD', count: 1, target: 'SELF', random: false },
      // 若弃的是妖怪牌则 +1 伤害，GameManager 检验弃置类型后补充 DAMAGE
    ],
    description: '【启】鬼火-1：抓牌+1，然后弃置1张牌。若弃置的是妖怪牌（御魂），则伤害+1',
  },
];

/** 根据 cardId 获取式神所有效果定义（可能有多个，例如酒吞的两个技能） */
export function getShikigamiEffectDefs(cardId: string): CardEffectDef[] {
  return SHIKIGAMI_EFFECT_DEFS.filter(d => d.cardId === cardId);
}

/** 根据 cardId + skillName 获取特定技能定义 */
export function getShikigamiSkill(cardId: string, skillName: string): CardEffectDef | undefined {
  return SHIKIGAMI_EFFECT_DEFS.find(d => d.cardId === cardId && d.skillName === skillName);
}
