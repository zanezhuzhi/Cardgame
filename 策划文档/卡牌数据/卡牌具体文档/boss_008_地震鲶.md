# boss_008_地震鲶

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_008 |
| **名称** | 地震鲶 |
| **类型** | boss |
| **阶段** | Ⅲ |
| **生命** | 13 |
| **声誉** | +5 |
| **关键词** | 御魂/妨害 |
| **🔷多人专属** | 否 |
| **特殊机制** | 阴阳师下藏牌 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家在清理阶段补充完手牌后，随机将一张手牌背面朝上放置于各自的阴阳师下。当此鬼王被击败后将阴阳师下的所有卡牌弃置。

### 与全局回合结构（已定稿）

- 牌面「每位玩家」指：**每名玩家各自在自己回合的清理阶段**各结算一次，**不是**同一次清理阶段内全员同时藏牌。
- **触发条件**：场上当前鬼王为地震鲶（存活）期间。
- **时机**：该玩家清理阶段中，**从牌库抽满 5 张当次手牌之后**；仅对**正在进行清理的该玩家**随机藏 **1** 张至阴阳师下；其他玩家在轮到其清理阶段时再各藏 1 张。
- 与翻下一只鬼王的清理阶段关系见技术备忘：`docs/superpowers/specs/2026-03-30-boss-zone-state-machine.md` §3。

### 御魂效果
> 所有对手玩家将手牌数弃至3张，你可以获得其中生命值最高的御魂卡并将其置入手牌。（同为最高则你可以选择）

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 设置全局状态：地震鲶存活期间的特殊规则（实现可用 field.currentBoss + 标志位）
步骤2: 每「一名玩家」进入自己回合的清理阶段，且已补充完当次 5 张手牌后：
  - 2a: 仅对该玩家，从手牌中随机选择 1 张牌
  - 2b: 将该牌背面朝上置于该玩家阴阳师下（如 cardsUnderOnmyoji）
步骤3: 当地震鲶被击败时：
  - 3a: 遍历所有玩家
  - 3b: 将阴阳师下的所有卡牌规则弃置到各自弃牌堆
```

**关键判断**:
- **持续效果**：地震鲶存活期间，**每名玩家每个自己的清理阶段**执行步骤 2 一次（非全员同一清理阶段批量执行）
- **随机选择**：系统随机，玩家不能选择
- **背面朝上**：其他玩家不知道藏了什么牌
- **击败后释放**：地震鲶被击败后，所有藏牌弃置

### 御魂效果分解

```
步骤1: 获取所有对手列表
步骤2: 每位对手弃牌至3张：
  - 2a: 如果手牌>3张，对手选择弃掉多余的牌
  - 2b: 这些弃牌暂存，等待使用者选择
步骤3: 从所有弃掉的牌中筛选御魂卡（妖怪/鬼王）
步骤4: 找出HP最高的御魂卡：
  - 4a: 如果只有1张最高HP，自动获取
  - 4b: 如果有多张并列最高，使用者选择1张
步骤5: 将选择的御魂卡置入使用者手牌
步骤6: 其余弃牌进入各自玩家的弃牌堆
```

**特殊机制**：
- 这是一个**强力的妨害+收益**效果
- 可以从对手弃牌中**偷取**御魂
- 对手被迫弃掉高价值牌

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('地震鲶 - 来袭效果', () => {
  it('🟢 设置持续状态: 清理阶段藏牌规则', async () => {
    const ctx = createTestContext([]);
    
    await executeBossArrival('地震鲶', ctx);
    
    // 应该设置全局状态
    expect(ctx.gameState.activeBossEffect).toBe('地震鲶');
  });

  it('🟢 清理阶段: 随机藏1张手牌', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ name: '牌A' }),
        createTestCard({ name: '牌B' }),
        createTestCard({ name: '牌C' }),
      ],
      hiddenCards: []
    });
    const ctx = createTestContext([player]);
    ctx.gameState.activeBossEffect = '地震鲶';
    
    await executeCleanupPhaseEnd(player, ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.hiddenCards.length).toBe(1);
  });

  it('🟢 手牌为空: 无法藏牌', async () => {
    const player = createTestPlayer({
      hand: [],
      hiddenCards: []
    });
    const ctx = createTestContext([player]);
    ctx.gameState.activeBossEffect = '地震鲶';
    
    await executeCleanupPhaseEnd(player, ctx);
    
    expect(player.hiddenCards.length).toBe(0);
  });

  it('🟢 地震鲶被击败: 释放藏牌', async () => {
    const player = createTestPlayer({
      hiddenCards: [
        createTestCard({ name: '藏牌A' }),
        createTestCard({ name: '藏牌B' }),
      ],
      discard: []
    });
    const ctx = createTestContext([player]);
    
    await executeBossDefeated('地震鲶', ctx);
    
    expect(player.hiddenCards.length).toBe(0);
    expect(player.discard.length).toBe(2);
  });

  it('🟢 多玩家: 每位独立藏牌', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      hand: [createTestCard(), createTestCard()],
      hiddenCards: []
    });
    const player2 = createTestPlayer({
      id: 'p2',
      hand: [createTestCard(), createTestCard(), createTestCard()],
      hiddenCards: []
    });
    const ctx = createTestContext([player1, player2]);
    ctx.gameState.activeBossEffect = '地震鲶';
    
    await executeCleanupPhaseEnd(player1, ctx);
    await executeCleanupPhaseEnd(player2, ctx);
    
    expect(player1.hiddenCards.length).toBe(1);
    expect(player2.hiddenCards.length).toBe(1);
  });
});
```

### 御魂效果测试

```typescript
describe('地震鲶 - 御魂效果', () => {
  it('🟢 基础: 对手弃至3张，获取最高HP御魂', async () => {
    const user = createTestPlayer({ id: 'user' });
    const opponent = createTestPlayer({
      id: 'opp',
      hand: [
        createTestCard({ cardType: 'yokai', hp: 5, name: '低HP妖怪' }),
        createTestCard({ cardType: 'yokai', hp: 8, name: '高HP妖怪' }),
        createTestCard({ cardType: 'spell', hp: 0, name: '符咒' }),
        createTestCard({ cardType: 'yokai', hp: 3, name: '更低HP妖怪' }),
        createTestCard({ cardType: 'yokai', hp: 6, name: '中HP妖怪' }),
      ]
    });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'discardToThree') return [1, 3]; // 弃高HP和更低HP
    };
    
    await executeBossSoulEffect('地震鲶', ctx);
    
    expect(opponent.hand.length).toBe(3);
    // 用户应该获得HP最高的御魂（hp=8）
    expect(user.hand.length).toBe(1);
    expect(user.hand[0].hp).toBe(8);
  });

  it('🟢 对手手牌<=3张: 无需弃牌', async () => {
    const user = createTestPlayer({ id: 'user' });
    const opponent = createTestPlayer({
      id: 'opp',
      hand: [
        createTestCard({ cardType: 'yokai', hp: 5 }),
        createTestCard({ cardType: 'yokai', hp: 3 }),
      ]
    });
    const ctx = createTestContext([user, opponent]);
    
    await executeBossSoulEffect('地震鲶', ctx);
    
    expect(opponent.hand.length).toBe(2);
    expect(user.hand.length).toBe(0);
  });

  it('🟢 弃牌中无御魂: 不获取任何牌', async () => {
    const user = createTestPlayer({ id: 'user' });
    const opponent = createTestPlayer({
      id: 'opp',
      hand: [
        createTestCard({ cardType: 'spell', hp: 0 }),
        createTestCard({ cardType: 'spell', hp: 0 }),
        createTestCard({ cardType: 'spell', hp: 0 }),
        createTestCard({ cardType: 'spell', hp: 0 }),
      ]
    });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async () => [0]; // 弃1张
    
    await executeBossSoulEffect('地震鲶', ctx);
    
    expect(opponent.hand.length).toBe(3);
    expect(user.hand.length).toBe(0);
  });

  it('🟢 多张并列最高HP: 使用者选择', async () => {
    const user = createTestPlayer({ id: 'user' });
    const opponent = createTestPlayer({
      id: 'opp',
      hand: [
        createTestCard({ cardType: 'yokai', hp: 7, name: '妖怪A' }),
        createTestCard({ cardType: 'yokai', hp: 7, name: '妖怪B' }),
        createTestCard({ cardType: 'spell', hp: 0, name: '符咒' }),
        createTestCard({ cardType: 'yokai', hp: 3, name: '低HP妖怪' }),
      ]
    });
    const ctx = createTestContext([user, opponent]);
    ctx.triggerInteract = async ({ type }) => {
      if (type === 'discardToThree') return [0]; // 弃妖怪A
      if (type === 'selectCard') return 0; // 选择第一张
    };
    
    await executeBossSoulEffect('地震鲶', ctx);
    
    expect(user.hand.length).toBe(1);
  });

  it('🟢 多对手: 从所有弃牌中选最高HP', async () => {
    const user = createTestPlayer({ id: 'user' });
    const opp1 = createTestPlayer({
      id: 'opp1',
      hand: [
        createTestCard({ cardType: 'yokai', hp: 5 }),
        createTestCard({ cardType: 'yokai', hp: 6 }),
        createTestCard({ cardType: 'yokai', hp: 4 }),
        createTestCard({ cardType: 'yokai', hp: 3 }),
      ]
    });
    const opp2 = createTestPlayer({
      id: 'opp2',
      hand: [
        createTestCard({ cardType: 'yokai', hp: 9 }),
        createTestCard({ cardType: 'yokai', hp: 2 }),
        createTestCard({ cardType: 'yokai', hp: 1 }),
        createTestCard({ cardType: 'yokai', hp: 7 }),
      ]
    });
    const ctx = createTestContext([user, opp1, opp2]);
    ctx.triggerInteract = async ({ playerId }) => {
      return [0]; // 都弃第一张
    };
    
    await executeBossSoulEffect('地震鲶', ctx);
    
    // 应该获得HP=9的那张（来自opp2）
    expect(user.hand.length).toBe(1);
    expect(user.hand[0].hp).toBe(9);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('地震鲶', async (ctx) => {
  const { gameState, addLog } = ctx;
  
  // 设置持续效果状态
  gameState.activeBossEffect = '地震鲶';
  
  addLog?.(`🐟 地震鲶来袭！每位玩家清理阶段后需藏1张手牌于阴阳师下`);
  
  return { success: true, message: '地震鲶来袭：开始藏牌规则' };
});

// 清理阶段结束时的藏牌逻辑
registerCleanupEndTrigger('地震鲶', async (ctx) => {
  const { player, gameState, addLog } = ctx;
  
  if (gameState.activeBossEffect !== '地震鲶') {
    return { triggered: false };
  }
  
  if (player.hand.length === 0) {
    addLog?.(`⚠️ ${player.name} 手牌为空，无法藏牌`);
    return { triggered: false };
  }
  
  // 随机选择1张
  const randomIdx = Math.floor(Math.random() * player.hand.length);
  const hiddenCard = player.hand.splice(randomIdx, 1)[0];
  
  // 放入阴阳师下
  player.hiddenCards = player.hiddenCards || [];
  player.hiddenCards.push(hiddenCard);
  
  addLog?.(`🙈 ${player.name} 将1张手牌藏于阴阳师下`);
  
  return { triggered: true };
});

// 地震鲶被击败时释放藏牌
registerBossDefeatedTrigger('地震鲶', async (ctx) => {
  const { players, addLog } = ctx;
  
  for (const player of players) {
    if (player.hiddenCards && player.hiddenCards.length > 0) {
      const count = player.hiddenCards.length;
      player.discard.push(...player.hiddenCards);
      player.hiddenCards = [];
      addLog?.(`📤 ${player.name} 阴阳师下的${count}张牌被弃置`);
    }
  }
  
  return { triggered: true };
});

// 御魂效果
registerBossSoul('地震鲶', async (ctx) => {
  const { player, players, triggerInteract, addLog } = ctx;
  
  const opponents = players.filter(p => p.id !== player.id);
  const allDiscardedSouls: { card: CardInstance; fromPlayer: PlayerState }[] = [];
  
  // 每位对手弃至3张
  for (const opponent of opponents) {
    const excessCount = opponent.hand.length - 3;
    
    if (excessCount <= 0) {
      addLog?.(`✅ ${opponent.name} 手牌不超过3张，无需弃牌`);
      continue;
    }
    
    // 对手选择弃哪些牌
    const indices = await triggerInteract?.({
      type: 'discardToThree',
      playerId: opponent.id,
      cards: opponent.hand,
      count: excessCount,
      prompt: `选择弃掉${excessCount}张手牌（保留3张）`
    }) as number[] ?? [];
    
    // 收集弃牌
    const sortedIndices = [...indices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      const card = opponent.hand.splice(idx, 1)[0];
      
      // 如果是御魂卡，暂存
      if (card.cardType === 'yokai' || card.cardType === 'boss') {
        allDiscardedSouls.push({ card, fromPlayer: opponent });
      } else {
        opponent.discard.push(card);
      }
      
      addLog?.(`🗑️ ${opponent.name} 弃掉 ${card.name}`);
    }
  }
  
  // 从所有弃掉的御魂中找最高HP
  if (allDiscardedSouls.length === 0) {
    addLog?.(`⚠️ 无御魂卡可获取`);
    // 将暂存的非御魂卡也放回弃牌堆（已经处理）
    return { success: true, message: '御魂效果：无御魂可获取' };
  }
  
  // 找最高HP
  const maxHp = Math.max(...allDiscardedSouls.map(s => s.card.hp));
  const highestHpSouls = allDiscardedSouls.filter(s => s.card.hp === maxHp);
  
  let selectedSoul: { card: CardInstance; fromPlayer: PlayerState };
  
  if (highestHpSouls.length === 1) {
    selectedSoul = highestHpSouls[0];
  } else {
    // 多张并列，使用者选择
    const selectedIdx = await triggerInteract?.({
      type: 'selectCard',
      playerId: player.id,
      cards: highestHpSouls.map(s => s.card),
      count: 1,
      prompt: '选择1张御魂卡获取'
    }) as number ?? 0;
    
    selectedSoul = highestHpSouls[selectedIdx];
  }
  
  // 获取选择的御魂
  player.hand.push(selectedSoul.card);
  addLog?.(`🎁 ${player.name} 获得 ${selectedSoul.card.name} (HP=${selectedSoul.card.hp})`);
  
  // 其余御魂放回各自弃牌堆
  for (const soul of allDiscardedSouls) {
    if (soul !== selectedSoul) {
      soul.fromPlayer.discard.push(soul.card);
    }
  }
  
  return { success: true, message: '御魂效果：对手弃至3张，获取最高HP御魂' };
});
```

---

## 📝 注意事项

### 阶段Ⅲ开始
- 地震鲶是阶段Ⅲ的第一个鬼王
- HP=13，声誉+5
- 具有复杂的**持续效果**机制

### 阴阳师下藏牌
- 需要在 `PlayerState` 中添加 `hiddenCards` 字段
- 藏牌是**背面朝上**的，其他玩家不可见
- 每个清理阶段都会触发（直到地震鲶被击败）

### 御魂效果的强度
- **强制弃牌**至3张是非常强的妨害
- **偷取御魂**进一步增加了效果价值
- 在多人游戏中效果更强

### 实现复杂度
- 需要注册**清理阶段结束触发器**
- 需要注册**鬼王被击败触发器**
- 需要管理**全局状态**（activeBossEffect）

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
