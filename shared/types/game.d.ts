/**
 * 御魂传说 - 游戏状态类型定义
 * @file shared/types/game.ts
 * @version 0.3 - 根据规则书更新
 */
import type { CardInstance, OnmyojiCard, ShikigamiCard, BossCard } from './cards';
import type { TempBuff } from '../game/TempBuff';
/** 游戏整体阶段 */
export type GamePhase = 'waiting' | 'setup' | 'playing' | 'ended';
/** 回合内阶段 - 简化为4个阶段 */
export type TurnPhase = 'ghostFire' | 'shikigami' | 'action' | 'cleanup';
export interface PlayerState {
    id: string;
    name: string;
    onmyoji: OnmyojiCard | null;
    shikigami: ShikigamiCard[];
    maxShikigami: number;
    ghostFire: number;
    maxGhostFire: number;
    damage: number;
    hand: CardInstance[];
    deck: CardInstance[];
    discard: CardInstance[];
    played: CardInstance[];
    exiled: CardInstance[];
    totalCharm: number;
    cardsPlayed: number;
    isConnected: boolean;
    disconnectedAt?: number;
    lastActionAt?: number;
    isOfflineHosted?: boolean;
    isReady: boolean;
    /** 是否为 AI（匹配/机器人座位） */
    isAI?: boolean;
    /** AI 策略层级 */
    aiStrategy?: 'L1' | 'L2' | 'L3' | 'L4';
    shikigamiState: ShikigamiState[];
    tempBuffs: TempBuff[];
}
export interface ShikigamiState {
    cardId: string;
    isExhausted: boolean;
    markers: Record<string, number>;
}
export interface FieldState {
    yokaiSlots: (CardInstance | null)[];
    currentBoss: BossCard | null;
    bossCurrentHp: number;
    bossDeck: BossCard[];
    spellSupply: {
        basic: CardInstance | null;
        medium: CardInstance | null;
        advanced: CardInstance | null;
    };
    spellCounts: {
        basic: number;
        medium: number;
        advanced: number;
    };
    tokenShop: number;
    penaltyPile: CardInstance[];
    yokaiDeck: CardInstance[];
    shikigamiSupply?: ShikigamiCard[];
    exileZone: CardInstance[];
}
export interface GameState {
    roomId: string;
    phase: GamePhase;
    playerCount?: number;
    players: PlayerState[];
    currentPlayerIndex: number;
    turnNumber: number;
    turnPhase: TurnPhase | 'start';
    turnStartAt?: number;
    turnTimeoutMs?: number;
    field: FieldState;
    shikigamiDeck?: ShikigamiCard[];
    log: GameLogEntry[];
    lastUpdate: number;
    /** 上一玩家是否击杀了妖怪（首回合默认true，不触发刷新选项） */
    lastPlayerKilledYokai?: boolean;
    /** 是否等待当前玩家决定刷新妖怪（旧版；多人已改为自动强者离场） */
    pendingYokaiRefresh?: boolean;
    /** 当前回合是否已达成「击杀」（游荡妖怪或鬼王生命曾扣至0；用于结算上一回合击杀判定） */
    turnHadKill?: boolean;
    /** 等待玩家做出选择（御魂效果、式神技能等） */
    pendingChoice?: {
        /** 选择类型 */
        type: 'salvageChoice' | 'cardSelect' | 'yokaiTarget' | 'yokaiChoice';
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
export type GameLogType = 'game_start' | 'turn_start' | 'phase_change' | 'turn_end' | 'play_card' | 'use_skill' | 'damage_allocate' | 'defeat_yokai' | 'defeat_boss' | 'draw' | 'discard' | 'exile' | 'boss_arrival' | 'penalty' | 'game_end' | 'chat';
/** 日志引用对象类型 */
export type LogRefType = 'card' | 'shikigami' | 'boss' | 'player';
/** 日志引用对象 */
export interface LogRef {
    type: LogRefType;
    id: string;
    name: string;
    data?: any;
}
/** 日志可见性 */
export type LogVisibility = 'public' | 'private';
export interface GameLogEntry {
    type: GameLogType;
    /** 单调递增序号，保证 v-for key 唯一（避免同 ms 内多条日志与 timestamp 碰撞） */
    logSeq?: number;
    playerId?: string;
    playerName?: string;
    cardName?: string;
    targetName?: string;
    value?: number;
    message: string;
    timestamp: number;
    visibility?: LogVisibility;
    refs?: Record<string, LogRef>;
    chatData?: {
        senderId: string;
        senderName: string;
        rawContent: string;
    };
}
export type GameAction = {
    type: 'PLAY_CARD';
    cardInstanceId: string;
} | {
    type: 'USE_SKILL';
    shikigamiId: string;
    targetId?: string;
} | {
    type: 'ATTACK';
    targetId: string;
    damage: number;
} | {
    type: 'BUY_SPELL';
    spellId: string;
    exileCardIds: string[];
} | {
    type: 'CONFIRM_SHIKIGAMI';
} | {
    type: 'REPLACE_SHIKIGAMI';
    oldId: string;
    newId: string;
} | {
    type: 'DECIDE_YOKAI_REFRESH';
    refresh: boolean;
} | {
    type: 'SELECT_SHIKIGAMI';
    selectedIds: string[];
} | {
    type: 'END_TURN';
};
export type GameEvent = {
    type: 'GAME_STARTED';
    state: GameState;
} | {
    type: 'STATE_UPDATE';
    state: GameState;
} | {
    type: 'TURN_CHANGED';
    playerId: string;
} | {
    type: 'PHASE_CHANGED';
    phase: TurnPhase;
} | {
    type: 'CARD_PLAYED';
    playerId: string;
    card: CardInstance;
} | {
    type: 'CARD_DRAWN';
    playerId: string;
    count: number;
} | {
    type: 'DAMAGE_ALLOCATED';
    results: {
        targetId: string;
        damage: number;
        defeated: boolean;
    }[];
} | {
    type: 'YOKAI_DEFEATED';
    card: CardInstance;
    playerId: string;
} | {
    type: 'BOSS_ARRIVAL';
    boss: BossCard;
} | {
    type: 'BOSS_DEFEATED';
    boss: BossCard;
    playerId: string;
} | {
    type: 'GAME_ENDED';
    winner: string;
    scores: Record<string, number>;
};
export interface GameConfig {
    playerCount: number;
    removeMultiPlayerCards: boolean;
    startingSpells: number;
    startingTokens: number;
    startingHandSize: number;
    maxHandSize: number;
    shikigamiDraw: number;
    shikigamiKeep: number;
    maxShikigami: number;
    maxGhostFire: number;
    ghostFirePerTurn: number;
    yokaiSlots: number;
}
/** 默认游戏配置 */
export declare const DEFAULT_GAME_CONFIG: GameConfig;
//# sourceMappingURL=game.d.ts.map