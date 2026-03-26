# yokai_024_返魂香

## 📋 基础信息

| 属性 | 值 |
|:----:|:---|
| ID | yokai_024 |
| 名称 | 返魂香 |
| 类型 | yokai (御魂) |
| 副类型 | 御魂/妨害 |
| 性别 | 无 |
| HP | 5 |
| 声望 | 1 |
| 总数量 | 2 |
| 多人标记 | 1（1张为多人模式🔷专属） |
| 初始张数 | 1（标准模式3-4人使用） |

## 📜 效果原文

> 抓牌+1，伤害+1。每名对手选择一项：· 弃置1张手牌（无手牌时不可选）· 获得1张恶评

## 🔍 效果分解

### 3.1 执行步骤

| 步骤 | 操作 | 说明 |
|:----:|------|------|
| 1 | 抓牌+1 | 从牌库抽1张牌加入手牌 |
| 2 | 伤害+1 | 增加当前伤害值1点 |
| 3 | 每名对手选择 | 每名对手独立选择：弃牌或获得恶评 |

### 3.2 关键规则

#### 对手定义
- **【对手】**：除自己以外的所有其他玩家（包括AI）
- **单人模式**：无对手，步骤3跳过
- **多人模式**：2人局1名对手，3人局2名对手，4人局3名对手

#### 选择限制
- **无手牌时**：只能选择"获得恶评"
- **有手牌时**：两个选项均可选

#### 恶评卡
- **获得方式**：从恶评牌堆获取1张加入手牌
- **恶评效果**：负面卡牌，会影响声望或产生其他惩罚

## 💻 执行逻辑

### 4.1 伪代码

```typescript
async function execute_返魂香(ctx: EffectContext): Promise<EffectResult> {
  const { player, gameState, triggerInteract } = ctx;
  
  // 步骤1：抓牌+1
  await drawCards(player, 1);
  addLog(`🎴 ${player.name} 抓牌+1`);
  
  // 步骤2：伤害+1
  player.damage += 1;
  addLog(`⚔️ ${player.name} 伤害+1`);
  
  // 步骤3：每名对手选择
  const opponents = getOpponents(player, gameState);
  
  for (const opponent of opponents) {
    const hasHandCards = opponent.hand.length > 0;
    
    // 构建选项
    const options = [];
    if (hasHandCards) {
      options.push('弃置1张手牌');
    }
    options.push('获得1张恶评');
    
    // 请求对手选择
    const choice = await triggerInteract?.({
      type: 'opponentChoice',
      playerId: opponent.id,
      sourcePlayerId: player.id,
      sourceName: '返魂香',
      prompt: '选择一项：',
      options: options
    });
    
    // 执行选择结果
    if (hasHandCards && choice === 0) {
      // 对手选择弃牌
      const discardChoice = await triggerInteract?.({
        type: 'selectCard',
        playerId: opponent.id,
        cards: opponent.hand,
        count: 1,
        prompt: '选择1张手牌弃置'
      });
      const discardIndex = discardChoice ?? 0;
      const discarded = opponent.hand.splice(discardIndex, 1)[0];
      opponent.discard.push(discarded);
      addLog(`🗑️ ${opponent.name} 弃置 ${discarded.name}`);
    } else {
      // 对手获得恶评
      const penaltyCard = drawPenaltyCard(gameState);
      if (penaltyCard) {
        opponent.hand.push(penaltyCard);
        addLog(`📛 ${opponent.name} 获得恶评「${penaltyCard.name}」`);
      }
    }
  }
  
  return { success: true, message: '抓牌+1，伤害+1，对手受到妨害' };
}
```

### 4.2 恶评卡处理

```typescript
function drawPenaltyCard(gameState: GameState): CardInstance | null {
  if (gameState.penaltyDeck.length === 0) {
    return null;  // 恶评牌堆已空
  }
  return gameState.penaltyDeck.shift();
}
```

## ⚠️ 边界条件与问答

### Q1: 单人模式下返魂香效果如何？

**A**: 仅执行"抓牌+1，伤害+1"，无对手选择环节。

### Q2: 多名对手的选择顺序是什么？

**A**: 从玩家左手边开始，按顺时针顺序依次选择。

### Q3: 对手选择弃牌时，可以选择弃哪张牌？

**A**: 对手自由选择弃置任意1张手牌（由对手决定）。

### Q4: 对手手牌为空时必须获得恶评吗？

**A**: 是的。无手牌时"弃置手牌"选项不可用，只能获得恶评。

### Q5: 恶评牌堆为空时会发生什么？

**A**: 选择"获得恶评"的对手不获得任何牌。

### Q6: 被「轮入道」执行两次效果时如何处理？

**A**: 
- 第1次：抓牌+1，伤害+1，每名对手选择一次
- 第2次：再抓牌+1，伤害+1，每名对手再选择一次
- 对手共需做出2次选择

### Q7: 对手可以用「铮」抵消返魂香的效果吗？

**A**: 是的。返魂香的选择属于[妨害]效果，「铮」可以弃置来抵消。

### Q8: AI对手如何选择？

**A**: AI默认选择"弃置手牌"（损失较小），仅当手牌为空时才获得恶评。

## ⚔️ 与其他卡牌的交互

### 6.1 协同卡牌

| 卡牌 | 协同效果 |
|------|----------|
| 轮入道(HP4) | 执行两次，对手需选择两次 |
| 其他妨害牌 | 多重妨害压力 |

### 6.2 被克制

| 卡牌 | 效果 |
|------|------|
| 铮(HP4) | 对手可弃置「铮」免疫妨害并抓牌+2 |

### 6.3 触发场景

| 场景 | 说明 |
|------|------|
| 2人对战 | 1名对手选择 |
| 3人对战 | 2名对手各自选择 |
| 4人对战 | 3名对手各自选择 |

## 🎲 AI 决策逻辑

### 7.1 使用时机评估（使用方）

```typescript
function aiEvaluate_返魂香(ctx: AIContext): number {
  const { player, gameState } = ctx;
  let score = 0;
  
  // 基础价值：抓牌+1 = 4分，伤害+1 = 2分
  score += 4 + 2;
  
  // 声望+1 = 2分
  score += 2;
  
  // 妨害价值：每名对手约3分
  const opponentCount = getOpponents(player, gameState).length;
  score += opponentCount * 3;
  
  return score;
}
```

### 7.2 AI对手的选择策略

```typescript
function aiDecide_返魂香_OpponentChoice(ctx: AIContext): number {
  const { player } = ctx;
  
  // 若手牌为空，只能选择获得恶评（选项1或唯一选项）
  if (player.hand.length === 0) {
    return 0;  // 获得恶评是唯一选项
  }
  
  // 评估弃牌损失 vs 获得恶评损失
  const lowestCardValue = Math.min(...player.hand.map(c => c.hp ?? 0));
  const penaltyLoss = 4;  // 恶评估计损失4分
  
  // 弃牌损失 < 恶评损失 → 选择弃牌
  if (lowestCardValue < penaltyLoss) {
    return 0;  // 选择弃牌
  }
  
  // 否则选择获得恶评
  return 1;
}
```

### 7.3 AI 优先级表

| 条件 | 优先级 | 说明 |
|------|:------:|------|
| 多人模式，对手多 | ⭐⭐⭐⭐⭐ | 妨害多人收益高 |
| 对手手牌少 | ⭐⭐⭐⭐ | 更可能强制获得恶评 |
| 单人模式 | ⭐⭐ | 无妨害效果，仅抓牌+伤害 |

## ✅ 测试用例

```typescript
describe('yokai_024_返魂香', () => {
  describe('基础效果', () => {
    it('🟢 打出时抓牌+1，伤害+1', async () => {
      const player = createTestPlayer({
        deck: createTestDeck(5),
        damage: 0
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('返魂香', ctx);
      
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(1);
    });
  });
  
  describe('多人模式妨害', () => {
    it('🟢 对手有手牌时选择弃牌', async () => {
      const player = createTestPlayer({ damage: 0 });
      const opponent = createTestPlayer({
        hand: [createYokai('赤舌'), createYokai('天邪鬼青')]
      });
      const gameState = createMultiplayerState([player, opponent]);
      const ctx = createTestContext(player, gameState);
      ctx.triggerInteract = async (req) => {
        if (req.type === 'opponentChoice') return 0;  // 选择弃牌
        if (req.type === 'selectCard') return 0;       // 弃第一张
        return 0;
      };
      
      await executeYokaiEffect('返魂香', ctx);
      
      expect(opponent.hand.length).toBe(1);
      expect(opponent.discard.length).toBe(1);
    });
    
    it('🟢 对手无手牌时获得恶评', async () => {
      const player = createTestPlayer({ damage: 0 });
      const opponent = createTestPlayer({ hand: [] });
      const gameState = createMultiplayerState([player, opponent]);
      gameState.penaltyDeck = [createPenaltyCard('恶评1')];
      const ctx = createTestContext(player, gameState);
      
      await executeYokaiEffect('返魂香', ctx);
      
      expect(opponent.hand.length).toBe(1);
      expect(opponent.hand[0].cardType).toBe('penalty');
    });
    
    it('🟢 3人对战时，2名对手各自选择', async () => {
      const player = createTestPlayer();
      const opponent1 = createTestPlayer({ hand: [createYokai('赤舌')] });
      const opponent2 = createTestPlayer({ hand: [] });
      const gameState = createMultiplayerState([player, opponent1, opponent2]);
      gameState.penaltyDeck = [createPenaltyCard('恶评1')];
      const ctx = createTestContext(player, gameState);
      let choiceCount = 0;
      ctx.triggerInteract = async (req) => {
        choiceCount++;
        return 0;
      };
      
      await executeYokaiEffect('返魂香', ctx);
      
      // opponent1弃牌，opponent2获得恶评
      expect(opponent1.hand.length).toBe(0);
      expect(opponent2.hand.length).toBe(1);
    });
  });
  
  describe('边界条件', () => {
    it('🔴 单人模式无妨害环节', async () => {
      const player = createTestPlayer();
      const gameState = createSinglePlayerState(player);
      const ctx = createTestContext(player, gameState);
      
      await executeYokaiEffect('返魂香', ctx);
      
      expect(player.damage).toBe(1);
      // 无对手，无妨害交互
    });
    
    it('🔴 恶评牌堆为空时不获得牌', async () => {
      const player = createTestPlayer();
      const opponent = createTestPlayer({ hand: [] });
      const gameState = createMultiplayerState([player, opponent]);
      gameState.penaltyDeck = [];  // 空牌堆
      const ctx = createTestContext(player, gameState);
      
      await executeYokaiEffect('返魂香', ctx);
      
      expect(opponent.hand.length).toBe(0);  // 无恶评可获得
    });
  });
});
```

## 📊 实现状态

| 项目 | 状态 |
|:----:|:----:|
| 基础效果 | ⬜ 待实现 |
| 对手选择交互 | ⬜ 待实现 |
| 恶评系统 | ⬜ 需确认 |
| AI选择逻辑 | ⬜ 待实现 |
| 单元测试 | ⬜ 待编写 |

## 🛠️ 开发备注

1. **需要恶评牌堆**：`gameState.penaltyDeck` 存储恶评卡
2. **对手选择UI**：需要实现对手选择弹窗，显示两个选项
3. **[妨害]标签**：此效果应标记为妨害，可被「铮」抵消
4. **选择顺序**：多名对手按顺时针顺序依次选择
5. **网络同步**：多人模式需要等待所有对手完成选择
