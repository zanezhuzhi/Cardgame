# 镇墓兽第二段：禁止击杀 + 盾标（设计说明）

**日期**：2026-03-29  
**状态**：已批准（方案 A，盾标全场可见）

## 背景

- `prohibitedTargets` 已写入「打出镇墓兽的玩家」，且 `handleRetireYokai` / `handleRetireBoss` 已拦截手动退治。
- 现行结算为**击杀后默认退治**，`handleAllocateDamage` 等在击杀分支会直接退治，未校验 `prohibitedTargets`，导致「禁止退治」形同虚设。
- 规则更正：**对本回合被指定的目标，被限制玩家不能退治 ⇔ 不能造成可致其退治的击杀**；对游荡妖怪表现为**不可对该目标分配伤害**；鬼王同理。

## 规则与文档

- 更新 `策划文档/游戏规则说明书.md`、`策划文档/卡牌数据/妖怪卡.md`、`策划文档/卡牌数据/卡牌具体文档/yokai_025_镇墓兽.md`：删除「禁止退治 ≠ 禁止击杀」等基于旧版「击杀后可选退治/超度」的表述。
- **盾标**：**全场可见**（任意玩家 `prohibitedTargets` 含该 `instanceId` 即在场上显示）；**仅被限制的本机玩家**不可点击分配伤害，且选退治目标时剔除/不可用。
- 盾层 `pointer-events: none`，避免误挡点击。

## 服务端

- `handleAllocateDamage`：若当前玩家 `prohibitedTargets` 含该格妖怪 `instanceId`，拒绝本次分配。
- 鬼王：`handleAttackBoss`、`attackBoss`、`defeatBoss` 路径在造成伤害/退治前校验 `boss.id`（与 `handleRetireBoss` 一致）。
- `attackYokai`：防御旧客户端/协议，校验 `yokaiInstanceId`。
- 技能中选择游荡妖怪/鬼王作为退治目标时，对**当前行动玩家**校验 `prohibitedTargets`（与现有目标校验并列）。

## 客户端

- 计算 `shieldYokaiIds`：`players.flatMap(p => p.prohibitedTargets ?? [])` 去重；游荡区卡牌 `instanceId` 命中则显示居中盾标。
- `handleYokaiClick`：若 `player.prohibitedTargets?.includes(y.instanceId)` 则直接 return。
- 目标选择弹窗：过滤或置灰被禁止目标（与现有模态一致）。

## 测试

- 受限玩家 `allocateDamage` 指向被禁妖怪失败；非受限玩家仍可击杀。
- 鬼王被指定后受限玩家攻击失败。
- 回合结束清空 `prohibitedTargets` 后交互恢复。
