
/**
 * 御魂传说 - 游戏状态类型定义
 * @file shared/types/game.ts
 */

import type { CardInstance, OnmyojiCard, ShikigamiCard, BossCard } from './cards';

// ============ 游戏阶段 ============

/** 游戏整体阶段 */
export type GamePhase = 'waiting' | 'setup' | 'playing' | 'ended';

/** 回合内阶段 */
export type TurnPhase = 
  | 'start'       // 回合开始（鬼火+1）
  | 'summon'      // 召唤阶段（可选：召唤/置换式神）
  | 'action'      // 行动阶段（打牌、使用技能）
  | 'combat'      // 退治阶段（分配伤害）
  | 'buy'         // 购买阶段（购买令牌/妖怪）
  | 'cleanup'     // 清理阶段（弃牌、抓牌）
  | 'end';        // 回合结束

// ============ 玩家状态 ============

export interface PlayerState {
  id: string;
  name: string;
  
  // 角色
  onmyoji: OnmyojiCard | null;
  shikigami: ShikigamiCard[];
  
  // 资源
  ghostFire: number;        // 当前鬼火
  maxGhostFire: number;     // 鬼火上限（默认5）
  spellPower: number;       // 当前咒力（回合内累加）
  
  // 牌区
  hand: CardInstance[];           // 手牌
  deck: CardInstance[];           // 牌库
  discard: CardInstance[];        // 弃牌堆
  played: CardInstance[];         // 本回合已打出的牌
  exiled: CardInstance[];         // 超度区（移出游戏）
  
  // 统计
  totalCharm: number;       // 符咒总计（胜利点数）
  cardsPlayed: number;      // 本回合已打出卡牌数
  
  // 状态
  isConnected: boolean;
  isReady: boolean;
  
  // 式神状态
  shikigamiState: ShikigamiState[];
}

export interface ShikigamiState {
  cardId: string;
  isExhausted: boolean;     // 是否已行动
  markers: Record<string, number>;  // 指示物（如酒气、会心、红枫娃娃等）
}

// ============ 战场状态 ============

export interface FieldState {
  // 战场妖怪区（6张）
  yokaiSlots: (CardInstance | null)[];
  
  // 鬼王区
  currentBoss: BossCard | null;
  bossHp: number;
  bossDeck: BossCard[];
  
  // 商店区
  tokenShop: {
    token1: number;   // 招福达摩剩余
    token3: number;   // 大吉达摩剩余
    token6: number;   // 奉为达摩剩余
  };
  
  // 恶评堆
  penaltyPile: CardInstance[];
  
  // 游荡妖怪牌库
  yokaiDeck: CardInstance[];
}

// ============ 游戏状态 ============

export interface GameState {
  // 基础信息
  roomId: string;
  phase: GamePhase;
  
  // 玩家
  players: PlayerState[];
  currentPlayerIndex: number;
  turnNumber: number;
  
  // 回合内状态
  turnPhase: TurnPhase;
  
  // 战场
  field: FieldState;
  
  // 游戏日志
  log: GameLogEntry[];
  
  // 时间戳
  lastUpdate: number;
}

// ============ 游戏日志 ============

export type GameLogType = 
  | 'game_start'
  | 'turn_start'
  | 'turn_end'
  | 'play_card'
  | 'use_skill'
  | 'attack'
  | 'kill'
  | 'buy'
  | 'draw'
  | 'discard'
  | 'exile'
  | 'boss_arrival'
  | 'boss_defeated'
  | 'game_end';

export interface GameLogEntry {
  type: GameLogType;
  playerId?: string;
  playerName?: string;
  cardName?: string;
  targetName?: string;
  value?: number;
  message: string;
  timestamp: number;
}

// ============ 游戏动作 ============

export type GameAction = 
  | { type: 'PLAY_CARD'; cardInstanceId: string }
  | { type: 'USE_SKILL'; shikigamiId: string; targetId?: string }
  | { type: 'ATTACK'; targetId: string; damage: number }
  | { type: 'BUY_TOKEN'; tokenType: 'token1' | 'token3' | 'token6' }
  | { type: 'BUY_YOKAI'; slotIndex: number }
  | { type: 'END_PHASE' }
  | { type: 'END_TURN' }
  | { type: 'SUMMON_SHIKIGAMI'; shikigamiId: string }
  | { type: 'REPLACE_SHIKIGAMI'; oldId: string; newId: string };

// ============ 游戏事件 ============

export type GameEvent =
  | { type: 'GAME_STARTED'; state: GameState }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'TURN_CHANGED'; playerId: string }
  | { type: 'CARD_PLAYED'; playerId: string; card: CardInstance }
  | { type: 'CARD_DRAWN'; playerId: string; count: number }
  | { type: 'DAMAGE_DEALT'; targetId: string; damage: number }
  | { type: 'UNIT_KILLED'; targetId: string; killerId: string }
  | { type: 'BOSS_ARRIVAL'; boss: BossCard }
  | { type: 'BOSS_DEFEATED'; boss: BossCard; playerId: string }
  | { type: 'GAME_ENDED'; winner: string; scores: Record<string, number> };

// ============ 初始化配置 ============

export interface GameConfig {
  playerCount: number;
  yokaiPerType: number;
  tokenCounts: {
    token1: number;
    token3: number;
    token6: number;
  };
  penaltyCounts: {
    penalty1: number;
    penalty2: number;
  };
  startingHandSize: number;
  startingShikigamiCount: number;
}
