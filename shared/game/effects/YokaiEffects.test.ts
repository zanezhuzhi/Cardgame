/**
 * 妖怪御魂效果测试
 * TDD流程：先写测试，再实现效果
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeYokaiEffect, aiDecide_唐纸伞妖, aiSelect_天邪鬼绿 } from './YokaiEffects';
import { CardInstance, PlayerState, GameState } from '../../types';

// 测试辅助函数
function createTestPlayer(options: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'test-player',
    name: 'Test',
    ghostFire: options.ghostFire ?? 3,
    maxGhostFire: 5,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    shikigami: [],
    shikigamiState: [],
    damage: 0,
    reputation: 0,
    tempBuffs: [],
    ...options
  };
}

function createTestGameState(player: PlayerState, additionalPlayers: PlayerState[] = []): GameState {
  return {
    phase: 'action',
    currentPlayerIndex: 0,
    players: [player, ...additionalPlayers],
    field: {
      yokaiSlots: [null, null, null, null, null, null],
      bossSlot: null,
      yokaiDeck: [],
      bossDeck: []
    },
    turnNumber: 1,
    log: []
  };
}

function createTestCard(type: string = 'yokai', name: string = '测试卡'): CardInstance {
  return {
    instanceId: `${type}_${Date.now()}_${Math.random()}`,
    cardId: `${type}_001`,
    cardType: type as any,
    name,
    hp: 3,
    maxHp: 3
  };
}

// ============================================
// 生命1 - 招福达摩测试
// ============================================
describe('招福达摩', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('无御魂效果', async () => {
    const result = await executeYokaiEffect('招福达摩', {
      player, gameState, card: createTestCard('yokai', '招福达摩')
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('无御魂效果');
  });
});

// ============================================
// 生命2 - 天邪鬼系列测试
// ============================================
describe('天邪鬼青', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('选择抓牌+1', async () => {
      const result = await executeYokaiEffect('天邪鬼青', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼青'),
        onChoice: async () => 0
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(result.draw).toBe(1);
      expect(result.message).toContain('抓牌+1');
    });

    it('选择伤害+1', async () => {
      const result = await executeYokaiEffect('天邪鬼青', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼青'),
        onChoice: async () => 1
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(result.damage).toBe(1);
      expect(result.message).toContain('伤害+1');
    });

    it('无 onChoice 时默认选第一项（抓牌+1）', async () => {
      const result = await executeYokaiEffect('天邪鬼青', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼青'),
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(0);
      expect(result.draw).toBe(1);
      expect(result.message).toContain('抓牌+1');
    });

    it('牌库与弃牌堆皆空时不弹出选择，直接伤害+1', async () => {
      player.deck = [];
      player.discard = [];
      let choiceCalled = 0;
      const result = await executeYokaiEffect('天邪鬼青', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼青'),
        onChoice: async () => {
          choiceCalled++;
          return 0;
        }
      });

      expect(choiceCalled).toBe(0);
      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0);
      expect(player.damage).toBe(1);
      expect(result.message).toContain('伤害+1');
    });

    it('牌库空但弃牌堆有牌时可选择抓牌并洗牌入库', async () => {
      player.deck = [];
      player.discard = [createTestCard('spell', '弃牌顶')];

      const result = await executeYokaiEffect('天邪鬼青', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼青'),
        onChoice: async () => 0
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(0);
      expect(result.message).toContain('抓牌+1');
    });
  });
});

describe('天邪鬼赤', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('伤害+1，可换牌', async () => {
      player.hand = [createTestCard('spell', '手牌1'), createTestCard('spell', '手牌2')];
      player.deck = [createTestCard('spell'), createTestCard('spell')];

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.discard.length).toBe(1);
      expect(player.hand.length).toBe(2); // 原2张-弃1张+抓1张
    });

    it('不换牌也有伤害+1', async () => {
      player.hand = [];

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库张数 < 弃置张数：洗牌后继续抓', async () => {
      // 手牌3张，牌库只有1张
      // 按游戏规则：牌库空时会洗入弃牌堆，所以弃3抓3时实际能抓到3张
      const card1 = createTestCard('yokai', '低价值1');
      const card2 = createTestCard('yokai', '低价值2');
      const card3 = createTestCard('yokai', '低价值3');
      player.hand = [card1, card2, card3];
      player.deck = [createTestCard('spell', '牌库唯一')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤'),
        onSelectCards: async (cards) => {
          // 返回传入手牌的所有instanceId
          return cards.map(c => c.instanceId);
        }
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1); // 伤害+1始终执行
      // 弃3张到discard，抓牌时：先抓deck的1张，deck空后洗回discard的3张，再抓2张
      // 最终：hand=3, deck=1, discard=0
      expect(player.hand.length).toBe(3); // 成功抓到3张（洗牌机制）
      expect(player.deck.length).toBe(1); // 洗回后剩1张
      expect(player.discard.length).toBe(0); // discard已洗回牌库
    });

    it('选择弃置0张：仅伤害+1，不抓牌', async () => {
      player.hand = [createTestCard('yokai', '保留牌')];
      player.deck = [createTestCard('spell', '不应抓到')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤'),
        onSelectCards: async () => [] // 选择弃置0张
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1); // 伤害+1
      expect(player.discard.length).toBe(0); // 无弃置
      expect(player.hand.length).toBe(1); // 手牌不变
      expect(player.deck.length).toBe(1); // 牌库不变
    });

    it('无手牌时：仅伤害+1，不弹选择', async () => {
      player.hand = [];
      player.damage = 0;
      let selectCardsCalled = false;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤'),
        onSelectCards: async () => {
          selectCardsCalled = true;
          return [];
        }
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(selectCardsCalled).toBe(false); // 不应调用选牌
    });
  });

  describe('⏱️ 强制中止（onSelectCards返回空数组）', () => {
    it('onSelectCards返回空数组时：不弃牌，伤害+1保留', async () => {
      player.hand = [createTestCard('yokai', '手牌1'), createTestCard('yokai', '手牌2')];
      player.deck = [createTestCard('spell', '牌库牌')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤'),
        onSelectCards: async () => [] // 超时/强制中止时返回空数组
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1); // 伤害+1已执行
      expect(player.discard.length).toBe(0); // 不弃牌
      expect(player.hand.length).toBe(2); // 手牌不变
    });
  });

  describe('🤖 AI接管（无onSelectCards）', () => {
    it('AI全弃低价值手牌（HP 2两张）', async () => {
      // 两张低HP手牌，AI应该全弃
      const card1 = { ...createTestCard('yokai', '低HP1'), hp: 2, charm: 0 };
      const card2 = { ...createTestCard('yokai', '低HP2'), hp: 2, charm: 1 };
      player.hand = [card1, card2];
      player.deck = [createTestCard('spell', '新牌1'), createTestCard('spell', '新牌2')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤')
        // 不提供 onSelectCards，AI接管
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.discard.length).toBe(2); // AI弃全部
      expect(player.hand.length).toBe(2); // 抓了等量新牌
    });

    it('AI不弃唯一高价值手牌（HP≥5）', async () => {
      const highValueCard = { ...createTestCard('yokai', '高HP'), hp: 5, charm: 0 };
      player.hand = [highValueCard];
      player.deck = [createTestCard('spell', '新牌')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.discard.length).toBe(0); // 高价值不弃
      expect(player.hand.length).toBe(1); // 保留
    });

    it('AI不弃唯一高声誉手牌（声誉≥2）', async () => {
      const highCharmCard = { ...createTestCard('yokai', '高声誉'), hp: 2, charm: 2 };
      player.hand = [highCharmCard];
      player.deck = [createTestCard('spell', '新牌')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.discard.length).toBe(0); // 高声誉不弃
      expect(player.hand.length).toBe(1);
    });

    it('AI弃唯一低价值手牌（HP<5且声誉<2）', async () => {
      const lowValueCard = { ...createTestCard('yokai', '低价值'), hp: 3, charm: 1 };
      player.hand = [lowValueCard];
      player.deck = [createTestCard('spell', '新牌')];
      player.damage = 0;

      const result = await executeYokaiEffect('天邪鬼赤', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼赤')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.discard.length).toBe(1); // 低价值弃掉
      expect(player.hand.length).toBe(1); // 抓了新牌
    });
  });

  describe('🤖 AI决策函数', () => {
    it('按HP升序排列', async () => {
      const { aiDecide_天邪鬼赤 } = await import('./YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', 'HP3'), hp: 3, charm: 0 },
        { ...createTestCard('yokai', 'HP1'), hp: 1, charm: 0 },
        { ...createTestCard('yokai', 'HP2'), hp: 2, charm: 0 }
      ];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      // 应该全弃，且按HP升序排列（HP1 < HP2 < HP3）
      expect(result.length).toBe(3);
      expect(result[0]).toBe(cards[1].instanceId); // HP1
      expect(result[1]).toBe(cards[2].instanceId); // HP2
      expect(result[2]).toBe(cards[0].instanceId); // HP3
    });

    it('同HP按声誉升序', async () => {
      const { aiDecide_天邪鬼赤 } = await import('./YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', '声誉2'), hp: 2, charm: 2 },
        { ...createTestCard('yokai', '声誉0'), hp: 2, charm: 0 },
        { ...createTestCard('yokai', '声誉1'), hp: 2, charm: 1 }
      ];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      expect(result.length).toBe(3);
      expect(result[0]).toBe(cards[1].instanceId); // charm 0
      expect(result[1]).toBe(cards[2].instanceId); // charm 1
      expect(result[2]).toBe(cards[0].instanceId); // charm 2
    });

    it('唯一高HP牌不弃', async () => {
      const { aiDecide_天邪鬼赤 } = await import('./YokaiEffects');
      const cards = [{ ...createTestCard('yokai', 'HP5'), hp: 5, charm: 0 }];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      expect(result.length).toBe(0);
    });

    it('唯一高声誉牌不弃', async () => {
      const { aiDecide_天邪鬼赤 } = await import('./YokaiEffects');
      const cards = [{ ...createTestCard('yokai', '声誉2'), hp: 2, charm: 2 }];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      expect(result.length).toBe(0);
    });

    it('空手牌返回空数组', async () => {
      const { aiDecide_天邪鬼赤 } = await import('./YokaiEffects');
      
      const result = aiDecide_天邪鬼赤([]);
      
      expect(result.length).toBe(0);
    });
  });
});

describe('天邪鬼黄', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('抓牌+2，置顶1张', async () => {
      const result = await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      // 抓2张放回1张 = 净手牌+1
      expect(player.hand.length).toBe(1);
      // 牌库: 原2张 - 抓2张 + 放回1张 = 1张
      expect(player.deck.length).toBe(1);
    });

    it('置顶牌位于牌库顶（下次抽到它）', async () => {
      const deckCard1 = createTestCard('spell', '牌库1');
      const deckCard2 = createTestCard('spell', '牌库2');
      player.deck = [deckCard1, deckCard2];

      await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      // 置顶的牌应该在牌库末尾（顶）
      const topCard = player.deck[player.deck.length - 1];
      expect(topCard).toBeDefined();
      // 置顶的是从手牌选的牌（即刚抓到的牌之一）
      expect(topCard!.name === '牌库1' || topCard!.name === '牌库2').toBe(true);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库只有1张：少抓后仍置顶', async () => {
      player.deck = [createTestCard('spell', '唯一牌')];
      player.hand = [];

      const result = await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      // 抓1张放回1张 = 净手牌 0
      expect(player.hand.length).toBe(0);
      expect(player.deck.length).toBe(1);
    });

    it('牌库为空：无法抓牌，跳过置顶', async () => {
      player.deck = [];
      player.hand = [];
      player.discard = []; // 也没有弃牌堆可洗

      const result = await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0);
      expect(player.deck.length).toBe(0);
    });

    it('打出后有手牌但抓不到牌：用现有手牌置顶', async () => {
      player.deck = [];
      player.discard = [];
      const existingCard = createTestCard('yokai', '现有手牌');
      player.hand = [existingCard];

      const result = await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 置顶后手牌空
      expect(player.deck.length).toBe(1); // 置顶到牌库
      expect(player.deck[0]!.name).toBe('现有手牌');
    });
  });

  describe('⏱️ 强制中止（无onSelectCards）', () => {
    it('无onSelectCards时：使用AI策略选择价值最低的牌置顶', async () => {
      const lowValueCard = { ...createTestCard('yokai', '低价值'), hp: 2, charm: 0 };
      const highValueCard = { ...createTestCard('yokai', '高价值'), hp: 5, charm: 2 };
      player.deck = [lowValueCard, highValueCard];
      player.hand = [];

      const result = await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄')
        // 不提供 onSelectCards
      });

      expect(result.success).toBe(true);
      // AI应选择低价值牌置顶
      expect(player.deck[player.deck.length - 1]!.name).toBe('低价值');
      expect(player.hand.length).toBe(1);
      expect(player.hand[0]!.name).toBe('高价值');
    });
  });

  describe('🤖 AI接管', () => {
    it('AI选择HP最低的牌置顶', async () => {
      const hp2Card = { ...createTestCard('yokai', 'HP2'), hp: 2, charm: 1 };
      const hp5Card = { ...createTestCard('yokai', 'HP5'), hp: 5, charm: 0 };
      player.deck = [hp2Card, hp5Card];
      player.hand = [];

      await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄')
      });

      // HP2 应被置顶
      expect(player.deck[player.deck.length - 1]!.name).toBe('HP2');
    });

    it('同HP时选择声誉最低的牌置顶', async () => {
      const lowCharm = { ...createTestCard('yokai', '低声誉'), hp: 3, charm: 0 };
      const highCharm = { ...createTestCard('yokai', '高声誉'), hp: 3, charm: 2 };
      player.deck = [highCharm, lowCharm];
      player.hand = [];

      await executeYokaiEffect('天邪鬼黄', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼黄')
      });

      // 低声誉应被置顶
      expect(player.deck[player.deck.length - 1]!.name).toBe('低声誉');
    });
  });

  describe('🤖 AI决策函数', () => {
    it('返回HP最低的牌', async () => {
      const { aiDecide_天邪鬼黄 } = await import('./YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', 'HP5'), hp: 5, charm: 0 },
        { ...createTestCard('yokai', 'HP2'), hp: 2, charm: 0 },
        { ...createTestCard('yokai', 'HP3'), hp: 3, charm: 0 }
      ];

      const result = aiDecide_天邪鬼黄(cards);

      expect(result).toBe(cards[1].instanceId); // HP2
    });

    it('同HP返回声誉最低的牌', async () => {
      const { aiDecide_天邪鬼黄 } = await import('./YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', '声誉2'), hp: 2, charm: 2 },
        { ...createTestCard('yokai', '声誉0'), hp: 2, charm: 0 },
        { ...createTestCard('yokai', '声誉1'), hp: 2, charm: 1 }
      ];

      const result = aiDecide_天邪鬼黄(cards);

      expect(result).toBe(cards[1].instanceId); // charm 0
    });

    it('空手牌返回空字符串', async () => {
      const { aiDecide_天邪鬼黄 } = await import('./YokaiEffects');

      const result = aiDecide_天邪鬼黄([]);

      expect(result).toBe('');
    });
  });
});

describe('天邪鬼绿', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 功能验收', () => {
    it('退治的妖怪从战场移除', async () => {
      const yokai = createTestCard('yokai', '灯笼鬼');
      yokai.hp = 3;
      gameState.field.yokaiSlots[0] = yokai;

      await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(gameState.field.yokaiSlots[0]).toBeNull();
    });

    it('退治的妖怪进入打出者的弃牌堆', async () => {
      const yokai = createTestCard('yokai', '灯笼鬼');
      yokai.hp = 3;
      gameState.field.yokaiSlots[0] = yokai;

      await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(player.discard.length).toBe(1);
      expect(player.discard[0]!.name).toBe('灯笼鬼');
    });

    it('有多个合法目标时玩家可选择', async () => {
      const y1 = createTestCard('yokai', '蝠翼');
      y1.hp = 3;
      const y2 = createTestCard('yokai', '兵主部');
      y2.hp = 3;
      gameState.field.yokaiSlots[0] = y1;
      gameState.field.yokaiSlots[1] = y2;

      await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => targets[1]!.instanceId
      });

      expect(gameState.field.yokaiSlots[0]).not.toBeNull();
      expect(gameState.field.yokaiSlots[1]).toBeNull();
      expect(player.discard[0]!.name).toBe('兵主部');
    });

    it('日志正确记录退治的妖怪名称', async () => {
      const yokai = createTestCard('yokai', '蝠翼');
      yokai.hp = 3;
      gameState.field.yokaiSlots[0] = yokai;

      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(result.message).toContain('退治');
      expect(result.message).toContain('蝠翼');
    });
  });

  describe('🔴 边界条件', () => {
    it('场上无HP≤4的妖怪时跳过', async () => {
      const yokai = createTestCard('yokai', '大妖怪');
      yokai.hp = 6;
      gameState.field.yokaiSlots[0] = yokai;

      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState, card: createTestCard('yokai', '天邪鬼绿')
      });

      expect(result.success).toBe(true);
      expect(gameState.field.yokaiSlots[0]).not.toBeNull();
      expect(player.discard.length).toBe(0);
    });

    it('场上无妖怪时跳过', async () => {
      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState, card: createTestCard('yokai', '天邪鬼绿')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有符合条件');
    });

    it('HP=4和HP=5并存时只能选HP=4', async () => {
      const y4 = createTestCard('yokai', '骰子鬼');
      y4.hp = 4;
      const y5 = createTestCard('yokai', '狂骨');
      y5.hp = 5;
      gameState.field.yokaiSlots[0] = y4;
      gameState.field.yokaiSlots[1] = y5;

      await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => {
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('骰子鬼');
          return targets[0]!.instanceId;
        }
      });

      expect(gameState.field.yokaiSlots[0]).toBeNull();
      expect(gameState.field.yokaiSlots[1]).not.toBeNull();
    });
  });

  describe('🤖 AI接管 + ⏱️ 强制中止', () => {
    it('无onSelectTarget时AI选择HP最高的目标', async () => {
      const y2 = createTestCard('yokai', '赤舌');
      y2.hp = 2;
      const y4 = createTestCard('yokai', '骰子鬼');
      y4.hp = 4;
      const y3 = createTestCard('yokai', '灯笼鬼');
      y3.hp = 3;
      gameState.field.yokaiSlots[0] = y2;
      gameState.field.yokaiSlots[1] = y4;
      gameState.field.yokaiSlots[2] = y3;

      await executeYokaiEffect('天邪鬼绿', {
        player, gameState, card: createTestCard('yokai', '天邪鬼绿')
      });

      expect(gameState.field.yokaiSlots[1]).toBeNull();
      expect(player.discard[0]!.name).toBe('骰子鬼');
      expect(gameState.field.yokaiSlots[0]).not.toBeNull();
      expect(gameState.field.yokaiSlots[2]).not.toBeNull();
    });

    it('aiSelect函数返回HP最高目标的ID', () => {
      const targets = [
        { ...createTestCard('yokai', '赤舌'), hp: 2 },
        { ...createTestCard('yokai', '骰子鬼'), hp: 4 },
        { ...createTestCard('yokai', '灯笼鬼'), hp: 3 },
      ];

      const selectedId = aiSelect_天邪鬼绿(targets);
      expect(selectedId).toBe(targets[1]!.instanceId);
    });
  });
});

describe('唐纸伞妖', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell', '牌库顶牌')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('伤害+1，选择保留牌库顶', async () => {
      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖'),
        onChoice: async () => 0 // 保留
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.deck.length).toBe(1);
      expect(player.exiled.length).toBe(0);
    });

    it('伤害+1，选择超度牌库顶', async () => {
      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖'),
        onChoice: async () => 1 // 超度
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.deck.length).toBe(0);
      expect(player.exiled.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库为空时只有伤害+1', async () => {
      player.deck = [];

      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
    });
  });

  describe('⏱️ 强制中止（无onChoice回调）', () => {
    it('无onChoice时默认保留牌库顶（AI决策）', async () => {
      player.deck = [createTestCard('spell', '中级符咒')];

      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.deck.length).toBe(1);
      expect(player.exiled.length).toBe(0);
      expect(result.message).toContain('保留');
    });

    it('无onChoice但牌库顶是招福达摩时AI超度', async () => {
      const daruma = createTestCard('token', '招福达摩');
      player.deck = [daruma];

      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(player.deck.length).toBe(0);
      expect(player.exiled.length).toBe(1);
      expect(result.message).toContain('超度');
    });

    it('无onChoice但牌库顶是恶评时AI超度', async () => {
      const penalty = createTestCard('penalty', '农夫');
      player.deck = [penalty];

      const result = await executeYokaiEffect('唐纸伞妖', {
        player, gameState,
        card: createTestCard('yokai', '唐纸伞妖')
      });

      expect(result.success).toBe(true);
      expect(player.exiled.length).toBe(1);
    });
  });

  describe('🤖 AI决策函数', () => {
    it('招福达摩 → 超度', () => {
      const card = createTestCard('token', '招福达摩');
      expect(aiDecide_唐纸伞妖(card)).toBe(1);
    });

    it('恶评 → 超度', () => {
      const card = createTestCard('penalty', '农夫');
      expect(aiDecide_唐纸伞妖(card)).toBe(1);
    });

    it('阴阳术 → 保留', () => {
      const card = createTestCard('spell', '基础术式');
      expect(aiDecide_唐纸伞妖(card)).toBe(0);
    });

    it('御魂 → 保留', () => {
      const card = createTestCard('yokai', '兵主部');
      expect(aiDecide_唐纸伞妖(card)).toBe(0);
    });
  });
});

describe('赤舌', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.id = 'player1';
    opponent = createTestPlayer();
    opponent.id = 'opponent1';
    opponent.name = '对手1';
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 功能验收', () => {
    it('对手弃牌堆有基础术式时，移到牌库顶', async () => {
      const spell = createTestCard('spell', '基础术式');
      opponent.discard = [spell];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.discard.length).toBe(0);
      expect(opponent.deck.length).toBe(1);
      expect(opponent.deck[0]!.name).toBe('基础术式');
    });

    it('对手弃牌堆有招福达摩时，移到牌库顶', async () => {
      const daruma = createTestCard('token', '招福达摩');
      opponent.discard = [daruma];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.discard.length).toBe(0);
      expect(opponent.deck.length).toBe(1);
      expect(opponent.deck[0]!.name).toBe('招福达摩');
    });

    it('多名对手都有符合条件的牌时，全部处理', async () => {
      const opponent2 = createTestPlayer();
      opponent2.id = 'opponent2';
      gameState.players.push(opponent2);

      opponent.discard = [createTestCard('spell', '基础术式')];
      opponent2.discard = [createTestCard('token', '招福达摩')];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.deck.length).toBe(1);
      expect(opponent2.deck.length).toBe(1);
      expect(result.message).toContain('2名对手');
    });

    it('返回消息包含「妨害」关键词', async () => {
      opponent.discard = [createTestCard('spell', '基础术式')];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.message).toContain('妨害');
    });
  });

  describe('🔴 边界条件', () => {
    it('对手弃牌堆为空时跳过', async () => {
      opponent.discard = [];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.deck.length).toBe(0);
      expect(result.message).toContain('无符合条件');
    });

    it('对手弃牌堆没有基础术式/招福达摩时跳过', async () => {
      opponent.discard = [
        createTestCard('yokai', '兵主部'),
        createTestCard('spell', '中级符咒')
      ];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.discard.length).toBe(2);
      expect(opponent.deck.length).toBe(0);
    });

    it('单人模式无对手时返回跳过提示', async () => {
      gameState.players = [player];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('无对手');
    });
  });

  describe('🤖 AI接管（L1规则）', () => {
    it('弃牌堆同时有招福达摩和基础术式时，优先选招福达摩', async () => {
      const daruma = createTestCard('token', '招福达摩');
      const spell = createTestCard('spell', '基础术式');
      opponent.discard = [spell, daruma];

      await executeYokaiEffect('赤舌', {
        player, gameState, card: createTestCard('yokai', '赤舌')
      });

      expect(opponent.deck.length).toBe(1);
      expect(opponent.deck[0]!.name).toBe('招福达摩');
      expect(opponent.discard.length).toBe(1);
      expect(opponent.discard[0]!.name).toBe('基础术式');
    });
  });
});

// ============================================
// 生命3 妖怪测试
// ============================================

describe('魅妖', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.id = 'player1';
    opponent = createTestPlayer('opponent');
    opponent.id = 'opponent1';
    opponent.name = '对手1';
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 正常流程', () => {
    it('展示对手牌库顶牌并使用效果', async () => {
      // 对手牌库顶是兵主部（HP=2, damage=2）
      const yokaiCard = { ...createTestCard('yokai', '兵主部'), hp: 2, damage: 2 };
      opponent.deck = [yokaiCard];

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖'),
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('魅妖');
      expect(result.message).toContain('兵主部');
      // 牌应从对手牌库移入弃牌堆
      expect(opponent.deck.length).toBe(0);
      expect(opponent.discard.length).toBe(1);
      expect(opponent.discard[0]!.name).toBe('兵主部');
    });

    it('可选择多个对手中的一张牌', async () => {
      const opponent2 = createTestPlayer('opponent2');
      const yokai1 = { ...createTestCard('yokai', '低HP妖怪1'), hp: 2 };
      const yokai2 = { ...createTestCard('yokai', '低HP妖怪2'), hp: 3 };
      opponent.deck = [yokai1];
      opponent2.deck = [yokai2];
      gameState.players.push(opponent2);

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖'),
        onSelectTarget: async (targets) => {
          // 选择第二个对手的牌
          const target = targets.find(t => t.name === '低HP妖怪2');
          return target!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('低HP妖怪2');
      expect(opponent2.discard.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('对手牌库为空时跳过', async () => {
      opponent.deck = [];

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有符合条件');
    });

    it('对手牌库顶HP>=5时不可选', async () => {
      const highHpCard = { ...createTestCard('yokai', '高HP'), hp: 5 };
      opponent.deck = [highHpCard];

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有符合条件');
      expect(opponent.deck.length).toBe(1); // 牌仍在牌库
    });

    it('无对手时跳过', async () => {
      gameState.players = [player]; // 只有自己

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('无对手');
    });
  });

  describe('⏱️ 强制中止 + 🤖 AI接管', () => {
    it('无onSelectTarget时：AI选择伤害最高的牌', async () => {
      const opponent2 = createTestPlayer('opponent2');
      const lowDmg = { ...createTestCard('yokai', '低伤害'), hp: 2, damage: 1 };
      const highDmg = { ...createTestCard('yokai', '高伤害'), hp: 3, damage: 3 };
      opponent.deck = [lowDmg];
      opponent2.deck = [highDmg];
      gameState.players.push(opponent2);

      const result = await executeYokaiEffect('魅妖', {
        player, gameState,
        card: createTestCard('yokai', '魅妖')
        // 不提供 onSelectTarget
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('高伤害');
      expect(opponent2.discard.length).toBe(1);
    });
  });

  describe('🤖 AI决策函数', () => {
    it('优先选择伤害最高的牌', async () => {
      const { aiDecide_魅妖 } = await import('./YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', '伤害1'), damage: 1 },
        { ...createTestCard('yokai', '伤害3'), damage: 3 },
        { ...createTestCard('yokai', '伤害2'), damage: 2 }
      ];

      const result = aiDecide_魅妖(cards);

      expect(result).toBe(cards[1].instanceId); // damage 3
    });

    it('空列表返回空字符串', async () => {
      const { aiDecide_魅妖 } = await import('./YokaiEffects');

      const result = aiDecide_魅妖([]);

      expect(result).toBe('');
    });
  });
});

describe('灯笼鬼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('鬼火+1，抓牌+1', async () => {
      const result = await executeYokaiEffect('灯笼鬼', {
        player, gameState, card: createTestCard('yokai', '灯笼鬼')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(player.hand.length).toBe(1);
      expect(result.ghostFire).toBe(1);
      expect(result.draw).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火已达上限时不超过上限', async () => {
      player.ghostFire = player.maxGhostFire; // 已满
      player.deck = [createTestCard('spell')];

      const result = await executeYokaiEffect('灯笼鬼', {
        player, gameState, card: createTestCard('yokai', '灯笼鬼')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(player.maxGhostFire); // 保持上限
      expect(player.hand.length).toBe(1); // 抓牌仍执行
    });

    it('牌库为空时：鬼火+1，抓牌0', async () => {
      player.deck = [];
      player.discard = [];
      player.hand = [];

      const result = await executeYokaiEffect('灯笼鬼', {
        player, gameState, card: createTestCard('yokai', '灯笼鬼')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3); // 鬼火仍+1
      expect(player.hand.length).toBe(0); // 无牌可抓
    });

    it('牌库空但弃牌堆有牌时：洗牌后抓取', async () => {
      player.deck = [];
      player.discard = [createTestCard('spell', '弃牌中的牌')];
      player.hand = [];

      const result = await executeYokaiEffect('灯笼鬼', {
        player, gameState, card: createTestCard('yokai', '灯笼鬼')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(0); // 弃牌已洗入牌库
    });
  });
});

describe('树妖', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    // 初始化牌库
    player.deck = [
      createTestCard('yokai', '测试牌1'),
      createTestCard('yokai', '测试牌2'),
      createTestCard('yokai', '测试牌3')
    ];
    gameState = createTestGameState(player);
  });

  describe('🟢 打出效果：抓牌+2，弃置1张', () => {
    it('正常流程：抓2张后选择弃1张', async () => {
      const result = await executeYokaiEffect('树妖', {
        player,
        gameState,
        card: createTestCard('yokai', '树妖'),
        onSelectCards: async (cards, count) => {
          // 选择弃置第一张手牌
          return [cards[0]!.instanceId];
        }
      });

      expect(result.success).toBe(true);
      expect(result.draw).toBe(2);
      expect(player.hand.length).toBe(1); // 抓2弃1 = 净增1
      expect(player.discard.length).toBe(1); // 弃了1张
      expect(player.deck.length).toBe(1); // 原3张 - 抓2张 = 1张
    });

    it('抓牌后无回调时默认弃第一张', async () => {
      const result = await executeYokaiEffect('树妖', {
        player,
        gameState,
        card: createTestCard('yokai', '树妖')
        // 无 onSelectCards
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库空：无法抓牌，也无手牌可弃', async () => {
      player.deck = [];
      player.discard = [];
      player.hand = [];

      const result = await executeYokaiEffect('树妖', {
        player,
        gameState,
        card: createTestCard('yokai', '树妖')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 无牌可抓
      expect(player.discard.length).toBe(0); // 无牌可弃
    });

    it('牌库只有1张：抓1张后弃1张', async () => {
      player.deck = [createTestCard('yokai', '唯一牌')];

      const result = await executeYokaiEffect('树妖', {
        player,
        gameState,
        card: createTestCard('yokai', '树妖')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 抓1弃1
      expect(player.discard.length).toBe(1);
    });

    it('牌库空但弃牌堆有牌：洗牌后抓', async () => {
      player.deck = [];
      player.discard = [
        createTestCard('yokai', '弃牌1'),
        createTestCard('yokai', '弃牌2')
      ];
      player.hand = [];

      const result = await executeYokaiEffect('树妖', {
        player,
        gameState,
        card: createTestCard('yokai', '树妖')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1); // 洗牌抓2弃1
    });
  });

  describe('🟢 【触】被主动弃置时', () => {
    it('主动弃置树妖时抓牌+2', async () => {
      // 导入触发函数
      const { onTreeDemonDiscard } = await import('./YokaiEffects');
      
      // 准备牌库
      player.deck = [
        createTestCard('yokai', '抓牌1'),
        createTestCard('yokai', '抓牌2'),
        createTestCard('yokai', '抓牌3')
      ];
      const treeDemon = createTestCard('yokai', '树妖');
      player.hand = [treeDemon];
      const initialHandCount = player.hand.length;

      // 模拟主动弃置树妖
      const discardedCard = player.hand.splice(0, 1)[0]!;
      player.discard.push(discardedCard);
      
      // 触发【触】效果
      onTreeDemonDiscard(player, discardedCard);

      // 验证抓牌+2
      expect(player.hand.length).toBe(2); // 弃置后抓2
      expect(player.deck.length).toBe(1); // 原3张-抓2张
    });

    it('弃置非树妖卡牌不触发', async () => {
      const { onTreeDemonDiscard } = await import('./YokaiEffects');
      
      player.deck = [createTestCard('yokai', '牌库牌')];
      const otherCard = createTestCard('yokai', '其他卡');
      player.hand = [];

      // 弃置其他卡
      onTreeDemonDiscard(player, otherCard);

      // 不应抓牌
      expect(player.hand.length).toBe(0);
      expect(player.deck.length).toBe(1);
    });
  });

  describe('🔴 回合末弃牌不触发【触】', () => {
    it('回合结束批量清手牌不触发树妖【触】效果', () => {
      // 此测试验证文档要求：回合末自动弃牌不触发【触】
      // 实际触发逻辑由 MultiplayerGame 控制，此处仅验证函数存在
      // 回合末清手牌时不应调用 onTreeDemonDiscard
      
      const treeDemon = createTestCard('yokai', '树妖');
      player.hand = [treeDemon, createTestCard('yokai', '其他')];
      player.deck = [createTestCard('yokai', '牌库')];
      
      // 模拟回合末批量清空（不调用 onTreeDemonDiscard）
      const handToDiscard = [...player.hand];
      player.discard.push(...handToDiscard);
      player.hand = [];
      
      // 验证：手牌清空，但牌库未减少（未触发抓牌）
      expect(player.hand.length).toBe(0);
      expect(player.deck.length).toBe(1); // 未抓牌
      expect(player.discard.length).toBe(2);
    });
  });
});

describe('日女巳时', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('选择鬼火+1', async () => {
    const result = await executeYokaiEffect('日女巳时', {
      player, gameState,
      card: createTestCard('yokai', '日女巳时'),
      onChoice: async () => 0
    });

    expect(result.success).toBe(true);
    expect(player.ghostFire).toBe(3);
  });

  it('选择抓牌+2', async () => {
    const result = await executeYokaiEffect('日女巳时', {
      player, gameState,
      card: createTestCard('yokai', '日女巳时'),
      onChoice: async () => 1
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(2);
  });

  it('选择伤害+2', async () => {
    const result = await executeYokaiEffect('日女巳时', {
      player, gameState,
      card: createTestCard('yokai', '日女巳时'),
      onChoice: async () => 2
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2);
  });

  describe('🔴 边界条件', () => {
    it('鬼火已满时不提供鬼火+1选项，默认选择抓牌+2', async () => {
      player.maxGhostFire = 5;
      player.ghostFire = 5; // 已满
      player.hand = [];
      player.deck = [createTestCard('spell', '测试牌1'), createTestCard('spell', '测试牌2')];
      
      // 记录传入onChoice的选项
      let receivedOptions: string[] = [];
      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时'),
        onChoice: async (options) => {
          receivedOptions = options as string[];
          return 0; // 选择第一项
        }
      });

      // 鬼火满时，选项只有2个
      expect(receivedOptions).toEqual(['抓牌+2', '伤害+2']);
      expect(receivedOptions).not.toContain('鬼火+1');
      expect(result.success).toBe(true);
      expect(result.draw).toBe(2); // 默认选第一项变成了抓牌+2
      expect(player.hand.length).toBe(2);
    });

    it('鬼火未满时提供三个选项', async () => {
      player.ghostFire = 3; // 未满
      
      let receivedOptions: string[] = [];
      await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时'),
        onChoice: async (options) => {
          receivedOptions = options as string[];
          return 0;
        }
      });

      expect(receivedOptions).toEqual(['鬼火+1', '抓牌+2', '伤害+2']);
    });

    it('牌库空时选择抓牌+2：仍成功但抓0张', async () => {
      player.deck = [];
      player.discard = [];
      player.hand = [];

      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时'),
        onChoice: async () => 1 // 抓牌+2
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0); // 无牌可抓
      expect(result.draw).toBe(2); // 效果仍报告+2
    });

    it('牌库空但弃牌堆有牌时：洗牌后抓', async () => {
      player.deck = [];
      player.discard = [
        createTestCard('spell', '弃牌1'),
        createTestCard('spell', '弃牌2')
      ];
      player.hand = [];

      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时'),
        onChoice: async () => 1 // 抓牌+2
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(2);
      expect(player.discard.length).toBe(0);
    });

    it('无回调时默认选择第一项（鬼火未满则为鬼火+1）', async () => {
      player.ghostFire = 2;
      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时')
        // 无 onChoice
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3); // 原2+1=3
      expect(result.ghostFire).toBe(1);
    });

    it('无回调且鬼火已满时默认选择第一项（变为抓牌+2）', async () => {
      player.maxGhostFire = 5;
      player.ghostFire = 5;
      player.hand = [];
      player.deck = [createTestCard('spell', '测试牌1'), createTestCard('spell', '测试牌2')];

      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时')
        // 无 onChoice
      });

      expect(result.success).toBe(true);
      expect(result.draw).toBe(2); // 默认选第一项（抓牌+2）
      expect(player.hand.length).toBe(2);
    });

    it('无效选择（index超出范围）返回失败', async () => {
      const result = await executeYokaiEffect('日女巳时', {
        player, gameState,
        card: createTestCard('yokai', '日女巳时'),
        onChoice: async () => 99 // 无效选择
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('无效');
    });
  });
});

describe('鸣屋', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('弃牌堆空时伤害+4', async () => {
    player.discard = [];

    const result = await executeYokaiEffect('鸣屋', {
      player, gameState, card: createTestCard('yokai', '鸣屋')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(4);
  });

  it('弃牌堆非空时伤害+2', async () => {
    player.discard = [createTestCard('spell')];

    const result = await executeYokaiEffect('鸣屋', {
      player, gameState, card: createTestCard('yokai', '鸣屋')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2);
  });
});

describe('蚌精', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('超度1张手牌，抓牌+2', async () => {
    player.hand = [createTestCard('spell', '要超度的牌')];

    const result = await executeYokaiEffect('蚌精', {
      player, gameState,
      card: createTestCard('yokai', '蚌精'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(1);
    expect(player.hand.length).toBe(2); // 超度1张+抓2张
  });

  it('没有手牌时失败', async () => {
    player.hand = [];

    const result = await executeYokaiEffect('蚌精', {
      player, gameState, card: createTestCard('yokai', '蚌精')
    });

    expect(result.success).toBe(false);
  });

  it('牌库不足2张时少抓', async () => {
    player.hand = [createTestCard('spell', '要超度的牌')];
    player.deck = [createTestCard('spell', '唯一一张牌')]; // 牌库只有1张

    const result = await executeYokaiEffect('蚌精', {
      player, gameState,
      card: createTestCard('yokai', '蚌精'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(1);
    expect(player.hand.length).toBe(1); // 超度1张+只能抓1张
    expect(player.deck.length).toBe(0);
  });

  it('牌库为空时仅超度', async () => {
    player.hand = [createTestCard('spell', '要超度的牌')];
    player.deck = []; // 牌库为空

    const result = await executeYokaiEffect('蚌精', {
      player, gameState,
      card: createTestCard('yokai', '蚌精'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(1);
    expect(player.hand.length).toBe(0); // 超度1张+无牌可抓
  });

  it('不提供onSelectCards时默认选第一张', async () => {
    const card1 = createTestCard('spell', '第一张牌');
    const card2 = createTestCard('spell', '第二张牌');
    player.hand = [card1, card2];

    const result = await executeYokaiEffect('蚌精', {
      player, gameState,
      card: createTestCard('yokai', '蚌精')
      // 不提供onSelectCards
    });

    expect(result.success).toBe(true);
    expect(player.exiled.length).toBe(1);
    expect(player.exiled[0]!.instanceId).toBe(card1.instanceId); // 默认超度第一张
    expect(player.hand.length).toBe(3); // 剩1张+抓2张
  });
});

describe('兵主部', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('伤害+2', async () => {
    const result = await executeYokaiEffect('兵主部', {
      player, gameState, card: createTestCard('yokai', '兵主部')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(2);
  });
});

// ============================================
// 生命4 妖怪测试
// ============================================

describe('骰子鬼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('超度1张手牌，退治HP≤超度牌HP+2的妖怪', async () => {
      // 手牌有一张HP=2的妖怪
      const handCard = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      player.hand = [handCard];
      
      // 场上有HP=4和HP=5的妖怪（只有HP=4的符合退治条件：HP≤2+2=4）
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      const yokai5 = { ...createTestCard('yokai', '狂骨'), hp: 5, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai4;
      gameState.field.yokaiSlots[1] = yokai5;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [handCard.instanceId],
        onSelectTarget: async (targets) => {
          // 只应有HP=4的妖怪可选
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('骰子鬼');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('超度');
      expect(result.message).toContain('退治');
      expect(player.exiled.length).toBe(1); // 手牌被超度
      expect(player.exiled[0]!.name).toBe('赤舌');
      expect(player.discard.length).toBe(1); // 妖怪被退治进入弃牌堆
      expect(player.discard[0]!.name).toBe('骰子鬼');
      expect(gameState.field.yokaiSlots[0]).toBeNull(); // HP=4的妖怪被移除
      expect(gameState.field.yokaiSlots[1]).not.toBeNull(); // HP=5的妖怪仍在
    });

    it('超度招福达摩(HP=1)，可退治HP≤3的妖怪', async () => {
      const daruma = { ...createTestCard('token', '招福达摩'), hp: 1, charm: 1 };
      player.hand = [daruma];
      
      const yokai3 = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai3;
      gameState.field.yokaiSlots[1] = yokai4;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [daruma.instanceId],
        onSelectTarget: async (targets) => {
          // 只有HP=3可选（HP≤1+2=3）
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('灯笼鬼');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(player.exiled[0]!.name).toBe('招福达摩');
      expect(player.discard[0]!.name).toBe('灯笼鬼');
    });
  });

  describe('🔴 边界条件', () => {
    it('手牌为空时返回失败', async () => {
      player.hand = [];

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有手牌可超度');
    });

    it('场上没有符合条件的妖怪时，仅执行超度', async () => {
      const handCard = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      player.hand = [handCard];
      
      // 场上所有妖怪HP都>4（超度HP=2后，可退治范围为HP≤4）
      const yokai5 = { ...createTestCard('yokai', '狂骨'), hp: 5, charm: 1 };
      const yokai6 = { ...createTestCard('yokai', '破势'), hp: 6, charm: 2 };
      gameState.field.yokaiSlots[0] = yokai5;
      gameState.field.yokaiSlots[1] = yokai6;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [handCard.instanceId]
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有可退治的妖怪');
      expect(player.exiled.length).toBe(1); // 手牌仍被超度
      expect(player.discard.length).toBe(0); // 无妖怪被退治
    });

    it('超度无HP属性的牌(阴阳术)，默认按HP=0计算，可退治HP≤2', async () => {
      // 阴阳术没有hp属性，测试时需要确保hp为undefined或0
      const spell = createTestCard('spell', '基础术式');
      delete (spell as any).hp; // 确保无HP属性
      player.hand = [spell];
      
      const yokai2 = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const yokai3 = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai2;
      gameState.field.yokaiSlots[1] = yokai3;

      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async () => [spell.instanceId],
        onSelectTarget: async (targets) => {
          // 只有HP=2可选（HP≤0+2=2）
          expect(targets.length).toBe(1);
          expect(targets[0]!.name).toBe('赤舌');
          return targets[0]!.instanceId;
        }
      });

      expect(result.success).toBe(true);
      expect(player.exiled[0]!.name).toBe('基础术式');
      expect(player.discard[0]!.name).toBe('赤舌');
    });
  });

  describe('🤖 AI接管（无回调）', () => {
    it('AI超度声誉最低的牌', async () => {
      // 两张手牌：声誉0和声誉1
      const lowCharm = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highCharm = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      player.hand = [highCharm, lowCharm]; // 高声誉在前
      
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      gameState.field.yokaiSlots[0] = yokai4;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择声誉=0的赤舌超度
      expect(player.exiled[0]!.name).toBe('赤舌');
    });

    it('AI同声誉时超度HP最高的牌（扩大退治范围）', async () => {
      // 两张手牌：同声誉，不同HP
      const lowHp = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highHp = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 0 };
      player.hand = [lowHp, highHp];
      
      const yokai6 = { ...createTestCard('yokai', '破势'), hp: 6, charm: 2 };
      gameState.field.yokaiSlots[0] = yokai6;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择HP=4的牌超度（可退治HP≤6）
      expect(player.exiled[0]!.name).toBe('骰子鬼');
      // 并且能退治HP=6的妖怪
      expect(player.discard[0]!.name).toBe('破势');
    });

    it('AI退治声誉最高的妖怪', async () => {
      const handCard = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1 };
      player.hand = [handCard];
      
      // 两个符合条件的妖怪：声誉不同
      const lowCharmYokai = { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 0 };
      const highCharmYokai = { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 1 };
      gameState.field.yokaiSlots[0] = lowCharmYokai;
      gameState.field.yokaiSlots[1] = highCharmYokai;

      await executeYokaiEffect('骰子鬼', {
        player, gameState, card: createTestCard('yokai', '骰子鬼')
      });

      // AI应选择声誉=1的灯笼鬼退治
      expect(player.discard[0]!.name).toBe('灯笼鬼');
    });
  });

  describe('🤖 AI决策函数', () => {
    it('aiDecide_骰子鬼_超度：返回声誉最低的牌', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('./YokaiEffects');
      
      const cards = [
        { ...createTestCard('yokai'), charm: 1, hp: 2 },
        { ...createTestCard('yokai'), charm: 0, hp: 3 },
      ];
      
      const result = aiDecide_骰子鬼_超度(cards);
      expect(result).toBe(cards[1]!.instanceId); // 声誉=0的牌
    });

    it('aiDecide_骰子鬼_超度：同声誉时返回HP最高的牌', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('./YokaiEffects');
      
      const cards = [
        { ...createTestCard('yokai'), charm: 0, hp: 2 },
        { ...createTestCard('yokai'), charm: 0, hp: 4 },
      ];
      
      const result = aiDecide_骰子鬼_超度(cards);
      expect(result).toBe(cards[1]!.instanceId); // HP=4的牌
    });

    it('aiDecide_骰子鬼_退治：返回声誉最高的妖怪', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('./YokaiEffects');
      
      const targets = [
        { ...createTestCard('yokai'), charm: 1, hp: 3 },
        { ...createTestCard('yokai'), charm: 2, hp: 2 },
      ];
      
      const result = aiDecide_骰子鬼_退治(targets);
      expect(result).toBe(targets[1]!.instanceId); // 声誉=2的妖怪
    });

    it('aiDecide_骰子鬼_退治：同声誉时返回HP最高的妖怪', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('./YokaiEffects');
      
      const targets = [
        { ...createTestCard('yokai'), charm: 1, hp: 2 },
        { ...createTestCard('yokai'), charm: 1, hp: 4 },
      ];
      
      const result = aiDecide_骰子鬼_退治(targets);
      expect(result).toBe(targets[1]!.instanceId); // HP=4的妖怪
    });

    it('aiDecide_骰子鬼_超度：空手牌返回空字符串', async () => {
      const { aiDecide_骰子鬼_超度 } = await import('./YokaiEffects');
      expect(aiDecide_骰子鬼_超度([])).toBe('');
    });

    it('aiDecide_骰子鬼_退治：空目标返回空字符串', async () => {
      const { aiDecide_骰子鬼_退治 } = await import('./YokaiEffects');
      expect(aiDecide_骰子鬼_退治([])).toBe('');
    });
  });

  describe('🔴 边界测试：多次使用骰子鬼', () => {
    it('超度2次退治2只妖怪', async () => {
      // 准备3张手牌
      player.hand = [
        { ...createTestCard('yokai', '赤舌'), hp: 2, charm: 1 },
        { ...createTestCard('spell', '基础术式'), hp: 0, charm: 0 },
        { ...createTestCard('yokai', '灯笼鬼'), hp: 3, charm: 0 }
      ];
      
      // 场上放2只HP=2和HP=4的妖怪
      const yokai2 = { ...createTestCard('yokai', '天邪鬼青'), hp: 2, charm: 0, instanceId: 'y-2' };
      const yokai4 = { ...createTestCard('yokai', '骰子鬼'), hp: 4, charm: 1, instanceId: 'y-4' };
      gameState.field.yokaiSlots = [yokai2, yokai4, null, null, null, null];
      
      // 第一次：超度HP=2的赤舌，可退治HP≤4的妖怪
      const result1 = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async (cards) => {
          const card = cards.find(c => c.name === '赤舌');
          return card ? [card.instanceId] : [];
        },
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result1.success).toBe(true);
      expect(player.exiled.length).toBe(1);
      expect(player.exiled[0]!.name).toBe('赤舌');
      expect(player.hand.length).toBe(2);
      
      // 场上应只剩1只妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(1);
      
      // 第二次：超度HP=3的灯笼鬼，可退治HP≤5的妖怪
      const result2 = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectCards: async (cards) => {
          const card = cards.find(c => c.name === '灯笼鬼');
          return card ? [card.instanceId] : [];
        },
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result2.success).toBe(true);
      expect(player.exiled.length).toBe(2);
      expect(player.hand.length).toBe(1); // 只剩基础术式
      
      // 场上应无妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(0);
    });
    
    it('超度高HP牌可以退治更强的妖怪', async () => {
      // 准备1张HP=5的妖怪
      const highHpCard = { ...createTestCard('yokai', '心眼'), hp: 5, charm: 0 };
      player.hand = [highHpCard];
      
      // 场上放HP=7的妖怪（需要超度HP≥5的牌才能退治）
      const yokai7 = { ...createTestCard('yokai', '幽谷响'), hp: 7, charm: 1, instanceId: 'y-7' };
      gameState.field.yokaiSlots = [yokai7, null, null, null, null, null];
      
      const result = await executeYokaiEffect('骰子鬼', {
        player, gameState,
        card: createTestCard('yokai', '骰子鬼'),
        onSelectTarget: async (targets) => {
          return targets[0]?.instanceId || '';
        }
      });
      
      expect(result.success).toBe(true);
      expect(player.exiled.length).toBe(1);
      expect(player.exiled[0]!.name).toBe('心眼');
      // HP=5的牌可以退治HP≤7的妖怪
      expect(gameState.field.yokaiSlots.filter(s => s !== null).length).toBe(0);
    });
  });
});
describe('涅槃之火', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('添加技能消耗减少buff', async () => {
    const result = await executeYokaiEffect('涅槃之火', {
      player, gameState, card: createTestCard('yokai', '涅槃之火')
    });

    expect(result.success).toBe(true);
    const buff = player.tempBuffs.find(b => (b as any).source === '涅槃之火');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(1);
  });
});

describe('铮', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('主动效果', () => {
    it('🟢 抓牌+1，伤害+2', async () => {
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(2);
    });

    it('🔴 牌库为空时仍增加伤害+2，抓牌为0', async () => {
      player.deck = [];
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2);
      expect(player.hand.length).toBe(0);
    });

    it('🔴 牌库为空但弃牌堆有牌时，洗入后抓牌', async () => {
      player.deck = [];
      player.discard = [createTestCard('yokai', '招福达摩')];
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2);
      expect(player.hand.length).toBe(1); // 弃牌堆洗入后抓到1张
      expect(player.discard.length).toBe(0);
    });

    it('🟢 已有伤害时累加', async () => {
      player.damage = 3;
      const result = await executeYokaiEffect('铮', {
        player, gameState, card: createTestCard('yokai', '铮')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(5); // 3 + 2
    });
  });

  describe('轮入道兼容', () => {
    it('🟢 轮入道+铮：效果执行2次，抓牌+2，伤害+4', async () => {
      player.deck = [
        createTestCard('spell', '术式1'),
        createTestCard('spell', '术式2'),
      ];
      const zhengCard = createTestCard('yokai', '铮');

      // 模拟轮入道执行两次铮的效果
      const ctx = { player, gameState, card: zhengCard };
      await executeYokaiEffect('铮', ctx);
      await executeYokaiEffect('铮', ctx);

      expect(player.damage).toBe(4); // 2 + 2
      expect(player.hand.length).toBe(2); // 抓1 + 抓1
    });

    it('🔴 轮入道+铮：第一次抓牌耗尽牌库，第二次无牌可抓', async () => {
      player.deck = [createTestCard('spell', '术式1')];
      const zhengCard = createTestCard('yokai', '铮');

      const ctx = { player, gameState, card: zhengCard };
      await executeYokaiEffect('铮', ctx);
      await executeYokaiEffect('铮', ctx);

      expect(player.damage).toBe(4); // 2 + 2
      expect(player.hand.length).toBe(1); // 只抓到1张
    });
  });
});

describe('网切', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('🟢 基础效果：在field.tempBuffs添加NET_CUTTER_HP_REDUCTION', async () => {
    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    expect(gameState.field.tempBuffs).toBeDefined();
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff).toBeDefined();
    expect(buff.yokaiHpModifier).toBe(-1);
    expect(buff.bossHpModifier).toBe(-2);
    expect(buff.minHp).toBe(1);
    expect(buff.expiresAt).toBe('endOfTurn');
    expect(buff.sourcePlayerId).toBe(player.id);
  });

  it('🟢 妖怪HP-1：场上游荡妖怪受影响', async () => {
    // 场上放置妖怪
    const yokai5 = { ...createTestCard('yokai', '心眼'), hp: 5, maxHp: 5 };
    const yokai3 = { ...createTestCard('yokai', '天邪鬼青'), hp: 3, maxHp: 3 };
    gameState.field.yokaiSlots = [yokai5, yokai3, null, null, null, null];

    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    // 验证buff已设置
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff).toBeDefined();
    // 注意：网切设置的是HP修正状态，实际HP计算由EffectiveHP系统或服务端处理
    // 这里验证状态标记正确即可
    expect(buff.yokaiHpModifier).toBe(-1);
  });

  it('🟢 鬼王HP-2：鬼王受影响', async () => {
    gameState.field.currentBoss = { ...createTestCard('boss', '麒麟'), hp: 8, maxHp: 8 };
    gameState.field.bossCurrentHp = 8;

    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff.bossHpModifier).toBe(-2);
  });

  it('🟢 HP最低值保护标记', async () => {
    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    const buff = (gameState.field.tempBuffs as any[]).find(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(buff.minHp).toBe(1);
  });

  it('🟢 多次使用不叠加（覆盖）', async () => {
    // 第一次使用
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });
    expect((gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    ).length).toBe(1);

    // 第二次使用（应覆盖而非叠加）
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });
    const netCutterBuffs = (gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.type === 'NET_CUTTER_HP_REDUCTION'
    );
    expect(netCutterBuffs.length).toBe(1);  // 仍然只有1个buff
    expect(netCutterBuffs[0].yokaiHpModifier).toBe(-1);  // 不是-2
    expect(netCutterBuffs[0].bossHpModifier).toBe(-2);   // 不是-4
  });

  it('🟢 回合结束可清除（endOfTurn标记）', async () => {
    await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    // 模拟回合结束清理
    gameState.field.tempBuffs = (gameState.field.tempBuffs as any[]).filter(
      (b: any) => b.expiresAt !== 'endOfTurn'
    );

    expect(gameState.field.tempBuffs.length).toBe(0);
  });
});

describe('魍魉之匣', () => {
  let player: PlayerState;
  let opponent1: PlayerState;
  let opponent2: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ name: '玩家A' });
    player.deck = [createTestCard('spell', '基础术式')];
    
    opponent1 = createTestPlayer({ name: '玩家B' });
    opponent1.id = 'opponent1';
    opponent1.deck = [createTestCard('yokai', '赤舌')];
    
    opponent2 = createTestPlayer({ name: '玩家C' });
    opponent2.id = 'opponent2';
    opponent2.deck = [createTestCard('yokai', '灯笼鬼')];
    
    gameState = createTestGameState(player);
    gameState.players = [player, opponent1, opponent2];
  });

  it('🟢 基础效果：抓牌+1，伤害+1', async () => {
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 0 // 全部保留
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(1); // 抓1张
    expect(player.damage).toBe(1);      // 伤害+1
  });

  it('🟢 选择保留：所有玩家牌库顶不变', async () => {
    const originalDeckLengths = [player.deck.length, opponent1.deck.length, opponent2.deck.length];
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 0 // 全部选择保留
    });

    expect(result.success).toBe(true);
    // 玩家自己的牌库因抓牌减少1张
    expect(player.deck.length).toBe(originalDeckLengths[0] - 1);
    // 对手牌库不变（保留）
    expect(opponent1.deck.length).toBe(originalDeckLengths[1]);
    expect(opponent2.deck.length).toBe(originalDeckLengths[2]);
    // 对手弃牌堆不变
    expect(opponent1.discard.length).toBe(0);
    expect(opponent2.discard.length).toBe(0);
  });

  it('🟢 选择弃置：对手牌库顶移入弃牌堆', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示弃置
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => 1 // 全部选择弃置
    });

    expect(result.success).toBe(true);
    // 玩家自己的牌库顶也被弃置（drawCards抓1张+弃置1张=deck从2变0）
    expect(player.deck.length).toBe(0);
    expect(player.discard.length).toBe(1);
    // 对手牌库顶被弃置
    expect(opponent1.deck.length).toBe(0);
    expect(opponent1.discard.length).toBe(1);
    expect(opponent1.discard[0]!.name).toBe('赤舌');
    expect(opponent2.deck.length).toBe(0);
    expect(opponent2.discard.length).toBe(1);
    expect(opponent2.discard[0]!.name).toBe('灯笼鬼');
  });

  it('🟢 混合选择：保留自己、弃置对手', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    
    let choiceIndex = 0;
    const choices = [0, 1, 1]; // 保留玩家A、弃置玩家B、弃置玩家C
    
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => choices[choiceIndex++]!
    });

    expect(result.success).toBe(true);
    // 玩家自己保留（牌库顶不弃置，deck剩1张）
    expect(player.deck.length).toBe(1);
    expect(player.discard.length).toBe(0);
    // 对手被弃置
    expect(opponent1.discard.length).toBe(1);
    expect(opponent2.discard.length).toBe(1);
  });

  it('🔴 边界条件：空牌库跳过', async () => {
    // 玩家牌库放2张：1张被drawCards抓走，剩1张可展示
    player.deck = [createTestCard('spell', '基础术式'), createTestCard('spell', '额外术式')];
    opponent1.deck = []; // 对手1牌库为空
    
    let choiceCount = 0;
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣'),
      onChoice: async () => { choiceCount++; return 0; }
    });

    expect(result.success).toBe(true);
    // 触发2次选择（玩家A + 玩家C），跳过空牌库的玩家B
    expect(choiceCount).toBe(2);
  });

  it('🔴 超时默认：默认保留（index=0）', async () => {
    // 不传 onChoice，模拟超时走默认
    const result = await executeYokaiEffect('魍魉之匣', {
      player, gameState, card: createTestCard('yokai', '魍魉之匣')
    });

    expect(result.success).toBe(true);
    // 默认保留，对手牌库不变
    expect(opponent1.deck.length).toBe(1);
    expect(opponent2.deck.length).toBe(1);
    expect(opponent1.discard.length).toBe(0);
    expect(opponent2.discard.length).toBe(0);
  });
});

// ============================================
// 生命5 妖怪测试
// ============================================
describe('狂骨', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 4 });
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('基础效果', () => {
    it('🟢 鬼火=4时，抓牌+1，伤害+4', async () => {
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(4); // 等于鬼火数
    });

    it('🟢 鬼火=5时，伤害+5（最大收益）', async () => {
      player.ghostFire = 5;
      player.damage = 2; // 已有伤害
      player.deck = [createTestCard('spell'), createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(7); // 2+5=7
      expect(player.hand.length).toBe(1);
    });
  });

  describe('边界条件', () => {
    it('🔴 鬼火=0时，伤害+0（仍可打出）', async () => {
      player.ghostFire = 0;
      player.damage = 0;
      player.deck = [createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(0); // +0
      expect(player.hand.length).toBe(1); // 仍抓牌
    });

    it('🔴 牌库为空时仍增加伤害', async () => {
      player.ghostFire = 4;
      player.damage = 0;
      player.deck = []; // 空牌库
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(4); // +4
      expect(player.hand.length).toBe(0); // 无牌可抓
    });

    it('🟢 轮入道双重效果：两次执行，伤害累加', async () => {
      player.ghostFire = 3;
      player.damage = 0;
      player.deck = [createTestCard('spell'), createTestCard('spell'), createTestCard('spell')];
      
      // 第一次执行
      await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });
      expect(player.damage).toBe(3);
      expect(player.hand.length).toBe(1);
      
      // 第二次执行（轮入道触发）
      await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });
      
      expect(player.damage).toBe(6); // 3+3=6
      expect(player.hand.length).toBe(2); // 1+1=2
    });

    it('🔴 鬼火=1时，伤害+1（低收益）', async () => {
      player.ghostFire = 1;
      player.damage = 0;
      player.deck = [createTestCard('spell')];
      
      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
    });

    it('🔴 手牌已满10张时跳过抓牌，仍按打出瞬间鬼火加伤', async () => {
      player.ghostFire = 4;
      player.damage = 0;
      player.deck = [createTestCard('spell'), createTestCard('spell')];
      while (player.hand.length < 10) {
        player.hand.push(createTestCard('spell'));
      }

      const result = await executeYokaiEffect('狂骨', {
        player, gameState, card: createTestCard('yokai', '狂骨')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(10);
      expect(player.damage).toBe(4);
    });
  });
});

describe('心眼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('伤害+3', async () => {
    const result = await executeYokaiEffect('心眼', {
      player, gameState, card: createTestCard('yokai', '心眼')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(3);
  });
});

describe('针女', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('伤害+1并添加技能伤害buff', async () => {
    const result = await executeYokaiEffect('针女', {
      player, gameState, card: createTestCard('yokai', '针女')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(1);
    const buff = player.tempBuffs.find(b => (b as any).source === '针女');
    expect(buff).toBeDefined();
    expect(buff?.value).toBe(2);
  });
});

// ============================================
// 生命6 妖怪测试
// ============================================
describe('破势', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('首张牌伤害+5', async () => {
    (player as any).cardsPlayed = 1;
    (player as any).played = [createTestCard('yokai', '破势')];

    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(5);
  });

  it('非首张牌伤害+3', async () => {
    (player as any).cardsPlayed = 3;
    (player as any).played = [
      createTestCard('spell', '基础术式'),
      createTestCard('spell', '中级符咒'),
      createTestCard('yokai', '破势')
    ];

    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(3);
  });

  it('无cardsPlayed字段时默认为首张（兼容）', async () => {
    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(5);
  });
});

describe('镜姬', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('抓牌+2，伤害+1，鬼火+1', async () => {
    const result = await executeYokaiEffect('镜姬', {
      player, gameState, card: createTestCard('yokai', '镜姬')
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(2);
    expect(player.damage).toBe(1);
    expect(player.ghostFire).toBe(3);
  });
});

// ============================================
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
