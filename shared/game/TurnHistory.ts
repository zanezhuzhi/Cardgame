/**
 * 御魂传说 - 回合历史记录系统
 * @file shared/game/TurnHistory.ts
 * @description 记录回合内的关键操作，用于三味等卡牌效果的统计
 */

// ============ 回合事件类型 ============

/**
 * 打出卡牌记录
 */
export interface PlayCardRecord {
  type: 'playCard';
  /** 玩家ID */
  playerId: string;
  /** 卡牌实例ID */
  cardInstanceId: string;
  /** 卡牌ID (如 yokai_038) */
  cardId: string;
  /** 卡牌名称 */
  cardName: string;
  /** 卡牌类型 */
  cardType: 'yokai' | 'spell' | 'token' | 'penalty';
  /** 消耗的鬼火 */
  ghostFireCost: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 使用技能记录
 */
export interface UseSkillRecord {
  type: 'useSkill';
  /** 玩家ID */
  playerId: string;
  /** 式神卡牌ID */
  shikigamiId: string;
  /** 式神名称 */
  shikigamiName: string;
  /** 技能名称 */
  skillName: string;
  /** 技能类型 */
  skillType: 'qi' | 'chu' | 'zi' | 'yong';  // 启/触/自/永
  /** 消耗的鬼火 */
  ghostFireCost: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 退治妖怪记录
 */
export interface DefeatYokaiRecord {
  type: 'defeatYokai';
  /** 玩家ID */
  playerId: string;
  /** 妖怪卡牌ID */
  yokaiId: string;
  /** 妖怪名称 */
  yokaiName: string;
  /** 妖怪HP */
  yokaiHp: number;
  /** 获得声誉 */
  charmGained: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 弃置卡牌记录
 */
export interface DiscardCardRecord {
  type: 'discardCard';
  /** 玩家ID */
  playerId: string;
  /** 卡牌实例ID */
  cardInstanceId: string;
  /** 卡牌名称 */
  cardName: string;
  /** 弃置原因 */
  reason: 'manual' | 'effect' | 'cleanup';  // 主动弃置 / 效果弃置 / 回合结束
  /** 时间戳 */
  timestamp: number;
}

/**
 * 抓牌记录
 */
export interface DrawCardRecord {
  type: 'drawCard';
  /** 玩家ID */
  playerId: string;
  /** 抓牌数量 */
  count: number;
  /** 抓牌来源 */
  source: 'turnStart' | 'effect' | 'cleanup';  // 回合开始 / 效果 / 清理阶段
  /** 时间戳 */
  timestamp: number;
}

/** 所有回合事件类型的联合 */
export type TurnEvent = 
  | PlayCardRecord 
  | UseSkillRecord 
  | DefeatYokaiRecord 
  | DiscardCardRecord 
  | DrawCardRecord;

// ============ 回合历史管理器 ============

/**
 * 回合历史记录
 */
export interface TurnHistory {
  /** 回合数 */
  turnNumber: number;
  /** 当前回合玩家ID */
  activePlayerId: string;
  /** 本回合所有事件 */
  events: TurnEvent[];
  /** 回合开始时间 */
  startTime: number;
}

/**
 * 创建新的回合历史
 */
export function createTurnHistory(turnNumber: number, activePlayerId: string): TurnHistory {
  return {
    turnNumber,
    activePlayerId,
    events: [],
    startTime: Date.now(),
  };
}

// ============ 事件记录函数 ============

/**
 * 记录打出卡牌
 */
export function recordPlayCard(
  history: TurnHistory,
  playerId: string,
  cardInstanceId: string,
  cardId: string,
  cardName: string,
  cardType: 'yokai' | 'spell' | 'token' | 'penalty',
  ghostFireCost: number
): void {
  history.events.push({
    type: 'playCard',
    playerId,
    cardInstanceId,
    cardId,
    cardName,
    cardType,
    ghostFireCost,
    timestamp: Date.now(),
  });
}

/**
 * 记录使用技能
 */
export function recordUseSkill(
  history: TurnHistory,
  playerId: string,
  shikigamiId: string,
  shikigamiName: string,
  skillName: string,
  skillType: 'qi' | 'chu' | 'zi' | 'yong',
  ghostFireCost: number
): void {
  history.events.push({
    type: 'useSkill',
    playerId,
    shikigamiId,
    shikigamiName,
    skillName,
    skillType,
    ghostFireCost,
    timestamp: Date.now(),
  });
}

/**
 * 记录退治妖怪
 */
export function recordDefeatYokai(
  history: TurnHistory,
  playerId: string,
  yokaiId: string,
  yokaiName: string,
  yokaiHp: number,
  charmGained: number
): void {
  history.events.push({
    type: 'defeatYokai',
    playerId,
    yokaiId,
    yokaiName,
    yokaiHp,
    charmGained,
    timestamp: Date.now(),
  });
}

/**
 * 记录弃置卡牌
 */
export function recordDiscardCard(
  history: TurnHistory,
  playerId: string,
  cardInstanceId: string,
  cardName: string,
  reason: 'manual' | 'effect' | 'cleanup'
): void {
  history.events.push({
    type: 'discardCard',
    playerId,
    cardInstanceId,
    cardName,
    reason,
    timestamp: Date.now(),
  });
}

/**
 * 记录抓牌
 */
export function recordDrawCard(
  history: TurnHistory,
  playerId: string,
  count: number,
  source: 'turnStart' | 'effect' | 'cleanup'
): void {
  history.events.push({
    type: 'drawCard',
    playerId,
    count,
    source,
    timestamp: Date.now(),
  });
}

// ============ 查询函数（用于卡牌效果） ============

/**
 * 统计本回合打出的卡牌数量
 * @param history 回合历史
 * @param playerId 玩家ID（可选，不传则统计所有玩家）
 * @param cardType 卡牌类型（可选，不传则统计所有类型）
 */
export function countCardsPlayed(
  history: TurnHistory,
  playerId?: string,
  cardType?: 'yokai' | 'spell' | 'token' | 'penalty'
): number {
  return history.events.filter(event => {
    if (event.type !== 'playCard') return false;
    if (playerId && event.playerId !== playerId) return false;
    if (cardType && event.cardType !== cardType) return false;
    return true;
  }).length;
}

/**
 * 统计本回合打出的阴阳术数量
 * @description 用于三味等卡牌效果
 */
export function countSpellsPlayed(history: TurnHistory, playerId?: string): number {
  return countCardsPlayed(history, playerId, 'spell');
}

/**
 * 统计本回合消耗鬼火的卡牌数量
 * @description 三味效果：每使用1张鬼火牌，伤害+2
 */
export function countGhostFireCardsPlayed(history: TurnHistory, playerId?: string): number {
  return history.events.filter(event => {
    if (event.type !== 'playCard') return false;
    if (playerId && event.playerId !== playerId) return false;
    return event.ghostFireCost > 0;
  }).length;
}

/**
 * 获取本回合使用技能的次数
 */
export function countSkillsUsed(
  history: TurnHistory,
  playerId?: string,
  skillType?: 'qi' | 'chu' | 'zi' | 'yong'
): number {
  return history.events.filter(event => {
    if (event.type !== 'useSkill') return false;
    if (playerId && event.playerId !== playerId) return false;
    if (skillType && event.skillType !== skillType) return false;
    return true;
  }).length;
}

/**
 * 获取本回合退治的妖怪列表
 */
export function getDefeatedYokai(
  history: TurnHistory,
  playerId?: string
): DefeatYokaiRecord[] {
  return history.events.filter(event => {
    if (event.type !== 'defeatYokai') return false;
    if (playerId && event.playerId !== playerId) return false;
    return true;
  }) as DefeatYokaiRecord[];
}

/**
 * 获取本回合打出的所有卡牌记录
 */
export function getPlayedCards(
  history: TurnHistory,
  playerId?: string
): PlayCardRecord[] {
  return history.events.filter(event => {
    if (event.type !== 'playCard') return false;
    if (playerId && event.playerId !== playerId) return false;
    return true;
  }) as PlayCardRecord[];
}

/**
 * 获取本回合总消耗的鬼火
 */
export function getTotalGhostFireSpent(history: TurnHistory, playerId?: string): number {
  let total = 0;
  
  history.events.forEach(event => {
    if (playerId && event.playerId !== playerId) return;
    
    if (event.type === 'playCard' || event.type === 'useSkill') {
      total += event.ghostFireCost;
    }
  });
  
  return total;
}

/**
 * 检查本回合是否打出过指定卡牌
 * @param history 回合历史
 * @param cardName 卡牌名称
 * @param playerId 玩家ID（可选）
 */
export function hasPlayedCard(
  history: TurnHistory,
  cardName: string,
  playerId?: string
): boolean {
  return history.events.some(event => {
    if (event.type !== 'playCard') return false;
    if (playerId && event.playerId !== playerId) return false;
    return event.cardName === cardName;
  });
}

/**
 * 检查本回合是否使用过指定式神技能
 */
export function hasUsedShikigamiSkill(
  history: TurnHistory,
  shikigamiName: string,
  playerId?: string
): boolean {
  return history.events.some(event => {
    if (event.type !== 'useSkill') return false;
    if (playerId && event.playerId !== playerId) return false;
    return event.shikigamiName === shikigamiName;
  });
}

/**
 * 获取弃置的卡牌（区分主动弃置和规则弃置）
 * @description 用于三味【触】效果判断
 */
export function getDiscardedCards(
  history: TurnHistory,
  playerId?: string,
  reason?: 'manual' | 'effect' | 'cleanup'
): DiscardCardRecord[] {
  return history.events.filter(event => {
    if (event.type !== 'discardCard') return false;
    if (playerId && event.playerId !== playerId) return false;
    if (reason && event.reason !== reason) return false;
    return true;
  }) as DiscardCardRecord[];
}
