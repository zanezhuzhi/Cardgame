
/**
 * 御魂传说 - 卡牌类型定义
 * @file shared/types/cards.ts
 */

// ============ 基础类型 ============

/** 卡牌类型枚举 */
export type CardType = 'onmyoji' | 'shikigami' | 'ghostFire' | 'token' | 'penalty' | 'boss' | 'yokai';

/** 卡牌子类型（效果标签） */
export type CardSubtype = '御魂' | '鬼火' | '令牌' | '妨害' | '持续';

// ============ 阴阳师卡 ============

export interface OnmyojiCard {
  id: string;
  name: string;
  type: 'onmyoji';
  skill: string;
  effect: string;
  image: string;
}

// ============ 式神卡 ============

export interface ShikigamiSkill {
  name: string;
  cost: number;
  effect: string;
}

export interface ShikigamiPassive {
  name: string;
  effect: string;
}

export interface ShikigamiCard {
  id: string;
  name: string;
  type: 'shikigami';
  category: string;
  passive: ShikigamiPassive;
  skill: ShikigamiSkill;
  image: string;
}

// ============ 鬼火卡 ============

export interface GhostFireCard {
  id: string;
  name: string;
  type: 'ghostFire';
  hp: number;
  armor: number;
  ghostFire: number;
  count: number;
  image: string;
}

// ============ 令牌卡 ============

export interface TokenCard {
  id: string;
  name: string;
  type: 'token';
  hp: number;
  armor: number;
  charm: number;
  count: number;
  image: string;
}

// ============ 恶评卡 ============

export interface PenaltyCard {
  id: string;
  name: string;
  type: 'penalty';
  hp: number;
  armor: number;
  charm: number;
  count: number;
  image: string;
}

// ============ 鬼王卡 ============

export interface BossCard {
  id: string;
  name: string;
  type: 'boss';
  hp: number;
  armor: number;
  effect: string;
  arrival: string;
  image: string;
}

// ============ 游荡妖怪卡 ============

export interface YokaiCard {
  id: string;
  name: string;
  type: 'yokai';
  cost: number;
  hp: number;
  armor: number;
  subtype: string;
  effect: string;
  image: string;
}

// ============ 联合类型 ============

/** 所有御魂卡（可进入玩家牌库的卡） */
export type YuhunCard = GhostFireCard | TokenCard | PenaltyCard | YokaiCard | BossCard;

/** 所有卡牌类型 */
export type AnyCard = OnmyojiCard | ShikigamiCard | YuhunCard;

// ============ 运行时卡牌实例 ============

/** 卡牌实例（游戏中的具体一张牌） */
export interface CardInstance {
  instanceId: string;       // 唯一实例ID
  cardId: string;          // 原型卡牌ID
  cardType: CardType;      // 卡牌类型
  name: string;            // 卡牌名称
  hp: number;              // 当前生命值
  maxHp: number;           // 最大生命值
  armor: number;           // 护甲
  cost?: number;           // 费用（妖怪）
  ghostFire?: number;      // 鬼火值
  charm?: number;          // 符咒值
  effect?: string;         // 效果描述
  image: string;           // 图片
  // 状态标记
  isExhausted?: boolean;   // 是否已行动
  markers?: Record<string, number>; // 指示物
}

// ============ 数据库结构 ============

export interface PlayerSetup {
  startingDeck: {
    ghostFire: { name: string; count: number };
    token: { name: string; count: number };
  };
  handSize: number;
  shikigamiCount: number;
}

export interface GameSetupConfig {
  yokaiPerType: number;
  token1: number;
  token3: number;
  token6: number;
  penalty1: number;
  penalty2?: number;
}

export interface CardDatabase {
  version: string;
  totalCards: number;
  onmyoji: OnmyojiCard[];
  shikigami: ShikigamiCard[];
  ghostFire: GhostFireCard[];
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
}
