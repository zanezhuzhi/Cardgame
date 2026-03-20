/**
 * 御魂传说 - 效果系统类型定义 v2
 * @file shared/game/effects/types.ts
 */

import type { CardInstance } from '../../types/cards';
import type { PlayerState, GameState } from '../../types/game';

// ============ 原子效果（直接修改状态）============

export type AtomEffectType =
  | 'DRAW'           // 抓牌+N
  | 'GHOST_FIRE'     // 鬼火+N / -N
  | 'DAMAGE'         // 累积伤害+N
  | 'DISCARD'        // 弃置N张手牌（自选 or 随机）
  | 'EXILE_HAND'     // 超度N张手牌
  | 'GAIN_SPELL'     // 获得阴阳术（basic/medium/advanced）
  | 'GAIN_PENALTY'   // 获得恶评（farmer/warrior）
  | 'PUT_TOP'        // 将手牌/展示牌置于牌库顶
  | 'PUT_BOTTOM'     // 将手牌置于牌库底
  | 'REVEAL_TOP'     // 展示牌库顶N张
  | 'MARKER_ADD'     // 放置指示物
  | 'MARKER_REMOVE'  // 移除指示物
  | 'KILL_YOKAI'     // 直接退治指定妖怪（忽略HP）
  | 'HEAL_YOKAI'     // 恢复妖怪生命
  | 'SKIP_CLEANUP'   // 跳过清理阶段
  | 'INTERFERE';     // 妨害（对其他玩家）

// ============ 效果定义 ============

export interface BaseAtomEffect {
  type: AtomEffectType;
}

export interface DrawEffect extends BaseAtomEffect {
  type: 'DRAW';
  count: number;
}

export interface GhostFireEffect extends BaseAtomEffect {
  type: 'GHOST_FIRE';
  value: number;  // 正=获得，负=消耗
}

export interface DamageEffect extends BaseAtomEffect {
  type: 'DAMAGE';
  value: number;
}

export interface DiscardEffect extends BaseAtomEffect {
  type: 'DISCARD';
  count: number;
  random?: boolean;   // true=随机弃，false=玩家自选
  target?: 'SELF' | 'OTHER_PLAYERS' | 'ALL_PLAYERS';
}

export interface ExileHandEffect extends BaseAtomEffect {
  type: 'EXILE_HAND';
  count: number;
}

export interface GainSpellEffect extends BaseAtomEffect {
  type: 'GAIN_SPELL';
  tier: 'basic' | 'medium' | 'advanced';
}

export interface GainPenaltyEffect extends BaseAtomEffect {
  type: 'GAIN_PENALTY';
  penaltyType: 'farmer' | 'warrior';
  target: 'SELF' | 'OTHER_PLAYERS' | 'ALL_PLAYERS';
}

export interface MarkerAddEffect extends BaseAtomEffect {
  type: 'MARKER_ADD';
  markerKey: string;  // e.g. 'sake', 'seed', 'sleep'
  count: number;
  max?: number;
}

export interface MarkerRemoveEffect extends BaseAtomEffect {
  type: 'MARKER_REMOVE';
  markerKey: string;
  count: number | 'ALL';
}

export interface KillYokaiEffect extends BaseAtomEffect {
  type: 'KILL_YOKAI';
  maxHp: number;   // 只能退治生命不高于maxHp的妖怪
}

export interface InterfereEffect extends BaseAtomEffect {
  type: 'INTERFERE';
  subEffects: AtomEffect[];
  target: 'OTHER_PLAYERS' | 'ALL_PLAYERS';
}

export type AtomEffect =
  | DrawEffect
  | GhostFireEffect
  | DamageEffect
  | DiscardEffect
  | ExileHandEffect
  | GainSpellEffect
  | GainPenaltyEffect
  | MarkerAddEffect
  | MarkerRemoveEffect
  | KillYokaiEffect
  | InterfereEffect;

// ============ 复合效果（条件/选择）============

/** 选择一项执行 */
export interface ChoiceEffect {
  type: 'CHOICE';
  options: {
    label: string;
    effects: CardEffect[];
  }[];
}

/** 条件效果 */
export interface ConditionalEffect {
  type: 'CONDITIONAL';
  condition: EffectCondition;
  thenEffects: CardEffect[];
  elseEffects?: CardEffect[];
}

/** 卡牌效果（原子 or 复合） */
export type CardEffect = AtomEffect | ChoiceEffect | ConditionalEffect;

// ============ 条件系统 ============

export type ConditionKey =
  | 'CARDS_PLAYED_THIS_TURN'    // 本回合已打出牌数
  | 'YOKAI_PLAYED_THIS_TURN'    // 本回合已打出御魂数
  | 'SPELL_PLAYED_THIS_TURN'    // 本回合已打出阴阳术数
  | 'DISCARD_EMPTY'             // 弃牌堆为空
  | 'HAND_COUNT'                // 手牌数量
  | 'GHOST_FIRE'                // 当前鬼火
  | 'MARKER_COUNT'              // 指示物数量
  | 'IS_FIRST_CARD';            // 是否为本回合第一张牌

export interface EffectCondition {
  key: ConditionKey;
  markerKey?: string;           // 当key=MARKER_COUNT时使用
  op: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: number;
}

// ============ 效果上下文 ============

export interface EffectContext {
  gameState: GameState;
  player: PlayerState;        // 效果触发者
  sourceCard?: CardInstance;  // 触发效果的卡牌
  // 异步交互回调（UI层提供）
  onChoice?: (options: string[]) => Promise<number>;
  onSelectTarget?: (candidates: CardInstance[]) => Promise<string>;
  onSelectCards?: (candidates: CardInstance[], count: number) => Promise<string[]>;
}

// ============ 触发器 ============

export type TriggerType =
  | 'ON_PLAY'         // 打出时
  | 'ON_EXILE'        // 超度时
  | 'ON_DISCARD'      // 弃置时
  | 'ON_DRAW'         // 抓到时
  | 'ON_KILL_YOKAI'   // 退治妖怪时
  | 'ON_TURN_START'   // 回合开始
  | 'ON_INTERFERE'    // 受到妨害时
  | 'PASSIVE';        // 被动（永久生效）

export interface CardEffectDef {
  cardId: string;
  effectType: '启' | '触' | '永' | '自';
  trigger: TriggerType;
  skillName?: string;
  cost?: { ghostFire?: number };
  effects: CardEffect[];
  description: string;
}