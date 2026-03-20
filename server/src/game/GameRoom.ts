/**
 * 游戏房间 - 管理单局游戏
 * @file server/src/game/GameRoom.ts
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import type {
  RoomConfig,
  RoomInfo,
  RoomPlayer,
  RoomState,
  InteractRequest,
  InteractResponse,
  InteractType,
  S2C_Message,
  ErrorCode,
} from '../../../shared/types/network';
import type { GameState, GameAction } from '../../../shared/types/game';
import type { CardInstance } from '../../../shared/types/cards';
import type { PlayerConnection } from '../socket/types';

interface PendingInteract {
  resolve: (response: InteractResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface DisconnectInfo {
  disconnectTime: number;
  playerData: RoomPlayerInternal;
}

interface RoomPlayerInternal extends RoomPlayer {
  connection: PlayerConnection | null;
}

/**
 * 游戏房间
 */
export class GameRoom extends EventEmitter {
  readonly roomId: string;
  readonly hostId: string;
  readonly config: RoomConfig;
  readonly createdAt: number;
  
  private state: RoomState = 'WAITING';
  private players: Map<string, RoomPlayerInternal> = new Map();
  private spectators: Map<string, PlayerConnection> = new Map();
  
  // 游戏管理器（后续集成）
  private gameManager: any = null;  // TODO: 类型化
  private stateSeq: number = 0;
  
  // 交互系统
  private pendingInteracts: Map<string, PendingInteract> = new Map();
  
  // 断线重连
  private disconnectedPlayers: Map<string, DisconnectInfo> = new Map();
  
  // 活动时间
  private lastActivity: number;
  
  constructor(roomId: string, hostId: string, roomConfig: RoomConfig) {
    super();
    this.roomId = roomId;
    this.hostId = hostId;
    this.config = roomConfig;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }
  
  // ============ 玩家管理 ============
  
  /**
   * 添加玩家
   */
  addPlayer(playerId: string, playerName: string, connection: PlayerConnection): boolean {
    // 检查是否是断线重连
    const disconnectInfo = this.disconnectedPlayers.get(playerId);
    if (disconnectInfo) {
      return this.handleReconnect(playerId, connection);
    }
    
    // 新玩家
    if (this.players.size >= this.config.maxPlayers) {
      return false;
    }
    
    const player: RoomPlayerInternal = {
      id: playerId,
      name: playerName,
      isReady: false,
      isConnected: true,
      isHost: playerId === this.hostId,
      connection,
    };
    
    this.players.set(playerId, player);
    this.updateActivity();
    
    // 广播房间更新
    this.broadcastRoomUpdate();
    
    console.log(`[GameRoom ${this.roomId}] 玩家加入: ${playerName} (${playerId})`);
    
    return true;
  }
  
  /**
   * 移除玩家
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // 游戏中处理为断线
    if (this.state === 'PLAYING') {
      this.handleDisconnect(playerId);
      return;
    }
    
    // 等待中直接移除
    this.players.delete(playerId);
    this.updateActivity();
    
    // 如果房主离开，转移房主或销毁房间
    if (playerId === this.hostId && this.players.size > 0) {
      const newHost = this.players.values().next().value;
      if (newHost) {
        (newHost as RoomPlayerInternal).isHost = true;
      }
    }
    
    // 广播房间更新
    this.broadcastRoomUpdate();
    
    // 空房间销毁
    if (this.players.size === 0) {
      this.destroy();
    }
    
    console.log(`[GameRoom ${this.roomId}] 玩家离开: ${playerId}`);
  }
  
  /**
   * 设置玩家准备状态
   */
  setPlayerReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    player.isReady = ready;
    this.updateActivity();
    this.broadcastRoomUpdate();
    
    // 检查是否可以开始游戏
    this.checkAutoStart();
  }
  
  /**
   * 处理玩家断线
   */
  private handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    player.isConnected = false;
    player.connection = null;
    
    this.disconnectedPlayers.set(playerId, {
      disconnectTime: Date.now(),
      playerData: player,
    });
    
    // 通知其他玩家
    this.broadcast({
      type: 'PLAYER_DISCONNECTED',
      playerId,
      timeout: config.game.reconnectTimeout,
    });
    
    console.log(`[GameRoom ${this.roomId}] 玩家断线: ${playerId}`);
    
    // 设置超时处理
    setTimeout(() => {
      if (this.disconnectedPlayers.has(playerId)) {
        this.forceRemovePlayer(playerId);
      }
    }, config.game.reconnectTimeout);
  }
  
  /**
   * 处理重连
   */
  private handleReconnect(playerId: string, connection: PlayerConnection): boolean {
    const info = this.disconnectedPlayers.get(playerId);
    if (!info) return false;
    
    // 检查是否超时
    if (Date.now() - info.disconnectTime > config.game.reconnectTimeout) {
      return false;
    }
    
    // 恢复玩家
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = true;
      player.connection = connection;
    }
    
    this.disconnectedPlayers.delete(playerId);
    
    // 发送当前状态
    this.sendToPlayer(playerId, {
      type: 'RECONNECTED',
      state: this.getGameState(),
    });
    
    // 通知其他玩家
    this.broadcast({
      type: 'PLAYER_RECONNECTED',
      playerId,
    }, playerId);
    
    console.log(`[GameRoom ${this.roomId}] 玩家重连: ${playerId}`);
    
    return true;
  }
  
  /**
   * 强制移除玩家（超时或作弊）
   */
  private forceRemovePlayer(playerId: string): void {
    this.disconnectedPlayers.delete(playerId);
    this.players.delete(playerId);
    
    // TODO: 游戏中处理（判负等）
    
    this.broadcastRoomUpdate();
    
    console.log(`[GameRoom ${this.roomId}] 玩家被强制移除: ${playerId}`);
  }
  
  // ============ 游戏控制 ============
  
  /**
   * 检查是否可以自动开始
   */
  private checkAutoStart(): void {
    if (this.state !== 'WAITING') return;
    if (this.players.size < config.room.minPlayersToStart) return;
    
    // 检查所有玩家是否准备
    for (const player of this.players.values()) {
      if (!player.isReady && !player.isHost) {
        return;
      }
    }
    
    // 房主需要手动开始
    // this.startGame();
  }
  
  /**
   * 开始游戏
   */
  startGame(): boolean {
    if (this.state !== 'WAITING') {
      return false;
    }
    
    if (this.players.size < config.room.minPlayersToStart) {
      return false;
    }
    
    this.state = 'STARTING';
    
    // TODO: 初始化 GameManager
    // this.gameManager = new GameManager(this.roomId, this.players.size);
    // for (const player of this.players.values()) {
    //   this.gameManager.addPlayer(player.id, player.name);
    // }
    // this.gameManager.startGame();
    
    this.state = 'PLAYING';
    
    // 广播游戏开始
    this.broadcast({
      type: 'GAME_START',
      state: this.getGameState(),
    });
    
    console.log(`[GameRoom ${this.roomId}] 游戏开始`);
    
    return true;
  }
  
  /**
   * 处理游戏动作
   */
  handleAction(playerId: string, action: GameAction, seq: number): void {
    this.updateActivity();
    
    // TODO: 校验动作
    // const validation = this.actionValidator.validate(action, playerId, this.getGameState());
    // if (!validation.valid) {
    //   this.sendToPlayer(playerId, {
    //     type: 'ACTION_RESULT',
    //     seq,
    //     success: false,
    //     error: validation.error,
    //   });
    //   return;
    // }
    
    // TODO: 执行动作
    // this.gameManager.handleAction(action);
    
    // 发送结果
    this.sendToPlayer(playerId, {
      type: 'ACTION_RESULT',
      seq,
      success: true,
    });
    
    // 广播状态更新
    this.broadcastState();
  }
  
  // ============ 交互系统 ============
  
  /**
   * 创建交互回调桥接
   */
  createInteractBridge(playerId: string) {
    return {
      onChoice: (options: string[]) => this.requestInteract(playerId, 'CHOICE', { type: 'CHOICE', options }),
      onSelectCards: (cards: CardInstance[], count: number) => 
        this.requestInteract(playerId, 'SELECT_CARDS', { type: 'SELECT_CARDS', candidates: cards, count }),
      onSelectTarget: (targets: CardInstance[]) => 
        this.requestInteract(playerId, 'SELECT_TARGET', { type: 'SELECT_TARGET', candidates: targets }),
    };
  }
  
  /**
   * 发送交互请求并等待响应
   */
  async requestInteract(
    playerId: string,
    type: InteractType,
    data: any
  ): Promise<any> {
    const requestId = uuidv4();
    const request: InteractRequest = {
      requestId,
      playerId,
      type,
      timeout: config.game.interactTimeout,
      data,
    };
    
    // 发送给客户端
    this.sendToPlayer(playerId, { type: 'INTERACT_REQUEST', request });
    
    // 等待响应
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingInteracts.delete(requestId);
        // 超时自动选择默认值
        resolve(this.getDefaultInteractResponse(type, data));
      }, config.game.interactTimeout);
      
      this.pendingInteracts.set(requestId, { resolve, reject, timer });
    });
  }
  
  /**
   * 处理交互响应
   */
  handleInteractResponse(playerId: string, response: InteractResponse): void {
    const pending = this.pendingInteracts.get(response.requestId);
    if (!pending) return;
    
    clearTimeout(pending.timer);
    this.pendingInteracts.delete(response.requestId);
    pending.resolve(response);
    
    this.updateActivity();
  }
  
  /**
   * 获取默认交互响应（超时使用）
   */
  private getDefaultInteractResponse(type: InteractType, data: any): any {
    switch (type) {
      case 'CHOICE':
        return { choiceIndex: 0 };
      case 'SELECT_CARDS':
        // 自动选择前N张
        const cards = data.candidates?.slice(0, data.count) || [];
        return { selectedCardIds: cards.map((c: CardInstance) => c.instanceId) };
      case 'SELECT_TARGET':
        return { targetId: data.candidates?.[0]?.instanceId || '' };
      default:
        return {};
    }
  }
  
  // ============ 状态广播 ============
  
  /**
   * 广播房间更新
   */
  broadcastRoomUpdate(): void {
    this.broadcast({
      type: 'ROOM_UPDATE',
      roomInfo: this.getRoomInfo(),
    });
  }
  
  /**
   * 广播游戏状态
   */
  broadcastState(): void {
    const state = this.getGameState();
    if (!state) return;
    
    this.stateSeq++;
    
    // 对每个玩家发送定制化视图
    for (const [playerId, player] of this.players) {
      if (player.connection && player.isConnected) {
        const playerView = this.createPlayerView(state, playerId);
        this.sendToPlayer(playerId, {
          type: 'STATE_SYNC',
          state: playerView,
          seq: this.stateSeq,
        });
      }
    }
  }
  
  /**
   * 创建玩家视角的状态
   */
  private createPlayerView(state: GameState, playerId: string): GameState {
    return {
      ...state,
      players: state.players.map(p => ({
        ...p,
        // 隐藏其他玩家的手牌详情
        hand: p.id === playerId
          ? p.hand
          : p.hand.map(() => ({
              instanceId: 'hidden',
              cardId: 'hidden',
              name: '???',
              cardType: 'yokai' as const,
            })),
        // 隐藏牌库
        deck: [],
      })),
      field: {
        ...state.field,
        // 隐藏妖怪牌库
        yokaiDeck: [],
        // 保留鬼王牌库数量但隐藏内容
        bossDeck: state.field.bossDeck.map(() => ({
          id: 'hidden',
          name: '???',
          type: 'boss' as const,
          stage: 1 as const,
          hp: 0,
          charm: 0,
          image: '',
        })),
      },
    };
  }
  
  /**
   * 发送消息给指定玩家
   */
  sendToPlayer(playerId: string, message: S2C_Message): void {
    const player = this.players.get(playerId);
    if (player?.connection && player.isConnected) {
      player.connection.send(message);
    }
  }
  
  /**
   * 广播消息给所有玩家
   */
  broadcast(message: S2C_Message, excludePlayerId?: string): void {
    for (const [playerId, player] of this.players) {
      if (playerId !== excludePlayerId && player.connection && player.isConnected) {
        player.connection.send(message);
      }
    }
  }
  
  // ============ 状态查询 ============
  
  getRoomInfo(): RoomInfo {
    const players: RoomPlayer[] = [];
    for (const player of this.players.values()) {
      players.push({
        id: player.id,
        name: player.name,
        isReady: player.isReady,
        isConnected: player.isConnected,
        isHost: player.isHost,
      });
    }
    
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      state: this.state,
      config: this.config,
      players,
      spectators: this.spectators.size,
      createdAt: this.createdAt,
    };
  }
  
  getGameState(): GameState {
    // TODO: 从 GameManager 获取
    return this.gameManager?.getState() || null;
  }
  
  isFull(): boolean {
    return this.players.size >= this.config.maxPlayers;
  }
  
  isEmpty(): boolean {
    return this.players.size === 0;
  }
  
  isStarted(): boolean {
    return this.state === 'PLAYING' || this.state === 'STARTING';
  }
  
  isIdle(now: number): boolean {
    return now - this.lastActivity > config.room.roomIdleTimeout;
  }
  
  // ============ 生命周期 ============
  
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }
  
  destroy(): void {
    // 清理所有计时器
    for (const pending of this.pendingInteracts.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingInteracts.clear();
    
    // 通知所有玩家
    this.broadcast({
      type: 'ROOM_ERROR',
      code: 'ROOM_NOT_FOUND' as ErrorCode,
      message: '房间已关闭',
    });
    
    // 清理
    this.players.clear();
    this.spectators.clear();
    this.disconnectedPlayers.clear();
    
    this.emit('destroyed');
    
    console.log(`[GameRoom ${this.roomId}] 房间销毁`);
  }
}
