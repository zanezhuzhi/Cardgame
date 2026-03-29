/**
 * 御魂传说 - 服务端类型定义
 * @file server/src/types/index.ts
 */

// ============ 玩家信息 ============

/** 连接的玩家信息 */
export interface ConnectedPlayer {
  id: string;           // Socket ID
  name: string;         // 玩家昵称
  roomId: string | null; // 当前所在房间
  joinedAt: number;     // 加入时间
}

// ============ 房间相关 ============

/** 房间状态 */
export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'finished';

/** 房间内玩家 */
export interface RoomPlayer {
  id: string;           // 玩家ID（Socket ID）
  name: string;         // 玩家昵称
  isHost: boolean;      // 是否房主
  isReady: boolean;     // 是否准备
  isConnected: boolean; // 是否在线
  playerIndex: number;  // 游戏中的玩家索引
}

/** 房间配置 */
export interface RoomConfig {
  name?: string;        // 房间名称
  maxPlayers: number;   // 最大玩家数（3-6）
  minPlayers: number;   // 最小玩家数（默认3）
  isPrivate: boolean;   // 是否私有房间
  password?: string;    // 房间密码（私有房间）
}

/** 房间信息 */
export interface RoomInfo {
  id: string;           // 房间码（6位）
  name?: string;        // 房间名称
  hostId: string;       // 房主ID
  hostName?: string;    // 房主名称
  status: RoomStatus;   // 房间状态
  players: RoomPlayer[]; // 玩家列表
  maxPlayers: number;   // 最大玩家数
  minPlayers?: number;  // 最小玩家数
  isPrivate?: boolean;  // 是否私有
  createdAt: number;    // 创建时间
  config?: RoomConfig;  // 房间配置（可选，用于详细信息）
  lastActivity?: number; // 最后活动时间
}

// ============ 游戏相关类型（本地定义，避免跨项目导入问题）============

/** 游戏阶段 */
export type GamePhase = 'waiting' | 'setup' | 'shikigamiSelect' | 'playing' | 'ended';

/** 回合阶段 */
export type TurnPhase = 'ghostFire' | 'shikigami' | 'action' | 'cleanup';

/** 卡牌类型 */
export type CardType = 'onmyoji' | 'shikigami' | 'boss' | 'yokai' | 'spell' | 'penalty' | 'token';

/** 卡牌实例 */
export interface CardInstance {
  instanceId: string;
  cardId: string;
  cardType: CardType;
  name: string;
  hp?: number;
  maxHp?: number;
  charm?: number;
  damage?: number;
  effect?: string;
  image?: string;
}

/** 式神卡 */
export interface ShikigamiCard {
  id: string;
  name: string;
  type: 'shikigami';
  rarity?: string;
  skill?: {
    name: string;
    cost: number;
    description: string;
    effect?: string;
  };
  image?: string;
}

/** 鬼王卡 */
export interface BossCard {
  id: string;
  name: string;
  type: 'boss';
  stage: number;
  hp: number;
  charm?: number;
  effect?: string;
  image?: string;
}

/** 阴阳师卡 */
export interface OnmyojiCard {
  id: string;
  name: string;
  type: 'onmyoji';
  ability?: string;
  image?: string;
}

/** 游戏日志条目 */
export interface GameLogEntry {
  type: string;
  logSeq?: number;
  playerId?: string;
  playerName?: string;
  cardName?: string;
  targetName?: string;
  value?: number;
  message: string;
  timestamp: number;
  visibility?: 'public' | 'private';
  refs?: Record<string, any>;
  chatData?: {
    senderId: string;
    senderName: string;
    rawContent: string;
  };
}

/** 式神状态 */
export interface ShikigamiState {
  cardId: string;
  isExhausted: boolean;
  markers: Record<string, number>;
}

/** 临时增益 */
export interface TempBuff {
  type: string;
  value: number;
  source: string;
}

/** 玩家状态 */
export interface PlayerState {
  id: string;
  name: string;
  onmyoji: OnmyojiCard | null;
  shikigami: ShikigamiCard[];
  maxShikigami: number;
  ghostFire: number;
  maxGhostFire: number;
  damage: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  played: CardInstance[];
  exiled: CardInstance[];
  totalCharm: number;
  cardsPlayed: number;
  isConnected: boolean;
  disconnectedAt?: number;
  lastActionAt?: number;
  isOfflineHosted?: boolean;
  isReady: boolean;
  /** 是否为 AI 座位 */
  isAI?: boolean;
  aiStrategy?: 'L1' | 'L2' | 'L3' | 'L4';
  shikigamiState: ShikigamiState[];
  tempBuffs: TempBuff[];
  // 式神选择阶段的临时字段
  selectedShikigami?: ShikigamiCard[];
  // 本回合是否已获得基础术式
  hasGainedBasicSpell?: boolean;
}

/** 战场状态 */
export interface FieldState {
  yokaiSlots: (CardInstance | null)[];
  currentBoss: BossCard | null;
  bossCurrentHp: number;
  bossDeck: BossCard[];
  spellSupply: {
    basic: CardInstance | null;
    medium: CardInstance | null;
    advanced: CardInstance | null;
  };
  spellCounts: {
    basic: number;
    medium: number;
    advanced: number;
  };
  tokenShop: number;
  penaltyPile: CardInstance[];
  yokaiDeck: CardInstance[];
  shikigamiSupply?: ShikigamiCard[];
  exileZone: CardInstance[];
}

// ============ 伤害池 ============

/**
 * 伤害池
 * @description 精细追踪当前回合各来源累积的伤害点数
 * 用于镜姬【妖】效果：只免疫阴阳术（spell）伤害，御魂/式神伤害正常生效
 */
export interface DamagePool {
  /** 阴阳术伤害（镜姬免疫） */
  spell: number;
  /** 御魂效果伤害（镜姬不免疫） */
  yokai: number;
  /** 式神技能伤害（镜姬不免疫） */
  shikigami: number;
  /** 其他来源伤害 */
  other: number;
}

/** 创建空伤害池 */
export function createEmptyDamagePool(): DamagePool {
  return { spell: 0, yokai: 0, shikigami: 0, other: 0 };
}

/** 游戏状态 */
export interface GameState {
  roomId: string;
  phase: GamePhase;
  playerCount?: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  turnNumber: number;
  turnPhase: TurnPhase | 'start';
  turnStartAt?: number;
  turnTimeoutMs?: number;
  /** 多人：等待其他玩家回合外反馈时暂停行动阶段倒计时 */
  turnTimerPaused?: boolean;
  turnPausedRemainMs?: number;
  outOfTurnFeedbackDeadlineAt?: number;
  field: FieldState;
  shikigamiDeck?: ShikigamiCard[];
  shikigamiOptions?: ShikigamiCard[];
  log: GameLogEntry[];
  lastUpdate: number;
  lastPlayerKilledYokai?: boolean;
  pendingYokaiRefresh?: boolean;
  turnHadKill?: boolean;
  
  /** 
   * 当前回合各来源累积的伤害池
   * 镜姬【妖】效果：只免疫 spell 部分，yokai/shikigami 伤害正常生效
   */
  damagePool?: DamagePool;
  
  pendingChoice?: {
    type: 'salvageChoice' | 'cardSelect' | 'yokaiTarget' | 'yokaiChoice' 
      | 'treeDemonDiscard' | 'rinyuChoice' | 'bangJingExile' | 'diceGhostExile' 
      | 'diceGhostTarget' | 'selectCardsMulti' | 'selectCardPutTop' | 'wheelMonkDiscard'
      | 'wangliangChoice' | 'meiYaoSelect' | 'akajitaSelect' | 'akajitaBatch'       | 'fanHunXiangChoice'
      | 'harassmentPipelineChoice'
      | 'tufoSelect' | 'youguXiangSelect' | 'naginataSoulDiscard' | 'zhenMuShouTarget'
      | 'yinmoluoSelect'
      // 地藏像相关
      | 'dizangConfirm' | 'dizangSelectShikigami' | 'dizangReplaceShikigami';
    playerId: string;
    card?: CardInstance;
    prompt?: string;
    options?: string[] | any[];
    [key: string]: any;
  };
  // 式神选择阶段倒计时
  shikigamiSelectTimeout?: number;
  shikigamiSelectStartTime?: number;
  
  // 轮入道队列执行
  wheelMonkQueue?: WheelMonkQueue;

  /** 与信息栏同源的中部提示（仅 recipient 含本机时由客户端展示） */
  settlementToast?: {
    message: string;
    recipientPlayerIds: string[];
    logSeq?: number;
    timestamp: number;
  };
  
  // 阴摩罗回合结束归还队列
  pendingEndOfTurnEffects?: EndOfTurnEffect[];
}

/** 回合结束效果（阴摩罗归还等） */
export interface EndOfTurnEffect {
  /** 效果类型 */
  type: 'yinmoluoReturn';
  /** 归属玩家ID */
  playerId: string;
  /** 待归还的卡牌 */
  cards: CardInstance[];
}

/** 轮入道效果执行队列 */
export interface WheelMonkQueue {
  /** 被弃置的御魂名称 */
  cardName: string;
  /** 被弃置的御魂卡牌ID */
  cardId: string;
  /** 剩余执行次数（初始值2） */
  remainingExecutions: number;
  /** 执行玩家ID */
  playerId: string;
}

/** 游戏动作 */
export type GameAction = 
  // 大写格式（兼容旧代码）
  | { type: 'PLAY_CARD'; cardInstanceId: string }
  | { type: 'USE_SKILL'; shikigamiId: string; targetId?: string }
  | { type: 'ATTACK'; targetId: string; damage: number }
  | { type: 'BUY_SPELL'; spellId: string; exileCardIds: string[] }
  | { type: 'CONFIRM_SHIKIGAMI' }
  | { type: 'REPLACE_SHIKIGAMI'; oldId: string; newId: string }
  | { type: 'DECIDE_YOKAI_REFRESH'; refresh: boolean }
  | { type: 'SELECT_SHIKIGAMI'; selectedIds: string[] }
  | { type: 'END_TURN' }
  // 小写格式（客户端使用）
  | { type: 'playCard'; cardInstanceId: string }
  | { type: 'useShikigamiSkill'; shikigamiId: string; targetId?: string }
  | { type: 'attackBoss'; damage: number }
  | { type: 'allocateDamage'; slotIndex: number }
  | { type: 'retireYokai'; slotIndex: number }
  | { type: 'banishYokai'; slotIndex: number }
  | { type: 'decideYokaiRefresh'; refresh: boolean }
  | { type: 'endTurn' }
  | { type: 'confirmShikigamiPhase' }
  | { type: 'selectShikigami'; shikigamiId: string }
  | { type: 'deselectShikigami'; shikigamiId: string }
  | { type: 'confirmShikigamiSelection' }
  | { type: 'gainBasicSpell' }
  | { type: 'exchangeMediumSpell'; exileCardIds: string[] }
  | { type: 'exchangeAdvancedSpell'; exileCardIds: string[] };

/** 游戏事件 */
export type GameEvent =
  | { type: 'GAME_STARTED'; state: GameState }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'TURN_CHANGED'; playerId: string }
  | { type: 'PHASE_CHANGED'; phase: TurnPhase }
  | { type: 'CARD_PLAYED'; playerId: string; card: CardInstance }
  | { type: 'CARD_DRAWN'; playerId: string; count: number }
  | { type: 'DAMAGE_ALLOCATED'; results: { targetId: string; damage: number; defeated: boolean }[] }
  | { type: 'YOKAI_DEFEATED'; card: CardInstance; playerId: string }
  | { type: 'BOSS_ARRIVAL'; boss: BossCard }
  | { type: 'BOSS_DEFEATED'; boss: BossCard; playerId: string }
  | { type: 'GAME_ENDED'; winner: string; scores: Record<string, number> }
  | { type: 'SHIKIGAMI_SELECT_START'; timeout: number }
  | { type: 'GAME_START'; state: GameState; shikigamiSummary: { name: string; shikigami: string[] }[] };

// ============ Socket 事件类型 ============

/** 通用响应类型 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 服务端 → 客户端 事件 */
export interface ServerToClientEvents {
  // 连接相关
  'connect:success': (data: { playerId: string }) => void;
  
  // 房间相关
  'room:created': (room: RoomInfo) => void;
  'room:joined': (room: RoomInfo, playerId: string) => void;
  'room:updated': (room: RoomInfo) => void;
  'room:playerJoined': (player: RoomPlayer) => void;
  'room:playerLeft': (playerId: string) => void;
  'room:playerReady': (playerId: string, isReady: boolean) => void;
  'room:hostChanged': (newHostId: string) => void;
  'room:left': () => void;
  'room:error': (code: string, message: string) => void;
  'room:list': (rooms: RoomInfo[]) => void;
  
  // 游戏相关
  'game:starting': (countdown: number) => void;
  'game:started': (state: GameState) => void;
  'game:stateSync': (state: GameState, seq: number) => void;
  'game:event': (event: GameEvent) => void;
  'game:turnChange': (playerId: string, turnNumber: number) => void;
  'game:phaseChange': (phase: TurnPhase) => void;
  'game:actionResult': (seq: number, success: boolean, error?: string) => void;
  'game:ended': (winners: string[], scores: Record<string, number>) => void;
  'game:error': (code: string, message: string) => void;
  
  // 交互请求
  'interact:request': (request: InteractRequest) => void;
  
  // 聊天
  'gm:result': (data: { message: string; success: boolean }) => void;
  
  // 玩家状态
  'player:disconnected': (playerId: string, timeout: number) => void;
  'player:reconnected': (playerId: string) => void;
  
  // 心跳
  'pong': (timestamp: number, serverTime: number) => void;
}

/** 回调响应类型 */
export interface CallbackResponse {
  success: boolean;
  error?: string;
  room?: RoomInfo;
  rooms?: RoomInfo[];
}

/** 客户端 → 服务端 事件 */
export interface ClientToServerEvents {
  // 玩家信息
  'player:setName': (name: string, callback: (response: CallbackResponse) => void) => void;
  
  // 房间相关
  'room:create': (config: Partial<RoomConfig>, callback: (response: CallbackResponse) => void) => void;
  'room:join': (roomId: string, password?: string, callback?: (response: CallbackResponse) => void) => void;
  'room:leave': (callback?: (response: CallbackResponse) => void) => void;
  'room:ready': (isReady: boolean, callback?: (response: CallbackResponse) => void) => void;
  'room:kick': (playerId: string, callback?: (response: CallbackResponse) => void) => void;
  'room:list': (callback: (response: CallbackResponse) => void) => void;
  
  // 游戏相关
  'game:start': (callback?: (response: { success: boolean; error?: string }) => void) => void;
  'game:action': (action: GameAction, seq: number, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // 交互响应
  'interact:response': (response: InteractResponse) => void;
  
  // 聊天
  'chat:send': (data: { content: string; roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  'gm:command': (data: { command: string; roomId: string }, callback?: (response: { success: boolean; error?: string }) => void) => void;
  
  // 心跳
  'ping': (timestamp: number) => void;
}

/** Socket 中间数据 */
export interface InterServerEvents {
  // 暂时为空，用于服务端之间通信
}

/** Socket 数据 */
export interface SocketData {
  playerId: string;
  playerName: string;
  roomId: string | null;
}

// ============ 交互系统 ============

/** 交互请求类型 */
export type InteractType = 
  | 'CHOICE'
  | 'SELECT_CARDS'
  | 'SELECT_TARGET'
  | 'SELECT_SHIKIGAMI';

/** 交互请求 */
export interface InteractRequest {
  requestId: string;
  playerId: string;
  type: InteractType;
  timeout: number;
  data: ChoiceData | SelectCardsData | SelectTargetData | SelectShikigamiData;
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

/** 选择式神数据 */
export interface SelectShikigamiData {
  type: 'SELECT_SHIKIGAMI';
  candidates: ShikigamiCard[];
  count: number;
  title?: string;
}

/** 交互响应 */
export interface InteractResponse {
  requestId: string;
  choiceIndex?: number;
  selectedCardIds?: string[];
  targetId?: string;
  selectedShikigamiIds?: string[];
}

// ============ 错误码 ============

export const ErrorCodes = {
  // 房间错误
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',
  ROOM_WRONG_PASSWORD: 'ROOM_WRONG_PASSWORD',
  ROOM_ALREADY_IN_ROOM: 'ROOM_ALREADY_IN_ROOM',
  ROOM_NOT_IN_ROOM: 'ROOM_NOT_IN_ROOM',
  ROOM_NOT_HOST: 'ROOM_NOT_HOST',
  ROOM_NOT_ENOUGH_PLAYERS: 'ROOM_NOT_ENOUGH_PLAYERS',
  ROOM_PLAYERS_NOT_READY: 'ROOM_PLAYERS_NOT_READY',
  
  // 游戏错误
  GAME_NOT_STARTED: 'GAME_NOT_STARTED',
  GAME_NOT_YOUR_TURN: 'GAME_NOT_YOUR_TURN',
  GAME_INVALID_ACTION: 'GAME_INVALID_ACTION',
  GAME_INVALID_PHASE: 'GAME_INVALID_PHASE',
  
  // 通用错误
  INVALID_PARAMS: 'INVALID_PARAMS',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============ 游戏配置 ============

export interface MultiplayerGameConfig {
  minPlayers: number;      // 最小玩家数（3）
  maxPlayers: number;      // 最大玩家数（6）
  turnTimeout: number;     // 回合超时（毫秒）
  interactTimeout: number; // 交互超时（毫秒）
  reconnectTimeout: number; // 重连超时（毫秒）
}

export const DEFAULT_MULTIPLAYER_CONFIG: MultiplayerGameConfig = {
  minPlayers: 3,
  maxPlayers: 6,
  turnTimeout: 120000,      // 2分钟
  interactTimeout: 30000,   // 30秒
  reconnectTimeout: 60000,  // 1分钟
};

// ============ 工具类型 ============

/** 深度只读 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** 可选深度部分 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};