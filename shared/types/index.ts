/**
 * 御魂传说 - 类型定义导出
 * @file shared/types/index.ts
 */

// 导出卡牌类型
export * from './cards';

// 导出游戏状态类型
export * from './game';

// 导出 PendingChoice 类型
export * from './pendingChoice';

// 导出式神技能引擎类型
export * from './shikigami';

// 房间相关类型
export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  players: RoomPlayer[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'ended';
  createdAt: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

// Socket 事件类型
export interface ServerToClientEvents {
  'room:created': (room: RoomInfo) => void;
  'room:joined': (room: RoomInfo) => void;
  'room:updated': (room: RoomInfo) => void;
  'room:left': () => void;
  'room:error': (message: string) => void;
  'game:started': (state: import('./game').GameState) => void;
  'game:state': (state: import('./game').GameState) => void;
  'game:event': (event: import('./game').GameEvent) => void;
  'game:error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:create': (playerName: string) => void;
  'room:join': (roomId: string, playerName: string) => void;
  'room:leave': () => void;
  'room:ready': (ready: boolean) => void;
  'game:start': () => void;
  'game:action': (action: import('./game').GameAction) => void;
}