# boss_009_八岐大蛇

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_009 |
| **名称** | 八岐大蛇 |
| **类型** | boss |
| **阶段** | Ⅲ |
| **生命** | 14 |
| **声誉** | +5 |
| **关键词** | 御魂 |
| **🔷多人专属** | 否 |
| **特殊机制** | 式神翻面失能 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家按顺序展示手牌，弃掉生命值最高的1张手牌。所有式神翻面失去能力直至大蛇离场。

### 御魂效果
> 鬼火+2，伤害+7。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家（按顺序）
步骤2: 对每位玩家：
  - 2a: 展示所有手牌
  - 2b: 找出HP最高的卡牌
  - 2c: 如果有多张并列最高，玩家选择弃哪张
  - 2d: 弃掉该卡牌
步骤3: 设置全局状态：所有式神翻面失能
  - 3a: 遍历所有玩家的式神
  - 3b: 将式神状态设为"翻面"（disabled）
步骤4: 当八岐大蛇离场时恢复式神能力
```

**关键判断**:
- **HP最高**：找出手牌中HP最大的卡
- **式神翻面**：式神无法使用技能，直到大蛇被击败
- **持续效果**：式神失能持续到大蛇离场

### 御魂效果分解

```
步骤1: 鬼火+2（当前鬼火+2，不超过上限）
步骤2: 伤害+7（当前回合伤害累计+7）
```

**特点**：
- 这是**最高伤害**的御魂效果
- 鬼火+2可以支撑更多操作
- 简单直接，无复杂逻辑

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('八岐大蛇 - 来袭效果', () => {
  it('🟢 基础: 弃掉HP最高的手牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ name: '低HP牌', hp: 3 }),
        createTestCard({ name: '高HP牌', hp: 8 }),
        createTestCard({ name: '中HP牌', hp: 5 }),
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('八岐大蛇', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(1);
    expect(player.discard[0].hp).toBe(8);
  });

  it('🟢 多张并列最高HP: 玩家选择', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ name: '牌A', hp: 7 }),
        createTestCard({ name: '牌B', hp: 7 }),
        createTestCard({ name: '牌C', hp: 3 }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 1; // 选择牌B
    
    await executeBossArrival('八岐大蛇', ctx);
    
    expect(player.discard[0].name).toBe('牌B');
  });

  it('🟢 手牌为空: 无弃牌', async () => {
    const player = createTestPlayer({ hand: [] });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('八岐大蛇', ctx);
    
    expect(player.discard.length).toBe(0);
  });

  it('🟢 式神翻面失能', async () => {
    const player = createTestPlayer({
      hand: [createTestCard({ hp: 5 })],
      shikigamiState: [
        { id: 's1', isActive: true, isDisabled: false },
        { id: 's2', isActive: true, isDisabled: false },
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('八岐大蛇', ctx);
    
    // 所有式神应该被禁用
    expect(player.shikigamiState.every(s => s.isDisabled)).toBe(true);
  });

  it('🟢 多玩家: 每位独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      hand: [createTestCard({ hp: 5 }), createTestCard({ hp: 3 })],
      shikigamiState: [{ id: 's1', isActive: true, isDisabled: false }]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      hand: [createTestCard({ hp: 9 }), createTestCard({ hp: 2 })],
      shikigamiState: [{ id: 's2', isActive: true, isDisabled: false }]
    });
    const ctx = createTestContext([player1, player2]);
    
    await executeBossArrival('八岐大蛇', ctx);
    
    expect(player1.discard[0].hp).toBe(5);
    expect(player2.discard[0].hp).toBe(9);
    expect(player1.shikigamiState[0].isDisabled).toBe(true);
    expect(player2.shikigamiState[0].isDisabled).toBe(true);
  });
});

describe('八岐大蛇 - 离场恢复', () => {
  it('🟢 大蛇被击败: 式神恢复能力', async () => {
    const player = createTestPlayer({
      shikigamiState: [
        { id: 's1', isActive: true, isDisabled: true },
        { id: 's2', isActive: true, isDisabled: true },
      ]
    });
    const ctx = createTestContext([player]);
    ctx.gameState.activeBossEffect = '八岐大蛇';
    
    await executeBossDefeated('八岐大蛇', ctx);
    
    expect(player.shikigamiState.every(s => !s.isDisabled)).toBe(true);
  });
});
```

### 御魂效果测试

```typescript
describe('八岐大蛇 - 御魂效果', () => {
  it('🟢 基础: 鬼火+2，伤害+7', async () => {
    const player = createTestPlayer({
      ghostFire: 2,
      maxGhostFire: 6,
      damage: 0
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('八岐大蛇', ctx);
    
    expect(player.ghostFire).toBe(4);
    expect(player.damage).toBe(7);
  });

  it('🟢 鬼火上限: 不超过maxGhostFire', async () => {
    const player = createTestPlayer({
      ghostFire: 5,
      maxGhostFire: 6,
      damage: 3
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('八岐大蛇', ctx);
    
    expect(player.ghostFire).toBe(6); // 最多+1到上限
    expect(player.damage).toBe(10);
  });

  it('🟢 鬼火已满: 不增加', async () => {
    const player = createTestPlayer({
      ghostFire: 6,
      maxGhostFire: 6,
      damage: 0
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('八岐大蛇', ctx);
    
    expect(player.ghostFire).toBe(6);
    expect(player.damage).toBe(7);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('八岐大蛇', async (ctx) => {
  const { players, triggerInteract, gameState, addLog } = ctx;
  
  // 1. 每位玩家弃掉HP最高的手牌
  for (const player of players) {
    if (player.hand.length === 0) {
      addLog?.(`⚠️ ${player.name} 手牌为空`);
      continue;
    }
    
    // 展示手牌
    const handNames = player.hand.map(c => `${c.name}(HP=${c.hp})`).join('、');
    addLog?.(`👁️ ${player.name} 展示手牌：${handNames}`);
    
    // 找HP最高的
    const maxHp = Math.max(...player.hand.map(c => c.hp));
    const highestHpCards = player.hand.filter(c => c.hp === maxHp);
    
    let cardToDiscard: CardInstance;
    
    if (highestHpCards.length === 1) {
      cardToDiscard = highestHpCards[0];
    } else {
      // 多张并列，玩家选择
      const selectedIdx = await triggerInteract?.({
        type: 'selectCard',
        playerId: player.id,
        cards: highestHpCards,
        count: 1,
        prompt: '选择弃掉哪张HP最高的牌'
      }) as number ?? 0;
      
      cardToDiscard = highestHpCards[selectedIdx];
    }
    
    // 弃牌
    const handIdx = player.hand.indexOf(cardToDiscard);
    if (handIdx !== -1) {
      player.hand.splice(handIdx, 1);
      player.discard.push(cardToDiscard);
      addLog?.(`🗑️ ${player.name} 弃掉 ${cardToDiscard.name} (HP=${cardToDiscard.hp})`);
    }
  }
  
  // 2. 所有式神翻面失能
  for (const player of players) {
    if (player.shikigamiState && player.shikigamiState.length > 0) {
      for (const state of player.shikigamiState) {
        state.isDisabled = true;
      }
      addLog?.(`🔒 ${player.name} 的式神全部翻面失去能力`);
    }
  }
  
  // 设置全局状态
  gameState.activeBossEffect = '八岐大蛇';
  
  addLog?.(`🐍 八岐大蛇来袭！所有式神失能直至大蛇离场`);
  
  return { success: true, message: '八岐大蛇来袭：弃最高HP手牌，式神翻面' };
});

// 大蛇被击败时恢复式神
registerBossDefeatedTrigger('八岐大蛇', async (ctx) => {
  const { players, gameState, addLog } = ctx;
  
  if (gameState.activeBossEffect !== '八岐大蛇') {
    return { triggered: false };
  }
  
  // 恢复所有式神
  for (const player of players) {
    if (player.shikigamiState && player.shikigamiState.length > 0) {
      for (const state of player.shikigamiState) {
        state.isDisabled = false;
      }
      addLog?.(`🔓 ${player.name} 的式神恢复能力`);
    }
  }
  
  gameState.activeBossEffect = null;
  
  return { triggered: true };
});

// 御魂效果
registerBossSoul('八岐大蛇', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 鬼火+2
  const ghostFireGain = Math.min(2, player.maxGhostFire - player.ghostFire);
  if (ghostFireGain > 0) {
    player.ghostFire += ghostFireGain;
    addLog?.(`🔥 ${player.name} 鬼火+${ghostFireGain} (当前: ${player.ghostFire})`);
  }
  
  // 伤害+7
  player.damage += 7;
  addLog?.(`⚔️ ${player.name} 伤害+7 (当前: ${player.damage})`);
  
  return { success: true, message: '御魂效果：鬼火+2，伤害+7' };
});
```

---

## 📝 注意事项

### 阶段Ⅲ倒数第二
- 八岐大蛇是阶段Ⅲ的第二个鬼王
- HP=14，声誉+5
- **最强御魂效果**（伤害+7）

### 式神翻面机制
- 需要在 `ShikigamiState` 中添加 `isDisabled` 字段
- 翻面期间式神技能不可用
- **持续效果**：直到大蛇被击败才恢复

### 弃牌逻辑
- 找HP最高的牌弃掉
- 如果有多张并列，玩家可以选择
- 这是**强制弃牌**，无法避免

### 与其他鬼王的对比
| 鬼王 | 来袭惩罚 | 持续效果 |
|------|---------|---------|
| 地震鲶 | 每回合藏牌 | 击败后释放 |
| 八岐大蛇 | 弃最高HP牌 | 式神失能至击败 |

### 策略影响
- 式神失能对依赖式神技能的玩家影响巨大
- 需要尽快击败大蛇恢复式神
- 御魂效果超强，是优质的收割手段

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
