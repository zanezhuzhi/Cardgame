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
│ 1. 每个玩家看到的是【自己的视角】                           │
│    - 手牌区显示自己的手牌                                   │
│    - 式神区显示自己的式神                                   │
│                                                             │
│ 2. 顶部【玩家区】显示所有玩家状态                           │
│    - 当前行动玩家高亮显示                                   │
│    - 回合切换时，高亮移动到下一个玩家                       │
│                                                             │
│ 3. 轮流行动机制：                                           │
│    - 玩家A行动 → 结果同步 → 玩家B行动 → 结果同步 → ...     │
│    - 非行动玩家只能等待，看到的是结果同步                   │
│    - 必须等所有人行动完，才会再次轮到自己                   │
│                                                             │
│ 4. 观战时看到的内容：                                       │
│    - 其他玩家的操作过程不可见                               │
│    - 只同步操作结果（打出的牌、造成的伤害等）               │
│    - 其他玩家的手牌不可见                                   │
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
    turnNumber: number;           // 第几轮
  };
  
  // 我的玩家ID
  myPlayerId: string;
  
  // 是否轮到我行动
  isMyTurn: boolean;
  
  // === 顶部玩家区（所有玩家可见） ===
  playersInfo: PlayerSummary[];
  
  // === 我的私有区域 ===
  myState: {
    hand: CardInstance[];         // 我的手牌
    shikigami: ShikigamiCard[];   // 我的式神
    ghostFire: number;            // 我的鬼火
    deck: number;                 // 牌库剩余数量（不显示内容）
    discard: CardInstance[];      // 我的弃牌堆
  };
  
  // === 公共区域 ===
  field: {
    boss: BossState;              // 当前鬼王
    yokaiSlots: YokaiSlot[];      // 游荡妖怪区
    spellDecks: SpellDeckState;   // 阴阳术牌堆
  };
  
  // 事件日志
  eventLog: GameEventLog[];
}

// 顶部玩家区的摘要信息（不显示手牌内容）
interface PlayerSummary {
  id: string;
  name: string;
  charm: number;                  // 声望
  ghostFire: number;              // 鬼火
  handCount: number;              // 手牌数量（不显示具体内容）
  shikigamiNames: string[];       // 式神名字
  isActive: boolean;              // 是否正在行动（高亮）
  isConnected: boolean;           // 是否在线
}

// 是否能操作
function canOperate(state: ClientViewState): boolean {
  return state.isMyTurn;
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

### 2.4 游戏界面布局（三区设计）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                           ① 进度指示区                                  │ │
│ │  交互信息提示    [👤][👤🔷][👤][👤][👤]               游戏LOGO         │ │
│ │  "第3轮"              玩家区                                            │ │
│ │                    (点击头像查看详情)                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                           ② 信息共享区                                  │ │
│ │                                                                         │ │
│ │   ┌─────────┐    ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐    游荡妖怪区    │ │
│ │   │         │    │     ││     ││     ││     ││     │                   │ │
│ │   │  鬼王区 │    │妖怪1││妖怪2││妖怪3││妖怪4││妖怪5│                   │ │
│ │   │         │    │     ││     ││     ││     ││     │                   │ │
│ │   │         │    └─────┘└─────┘└─────┘└─────┘└─────┘                   │ │
│ │   │         │                                                           │ │
│ │   └─────────┘    [12] 获得式神      获得阴阳术   [12] 查看超度区        │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                           ③ 自己信息区                                  │ │
│ │  式神区                                                                 │ │
│ │  ┌─────┐┌─────┐┌─────┐┌─────┐   ┌────┐  ┌─────┐┌─────┐...┌─────┐     │ │
│ │  │式神1││式神2││式神3││式神4│   │牌库│  │手牌1││手牌2│   │手牌10│手牌区│ │
│ │  └─────┘└─────┘└─────┘└─────┘   │    │  └─────┘└─────┘...└─────┘ *10  │ │
│ │                                  │弃牌│                                 │ │
│ │                                  └────┘                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 线下桌游比喻

想象你在玩一款线下桌游，桌面上有：

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   📊 记分牌（放在桌子边上）                                         │
│   ─────────────────────────                                         │
│   显示每位玩家的分数、资源概况                                       │
│   谁想看谁的情况，拿起来看一眼就行                                   │
│                                                                     │
│                        ↑ ① 进度指示区                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   🎲 公共桌面（桌子中央，所有人都能看到）                            │
│   ─────────────────────────────────────                             │
│   鬼王卡放在中央，妖怪卡摆成一排                                     │
│   式神招募池、阴阳术牌堆都在桌上                                     │
│   谁打出什么牌、造成什么效果，大家都看得见                           │
│                                                                     │
│                        ↑ ② 信息共享区                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   🎴 我的面板（我面前的区域，只有我能操作）                          │
│   ──────────────────────────────────────                            │
│   我的手牌捏在手里（别人看不到内容）                                 │
│   我的式神摆在面前                                                  │
│   我的牌库和弃牌堆在旁边                                            │
│   别人回合时我可以整理手牌、看自己的卡，但不能出牌                   │
│                                                                     │
│                        ↑ ③ 自己信息区                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.6 三区详细说明

#### ① 进度指示区 = 📊 记分牌

**线下体验**：桌游旁边放着一个记分牌，记录每个玩家的状态。

| 元素 | 线下等价物 | 说明 |
|------|-----------|------|
| 当前轮次 | 轮次标记 | "第3轮" |
| 玩家头像 | 玩家标记物 | 当前行动者发光/高亮 |
| 点击头像 | 看一眼记分牌 | 查看该玩家汇总信息 |

**点击头像弹出汇总信息**：
```
┌─────────────────────────┐
│  👤 玩家B               │
│  ─────────────────────  │
│  📚 牌库: 18张          │
│  🏆 声誉: 12            │
│  🔥 鬼火: 3             │
│  式神: 座敷童子、小白   │
└─────────────────────────┘
```

#### ② 信息共享区 = 🎲 公共桌面

**线下体验**：桌子中央，所有人围坐一圈都能看到。

| 元素 | 线下等价物 | 同步方式 |
|------|-----------|----------|
| 鬼王区 | 大Boss卡 | 血量实时更新 |
| 游荡妖怪区 | 一排小怪卡 | 受伤/击杀动画 |
| 获得式神 | 式神牌堆 | 被拿走时移除 |
| 获得阴阳术 | 阴阳术牌堆 | 显示剩余数量 |
| 超度区 | 击败妖怪堆 | 新增卡牌 |

**别人回合时发生的事**：
```
你坐在桌边，看着玩家B：
1. 从手里抽出一张牌（你看不到是什么）
2. 打出！放到桌上 → 你看到是「中级阴阳术」
3. 指向河童 → 河童受到3点伤害
4. 河童血量标记从5变成2 → 你看到了这个变化

整个过程，公共桌面上的变化你都能看到，
但他手里还剩什么牌，你看不到。
```

#### ③ 自己信息区 = 🎴 我的操作面板

**线下体验**：我面前的区域，手牌捏在手里只有自己能看。

| 元素 | 线下等价物 | 别人回合 | 自己回合 |
|------|-----------|----------|----------|
| 手牌区 | 手里的牌 | 可看，不能出 | 可看，可出 |
| 式神区 | 面前的式神卡 | 可看技能说明 | 可使用技能 |
| 牌库 | 我的抽牌堆 | 只显示数量 | 可抽牌 |
| 弃牌堆 | 我的弃牌堆 | 可翻看 | 可翻看 |

**非回合时的状态**：
```
你在等待玩家B行动...

你可以：
✅ 翻看自己的手牌（思考策略）
✅ 查看自己式神的技能说明
✅ 翻看自己的弃牌堆
✅ 点击公共区域的卡牌查看详情

你不能：
❌ 打出手牌（按钮灰色）
❌ 使用式神技能（按钮灰色）
❌ 获取式神/阴阳术（按钮灰色）
```

### 2.7 回合流转示意

```
┌──────────────────────────────────────────────────────────────────┐
│                         一轮游戏流程                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  玩家A回合                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ A操作自己的面板 → 结果同步到公共桌面 → BCD看到结果       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  玩家B回合                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ B操作自己的面板 → 结果同步到公共桌面 → ACD看到结果       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  玩家C回合                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ C操作自己的面板 → 结果同步到公共桌面 → ABD看到结果       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│  玩家D回合                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ D操作自己的面板 → 结果同步到公共桌面 → ABC看到结果       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              ↓                                   │
│                     一轮结束，进入下一轮                         │
│                      记分牌更新轮次: 第4轮                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
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

### 2.6 状态同步策略

**核心原则**：每个玩家只看到自己的私有信息 + 公共信息 + 其他玩家的操作结果

```typescript
// server/src/game/StateBroadcaster.ts

class StateBroadcaster {
  
  // 发送个人视角状态（只在需要时调用）
  sendPersonalState(playerId: string, gameState: GameState): void {
    const player = gameState.players.find(p => p.id === playerId);
    
    player.connection.send({
      type: 'STATE_SYNC',
      state: {
        currentTurn: {
          activePlayerId: gameState.currentPlayerId,
          phase: gameState.turnPhase,
          turnNumber: gameState.turnNumber,
        },
        isMyTurn: gameState.currentPlayerId === playerId,
        
        // 顶部玩家区（摘要信息）
        playersInfo: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          charm: p.charm,
          ghostFire: p.ghostFire,
          handCount: p.hand.length,      // 只显示数量
          shikigamiNames: p.shikigami.map(s => s.name),
          isActive: p.id === gameState.currentPlayerId,
          isConnected: p.isConnected,
        })),
        
        // 我的私有区域（只有自己能看到完整手牌）
        myState: {
          hand: player.hand,             // 完整手牌
          shikigami: player.shikigami,
          ghostFire: player.ghostFire,
          deckCount: player.deck.length,
          discard: player.discard,
        },
        
        // 公共区域
        field: {
          boss: gameState.currentBoss,
          yokaiSlots: gameState.yokaiSlots,
          spellDecks: gameState.spellDecks,
        },
      },
    });
  }
  
  // 广播操作结果（给所有人）
  broadcastActionResult(event: GameEvent): void {
    for (const player of this.room.players) {
      player.connection.send({
        type: 'GAME_EVENT',
        event,
      });
    }
  }
}
```

### 2.7 结果同步事件

当某玩家完成操作，服务端广播**结果事件**给所有人：

```typescript
type GameEvent =
  | {
      type: 'TURN_START';
      playerId: string;           // 轮到谁行动
      playerName: string;
    }
  | {
      type: 'CARD_PLAYED';
      playerId: string;
      cardName: string;           // 打出的牌名（不透露其他手牌）
      target?: string;
    }
  | {
      type: 'DAMAGE_DEALT';
      source: string;             // 来源（玩家名/技能名）
      target: string;             // 目标（妖怪/鬼王）
      damage: number;
      remainingHp: number;        // 目标剩余血量
    }
  | {
      type: 'YOKAI_DEFEATED';
      playerId: string;
      yokaiName: string;
      charmGained: number;
    }
  | {
      type: 'SKILL_USED';
      playerId: string;
      shikigamiName: string;
      skillName: string;
      effectDesc: string;         // 效果描述
    }
  | {
      type: 'TURN_END';
      playerId: string;
      nextPlayerId: string;       // 下一个行动的玩家
    }
  | {
      type: 'PLAYER_STATS_UPDATE';
      playerId: string;
      charm?: number;             // 声望变化后的值
      ghostFire?: number;         // 鬼火变化后的值
      handCount?: number;         // 手牌数量变化
    };
```

**同步流程**：
```
玩家A操作 → 服务端处理 → 广播结果事件 → 所有玩家更新显示
                                    ↓
                        下一个玩家开始行动
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
