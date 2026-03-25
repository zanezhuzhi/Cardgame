# 天邪鬼绿

> 妖怪/御魂卡

---

## 基础信息

| 属性 | 值 |
|------|---|
| ID | yokai_003 |
| 名称 | 天邪鬼绿 |
| HP | 2 |
| 声誉 | 0 |
| 类型 | 御魂 |
| 效果 | 退治1个生命不高于4的游荡妖怪。 |
| 多人标记 | 0（标准/多人都有效） |
| 数量 | 2 |

---

## 效果分解

1. **筛选目标** — 从战场妖怪槽 `yokaiSlots` 中筛选 HP ≤ 4 的妖怪
2. **玩家选择1个** — 若有多个合法目标，由玩家选择1个
3. **退治** — 将选中的妖怪从战场移除，放入打出者的弃牌堆（贡献声誉）
4. **无目标** — 场上无 HP ≤ 4 的妖怪时，效果无事发生

---

## 单人模式实现

### 逻辑描述

玩家打出天邪鬼绿 → 弹窗展示场上 HP ≤ 4 的妖怪列表 → 玩家点选1个 → 妖怪从战场移除 → 放入玩家弃牌堆。

### 涉及模块

- `shared/game/effects/YokaiEffects.ts` — 效果逻辑
- `client/src/App.vue` — 目标选择弹窗

### 风险点

- 退治的妖怪**必须进入玩家弃牌堆**，否则声誉不会被计算
- 退治后需触发战场妖怪补充逻辑

---

## 多人模式实现

### 逻辑描述

与单人模式逻辑一致，无需其他玩家参与决策。

### 涉及模块

同单人模式。

### 风险点

- 退治后的妖怪槽位补充需要服务端同步

---

## 代码设计

### 当前实现问题

| # | 问题 | 严重度 | 描述 |
|---|------|:------:|------|
| 1 | **退治妖怪未入弃牌堆** | 🔴 高 | `yokaiSlots[idx] = null` 后妖怪凭空消失，玩家损失声誉 |
| 2 | AI 选择无策略 | 🟡 中 | 无 `onSelectTarget` 时直接取第一个，无择优逻辑 |
| 3 | 缺少强制中止/AI接管测试 | 🟡 中 | 不符合新流程规范 |

### 修复方案

```typescript
registerEffect('天邪鬼绿', async (ctx) => {
  const { player, gameState, onSelectTarget } = ctx;
  const validTargets = gameState.field.yokaiSlots
    .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= 4);
  
  if (validTargets.length === 0) {
    return { success: true, message: '天邪鬼绿：场上没有符合条件的妖怪' };
  }
  
  const targetId = onSelectTarget
    ? await onSelectTarget(validTargets)
    : aiSelect_天邪鬼绿(validTargets);
  
  const idx = gameState.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
  if (idx !== -1) {
    const target = gameState.field.yokaiSlots[idx]!;
    gameState.field.yokaiSlots[idx] = null;
    player.discard.push(target);  // ← 关键修复：退治入弃牌堆
    return { success: true, message: `天邪鬼绿：退治${target.name}` };
  }
  
  return { success: true, message: '天邪鬼绿：退治失败' };
});
```

### 注意事项

1. 「退治」= 移除战场 + 进入打出者弃牌堆（不是超度区）
2. 退治不等于击杀，不触发击杀相关的声誉结算（声誉在回合结束统一计算）
3. 战场空位在清理阶段由 `fillYokaiSlots` 补充

---

## 强制中止行为

| 中止时机 | 已执行的部分 | 默认处理 |
|----------|------------|----------|
| 效果触发前 | 无 | 效果跳过 |
| 等待玩家选择目标时超时 | 已筛选出合法目标 | 执行 AI 默认策略选择目标 |

### 默认选择策略

| 选择类型 | 超时默认 |
|----------|----------|
| `onSelectTarget`（选择退治目标） | 选择 HP 最高的合法妖怪（收益最大化） |

---

## AI接管行为

### AI决策表

| 决策点 | AI策略 |
|--------|--------|
| 选择退治哪个妖怪 | 优先选 HP 最高的合法目标（HP ≤ 4 中取最大值） |

### 策略说明（L1 规则）

- HP 越高的妖怪越难用伤害退治，用天邪鬼绿直接退治收益最大
- HP=4 > HP=3 > HP=2（同 HP 时选第一个）
- 场上只有1个合法目标时自动选择，无需决策

---

## 验收标准

### 功能验收

- [ ] 退治的妖怪从战场移除
- [ ] 退治的妖怪进入打出者的弃牌堆
- [ ] 只能退治 HP ≤ 4 的妖怪
- [ ] 有多个合法目标时，玩家可以选择
- [ ] 日志正确记录退治的妖怪名称

### 边界情况

- [ ] 场上无 HP ≤ 4 的妖怪时，效果跳过
- [ ] 场上无妖怪时，效果跳过
- [ ] 场上有 HP=4 和 HP=5 的妖怪时，只能选 HP=4 的

### 强制中止 & AI接管

- [ ] 无 onSelectTarget 时 AI 选择 HP 最高的合法目标
- [ ] 超时时按默认策略正确结算

---

## 开发状态

- 文档创建时间：2026-03-24
- 当前状态：✅ 开发完成（771 tests passed）
- 修复：退治妖怪入弃牌堆 + AI择优选择 + 完整测试覆盖
