/**
 * 御魂传说 - 伤害来源系统
 * @file shared/game/DamageSystem.ts
 * @description 实现伤害来源追踪和免疫判定
 */
import type { DamageSource, DamageSourceType } from '../types/game';
export type { DamageSource, DamageSourceType };
/**
 * 检查伤害是否被目标免疫
 * @param targetCard 目标卡牌
 * @param source 伤害来源
 * @returns true 表示伤害被免疫
 */
export declare function isDamageImmune(targetCard: {
    name: string;
    cardId?: string;
}, source: DamageSource): boolean;
/**
 * 创建伤害来源对象
 * @param type 伤害类型
 * @param playerId 来源玩家
 * @param cardId 来源卡牌ID
 * @param cardName 来源卡牌名称
 */
export declare function createDamageSource(type: DamageSourceType, playerId: string, cardId?: string, cardName?: string): DamageSource;
/**
 * 根据卡牌类型推断伤害来源类型
 * @param cardType 卡牌类型
 */
export declare function inferDamageSourceType(cardType: string): DamageSourceType;
/**
 * 获取可被伤害的目标列表（过滤掉免疫的目标）
 * @param targets 所有目标
 * @param source 伤害来源
 */
export declare function getValidDamageTargets<T extends {
    name: string;
    cardId?: string;
}>(targets: T[], source: DamageSource): T[];
//# sourceMappingURL=DamageSystem.d.ts.map