/**
 * 御魂传说 - 多人游戏场景设计
 * @file docs/MULTIPLAYER_SCENARIOS.md
 * @version 1.0.0
 */

# 多人游戏场景设计

## 一、匹配机制

### 1.1 匹配流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  进入大厅   │ ──→ │  选择模式   │ ──→ │  匹配队列   │ ──→ │  进入房间   │
│             │     │ 快速/自定义 │     │  等待配对   │     │  准备开始   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 1.2 匹配模式

#### 模式A：快速匹配
- 系统自动分配房间
- 按**段位/积分**相近匹配
- 默认2人对战，可选3-6人

```typescript
interface QuickMatchRequest {
  type: 'QUICK_MATCH';
  playerCount: 2 | 3 | 4 | 5 | 6;  // 期望玩家数
  rankTolerance?: number;          // 段位容差（默认±200分）
}
```

#### 模式B：创建房间
- 玩家手动创建
- 可设置密码（好友房）
- 房主控制开始时机

```typescript
interface CreateRoomRequest {
  type: 'CREATE_ROOM';
  config: {
    minPlayers: number;       // 最少人数（2-6）
    maxPlayers: number;       // 最多人数（2-6）
    isPrivate: boolean;       // 是否私有房
    password?: string;        // 房间密码
    isRanked: boolean;        // 是否计入排位
  };
}
```

### 1.3 匹配队列实现

```typescript
// server/src/match/MatchQueue.ts

interface QueuedPlayer {
  playerId: string;
  playerName: string;
  rating: number;              // 玩家积分
  queueTime: number;           // 入队时间
  targetPlayerCount: number;   // 期望人数
  connection: PlayerConnection;
}

class MatchQueue {
  private queues: Map<number, QueuedPlayer[]> = new Map();  // 按人数分队列
  private matchInterval: number = 2000;  // 每2秒匹配一次
  
  // 加入匹配队列
  enqueue(player: QueuedPlayer): void {
    const queue = this.getQueue(player.targetPlayerCount);
    queue.push(player);
    
    // 通知玩家排队状态
    player.connection.send({
      type: 'MATCH_QUEUE_UPDATE',
      position: queue.length,
      estimatedTime: this.estimateWaitTime(player.targetPlayerCount),
    });
  }
  
  // 取消匹配
  dequeue(playerId: string): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(p => p.playerId === playerId);
      if (index !== -1) {
        queue.splice(index, 1);
        break;
      }
    }
  }
  
  // 定时匹配逻辑
  private processMatch(): void {
    for (const [playerCount, queue] of this.queues) {
      if (queue.length < playerCount) continue;
      
      // 按积分排序
      queue.sort((a, b) => a.rating - b.rating);
      
      // 滑动窗口寻找积分相近的玩家
      for (let i = 0; i <= queue.length - playerCount; i++) {
        const candidates = queue.slice(i, i + playerCount);
        const ratingDiff = candidates[playerCount - 1].rating - candidates[0].rating;
        
        // 随时间增加容差
        const maxWaitTime = Math.max(...candidates.map(p => Date.now() - p.queueTime));
        const tolerance = 200 + Math.floor(maxWaitTime / 10000) * 50;  // 每10秒+50分容差
        
        if (ratingDiff <= tolerance) {
          // 匹配成功！
          this.createMatch(candidates);
          // 从队列移除
          candidates.forEach(p => {
            const idx = queue.indexOf(p);
            if (idx !== -1) queue.splice(idx, 1);
          });
          break;
        }
      }
    }
  }
  
  // 创建对局
  private createMatch(players: QueuedPlayer[]): void {
    const roomManager = RoomManager.getInstance();
    const result = roomManager.createRoom(players[0].playerId, {
      maxPlayers: players.length,
      minPlayers: players.length,
      isPrivate: false,
      isRanked: true,
    });
    
    if (result.success && result.room) {
      // 通知所有玩家
      players.forEach(p => {
        p.connection.send({
          type: 'MATCH_FOUND',
          roomId: result.roomId,
          players: players.map(pp => ({
            id: pp.playerId,
            name: pp.playerName,
            rating: pp.rating,
          })),
        });
        
        // 自动加入房间
        result.room.addPlayer(p.playerId, p.playerName, p.connection);
      });
    }
  }
}
```

### 1.4 匹配UI流程

```
┌────────────────────────────────────────────────────────────┐
│                      🎮 御魂传说                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│    ┌─────────────────┐    ┌─────────────────┐             │
│    │   ⚔️ 快速匹配    │    │   🏠 创建房间    │             │
│    │                 │    │                 │             │
│    │  [2人] [3人]    │    │  房间号: ____   │             │
│    │  [4人] [5人]    │    │  密码: ______   │             │
│    │  [6人]          │    │                 │             │
│    │                 │    │  [创建]         │             │
│    │  [开始匹配]     │    │                 │             │
│    └─────────────────┘    └─────────────────┘             │
│                                                            │
│    ┌─────────────────┐                                     │
│    │   🚪 加入房间    │    当前在线: 1,234 人              │
│    │                 │    正在对局: 456 场                 │
│    │  房间号: ____   │                                     │
│    │  [加入]         │                                     │
│    └─────────────────┘                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 1.5 匹配等待界面

```
┌────────────────────────────────────────────────────────────┐
│                    ⏳ 正在匹配中...                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│            ┌─────────────────────────────┐                 │
│            │                             │                 │
│            │      🔄  寻找对手中...       │                 │
│            │                             │                 │
│            │    已等待: 00:32           │                 │
│            │    预计: 约 1 分钟          │                 │
│            │                             │                 │
│            │    ┌─────────────┐          │                 │
│            │    │  取消匹配   │          │                 │
│            │    └─────────────┘          │                 │
│            │                             │                 │
│            └─────────────────────────────┘                 │
│                                                            │
│    💡 小提示: 高峰时段匹配更快哦~                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 二、游戏内视角系统

### 2.1 核心原则

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 视角规则                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. 轮到谁行动，所有人都能看到「谁在行动」                    │
│                                                             │
│ 2. 行动玩家的操作过程对其他人**隐藏**：                      │
│    - 不显示行动玩家的手牌                                   │
│    - 不显示行动玩家正在做的选择                              │
│                                                             │
│ 3. 操作结果**同步广播**给所有人：                           │
│    - 打出的牌（从手牌区飞到场上）                           │
│    - 发动的技能效果                                         │
│    - 造成的伤害数值                                         │
│    - 获得的御魂/声望                                        │
│                                                             │
│ 4. 公开信息所有人可见：                                     │
│    - 鬼王血量、场上妖怪                                     │
│    - 弃牌堆、阴阳术牌堆数量                                 │
│    - 各玩家的声望、鬼火数量                                 │
│    - 各玩家出战的式神                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 客户端视图状态

```typescript
// client/scripts/game/ViewState.ts

interface ClientViewState {
  // 当前回合信息
  currentTurn: {
    activePlayerId: string;       // 当前行动的玩家
    phase: TurnPhase;             // 当前阶段
    remainingTime: number;        // 剩余行动时间
  };
  
  // 我的私有信息
  myState: {
    hand: CardInstance[];         // 我的手牌（完整信息）
    pendingInteract?: InteractRequest;  // 等待我响应的交互
  };
  
  // 各玩家公开信息
  players: PlayerPublicView[];
  
  // 战场公开信息
  field: FieldPublicView;
  
  // 事件日志
  eventLog: GameEventLog[];
}

interface PlayerPublicView {
  id: string;
  name: string;
  
  // 公开数值
  ghostFire: number;              // 鬼火数量
  charm: number;                  // 声望
  handCount: number;              // 手牌数量（不显示内容）
  
  // 公开卡牌
  shikigami: ShikigamiCard[];     // 出战式神
  discardPile: CardInstance[];    // 弃牌堆
  played: CardInstance[];         // 本回合打出的牌
  
  // 状态
  isActive: boolean;              // 是否正在行动
  isConnected: boolean;           // 是否在线
}
```

### 2.3 视角切换动画

```typescript
// 当行动玩家切换时的UI表现

interface TurnChangeAnimation {
  // 1. 淡出当前玩家区域的高亮
  fadeOutCurrentPlayer();
  
  // 2. 相机/视角平移到新玩家区域
  panToPlayer(newPlayerId: string, duration: 500);
  
  // 3. 高亮新行动玩家的区域
  highlightActivePlayer(newPlayerId: string);
  
  // 4. 如果是自己的回合，显示操作提示
  if (newPlayerId === myPlayerId) {
    showActionHint('你的回合！');
    enableMyControls();
  } else {
    showWatchingHint(`${playerName} 正在行动...`);
    disableMyControls();
  }
}
```

### 2.4 游戏界面布局（4人局示例）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          对手3 [声望:12] 🔥×3                            │
│                    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│                    │ ▓▓▓ │ │ ▓▓▓ │ │ ▓▓▓ │ │ ▓▓▓ │ │ ▓▓▓ │ ← 手牌背面  │
│                    └─────┘ └─────┘ └─────┘ └─────┘ └─────┘             │
│                          [山兔] [青行灯]  ← 式神                        │
├───────────────────┬─────────────────────────────┬───────────────────────┤
│    对手2          │                             │        对手4         │
│   [声望:8] 🔥×2   │      ┌───────────────┐      │     [声望:15] 🔥×4   │
│   ┌───┐ ┌───┐    │      │  🎃 酒吞童子   │      │    ┌───┐ ┌───┐      │
│   │▓▓▓│ │▓▓▓│    │      │   HP: 35/50    │      │    │▓▓▓│ │▓▓▓│      │
│   │▓▓▓│ │▓▓▓│    │      │   ⚔️ ████████░░ │      │    │▓▓▓│ │▓▓▓│      │
│   └───┘ └───┘    │      └───────────────┘      │    └───┘ └───┘      │
│  [座敷童子][小白] │                             │   [茨木][萤草]       │
│                   │   ┌─────┐┌─────┐┌─────┐    │                      │
│   ⬅ 当前行动中    │   │ 🎃  ││ 🎃  ││ 🎃  │    │                      │
│                   │   │河童 ││狸猫 ││骨女 │    │                      │
│                   │   └─────┘└─────┘└─────┘    │                      │
│                   │         场上妖怪            │                      │
├───────────────────┴─────────────────────────────┴───────────────────────┤
│                              我 [声望:10] 🔥×5                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   [桃花妖] [姑获鸟]       │ │
│  │ │阴阳术│ │阴阳术│ │御魂牌│ │御魂牌│ │御魂牌│   我的式神              │ │
│  │ │ 初级 │ │ 中级 │ │骸骨 │ │三尾狐│ │天狗 │                          │ │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                            │ │
│  │                  ↑ 我的手牌（完整可见）                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  📜 日志: 对手2 打出「中级阴阳术」→ 河童 造成 3 点伤害                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5 操作结果同步

当某玩家完成操作后，服务端广播**结果事件**：

```typescript
// 服务端广播的事件类型
type GameBroadcastEvent =
  | {
      type: 'CARD_PLAYED';
      playerId: string;
      card: CardInstance;           // 打出的牌
      targets?: string[];           // 目标（如有）
    }
  | {
      type: 'SKILL_USED';
      playerId: string;
      shikigami: string;            // 式神名
      skillType: SkillType;
      effects: EffectResult[];      // 效果结果
    }
  | {
      type: 'DAMAGE_DEALT';
      source: string;               // 来源
      target: string;               // 目标（妖怪/鬼王）
      damage: number;
      overkill?: boolean;           // 是否击杀
    }
  | {
      type: 'YOKAI_DEFEATED';
      playerId: string;             // 击杀者
      yokai: CardInstance;          // 被击杀的妖怪
      charmGained: number;          // 获得声望
    }
  | {
      type: 'BOSS_PHASE_CHANGE';
      bossId: string;
      newPhase: number;
    }
  | {
      type: 'TURN_END';
      playerId: string;
      nextPlayerId: string;
    };
```

### 2.6 观战模式

非行动玩家观看时的信息过滤：

```typescript
// server/src/game/ViewFilter.ts

function filterStateForSpectator(
  fullState: GameState,
  viewerId: string
): SpectatorViewState {
  return {
    ...fullState,
    players: fullState.players.map(player => {
      const isMe = player.id === viewerId;
      
      return {
        ...player,
        // 只有自己能看手牌
        hand: isMe ? player.hand : player.hand.map(() => HIDDEN_CARD),
        // 牌库对所有人隐藏
        deck: [],
        // 其他公开信息保留
        ghostFire: player.ghostFire,
        charm: player.charm,
        shikigami: player.shikigami,
        discard: player.discard,
      };
    }),
  };
}
```

---

## 三、结算系统

### 3.1 游戏结束条件

```typescript
enum GameEndReason {
  BOSS_DEFEATED = 'BOSS_DEFEATED',     // 最终鬼王被击败
  ALL_PLAYERS_DEAD = 'ALL_PLAYERS_DEAD', // 所有玩家死亡（可选规则）
  TIMEOUT = 'TIMEOUT',                 // 超时（如1小时未结束）
  SURRENDER = 'SURRENDER',             // 投降
}
```

### 3.2 胜负判定

```typescript
interface GameResult {
  endReason: GameEndReason;
  endTime: number;
  duration: number;                    // 游戏时长（秒）
  
  rankings: PlayerRanking[];           // 排名（按声望）
  
  winner?: {
    playerId: string;
    playerName: string;
    finalCharm: number;
  };
  
  // 统计数据
  stats: GameStats;
}

interface PlayerRanking {
  rank: number;                        // 名次 1, 2, 3...
  playerId: string;
  playerName: string;
  
  // 最终数据
  finalCharm: number;                  // 最终声望
  
  // 过程统计
  damageDealt: number;                 // 总伤害
  yokaiDefeated: number;               // 击杀妖怪数
  bossContribution: number;            // 鬼王贡献（伤害占比）
  cardsPlayed: number;                 // 打出卡牌数
  skillsUsed: number;                  // 使用技能数
  
  // 积分变化
  ratingChange: number;                // 积分变化
  newRating: number;                   // 新积分
}
```

### 3.3 积分计算

```typescript
// server/src/rating/RatingCalculator.ts

interface RatingConfig {
  baseWinPoints: number;       // 基础胜利积分 +25
  baseLosePoints: number;      // 基础失败积分 -20
  drawPoints: number;          // 平局积分 +5
  
  // 修正系数
  rankBonus: number[];         // 名次加成 [1st: +10, 2nd: +5, 3rd: 0, ...]
  performanceWeight: number;   // 表现权重
  underdog Bonus: number;      // 弱者击败强者加成
}

function calculateRatingChange(
  player: PlayerRanking,
  opponents: PlayerRanking[],
  config: RatingConfig
): number {
  const isWinner = player.rank === 1;
  
  // 基础分
  let change = isWinner ? config.baseWinPoints : config.baseLosePoints;
  
  // 名次修正
  change += config.rankBonus[player.rank - 1] || 0;
  
  // 表现分（基于统计数据）
  const performanceScore = calculatePerformanceScore(player);
  change += performanceScore * config.performanceWeight;
  
  // 对手强度修正（ELO风格）
  const avgOpponentRating = average(opponents.map(o => o.newRating));
  const ratingDiff = avgOpponentRating - player.newRating;
  if (isWinner && ratingDiff > 0) {
    // 击败更强对手，额外加分
    change += Math.min(ratingDiff / 20, 15);
  } else if (!isWinner && ratingDiff < 0) {
    // 输给更弱对手，额外扣分
    change -= Math.min(Math.abs(ratingDiff) / 20, 10);
  }
  
  // 限制单场变化范围
  return Math.max(-40, Math.min(50, Math.round(change)));
}

function calculatePerformanceScore(player: PlayerRanking): number {
  // 综合表现评分（0-10分）
  let score = 0;
  
  // 伤害贡献
  score += Math.min(player.damageDealt / 50, 3);
  
  // 击杀效率
  score += Math.min(player.yokaiDefeated * 0.5, 2);
  
  // 鬼王贡献
  score += player.bossContribution * 3;
  
  // 技能使用
  score += Math.min(player.skillsUsed * 0.2, 2);
  
  return Math.min(score, 10);
}
```

### 3.4 段位系统

```typescript
// 段位定义
const RANKS = [
  { name: '见习阴阳师', minRating: 0, icon: '🌱' },
  { name: '初级阴阳师', minRating: 500, icon: '🌿' },
  { name: '中级阴阳师', minRating: 1000, icon: '🌳' },
  { name: '高级阴阳师', minRating: 1500, icon: '⭐' },
  { name: '阴阳师大人', minRating: 2000, icon: '🌟' },
  { name: '首席阴阳师', minRating: 2500, icon: '💫' },
  { name: '传说阴阳师', minRating: 3000, icon: '👑' },
];

interface PlayerProfile {
  playerId: string;
  playerName: string;
  
  // 积分与段位
  rating: number;
  rank: typeof RANKS[number];
  
  // 历史统计
  totalGames: number;
  wins: number;
  winRate: number;
  
  // 最高成就
  peakRating: number;
  longestWinStreak: number;
  
  // 本赛季数据
  seasonGames: number;
  seasonWins: number;
  seasonRating: number;
}
```

### 3.5 结算界面

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          🎉 游戏结束 🎉                                  │
│                      酒吞童子 已被讨伐！                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   🏆 排名                声望    伤害    击杀    积分变化                │
│   ════════════════════════════════════════════════════════════════      │
│                                                                          │
│   🥇 第1名  玩家A       156     320     12      +32 ⬆️ (1532 → 1564)   │
│   🥈 第2名  玩家B       142     280     10      +15 ⬆️ (1498 → 1513)   │
│   🥉 第3名  我          128     250      8       +5 ⬆️ (1450 → 1455)   │
│   　 第4名  玩家C       98      180      6      -18 ⬇️ (1520 → 1502)   │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│   📊 我的本局数据                                                        │
│   ─────────────────────────────────────────                              │
│   声望获得: 128  │  总伤害: 250  │  妖怪击杀: 8  │  技能使用: 15         │
│   最高连击: 3连  │  御魂收集: 12 │  完美操作: 2  │  表现评分: ★★★★☆    │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│         ┌──────────────┐          ┌──────────────┐                       │
│         │   再来一局   │          │   返回大厅   │                       │
│         └──────────────┘          └──────────────┘                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.6 数据持久化

```typescript
// server/src/storage/GameHistory.ts

interface GameRecord {
  gameId: string;
  startTime: number;
  endTime: number;
  
  // 游戏配置
  playerCount: number;
  isRanked: boolean;
  
  // 结果
  result: GameResult;
  
  // 回放数据（可选，用于录像回放）
  replayData?: {
    initialState: GameState;
    actions: TimestampedAction[];
  };
}

// 玩家历史记录
interface PlayerGameHistory {
  playerId: string;
  
  recentGames: GameRecord[];       // 最近20场
  statistics: {
    total: PlayerStats;
    ranked: PlayerStats;
    casual: PlayerStats;
    byPlayerCount: Map<number, PlayerStats>;  // 按人数分
  };
}
```

---

## 四、消息协议补充

基于上述场景，补充以下消息类型：

```typescript
// 匹配相关 C2S
| { type: 'QUICK_MATCH'; playerCount: number }
| { type: 'CANCEL_MATCH' }

// 匹配相关 S2C
| { type: 'MATCH_QUEUE_UPDATE'; position: number; estimatedTime: number }
| { type: 'MATCH_FOUND'; roomId: string; players: MatchedPlayer[] }
| { type: 'MATCH_CANCELLED' }

// 游戏事件 S2C
| { type: 'TURN_CHANGE'; activePlayerId: string; phase: TurnPhase }
| { type: 'GAME_BROADCAST'; event: GameBroadcastEvent }
| { type: 'GAME_END'; result: GameResult }

// 结算相关 S2C
| { type: 'RATING_UPDATE'; oldRating: number; newRating: number; change: number }
```

---

## 五、实现优先级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 创建/加入房间 | 基础多人入口 |
| P0 | 回合同步 | 核心游戏体验 |
| P0 | 视角过滤 | 保证公平性 |
| P1 | 快速匹配 | 便捷入口 |
| P1 | 积分系统 | 竞技激励 |
| P2 | 段位系统 | 成长体验 |
| P2 | 历史记录 | 数据回顾 |
| P3 | 录像回放 | 复盘学习 |

---

*文档版本：1.0.0*  
*最后更新：2024年*
