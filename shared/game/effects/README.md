# 效果系统单元测试规范

## 测试原则

### TDD开发流程

1. **红** - 先写失败的测试（描述期望行为）
2. **绿** - 写最少代码使测试通过
3. **重构** - 优化代码，保持测试通过

```bash
# 开发时监听模式
cd shared && npm run test:watch

# 运行指定卡牌测试
npm test -- "唐纸伞妖"

# 覆盖率报告
npm run test:coverage
```

---

## 测试文件结构

```
shared/game/effects/
├── YokaiEffects.ts          # 妖怪御魂效果实现
├── YokaiEffects.test.ts     # 妖怪御魂效果测试
├── ShikigamiSkills.ts       # 式神技能实现
├── ShikigamiSkills.test.ts  # 式神技能测试
├── BossEffects.ts           # 鬼王效果实现
├── BossEffects.test.ts      # 鬼王效果测试
└── EffectEngine.test.ts     # 核心引擎测试
```

---

## 测试辅助函数

### 创建测试玩家

```typescript
import { PlayerState, GameState, CardInstance } from '../../types';

function createTestPlayer(options: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'test-player',
    name: 'Test',
    ghostFire: options.ghostFire ?? 3,
    maxGhostFire: 5,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    shikigami: [],
    shikigamiState: [],
    damage: 0,
    reputation: 0,
    tempBuffs: [],
    ...options
  };
}
```

### 创建测试游戏状态

```typescript
function createTestGameState(player: PlayerState): GameState {
  return {
    phase: 'action',
    currentPlayerIndex: 0,
    players: [player],
    field: {
      yokaiSlots: [null, null, null, null, null, null],
      bossSlot: null,
      yokaiDeck: [],
      bossDeck: []
    },
    turnNumber: 1,
    log: []
  };
}
```

### 创建测试卡牌

```typescript
function createTestCard(
  type: string = 'yokai', 
  name: string = '测试卡',
  options: Partial<CardInstance> = {}
): CardInstance {
  return {
    instanceId: `${type}_${Date.now()}_${Math.random()}`,
    cardId: `${type}_001`,
    cardType: type as any,
    name,
    hp: options.hp ?? 3,
    maxHp: options.maxHp ?? 3,
    damage: options.damage,
    charm: options.charm,
    effect: options.effect,
    ...options
  };
}
```

---

## 测试命名规范

### describe 分组

- 使用**中文卡牌名**作为顶层 describe
- 使用 emoji 标记测试类型

```typescript
describe('唐纸伞妖', () => {
  describe('🟢 正常流程', () => {
    it('伤害+1，选择超度', async () => { ... });
    it('伤害+1，选择保留', async () => { ... });
  });
  
  describe('🔴 边界条件', () => {
    it('牌库为空时不触发交互', async () => { ... });
  });
  
  describe('🔵 AI决策', () => {
    it('AI会超度低价值牌', () => { ... });
  });
});
```

### 测试用例命名

| 前缀 | 含义 | 示例 |
|------|------|------|
| `🟢` | 正常流程 | `🟢 正常流程: 伤害+1并抓牌` |
| `🔴` | 边界条件 | `🔴 边界条件: 牌库为空` |
| `🟡` | 特殊情况 | `🟡 特殊: 无式神时跳过效果` |
| `🔵` | AI逻辑 | `🔵 AI: 优先超度低HP妖怪` |
| `⚡` | 性能测试 | `⚡ 性能: 批量处理1000张卡` |

---

## 测试模板

### 基础效果测试

```typescript
describe('卡牌名称', () => {
  let player: PlayerState;
  let gameState: GameState;

  beforeEach(() => {
    player = createTestPlayer();
    gameState = createTestGameState(player);
  });

  it('🟢 基本效果：描述', async () => {
    // Arrange - 准备测试数据
    player.deck = [createTestCard()];
    
    // Act - 执行效果
    const result = await executeYokaiEffect('卡牌名称', {
      player,
      gameState,
      card: createTestCard('yokai', '卡牌名称')
    });
    
    // Assert - 验证结果
    expect(result.success).toBe(true);
    expect(player.damage).toBe(1);
  });
});
```

### 交互选择测试

```typescript
it('🟢 选择超度牌库顶牌', async () => {
  player.deck = [createTestCard('yokai', '测试妖怪')];
  
  const result = await executeYokaiEffect('唐纸伞妖', {
    player,
    gameState,
    card: createTestCard('yokai', '唐纸伞妖'),
    // 模拟用户选择：1 = 超度
    onChoice: async (options) => {
      expect(options.prompt).toContain('超度');
      return 1;
    }
  });
  
  expect(result.success).toBe(true);
  expect(player.deck.length).toBe(0);
  expect(player.exiled.length).toBe(1);
});
```

### AI决策测试

```typescript
describe('🔵 AI决策', () => {
  it('唐纸伞妖AI会超度低价值牌', () => {
    const lowValueCard = createTestCard('yokai', '招福达摩', { hp: 1 });
    const decision = aiDecide_唐纸伞妖(lowValueCard);
    expect(decision).toBe(1); // 1 = 超度
  });

  it('唐纸伞妖AI会保留高价值牌', () => {
    const highValueCard = createTestCard('spell', '封印之阵');
    const decision = aiDecide_唐纸伞妖(highValueCard);
    expect(decision).toBe(0); // 0 = 保留
  });
});
```

---

## 断言最佳实践

### 使用精确断言

```typescript
// ✅ 好 - 精确检查
expect(player.damage).toBe(1);
expect(player.hand).toHaveLength(3);
expect(player.exiled[0].name).toBe('唐纸伞妖');

// ❌ 避免 - 模糊检查
expect(player.damage).toBeTruthy();
expect(player.hand.length > 0).toBe(true);
```

### 检查状态变化

```typescript
it('应该正确增加伤害', async () => {
  const initialDamage = player.damage;
  
  await executeYokaiEffect('针女', { player, gameState, card });
  
  expect(player.damage).toBe(initialDamage + 1);
});
```

### 检查数组操作

```typescript
// 检查移动卡牌
expect(player.deck).not.toContain(card);
expect(player.exiled).toContain(card);

// 检查数量变化
expect(player.hand).toHaveLength(previousLength + 2);
```

---

## 覆盖率要求

| 类型 | 最低覆盖率 | 目标覆盖率 |
|------|-----------|-----------|
| 行覆盖 | 80% | 95% |
| 分支覆盖 | 75% | 90% |
| 函数覆盖 | 90% | 100% |

### 运行覆盖率检查

```bash
cd shared && npm run test:coverage
```

---

## 常见测试场景

### 场景1：多人游戏

```typescript
it('多人游戏：影响所有对手', async () => {
  const opponent1 = createTestPlayer({ id: 'opp1' });
  const opponent2 = createTestPlayer({ id: 'opp2' });
  gameState.players = [player, opponent1, opponent2];
  
  await executeYokaiEffect('某妖怪', { player, gameState, card });
  
  expect(opponent1.damage).toBe(1);
  expect(opponent2.damage).toBe(1);
});
```

### 场景2：条件触发

```typescript
it('条件触发：有式神时额外效果', async () => {
  player.shikigami = [{ id: 'shikigami_001', name: '山兔' }];
  
  await executeYokaiEffect('针女', { player, gameState, card });
  
  expect(player.damage).toBe(3); // 基础1 + 式神加成2
});
```

### 场景3：状态叠加

```typescript
it('状态叠加：多个buff生效', async () => {
  player.tempBuffs = [
    { type: 'damageBonus', value: 1, duration: 1 },
    { type: 'damageBonus', value: 2, duration: 1 }
  ];
  
  await executeYokaiEffect('心眼', { player, gameState, card });
  
  expect(player.damage).toBe(6); // 基础3 + buff(1+2)
});
```

---

## 禁止事项

1. ❌ **禁止依赖外部服务** - 测试必须能离线运行
2. ❌ **禁止修改全局状态** - 每个测试应独立
3. ❌ **禁止使用 setTimeout/setInterval** - 使用 vi.useFakeTimers()
4. ❌ **禁止跳过测试提交** - 所有 `it.skip` 必须有注释说明原因
5. ❌ **禁止硬编码随机数** - 使用 seed 或 mock

---

## 调试技巧

### 单独运行失败测试

```bash
# 只运行特定测试
npm test -- -t "唐纸伞妖"

# 运行并显示详细输出
npm test -- --reporter=verbose
```

### 调试模式

```typescript
it('调试测试', async () => {
  console.log('Before:', JSON.stringify(player, null, 2));
  
  const result = await executeYokaiEffect('卡牌', { player, gameState, card });
  
  console.log('After:', JSON.stringify(player, null, 2));
  console.log('Result:', result);
});
```
