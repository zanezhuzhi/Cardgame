/**
 * 御魂传说 - AI 玩家模块
 * @file server/src/ai/AIPlayer.ts
 * 
 * 负责AI玩家的行为逻辑
 * 
 * L1 策略（基础版）：
 * 1. 式神选择：随机选择前2个式神
 * 2. 回合行动：随机出牌 -> 随机退治妖怪 -> 结束回合
 */

import type { GameState, PlayerState, CardInstance, FieldState } from '@shared/types/game';

/** AI 玩家配置 */
export interface AIPlayerConfig {
  /** AI ID */
  id: string;
  /** AI 名称 */
  name: string;
  /** AI 等级 (L1=基础随机, L2=简单策略, L3=高级策略) */
  level: 'L1' | 'L2' | 'L3';
  /** 行动延迟 (ms) - 模拟思考时间 */
  actionDelay: number;
}

/** AI 决策结果 */
export interface AIDecision {
  type: 'playCard' | 'killYokai' | 'endTurn' | 'salvage' | 'selectTarget';
  cardInstanceId?: string;
  targetSlotIndex?: number;
  salvage?: boolean;
}

/** AI 名称池 */
const AI_NAMES = [
  '百目鬼',
  '鸦天狗',
  '雪女',
  '酒吞童子',
  '茨木童子',
  '妖狐',
  '座敷童子',
  '荒川之主',
  '大天狗',
  '般若',
];

/**
 * 生成随机AI玩家配置
 */
export function generateAIPlayer(index: number): AIPlayerConfig {
  const name = AI_NAMES[index % AI_NAMES.length];
  return {
    id: `ai_${Date.now()}_${index}`,
    name: `[AI] ${name}`,
    level: 'L1',
    actionDelay: 800 + Math.random() * 400, // 800-1200ms
  };
}

/**
 * AI 玩家类
 */
export class AIPlayer {
  readonly config: AIPlayerConfig;
  
  constructor(config: AIPlayerConfig) {
    this.config = config;
    console.log(`[AIPlayer] 创建 AI 玩家: ${config.name} (${config.level})`);
  }
  
  /**
   * 式神选择 (L1: 随机选择前2个)
   */
  selectShikigami(availableShikigami: CardInstance[]): string[] {
    if (this.config.level === 'L1') {
      // L1: 随机打乱后选前2个
      const shuffled = [...availableShikigami].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 2).map(s => s.cardId);
    }
    
    // TODO: L2/L3 策略
    return availableShikigami.slice(0, 2).map(s => s.cardId);
  }
  
  /**
   * 决定下一步行动 (L1: 随机策略)
   */
  async decideAction(state: GameState, myPlayerId: string): Promise<AIDecision> {
    // 模拟思考时间
    await this.delay(this.config.actionDelay);
    
    const myState = state.players.find(p => p.id === myPlayerId);
    if (!myState) {
      return { type: 'endTurn' };
    }
    
    // L1 策略：优先出牌 -> 退治妖怪 -> 结束回合
    
    // 1. 检查是否有可打出的手牌
    const playableCards = this.getPlayableCards(myState, state.field);
    if (playableCards.length > 0) {
      // 随机选一张打出
      const card = playableCards[Math.floor(Math.random() * playableCards.length)];
      return {
        type: 'playCard',
        cardInstanceId: card.instanceId,
      };
    }
    
    // 2. 检查是否有可退治的妖怪
    const killableYokai = this.getKillableYokai(myState, state.field);
    if (killableYokai.length > 0) {
      // 随机选一个退治
      const targetIndex = killableYokai[Math.floor(Math.random() * killableYokai.length)];
      return {
        type: 'killYokai',
        targetSlotIndex: targetIndex,
      };
    }
    
    // 3. 没有可执行的操作，结束回合
    return { type: 'endTurn' };
  }
  
  /**
   * 超度选择 (L1: 随机)
   */
  decideSalvage(): boolean {
    // L1: 50% 概率超度
    return Math.random() > 0.5;
  }
  
  /**
   * 目标选择 (L1: 随机)
   */
  selectTarget(validTargets: number[]): number {
    // L1: 随机选择
    return validTargets[Math.floor(Math.random() * validTargets.length)];
  }
  
  /**
   * 获取可打出的手牌
   */
  private getPlayableCards(player: PlayerState, field: FieldState): CardInstance[] {
    // 简单判断：鬼火足够的牌
    return player.hand.filter(card => {
      // 御魂牌需要1点鬼火
      if (card.cardType === 'spell') {
        return player.ghostFire >= 1;
      }
      // 其他牌暂时都可以打
      return true;
    });
  }
  
  /**
   * 获取可退治的妖怪槽位
   */
  private getKillableYokai(player: PlayerState, field: FieldState): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < field.yokaiSlots.length; i++) {
      const yokai = field.yokaiSlots[i];
      if (yokai && yokai.hp <= player.damage) {
        result.push(i);
      }
    }
    
    return result;
  }
  
  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * AI 玩家管理器
 */
export class AIPlayerManager {
  private static instance: AIPlayerManager;
  private aiPlayers: Map<string, AIPlayer> = new Map();
  
  private constructor() {
    console.log('[AIPlayerManager] AI 管理器已初始化');
  }
  
  static getInstance(): AIPlayerManager {
    if (!AIPlayerManager.instance) {
      AIPlayerManager.instance = new AIPlayerManager();
    }
    return AIPlayerManager.instance;
  }
  
  /**
   * 创建 AI 玩家
   */
  createAI(index: number): AIPlayer {
    const config = generateAIPlayer(index);
    const ai = new AIPlayer(config);
    this.aiPlayers.set(config.id, ai);
    return ai;
  }
  
  /**
   * 获取 AI 玩家
   */
  getAI(id: string): AIPlayer | undefined {
    return this.aiPlayers.get(id);
  }
  
  /**
   * 移除 AI 玩家
   */
  removeAI(id: string): boolean {
    return this.aiPlayers.delete(id);
  }
  
  /**
   * 判断是否是 AI
   */
  isAI(id: string): boolean {
    return id.startsWith('ai_') || this.aiPlayers.has(id);
  }
  
  /**
   * 清空所有 AI
   */
  clear(): void {
    this.aiPlayers.clear();
  }
}
