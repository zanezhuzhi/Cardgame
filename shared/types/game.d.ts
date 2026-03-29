/**
 * 御魂传说 - 游戏状态类型定义
 * @file shared/types/game.ts
 * @version 0.3 - 根据规则书更新
 */
import type { CardInstance, OnmyojiCard, ShikigamiCard, BossCard } from './cards';
import type { TempBuff } from '../game/TempBuff';
import type { PendingChoice } from './pendingChoice';
/**
 * 伤害来源类型
 * @description 用于区分不同来源的伤害，镜姬【妖】效果需要免疫阴阳术伤害
 */
export type DamageSourceType = 'spell' | 'yokai' | 'shikigami' | 'boss' | 'token' | 'penalty' | 'other';
/**
 * 伤害池
 * @description 精细追踪当前回合各来源累积的伤害点数
 * 用于镜姬【妖】效果：只免疫阴阳术（spell）伤害，御魂/式神伤害正常生效
 */
export interface DamagePool {
    /** 阴阳术伤害（镜姬免疫） */
    spell: number;
    /** 御魂效果伤害（镜姬不免疫） */
    yokai: number;
    /** 式神技能伤害（镜姬不免疫） */
    shikigami: number;
    /** 其他来源伤害 */
    other: number;
}
/** 创建空伤害池 */
export declare function createEmptyDamagePool(): DamagePool;
/** 计算伤害池总伤害 */
export declare function getTotalDamage(pool: DamagePool): number;
/** 计算可用于指定目标的伤害（镜姬免疫spell） */
export declare function getAvailableDamageForTarget(pool: DamagePool, isImmuneToSpell: boolean): number;
/**
 * 伤害来源信息
 * @description 记录一次伤害的完整来源信息
 */
export interface DamageSource {
    /** 伤害来源类型 */
    type: DamageSourceType;
    /** 来源卡牌ID（可选） */
    cardId?: string;
    /** 来源卡牌名称（可选） */
    cardName?: string;
    /** 来源玩家ID */
    playerId: string;
}
/**
 * 伤害分配项
 * @description 描述对单个目标的伤害分配
 */
export interface DamageAllocation {
    /** 目标卡牌实例ID（游荡妖怪或鬼王） */
    targetId: string;
    /** 伤害数值 */
    damage: number;
    /** 伤害来源 */
    source: DamageSource;
}
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
    revealedDeckCards?: RevealedCard[];
    prohibitedTargets?: string[];
}
export interface ShikigamiState {
    cardId: string;
    isExhausted: boolean;
    markers: Record<string, number>;
    /** 本回合各技能已使用次数 { skillId: count } */
    skillUsesThisTurn: Record<string, number>;
    /** 状态标记（如 'sleep' 沉睡等） */
    statusFlags: string[];
}
/**
 * 已展示的牌库卡牌信息
 * @description 记录被查看过的牌库位置，用于UI展示
 */
export interface RevealedCard {
    /** 卡牌实例ID */
    instanceId: string;
    /** 牌库位置：'top'(顶), 'bottom'(底), 或具体索引 */
    position: 'top' | 'bottom' | number;
    /** 触发展示的玩家ID */
    revealedBy: string;
    /** 展示时间戳 */
    revealedAt: number;
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
/**
 * 与信息栏同源文案；仅 recipientPlayerIds 含本机时客户端显示中部提示。
 */
export interface SettlementToast {
    message: string;
    recipientPlayerIds: string[];
    /** 可选：与 GameLogEntry.logSeq 对齐便于对账 */
    logSeq?: number;
    timestamp: number;
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
    /** 多人：等待其他玩家回合外反馈时，行动阶段回合计时暂停 */
    turnTimerPaused?: boolean;
    /** 多人：暂停瞬间剩余的本回合行动可用时间（毫秒） */
    turnPausedRemainMs?: number;
    /** 多人：当前回合外反馈截止时间（Unix 毫秒），便于客户端展示 */
    outOfTurnFeedbackDeadlineAt?: number;
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
    /**
     * 当前回合各来源累积的伤害池
     * 镜姬【妖】效果：只免疫 spell 部分，yokai/shikigami 伤害正常生效
     */
    damagePool?: DamagePool;
    /** 等待玩家做出选择（御魂效果、式神技能等） */
    pendingChoice?: PendingChoice;
    settlementToast?: SettlementToast;
    /** 轮入道效果执行队列（完整执行N次，每次包含交互选择） */
    wheelMonkQueue?: WheelMonkQueue;
}
/** 轮入道效果执行队列 */
export interface WheelMonkQueue {
    /** 被弃置的御魂名称 */
    cardName: string;
    /** 被弃置的御魂卡牌ID */
    cardId: string;
    /** 剩余执行次数（初始值2） */
    remainingExecutions: number;
    /** 执行玩家ID */
    playerId: string;
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