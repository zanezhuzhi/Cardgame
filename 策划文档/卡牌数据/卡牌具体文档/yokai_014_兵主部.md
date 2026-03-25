# 兵主部

> 妖怪/御魂卡（御魂）

---

## 基础信息

| 属性 | 值 |
|------|---|
| ID | yokai_014 |
| 名称 | 兵主部 |
| HP | 3 |
| 声誉 | +1 |
| 类型 | 御魂 |
| 效果 | 伤害+2。 |
| 多人标记 | 1 |
| 数量 | 2 |

---

## 效果分解

1. **伤害+2** — 本回合 `damage += 2`。

---

## 单人模式实现

### 逻辑描述

打出即加伤害，无选择、无目标。

### 涉及模块

- `shared/game/effects/YokaiEffects.ts` — `兵主部`

### 风险点

- 无

---

## 多人模式实现

### 逻辑描述

同单人。

### 涉及模块

- `server/src/game/MultiplayerGame.ts`

### 风险点

- 无

---

## 代码设计

### 涉及文件

- `shared/game/effects/YokaiEffects.ts`
- `shared/data/cards.json` — `yokai_014`

### 关键逻辑要点

- `player.damage += 2`

---

## 强制中止行为

- 不适用。

---

## AI接管行为

- 无分支。

---

## 验收标准

- [ ] 伤害 +2
- [ ] 日志正确

---

## 开发状态

- 文档创建时间：2026-03-25
- 实现参考：`shared/game/effects/YokaiEffects.ts`（`兵主部`）
