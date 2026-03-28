/**
 * 服务端测试工具函数
 * @file server/src/game/__tests__/testUtils.ts
 * 
 * 提供创建测试用游戏实例、模拟玩家操作等基础设施
 */

import type { 
  GameState, 
  PlayerState, 
  CardInstance, 
  CardType,
  FieldState,
  TurnPhase 
} from '../../../../shared/types/game';

// ============================================================
// 卡牌创建工具
// ============================================================

let cardCounter = 0;

/**
 * 创建测试用卡牌实例
 */
export function createTestCard(
  type: CardType = 'yokai',
  name: string = 'TestCard',
  overrides: Partial<CardInstance> = {}
): CardInstance {
  cardCounter++;
  return {
    instanceId: `test-card-${cardCounter}`,
    cardId: `${type}_test_${cardCounter}`,
    cardType: type,
    name,
    hp: 5,
    maxHp: 5,
    damage: 1,
    charm: 0,
    cost: 1,
    effect: '',
    ...overrides,
  };
}

/**
 * 创建指定名称的妖怪卡牌
 */
export function createYokaiCard(name: string, overrides: Partial<CardInstance> = {}): CardInstance {
  return createTestCard('yokai', name, overrides);
}

// ============================================================
// 玩家状态创建工具
// ============================================================

let playerCounter = 0;

/**
 * 创建测试用玩家状态
 */
export function createTestPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  playerCounter++;
  return {
    id: `player-${playerCounter}`,
    oddsId: `odds-${playerCounter}`,
    name: `测试玩家${playerCounter}`,
    ghostFire: 3,
    maxGhostFire: 5,
    damage: 0,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    shikigami: [],
    shikigamiState: [],
    reputation: 0,
    tempBuffs: [],
    onmyoji: null,
    isAFK: false,
    ...overrides,
  };
}

// ============================================================
// 游戏状态创建工具
// ============================================================

/**
 * 创建测试用场地状态
 */
export function createTestField(overrides: Partial<FieldState> = {}): FieldState {
  return {
    yokaiSlots: [
      createYokaiCard('狂骨', { hp: 5, maxHp: 5, damage: 1 }),
      createYokaiCard('河童', { hp: 4, maxHp: 4, damage: 1 }),
      createYokaiCard('天邪鬼青', { hp: 3, maxHp: 3, damage: 1 }),
    ],
    bossSlot: null,
    bossPhase: 0,
    ...overrides,
  };
}

/**
 * 创建测试用游戏状态
 */
export function createTestGameState(options: {
  playerCount?: number;
  currentPlayerIndex?: number;
  turnPhase?: TurnPhase;
  yokaiSlots?: CardInstance[];
} = {}): GameState {
  const {
    playerCount = 2,
    currentPlayerIndex = 0,
    turnPhase = 'action',
    yokaiSlots,
  } = options;

  // 创建玩家
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(createTestPlayer({
      id: `player-${i + 1}`,
      name: `玩家${i + 1}`,
      // 给每个玩家一些初始手牌
      hand: [
        createYokaiCard('狂骨'),
        createYokaiCard('河童'),
      ],
      deck: [
        createTestCard('spell', '基础术式'),
        createTestCard('spell', '基础术式'),
        createTestCard('spell', '基础术式'),
      ],
    }));
  }

  return {
    players,
    field: createTestField(yokaiSlots ? { yokaiSlots } : {}),
    currentPlayerIndex,
    turnPhase,
    turnNumber: 1,
    logs: [],
    pendingChoice: null,
    gamePhase: 'playing',
  } as GameState;
}

// ============================================================
// 断言辅助函数
// ============================================================

/**
 * 验证游戏状态一致性
 * 检查：手牌/牌库/弃牌堆数量、鬼火范围、场上妖怪状态等
 */
export function assertStateConsistency(state: GameState): void {
  for (const player of state.players) {
    // 鬼火不能超过上限
    if (player.ghostFire > player.maxGhostFire) {
      throw new Error(`玩家 ${player.name} 鬼火(${player.ghostFire})超过上限(${player.maxGhostFire})`);
    }
    
    // 鬼火不能为负
    if (player.ghostFire < 0) {
      throw new Error(`玩家 ${player.name} 鬼火为负数(${player.ghostFire})`);
    }
    
    // 手牌不能超过上限
    if (player.hand.length > 10) {
      throw new Error(`玩家 ${player.name} 手牌超过上限(${player.hand.length})`);
    }
  }
  
  // 场上妖怪 HP 检查
  for (const yokai of state.field.yokaiSlots) {
    if (yokai && yokai.hp < 0) {
      throw new Error(`场上妖怪 ${yokai.name} HP 为负数(${yokai.hp})`);
    }
  }
}

/**
 * 获取玩家手牌中指定名称的卡牌
 */
export function getCardFromHand(player: PlayerState, cardName: string): CardInstance | undefined {
  return player.hand.find(c => c.name === cardName);
}

/**
 * 获取场上指定名称的妖怪
 */
export function getYokaiFromField(state: GameState, yokaiName: string): CardInstance | undefined {
  return state.field.yokaiSlots.find(y => y && y.name === yokaiName) || undefined;
}

// ============================================================
// 测试重置
// ============================================================

/**
 * 重置计数器（在 beforeEach 中调用）
 */
export function resetTestCounters(): void {
  cardCounter = 0;
  playerCounter = 0;
}