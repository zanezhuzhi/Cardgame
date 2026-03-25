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

function createTestGameState(player: PlayerState): GameState {
  return {
    phase: 'action',
    currentPlayerIndex: 0,
    players: [player],
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
describe('灯笼鬼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  it('鬼火+1，抓牌+1', async () => {
    const result = await executeYokaiEffect('灯笼鬼', {
      player, gameState, card: createTestCard('yokai', '灯笼鬼')
    });

    expect(result.success).toBe(true);
    expect(player.ghostFire).toBe(3);
    expect(player.hand.length).toBe(1);
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

  it('抓牌+1，伤害+2', async () => {
    const result = await executeYokaiEffect('铮', {
      player, gameState, card: createTestCard('yokai', '铮')
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(1);
    expect(player.damage).toBe(2);
  });
});

describe('网切', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('添加生命减少buff', async () => {
    const result = await executeYokaiEffect('网切', {
      player, gameState, card: createTestCard('yokai', '网切')
    });

    expect(result.success).toBe(true);
    const buff = player.tempBuffs.find(b => (b as any).source === '网切');
    expect(buff).toBeDefined();
    expect((buff as any).yokaiReduction).toBe(1);
    expect((buff as any).bossReduction).toBe(2);
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

  it('抓牌+1，伤害=当前鬼火', async () => {
    const result = await executeYokaiEffect('狂骨', {
      player, gameState, card: createTestCard('yokai', '狂骨')
    });

    expect(result.success).toBe(true);
    expect(player.hand.length).toBe(1);
    expect(player.damage).toBe(4); // 等于鬼火数
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
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

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
    expect(player.ghostFire).toBe(4);
    expect(result.message).toContain('鬼火+2');
  });

  it('未满3张御魂时添加延迟buff', async () => {
    (player as any).played = [
      createTestCard('yokai', '薙魂')
    ];

    const result = await executeYokaiEffect('薙魂', {
      player, gameState,
      card: createTestCard('yokai', '薙魂'),
      onSelectCards: async (cards) => [cards[0]!.instanceId]
    });

    expect(result.success).toBe(true);
    expect(player.ghostFire).toBe(2);
    const buff = player.tempBuffs.find(b => (b as any).source === '薙魂');
    expect(buff).toBeDefined();
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
