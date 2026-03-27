# boss_006_蜃气楼

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_006 |
| **名称** | 蜃气楼 |
| **类型** | boss |
| **阶段** | Ⅱ |
| **生命** | 11 |
| **声誉** | +4 |
| **关键词** | 御魂 |
| **🔷多人专属** | 否 |
| **特殊被动** | 【自】回合开始回收 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家将手牌生命高于6的卡牌弃置。

### 御魂效果
> 抓牌+1，鬼火+1，伤害+1。
> **【自】**：你的回合开始时，如果此牌在弃牌堆中，则将其置入手牌。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家
步骤2: 对每位玩家：
  - 2a: 检查手牌中所有卡牌的HP
  - 2b: 筛选出 HP > 6 的卡牌
  - 2c: 将这些卡牌弃置到弃牌堆
步骤3: 记录日志
```

**关键判断**:
- HP 判断条件是 `hp > 6`，即 HP=7,8,9... 的卡牌会被弃置
- HP=6 及以下的卡牌不受影响
- 这是**强制弃牌**，玩家无法选择保留

### 御魂效果分解

```
步骤1: 抓牌+1（从牌库抽1张牌到手牌）
步骤2: 鬼火+1（当前鬼火+1，不超过上限）
步骤3: 伤害+1（当前回合伤害累计+1）
```

### 【自】被动效果分解

```
触发时机: 玩家回合开始时（鬼火阶段之前）
检查条件: 此牌是否在弃牌堆中
执行效果: 将此牌从弃牌堆移入手牌
```

**特殊机制**：
- 这是一个**持续被动**效果
- 只要玩家拥有这张卡，每回合开始都会检查
- 相当于"不死"的御魂牌

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('蜃气楼 - 来袭效果', () => {
  it('🟢 基础: 弃置HP>6的卡牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ name: '妖怪A', hp: 7 }),  // 弃
        createTestCard({ name: '妖怪B', hp: 5 }),  // 保留
        createTestCard({ name: '妖怪C', hp: 8 }),  // 弃
        createTestCard({ name: '符咒', hp: 0 }),   // 保留
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(2);
    expect(player.discard.every(c => c.hp > 6)).toBe(true);
  });

  it('🟢 边界: HP=6不弃置', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ name: '妖怪A', hp: 6 }),
        createTestCard({ name: '妖怪B', hp: 6 }),
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(0);
  });

  it('🟢 全部弃置: 所有卡牌HP>6', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ hp: 7 }),
        createTestCard({ hp: 8 }),
        createTestCard({ hp: 9 }),
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(0);
    expect(player.discard.length).toBe(3);
  });

  it('🟢 无影响: 所有卡牌HP<=6', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ hp: 3 }),
        createTestCard({ hp: 5 }),
        createTestCard({ hp: 6 }),
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(3);
    expect(player.discard.length).toBe(0);
  });

  it('🟢 手牌为空', async () => {
    const player = createTestPlayer({ hand: [] });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(0);
    expect(player.discard.length).toBe(0);
  });

  it('🟢 多玩家: 每位独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      hand: [createTestCard({ hp: 7 }), createTestCard({ hp: 3 })]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      hand: [createTestCard({ hp: 5 }), createTestCard({ hp: 8 })]
    });
    const ctx = createTestContext([player1, player2]);
    
    await executeBossArrival('蜃气楼', ctx);
    
    expect(player1.hand.length).toBe(1);
    expect(player1.discard.length).toBe(1);
    expect(player2.hand.length).toBe(1);
    expect(player2.discard.length).toBe(1);
  });
});
```

### 御魂效果测试

```typescript
describe('蜃气楼 - 御魂效果', () => {
  it('🟢 基础: 抓牌+1，鬼火+1，伤害+1', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
      ghostFire: 2,
      maxGhostFire: 5,
      damage: 0
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('蜃气楼', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.ghostFire).toBe(3);
    expect(player.damage).toBe(1);
  });

  it('🟢 鬼火上限: 不超过maxGhostFire', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
      ghostFire: 5,
      maxGhostFire: 5,
      damage: 0
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('蜃气楼', ctx);
    
    expect(player.ghostFire).toBe(5); // 不超过上限
    expect(player.damage).toBe(1);
  });
});

describe('蜃气楼 - 【自】被动效果', () => {
  it('🟢 回合开始: 从弃牌堆回收到手牌', async () => {
    const shenqilou = createTestCard({ 
      cardId: 'boss_006', 
      name: '蜃气楼' 
    });
    const player = createTestPlayer({
      discard: [shenqilou, createTestCard({ name: '其他牌' })]
    });
    
    await executeTurnStartTriggers(player);
    
    expect(player.hand.length).toBe(1);
    expect(player.hand[0].name).toBe('蜃气楼');
    expect(player.discard.length).toBe(1);
  });

  it('🟢 不在弃牌堆: 无效果', async () => {
    const shenqilou = createTestCard({ 
      cardId: 'boss_006', 
      name: '蜃气楼' 
    });
    const player = createTestPlayer({
      hand: [shenqilou],
      discard: [createTestCard({ name: '其他牌' })]
    });
    
    await executeTurnStartTriggers(player);
    
    expect(player.hand.length).toBe(1);
    expect(player.discard.length).toBe(1);
  });

  it('🟢 在牌库中: 无效果', async () => {
    const shenqilou = createTestCard({ 
      cardId: 'boss_006', 
      name: '蜃气楼' 
    });
    const player = createTestPlayer({
      deck: [shenqilou],
      discard: []
    });
    
    await executeTurnStartTriggers(player);
    
    expect(player.hand.length).toBe(0);
    expect(player.deck.length).toBe(1);
  });

  it('🟢 多个【自】效果: 按顺序执行', async () => {
    const shenqilou = createTestCard({ 
      cardId: 'boss_006', 
      name: '蜃气楼' 
    });
    const araguludeng = createTestCard({ 
      cardId: 'boss_007', 
      name: '荒骷髅' 
    });
    const player = createTestPlayer({
      discard: [shenqilou, araguludeng]
    });
    
    await executeTurnStartTriggers(player);
    
    // 两张都应该回收
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(0);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('蜃气楼', async (ctx) => {
  const { players, addLog } = ctx;
  
  for (const player of players) {
    // 筛选HP>6的卡牌
    const toDiscard = player.hand.filter(c => c.hp > 6);
    
    if (toDiscard.length === 0) {
      addLog?.(`✅ ${player.name} 无HP>6的卡牌`);
      continue;
    }
    
    // 弃置
    for (const card of toDiscard) {
      const idx = player.hand.indexOf(card);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.discard.push(card);
        addLog?.(`🗑️ ${player.name} 弃置 ${card.name} (HP=${card.hp})`);
      }
    }
  }
  
  return { success: true, message: '蜃气楼来袭：弃置手牌中HP>6的卡牌' };
});

// 御魂效果
registerBossSoul('蜃气楼', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 抓牌+1
  if (player.deck.length > 0) {
    const card = player.deck.shift()!;
    player.hand.push(card);
    addLog?.(`🎴 ${player.name} 抓牌+1`);
  }
  
  // 鬼火+1
  if (player.ghostFire < player.maxGhostFire) {
    player.ghostFire += 1;
    addLog?.(`🔥 ${player.name} 鬼火+1 (当前: ${player.ghostFire})`);
  }
  
  // 伤害+1
  player.damage += 1;
  addLog?.(`⚔️ ${player.name} 伤害+1 (当前: ${player.damage})`);
  
  return { success: true, message: '御魂效果：抓牌+1，鬼火+1，伤害+1' };
});

// 【自】回合开始回收
registerTurnStartTrigger('蜃气楼', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 检查弃牌堆中是否有蜃气楼
  const idx = player.discard.findIndex(c => c.cardId === 'boss_006');
  
  if (idx !== -1) {
    const card = player.discard.splice(idx, 1)[0];
    player.hand.push(card);
    addLog?.(`🔄 ${player.name} 回合开始，蜃气楼从弃牌堆回到手牌`);
    return { triggered: true };
  }
  
  return { triggered: false };
});
```

---

## 📝 注意事项

### 【自】被动效果实现
- 需要在游戏引擎中注册**回合开始触发器**
- 触发时机：玩家回合开始时，鬼火阶段之前
- 需要检查玩家的**弃牌堆**中是否有此卡
- 如果在超度区则**不会**触发

### 与鬼灵歌伎的区别
- 鬼灵歌伎来袭：弃置**牌库顶**5张中HP>6的牌
- 蜃气楼来袭：弃置**手牌**中HP>6的牌
- 两者都是强制弃牌，但影响范围不同

### 策略价值
- 御魂效果数值不高（各+1），但有**回收**能力
- 可以每回合打出，持续提供稳定收益
- 适合需要稳定输出的策略

### 同类【自】效果鬼王
- **蜃气楼**（boss_006）：回合开始回收
- **荒骷髅**（boss_007）：回合开始回收
- **贪嗔痴**（boss_010）：回合开始回收

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
