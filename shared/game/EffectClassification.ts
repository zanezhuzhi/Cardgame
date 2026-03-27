/**
 * 御魂传说 - 效果分类系统
 * @file shared/game/EffectClassification.ts
 * @description 实现妨害/来袭效果的分类标记，支持青女房等防御机制
 */

// ============ 效果分类类型 ============

/**
 * 效果分类类型
 * @description 用于区分不同类型的效果，青女房可以防御妨害和来袭
 */
export type EffectCategory = 
  | 'normal'      // 普通效果（无法防御）
  | 'harassment'  // 妨害效果（对其他玩家的负面影响）
  | 'bossRaid';   // 鬼王来袭效果（翻出鬼王时的全体效果）

/**
 * 效果分类信息
 */
export interface EffectClassification {
  /** 效果所属卡牌ID */
  cardId: string;
  /** 效果所属卡牌名称 */
  cardName: string;
  /** 效果分类 */
  category: EffectCategory;
  /** 效果描述 */
  description?: string;
}

// ============ 已注册的妨害效果 ============

/**
 * 妨害效果卡牌列表
 * @description 这些卡牌的效果属于[妨害]类型，可被青女房/铮/萤草等防御
 */
export const HARASSMENT_CARDS: EffectClassification[] = [
  // 妖怪卡 - 妨害效果
  { cardId: 'yokai_007', cardName: '赤舌', category: 'harassment', description: '对手从弃牌堆选牌置于牌库顶' },
  { cardId: 'yokai_008', cardName: '魅妖', category: 'harassment', description: '使用对手牌库顶符合条件的效果' },
  { cardId: 'yokai_018', cardName: '雪幽魂', category: 'harassment', description: '对手弃置恶评或获得恶评' },
  { cardId: 'yokai_016', cardName: '魍魉之匣', category: 'harassment', description: '每名对手获得1张恶评' },
  { cardId: 'yokai_024', cardName: '返魂香', category: 'harassment', description: '对手弃置手牌或获得恶评' },
  { cardId: 'yokai_025', cardName: '镇墓兽', category: 'harassment', description: '指定禁止退治的目标' },
  { cardId: 'yokai_030', cardName: '飞缘魔', category: 'harassment', description: '使用当前鬼王效果（可能是妨害）' },
  { cardId: 'yokai_034', cardName: '幽谷响', category: 'harassment', description: '使用对手牌库顶至多3张效果' },
  
  // 式神技能 - 妨害效果
  { cardId: 'shikigami_007', cardName: '百目鬼', category: 'harassment', description: '所有玩家弃置1张手牌' },
  { cardId: 'shikigami_009', cardName: '般若', category: 'harassment', description: '所有玩家弃置牌库顶牌' },
  { cardId: 'shikigami_017', cardName: '巫蛊师', category: 'harassment', description: '交换对手手牌' },
  { cardId: 'shikigami_019', cardName: '丑时之女', category: 'harassment', description: '给对手牌，其他对手获得恶评' },
  { cardId: 'shikigami_022', cardName: '铁鼠', category: 'harassment', description: '对手弃置牌库顶2张' },
];

// ============ 鬼王来袭效果 ============

/**
 * 鬼王来袭效果列表
 * @description 鬼王翻出时的【来袭】效果，可被青女房防御
 */
export const BOSS_RAID_EFFECTS: EffectClassification[] = [
  { cardId: 'boss_001', cardName: '土蜘蛛', category: 'bossRaid', description: '每名玩家获得1张恶评' },
  { cardId: 'boss_002', cardName: '八岐大蛇', category: 'bossRaid', description: '每名玩家弃置2张手牌' },
  { cardId: 'boss_003', cardName: '鬼切', category: 'bossRaid', description: '每名玩家超度1张手牌' },
  // 可扩展更多鬼王...
];

// ============ 效果分类查询函数 ============

/**
 * 检查卡牌效果是否为妨害类型
 * @param cardId 卡牌ID
 * @returns true 表示是妨害效果
 */
export function isHarassmentEffect(cardId: string): boolean {
  return HARASSMENT_CARDS.some(card => card.cardId === cardId);
}

/**
 * 检查卡牌效果是否为鬼王来袭类型
 * @param cardId 卡牌ID
 * @returns true 表示是来袭效果
 */
export function isBossRaidEffect(cardId: string): boolean {
  return BOSS_RAID_EFFECTS.some(boss => boss.cardId === cardId);
}

/**
 * 获取卡牌的效果分类
 * @param cardId 卡牌ID
 * @returns 效果分类，未找到返回 'normal'
 */
export function getEffectCategory(cardId: string): EffectCategory {
  if (isHarassmentEffect(cardId)) return 'harassment';
  if (isBossRaidEffect(cardId)) return 'bossRaid';
  return 'normal';
}

/**
 * 获取卡牌的效果分类信息
 * @param cardId 卡牌ID
 * @returns 完整分类信息，未找到返回 undefined
 */
export function getEffectClassification(cardId: string): EffectClassification | undefined {
  return HARASSMENT_CARDS.find(card => card.cardId === cardId) 
      || BOSS_RAID_EFFECTS.find(boss => boss.cardId === cardId);
}

// ============ 防御检查系统 ============

/**
 * 可防御该效果的卡牌类型
 */
export interface DefenseCard {
  /** 卡牌ID */
  cardId: string;
  /** 卡牌名称 */
  cardName: string;
  /** 可防御的效果类型 */
  defenseCategories: EffectCategory[];
  /** 防御方式 */
  defenseType: 'reveal' | 'discard';  // 展示 或 弃置
  /** 防御后是否消耗 */
  consumed: boolean;
}

/**
 * 可防御妨害/来袭的卡牌列表
 */
export const DEFENSE_CARDS: DefenseCard[] = [
  {
    cardId: 'yokai_037',
    cardName: '青女房',
    defenseCategories: ['harassment', 'bossRaid'],
    defenseType: 'reveal',
    consumed: false,  // 展示后仍在手牌
  },
  {
    cardId: 'yokai_021',
    cardName: '铮',
    defenseCategories: ['harassment'],
    defenseType: 'discard',
    consumed: true,   // 弃置后消耗
  },
  // 萤草通过移除种子防御，机制不同，不在此列表
];

/**
 * 检查玩家是否有可防御该效果的卡牌
 * @param handCards 玩家手牌（卡牌名称数组）
 * @param effectCategory 效果分类
 * @returns 可用于防御的卡牌信息数组
 */
export function getAvailableDefenses(
  handCards: string[],
  effectCategory: EffectCategory
): DefenseCard[] {
  return DEFENSE_CARDS.filter(defense => 
    defense.defenseCategories.includes(effectCategory) &&
    handCards.includes(defense.cardName)
  );
}

/**
 * 检查效果是否可被防御
 * @param effectCategory 效果分类
 * @returns true 表示该效果类型可被某些卡牌防御
 */
export function isDefendableEffect(effectCategory: EffectCategory): boolean {
  return effectCategory === 'harassment' || effectCategory === 'bossRaid';
}

// ============ 效果触发上下文 ============

/**
 * 效果触发上下文
 * @description 在触发效果时传递分类信息
 */
export interface EffectTriggerContext {
  /** 效果分类 */
  category: EffectCategory;
  /** 来源卡牌ID */
  sourceCardId: string;
  /** 来源卡牌名称 */
  sourceCardName: string;
  /** 来源玩家ID */
  sourcePlayerId: string;
  /** 效果描述 */
  description?: string;
}

/**
 * 创建效果触发上下文
 */
export function createEffectTriggerContext(
  cardId: string,
  cardName: string,
  playerId: string,
  description?: string
): EffectTriggerContext {
  return {
    category: getEffectCategory(cardId),
    sourceCardId: cardId,
    sourceCardName: cardName,
    sourcePlayerId: playerId,
    description,
  };
}
