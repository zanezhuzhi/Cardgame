# 测试条件集（精简版）

> 目标：快速知道“现在开了什么测试、怎么测、GM怎么用”

---

## 1) 当前测试开关

### 单人（`client/src/game/SinglePlayerGame.ts`）

| ID | 描述 | 状态 |
|----|------|------|
| test1 | 初始手牌增加1/2/3阶阴阳术 | 关闭 |
| test2 | 初始手牌增加1/2/3/3阶阴阳术 | 关闭 |
| test3 | 中级/高级符咒获取条件测试 | 关闭 |
| test4 | 初始御魂（赤舌/唐纸伞妖/天邪鬼绿） | 启用 |

### 多人（`server/src/game/MultiplayerGame.ts`）

| ID | 描述 | 状态 |
|----|------|------|
| test2-1 | 初始手牌增加1/2/3阶阴阳术 | 启用 |
| test2-2 | 初始手牌增加1/2/3/3阶阴阳术 | 关闭 |
| test2-3 | 中级/高级符咒获取条件测试 | 关闭 |

开关方式：搜索 `TEST*_ENABLED`，改 `true/false`。

---

## 2) 自动化测试入口

```bash
cd shared && npm test
cd server && npm test
```

专项清单：
- `docs/TEST_CHECKLIST_SPELL.md`
- `docs/TEST_CHECKLIST_SHIKIGAMI.md`
- `docs/MULTIPLAYER_SCENARIOS.md`

---

## 3) GM 测试（HTTP API）

服务地址：`http://localhost:3001`（GET）

| 指令 | 功能 | 路径 |
|------|------|------|
| GM1 | 添加测试卡组(1+2+3+3) | `/api/gm/addcards/:roomId/:playerId` |
| GM2 | 加卡到手牌 | `/api/gm/addcard/:roomId/:playerId/:cardName/:count` |
| GM3 | 替换式神 | `/api/gm/setshikigami/:roomId/:playerId/:slotIndex/:shikigamiName` |
| GM4 | 替换场上妖怪 | `/api/gm/setyokai/:roomId/:slotIndex/:yokaiName` |
| GM5 | 加卡到弃牌堆 | `/api/gm/discard/:roomId/:playerId/:cardName/:count` |
| GM6 | 增加伤害值 | `/api/gm/adddamage/:roomId/:playerId/:damage` |
| GM7 | 替换鬼王 | `/api/gm/setboss/:roomId/:bossName` |

返回：

```json
{ "success": true }
{ "success": false, "error": "错误原因" }
```

---

## 4) GM 测试（游戏内输入）

> 在游戏聊天输入框中输入 `/` 开头指令

- 输入位置：右侧信息区底部聊天栏
- 触发：`/xxx` 后回车或点击发送
- 显示：`⚙️ [GM] ...`（仅发送者可见）
- 冷却：不受聊天 5 秒冷却限制

当前可用：

| 指令 | 作用 |
|------|------|
| `/help` | 查看可用指令 |
| `/status` | 查看房间状态和玩家数 |
| `/ping` | 连通性检查 |

实现位置：
- 服务端：`server/src/socket/SocketServer.ts` -> `executeGMCommand()`
- 单人本地：`client/src/App.vue` -> `handleLocalGMCommand()`

---

## 5) 当前手测建议（最小集）

1. 发送普通聊天，确认全房间可见。
2. 连续发送两条聊天，确认第2条受5秒冷却。
3. 输入 `/help`，确认显示 GM 结果且仅自己可见。
4. 使用 test4/test2-1 验证御魂与阴阳术测试流程。

---

## 6) TDD 复盘记录

> 目标：记录 TDD 未能捕获的 bug，分析原因并改进测试策略

### 2025-01-xx：树妖弃牌未触发

| 项目 | 内容 |
|------|------|
| **Bug 描述** | 树妖效果应为「抓牌+2 → 弃置1张手牌」，但实际游戏中触发妖怪后仅抓牌，未弹出弃牌选择 UI |
| **TDD 状态** | ✅ 通过（`YokaiEffects.test.ts` 中树妖测试全绿） |
| **根因** | **服务端重复实现**。`server/src/game/MultiplayerGame.ts` 的 `switch(effectKey)` 中有独立的树妖逻辑，直接执行 `player.hand.shift()` 自动弃牌，绕过了 `shared/game/effects/YokaiEffects.ts` 的选择逻辑 |
| **为何未测到** | TDD 测试的是 `shared` 层的纯函数效果，而服务端的 switch-case 硬编码逻辑属于另一个代码路径，两者从未交汇 |

#### 教训与改进

1. **架构层面**：服务端 `MultiplayerGame.ts` 中存在大量与 `shared/YokaiEffects.ts` 重复的 switch-case 逻辑，形成了**测试盲区**。应逐步重构，让服务端调用 `shared` 的 `executeYokaiEffect()` 并通过 `pendingChoice` 回调处理交互。

2. **测试层面**：
   - 单元测试仅覆盖 shared 层 → **需要增加集成测试**验证 server 实际调用路径
   - 可考虑在 `server/` 添加集成测试，模拟完整的 socket 事件流

3. **临时缓解**：在修改服务端 switch-case 时，**必须同步检查 shared 层是否已有正确实现**，避免重复造轮子。

#### 修复内容

| 文件 | 修改 |
|------|------|
| `server/src/game/MultiplayerGame.ts` | 树妖 case 改为设置 `pendingChoice: { type: 'treeDemonDiscard' }`，等待玩家选择 |
| `server/src/game/MultiplayerGame.ts` | 新增 `handleTreeDemonDiscardResponse()` 处理玩家选择 |
| `server/src/socket/SocketServer.ts` | 新增 `game:treeDemonDiscardResponse` 事件监听 |
| `client/src/App.vue` | 新增 `treeDemonDiscard` pendingChoice UI 处理 |

---

## 7) 已修复 Bug 简要记录

> 所有 `bug：XXX` 格式提交的问题，修复后在此简要记录原因

| 日期 | 问题 | 根因 | 修复 |
|------|------|------|------|
| 2026-03 | **退治/超度选择改为默认退治** | 规则简化：HP降为0时不再弹出退治/超度选项，直接退治（进弃牌堆） | 服务端 `handleAllocateDamage`/`handleAttackBoss` 击杀后直接退治；移除 `pendingDeathChoices`/`pendingBossDeath` 逻辑；客户端移除选择弹窗；`endTurn` 不再需要自动退治兜底 |
| 2025-03 | **树妖弃牌未触发** | 服务端 switch-case 直接 `shift()` 跳过选择 | 改用 `pendingChoice` 触发弃牌选择 UI |
| 2025-03 | **赤舌置顶牌对手不可见** | 牌库操作后未更新 `revealedDeckCards` | 在 YokaiEffects.ts 中为对手添加 `revealedDeckCards` 记录 |
| 2025-03 | **聊天界面不自动滚动** | `userIsAtBottom` 是普通变量非 `ref`，响应式失效 | 改为 `ref(true)` 并在 `onMounted` 初始化滚动 |
| 2025-03 | **树妖【触】技能未生效** | 弃牌逻辑分散，各处 `discard.push` 未统一检测【触】 | 重构为 `discard(card, type)` 原子函数，内置【触】检测 |
| 2025-03 | **日女巳时没有弹出选择** | 服务端 switch-case 直接执行 `伤害+2`，跳过选择 | 改用 `pendingChoice: { type: 'rinyuChoice' }` 触发三选一UI |
| 2025-07 | **蚌精超度未触发** | 服务端 switch-case 直接 `drawCards(2)` 跳过超度选牌 | 改用 `pendingChoice: { type: 'bangJingExile' }` 触发超度选牌UI |

---

