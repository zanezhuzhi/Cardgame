/**
 * 妖怪效果测试公共工具函数
 */

import { CardInstance, PlayerState, GameState } from '../../../types';

/**
 * 创建测试玩家
 */
export function createTestPlayer(options: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'test-player',
    name: 'Test',
    ghostFire: options.ghostFire ?? 3,
    maxGhostFire: 5,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    played: [],
    shikigami: [],
    shikigamiState: [],
    damage: 0,
    totalCharm: 0,
    cardsPlayed: 0,
    tempBuffs: [],
    isConnected: true,
    isReady: true,
    onmyoji: null,
    maxShikigami: 3,
    ...options
  } as PlayerState;
}

/**
 * 创建测试游戏状态
 */
export function createTestGameState(player: PlayerState, additionalPlayers: PlayerState[] = []): GameState {
  return {
    roomId: 'test-room',
    phase: 'playing',
    turnPhase: 'action',
    currentPlayerIndex: 0,
    players: [player, ...additionalPlayers],
    field: {
      yokaiSlots: [null, null, null, null, null, null],
      bossSlot: null,
      yokaiDeck: [],
      bossDeck: []
    },
    turnNumber: 1,
    log: [],
    lastUpdate: Date.now()
  } as GameState;
}

/**
 * 创建测试卡牌
 */
export function createTestCard(type: string = 'yokai', name: string = '测试卡', options: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `${type}_${Date.now()}_${Math.random()}`,
    cardId: `${type}_001`,
    cardType: type as any,
    name,
    hp: 3,
    maxHp: 3,
    image: '',
    ...options
  } as CardInstance;
}

/**
 * 创建指定名称的妖怪卡
 */
export function createYokaiCard(name: string, hp: number = 3, options: Partial<CardInstance> = {}): CardInstance {
  return createTestCard('yokai', name, { hp, maxHp: hp, ...options });
}

/**
 * 创建阴阳术卡
 */
export function createSpellCard(name: string = '基础术式', damage: number = 1): CardInstance {
  return createTestCard('spell', name, { damage, hp: 0, maxHp: 0 });
}

/**
 * 创建令牌卡
 */
export function createTokenCard(name: string = '招福达摩'): CardInstance {
  return createTestCard('token', name, { hp: 1, maxHp: 1, charm: 1 });
}

/**
 * 创建鬼王卡
 */
export function createBossCard(name: string = '测试鬼王', hp: number = 10): CardInstance {
  return createTestCard('boss', name, { hp, maxHp: hp });
}

/**
 * 创建对手玩家
 */
export function createOpponent(id: string, options: Partial<PlayerState> = {}): PlayerState {
  return createTestPlayer({
    id,
    name: `Opponent_${id}`,
    ...options
  });
}
