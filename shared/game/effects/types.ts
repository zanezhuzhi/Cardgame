
/**
 * 御魂传说 - 效果系统类型定义
 * @file shared/game/effects/types.ts
 */

import type { CardInstance } from '../../types/cards';
import type { PlayerState, GameState } from '../../types/game';

// ============ 效果类型 ============

/** 基础效果类型 */
export type EffectType =
  | 'DRAW'           // 抓牌
  | 'GHOST_FIRE'     // 获得鬼火
  | 'SPELL_POWER'    // 获得咒力
  | 'DAMAGE'         // 造成伤害
  | 'HEAL'           // 恢复生命（妖怪）
  | 'DISCARD'        // 弃置
  | 'EXILE'          // 超度
  | 'GAIN_CARD'      // 获得卡牌
  | 'PUT_TOP'        // 置于牌库顶
  | 'PUT_BOTTOM'     // 置于牌库底
  | 'REVEAL'         // 展示牌库顶
  | 'ARMOR'          // 护甲变化
  | 'MARKER'         // 放置/移除指示物
  | 'ATTACK_BONUS'   // 伤害加成
  | 'SHUFFLE'        // 洗牌
  | 'REFRESH'        // 刷新战场
  | 'INTERFERE'      // 妨害（影响其他玩家）
  | 'CONDITIONAL'    // 条件效果
  | 'CHOICE'         // 选择效果
  | 'CUSTOM';        // 自定义效果

/** 目标类型 */
export type TargetType =
  | 'SELF'           // 自己
  | 'PLAYER'         // 指定玩家
  | 'ALL_PLAYERS'    // 所有玩家
  | 'OTHER_PLAYERS'  // 其他玩家
  | 'YOKAI'          // 战场妖怪
  | 'ALL_YOKAI'      // 所有战场妖怪
  | 'BOSS'           // 鬼王
  | 'UNIT'           // 任意单位（妖怪或鬼王）
  | 'HAND_CARD'      // 手牌
  | 'DECK_TOP'       // 牌库顶
  | 'DISCARD_PILE'   // 弃牌堆
  | 'SHIKIGAMI';     // 式神

// ============ 效果定义 ============

/** 基础效果接口 */
export interface BaseEffect {
  type: EffectType;
  value?: number;
  target?: TargetType;
  condition?: EffectCondition;
}

/** 抓牌效果 */
export interface DrawEffect extends BaseEffect {
  type: 'DRAW';
  value: number;  // 抓牌数量
}

/** 鬼火效果 */
export interface GhostFireEffect extends BaseEffect {
  type: 'GHOST_FIRE';
  value: number;  // 鬼火变化量
}

/** 咒力效果 */
export interface SpellPowerEffect extends BaseEffect {
  type: 'SPELL_POWER';
  value: number;  // 咒力变化量
}

/** 伤害效果 */
export interface DamageEffect extends BaseEffect {
  type: 'DAMAGE';
  value: number;  // 伤害值
  target: TargetType;
  targetId?: string;  // 具体目标ID
}

/** 弃置效果 */
export interface DiscardEffect extends BaseEffect {
  type: 'DISCARD';
  value: number;  // 弃置数量
  target: TargetType;
  random?: boolean;  // 是否随机
}

/** 超度效果 */
export interface ExileEffect extends BaseEffect {
  type: 'EXILE';
  value: number;
  target: TargetType;
}

/** 护甲效果 */
export interface ArmorEffect extends BaseEffect {
  type: 'ARMOR';
  value: number;  // 护甲变化量
  target: TargetType;
  targetId?: string;
}

/** 指示物效果 */
export interface MarkerEffect extends BaseEffect {
  type: 'MARKER';
  markerName: string;  // 指示物名称
  value: number;       // 变化量（正数添加，负数移除）
  target: TargetType;
}

/** 伤害加成效果 */
export interface AttackBonusEffect extends BaseEffect {
  type: 'ATTACK_BONUS';
  value: number;
  duration: 'turn' | 'permanent';
}

/** 条件效果 */
export interface ConditionalEffect extends BaseEffect {
  type: 'CONDITIONAL';
  condition: EffectCondition;
  thenEffects: Effect[];
  elseEffects?: Effect[];
}

/** 选择效果 */
export interface ChoiceEffect extends BaseEffect {
  type: 'CHOICE';
  options: {
    label: string;
    effects: Effect[];
  }[];
}

/** 妨害效果 */
export interface InterfereEffect extends BaseEffect {
  type: 'INTERFERE';
  subEffects: Effect[];
  target: 'OTHER_PLAYERS' | 'ALL_PLAYERS';
}

/** 联合效果类型 */
export type Effect =
  | DrawEffect
  | GhostFireEffect
  | SpellPowerEffect
  | DamageEffect
  | DiscardEffect
  | ExileEffect
  | ArmorEffect
  | MarkerEffect
  | AttackBonusEffect
  | ConditionalEffect
  | ChoiceEffect
  | InterfereEffect
  | BaseEffect;

// ============ 条件系统 ============

export type ConditionType =
  | 'HAND_COUNT'        // 手牌数量
  | 'DECK_COUNT'        // 牌库数量
  | 'DISCARD_COUNT'     // 弃牌堆数量
  | 'GHOST_FIRE'        // 鬼火数量
  | 'SPELL_POWER'       // 咒力数量
  | 'CARDS_PLAYED'      // 本回合已打牌数
  | 'SHIKIGAMI_COUNT'   // 式神数量
  | 'HAS_MARKER'        // 是否有指示物
  | 'TARGET_HP'         // 目标生命值
  | 'FIRST_ATTACK'      // 是否首次攻击
  | 'CARD_TYPE'         // 卡牌类型
  | 'ALWAYS';           // 总是满足

export interface EffectCondition {
  type: ConditionType;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: number | string;
}

// ============ 效果上下文 ============

export interface EffectContext {
  /** 当前游戏状态 */
  gameState: GameState;
  /** 效果触发者 */
  sourcePlayer: PlayerState;
  /** 触发的卡牌 */
  sourceCard?: CardInstance;
  /** 目标玩家 */
  targetPlayer?: PlayerState;
  /** 目标卡牌/单位 */
  targetCard?: CardInstance;
  /** 回合内累计伤害加成 */
  turnDamageBonus: number;
  /** 回合内累计抓牌加成 */
  turnDrawBonus: number;
  /** 是否为首次攻击 */
  isFirstAttack: boolean;
  /** 用户选择回调 */
  onChoice?: (options: string[]) => Promise<number>;
  /** 目标选择回调 */
  onSelectTarget?: (targets: CardInstance[]) => Promise<string>;
}

// ============ 效果执行结果 ============

export interface EffectResult {
  success: boolean;
  effects: ExecutedEffect[];
  message?: string;
}

export interface ExecutedEffect {
  type: EffectType;
  value?: number;
  targetId?: string;
  description: string;
}
