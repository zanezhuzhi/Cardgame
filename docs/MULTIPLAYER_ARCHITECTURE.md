/**
 * 御魂传说 - 多人游戏架构设计文档
 * @file docs/MULTIPLAYER_ARCHITECTURE.md
 * @version 1.0.0
 * @date 2024
 */

# 多人游戏架构设计

## 一、设计目标

### 1.1 核心需求
- **实时对战**：2-6人同时在线，WebSocket实时通信
- **服务器权威**：所有游戏逻辑在服务端执行，防止作弊
- **状态同步**：高效的增量状态同步，低延迟体验
- **断线重连**：支持玩家短时间内断线后恢复游戏
- **观战功能**：支持其他玩家旁观对局

### 1.2 非功能需求
- **延迟目标**：操作响应 < 100ms
- **并发目标**：单服务器支持 1000+ 同时对局
- **可靠性**：游戏状态持久化，服务重启可恢复

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (Client)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Cocos UI   │  │  GameClient  │  │  StateStore  │          │
│  │   (渲染层)   │←→│ (网络通信)   │←→│ (本地状态)   │          │
│  └──────────────┘  └──────┬───────┘  └──────────────┘          │
└────────────────────────────┼────────────────────────────────────┘
                             │ WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务端 (Server)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ SocketRouter │→ │ RoomManager  │→ │  GameRoom    │          │
│  │ (连接管理)   │  │ (房间调度)   │  │  (对局实例)  │          │
│  └──────────────┘  └──────────────┘  └──────┬───────┘          │
│                                              │                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────▼───────┐          │
│  │   shared/    │  │ActionValidator│ │ GameManager  │          │
│  │ game-logic   │←─│ (动作校验)   │←─│ (游戏逻辑)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 分层职责

| 层级 | 职责 | 技术选型 |
|------|------|----------|
| **Client UI** | 渲染、动画、用户交互 | Cocos Creator 3.x |
| **GameClient** | 网络通信、消息序列化 | socket.io-client |
| **StateStore** | 本地状态缓存、乐观更新 | 响应式状态管理 |
| **SocketRouter** | 连接管理、心跳检测 | socket.io |
| **RoomManager** | 房间生命周期、匹配系统 | 单例服务 |
| **GameRoom** | 单局游戏容器、玩家管理 | 实例化对象 |
| **GameManager** | 核心游戏逻辑（复用现有） | shared/game |

---

## 三、通信协议设计

### 3.1 消息类型总览

```typescript
// ============ 客户端 → 服务端 (C2S) ============

interface C2S_Message {
  // 房间相关
  | { type: 'CREATE_ROOM'; config: RoomConfig }
  | { type: 'JOIN_ROOM'; roomId: string; password?: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'PLAYER_READY'; ready: boolean }
  
  // 游戏动作（复用现有 GameAction）
  | { type: 'GAME_ACTION'; action: GameAction; seq: number }
  
  // 交互响应
  | { type: 'INTERACT_RESPONSE'; requestId: string; response: InteractResponse }
  
  // 心跳
  | { type: 'PING'; timestamp: number }
}

// ============ 服务端 → 客户端 (S2C) ============

interface S2C_Message {
  // 房间相关
  | { type: 'ROOM_CREATED'; roomId: string }
  | { type: 'ROOM_JOINED'; roomInfo: RoomInfo }
  | { type: 'ROOM_UPDATE'; roomInfo: RoomInfo }
  | { type: 'ROOM_ERROR'; code: ErrorCode; message: string }
  
  // 游戏状态
  | { type: 'GAME_START'; state: GameState }
  | { type: 'STATE_SYNC'; state: GameState; seq: number }
  | { type: 'STATE_DELTA'; delta: StateDelta; seq: number }
  
  // 交互请求（需要玩家选择）
  | { type: 'INTERACT_REQUEST'; request: InteractRequest }
  
  // 动作结果
  | { type: 'ACTION_RESULT'; seq: number; success: boolean; error?: string }
  
  // 游戏事件
  | { type: 'GAME_EVENT'; event: GameEvent }
  
  // 心跳响应
  | { type: 'PONG'; timestamp: number; serverTime: number }
}
```

### 3.2 交互请求系统

核心设计：**异步回调转网络请求**

现有代码中的 `onChoice`、`onSelectCards` 回调需要转化为网络交互：

```typescript
// 交互请求类型
interface InteractRequest {
  requestId: string;           // 唯一请求ID
  playerId: string;            // 目标玩家
  type: InteractType;
  timeout: number;             // 超时时间（毫秒）
  
  // 根据类型携带不同数据
  data: ChoiceData | SelectCardsData | SelectTargetData;
}

type InteractType = 
  | 'CHOICE'           // 选择选项
  | 'SELECT_CARDS'     // 选择卡牌
  | 'SELECT_TARGET';   // 选择目标

interface ChoiceData {
  options: string[];
  title?: string;
}

interface SelectCardsData {
  candidates: CardInstance[];
  count: number;
  title?: string;
}

interface SelectTargetData {
  candidates: CardInstance[];
  title?: string;
}

// 交互响应
interface InteractResponse {
  requestId: string;
  
  // 根据请求类型返回
  choiceIndex?: number;        // CHOICE 类型
  selectedCardIds?: string[];  // SELECT_CARDS 类型
  targetId?: string;           // SELECT_TARGET 类型
}
```

### 3.3 序列号与同步

```typescript
interface SyncState {
  seq: number;                 // 状态序列号
  lastAck: number;             // 客户端最后确认的序列号
  pendingActions: Map<number, GameAction>;  // 待确认的动作
}
```

**同步策略**：
1. 每个动作带递增序列号
2. 服务端处理后返回确认
3. 客户端可做乐观更新，收到确认后对账

---

## 四、服务端核心模块

### 4.1 RoomManager（房间管理器）

```typescript
// server/game/RoomManager.ts

class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
  
  // 创建房间
  createRoom(hostId: string, config: RoomConfig): GameRoom;
  
  // 加入房间
  joinRoom(playerId: string, roomId: string): JoinResult;
  
  // 离开房间
  leaveRoom(playerId: string): void;
  
  // 快速匹配
  quickMatch(playerId: string, options: MatchOptions): Promise<GameRoom>;
  
  // 房间清理（定时任务）
  cleanupStaleRooms(): void;
}

interface RoomConfig {
  maxPlayers: number;          // 2-6
  isPrivate: boolean;
  password?: string;
  gameConfig?: Partial<GameConfig>;
}
```

### 4.2 GameRoom（游戏房间）

```typescript
// server/game/GameRoom.ts

class GameRoom extends EventEmitter {
  readonly roomId: string;
  readonly config: RoomConfig;
  
  private players: Map<string, PlayerConnection> = new Map();
  private spectators: Map<string, PlayerConnection> = new Map();
  private gameManager: GameManager | null = null;
  
  // 状态
  private state: RoomState = 'WAITING';
  
  // 交互系统
  private pendingInteracts: Map<string, PendingInteract> = new Map();
  
  // ======== 生命周期 ========
  
  addPlayer(conn: PlayerConnection): void;
  removePlayer(playerId: string): void;
  setPlayerReady(playerId: string, ready: boolean): void;
  
  startGame(): void;
  
  // ======== 动作处理 ========
  
  handleAction(playerId: string, action: GameAction): ActionResult;
  
  // ======== 交互桥接 ========
  
  // 将 SkillContext 的回调转为网络请求
  createInteractBridge(playerId: string): InteractCallbacks {
    return {
      onChoice: (options) => this.requestInteract(playerId, 'CHOICE', { options }),
      onSelectCards: (cards, count) => this.requestInteract(playerId, 'SELECT_CARDS', { cards, count }),
      onSelectTarget: (targets) => this.requestInteract(playerId, 'SELECT_TARGET', { targets }),
    };
  }
  
  // 发送交互请求并等待响应
  private async requestInteract(
    playerId: string,
    type: InteractType,
    data: unknown
  ): Promise<unknown> {
    const requestId = generateId();
    const request: InteractRequest = { requestId, playerId, type, data, timeout: 30000 };
    
    // 发送给客户端
    this.sendToPlayer(playerId, { type: 'INTERACT_REQUEST', request });
    
    // 等待响应（Promise + 超时）
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingInteracts.delete(requestId);
        reject(new Error('交互超时'));
      }, request.timeout);
      
      this.pendingInteracts.set(requestId, { resolve, reject, timer });
    });
  }
  
  // 处理客户端的交互响应
  handleInteractResponse(playerId: string, response: InteractResponse): void {
    const pending = this.pendingInteracts.get(response.requestId);
    if (!pending) return;
    
    clearTimeout(pending.timer);
    this.pendingInteracts.delete(response.requestId);
    pending.resolve(response);
  }
  
  // ======== 状态广播 ========
  
  broadcastState(): void {
    const state = this.gameManager?.getState();
    if (!state) return;
    
    // 对每个玩家发送定制化视图（隐藏对手手牌等）
    for (const [playerId, conn] of this.players) {
      const playerView = this.createPlayerView(state, playerId);
      conn.send({ type: 'STATE_SYNC', state: playerView, seq: this.seq++ });
    }
  }
  
  // 创建玩家视角的状态（隐藏敏感信息）
  private createPlayerView(state: GameState, playerId: string): GameState {
    return {
      ...state,
      players: state.players.map(p => ({
        ...p,
        // 隐藏其他玩家的手牌详情
        hand: p.id === playerId 
          ? p.hand 
          : p.hand.map(() => ({ hidden: true })),
        // 隐藏牌库
        deck: [],
      })),
    };
  }
}
```

### 4.3 NetworkEffectContext（网络效果上下文）

**核心桥接**：将现有的本地回调式上下文转为网络请求式

```typescript
// server/game/NetworkEffectContext.ts

import type { SkillContext } from '@shared/game/effects/ShikigamiSkills';

export function createNetworkSkillContext(
  room: GameRoom,
  baseCtx: Omit<SkillContext, 'onChoice' | 'onSelectCards' | 'onSelectTarget'>,
  playerId: string
): SkillContext {
  return {
    ...baseCtx,
    
    // 选择选项 → 网络请求
    onChoice: async (options: string[]): Promise<number> => {
      const response = await room.requestInteract(playerId, 'CHOICE', { options });
      return response.choiceIndex ?? 0;
    },
    
    // 选择卡牌 → 网络请求
    onSelectCards: async (cards: CardInstance[], count: number): Promise<string[]> => {
      const response = await room.requestInteract(playerId, 'SELECT_CARDS', { 
        candidates: cards, 
        count 
      });
      return response.selectedCardIds ?? [];
    },
    
    // 选择目标 → 网络请求
    onSelectTarget: async (targets: CardInstance[]): Promise<string> => {
      const response = await room.requestInteract(playerId, 'SELECT_TARGET', { 
        candidates: targets 
      });
      return response.targetId ?? targets[0]?.instanceId ?? '';
    },
  };
}
```

---

## 五、客户端核心模块

### 5.1 GameClient（游戏客户端）

```typescript
// client/scripts/network/GameClient.ts

class GameClient extends EventEmitter {
  private socket: Socket;
  private seq: number = 0;
  private pendingActions: Map<number, { resolve, reject }> = new Map();
  
  // ======== 连接管理 ========
  
  connect(serverUrl: string): Promise<void>;
  disconnect(): void;
  
  // ======== 房间操作 ========
  
  createRoom(config: RoomConfig): Promise<string>;
  joinRoom(roomId: string): Promise<RoomInfo>;
  leaveRoom(): void;
  setReady(ready: boolean): void;
  
  // ======== 游戏动作 ========
  
  sendAction(action: GameAction): Promise<ActionResult> {
    const seq = this.seq++;
    
    return new Promise((resolve, reject) => {
      this.pendingActions.set(seq, { resolve, reject });
      
      this.socket.emit('message', {
        type: 'GAME_ACTION',
        action,
        seq,
      });
      
      // 超时处理
      setTimeout(() => {
        if (this.pendingActions.has(seq)) {
          this.pendingActions.delete(seq);
          reject(new Error('动作超时'));
        }
      }, 10000);
    });
  }
  
  // ======== 交互响应 ========
  
  respondInteract(requestId: string, response: Partial<InteractResponse>): void {
    this.socket.emit('message', {
      type: 'INTERACT_RESPONSE',
      requestId,
      ...response,
    });
  }
  
  // ======== 消息处理 ========
  
  private handleMessage(msg: S2C_Message): void {
    switch (msg.type) {
      case 'STATE_SYNC':
        this.emit('stateUpdate', msg.state);
        break;
        
      case 'INTERACT_REQUEST':
        this.emit('interactRequest', msg.request);
        break;
        
      case 'ACTION_RESULT':
        const pending = this.pendingActions.get(msg.seq);
        if (pending) {
          this.pendingActions.delete(msg.seq);
          if (msg.success) {
            pending.resolve(msg);
          } else {
            pending.reject(new Error(msg.error));
          }
        }
        break;
        
      case 'GAME_EVENT':
        this.emit('gameEvent', msg.event);
        break;
    }
  }
}
```

### 5.2 InteractHandler（交互处理器）

```typescript
// client/scripts/game/InteractHandler.ts

class InteractHandler {
  constructor(
    private client: GameClient,
    private uiManager: UIManager
  ) {
    client.on('interactRequest', this.handleRequest.bind(this));
  }
  
  private async handleRequest(request: InteractRequest): Promise<void> {
    let response: Partial<InteractResponse>;
    
    switch (request.type) {
      case 'CHOICE':
        // 显示选项UI，等待玩家点击
        const index = await this.uiManager.showChoiceDialog(request.data.options);
        response = { choiceIndex: index };
        break;
        
      case 'SELECT_CARDS':
        // 显示卡牌选择UI
        const cards = await this.uiManager.showCardSelector(
          request.data.candidates,
          request.data.count
        );
        response = { selectedCardIds: cards.map(c => c.instanceId) };
        break;
        
      case 'SELECT_TARGET':
        // 高亮可选目标，等待玩家点击
        const target = await this.uiManager.showTargetSelector(request.data.candidates);
        response = { targetId: target.instanceId };
        break;
    }
    
    this.client.respondInteract(request.requestId, response);
  }
}
```

---

## 六、状态同步策略

### 6.1 全量同步 vs 增量同步

| 场景 | 策略 | 说明 |
|------|------|------|
| 游戏开始 | 全量 | 发送完整 GameState |
| 断线重连 | 全量 | 恢复完整状态 |
| 普通动作 | 增量 | 只发送变化的部分 |
| 复杂效果 | 全量 | 连锁效果后全量同步 |

### 6.2 增量同步格式

```typescript
interface StateDelta {
  // 玩家状态变化
  players?: {
    [playerId: string]: Partial<PlayerState> & {
      hand?: { add?: CardInstance[]; remove?: string[] };
      discard?: { add?: CardInstance[]; remove?: string[] };
    };
  };
  
  // 场上状态变化
  field?: Partial<FieldState>;
  
  // 回合信息
  turnInfo?: {
    currentPlayerIndex?: number;
    turnPhase?: TurnPhase;
    turnNumber?: number;
  };
  
  // 日志追加
  logAppend?: GameLogEntry[];
}
```

### 6.3 乐观更新

```typescript
// 客户端可选的乐观更新策略

class OptimisticStateManager {
  private confirmedState: GameState;
  private pendingMutations: StateMutation[] = [];
  
  // 应用乐观更新
  applyOptimistic(action: GameAction): GameState {
    const mutation = this.predictMutation(action);
    this.pendingMutations.push(mutation);
    return this.computeCurrentState();
  }
  
  // 服务端确认后
  confirm(seq: number, serverState: GameState): void {
    // 移除已确认的变更
    this.pendingMutations = this.pendingMutations.filter(m => m.seq > seq);
    this.confirmedState = serverState;
  }
  
  // 服务端拒绝后
  reject(seq: number): void {
    this.pendingMutations = this.pendingMutations.filter(m => m.seq !== seq);
  }
}
```

---

## 七、断线重连

### 7.1 服务端处理

```typescript
// GameRoom 断线处理

class GameRoom {
  private disconnectedPlayers: Map<string, DisconnectInfo> = new Map();
  
  handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // 标记断线，保留位置
    this.disconnectedPlayers.set(playerId, {
      disconnectTime: Date.now(),
      playerData: player,
    });
    
    // 通知其他玩家
    this.broadcast({ 
      type: 'PLAYER_DISCONNECTED', 
      playerId,
      timeout: 60000  // 60秒重连窗口
    });
    
    // 如果是当前行动玩家，启动超时计时器
    if (this.isCurrentPlayer(playerId)) {
      this.startTurnTimeout(30000);
    }
  }
  
  handleReconnect(playerId: string, conn: PlayerConnection): boolean {
    const info = this.disconnectedPlayers.get(playerId);
    if (!info) return false;
    
    // 检查是否超时
    if (Date.now() - info.disconnectTime > 60000) {
      return false;
    }
    
    // 恢复连接
    this.players.set(playerId, conn);
    this.disconnectedPlayers.delete(playerId);
    
    // 发送完整状态
    conn.send({ 
      type: 'RECONNECTED',
      state: this.gameManager?.getState() 
    });
    
    return true;
  }
}
```

### 7.2 客户端处理

```typescript
class GameClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.socket.connect();
      }, 1000 * Math.pow(2, this.reconnectAttempts)); // 指数退避
    } else {
      this.emit('connectionFailed');
    }
  }
  
  private handleReconnected(state: GameState): void {
    this.reconnectAttempts = 0;
    this.emit('stateUpdate', state);
  }
}
```

---

## 八、安全性设计

### 8.1 服务端校验

所有动作必须经过服务端校验：

```typescript
// server/game/ActionValidator.ts

class ActionValidator {
  validate(
    action: GameAction, 
    playerId: string, 
    state: GameState
  ): ValidationResult {
    // 1. 是否是该玩家的回合
    if (state.players[state.currentPlayerIndex].id !== playerId) {
      return { valid: false, error: '不是你的回合' };
    }
    
    // 2. 是否在正确的阶段
    if (!this.isValidPhaseForAction(action, state.turnPhase)) {
      return { valid: false, error: '当前阶段不能执行此动作' };
    }
    
    // 3. 动作特定校验
    switch (action.type) {
      case 'PLAY_CARD':
        return this.validatePlayCard(action, playerId, state);
      case 'USE_SKILL':
        return this.validateUseSkill(action, playerId, state);
      // ... 其他动作
    }
  }
  
  private validatePlayCard(action, playerId, state): ValidationResult {
    const player = state.players.find(p => p.id === playerId);
    const card = player?.hand.find(c => c.instanceId === action.cardInstanceId);
    
    if (!card) {
      return { valid: false, error: '卡牌不在手牌中' };
    }
    
    return { valid: true };
  }
}
```

### 8.2 信息隐藏

```typescript
// 永远不要发送给客户端的信息：
// - 其他玩家的手牌详情
// - 牌库顺序
// - 未翻开的鬼王

function sanitizeStateForPlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      // 只显示自己的手牌
      hand: p.id === playerId ? p.hand : p.hand.map(() => HIDDEN_CARD),
      // 隐藏所有牌库
      deck: [],
    })),
    field: {
      ...state.field,
      // 隐藏妖怪牌库
      yokaiDeck: [],
      // 隐藏鬼王牌库
      bossDeck: state.field.bossDeck.map(() => HIDDEN_BOSS),
    },
  };
}
```

---

## 九、项目结构

```
Cardgame/
├── shared/                    # 共享代码（客户端+服务端）
│   ├── types/                 # 类型定义
│   │   ├── cards.ts
│   │   ├── game.ts
│   │   └── network.ts         # [新增] 网络协议类型
│   ├── game/                  # 游戏逻辑
│   │   ├── GameManager.ts     # 核心逻辑（复用）
│   │   └── effects/           # 效果系统（复用）
│   └── data/                  # 数据加载
│
├── server/                    # [新增] 服务端
│   ├── index.ts               # 入口
│   ├── config.ts              # 服务配置
│   ├── game/
│   │   ├── RoomManager.ts     # 房间管理
│   │   ├── GameRoom.ts        # 游戏房间
│   │   ├── ActionValidator.ts # 动作校验
│   │   └── NetworkContext.ts  # 网络效果上下文
│   ├── socket/
│   │   ├── SocketRouter.ts    # WebSocket路由
│   │   └── ConnectionManager.ts
│   └── utils/
│       └── StateSerializer.ts # 状态序列化
│
├── client/                    # [新增] 客户端网络层
│   └── scripts/
│       ├── network/
│       │   ├── GameClient.ts  # 游戏客户端
│       │   └── StateSync.ts   # 状态同步
│       └── game/
│           └── InteractHandler.ts
│
└── docs/
    └── MULTIPLAYER_ARCHITECTURE.md  # 本文档
```

---

## 十、实现路线图

### Phase 1: 基础通信（1-2周）
- [ ] 搭建 Node.js + Socket.io 服务端框架
- [ ] 实现 RoomManager 基础功能
- [ ] 实现客户端 GameClient
- [ ] 完成创建/加入房间流程

### Phase 2: 游戏同步（2-3周）
- [ ] 实现 GameRoom 与 GameManager 集成
- [ ] 实现全量状态同步
- [ ] 实现动作发送与校验
- [ ] 完成基础对战流程

### Phase 3: 交互系统（1-2周）
- [ ] 实现 NetworkEffectContext
- [ ] 实现 InteractHandler
- [ ] 支持所有式神技能的网络交互

### Phase 4: 优化完善（1-2周）
- [ ] 增量状态同步
- [ ] 断线重连
- [ ] 观战功能
- [ ] 压力测试与优化

---

## 十一、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 服务端运行时 | Node.js | TypeScript共享代码 |
| WebSocket | Socket.io | 成熟稳定，自动重连 |
| 序列化 | JSON | 简单，调试方便 |
| 状态存储 | 内存 + Redis（可选） | 先内存，后期加Redis集群 |
| 部署 | Docker + PM2 | 容器化，进程管理 |

---

## 十二、Q&A

### Q1: 为什么不用 WebRTC P2P？
卡牌游戏需要状态权威性，P2P无法防作弊。

### Q2: 为什么不用状态机？
现有 GameManager 已经是隐式状态机，phase/turnPhase 控制流程。

### Q3: 如何处理超时？
- 交互超时：30秒，自动选择默认选项
- 回合超时：120秒，自动结束回合
- 断线超时：60秒，判定掉线输

### Q4: 如何扩展到分布式？
- 房间粘性会话（同一房间同一节点）
- 状态存 Redis，支持故障转移
- 使用消息队列解耦匹配与游戏

---

*文档版本：1.0.0*
*最后更新：2024年*
