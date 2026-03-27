# boss_004_土蜘蛛

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_004 |
| **名称** | 土蜘蛛 |
| **类型** | boss |
| **阶段** | Ⅰ |
| **生命** | 10 |
| **声誉** | +4 |
| **关键词** | 御魂 |
| **🔷多人专属** | 否 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家需要从手牌中展示3张阴阳术，否则每缺1张则弃1张手牌。

### 御魂效果
> 抓牌+2，伤害+3。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家
步骤2: 对每位玩家：
  - 2a: 检查手牌中的阴阳术数量
  - 2b: 如果阴阳术 >= 3张，展示3张阴阳术（玩家可选择展示哪3张）
  - 2c: 如果阴阳术 < 3张，计算缺少数量 = 3 - 阴阳术数量
  - 2d: 弃掉等于缺少数量的手牌（由玩家选择弃哪些）
步骤3: 记录日志
```

**关键判断**:
- **阴阳术**：cardType === 'spell' 的卡牌
- 阴阳术共有3种：初级符咒、中级符咒、高级符咒
- 玩家需要**选择**展示哪些阴阳术（如果超过3张）
- 玩家需要**选择**弃掉哪些手牌（如果不足3张阴阳术）

### 御魂效果分解

```
步骤1: 抓牌+2（从牌库抽2张牌到手牌）
步骤2: 伤害+3（当前回合伤害累计+3）
```

**实现简单**：这是一个标准的数值增益效果，无特殊逻辑。

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('土蜘蛛 - 来袭效果', () => {
  it('🟢 基础: 有3张阴阳术，展示后无惩罚', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'spell', name: '初级符咒' }),
        createTestCard({ cardType: 'spell', name: '中级符咒' }),
        createTestCard({ cardType: 'spell', name: '高级符咒' }),
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => [0, 1, 2]; // 展示前3张
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(4); // 无弃牌
    expect(player.discard.length).toBe(0);
  });

  it('🟢 缺少1张: 弃1张手牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'spell', name: '初级符咒' }),
        createTestCard({ cardType: 'spell', name: '中级符咒' }),
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
        createTestCard({ cardType: 'yokai', name: '妖怪B' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'revealSpells') return [0, 1]; // 展示2张阴阳术
      if (type === 'discardCards') return [2]; // 弃妖怪A
    };
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(3);
    expect(player.discard.length).toBe(1);
  });

  it('🟢 缺少2张: 弃2张手牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'spell', name: '初级符咒' }),
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
        createTestCard({ cardType: 'yokai', name: '妖怪B' }),
        createTestCard({ cardType: 'yokai', name: '妖怪C' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'revealSpells') return [0];
      if (type === 'discardCards') return [1, 2]; // 弃妖怪A和B
    };
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(2);
  });

  it('🟢 无阴阳术: 弃3张手牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
        createTestCard({ cardType: 'yokai', name: '妖怪B' }),
        createTestCard({ cardType: 'yokai', name: '妖怪C' }),
        createTestCard({ cardType: 'yokai', name: '妖怪D' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'discardCards') return [0, 1, 2]; // 弃前3张
    };
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.discard.length).toBe(3);
  });

  it('🟢 边界: 手牌不足以弃够', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'discardCards') return [0]; // 只能弃1张
    };
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(0);
    expect(player.discard.length).toBe(1);
    // 需要弃3张但只有1张，弃完所有手牌
  });

  it('🟢 边界: 手牌为空', async () => {
    const player = createTestPlayer({ hand: [] });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(0);
    expect(player.discard.length).toBe(0);
    // 无牌可弃
  });

  it('🟢 超过3张阴阳术: 玩家选择展示哪3张', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'spell', name: '初级符咒1' }),
        createTestCard({ cardType: 'spell', name: '初级符咒2' }),
        createTestCard({ cardType: 'spell', name: '中级符咒' }),
        createTestCard({ cardType: 'spell', name: '高级符咒' }),
        createTestCard({ cardType: 'yokai', name: '妖怪A' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => [0, 2, 3]; // 选择展示3张
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(5); // 无弃牌
    expect(player.discard.length).toBe(0);
  });

  it('🟢 多玩家: 每位玩家独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      hand: [
        createTestCard({ cardType: 'spell' }),
        createTestCard({ cardType: 'spell' }),
        createTestCard({ cardType: 'spell' }),
      ]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      hand: [
        createTestCard({ cardType: 'yokai' }),
        createTestCard({ cardType: 'yokai' }),
      ]
    });
    const ctx = createTestContext([player1, player2]);
    ctx.triggerInteract = async ({ playerId, type }) => {
      if (playerId === 'p1') return [0, 1, 2];
      if (playerId === 'p2' && type === 'discardCards') return [0, 1];
    };
    
    await executeBossArrival('土蜘蛛', ctx);
    
    expect(player1.hand.length).toBe(3); // 无惩罚
    expect(player2.hand.length).toBe(0); // 弃2张（缺3张但只有2张）
    expect(player2.discard.length).toBe(2);
  });
});
```

### 御魂效果测试

```typescript
describe('土蜘蛛 - 御魂效果', () => {
  it('🟢 基础: 抓牌+2，伤害+3', async () => {
    const player = createTestPlayer({
      deck: [createTestCard(), createTestCard(), createTestCard()],
      damage: 0
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.deck.length).toBe(1);
    expect(player.damage).toBe(3);
  });

  it('🟢 边界: 牌库不足2张', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
      damage: 5
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.deck.length).toBe(0);
    expect(player.damage).toBe(8);
  });

  it('🟢 边界: 牌库为空', async () => {
    const player = createTestPlayer({
      deck: [],
      damage: 2
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('土蜘蛛', ctx);
    
    expect(player.hand.length).toBe(0);
    expect(player.damage).toBe(5);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('土蜘蛛', async (ctx) => {
  const { players, triggerInteract, addLog } = ctx;
  
  for (const player of players) {
    // 统计手牌中的阴阳术
    const spells = player.hand.filter(c => c.cardType === 'spell');
    const spellCount = spells.length;
    
    addLog?.(`🔍 ${player.name} 手牌中有${spellCount}张阴阳术`);
    
    if (spellCount >= 3) {
      // 足够3张，展示3张
      if (spellCount > 3) {
        // 超过3张，需要选择展示哪3张
        const indices = await triggerInteract?.({
          type: 'revealSpells',
          playerId: player.id,
          cards: spells,
          count: 3,
          prompt: '选择展示3张阴阳术'
        }) as number[] | undefined;
        
        const revealedNames = indices 
          ? indices.map(i => spells[i].name).join('、')
          : spells.slice(0, 3).map(c => c.name).join('、');
        addLog?.(`📜 ${player.name} 展示阴阳术：${revealedNames}`);
      } else {
        // 刚好3张，全部展示
        const names = spells.map(c => c.name).join('、');
        addLog?.(`📜 ${player.name} 展示阴阳术：${names}`);
      }
    } else {
      // 不足3张，展示所有阴阳术并弃牌
      if (spellCount > 0) {
        const names = spells.map(c => c.name).join('、');
        addLog?.(`📜 ${player.name} 展示阴阳术：${names}`);
      }
      
      const shortage = 3 - spellCount;
      const nonSpellCards = player.hand.filter(c => c.cardType !== 'spell');
      const discardCount = Math.min(shortage, nonSpellCards.length + spellCount - spellCount);
      // 实际可弃数量 = min(缺少数, 手牌总数 - 阴阳术数)
      const actualDiscardCount = Math.min(shortage, player.hand.length - spellCount);
      
      if (actualDiscardCount > 0) {
        // 需要弃牌
        const discardableCards = player.hand.filter(c => c.cardType !== 'spell');
        
        if (actualDiscardCount >= discardableCards.length) {
          // 弃掉所有非阴阳术
          for (const card of discardableCards) {
            const idx = player.hand.indexOf(card);
            if (idx !== -1) {
              player.hand.splice(idx, 1);
              player.discard.push(card);
              addLog?.(`🗑️ ${player.name} 弃掉 ${card.name}`);
            }
          }
        } else {
          // 玩家选择弃哪些牌
          const indices = await triggerInteract?.({
            type: 'discardCards',
            playerId: player.id,
            cards: discardableCards,
            count: actualDiscardCount,
            prompt: `选择弃掉${actualDiscardCount}张手牌`
          }) as number[] | undefined;
          
          const toDiscard = indices 
            ? indices.map(i => discardableCards[i])
            : discardableCards.slice(0, actualDiscardCount);
          
          for (const card of toDiscard) {
            const idx = player.hand.indexOf(card);
            if (idx !== -1) {
              player.hand.splice(idx, 1);
              player.discard.push(card);
              addLog?.(`🗑️ ${player.name} 弃掉 ${card.name}`);
            }
          }
        }
      } else if (shortage > 0 && player.hand.length === 0) {
        addLog?.(`⚠️ ${player.name} 手牌为空，无法弃牌`);
      }
      
      addLog?.(`💢 ${player.name} 阴阳术不足，缺${shortage}张`);
    }
  }
  
  return { success: true, message: '土蜘蛛来袭：检查阴阳术，不足则弃牌' };
});

// 御魂效果
registerBossSoul('土蜘蛛', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 抓牌+2
  let drawnCount = 0;
  for (let i = 0; i < 2; i++) {
    if (player.deck.length > 0) {
      const card = player.deck.shift()!;
      player.hand.push(card);
      drawnCount++;
    }
  }
  if (drawnCount > 0) {
    addLog?.(`🎴 ${player.name} 抓牌+${drawnCount}`);
  }
  
  // 伤害+3
  player.damage += 3;
  addLog?.(`⚔️ ${player.name} 伤害+3 (当前: ${player.damage})`);
  
  return { success: true, message: '御魂效果：抓牌+2，伤害+3' };
});
```

---

## 📝 注意事项

### 阴阳术识别
- **阴阳术** = `cardType === 'spell'`
- 包括：初级符咒、中级符咒、高级符咒
- 不包括其他类型的卡牌（妖怪、御魂、鬼王等）

### 弃牌选择
- 当阴阳术不足时，玩家需要**选择**弃哪些牌
- 不能弃掉阴阳术（已经用于展示了）
- 如果手牌全是阴阳术，则无需弃牌（按已有的阴阳术计算）

### 边界情况
- 手牌为空：无法展示也无法弃牌
- 阴阳术刚好3张：全部展示，无惩罚
- 阴阳术超过3张：玩家可选择展示哪3张
- 手牌不足以弃够：弃掉所有可弃的牌

### 阶段Ⅰ的平衡性
- 土蜘蛛是阶段Ⅰ中HP最高的鬼王（10HP）
- 声誉+4也是阶段Ⅰ最高
- 来袭效果惩罚相对温和（有阴阳术的玩家不受影响）
- 御魂效果收益优秀（抓牌+2，伤害+3）

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
