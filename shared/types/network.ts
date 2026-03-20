/**
 * 御魂传说 - 网络协议类型定义
 * @file shared/types/network.ts
 * @version 1.0.0
 */

import type { CardInstance } from './cards';
import type { GameState, GameAction, GameEvent, GameConfig } from './game';

// ============ 房间相关 ============

/** 房间配置 */
export interface RoomConfig {
  maxPlayers: number;          // 2-6
  isPrivate: boolean;
  password?: string;
  gameConfig?: Partial<GameConfig>;
}

/** 房间状态 */
export type RoomState = 
  | 'WAITING'      // 等待玩家
  | 'STARTING'     // 正在启动
  | 'PLAYING'      // 游戏中
  | 'FINISHED';    // 已结束

/** 房间信息 */
export interface RoomInfo {
  roomId: string;
  hostId: string;
  state: RoomState;
  config: RoomConfig;
  players: RoomPlayer[];
  spectators: number;
  createdAt: number;
}

/** 房间内玩家信息 */
export interface RoomPlayer {
  id: string;
  name: string;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
}

// ============ 客户端 → 服务端 (C2S) ============

export type C2S_Message =
  // 房间相关
  | { type: 'CREATE_ROOM'; config: RoomConfig }
  | { type: 'JOIN_ROOM'; roomId: string; password?: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PLAYER_READY'; ready: boolean }
  
  // 游戏动作
  | { type: 'GAME_ACTION'; action: GameAction; seq: number }
  
  // 交互响应
  | { type: 'INTERACT_RESPONSE'; requestId: string; response: InteractResponse }
  
  // 心跳
  | { type: 'PING'; timestamp: number };

// ============ 服务端 → 客户端 (S2C) ============

export type S2C_Message =
  // 房间相关
  | { type: 'ROOM_CREATED'; roomId: string }
  | { type: 'ROOM_JOINED'; roomInfo: RoomInfo }
  | { type: 'ROOM_UPDATE'; roomInfo: RoomInfo }
  | { type: 'ROOM_ERROR'; code: ErrorCode; message: string }
  
  // 游戏状态
  | { type: 'GAME_START'; state: GameState }
  | { type: 'STATE_SYNC'; state: GameState; seq: number }
  | { type: 'STATE_DELTA'; delta: StateDelta; seq: number }
  
  // 交互请求
  | { type: 'INTERACT_REQUEST'; request: InteractRequest }
  
  // 动作结果
  | { type: 'ACTION_RESULT'; seq: number; success: boolean; error?: string }
  
  // 游戏事件
  | { type: 'GAME_EVENT'; event: GameEvent }
  
  // 玩家状态
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; timeout: number }
  | { type: 'PLAYER_RECONNECTED'; playerId: string }
  | { type: 'RECONNECTED'; state: GameState }
  
  // 心跳响应
  | { type: 'PONG'; timestamp: number; serverTime: number };

// ============ 错误码 ============

export enum ErrorCode {
  // 房间错误
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_STARTED = 'ROOM_STARTED',
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  
  // 游戏错误
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_PHASE = 'INVALID_PHASE',
  
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ============ 交互系统 ============

/** 交互请求类型 */
export type InteractType = 
  | 'CHOICE'           // 选择选项
  | 'SELECT_CARDS'     // 选择卡牌
  | 'SELECT_TARGET';   // 选择目标

/** 交互请求 */
export interface InteractRequest {
  requestId: string;
  playerId: string;
  type: InteractType;
  timeout: number;
  data: ChoiceData | SelectCardsData | SelectTargetData;
}

/** 选择选项数据 */
export interface ChoiceData {
  type: 'CHOICE';
  options: string[];
  title?: string;
}

/** 选择卡牌数据 */
export interface SelectCardsData {
  type: 'SELECT_CARDS';
  candidates: CardInstance[];
  count: number;
  minCount?: number;
  title?: string;
}

/** 选择目标数据 */
export interface SelectTargetData {
  type: 'SELECT_TARGET';
  candidates: CardInstance[];
  title?: string;
}

/** 交互响应 */
export interface InteractResponse {
  requestId: string;
  choiceIndex?: number;
  selectedCardIds?: string[];
  targetId?: string;
}

// ============ 状态同步 ============

/** 增量状态变化 */
export interface StateDelta {
  // 玩家状态变化
  players?: {
    [playerId: string]: PlayerDelta;
  };
  
  // 场上状态变化
  field?: FieldDelta;
  
  // 回合信息
  turnInfo?: {
    currentPlayerIndex?: number;
    turnPhase?: string;
    turnNumber?: number;
  };
  
  // 日志追加
  logAppend?: LogEntry[];
}

/** 玩家状态增量 */
export interface PlayerDelta {
  ghostFire?: number;
  damage?: number;
  totalCharm?: number;
  hand?: { add?: CardInstance[]; remove?: string[] };
  discard?: { add?: CardInstance[]; remove?: string[] };
  played?: { add?: CardInstance[]; remove?: string[] };
  exiled?: { add?: CardInstance[]; remove?: string[] };
}

/** 战场状态增量 */
export interface FieldDelta {
  yokaiSlots?: { index: number; card: CardInstance | null }[];
  bossCurrentHp?: number;
  spellCounts?: Partial<{ basic: number; medium: number; advanced: number }>;
}

/** 日志条目 */
export interface LogEntry {
  type: string;
  playerId?: string;
  message: string;
  timestamp: number;
}

// ============ 动作结果 ============

export interface ActionResult {
  success: boolean;
  seq: number;
  error?: string;
  state?: GameState;
}

// ============ 隐藏卡牌占位 ============

export const HIDDEN_CARD: Partial<CardInstance> = {
  instanceId: 'hidden',
  cardId: 'hidden',
  name: '???',
  cardType: 'yokai',
};

export const HIDDEN_BOSS = {
  id: 'hidden',
  name: '???',
};
