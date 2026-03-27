# yokai_021_铮

> **文档版本**: v2.0  
> **卡牌ID**: yokai_021  
> **最后更新**: 2026年3月  
> **框架依赖**: HarassmentPipeline (反制器), onChoice 回调

---

## 📋 基础信息

| 属性 | 值 |
|:----:|:---|
| ID | yokai_021 |
| 名称 | 铮 |
| 类型 | yokai (御魂) |
| 副类型 | 御魂/反制 |
| 性别 | 无 |
| HP | 4 |
| 声望 | 0 |
| 总数量 | 2 |
| 多人标记 | 1（1张为多人模式🔷专属） |
| 初始张数 | 2（标准模式3-4人使用） |

## 📜 效果原文

> 抓牌+1，伤害+2。【触】受到[妨害]效果时，可以弃置此牌：抓牌+2，不受[妨害]效果影响。

## 🔍 效果分解

### 3.1 主动效果（打出时）

| 步骤 | 操作 | 说明 |
|:----:|------|------|
| 1 | 抓牌+1 | 从牌库抽1张牌加入手牌 |
| 2 | 伤害+2 | 增加当前伤害值2点 |

### 3.2 触发效果【触】（手牌状态）

| 触发条件 | 操作 | 说明 |
|----------|------|------|
| 受到[妨害]效果时 | 可选择弃置此牌 | 弃置到弃牌堆 |
| 弃置后 | 抓牌+2 | 从牌库抽2张牌 |
| 弃置后 | 不受此次[妨害]影响 | 完全取消妨害效果 |

### 3.3 关键词解释

#### 【触】触发效果
- **定义**：在手牌中时被动触发的效果
- **触发时机**：当符合条件的游戏事件发生时
- **选择权**：标注"可以"表示玩家可选择是否触发

#### [妨害]效果
- **定义**：对对手产生负面影响的效果类型
- **常见妨害效果**：
  - 强制弃牌（如鬼童丸的"对手弃置手牌"）
  - 移除牌库顶牌
  - 削减资源（鬼火、伤害）
  - 打断/取消操作

## 💻 执行逻辑

### 4.1 主动效果伪代码

```typescript
async function execute_铮(ctx: EffectContext): Promise<EffectResult> {
  const { player } = ctx;
  
  // 步骤1：抓牌+1
  await drawCards(player, 1);
  addLog(`🎴 ${player.name} 抓牌+1`);
  
  // 步骤2：伤害+2
  player.damage += 2;
  addLog(`⚔️ ${player.name} 伤害+2 (当前: ${player.damage})`);
  
  return { success: true, message: '抓牌+1，伤害+2' };
}
```

### 4.2 触发效果伪代码

```typescript
// 注册手牌触发效果
registerHandTrigger('铮', {
  triggerType: 'onHindranceReceived',  // 当受到妨害时
  condition: (ctx) => {
    // 检查是否在手牌中
    return ctx.player.hand.some(c => c.name === '铮');
  },
  execute: async (ctx) => {
    const { player, triggerInteract, hindranceEvent } = ctx;
    
    // 找到手牌中的铮
    const zhengCard = player.hand.find(c => c.name === '铮');
    if (!zhengCard) return { triggered: false };
    
    // 询问玩家是否触发
    const choice = await triggerInteract?.({
      type: 'triggerChoice',
      playerId: player.id,
      card: zhengCard,
      prompt: `受到[${hindranceEvent.sourceName}]的妨害效果，是否弃置「铮」来抵消？`,
      options: ['弃置（抓牌+2，免疫妨害）', '不弃置']
    });
    
    if (choice === 0) {
      // 弃置铮
      const cardIndex = player.hand.findIndex(c => c.instanceId === zhengCard.instanceId);
      const discarded = player.hand.splice(cardIndex, 1)[0];
      player.discard.push(discarded);
      addLog(`🛡️ ${player.name} 弃置「铮」抵消妨害`);
      
      // 抓牌+2
      await drawCards(player, 2);
      addLog(`🎴 ${player.name} 抓牌+2`);
      
      // 标记妨害被取消
      hindranceEvent.cancelled = true;
      
      return { triggered: true, hindranceCancelled: true };
    }
    
    return { triggered: false };
  }
});
```

## ⚠️ 边界条件与问答

### Q1: 手牌中有多张「铮」，受到妨害时可以弃置几张？

**A**: 只需弃置1张即可完全抵消妨害。弃置多张无额外收益。

### Q2: 触发弃置「铮」后抓的2张牌是否立即可用？

**A**: 是的，抓到的牌立即加入手牌，当回合可正常使用。

### Q3: 「铮」能否抵消"超度"类效果？

**A**: 需要看"超度"是否被标记为[妨害]。一般而言：
- ✅ 强制超度（对手令你超度）→ 妨害
- ❌ 自愿超度（自己选择超度）→ 非妨害

### Q4: 多个妨害效果同时触发时如何处理？

**A**: 每个妨害效果独立触发一次询问。抵消一个妨害后，若还有后续妨害且手牌中仍有「铮」，可再次选择是否弃置。

### Q5: 对手的「轮入道」让某妨害效果执行两次，弃置一张「铮」能否全部抵消？

**A**: 不能。每次执行视为独立妨害，需要弃置2张「铮」才能完全抵消。

### Q6: 牌库为空时触发弃置「铮」，抓牌+2如何处理？

**A**: 抓取可用的牌数（0-2张），不足部分不产生额外效果。

### Q7: 「铮」的【触】效果在行动阶段外能否触发？

**A**: 可以。【触】效果不限制阶段，只要满足条件即可触发（如对手在其回合使用妨害效果影响你）。

## ⚔️ 与其他卡牌的交互

### 6.1 触发「铮」的常见妨害来源

| 妨害来源 | 效果 | 可被「铮」抵消 |
|----------|------|:--------------:|
| 鬼童丸(HP 3) | 对手弃置1张手牌 | ✅ |
| 骨女(HP 3) | 移除对手牌库顶 | ✅ |
| 络新妇(HP 5) | 对手下回合抓牌-1 | ✅ |
| 大�的鬼(Boss) | 对手弃置2张手牌 | ✅ |

### 6.2 不触发「铮」的效果

| 效果来源 | 原因 |
|----------|------|
| 自己使用的弃牌效果 | 非妨害（自愿） |
| 战斗伤害 | 非妨害类型 |
| 超度自己的牌 | 非妨害（自愿） |

## 🎲 AI 决策逻辑

### 7.1 主动效果评估

```typescript
function aiEvaluate_铮(ctx: AIContext): number {
  let score = 0;
  
  // 基础价值：抓牌+1 = 4分，伤害+2 = 4分
  score += 4 + 4;  // 基础8分
  
  // HP=4，中等难度击杀
  // 无额外消耗，效率稳定
  
  return score;
}
```

### 7.2 触发效果决策

```typescript
function aiDecide_铮_Trigger(ctx: AIContext, hindranceEvent: HindranceEvent): boolean {
  const { player, gameState } = ctx;
  
  // 评估妨害严重程度
  const hindranceSeverity = evaluateHindrance(hindranceEvent);
  // - 弃牌: 严重度 = 被弃牌数 × 3
  // - 移除牌库: 严重度 = 移除数 × 2
  // - 资源削减: 严重度 = 削减量 × 2
  
  // 弃置「铮」的收益
  const triggerBenefit = 6;  // 抓牌+2 ≈ 6分
  
  // 「铮」自身价值（打出时的收益）
  const zhengValue = 8;  // 抓牌+1(4) + 伤害+2(4)
  
  // 决策公式：
  // 触发收益 = 抵消妨害(hindranceSeverity) + 抓牌收益(triggerBenefit)
  // 触发成本 = 失去「铮」(zhengValue)
  const netBenefit = hindranceSeverity + triggerBenefit - zhengValue;
  
  // 当净收益 > 0 时选择弃置
  return netBenefit > 0;
  
  // 实际阈值示例：
  // - 被迫弃2张牌(severity=6) → 6+6-8=4 > 0 → 弃置
  // - 被迫弃1张牌(severity=3) → 3+6-8=1 > 0 → 弃置（边缘情况）
  // - 移除1张牌库顶(severity=2) → 2+6-8=0 → 不弃置
}
```

## ✅ 测试用例

```typescript
describe('yokai_021_铮', () => {
  describe('主动效果', () => {
    it('🟢 打出时抓牌+1，伤害+2', async () => {
      const player = createTestPlayer({ 
        hand: [createYokai('铮')],
        deck: createTestDeck(5),
        damage: 0
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('铮', ctx);
      
      expect(player.hand.length).toBe(1);  // 原1张打出，抓1张
      expect(player.damage).toBe(2);
    });
    
    it('🔴 牌库为空时仍增加伤害', async () => {
      const player = createTestPlayer({ 
        deck: [],
        damage: 3
      });
      const ctx = createTestContext(player);
      
      await executeYokaiEffect('铮', ctx);
      
      expect(player.damage).toBe(5);  // +2
      expect(player.hand.length).toBe(0);  // 无牌可抓
    });
  });
  
  describe('触发效果【触】', () => {
    it('🟢 受到妨害时选择弃置，抵消妨害并抓牌+2', async () => {
      const zhengCard = createYokai('铮');
      const player = createTestPlayer({
        hand: [zhengCard],
        deck: createTestDeck(5)
      });
      const ctx = createTriggerContext(player, {
        hindranceType: 'forceDiscard',
        hindranceAmount: 1
      });
      ctx.triggerInteract = async () => 0;  // 选择弃置
      
      const result = await handleHindrance(ctx);
      
      expect(result.hindranceCancelled).toBe(true);
      expect(player.hand.length).toBe(2);  // 原1张弃置，抓2张
      expect(player.discard).toContain(zhengCard);
    });
    
    it('🟢 选择不弃置，正常受到妨害', async () => {
      const zhengCard = createYokai('铮');
      const otherCard = createYokai('天邪鬼青');
      const player = createTestPlayer({
        hand: [zhengCard, otherCard],
        deck: createTestDeck(5)
      });
      const ctx = createTriggerContext(player, {
        hindranceType: 'forceDiscard',
        hindranceAmount: 1
      });
      ctx.triggerInteract = async () => 1;  // 选择不弃置
      
      const result = await handleHindrance(ctx);
      
      expect(result.hindranceCancelled).toBe(false);
      expect(player.hand.length).toBe(1);  // 被迫弃1张(otherCard)
    });
    
    it('🔴 手牌中无「铮」时无法触发', async () => {
      const player = createTestPlayer({
        hand: [createYokai('天邪鬼青')],
        deck: createTestDeck(5)
      });
      const ctx = createTriggerContext(player, {
        hindranceType: 'forceDiscard',
        hindranceAmount: 1
      });
      
      const canTrigger = checkHandTrigger('铮', ctx);
      
      expect(canTrigger).toBe(false);
    });
    
    it('🟢 轮入道双重妨害需要弃置2张「铮」', async () => {
      const zheng1 = createYokai('铮', 'zheng-1');
      const zheng2 = createYokai('铮', 'zheng-2');
      const player = createTestPlayer({
        hand: [zheng1, zheng2],
        deck: createTestDeck(5)
      });
      
      // 第一次妨害
      const ctx1 = createTriggerContext(player, { hindranceType: 'forceDiscard' });
      ctx1.triggerInteract = async () => 0;
      await handleHindrance(ctx1);
      
      // 第二次妨害（轮入道触发）
      const ctx2 = createTriggerContext(player, { hindranceType: 'forceDiscard' });
      ctx2.triggerInteract = async () => 0;
      await handleHindrance(ctx2);
      
      expect(player.discard.length).toBe(2);  // 两张铮都被弃置
      expect(player.hand.length).toBe(4);     // 抓了2+2=4张
    });
  });
});
```

## 📊 实现状态

| 项目 | 状态 |
|:----:|:----:|
| 主动效果 | ⬜ 待实现 |
| 触发系统 | ⬜ 待实现 |
| 妨害标签 | ⬜ 待定义 |
| AI逻辑 | ⬜ 待实现 |
| 单元测试 | ⬜ 待编写 |

## 🛠️ 开发备注

1. **需要实现妨害标签系统**：为所有妨害效果添加 `isHindrance: true` 标记
2. **需要实现手牌触发系统**：区别于打出效果，手牌触发在事件发生时检查
3. **触发优先级**：多个【触】效果同时满足时的执行顺序待定义
4. **与「镜姬」的区别**：镜姬是伤害免疫，「铮」是妨害免疫
