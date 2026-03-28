/**
 * 妖怪御魂效果测试 - HP6+ (伤魂鸟~幽谷响)
 * 包含: 伤魂鸟、青女房、三味、雪幽魂、轮入道、阴摩罗、薙魂、飞缘魔、木魅、幽谷响
 */

import { describe, it, expect, beforeEach } from 'vitest';
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


// 生命7 妖怪测试
// ============================================
describe('伤魂鸟', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('超度X张，伤害+2X', async () => {
    player.hand = [
      createTestCard('spell', '牌1'),
      createTestCard('spell', '牌2'),
      createTestCard('spell', '牌3')
    ];

    const result = await executeYokaiEffect('伤魂鸟', {
      player, gameState,
      card: createTestCard('yokai', '伤魂鸟'),
      onSelectCards: async (cards) => cards.slice(0, 2).map(c => c.instanceId)
    });

    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(2);
    expect(player.damage).toBe(4); // 2 * 2
  });

  it('没有手牌时无伤害', async () => {
    player.hand = [];

    const result = await executeYokaiEffect('伤魂鸟', {
      player, gameState, card: createTestCard('yokai', '伤魂鸟')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(0);
  });

  // 边界测试：两次独立超度
  it('🔴 两次使用伤魂鸟，各自独立超度和计算伤害', async () => {
    // 准备6张手牌
    player.hand = [
      createTestCard('spell', '牌1'),
      createTestCard('spell', '牌2'),
      createTestCard('spell', '牌3'),
      createTestCard('spell', '牌4'),
      createTestCard('spell', '牌5'),
      createTestCard('spell', '牌6')
    ];
    
    // 第一次超度2张
    const result1 = await executeYokaiEffect('伤魂鸟', {
      player, gameState,
      card: createTestCard('yokai', '伤魂鸟'),
      onSelectCards: async (cards) => cards.slice(0, 2).map(c => c.instanceId)
    });
    
    expect(result1.success).toBe(true);
    expect(player.exiled.length).toBe(2);
    expect(player.damage).toBe(4); // 2 * 2
    expect(player.hand.length).toBe(4);
    
    // 第二次超度3张
    const result2 = await executeYokaiEffect('伤魂鸟', {
      player, gameState,
      card: createTestCard('yokai', '伤魂鸟'),
      onSelectCards: async (cards) => cards.slice(0, 3).map(c => c.instanceId)
    });
    
    expect(result2.success).toBe(true);
    expect(player.exiled.length).toBe(5); // 2 + 3
    expect(player.damage).toBe(10); // 4 + 6 (3*2)
    expect(player.hand.length).toBe(1);
  });
  
  it('🔴 可以选择超度0张牌（不增加伤害）', async () => {
    player.hand = [
      createTestCard('spell', '牌1'),
      createTestCard('spell', '牌2')
    ];
    
    const result = await executeYokaiEffect('伤魂鸟', {
      player, gameState,
      card: createTestCard('yokai', '伤魂鸟'),
      onSelectCards: async () => [] // 选择0张
    });
    
    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(0);
    expect(player.damage).toBe(0);
    expect(player.hand.length).toBe(2); // 手牌不变
  });
});

// ============================================
// 生命8 妖怪测试
// ============================================
describe('青女房', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('抓牌+2，鬼火+1', async () => {
    const result = await executeYokaiEffect('青女房', {
      player, gameState, card: createTestCard('yokai', '青女房')
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(2);
    expect(player.ghostFire).toBe(3);
  });
});

describe('三味', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('添加阴阳术伤害buff', async () => {
    const result = await executeYokaiEffect('三味', {
      player, gameState, card: createTestCard('yokai', '三味')
    });

    expect(result.success).toBe(true);
    const buff = player.tempBuffs.find(b => (b as any).source === '三味');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(2);
  });
  
  it('本回合已使用阴阳术时，立即获得伤害加成', async () => {
    // 设置已打出区有2张阴阳术
    (player as any).played = [
      { ...createTestCard('spell', '基础术式'), cardType: 'spell' },
      { ...createTestCard('spell', '中级符咒'), cardType: 'spell' },
    ];
    player.damage = 0;
    
    const result = await executeYokaiEffect('三味', {
      player, gameState, card: createTestCard('yokai', '三味')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(4); // 2张阴阳术 × 2伤害 = +4
    expect(result.damage).toBe(4);
  });
  
  it('本回合已使用鬼火牌时，也计入伤害加成', async () => {
    // 设置已打出区有1张鬼火牌（灯笼鬼）
    (player as any).played = [
      { ...createTestCard('yokai', '灯笼鬼'), cardType: 'yokai', tags: ['鬼火'] },
    ];
    player.damage = 0;
    
    const result = await executeYokaiEffect('三味', {
      player, gameState, card: createTestCard('yokai', '三味')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2); // 1张鬼火牌 × 2伤害 = +2
  });
  
  it('混合统计阴阳术和鬼火牌', async () => {
    // 设置已打出区：1张阴阳术 + 1张鬼火牌
    (player as any).played = [
      { ...createTestCard('spell', '基础术式'), cardType: 'spell' },
      { ...createTestCard('yokai', '涅槃之火'), cardType: 'yokai', subtype: '御魂/鬼火' },
    ];
    player.damage = 0;
    
    const result = await executeYokaiEffect('三味', {
      player, gameState, card: createTestCard('yokai', '三味')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(4); // 2张 × 2伤害 = +4
  });
  
  it('无已使用牌时，仅添加buff无即时伤害', async () => {
    (player as any).played = [];
    player.damage = 0;
    
    const result = await executeYokaiEffect('三味', {
      player, gameState, card: createTestCard('yokai', '三味')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(0); // 无即时伤害
    // 但buff仍然添加
    const buff = player.tempBuffs.find(b => (b as any).source === '三味');
    expect(buff).toBeDefined();
  });
});

// ============================================
// 雪幽魂测试
// ============================================
describe('雪幽魂', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.id = 'player1';
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    
    opponent = createTestPlayer();
    opponent.id = 'opponent1';
    opponent.hand = [];
    
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
    
    // 初始化恶评牌库
    gameState.field.penaltyPile = [
      {
        instanceId: 'penalty_1',
        cardId: 'penalty_001',
        cardType: 'penalty',
        name: '农夫',
        hp: 0,
        maxHp: 0
      }
    ];
  });

  it('🟢 正常流程：打出者抓牌+1', async () => {
    const initialHandCount = player.hand.length;
    const initialDeckCount = player.deck.length;
    
    const result = await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(initialHandCount + 1);
    expect(player.deck.length).toBe(initialDeckCount - 1);
  });

  it('🟢 对手无恶评时，获得1张恶评到弃牌堆', async () => {
    opponent.hand = [];
    opponent.discard = [];
    const penaltyPileCount = gameState.field.penaltyPile!.length;
    
    await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    // 【获得】规则：恶评进入对手弃牌堆
    expect(opponent.hand.length).toBe(0); // 手牌不变
    expect(opponent.discard.length).toBe(1); // 弃牌堆+1
    expect(opponent.discard[0]!.cardType).toBe('penalty');
    expect(gameState.field.penaltyPile!.length).toBe(penaltyPileCount - 1);
  });

  it('🟢 对手有1张恶评时，自动弃置该恶评', async () => {
    const existingPenalty: CardInstance = {
      instanceId: 'existing_penalty',
      cardId: 'penalty_001',
      cardType: 'penalty',
      name: '农夫',
      hp: 0,
      maxHp: 0
    };
    opponent.hand = [existingPenalty];
    
    await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    // 恶评从手牌移动到弃牌堆
    expect(opponent.hand.length).toBe(0);
    expect(opponent.discard.length).toBe(1);
    expect(opponent.discard[0]!.instanceId).toBe('existing_penalty');
  });

  it('🟢 对手有多张恶评时，AI优先弃置农夫', async () => {
    const farmer: CardInstance = {
      instanceId: 'farmer_1',
      cardId: 'penalty_001',
      cardType: 'penalty',
      name: '农夫',
      hp: 0,
      maxHp: 0
    };
    const samurai: CardInstance = {
      instanceId: 'samurai_1',
      cardId: 'penalty_002',
      cardType: 'penalty',
      name: '武士',
      hp: 0,
      maxHp: 0
    };
    opponent.hand = [samurai, farmer]; // 武士在前，农夫在后
    
    await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    // AI应弃置农夫（惩罚更低）
    expect(opponent.hand.length).toBe(1);
    expect(opponent.hand[0]!.cardId).toBe('penalty_002'); // 武士保留
    expect(opponent.discard[0]!.cardId).toBe('penalty_001'); // 农夫被弃置
  });

  it('🟢 恶评牌库耗尽时，创建农夫（无限供应）', async () => {
    opponent.hand = [];
    opponent.discard = [];
    gameState.field.penaltyPile = []; // 恶评牌库为空
    
    await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    // 仍然获得农夫（进入弃牌堆）
    expect(opponent.discard.length).toBe(1);
    expect(opponent.discard[0]!.cardType).toBe('penalty');
    expect(opponent.discard[0]!.name).toBe('农夫');
  });

  it('🟢 多名对手都被处理', async () => {
    const opponent2 = createTestPlayer();
    opponent2.id = 'opponent2';
    opponent2.hand = [];
    opponent2.discard = [];
    opponent.discard = [];
    gameState.players = [player, opponent, opponent2];
    
    // 添加足够的恶评牌
    gameState.field.penaltyPile = [
      { instanceId: 'p1', cardId: 'penalty_001', cardType: 'penalty', name: '农夫', hp: 0, maxHp: 0 },
      { instanceId: 'p2', cardId: 'penalty_001', cardType: 'penalty', name: '农夫', hp: 0, maxHp: 0 }
    ];
    
    await executeYokaiEffect('雪幽魂', {
      player, gameState,
      card: createTestCard('yokai', '雪幽魂')
    });
    
    // 两名对手都获得恶评（进入弃牌堆）
    expect(opponent.discard.length).toBe(1);
    expect(opponent2.discard.length).toBe(1);
    expect(opponent.discard[0]!.cardType).toBe('penalty');
    expect(opponent2.discard[0]!.cardType).toBe('penalty');
  });
});

// ============================================
// 新增测试：修复后的完整逻辑验证
// ============================================
describe('轮入道（递归执行）', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell'), createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('弃置兵主部，执行两次伤害+2 = 总伤害+4', async () => {
    const heizu = createTestCard('yokai', '兵主部');
    heizu.hp = 3;
    player.hand = [heizu];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(4);
    expect(player.discard.length).toBe(1);
    expect(player.hand.length).toBe(0);
  });

  it('弃置蝠翼，执行两次抓牌+1/伤害+1 = 总抓牌+2/伤害+2', async () => {
    const fuyi = createTestCard('yokai', '蝠翼');
    fuyi.hp = 3;
    player.hand = [fuyi];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2);
    expect(player.hand.length).toBe(2);
  });

  it('没有符合条件的御魂时失败', async () => {
    player.hand = [createTestCard('spell', '阴阳术')];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道')
    });

    expect(result.success).toBe(false);
  });

  // ========== 轮入道验收测试 ==========
  
  it('🟢 弃置日女巳时，两次可做不同选择', async () => {
    const nvshishi = createTestCard('yokai', '日女巳时');
    nvshishi.hp = 3;
    player.hand = [nvshishi];
    player.ghostFire = 2;
    player.damage = 0;
    
    let callCount = 0;
    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId],
      onChoice: async (options) => {
        callCount++;
        if (callCount === 1) return 0; // 第一次选择鬼火+1
        return options.length - 1;      // 第二次选择伤害+2
      }
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
    expect(player.ghostFire).toBe(3); // 原2 + 1
    expect(player.damage).toBe(2);    // +2
  });

  it('🟢 弃置涅槃之火，减费效果叠加两次', async () => {
    const nirvana = createTestCard('yokai', '涅槃之火');
    nirvana.hp = 4;
    player.hand = [nirvana];
    player.tempBuffs = [];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    // 涅槃之火效果：技能费用-1（执行两次 → 叠加两个buff）
    const costReductions = player.tempBuffs.filter(b => b.type === 'SKILL_COST_REDUCTION');
    expect(costReductions.length).toBe(2); // 两次减费buff
  });

  it('🟢 弃置网切，HP减少效果不重复叠加（状态覆盖）', async () => {
    const wangqie = createTestCard('yokai', '网切');
    wangqie.hp = 4;
    player.hand = [wangqie];
    
    // 场上放置妖怪
    const fieldYokai = createTestCard('yokai', '灯笼鬼');
    fieldYokai.hp = 4;
    gameState.field.yokaiSlots = [fieldYokai, null, null, null, null, null];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    // 网切效果：在field.tempBuffs设置NET_CUTTER_HP_REDUCTION
    // 执行两次但覆盖不叠加，仍只有1个buff
    const netCutterBuffs = (gameState.field.tempBuffs as any[] || []).filter(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(netCutterBuffs.length).toBe(1);  // 覆盖不叠加
    expect(netCutterBuffs[0].yokaiHpModifier).toBe(-1);  // 妖怪HP-1
    expect(netCutterBuffs[0].bossHpModifier).toBe(-2);   // 鬼王HP-2
  });

  it('🟢 弃置生命正好为6的御魂', async () => {
    const yokai6hp = createTestCard('yokai', '镜姬');
    yokai6hp.hp = 6;
    player.hand = [yokai6hp];
    // 镜姬效果：抓牌+2，执行两次共抓4张。需要deck有足够的牌，避免洗discard时镜姬被重新抓回手牌
    player.deck = [
      createTestCard('spell'), createTestCard('spell'),
      createTestCard('spell'), createTestCard('spell'),
      createTestCard('spell')
    ];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    // 镜姬被弃置后，执行效果期间deck足够，不会触发洗牌
    // 镜姬应已从手牌移出（弃置时移出）
    // 注意：镜姬可能在discard中，也可能因drawCards被洗入deck再被抓到hand
    // 这里只验证"弃置操作发生了"：discard中应当包含过镜姬，或hand中不含镜姬的原始实例
    const originalId = yokai6hp.instanceId;
    // 验证镜姬不再以原始实例留在手牌中（被弃置操作splice了）
    // 由于deck足够5张，两次抓2张后deck还剩1张，不会洗discard
    expect(player.discard.some(c => c.instanceId === originalId)).toBe(true);
    expect(player.hand.some(c => c.instanceId === originalId)).toBe(false);
  });

  it('🔴 生命>6的御魂不能被选择', async () => {
    const yokai7hp = createTestCard('yokai', '幽谷响');
    yokai7hp.hp = 7;
    player.hand = [yokai7hp];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道')
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('没有符合条件');
  });

  it('🔴 手牌为空时失败', async () => {
    player.hand = [];

    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道')
    });

    expect(result.success).toBe(false);
  });

  // ========== 【触】弃置触发测试 ==========
  it('🟢 【触】弃置树妖时先触发抓牌+2，再执行两次树妖效果', async () => {
    const treeDemon = createTestCard('yokai', '树妖');
    treeDemon.hp = 5;
    player.hand = [treeDemon];
    player.deck = Array(10).fill(null).map(() => createTestCard('spell'));
    
    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    // 【触】弃置抓牌+2 + 树妖效果(抓牌+2,弃置1)*2
    // 初始手牌0 → 【触】+2 → 树妖效果1(+2,-1) → 树妖效果2(+2,-1) = 4张手牌
    expect(player.hand.length).toBe(4);
    // 弃牌堆: 树妖本身(1) + 树妖效果弃置(2) = 3张
    expect(player.discard.length).toBe(3);
    expect(player.discard[0]!.name).toBe('树妖'); // 轮入道弃置的树妖
  });

  it('🟢 【触】弃置三味时先触发抓牌+3，再执行两次三味效果', async () => {
    const sanmi = createTestCard('yokai', '三味');
    sanmi.hp = 4;
    player.hand = [sanmi];
    player.deck = Array(12).fill(null).map(() => createTestCard('spell'));
    
    // 三味效果: 本回合每使用阴阳术伤害+2（它不抓牌）
    // 【触】弃置抓牌+3
    const result = await executeYokaiEffect('轮入道', {
      player, gameState,
      card: createTestCard('yokai', '轮入道'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    // 【触】弃置抓牌+3（三味效果不抓牌）
    expect(player.hand.length).toBe(3);
    // 三味添加了2次SPELL_DAMAGE_BONUS buff
    const bonusBuffs = player.tempBuffs.filter(b => (b as any).source === '三味');
    expect(bonusBuffs.length).toBe(2);
  });
});

describe('阴摩罗（执行弃牌区效果）', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('选择弃牌区的兵主部，执行伤害+2并返回牌库底', async () => {
    const heizu = createTestCard('yokai', '兵主部');
    heizu.hp = 3;
    player.discard = [heizu];

    const result = await executeYokaiEffect('阴摩罗', {
      player, gameState,
      card: createTestCard('yokai', '阴摩罗'),
      onSelectCards: async (cards) => cards.map(c => c.instanceId)
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2);
    expect(player.deck[0]!.name).toBe('兵主部');
  });

  it('弃牌区没有符合条件的牌时直接返回', async () => {
    player.discard = [];

    const result = await executeYokaiEffect('阴摩罗', {
      player, gameState,
      card: createTestCard('yokai', '阴摩罗')
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('没有符合条件');
  });
});

describe('薙魂（御魂计数鬼火+2）', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2, maxGhostFire: 5 });
    player.deck = [createTestCard('spell', '阴阳术'), createTestCard('spell', '阴阳术')];
    player.hand = [createTestCard('yokai', '赤舌')];
    gameState = createTestGameState(player);
  });

  describe('基础效果', () => {
    it('抓牌+1，然后弃置1张手牌', async () => {
      (player as any).played = [createTestCard('yokai', '薙魂')];
      const initialDeckLength = player.deck.length;
      
      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      // 原1张手牌 + 抓1张 - 弃1张 = 1张
      expect(player.hand.length).toBe(1);
      expect(player.deck.length).toBe(initialDeckLength - 1);
      expect(player.discard.length).toBe(1);
    });
  });

  describe('御魂计数触发', () => {
    it('已打出3张御魂时立即鬼火+2', async () => {
      (player as any).played = [
        createTestCard('yokai', '兵主部'),
        createTestCard('yokai', '蝠翼'),
        createTestCard('yokai', '薙魂')
      ];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(4); // 2 + 2 = 4
      expect(result.message).toContain('鬼火+2');
    });

    it('打出2张御魂时不触发鬼火+2', async () => {
      (player as any).played = [
        createTestCard('yokai', '兵主部'),
        createTestCard('yokai', '薙魂')
      ];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2); // 不变
      expect(result.message).toContain('2张御魂');
    });

    it('打出1张御魂（仅薙魂自身）时不触发', async () => {
      (player as any).played = [createTestCard('yokai', '薙魂')];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2); // 不变
      expect(result.message).toContain('1张御魂');
    });

    it('打出4张御魂时鬼火仍只+2（非每满3张+2）', async () => {
      (player as any).played = [
        createTestCard('yokai', '兵主部'),
        createTestCard('yokai', '蝠翼'),
        createTestCard('yokai', '赤舌'),
        createTestCard('yokai', '薙魂')
      ];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(4); // 2 + 2 = 4，不是 +4
      expect(result.message).toContain('4张御魂');
    });
  });

  describe('边界条件', () => {
    it('鬼火已满时不会超过上限', async () => {
      player.ghostFire = 5;
      player.maxGhostFire = 5;
      (player as any).played = [
        createTestCard('yokai', '兵主部'),
        createTestCard('yokai', '蝠翼'),
        createTestCard('yokai', '薙魂')
      ];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(5); // 仍为5，不超上限
      expect(result.message).toContain('鬼火已满');
    });

    it('鬼火4/5时+2只得到1点', async () => {
      player.ghostFire = 4;
      player.maxGhostFire = 5;
      (player as any).played = [
        createTestCard('yokai', '兵主部'),
        createTestCard('yokai', '蝠翼'),
        createTestCard('yokai', '薙魂')
      ];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(5);
      expect(result.message).toContain('鬼火+1');
    });

    it('抓牌后手牌只有1张，必须弃置', async () => {
      player.hand = []; // 手牌为空
      player.deck = [createTestCard('yokai', '心眼')];
      (player as any).played = [createTestCard('yokai', '薙魂')];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 抓1张后弃1张 = 0
      expect(player.discard.length).toBe(1);
    });

    it('牌库为空时只执行弃牌', async () => {
      player.deck = [];
      player.hand = [createTestCard('yokai', '赤舌'), createTestCard('yokai', '蝠翼')];
      (player as any).played = [createTestCard('yokai', '薙魂')];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1); // 抓0张 - 弃1张 = 1
      expect(player.discard.length).toBe(1);
    });

    it('无onSelectCards回调时默认弃第一张', async () => {
      player.hand = [
        { ...createTestCard('yokai', '赤舌'), instanceId: 'first_card' },
        { ...createTestCard('yokai', '蝠翼'), instanceId: 'second_card' }
      ];
      (player as any).played = [createTestCard('yokai', '薙魂')];

      const result = await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂')
        // 无 onSelectCards
      });

      expect(result.success).toBe(true);
      // 应该弃置第一张（赤舌）
      expect(player.discard[0]!.instanceId).toBe('first_card');
    });
  });

  describe('轮入道双重效果', () => {
    it('两次执行，条件满足时两次各+2鬼火', async () => {
      player.ghostFire = 1;
      player.maxGhostFire = 5;
      player.hand = [createTestCard('yokai', '心眼'), createTestCard('yokai', '天邪鬼青')];
      player.deck = [createTestCard('spell', '阴阳术A'), createTestCard('spell', '阴阳术B')];
      // 已打出3张御魂（包括被轮入道触发的薙魂）
      (player as any).played = [
        createTestCard('yokai', '赤舌'),
        createTestCard('yokai', '天邪鬼绿'),
        createTestCard('yokai', '薙魂')
      ];

      // 第一次执行
      await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });
      
      const afterFirst = player.ghostFire;
      
      // 第二次执行（轮入道）
      await executeYokaiEffect('薙魂', {
        player, gameState,
        card: createTestCard('yokai', '薙魂'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      // 两次都满足条件，共+4鬼火（但受上限限制）
      expect(afterFirst).toBe(3); // 1 + 2 = 3
      expect(player.ghostFire).toBe(5); // 3 + 2 = 5，受上限限制
    });
  });
});

describe('飞缘魔（鬼王御魂效果）', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('场上没有鬼王时返回提示', async () => {
    const result = await executeYokaiEffect('飞缘魔', {
      player, gameState, card: createTestCard('yokai', '飞缘魔')
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('没有鬼王');
  });

  it('场上有鬼王时尝试执行御魂效果', async () => {
    (gameState.field as any).currentBoss = {
      instanceId: 'boss_001',
      cardId: 'boss_001',
      cardType: 'boss',
      name: '八岐大蛇',
      hp: 15
    };

    const result = await executeYokaiEffect('飞缘魔', {
      player, gameState, card: createTestCard('yokai', '飞缘魔')
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('八岐大蛇');
  });
});

// ============================================
// 木魅 测试
// ============================================
describe('木魅', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('搜索到3张阴阳术，全部入手', async () => {
      // 牌库顶到底：阴阳术1、非阴阳术1、阴阳术2、非阴阳术2、阴阳术3、...
      const spell1 = createTestCard('spell', '基础术式');
      const yokai1 = createTestCard('yokai', '心眼');
      const spell2 = createTestCard('spell', '中级符咒');
      const yokai2 = createTestCard('yokai', '镜姬');
      const spell3 = createTestCard('spell', '高级符咒');
      const yokai3 = createTestCard('yokai', '农夫');
      
      // deck[0]是牌库顶（shift取走）
      player.deck = [spell1, yokai1, spell2, yokai2, spell3, yokai3];
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      // 阴阳术入手3张
      expect(player.hand.length).toBe(3);
      expect(player.hand.map(c => c.name)).toEqual(['基础术式', '中级符咒', '高级符咒']);
      // 非阴阳术弃置2张
      expect(player.discard.length).toBe(2);
      expect(player.discard.map(c => c.name)).toEqual(['心眼', '镜姬']);
      // 剩余牌库（未展示的部分）
      expect(player.deck.length).toBe(1);
      expect(player.deck[0].name).toBe('农夫');
    });

    it('第一张就是阴阳术，连续3张阴阳术入手', async () => {
      const spell1 = createTestCard('spell', '基础术式');
      const spell2 = createTestCard('spell', '中级符咒');
      const spell3 = createTestCard('spell', '高级符咒');
      const yokai1 = createTestCard('yokai', '心眼');
      
      player.deck = [spell1, spell2, spell3, yokai1];
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(3);
      expect(player.discard.length).toBe(0); // 无弃置
      expect(player.deck.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库为空，无效果', async () => {
      player.deck = [];
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0);
      expect(player.discard.length).toBe(0);
    });

    it('牌库阴阳术不足3张（只有1张）', async () => {
      const spell1 = createTestCard('spell', '基础术式');
      const yokai1 = createTestCard('yokai', '心眼');
      const yokai2 = createTestCard('yokai', '镜姬');
      
      player.deck = [yokai1, spell1, yokai2]; // 只有1张阴阳术
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      // 搜索完整个牌库才找到1张
      expect(player.hand.length).toBe(1);
      expect(player.hand[0].name).toBe('基础术式');
      // 其余2张弃置
      expect(player.discard.length).toBe(2);
      // 牌库空了
      expect(player.deck.length).toBe(0);
    });

    it('牌库无阴阳术，全部弃置', async () => {
      const yokai1 = createTestCard('yokai', '心眼');
      const yokai2 = createTestCard('yokai', '镜姬');
      const yokai3 = createTestCard('yokai', '农夫');
      
      player.deck = [yokai1, yokai2, yokai3];
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 没有阴阳术入手
      expect(player.discard.length).toBe(3); // 全部弃置
      expect(player.deck.length).toBe(0);
    });

    it('牌库全是阴阳术（超过3张），只取前3张', async () => {
      const spell1 = createTestCard('spell', '基础术式1');
      const spell2 = createTestCard('spell', '基础术式2');
      const spell3 = createTestCard('spell', '基础术式3');
      const spell4 = createTestCard('spell', '基础术式4');
      
      player.deck = [spell1, spell2, spell3, spell4];
      player.hand = [];
      player.discard = [];

      const result = await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(3);
      expect(player.discard.length).toBe(0); // 无弃置（展示的全是阴阳术）
      expect(player.deck.length).toBe(1); // 第4张没被展示
    });
  });

  describe('🔄 轮入道触发木魅', () => {
    it('轮入道执行两次木魅效果，最多获得6张阴阳术', async () => {
      // 准备充足的阴阳术
      const spells = [
        createTestCard('spell', '术式1'),
        createTestCard('spell', '术式2'),
        createTestCard('spell', '术式3'),
        createTestCard('spell', '术式4'),
        createTestCard('spell', '术式5'),
        createTestCard('spell', '术式6'),
        createTestCard('spell', '术式7'),
      ];
      
      player.deck = spells;
      player.hand = [];
      player.discard = [];

      // 第一次执行
      await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(player.hand.length).toBe(3);
      expect(player.deck.length).toBe(4);

      // 第二次执行（模拟轮入道）
      await executeYokaiEffect('木魅', {
        player, gameState,
        card: createTestCard('yokai', '木魅')
      });

      expect(player.hand.length).toBe(6);
      expect(player.deck.length).toBe(1);
    });
  });
});

// ============================================
// 幽谷响 测试
// ============================================
describe('幽谷响', () => {
  let player: PlayerState;
  let opponent1: PlayerState;
  let opponent2: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ name: '玩家A' });
    player.id = 'player1';
    player.deck = [createTestCard('spell', '基础术式')];
    
    opponent1 = createTestPlayer({ name: '对手B' });
    opponent1.id = 'opponent1';
    opponent1.deck = [];
    opponent1.discard = [];
    
    opponent2 = createTestPlayer({ name: '对手C' });
    opponent2.id = 'opponent2';
    opponent2.deck = [];
    opponent2.discard = [];
    
    gameState = createTestGameState(player);
    gameState.players = [player, opponent1, opponent2];
  });

  describe('🟢 正常流程', () => {
    it('展示多个对手牌库顶牌并选择使用效果', async () => {
      // 对手1牌库顶：心眼（伤害+3）
      const xinyan = { ...createTestCard('yokai', '心眼'), hp: 5, damage: 3 };
      opponent1.deck = [xinyan];
      
      // 对手2牌库顶：灯笼鬼（抓牌+1）
      const denglong = { ...createTestCard('yokai', '灯笼鬼'), hp: 3 };
      opponent2.deck = [denglong];
      
      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async (cards) => cards.map(c => c.instanceId) // 全选
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('心眼');
      expect(result.message).toContain('灯笼鬼');
      // 两张牌都应归还各自拥有者弃牌区
      expect(opponent1.deck.length).toBe(0);
      expect(opponent1.discard.length).toBe(1);
      expect(opponent1.discard[0]!.name).toBe('心眼');
      expect(opponent2.deck.length).toBe(0);
      expect(opponent2.discard.length).toBe(1);
      expect(opponent2.discard[0]!.name).toBe('灯笼鬼');
    });

    it('使用展示牌效果时，效果归属幽谷响使用者', async () => {
      // 对手牌库顶是兵主部（伤害+2）
      const heizu = { ...createTestCard('yokai', '兵主部'), hp: 3, damage: 2 };
      opponent1.deck = [heizu];
      player.damage = 0;

      await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      // 伤害应加到幽谷响使用者身上
      expect(player.damage).toBe(2);
    });

    it('最多选择3张牌使用效果', async () => {
      // 准备4名对手
      const opponent3 = createTestPlayer({ name: '对手D' });
      opponent3.id = 'opponent3';
      const opponent4 = createTestPlayer({ name: '对手E' });
      opponent4.id = 'opponent4';
      gameState.players = [player, opponent1, opponent2, opponent3, opponent4];
      
      // 每个对手牌库顶放一张妖怪
      opponent1.deck = [{ ...createTestCard('yokai', '赤舌'), hp: 2 }];
      opponent2.deck = [{ ...createTestCard('yokai', '灯笼鬼'), hp: 3 }];
      opponent3.deck = [{ ...createTestCard('yokai', '蝠翼'), hp: 2 }];
      opponent3.discard = [];
      opponent4.deck = [{ ...createTestCard('yokai', '心眼'), hp: 5, damage: 3 }];
      opponent4.discard = [];
      
      let selectedCount = 0;
      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async (cards, maxCount) => {
          // 验证最多只能选3张
          expect(maxCount).toBe(3);
          selectedCount = Math.min(3, cards.length);
          return cards.slice(0, 3).map(c => c.instanceId);
        }
      });

      expect(result.success).toBe(true);
      expect(selectedCount).toBe(3);
      // 所有4张牌都应归还各自弃牌区
      expect(opponent1.discard.length).toBe(1);
      expect(opponent2.discard.length).toBe(1);
      expect(opponent3.discard.length).toBe(1);
      expect(opponent4.discard.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼王卡被排除在可选池外', async () => {
      // 对手1牌库顶是鬼王
      const boss = { ...createTestCard('boss', '大天狗'), cardType: 'boss' as const, hp: 15 };
      opponent1.deck = [boss];
      
      // 对手2牌库顶是普通妖怪
      const yokai = { ...createTestCard('yokai', '灯笼鬼'), hp: 3 };
      opponent2.deck = [yokai];

      let selectableCandidates: any[] = [];
      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async (cards) => {
          selectableCandidates = cards;
          return cards.map(c => c.instanceId);
        }
      });

      expect(result.success).toBe(true);
      // 只有1张可选（灯笼鬼），鬼王被排除
      expect(selectableCandidates.length).toBe(1);
      expect(selectableCandidates[0].name).toBe('灯笼鬼');
      // 鬼王也应归还弃牌区
      expect(opponent1.discard.length).toBe(1);
      expect(opponent1.discard[0]!.name).toBe('大天狗');
      expect(result.message).toContain('大天狗为鬼王不可选');
    });

    it('对手牌库为空时跳过该对手', async () => {
      // 对手1牌库为空
      opponent1.deck = [];
      
      // 对手2有牌
      const yokai = { ...createTestCard('yokai', '灯笼鬼'), hp: 3 };
      opponent2.deck = [yokai];

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async (cards) => cards.map(c => c.instanceId)
      });

      expect(result.success).toBe(true);
      // 只有对手2的牌被处理
      expect(opponent2.discard.length).toBe(1);
      expect(opponent1.discard.length).toBe(0);
    });

    it('所有对手牌库为空时直接返回', async () => {
      opponent1.deck = [];
      opponent2.deck = [];

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('所有对手牌库为空');
    });

    it('选择0张（不使用任何效果）', async () => {
      const yokai = { ...createTestCard('yokai', '灯笼鬼'), hp: 3 };
      opponent1.deck = [yokai];
      player.damage = 0;

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响'),
        onSelectCards: async () => [] // 不选任何牌
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('未使用任何效果');
      // 牌仍归还弃牌区
      expect(opponent1.discard.length).toBe(1);
      // 没有效果执行
      expect(player.damage).toBe(0);
    });

    it('无对手时直接返回', async () => {
      gameState.players = [player]; // 只有自己

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('无对手');
    });

    it('所有展示牌都是鬼王时，无牌可选', async () => {
      const boss1 = { ...createTestCard('boss', '八岐大蛇'), cardType: 'boss' as const };
      const boss2 = { ...createTestCard('boss', '玉藻前'), cardType: 'boss' as const };
      opponent1.deck = [boss1];
      opponent2.deck = [boss2];

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('未使用任何效果');
      // 鬼王仍归还各自弃牌区
      expect(opponent1.discard.length).toBe(1);
      expect(opponent2.discard.length).toBe(1);
    });
  });

  describe('🤖 AI 策略', () => {
    it('AI 按效果价值选择（优先伤害>抓牌>鬼火）', async () => {
      // 准备不同类型的牌
      const xinyan = { ...createTestCard('yokai', '心眼'), hp: 5, damage: 3 }; // 伤害+3，评分6
      const denglong = { ...createTestCard('yokai', '灯笼鬼'), hp: 3 }; // 抓牌+1，评分3
      const fuyi = { ...createTestCard('yokai', '蝠翼'), hp: 2 }; // 鬼火+1，评分1
      
      opponent1.deck = [fuyi];
      opponent2.deck = [xinyan];
      
      const opponent3 = createTestPlayer({ name: '对手D' });
      opponent3.id = 'opponent3';
      opponent3.deck = [denglong];
      opponent3.discard = [];
      gameState.players = [player, opponent1, opponent2, opponent3];

      player.damage = 0;

      // 不提供 onSelectCards，触发 AI 策略
      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响')
      });

      expect(result.success).toBe(true);
      // AI 应该选择心眼（评分最高）
      expect(result.message).toContain('心眼');
    });

    it('AI 不选择评分≤0的牌（如恶评）', async () => {
      const penalty = { ...createTestCard('penalty', '农夫'), cardType: 'penalty' as const };
      opponent1.deck = [penalty];

      const result = await executeYokaiEffect('幽谷响', {
        player, gameState,
        card: createTestCard('yokai', '幽谷响')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('未使用任何效果');
    });
  });
});

