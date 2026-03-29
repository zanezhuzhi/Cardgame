/**
 * 御魂传说 - 类型定义导出
 * @file shared/types/index.ts
 */
export * from './cards';
export * from './game';
export * from './pendingChoice';
export * from './shikigami';
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
//# sourceMappingURL=index.d.ts.map