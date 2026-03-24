/**
 * 御魂传说 - 匹配确认阶段管理
 * @file server/src/match/ConfirmSession.ts
 * 
 * 管理匹配成功后的确认阶段
 * 
 * 流程：
 * 1. 匹配成功后创建确认会话
 * 2. 真人玩家需要在15秒内点击确认
 * 3. AI玩家自动确认
 * 4. 全员确认后开始游戏
 * 5. 超时或有人取消则返回大厅/重新匹配
 */

export interface ConfirmPlayer {
  id: string;
  name: string;
  isAI: boolean;
  confirmed: boolean;
  socketId?: string; // 真人玩家的socket ID
}

export interface ConfirmSessionData {
  sessionId: string;
  players: ConfirmPlayer[];
  countdown: number;
  createdAt: number;
}

type AllConfirmedCallback = (data: ConfirmSessionData) => void;
type TimeoutCallback = (data: ConfirmSessionData) => void;
type CancelCallback = (data: ConfirmSessionData, cancelledBy: string) => void;

interface SessionCallbacks {
  onAllConfirmed: AllConfirmedCallback;
  onTimeout: TimeoutCallback;
  onCancel: CancelCallback;
}

/**
 * 确认会话
 */
export class ConfirmSession {
  readonly sessionId: string;
  readonly players: ConfirmPlayer[];
  readonly createdAt: number;
  
  private countdown: number;
  private timer: NodeJS.Timeout | null = null;
  private callbacks: SessionCallbacks | null = null;
  private cancelledBy: string | null = null;
  
  /** 确认超时时间（秒） */
  private readonly CONFIRM_TIMEOUT = 15;
  
  constructor(players: ConfirmPlayer[]) {
    this.sessionId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.players = players.map(p => ({ ...p, confirmed: p.isAI })); // AI自动确认
    this.countdown = this.CONFIRM_TIMEOUT;
    this.createdAt = Date.now();
    
    console.log(`[ConfirmSession] 创建确认会话 ${this.sessionId}, ${players.length} 人`);
  }
  
  /**
   * 设置回调
   */
  setCallbacks(callbacks: SessionCallbacks): void {
    this.callbacks = callbacks;
  }
  
  /**
   * 开始倒计时
   */
  start(): void {
    // 检查是否全员确认（可能全是AI）
    if (this.checkAllConfirmed()) {
      this.complete('success');
      return;
    }
    
    // 开始倒计时
    this.timer = setInterval(() => {
      this.countdown--;
      
      if (this.countdown <= 0) {
        this.complete('timeout');
      }
    }, 1000);
    
    console.log(`[ConfirmSession] 开始倒计时 ${this.CONFIRM_TIMEOUT} 秒`);
  }
  
  /**
   * 玩家确认
   */
  confirm(playerId: string): { success: boolean; error?: string } {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: '玩家不存在' };
    }
    
    if (player.confirmed) {
      return { success: true }; // 已确认
    }
    
    player.confirmed = true;
    console.log(`[ConfirmSession] 玩家 ${player.name} 已确认`);
    
    // 检查是否全员确认
    if (this.checkAllConfirmed()) {
      this.complete('success');
    }
    
    return { success: true };
  }
  
  /**
   * 玩家取消
   */
  cancel(playerId: string): void {
    this.cancelledBy = playerId;
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      console.log(`[ConfirmSession] 玩家 ${player.name} 取消确认`);
    }
    this.complete('cancel');
  }
  
  /**
   * 检查是否全员确认
   */
  private checkAllConfirmed(): boolean {
    return this.players.every(p => p.confirmed);
  }
  
  /**
   * 完成确认阶段
   */
  private complete(reason: 'success' | 'timeout' | 'cancel'): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    console.log(`[ConfirmSession] 确认阶段结束: ${reason}`);
    
    const data = this.getData();
    
    if (this.callbacks) {
      switch (reason) {
        case 'success':
          this.callbacks.onAllConfirmed(data);
          break;
        case 'timeout':
          this.callbacks.onTimeout(data);
          break;
        case 'cancel':
          this.callbacks.onCancel(data, this.cancelledBy || '');
          break;
      }
    }
  }
  
  /**
   * 获取会话数据
   */
  getData(): ConfirmSessionData {
    return {
      sessionId: this.sessionId,
      players: this.players.map(p => ({ ...p })),
      countdown: this.countdown,
      createdAt: this.createdAt,
    };
  }
  
  /**
   * 销毁会话
   */
  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * 确认会话管理器
 */
export class ConfirmSessionManager {
  private static instance: ConfirmSessionManager;
  private sessions: Map<string, ConfirmSession> = new Map();
  
  /** 玩家->会话ID 映射 */
  private playerSessionMap: Map<string, string> = new Map();
  
  private constructor() {
    console.log('[ConfirmSessionManager] 确认会话管理器已初始化');
  }
  
  static getInstance(): ConfirmSessionManager {
    if (!ConfirmSessionManager.instance) {
      ConfirmSessionManager.instance = new ConfirmSessionManager();
    }
    return ConfirmSessionManager.instance;
  }
  
  /**
   * 创建确认会话
   */
  createSession(
    players: ConfirmPlayer[],
    onAllConfirmed: AllConfirmedCallback,
    onTimeout: TimeoutCallback,
    onCancel: CancelCallback
  ): ConfirmSession {
    const session = new ConfirmSession(players);
    
    // 包装回调，添加清理逻辑
    session.setCallbacks({
      onAllConfirmed: (data) => {
        this.cleanupSession(session.sessionId);
        onAllConfirmed(data);
      },
      onTimeout: (data) => {
        this.cleanupSession(session.sessionId);
        onTimeout(data);
      },
      onCancel: (data, cancelledBy) => {
        this.cleanupSession(session.sessionId);
        onCancel(data, cancelledBy);
      },
    });
    
    this.sessions.set(session.sessionId, session);
    
    // 建立玩家映射
    players.forEach(p => {
      this.playerSessionMap.set(p.id, session.sessionId);
    });
    
    // 自动开始
    session.start();
    
    return session;
  }
  
  /**
   * 清理会话
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.players.forEach(p => this.playerSessionMap.delete(p.id));
      this.sessions.delete(sessionId);
    }
  }
  
  /**
   * 获取会话
   */
  getSession(sessionId: string): ConfirmSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * 根据玩家ID获取会话
   */
  getSessionByPlayer(playerId: string): ConfirmSession | undefined {
    const sessionId = this.playerSessionMap.get(playerId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }
  
  /**
   * 玩家确认
   */
  confirm(sessionId: string, playerId: string): { success: boolean; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: '会话不存在' };
    }
    return session.confirm(playerId);
  }
  
  /**
   * 玩家取消
   */
  cancel(sessionId: string, playerId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cancel(playerId);
    }
  }
  
  /**
   * 清理所有会话
   */
  clear(): void {
    this.sessions.forEach(s => s.destroy());
    this.sessions.clear();
    this.playerSessionMap.clear();
  }
}