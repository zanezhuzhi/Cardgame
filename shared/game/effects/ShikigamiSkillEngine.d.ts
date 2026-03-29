/**
 * 御魂传说 - 式神技能统一执行引擎
 * @file shared/game/effects/ShikigamiSkillEngine.ts
 * @version 1.0
 *
 * 替代旧的三套并行实现：
 * - ShikigamiEffects.ts (声明式 CardEffectDef)
 * - ShikigamiSkills.ts (命令式 registerSkill)
 * - GameManager.resolveSkillEffect() (switch-case)
 *
 * 设计文档: docs/design/shikigami-framework.md
 */
import type { PlayerState } from '../../types/game';
import type { ShikigamiCard } from '../../types/cards';
import type { ShikigamiSkillDef, SkillContext, SkillResult, SkillEvent, SkillEventType, SkillEventListener } from '../../types/shikigami';
export declare class ShikigamiSkillEngine {
    /** 技能注册表 { skillId → SkillDef } */
    private readonly registry;
    /** 按 shikigamiId 索引 { shikigamiId → skillId[] } */
    private readonly shikigamiIndex;
    /** 事件总线：{ eventType → Set<listener> } */
    private readonly eventListeners;
    /**
     * 注册技能定义（游戏启动时调用）
     * @throws 如果 skillId 重复则抛出错误
     */
    registerSkillDef(def: ShikigamiSkillDef): void;
    /**
     * 批量注册技能
     */
    registerAll(defs: ShikigamiSkillDef[]): void;
    /**
     * 根据 shikigamiId 获取该式神的所有技能定义
     */
    getSkillDefs(shikigamiId: string): ShikigamiSkillDef[];
    /**
     * 根据 skillId 获取单个技能定义
     */
    getSkillDef(skillId: string): ShikigamiSkillDef | undefined;
    /**
     * 获取该式神的所有【启】主动技能
     */
    getActiveSkills(shikigamiId: string): ShikigamiSkillDef[];
    /**
     * 获取该式神的所有被动/触发技能（非 ACTIVE）
     */
    getPassiveSkills(shikigamiId: string): ShikigamiSkillDef[];
    /**
     * 检查引擎是否已注册了指定式神的技能
     */
    hasSkillDefs(shikigamiId: string): boolean;
    /** 获取已注册的技能总数 */
    get registeredCount(): number;
    /**
     * 检查技能是否可发动
     *
     * 统一检查链：
     * 1. skillId 是否存在
     * 2. 式神是否已行动（isExhausted） — 仅【启】需要
     * 3. 本回合使用次数是否达上限
     * 4. 基础鬼火是否足够（固定消耗类型）
     * 5. 技能自身的 canUse() 校验
     *
     * @returns null = 可发动；string = 不可发动原因
     */
    canUseSkill(skillId: string, ctx: SkillContext): string | null;
    /**
     * 执行主动技能（【启】）
     *
     * 调用链：
     * 1. canUseSkill() 前置校验
     * 2. 扣除鬼火（固定消耗类型由引擎统一扣除）
     * 3. def.execute() 执行技能逻辑
     * 4. 标记 isExhausted（如果 execute 成功）
     * 5. 更新技能使用计数
     */
    executeActiveSkill(skillId: string, ctx: SkillContext): Promise<SkillResult>;
    /**
     * 触发被动技能（【触】/【自】/【永】）
     *
     * 由 EventBus 的事件监听器调用。
     * 与 executeActiveSkill 不同的是：
     * - 不检查 isExhausted
     * - 不标记 isExhausted
     * - 仍检查 canUse 和使用次数
     */
    triggerPassiveSkill(skillId: string, event: SkillEvent, ctx: SkillContext): Promise<SkillResult | null>;
    /**
     * 注册事件监听器
     */
    on(eventType: SkillEventType, listener: SkillEventListener): void;
    /**
     * 移除事件监听器
     */
    off(eventType: SkillEventType, listener: SkillEventListener): void;
    /**
     * 触发事件（依次执行所有监听器，await 每个）
     */
    emit(event: SkillEvent, ctx: SkillContext): Promise<void>;
    /**
     * 清空所有事件监听器
     */
    clearListeners(): void;
    /**
     * 回合开始：重置式神状态
     *
     * - 重置 isExhausted
     * - 重置 skillUsesThisTurn
     * - 清理 clearOn='TURN_START' 的指示物（食梦貘沉睡）
     * - 清理 clearOn='TURN_END' 遗漏的指示物
     */
    onTurnStart(player: PlayerState): void;
    /**
     * 回合结束：清理回合内状态
     *
     * - 清理 clearOn='TURN_END' 的指示物
     */
    onTurnEnd(player: PlayerState): void;
    /**
     * 式神入场：注册事件监听器
     *
     * 遍历该式神的所有非 ACTIVE 技能，根据 trigger 注册对应事件监听。
     */
    onShikigamiEnter(player: PlayerState, shikigami: ShikigamiCard, buildContext: (player: PlayerState, shikigamiId: string) => SkillContext): void;
    /**
     * 式神离场：移除事件监听器
     */
    onShikigamiLeave(player: PlayerState, shikigamiId: string): void;
    /**
     * 创建默认的 ShikigamiState
     */
    static createDefaultState(cardId: string): import('../../types/game').ShikigamiState;
    /**
     * 清理指定时机的指示物
     */
    private clearMarkersOnTiming;
    /**
     * SkillTriggerType → SkillEventType 映射
     */
    private triggerToEventType;
    /**
     * 获取玩家当前的技能鬼火消耗减免值（涅槃之火效果）
     * 多个减费buff会叠加
     */
    private getSkillCostReduction;
    /** { `shikigamiId:playerId` → [eventType, listener][] } */
    private readonly listenerStore;
    private storeListener;
    /**
     * 完全重置引擎（新游戏时调用）
     */
    reset(): void;
}
/** 全局技能引擎实例 */
export declare const globalSkillEngine: ShikigamiSkillEngine;
//# sourceMappingURL=ShikigamiSkillEngine.d.ts.map