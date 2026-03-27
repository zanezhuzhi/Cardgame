# 妖怪效果引擎技术框架

> **版本**: v2.0  
> **状态**: 架构规划  
> **最后更新**: 2026/3/27  
> **已验收截止**: yokai_016 骰子鬼

---

## 一、架构概述

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **单一入口** | `executeYokaiEffect()` 作为所有妖怪效果的统一执行入口 |
| **命令式注册** | 使用 `registerEffect(name, handler)` 注册效果处理器 |
| **异步交互** | 通过回调函数 `onSelectCards`/`onChoice`/`onSelectTarget` 处理玩家选择 |
| **AI 备选** | 每个交互点提供 `aiDecide_xxx()` 函数作为 AI/超时备选策略 |
| **向后兼容** | yokai_001-016 已验收代码保持稳定，不做破坏性修改 |

### 1.2 核心文件

| 文件 | 职责 | 状态 |
|------|------|------|
| `shared/game/effects/YokaiEffects.ts` | 妖怪御魂效果注册与执行 | ✅ 已实现 |
| `shared/game/effects/EffectEngine.ts` | 底层效果执行引擎 | ✅ 已实现 |
| `shared/game/effects/HarassmentPipeline.ts` | 妨害抵抗管线 | ✅ 已实现 |
| `server/src/game/MultiplayerGame.ts` | 服务端效果触发与交互处理 | ✅ 已实现 |

### 1.3 模块关系图

```
                    MultiplayerGame
                         │
                   ┌─────┴─────┐
                   │ executeYokaiEffect() │  ← 唯一入口
                   └─────┬─────┘
          ┌──────────────┼──────────────┐
          │              │              │
   ┌──────┴──────┐ ┌────┴────┐ ┌───────┴───────┐
   │ effectHandlers│ │ drawCards │ │ HarassmentPipe │
   │ (Map 注册表)  │ │ (辅助函数) │ │ (抵抗检查器)   │
   └──────┬──────┘ └─────────┘ └───────────────┘
          │
   ┌──────┴──────┐
   │ 38个妖怪效果 │
   │ registerEffect│
   └─────────────┘
```

---

## 二、38 种妖怪效果全景分析

### 2.1 效果类型分布

| 类型 | 数量 | 妖怪 |
|------|:----:|------|
| **伤害** | 12 | 唐纸伞妖、天邪鬼赤、鸣屋、蝠翼、兵主部、心眼、破势、镇墓兽、针女、狂骨、薙魂、伤魂鸟 |
| **抓牌** | 10 | 天邪鬼黄、灯笼鬼、树妖、蚌精、铮、镜姬、青女房、木魅、雪幽魂、镇墓兽 |
| **鬼火** | 4 | 天邪鬼青(选)、灯笼鬼、镜姬、青女房 |
| **退治** | 3 | 天邪鬼绿、骰子鬼、日女巳时(选) |
| **妨害** | 7 | 赤舌、魅妖、雪幽魂、返魂香、幽谷响、魍魉之匣、青女房(抵抗) |
| **超度** | 4 | 唐纸伞妖、蚌精、骰子鬼、伤魂鸟 |
| **复制** | 2 | 轮入道(双重效果)、飞缘魔(鬼王效果) |
| **触发** | 3 | 树妖(弃置)、三味(弃置)、铮(抵抗) |
| **TempBuff** | 4 | 涅槃之火、网切、针女、三味 |
| **特殊** | 3 | 地藏像(获式神)、涂佛(回收)、阴摩罗(复用) |

### 2.2 交互类型分布

| 交互类型 | 回调函数 | 涉及妖怪 |
|----------|----------|----------|
| **无交互** | - | 招福达摩、灯笼鬼、鸣屋、蝠翼、兵主部、心眼、狂骨、镇墓兽、镜姬、青女房 |
| **二选一** | `onChoice` | 唐纸伞妖、天邪鬼青、日女巳时 |
| **选择手牌** | `onSelectCards` | 天邪鬼赤、天邪鬼黄、树妖、蚌精、骰子鬼、轮入道、薙魂、涂佛、伤魂鸟、阴摩罗 |
| **选择目标** | `onSelectTarget` | 天邪鬼绿、骰子鬼、魅妖 |
| **复合交互** | 多回调 | 骰子鬼(选牌+选目标)、轮入道(选牌+子效果)、魍魉之匣(多次选择) |

### 2.3 按 HP 分组索引

#### HP 2 (7种) — yokai_001~007
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_001 | 赤舌 | 妨害 | 无 | ✅ |
| yokai_002 | 唐纸伞妖 | 伤害+超度 | 二选一 | ✅ |
| yokai_003 | 天邪鬼绿 | 退治 | 选目标 | ✅ |
| yokai_004 | 天邪鬼青 | 鬼火/伤害 | 二选一 | ✅ |
| yokai_005 | 天邪鬼赤 | 伤害+换牌 | 选手牌 | ✅ |
| yokai_006 | 天邪鬼黄 | 抓牌 | 选手牌 | ✅ |
| yokai_007 | 魅妖 | 妨害 | 选目标 | ✅ |

#### HP 3 (8种) — yokai_008~015
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_008 | 灯笼鬼 | 鬼火+抓牌 | 无 | ✅ |
| yokai_009 | 树妖 | 抓牌+弃置 | 选手牌 | ✅ |
| yokai_010 | 日女巳时 | 三选一 | 二选一 | ✅ |
| yokai_011 | 蚌精 | 超度+抓牌 | 选手牌 | ✅ |
| yokai_012 | 鸣屋 | 条件伤害 | 无 | ✅ |
| yokai_013 | 蝠翼 | 抓牌+伤害 | 无 | ✅ |
| yokai_014 | 兵主部 | 伤害 | 无 | ✅ |
| yokai_015 | 魍魉之匣 | 妨害 | 多次选择 | ✅ |

#### HP 4 (7种) — yokai_016~022
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_016 | 骰子鬼 | 超度+退治 | 选牌+选目标 | ✅ |
| yokai_017 | 涅槃之火 | TempBuff | 无 | 🔄 |
| yokai_018 | 雪幽魂 | 妨害 | 无 | 🔄 |
| yokai_019 | 轮入道 | 复制 | 选手牌 | 🔄 |
| yokai_020 | 网切 | TempBuff | 无 | 🔄 |
| yokai_021 | 铮 | 抓牌+伤害 | 触发 | 🔄 |
| yokai_022 | 薙魂 | 条件鬼火 | 选手牌 | 🔄 |

#### HP 5 (7种) — yokai_023~029
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_023 | 狂骨 | 动态伤害 | 无 | 🔄 |
| yokai_024 | 返魂香 | 妨害 | 无 | 🔄 |
| yokai_025 | 镇墓兽 | 综合 | 无 | 🔄 |
| yokai_026 | 针女 | TempBuff | 无 | 🔄 |
| yokai_027 | 心眼 | 伤害 | 无 | 🔄 |
| yokai_028 | 涂佛 | 回收 | 选手牌 | 🔄 |
| yokai_029 | 地藏像 | 获式神 | 特殊 | 🔄 |

#### HP 6 (4种) — yokai_030~033
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_030 | 飞缘魔 | 复制 | 依赖鬼王 | 🔄 |
| yokai_031 | 破势 | 条件伤害 | 无 | 🔄 |
| yokai_032 | 镜姬 | 综合 | 无 | 🔄 |
| yokai_033 | 木魅 | 抓牌 | 无 | 🔄 |

#### HP 7 (3种) — yokai_034~036
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_034 | 幽谷响 | 妨害 | 无 | 🔄 |
| yokai_035 | 伤魂鸟 | 超度 | 选手牌 | 🔄 |
| yokai_036 | 阴摩罗 | 复用 | 选手牌 | 🔄 |

#### HP 8 (2种) — yokai_037~038
| ID | 名称 | 类型 | 交互 | 验收 |
|----|------|------|------|:----:|
| yokai_037 | 青女房 | 综合+抵抗 | 无 | 🔄 |
| yokai_038 | 三味 | TempBuff+触发 | 无 | 🔄 |

> ✅ = 已验收  🔄 = 待验收

---

## 三、核心类型定义

### 3.1 EffectContext — 效果执行上下文

```typescript
// shared/game/effects/YokaiEffects.ts (现有接口)

interface EffectContext {
  /** 当前玩家状态（可直接修改） */
  player: PlayerState;
  
  /** 完整游戏状态 */
  gameState: GameState;
  
  /** 触发效果的卡牌实例 */
  card: CardInstance;
  
  // ── 交互回调（由服务端注入，AI 时为 undefined）──
  
  /** 选择手牌（返回 instanceId[]） */
  onSelectCards?: (cards: CardInstance[], count: number) => Promise<string[]>;
  
  /** 多选一 */
  onChoice?: (options: string[]) => Promise<number>;
  
  /** 选择目标（妖怪/玩家） */
  onSelectTarget?: (targets: CardInstance[]) => Promise<string>;
}
```

### 3.2 EffectResult — 执行结果

```typescript
interface EffectResult {
  success: boolean;
  message: string;
  
  // ── 可选统计字段（用于日志/UI）──
  draw?: number;       // 实际抓牌数
  damage?: number;     // 实际伤害数
  ghostFire?: number;  // 实际鬼火变化
}
```

### 3.3 CardInstance — 卡牌实例

```typescript
interface CardInstance {
  instanceId: string;   // 唯一实例ID
  cardId: string;       // 卡牌定义ID (如 'yokai_002')
  cardType: string;     // 'yokai' | 'spell' | 'penalty' | ...
  name: string;         // 卡牌名称
  hp?: number;          // 当前HP
  maxHp?: number;       // 最大HP
  damage?: number;      // 伤害值
  charm?: number;       // 声誉值
  tags?: string[];      // 标签 ['鬼火', '妨害', ...]
}
```

### 3.4 PlayerState — 玩家状态

```typescript
interface PlayerState {
  id: string;
  name: string;
  deck: CardInstance[];      // 牌库
  hand: CardInstance[];      // 手牌
  discard: CardInstance[];   // 弃牌堆
  exiled: CardInstance[];    // 超度区
  ghostFire: number;         // 当前鬼火
  maxGhostFire: number;      // 鬼火上限
  damage: number;            // 累计伤害
  tempBuffs: TempBuff[];     // 临时效果
  
  // ── 扩展字段 ──
  revealedDeckCards?: RevealedCard[];  // 已展示的牌库卡牌
  played?: CardInstance[];             // 本回合已打出的牌
  cardsPlayed?: number;                // 本回合打出牌数量
}
```

---

## 四、交互系统规范

### 4.1 pendingChoice 类型定义

妖怪效果使用以下标准交互类型：

| 类型 | 用途 | 触发方式 |
|------|------|----------|
| `salvageChoice` | 超度选择（是/否） | `onChoice(['保留', '超度'])` |
| `selectHandCards` | 选择手牌 | `onSelectCards(hand, count)` |
| `selectTarget` | 选择目标妖怪 | `onSelectTarget(targets)` |
| `multiChoice` | 多选一 | `onChoice(['选项A', '选项B', ...])` |

### 4.2 交互流程时序

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   服务端     │     │   客户端     │     │   效果处理器 │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │   执行效果        │                   │
       │──────────────────────────────────────>│
       │                   │                   │
       │                   │   需要交互        │
       │                   │<──────────────────│
       │   设置 pendingChoice                  │
       │<──────────────────│                   │
       │                   │                   │
       │   广播状态更新    │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │   显示选择UI      │
       │                   │                   │
       │   玩家响应        │                   │
       │<──────────────────│                   │
       │                   │                   │
       │   继续执行        │                   │
       │──────────────────────────────────────>│
       │                   │                   │
```

### 4.3 交互超时处理

| 场景 | 默认行为 | AI 策略 |
|------|----------|---------|
| 二选一超时 | 选择第一个选项 | 调用 `aiDecide_xxx()` |
| 选择手牌超时 | 选择第一张牌 | 按价值排序选择 |
| 选择目标超时 | 选择第一个合法目标 | 按优先级选择 |
| 玩家断线 | AI 接管剩余选择 | L1 规则策略 |

### 4.4 标准交互回调映射表

为确保前后端接口一致，所有妖怪文档中的 `triggerInteract` 调用需遵循以下标准映射：

| 文档中的 triggerInteract.type | v2.0 回调 | 返回值 | 使用场景 |
|------------------------------|-----------|--------|----------|
| `salvageChoice` | `onChoice(['保留', '超度'])` | `number` (0/1) | 唐纸伞妖、蚌精、骰子鬼 |
| `selectCard` | `onSelectCards(cards, 1)` | `string[]` | 单选手牌 |
| `selectCards` | `onSelectCards(cards, count)` | `string[]` | 多选手牌 |
| `selectTarget` | `onSelectTarget(targets)` | `string` | 选择妖怪目标 |
| `selectYokai` | `onSelectTarget(yokai)` | `string` | 选择游荡妖怪 |
| `selectShikigami` | `onSelectTarget(shikigami)` | `string` | 选择式神 |
| `multiChoice` | `onChoice(options)` | `number` | 多选一 |
| `chooseNumber` | `onChooseX(min, max)` | `number` | 选择数值 |
| `opponentChoice` | `onChoice(options)` | `number` | 对手选择 |
| `revealDefense` | `onChoice(['展示', '不展示'])` | `number` | 青女房展示防御 |
| `replaceShikigami` | `onSelectTarget(shikigami)` | `string | null` | 地藏像替换式神 |

#### 标准化伪代码示例

**旧写法（需更新）**：
```typescript
const choice = await triggerInteract?.({
  type: 'salvageChoice',
  playerId: player.id,
  card: topCard,
  prompt: '是否超度牌库顶牌？'
});
```

**新写法（v2.0 规范）**：
```typescript
const choice = await ctx.onChoice?.(['保留', '超度']) ?? aiDecide_xxx(topCard);
```

#### AI 函数命名规范

所有 AI 决策函数统一使用以下命名格式：

```typescript
// 格式: aiDecide_<卡牌名>_<决策点>?

// 单一决策点
function aiDecide_唐纸伞妖(topCard: CardInstance): number { ... }

// 多个决策点
function aiDecide_骰子鬼_超度(hand: CardInstance[]): string { ... }
function aiDecide_骰子鬼_退治(targets: CardInstance[]): string { ... }

// 对手决策
function aiDecide_返魂香_对手选择(opponent: PlayerState): number { ... }
function aiDecide_镇墓兽_左手边玩家(targets: CardInstance[]): string { ... }
```

---

## 五、AI 决策规范

### 5.1 AI 策略等级

| 等级 | 名称 | 说明 |
|:----:|------|------|
| L0 | 随机 | 随机选择（仅用于测试） |
| **L1** | 规则 | 按固定规则选择（**当前使用**） |
| L2 | 启发 | 考虑当前局面综合判断（未来扩展） |

### 5.2 AI 决策函数命名规范

```typescript
// 函数命名: aiDecide_妖怪名 或 aiSelect_妖怪名
export function aiDecide_唐纸伞妖(topCard: CardInstance): number { ... }
export function aiSelect_天邪鬼绿(targets: CardInstance[]): string { ... }
export function aiDecide_骰子鬼_超度(hand: CardInstance[]): string { ... }
export function aiDecide_骰子鬼_退治(targets: CardInstance[]): string { ... }
```

### 5.3 已实现 AI 决策索引

| 妖怪 | 函数 | 策略说明 |
|------|------|----------|
| 唐纸伞妖 | `aiDecide_唐纸伞妖` | 超度低价值/负面牌 |
| 天邪鬼绿 | `aiSelect_天邪鬼绿` | 优先退治 HP 最高的合法目标 |
| 天邪鬼赤 | `aiDecide_天邪鬼赤` | 全弃低价值牌以滤牌 |
| 天邪鬼黄 | `aiDecide_天邪鬼黄` | 选价值最低的牌置顶 |
| 魅妖 | `aiDecide_魅妖` | 优先选伤害高的牌 |
| 骰子鬼 | `aiDecide_骰子鬼_超度` | 声誉最低，同声誉时 HP 最高 |
| 骰子鬼 | `aiDecide_骰子鬼_退治` | 声誉最高，同声誉时 HP 最高 |

---

## 六、特殊机制处理规范

### 6.1 妨害效果管线

妨害效果需通过 `HarassmentPipeline` 检查抵抗：

```typescript
// 妨害效果执行流程
async function applyHarassment(
  ctx: EffectContext,
  applyToTarget: (target: PlayerState) => Promise<void>
) {
  const opponents = ctx.gameState.players.filter(p => p.id !== ctx.player.id);
  
  for (const target of opponents) {
    // 1. 检查花鸟卷护符抵抗
    // 2. 检查萤草种子护盾
    // 3. 检查铮反击
    // 4. 检查食梦貘沉睡
    // 5. 执行妨害效果
    await applyToTarget(target);
  }
}
```

#### 妨害妖怪一览

| 妖怪 | 妨害效果 | 可被抵抗 |
|------|----------|:--------:|
| 赤舌 | 对手弃牌堆→牌库顶 | ✅ |
| 魅妖 | 使用对手牌库顶效果 | ✅ |
| 雪幽魂 | 弃恶评/获恶评 | ✅ |
| 返魂香 | 弃牌/获恶评 | ✅ |
| 魍魉之匣 | Wilson 发现法检查弃置 | ✅ |
| 幽谷响 | 使用对手牌库顶效果 | ✅ |

### 6.2 触发效果处理

部分妖怪具有被动触发效果：

| 妖怪 | 触发条件 | 效果 | 处理函数 |
|------|----------|------|----------|
| 树妖 | 被弃置时 | 抓牌+2 | `onTreeDemonDiscard()` |
| 三味 | 被弃置时 | 抓牌+3 | `onSanmiDiscard()` |
| 铮 | 受妨害时 | 弃置抓牌+2免疫 | `canZhengCounter()` / `useZhengCounter()` |
| 青女房 | 展示时 | 免疫妨害/鬼王来袭 | `canQingnvfangImmune()` |

### 6.3 牌库操作与展示记录

涉及牌库顶/底操作时，需维护展示记录：

```typescript
interface RevealedCard {
  instanceId: string;
  position: 'top' | 'bottom';
  revealedBy: string;    // 玩家ID
  revealedAt: number;    // 时间戳
}

// 展示记录管理
if (!player.revealedDeckCards) player.revealedDeckCards = [];

// 添加展示
player.revealedDeckCards.push({
  instanceId: card.instanceId,
  position: 'top',
  revealedBy: player.id,
  revealedAt: Date.now()
});

// 卡牌离开时移除
player.revealedDeckCards = player.revealedDeckCards.filter(
  r => r.instanceId !== card.instanceId
);
```

#### 涉及牌库操作的妖怪

| 妖怪 | 操作类型 | 说明 |
|------|----------|------|
| 唐纸伞妖 | 查看牌库顶 | 可选超度 |
| 天邪鬼黄 | 置牌库顶 | 手牌→牌库顶 |
| 赤舌 | 置牌库顶 | 对手弃牌堆→牌库顶 |
| 魅妖 | Wilson 发现法检查牌库顶 | 另行处理 |
| 木魅 | 连续展示 | 直到3张阴阳术 |
| 幽谷响 | Wilson 发现法检查展示 | 可选3张或超度 |
| 阴摩罗 | 置牌库底 | 使用后返回 |

### 6.4 TempBuff 系统

妖怪效果使用的临时增益定义：

```typescript
// shared/types/game.ts

/** TempBuff 类型枚举 */
enum TempBuffType {
  // === 费用类 ===
  SKILL_COST_REDUCTION = 'SKILL_COST_REDUCTION',     // 涅槃之火: 式神技能消耗-1
  CARD_COST_REDUCTION = 'CARD_COST_REDUCTION',       // 预留: 御魂消耗减少
  
  // === 伤害类 ===
  SKILL_DAMAGE_BONUS = 'SKILL_DAMAGE_BONUS',         // 针女: 式神技能伤害+2
  SPELL_DAMAGE_BONUS = 'SPELL_DAMAGE_BONUS',         // 三味: 阴阳术伤害+2(统计)
  
  // === 目标类 ===
  HP_REDUCTION = 'HP_REDUCTION',                     // 网切: 妖怪HP-1, 鬼王HP-2
  PROHIBIT_RETIRE = 'PROHIBIT_RETIRE',               // 镇墓兽: 禁止退治指定目标
  
  // === 触发类 ===
  NAGINATA_SOUL_PENDING = 'NAGINATA_SOUL_PENDING',   // 薙魂: 3张御魂时鬼火+2
  ON_SKILL_USED = 'ON_SKILL_USED',                   // 针女: 使用技能时触发
}

/** TempBuff 实例接口 */
interface TempBuff {
  type: TempBuffType;
  value?: number;            // 数值型buff的值
  targetId?: string;         // 针对特定目标（如镇墓兽）
  duration: 'turn' | 'permanent';  // 持续时间
  source: string;            // 来源卡牌名
  callback?: () => void;     // 触发回调（如针女）
}
```

#### TempBuff 使用一览

| Buff 类型 | 来源 | 持续 | 触发时机 | 说明 |
|-----------|------|:----:|----------|------|
| `SKILL_COST_REDUCTION` | 涅槃之火 | turn | 使用技能时 | 消耗-1 |
| `HP_REDUCTION` | 网切 | turn | 攻击结算时 | HP-1/-2 |
| `SKILL_DAMAGE_BONUS` | 针女 | turn | 使用技能后 | 伤害+2 |
| `SPELL_DAMAGE_BONUS` | 三味 | turn | 统计阶段 | 伤害+2×X |
| `PROHIBIT_RETIRE` | 镇墓兽 | turn | 退治时 | 禁止退治 |
| `NAGINATA_SOUL_PENDING` | 薙魂 | turn | 打出时 | 3御魂则+2 |
| `ON_SKILL_USED` | 针女 | turn | 技能后 | 回调触发 |

### 6.5 回合历史系统

用于追踪本回合已执行的操作：

```typescript
// shared/types/game.ts

interface TurnHistory {
  /** 本回合已打出的牌（按顺序） */
  playedCards: CardInstance[];
  
  /** 本回合已使用的技能 */
  usedSkills: { shikigamiId: string; skillName: string }[];
  
  /** 本回合造成的伤害来源分类 */
  damageBreakdown: {
    fromSpell: number;      // 来自阴阳术
    fromYokai: number;      // 来自御魂
    fromSkill: number;      // 来自式神技能
  };
  
  /** 本回合鬼火牌使用数 */
  ghostFireCardsUsed: number;
}

// 使用示例
function onCardPlayed(card: CardInstance, turnHistory: TurnHistory) {
  turnHistory.playedCards.push(card);
  
  if (card.cardType === 'spell') {
    turnHistory.damageBreakdown.fromSpell += card.damage ?? 0;
  }
  
  if (card.tags?.includes('鬼火')) {
    turnHistory.ghostFireCardsUsed++;
  }
}
```

#### 依赖回合历史的妖怪

| 妖怪 | 使用字段 | 说明 |
|------|----------|------|
| 破势 | `playedCards.length` | 首张打出时伤害+5 |
| 三味 | `playedCards` | 统计阴阳术+鬼火牌数量 |
| 薙魂 | `playedCards` | 统计御魂数量 |

### 6.6 弃置触发系统

部分卡牌在被弃置时触发效果：

```typescript
// shared/game/effects/TriggerEffects.ts

/** 弃置类型 */
type DiscardType = 
  | 'active'     // 主动弃置（玩家选择/效果强制）
  | 'rule'       // 规则弃置（回合结束清空、超限弃牌）
  | 'replace';   // 替换弃置（换牌效果）

/** 弃置上下文 */
interface DiscardContext {
  player: PlayerState;
  card: CardInstance;
  discardType: DiscardType;
  source?: string;  // 触发弃置的来源
}

/** 弃置触发注册表 */
const discardTriggers = new Map<string, (ctx: DiscardContext) => Promise<EffectResult>>();

/** 注册弃置触发 */
function registerDiscardTrigger(
  cardName: string, 
  handler: (ctx: DiscardContext) => Promise<EffectResult>
) {
  discardTriggers.set(cardName, handler);
}

/** 执行弃置触发检查 */
async function checkDiscardTriggers(ctx: DiscardContext): Promise<EffectResult | null> {
  const handler = discardTriggers.get(ctx.card.name);
  if (handler) {
    return await handler(ctx);
  }
  return null;
}
```

#### 弃置触发卡牌一览

| 卡牌 | 触发条件 | 效果 | DiscardType |
|------|----------|------|-------------|
| 树妖 | 任意弃置 | 抓牌+2 | `active`, `rule`, `replace` |
| 三味 | 主动弃置 | 抓牌+3 | `active` only |

### 6.7 回合结束效果系统

部分效果在回合结束时执行：

```typescript
// shared/game/effects/EndOfTurnEffects.ts

/** 回合结束效果 */
interface EndOfTurnEffect {
  id: string;
  playerId: string;
  callback: () => Promise<void>;
  priority: number;  // 执行优先级（数字越小越先执行）
}

/** 回合结束效果队列 */
const endOfTurnQueue: EndOfTurnEffect[] = [];

/** 注册回合结束效果 */
function registerEndOfTurnEffect(effect: EndOfTurnEffect) {
  endOfTurnQueue.push(effect);
  endOfTurnQueue.sort((a, b) => a.priority - b.priority);
}

/** 执行所有回合结束效果 */
async function executeEndOfTurnEffects(playerId: string) {
  const effects = endOfTurnQueue.filter(e => e.playerId === playerId);
  
  for (const effect of effects) {
    await effect.callback();
    // 移除已执行的效果
    const idx = endOfTurnQueue.indexOf(effect);
    if (idx !== -1) endOfTurnQueue.splice(idx, 1);
  }
}
```

#### 回合结束效果一览

| 卡牌 | 效果 | 优先级 |
|------|------|:------:|
| 阴摩罗 | 使用的牌返回牌库底 | 100 |
| TempBuff清理 | 清除所有 turn 级buff | 999 |

---

## 七、边界条件与异常处理

### 7.1 标准边界条件

| 条件 | 处理方式 | 示例 |
|------|----------|------|
| **手牌为空** | 返回失败或跳过选择步骤 | 蚌精、骰子鬼 |
| **牌库耗尽** | 洗入弃牌堆后继续 | `drawCards()` 自动处理 |
| **牌库+弃牌堆皆空** | 跳过抓牌/仅提供替代选项 | 天邪鬼青 |
| **无合法目标** | 返回成功但无效果 | 天邪鬼绿 |
| **对手为空** | 跳过妨害效果 | 赤舌、魅妖 |
| **选择无效** | 返回失败 | 选择了不存在的卡牌 |

### 7.2 效果实现模板

```typescript
registerEffect('妖怪名', async (ctx) => {
  const { player, gameState, onSelectCards, onChoice, onSelectTarget } = ctx;
  
  // 1. 前置条件检查
  if (player.hand.length === 0) {
    return { success: false, message: '妖怪名：没有手牌可选择' };
  }
  
  // 2. 获取合法目标/候选
  const validTargets = gameState.field.yokaiSlots
    .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= 4);
  
  if (validTargets.length === 0) {
    return { success: true, message: '妖怪名：没有符合条件的目标' };
  }
  
  // 3. 交互选择（带 AI 备选）
  let targetId: string;
  if (onSelectTarget) {
    targetId = await onSelectTarget(validTargets);
  } else {
    targetId = aiSelect_妖怪名(validTargets);  // AI 备选
  }
  
  // 4. 执行效果
  const idx = gameState.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
  if (idx !== -1) {
    const target = gameState.field.yokaiSlots[idx]!;
    gameState.field.yokaiSlots[idx] = null;
    player.discard.push(target);
    return { success: true, message: `妖怪名：退治${target.name}` };
  }
  
  // 5. 异常处理
  return { success: false, message: '妖怪名：执行失败' };
});
```

### 7.3 事务性原则

- **已生效的数值变更不回滚**：如伤害+1 已执行，后续步骤失败不影响
- **未完成的选择步骤执行默认策略**：超时/断线时 AI 接管
- **效果执行顺序固定**：先数值变更，后交互选择

---

## 八、开发流程与检查清单

### 8.1 效果实现检查清单

- [ ] 在 `YokaiEffects.ts` 中使用 `registerEffect()` 注册
- [ ] 效果名称与 `cards.json` 中的 `name` 字段一致
- [ ] 处理所有交互分支（玩家选择/AI 备选）
- [ ] 实现对应的 `aiDecide_xxx()` 函数
- [ ] 维护牌库展示记录（如涉及牌库操作）
- [ ] 考虑妨害抵抗（如为妨害效果）
- [ ] 编写对应测试用例
- [ ] 更新 `YOKAI_EFFECT_DEFS` 兼容列表

### 8.2 测试模板

```typescript
// shared/game/effects/YokaiEffects.test.ts
describe('妖怪名', () => {
  it('🟢 正常流程', async () => {
    const player = createTestPlayer({ hand: [createTestCard()] });
    const ctx = createTestContext(player);
    
    const result = await executeYokaiEffect('妖怪名', ctx);
    
    expect(result.success).toBe(true);
    expect(player.damage).toBe(1);
  });
  
  it('🔴 边界条件: 手牌为空', async () => {
    const player = createTestPlayer({ hand: [] });
    const ctx = createTestContext(player);
    
    const result = await executeYokaiEffect('妖怪名', ctx);
    
    expect(result.success).toBe(false);
  });
});
```

### 8.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 效果未触发 | 名称不匹配 | 检查 `registerEffect` 名称与 cards.json 一致 |
| 交互无响应 | pendingChoice 类型不匹配 | 确认前后端交互类型一致 |
| AI 选择异常 | aiDecide 函数未导出 | 检查 export 并确保被正确调用 |
| 牌库可见性错误 | 展示记录未维护 | 添加/移除 revealedDeckCards |
| 妨害未抵抗 | 未接入管线 | 通过 HarassmentPipeline 执行 |

### 8.4 服务端同步检查（重要）

> ⚠️ **此章节针对"TDD测试通过但实际功能有bug"的根本原因进行规范**

#### 8.4.1 问题背景

项目存在**两套效果实现代码**：

| 位置 | 用途 | 测试覆盖 |
|------|------|----------|
| `shared/game/effects/YokaiEffects.ts` | 效果引擎实现（完整） | ✅ TDD测试覆盖 |
| `server/src/game/MultiplayerGame.ts` | 服务端switch-case实现 | ⚠️ 无单元测试 |

**典型问题**：shared中的TDD测试全部通过，但服务端实际运行的是MultiplayerGame中的switch-case代码，导致功能异常。

#### 8.4.2 服务端同步检查清单

**每个效果实现完成后，必须确认以下内容**：

##### A. 检查服务端实现存在性

```bash
# 搜索服务端是否有对应的 case 分支
grep -n "case '卡牌名称':" server/src/game/MultiplayerGame.ts
```

##### B. 核对实现一致性

| 检查项 | 描述 |
|--------|------|
| **效果逻辑** | switch-case中的逻辑是否与shared中一致？ |
| **交互类型** | 如需玩家选择，是否设置了正确的pendingChoice？ |
| **响应处理** | 是否添加了对应的handleXxxResponse函数？ |
| **Socket事件** | 是否在SocketServer.ts中注册了事件监听？ |
| **客户端UI** | App.vue中是否处理了该pendingChoice类型？ |
| **超时处理** | resolvePendingChoiceForTimeout中是否有兜底？ |

##### C. 新增效果完整流程

| 步骤 | 内容 |
|:----:|------|
| **1** | 在 `shared/game/effects/YokaiEffects.ts` 中 `registerEffect()` |
| **2** | 编写TDD测试并通过 |
| **3** | 检查 `server/src/game/MultiplayerGame.ts` 中的 switch-case |
| **4** | 如有交互，在 `shared/types/pendingChoice.ts` 添加类型 |
| **5** | 在 `MultiplayerGame.ts` 添加 `handleXxxResponse()` |
| **6** | 在 `SocketServer.ts` 添加 Socket 事件监听 |
| **7** | 在 `client/src/App.vue` 添加 pendingChoice UI 处理 |
| **8** | 在 `resolvePendingChoiceForTimeout()` 添加超时兜底 |

##### D. 理想方案：统一效果入口

长期目标是让服务端直接调用shared模块的效果实现，消除代码重复：

```typescript
// 理想实现（未来重构目标）
import { executeYokaiEffect } from '@shared/game/effects';

// 服务端不再维护switch-case，直接调用shared
case '轮入道':
case '天邪鬼青':
default:
  await executeYokaiEffect(effectKey, buildContext(player));
  break;
```

#### 8.4.3 御魂服务端同步状态

> 此表格用于追踪各御魂在服务端的实现状态

| 御魂名称 | shared实现 | 服务端实现 | 一致性 | 备注 |
|----------|:----------:|:----------:|:------:|------|
| 轮入道 | ✅ | ✅ | ✅ | 2026-03-27修复 |
| 涅槃之火 | ✅ | ✅ | ✅ | |
| 心眼 | ✅ | ✅ | ✅ | |
| 天邪鬼青 | ✅ | ✅ | ✅ | |
| 天邪鬼绿 | ✅ | ✅ | ✅ | |
| 网切 | ✅ | ✅ | ✅ | |
| 铮 | ✅ | ✅ | ✅ | |
| 灯笼鬼 | ✅ | ✅ | ✅ | |
| ... | ... | ... | ... | |

---

## 九、版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026/3/20 | 初版框架文档 |
| v2.0 | 2026/3/27 | 重构架构设计，补充完整分类、接口定义、边界处理规范 |
| v2.1 | 2026/3/27 | 新增8.4服务端同步检查章节，规范shared与server代码一致性流程 |

---

## 十、附录：卡牌具体文档索引

所有妖怪的详细效果文档位于 `策划文档/卡牌数据/卡牌具体文档/` 目录：

### 已验收 (yokai_001-016)
- [yokai_001_赤舌.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_001_赤舌.md)
- [yokai_002_唐纸伞妖.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_002_唐纸伞妖.md)
- [yokai_003_天邪鬼绿.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_003_天邪鬼绿.md)
- [yokai_004_天邪鬼青.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_004_天邪鬼青.md)
- [yokai_005_天邪鬼赤.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_005_天邪鬼赤.md)
- [yokai_006_天邪鬼黄.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_006_天邪鬼黄.md)
- [yokai_007_魅妖.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_007_魅妖.md)
- [yokai_008_灯笼鬼.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_008_灯笼鬼.md)
- [yokai_009_树妖.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_009_树妖.md)
- [yokai_010_日女巳时.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_010_日女巳时.md)
- [yokai_011_蚌精.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_011_蚌精.md)
- [yokai_012_鸣屋.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_012_鸣屋.md)
- [yokai_013_蝠翼.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_013_蝠翼.md)
- [yokai_014_兵主部.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_014_兵主部.md)
- [yokai_015_魍魉之匣.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_015_魍魉之匣.md)
- [yokai_016_骰子鬼.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_016_骰子鬼.md)

### 待验收 (yokai_017-038)
- [yokai_017_涅槃之火.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_017_涅槃之火.md)
- [yokai_018_雪幽魂.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_018_雪幽魂.md)
- [yokai_019_轮入道.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_019_轮入道.md)
- [yokai_020_网切.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_020_网切.md)
- [yokai_021_铮.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_021_铮.md)
- [yokai_022_薙魂.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_022_薙魂.md)
- [yokai_023_狂骨.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_023_狂骨.md)
- [yokai_024_返魂香.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_024_返魂香.md)
- [yokai_025_镇墓兽.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_025_镇墓兽.md)
- [yokai_026_针女.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_026_针女.md)
- [yokai_027_心眼.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_027_心眼.md)
- [yokai_028_涂佛.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_028_涂佛.md)
- [yokai_029_地藏像.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_029_地藏像.md)
- [yokai_030_飞缘魔.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_030_飞缘魔.md)
- [yokai_031_破势.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_031_破势.md)
- [yokai_032_镜姬.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_032_镜姬.md)
- [yokai_033_木魅.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_033_木魅.md)
- [yokai_034_幽谷响.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_034_幽谷响.md)
- [yokai_035_伤魂鸟.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_035_伤魂鸟.md)
- [yokai_036_阴摩罗.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_036_阴摩罗.md)
- [yokai_037_青女房.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_037_青女房.md)
- [yokai_038_三味.md](../../策划文档/卡牌数据/卡牌具体文档/yokai_038_三味.md)