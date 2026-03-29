/**
 * 御魂传说 - 卡牌数据加载器
 * @file shared/data/loader.ts
 * @version 0.3 - 阴阳术系统
 */

import type {
  CardDatabase,
  OnmyojiCard,
  ShikigamiCard,
  SpellCard,
  TokenCard,
  PenaltyCard,
  BossCard,
  YokaiCard,
  CardInstance,
  CardType
} from '../types/cards';

import type { GameConfig } from '../types/game';

import { resolveYokaiKeywords } from '../game/cardKeywords';

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

/** 获取所有阴阳术卡 */
export function getAllSpells(): SpellCard[] {
  return cardDatabase.spell;
}

/** 根据等级获取阴阳术 */
export function getSpellsByTier(tier: 'basic' | 'medium' | 'advanced'): SpellCard[] {
  const tierMap = {
    basic: '基础术式',
    medium: '中级符咒',
    advanced: '高级符咒'
  };
  return cardDatabase.spell.filter(s => s.name === tierMap[tier]);
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

/** 根据玩家数量过滤妖怪（移除纸人标记卡） */
export function getYokaiForPlayerCount(playerCount: number): YokaiCard[] {
  if (playerCount >= 5) {
    return cardDatabase.yokai; // 5人以上使用全部妖怪
  }
  // 4人及以下移除多人专属卡
  return cardDatabase.yokai.filter(y => !y.multiPlayer);
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

/** 游戏常量 */
export const GAME_CONSTANTS = cardDatabase.gameConstants;

/** 根据玩家数量获取游戏配置 */
export function getGameConfig(playerCount: number): GameConfig {
  const key = `${playerCount}players` as keyof typeof cardDatabase.gameSetup;
  const setup = cardDatabase.gameSetup[key] || cardDatabase.gameSetup['4players'];
  
  return {
    playerCount,
    yokaiPerType: setup.yokaiPerType,
    tokenCounts: {
      fortuneDaruma: setup.fortuneDaruma,
    },
    penaltyCounts: {
      farmer: setup.farmer,
      warrior: setup.warrior || 0,
    },
    startingHandSize: cardDatabase.playerSetup.handSize,
    startingShikigamiCount: cardDatabase.playerSetup.shikigamiCount,
    maxGhostFire: GAME_CONSTANTS.maxGhostFire,
    ghostFirePerTurn: GAME_CONSTANTS.ghostFirePerTurn,
    yokaiSlots: GAME_CONSTANTS.yokaiSlots,
    maxShikigami: GAME_CONSTANTS.maxShikigami,
  };
}

// ============ 卡牌实例化 ============

let instanceCounter = 0;

/** 生成唯一实例ID */
function generateInstanceId(): string {
  return `card_${Date.now()}_${++instanceCounter}`;
}

/** 从阴阳术卡创建实例 */
export function createSpellInstance(card: SpellCard): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'spell',
    name: card.name,
    hp: card.hp,
    maxHp: card.hp,
    damage: card.damage,
    charm: card.charm,
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
    charm: card.charm,
    image: card.image,
  };
}

/** 从恶评卡创建实例 */
export function createPenaltyInstance(card: PenaltyCard): CardInstance {
  const ch = card.charm;
  return {
    instanceId: generateInstanceId(),
    cardId: card.id,
    cardType: 'penalty',
    name: card.name,
    hp: 0,
    maxHp: 0,
    charm: typeof ch === 'number' ? ch : -1,
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
    charm: card.charm || 0,
    effect: card.effect,
    keywords: resolveYokaiKeywords(card),
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
    effect: card.effect,
    image: card.image,
  };
}

// ============ 初始牌库生成 ============

/** 生成玩家初始牌库（6基础术式 + 4招福达摩） */
export function createStartingDeck(): CardInstance[] {
  const deck: CardInstance[] = [];
  const setup = cardDatabase.playerSetup.startingDeck;
  
  // 添加基础术式（6张）
  const basicSpell = cardDatabase.spell.find(c => c.name === setup.spell.name);
  if (basicSpell) {
    for (let i = 0; i < setup.spell.count; i++) {
      deck.push(createSpellInstance(basicSpell));
    }
  }
  
  // 添加招福达摩（4张）
  const fortuneDaruma = cardDatabase.token.find(c => c.name === setup.token.name);
  if (fortuneDaruma) {
    for (let i = 0; i < setup.token.count; i++) {
      deck.push(createTokenInstance(fortuneDaruma));
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
    spell: cardDatabase.spell.reduce((sum, c) => sum + c.count, 0),
    token: cardDatabase.token.reduce((sum, c) => sum + c.count, 0),
    penalty: cardDatabase.penalty.reduce((sum, c) => sum + c.count, 0),
    boss: cardDatabase.boss.length,
    yokai: cardDatabase.yokai.length,
  }
};

console.log('[CardLoader] 卡牌数据加载完成:', DATA_SUMMARY);