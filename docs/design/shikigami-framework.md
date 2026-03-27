# 式神技能引擎统一架构设计

> **版本**: v1.0 草案  
> **状态**: 待确认  
> **最后更新**: 2026/3/27

---

## 一、现状问题

### 1.1 三套并行实现

| 文件 | 风格 | 覆盖 | 问题 |
|------|------|------|------|
| `ShikigamiEffects.ts` | 声明式 CardEffectDef | 29条定义 | 大量 `as any`，注释"由 GameManager 处理" |
| `ShikigamiSkills.ts` | 命令式 registerSkill | ~15个handler | 自定义类型，重复工具函数 |
| `GameManager.resolveSkillEffect()` | switch-case | 5个 | 与前两者不一致 |

### 1.2 核心缺陷

1. **类型不安全** — ShikigamiSkills.ts 自建接口，大量 `as any`
2. **触发时机混乱** — 【触】/【自】/【永】无统一管线，散布各处
3. **ShikigamiState 简陋** — 仅 `cardId + isExhausted + markers`
4. **指示物无 Schema** — markers 键名中英混用（'酒气' vs 'sake'）
5. **无 canUseSkill()** — 鬼火/目标/冷却校验散落多处
6. **TempBuff 不完整** — 缺花鸟卷/追月神/丑时之女等类型
7. **妨害无标准管线** — 花鸟卷/萤草抵抗逻辑 ad-hoc 散布

---

## 二、24 式神技能需求全景

### 2.1 技能触发类型分布

| 类型 | 标记 | 式神 |
|------|------|------|
| **主动技** | 【启】 | 妖刀姬、大天狗、酒吞童子、茨木童子、花鸟卷(启)、书翁、百目鬼、鬼使白、般若、白狼、食梦貘(启)、食发鬼、山童、丑时之女(启)、青蛙瓷器、铁鼠、座敷童子、山兔 |
| **触发技** | 【触】 | 追月神、食梦貘(触)、萤草(触×2)、巫蛊师、丑时之女(触) |
| **被动自动** | 【自】 | 花鸟卷(自)、鲤鱼精 |
| **永久被动** | 【永】 | 独眼小僧、三尾狐 |

### 2.2 消耗类型分布

| 消耗方式 | 式神 |
|----------|------|
| 固定鬼火-N | 大天狗(2)、酒吞(2)、茨木(2)、花鸟卷启(2)、百目鬼(1)、鬼使白(1)、般若(1)、白狼(1)、食梦貘(1)、食发鬼(1)、山童(1)、丑时之女启(2)、青蛙瓷器(1)、铁鼠(2)、山兔(1) |
| 可变鬼火-N | 书翁(N≥1) |
| 可选追加 | 妖刀姬(基础2+可选1) |
| 弃置手牌 | 白狼(弃N张)、座敷童子(弃妖怪牌) |
| 超度手牌 | 酒吞(超度1张) |
| 无消耗触发 | 追月神、鲤鱼精、丑时之女(触) |
| 触发时扣费 | 花鸟卷自(1)、巫蛊师(1) |

### 2.3 指示物（Marker）需求

| 式神 | key | 上限 | 跨回合 | 说明 |
|------|-----|------|--------|------|
| 酒吞童子 | `sake` | 3 | ✅ | 储酒/释放双技能 |
| 萤草 | `seed` | 无 | ✅ | 鬼火/妖怪两种播种 |
| 食梦貘 | `sleep` | 1 | ✅ 到下回合开始 | 沉睡状态标记 |

### 2.4 交互需求分类

| 交互类型 | 式神 |
|----------|------|
| **选择手牌** | 酒吞、白狼、山兔、座敷、花鸟卷、萤草、丑时之女、般若 |
| **选择目标** | 大天狗、食发鬼、巫蛊师 |
| **多选一** | 妖刀姬(追加?)、追月神(三选一)、般若(手牌/超度)、萤草(开花分配) |
| **可变数值** | 书翁(N)、白狼(弃N张)、酒吞(释放N枚) |
| **跨玩家** | 百目鬼、般若、铁鼠、丑时之女、巫蛊师 |

### 2.5 妨害标签式神

| 式神 | 效果 | 可被抵抗 |
|------|------|---------|
| 百目鬼 | 所有玩家弃1张手牌 | 花鸟卷/萤草 |
| 般若 | 所有玩家弃牌库顶 | 花鸟卷/萤草 |
| 丑时之女(启) | 给对手牌+其他得恶评 | 花鸟卷/萤草 |
| 铁鼠 | 对手弃牌库顶2张 | 花鸟卷/萤草 |

### 2.6 双技能/多技能式神

| 式神 | 技能数 | 技能列表 |
|------|:------:|---------|
| 酒吞童子 | 2 | 储酒(启) + 释放(启) |
| 萤草 | 3 | 播种(启) + 开花(触) + 护盾(触) |
| 花鸟卷 | 2 | 护符(自) + 探索(启) |
| 食梦貘 | 2 | 入眠(启) + 梦护(触) |
| 丑时之女 | 2 | 首妨害抓牌(触) + 草人替身(启) |

### 2.7 需新增 TempBuff 类型

| Buff 类型 | 来源 | 说明 |
|-----------|------|------|
| `HARASSMENT_SHIELD` | 花鸟卷(自) | 受妨害前：抓牌+2→置顶→结算 |
| `DRAW_COUNTER` | 追月神 | 回合内抓牌累计，达3触发 |
| `FIRST_HARASSMENT_DRAW` | 丑时之女(触) | 首次妨害抓牌+1 |
| `SEED_SHIELD` | 萤草(触) | 种子护盾免疫妨害 |

---

## 三、架构总览

### 3.1 目标

1. **单一入口** — `ShikigamiSkillEngine` 替代三套并行实现
2. **强类型** — 全量 TypeScript 强类型，零 `as any`
3. **事件驱动** — 标准化事件钩子驱动【触】/【自】/【永】
4. **交互协议** — 统一 `pendingChoice` 类型，前后端对齐
5. **可测试** — 纯函数 + 依赖注入，shared 层独立可测

### 3.2 模块关系图

```
                    GameManager
                        │
                  ┌─────┴─────┐
                  │ ShikigamiSkillEngine │  ← 唯一入口
                  └─────┬─────┘
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────┴──────┐ ┌───┴───┐ ┌──────┴──────┐
   │ SkillRegistry │ │EventBus│ │HarassmentPipe│
   └──────┬──────┘ └───┬───┘ └──────┬──────┘
          │             │             │
   ┌──────┴──────┐     │      ┌──────┴──────┐
   │ 24个SkillDef │     │      │ 抵抗检查器  │
   │ (数据+handler)│     │      │ (花鸟卷/萤草)│
   └─────────────┘     │      └─────────────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
        ON_TURN_START  ON_DRAW  ON_INTERFERE ...
```

### 3.3 文件清单（新增/重构）

| 文件 | 类型 | 说明 |
|------|------|------|
| `shared/types/shikigami.ts` | **新增** | 技能引擎核心类型定义 |
| `shared/game/effects/ShikigamiSkillEngine.ts` | **新增** | 统一执行引擎 |
| `shared/game/effects/skills/` | **新增目录** | 按式神拆分的技能实现文件 |
| `shared/game/effects/ShikigamiEventBus.ts` | **新增** | 事件钩子系统 |
| `shared/game/effects/HarassmentPipeline.ts` | **新增** | 妨害抵抗管线 |
| `shared/game/TempBuff.ts` | **扩展** | 新增缺失 Buff 类型 |
| `shared/game/effects/ShikigamiEffects.ts` | **废弃** | 迁移后删除 |
| `shared/game/effects/ShikigamiSkills.ts` | **废弃** | 迁移后删除 |
| `shared/game/GameManager.ts` | **重构** | 移除 resolveSkillEffect，改调引擎 |

---

## 四、核心类型定义

### 4.1 SkillTriggerType — 技能触发时机枚举

```typescript
// shared/types/shikigami.ts

/** 技能触发时机 */
export type SkillTriggerType =
  | 'ACTIVE'           // 【启】主动发动
  | 'ON_TURN_START'    // 【触】回合开始时
  | 'ON_DRAW'          // 【触】抓牌时（追月神）
  | 'ON_EXILE'         // 【触】超度时（巫蛊师）
  | 'ON_INTERFERE'     // 【触/自】受到妨害时（花鸟卷/萤草/食梦貘）
  | 'ON_FIRST_HARASS'  // 【触】首次发起妨害时（丑时之女）
  | 'ON_KILL'          // 【自】退治妖怪/鬼王时（鲤鱼精）
  | 'ON_DAMAGE'        // 【永】造成伤害时（三尾狐/大天狗联动）
  | 'PASSIVE';         // 【永】持续生效（独眼小僧）
```

### 4.2 SkillCostType — 消耗方式

```typescript
/** 技能消耗定义 */
export type SkillCostType =
  | { kind: 'GHOST_FIRE'; amount: number }                    // 固定鬼火
  | { kind: 'GHOST_FIRE_VARIABLE'; min: number; max?: number } // 可变鬼火（书翁）
  | { kind: 'GHOST_FIRE_OPTIONAL'; base: number; extra: number } // 可选追加（妖刀姬）
  | { kind: 'DISCARD_HAND'; count: number | 'VARIABLE'; filter?: CardFilter } // 弃手牌
  | { kind: 'EXILE_HAND'; count: number }                     // 超度手牌
  | { kind: 'NONE' };                                         // 无消耗

export interface CardFilter {
  cardType?: string;       // 'yokai' | 'spell' | ...
  maxHp?: number;
  minHp?: number;
}
```

### 4.3 ShikigamiSkillDef — 技能定义

```typescript
/** 单个技能定义（一个式神可有多个） */
export interface ShikigamiSkillDef {
  /** 技能唯一ID: 如 'shikigami_001:杀戮' */
  skillId: string;

  /** 所属式神 cardId */
  shikigamiId: string;

  /** 技能名称 */
  name: string;

  /** 技能类型标记 */
  effectType: '启' | '触' | '自' | '永';

  /** 触发时机 */
  trigger: SkillTriggerType;

  /** 消耗定义 */
  cost: SkillCostType;

  /** 是否为妨害技能 */
  isHarassment: boolean;

  /** 每回合使用限制（默认1，-1=无限制） */
  usesPerTurn: number;

  /** 技能效果描述（用于日志/UI） */
  description: string;

  /**
   * 前置校验：当前局面是否允许发动？
   * @returns null = 可发动；string = 不可发动原因
   */
  canUse: (ctx: SkillContext) => string | null;

  /**
   * 执行技能效果
   * @returns 执行结果
   */
  execute: (ctx: SkillContext) => Promise<SkillResult>;
}
```

### 4.4 SkillContext — 技能执行上下文

```typescript
import type { PlayerState, GameState, ShikigamiState } from '../types/game';
import type { CardInstance, ShikigamiCard } from '../types/cards';

/** 技能执行上下文（依赖注入） */
export interface SkillContext {
  /** 游戏状态（只读引用，效果函数可直接修改 player 等） */
  gameState: GameState;

  /** 技能发动者 */
  player: PlayerState;

  /** 当前式神卡数据 */
  shikigami: ShikigamiCard;

  /** 当前式神状态 */
  shikigamiState: ShikigamiState;

  /** 式神在 player.shikigamiState 中的索引 */
  slotIndex: number;

  /** 所有对手 */
  opponents: PlayerState[];

  // ── 交互回调（由 GameManager/服务端注入）──

  /** 选择手牌（返回 instanceId[]） */
  onSelectCards: (candidates: CardInstance[], count: number, prompt?: string) => Promise<string[]>;

  /** 选择目标（妖怪/鬼王/对手） */
  onSelectTarget: (candidates: Array<CardInstance | PlayerState>, prompt?: string) => Promise<string>;

  /** 多选一 */
  onChoice: (options: string[], prompt?: string) => Promise<number>;

  /** 输入数值（书翁 N） */
  onInputNumber: (min: number, max: number, prompt?: string) => Promise<number>;

  // ── 工具函数（由引擎注入）──

  /** 抓牌 */
  drawCards: (player: PlayerState, count: number) => number;

  /** 弃置手牌 */
  discardCard: (player: PlayerState, instanceId: string, type: 'active' | 'rule') => void;

  /** 超度卡牌 */
  exileCard: (player: PlayerState, instanceId: string) => void;

  /** 添加日志 */
  addLog: (message: string) => void;

  /** 发射事件（用于触发其他式神的被动） */
  emitEvent: (event: SkillEvent) => Promise<void>;
}
```

### 4.5 SkillResult — 执行结果

```typescript
export interface SkillResult {
  success: boolean;
  message: string;
  /** 实际支付的鬼火数（用于日志） */
  ghostFirePaid?: number;
  /** 是否需要立即结束回合（食梦貘） */
  forceEndTurn?: boolean;
  /** 是否需要跳过清理阶段（食梦貘） */
  skipCleanup?: boolean;
}
```

### 4.6 ShikigamiState 扩展

```typescript
// shared/types/game.ts — 扩展 ShikigamiState

export interface ShikigamiState {
  cardId: string;
  isExhausted: boolean;
  markers: Record<string, number>;

  // ── 新增字段 ──

  /** 本回合各技能已使用次数 { skillId: count } */
  skillUsesThisTurn: Record<string, number>;

  /** 状态标记（如沉睡、被封印等） */
  statusFlags: string[];
}
```

---

## 五、指示物（Marker）标准化 Schema

### 5.1 命名规范

| 式神 | 旧 key | 新 key（统一英文小写） | 上限 | 跨回合 | 清理时机 |
|------|--------|----------------------|------|--------|---------|
| 酒吞 | 'sake'/'酒气' | `sake` | 3 | ✅ | 手动移除（释放技能） |
| 萤草 | 'seed'/'祝福种子' | `seed` | 无 | ✅ | 手动移除（开花/护盾） |
| 萤草 | '生花_鬼火'/'生花_妖怪' | `seed_method_fire` / `seed_method_yokai` | 1 | ❌ 回合内 | 回合结束清除 |
| 食梦貘 | 'sleep' | `sleep` | 1 | ✅ | 下回合开始清除 |

### 5.2 Marker Schema 定义

```typescript
export interface MarkerSchema {
  key: string;           // 英文标识符
  displayName: string;   // 中文展示名
  max?: number;          // 上限（undefined=无限）
  persist: boolean;      // 是否跨回合保留
  clearOn?: 'TURN_START' | 'TURN_END' | 'MANUAL';  // 自动清理时机
}

export const MARKER_SCHEMAS: Record<string, MarkerSchema> = {
  sake:               { key: 'sake',               displayName: '酒气',     max: 3, persist: true,  clearOn: 'MANUAL' },
  seed:               { key: 'seed',               displayName: '祝福种子', persist: true,  clearOn: 'MANUAL' },
  seed_method_fire:   { key: 'seed_method_fire',   displayName: '播种(鬼火)', max: 1, persist: false, clearOn: 'TURN_END' },
  seed_method_yokai:  { key: 'seed_method_yokai',  displayName: '播种(妖怪)', max: 1, persist: false, clearOn: 'TURN_END' },
  sleep:              { key: 'sleep',              displayName: '沉睡',     max: 1, persist: true,  clearOn: 'TURN_START' },
};
```

---

## 六、事件钩子系统

### 6.1 事件类型定义

```typescript
// shared/game/effects/ShikigamiEventBus.ts

export type SkillEventType =
  | 'TURN_START'           // 回合开始（鬼火阶段后）
  | 'TURN_END'             // 回合结束（清理阶段前）
  | 'CARD_PLAYED'          // 打出卡牌后
  | 'CARDS_DRAWN'          // 抓牌后（追月神监听）
  | 'DAMAGE_DEALT'         // 造成伤害时（三尾狐/大天狗）
  | 'YOKAI_KILLED'         // 退治妖怪后（鲤鱼精/茨木）
  | 'BOSS_KILLED'          // 击败鬼王后
  | 'CARD_EXILED'          // 超度手牌后（巫蛊师监听）
  | 'HARASSMENT_INCOMING'  // 即将受到妨害（花鸟卷/萤草/食梦貘检查）
  | 'HARASSMENT_INITIATED' // 发起妨害时（丑时之女监听）
  | 'CLEANUP_PHASE';       // 清理阶段开始时

export interface SkillEvent {
  type: SkillEventType;
  sourcePlayerId: string;     // 事件发起者
  data?: Record<string, any>; // 事件携带数据
}

/** 抓牌事件 */
export interface DrawEvent extends SkillEvent {
  type: 'CARDS_DRAWN';
  data: {
    count: number;             // 本次抓牌数
    totalThisTurn: number;     // 回合累计抓牌数（用于追月神判定）
  };
}

/** 退治事件 */
export interface KillEvent extends SkillEvent {
  type: 'YOKAI_KILLED';
  data: {
    killedCard: CardInstance;
    isFirstKill: boolean;      // 本回合首次退治
  };
}

/** 妨害事件 */
export interface HarassmentEvent extends SkillEvent {
  type: 'HARASSMENT_INCOMING';
  data: {
    harasserId: string;        // 发起妨害的玩家ID
    skillName: string;         // 妨害技能名
    targetIds: string[];       // 被妨害的玩家ID列表
  };
}
```

### 6.2 EventBus 核心 API

```typescript
export class ShikigamiEventBus {
  /** 注册事件监听器（由引擎在式神入场时自动注册） */
  on(event: SkillEventType, listener: EventListener): void;

  /** 移除监听器（式神离场时） */
  off(event: SkillEventType, listener: EventListener): void;

  /** 触发事件（同步按优先级执行所有监听器） */
  async emit(event: SkillEvent, ctx: SkillContext): Promise<void>;

  /** 清空所有监听器（新游戏时） */
  clear(): void;
}

type EventListener = (event: SkillEvent, ctx: SkillContext) => Promise<void>;
```

### 6.3 触发时机映射

| GameManager 调用点 | 事件 | 监听的式神 |
|-------------------|------|-----------|
| `startTurn()` 鬼火+1后 | `TURN_START` | 萤草(开花)、食梦貘(清除沉睡) |
| `drawCards()` 每次抓牌后 | `CARDS_DRAWN` | 追月神 |
| `allocateDamage()` 扣血时 | `DAMAGE_DEALT` | 三尾狐、大天狗 |
| `killYokai()` 退治后 | `YOKAI_KILLED` | 鲤鱼精、茨木 |
| `exileCard()` 超度手牌后 | `CARD_EXILED` | 巫蛊师 |
| 妨害效果执行前 | `HARASSMENT_INCOMING` | 花鸟卷、萤草、食梦貘 |
| 妨害效果发起时 | `HARASSMENT_INITIATED` | 丑时之女(触) |
| `endTurn()` 清理前 | `TURN_END` | 独眼小僧 |

---

## 七、妨害抵抗管线

### 7.1 流程图

```
发起妨害（百目鬼/般若/丑时之女/铁鼠/妖怪御魂妨害效果）
    │
    ▼ 对每个目标执行
┌───────────────────────────────────────┐
│ 1. emit('HARASSMENT_INCOMING', target)│
├───────────────────────────────────────┤
│ 2. 检查花鸟卷【自】                   │
│    └─ 有且鬼火≥1？                    │
│       ├─ YES → 抓牌+2 → 置顶1张     │
│       │        → 标记已触发           │
│       │        → 继续结算妨害（不免疫）│
│       └─ NO → 继续检查下一项         │
├───────────────────────────────────────┤
│ 3. 检查萤草种子护盾                    │
│    └─ seed > 0？                      │
│       ├─ YES → seed-1 → 免疫本次妨害 │
│       └─ NO → 继续                   │
├───────────────────────────────────────┤
│ 4. 检查食梦貘沉睡状态                  │
│    └─ sleep > 0？                     │
│       ├─ YES → 先弃1张手牌           │
│       │        → 继续结算妨害         │
│       └─ NO → 继续                   │
├───────────────────────────────────────┤
│ 5. 执行妨害效果                        │
└───────────────────────────────────────┘
```

### 7.2 API

```typescript
// shared/game/effects/HarassmentPipeline.ts

export interface HarassmentAction {
  sourcePlayerId: string;
  sourceSkillName: string;
  /** 对单个目标执行的妨害效果 */
  applyToTarget: (target: PlayerState, ctx: SkillContext) => Promise<void>;
}

/**
 * 统一妨害执行入口
 * 遍历所有目标，对每个目标：先走抵抗检查管线 → 再执行实际妨害
 */
export async function resolveHarassment(
  action: HarassmentAction,
  targets: PlayerState[],
  ctx: SkillContext
): Promise<void>;
```

---

## 八、ShikigamiSkillEngine 核心 API

### 8.1 引擎类

```typescript
// shared/game/effects/ShikigamiSkillEngine.ts

export class ShikigamiSkillEngine {

  // ── 注册 ──

  /** 注册技能定义（启动时调用） */
  registerSkillDef(def: ShikigamiSkillDef): void;

  /** 根据 shikigamiId 获取所有技能定义 */
  getSkillDefs(shikigamiId: string): ShikigamiSkillDef[];

  /** 根据 skillId 获取单个技能 */
  getSkillDef(skillId: string): ShikigamiSkillDef | undefined;

  // ── 前置校验 ──

  /**
   * 检查技能是否可发动
   * @returns null=可发动，string=不可发动原因
   */
  canUseSkill(skillId: string, ctx: SkillContext): string | null;

  // ── 执行 ──

  /**
   * 执行主动技能（【启】）
   * 调用链: canUseSkill → 扣除鬼火 → 标记疲劳 → execute → 更新计数
   */
  async executeActiveSkill(
    skillId: string,
    ctx: SkillContext,
    extraParams?: Record<string, any>
  ): Promise<SkillResult>;

  /**
   * 触发被动技能（【触】/【自】/【永】）
   * 由 EventBus 的事件监听器调用
   */
  async triggerPassiveSkill(
    skillId: string,
    event: SkillEvent,
    ctx: SkillContext
  ): Promise<SkillResult | null>;

  // ── 生命周期 ──

  /** 回合开始：重置 isExhausted、清理回合内 markers、重置技能使用次数 */
  onTurnStart(player: PlayerState): void;

  /** 回合结束：清理回合内状态 */
  onTurnEnd(player: PlayerState): void;

  /** 式神入场：注册事件监听器 */
  onShikigamiEnter(player: PlayerState, shikigami: ShikigamiCard): void;

  /** 式神离场：移除事件监听器 */
  onShikigamiLeave(player: PlayerState, shikigamiId: string): void;
}
```

### 8.2 使用流程（GameManager 集成）

```typescript
// GameManager.ts（重构后）

// 回合开始
startTurn() {
  // ... 鬼火+1
  this.skillEngine.onTurnStart(player);
  this.eventBus.emit({ type: 'TURN_START', sourcePlayerId: player.id }, ctx);
}

// 使用式神技能
useShikigamiSkill(player, shikigamiId, skillId, params?) {
  const ctx = this.buildSkillContext(player, shikigamiId);
  const error = this.skillEngine.canUseSkill(skillId, ctx);
  if (error) return { success: false, error };
  
  const result = await this.skillEngine.executeActiveSkill(skillId, ctx, params);
  this.notifyStateChange();
  return result;
}

// 抓牌后
drawCards(player, count) {
  // ... 实际抓牌
  this.eventBus.emit({ type: 'CARDS_DRAWN', sourcePlayerId: player.id, data: { count, totalThisTurn } }, ctx);
}
```

---

## 九、pendingChoice 类型清单

### 9.1 式神技能需要的 pendingChoice 类型

| 类型 | 用途 | 关联式神 | 数据结构 |
|------|------|---------|---------|
| `skillRepeatChoice` | 是否追加效果 | 妖刀姬 | `{ canRepeat: boolean }` |
| `skillVariableCost` | 输入可变鬼火 | 书翁 | `{ min: number, max: number }` |
| `skillSelectCards` | 选择手牌 | 酒吞/白狼/山兔/座敷/花鸟卷/丑时之女/般若/萤草 | `{ candidates: CardInstance[], count: number, filter?: CardFilter }` |
| `skillSelectTarget` | 选择场上目标 | 大天狗/食发鬼/巫蛊师 | `{ candidates: (CardInstance\|PlayerState)[], maxCount?: number }` |
| `skillMultiChoice` | 多选一 | 追月神/般若/萤草 | `{ options: string[] }` |
| `skillSakeRelease` | 酒气释放数量 | 酒吞 | `{ current: number }` |
| `skillDiscardCount` | 弃牌数量 | 白狼 | `{ min: number, max: number }` |
| `skillSeedHarvest` | 种子收获分配 | 萤草 | `{ seedCount: number }` |
| `skillOpponentDiscard` | 对手选择弃牌 | 百目鬼/般若/铁鼠 | `{ count: number, fromDeck?: boolean }` |
| `skillCardExchange` | 交换手牌 | 巫蛊师 | `{ myCard: CardInstance, opponentCards: CardInstance[] }` |

### 9.2 三处必改（服务端/Socket/客户端）

每新增一个 pendingChoice 类型，必须同步修改：

1. **`server/MultiplayerGame.ts`** — 设置 `pendingChoice` + 新增 `handleXxxResponse()`
2. **`server/socket/SocketServer.ts`** — 新增 `socket.on('game:xxxResponse')` 
3. **`client/App.vue`** — `watch(gameState)` 中添加 UI 处理

---

## 十、迁移计划

### 10.1 阶段一：框架搭建（本次）

1. 新建 `shared/types/shikigami.ts` — 类型定义
2. 新建 `ShikigamiSkillEngine.ts` — 引擎骨架
3. 新建 `ShikigamiEventBus.ts` — 事件系统
4. 新建 `HarassmentPipeline.ts` — 妨害管线
5. 扩展 `TempBuff.ts` — 补全类型

### 10.2 阶段二：技能注册

按优先级迁移 24 个式神的技能定义到新引擎：

| 批次 | 式神 | 原因 |
|------|------|------|
| P0 | 山童、座敷、山兔、书翁、白狼 | 简单主动技，验证引擎基础流程 |
| P1 | 妖刀姬、大天狗、酒吞、茨木 | SSR 核心，验证追加/联动/指示物/Buff |
| P2 | 百目鬼、般若、丑时之女、铁鼠 | 妨害类，验证 HarassmentPipeline |
| P3 | 花鸟卷、萤草、食梦貘 | 防御/触发类，验证 EventBus + 妨害抵抗 |
| P4 | 鬼使白、追月神、鲤鱼精、巫蛊师 | 触发/被动类，验证 EventBus 完整性 |
| P5 | 三尾狐、独眼小僧、食发鬼、青蛙瓷器 | 永久被动 + 场地操作 + 随机 |

### 10.3 阶段三：集成替换

1. `GameManager.useShikigamiSkill()` 改调 `ShikigamiSkillEngine`
2. 回合流程关键节点插入 `EventBus.emit()`
3. 移除 `resolveSkillEffect()` switch-case
4. 标记 `ShikigamiEffects.ts` / `ShikigamiSkills.ts` 为 deprecated

---

## 十一、24 式神技能注册表（快速参考）

| # | 式神 | cardId | 技能 | skillId | 类型 | 鬼火 | 妨害 | 指示物 | 交互 |
|:-:|------|--------|------|---------|:----:|:----:|:----:|:------:|------|
| 1 | 妖刀姬 | shikigami_001 | 杀戮 | `001:杀戮` | 启 | 2(+1) | | | 追加选择 |
| 2 | 大天狗 | shikigami_002 | 羽刃暴风 | `002:羽刃暴风` | 启 | 2 | | | 选目标 |
| 3 | 酒吞童子 | shikigami_003 | 酒葫芦·储酒 | `003:储酒` | 启 | 2 | | sake(3) | 选手牌超度 |
| 3 | 酒吞童子 | shikigami_003 | 酒葫芦·释放 | `003:释放` | 启 | 0 | | sake | 输入N |
| 4 | 茨木童子 | shikigami_004 | 迁怒 | `004:迁怒` | 启 | 2 | | | |
| 5 | 花鸟卷 | shikigami_005 | 画境·护符 | `005:护符` | 自 | 1 | | | 选手牌置顶 |
| 5 | 花鸟卷 | shikigami_005 | 画境·探索 | `005:探索` | 启 | 2 | | | 选手牌置底 |
| 6 | 书翁 | shikigami_006 | 万象之书 | `006:万象之书` | 启 | N≥1 | | | 输入N |
| 7 | 百目鬼 | shikigami_007 | 诅咒之眼 | `007:诅咒之眼` | 启 | 1 | ✅ | | 跨玩家弃牌 |
| 8 | 鬼使白 | shikigami_008 | 魂狩 | `008:魂狩` | 启 | 1 | | | |
| 9 | 般若 | shikigami_009 | 嫉恨之心 | `009:嫉恨之心` | 启 | 1 | ✅ | | 选择处理 |
| 10 | 追月神 | shikigami_010 | 明月潮升 | `010:明月潮升` | 触 | 0 | | | 三选一 |
| 11 | 白狼 | shikigami_011 | 冥想 | `011:冥想` | 启 | 1 | | | 弃N张 |
| 12 | 食梦貘 | shikigami_012 | 沉睡·入眠 | `012:入眠` | 启 | 1 | | sleep(1) | |
| 12 | 食梦貘 | shikigami_012 | 沉睡·梦护 | `012:梦护` | 触 | 0 | | sleep | 弃1张 |
| 13 | 鲤鱼精 | shikigami_013 | 泡泡之盾 | `013:泡泡之盾` | 自 | 0 | | | 选择置顶 |
| 14 | 萤草 | shikigami_014 | 生花·播种 | `014:播种` | 启 | 1/弃妖 | | seed | |
| 14 | 萤草 | shikigami_014 | 生花·开花 | `014:开花` | 触 | 0 | | seed | 分配 |
| 14 | 萤草 | shikigami_014 | 生花·护盾 | `014:护盾` | 触 | 0 | | seed | |
| 15 | 独眼小僧 | shikigami_015 | 金刚经 | `015:金刚经` | 永 | 0 | | | |
| 16 | 食发鬼 | shikigami_016 | 真实之颜 | `016:真实之颜` | 启 | 1 | | | 选妖怪×3 |
| 17 | 巫蛊师 | shikigami_017 | 迷魂蛊 | `017:迷魂蛊` | 触 | 1 | ✅ | | 选对手+交换 |
| 18 | 山童 | shikigami_018 | 怪力 | `018:怪力` | 启 | 1 | | | |
| 19 | 丑时之女 | shikigami_019 | 草人·触 | `019:草人触` | 触 | 0 | | | |
| 19 | 丑时之女 | shikigami_019 | 草人·替身 | `019:草人替身` | 启 | 2 | ✅ | | 选手牌+对手 |
| 20 | 三尾狐 | shikigami_020 | 诱惑 | `020:诱惑` | 永 | 0 | | | |
| 21 | 青蛙瓷器 | shikigami_021 | 岭上开花 | `021:岭上开花` | 启 | 1 | | | 骰子 |
| 22 | 铁鼠 | shikigami_022 | 横财护身 | `022:横财护身` | 启 | 2 | ✅ | | 跨玩家弃顶 |
| 23 | 座敷童子 | shikigami_023 | 魂之火 | `023:魂之火` | 启 | 0/弃妖 | | | 选妖怪牌弃 |
| 24 | 山兔 | shikigami_024 | 兔子舞 | `024:兔子舞` | 启 | 1 | | | 弃1张 |

> **skillId 格式**: `{cardId序号}:{技能名}`（如 `001:杀戮`，实际代码用完整 `shikigami_001:杀戮`）

---

## 十二、与现有系统的兼容

### 12.1 cards.json 无需修改

式神的 `skill.effect` 字段保持不变，新引擎通过 `shikigamiId` 映射到 `ShikigamiSkillDef`，不依赖 `skill.effect` 字符串。

### 12.2 TempBuff 向后兼容

新增的 Buff 类型追加到现有 `TempBuffType` 联合类型，不影响已有逻辑。

### 12.3 渐进式迁移

引擎启用后，`GameManager.resolveSkillEffect()` 保留为 fallback：

```typescript
resolveSkillEffect(player, shikigami, state, targetId) {
  // 优先使用新引擎
  const defs = this.skillEngine.getSkillDefs(shikigami.id);
  if (defs.length > 0) {
    // 新引擎处理
    return;
  }
  // fallback: 旧 switch-case（逐步移除）
  switch (shikigami.skill?.effect) { ... }
}
```

---

## 十三、相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 式神卡牌数据 | `策划文档/卡牌数据/式神卡.md` | 24张式神原始效果描述 |
| 游戏规则说明书 | `策划文档/游戏规则说明书.md` | 式神技能类型/获取规则 |
| 卡牌开发流程 | `策划文档/卡牌数据/卡牌开发.md` | TDD流程/pendingChoice规范 |
| 式神文档模板 | `策划文档/卡牌数据/卡牌具体文档/TEMPLATE_shikigami.md` | 单式神文档模板 |
| 现有类型定义 | `shared/types/cards.ts` + `shared/types/game.ts` | ShikigamiCard/ShikigamiState |
| 现有效果引擎 | `shared/game/effects/types.ts` | CardEffectDef/AtomEffect |
| 现有 TempBuff | `shared/game/TempBuff.ts` | TempBuffType/TempBuffManager |

---

## 十四、式神卡牌具体文档索引

### SSR (5种)

| 式神 | 实现状态 | 文档 |
|------|:--------:|------|
| 妖刀姬 | ✅ | [shikigami_001_妖刀姬.md](../../策划文档/卡牌数据/卡牌具体文档/shikigami_001_妖刀姬.md) |
| 大天狗 | ✅ | [shikigami_002_大天狗.md](../../策划文档/卡牌数据/卡牌具体文档/shikigami_002_大天狗.md) |
| 酒吞童子 | ✅ | [shikigami_003_酒吞童子.md](../../策划文档/卡牌数据/卡牌具体文档/shikigami_003_酒吞童子.md) |
| 茨木童子 | ✅ | [shikigami_004_茨木童子.md](../../策划文档/卡牌数据/卡牌具体文档/shikigami_004_茨木童子.md) |
| 花鸟卷 | 📝 | 待创建 |

### SR (7种)

| 式神 | 实现状态 | 🔷 | 文档 |
|------|:--------:|:--:|------|
| 书翁 | ✅ | | 待创建 |
| 百目鬼 | ✅ | ✅ | 待创建 |
| 鬼使白 | ✅ | | 待创建 |
| 般若 | ✅ | | 待创建 |
| 追月神 | 📝 | | 待创建 |
| 白狼 | ✅ | | 待创建 |
| 食梦貘 | 📝 | ✅ | 待创建 |

### R (12种)

| 式神 | 实现状态 | 🔷 | 文档 |
|------|:--------:|:--:|------|
| 鲤鱼精 | 📝 | | 待创建 |
| 萤草 | 📝 | | 待创建 |
| 独眼小僧 | 📝 | ✅ | 待创建 |
| 食发鬼 | 📝 | | 待创建 |
| 巫蛊师 | 📝 | ✅ | 待创建 |
| 山童 | ✅ | | 待创建 |
| 丑时之女 | 📝 | ✅ | 待创建 |
| 三尾狐 | 📝 | | 待创建 |
| 青蛙瓷器 | 📝 | | 待创建 |
| 铁鼠 | 📝 | ✅ | 待创建 |
| 座敷童子 | ✅ | | 待创建 |
| 山兔 | ✅ | | 待创建 |

> **实现状态说明**：✅ 已迁移至新引擎 | 📝 待迁移
> 
> **🔷 标记**：5-6人多人模式专属
