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
- **两种人数模式**：
  - 🎯 **小局模式**：3-4人（推荐新手）
  - 🎯 **大局模式**：5-6人（完整体验）

```typescript
interface QuickMatchRequest {
  type: 'QUICK_MATCH';
  mode: 'SMALL' | 'LARGE';         // 小局(3-4人) / 大局(5-6人)
  rankTolerance?: number;          // 段位容差（默认±200分）
}

// 匹配规则：
// - 小局模式：3人即可开始，最多4人
// - 大局模式：5人即可开始，最多6人
```

#### 模式B：创建房间
- 玩家手动创建
- 可设置密码（好友房）
- 房主控制开始时机
- **必须选择人数模式**

```typescript
interface CreateRoomRequest {
  type: 'CREATE_ROOM';
  config: {
    mode: 'SMALL' | 'LARGE';  // 小局(3-4人) / 大局(5-6人)
    isPrivate: boolean;       // 是否私有房
    password?: string;        // 房间密码
    isRanked: boolean;        // 是否计入排位
  };
}

// 人数限制：
// - SMALL 模式：minPlayers=3, maxPlayers=4
// - LARGE 模式：minPlayers=5, maxPlayers=6
```

### 1.3 匹配队列实现

```typescript
// server/src/match/MatchQueue.ts

interface QueuedPlayer {
  playerId: string;
  playerName: string;
  rating: number;              // 玩家积分
  queueTime: number;           // 入队时间
  mode: MatchMode;             // 匹配模式：SMALL(3-4人) / LARGE(5-6人)
  connection: PlayerConnection;
}

type MatchMode = 'SMALL' | 'LARGE';

const MODE_CONFIG = {
  SMALL: { minPlayers: 3, maxPlayers: 4 },
  LARGE: { minPlayers: 5, maxPlayers: 6 },
};

class MatchQueue {
  private queues: Map<MatchMode, QueuedPlayer[]> = new Map([
    ['SMALL', []],
    ['LARGE', []],
  ]);
  private matchInterval: number = 2000;  // 每2秒匹配一次
  
  // 加入匹配队列
  enqueue(player: QueuedPlayer): void {
    const queue = this.queues.get(player.mode)!;
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
    for (const [mode, queue] of this.queues) {
      const { minPlayers, maxPlayers } = MODE_CONFIG[mode];
      
      // 人数不足最小要求，跳过
      if (queue.length < minPlayers) continue;
      
      // 按积分排序
      queue.sort((a, b) => a.rating - b.rating);
      
      // 确定本次匹配人数（优先凑满，但至少满足最小人数）
      const matchSize = Math.min(queue.length, maxPlayers);
      if (matchSize < minPlayers) continue;
      
      // 滑动窗口寻找积分相近的玩家
      for (let i = 0; i <= queue.length - matchSize; i++) {
        const candidates = queue.slice(i, i + matchSize);
        const ratingDiff = candidates[matchSize - 1].rating - candidates[0].rating;
        
        // 随时间增加容差
        const maxWaitTime = Math.max(...candidates.map(p => Date.now() - p.queueTime));
        const tolerance = 200 + Math.floor(maxWaitTime / 10000) * 50;  // 每10秒+50分容差
        
        if (ratingDiff <= tolerance) {
          // 匹配成功！
          this.createMatch(candidates, mode);
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
│    │  ○ 小局 (3-4人) │    │  ○ 小局 (3-4人) │             │
│    │  ○ 大局 (5-6人) │    │  ○ 大局 (5-6人) │             │
│    │                 │    │  密码: ______   │             │
│    │  [开始匹配]     │    │  [创建房间]     │             │
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
│ 1. 所有玩家共享同一视角                                     │
│    - 中央操作区：所有行动都在这里展示                        │
│    - 周围信息区：各玩家的状态信息                           │
│                                                             │
│ 2. 顶部显示【当前行动玩家】指示器                           │
│    - 回合切换时，指示器变更到新玩家                          │
│    - 中央操作区展示当前玩家的操作界面                        │
│                                                             │
│ 3. 观战模式（非行动玩家）：                                 │
│    - 视角与行动玩家完全相同                                 │
│    - 可以看到行动玩家的手牌和操作                           │
│    - 只是无法实际点击/操作                                  │
│    - 可以自由查看场上信息                                   │
│                                                             │
│ 4. 公开信息所有人可见：                                     │
│    - 鬼王血量、场上妖怪                                     │
│    - 各玩家的声望、鬼火、出战式神                           │
│    - 弃牌堆、牌库剩余数量                                   │
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
  
  // 我的玩家ID
  myPlayerId: string;
  
  // 所有玩家完整信息（共享视角）
  players: PlayerFullView[];
  
  // 战场公开信息
  field: FieldView;
  
  // 事件日志
  eventLog: GameEventLog[];
}

interface PlayerFullView {
  id: string;
  name: string;
  
  // 数值
  ghostFire: number;              // 鬼火数量
  charm: number;                  // 声望
  
  // 完整手牌（所有人都能看到当前行动者的手牌）
  hand: CardInstance[];
  
  // 式神
  shikigami: ShikigamiCard[];
  
  // 弃牌堆
  discardPile: CardInstance[];
  
  // 状态
  isActive: boolean;              // 是否正在行动
  isConnected: boolean;           // 是否在线
}

// 操作权限判断
function canOperate(state: ClientViewState): boolean {
  return state.currentTurn.activePlayerId === state.myPlayerId;
}
```

### 2.3 回合切换动画

```typescript
// 当行动玩家切换时的UI表现

class TurnChangeHandler {
  
  onTurnChange(newPlayerId: string): void {
    // 1. 更新顶部指示器
    this.updateActivePlayerIndicator(newPlayerId);
    
    // 2. 更新玩家信息栏高亮
    this.highlightPlayerCard(newPlayerId);
    
    // 3. 切换中央操作区内容
    this.switchOperationArea(newPlayerId);
    
    // 4. 根据是否是自己的回合，设置操作权限
    if (newPlayerId === myPlayerId) {
      this.showMyTurnPrompt('你的回合！');
      this.enableOperationButtons();
    } else {
      this.showWatchingPrompt(`等待 ${playerName} 行动...`);
      this.disableOperationButtons();  // 按钮变灰，不可点击
    }
  }
  
  // 切换操作区：显示当前行动玩家的手牌和式神
  switchOperationArea(playerId: string): void {
    const playerState = gameState.players.find(p => p.id === playerId);
    this.renderHandCards(playerState.hand);       // 显示该玩家手牌
    this.renderShikigami(playerState.shikigami);  // 显示该玩家式神
    this.renderGhostFire(playerState.ghostFire);  // 显示该玩家鬼火
  }
}
```

### 2.4 游戏界面布局（4人局示例）

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ▶ 当前行动: 玩家B [声望:8] 🔥×2                   ⏱️ 01:45     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐                    │
│   │ 玩家A  │   │ 玩家B  │   │ 玩家C  │   │ 玩家D  │  ← 玩家信息栏     │
│   │ 🏆 12  │   │ 🏆 8   │   │ 🏆 15  │   │ 🏆 10  │                    │
│   │ 🔥 3   │   │ 🔥 2   │   │ 🔥 4   │   │ 🔥 5   │                    │
│   │ 🃏 5   │   │ 🃏 4   │   │ 🃏 6   │   │ 🃏 5   │  ← 手牌数量       │
│   │[山兔]  │   │[座敷]  │   │[茨木]  │   │[桃花]  │  ← 式神           │
│   │[青灯]  │   │[小白]  │   │[萤草]  │   │[姑获]  │                    │
│   └────────┘   └──🔷───┘   └────────┘   └────────┘                    │
│                   ↑ 当前行动高亮                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│         ┌────────────────────────────────────────────┐                  │
│         │              🎃 酒吞童子                   │                  │
│         │              HP: 35/50                     │                  │
│         │         ⚔️ ████████████░░░░░░░             │                  │
│         └────────────────────────────────────────────┘                  │
│                                                                         │
│      ┌─────────┐   ┌─────────┐   ┌─────────┐                           │
│      │   🎃    │   │   🎃    │   │   🎃    │   ← 场上妖怪              │
│      │  河童   │   │  狸猫   │   │  骨女   │                           │
│      │  HP:3   │   │  HP:4   │   │  HP:5   │                           │
│      └─────────┘   └─────────┘   └─────────┘                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                    ═══ 当前行动玩家的操作区 ═══                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  手牌:                                                              │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     式神: [座敷童子] [小白]      │ │
│  │  │阴阳术│ │阴阳术│ │御魂牌│ │御魂牌│                                 │ │
│  │  │ 初级 │ │ 中级 │ │骸骨  │ │三尾狐│     🔥 鬼火: 2               │ │
│  │  └─────┘ └─────┘ └─────┘ └─────┘                                   │ │
│  │                                                                     │ │
│  │     [打出卡牌]    [使用技能]    [结束回合]   ← 只有行动者可点击     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  📜 玩家B 打出「中级阴阳术」→ 河童 造成 3 点伤害                        │
└─────────────────────────────────────────────────────────────────────────┘
```

**布局说明**：
- **顶部**：当前行动玩家指示器 + 倒计时
- **上方**：所有玩家信息栏（声望🏆、鬼火🔥、手牌数🃏、式神）
- **中央**：鬼王 + 场上妖怪
- **下方**：当前行动玩家的操作区（手牌、技能、操作按钮）
- **底部**：事件日志

**观战时**：操作按钮变灰，显示「等待 玩家B 行动...」

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

### 2.6 状态同步策略

由于所有玩家共享视角，服务端广播完整的游戏状态：

```typescript
// server/src/game/StateBroadcaster.ts

class StateBroadcaster {
  
  // 广播游戏状态给所有玩家（共享视角）
  broadcastState(gameState: GameState): void {
    const sharedView = this.createSharedView(gameState);
    
    for (const player of this.room.players) {
      player.connection.send({
        type: 'STATE_SYNC',
        state: sharedView,
        myPlayerId: player.id,  // 告知客户端自己是谁
      });
    }
  }
  
  // 创建共享视图（所有人看到相同内容）
  private createSharedView(state: GameState): SharedGameView {
    return {
      currentTurn: {
        activePlayerId: state.currentPlayerId,
        phase: state.turnPhase,
        remainingTime: state.turnTimer,
      },
      
      // 所有玩家的完整信息
      players: state.players.map(player => ({
        id: player.id,
        name: player.name,
        ghostFire: player.ghostFire,
        charm: player.charm,
        hand: player.hand,           // 完整手牌（共享视角）
        shikigami: player.shikigami,
        discardPile: player.discard,
        isActive: player.id === state.currentPlayerId,
        isConnected: player.isConnected,
      })),
      
      // 战场信息
      field: {
        boss: state.currentBoss,
        yokaiSlots: state.yokaiSlots,
        spellDecks: state.spellDecks,
      },
    };
  }
}
```

**注意**：牌库顺序仍然隐藏，玩家无法知道下一张会抽到什么牌。

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
| { type: 'QUICK_MATCH'; mode: 'SMALL' | 'LARGE' }  // 小局3-4人 / 大局5-6人
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
