# boss_005_胧车

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_005 |
| **名称** | 胧车 |
| **类型** | boss |
| **阶段** | Ⅱ |
| **生命** | 10 |
| **声誉** | +4 |
| **关键词** | 御魂 |
| **🔷多人专属** | 否 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家展示手牌并超度1张御魂牌。若无法执行则获得1张[恶评]。

### 御魂效果
> 抓牌+1，攻击+3，将任意数量的「游荡妖怪」置入牌库底，并立刻补充相同数量的牌。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家
步骤2: 对每位玩家：
  - 2a: 展示所有手牌
  - 2b: 检查手牌中是否有御魂牌（HP > 0 的卡牌）
  - 2c: 如果有御魂牌：玩家选择1张超度（移入超度区）
  - 2d: 如果无御魂牌：获得1张[恶评]
步骤3: 记录日志
```

**关键判断**:
- **御魂牌**：通常指妖怪类卡牌，即 `cardType === 'yokai'` 或有HP值的卡牌
- **超度**：将卡牌移入超度区（exiled）
- **[恶评]**：惩罚卡牌，从惩罚牌堆获取

### 御魂效果分解

```
步骤1: 抓牌+1（从牌库抽1张牌到手牌）
步骤2: 攻击+3（当前回合伤害累计+3）
步骤3: 可选择将场上「游荡妖怪」置入牌库底
  - 3a: 展示场上的游荡妖怪
  - 3b: 玩家选择0~N张妖怪
  - 3c: 将选择的妖怪置入牌库底
  - 3d: 补充等量的新妖怪到场上
步骤4: 立刻抓取等量的牌
```

**特殊机制**：
- 这是一个**场地操控**效果
- 可以"刷新"不想要的游荡妖怪
- 同时获得额外抓牌

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('胧车 - 来袭效果', () => {
  it('🟢 基础: 有御魂牌，选择超度1张', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'yokai', name: '妖怪A', hp: 3 }),
        createTestCard({ cardType: 'yokai', name: '妖怪B', hp: 5 }),
        createTestCard({ cardType: 'spell', name: '符咒' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 0; // 选择超度第一张
    
    await executeBossArrival('胧车', ctx);
    
    expect(player.hand.length).toBe(2);
    expect(player.exiled.length).toBe(1);
    expect(player.exiled[0].name).toBe('妖怪A');
  });

  it('🟢 无御魂牌: 获得恶评', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'spell', name: '符咒A' }),
        createTestCard({ cardType: 'spell', name: '符咒B' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('胧车', ctx);
    
    expect(player.hand.length).toBe(3); // 原2张+1张恶评
    expect(player.hand.some(c => c.name === '恶评')).toBe(true);
    expect(player.exiled.length).toBe(0);
  });

  it('🟢 手牌为空: 获得恶评', async () => {
    const player = createTestPlayer({ hand: [] });
    const ctx = createTestContext([player]);
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('胧车', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.hand[0].name).toBe('恶评');
  });

  it('🟢 只有1张御魂牌: 必须超度', async () => {
    const player = createTestPlayer({
      hand: [
        createTestCard({ cardType: 'yokai', name: '唯一妖怪', hp: 4 }),
        createTestCard({ cardType: 'spell', name: '符咒' }),
      ]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 0;
    
    await executeBossArrival('胧车', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.exiled.length).toBe(1);
    expect(player.exiled[0].name).toBe('唯一妖怪');
  });

  it('🟢 多玩家: 每位独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      hand: [createTestCard({ cardType: 'yokai', hp: 3 })]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      hand: [createTestCard({ cardType: 'spell' })]
    });
    const ctx = createTestContext([player1, player2]);
    ctx.triggerInteract = async ({ playerId }) => {
      if (playerId === 'p1') return 0;
    };
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('胧车', ctx);
    
    expect(player1.exiled.length).toBe(1);
    expect(player2.hand.some(c => c.name === '恶评')).toBe(true);
  });
});
```

### 御魂效果测试

```typescript
describe('胧车 - 御魂效果', () => {
  it('🟢 基础: 抓牌+1，伤害+3', async () => {
    const player = createTestPlayer({
      deck: [createTestCard(), createTestCard()],
      damage: 0
    });
    const ctx = createTestContext([player]);
    ctx.gameState = {
      field: {
        yokaiSlots: []
      }
    };
    ctx.triggerInteract = async () => []; // 不置换妖怪
    
    await executeBossSoulEffect('胧车', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.damage).toBe(3);
  });

  it('🟢 置换1只游荡妖怪: 抓额外1张牌', async () => {
    const yokai1 = createTestCard({ name: '妖怪A' });
    const yokai2 = createTestCard({ name: '妖怪B' });
    const player = createTestPlayer({
      deck: [createTestCard(), createTestCard(), createTestCard()],
      damage: 0
    });
    const ctx = createTestContext([player]);
    ctx.gameState = {
      field: {
        yokaiSlots: [yokai1, yokai2]
      }
    };
    ctx.triggerInteract = async () => [0]; // 置换第一只
    ctx.replaceYokai = (idx) => {
      // 模拟置换逻辑
    };
    
    await executeBossSoulEffect('胧车', ctx);
    
    // 基础抓1张 + 置换1张 = 2张
    expect(player.hand.length).toBe(2);
    expect(player.damage).toBe(3);
  });

  it('🟢 置换多只游荡妖怪', async () => {
    const player = createTestPlayer({
      deck: [createTestCard(), createTestCard(), createTestCard(), createTestCard()],
      damage: 2
    });
    const ctx = createTestContext([player]);
    ctx.gameState = {
      field: {
        yokaiSlots: [
          createTestCard({ name: '妖怪A' }),
          createTestCard({ name: '妖怪B' }),
          createTestCard({ name: '妖怪C' }),
        ]
      }
    };
    ctx.triggerInteract = async () => [0, 1, 2]; // 置换全部3只
    
    await executeBossSoulEffect('胧车', ctx);
    
    // 基础抓1张 + 置换3张 = 4张
    expect(player.hand.length).toBe(4);
    expect(player.damage).toBe(5);
  });

  it('🟢 选择不置换: 只抓1张', async () => {
    const player = createTestPlayer({
      deck: [createTestCard(), createTestCard()],
      damage: 0
    });
    const ctx = createTestContext([player]);
    ctx.gameState = {
      field: {
        yokaiSlots: [createTestCard({ name: '妖怪A' })]
      }
    };
    ctx.triggerInteract = async () => []; // 不置换
    
    await executeBossSoulEffect('胧车', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.damage).toBe(3);
  });

  it('🟢 场上无游荡妖怪: 只抓1张', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
      damage: 0
    });
    const ctx = createTestContext([player]);
    ctx.gameState = {
      field: {
        yokaiSlots: []
      }
    };
    
    await executeBossSoulEffect('胧车', ctx);
    
    expect(player.hand.length).toBe(1);
    expect(player.damage).toBe(3);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('胧车', async (ctx) => {
  const { players, triggerInteract, getPenaltyCard, addLog } = ctx;
  
  for (const player of players) {
    // 展示手牌
    if (player.hand.length > 0) {
      const handNames = player.hand.map(c => c.name).join('、');
      addLog?.(`👁️ ${player.name} 展示手牌：${handNames}`);
    } else {
      addLog?.(`👁️ ${player.name} 手牌为空`);
    }
    
    // 检查御魂牌（妖怪类卡牌）
    const soulCards = player.hand.filter(c => 
      c.cardType === 'yokai' || c.cardType === 'boss'
    );
    
    if (soulCards.length > 0) {
      // 有御魂牌，选择1张超度
      let selectedIndex = 0;
      
      if (soulCards.length > 1) {
        selectedIndex = await triggerInteract?.({
          type: 'selectCard',
          playerId: player.id,
          cards: soulCards,
          count: 1,
          prompt: '选择1张御魂牌超度'
        }) as number ?? 0;
      }
      
      const cardToExile = soulCards[selectedIndex];
      const handIndex = player.hand.indexOf(cardToExile);
      
      if (handIndex !== -1) {
        player.hand.splice(handIndex, 1);
        player.exiled.push(cardToExile);
        addLog?.(`🔮 ${player.name} 超度 ${cardToExile.name}`);
      }
    } else {
      // 无御魂牌，获得恶评
      const penalty = getPenaltyCard?.();
      if (penalty) {
        player.hand.push(penalty);
        addLog?.(`😈 ${player.name} 无御魂牌可超度，获得[恶评]`);
      }
    }
  }
  
  return { success: true, message: '胧车来袭：展示手牌并超度1张御魂，无则获恶评' };
});

// 御魂效果
registerBossSoul('胧车', async (ctx) => {
  const { player, gameState, triggerInteract, addLog } = ctx;
  
  // 抓牌+1
  if (player.deck.length > 0) {
    const card = player.deck.shift()!;
    player.hand.push(card);
    addLog?.(`🎴 ${player.name} 抓牌+1`);
  }
  
  // 伤害+3
  player.damage += 3;
  addLog?.(`⚔️ ${player.name} 伤害+3 (当前: ${player.damage})`);
  
  // 检查场上游荡妖怪
  const yokaiSlots = gameState?.field?.yokaiSlots || [];
  
  if (yokaiSlots.length > 0) {
    // 选择要置换的妖怪
    const selectedIndices = await triggerInteract?.({
      type: 'selectMultiple',
      playerId: player.id,
      cards: yokaiSlots,
      minCount: 0,
      maxCount: yokaiSlots.length,
      prompt: '选择要置入牌库底的游荡妖怪（可选0~全部）'
    }) as number[] ?? [];
    
    if (selectedIndices.length > 0) {
      // 置换妖怪
      const replacedYokai: CardInstance[] = [];
      
      // 按索引从大到小排序，避免删除时索引错乱
      const sortedIndices = [...selectedIndices].sort((a, b) => b - a);
      
      for (const idx of sortedIndices) {
        const yokai = yokaiSlots[idx];
        if (yokai) {
          // 移除并置入牌库底
          yokaiSlots.splice(idx, 1);
          player.deck.push(yokai); // 置入牌库底
          replacedYokai.push(yokai);
          addLog?.(`📦 ${yokai.name} 置入牌库底`);
        }
      }
      
      // 补充新妖怪（由游戏逻辑处理）
      // fillYokaiSlots() 会在之后调用
      
      // 抓取等量的牌
      const extraDraw = replacedYokai.length;
      for (let i = 0; i < extraDraw; i++) {
        if (player.deck.length > 0) {
          const card = player.deck.shift()!;
          player.hand.push(card);
        }
      }
      
      if (extraDraw > 0) {
        addLog?.(`🎴 ${player.name} 额外抓牌+${extraDraw}`);
      }
    }
  }
  
  return { success: true, message: '御魂效果：抓牌+1，伤害+3，可置换游荡妖怪' };
});
```

---

## 📝 注意事项

### 御魂牌定义
- 在此效果中，**御魂牌**指的是可以作为御魂使用的卡牌
- 通常是妖怪类卡牌（`cardType === 'yokai'`）
- 也可能包括鬼王（`cardType === 'boss'`）

### 游荡妖怪置换
- 这是一个**高级策略**效果
- 可以刷新不想要的场上妖怪
- 同时获得额外抓牌，相当于"过牌"
- 被置换的妖怪进入**牌库底**（不是弃牌堆）

### 阶段Ⅱ开始
- 胧车是阶段Ⅱ的第一个鬼王
- HP=10，与土蜘蛛持平
- 来袭效果惩罚温和（有妖怪就不受恶评）
- 御魂效果有独特的场地操控能力

### 与其他卡牌的联动
- 置换效果可以与"牌库底"相关的卡牌产生联动
- 额外抓牌可能抽到刚被置入牌库底的妖怪（如果牌库很薄）

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
