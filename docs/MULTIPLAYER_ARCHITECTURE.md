/**
 * 御魂传说 - 多人系统架构规划
 * @file docs/MULTIPLAYER_ARCHITECTURE.md
 * @version 2.0.0
 */

# 多人系统架构规划

> ⚠️ **核心原则**：多人模式只添加后端同步逻辑（数据同步、限时同步、全局数据联动），**不改变用户界面样式**。单人模式的 UI 已为多人兼容预留设计，多人模式直接复用。

## 一、整体架构

### 1.1 用户旅程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   注册/登录  │ ──→ │   大厅主页   │ ──→ │  匹配/房间   │ ──→ │   游戏对局   │
│   账号系统   │     │  世界频道   │     │   准备阶段   │     │   多人对战   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   创建角色           社交互动           匹配/组队           实时同步
   玩家数据           好友/公会           选角/准备           状态广播
```

### 1.2 系统分层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端层 (Client)                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  登录   │  │  大厅   │  │ 匹配/房间│  │  游戏   │  │  社交   │           │
│  │  注册   │  │  主页   │  │  等待   │  │  对局   │  │  好友   │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                               WebSocket / HTTP
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              网关层 (Gateway)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  负载均衡  │  连接管理  │  协议转换  │  身份验证  │  限流/防作弊         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              服务层 (Services)                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  账号   │  │  大厅   │  │  匹配   │  │  房间   │  │  游戏   │           │
│  │ Service │  │ Service │  │ Service │  │ Service │  │ Service │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│       │            │            │            │            │                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  社交   │  │  排行   │  │  成就   │  │  商城   │  │  日志   │           │
│  │ Service │  │ Service │  │ Service │  │ Service │  │ Service │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据层 (Data)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   MySQL     │  │   Redis     │  │  MongoDB    │  │   MQ        │        │
│  │ 用户/账号   │  │ 缓存/会话   │  │ 日志/统计   │  │ 消息队列    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、开发阶段规划

### Phase 1: 房间系统 (当前) ✅

**目标**：实现基础的多人房间机制

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 房间系统                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ WebSocket 连接                                              │
│  ✅ 房间创建/加入/离开                                          │
│  ✅ 玩家准备状态                                                │
│  ✅ 房间列表显示                                                │
│  🔄 多人游戏状态同步                                            │
│  ⏳ 断线重连                                                    │
│                                                                 │
│  账号系统：临时ID + 本地存储昵称                                 │
│  匹配系统：手动创建/加入房间                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: 游戏同步 (下一步)

**目标**：完整的多人游戏对战体验

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 游戏同步                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⏳ 式神选择阶段同步                                            │
│  ⏳ 回合制行动同步                                              │
│  ⏳ 玩家视角分离（只看自己手牌）                                │
│  ⏳ 操作日志广播                                                │
│  ⏳ 游戏结束结算                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: 账号系统

**目标**：持久化玩家数据

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 账号系统                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  方案选择（按平台）：                                            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │   Steam     │   │  微信小游戏  │   │   Web版     │           │
│  │             │   │             │   │             │           │
│  │ Steam 账号  │   │ 微信 OpenID │   │ 邮箱/手机   │           │
│  │ Steam ID   │   │ UnionID    │   │ 账号密码    │           │
│  │ 成就/统计   │   │ 微信支付    │   │ 第三方登录  │           │
│  └─────────────┘   └─────────────┘   └─────────────┘           │
│                                                                 │
│  玩家数据：                                                      │
│  - 角色信息（昵称、头像、等级）                                  │
│  - 战绩统计（胜/负/平）                                          │
│  - 段位/积分                                                     │
│  - 收藏/皮肤/道具                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: 大厅与社交

**目标**：社交化游戏体验

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: 大厅与社交                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  大厅功能：                                                      │
│  - 世界频道聊天                                                  │
│  - 在线玩家列表                                                  │
│  - 快速匹配入口                                                  │
│  - 房间列表浏览                                                  │
│                                                                 │
│  社交功能：                                                      │
│  - 好友系统（添加/删除/邀请）                                    │
│  - 私聊/组队                                                    │
│  - 观战功能                                                      │
│  - 举报/屏蔽                                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     🎮 御魂传说 大厅                         ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │  [世界] 玩家A: 有人一起开黑吗？                          │││
│  │  │  [世界] 玩家B: @玩家A 来了来了                           │││
│  │  │  [系统] 玩家C 达成成就【百鬼夜行】                        │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                             ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               ││
│  │  │ ⚔️ 快速匹配│  │ 🏠 创建房间│  │ 🚪 加入房间│               ││
│  │  └───────────┘  └───────────┘  └───────────┘               ││
│  │                                                             ││
│  │  在线: 1,234人  对局中: 456场  好友: 3人在线                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: 匹配系统

**目标**：自动化匹配体验

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: 匹配系统                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  匹配模式：                                                      │
│  - 快速匹配（按段位/积分）                                       │
│  - 排位赛（影响段位）                                            │
│  - 休闲模式（不影响段位）                                        │
│  - 自定义房间（好友房）                                          │
│                                                                 │
│  匹配算法：                                                      │
│  - ELO 积分系统                                                  │
│  - 等待时间动态扩大匹配范围                                       │
│  - 段位保护机制                                                  │
│                                                                 │
│  人数模式：                                                      │
│  - 小局模式（3-4人）                                             │
│  - 大局模式（5-6人）                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、技术选型

### 3.1 后端技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| **运行时** | Node.js | 与前端统一技术栈 |
| **框架** | Express + Socket.io | 当前已使用 |
| **数据库** | MySQL / PostgreSQL | 用户数据、战绩 |
| **缓存** | Redis | 会话、房间状态、排行榜 |
| **认证** | JWT + OAuth2 | 支持第三方登录 |

### 3.2 平台适配

| 平台 | 账号系统 | 支付系统 | 社交功能 |
|------|----------|----------|----------|
| **Steam** | Steamworks SDK | Steam 钱包 | Steam 好友 |
| **微信小游戏** | 微信 OpenID | 微信支付 | 微信好友 |
| **Web** | 自建账号系统 | 支付宝/微信 | 自建好友 |

### 3.3 通信协议

```typescript
// 当前（Phase 1-2）
WebSocket + Socket.io
- 全双工实时通信
- 自动重连
- 房间/广播机制

// 未来（Phase 3+）
HTTP REST API + WebSocket
- REST: 账号、商城、统计等低频操作
- WebSocket: 游戏同步、聊天等实时操作
```

---

## 四、数据模型设计（Phase 3+）

### 4.1 用户表

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  -- 账号信息
  username VARCHAR(32) UNIQUE,
  email VARCHAR(128) UNIQUE,
  password_hash VARCHAR(256),
  
  -- 第三方登录
  steam_id VARCHAR(64),
  wechat_openid VARCHAR(64),
  wechat_unionid VARCHAR(64),
  
  -- 角色信息
  nickname VARCHAR(32) NOT NULL,
  avatar_url VARCHAR(256),
  level INT DEFAULT 1,
  exp BIGINT DEFAULT 0,
  
  -- 段位
  rank_tier VARCHAR(16) DEFAULT 'BRONZE',  -- 青铜/白银/黄金/铂金/钻石/大师
  rank_points INT DEFAULT 0,
  
  -- 统计
  total_games INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_charm BIGINT DEFAULT 0,
  
  -- 状态
  status ENUM('online', 'offline', 'playing') DEFAULT 'offline',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rank (rank_tier, rank_points),
  INDEX idx_steam (steam_id),
  INDEX idx_wechat (wechat_openid)
);
```

### 4.2 游戏记录表

```sql
CREATE TABLE game_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id VARCHAR(16) NOT NULL,
  
  -- 游戏信息
  mode ENUM('SMALL', 'LARGE') NOT NULL,
  player_count INT NOT NULL,
  turn_count INT NOT NULL,
  duration_seconds INT NOT NULL,
  
  -- 结果
  winner_id BIGINT,
  is_ranked BOOLEAN DEFAULT FALSE,
  
  -- 时间
  started_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL,
  
  INDEX idx_winner (winner_id),
  INDEX idx_time (started_at)
);

-- 游戏参与者
CREATE TABLE game_players (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  
  -- 游戏数据
  final_charm INT NOT NULL,
  cards_played INT NOT NULL,
  yokai_defeated INT NOT NULL,
  boss_defeated INT NOT NULL,
  
  -- 排行榜
  rank_position INT NOT NULL,  -- 1,2,3...
  
  FOREIGN KEY (game_id) REFERENCES game_records(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id)
);
```

---

## 五、当前优先级

### 立即执行 (本周)

1. ✅ 房间创建/加入/离开 - 已完成
2. 🔄 多人游戏状态同步 - 进行中
3. ⏳ 式神选择阶段
4. ⏳ 回合制操作

### 短期目标 (2-4周)

1. 完整的多人游戏流程
2. 断线重连
3. 游戏结束结算
4. 基础的游戏统计（本地）

### 中期目标 (1-3月)

1. 账号系统（选择平台后）
2. 数据持久化
3. 匹配系统
4. 排行榜

### 长期目标 (3-6月)

1. 社交功能
2. 成就系统
3. 商城/皮肤
4. 赛季系统

---

## 六、讨论点

### Q1: 账号系统优先级？

当前使用临时ID + 本地昵称，足够支撑：
- 房间匹配
- 多人游戏
- 基础体验

账号系统可以在核心玩法完成后再接入，因为：
- 需要确定发布平台（Steam/微信/Web）
- 不同平台账号系统差异大
- 可以通过"游客模式"先验证玩法

### Q2: 什么时候需要数据库？

**不需要数据库的阶段**：
- 房间匹配（内存）
- 游戏对局（内存）
- 单人模式（本地存储）

**需要数据库的功能**：
- 账号注册/登录
- 战绩统计
- 好友系统
- 排行榜
- 商城/道具

### Q3: 世界频道何时实现？

世界频道依赖：
- 账号系统（识别发言者）
- 在线状态管理
- 聊天内容审核

建议在 Phase 4 实现，当前可以先实现**房间内聊天**作为过渡。

---

## 七、妨害抵抗管线统一接入（规划）

> 目标：`shared/game/EffectClassification.ts` 中 **`HARASSMENT_CARDS`** 所列御魂/式神妨害，在 **多人服务端** 结算时 **统一** 经过 `shared/game/effects/HarassmentPipeline.ts` 的抵抗链（青女房 → 铮 → 萤草种子 → 花鸟卷 → 食梦貘沉睡…），避免出现「策划/单测有管线、线上 switch-case 绕开」的双轨问题。

### 7.1 现状

| 层级 | 状态 |
|------|------|
| **分类真相源** | `HARASSMENT_CARDS`：赤舌、魅妖、雪幽魂、魍魉之匣、返魂香、镇墓兽、飞缘魔、幽谷响 + 百目鬼/般若/巫蛊师/丑时之女/铁鼠 等 |
| **管线实现** | `resolveHarassment` + `registerResistHandler`，依赖 `SkillContext.onChoice` |
| **多人服务端** | `MultiplayerGame` 大量 **手写** `[妨害]` 分支；**返魂香** 已走 `resolveHarassment` + `harassmentPipelineChoice`；其余妨害仍可能跳过管线 |
| **根因** | 未调用 `resolveHarassment`；`buildSkillContext` 中 `onChoice` 为占位；`onChoice` 未绑定 **被询问的 `playerId`**（抵抗方 ≠ 出牌方） |

### 7.2 目标架构（单轨）

1. **Shared（管线契约）**  
   - 在 `resolveForSingleTarget` 进入抵抗链 **前**，将当前 `target` 挂到 `SkillContext`（建议字段：`harassmentResistSubject?: PlayerState` 或仅 `harassmentResistSubjectId: string`），使 `onChoice` 实现者知道「弹窗归属谁」。  
   - 可选：新增显式 API `onChoiceForPlayer(playerId, options, prompt)`，默认实现回退到 `harassmentResistSubject`。

2. **Server（MultiplayerGame）**  
   - 提供 **`buildSkillContextForHarassment(sourcePlayer: PlayerState)`**：注入真实 `onChoice`：设 `pendingChoice`（通用 `harassmentPipelineChoice` 或复用 `choiceModal` 协议）、**阻塞侧** 用 `Promise` + 内部 `Map<requestId, resolve>` 或与现有 `handleXxxResponse` 对接的 **单槽 continuation**（与当前 `pendingChoice` 模型一致）。  
   - 提供 **`applyHarassmentToOpponents(source, cardName, targets, applyToTarget)`**：内部 `await resolveHarassment(createHarassmentAction(...), targets, ctx)`。  
   - **Socket**：一种通用 `game:harassmentPipelineChoiceResponse`（或按类型分事件，但参数统一 `{ choiceIndex }`），避免每种妨害单独加 socket。  
   - **AI**：`runAiTurnStep` 对 `pendingChoice.playerId !== currentPlayer` 的管线类 pending **按策略代答**（与现 `fanHunXiangChoice` / `harassmentHandResist` 规则一致）。

3. **Client**  
   - `App.vue`：监听统一 pending 类型，复用 `choiceModal`；若管线需选卡/多目标，再挂 `onSelectCards` 等与 `SkillContext` 对齐。

### 7.3 迁移顺序（建议）

按 **对手循环结构** 与 **依赖交互** 复杂度分批替换手写循环，每批带 **集成测试**（铮免疫 + 青女房免疫 + 不弃置后仍吃满妨害）：

| 批次 | 内容 | 备注 |
|:----:|------|------|
| **0** | Shared：`SkillContext.harassmentResistSubject` + `resolveForSingleTarget` try/finally 注入/恢复 | ✅ 已合并：`shared/types/shikigami.ts`、`HarassmentPipeline.ts`；单测覆盖 apply/onChoice 期间 subject 与结束后清空 |
| **1** | 返魂香：`resolveHarassment` + `buildSkillContextForHarassment` + `handleHarassmentPipelineChoiceResponse` | ✅ 已合并（`harassmentPipelineChoice` / 旧 socket 兼容转发） |
| **2** | **每名对手同质** 的妨害：雪幽魂式（弃恶评/恶评）、魍魉之匣（恶评）、简单 foreach | ✅ 已合并：`startXueYouHunHarassment` / `startWangliangHarassment`（魍魉由**发动者** `waitHarassmentPipelineChoice` + `meta.wangliangTargetId`；弃顶仍 `deck.pop` 与旧版一致） |
| **3** | **强交互**：赤舌、魅妖、幽谷响（牌库顶/多选）、镇墓兽、飞缘魔 | ✅ 赤舌 / 魅妖（选牌后）/ 幽谷响（申报后、含 AI 路径）已走 `resolveHarassment`；**镇墓兽**（左手指定禁退治）、**飞缘魔**（鬼王魂嵌套）仍未统一管线 |
| **4** | **式神技能妨害**（百目鬼/般若/巫蛊师/丑时之女/铁鼠） | 入口从 `ShikigamiSkillEngine` 或 `MultiplayerGame` 技能分支统一调到 `applyHarassmentToOpponents` |

### 7.4 测试与验收

- **清单驱动**：以 `HARASSMENT_CARDS` 与 `BOSS_RAID_EFFECTS`（若来袭也要统一「展示青女房」）为 checklist，每项至少：**免疫成功**、**拒绝抵抗后结算正确**、**AI 不卡死**。  
- **回归**：`server` 下现有 `fanHunXiangResist.integration.test.ts` 扩展或并行增加 `harassmentPipeline.multiplayer.test.ts`。

### 7.5 已知技术债（管线内）

- `HarassmentPipeline` 中花鸟卷 **置顶手牌** 仍为 TODO（自动选牌）；统一接入多人时，应优先接 `onSelectCards` 以免与「统一 SkillContext」目标冲突。

---

**下一步建议**：完成 Phase 2（游戏同步），让多人对战可以正常进行，再考虑账号系统。