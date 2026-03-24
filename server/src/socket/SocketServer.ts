/**
 * 御魂传说 - Socket.io 服务封装
 * @file server/src/socket/SocketServer.ts
 * 
 * 封装 Socket.io 服务器，处理 WebSocket 连接和事件
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import * as fs from 'fs';
import * as path from 'path';
import { RoomManager } from '../room/RoomManager';
import { MatchQueue, MatchResult } from '../match/MatchQueue';
import { ConfirmSessionManager, ConfirmPlayer, ConfirmSessionData } from '../match/ConfirmSession';
import { AIPlayerManager, generateAIPlayer } from '../ai/AIPlayer';
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
  GameLogEntry,
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
  private matchQueue: MatchQueue;
  private confirmManager: ConfirmSessionManager;
  private aiManager: AIPlayerManager;
  
  /** 玩家名称映射 (socketId -> playerName) */
  private playerNames: Map<string, string> = new Map();
  
  /** 重连超时时间 */
  private reconnectTimeout: number = 60000; // 1分钟

  /** 玩家聊天冷却记录 (socketId -> lastChatTimestamp) */
  private chatCooldowns: Map<string, number> = new Map();
  
  /** 聊天冷却时间 (ms) */
  private readonly CHAT_COOLDOWN = 5000;
  
  /** 聊天消息最大长度 */
  private readonly CHAT_MAX_LENGTH = 100;

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
    
    // 获取匹配队列
    this.matchQueue = MatchQueue.getInstance();
    this.setupMatchQueueCallbacks();
    
    // 获取确认会话管理器
    this.confirmManager = ConfirmSessionManager.getInstance();
    
    // 获取AI管理器
    this.aiManager = AIPlayerManager.getInstance();
    
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
    
    // 房间删除时通知所有成员（房间被解散）
    this.roomManager.onRoomDeleted((roomId) => {
      console.log(`[SocketServer] 房间 ${roomId} 被解散，通知所有成员`);
      this.io.to(roomId).emit('room:disbanded' as any, { reason: '房主已离开，房间已解散' });
      
      // 让所有socket离开这个房间
      const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        roomSockets.forEach(socketId => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.leave(roomId);
            socket.data.roomId = null;
          }
        });
      }
    });
  }

  /**
   * 设置匹配队列回调
   */
  private setupMatchQueueCallbacks(): void {
    this.matchQueue.setMatchCallback((result: MatchResult) => {
      this.handleMatchComplete(result);
    });
  }

  /**
   * 处理匹配完成 - 进入确认阶段
   */
  private handleMatchComplete(result: MatchResult): void {
    console.log(`[SocketServer] 匹配完成回调: ${result.players.length} 真人 + ${result.aiCount} AI`);
    
    if (result.players.length === 0) {
      console.warn('[SocketServer] 匹配结果为空');
      return;
    }
    
    // 构建确认玩家列表
    const confirmPlayers: ConfirmPlayer[] = [];
    
    // 添加真人玩家
    for (const p of result.players) {
      const socket = this.io.sockets.sockets.get(p.socketId);
      if (socket) {
        confirmPlayers.push({
          id: p.socketId,
          name: p.playerName,
          isAI: false,
          confirmed: false,
          socketId: p.socketId,
        });
      }
    }
    
    // 添加AI玩家
    for (let i = 0; i < result.aiCount; i++) {
      const ai = this.aiManager.createAI(i);
      confirmPlayers.push({
        id: ai.config.id,
        name: ai.config.name,
        isAI: true,
        confirmed: true, // AI自动确认
      });
    }
    
    if (confirmPlayers.length < 3) {
      console.warn('[SocketServer] 确认玩家数量不足3人');
      result.players.forEach(p => {
        const s = this.io.sockets.sockets.get(p.socketId);
        s?.emit('match:failed' as any, { reason: '玩家数量不足' });
      });
      return;
    }
    
    // 创建确认会话
    const session = this.confirmManager.createSession(
      confirmPlayers,
      // onAllConfirmed: 所有玩家确认后开始游戏
      (sessionData) => this.handleConfirmSuccess(sessionData),
      // onTimeout: 超时处理
      (sessionData) => this.handleConfirmTimeout(sessionData),
      // onCancel: 玩家取消
      (sessionData, cancelledBy) => this.handleConfirmCancel(sessionData, cancelledBy)
    );
    
    // 通知所有真人玩家进入确认阶段
    const confirmData = {
      sessionId: session.sessionId,
      players: session.players.map(p => ({
        id: p.id,
        name: p.name,
        isAI: p.isAI,
        confirmed: p.confirmed,
      })),
      timeout: 15,
    };
    
    result.players.forEach(p => {
      const s = this.io.sockets.sockets.get(p.socketId);
      s?.emit('match:confirmPhase' as any, confirmData);
    });
    
    console.log(`[SocketServer] 确认会话创建成功: ${session.sessionId}, ${confirmPlayers.length} 玩家`);
  }
  
  /**
   * 确认成功 - 创建房间并开始游戏
   */
  private handleConfirmSuccess(sessionData: ConfirmSessionData): void {
    console.log(`[SocketServer] 确认成功: ${sessionData.sessionId}`);
    
    const humanPlayers = sessionData.players.filter(p => !p.isAI);
    const aiPlayers = sessionData.players.filter(p => p.isAI);
    
    if (humanPlayers.length === 0) {
      console.warn('[SocketServer] 没有真人玩家');
      return;
    }
    
    // 第一个真人玩家作为房主
    const host = humanPlayers[0];
    const hostSocket = this.io.sockets.sockets.get(host.socketId!);
    
    if (!hostSocket) {
      console.warn(`[SocketServer] 房主 socket 不存在`);
      return;
    }
    
    // 创建匹配房间
    const roomConfig: RoomConfig = {
      name: `匹配房间-${Date.now().toString(36)}`,
      maxPlayers: 6,
      minPlayers: 3,
      isPrivate: true,
    };
    
    try {
      const room = this.roomManager.createRoom(host.socketId!, host.name, roomConfig);
      
      // 房主加入房间
      hostSocket.join(room.id);
      hostSocket.data.roomId = room.id;
      
      // 其他真人玩家加入房间
      for (let i = 1; i < humanPlayers.length; i++) {
        const player = humanPlayers[i];
        const playerSocket = this.io.sockets.sockets.get(player.socketId!);
        
        if (playerSocket) {
          const joinResult = this.roomManager.joinRoom(room.id, player.socketId!, player.name);
          if (joinResult.success) {
            playerSocket.join(room.id);
            playerSocket.data.roomId = room.id;
          }
        }
      }
      
      // 添加AI玩家到房间
      for (const ai of aiPlayers) {
        const joinResult = this.roomManager.joinRoom(room.id, ai.id, ai.name);
        if (joinResult.success) {
          console.log(`[SocketServer] AI 玩家 ${ai.name} 加入房间 ${room.id}`);
        }
      }
      
      // 通知所有真人玩家匹配成功，准备开始游戏
      humanPlayers.forEach(p => {
        const s = this.io.sockets.sockets.get(p.socketId!);
        s?.emit('match:found' as any, {
          roomId: room.id,
          players: room.players,
          aiCount: aiPlayers.length,
        });
      });
      
      console.log(`[SocketServer] 匹配房间创建成功: ${room.id}`);
      
    } catch (error: any) {
      console.error('[SocketServer] 创建匹配房间失败:', error);
      humanPlayers.forEach(p => {
        const s = this.io.sockets.sockets.get(p.socketId!);
        s?.emit('match:failed' as any, { reason: error.message || '创建房间失败' });
      });
    }
  }
  
  /**
   * 确认超时 - 通知玩家返回大厅
   */
  private handleConfirmTimeout(sessionData: ConfirmSessionData): void {
    console.log(`[SocketServer] 确认超时: ${sessionData.sessionId}`);
    
    // 找出未确认的玩家
    const notConfirmed = sessionData.players.filter(p => !p.isAI && !p.confirmed);
    const notConfirmedNames = notConfirmed.map(p => p.name).join(', ');
    
    // 通知所有真人玩家
    sessionData.players.forEach(p => {
      if (!p.isAI && p.socketId) {
        const s = this.io.sockets.sockets.get(p.socketId);
        s?.emit('match:confirmFailed' as any, {
          reason: `确认超时，以下玩家未确认: ${notConfirmedNames}`,
        });
      }
    });
    
    // 清理AI
    sessionData.players.filter(p => p.isAI).forEach(ai => {
      this.aiManager.removeAI(ai.id);
    });
  }
  
  /**
   * 玩家取消确认 - 通知其他玩家
   */
  private handleConfirmCancel(sessionData: ConfirmSessionData, cancelledBy: string): void {
    const cancelledPlayer = sessionData.players.find(p => p.id === cancelledBy);
    const cancelledName = cancelledPlayer?.name || '未知玩家';
    
    console.log(`[SocketServer] 玩家取消确认: ${cancelledName}`);
    
    // 通知所有其他真人玩家
    sessionData.players.forEach(p => {
      if (!p.isAI && p.socketId && p.id !== cancelledBy) {
        const s = this.io.sockets.sockets.get(p.socketId);
        s?.emit('match:confirmFailed' as any, {
          reason: `${cancelledName} 取消了匹配`,
        });
      }
    });
    
    // 清理AI
    sessionData.players.filter(p => p.isAI).forEach(ai => {
      this.aiManager.removeAI(ai.id);
    });
  }

  /**
   * 设置连接处理
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      const currentCount = this.io.sockets.sockets.size;
      console.log(`[SocketServer] 新连接: ${socket.id} (当前在线: ${currentCount})`);
      
      // 调试：记录所有收到的事件
      socket.onAny((eventName, ...args) => {
        console.log(`[DEBUG] 收到事件: ${eventName}`, args.length > 0 ? JSON.stringify(args).substring(0, 100) : '');
      });
      
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
      this.bindChatEvents(socket);
      this.bindPingEvents(socket);
      this.bindMatchEvents(socket);
      
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
        
        // 调试：检查房间成员
        const roomSockets = this.io.sockets.adapter.rooms.get(room.id);
        console.log(`[SocketServer] 房间 ${room.id} Socket.io 成员:`, roomSockets ? Array.from(roomSockets) : '无');
        console.log(`[SocketServer] 房间 ${room.id} Room 玩家:`, room.players.map(p => p.id));
        
        // 广播游戏开始（客户端根据自己的 playerIndex 取对应数据）
        const initialState = room.game.getState();
        
        // 使用逐个发送确保所有玩家收到
        room.players.forEach(p => {
          const playerSocket = this.io.sockets.sockets.get(p.id);
          if (playerSocket) {
            console.log(`[SocketServer] 向玩家 ${p.name} (${p.id}) 发送 game:started`);
            playerSocket.emit('game:started', initialState);
          } else {
            console.warn(`[SocketServer] 玩家 ${p.name} (${p.id}) socket 不存在！`);
          }
        });
        
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

    // 超度选择响应（唐纸伞妖等卡牌效果）
    socket.on('game:salvageResponse' as any, (data: { playerId: string; salvage: boolean } | boolean, callback?: (result: { success: boolean; error?: string }) => void) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room || !room.game) {
        callback?.({ success: false, error: '游戏未开始' });
        return;
      }
      
      // 兼容两种格式：{ playerId, salvage } 或直接 boolean
      const doSalvage = typeof data === 'boolean' ? data : data.salvage;
      const result = room.game.handleSalvageResponse(socket.id, doSalvage);
      
      if (result.success) {
        // 广播游戏状态更新
        this.broadcastGameState(room.id, room.game.getState());
      }
      
      callback?.(result);
    });

    // 妖怪目标选择响应（天邪鬼绿等卡牌效果）
    socket.on('game:yokaiTargetResponse' as any, (data: { targetId: string }, callback?: (result: { success: boolean; error?: string }) => void) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (!room || !room.game) {
        callback?.({ success: false, error: '游戏未开始' });
        return;
      }
      
      const result = room.game.handleYokaiTargetResponse(socket.id, data.targetId);
      
      if (result.success) {
        // 广播游戏状态更新
        this.broadcastGameState(room.id, room.game.getState());
      }
      
      callback?.(result);
    });
  }

  /**
   * 绑定聊天与GM指令事件
   */
  private bindChatEvents(socket: TypedSocket): void {
    // 聊天消息
    socket.on('chat:send' as any, (data: { content: string; roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        callback?.({ success: false, error: '不在房间中' });
        return;
      }

      const content = data.content?.trim();
      if (!content) {
        callback?.({ success: false, error: '消息不能为空' });
        return;
      }
      if (content.length > this.CHAT_MAX_LENGTH) {
        callback?.({ success: false, error: `消息不能超过${this.CHAT_MAX_LENGTH}字符` });
        return;
      }

      // 冷却检查
      const now = Date.now();
      const lastChat = this.chatCooldowns.get(socket.id) || 0;
      if (now - lastChat < this.CHAT_COOLDOWN) {
        const remaining = Math.ceil((this.CHAT_COOLDOWN - (now - lastChat)) / 1000);
        callback?.({ success: false, error: `发言冷却中，${remaining}秒后可再次发言` });
        return;
      }
      this.chatCooldowns.set(socket.id, now);

      const senderName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      const room = this.roomManager.getRoom(roomId);

      // 构造聊天日志条目
      const chatLog: GameLogEntry = {
        type: 'chat',
        playerId: socket.id,
        playerName: senderName,
        message: `💬 [${senderName}] ${content}`,
        timestamp: now,
        visibility: 'public',
        chatData: {
          senderId: socket.id,
          senderName,
          rawContent: content,
        },
      };

      // 如果游戏正在进行，写入 state.log 并通过 stateSync 广播
      if (room?.game) {
        const state = room.game.getState();
        state.log.push(chatLog);
        this.broadcastGameState(roomId, state);
      } else {
        // 游戏未开始时（大厅阶段），直接广播聊天事件
        this.io.to(roomId).emit('game:event' as any, { type: 'CHAT_MESSAGE', log: chatLog });
      }

      callback?.({ success: true });
    });

    // GM 指令
    socket.on('gm:command' as any, (data: { command: string; roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        callback?.({ success: false, error: '不在房间中' });
        return;
      }

      const command = data.command?.trim();
      if (!command) {
        callback?.({ success: false, error: '指令不能为空' });
        return;
      }

      const [cmd, ...args] = command.split(' ');
      const result = this.executeGMCommand(cmd, args, socket);

      socket.emit('gm:result' as any, {
        message: result.message,
        success: result.success,
      });

      callback?.(result);
    });
  }

  /**
   * 执行GM指令
   */
  private executeGMCommand(cmd: string, args: string[], socket: TypedSocket): { success: boolean; message: string; error?: string } {
    switch (cmd.toLowerCase()) {
      case 'help':
        return {
          success: true,
          message: '可用指令: /help, /status, /ping, /addcard <卡牌名> [数量]',
        };

      case 'status': {
        const room = this.roomManager.getRoom(socket.data.roomId || '');
        if (!room) {
          return { success: false, message: '未找到房间', error: '未找到房间' };
        }
        const playerCount = room.playerCount;
        const status = room.status;
        return {
          success: true,
          message: `房间状态: ${status}，玩家数: ${playerCount}`,
        };
      }

      case 'ping':
        return { success: true, message: `Pong! 服务器时间: ${new Date().toLocaleTimeString()}` };

      case 'addcard': {
        // /addcard 卡牌名 [数量]
        if (args.length < 1) {
          return { success: false, message: '用法: /addcard <卡牌名> [数量]', error: '缺少卡牌名' };
        }
        const cardName = args[0];
        const count = parseInt(args[1]) || 1;
        
        const room = this.roomManager.getRoom(socket.data.roomId || '');
        if (!room || !room.game) {
          return { success: false, message: '游戏未开始', error: '游戏未开始' };
        }
        
        // 通过handleAction调用GM指令
        const result = room.game.handleAction(socket.id, {
          type: 'gmAddCard',
          cardName: cardName,
          count: count,
        } as any);
        
        if (result.success) {
          return { success: true, message: `已添加 ${count} 张 ${cardName}` };
        } else {
          return { success: false, message: result.error || '添加失败', error: result.error };
        }
      }

      default:
        return { success: false, message: `未知指令 /${cmd}，输入 /help 查看可用指令`, error: `未知指令: ${cmd}` };
    }
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
   * 绑定匹配相关事件
   */
  private bindMatchEvents(socket: TypedSocket): void {
    console.log(`[SocketServer] 绑定匹配事件到 socket: ${socket.id}`);
    
    // 获取在线人数
    socket.on('getOnlineCount' as any, () => {
      const count = this.getOnlineCount();
      console.log(`[SocketServer] 获取在线人数请求, 当前: ${count} 人`);
      socket.emit('onlineCount' as any, count);
    });
    
    // 开始匹配
    socket.on('match:start' as any, () => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      console.log(`[SocketServer] ⚡ 玩家 ${playerName} 开始匹配 (socket: ${socket.id})`);
      
      // 加入匹配队列
      const joined = this.matchQueue.join(socket.id, playerName);
      if (!joined) {
        socket.emit('match:failed' as any, { reason: '已在匹配队列中' });
        return;
      }
      
      // 发送队列状态
      socket.emit('match:queued' as any, {
        position: this.matchQueue.getQueueLength(),
      });
    });
    
    // 取消匹配（队列阶段）
    socket.on('match:cancel' as any, () => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      console.log(`[SocketServer] 玩家 ${playerName} 取消匹配`);
      
      // 从匹配队列移除
      this.matchQueue.leave(socket.id);
      socket.emit('match:cancelled' as any);
    });
    
    // 确认匹配（确认阶段）
    socket.on('match:confirm' as any, (data: { sessionId: string }) => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      console.log(`[SocketServer] 玩家 ${playerName} 确认匹配, sessionId: ${data.sessionId}`);
      
      const result = this.confirmManager.confirm(data.sessionId, socket.id);
      if (result.success) {
        // 通知所有玩家更新确认状态
        const session = this.confirmManager.getSession(data.sessionId);
        if (session) {
          session.players.forEach(p => {
            if (!p.isAI && p.socketId) {
              const s = this.io.sockets.sockets.get(p.socketId);
              s?.emit('match:confirmUpdate' as any, {
                sessionId: data.sessionId,
                playerId: socket.id,
                confirmed: true,
                players: session.players.map(pp => ({
                  id: pp.id,
                  name: pp.name,
                  isAI: pp.isAI,
                  confirmed: pp.confirmed,
                })),
              });
            }
          });
        }
      } else {
        socket.emit('match:confirmFailed' as any, { reason: result.error || '确认失败' });
      }
    });
    
    // 取消确认/拒绝匹配（确认阶段）
    socket.on('match:reject' as any, (data: { sessionId: string }) => {
      const playerName = socket.data.playerName || `玩家${socket.id.substring(0, 4)}`;
      console.log(`[SocketServer] 玩家 ${playerName} 拒绝匹配, sessionId: ${data.sessionId}`);
      
      this.confirmManager.cancel(data.sessionId, socket.id);
      // 回调会处理通知其他玩家
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
    
    // 从匹配队列移除
    this.matchQueue.leave(socket.id);
    
    // 清理玩家名称和聊天冷却
    this.playerNames.delete(socket.id);
    this.chatCooldowns.delete(socket.id);
  }

  /**
   * 广播游戏状态（按玩家过滤私有消息）
   */
  private broadcastGameState(roomId: string, state: GameState, event?: GameEvent): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room || !room.game) return;
    
    const seq = room.game.getStateSeq();
    
    // 获取房间内所有socket
    const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) {
      // 降级：无法获取房间socket时，使用原有广播方式
      this.io.to(roomId).emit('game:stateSync', state, seq);
      if (event) {
        this.io.to(roomId).emit('game:event', event);
      }
      return;
    }
    
    // 为每个玩家生成过滤后的状态
    for (const socketId of roomSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;
      
      const playerId = socket.data.playerId || socketId;
      
      // 过滤日志：保留公开消息 + 属于该玩家的私有消息
      const filteredLog = state.log.filter(entry => {
        // 没有visibility字段的默认为public（兼容旧消息）
        if (!entry.visibility || entry.visibility === 'public') {
          return true;
        }
        // 私有消息只发给对应玩家
        return entry.playerId === playerId;
      });
      
      // 创建该玩家专属的状态副本
      const playerState: GameState = {
        ...state,
        log: filteredLog
      };
      
      socket.emit('game:stateSync', playerState, seq);
    }
    
    // 如果有事件，广播给所有人
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