/**
 * 御魂传说 - 匹配队列管理
 * @file server/src/match/MatchQueue.ts
 * 
 * 负责管理玩家匹配队列，实现快速匹配功能
 * 
 * 设计规则（参考 策划文档/AI匹配机制设计.md）：
 * 1. 玩家点击"开始游戏"后进入匹配队列
 * 2. 第一个玩家等待满10秒时，拉取所有队列中的玩家 + AI填充至6人
 * 3. 最少3人开局，至少1个真人
 * 4. 真人需要确认，AI自动确认
 */

export interface QueuedPlayer {
  socketId: string;
  playerName: string;
  joinTime: number;     // 加入队列的时间戳
}

export interface MatchResult {
  players: QueuedPlayer[];    // 真人玩家列表
  aiCount: number;            // 需要填充的AI数量
  roomId?: string;            // 创建的房间ID（由外部设置）
}

type MatchCallback = (result: MatchResult) => void;

/**
 * 匹配队列单例
 */
export class MatchQueue {
  private static instance: MatchQueue;
  
  /** 匹配队列 */
  private queue: QueuedPlayer[] = [];
  
  /** 匹配计时器 */
  private matchTimer: NodeJS.Timeout | null = null;
  
  /** 匹配回调 */
  private onMatchComplete: MatchCallback | null = null;
  
  /** 匹配等待时间（毫秒） */
  private readonly MATCH_WAIT_TIME = 10000; // 10秒
  
  /** 最大玩家数 */
  private readonly MAX_PLAYERS = 6;
  
  /** 最小玩家数（含AI） */
  private readonly MIN_PLAYERS = 3;

  private constructor() {
    console.log('[MatchQueue] 匹配队列已初始化');
  }

  /**
   * 获取单例
   */
  static getInstance(): MatchQueue {
    if (!MatchQueue.instance) {
      MatchQueue.instance = new MatchQueue();
    }
    return MatchQueue.instance;
  }

  /**
   * 设置匹配完成回调
   */
  setMatchCallback(callback: MatchCallback): void {
    this.onMatchComplete = callback;
  }

  /**
   * 玩家加入匹配队列
   */
  join(socketId: string, playerName: string): boolean {
    // 检查是否已在队列中
    if (this.isInQueue(socketId)) {
      console.log(`[MatchQueue] 玩家 ${playerName} 已在队列中`);
      return false;
    }
    
    const player: QueuedPlayer = {
      socketId,
      playerName,
      joinTime: Date.now(),
    };
    
    this.queue.push(player);
    console.log(`[MatchQueue] 玩家 ${playerName} 加入队列 (当前 ${this.queue.length} 人)`);
    
    // 如果是第一个玩家，启动匹配计时器
    if (this.queue.length === 1) {
      this.startMatchTimer();
    }
    
    // 如果已满6人，立即匹配
    if (this.queue.length >= this.MAX_PLAYERS) {
      console.log(`[MatchQueue] 队列已满 ${this.MAX_PLAYERS} 人，立即匹配`);
      this.executeMatch();
    }
    
    return true;
  }

  /**
   * 玩家离开匹配队列
   */
  leave(socketId: string): boolean {
    const index = this.queue.findIndex(p => p.socketId === socketId);
    if (index === -1) {
      return false;
    }
    
    const player = this.queue[index];
    this.queue.splice(index, 1);
    console.log(`[MatchQueue] 玩家 ${player.playerName} 离开队列 (剩余 ${this.queue.length} 人)`);
    
    // 如果队列空了，停止计时器
    if (this.queue.length === 0) {
      this.stopMatchTimer();
    }
    
    return true;
  }

  /**
   * 检查玩家是否在队列中
   */
  isInQueue(socketId: string): boolean {
    return this.queue.some(p => p.socketId === socketId);
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 获取队列中的玩家信息（用于调试）
   */
  getQueueInfo(): { socketId: string; playerName: string; waitTime: number }[] {
    const now = Date.now();
    return this.queue.map(p => ({
      socketId: p.socketId,
      playerName: p.playerName,
      waitTime: Math.floor((now - p.joinTime) / 1000),
    }));
  }

  /**
   * 启动匹配计时器
   */
  private startMatchTimer(): void {
    if (this.matchTimer) {
      return;
    }
    
    console.log(`[MatchQueue] 启动匹配计时器 (${this.MATCH_WAIT_TIME / 1000}秒)`);
    
    this.matchTimer = setTimeout(() => {
      this.executeMatch();
    }, this.MATCH_WAIT_TIME);
  }

  /**
   * 停止匹配计时器
   */
  private stopMatchTimer(): void {
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
      console.log('[MatchQueue] 匹配计时器已停止');
    }
  }

  /**
   * 执行匹配
   */
  private executeMatch(): void {
    this.stopMatchTimer();
    
    if (this.queue.length === 0) {
      console.log('[MatchQueue] 队列为空，跳过匹配');
      return;
    }
    
    // 取出所有玩家（最多6人）
    const matchedPlayers = this.queue.splice(0, this.MAX_PLAYERS);
    
    // 计算需要的AI数量
    // 规则：至少3人，最多6人，用AI填充
    const humanCount = matchedPlayers.length;
    const aiCount = Math.max(0, this.MIN_PLAYERS - humanCount);
    const totalPlayers = humanCount + aiCount;
    
    console.log(`[MatchQueue] 匹配完成: ${humanCount} 真人 + ${aiCount} AI = ${totalPlayers} 人`);
    
    const result: MatchResult = {
      players: matchedPlayers,
      aiCount,
    };
    
    // 触发回调
    if (this.onMatchComplete) {
      this.onMatchComplete(result);
    }
    
    // 如果队列中还有人，继续下一轮匹配
    if (this.queue.length > 0) {
      console.log(`[MatchQueue] 队列中还有 ${this.queue.length} 人，启动下一轮匹配`);
      this.startMatchTimer();
    }
  }

  /**
   * 清空队列（测试用）
   */
  clear(): void {
    this.queue = [];
    this.stopMatchTimer();
    console.log('[MatchQueue] 队列已清空');
  }
}
