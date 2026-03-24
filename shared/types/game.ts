/**
 * 御魂传说 - 游戏状态类型定义
 * @file shared/types/game.ts
 * @version 0.3 - 根据规则书更新
 */

import type { CardInstance, OnmyojiCard, ShikigamiCard, BossCard } from './cards';
import type { TempBuff } from '../game/TempBuff';

// ============ 游戏阶段 ============

/** 游戏整体阶段 */
export type GamePhase = 'waiting' | 'setup' | 'playing' | 'ended';

/** 回合内阶段 - 简化为4个阶段 */
export type TurnPhase = 
  | 'ghostFire'   // 鬼火阶段（鬼火+1）
  | 'shikigami'   // 式神调整阶段（可选）
  | 'action'      // 行动阶段（打牌、使用技能、分配伤害）
  | 'cleanup';    // 清理阶段（弃牌、抓牌、补充妖怪）

// ============ 玩家状态 ============

export interface PlayerState {
  id: string;
  name: string;
  
  // 角色
  onmyoji: OnmyojiCard | null;
  shikigami: ShikigamiCard[];
  maxShikigami: number;       // 式神上限（默认3）
  
  // 资源
  ghostFire: number;          // 当前鬼火
  maxGhostFire: number;       // 鬼火上限（固定5）
  damage: number;             // 当前累积伤害（回合内）
  
  // 牌区
  hand: CardInstance[];           // 手牌
  deck: CardInstance[];           // 牌库
  discard: CardInstance[];        // 弃牌堆
  played: CardInstance[];         // 本回合已打出的牌（旁置）
  exiled: CardInstance[];         // 超度区（移出游戏）
  
  // 统计
  totalCharm: number;         // 声誉总计（胜利点数）
  cardsPlayed: number;        // 本回合已打出卡牌数
  
  // 状态
  isConnected: boolean;
  isReady: boolean;
  
  // 式神状态
  shikigamiState: ShikigamiState[];

  // 回合临时增益（回合结束自动清空）
  tempBuffs: TempBuff[];
}

export interface ShikigamiState {
  cardId: string;
  isExhausted: boolean;     // 是否已行动
  markers: Record<string, number>;  // 指示物
}

// ============ 战场状态 ============

export interface FieldState {
  // 战场妖怪区（6张）
  yokaiSlots: (CardInstance | null)[];
  
  // 鬼王区
  currentBoss: BossCard | null;
  bossCurrentHp: number;         // 鬼王当前生命
  bossDeck: BossCard[];          // 鬼王牌库（阶段Ⅲ→Ⅱ→Ⅰ→麒麟）
  
  // 阴阳术供应区（存储实体卡牌，用于超度兑换）
  spellSupply: {
    basic:    CardInstance | null;   // 基础术式（代表牌堆，HP=1）
    medium:   CardInstance | null;   // 中级符咒（代表牌堆，HP=2）
    advanced: CardInstance | null;   // 高级符咒（代表牌堆，HP=3）
  };
  spellCounts: {
    basic: number;     // 基础术式剩余数量
    medium: number;    // 中级符咒剩余数量
    advanced: number;  // 高级符咒剩余数量
  };
  
  // 令牌商店
  tokenShop: number;        // 招福达摩剩余
  
  // 恶评堆
  penaltyPile: CardInstance[];
  
  // 游荡妖怪牌库
  yokaiDeck: CardInstance[];
  
  // 式神供应堆（商店）
  shikigamiSupply?: ShikigamiCard[];
  
  // 公共超度区
  exileZone: CardInstance[];
}

// ============ 游戏状态 ============

export interface GameState {
  // 基础信息
  roomId: string;
  phase: GamePhase;
  playerCount?: number;
  
  // 玩家
  players: PlayerState[];
  currentPlayerIndex: number;
  turnNumber: number;
  
  // 回合内状态
  turnPhase: TurnPhase | 'start';  // 支持 start 作为初始值
  
  // 战场
  field: FieldState;
  
  // 式神牌库（用于选择/置换）
  shikigamiDeck?: ShikigamiCard[];
  
  // 游戏日志
  log: GameLogEntry[];
  
  // 时间戳
  lastUpdate: number;

  // ====== 妖怪刷新规则 ======
  /** 上一玩家是否击杀了妖怪（首回合默认true，不触发刷新选项） */
  lastPlayerKilledYokai?: boolean;
  /** 是否等待当前玩家决定刷新妖怪 */
  pendingYokaiRefresh?: boolean;
  
  // ====== 玩家选择等待 ======
  /** 等待玩家做出选择（御魂效果、式神技能等） */
  pendingChoice?: {
    /** 选择类型 */
    type: 'salvageChoice' | 'cardSelect' | 'yokaiTarget';
    /** 等待的玩家ID */
    playerId: string;
    /** 选择相关的卡牌信息 */
    card?: CardInstance;
    /** 提示文本 */
    prompt?: string;
    /** 可选项 */
    options?: string[];
  };
}

// ============ 游戏日志 ============

export type GameLogType = 
  | 'game_start'
  | 'turn_start'
  | 'phase_change'
  | 'turn_end'
  | 'play_card'
  | 'use_skill'
  | 'damage_allocate'
  | 'defeat_yokai'
  | 'defeat_boss'
  | 'draw'
  | 'discard'
  | 'exile'
  | 'boss_arrival'
  | 'penalty'
  | 'game_end';

/** 日志引用对象类型 */
export type LogRefType = 'card' | 'shikigami' | 'boss' | 'player';

/** 日志引用对象 */
export interface LogRef {
  type: LogRefType;
  id: string;           // 对象ID（卡牌instanceId、式神id等）
  name: string;         // 显示名称
  data?: any;           // 可选：完整对象数据（用于离线展示）
}

/** 日志可见性 */
export type LogVisibility = 'public' | 'private';

export interface GameLogEntry {
  type: GameLogType;
  playerId?: string;
  playerName?: string;
  cardName?: string;
  targetName?: string;
  value?: number;
  message: string;
  timestamp: number;
  // 新增字段 - 消息同步控制
  visibility?: LogVisibility;           // 可见性：public=所有人，private=仅自己
  refs?: Record<string, LogRef>;        // 引用对象映射 {占位符: 对象信息}
}

// ============ 游戏动作 ============

export type GameAction = 
  // 行动阶段
  | { type: 'PLAY_CARD'; cardInstanceId: string }
  | { type: 'USE_SKILL'; shikigamiId: string; targetId?: string }
  | { type: 'ATTACK'; targetId: string; damage: number }
  | { type: 'BUY_SPELL'; spellId: string; exileCardIds: string[] }
  // 式神调整阶段
  | { type: 'CONFIRM_SHIKIGAMI' }
  | { type: 'REPLACE_SHIKIGAMI'; oldId: string; newId: string }
  // 鬼火阶段（妖怪刷新规则）
  | { type: 'DECIDE_YOKAI_REFRESH'; refresh: boolean }
  // 式神选择阶段（游戏开始前）
  | { type: 'SELECT_SHIKIGAMI'; selectedIds: string[] }
  // 回合控制
  | { type: 'END_TURN' };

// ============ 游戏事件 ============

export type GameEvent =
  | { type: 'GAME_STARTED'; state: GameState }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'TURN_CHANGED'; playerId: string }
  | { type: 'PHASE_CHANGED'; phase: TurnPhase }
  | { type: 'CARD_PLAYED'; playerId: string; card: CardInstance }
  | { type: 'CARD_DRAWN'; playerId: string; count: number }
  | { type: 'DAMAGE_ALLOCATED'; results: { targetId: string; damage: number; defeated: boolean }[] }
  | { type: 'YOKAI_DEFEATED'; card: CardInstance; playerId: string }
  | { type: 'BOSS_ARRIVAL'; boss: BossCard }
  | { type: 'BOSS_DEFEATED'; boss: BossCard; playerId: string }
  | { type: 'GAME_ENDED'; winner: string; scores: Record<string, number> };

// ============ 初始化配置 ============

export interface GameConfig {
  playerCount: number;
  removeMultiPlayerCards: boolean;  // 4人以下移除纸人符号卡
  
  // 起始牌库
  startingSpells: number;           // 基础术式数量（默认6）
  startingTokens: number;           // 招福达摩数量（默认4）
  
  // 手牌
  startingHandSize: number;         // 起始手牌（默认5）
  maxHandSize: number;              // 手牌上限（默认无限制）
  
  // 式神
  shikigamiDraw: number;            // 抽几张式神（默认4）
  shikigamiKeep: number;            // 保留几张（默认2）
  maxShikigami: number;             // 最多拥有几张（默认3）
  
  // 资源
  maxGhostFire: number;             // 鬼火上限（固定5）
  ghostFirePerTurn: number;         // 每回合获得鬼火（固定1）
  
  // 战场
  yokaiSlots: number;               // 妖怪槽位（固定6）
}

/** 默认游戏配置 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  playerCount: 2,
  removeMultiPlayerCards: true,
  startingSpells: 6,
  startingTokens: 4,
  startingHandSize: 5,
  maxHandSize: -1,
  shikigamiDraw: 4,
  shikigamiKeep: 2,
  maxShikigami: 3,
  maxGhostFire: 5,
  ghostFirePerTurn: 1,
  yokaiSlots: 6,
};