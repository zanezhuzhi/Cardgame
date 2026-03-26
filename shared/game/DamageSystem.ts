/**
 * 御魂传说 - 伤害来源系统
 * @file shared/game/DamageSystem.ts
 * @description 实现伤害来源追踪和免疫判定
 */

import type { DamageSource, DamageSourceType } from '../types/game';

// 重新导出类型供外部使用
export type { DamageSource, DamageSourceType };

/**
 * 检查伤害是否被目标免疫
 * @param targetCard 目标卡牌
 * @param source 伤害来源
 * @returns true 表示伤害被免疫
 */
export function isDamageImmune(
  targetCard: { name: string; cardId?: string },
  source: DamageSource
): boolean {
  // 镜姬【妖】效果：作为游荡妖怪时免疫阴阳术伤害
  if (targetCard.name === '镜姬' && source.type === 'spell') {
    return true;
  }
  
  // 可扩展：其他免疫效果...
  
  return false;
}

/**
 * 创建伤害来源对象
 * @param type 伤害类型
 * @param playerId 来源玩家
 * @param cardId 来源卡牌ID
 * @param cardName 来源卡牌名称
 */
export function createDamageSource(
  type: DamageSourceType,
  playerId: string,
  cardId?: string,
  cardName?: string
): DamageSource {
  return {
    type,
    playerId,
    cardId,
    cardName,
  };
}

/**
 * 根据卡牌类型推断伤害来源类型
 * @param cardType 卡牌类型
 */
export function inferDamageSourceType(cardType: string): DamageSourceType {
  switch (cardType) {
    case 'spell':
      return 'spell';
    case 'yokai':
      return 'yokai';
    case 'shikigami':
      return 'shikigami';
    case 'boss':
      return 'boss';
    case 'token':
      return 'token';
    case 'penalty':
      return 'penalty';
    default:
      return 'other';
  }
}

/**
 * 获取可被伤害的目标列表（过滤掉免疫的目标）
 * @param targets 所有目标
 * @param source 伤害来源
 */
export function getValidDamageTargets<T extends { name: string; cardId?: string }>(
  targets: T[],
  source: DamageSource
): T[] {
  return targets.filter(target => !isDamageImmune(target, source));
}
