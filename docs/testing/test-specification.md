# 御魂传说 - 单元测试规范文档

> 建立完善的自动化测试流程，减少手动客户端验证的痛点

---

## 📌 目录

1. [测试体系概览](#1-测试体系概览)
2. [测试文件命名与组织](#2-测试文件命名与组织)
3. [测试用例编写规范](#3-测试用例编写规范)
4. [Mock 与测试工具函数](#4-mock-与测试工具函数)
5. [分层测试策略](#5-分层测试策略)
6. [测试命令与CI集成](#6-测试命令与ci集成)
7. [测试覆盖优先级](#7-测试覆盖优先级)
8. [常见测试模式速查](#8-常见测试模式速查)

---

## 1. 测试体系概览

### 1.1 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 测试框架 | Vitest | ^1.x |
| 断言库 | Vitest 内置 (expect) | - |
| Mock 工具 | Vitest 内置 (vi) | - |
| 覆盖率工具 | c8 / istanbul | - |

### 1.2 测试目录结构

```
Cardgame/
├── shared/
│   ├── data/
│   │   ├── loader.test.ts           # 数据加载测试
│   │   └── cards.consistency.test.ts # 数据一致性测试
│   └── game/
│       ├── DeckManager.test.ts       # 牌库管理测试
│       ├── GameManager.test.ts       # 游戏管理器测试
│       └── effects/
│           ├── YokaiEffects.test.ts  # 妖怪效果测试
│           ├── ShikigamiSkills.test.ts # 式神技能测试
│           ├── BossEffects.test.ts   # 鬼王效果测试
│           ├── EffectEngine.test.ts  # 效果引擎测试
│           └── EffectiveHP.test.ts   # HP系统测试
├── server/
│   └── src/
│       └── game/
│           └── MultiplayerGame.test.ts # 服务端游戏逻辑测试
└── client/
    └── src/
        └── __tests__/                # 客户端测试(待建设)
```

### 1.3 当前覆盖率概况

| 模块 | 状态 | 覆盖用例数 |
|------|:----:|:----------:|
| 效果系统 (YokaiEffects) | ✅ 良好 | 60+ |
| 式神技能 (ShikigamiSkills) | ✅ 良好 | 100+ |
| 数据一致性 | ✅ 良好 | 150+ |
| HP系统 | ✅ 良好 | 28 |
| 牌库管理 | ✅ 良好 | 12 |
| 服务端游戏逻辑 | 🟡 薄弱 | <10 |
| Socket事件 | 🔴 缺失 | 0 |
| AI决策 | 🔴 缺失 | 0 |
| 客户端网络 | 🔴 缺失 | 0 |

---

## 2. 测试文件命名与组织

### 2.1 文件命名规范

```
<被测模块名>.test.ts
```

| 示例 | 说明 |
|------|------|
| `YokaiEffects.test.ts` | 妖怪效果测试 |
| `ShikigamiSkills.test.ts` | 式神技能测试 |
| `MultiplayerGame.test.ts` | 多人游戏逻辑测试 |
| `cards.consistency.test.ts` | 数据一致性测试 |

### 2.2 测试组织结构

```typescript
// 文件级别: 按功能模块分组
describe('YokaiEffects', () => {
  
  // 一级分组: 按卡牌/功能
  describe('唐纸伞妖', () => {
    
    // 二级用例: 具体场景
    it('🟢 正常流程: 伤害+1，选择超度', async () => { ... });
    it('🔴 边界条件: 牌库为空', async () => { ... });
    it('🔄 轮入道兼容: 执行两次', async () => { ... });
  });

  describe('狂骨', () => {
    it('🟢 基础效果: 鬼火3时伤害+3抓1牌', async () => { ... });
    // ...
  });
});
```

### 2.3 用例标题规范

使用 emoji 前缀区分测试类型：

| 前缀 | 含义 | 示例 |
|:----:|------|------|
| 🟢 | 正常流程/Happy Path | `🟢 正常流程: 伤害+1` |
| 🔴 | 边界条件/异常场景 | `🔴 边界条件: 牌库为空` |
| 🔄 | 轮入道兼容性 | `🔄 轮入道: 效果执行两次` |
| ⚡ | 触发条件测试 | `⚡ 触发条件: 妖怪被退治时` |
| 🎯 | 目标选择测试 | `🎯 目标选择: 仅HP≤3的妖怪` |
| 🤖 | AI 决策测试 | `🤖 AI策略: 优先超度恶评` |

---

## 3. 测试用例编写规范

### 3.1 AAA 模式 (Arrange-Act-Assert)

```typescript
it('🟢 树妖: 抓牌+2，弃置1张', async () => {
  // ===== Arrange: 准备测试数据 =====
  const player = createTestPlayer({
    deck: [createTestCard('spell'), createTestCard('spell')],
    hand: [createTestCard('yokai')],
  });
  const ctx = createTestContext(player);
  ctx.triggerInteract = async () => 0; // 选择弃置第一张

  // ===== Act: 执行被测逻辑 =====
  await executeYokaiEffect('树妖', ctx);

  // ===== Assert: 验证结果 =====
  expect(player.hand.length).toBe(2);     // 1原有 + 2抓牌 - 1弃置 = 2
  expect(player.discard.length).toBe(1);  // 弃置了1张
  expect(player.deck.length).toBe(0);     // 牌库被抽空
});
```

### 3.2 测试数据创建

使用标准的工厂函数创建测试数据：

```typescript
// 创建测试玩家
const player = createTestPlayer({
  ghostFire: 3,
  maxGhostFire: 5,
  damage: 0,
  hand: [createTestCard('yokai', '河童')],
  deck: [createTestCard('spell')],
  discard: [],
  exiled: [],
});

// 创建测试卡牌
const card = createTestCard('yokai', '狂骨', {
  hp: 5,
  damage: 1,
  effect: '...',
});

// 创建测试上下文
const ctx = createTestContext(player, {
  gameState: createTestGameState(),
  card: targetCard,
});
```

### 3.3 异步效果测试

所有涉及交互的效果都是异步的：

```typescript
it('🟢 带交互的效果', async () => {
  const ctx = createTestContext(player);
  
  // Mock 玩家选择
  ctx.triggerInteract = async (interaction) => {
    if (interaction.type === 'salvageChoice') {
      return 1; // 选择超度
    }
    return 0;
  };

  // 使用 await 执行效果
  await executeYokaiEffect('唐纸伞妖', ctx);

  expect(player.exiled.length).toBe(1);
});
```

### 3.4 边界条件必测清单

每张卡牌至少覆盖以下边界条件：

| 边界类型 | 测试场景 |
|----------|----------|
| 空牌库 | `player.deck = []` |
| 空手牌 | `player.hand = []` |
| 满手牌 | `player.hand.length = 10` |
| 鬼火为0 | `player.ghostFire = 0` |
| 鬼火满 | `player.ghostFire = maxGhostFire` |
| 无合法目标 | 场上无妖怪/无满足条件的妖怪 |
| 轮入道执行两次 | 验证效果叠加正确 |

---

## 4. Mock 与测试工具函数

### 4.1 标准 Mock 函数

```typescript
// shared/game/effects/__tests__/testUtils.ts

/** 创建测试玩家 */
export function createTestPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'player-1',
    name: 'TestPlayer',
    ghostFire: 3,
    maxGhostFire: 5,
    damage: 0,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    shikigami: [],
    shikigamiState: [],
    reputation: 0,
    tempBuffs: [],
    ...overrides,
  };
}

/** 创建测试卡牌 */
export function createTestCard(
  type: CardType = 'yokai',
  name: string = 'TestCard',
  overrides: Partial<CardInstance> = {}
): CardInstance {
  return {
    instanceId: `inst-${Math.random().toString(36).slice(2)}`,
    cardId: `${type}_test`,
    cardType: type,
    name,
    hp: 5,
    maxHp: 5,
    ...overrides,
  };
}

/** 创建测试上下文 */
export function createTestContext(
  player: PlayerState,
  overrides: Partial<EffectContext> = {}
): EffectContext {
  return {
    player,
    gameState: createTestGameState(),
    card: undefined,
    triggerInteract: async () => 0,
    addLog: () => {},
    ...overrides,
  };
}

/** 创建测试游戏状态 */
export function createTestGameState(): GameState {
  return {
    players: [],
    field: { yokaiSlots: [], bossSlot: null },
    currentPlayerIndex: 0,
    turnPhase: 'action',
    turnNumber: 1,
    logs: [],
  };
}
```

### 4.2 交互 Mock 模式

```typescript
// 固定返回值
ctx.triggerInteract = async () => 1;

// 根据交互类型返回不同值
ctx.triggerInteract = async (interaction) => {
  switch (interaction.type) {
    case 'salvageChoice': return 1;      // 超度
    case 'treeDemonDiscard': return 0;   // 弃置第一张
    case 'yokaiTarget': return 0;        // 选择第一个目标
    default: return 0;
  }
};

// 记录交互调用次数
let interactCount = 0;
ctx.triggerInteract = async () => {
  interactCount++;
  return 0;
};
// 验证
expect(interactCount).toBe(2);
```

---

## 5. 分层测试策略

### 5.1 测试金字塔

```
           ╱╲
          ╱  ╲     E2E 测试 (手动/未来自动化)
         ╱────╲    - 完整游戏流程
        ╱      ╲   - 多人对战场景
       ╱────────╲
      ╱  集成测试  ╲ Integration Tests
     ╱──────────────╲ - Socket 事件流
    ╱                ╲ - 服务端状态同步
   ╱    单元测试      ╲ Unit Tests (当前重点)
  ╱────────────────────╲ - 效果逻辑
 ╱                      ╲ - 状态变更
╱────────────────────────╲ - 数据一致性
```

### 5.2 单元测试 (Unit Tests)

**目标**: 验证最小逻辑单元的正确性

**覆盖范围**:
- 卡牌效果 (YokaiEffects, ShikigamiSkills, BossEffects)
- 状态管理 (DeckManager, GameManager)
- 数据验证 (cards.json 一致性)
- HP 计算 (EffectiveHP)

**特点**:
- 无外部依赖 (无网络、无数据库)
- 执行快速 (毫秒级)
- Mock 所有交互

### 5.3 集成测试 (Integration Tests)

**目标**: 验证模块间协作的正确性

**覆盖范围**:
- 服务端游戏流程 (MultiplayerGame)
- Socket 事件处理
- 状态同步

**特点**:
- 可能需要 Mock Socket
- 验证完整的请求-响应链
- 关注状态一致性

### 5.4 E2E 测试 (End-to-End)

**目标**: 验证真实用户场景

**当前状态**: 手动测试为主

**未来方向**:
- Playwright/Cypress 自动化
- 视觉回归测试

---

## 6. 测试命令与 CI 集成

### 6.1 常用命令

```bash
# === 运行测试 ===

# 运行所有测试
cd shared && npm test

# 运行指定文件
cd shared && npm test -- YokaiEffects

# 运行指定用例（按名称过滤）
cd shared && npm test -- -t "狂骨"

# 监听模式（开发时使用）
cd shared && npm run test:watch

# 生成覆盖率报告
cd shared && npm run test:coverage


# === 服务端测试 ===

cd server && npm test
cd server && npm test -- MultiplayerGame
```

### 6.2 Vitest 配置

```typescript
// shared/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', '**/*.test.ts'],
    },
    // 超时设置（处理异步效果）
    testTimeout: 5000,
  },
});
```

### 6.3 CI 集成示例

```yaml
# .github/workflows/test.yml
name: Unit Tests

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd shared && npm ci
          cd ../server && npm ci
      
      - name: Run shared tests
        run: cd shared && npm test
      
      - name: Run server tests
        run: cd server && npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 7. 测试覆盖优先级

### 7.1 P0 - 必须覆盖

| 模块 | 要求 |
|------|------|
| 所有卡牌效果 | 正常流程 + 边界条件 + 轮入道兼容 |
| 式神技能 | 触发条件 + 效果执行 + 冷却机制 |
| 数据一致性 | cards.json 与文档匹配 |
| HP 计算 | 各种加减护盾场景 |

### 7.2 P1 - 应该覆盖

| 模块 | 要求 |
|------|------|
| 服务端游戏流程 | 回合流转、状态广播 |
| 交互响应链 | pendingChoice 完整流程 |
| AI 决策 | 主要决策点正确性 |

### 7.3 P2 - 逐步完善

| 模块 | 要求 |
|------|------|
| Socket 事件 | 连接/断线/重连 |
| 客户端网络 | 请求-响应匹配 |
| 房间管理 | 创建/加入/离开 |

---

## 8. 常见测试模式速查

### 8.1 妖怪效果测试模板

```typescript
describe('新妖怪名', () => {
  let player: PlayerState;
  let ctx: EffectContext;

  beforeEach(() => {
    player = createTestPlayer();
    ctx = createTestContext(player);
  });

  it('🟢 正常流程: 描述效果', async () => {
    // Arrange
    player.ghostFire = 3;
    player.deck = [createTestCard('spell')];
    
    // Act
    await executeYokaiEffect('新妖怪名', ctx);
    
    // Assert
    expect(player.damage).toBe(1);
    expect(player.hand.length).toBe(1);
  });

  it('🔴 边界条件: 牌库为空', async () => {
    player.deck = [];
    await executeYokaiEffect('新妖怪名', ctx);
    expect(player.deck.length).toBe(0);
  });

  it('🔄 轮入道兼容: 效果执行两次', async () => {
    player.damage = 0;
    
    await executeYokaiEffect('新妖怪名', ctx);
    expect(player.damage).toBe(1);
    
    await executeYokaiEffect('新妖怪名', ctx);
    expect(player.damage).toBe(2);
  });
});
```

### 8.2 式神技能测试模板

```typescript
describe('式神技能: 技能名', () => {
  it('⚡ 触发条件: 当XX时触发', async () => {
    const ctx = createSkillContext({
      trigger: 'onYokaiDefeated',
      targetYokai: createTestCard('yokai', 'HP5妖怪', { hp: 5 }),
    });
    
    const result = await executeSkill('技能名', ctx);
    
    expect(result.triggered).toBe(true);
    expect(ctx.player.reputation).toBeGreaterThan(0);
  });

  it('🔴 不触发: 条件不满足时', async () => {
    const ctx = createSkillContext({
      trigger: 'onYokaiDefeated',
      targetYokai: createTestCard('yokai', 'HP3妖怪', { hp: 3 }),
    });
    
    const result = await executeSkill('技能名', ctx);
    
    expect(result.triggered).toBe(false);
  });
});
```

### 8.3 数据一致性测试模板

```typescript
describe('cards.json 数据一致性', () => {
  const cards = loadCards();

  it('所有卡牌ID唯一', () => {
    const ids = cards.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('所有妖怪有HP和伤害值', () => {
    const yokai = cards.filter(c => c.type === 'yokai');
    yokai.forEach(y => {
      expect(y.hp).toBeDefined();
      expect(y.damage).toBeDefined();
    });
  });

  it('所有效果描述非空', () => {
    cards.forEach(c => {
      if (c.effect) {
        expect(c.effect.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
```

---

## 📚 附录

### A. 相关文档

- [卡牌开发流程规范](../../策划文档/卡牌数据/卡牌开发.md)
- [妖怪技术框架](../design/yokai-framework.md)
- [式神技术框架](../design/shikigami-framework.md)
- [Bug历史记录](../design/testset.md)

### B. 测试工具函数源码

位置: `shared/game/effects/__tests__/testUtils.ts`

### C. 更新日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2024-XX-XX | v1.0 | 初始版本 |

---

> **文档维护者**: AI Assistant  
> **最后更新**: 自动生成
