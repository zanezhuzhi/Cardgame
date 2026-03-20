/**
 * Socket 类型定义
 * @file server/src/socket/types.ts
 */

import type { Socket } from 'socket.io';
import type { S2C_Message, C2S_Message } from '../../../shared/types/network';

/**
 * 玩家连接接口
 */
export interface PlayerConnection {
  socket: Socket;
  playerId: string;
  playerName: string;
  connectedAt: number;
  lastPing: number;
  
  send(message: S2C_Message): void;
  disconnect(): void;
}

/**
 * 创建玩家连接
 */
export function createPlayerConnection(
  socket: Socket,
  playerId: string,
  playerName: string
): PlayerConnection {
  return {
    socket,
    playerId,
    playerName,
    connectedAt: Date.now(),
    lastPing: Date.now(),
    
    send(message: S2C_Message) {
      socket.emit('message', message);
    },
    
    disconnect() {
      socket.disconnect(true);
    },
  };
}

/**
 * 连接上下文
 */
export interface ConnectionContext {
  playerId: string;
  playerName: string;
  roomId?: string;
}
