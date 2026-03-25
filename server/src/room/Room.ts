/**
 * 御魂传说 - 房间类
 * @file server/src/room/Room.ts
 * 
 * 管理单个房间的状态、玩家列表和生命周期
 */

import type {
  RoomInfo,
  RoomPlayer,
  RoomConfig,
  RoomStatus,
} from '../types/index';
import type { MultiplayerGame } from '../game/MultiplayerGame';

// 房间码字符集（排除容易混淆的字符）
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

/** 生成6位房间码 */
function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

/** 默认房间配置 */
const DEFAULT_ROOM_CONFIG: RoomConfig = {
  maxPlayers: 6,
  minPlayers: 3,
  isPrivate: false,
};

/**
 * 房间类
 * 管理房间内的玩家、状态和游戏实例
 */
export class Room {
  /** 房间ID（6位房间码） */
  public readonly id: string;
  
  /** 房主ID */
  private _hostId: string;
  
  /** 房间状态 */
  private _status: RoomStatus;
  
  /** 房间配置 */
  private _config: RoomConfig;
  
  /** 玩家列表 */
  private _players: Map<string, RoomPlayer>;
  
  /** 游戏实例 */
  private _game: MultiplayerGame | null = null;
  
  /** 创建时间 */
  public readonly createdAt: number;
  
  /** 最后活动时间 */
  private _lastActivity: number;
  
  /** 重连超时定时器 */
  private _reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(hostId: string, hostName: string, config: Partial<RoomConfig> = {}) {
    this.id = generateRoomCode();
    this._hostId = hostId;
    this._status = 'waiting';
    this._config = { ...DEFAULT_ROOM_CONFIG, ...config };
    this._players = new Map();
    this.createdAt = Date.now();
    this._lastActivity = Date.now();
    
    // 添加房主
    this._players.set(hostId, {
      id: hostId,
      name: hostName,
      isHost: true,
      isReady: false,
      isConnected: true,
      playerIndex: 0,
    });
  }

  // ============ Getters ============

  get hostId(): string {
    return this._hostId;
  }

  get status(): RoomStatus {
    return this._status;
  }

  get config(): RoomConfig {
    return { ...this._config };
  }

  get playerCount(): number {
    return this._players.size;
  }

  get players(): RoomPlayer[] {
    return Array.from(this._players.values());
  }

  get connectedPlayerCount(): number {
    return this.players.filter(p => p.isConnected).length;
  }

  get game(): MultiplayerGame | null {
    return this._game;
  }

  get lastActivity(): number {
    return this._lastActivity;
  }
  
  // ============ 调试方法 ============
  
  /** 获取游戏实例 */
  getGame(): MultiplayerGame | null {
    return this._game;
  }
  
  /** 获取房间信息摘要 */
  getInfo(): RoomInfo {
    return {
      id: this.id,
      hostId: this._hostId,
      hostName: this._players.get(this._hostId)?.name || 'Unknown',
      playerCount: this.playerCount,
      maxPlayers: this._config.maxPlayers,
      status: this._status,
      isPrivate: this._config.isPrivate,
      players: this.players,
    };
  }

  // ============ 玩家管理 ============

  /**
   * 获取玩家信息
   */
  getPlayer(playerId: string): RoomPlayer | undefined {
    return this._players.get(playerId);
  }

  /**
   * 检查玩家是否在房间内
   */
  hasPlayer(playerId: string): boolean {
    return this._players.has(playerId);
  }

  /**
   * 添加玩家
   */
  addPlayer(playerId: string, playerName: string): { success: boolean; error?: string } {
    this.updateActivity();
    
    // 检查房间状态
    if (this._status !== 'waiting') {
      return { success: false, error: '游戏已开始，无法加入' };
    }
    
    // 检查是否已在房间
    if (this._players.has(playerId)) {
      return { success: false, error: '已在房间中' };
    }
    
    // 检查人数上限
    if (this._players.size >= this._config.maxPlayers) {
      return { success: false, error: '房间已满' };
    }
    
    // 分配玩家索引
    const playerIndex = this._players.size;
    
    // 添加玩家
    this._players.set(playerId, {
      id: playerId,
      name: playerName,
      isHost: false,
      isReady: false,
      isConnected: true,
      playerIndex,
    });
    
    return { success: true };
  }

  /**
   * 移除玩家
   */
  removePlayer(playerId: string): { success: boolean; newHostId?: string } {
    this.updateActivity();
    
    if (!this._players.has(playerId)) {
      return { success: false };
    }
    
    const player = this._players.get(playerId)!;
    this._players.delete(playerId);
    
    // 清理重连定时器
    this.clearReconnectTimer(playerId);
    
    // 如果房间空了，返回
    if (this._players.size === 0) {
      return { success: true };
    }
    
    // 如果移除的是房主，转移房主权限
    let newHostId: string | undefined;
    if (player.isHost) {
      newHostId = this.transferHost();
    }
    
    // 重新分配玩家索引
    this.reassignPlayerIndices();
    
    return { success: true, newHostId };
  }

  /**
   * 转移房主权限给第一个连接的玩家
   */
  private transferHost(): string | undefined {
    const connectedPlayers = this.players.filter(p => p.isConnected);
    if (connectedPlayers.length === 0) {
      // 如果没有在线玩家，选择第一个玩家
      const firstPlayer = this.players[0];
      if (firstPlayer) {
        firstPlayer.isHost = true;
        this._hostId = firstPlayer.id;
        return firstPlayer.id;
      }
      return undefined;
    }
    
    const newHost = connectedPlayers[0];
    newHost.isHost = true;
    this._hostId = newHost.id;
    return newHost.id;
  }

  /**
   * 重新分配玩家索引
   */
  private reassignPlayerIndices(): void {
    let index = 0;
    for (const player of this._players.values()) {
      player.playerIndex = index++;
    }
  }

  /**
   * 设置玩家准备状态
   */
  setPlayerReady(playerId: string, isReady: boolean): boolean {
    this.updateActivity();
    
    const player = this._players.get(playerId);
    if (!player) return false;
    
    player.isReady = isReady;
    return true;
  }

  /**
   * 检查是否所有玩家都已准备
   */
  areAllPlayersReady(): boolean {
    // 房主不需要准备
    for (const player of this._players.values()) {
      if (!player.isHost && !player.isReady) {
        return false;
      }
    }
    return true;
  }

  /**
   * 玩家断线
   */
  playerDisconnected(playerId: string): void {
    const player = this._players.get(playerId);
    if (player) {
      player.isConnected = false;
    }
  }

  /**
   * 玩家重连
   */
  playerReconnected(playerId: string): boolean {
    const player = this._players.get(playerId);
    if (!player) return false;
    
    player.isConnected = true;
    this.clearReconnectTimer(playerId);
    this.updateActivity();
    return true;
  }

  /**
   * 查找指定名称的离线玩家（用于进行中对局的重连恢复）
   */
  findDisconnectedPlayerByName(playerName: string): RoomPlayer | undefined {
    const normalized = (playerName || '').trim();
    if (!normalized) return undefined;
    return this.players.find(p => !p.isConnected && p.name === normalized);
  }

  /**
   * 重绑定离线玩家ID（旧socket -> 新socket）
   */
  rebindDisconnectedPlayer(oldPlayerId: string, newPlayerId: string): { success: boolean; error?: string } {
    if (oldPlayerId === newPlayerId) {
      const ok = this.playerReconnected(oldPlayerId);
      return ok ? { success: true } : { success: false, error: '玩家不存在' };
    }
    const oldPlayer = this._players.get(oldPlayerId);
    if (!oldPlayer) return { success: false, error: '旧玩家不存在' };
    if (this._players.has(newPlayerId)) return { success: false, error: '新玩家ID已存在' };

    this.clearReconnectTimer(oldPlayerId);
    this._players.delete(oldPlayerId);
    this._players.set(newPlayerId, {
      ...oldPlayer,
      id: newPlayerId,
      isConnected: true,
    });
    if (this._hostId === oldPlayerId) this._hostId = newPlayerId;
    this.updateActivity();
    return { success: true };
  }

  /**
   * 设置重连超时
   */
  setReconnectTimeout(playerId: string, timeout: number, callback: () => void): void {
    this.clearReconnectTimer(playerId);
    const timer = setTimeout(callback, timeout);
    this._reconnectTimers.set(playerId, timer);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(playerId: string): void {
    const timer = this._reconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this._reconnectTimers.delete(playerId);
    }
  }

  // ============ 房间状态管理 ============

  /**
   * 更新最后活动时间
   */
  updateActivity(): void {
    this._lastActivity = Date.now();
  }

  /**
   * 检查房间是否可以开始游戏
   */
  canStartGame(): { canStart: boolean; error?: string } {
    if (this._status !== 'waiting') {
      return { canStart: false, error: '游戏已开始' };
    }
    
    if (this._players.size < this._config.minPlayers) {
      return { canStart: false, error: `至少需要${this._config.minPlayers}名玩家` };
    }
    
    if (!this.areAllPlayersReady()) {
      return { canStart: false, error: '并非所有玩家都已准备' };
    }
    
    return { canStart: true };
  }

  /**
   * 设置房间状态
   */
  setStatus(status: RoomStatus): void {
    this._status = status;
    this.updateActivity();
  }

  /**
   * 设置游戏实例
   */
  setGame(game: MultiplayerGame | null): void {
    this._game = game;
  }

  /**
   * 验证房间密码
   */
  validatePassword(password?: string): boolean {
    if (!this._config.isPrivate) return true;
    return password === this._config.password;
  }

  // ============ 序列化 ============

  /**
   * 获取房间信息（用于发送给客户端）
   */
  toRoomInfo(): RoomInfo {
    const host = this._players.get(this._hostId);
    return {
      id: this.id,
      name: this._config.name || `房间 ${this.id}`,
      hostId: this._hostId,
      hostName: host?.name || '未知',
      players: this.players,
      maxPlayers: this._config.maxPlayers,
      minPlayers: this._config.minPlayers,
      status: this._status,
      isPrivate: this._config.isPrivate,
      createdAt: this.createdAt,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理所有重连定时器
    for (const timer of this._reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this._reconnectTimers.clear();
    
    // 清理游戏实例
    if (this._game) {
      this._game.cleanup();
      this._game = null;
    }
  }
}