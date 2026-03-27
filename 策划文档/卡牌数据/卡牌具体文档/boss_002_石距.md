# boss_002 石距

> **版本**: v1.0  
> **类型**: 鬼王  
> **阶段**: Ⅰ  
> **数据来源**: `策划文档/卡牌数据/鬼王卡.md`

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_002 |
| **名称** | 石距 |
| **阶段** | Ⅰ |
| **生命** | 9 |
| **声誉** | +3 |
| **关键词** | 御魂/鬼火 |
| **🔷多人** | 否 |
| **数量** | 1 |

---

## 📜 效果原文

### 来袭效果
每位玩家展示手牌，并弃掉所有的阴阳术。（未弃牌者获得1张恶评）

### 御魂效果
鬼火+1，抓牌+1，伤害+2。

---

## 🔍 效果分解

### 来袭效果分解

| 步骤 | 动作 | 说明 |
|:----:|------|------|
| 1 | 展示手牌 | 每位玩家向所有人展示手牌 |
| 2 | 弃置阴阳术 | 将手牌中**所有**阴阳术（基础术式、中级符咒、高级符咒）弃置 |
| 3 | 检查弃牌 | 若该玩家**未弃置任何牌**（手牌无阴阳术） |
| 4 | 获得恶评 | 未弃牌的玩家获得1张恶评 |

**关键规则**：
- **展示**：展示后归还原位（但会被弃置）
- **弃置类型**：此弃置属于**来袭效果导致的弃置**，触发【触】效果
- **"未弃牌"判定**：指该玩家**没有弃置任何阴阳术**，而非"选择不弃"
- **执行顺序**：从击败上一个鬼王的玩家开始，顺时针依次处理

### 御魂效果分解

| 步骤 | 动作 | 说明 |
|:----:|------|------|
| 1 | 鬼火+1 | 增加1点鬼火（上限5） |
| 2 | 抓牌+1 | 从牌库抽1张牌 |
| 3 | 伤害+2 | 获得2点伤害 |

---

## 🎲 AI 行为决策

来袭效果为强制执行，无 AI 决策空间。

| 场景 | AI策略 |
|------|--------|
| 来袭弃置 | 自动弃置所有阴阳术 |
| 无阴阳术 | 自动获得恶评 |
| 打出石距 | 优先在鬼火不足5、需要抓牌时打出 |

---

## ⚔️ 交互场景

### 场景1：来袭效果 - 有阴阳术
1. 石距翻出，来袭效果触发
2. 玩家A展示手牌：[基础术式×2, 妖怪×3]
3. 弃置所有阴阳术：[基础术式×2] → 弃牌堆
4. 不获得恶评
5. 日志：「👹 石距来袭：玩家A 弃置了 2 张阴阳术」

### 场景2：来袭效果 - 无阴阳术
1. 石距翻出，来袭效果触发
2. 玩家B展示手牌：[妖怪×5]
3. 无阴阳术可弃
4. 获得1张恶评
5. 日志：「👹 石距来袭：玩家B 无阴阳术，获得1张恶评」

### 场景3：作为御魂打出
1. 玩家手牌有石距
2. 玩家打出石距
3. 鬼火+1（当前鬼火3→4）
4. 抓牌+1（从牌库抽1张）
5. 伤害+2（当前伤害0→2）
6. 日志：「🎴 玩家 打出御魂 石距：鬼火+1，抓牌+1，伤害+2」

---

## ✅ 验收标准

### 基础测试

| 测试项 | 预期结果 |
|--------|----------|
| 来袭 - 手牌有2张阴阳术 | 弃置2张，不获得恶评 |
| 来袭 - 手牌无阴阳术 | 获得1张恶评 |
| 御魂 - 正常打出 | 鬼火+1，抓牌+1，伤害+2 |

### 边界测试

| 测试项 | 预期结果 |
|--------|----------|
| 来袭 - 手牌只有1张阴阳术 | 弃置1张，不获得恶评 |
| 来袭 - 手牌全是阴阳术（5张） | 弃置5张，手牌清空，不获得恶评 |
| 来袭 - 手牌为空 | 无阴阳术可弃，获得1张恶评 |
| 御魂 - 鬼火已满5 | 鬼火仍为5，其他效果正常 |
| 御魂 - 牌库为空 | 跳过抓牌，其他效果正常 |

### TDD 用例

```typescript
describe('石距', () => {
  describe('🟢 来袭效果', () => {
    it('弃掉所有阴阳术', async () => {
      player.hand = [
        createTestCard('spell', '基础术式'),
        createTestCard('spell', '中级符咒'),
        createTestCard('yokai', '妖怪')
      ];
      
      await executeBossArrival('石距', { gameState, bossCard: boss });
      
      expect(player.hand.length).toBe(1); // 只剩妖怪
      expect(player.discard.length).toBe(2); // 2张阴阳术
    });

    it('无阴阳术时获得恶评', async () => {
      player.hand = [createTestCard('yokai', '妖怪')];
      
      await executeBossArrival('石距', { gameState, bossCard: boss });
      
      expect(player.hand.some(c => c.cardType === 'penalty')).toBe(true);
    });
  });

  describe('🟢 御魂效果', () => {
    it('鬼火+1，抓牌+1，伤害+2', async () => {
      player.ghostFire = 2;
      player.deck = [createTestCard('spell')];
      
      const result = await executeBossSoul('石距', { player, gameState, bossCard: boss });
      
      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3);
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(2);
    });
  });
});
```

---

## 🛠️ 实现备注

### 涉及文件

| 文件 | 职责 |
|------|------|
| `shared/game/effects/BossEffects.ts` | 来袭效果 + 御魂效果 |
| `shared/game/effects/BossEffects.test.ts` | TDD 测试 |
| `server/src/game/MultiplayerGame.ts` | 服务端来袭流程控制 |

### 实现要点

1. **来袭效果**：
   ```typescript
   // 遍历所有玩家
   for (const player of gameState.players) {
     const spells = player.hand.filter(c => c.cardType === 'spell');
     if (spells.length > 0) {
       // 弃置所有阴阳术
       for (const spell of spells) {
         const idx = player.hand.indexOf(spell);
         player.hand.splice(idx, 1);
         player.discard.push(spell);
       }
     } else {
       // 无阴阳术，获得恶评
       addPenaltyCard(player);
     }
   }
   ```

2. **御魂效果**：
   ```typescript
   player.ghostFire = Math.min(5, player.ghostFire + 1);
   drawCards(player, 1);
   player.damage += 2;
   ```

### 注意事项

- 来袭弃置阴阳术属于**主动弃置**，会触发【触】效果（如果有）
- 恶评从恶评牌库抽取，牌库空时获得农夫
- 展示手牌是信息公开，实现时需要广播给所有玩家
