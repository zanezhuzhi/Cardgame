/**
 * 御魂传说 - 回合临时增益（TempBuff）系统
 * @file shared/game/TempBuff.ts
 *
 * TempBuff 是回合内有效的临时状态修饰符。
 * 每个 Buff 在回合结束的清理阶段（cleanup）被统一清空。
 *
 * 设计原则：
 *  - 所有 Buff 都是"加法器"，最终由 GameManager 在执行动作时叠加
 *  - 带计数上限的 Buff（如山童怪力）用 remainingCount 控制剩余触发次数
 *  - GameManager 读取 Buff 后若 remainingCount 归零则自动移除
 */
export type TempBuffType = 'DAMAGE_BONUS' | 'SHIKIGAMI_SKILL_DAMAGE_BONUS' | 'SPELL_DAMAGE_BONUS' | 'EXILE_KILL_DAMAGE' | 'FIRST_NON_FEMALE_DAMAGE' | 'LINKED_TARGET_DAMAGE' | 'GHOST_FIRE_BONUS' | 'NEXT_YOKAI_DOUBLE' | 'FIRST_KILL_TO_HAND' | 'DISCARD_FOR_DAMAGE' | 'SKIP_CLEANUP' | 'SKILL_COST_REDUCTION' | 'HARASS_COUNT' | 'EXTRA_TURN' | 'DRAW_BONUS' | 'KACHOU_RESIST_USED' | 'USHI_HARASS_REWARD' | 'SLEEP_STATE' | 'YUMEKUI_DREAM_SHIELD' | 'SKILL_DAMAGE_PER_FIRE' | 'KILL_DRAW_BONUS' | 'IMMUNITY_HARASSMENT';
export interface BaseTempBuff {
    type: TempBuffType;
    sourceCardId?: string;
    sourceSkill?: string;
}
export interface DamageBonusBuff extends BaseTempBuff {
    type: 'DAMAGE_BONUS';
    bonus: number;
    remainingCount: number;
}
export interface ShikigamiSkillDamageBuff extends BaseTempBuff {
    type: 'SHIKIGAMI_SKILL_DAMAGE_BONUS';
    bonus: number;
}
export interface SpellDamageBuff extends BaseTempBuff {
    type: 'SPELL_DAMAGE_BONUS';
    bonusPerSpell: number;
    remainingCount: number;
}
export interface ExileKillDamageBuff extends BaseTempBuff {
    type: 'EXILE_KILL_DAMAGE';
    bonus: number;
}
export interface FirstNonFemaleDamageBuff extends BaseTempBuff {
    type: 'FIRST_NON_FEMALE_DAMAGE';
    bonus: number;
    triggered: boolean;
}
export interface LinkedTargetDamageBuff extends BaseTempBuff {
    type: 'LINKED_TARGET_DAMAGE';
    targetInstanceId: string;
    reduction: number;
}
export interface GhostFireBonusBuff extends BaseTempBuff {
    type: 'GHOST_FIRE_BONUS';
    bonus: number;
    remainingCount: number;
}
export interface NextYokaiDoubleBuff extends BaseTempBuff {
    type: 'NEXT_YOKAI_DOUBLE';
}
export interface FirstKillToHandBuff extends BaseTempBuff {
    type: 'FIRST_KILL_TO_HAND';
    maxHp: number;
    triggered: boolean;
}
export interface DiscardForDamageBuff extends BaseTempBuff {
    type: 'DISCARD_FOR_DAMAGE';
    active: boolean;
}
export interface SkipCleanupBuff extends BaseTempBuff {
    type: 'SKIP_CLEANUP';
}
/** 式神技能鬼火消耗减少（涅槃之火） */
export interface SkillCostReductionBuff extends BaseTempBuff {
    type: 'SKILL_COST_REDUCTION';
    value: number;
    source?: string;
}
/** 本回合妨害次数追踪（HarassmentPipeline 内部使用） */
export interface HarassCountBuff extends BaseTempBuff {
    type: 'HARASS_COUNT';
    value: number;
}
/** 额外回合（追月神觉醒技） */
export interface ExtraTurnBuff extends BaseTempBuff {
    type: 'EXTRA_TURN';
}
/** 本回合抓牌额外+N */
export interface DrawBonusBuff extends BaseTempBuff {
    type: 'DRAW_BONUS';
    bonus: number;
    remainingCount: number;
}
/** 花鸟卷抵抗已使用标记（每回合限1次） */
export interface KachouResistUsedBuff extends BaseTempBuff {
    type: 'KACHOU_RESIST_USED';
}
/** 丑时之女：首次妨害时抓牌+1 */
export interface UshiHarassRewardBuff extends BaseTempBuff {
    type: 'USHI_HARASS_REWARD';
    drawBonus: number;
    triggered: boolean;
}
/** 食梦貘沉睡状态标记 */
export interface SleepStateBuff extends BaseTempBuff {
    type: 'SLEEP_STATE';
}
/** 食梦貘梦境保护（沉睡中受妨害弃牌触发） */
export interface YumekuiDreamShieldBuff extends BaseTempBuff {
    type: 'YUMEKUI_DREAM_SHIELD';
    discardCount: number;
}
/** 按鬼火数加伤（书翁墨龙） */
export interface SkillDamagePerFireBuff extends BaseTempBuff {
    type: 'SKILL_DAMAGE_PER_FIRE';
    damagePerFire: number;
    firePaid: number;
}
/** 退治妖怪时抓牌（山兔蹦跳） */
export interface KillDrawBonusBuff extends BaseTempBuff {
    type: 'KILL_DRAW_BONUS';
    drawCount: number;
    remainingCount: number;
}
/** 妨害完全免疫（青女房展示后的标记） */
export interface ImmunityHarassmentBuff extends BaseTempBuff {
    type: 'IMMUNITY_HARASSMENT';
}
export type TempBuff = DamageBonusBuff | ShikigamiSkillDamageBuff | SpellDamageBuff | ExileKillDamageBuff | FirstNonFemaleDamageBuff | LinkedTargetDamageBuff | GhostFireBonusBuff | NextYokaiDoubleBuff | FirstKillToHandBuff | DiscardForDamageBuff | SkipCleanupBuff | SkillCostReductionBuff | HarassCountBuff | ExtraTurnBuff | DrawBonusBuff | KachouResistUsedBuff | UshiHarassRewardBuff | SleepStateBuff | YumekuiDreamShieldBuff | SkillDamagePerFireBuff | KillDrawBonusBuff | ImmunityHarassmentBuff;
export declare class TempBuffManager {
    private buffs;
    constructor(initial?: TempBuff[]);
    /** 添加 Buff（addBuff / add 均可） */
    addBuff(buff: TempBuff): void;
    /** @alias addBuff */
    add(buff: TempBuff): void;
    /** 获取所有指定类型的 Buff */
    get<T extends TempBuff>(type: TempBuffType): T[];
    /** 检查是否有指定类型的 Buff */
    has(type: TempBuffType): boolean;
    /** 移除指定类型的所有 Buff */
    remove(type: TempBuffType): void;
    /** 清空所有 Buff（回合结束时调用） */
    clear(): void;
    /** 获取当前 buff 列表（写回 PlayerState 用） */
    getBuffs(): TempBuff[];
    /**
     * 消费通用伤害 bonus（DAMAGE_BONUS）
     * remainingCount > 0 时递减，-1 时永久有效
     * @returns 本次获得的额外伤害
     */
    consumeDamageBonus(): number;
    /**
     * 消费阴阳术加伤（SPELL_DAMAGE_BONUS，带次数上限）
     * @returns 本次额外伤害值
     */
    consumeSpellDamageBonus(): number;
    /** @alias consumeSpellDamageBonus（向后兼容旧名称） */
    triggerSpellDamageBonus(): number;
    /**
     * 消费御魂双倍效果（NEXT_YOKAI_DOUBLE）
     * 触发后自动移除
     * @returns true 表示本张御魂效果应×2
     */
    consumeNextYokaiDouble(): boolean;
    /** @alias consumeNextYokaiDouble */
    triggerNextYokaiDouble(): boolean;
    /**
     * 消费式神技能加伤（SHIKIGAMI_SKILL_DAMAGE_BONUS）
     * @returns 额外伤害值
     */
    triggerShikigamiSkillBonus(): number;
    /**
     * 触发超度/退治加伤（EXILE_KILL_DAMAGE，不消耗，回合内持续）
     * @returns 本次额外伤害值
     */
    triggerExileKillBonus(): number;
    /**
     * 触发首次对非女性目标加伤（三尾狐）
     * @param isFemale 目标是否为女性
     * @returns 额外伤害值
     */
    triggerFirstNonFemaleDamage(isFemale: boolean): number;
    /** 获取联动目标 Buff（大天狗） */
    getLinkedTargetBuff(): LinkedTargetDamageBuff | null;
    /**
     * 消费鬼火额外获取（GHOST_FIRE_BONUS，带次数）
     * @returns 额外鬼火值
     */
    triggerGhostFireBonus(): number;
    /**
     * 触发鬼使白首次退治置入手牌
     * @param targetHp 目标妖怪的 HP
     * @returns true 表示应该置入手牌
     */
    triggerFirstKillToHand(targetHp: number): boolean;
    /** 是否需要跳过清理阶段（食梦貘） */
    shouldSkipCleanup(): boolean;
    /**
     * 获取式神技能消耗减少量（涅槃之火）
     * 多张叠加时累加所有 value
     * @returns 总减少量（用于计算实际消耗 = 原消耗 - 返回值，最低为 0）
     */
    getSkillCostReduction(): number;
    /** 序列化（用于状态同步） */
    toJSON(): TempBuff[];
    /** 从序列化数据恢复 */
    static fromJSON(data: TempBuff[]): TempBuffManager;
}
//# sourceMappingURL=TempBuff.d.ts.map