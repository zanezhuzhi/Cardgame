# yokai_023_狂骨

> **文档版本**: v2.0  
> **卡牌ID**: yokai_023  
> **最后更新**: 2026年3月  
> **框架依赖**: 无特殊依赖（读取 player.ghostFire）

---

## 📋 基础信息

| 属性 | 值 |
|:----:|:---|
| ID | yokai_023 |
| 名称 | 狂骨 |
| 类型 | yokai (御魂) |
| 副类型 | 御魂 |
| 性别 | 女 |
| HP | 5 |
| 声望 | 0 |
| 总数量 | 2 |
| 多人标记 | 0（0张为多人模式🔷专属） |
| 初始张数 | 2（标准模式3-4人使用） |

## 📜 效果原文

> 抓牌+1，伤害+X，X等于你当前的鬼火数量。

## 🔍 效果分解

### 3.1 执行步骤

| 步骤 | 操作 | 说明 |
|:----:|------|------|
| 1 | 读取当前鬼火 | 获取玩家当前鬼火数量 X |
| 2 | 抓牌+1 | 从牌库抽1张牌加入手牌 |
| 3 | 伤害+X | 增加伤害值 X 点 |

### 3.2 关键规则

#### 计算时机
- **即时计算**：打出狂骨时立即读取当前鬼火数量
- **效果结算后不变**：即使之后鬼火变化，已加的伤害不变

#### 鬼火范围
- **最小值**：0（鬼火为0时，伤害+0）
- **最大值**：通常5（鬼火上限），特殊情况可能更高

#### 执行顺序
- **先读取鬼火，再执行效果**：抓牌操作不影响伤害计算
- 若有"打出牌时鬼火+1"的buff，需确认触发顺序

## 💻 执行逻辑

### 4.1 伪代码

```typescript
async function execute_狂骨(ctx: EffectContext): Promise<EffectResult> {
  const { player } = ctx;
  
  // 步骤1：读取当前鬼火数量
  const X = player.ghostFire;
  
  // 步骤2：抓牌+1
  await drawCards(player, 1);
  addLog(`🎴 ${player.name} 抓牌+1`);
  
  // 步骤3：伤害+X
  player.damage += X;
  addLog(`⚔️ ${player.name} 伤害+${X} (当前鬼火: ${X})`);
  
  return { 
    success: true, 
    message: `抓牌+1，伤害+${X}` 
  };
}
```

## ⚠️ 边界条件与问答

### Q1: 鬼火为0时打出狂骨有什么效果？

**A**: 抓牌+1，伤害+0。仍然可以正常打出。

### Q2: 鬼火为5时伤害是多少？

**A**: 伤害+5。狂骨在鬼火充足时效率极高。

### Q3: 打出狂骨后鬼火减少，伤害会回退吗？

**A**: 不会。伤害在效果执行时已经确定。

### Q4: 狂骨的HP=5，需要多少伤害才能退治？

**A**: 需要累计伤害≥5才能退治狂骨。这与狂骨的伤害加成无关。

### Q5: 被「轮入道」执行两次效果时如何处理？

**A**: 
- 第1次：读取鬼火X1，抓牌+1，伤害+X1
- 第2次：读取鬼火X2（通常与X1相同），抓牌+1，伤害+X2
- 总计：抓牌+2，伤害+2X

### Q6: 有"涅槃之火"减费效果时，狂骨计算的是消耗后的鬼火吗？

**A**: **减费效果不影响鬼火实际数量**。

- 涅槃之火的减费在**使用牌时**生效，降低的是消耗量，而非鬼火值
- 狂骨读取的 X = 当前鬼火（消耗前）
- 打出狂骨后再扣除鬼火

**示例**：
- 当前鬼火：5
- 涅槃之火减费：御魂消耗 -1（本应消耗1，实际消耗0）
- 狂骨效果：伤害 +5（读取的是5）
- 消耗后鬼火：5 - 0 = 5

## ⚔️ 与其他卡牌的交互

### 6.1 协同卡牌

| 卡牌 | 协同效果 |
|------|----------|
| 涅槃之火(HP4) | 减少消耗，保留更多鬼火给狂骨 |
| 薙魂(HP4) | 可能+2鬼火，增加狂骨伤害 |
| 天邪鬼黄(HP2) | 鬼火+1，为狂骨储备 |

### 6.2 对抗卡牌

| 卡牌 | 影响 |
|------|------|
| 鬼火消耗大的牌 | 提前打出会减少狂骨收益 |

### 6.3 最佳使用时机

| 鬼火 | 伤害 | 评价 |
|:----:|:----:|------|
| 0 | +0 | ❌ 效率极低 |
| 1-2 | +1~2 | ⚠️ 一般 |
| 3-4 | +3~4 | ✅ 较好 |
| 5 | +5 | 🎯 最佳 |

## 🎲 AI 决策逻辑

### 7.1 使用时机评估

```typescript
function aiEvaluate_狂骨(ctx: AIContext): number {
  const { player } = ctx;
  let score = 0;
  
  // 基础价值：抓牌+1 = 4分
  score += 4;
  
  // 伤害价值：每点伤害 ≈ 2分
  const damageBonus = player.ghostFire;
  score += damageBonus * 2;
  
  // 鬼火效率评估
  // 鬼火高时狂骨收益高，应优先使用
  if (player.ghostFire >= 4) {
    score += 3;  // 高鬼火加分
  } else if (player.ghostFire <= 1) {
    score -= 2;  // 低鬼火减分
  }
  
  return score;
}
```

### 7.2 AI 优先级表

| 条件 | 优先级 | 说明 |
|------|:------:|------|
| 鬼火=5 | ⭐⭐⭐⭐⭐ | 必出，伤害+5极高收益 |
| 鬼火≥3 | ⭐⭐⭐⭐ | 优先出，收益可观 |
| 鬼火=1~2 | ⭐⭐ | 收益一般，可留待后续 |
| 鬼火=0 | ⭐ | 仅抓牌，效率低 |

### 7.3 与其他牌的出牌顺序

```typescript
// AI应在鬼火充足时优先打狂骨
function shouldPlayKuangguFirst(hand: CardInstance[], ghostFire: number): boolean {
  // 高鬼火时狂骨优先
  if (ghostFire >= 4) return true;
  
  // 若手牌有增加鬼火的牌，先打那些牌
  const fireGainCards = hand.filter(c => 
    ['天邪鬼黄', '涅槃之火', '薙魂'].includes(c.name)
  );
  if (fireGainCards.length > 0 && ghostFire < 3) {
    return false;  // 先打增加鬼火的牌
  }
  
  return true;
}
```

## ✅ 测试用例

```typescript
describe('yokai_023_狂骨', () => {
  describe('基础效果', () => {
    it('🟢 鬼火=3时，抓牌+1，伤害+3', async () => {
      const player = createTestPlayer({
        deck: createTestDeck(5),
        damage: 0,
        ghostFire: 3
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('狂骨', ctx);
      
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(3);
    });
    
    it('🟢 鬼火=5时，伤害+5', async () => {
      const player = createTestPlayer({
        deck: createTestDeck(5),
        damage: 2,
        ghostFire: 5
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('狂骨', ctx);
      
      expect(player.damage).toBe(7);  // 2+5=7
    });
  });
  
  describe('边界条件', () => {
    it('🔴 鬼火=0时，伤害+0', async () => {
      const player = createTestPlayer({
        deck: createTestDeck(5),
        damage: 0,
        ghostFire: 0
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('狂骨', ctx);
      
      expect(player.damage).toBe(0);  // +0
      expect(player.hand.length).toBe(1);  // 仍抓牌
    });
    
    it('🔴 牌库为空时仍增加伤害', async () => {
      const player = createTestPlayer({
        deck: [],
        damage: 0,
        ghostFire: 4
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('狂骨', ctx);
      
      expect(player.damage).toBe(4);  // +4
      expect(player.hand.length).toBe(0);  // 无牌可抓
    });
    
    it('🟢 轮入道双重效果：两次读取鬼火', async () => {
      const player = createTestPlayer({
        deck: createTestDeck(5),
        damage: 0,
        ghostFire: 3
      });
      const ctx = createTestContext(player);
      
      // 第一次执行
      await executeYokaiEffect('狂骨', ctx);
      // 第二次执行（轮入道）
      await executeYokaiEffect('狂骨', ctx);
      
      expect(player.damage).toBe(6);  // 3+3=6
      expect(player.hand.length).toBe(2);  // 1+1=2
    });
  });
});
```

## 📊 实现状态

| 项目 | 状态 |
|:----:|:----:|
| 基础效果 | ✅ 已实现 |
| AI逻辑 | ⬜ 待优化 |
| 单元测试 | ⬜ 待编写 |

## 🛠️ 开发备注

1. **效率曲线**：狂骨在鬼火满时收益最高，是回合末尾的强力收尾牌
2. **与涅槃之火配合**：减少消耗=保留更多鬼火=更高伤害
3. **计算确认**：需确认"消耗鬼火"与"执行效果"的顺序
