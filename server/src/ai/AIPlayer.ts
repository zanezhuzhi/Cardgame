/**
 * 御魂传说 - AI 玩家模块
 * @file server/src/ai/AIPlayer.ts
 * 
 * 负责AI玩家的行为逻辑
 * 
 * L1 策略（基础版，对齐策划文档）：
 * 1. 式神选择：固定选展示顺序前 2 个
 * 2. 回合行动：随机出牌 -> 可击杀则攻击妖怪 -> 结束回合
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

/**
 * 生成匹配用 AI 配置（昵称：机器人1、机器人2…）
 */
export function generateAIPlayer(index: number): AIPlayerConfig {
  return {
    id: `ai_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    name: `机器人${index + 1}`,
    level: 'L1',
    // 策划文档 6.2：每次动作间隔 random(1,2) 秒
    actionDelay: 1000 + Math.random() * 1000,
  };
}

/**
 * 未在 AI 管理器注册时的临时 L1（如旧房间数据）
 */
export function createEphemeralL1Ai(id: string, name: string): AIPlayer {
  return new AIPlayer({
    id,
    name,
    level: 'L1',
    actionDelay: 1000 + Math.random() * 1000,
  });
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
   * 式神选择 (L1: 固定选列表前 2 张，与文档 6.1 一致)
   */
  selectShikigami(availableShikigami: CardInstance[]): string[] {
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
   * 超度选择 (L1: 默认不超度，文档 6.2)
   */
  decideSalvage(): boolean {
    return false;
  }
  
  /**
   * 目标选择 (L1: 随机)
   */
  selectTarget(validTargets: number[]): number {
    // L1: 随机选择
    return validTargets[Math.floor(Math.random() * validTargets.length)];
  }

  /** 当前伤害下可一次分配击杀的游荡妖怪槽位（供服务端 AI 调度，允许溢出） */
  getKillableSlotIndices(player: PlayerState, field: FieldState): number[] {
    return this.getKillableYokai(player, field);
  }
  
  /**
   * 获取可尝试打出的手牌（具体合法性由服务端校验；排除不可打出的类型）
   */
  private getPlayableCards(player: PlayerState, _field: FieldState): CardInstance[] {
    return player.hand.filter(
      c =>
        c.cardType !== 'token' &&
        c.cardType !== 'penalty' &&
        c.name !== '恶评'
    );
  }
  
  /**
   * 获取可退治的妖怪槽位
   */
  private getKillableYokai(player: PlayerState, field: FieldState): number[] {
    const result: number[] = [];
    const d = player.damage;
    if (d <= 0) return result;

    for (let i = 0; i < field.yokaiSlots.length; i++) {
      const yokai = field.yokaiSlots[i];
      const hp = yokai?.hp ?? 0;
      // 仍需存活且本回合累计伤害足以在单次分配中击杀（允许溢出浪费）
      if (yokai && hp > 0 && hp <= d) {
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
