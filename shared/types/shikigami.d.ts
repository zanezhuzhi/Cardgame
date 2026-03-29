/**
 * 御魂传说 - 式神技能引擎类型定义
 * @file shared/types/shikigami.ts
 * @version 1.0
 *
 * 本文件定义式神技能引擎（ShikigamiSkillEngine）的全部核心类型。
 * 设计文档: docs/design/shikigami-framework.md
 */
import type { PlayerState, GameState, ShikigamiState } from './game';
import type { CardInstance, ShikigamiCard, CardType } from './cards';
/** 技能触发时机枚举 */
export type SkillTriggerType = 'ACTIVE' | 'ON_TURN_START' | 'ON_DRAW' | 'ON_EXILE' | 'ON_INTERFERE' | 'ON_FIRST_HARASS' | 'ON_KILL' | 'ON_DAMAGE' | 'PASSIVE';
/** 手牌过滤条件（弃牌/超度时使用） */
export interface CardFilter {
    cardType?: CardType;
    maxHp?: number;
    minHp?: number;
}
/** 技能消耗定义 — 可辨识联合类型 */
export type SkillCostType = SkillCostGhostFire | SkillCostGhostFireVariable | SkillCostGhostFireOptional | SkillCostDiscardHand | SkillCostExileHand | SkillCostNone;
/** 固定鬼火消耗（大多数【启】技能） */
export interface SkillCostGhostFire {
    kind: 'GHOST_FIRE';
    amount: number;
}
/** 可变鬼火消耗（书翁：N≥1） */
export interface SkillCostGhostFireVariable {
    kind: 'GHOST_FIRE_VARIABLE';
    min: number;
    max?: number;
}
/** 可选追加鬼火（妖刀姬：基础2+可选1） */
export interface SkillCostGhostFireOptional {
    kind: 'GHOST_FIRE_OPTIONAL';
    base: number;
    extra: number;
}
/** 弃置手牌消耗（座敷童子/白狼） */
export interface SkillCostDiscardHand {
    kind: 'DISCARD_HAND';
    count: number | 'VARIABLE';
    filter?: CardFilter;
}
/** 超度手牌消耗（酒吞童子） */
export interface SkillCostExileHand {
    kind: 'EXILE_HAND';
    count: number;
}
/** 无消耗（被动/触发技能） */
export interface SkillCostNone {
    kind: 'NONE';
}
/**
 * 技能执行上下文
 *
 * 由 ShikigamiSkillEngine 在调用 execute() 前构建。
 * 所有外部依赖通过此接口注入，保证 shared 层可独立测试。
 */
export interface SkillContext {
    /** 游戏完整状态 */
    gameState: GameState;
    /** 技能发动者 */
    player: PlayerState;
    /** 当前式神卡牌数据 */
    shikigami: ShikigamiCard;
    /** 当前式神运行时状态 */
    shikigamiState: ShikigamiState;
    /** 式神在 player.shikigamiState 中的索引 */
    slotIndex: number;
    /** 除 player 以外的所有玩家 */
    opponents: PlayerState[];
    /**
     * 妨害抵抗链当前正在结算的「被妨害玩家」（≠ skill 发动者 ctx.player）。
     * 由 `HarassmentPipeline.resolveForSingleTarget` 在单目标结算期间写入并在结束时恢复；
     * 供服务端注入的 `onChoice` / `onSelectCards` 将 UI 归属到正确座位。未跑管线时不设置。
     */
    harassmentResistSubject?: PlayerState;
    /**
     * 选择手牌
     * @param candidates 可选卡牌列表
     * @param count 需要选择的数量
     * @param prompt 提示文案（可选）
     * @returns 选中的 instanceId 数组
     */
    onSelectCards: (candidates: CardInstance[], count: number, prompt?: string) => Promise<string[]>;
    /**
     * 选择目标（场上妖怪 / 鬼王 / 对手玩家）
     * @param candidates 可选目标列表
     * @param prompt 提示文案
     * @returns 选中目标的 id（CardInstance.instanceId 或 PlayerState.id）
     */
    onSelectTarget: (candidates: Array<CardInstance | PlayerState>, prompt?: string) => Promise<string>;
    /**
     * 多目标选择（食发鬼：至多3个妖怪）
     * @param candidates 可选目标列表
     * @param maxCount 最多选择几个
     * @param prompt 提示文案
     * @returns 选中目标的 id 数组
     */
    onSelectMultiTargets: (candidates: CardInstance[], maxCount: number, prompt?: string) => Promise<string[]>;
    /**
     * 多选一
     * @param options 选项文案列表
     * @param prompt 提示文案
     * @returns 选中的选项索引
     */
    onChoice: (options: string[], prompt?: string) => Promise<number>;
    /**
     * 输入数值（书翁的可变鬼火 N）
     * @param min 最小值
     * @param max 最大值
     * @param prompt 提示文案
     * @returns 玩家输入的数值
     */
    onInputNumber: (min: number, max: number, prompt?: string) => Promise<number>;
    /** 抓牌（自动处理牌库耗尽→洗弃牌堆、手牌上限 10） */
    drawCards: (player: PlayerState, count: number) => number;
    /**
     * 弃置手牌（主动弃置触发【触】效果）
     * @param type 'active' = 主动弃置（触发弃置效果），'rule' = 规则弃置（不触发）
     */
    discardCard: (player: PlayerState, instanceId: string, type: 'active' | 'rule') => void;
    /** 超度卡牌（手牌/弃牌堆 → 超度区） */
    exileCard: (player: PlayerState, instanceId: string) => void;
    /** 获取恶评（从恶评牌库顶取） */
    gainPenalty: (player: PlayerState) => void;
    /** 添加游戏日志 */
    addLog: (message: string) => void;
    /**
     * 发射事件（用于链式触发其他式神被动）
     * 例如：退治妖怪后触发鲤鱼精，超度手牌后触发巫蛊师
     */
    emitEvent: (event: SkillEvent) => Promise<void>;
}
export interface SkillResult {
    success: boolean;
    message: string;
    /** 实际支付的鬼火数（用于日志/UI 显示） */
    ghostFirePaid?: number;
    /** 是否需要立即结束回合（食梦貘入眠） */
    forceEndTurn?: boolean;
    /** 是否需要跳过清理阶段的弃牌和补牌（食梦貘沉睡） */
    skipCleanup?: boolean;
}
/**
 * 式神技能定义
 *
 * 一个式神可以有多个 ShikigamiSkillDef，例如：
 * - 酒吞童子有 2 个（储酒 + 释放）
 * - 萤草有 3 个（播种 + 开花 + 护盾）
 *
 * 每个 SkillDef 是自包含的：包含前置校验 + 执行逻辑。
 */
export interface ShikigamiSkillDef {
    /**
     * 技能唯一 ID
     * 格式: `{shikigamiId}:{技能名}`
     * 示例: 'shikigami_001:杀戮', 'shikigami_003:储酒'
     */
    skillId: string;
    /** 所属式神 cardId（如 'shikigami_001'） */
    shikigamiId: string;
    /** 技能名称（中文，用于日志和 UI） */
    name: string;
    /** 技能类型标记 */
    effectType: '启' | '触' | '自' | '永';
    /** 触发时机 */
    trigger: SkillTriggerType;
    /** 消耗定义 */
    cost: SkillCostType;
    /** 是否为妨害技能（需经过 HarassmentPipeline） */
    isHarassment: boolean;
    /**
     * 每回合使用限制
     * - 1 = 每回合限 1 次（大多数式神默认值）
     * - -1 = 无限制（被动/永久生效）
     * - N = 每回合限 N 次
     */
    usesPerTurn: number;
    /** 技能效果描述（牌面原文） */
    description: string;
    /**
     * 前置校验：当前局面是否允许发动？
     *
     * 引擎在 execute 前自动调用，也供 UI 层判断按钮是否可点击。
     * @returns null = 可发动；string = 不可发动原因（如"鬼火不足"、"无合法目标"）
     */
    canUse: (ctx: SkillContext) => string | null;
    /**
     * 执行技能效果
     *
     * 此函数假定：
     * - canUse 已通过
     * - 鬼火已由引擎扣除（对于固定鬼火消耗）
     * - isExhausted 尚未标记（引擎在 execute 成功后标记）
     *
     * 可变鬼火/弃牌消耗等复杂情况由 execute 内部自行处理。
     */
    execute: (ctx: SkillContext) => Promise<SkillResult>;
}
/** 事件类型枚举 */
export type SkillEventType = 'TURN_START' | 'TURN_END' | 'CARD_PLAYED' | 'CARDS_DRAWN' | 'DAMAGE_DEALT' | 'YOKAI_KILLED' | 'BOSS_KILLED' | 'CARD_EXILED' | 'HARASSMENT_INCOMING' | 'HARASSMENT_INITIATED' | 'CLEANUP_PHASE';
/** 基础事件 */
export interface SkillEvent {
    type: SkillEventType;
    /** 事件发起者 playerId */
    sourcePlayerId: string;
    /** 事件携带数据 */
    data?: Record<string, unknown>;
}
/** 抓牌事件 */
export interface DrawEvent extends SkillEvent {
    type: 'CARDS_DRAWN';
    data: {
        count: number;
        totalThisTurn: number;
        source: string;
    };
}
/** 退治事件 */
export interface KillEvent extends SkillEvent {
    type: 'YOKAI_KILLED';
    data: {
        killedCard: CardInstance;
        isFirstKill: boolean;
        killedHp: number;
    };
}
/** 造成伤害事件 */
export interface DamageDealtEvent extends SkillEvent {
    type: 'DAMAGE_DEALT';
    data: {
        targetInstanceId: string;
        targetName: string;
        amount: number;
        isFemale: boolean;
        isFirstDamage: boolean;
    };
}
/** 超度事件 */
export interface ExileEvent extends SkillEvent {
    type: 'CARD_EXILED';
    data: {
        exiledCard: CardInstance;
        source: 'hand' | 'discard' | 'field';
    };
}
/** 妨害来袭事件 */
export interface HarassmentIncomingEvent extends SkillEvent {
    type: 'HARASSMENT_INCOMING';
    data: {
        harasserId: string;
        skillName: string;
        targetId: string;
    };
}
/** 妨害发起事件 */
export interface HarassmentInitiatedEvent extends SkillEvent {
    type: 'HARASSMENT_INITIATED';
    data: {
        skillName: string;
        isFirstHarass: boolean;
    };
}
/** 事件监听器类型 */
export type SkillEventListener = (event: SkillEvent, ctx: SkillContext) => Promise<void>;
/** 指示物（Marker）定义 */
export interface MarkerSchema {
    /** 英文标识 key（存储在 ShikigamiState.markers 中） */
    key: string;
    /** 中文展示名 */
    displayName: string;
    /** 数量上限（undefined = 无上限） */
    max?: number;
    /** 是否跨回合保留 */
    persist: boolean;
    /** 自动清理时机 */
    clearOn: 'TURN_START' | 'TURN_END' | 'MANUAL';
}
/** 全局指示物 Schema 注册表 */
export declare const MARKER_SCHEMAS: Record<string, MarkerSchema>;
/** 妨害动作定义（传给 HarassmentPipeline） */
export interface HarassmentAction {
    /** 发起妨害的玩家 ID */
    sourcePlayerId: string;
    /** 妨害来源技能名 */
    sourceSkillName: string;
    /**
     * 对单个目标执行妨害的回调
     * 只有通过抵抗检查后才会被调用
     */
    applyToTarget: (target: PlayerState, ctx: SkillContext) => Promise<void>;
}
/** 妨害抵抗结果 */
export interface HarassmentResistResult {
    /** 是否完全免疫（萤草种子） */
    immune: boolean;
    /** 抵抗前置效果日志（花鸟卷抓牌、食梦貘弃牌等） */
    preEffectLogs: string[];
}
//# sourceMappingURL=shikigami.d.ts.map