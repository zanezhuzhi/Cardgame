/**
 * 妖怪御魂效果处理器
 * 实现38种妖怪的御魂效果
 */
interface CardInstance {
    instanceId: string;
    cardId: string;
    cardType: string;
    name: string;
    hp?: number;
    maxHp?: number;
    damage?: number;
    tags?: string[];
    [key: string]: any;
}
interface PlayerState {
    id: string;
    name: string;
    deck: CardInstance[];
    hand: CardInstance[];
    discard: CardInstance[];
    exiled: CardInstance[];
    ghostFire: number;
    maxGhostFire: number;
    damage: number;
    tempBuffs: any[];
    [key: string]: any;
}
interface FieldState {
    yokaiSlots: (CardInstance | null)[];
    currentBoss?: CardInstance | null;
    boss?: CardInstance | null;
    bossMaxHp?: number;
    bossCurrentHp?: number;
    [key: string]: any;
}
interface GameState {
    players: PlayerState[];
    field: FieldState;
    [key: string]: any;
}
interface EffectResult {
    success: boolean;
    message: string;
    draw?: number;
    damage?: number;
    ghostFire?: number;
}
interface EffectContext {
    player: PlayerState;
    gameState: GameState;
    card: CardInstance;
    onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
    onChoice?: (options: string[]) => Promise<number>;
    onSelectTarget?: (targets: CardInstance[]) => Promise<string>;
}
type EffectHandler = (ctx: EffectContext) => Promise<EffectResult>;
declare const effectHandlers: Map<string, EffectHandler>;
declare function registerEffect(name: string, handler: EffectHandler): void;
export declare function executeYokaiEffect(yokaiName: string, ctx: EffectContext): Promise<EffectResult>;
declare function drawCards(player: PlayerState, count: number): number;
/** 唐纸伞妖 AI 决策（L1 规则策略） */
export declare function aiDecide_唐纸伞妖(topCard: CardInstance): number;
/** 天邪鬼绿 AI 选择（L1 规则策略）：优先退治 HP 最高的合法目标 */
export declare function aiSelect_天邪鬼绿(targets: CardInstance[]): string;
/**
 * 天邪鬼赤 AI 决策函数
 * @param hand 当前手牌
 * @returns 应弃置的卡牌 instanceId 数组（按价值升序排列后全选，即"尽可能多弃低价值牌"）
 * @description
 * - 排序规则：HP 升序 → 同 HP 按声誉升序
 * - 策略：全弃（将手牌全部换掉以滤牌），除非手牌仅 1 张且为高价值（HP≥5 或 声誉≥2）
 */
export declare function aiDecide_天邪鬼赤(hand: CardInstance[]): string[];
/**
 * 天邪鬼黄 AI 决策函数
 * @param hand 当前手牌
 * @returns 应置顶的卡牌 instanceId（选择价值最低的牌）
 * @description
 * - 排序规则：HP 升序 → 同 HP 按声誉升序
 * - 选择价值最低的一张牌置顶（减少损失，且近期会再抽到）
 */
export declare function aiDecide_天邪鬼黄(hand: CardInstance[]): string;
/**
 * 魅妖 AI 决策函数
 * @param validCards 合法展示牌列表
 * @returns 应选择的卡牌 instanceId
 * @description
 * - 优先选择能造成更高伤害的牌（damage 字段）
 * - 否则选第一张
 */
export declare function aiDecide_魅妖(validCards: CardInstance[]): string;
/**
 * 骰子鬼 AI 决策 - 选择超度手牌（L1 规则策略）
 * @param hand 可选手牌列表
 * @returns 应超度的卡牌 instanceId
 * @description
 * - 优先选择声誉最低的牌
 * - 同声誉时选择HP最高的牌（使退治范围更大）
 */
export declare function aiDecide_骰子鬼_超度(hand: CardInstance[]): string;
/**
 * 骰子鬼 AI 决策 - 选择退治目标（L1 规则策略）
 * @param targets 可选游荡妖怪列表
 * @returns 应退治的妖怪 instanceId
 * @description
 * - 优先选择声誉最高的妖怪
 * - 同声誉时选择HP最高的妖怪
 */
export declare function aiDecide_骰子鬼_退治(targets: CardInstance[]): string;
/**
 * AI决策：薙魂 - 选择弃置哪张手牌
 * 策略：弃置价值最低的牌
 * - 优先保留御魂和阴阳术
 * - 优先弃置低HP的牌
 * - 若已打出2张御魂，更优先保留御魂
 * @param hand 玩家手牌
 * @param yokaiPlayedCount 本回合已打出的御魂数量（不含当前的薙魂）
 * @returns 要弃置的卡牌instanceId
 */
export declare function aiSelect_薙魂(hand: CardInstance[], yokaiPlayedCount?: number): string;
/**
 * AI决策：雪幽魂 - 选择弃置哪张恶评
 * 策略：优先弃置声誉惩罚最低的恶评（农夫-1 优先于武士-2）
 * @param penaltyCards 对手手牌中的恶评卡
 * @returns 要弃置的卡牌instanceId，空则返回''
 */
export declare function aiDecide_雪幽魂(penaltyCards: CardInstance[]): string;
/**
 * 轮入道AI评分函数：评估弃置某张御魂执行两次效果的收益
 * 用于AI选择最优的弃置目标
 * @param card 要评估的御魂卡牌
 * @param context AI上下文（鬼火、手牌数等）
 * @returns 评分（越高越优先选择）
 */
export declare function aiDecide_轮入道(card: CardInstance, context?: {
    ghostFire?: number;
    handCount?: number;
}): number;
/**
 * 为轮入道选择最优的弃置目标
 * @param validCards 可选的御魂卡牌列表
 * @param context AI上下文
 * @returns 最优选择的卡牌instanceId
 */
export declare function aiSelect_轮入道(validCards: CardInstance[], context?: {
    ghostFire?: number;
    handCount?: number;
}): string | null;
/**
 * 伤魂鸟 AI 决策函数
 * @param hand 当前手牌列表
 * @param targetHp 目标妖怪 HP（可选，用于计算伤害缺口）
 * @param currentDamage 当前伤害（可选）
 * @returns 应超度的卡牌 instanceId 列表
 * @description
 * L1 规则策略：
 * - 优先超度：恶评卡 > HP≤3的妖怪 > 阴阳术 > 其他
 * - 根据伤害缺口决定超度数量（若目标明确）
 * - 若无明确目标，默认超度低价值牌
 */
export declare function aiDecide_伤魂鸟(hand: CardInstance[], targetHp?: number, currentDamage?: number): string[];
/**
 * 阴摩罗 AI 选牌策略
 * 按效果价值排序选择：伤害类 > 抓牌类 > 鬼火类
 */
export declare function aiDecide_阴摩罗(validCards: CardInstance[], maxCount: number): string[];
/**
 * 统一处理【触】弃置效果
 * 当卡牌被主动弃置时（非回合结束清理），触发其【触】效果
 * @param player 弃置卡牌的玩家
 * @param card 被弃置的卡牌
 * @returns 是否触发了任何效果
 */
export declare function triggerOnDiscard(player: PlayerState, card: CardInstance): boolean;
export declare function onTreeDemonDiscard(player: PlayerState, card: CardInstance): void;
export declare function onSanmiDiscard(player: PlayerState, card: CardInstance): void;
export declare function canZhengCounter(player: PlayerState): CardInstance | null;
export declare function useZhengCounter(player: PlayerState): boolean;
export declare function canQingnvfangImmune(player: PlayerState): boolean;
export { drawCards, registerEffect, effectHandlers };
/** 妖怪效果定义（兼容测试用） */
export interface YokaiEffectDef {
    cardId: string;
    cardName: string;
    effects: any[];
}
/** 从已注册的处理器生成效果定义列表 */
/** 与 cards.json 中的 yokai 数组顺序对齐（2026-03 修复映射偏移问题） */
export declare const YOKAI_EFFECT_DEFS: YokaiEffectDef[];
/** 根据卡牌ID获取效果定义 */
export declare function getYokaiEffectDef(cardId: string): YokaiEffectDef | undefined;
/** 根据名称获取效果定义 */
export declare function getYokaiEffectDefByName(name: string): YokaiEffectDef | undefined;
//# sourceMappingURL=YokaiEffects.d.ts.map