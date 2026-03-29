/**
 * 鬼王效果测试
 * TDD流程验证来袭效果和御魂效果
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  executeBossArrival, 
  executeBossSoul,
  checkBossRecoveryOnTurnStart,
  recoverBossToHand,
  checkKirinEndOfTurn,
  clearOrochiEffect
} from './BossEffects';
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

function createTestCard(type: string = 'yokai', name: string = '测试卡', hp: number = 3): CardInstance {
  return {
    instanceId: `${type}_${Date.now()}_${Math.random()}`,
    cardId: `${type}_001`,
    cardType: type as any,
    name,
    hp,
    maxHp: hp
  };
}

// ============================================
// 阶段Ⅰ 鬼王测试
// ============================================
describe('麒麟', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('首张鬼王无来袭效果', async () => {
      const result = await executeBossArrival('麒麟', {
        gameState,
        bossCard: createTestCard('boss', '麒麟', 8)
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('无来袭效果');
    });
  });

  describe('🟢 御魂效果', () => {
    it('伤害+3', async () => {
      const result = await executeBossSoul('麒麟', {
        player, gameState,
        bossCard: createTestCard('boss', '麒麟', 8)
      });

      expect(result.success).toBe(true);
      expect(player.damage).toBe(3);
    });
  });

  describe('🟢 回合结束归底', () => {
    it('弃牌堆中的麒麟归底', () => {
      const kirin = createTestCard('boss', '麒麟', 8);
      player.discard = [kirin];

      const result = checkKirinEndOfTurn(player);

      expect(result).toBe(true);
      expect(player.discard.length).toBe(0);
      expect(player.deck.length).toBe(1);
      expect(player.deck[player.deck.length - 1]!.name).toBe('麒麟');
    });
  });
});

describe('石距', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('弃掉所有阴阳术', async () => {
      player.hand = [
        createTestCard('spell', '阴阳术1'),
        createTestCard('spell', '阴阳术2'),
        createTestCard('yokai', '妖怪')
      ];

      await executeBossArrival('石距', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(1); // 只剩妖怪
      expect(player.discard.length).toBe(2);
    });

    it('无阴阳术时获得恶评', async () => {
      player.hand = [createTestCard('yokai')];

      await executeBossArrival('石距', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(1);
      expect(player.discard.some(c => c.cardType === 'penalty' || c.name === '恶评')).toBe(true);
    });
  });

  describe('🟢 御魂效果', () => {
    it('鬼火+1，抓牌+1，伤害+2', async () => {
      player.ghostFire = 2;

      const result = await executeBossSoul('石距', {
        player, gameState,
        bossCard: createTestCard('boss', '石距')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(2);
    });
  });
});

describe('土蜘蛛', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell'), createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('有3张阴阳术则不弃牌', async () => {
      player.hand = [
        createTestCard('spell'),
        createTestCard('spell'),
        createTestCard('spell'),
        createTestCard('yokai')
      ];

      await executeBossArrival('土蜘蛛', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(4); // 不弃牌
    });

    it('缺1张阴阳术则弃1张手牌', async () => {
      player.hand = [
        createTestCard('spell'),
        createTestCard('spell'),
        createTestCard('yokai'),
        createTestCard('yokai')
      ];

      await executeBossArrival('土蜘蛛', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(3); // 弃1张
      expect(player.discard.length).toBe(1);
    });
  });

  describe('🟢 御魂效果', () => {
    it('抓牌+2，伤害+3', async () => {
      const result = await executeBossSoul('土蜘蛛', {
        player, gameState,
        bossCard: createTestCard('boss', '土蜘蛛')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(2);
      expect(player.damage).toBe(3);
    });
  });
});

// ============================================
// 阶段Ⅱ 鬼王测试
// ============================================
describe('蜃气楼', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('弃置手牌中生命>6的牌', async () => {
      player.hand = [
        createTestCard('yokai', '大妖怪', 8),
        createTestCard('yokai', '小妖怪', 3)
      ];

      await executeBossArrival('蜃气楼', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(1);
      expect(player.hand[0]!.name).toBe('小妖怪');
      expect(player.discard.length).toBe(1);
    });
  });

  describe('🟢 御魂效果', () => {
    it('抓牌+1，鬼火+1，伤害+1', async () => {
      const result = await executeBossSoul('蜃气楼', {
        player, gameState,
        bossCard: createTestCard('boss', '蜃气楼')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.ghostFire).toBe(3);
      expect(player.damage).toBe(1);
    });
  });

  describe('🟢 回合开始回收', () => {
    it('弃牌堆中的蜃气楼可回收', () => {
      const card = createTestCard('boss', '蜃气楼', 11);
      player.discard = [card];

      const recoverable = checkBossRecoveryOnTurnStart(player);
      expect(recoverable).not.toBeNull();

      const result = recoverBossToHand(player, recoverable!);
      expect(result).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.discard.length).toBe(0);
    });
  });
});

describe('胧车', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('超度1张御魂', async () => {
      player.hand = [
        createTestCard('yokai', '妖怪1'),
        createTestCard('spell', '阴阳术')
      ];

      await executeBossArrival('胧车', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(1);
      expect(player.exiled.length).toBe(1);
    });

    it('无御魂时获得恶评', async () => {
      player.hand = [createTestCard('spell')];

      await executeBossArrival('胧车', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.some(c => c.name === '恶评')).toBe(true);
    });
  });

  describe('🟢 御魂效果', () => {
    it('抓牌+1，伤害+3', async () => {
      const result = await executeBossSoul('胧车', {
        player, gameState,
        bossCard: createTestCard('boss', '胧车')
      });

      expect(result.success).toBe(true);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(3);
    });
  });
});

// ============================================
// 阶段Ⅲ 鬼王测试
// ============================================
describe('八岐大蛇', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer({ ghostFire: 2 });
    player.shikigamiState = [{ cardId: 'test', isExhausted: false, markers: {} }];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('弃掉生命最高的手牌', async () => {
      player.hand = [
        createTestCard('yokai', '小妖怪', 3),
        createTestCard('yokai', '大妖怪', 8),
        createTestCard('yokai', '中妖怪', 5)
      ];

      await executeBossArrival('八岐大蛇', { gameState, bossCard: createTestCard('boss') });

      expect(player.hand.length).toBe(2);
      expect(player.discard[0]!.name).toBe('大妖怪');
    });

    it('式神翻面失去能力', async () => {
      player.hand = [createTestCard('yokai')];

      await executeBossArrival('八岐大蛇', { gameState, bossCard: createTestCard('boss') });

      expect((player.shikigamiState[0] as any).flipped).toBe(true);
    });
  });

  describe('🟢 御魂效果', () => {
    it('鬼火+2，伤害+7', async () => {
      const result = await executeBossSoul('八岐大蛇', {
        player, gameState,
        bossCard: createTestCard('boss', '八岐大蛇')
      });

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(4);
      expect(player.damage).toBe(7);
    });
  });

  describe('🟢 清除翻面效果', () => {
    it('击败后式神恢复', () => {
      (player.shikigamiState[0] as any).flipped = true;

      clearOrochiEffect(gameState);

      expect((player.shikigamiState[0] as any).flipped).toBe(false);
    });
  });
});

describe('贪嗔痴', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    player.deck = [createTestCard('spell')];
    gameState = createTestGameState(player);
  });

  describe('🟢 来袭效果', () => {
    it('随机弃1张手牌', async () => {
      player.hand = [createTestCard('yokai'), createTestCard('yokai')];

      await executeBossArrival('贪嗔痴', { gameState, bossCard: createTestCard('boss') });

      // 至少弃1张（可能弃2张如果是生命最高者）
      expect(player.discard.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('🟢 御魂效果', () => {
    it('抓牌+1，超度手牌造成等同伤害', async () => {
      const yokai = createTestCard('yokai', '高生命妖怪', 6);
      player.hand = [yokai];

      const result = await executeBossSoul('贪嗔痴', {
        player, gameState,
        bossCard: createTestCard('boss', '贪嗔痴'),
        onSelectCards: async (cards) => [cards[0]!.instanceId]
      });

      expect(result.success).toBe(true);
      expect(player.exiled.length).toBe(1);
      expect(player.damage).toBe(6);
    });
  });

  describe('🟢 回合开始回收', () => {
    it('弃牌堆中的贪嗔痴可回收', () => {
      const card = createTestCard('boss', '贪嗔痴', 15);
      player.discard = [card];

      const recoverable = checkBossRecoveryOnTurnStart(player);
      expect(recoverable).not.toBeNull();
      expect(recoverable!.name).toBe('贪嗔痴');
    });
  });
});

// ============================================
// 青女房来袭防御测试
// ============================================
describe('青女房来袭防御', () => {
  let player1: PlayerState;
  let player2: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player1 = createTestPlayer({ id: 'p1', name: '玩家1' });
    player2 = createTestPlayer({ id: 'p2', name: '玩家2' });
    player1.hand = [createTestCard('yokai', '天邪鬼青')];
    player2.hand = [createTestCard('yokai', '天邪鬼青')];
    gameState = {
      phase: 'action',
      currentPlayerIndex: 0,
      players: [player1, player2],
      field: {
        yokaiSlots: [null, null, null, null, null, null],
        bossSlot: null,
        yokaiDeck: [],
        bossDeck: []
      },
      turnNumber: 1,
      log: []
    };
  });

  describe('石距来袭', () => {
    it('🟢 手牌有青女房，选择展示 → 免疫弃牌效果', async () => {
      // 给玩家1添加青女房和阴阳术
      const qingnvfang = { ...createTestCard('yokai', '青女房'), cardId: 'yokai_037' };
      const spell = createTestCard('spell', '阴阳术');
      player1.hand = [qingnvfang, spell];

      // 记录弃牌前手牌数量
      const handSizeBefore = player1.hand.length;

      // 使用 onCheckBossRaidDefense 模拟选择展示
      // 注意：回调参数是 player 对象，不是 playerId
      await executeBossArrival('石距', {
        gameState,
        bossCard: createTestCard('boss', '石距'),
        onCheckBossRaidDefense: async (player) => {
          return player.id === 'p1'; // 玩家1选择展示
        }
      });

      // 玩家1选择展示，应该免疫（手牌不变）
      expect(player1.hand.length).toBe(handSizeBefore);
      expect(player1.discard.length).toBe(0);
    });

    it('🟢 手牌有青女房，选择不展示 → 正常受到来袭效果', async () => {
      // 给玩家1添加青女房和阴阳术
      const qingnvfang = { ...createTestCard('yokai', '青女房'), cardId: 'yokai_037' };
      const spell = createTestCard('spell', '阴阳术');
      player1.hand = [qingnvfang, spell];

      await executeBossArrival('石距', {
        gameState,
        bossCard: createTestCard('boss', '石距'),
        onCheckBossRaidDefense: async () => false // 返回 false = 选择不展示
      });

      // 玩家1选择不展示，阴阳术被弃掉
      expect(player1.discard.length).toBe(1);
      expect(player1.discard[0]!.cardType).toBe('spell');
    });

    it('🔴 手牌无青女房 → 正常受到来袭效果', async () => {
      // 玩家只有阴阳术，没有青女房
      player1.hand = [createTestCard('spell', '阴阳术')];

      await executeBossArrival('石距', {
        gameState,
        bossCard: createTestCard('boss', '石距'),
        onCheckBossRaidDefense: async () => false
      });

      // 阴阳术被弃掉
      expect(player1.discard.length).toBe(1);
    });
  });

  describe('土蜘蛛来袭', () => {
    it('🟢 手牌有青女房，选择展示 → 免疫弃牌惩罚', async () => {
      const qingnvfang = { ...createTestCard('yokai', '青女房'), cardId: 'yokai_037' };
      player1.hand = [qingnvfang]; // 只有1张妖怪，不足3张阴阳术
      const handSizeBefore = player1.hand.length;

      await executeBossArrival('土蜘蛛', {
        gameState,
        bossCard: createTestCard('boss', '土蜘蛛'),
        onCheckBossRaidDefense: async (player) => player.id === 'p1'
      });

      // 玩家1免疫，手牌数不变
      expect(player1.hand.length).toBe(handSizeBefore);
    });
  });

  describe('八岐大蛇来袭', () => {
    it('🟢 手牌有青女房，选择展示 → 免疫弃牌和式神翻面', async () => {
      const qingnvfang = { ...createTestCard('yokai', '青女房'), cardId: 'yokai_037' };
      player1.hand = [qingnvfang];
      player1.shikigamiState = [{ flipped: false }] as any;
      const handSizeBefore = player1.hand.length;

      await executeBossArrival('八岐大蛇', {
        gameState,
        bossCard: createTestCard('boss', '八岐大蛇'),
        onCheckBossRaidDefense: async (player) => player.id === 'p1'
      });

      // 玩家1免疫，手牌不变
      expect(player1.hand.length).toBe(handSizeBefore);
      expect(player1.discard.length).toBe(0);
    });

    it('🟢 选择不展示 → 受到弃牌效果', async () => {
      const qingnvfang = { ...createTestCard('yokai', '青女房'), cardId: 'yokai_037' };
      player1.hand = [qingnvfang];
      player1.shikigamiState = [{ flipped: false }] as any;

      await executeBossArrival('八岐大蛇', {
        gameState,
        bossCard: createTestCard('boss', '八岐大蛇'),
        onCheckBossRaidDefense: async () => false
      });

      // 玩家1正常受到效果，青女房被弃（生命最高的牌）
      expect(player1.discard.length).toBe(1);
      expect(player1.discard[0]!.cardId).toBe('yokai_037');
    });
  });
});
