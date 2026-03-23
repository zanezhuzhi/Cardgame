/**
 * 御魂传说 - Socket.io 服务封装
 * @file server/src/socket/SocketServer.ts
 * 
 * 封装 Socket.io 服务器，处理 WebSocket 连接和事件
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RoomManager } from '../room/RoomManager';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RoomConfig,
  RoomInfo,
  GameAction,
  GameState,
  GameEvent,
  ErrorCodes,
} from '../types/index';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Socket.io 服务封装
 */
export class SocketServer {
  private io: TypedServer;
  private roomManager: RoomManager;
  
  /** 玩家名称映射 (socketId -> playerName) */
  private playerNames: Map<string, string> = new Map();
  
  /** 重连超时时间 */
  private reconnectTimeout: number = 60000; // 1分钟

  constructor(httpServer: HTTPServer) {
    // 创建 Socket.io 服务器
    this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingInterval: 10000,
      pingTimeout: 5000,
    });
    
    // 获取房间管理器
    this.roomManager = RoomManager.getInstance();
    
    // 设置房间管理器回调
    this.setupRoomManagerCallbacks();
    
    // 设置连接处理
    this.setupConnectionHandlers();
    
    console.log('[SocketServer] Socket.io 服务已初始化');
  }

  /**
   * 设置房间管理器回调
   */
  private setupRoomManagerCallbacks(): void {
    // 房间更新时广播
    this.roomManager.onRoomUpdate((room) => {
      this.io.to(room.id).emit('room:updated', room.toRoomInfo());
    });
    
    // 房间删除时通知
    this.roomManager.onRoomDeleted((roomId) => {
      this.io.to(roomId).emit('room:left');
    });
  }

  /**
   * 设置连接处理
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`[SocketServer] 新连接: ${socket.id}`);
      
      // 初始化 socket 数据
      socket.data.playerId = socket.id;
      socket.data.playerName = `玩家${socket.id.substring(0, 4)}`;
      socket.data.roomId = null;
      
      // 发送连接成功
      socket.emit('connect:success', { playerId: socket.id });
      
      // 绑定事件处理
      this.bindPlayerEvents(socket);
      this.bindRoomEvents(socket);
      this.bindGameEvents(socket);
      this.bindPingEvents(socket);
      
      // 断开连接处理
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * 绑定玩家相关事件
   */
  private bindPlayerEvents(socket: TypedSocket): void {
    // 设置玩家名称
    socket.on('player:setName', (name, callback) => {
      if (!name || name.trim().length === 0) {
        callback({ success: false, error: '名称不能为空' });
        return;
      }
      
      const trimmedName = name.trim().substring(0, 20);
      socket.data.playerName = trimmedName;
      this.playerNames.set(socket.id, trimmedName);
      
      console.log(`[SocketServer] 玩家 ${socket.id} 设置名称: ${trimmedName}`);
      callback({ success: true });
    });
  }

  /**
   * 绑定房间相关事件
   */
  private bindRoomEvents(socket: TypedSocket): void {
    // 创建房间
    socket.on('room:create', (config, callback) => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      
      try {
        const room = this.roomManager.createRoom(socket.id, playerName, config);
        
        // 加入 Socket.io 房间
        socket.join(room.id);
        socket.data.roomId = room.id;
        
        const roomInfo = room.toRoomInfo();
        socket.emit('room:created', roomInfo);
        callback({ success: true, room: roomInfo });
        
        console.log(`[SocketServer] 玩家 ${playerName} 创建房间 ${room.id}`);
      } catch (error: any) {
        console.error('[SocketServer] 创建房间失败:', error);
        callback({ success: false, error: error.message || '创建房间失败' });
      }
    });

    // 加入房间
    socket.on('room:join', (roomId, password, callback) => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      
      const result = this.roomManager.joinRoom(roomId, socket.id, playerName, password);
      
      if (result.success && result.room) {
        // 加入 Socket.io 房间
        socket.join(result.room.id);
        socket.data.roomId = result.room.id;
        
        const roomInfo = result.room.toRoomInfo();
        
        // 通知自己
        socket.emit('room:joined', roomInfo, socket.id);
        
        // 通知房间其他人
        socket.to(result.room.id).emit('room:playerJoined', {
          id: socket.id,
          name: playerName,
          isHost: false,
          isReady: false,
          isConnected: true,
          playerIndex: result.room.playerCount - 1,
        });
        
        callback?.({ success: true, room: roomInfo });
        console.log(`[SocketServer] 玩家 ${playerName} 加入房间 ${roomId}`);
      } else {
        socket.emit('room:error', result.errorCode || ErrorCodes.UNKNOWN_ERROR, result.error || '加入失败');
        callback?.({ success: false, error: result.error || '加入失败' });
      }
    });

    // 离开房间
    socket.on('room:leave', (callback) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        callback?.({ success: false, error: '不在房间中' });
        return;
      }
      
      const result = this.roomManager.leaveRoom(socket.id);
      
      if (result.success) {
        // 离开 Socket.io 房间
        socket.leave(roomId);
        socket.data.roomId = null;
        
        // 通知自己
        socket.emit('room:left');
        
        // 通知房间其他人
        if (!result.roomDeleted) {
          this.io.to(roomId).emit('room:playerLeft', socket.id);
          
          // 如果房主变更
          if (result.newHostId) {
            this.io.to(roomId).emit('room:hostChanged', result.newHostId);
          }
        }
        
        callback?.({ success: true });
        console.log(`[SocketServer] 玩家 ${socket.id} 离开房间 ${roomId}`);
      } else {
        callback?.({ success: false, error: '离开房间失败' });
      }
    });

    // 准备状态
    socket.on('room:ready', (isReady, callback) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room) {
        callback?.({ success: false, error: '不在房间中' });
        return;
      }
      
      const success = room.setPlayerReady(socket.id, isReady);
      if (success) {
        this.io.to(room.id).emit('room:playerReady', socket.id, isReady);
        callback?.({ success: true });
      } else {
        callback?.({ success: false, error: '设置准备状态失败' });
      }
    });

    // 踢出玩家（房主操作）
    socket.on('room:kick', (playerId, callback) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room || room.hostId !== socket.id) {
        callback?.({ success: false, error: '无权限' });
        return;
      }
      
      if (playerId === socket.id) {
        callback?.({ success: false, error: '不能踢出自己' });
        return;
      }
      
      // 获取被踢玩家的 socket
      const targetSocket = this.io.sockets.sockets.get(playerId);
      if (targetSocket) {
        // 让被踢玩家离开
        this.roomManager.leaveRoom(playerId);
        targetSocket.leave(room.id);
        targetSocket.data.roomId = null;
        targetSocket.emit('room:left');
        
        // 通知房间
        this.io.to(room.id).emit('room:playerLeft', playerId);
        
        callback?.({ success: true });
      } else {
        callback?.({ success: false, error: '玩家不存在' });
      }
    });

    // 获取房间列表
    socket.on('room:list', (callback) => {
      const rooms = this.roomManager.getPublicRooms();
      callback({ success: true, rooms });
    });
  }

  /**
   * 绑定游戏相关事件
   */
  private bindGameEvents(socket: TypedSocket): void {
    // 开始游戏
    socket.on('game:start', (callback) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room) {
        callback?.({ success: false, error: '不在房间中' });
        return;
      }
      
      const result = this.roomManager.startGame(room.id, socket.id);
      
      if (result.success && room.game) {
        // 设置游戏状态回调
        room.game.setOnStateChange((state, event) => {
          this.broadcastGameState(room.id, state, event);
        });
        
        // 广播游戏开始（客户端根据自己的 playerIndex 取对应数据）
        const initialState = room.game.getState();
        this.io.to(room.id).emit('game:started', initialState);
        
        // 启动游戏（触发式神选择倒计时等）
        room.game.start();
        
        callback?.({ success: true });
        console.log(`[SocketServer] 房间 ${room.id} 游戏开始`);
      } else {
        callback?.({ success: false, error: result.error });
      }
    });

    // 游戏动作
    socket.on('game:action', (action, seq, callback) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room || !room.game) {
        callback?.({ success: false, error: '游戏未开始' });
        return;
      }
      
      const result = room.game.handleAction(socket.id, action);
      
      if (result.success) {
        // 发送动作结果
        socket.emit('game:actionResult', seq, true);
        callback?.({ success: true });
      } else {
        socket.emit('game:actionResult', seq, false, result.error);
        callback?.({ success: false, error: result.error });
      }
    });
  }

  /**
   * 绑定心跳事件
   */
  private bindPingEvents(socket: TypedSocket): void {
    socket.on('ping', (timestamp) => {
      socket.emit('pong', timestamp, Date.now());
    });
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(socket: TypedSocket): void {
    console.log(`[SocketServer] 连接断开: ${socket.id}`);
    
    const roomId = socket.data.roomId;
    if (roomId) {
      const room = this.roomManager.getRoom(roomId);
      
      if (room) {
        // 如果游戏正在进行，标记玩家断线
        if (room.status === 'playing') {
          room.playerDisconnected(socket.id);
          this.io.to(roomId).emit('player:disconnected', socket.id, this.reconnectTimeout);
          
          // 设置重连超时
          room.setReconnectTimeout(socket.id, this.reconnectTimeout, () => {
            console.log(`[SocketServer] 玩家 ${socket.id} 重连超时`);
            this.roomManager.leaveRoom(socket.id);
            this.io.to(roomId).emit('room:playerLeft', socket.id);
          });
        } else {
          // 等待中，直接离开
          this.roomManager.leaveRoom(socket.id);
          this.io.to(roomId).emit('room:playerLeft', socket.id);
        }
      }
    }
    
    // 清理玩家名称
    this.playerNames.delete(socket.id);
  }

  /**
   * 广播游戏状态
   */
  private broadcastGameState(roomId: string, state: GameState, event?: GameEvent): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.game) return;
    
    const seq = room.game.getStateSeq();
    
    // 广播状态给所有人（客户端根据自己的 playerIndex 取对应数据）
    this.io.to(roomId).emit('game:stateSync', state, seq);
    
    // 如果有事件，也广播事件
    if (event) {
      this.io.to(roomId).emit('game:event', event);
    }
  }

  /**
   * 获取在线人数
   */
  getOnlineCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * 关闭服务器
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        console.log('[SocketServer] Socket.io 服务已关闭');
        resolve();
      });
    });
  }
}