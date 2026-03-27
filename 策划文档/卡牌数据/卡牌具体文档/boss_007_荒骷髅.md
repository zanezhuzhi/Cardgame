# boss_007_荒骷髅

> **文档版本**: v1.0.0  
> **最后更新**: 2024-01-XX  
> **开发状态**: 待实现

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_007 |
| **名称** | 荒骷髅 |
| **类型** | boss |
| **阶段** | Ⅱ |
| **生命** | 12 |
| **声誉** | +4 |
| **关键词** | 御魂 |
| **🔷多人专属** | 是（5人以上游戏） |
| **特殊被动** | 【自】回合开始回收 |

---

## 🎯 效果描述

### 来袭效果
> 每位玩家将整个牌库弃置，从弃牌区中超度1张生命高于7的御魂卡，并获得1张[恶评]。然后重洗牌库。

### 御魂效果
> 抓牌+1。本回合中你可以将所有卡视作「中级符咒」来使用。
> **【自】**：你的回合开始时，如果此牌在弃牌堆中，则将其置入手牌。

---

## 🔧 效果分解

### 来袭效果分解

```
步骤1: 遍历所有玩家
步骤2: 对每位玩家：
  - 2a: 将整个牌库弃置到弃牌堆
  - 2b: 从弃牌堆中筛选 HP > 7 的御魂卡
  - 2c: 如果有符合条件的卡，玩家选择1张超度
  - 2d: 获得1张[恶评]
  - 2e: 将弃牌堆洗入牌库（重洗）
步骤3: 记录日志
```

**关键判断**:
- **整个牌库弃置**：这是毁灭性的效果
- **HP > 7**：即 HP=8,9,10... 的卡牌才需要超度
- **御魂卡**：指妖怪类卡牌（`cardType === 'yokai' || cardType === 'boss'`）
- **必定获得恶评**：无论是否超度都会获得恶评
- **重洗牌库**：弃牌堆洗入牌库

### 御魂效果分解

```
步骤1: 抓牌+1（从牌库抽1张牌到手牌）
步骤2: 设置临时状态：本回合所有卡视作「中级符咒」
```

**特殊机制**：
- **卡牌变形**：这是一个复杂的状态效果
- 所有手牌在本回合内可以当作「中级符咒」打出
- 「中级符咒」的效果需要查询卡牌数据

### 【自】被动效果分解

```
触发时机: 玩家回合开始时（鬼火阶段之前）
检查条件: 此牌是否在弃牌堆中
执行效果: 将此牌从弃牌堆移入手牌
```

---

## 🧪 TDD 测试用例

### 来袭效果测试

```typescript
describe('荒骷髅 - 来袭效果', () => {
  it('🟢 基础: 牌库弃置，超度HP>7御魂，获恶评，重洗', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ cardType: 'yokai', hp: 8, name: '高HP妖怪' }),
        createTestCard({ cardType: 'yokai', hp: 5, name: '低HP妖怪' }),
        createTestCard({ cardType: 'spell', hp: 0, name: '符咒' }),
      ],
      discard: []
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 0; // 选择超度第一张HP>7的
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('荒骷髅', ctx);
    
    // 牌库应该重洗（不为空）
    expect(player.deck.length).toBeGreaterThan(0);
    // 超度了1张HP>7的御魂
    expect(player.exiled.length).toBe(1);
    expect(player.exiled[0].hp).toBeGreaterThan(7);
    // 获得了恶评
    expect(player.hand.some(c => c.name === '恶评')).toBe(true);
  });

  it('🟢 无HP>7御魂: 只获恶评并重洗', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ cardType: 'yokai', hp: 5 }),
        createTestCard({ cardType: 'yokai', hp: 7 }), // =7不算
        createTestCard({ cardType: 'spell', hp: 0 }),
      ],
      discard: []
    });
    const ctx = createTestContext([player]);
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('荒骷髅', ctx);
    
    expect(player.exiled.length).toBe(0);
    expect(player.hand.some(c => c.name === '恶评')).toBe(true);
    expect(player.deck.length).toBeGreaterThan(0);
  });

  it('🟢 牌库为空: 只获恶评', async () => {
    const player = createTestPlayer({
      deck: [],
      discard: [createTestCard({ cardType: 'yokai', hp: 8 })]
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 0;
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('荒骷髅', ctx);
    
    // 弃牌堆中的HP>7御魂也会被超度
    expect(player.exiled.length).toBe(1);
    expect(player.hand.some(c => c.name === '恶评')).toBe(true);
  });

  it('🟢 多张HP>7御魂: 玩家选择超度哪张', async () => {
    const player = createTestPlayer({
      deck: [
        createTestCard({ cardType: 'yokai', hp: 9, name: '妖怪A' }),
        createTestCard({ cardType: 'yokai', hp: 10, name: '妖怪B' }),
        createTestCard({ cardType: 'yokai', hp: 8, name: '妖怪C' }),
      ],
      discard: []
    });
    const ctx = createTestContext([player]);
    ctx.triggerInteract = async () => 1; // 选择第二张
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('荒骷髅', ctx);
    
    expect(player.exiled.length).toBe(1);
    expect(player.exiled[0].name).toBe('妖怪B');
  });

  it('🟢 多玩家: 每位独立处理', async () => {
    const player1 = createTestPlayer({
      id: 'p1',
      deck: [createTestCard({ cardType: 'yokai', hp: 9 })]
    });
    const player2 = createTestPlayer({
      id: 'p2',
      deck: [createTestCard({ cardType: 'yokai', hp: 5 })]
    });
    const ctx = createTestContext([player1, player2]);
    ctx.triggerInteract = async ({ playerId }) => 0;
    ctx.getPenaltyCard = () => createTestCard({ 
      cardType: 'penalty', 
      name: '恶评' 
    });
    
    await executeBossArrival('荒骷髅', ctx);
    
    expect(player1.exiled.length).toBe(1);
    expect(player2.exiled.length).toBe(0);
    expect(player1.hand.some(c => c.name === '恶评')).toBe(true);
    expect(player2.hand.some(c => c.name === '恶评')).toBe(true);
  });
});
```

### 御魂效果测试

```typescript
describe('荒骷髅 - 御魂效果', () => {
  it('🟢 基础: 抓牌+1', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('荒骷髅', ctx);
    
    expect(player.hand.length).toBe(1);
  });

  it('🟢 设置临时状态: 卡视作中级符咒', async () => {
    const player = createTestPlayer({
      deck: [createTestCard()],
      tempBuffs: []
    });
    const ctx = createTestContext([player]);
    
    await executeBossSoulEffect('荒骷髅', ctx);
    
    // 应该添加临时buff
    expect(player.tempBuffs.some(b => 
      b.type === 'cardTransform' && b.target === 'midSpell'
    )).toBe(true);
  });
});

describe('荒骷髅 - 【自】被动效果', () => {
  it('🟢 回合开始: 从弃牌堆回收到手牌', async () => {
    const huangkulou = createTestCard({ 
      cardId: 'boss_007', 
      name: '荒骷髅' 
    });
    const player = createTestPlayer({
      discard: [huangkulou, createTestCard({ name: '其他牌' })]
    });
    
    await executeTurnStartTriggers(player);
    
    expect(player.hand.length).toBe(1);
    expect(player.hand[0].name).toBe('荒骷髅');
    expect(player.discard.length).toBe(1);
  });

  it('🟢 不在弃牌堆: 无效果', async () => {
    const huangkulou = createTestCard({ 
      cardId: 'boss_007', 
      name: '荒骷髅' 
    });
    const player = createTestPlayer({
      hand: [huangkulou],
      discard: []
    });
    
    await executeTurnStartTriggers(player);
    
    expect(player.hand.length).toBe(1);
  });
});
```

### 卡牌变形效果测试

```typescript
describe('荒骷髅 - 卡牌变形效果', () => {
  it('🟢 任意卡可作为中级符咒打出', async () => {
    const player = createTestPlayer({
      hand: [createTestCard({ cardType: 'yokai', name: '普通妖怪' })],
      tempBuffs: [{ type: 'cardTransform', target: 'midSpell', duration: 1 }]
    });
    
    const canPlayAsSpell = checkCardTransform(player, player.hand[0]);
    
    expect(canPlayAsSpell).toBe(true);
  });

  it('🟢 回合结束后效果消失', async () => {
    const player = createTestPlayer({
      tempBuffs: [{ type: 'cardTransform', target: 'midSpell', duration: 1 }]
    });
    
    await endTurn(player);
    
    expect(player.tempBuffs.length).toBe(0);
  });
});
```

---

## 💻 实现代码

### BossEffects.ts

```typescript
// 来袭效果
registerBossArrival('荒骷髅', async (ctx) => {
  const { players, triggerInteract, getPenaltyCard, addLog } = ctx;
  
  for (const player of players) {
    // 1. 牌库全部弃置
    const deckCards = [...player.deck];
    player.discard.push(...deckCards);
    player.deck = [];
    addLog?.(`💥 ${player.name} 牌库全部弃置 (${deckCards.length}张)`);
    
    // 2. 从弃牌堆筛选HP>7的御魂卡
    const highHpSouls = player.discard.filter(c => 
      (c.cardType === 'yokai' || c.cardType === 'boss') && c.hp > 7
    );
    
    if (highHpSouls.length > 0) {
      // 选择超度1张
      let selectedIndex = 0;
      
      if (highHpSouls.length > 1) {
        selectedIndex = await triggerInteract?.({
          type: 'selectCard',
          playerId: player.id,
          cards: highHpSouls,
          count: 1,
          prompt: '选择1张HP>7的御魂牌超度'
        }) as number ?? 0;
      }
      
      const cardToExile = highHpSouls[selectedIndex];
      const discardIndex = player.discard.indexOf(cardToExile);
      
      if (discardIndex !== -1) {
        player.discard.splice(discardIndex, 1);
        player.exiled.push(cardToExile);
        addLog?.(`🔮 ${player.name} 超度 ${cardToExile.name} (HP=${cardToExile.hp})`);
      }
    } else {
      addLog?.(`⚠️ ${player.name} 弃牌堆中无HP>7的御魂牌`);
    }
    
    // 3. 获得恶评
    const penalty = getPenaltyCard?.();
    if (penalty) {
      player.hand.push(penalty);
      addLog?.(`😈 ${player.name} 获得[恶评]`);
    }
    
    // 4. 重洗牌库
    const cardsToShuffle = [...player.discard];
    player.discard = [];
    player.deck = shuffleArray(cardsToShuffle);
    addLog?.(`🔄 ${player.name} 重洗牌库 (${player.deck.length}张)`);
  }
  
  return { success: true, message: '荒骷髅来袭：牌库全弃，超度HP>7御魂，获恶评，重洗' };
});

// 御魂效果
registerBossSoul('荒骷髅', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 抓牌+1
  if (player.deck.length > 0) {
    const card = player.deck.shift()!;
    player.hand.push(card);
    addLog?.(`🎴 ${player.name} 抓牌+1`);
  }
  
  // 设置临时状态：本回合卡牌视作中级符咒
  player.tempBuffs = player.tempBuffs || [];
  player.tempBuffs.push({
    type: 'cardTransform',
    target: 'midSpell',
    duration: 1,
    source: 'boss_007'
  });
  addLog?.(`✨ ${player.name} 本回合所有卡可视作「中级符咒」使用`);
  
  return { success: true, message: '御魂效果：抓牌+1，本回合卡视作中级符咒' };
});

// 【自】回合开始回收
registerTurnStartTrigger('荒骷髅', async (ctx) => {
  const { player, addLog } = ctx;
  
  // 检查弃牌堆中是否有荒骷髅
  const idx = player.discard.findIndex(c => c.cardId === 'boss_007');
  
  if (idx !== -1) {
    const card = player.discard.splice(idx, 1)[0];
    player.hand.push(card);
    addLog?.(`🔄 ${player.name} 回合开始，荒骷髅从弃牌堆回到手牌`);
    return { triggered: true };
  }
  
  return { triggered: false };
});
```

---

## 📝 注意事项

### 多人游戏专属
- 此鬼王仅在 **5人以上游戏** 中出现
- 初始化鬼王牌堆时需检查玩家人数，人数<5则排除此卡

### 来袭效果的毁灭性
- **牌库全弃**是非常强力的惩罚
- 结合**必定获得恶评**，对所有玩家都有影响
- **HP>7超度**可能让玩家失去关键御魂牌

### 卡牌变形机制
- 这是一个**复杂的状态效果**
- 需要在打牌逻辑中检查 `tempBuffs` 中是否有 `cardTransform`
- 「中级符咒」效果：伤害+2（需确认具体效果）

### 【自】回合开始回收
- 与蜃气楼(boss_006)相同的被动机制
- 结合卡牌变形，每回合都能提供灵活的打牌选择

### 重洗牌库
- 需要实现 `shuffleArray` 工具函数
- 确保洗牌后的随机性

---

## 🔗 相关文档

- [鬼王卡.md](../鬼王卡.md) - 所有鬼王数据总表
- [boss-framework.md](../../../../docs/design/boss-framework.md) - 鬼王系统技术框架
- [卡牌开发.md](../卡牌开发.md) - 卡牌开发流程规范
