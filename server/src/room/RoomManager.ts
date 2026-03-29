/**
 * 御魂传说 - 房间管理器
 * @file server/src/room/RoomManager.ts
 */

import { Room } from './Room';
import { MultiplayerGame } from '../game/MultiplayerGame';
import { RoomInfo, RoomConfig, ErrorCodes } from '../types/index';

const ROOM_CLEANUP_INTERVAL = 60000;
const ROOM_EXPIRE_TIME = 3600000;
const WAITING_ROOM_EXPIRE_TIME = 1800000;

export class RoomManager {
  private static _instance: RoomManager;
  private _rooms: Map<string, Room> = new Map();
  private _playerRooms: Map<string, string> = new Map();
  private _cleanupTimer: NodeJS.Timeout | null = null;
  private _onRoomUpdate?: (room: Room) => void;
  private _onRoomDeleted?: (roomId: string, disbandReason?: string) => void;

  private constructor() {
    this.startCleanup();
  }

  static getInstance(): RoomManager {
    if (!RoomManager._instance) {
      RoomManager._instance = new RoomManager();
    }
    return RoomManager._instance;
  }

  onRoomUpdate(callback: (room: Room) => void): void {
    this._onRoomUpdate = callback;
  }

  onRoomDeleted(callback: (roomId: string, disbandReason?: string) => void): void {
    this._onRoomDeleted = callback;
  }

  /** 主动推送房间快照（用于 setPlayerReady 等不经过 joinRoom 的变更） */
  notifyRoomUpdate(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room) this._onRoomUpdate?.(room);
  }

  createRoom(hostId: string, hostName: string, config: Partial<RoomConfig> = {}): Room {
    const existingRoomId = this._playerRooms.get(hostId);
    if (existingRoomId) {
      this.leaveRoom(hostId);
    }
    
    const room = new Room(hostId, hostName, config);
    
    while (this._rooms.has(room.id)) {
      (room as any).id = this.generateUniqueRoomId();
    }
    
    this._rooms.set(room.id, room);
    this._playerRooms.set(hostId, room.id);
    
    console.log(`[RoomManager] 房间已创建: ${room.id}, 房主: ${hostName}`);
    
    return room;
  }

  private generateUniqueRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  getRoom(roomId: string): Room | undefined {
    return this._rooms.get(roomId.toUpperCase());
  }

  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this._playerRooms.get(playerId);
    if (!roomId) return undefined;
    return this._rooms.get(roomId);
  }

  /**
   * 断线重连时更新 playerId -> roomId 映射（旧socket迁移到新socket）
   */
  rebindPlayerRoom(oldPlayerId: string, newPlayerId: string, roomId: string): void {
    const existing = this._playerRooms.get(oldPlayerId);
    if (existing && existing === roomId) {
      this._playerRooms.delete(oldPlayerId);
    }
    this._playerRooms.set(newPlayerId, roomId);
  }

  joinRoom(
    roomId: string,
    playerId: string,
    playerName: string,
    password?: string
  ): { success: boolean; room?: Room; error?: string; errorCode?: string } {
    const room = this.getRoom(roomId);
    
    if (!room) {
      return { success: false, error: '房间不存在', errorCode: ErrorCodes.ROOM_NOT_FOUND };
    }
    
    if (!room.validatePassword(password)) {
      return { success: false, error: '密码错误', errorCode: ErrorCodes.ROOM_WRONG_PASSWORD };
    }
    
    const existingRoomId = this._playerRooms.get(playerId);
    if (existingRoomId && existingRoomId !== roomId) {
      this.leaveRoom(playerId);
    }
    
    const result = room.addPlayer(playerId, playerName);
    
    if (result.success) {
      this._playerRooms.set(playerId, room.id);
      console.log(`[RoomManager] 玩家 ${playerName} 加入房间 ${room.id}`);
      this._onRoomUpdate?.(room);
      return { success: true, room };
    }
    
    return { success: false, error: result.error, errorCode: this.mapErrorToCode(result.error || '') };
  }

  leaveRoom(playerId: string): { success: boolean; roomDeleted: boolean; newHostId?: string } {
    const roomId = this._playerRooms.get(playerId);
    if (!roomId) {
      return { success: false, roomDeleted: false };
    }
    
    const room = this._rooms.get(roomId);
    if (!room) {
      this._playerRooms.delete(playerId);
      return { success: false, roomDeleted: false };
    }
    
    // 等待中的房间，房主离开直接解散
    const isHost = room.hostId === playerId;
    if (isHost && room.status === 'waiting') {
      console.log(`[RoomManager] 房主 ${playerId} 离开等待中的房间 ${roomId}，解散房间`);
      this.deleteRoom(roomId);
      return { success: true, roomDeleted: true };
    }
    
    const result = room.removePlayer(playerId);
    this._playerRooms.delete(playerId);
    
    console.log(`[RoomManager] 玩家 ${playerId} 离开房间 ${roomId}`);
    
    if (room.playerCount === 0) {
      this.deleteRoom(roomId);
      return { success: true, roomDeleted: true };
    }
    
    this._onRoomUpdate?.(room);
    return { success: true, roomDeleted: false, newHostId: result.newHostId };
  }

  deleteRoom(roomId: string, disbandReason?: string): boolean {
    const room = this._rooms.get(roomId);
    if (!room) return false;
    
    room.cleanup();
    
    for (const player of room.players) {
      this._playerRooms.delete(player.id);
    }
    
    this._rooms.delete(roomId);
    console.log(`[RoomManager] 房间已删除: ${roomId}`);
    this._onRoomDeleted?.(roomId, disbandReason);
    
    return true;
  }

  startGame(roomId: string, playerId: string): { success: boolean; error?: string } {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }
    
    if (room.hostId !== playerId) {
      return { success: false, error: '只有房主可以开始游戏' };
    }
    
    const canStart = room.canStartGame();
    if (!canStart.canStart) {
      return { success: false, error: canStart.error };
    }
    
    const players = room.players.map(p => ({ id: p.id, name: p.name }));
    const game = new MultiplayerGame(room.id, players);
    room.setGame(game);
    room.setStatus('playing');
    
    console.log(`[RoomManager] 游戏开始: 房间 ${roomId}, ${players.length} 名玩家`);

    this.notifyRoomUpdate(roomId);
    
    return { success: true };
  }

  getPublicRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    console.log(`[RoomManager] getPublicRooms: 总房间数=${this._rooms.size}`);
    for (const room of this._rooms.values()) {
      console.log(`[RoomManager] 检查房间 ${room.id}: status=${room.status}, isPrivate=${room.config.isPrivate}`);
      if (room.status === 'waiting' && !room.config.isPrivate) {
        rooms.push(room.toRoomInfo());
      }
    }
    console.log(`[RoomManager] 返回公开房间数: ${rooms.length}`);
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    return rooms;
  }

  getRoomCount(): number {
    return this._rooms.size;
  }

  /** 获取所有房间（包括游戏中的） */
  getAllRooms(): Map<string, Room> {
    return this._rooms;
  }

  getOnlinePlayerCount(): number {
    return this._playerRooms.size;
  }

  handlePlayerDisconnect(playerId: string, reconnectTimeout: number): void {
    const room = this.getPlayerRoom(playerId);
    if (!room) return;
    
    room.playerDisconnected(playerId);
    room.setReconnectTimeout(playerId, reconnectTimeout, () => {
      console.log(`[RoomManager] 玩家 ${playerId} 重连超时`);
      this.leaveRoom(playerId);
    });
    this._onRoomUpdate?.(room);
  }

  handlePlayerReconnect(playerId: string): Room | undefined {
    const room = this.getPlayerRoom(playerId);
    if (!room) return undefined;
    
    room.playerReconnected(playerId);
    this._onRoomUpdate?.(room);
    return room;
  }

  private startCleanup(): void {
    this._cleanupTimer = setInterval(() => {
      this.cleanupExpiredRooms();
    }, ROOM_CLEANUP_INTERVAL);
  }

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    const roomsToDelete: string[] = [];
    
    for (const [roomId, room] of this._rooms) {
      const expireTime = room.status === 'waiting' ? WAITING_ROOM_EXPIRE_TIME : ROOM_EXPIRE_TIME;
      if (now - room.lastActivity > expireTime) {
        roomsToDelete.push(roomId);
      }
    }
    
    for (const roomId of roomsToDelete) {
      console.log(`[RoomManager] 清理过期房间: ${roomId}`);
      this.deleteRoom(roomId);
    }
  }

  shutdown(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    
    for (const room of this._rooms.values()) {
      room.cleanup();
    }
    this._rooms.clear();
    this._playerRooms.clear();
    
    console.log('[RoomManager] 已关闭');
  }

  private mapErrorToCode(error: string): string {
    if (error.includes('已满')) return ErrorCodes.ROOM_FULL;
    if (error.includes('已开始')) return ErrorCodes.ROOM_ALREADY_STARTED;
    if (error.includes('已在房间')) return ErrorCodes.ROOM_ALREADY_IN_ROOM;
    return ErrorCodes.UNKNOWN_ERROR;
  }
}
