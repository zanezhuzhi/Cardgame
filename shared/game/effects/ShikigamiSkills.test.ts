/**
 * 式神技能TDD测试
 * @file shared/game/effects/ShikigamiSkills.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  executeSkill, 
  isFemaleTarget, 
  checkSeductionBonus,
  checkBubbleShield,
  markBubbleShieldTriggered,
  applyKongoukyouEffect,
  checkMoonTideCondition,
  activateBlessingSeedsOnTurnStart,
  checkBlessingSeedProtection,
  isInSleepingState,
  handleSleepingHarassment,
  clearSleepingState,
  checkStrawDollTrigger,
  triggerStrawDollDraw
} from './ShikigamiSkills';
import type { PlayerState, GameState } from '../../types/game';
import type { CardInstance } from '../../types/cards';

// 创建测试用玩家状态
function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'test_player',
    name: 'TestPlayer',
    onmyoji: null as any,
    shikigami: [],
    shikigamiState: [],
    deck: [],
    hand: [],
    discard: [],
    exiled: [],
    played: [],
    ghostFire: 3,
    maxGhostFire: 5,
    damage: 0,
    totalCharm: 0,
    cardsPlayed: 0,
    tempBuffs: [],
    ...overrides
  };
}

// 创建测试用游戏状态
function createTestGameState(player: PlayerState): GameState {
  return {
    phase: 'playing',
    turnNumber: 1,
    currentPlayer: 0,
    players: [player],
    turnPhase: 'action',
    field: {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossHp: 0,
      bossDeck: [],
      penaltyPile: [],
      yokaiDeck: [],
      exileZone: [],
      spellSupply: {} as any,
      spellCounts: { basic: 50, medium: 20, advanced: 10 }
    },
    log: []
  } as any;
}

// 创建测试卡牌
function createTestCard(type: string, name = 'TestCard'): CardInstance {
  return {
    instanceId: `test_${Date.now()}_${Math.random()}`,
    cardId: 'test_001',
    cardType: type as any,
    name,
    hp: 2,
    maxHp: 2,
    charm: 1
  };
}

// ============================================
// #23 座敷童子「魂之火」测试
// ============================================
describe('座敷童子「魂之火」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('弃置妖怪牌后鬼火+1', async () => {
      const yokaiCard = createTestCard('yokai', '灯笼鬼');
      player.hand = [yokaiCard];
      player.ghostFire = 2;

      const result = await executeSkill('魂之火', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(player.hand.length).toBe(0);
      expect(player.discard.length).toBe(1);
      expect(player.discard[0]?.name).toBe('灯笼鬼');
    });

    it('不消耗鬼火（技能本身无鬼火消耗）', async () => {
      player.hand = [createTestCard('yokai')];
      player.ghostFire = 0;

      const result = await executeSkill('魂之火', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1); // 0 + 1
    });
  });

  describe('🔴 边界条件', () => {
    it('手牌无妖怪时失败', async () => {
      player.hand = [
        createTestCard('spell', '基础术式'),
        createTestCard('spell', '中级符咒')
      ];

      const result = await executeSkill('魂之火', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有妖怪牌');
    });

    it('手牌为空时失败', async () => {
      player.hand = [];

      const result = await executeSkill('魂之火', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });

    it('鬼火已满时不超过上限', async () => {
      player.hand = [createTestCard('yokai')];
      player.ghostFire = 5;
      player.maxGhostFire = 5;

      const result = await executeSkill('魂之火', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(5); // 不超过上限
    });
  });
});

// ============================================
// #24 山兔「兔子舞」测试
// ============================================
describe('山兔「兔子舞」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
    // 准备牌库
    player.deck = [
      createTestCard('spell', '抓到的牌1'),
      createTestCard('spell', '抓到的牌2')
    ];
  });

  describe('🟢 正常流程', () => {
    it('鬼火-1，抓牌+1，弃置阴阳术无额外伤害', async () => {
      const spellCard = createTestCard('spell', '基础术式');
      player.hand = [spellCard];
      player.ghostFire = 2;

      const result = await executeSkill('兔子舞', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async () => [player.hand[player.hand.length - 1]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1); // 2 - 1
      expect(player.damage).toBe(0); // 弃置阴阳术无伤害加成
    });

    it('弃置妖怪牌时伤害+1', async () => {
      const yokaiCard = createTestCard('yokai', '灯笼鬼');
      player.hand = [yokaiCard];
      player.ghostFire = 2;

      const result = await executeSkill('兔子舞', {
        player, gameState, shikigamiIndex: 0,
        // 选择弃置妖怪牌（手牌中第一张是原有的妖怪牌）
        onSelectCards: async (cards) => {
          const yokai = cards.find(c => c.cardType === 'yokai');
          return [yokai?.instanceId ?? cards[0]!.instanceId];
        }
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(result.message).toContain('伤害+1');
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;
      player.hand = [createTestCard('yokai')];

      const result = await executeSkill('兔子舞', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('鬼火不足');
    });

    it('牌库为空时从弃牌堆洗回', async () => {
      player.deck = [];
      player.discard = [createTestCard('spell', '弃牌堆的牌')];
      player.hand = [];
      player.ghostFire = 1;

      const result = await executeSkill('兔子舞', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      // 应该从弃牌堆洗回牌库再抓牌
      expect(player.hand.length).toBe(0); // 抓了一张又弃了一张
      expect(player.discard.length).toBe(1);
    });
  });
});

// ============================================
// #6 书翁「万象之书」测试
// ============================================
describe('书翁「万象之书」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('N=1时：鬼火-1，伤害+2', async () => {
      player.ghostFire = 3;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.damage).toBe(2); // 1 + 1
    });

    it('N=3时：鬼火-3，伤害+4', async () => {
      player.ghostFire = 5;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      }, 3);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.damage).toBe(4); // 3 + 1
    });

    it('N=5时：鬼火-5，伤害+6', async () => {
      player.ghostFire = 5;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      }, 5);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(0);
      expect(player.damage).toBe(6); // 5 + 1
    });
  });

  describe('🔴 边界条件', () => {
    it('N=0时失败（规则：N不能为0）', async () => {
      player.ghostFire = 5;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(false);
      expect(result.message).toContain('N不能为0');
      expect(player.ghostFire).toBe(5); // 鬼火不变
    });

    it('鬼火不足N时失败', async () => {
      player.ghostFire = 2;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      }, 3);

      expect(result.success).toBe(false);
      expect(result.message).toContain('鬼火不足');
    });

    it('默认N=1', async () => {
      player.ghostFire = 3;

      const result = await executeSkill('万象之书', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2); // 默认N=1, 伤害=1+1=2
    });
  });
});

// ============================================
// #11 白狼「冥想」测试
// ============================================
describe('白狼「冥想」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('弃置1张牌，伤害+1', async () => {
      player.hand = [createTestCard('spell')];
      player.ghostFire = 2;

      const result = await executeSkill('冥想', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.damage).toBe(1);
      expect(player.hand.length).toBe(0);
      expect(player.discard.length).toBe(1);
    });

    it('弃置3张牌，伤害+3', async () => {
      player.hand = [
        createTestCard('spell', '牌1'),
        createTestCard('spell', '牌2'),
        createTestCard('yokai', '牌3')
      ];
      player.ghostFire = 2;

      const result = await executeSkill('冥想', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards, count) => cards.slice(0, count).map(c => c.instanceId)
      }, 3);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.damage).toBe(3);
      expect(player.hand.length).toBe(0);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;
      player.hand = [createTestCard('spell')];

      const result = await executeSkill('冥想', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('鬼火不足');
    });

    it('手牌不足N张时失败（鬼火退还）', async () => {
      player.ghostFire = 3;
      player.hand = [createTestCard('spell')];

      const result = await executeSkill('冥想', {
        player, gameState, shikigamiIndex: 0
      }, 5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('手牌不足');
      expect(player.ghostFire).toBe(3); // 鬼火退还
    });

    it('弃置0张时（N=0）伤害+0', async () => {
      player.ghostFire = 2;
      player.hand = [createTestCard('spell')];

      const result = await executeSkill('冥想', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(true);
      expect(player.damage).toBe(0);
      expect(player.hand.length).toBe(1); // 手牌不变
    });
  });
});

// ============================================
// #2 大天狗「羽刃暴风」测试
// ============================================
describe('大天狗「羽刃暴风」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('消耗2点鬼火选择目标', async () => {
      const yokai = createTestCard('yokai', '灯笼鬼');
      gameState.field.yokaiSlots[0] = yokai;

      const result = await executeSkill('羽刃暴风', {
        player, gameState, shikigamiIndex: 0,
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(result.costPaid).toBe(2);
    });

    it('添加STORM_BLADE临时增益', async () => {
      const yokai = createTestCard('yokai', '灯笼鬼');
      gameState.field.yokaiSlots[0] = yokai;

      await executeSkill('羽刃暴风', {
        player, gameState, shikigamiIndex: 0,
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      const buff = player.tempBuffs.find(b => (b as any).source === '羽刃暴风');
      expect(buff).toBeDefined();
      expect((buff as any).target).toBe(yokai.instanceId);
      expect(buff?.value).toBe(2); // 减免值
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 1;
      gameState.field.yokaiSlots[0] = createTestCard('yokai');

      const result = await executeSkill('羽刃暴风', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });

    it('场上没有妖怪时失败', async () => {
      gameState.field.yokaiSlots = [null, null, null, null, null, null];

      const result = await executeSkill('羽刃暴风', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(5); // 退还
    });
  });
});

// ============================================
// #1 妖刀姬「杀戮」测试
// ============================================
describe('妖刀姬「杀戮」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    gameState = createTestGameState(player);
    player.deck = [
      createTestCard('spell', '牌1'),
      createTestCard('spell', '牌2'),
      createTestCard('spell', '牌3')
    ];
  });

  describe('🟢 正常流程', () => {
    it('基础效果：鬼火-2，抓牌+1，伤害+1', async () => {
      player.ghostFire = 3;

      const result = await executeSkill('杀戮', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.damage).toBe(1);
      expect(player.hand.length).toBe(1);
    });

    it('重复效果：鬼火-3，抓牌+2，伤害+2', async () => {
      player.ghostFire = 5;

      const result = await executeSkill('杀戮', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.damage).toBe(2);
      expect(player.hand.length).toBe(2);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足2时无法使用基础效果', async () => {
      player.ghostFire = 1;

      const result = await executeSkill('杀戮', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(false);
    });

    it('鬼火不足3时无法使用重复效果', async () => {
      player.ghostFire = 2;

      const result = await executeSkill('杀戮', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #3 酒吞童子「酒葫芦」测试
// ============================================
describe('酒吞童子「酒葫芦」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    player.shikigamiState = [{ cardId: 'shikigami_003', isExhausted: false, markers: {} }];
    gameState = createTestGameState(player);
  });

  describe('🟢 放置酒气', () => {
    it('超度手牌放置1枚酒气', async () => {
      player.hand = [createTestCard('spell')];
      player.ghostFire = 3;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.hand.length).toBe(0);
      expect(player.exiled.length).toBe(1);
      expect(player.shikigamiState[0]?.markers['酒气']).toBe(1);
    });

    it('酒气上限为3', async () => {
      player.hand = [createTestCard('spell')];
      player.shikigamiState[0]!.markers['酒气'] = 3;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(true);
      expect(player.shikigamiState[0]?.markers['酒气']).toBe(3); // 不超过上限
      expect(result.message).toContain('上限');
    });
  });

  describe('🟢 消耗酒气', () => {
    it('消耗2枚酒气，伤害+2', async () => {
      player.shikigamiState[0]!.markers['酒气'] = 3;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 2);

      expect(result.success).toBe(true);
      expect(player.damage).toBe(2);
      expect(player.shikigamiState[0]?.markers['酒气']).toBe(1);
    });

    it('消耗全部3枚酒气，伤害+3', async () => {
      player.shikigamiState[0]!.markers['酒气'] = 3;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 3);

      expect(result.success).toBe(true);
      expect(player.damage).toBe(3);
      expect(player.shikigamiState[0]?.markers['酒气']).toBeUndefined();
    });
  });

  describe('🔴 边界条件', () => {
    it('无手牌时无法放置酒气', async () => {
      player.hand = [];
      player.ghostFire = 5;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(5); // 退还
    });

    it('酒气不足时无法消耗', async () => {
      player.shikigamiState[0]!.markers['酒气'] = 1;

      const result = await executeSkill('酒葫芦', {
        player, gameState, shikigamiIndex: 0
      }, 3);

      expect(result.success).toBe(false);
      expect(result.message).toContain('酒气不足');
    });
  });
});

// ============================================
// #4 茨木童子「迁怒」测试
// ============================================
describe('茨木童子「迁怒」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('添加临时增益：每超度/退治1妖怪伤害+2', async () => {
      player.ghostFire = 3;

      const result = await executeSkill('迁怒', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.tempBuffs.length).toBe(1);
      expect(player.tempBuffs[0]?.type).toBe('DAMAGE_PER_YOKAI_KILL');
      expect(player.tempBuffs[0]?.value).toBe(2);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 1;

      const result = await executeSkill('迁怒', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #5 花鸟卷「画境」测试
// ============================================
describe('花鸟卷「画境」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 5 });
    gameState = createTestGameState(player);
    player.deck = [
      createTestCard('spell', '牌1'),
      createTestCard('spell', '牌2'),
      createTestCard('spell', '牌3'),
      createTestCard('spell', '牌4')
    ];
  });

  describe('🟢 正常流程', () => {
    it('抓牌+3，将1张手牌置于牌库底', async () => {
      player.ghostFire = 3;
      const deckBefore = player.deck.length;

      const result = await executeSkill('画境', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      // 抓3张，放回1张，净手牌+2
      expect(player.hand.length).toBe(2);
      // 牌库：原来4张-抓3张+放回1张=2张
      expect(player.deck.length).toBe(2);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 1;

      const result = await executeSkill('画境', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #21 青蛙瓷器「岭上开花」测试
// ============================================
describe('青蛙瓷器「岭上开花」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('消耗1点鬼火', async () => {
      player.ghostFire = 2;

      const result = await executeSkill('岭上开花', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
    });

    it('成功时伤害+2', async () => {
      // 多次测试，确保至少有一次成功
      let hasSuccess = false;
      for (let i = 0; i < 20; i++) {
        const testPlayer = createTestPlayer({ ghostFire: 5 });
        const result = await executeSkill('岭上开花', {
          player: testPlayer, gameState, shikigamiIndex: 0
        });
        if (testPlayer.damage === 2) {
          hasSuccess = true;
          break;
        }
      }
      expect(hasSuccess).toBe(true);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;

      const result = await executeSkill('岭上开花', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #20 三尾狐「诱惑」测试 (永久被动)
// ============================================
describe('三尾狐「诱惑」', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = createTestPlayer();
  });

  describe('🟢 女性目标判定', () => {
    it('雪女是女性目标', () => {
      expect(isFemaleTarget('雪女')).toBe(true);
    });

    it('姑获鸟是女性目标', () => {
      expect(isFemaleTarget('姑获鸟')).toBe(true);
    });

    it('络新妇是女性目标', () => {
      expect(isFemaleTarget('络新妇')).toBe(true);
    });

    it('青女房是女性目标', () => {
      expect(isFemaleTarget('青女房')).toBe(true);
    });

    it('般若是女性目标', () => {
      expect(isFemaleTarget('般若')).toBe(true);
    });

    it('天邪鬼赤不是女性目标', () => {
      expect(isFemaleTarget('天邪鬼赤')).toBe(false);
    });

    it('灯笼鬼不是女性目标', () => {
      expect(isFemaleTarget('灯笼鬼')).toBe(false);
    });

    it('酒吞童子不是女性目标', () => {
      expect(isFemaleTarget('酒吞童子')).toBe(false);
    });
  });

  describe('🟢 诱惑效果', () => {
    it('对非女性目标首次伤害+1', () => {
      const result = checkSeductionBonus(player, '天邪鬼赤', '三尾狐');
      
      expect(result.bonus).toBe(1);
      expect(result.triggered).toBe(true);
    });

    it('对女性目标不触发', () => {
      const result = checkSeductionBonus(player, '雪女', '三尾狐');
      
      expect(result.bonus).toBe(0);
      expect(result.triggered).toBe(false);
    });

    it('非三尾狐不触发', () => {
      const result = checkSeductionBonus(player, '天邪鬼赤', '妖刀姬');
      
      expect(result.bonus).toBe(0);
      expect(result.triggered).toBe(false);
    });
  });

  describe('🔴 边界条件', () => {
    it('本回合只能触发一次', () => {
      // 第一次触发
      const result1 = checkSeductionBonus(player, '天邪鬼赤', '三尾狐');
      expect(result1.bonus).toBe(1);
      expect(result1.triggered).toBe(true);
      
      // 第二次不应该触发
      const result2 = checkSeductionBonus(player, '灯笼鬼', '三尾狐');
      expect(result2.bonus).toBe(0);
      expect(result2.triggered).toBe(false);
    });

    it('对女性目标后再对非女性目标仍可触发', () => {
      // 先对女性目标（不触发）
      const result1 = checkSeductionBonus(player, '雪女', '三尾狐');
      expect(result1.triggered).toBe(false);
      
      // 然后对非女性目标（应该触发）
      const result2 = checkSeductionBonus(player, '天邪鬼赤', '三尾狐');
      expect(result2.bonus).toBe(1);
      expect(result2.triggered).toBe(true);
    });
  });
});

// ============================================
// #13 鲤鱼精「泡泡之盾」测试 (自动触发)
// ============================================
describe('鲤鱼精「泡泡之盾」', () => {
  let player: PlayerState;

  beforeEach(() => {
    player = createTestPlayer();
  });

  describe('🟢 正常流程', () => {
    it('鲤鱼精可以触发泡泡之盾', () => {
      const canTrigger = checkBubbleShield(player, '鲤鱼精');
      expect(canTrigger).toBe(true);
    });

    it('非鲤鱼精不能触发', () => {
      const canTrigger = checkBubbleShield(player, '妖刀姬');
      expect(canTrigger).toBe(false);
    });
  });

  describe('🔴 边界条件', () => {
    it('本回合只能触发一次', () => {
      // 第一次可以触发
      expect(checkBubbleShield(player, '鲤鱼精')).toBe(true);
      
      // 标记已触发
      markBubbleShieldTriggered(player);
      
      // 第二次不能触发
      expect(checkBubbleShield(player, '鲤鱼精')).toBe(false);
    });
  });
});

// ============================================
// #14 萤草「生花」测试
// ============================================
describe('萤草「生花」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.shikigamiState = [{ cardId: 'shikigami_014', isExhausted: false, markers: {} }];
    player.deck = [createTestCard('spell'), createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 放置种子', () => {
    it('消耗鬼火放置1枚种子', async () => {
      const result = await executeSkill('生花', {
        player, gameState, shikigamiIndex: 0
      }, 0);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBe(1);
    });

    it('弃置妖怪牌放置1枚种子', async () => {
      player.hand = [createTestCard('yokai', '灯笼鬼')];

      const result = await executeSkill('生花', {
        player, gameState, shikigamiIndex: 0
      }, 1);

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0);
      expect(player.discard.length).toBe(1);
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBe(1);
    });

    it('同回合可各使用1次', async () => {
      player.hand = [createTestCard('yokai')];

      // 使用鬼火
      const r1 = await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 0);
      expect(r1.success).toBe(true);
      
      // 使用妖怪牌
      const r2 = await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 1);
      expect(r2.success).toBe(true);
      
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBe(2);
    });
  });

  describe('🔴 边界条件', () => {
    it('同回合不能重复使用鬼火方式', async () => {
      await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 0);
      
      const result = await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 0);
      expect(result.success).toBe(false);
      expect(result.message).toContain('已使用');
    });

    it('没有妖怪牌时无法使用弃置方式', async () => {
      player.hand = [createTestCard('spell')]; // 只有符咒牌

      const result = await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 1);
      expect(result.success).toBe(false);
      expect(result.message).toContain('没有妖怪牌');
    });

    it('鬼火不足时无法使用鬼火方式', async () => {
      player.ghostFire = 0;

      const result = await executeSkill('生花', { player, gameState, shikigamiIndex: 0 }, 0);
      expect(result.success).toBe(false);
    });
  });

  describe('🟢 回合开始移除种子', () => {
    it('移除所有种子获得抓牌', async () => {
      player.shikigamiState[0]!.markers['祝福种子'] = 3;
      
      const result = await activateBlessingSeedsOnTurnStart(player, 0, async (count) => ({
        draw: count, damage: 0
      }));
      
      expect(player.hand.length).toBe(3);
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBeUndefined();
      expect(result.message).toContain('抓牌+3');
    });

    it('可分配为伤害', async () => {
      player.shikigamiState[0]!.markers['祝福种子'] = 2;
      
      await activateBlessingSeedsOnTurnStart(player, 0, async (count) => ({
        draw: 0, damage: count
      }));
      
      expect(player.damage).toBe(2);
    });

    it('没有种子时不触发', async () => {
      const result = await activateBlessingSeedsOnTurnStart(player, 0);
      expect(result.message).toBe('');
    });
  });

  describe('🟢 妨害免疫', () => {
    it('有种子时可以免疫妨害', () => {
      player.shikigamiState[0]!.markers['祝福种子'] = 2;
      
      const immune = checkBlessingSeedProtection(player, 0);
      
      expect(immune).toBe(true);
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBe(1);
    });

    it('没有种子时无法免疫', () => {
      const immune = checkBlessingSeedProtection(player, 0);
      expect(immune).toBe(false);
    });

    it('最后一枚种子被移除', () => {
      player.shikigamiState[0]!.markers['祝福种子'] = 1;
      
      const immune = checkBlessingSeedProtection(player, 0);
      
      expect(immune).toBe(true);
      expect(player.shikigamiState[0]?.markers['祝福种子']).toBeUndefined();
    });
  });
});

// ============================================
// #10 追月神「明月潮升」测试 (触发技)
// ============================================
describe('追月神「明月潮升」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
  });

  describe('🟢 触发条件判定', () => {
    it('抓牌达到3张时触发', () => {
      expect(checkMoonTideCondition(player, 3, true)).toBe(true);
    });

    it('抓牌超过3张也触发', () => {
      expect(checkMoonTideCondition(player, 5, true)).toBe(true);
    });

    it('抓牌不足3张不触发', () => {
      expect(checkMoonTideCondition(player, 2, true)).toBe(false);
    });

    it('没有追月神不触发', () => {
      expect(checkMoonTideCondition(player, 3, false)).toBe(false);
    });
  });

  describe('🟢 效果选择', () => {
    it('选择鬼火+1', async () => {
      player.ghostFire = 2;

      const result = await executeSkill('明月潮升', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(result.message).toContain('鬼火+1');
    });

    it('选择伤害+1', async () => {
      const result = await executeSkill('明月潮升', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 1
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(1);
      expect(result.message).toContain('伤害+1');
    });

    it('选择超度1张手牌', async () => {
      player.hand = [createTestCard('spell', '测试牌')];

      const result = await executeSkill('明月潮升', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 2,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(0);
      expect(player.exiled.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('选择超度但无手牌时改为鬼火+1', async () => {
      player.hand = [];
      player.ghostFire = 2;

      const result = await executeSkill('明月潮升', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 2
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(result.message).toContain('改为鬼火+1');
    });

    it('鬼火已满时仍可选择鬼火+1（但不超上限）', async () => {
      player.ghostFire = 5;
      player.maxGhostFire = 5;

      const result = await executeSkill('明月潮升', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(5); // 不超过上限
    });
  });
});

// ============================================
// #16 食发鬼「真实之颜」测试
// ============================================
describe('食发鬼「真实之颜」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('移除妖怪并补充新妖怪（生命-1）', async () => {
      // 场上放置妖怪
      const yokai1 = createTestCard('yokai', '灯笼鬼');
      yokai1.hp = 3;
      yokai1.maxHp = 3;
      gameState.field.yokaiSlots[0] = yokai1;
      
      // 牌库中准备新妖怪
      const newYokai = createTestCard('yokai', '天邪鬼赤');
      newYokai.hp = 4;
      newYokai.maxHp = 4;
      gameState.field.yokaiDeck = [newYokai];

      const result = await executeSkill('真实之颜', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      // 新妖怪生命-1
      expect(gameState.field.yokaiSlots[0]?.hp).toBe(3); // 4 - 1 = 3
    });

    it('移除最多3个妖怪', async () => {
      // 场上放置4个妖怪
      for (let i = 0; i < 4; i++) {
        const yokai = createTestCard('yokai', `妖怪${i}`);
        yokai.hp = 2;
        gameState.field.yokaiSlots[i] = yokai;
      }
      
      // 牌库中准备新妖怪
      for (let i = 0; i < 5; i++) {
        const newYokai = createTestCard('yokai', `新妖怪${i}`);
        newYokai.hp = 3;
        gameState.field.yokaiDeck.push(newYokai);
      }

      const result = await executeSkill('真实之颜', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      // 应该只移除3个，补充3个
      expect(result.message).toContain('移除3个妖怪');
    });
  });

  describe('🔴 边界条件', () => {
    it('场上没有妖怪时失败', async () => {
      gameState.field.yokaiSlots = [null, null, null, null, null, null];

      const result = await executeSkill('真实之颜', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(3); // 退还
    });

    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;
      gameState.field.yokaiSlots[0] = createTestCard('yokai');

      const result = await executeSkill('真实之颜', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });

    it('新妖怪生命最低为1', async () => {
      const yokai = createTestCard('yokai', '弱小妖怪');
      yokai.hp = 1;
      yokai.maxHp = 1;
      gameState.field.yokaiSlots[0] = yokai;
      
      const newYokai = createTestCard('yokai', '新妖怪');
      newYokai.hp = 1;
      newYokai.maxHp = 1;
      gameState.field.yokaiDeck = [newYokai];

      const result = await executeSkill('真实之颜', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      // 生命-1后不低于1
      expect(gameState.field.yokaiSlots[0]?.hp).toBe(1);
    });
  });
});

// ============================================
// #15 独眼小僧「金刚经」测试 (永久被动)
// ============================================
describe('独眼小僧「金刚经」', () => {
  describe('🟢 正常流程', () => {
    it('非自己回合时，生命<5的妖怪生命+1', () => {
      const result = applyKongoukyouEffect(4, false, true);
      expect(result).toBe(5); // 4 + 1 = 5
    });

    it('非自己回合时，生命=1的妖怪生命+1', () => {
      const result = applyKongoukyouEffect(1, false, true);
      expect(result).toBe(2);
    });

    it('生命=5时不生效', () => {
      const result = applyKongoukyouEffect(5, false, true);
      expect(result).toBe(5); // 不变
    });

    it('生命>5时不生效', () => {
      const result = applyKongoukyouEffect(8, false, true);
      expect(result).toBe(8); // 不变
    });
  });

  describe('🔴 边界条件', () => {
    it('自己回合时不生效', () => {
      const result = applyKongoukyouEffect(3, true, true);
      expect(result).toBe(3); // 不变
    });

    it('没有独眼小僧时不生效', () => {
      const result = applyKongoukyouEffect(3, false, false);
      expect(result).toBe(3); // 不变
    });

    it('生命=0时生效（变为1）', () => {
      // 理论上生命不会为0，但边界测试
      const result = applyKongoukyouEffect(0, false, true);
      expect(result).toBe(1);
    });
  });
});

// ============================================
// #7 百目鬼「诅咒之眼」测试 🔷
// ============================================
describe('百目鬼「诅咒之眼」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('所有玩家弃置1张手牌，然后抓牌+1', async () => {
      player.hand = [createTestCard('spell', '我的牌')];

      const result = await executeSkill('诅咒之眼', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      // 弃置1张，抓1张，净手牌不变
      expect(player.discard.length).toBe(1);
      expect(result.message).toContain('妨害');
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;

      const result = await executeSkill('诅咒之眼', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #9 般若「嫉恨之心」测试
// ============================================
describe('般若「嫉恨之心」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.deck = [createTestCard('yokai', '牌库顶牌')];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('弃置牌库顶并选择置入手牌', async () => {
      const result = await executeSkill('嫉恨之心', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 0 // 置入手牌
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.hand.length).toBe(1);
      expect(player.hand[0]?.name).toBe('牌库顶牌');
    });

    it('弃置牌库顶并选择超度', async () => {
      const result = await executeSkill('嫉恨之心', {
        player, gameState, shikigamiIndex: 0,
        onChoice: async () => 1 // 超度
      });

      expect(result.success).toBe(true);
      expect(player.exiled.length).toBe(1);
    });
  });

  describe('🔴 边界条件', () => {
    it('牌库为空时仍成功', async () => {
      player.deck = [];

      const result = await executeSkill('嫉恨之心', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// #12 食梦貘「沉睡」测试 🔷
// ============================================
describe('食梦貘「沉睡」', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.deck = [
      createTestCard('spell'),
      createTestCard('spell'),
      createTestCard('spell'),
      createTestCard('spell'),
      createTestCard('spell')
    ];
    gameState = createTestGameState(player);
  });

  describe('🟢 正常流程', () => {
    it('抓牌+4并进入沉睡状态', async () => {
      const result = await executeSkill('沉睡', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.hand.length).toBe(4);
      expect(isInSleepingState(player)).toBe(true);
    });
  });

  describe('🟢 沉睡状态', () => {
    it('沉睡状态下受到妨害先弃置1张手牌', () => {
      player.hand = [createTestCard('spell', '手牌1'), createTestCard('spell', '手牌2')];
      player.tempBuffs.push({ type: 'SLEEPING' as any, value: 0, duration: -1, source: '沉睡' } as any);

      handleSleepingHarassment(player);

      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(1);
    });

    it('非沉睡状态下不额外弃牌', () => {
      player.hand = [createTestCard('spell')];

      const result = handleSleepingHarassment(player);

      expect(result).toBe(true);
      expect(player.hand.length).toBe(1);
    });

    it('回合开始时清除沉睡状态', () => {
      player.tempBuffs.push({ type: 'SLEEPING' as any, value: 0, duration: -1, source: '沉睡' } as any);

      clearSleepingState(player);

      expect(isInSleepingState(player)).toBe(false);
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 0;

      const result = await executeSkill('沉睡', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #19 丑时之女「草人替身」测试 🔷
// ============================================
describe('丑时之女「草人替身」', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.id = 'player1';
    opponent = createTestPlayer();
    opponent.id = 'opponent1';
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 草人替身触发', () => {
    it('首次妨害时抓牌+1', () => {
      player.deck = [createTestCard('spell')];

      expect(checkStrawDollTrigger(player)).toBe(true);
      triggerStrawDollDraw(player);

      expect(player.hand.length).toBe(1);
      // 第二次不触发
      expect(checkStrawDollTrigger(player)).toBe(false);
    });
  });

  describe('🟢 主动技能', () => {
    it('给予对手1张手牌', async () => {
      player.hand = [createTestCard('spell', '要给的牌')];

      const result = await executeSkill('草人替身', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      expect(player.hand.length).toBe(0);
      expect(opponent.hand.length).toBe(1);
      expect(opponent.hand[0]?.name).toBe('要给的牌');
    });
  });

  describe('🔴 边界条件', () => {
    it('没有手牌时失败', async () => {
      player.hand = [];

      const result = await executeSkill('草人替身', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(3); // 退还
    });
  });
});

// ============================================
// #22 铁鼠「横财护身」测试 🔷
// ============================================
describe('铁鼠「横财护身」', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.id = 'player1';
    opponent = createTestPlayer();
    opponent.id = 'opponent1';
    opponent.deck = [createTestCard('spell', '阴阳术1'), createTestCard('yokai', '妖怪1')];
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 正常流程', () => {
    it('对手弃置库顶2张牌，获取阴阳术', async () => {
      const result = await executeSkill('横财护身', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(1);
      // 对手弃置了2张牌
      expect(opponent.discard.length).toBe(1); // 1张被我们拿走了
      // 我们获取了1张阴阳术到弃牌堆
      expect(player.discard.length).toBe(1);
      expect(player.discard[0]?.cardType).toBe('spell');
    });

    it('对手没有阴阳术时不获取', async () => {
      opponent.deck = [createTestCard('yokai'), createTestCard('yokai')];

      const result = await executeSkill('横财护身', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(true);
      expect(player.discard.length).toBe(0);
      expect(result.message).toContain('无阴阳术');
    });
  });

  describe('🔴 边界条件', () => {
    it('鬼火不足时失败', async () => {
      player.ghostFire = 1;

      const result = await executeSkill('横财护身', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});

// ============================================
// #17 巫蛊师「迷魂蛊」测试 🔷
// ============================================
describe('巫蛊师「迷魂蛊」', () => {
  let player: PlayerState;
  let opponent: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 3 });
    player.id = 'player1';
    opponent = createTestPlayer();
    opponent.id = 'opponent1';
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 正常流程', () => {
    it('交换手牌（生命差距≤2）', async () => {
      const myCard = createTestCard('yokai', '我的妖怪');
      myCard.hp = 3;
      player.hand = [myCard];

      const oppCard = createTestCard('yokai', '对手妖怪');
      oppCard.hp = 4; // 差距1，符合条件
      opponent.hand = [oppCard];

      const result = await executeSkill('迷魂蛊', {
        player, gameState, shikigamiIndex: 0,
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2);
      expect(player.hand[0]?.name).toBe('对手妖怪');
      expect(opponent.hand[0]?.name).toBe('我的妖怪');
    });
  });

  describe('🔴 边界条件', () => {
    it('生命差距>2时失败', async () => {
      const myCard = createTestCard('yokai', '我的妖怪');
      myCard.hp = 1;
      player.hand = [myCard];

      const oppCard = createTestCard('yokai', '对手妖怪');
      oppCard.hp = 5; // 差距4，不符合条件
      opponent.hand = [oppCard];

      const result = await executeSkill('迷魂蛊', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(3); // 退还
    });

    it('没有对手时失败', async () => {
      player.hand = [createTestCard('yokai')];
      gameState.players = [player]; // 只有自己

      const result = await executeSkill('迷魂蛊', {
        player, gameState, shikigamiIndex: 0
      });

      expect(result.success).toBe(false);
    });
  });
});
