# 单元测试增强方案

> 基于调研结果，制定分阶段的测试增强计划

---

## 📊 现状分析

### 覆盖良好 ✅

| 模块 | 用例数 | 评估 |
|------|:------:|------|
| YokaiEffects | 60+ | 妖怪效果覆盖完整 |
| ShikigamiSkills | 100+ | 式神技能覆盖全面 |
| cards.consistency | 150+ | 数据校验完善 |
| EffectiveHP | 28 | HP系统测试完整 |
| DeckManager | 12 | 牌库操作测试OK |

### 需要加强 🟡🔴

| 模块 | 现状 | 风险 | 改进方向 |
|------|------|:----:|----------|
| **服务端 MultiplayerGame** | 仅式神获取测试 | 🔴高 | 回合流程、状态机 |
| **交互响应链** | 部分集成测试 | 🟡中 | pendingChoice完整性 |
| **AI决策** | 无测试 | 🟡中 | aiDecide函数验证 |
| **BossEffects** | 基础测试 | 🟡中 | 鬼王特殊机制 |
| **Socket事件** | 无测试 | 🔴高 | 事件映射正确性 |

---

## 🎯 增强方案

### 第一阶段: 服务端核心逻辑 (P0)

**目标**: 确保 `MultiplayerGame` 核心流程可测试验证

**进展（2026-03-30）**: 已新增 `server/src/game/__tests__/MultiplayerGame.action.test.ts`，覆盖「非当前玩家 / 非行动阶段不可 endTurn」与「当前玩家 endTurn 后轮转与补牌」。可继续在此文件补充 `playCard`、伤害分配、`attackBoss` 等用例。

**范围**:
```
server/src/game/MultiplayerGame.ts
├── handleAction()        # 玩家操作处理
├── executeYokaiEffect() # 效果执行
├── handleXxxResponse()   # 各类交互响应
├── turnFlowControl()     # 回合流转
└── notifyStateChange()   # 状态广播
```

**新增测试文件**: `server/src/game/MultiplayerGame.action.test.ts`

**示例用例**:
```typescript
describe('MultiplayerGame - 操作处理', () => {
  describe('handleAction: playCard', () => {
    it('🟢 正常打出御魂: 消耗鬼火，触发效果', async () => {
      // 准备带妖怪的游戏状态
      const game = createTestGame();
      const player = game.state.players[0];
      player.hand = [createTestCard('yokai', '狂骨')];
      player.ghostFire = 3;
      
      // 执行出牌
      const result = game.handleAction(player.id, {
        type: 'playCard',
        cardInstanceId: player.hand[0].instanceId,
        targetYokaiId: game.state.field.yokaiSlots[0].instanceId,
      });
      
      // 验证
      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(2); // 消耗1鬼火
      expect(player.damage).toBe(3);    // 狂骨伤害+鬼火数
    });

    it('🔴 鬼火不足时拒绝出牌', () => {
      const game = createTestGame();
      const player = game.state.players[0];
      player.hand = [createTestCard('yokai', '狂骨')];
      player.ghostFire = 0;
      
      const result = game.handleAction(player.id, {
        type: 'playCard',
        cardInstanceId: player.hand[0].instanceId,
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('鬼火');
    });
  });

  describe('handleAction: endTurn', () => {
    it('🟢 结束回合: 切换到下一玩家', () => { ... });
    it('🔴 非当前玩家不能结束回合', () => { ... });
  });
});
```

**预计用例数**: 20-30

---

### 第二阶段: 交互响应链 (P1)

**目标**: 验证 `pendingChoice` 机制完整性

**范围**:
```
handleTreeDemonDiscardResponse()
handleSalvageChoiceResponse()
handleYokaiChoiceResponse()
handleSelectCardsMultiResponse()
...
```

**新增测试文件**: `server/src/game/MultiplayerGame.interaction.test.ts`

**示例用例**:
```typescript
describe('交互响应链', () => {
  describe('树妖弃置响应', () => {
    it('🟢 选择弃置后: 手牌减少，弃牌堆增加', () => { ... });
    it('🔄 轮入道场景: 第一次响应后继续第二次交互', () => { ... });
    it('🔴 超时/无效响应: 使用默认策略', () => { ... });
  });

  describe('唐纸伞妖超度响应', () => {
    it('🟢 选择超度: 牌移入超度区', () => { ... });
    it('🟢 选择不超度: 牌留在牌库顶', () => { ... });
  });
});
```

**预计用例数**: 15-20

---

### 第三阶段: AI 决策验证 (P1)

**目标**: 确保 AI 决策函数返回合理结果

**范围**:
```
shared/game/effects/YokaiEffects.ts
├── aiDecide_轮入道()
├── aiDecide_唐纸伞妖()
├── aiDecide_天邪鬼绿()
└── ...其他aiDecide函数
```

**新增测试文件**: `shared/game/effects/AIDecision.test.ts`

**示例用例**:
```typescript
describe('AI决策函数', () => {
  describe('aiDecide_轮入道', () => {
    it('🤖 鬼火多时优先选择狂骨', () => {
      const hand = [
        createTestCard('yokai', '狂骨'),
        createTestCard('yokai', '河童'),
      ];
      const ghostFire = 5;
      
      const choice = aiDecide_轮入道(hand, ghostFire);
      
      expect(hand[choice].name).toBe('狂骨');
    });

    it('🤖 仅有恶评时不选择', () => {
      const hand = [createTestCard('penalty', '恶评')];
      const choice = aiDecide_轮入道(hand, 3);
      expect(choice).toBe(-1); // 不选择
    });
  });

  describe('aiDecide_唐纸伞妖', () => {
    it('🤖 牌库顶为恶评时选择超度', () => { ... });
    it('🤖 牌库顶为御魂时不超度', () => { ... });
  });
});
```

**预计用例数**: 10-15

---

### 第四阶段: 鬼王效果 (P2)

**目标**: 补充鬼王特殊机制测试

**新增测试文件**: `shared/game/effects/BossEffects.test.ts` (扩展现有)

**预计用例数**: 10-15

---

## 📅 实施时间表

| 阶段 | 模块 | 预计用例 | 建议周期 |
|:----:|------|:--------:|:--------:|
| 1 | 服务端操作处理 | 20-30 | 1周 |
| 2 | 交互响应链 | 15-20 | 0.5周 |
| 3 | AI决策 | 10-15 | 0.5周 |
| 4 | 鬼王效果 | 10-15 | 0.5周 |

**总计**: 约 55-80 个新用例，预计 2.5 周完成

---

## 🛠️ 测试工具增强

### 需要新增的测试工具函数

```typescript
// server/src/game/__tests__/testUtils.ts

/** 创建测试用游戏实例 */
export function createTestGame(options?: {
  playerCount?: number;
  yokaiSlots?: CardInstance[];
  currentPhase?: TurnPhase;
}): MultiplayerGame {
  // 创建完整的游戏实例用于测试
  // 包含 Mock 的 notifyStateChange
}

/** 模拟玩家操作序列 */
export async function simulateActions(
  game: MultiplayerGame,
  actions: GameAction[]
): Promise<void> {
  for (const action of actions) {
    game.handleAction(action.playerId, action);
  }
}

/** 验证状态一致性 */
export function assertStateConsistency(state: GameState): void {
  // 检查状态内部一致性
  // - 玩家手牌/牌库/弃牌总数正确
  // - 场上妖怪状态正确
  // - 鬼火不超过上限
}
```

---

## ✅ 验收标准

完成后应达到的指标：

| 指标 | 目标值 |
|------|:------:|
| 核心逻辑测试覆盖率 | >80% |
| 所有卡牌效果有测试 | 100% |
| 所有交互响应有测试 | 100% |
| CI 全部测试通过 | ✅ |
| 测试执行时间 | <30秒 |

---

## 🚀 后续展望

完成上述单元测试增强后，可进一步：

1. **集成测试**: Socket 事件流完整测试
2. **性能测试**: 大量卡牌效果执行性能
3. **E2E 自动化**: Playwright 实现客户端自动化
4. **视觉回归**: 关键 UI 截图对比

---

> **创建日期**: 自动生成  
> **状态**: 待实施
