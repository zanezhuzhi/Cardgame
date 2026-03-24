/**
 * Socket.io 客户端封装
 * @file client/src/network/SocketClient.ts
 * 
 * 处理与服务端的 WebSocket 通信
 */

import { io, Socket } from 'socket.io-client';
import { ref, reactive } from 'vue';

// 服务器地址
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';

// 连接状态
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// 房间信息
export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  players: PlayerInfo[];
  maxPlayers: number;
  minPlayers: number;
  status: 'waiting' | 'playing' | 'ended';
  isPrivate: boolean;
  createdAt: number;
}

// 玩家信息
export interface PlayerInfo {
  id: string;
  name: string;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
}

// 游戏动作类型
export type GameAction = 
  | { type: 'selectShikigami'; shikigamiIds: string[] }
  | { type: 'playCard'; cardInstanceId: string }
  | { type: 'useSkill'; shikigamiIndex: number; skillType: string }
  | { type: 'attackYokai'; yokaiIndex: number; damage: number }
  | { type: 'attackBoss'; damage: number }
  | { type: 'retireYokai'; yokaiIndex: number }
  | { type: 'transcendYokai'; yokaiIndex: number }
  | { type: 'retireBoss' }
  | { type: 'transcendBoss' }
  | { type: 'gainSpell' }
  | { type: 'endTurn' };

/**
 * Socket 客户端单例
 */
class SocketClient {
  private socket: Socket | null = null;
  private actionSeq = 0;
  private pendingCallbacks = new Map<number, { resolve: Function; reject: Function }>();
  
  // 响应式状态
  public readonly status = ref<ConnectionStatus>('disconnected');
  public readonly playerId = ref<string>('');
  public readonly playerName = ref<string>('');
  public readonly currentRoom = ref<RoomInfo | null>(null);
  public readonly gameState = ref<any>(null);
  public readonly latency = ref<number>(0);
  
  // 事件回调
  private eventHandlers = new Map<string, Set<Function>>();
  
  /**
   * 连接到服务器
   */
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.playerId.value);
        return;
      }
      
      this.status.value = 'connecting';
      console.log('[Socket] 正在连接到服务器:', SERVER_URL);
      
      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      
      // 连接成功
      this.socket.on('connect', () => {
        console.log('[Socket] 连接成功');
      });
      
      // 收到玩家ID
      this.socket.on('connect:success', (data: any) => {
        // 兼容两种格式：{ playerId: string } 或直接 string
        const pid = typeof data === 'string' ? data : data?.playerId;
        console.log('[Socket] 收到玩家ID:', pid);
        this.playerId.value = pid || this.socket?.id || '';
        this.status.value = 'connected';
        resolve(this.playerId.value);
      });
      
      // 连接错误
      this.socket.on('connect_error', (error) => {
        console.error('[Socket] 连接错误:', error);
        this.status.value = 'disconnected';
        reject(error);
      });
      
      // 断开连接
      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] 断开连接:', reason);
        this.status.value = 'disconnected';
        this.emit('disconnected', reason);
      });
      
      // 重连中
      this.socket.io.on('reconnect_attempt', (attempt) => {
        console.log('[Socket] 重连尝试:', attempt);
        this.status.value = 'reconnecting';
      });
      
      // 重连成功
      this.socket.io.on('reconnect', () => {
        console.log('[Socket] 重连成功');
        this.status.value = 'connected';
        this.emit('reconnected');
      });
      
      // 绑定房间事件
      this.bindRoomEvents();
      
      // 绑定游戏事件
      this.bindGameEvents();
      
      // 心跳
      this.startHeartbeat();
    });
  }
  
  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status.value = 'disconnected';
    this.playerId.value = '';
    this.currentRoom.value = null;
    this.gameState.value = null;
  }
  
  /**
   * 设置玩家名称
   */
  setPlayerName(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      console.log('[SocketClient] 设置玩家名称:', name);
      this.socket.emit('player:setName', name, (response: any) => {
        console.log('[SocketClient] setPlayerName 响应:', response);
        
        // 兼容多种格式
        if (response === true || response?.success) {
          this.playerName.value = name;
          resolve();
        } else if (response === false) {
          reject(new Error('设置名称失败'));
        } else {
          reject(new Error(response?.error || '设置名称失败'));
        }
      });
    });
  }
  
  /**
   * 创建房间
   */
  createRoom(config: { name?: string; maxPlayers?: number; isPrivate?: boolean; password?: string }): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        console.error('[SocketClient] createRoom: 未连接到服务器');
        reject(new Error('未连接到服务器'));
        return;
      }
      
      console.log('[SocketClient] 发送 room:create 请求:', config);
      
      this.socket.emit('room:create', config, (response: any) => {
        console.log('[SocketClient] room:create 响应:', response);
        
        // 支持两种格式：{ success, room, error } 或直接返回 room 对象
        if (response) {
          // 格式1: { success: true, room: {...} }
          if (response.success !== undefined) {
            if (response.success && response.room) {
              this.currentRoom.value = response.room;
              resolve(response.room);
            } else {
              reject(new Error(response.error || '创建房间失败'));
            }
          } 
          // 格式2: 直接返回房间对象 { id, hostId, players, ... }
          else if (response.id && response.players) {
            this.currentRoom.value = response;
            resolve(response);
          }
          else {
            reject(new Error('未知响应格式'));
          }
        } else {
          reject(new Error('创建房间失败'));
        }
      });
    });
  }
  
  /**
   * 加入房间
   */
  joinRoom(roomId: string, password?: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      console.log('[SocketClient] 加入房间:', roomId);
      this.socket.emit('room:join', roomId, password, (response: any) => {
        console.log('[SocketClient] room:join 响应:', response);
        
        // 兼容多种格式
        if (response) {
          // 格式1: { success: true, room: {...} }
          if (response.success !== undefined) {
            if (response.success && response.room) {
              this.currentRoom.value = response.room;
              resolve(response.room);
            } else {
              reject(new Error(response.error || '加入房间失败'));
            }
          }
          // 格式2: 直接返回 true/false
          else if (response === true) {
            // 等待 room:joined 事件
            resolve(this.currentRoom.value!);
          }
          // 格式3: 直接返回房间对象
          else if (response.id && response.players) {
            this.currentRoom.value = response;
            resolve(response);
          }
          else {
            reject(new Error('加入房间失败'));
          }
        } else {
          reject(new Error('加入房间失败'));
        }
      });
    });
  }
  
  /**
   * 离开房间
   */
  leaveRoom(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      this.socket.emit('room:leave', (response: { success: boolean; error?: string }) => {
        if (response.success) {
          this.currentRoom.value = null;
          this.gameState.value = null;
          resolve();
        } else {
          reject(new Error(response.error || '离开房间失败'));
        }
      });
    });
  }
  
  /**
   * 设置准备状态
   */
  setReady(isReady: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      this.socket.emit('room:ready', isReady, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || '设置准备状态失败'));
        }
      });
    });
  }
  
  /**
   * 开始游戏（房主）
   */
  startGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      this.socket.emit('game:start', (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || '开始游戏失败'));
        }
      });
    });
  }
  
  /**
   * 发送游戏动作
   */
  sendAction(action: GameAction): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      const seq = ++this.actionSeq;
      this.pendingCallbacks.set(seq, { resolve, reject });
      
      this.socket.emit('game:action', action, seq, (response: { success: boolean; error?: string }) => {
        this.pendingCallbacks.delete(seq);
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || '动作执行失败'));
        }
      });
      
      // 超时处理
      setTimeout(() => {
        if (this.pendingCallbacks.has(seq)) {
          this.pendingCallbacks.delete(seq);
          reject(new Error('操作超时'));
        }
      }, 10000);
    });
  }
  
  /**
   * 发送聊天消息
   */
  sendChat(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      const roomId = this.currentRoom.value?.id;
      if (!roomId) {
        reject(new Error('不在房间中'));
        return;
      }

      this.socket.emit('chat:send' as any, { content, roomId }, (response: { success: boolean; error?: string }) => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || '发送失败'));
        }
      });
    });
  }

  /**
   * 发送GM指令
   */
  sendGMCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      const roomId = this.currentRoom.value?.id;
      if (!roomId) {
        reject(new Error('不在房间中'));
        return;
      }

      this.socket.emit('gm:command' as any, { command, roomId }, (response: { success: boolean; error?: string }) => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || '指令执行失败'));
        }
      });
    });
  }

  /**
   * 获取房间列表
   */
  getRoomList(): Promise<RoomInfo[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      console.log('[SocketClient] 请求房间列表...');
      this.socket.emit('room:list', (response: any) => {
        console.log('[SocketClient] room:list 响应:', response);
        
        // 兼容多种格式
        if (Array.isArray(response)) {
          // 格式1: 直接返回数组
          resolve(response);
        } else if (response && response.success && response.rooms) {
          // 格式2: { success: true, rooms: [...] }
          resolve(response.rooms);
        } else if (response && Array.isArray(response.rooms)) {
          // 格式3: { rooms: [...] }
          resolve(response.rooms);
        } else {
          console.error('[SocketClient] 获取房间列表失败:', response);
          reject(new Error(response?.error || '获取房间列表失败'));
        }
      });
    });
  }
  
  /**
   * 绑定房间事件
   */
  private bindRoomEvents(): void {
    if (!this.socket) return;
    
    // 房间更新
    this.socket.on('room:updated', (roomInfo: RoomInfo) => {
      this.currentRoom.value = roomInfo;
      this.emit('roomUpdated', roomInfo);
    });
    
    // 玩家加入
    this.socket.on('room:playerJoined', (player: PlayerInfo) => {
      if (this.currentRoom.value) {
        // 检查玩家是否已存在，避免重复添加
        const exists = this.currentRoom.value.players.some(p => p.id === player.id);
        if (!exists) {
          this.currentRoom.value.players.push(player);
        }
      }
      this.emit('playerJoined', player);
    });
    
    // 玩家离开
    this.socket.on('room:playerLeft', (playerId: string) => {
      if (this.currentRoom.value) {
        this.currentRoom.value.players = this.currentRoom.value.players.filter(p => p.id !== playerId);
      }
      this.emit('playerLeft', playerId);
    });
    
    // 玩家准备状态变更
    this.socket.on('room:playerReady', (playerId: string, isReady: boolean) => {
      if (this.currentRoom.value) {
        const player = this.currentRoom.value.players.find(p => p.id === playerId);
        if (player) player.isReady = isReady;
      }
      this.emit('playerReady', playerId, isReady);
    });
    
    // 房主变更
    this.socket.on('room:hostChanged', (newHostId: string) => {
      if (this.currentRoom.value) {
        this.currentRoom.value.hostId = newHostId;
        this.currentRoom.value.players.forEach(p => {
          p.isHost = p.id === newHostId;
        });
      }
      this.emit('hostChanged', newHostId);
    });
    
    // 被踢出房间
    this.socket.on('room:kicked', () => {
      this.currentRoom.value = null;
      this.gameState.value = null;
      this.emit('kicked');
    });
    
    // 房间错误
    this.socket.on('room:error', (code: string, message: string) => {
      this.emit('roomError', code, message);
    });
  }
  
  /**
   * 绑定游戏事件
   */
  private bindGameEvents(): void {
    if (!this.socket) return;
    
    // 游戏开始
    this.socket.on('game:started', (state: any) => {
      this.gameState.value = state;
      if (this.currentRoom.value) {
        this.currentRoom.value.status = 'playing';
      }
      this.emit('gameStarted', state);
    });
    
    // 状态同步
    this.socket.on('game:stateSync', (state: any, seq: number) => {
      this.gameState.value = state;
      this.emit('stateSync', state, seq);
    });
    
    // 游戏事件
    this.socket.on('game:event', (event: any) => {
      this.emit('gameEvent', event);
    });
    
    // 游戏结束
    this.socket.on('game:ended', (winners: string[], scores: Record<string, number>) => {
      if (this.currentRoom.value) {
        this.currentRoom.value.status = 'ended';
      }
      this.emit('gameEnded', winners, scores);
    });
    
    // GM指令结果
    this.socket.on('gm:result' as any, (data: { message: string; success: boolean }) => {
      this.emit('gmResult', data);
    });

    // 玩家断线
    this.socket.on('player:disconnected', (playerId: string, timeout: number) => {
      if (this.currentRoom.value) {
        const player = this.currentRoom.value.players.find(p => p.id === playerId);
        if (player) player.isConnected = false;
      }
      this.emit('playerDisconnected', playerId, timeout);
    });
    
    // 玩家重连
    this.socket.on('player:reconnected', (playerId: string) => {
      if (this.currentRoom.value) {
        const player = this.currentRoom.value.players.find(p => p.id === playerId);
        if (player) player.isConnected = true;
      }
      this.emit('playerReconnected', playerId);
    });
  }
  
  /**
   * 心跳
   */
  private startHeartbeat(): void {
    if (!this.socket) return;
    
    // 心跳响应
    this.socket.on('pong', (timestamp: number, serverTime: number) => {
      this.latency.value = Date.now() - timestamp;
    });
    
    // 定期发送心跳
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', Date.now());
      }
    }, 5000);
  }
  
  /**
   * 注册事件处理器
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  /**
   * 移除事件处理器
   */
  off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }
  
  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[Socket] 事件处理器错误 (${event}):`, error);
      }
    });
  }
  
  /**
   * 是否是房主
   */
  get isHost(): boolean {
    return this.currentRoom.value?.hostId === this.playerId.value;
  }
  
  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.status.value === 'connected';
  }
}

// 导出单例
export const socketClient = new SocketClient();
