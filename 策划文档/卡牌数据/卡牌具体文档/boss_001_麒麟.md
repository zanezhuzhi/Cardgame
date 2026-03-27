# boss_001 麒麟

> **版本**: v1.0  
> **类型**: 鬼王  
> **阶段**: Ⅰ  
> **数据来源**: `策划文档/卡牌数据/鬼王卡.md`

---

## 📋 基础信息

| 属性 | 值 |
|------|-----|
| **ID** | boss_001 |
| **名称** | 麒麟 |
| **阶段** | Ⅰ |
| **生命** | 8 |
| **声誉** | +3 |
| **关键词** | 御魂 |
| **🔷多人** | 否 |
| **数量** | 1 |

---

## 📜 效果原文

### 来袭效果
**无**。此牌是鬼王牌库的首张。

### 御魂效果
伤害+3。

**【触】** 回合结束时，若此牌在弃牌区，将其置入你的牌库底。

---

## 🔍 效果分解

### 来袭效果分解
麒麟是首个鬼王，游戏开始时直接翻出，**不触发来袭效果**。

### 御魂效果分解

| 步骤 | 动作 | 说明 |
|:----:|------|------|
| 1 | 伤害+3 | 立即获得3点伤害 |

### 【触】被动效果分解

| 步骤 | 动作 | 说明 |
|:----:|------|------|
| 1 | 回合结束检查 | 清理阶段开始时检查 |
| 2 | 位置检查 | 检查麒麟是否在**弃牌堆**中 |
| 3 | 归底 | 若在弃牌堆，将其从弃牌堆移到**牌库底** |

**关键规则**：
- **触发时机**：清理阶段开始时（弃牌前）
- **检查范围**：仅检查弃牌堆，不检查手牌或已打出区
- **执行顺序**：先执行麒麟归底，再执行其他清理步骤

---

## 🎲 AI 行为决策

麒麟效果简单，无需 AI 决策。

| 场景 | AI策略 |
|------|--------|
| 打出麒麟 | 优先在有高伤害需求时打出 |
| 【触】归底 | 自动执行，无决策 |

---

## ⚔️ 交互场景

### 场景1：作为御魂打出
1. 玩家手牌有麒麟
2. 玩家打出麒麟
3. 获得伤害+3
4. 麒麟进入已打出区
5. 清理阶段：已打出区 → 弃牌堆
6. 检查【触】：麒麟在弃牌堆 → 归牌库底

### 场景2：【触】效果触发
1. 清理阶段开始
2. 检查弃牌堆是否有麒麟
3. 若有，将麒麟从弃牌堆移到牌库底
4. 添加日志：「🎴 麒麟【触】：归入牌库底」
5. 继续执行其他清理步骤

### 场景3：麒麟被超度
1. 麒麟被超度（移出游戏）
2. 不在弃牌堆中
3. **不触发**【触】效果

---

## ✅ 验收标准

### 基础测试

| 测试项 | 预期结果 |
|--------|----------|
| 打出麒麟 | 伤害+3 |
| 回合结束弃牌堆有麒麟 | 麒麟归牌库底 |
| 回合结束弃牌堆无麒麟 | 不触发归底 |

### 边界测试

| 测试项 | 预期结果 |
|--------|----------|
| 麒麟在手牌中结束回合 | 手牌进弃牌堆 → 触发归底 |
| 麒麟在已打出区结束回合 | 已打出区进弃牌堆 → 触发归底 |
| 麒麟被超度 | 不触发归底（不在弃牌堆） |
| 多张麒麟（不可能）| - |

### TDD 用例

```typescript
describe('麒麟', () => {
  describe('🟢 来袭效果', () => {
    it('首张鬼王无来袭效果', async () => {
      const result = await executeBossArrival('麒麟', ctx);
      expect(result.success).toBe(true);
      expect(result.message).toContain('无来袭效果');
    });
  });

  describe('🟢 御魂效果', () => {
    it('伤害+3', async () => {
      const result = await executeBossSoul('麒麟', ctx);
      expect(result.success).toBe(true);
      expect(player.damage).toBe(3);
    });
  });

  describe('🟢 【触】回合结束归底', () => {
    it('弃牌堆中的麒麟归牌库底', () => {
      player.discard = [createTestCard('boss', '麒麟', 8)];
      const result = checkKirinEndOfTurn(player);
      expect(result).toBe(true);
      expect(player.discard.length).toBe(0);
      expect(player.deck.length).toBe(1);
      expect(player.deck[0].name).toBe('麒麟');
    });

    it('弃牌堆无麒麟不触发', () => {
      player.discard = [createTestCard('yokai', '其他妖怪', 3)];
      const result = checkKirinEndOfTurn(player);
      expect(result).toBe(false);
      expect(player.discard.length).toBe(1);
    });
  });
});
```

---

## 🛠️ 实现备注

### 涉及文件

| 文件 | 职责 |
|------|------|
| `shared/game/effects/BossEffects.ts` | 御魂效果 + 【触】效果 |
| `shared/game/effects/BossEffects.test.ts` | TDD 测试 |
| `server/src/game/MultiplayerGame.ts` | 清理阶段调用【触】检查 |

### 实现要点

1. **来袭效果**：麒麟是首个鬼王，无来袭效果，`executeBossArrival('麒麟')` 直接返回成功
2. **御魂效果**：简单的 `player.damage += 3`
3. **【触】效果**：
   - 在 `enterCleanupPhase()` 开始时调用 `checkKirinEndOfTurn(player)`
   - 检查 `player.discard` 是否包含名为「麒麟」的卡
   - 若有，将其移到 `player.deck` 末尾（牌库底）

### 注意事项

- 麒麟的【触】效果在清理阶段**最先**执行，确保归底后再执行其他清理步骤
- 归底操作不触发任何其他效果
- 牌库底 = `player.deck.push(card)`
