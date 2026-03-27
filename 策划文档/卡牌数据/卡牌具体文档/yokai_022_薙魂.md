# yokai_022_薙魂

> **文档版本**: v2.0  
> **卡牌ID**: yokai_022  
> **最后更新**: 2026年3月  
> **框架依赖**: TurnHistory (playedCards 统计), onSelectCards 回调

---

## 📋 基础信息

| 属性 | 值 |
|:----:|:---|
| ID | yokai_022 |
| 名称 | 薙魂 |
| 类型 | yokai (御魂) |
| 副类型 | 御魂/鬼火 |
| 性别 | 男 |
| HP | 4 |
| 声望 | 1 |
| 总数量 | 2 |
| 多人标记 | 1（1张为多人模式🔷专属） |
| 初始张数 | 2（标准模式3-4人使用） |

## 📜 效果原文

> 抓牌+1，弃置1张手牌。本回合中，若你打出了至少3张「御魂」（包括此牌），则鬼火+2。

## 🔍 效果分解

### 3.1 执行步骤

| 步骤 | 操作 | 说明 |
|:----:|------|------|
| 1 | 抓牌+1 | 从牌库抽1张牌加入手牌 |
| 2 | 弃置1张手牌 | 玩家选择1张手牌弃置（必须执行） |
| 3 | 检查条件 | 统计本回合打出的御魂数量（包括此牌） |
| 4 | 条件满足时 | 若御魂数 ≥ 3，则鬼火+2 |

### 3.2 关键规则

#### 计数范围
- **包括此牌**：薙魂自身计入御魂数量
- **本回合**：从回合开始到当前时刻打出的所有御魂
- **仅统计御魂**：阴阳术、式神技能不计入

#### 执行时机
- **即时检查**：打出薙魂时立即检查，不是回合结束时检查
- **条件满足即触发**：若打出薙魂时已满足条件，立即获得鬼火

#### 弃牌规则
- **强制弃牌**：必须弃置1张手牌，不可跳过
- **抓牌后弃牌**：先抓1张牌，再从手牌中选择弃置
- **可弃刚抓的牌**：抓到的牌可以立即弃置

## 💻 执行逻辑

### 4.1 伪代码

```typescript
async function execute_薙魂(ctx: EffectContext): Promise<EffectResult> {
  const { player, gameState, triggerInteract } = ctx;
  
  // 步骤1：抓牌+1
  await drawCards(player, 1);
  addLog(`🎴 ${player.name} 抓牌+1`);
  
  // 步骤2：弃置1张手牌（必须执行）
  if (player.hand.length > 0) {
    const selectedIndex = await triggerInteract?.({
      type: 'selectCard',
      playerId: player.id,
      cards: player.hand,
      count: 1,
      prompt: '选择1张手牌弃置'
    });
    
    const discardIndex = selectedIndex ?? 0;  // 默认弃第一张
    const discarded = player.hand.splice(discardIndex, 1)[0];
    player.discard.push(discarded);
    addLog(`🗑️ ${player.name} 弃置 ${discarded.name}`);
  }
  
  // 步骤3：检查本回合御魂数量
  const yokaiPlayedThisTurn = gameState.turnStats?.cardsPlayed?.filter(
    card => card.cardType === 'yokai'
  ).length ?? 0;
  
  // 步骤4：条件满足则鬼火+2
  if (yokaiPlayedThisTurn >= 3) {
    player.ghostFire += 2;
    if (player.ghostFire > player.maxGhostFire) {
      player.ghostFire = player.maxGhostFire;
    }
    addLog(`🔥 ${player.name} 本回合打出${yokaiPlayedThisTurn}张御魂，鬼火+2 (当前: ${player.ghostFire})`);
  }
  
  return { success: true, message: '抓牌+1，弃1牌' };
}
```

### 4.2 状态追踪

```typescript
// 需要在 GameState 或 TurnStats 中追踪
interface TurnStats {
  cardsPlayed: CardInstance[];  // 本回合打出的所有牌
  // ... 其他统计
}

// 每次打出牌时记录
function onCardPlayed(card: CardInstance) {
  gameState.turnStats.cardsPlayed.push(card);
}

// 回合结束时清空
function onTurnEnd() {
  gameState.turnStats.cardsPlayed = [];
}
```

## ⚠️ 边界条件与问答

### Q1: 抓牌后手牌为空还需要弃牌吗？

**A**: 如果抓牌前手牌为0，抓1张后手牌为1张，必须弃置这张刚抓的牌。

### Q2: 薙魂是本回合第3张御魂时如何计算？

**A**: 
- 打出薙魂前已打出2张御魂
- 打出薙魂（第3张）
- 薙魂效果结算时检查：3张 ≥ 3 ✅
- 鬼火+2

### Q3: 薙魂是本回合第1张御魂时能否触发？

**A**: 不能。打出薙魂时只有1张御魂，不满足 ≥3 的条件。

### Q4: 本回合打出4张御魂，鬼火是+2还是+4？

**A**: +2。条件是"若 ≥3"，不是"每满3张+2"。

### Q5: 鬼火已满时打出薙魂会如何？

**A**: 鬼火增加受上限限制。例如当前5/5，即使满足条件也不会超过5。

### Q6: 连续打出2张薙魂，第2张是否算第2张御魂？

**A**: 是的。
- 第1张薙魂（御魂计数=1）→ 不满足条件
- 第2张薙魂（御魂计数=2）→ 不满足条件
- 第3张薙魂（御魂计数=3）→ 满足条件，鬼火+2

### Q7: 弃牌时可以选择弃置哪张牌？

**A**: 玩家自由选择弃置任意1张手牌，包括刚抓到的牌。

### Q8: 被「轮入道」执行两次效果时如何处理？

**A**: 
- 第1次：抓牌+1，弃1牌，检查条件
- 第2次：再抓牌+1，再弃1牌，再检查条件
- 两次检查时御魂数量相同（轮入道不增加御魂计数）
- 若条件满足，两次各+2鬼火（共+4）

## ⚔️ 与其他卡牌的交互

### 6.1 协同卡牌

| 卡牌 | 协同效果 |
|------|----------|
| 天邪鬼青(HP2) | 抓牌+1，可作为薙魂的第2张御魂 |
| 天邪鬼绿(HP2) | 抓牌+1，可作为薙魂的第2张御魂 |
| 赤舌(HP2) | 最基础的御魂，可凑数 |
| 涅槃之火(HP4) | 御魂费-1，与薙魂的鬼火+2互补 |

### 6.2 对抗卡牌

| 卡牌 | 影响 |
|------|------|
| 鬼童丸(HP3) | 强制弃牌减少手牌资源，难以打出3张御魂 |
| 骨女(HP3) | 移除牌库顶，减少可抓到的御魂 |

### 6.3 特殊交互

| 场景 | 说明 |
|------|------|
| 轮入道(HP4) | 效果执行两次，两次都会检查条件 |
| 网切(HP4) | 不影响薙魂效果，HP减少独立计算 |

## 🎲 AI 决策逻辑

### 7.1 使用时机评估

```typescript
function aiEvaluate_薙魂(ctx: AIContext): number {
  const { player, gameState } = ctx;
  let score = 0;
  
  // 基础价值：抓牌+1 = 4分，弃牌-1 = -3分
  score += 4 - 3;  // 基础1分（净抓牌0张，但可换牌）
  
  // 声望+1 = 2分
  score += 2;
  
  // 检查本回合御魂数量
  const yokaiPlayed = gameState.turnStats?.cardsPlayed?.filter(
    c => c.cardType === 'yokai'
  ).length ?? 0;
  
  // 若打出薙魂后满足条件（包括薙魂自身）
  if (yokaiPlayed + 1 >= 3) {
    // 鬼火+2，但要考虑鬼火上限
    const fireGain = Math.min(2, player.maxGhostFire - player.ghostFire);
    score += fireGain * 3;  // 每点鬼火≈3分
  }
  
  // 手牌中御魂数量加成（能凑出3张御魂的潜力）
  const yokaiInHand = player.hand.filter(c => c.cardType === 'yokai').length;
  if (yokaiPlayed === 0 && yokaiInHand >= 3) {
    score += 2;  // 有潜力触发条件
  }
  
  return score;
}
```

### 7.2 弃牌选择逻辑

```typescript
function aiSelectDiscard_薙魂(ctx: AIContext): number {
  const { player } = ctx;
  
  // 优先弃置价值最低的牌
  // 价值计算：HP越低价值越低，非御魂也较低
  let lowestIndex = 0;
  let lowestValue = Infinity;
  
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    let value = card.hp ?? 0;
    
    // 如果是御魂且还没凑够3张，价值提高
    const yokaiPlayed = ctx.gameState.turnStats?.cardsPlayed?.filter(
      c => c.cardType === 'yokai'
    ).length ?? 0;
    
    if (card.cardType === 'yokai' && yokaiPlayed < 2) {
      value += 3;  // 保留御魂以凑条件
    }
    
    // 阴阳术通常较重要
    if (card.cardType === 'spell') {
      value += 5;
    }
    
    if (value < lowestValue) {
      lowestValue = value;
      lowestIndex = i;
    }
  }
  
  return lowestIndex;
}
```

### 7.3 AI 优先级表

| 条件 | 优先级 | 说明 |
|------|:------:|------|
| 已打出2张御魂 | ⭐⭐⭐⭐⭐ | 必触发鬼火+2 |
| 已打出1张御魂，手牌还有1张御魂 | ⭐⭐⭐⭐ | 高概率触发 |
| 鬼火接近上限 | ⭐⭐ | 鬼火+2可能溢出 |
| 手牌仅剩1张 | ⭐ | 抓1弃1后手牌仍为1 |

## ✅ 测试用例

```typescript
describe('yokai_022_薙魂', () => {
  describe('基础效果', () => {
    it('🟢 打出时抓牌+1，然后弃置1张手牌', async () => {
      const player = createTestPlayer({
        hand: [createYokai('薙魂'), createYokai('赤舌')],
        deck: createTestDeck(5)
      });
      const ctx = createTestContext(player);
      ctx.triggerInteract = async () => 1;  // 选择弃第2张（赤舌）
      
      await executeYokaiEffect('薙魂', ctx);
      
      expect(player.hand.length).toBe(2);  // 原2张-打出1张+抓1张-弃1张=1张... 等等
      // 注：薙魂打出后不在手牌中
      // 原1张赤舌+抓1张-弃1张=1张
    });
    
    it('🟢 满足条件时鬼火+2', async () => {
      const player = createTestPlayer({
        hand: [createYokai('薙魂')],
        deck: createTestDeck(5),
        ghostFire: 3,
        maxGhostFire: 5
      });
      const gameState = createTestGameState(player);
      // 模拟已打出2张御魂
      gameState.turnStats = {
        cardsPlayed: [createYokai('赤舌'), createYokai('天邪鬼青')]
      };
      const ctx = createTestContext(player, gameState);
      ctx.triggerInteract = async () => 0;
      
      await executeYokaiEffect('薙魂', ctx);
      
      // 薙魂是第3张御魂，满足条件
      expect(player.ghostFire).toBe(5);  // 3+2=5
    });
  });
  
  describe('边界条件', () => {
    it('🔴 本回合仅打出1张御魂（薙魂自身）不触发鬼火', async () => {
      const player = createTestPlayer({
        hand: [createYokai('薙魂')],
        deck: createTestDeck(5),
        ghostFire: 3
      });
      const gameState = createTestGameState(player);
      gameState.turnStats = { cardsPlayed: [] };  // 本回合首张
      const ctx = createTestContext(player, gameState);
      ctx.triggerInteract = async () => 0;
      
      await executeYokaiEffect('薙魂', ctx);
      
      expect(player.ghostFire).toBe(3);  // 不变
    });
    
    it('🔴 鬼火已满不会超过上限', async () => {
      const player = createTestPlayer({
        ghostFire: 5,
        maxGhostFire: 5
      });
      const gameState = createTestGameState(player);
      gameState.turnStats = {
        cardsPlayed: [createYokai('赤舌'), createYokai('天邪鬼青')]
      };
      const ctx = createTestContext(player, gameState);
      ctx.triggerInteract = async () => 0;
      
      await executeYokaiEffect('薙魂', ctx);
      
      expect(player.ghostFire).toBe(5);  // 仍为5
    });
    
    it('🔴 抓牌后手牌只有1张，必须弃置', async () => {
      const player = createTestPlayer({
        hand: [],  // 手牌为空
        deck: [createYokai('心眼')]
      });
      const ctx = createTestContext(player);
      ctx.triggerInteract = async () => 0;
      
      await executeYokaiEffect('薙魂', ctx);
      
      expect(player.hand.length).toBe(0);  // 抓1张后弃1张
      expect(player.discard.length).toBe(1);
    });
    
    it('🟢 轮入道双重效果：两次检查，可能两次+2鬼火', async () => {
      const player = createTestPlayer({
        hand: [createYokai('心眼'), createYokai('天邪鬼青')],
        deck: createTestDeck(5),
        ghostFire: 1,
        maxGhostFire: 5
      });
      const gameState = createTestGameState(player);
      // 已打出2张御魂（包括轮入道触发的薙魂）
      gameState.turnStats = {
        cardsPlayed: [createYokai('赤舌'), createYokai('天邪鬼绿'), createYokai('薙魂')]
      };
      const ctx = createTestContext(player, gameState);
      ctx.triggerInteract = async () => 0;
      
      // 第一次执行
      await executeYokaiEffect('薙魂', ctx);
      // 第二次执行（轮入道）
      await executeYokaiEffect('薙魂', ctx);
      
      // 两次都满足条件，共+4鬼火
      expect(player.ghostFire).toBe(5);  // 1+4=5，但不超上限
    });
  });
});
```

## 📊 实现状态

| 项目 | 状态 |
|:----:|:----:|
| 基础效果 | ⬜ 待实现 |
| 条件检查 | ⬜ 待实现 |
| 回合统计 | ⬜ 需确认 turnStats 结构 |
| AI弃牌逻辑 | ⬜ 待实现 |
| 单元测试 | ⬜ 待编写 |

## 🛠️ 开发备注

1. **依赖 turnStats**：需要 `gameState.turnStats.cardsPlayed` 追踪本回合打出的牌
2. **弃牌交互**：需要实现 `selectCard` 类型的交互请求
3. **与破势的区别**：
   - 破势：检查"是否首张"
   - 薙魂：检查"打出数量≥3"
4. **优化点**：可在UI上显示"本回合已打出N张御魂"提示
