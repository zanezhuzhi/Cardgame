/**
 * 妖怪御魂效果测试
 * TDD流程：先写测试，再实现效果
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { executeYokaiEffect } from './YokaiEffects';
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

  describe('🟢 正常流程', () => {
    it('退治生命≤4的妖怪', async () => {
      const yokai = createTestCard('yokai', '灯笼鬼');
      yokai.hp = 3;
      gameState.field.yokaiSlots[0] = yokai;

      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿'),
        onSelectTarget: async (targets) => targets[0]!.instanceId
      });

      expect(result.success).toBe(true);
      expect(gameState.field.yokaiSlots[0]).toBeNull();
      expect(result.message).toContain('退治');
    });
  });

  describe('🔴 边界条件', () => {
    it('场上没有符合条件的妖怪', async () => {
      const yokai = createTestCard('yokai', '大妖怪');
      yokai.hp = 6; // 生命>4
      gameState.field.yokaiSlots[0] = yokai;

      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿')
      });

      expect(result.success).toBe(true);
      expect(gameState.field.yokaiSlots[0]).not.toBeNull();
    });

    it('场上没有妖怪', async () => {
      const result = await executeYokaiEffect('天邪鬼绿', {
        player, gameState,
        card: createTestCard('yokai', '天邪鬼绿')
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('没有符合条件');
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
    gameState = createTestGameState(player);
    gameState.players = [player, opponent];
  });

  describe('🟢 妨害效果', () => {
    it('对手弃牌堆中的招福达摩置于牌库顶', async () => {
      const daruma = createTestCard('yokai', '招福达摩');
      opponent.discard = [daruma];

      const result = await executeYokaiEffect('赤舌', {
        player, gameState,
        card: createTestCard('yokai', '赤舌')
      });

      expect(result.success).toBe(true);
      expect(opponent.discard.length).toBe(0);
      expect(opponent.deck.length).toBe(1);
      expect(result.message).toContain('妨害');
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
    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(5);
  });

  it('非首张牌伤害+3', async () => {
    // 模拟已打出牌
    player.tempBuffs.push({ type: 'CARD_PLAYED' as any, value: 0, duration: 1, source: '破势_played' } as any);

    const result = await executeYokaiEffect('破势', {
      player, gameState, card: createTestCard('yokai', '破势')
    });

    expect(result.success).toBe(true);
    expect(player.damage).toBe(3);
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
