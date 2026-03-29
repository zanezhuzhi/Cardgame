/**
 * HarassmentPipeline — 妨害效果统一解算管线
 *
 * 职责：
 *   1. 遍历所有目标玩家
 *   2. 对每个目标依次检查抵抗链
 *   3. 只有未被完全免疫时，才调用 applyToTarget 执行妨害
 *   4. 如果发起者拥有丑时之女，在首次妨害成功时触发奖励
 *
 * 抵抗链优先级（高→低）：
 *   ① 手牌防御 — 青女房（展示，不消耗）/ 铮（弃置+抓牌+2）
 *   ② 式神被动 — 萤草（移除种子 → 完全免疫）
 *   ③ 式神被动 — 花鸟卷（鬼火-1 → 抓牌+2+置顶 → 仍受妨害）
 *   ④ 式神被动 — 食梦貘（沉睡中弃1牌 → 仍受妨害）
 *
 * 设计要点：
 *   - 与 ShikigamiSkillEngine 解耦：管线只依赖 PlayerState / SkillContext
 *   - 策略模式：每种抵抗能力以 ResistHandler 注册，方便未来扩展
 *   - 日志驱动：所有抵抗/免疫都产生日志供前端播放
 */
import type { PlayerState } from '../../types/game';
import type { SkillContext, HarassmentAction, HarassmentResistResult } from '../../types/shikigami';
/**
 * 单个抵抗能力的处理器
 */
export interface ResistHandler {
    /** 处理器唯一标识 */
    id: string;
    /** 优先级（数字越小越先执行） */
    priority: number;
    /**
     * 判断是否拥有此抵抗能力
     * @param target 受妨害的目标玩家
     * @param ctx 技能上下文
     * @returns true 表示拥有此能力
     */
    canResist: (target: PlayerState, ctx: SkillContext) => boolean;
    /**
     * 执行抵抗
     * @param target 受妨害的目标玩家
     * @param ctx 技能上下文
     * @returns immune = true 表示完全免疫（后续不再执行妨害）
     */
    resolve: (target: PlayerState, ctx: SkillContext) => Promise<HarassmentResistResult>;
}
/**
 * 注册一个抵抗处理器
 * 按 priority 升序自动排序
 */
export declare function registerResistHandler(handler: ResistHandler): void;
/**
 * 清空所有抵抗处理器（测试用）
 */
export declare function clearResistHandlers(): void;
/**
 * 获取当前注册的处理器列表（只读，测试用）
 */
export declare function getResistHandlers(): readonly ResistHandler[];
/**
 * 单目标妨害抵抗结果
 */
export interface TargetHarassmentResult {
    targetId: string;
    targetName: string;
    /** 是否被完全免疫 */
    immune: boolean;
    /** 免疫来源（如 '青女房' / '萤草种子'） */
    immuneSource?: string;
    /** 抵抗前置效果日志 */
    preEffectLogs: string[];
    /** 妨害是否成功执行 */
    applied: boolean;
}
/**
 * 整体妨害结果
 */
export interface HarassmentPipelineResult {
    /** 每个目标的结算结果 */
    targets: TargetHarassmentResult[];
    /** 成功被妨害的目标数 */
    affectedCount: number;
    /** 是否为发起者本回合首次妨害（用于丑时之女触发） */
    isFirstHarass: boolean;
    /** 汇总日志 */
    logs: string[];
}
/**
 * 执行妨害管线
 *
 * @param action 妨害动作定义
 * @param targets 受妨害的目标玩家列表（不含发起者自身）
 * @param ctx 技能上下文（发起者的上下文）
 * @returns 管线执行结果
 */
export declare function resolveHarassment(action: HarassmentAction, targets: PlayerState[], ctx: SkillContext): Promise<HarassmentPipelineResult>;
/**
 * 构建妨害动作（供式神技能使用）
 *
 * @example
 * ```typescript
 * const action = createHarassmentAction(
 *   ctx.player.id,
 *   '百目鬼',
 *   async (target, ctx) => {
 *     // 强制弃置1张手牌
 *     if (target.hand.length > 0) {
 *       const randomIdx = Math.floor(Math.random() * target.hand.length);
 *       const [card] = target.hand.splice(randomIdx, 1);
 *       target.discard.push(card);
 *     }
 *   }
 * );
 * const result = await resolveHarassment(action, ctx.opponents, ctx);
 * ```
 */
export declare function createHarassmentAction(sourcePlayerId: string, sourceSkillName: string, applyToTarget: (target: PlayerState, ctx: SkillContext) => Promise<void>): HarassmentAction;
//# sourceMappingURL=HarassmentPipeline.d.ts.map