# boss_003_鬼灵歌伎

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_003 |
| **名称** | 鬼灵歌伎 |
| **类型** | boss |
| **阶段** | Ⅰ |
| **生命** | 9 |
| **声誉** | +3 |
| **关键词** | 御魂/妨害 |
| **🔷多人专属** | 是（5人以上游戏） |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家展示牌库顶5张牌，将所有生命>6以上的卡牌弃置，其他以任意顺序放回牌库顶。

### 御魂效果
> 所有对手选择：随机弃掉1张手牌，或你抓牌+1。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家
步骤2: 对每位玩家：
  - 2a: 展示牌库顶5张牌（不足5张则展示全部）
  - 2b: 识别其中所有 HP > 6 的卡牌
  - 2c: 将 HP > 6 的卡牌弃置到弃牌堆
  - 2d: 剩余卡牌需要玩家选择顺序放回牌库顶（交互）
步骤3: 记录日志
```

**关键判断**:
- HP 判断条件是 `hp > 6`，即 HP=7,8,9... 的卡牌会被弃置
- HP=6 及以下的卡牌不受影响
- 放回顺序需要玩家交互选择（多人游戏中每位玩家各自选择）

### 御魂效果分解

```
步骤1: 获取所有对手列表
步骤2: 每位对手做出选择：
  - 选项A: 随机弃掉1张手牌
  - 选项B: 让你（使用者）抓牌+1
步骤3: 统计选择B的对手数量
步骤4: 使用者抓取相应数量的牌
步骤5: 选择A的对手随机弃牌
```

**AI决策逻辑**:
```typescript
function aiDecide_鬼灵歌伎御魂(opponent: PlayerState): 'discard' | 'draw' {
  // 如果手牌只有1张或更少，让对手抓牌更划算
  if (opponent.hand.length <= 1) {
    return 'draw';
  }
  // 如果手牌中有高价值牌（HP>7），倾向于保护
  const highValueCards = opponent.hand.filter(c => c.hp > 7);
  if (highValueCards.length > 0) {
    return 'draw';
  }
  // 默认选择弃牌
  return 'discard';
}
```

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('鬼灵歌伎 - 来袭效果', () => {
  it('🟢 基础: 展示5张，弃HP>6的牌', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ hp: 5 }),  // 保留
        createTestCard({ hp: 7 }),  // 弃置
        createTestCard({ hp: 3 }),  // 保留
        createTestCard({ hp: 8 }),  // 弃置
        createTestCard({ hp: 6 }),  // 保留 (=6不弃)
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => [0, 2, 4]; // 顺序：hp5, hp3, hp6
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player.deck.length).toBe(3);
    expect(player.discard.length).toBe(2);
    expect(player.discard.every(c => c.hp > 6)).toBe(true);
  });

  it('🟢 边界: 牌库不足5张', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ hp: 7 }),  // 弃置
        createTestCard({ hp: 4 }),  // 保留
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => [1]; // 只有hp4需要放回
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player.deck.length).toBe(1);
    expect(player.discard.length).toBe(1);
  });

  it('🟢 边界: 牌库为空', async () => {
    const player = createTestPlayer({ deck: [] });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player.deck.length).toBe(0);
    expect(player.discard.length).toBe(0);
  });

  it('🟢 全部保留: 5张都<=6', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ hp: 6 }),
        createTestCard({ hp: 5 }),
        createTestCard({ hp: 4 }),
        createTestCard({ hp: 3 }),
        createTestCard({ hp: 2 }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => [0, 1, 2, 3, 4];
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player.deck.length).toBe(5);
    expect(player.discard.length).toBe(0);
  });

  it('🟢 全部弃置: 5张都>6', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ hp: 7 }),
        createTestCard({ hp: 8 }),
        createTestCard({ hp: 9 }),
        createTestCard({ hp: 10 }),
        createTestCard({ hp: 11 }),
        createTestCard({ hp: 2 }), // 第6张，不参与
      ]
    });
    const ctx = createTestContext([player]);
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player.deck.length).toBe(1); // 只剩第6张
    expect(player.discard.length).toBe(5);
  });

  it('🟢 多玩家: 每位玩家独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      deck: [createTestCard({ hp: 7 }), createTestCard({ hp: 3 })]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      deck: [createTestCard({ hp: 5 }), createTestCard({ hp: 8 })]
    });
    const ctx = createTestContext([player1, player2]);
    ctx.triggerInteract = async ({ playerId }) => {
      return playerId === 'p1' ? [1] : [0];
    };
    
    await executeBossArrival('鬼灵歌伎', ctx);
    
    expect(player1.discard.length).toBe(1); // hp7被弃
    expect(player2.discard.length).toBe(1); // hp8被弃
  });
});
```

### 御魂效果测试

```typescript
describe('鬼灵歌伎 - 御魂效果', () => {
  it('🟢 对手选择弃牌', async () => {
    const user = createTestPlayer({ id: 'user', deck: [createTestCard()] });
    const opponent = createTestPlayer({ 
      id: 'opp', 
      hand: [createTestCard(), createTestCard()] 
    });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async () => 'discard';
    
    await executeBossSoulEffect('鬼灵歌伎', ctx);
    
    expect(opponent.hand.length).toBe(1);
    expect(opponent.discard.length).toBe(1);
    expect(user.hand.length).toBe(0); // 没有抓牌
  });

  it('🟢 对手选择让你抓牌', async () => {
    const user = createTestPlayer({ 
      id: 'user', 
      deck: [createTestCard(), createTestCard()] 
    });
    const opponent = createTestPlayer({ 
      id: 'opp', 
      hand: [createTestCard()] 
    });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async () => 'draw';
    
    await executeBossSoulEffect('鬼灵歌伎', ctx);
    
    expect(user.hand.length).toBe(1);
    expect(opponent.hand.length).toBe(1);
    expect(opponent.discard.length).toBe(0);
  });

  it('🟢 多对手混合选择', async () => {
    const user = createTestPlayer({ 
      id: 'user', 
      deck: [createTestCard(), createTestCard(), createTestCard()] 
    });
    const opp1 = createTestPlayer({ 
      id: 'opp1', 
      hand: [createTestCard(), createTestCard()] 
    });
    const opp2 = createTestPlayer({ 
      id: 'opp2', 
      hand: [createTestCard()] 
    });
    const opp3 = createTestPlayer({ 
      id: 'opp3', 
      hand: [createTestCard(), createTestCard(), createTestCard()] 
    });
    
    const ctx = createTestContext([user, opp1, opp2, opp3]);
    ctx.triggerInteract = async ({ playerId }) => {
      if (playerId === 'opp1') return 'discard';
      if (playerId === 'opp2') return 'draw';
      if (playerId === 'opp3') return 'discard';
    };
    
    await executeBossSoulEffect('鬼灵歌伎', ctx);
    
    expect(opp1.hand.length).toBe(1); // 弃1
    expect(opp2.hand.length).toBe(1); // 不变
    expect(opp3.hand.length).toBe(2); // 弃1
    expect(user.hand.length).toBe(1); // opp2选draw，抓1张
  });

  it('🟢 边界: 对手手牌为空选择弃牌', async () => {
    const user = createTestPlayer({ id: 'user', deck: [createTestCard()] });
    const opponent = createTestPlayer({ id: 'opp', hand: [] });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async () => 'discard';
    
    await executeBossSoulEffect('鬼灵歌伎', ctx);
    
    expect(opponent.hand.length).toBe(0);
    expect(opponent.discard.length).toBe(0);
    expect(user.hand.length).toBe(0);
  });

  it('🟢 边界: 没有对手（单人测试场景）', async () => {
    const user = createTestPlayer({ id: 'user' });
    const ctx = createTestContext([user]);
    
    await executeBossSoulEffect('鬼灵歌伎', ctx);
    
    // 无效果，但不应报错
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('鬼灵歌伎', async (ctx) => {
  const { players, triggerInteract, addLog } = ctx;
  
  for (const player of players) {
    // 展示牌库顶5张
    const revealCount = Math.min(5, player.deck.length);
    if (revealCount === 0) {
      addLog?.(`📦 ${player.name} 牌库为空，跳过`);
      continue;
    }
    
    const revealedCards = player.deck.slice(0, revealCount);
    addLog?.(`👁️ ${player.name} 展示牌库顶${revealCount}张`);
    
    // 分离: HP>6弃置，其余保留
    const toDiscard: CardInstance[] = [];
    const toKeep: CardInstance[] = [];
    
    for (const card of revealedCards) {
      if (card.hp > 6) {
        toDiscard.push(card);
      } else {
        toKeep.push(card);
      }
    }
    
    // 弃置HP>6的牌
    for (const card of toDiscard) {
      const idx = player.deck.indexOf(card);
      if (idx !== -1) {
        player.deck.splice(idx, 1);
        player.discard.push(card);
        addLog?.(`🗑️ ${player.name} 弃置 ${card.name} (HP=${card.hp})`);
      }
    }
    
    // 如果有需要保留的牌，询问放回顺序
    if (toKeep.length > 1) {
      // 移除这些牌
      for (const card of toKeep) {
        const idx = player.deck.indexOf(card);
        if (idx !== -1) player.deck.splice(idx, 1);
      }
      
      // 交互选择顺序
      const orderedIndices = await triggerInteract?.({
        type: 'reorderCards',
        playerId: player.id,
        cards: toKeep,
        prompt: '选择放回牌库顶的顺序（第一张在最上面）'
      }) as number[] | undefined;
      
      // 按顺序放回
      const orderedCards = orderedIndices 
        ? orderedIndices.map(i => toKeep[i])
        : toKeep; // 默认原顺序
      
      // 放回牌库顶（逆序插入使第一张在最上面）
      for (let i = orderedCards.length - 1; i >= 0; i--) {
        player.deck.unshift(orderedCards[i]);
      }
      
      addLog?.(`📚 ${player.name} 将${toKeep.length}张牌放回牌库顶`);
    } else if (toKeep.length === 1) {
      // 只有1张，直接放回顶部
      const card = toKeep[0];
      const idx = player.deck.indexOf(card);
      if (idx !== -1) {
        player.deck.splice(idx, 1);
      }
      player.deck.unshift(card);
      addLog?.(`📚 ${player.name} 将 ${card.name} 放回牌库顶`);
    }
  }
  
  return { success: true, message: '鬼灵歌伎来袭：展示牌库顶5张，弃置HP>6的牌' };
});

// 御魂效果
registerBossSoul('鬼灵歌伎', async (ctx) => {
  const { player, players, triggerInteract, addLog } = ctx;
  
  const opponents = players.filter(p => p.id !== player.id);
  let drawCount = 0;
  
  for (const opponent of opponents) {
    // 对手选择
    const choice = await triggerInteract?.({
      type: 'binaryChoice',
      playerId: opponent.id,
      prompt: '选择：随机弃掉1张手牌，或让对手抓牌+1',
      options: ['弃牌', '让对手抓牌']
    }) as string | undefined;
    
    if (choice === '让对手抓牌' || choice === 'draw') {
      drawCount++;
      addLog?.(`🎁 ${opponent.name} 选择让 ${player.name} 抓牌+1`);
    } else {
      // 随机弃牌
      if (opponent.hand.length > 0) {
        const randomIdx = Math.floor(Math.random() * opponent.hand.length);
        const discarded = opponent.hand.splice(randomIdx, 1)[0];
        opponent.discard.push(discarded);
        addLog?.(`🗑️ ${opponent.name} 随机弃掉 ${discarded.name}`);
      } else {
        addLog?.(`⚠️ ${opponent.name} 手牌为空，无法弃牌`);
      }
    }
  }
  
  // 使用者抓牌
  if (drawCount > 0) {
    for (let i = 0; i < drawCount; i++) {
      if (player.deck.length > 0) {
        const card = player.deck.shift()!;
        player.hand.push(card);
      }
    }
    addLog?.(`🎴 ${player.name} 抓牌+${drawCount}`);
  }
  
  return { success: true, message: `御魂效果：${drawCount}位对手选择让你抓牌` };
});
```

---

## 📝 注意事项

### 多人游戏专属
- 此鬼王仅在 **5人以上游戏** 中出现
- 初始化鬼王牌堆时需检查玩家人数，人数<5则排除此卡

### 来袭效果交互
- **重排顺序交互**：玩家需要选择保留卡牌放回牌库顶的顺序
- 这是一个**复杂交互**，需要设计专门的 UI 组件
- AI玩家默认按原顺序放回

### 御魂效果特殊性
- 这是一个**妨害型**御魂效果
- 对手的选择会影响使用者的收益
- **随机弃牌**：不是对手选择弃哪张，而是系统随机选择

### 与其他卡牌的联动
- 此效果触发的弃牌会进入弃牌堆，可能触发其他"弃牌触发"效果
- 来袭效果弃置的高HP牌可能包含御魂牌，影响后续战略

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
