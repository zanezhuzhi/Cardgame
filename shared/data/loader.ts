
/**
 * 御魂传说 - 卡牌数据加载器
 * @file shared/data/loader.ts
 */

import type {
  CardDatabase,
  OnmyojiCard,
  ShikigamiCard,
  GhostFireCard,
  TokenCard,
  PenaltyCard,
  BossCard,
  YokaiCard,
  CardInstance,
  CardType
} from '../types/cards';

import type { GameConfig } from '../types/game';

import cardsData from './cards.json';

// 类型断言
const cardDatabase = cardsData as CardDatabase;

// ============ 数据访问 ============

/** 获取完整卡牌数据库 */
export function getCardDatabase(): CardDatabase {
  return cardDatabase;
}

/** 获取所有阴阳师 */
export function getAllOnmyoji(): OnmyojiCard[] {
  return cardDatabase.onmyoji;
}

/** 获取所有式神 */
export function getAllShikigami(): ShikigamiCard[] {
  return cardDatabase.shikigami;
}

/** 获取所有鬼火卡 */
export function getAllGhostFire(): GhostFireCard[] {
  return cardDatabase.ghostFire;
}

/** 获取所有令牌卡 */
export function getAllTokens(): TokenCard[] {
  return cardDatabase.token;
}

/** 获取所有恶评卡 */
export function getAllPenalties(): PenaltyCard[] {
  return cardDatabase.penalty;
}

/** 获取所有鬼王 */
export function getAllBosses(): BossCard[] {
  return cardDatabase.boss;
}

/** 获取所有游荡妖怪 */
export function getAllYokai(): YokaiCard[] {
  return cardDatabase.yokai;
}

// ============ 按ID查找 ============

/** 根据ID获取阴阳师 */
export function getOnmyojiById(id: string): OnmyojiCard | undefined {
  return cardDatabase.onmyoji.find(c => c.id === id);
}

/** 根据ID获取式神 */
export function getShikigamiById(id: string): ShikigamiCard | undefined {
  return cardDatabase.shikigami.find(c => c.id === id);
}

/** 根据ID获取鬼王 */
export function getBossById(id: string): BossCard | undefined {
  return cardDatabase.boss.find(c => c.id === id);
}

/** 根据ID获取游荡妖怪 */
export function getYokaiById(id: string): YokaiCard | undefined {
  return cardDatabase.yokai.find(c => c.id === id);
}

// ============ 游戏配置 ============

/** 根据玩家数量获取游戏配置 */
export function getGameConfig(playerCount: number): GameConfig {
  const key = `${playerCount}players` as keyof typeof cardDatabase.gameSetup;
  const setup = cardDatabase.gameSetup[key] || cardDatabase.gameSetup['4players'];
  
  return {
    playerCount,
    yokaiPerType: setup.yokaiPerType,
    tokenCounts: {
      token1: setup.token1,
      token3: setup.token3,
      token6: setup.token6,
    },
    penaltyCounts: {
      penalty1: setup.penalty1,
      penalty2: setup.penalty2 || 0,
    },
    startingHandSize: cardDatabase.playerSetup.handSize,
    startingShikigamiCount: cardDatabase.playerSetup.shikigamiCount,
  };
}

// ============ 卡牌实例化 ============

let instanceCounter = 0;

/** 生成唯一实例ID */
function generateInstanceId(): string {
  return `card_${Date.now()}_${++instanceCounter}`;
}

/** 从鬼火卡创建实例 */
export function createGhostFireInstance(card: GhostFireCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'ghostFire',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    armor: card.armor,
    ghostFire: card.ghostFire,
    image: card.image,
  };
}

/** 从令牌卡创建实例 */
export function createTokenInstance(card: TokenCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'token',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    armor: card.armor,
    charm: card.charm,
    image: card.image,
  };
}

/** 从恶评卡创建实例 */
export function createPenaltyInstance(card: PenaltyCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'penalty',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    armor: card.armor,
    charm: card.charm,
    image: card.image,
  };
}

/** 从游荡妖怪创建实例 */
export function createYokaiInstance(card: YokaiCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'yokai',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    armor: card.armor,
    cost: card.cost,
    effect: card.effect,
    image: card.image,
  };
}

/** 从鬼王创建实例 */
export function createBossInstance(card: BossCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'boss',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    armor: card.armor,
    effect: card.effect,
    image: card.image,
  };
}

// ============ 初始牌库生成 ============

/** 生成玩家初始牌库 */
export function createStartingDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  const setup = cardDatabase.playerSetup.startingDeck;
  
  // 添加灯笼鬼（7张）
  const ghostFire1 = cardDatabase.ghostFire.find(c => c.name === setup.ghostFire.name);
  if (ghostFire1) {
    for (let i = 0; i < setup.ghostFire.count; i++) {
      deck.push(createGhostFireInstance(ghostFire1));
    }
  }
  
  // 添加招福达摩（3张）
  const token1 = cardDatabase.token.find(c => c.name === setup.token.name);
  if (token1) {
    for (let i = 0; i < setup.token.count; i++) {
      deck.push(createTokenInstance(token1));
    }
  }
  
  return deck;
}

/** 洗牌（Fisher-Yates算法） */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

// ============ 图片路径 ============

/** 获取卡牌图片路径 */
export function getCardImagePath(cardType: CardType, imageName: string): string {
  // 根据卡牌类型返回对应目录
  const basePath = '/assets/cards/';
  
  switch (cardType) {
    case 'shikigami':
      return `${basePath}式神${imageName.replace('式神', '')}`;
    case 'boss':
      return `${basePath}鬼王${imageName.replace('鬼王', '')}`;
    case 'yokai':
      return `${basePath}others/各${imageName}`;
    default:
      return `${basePath}${imageName}`;
  }
}

// ============ 导出数据摘要 ============

export const DATA_SUMMARY = {
  version: cardDatabase.version,
  totalCards: cardDatabase.totalCards,
  counts: {
    onmyoji: cardDatabase.onmyoji.length,
    shikigami: cardDatabase.shikigami.length,
    ghostFire: cardDatabase.ghostFire.reduce((sum, c) => sum + c.count, 0),
    token: cardDatabase.token.reduce((sum, c) => sum + c.count, 0),
    penalty: cardDatabase.penalty.reduce((sum, c) => sum + c.count, 0),
    boss: cardDatabase.boss.length,
    yokai: cardDatabase.yokai.length,
  }
};

console.log('[CardLoader] 卡牌数据加载完成:', DATA_SUMMARY);
