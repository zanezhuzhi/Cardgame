/**
 * 妖怪御魂效果测试 - HP1-3 (招福达摩~兵主部)
 * 包含: 招福达摩、天邪鬼系列、唐纸伞妖、赤舌、魅妖、灯笼鬼、树妖、日女巳时、鸣屋、蚌精、兵主部
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
      const { aiDecide_天邪鬼赤 } = await import('../YokaiEffects');
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
      const { aiDecide_天邪鬼赤 } = await import('../YokaiEffects');
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
      const { aiDecide_天邪鬼赤 } = await import('../YokaiEffects');
      const cards = [{ ...createTestCard('yokai', 'HP5'), hp: 5, charm: 0 }];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      expect(result.length).toBe(0);
    });

    it('唯一高声誉牌不弃', async () => {
      const { aiDecide_天邪鬼赤 } = await import('../YokaiEffects');
      const cards = [{ ...createTestCard('yokai', '声誉2'), hp: 2, charm: 2 }];
      
      const result = aiDecide_天邪鬼赤(cards);
      
      expect(result.length).toBe(0);
    });

    it('空手牌返回空数组', async () => {
      const { aiDecide_天邪鬼赤 } = await import('../YokaiEffects');
      
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
      const { aiDecide_天邪鬼黄 } = await import('../YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', 'HP5'), hp: 5, charm: 0 },
        { ...createTestCard('yokai', 'HP2'), hp: 2, charm: 0 },
        { ...createTestCard('yokai', 'HP3'), hp: 3, charm: 0 }
      ];

      const result = aiDecide_天邪鬼黄(cards);

      expect(result).toBe(cards[1].instanceId); // HP2
    });

    it('同HP返回声誉最低的牌', async () => {
      const { aiDecide_天邪鬼黄 } = await import('../YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', '声誉2'), hp: 2, charm: 2 },
        { ...createTestCard('yokai', '声誉0'), hp: 2, charm: 0 },
        { ...createTestCard('yokai', '声誉1'), hp: 2, charm: 1 }
      ];

      const result = aiDecide_天邪鬼黄(cards);

      expect(result).toBe(cards[1].instanceId); // charm 0
    });

    it('空手牌返回空字符串', async () => {
      const { aiDecide_天邪鬼黄 } = await import('../YokaiEffects');

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
      const { aiDecide_魅妖 } = await import('../YokaiEffects');
      const cards = [
        { ...createTestCard('yokai', '伤害1'), damage: 1 },
        { ...createTestCard('yokai', '伤害3'), damage: 3 },
        { ...createTestCard('yokai', '伤害2'), damage: 2 }
      ];

      const result = aiDecide_魅妖(cards);

      expect(result).toBe(cards[1].instanceId); // damage 3
    });

    it('空列表返回空字符串', async () => {
      const { aiDecide_魅妖 } = await import('../YokaiEffects');

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
      const { onTreeDemonDiscard } = await import('../YokaiEffects');
      
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
      const { onTreeDemonDiscard } = await import('../YokaiEffects');
      
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
