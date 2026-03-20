/**
 * 御魂传说 - 卡牌类型定义
 * @file shared/types/cards.ts
 * @version 0.3 - 根据规则书更新
 */

// ============ 基础类型 ============

/** 卡牌类型枚举 */
export type CardType = 'onmyoji' | 'shikigami' | 'spell' | 'token' | 'penalty' | 'boss' | 'yokai';

/** 卡牌子类型（效果标签） */
export type CardSubtype = '御魂' | '鬼火' | '令牌' | '妨害' | '持续';

/** 效果类型标记 */
export type EffectType = '启' | '触' | '永' | '妖' | '自';

// ============ 阴阳师卡 ============

/** 阴阳师卡 - 只有名称和形象，无技能（为了玩家平衡） */
export interface OnmyojiCard {
  id: string;
  name: string;
  type: 'onmyoji';
  image: string;
}

// ============ 式神卡 ============

export interface ShikigamiSkill {
  name: string;
  cost: number;        // 鬼火消耗
  effect: string;
  effectType: EffectType;  // 效果类型【启】【触】等
}

export interface ShikigamiPassive {
  name: string;
  effect: string;
  effectType: EffectType;
}

type ShikigamiRarity = 'SSR' | 'SR' | 'R';

export interface ShikigamiCard {
  id: string;
  name: string;
  type: 'shikigami';
  rarity: ShikigamiRarity;
  category: string;
  charm: number;           // 声誉值 (SSR=3, SR=2, R=1)
  passive: ShikigamiPassive;
  skill: ShikigamiSkill;
  multiPlayer?: boolean;   // 是否为多人游戏卡（纸人符号）
  image: string;
}

// ============ 阴阳术卡 ============

export interface SpellCard {
  id: string;
  name: string;
  type: 'spell';
  hp: number;              // 生命值（用于退治判定）
  damage: number;          // 伤害值
  charm: number;           // 声誉值
  effect?: string;         // 特殊效果
  count: number;
  image: string;
}

// ============ 令牌卡（招福达摩） ============

export interface TokenCard {
  id: string;
  name: string;
  type: 'token';
  hp: number;              // 生命值
  charm: number;           // 声誉值
  count: number;
  image: string;
}

// ============ 恶评卡 ============

export interface PenaltyCard {
  id: string;
  name: string;
  type: 'penalty';
  hp: number;              // 生命值
  charm: number;           // 声誉值（负数）
  count: number;
  image: string;
}

// ============ 鬼王卡 ============

export type BossStage = 1 | 2 | 3;

export interface BossCard {
  id: string;
  name: string;
  type: 'boss';
  stage: BossStage;        // 阶段 Ⅰ/Ⅱ/Ⅲ
  hp: number;              // 生命值
  charm: number;           // 声誉值
  arrivalEffect: string;   // 来袭效果
  yokaiEffect: string;     // 御魂效果（击败后获得）
  multiPlayer?: boolean;   // 是否为多人游戏卡（纸人符号）
  image: string;
}

// ============ 游荡妖怪卡 ============

export interface YokaiCard {
  id: string;
  name: string;
  type: 'yokai';
  hp: number;              // 生命值
  charm: number;           // 声誉值
  keywords: string[];      // 关键词标签 [御魂, 妨害, 持续...]
  effect: string;          // 效果描述
  effectType: EffectType;  // 效果类型
  fieldEffect?: string;    // 【妖】作为游荡妖怪时的效果
  multiPlayer?: boolean;   // 是否为多人游戏卡（纸人符号）
  image: string;
}

// ============ 联合类型 ============

/** 所有御魂卡（可进入玩家牌库的卡） */
export type YuhunCard = SpellCard | TokenCard | PenaltyCard | YokaiCard | BossCard;

/** 所有卡牌类型 */
export type AnyCard = OnmyojiCard | ShikigamiCard | YuhunCard;

// ============ 运行时卡牌实例 ============

/** 卡牌实例（游戏中的具体一张牌） */
export interface CardInstance {
  instanceId: string;       // 唯一实例ID
  cardId: string;          // 原型卡牌ID
  cardType: CardType;      // 卡牌类型
  name: string;            // 卡牌名称
  hp: number;              // 最大生命值（妖怪/鬼王）
  maxHp: number;           // 最大生命值（兼容）
  currentHp?: number;      // 当前生命值（战场上的妖怪受伤后会减少，回合结束恢复）
  damage?: number;         // 伤害值（阴阳术）
  charm?: number;          // 声誉值
  effect?: string;         // 效果描述
  keywords?: string[];     // 关键词标签
  image: string;           // 图片
  // 状态标记
  isExhausted?: boolean;   // 是否已行动
  markers?: Record<string, number>; // 指示物
}

// ============ 数据库结构 ============

export interface PlayerSetup {
  startingDeck: {
    spell: { name: string; count: number };   // 基础术式
    token: { name: string; count: number };   // 招福达摩
  };
  handSize: number;
  shikigamiDraw: number;     // 抽几张式神
  shikigamiKeep: number;     // 保留几张式神
}

export interface GameSetupConfig {
  yokaiPerType: number;
  fortuneDaruma: number;       // 招福达摩数量
  farmer: number;              // 农夫恶评数量
  warrior?: number;            // 武士恶评数量
}

export interface GameConstants {
  maxGhostFire: number;        // 鬼火上限
  ghostFirePerTurn: number;    // 每回合获得鬼火
  yokaiSlots: number;          // 战场妖怪槽位
  maxShikigami: number;        // 式神上限
}

export interface CardDatabase {
  version: string;
  totalCards: number;
  onmyoji: OnmyojiCard[];
  shikigami: ShikigamiCard[];
  spell: SpellCard[];
  token: TokenCard[];
  penalty: PenaltyCard[];
  boss: BossCard[];
  yokai: YokaiCard[];
  playerSetup: PlayerSetup;
  gameSetup: {
    '2players': GameSetupConfig;
    '3players': GameSetupConfig;
    '4players': GameSetupConfig;
    '5players': GameSetupConfig;
    '6players': GameSetupConfig;
  };
  gameConstants: GameConstants;
}
