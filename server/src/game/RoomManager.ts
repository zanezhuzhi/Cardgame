/**
 * 房间管理器 - 管理所有游戏房间
 * @file server/src/game/RoomManager.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './GameRoom';
import { config } from '../config';
import type { RoomConfig, RoomInfo } from '../../../shared/types/network';
import type { PlayerConnection } from '../socket/types';

export interface CreateRoomResult {
  success: boolean;
  roomId?: string;
  room?: GameRoom;
  error?: string;
}

export interface JoinRoomResult {
  success: boolean;
  room?: GameRoom;
  error?: string;
}

/**
 * 房间管理器（单例）
 */
export class RoomManager {
  private static instance: RoomManager;
  
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map();  // playerId -> roomId
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.startCleanupTask();
  }
  
  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }
  
  // ============ 房间操作 ============
  
  /**
   * 创建房间
   */
  createRoom(hostId: string, roomConfig: RoomConfig): CreateRoomResult {
    // 检查玩家是否已在房间中
    if (this.playerRooms.has(hostId)) {
      return { success: false, error: '你已经在一个房间中' };
    }
    
    // 检查房间数量上限
    if (this.rooms.size >= config.room.maxRooms) {
      return { success: false, error: '服务器房间已满' };
    }
    
    // 生成房间ID（6位短码）
    const roomId = this.generateRoomId();
    
    // 创建房间
    const room = new GameRoom(roomId, hostId, roomConfig);
    this.rooms.set(roomId, room);
    
    // 设置房间销毁回调
    room.on('destroyed', () => {
      this.rooms.delete(roomId);
      // 清理玩家映射
      for (const [playerId, rid] of this.playerRooms) {
        if (rid === roomId) {
          this.playerRooms.delete(playerId);
        }
      }
    });
    
    console.log(`[RoomManager] 房间创建: ${roomId}, 房主: ${hostId}`);
    
    return { success: true, roomId, room };
  }
  
  /**
   * 加入房间
   */
  joinRoom(playerId: string, roomId: string, password?: string): JoinRoomResult {
    // 检查玩家是否已在房间中
    const currentRoomId = this.playerRooms.get(playerId);
    if (currentRoomId) {
      if (currentRoomId === roomId) {
        // 重连到同一房间
        const room = this.rooms.get(roomId);
        if (room) {
          return { success: true, room };
        }
      }
      return { success: false, error: '你已经在另一个房间中' };
    }
    
    // 查找房间
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }
    
    // 检查密码
    if (room.config.password && room.config.password !== password) {
      return { success: false, error: '密码错误' };
    }
    
    // 检查房间是否已满
    if (room.isFull()) {
      return { success: false, error: '房间已满' };
    }
    
    // 检查游戏是否已开始
    if (room.isStarted()) {
      return { success: false, error: '游戏已开始' };
    }
    
    return { success: true, room };
  }
  
  /**
   * 玩家进入房间后注册映射
   */
  registerPlayerInRoom(playerId: string, roomId: string): void {
    this.playerRooms.set(playerId, roomId);
  }
  
  /**
   * 玩家离开房间后清除映射
   */
  unregisterPlayerFromRoom(playerId: string): void {
    this.playerRooms.delete(playerId);
  }
  
  /**
   * 离开房间
   */
  leaveRoom(playerId: string): boolean {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) {
      return false;
    }
    
    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(playerId);
    }
    
    this.playerRooms.delete(playerId);
    return true;
  }
  
  /**
   * 获取玩家所在房间
   */
  getPlayerRoom(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }
  
  /**
   * 获取房间信息
   */
  getRoomInfo(roomId: string): RoomInfo | null {
    const room = this.rooms.get(roomId);
    return room?.getRoomInfo() || null;
  }
  
  /**
   * 获取所有公开房间列表
   */
  getPublicRooms(): RoomInfo[] {
    const publicRooms: RoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (!room.config.isPrivate && !room.isStarted()) {
        publicRooms.push(room.getRoomInfo());
      }
    }
    return publicRooms;
  }
  
  // ============ 辅助方法 ============
  
  /**
   * 生成6位房间ID
   */
  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 移除易混淆字符
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // 确保唯一
    if (this.rooms.has(id)) {
      return this.generateRoomId();
    }
    
    return id;
  }
  
  /**
   * 启动定时清理任务
   */
  private startCleanupTask(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleRooms();
    }, config.room.cleanupInterval);
  }
  
  /**
   * 清理过期房间
   */
  private cleanupStaleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      // 空房间或超时房间
      if (room.isEmpty() || room.isIdle(now)) {
        console.log(`[RoomManager] 清理过期房间: ${roomId}`);
        room.destroy();
        this.rooms.delete(roomId);
      }
    }
  }
  
  /**
   * 停止清理任务
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  // ============ 统计 ============
  
  getRoomCount(): number {
    return this.rooms.size;
  }
  
  getPlayerCount(): number {
    return this.playerRooms.size;
  }
}
