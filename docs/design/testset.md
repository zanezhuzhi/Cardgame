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

### 2026-03-28：多人返魂香 — pendingChoice 归属非行动者 + AI 步进漏判

| 项目 | 内容 |
|------|------|
| **Bug 描述** | 打出返魂香后，被问起的一方（尤其机器人）不出现交互；出牌方一直等待，提示需先完成当前选择，对局形同卡死 |
| **易混表现** | 日志里已有「[妨害] 某某 需要选择：弃牌或获得恶评」，但 AI 永远不会提交选择；真人出牌方仍被全局 `pendingChoice` 锁住 |
| **根因** | ① `pendingChoice.playerId` 是**被妨害的对手**，不是 `currentPlayerIndex`。② `SocketServer.runAiTurnStep` 原逻辑只在「**当前回合座位**为 AI/托管」时运行；人类回合内挂起的 `fanHunXiangChoice` 不会触发 AI 代答，队列无法前进 |
| **为何单测易漏** | `MultiplayerGame.handleFanHunXiangChoiceResponse` 与客户端分支可单独正确；缺的是 **「状态更新后 AI 步进是否覆盖非当前回合的 pending」** 的集成/烟囱断言 |
| **修复** | 在 `runAiTurnStep` 开头优先判断：`pendingChoice.type === 'fanHunXiangChoice'` 且被询问者为 AI/离线托管 → 调用 `handleFanHunXiangChoiceResponse`（有手牌优先选弃牌）。服务端 `notifyStateChange` 会继续广播并 `scheduleAiTurn` |

#### 教训（避免同类复发）

1. **凡 `pendingChoice.playerId !== currentPlayer`** 的交互，AI/托管逻辑必须与「是否当前回合座位」解耦；不应只在 `pc.playerId === cur.id` 分支里处理。
2. 新增妨害类 pending 时，在 `docs/design/testset.md` 与本节补一条：**谁是 pending 的「责任座位」、AI 是否在人类回合也要代答**。
3. 建议在 `server` 增加一条测试：人类当前回合 + AI 对手 + `fanHunXiangChoice`，断言一步内 `pendingChoice` 被清空或进入下一对手。

#### 延伸（待修复）：持有「铮」时受妨害不触发（多人）

| 项目 | 内容 |
|------|------|
| **现象** | 手牌有「铮」时，对手妨害（含返魂香二选一）直接进妨害本身的选择/结算，**不出现**「是否弃置铮抵消」的抵抗交互 |
| **根因（设计文档已写管线，服务端未接）** | `shared/game/effects/HarassmentPipeline.ts` 已定义铮/青女房等妨害抵抗；`shared/types/pendingChoice.ts` 有 `harassmentResist`。但 `MultiplayerGame.startFanHunXiangHarassment` 等路径**直接** `processNextFanHunXiangOpponent` / `fanHunXiangChoice`，**未先**走妨害统一管线，与策划文档中「返魂香可被铮抵消」不一致 |
| **改进方向** | 长期仍应妨害入口统一走 `HarassmentPipeline`；短期已在返魂香流程实现与管线一致的青女房→铮→返魂香二选一（`server/.../fanHunXiangResist.integration.test.ts`） |

---

## 7) 已修复 Bug 简要记录

> 所有 `bug：XXX` 格式提交的问题，修复后在此简要记录原因

| 日期 | 问题 | 根因 | 修复 |
|------|------|------|------|
| 2026-03 | **多人返魂香：对手无反馈、出牌方卡死** | `fanHunXiangChoice` 挂在被妨害者；`runAiTurnStep` 仅在「当前回合座位」为 AI 时执行，人类出牌时从不代 AI 应答 | `SocketServer.runAiTurnStep` 开头对 AI/托管被询问者调用 `handleFanHunXiangChoiceResponse`（见 §6 复盘） |
| 2026-03 | **多人持有铮时受返魂香妨害不触发抵抗** | 同上；曾用手写 `harassmentHandResist` | **已修**：返魂香改走 `resolveHarassment`，统一 `harassmentPipelineChoice` + `game:harassmentPipelineChoiceResponse`（旧事件名仍转发） |
| 2026-03 | **退治/超度选择改为默认退治** | 规则简化：HP降为0时不再弹出退治/超度选项，直接退治（进弃牌堆） | 服务端 `handleAllocateDamage`/`handleAttackBoss` 击杀后直接退治；移除 `pendingDeathChoices`/`pendingBossDeath` 逻辑；客户端移除选择弹窗；`endTurn` 不再需要自动退治兜底 |
| 2025-03 | **树妖弃牌未触发** | 服务端 switch-case 直接 `shift()` 跳过选择 | 改用 `pendingChoice` 触发弃牌选择 UI |
| 2025-03 | **赤舌置顶牌对手不可见** | 牌库操作后未更新 `revealedDeckCards` | 在 YokaiEffects.ts 中为对手添加 `revealedDeckCards` 记录 |
| 2025-03 | **聊天界面不自动滚动** | `userIsAtBottom` 是普通变量非 `ref`，响应式失效 | 改为 `ref(true)` 并在 `onMounted` 初始化滚动 |
| 2025-03 | **树妖【触】技能未生效** | 弃牌逻辑分散，各处 `discard.push` 未统一检测【触】 | 重构为 `discard(card, type)` 原子函数，内置【触】检测 |
| 2025-03 | **日女巳时没有弹出选择** | 服务端 switch-case 直接执行 `伤害+2`，跳过选择 | 改用 `pendingChoice: { type: 'rinyuChoice' }` 触发三选一UI |
| 2025-07 | **蚌精超度未触发** | 服务端 switch-case 直接 `drawCards(2)` 跳过超度选牌 | 改用 `pendingChoice: { type: 'bangJingExile' }` 触发超度选牌UI |

---

## 8) 开发问题与注意事项汇总

> 以下是开发过程中遇到的典型问题和设计陷阱，用自然语言描述便于后续开发者理解和避免。

### 8.1 架构层面的"双重实现"陷阱

**问题描述**：在项目早期，`shared/game/effects/YokaiEffects.ts` 和 `server/src/game/MultiplayerGame.ts` 中分别实现了相同卡牌效果的逻辑。这导致测试只覆盖了 shared 层的纯函数，而服务端的 switch-case 硬编码逻辑从未被验证。

**典型表现**：树妖、日女巳时、蚌精等卡牌在单元测试中全部通过，但实际游戏中行为错误（如交互选择被跳过）。

**根因分析**：服务端直接通过 switch-case 执行效果，绕过了 shared 层定义的带交互的完整逻辑。

**解决方案**：
- 确保服务端调用 `shared` 层的 `executeYokaiEffect()` / `ShikigamiSkillEngine` 统一入口
- 任何需要玩家交互的效果必须通过 `pendingChoice` 状态机协调
- 新增效果时禁止在服务端重复实现相同逻辑

---

### 8.2 pendingChoice 交互机制的三处同步

**问题描述**：每当新增一种 pendingChoice 类型（如 `treeDemonDiscard`、`bangJingExile`），必须同时修改三个位置，否则交互流程会断裂。

**必改位置**：
1. `server/src/game/MultiplayerGame.ts` — 设置 `pendingChoice` + 新增 `handleXxxResponse()` 处理函数
2. `server/src/socket/SocketServer.ts` — 新增 `socket.on('game:xxxResponse')` 事件监听
3. `client/src/App.vue` — 在 `watch(gameState)` 中添加对应 UI 弹窗逻辑

**防遗漏建议**：在卡牌具体文档中预先定义所需的 pendingChoice 类型，开发时对照检查。

---

### 8.2b 多人妨害：`pendingChoice` 责任座位与 AI 步进

**问题描述**：部分妨害把 `pendingChoice` 挂在**对手**（非 `currentPlayerIndex`），若只在「当前回合是 AI」时才执行 `runAiTurnStep` 内的代答，会导致人类出牌、AI 被问时永远无人应答，全局交互锁死（返魂香为典型）。

**规则**：

- 实现 AI/托管代答时，按 **`pendingChoice.playerId`** 判断是否代答，不要默认等于「当前回合玩家」。
- 文档与 PR 中写清：该 pending 的**责任客户端**是谁、超时与托管如何收口。

**相关**：`HarassmentPipeline`、`harassmentResist`（铮/青女房）未接入服务端妨害路径时，抵抗根本不出现，见 §6「铮延伸」。

---

### 8.3 妖怪【触】被动技能的统一检测

**问题描述**：部分妖怪（如树妖、食发鬼、影鳄）拥有"在弃牌堆时触发"的【触】效果。早期各处 `discard.push()` 调用分散，未统一检测【触】导致效果遗漏。

**解决方案**：将弃牌操作重构为 `discardCard(card, source)` 原子函数，内置【触】检测逻辑。所有弃牌操作必须通过此函数执行。

---

### 8.4 牌库操作后的可见性同步

**问题描述**：赤舌等卡牌会将牌置顶并"公开给对手查看"。如果仅执行 `deck.unshift()` 而不更新 `revealedDeckCards`，对手将看不到应公开的信息。

**解决方案**：任何"公开查看"类效果必须同时更新 `revealedDeckCards` 数据结构，确保客户端正确渲染对手的已知牌信息。

---

### 8.5 Vue 响应式陷阱

**问题描述**：聊天界面的自动滚动功能失效，原因是 `userIsAtBottom` 被定义为普通 JavaScript 变量而非 `ref()`，导致响应式追踪失败。

**通用建议**：
- 任何需要在模板中使用或在 watch/computed 中追踪的变量必须使用 `ref()` 或 `reactive()`
- 在 `onMounted` 中初始化涉及 DOM 操作的状态

---

### 8.6 技术框架文档索引

当前已建立的技术框架文档，涵盖了各类卡牌的实现规范：

| 框架 | 文档 | 说明 |
|------|------|------|
| 式神引擎 | [shikigami-framework.md](shikigami-framework.md) | 24个式神的技能引擎、事件钩子、妨害抵抗管线 |
| 妖怪效果 | [yokai-framework.md](yokai-framework.md) | 38个妖怪的效果注册、EffectContext 上下文 |
| 鬼王效果 | [boss-framework.md](boss-framework.md) | 10个鬼王的阶段系统、来袭/御魂效果 |

---

### 8.7 待解决的技术债务

| 优先级 | 问题 | 影响范围 | 备注 |
|:------:|------|----------|------|
| 🔴高 | 伤害来源类型系统 | 镜姬【妖】需区分阴阳术伤害/其他伤害 | 需实现 `DamageSource` 枚举 |
| 🔴高 | 妨害/来袭效果分类标签 | 青女房/铮等防御型卡牌 | 需实现 `EffectTag` 标签系统 |
| 🟡中 | 回合历史记录系统 | 三味/破势/薙魂等统计型卡牌 | 需在 GameState 添加 TurnHistory |
| 🟡中 | 动态HP计算系统 | 网切临时HP减益 | 需实现 `getEffectiveHp()` |
| 🟢低 | 多人模式交互请求 | RemoteAdapter.ts | 当前 TODO 标记 |

---

## 9) 御魂验收记录

> GM 手动测试步骤与验收结果

### 伤魂鸟 (yokai_035)

| 项目 | 内容 |
|------|------|
| **效果** | 超度X张手牌，伤害+2X |
| **生命** | 6 |
| **GM 测试步骤** | 1. `/api/gm/setyokai/:roomId/0/伤魂鸟` 设置场上妖怪 <br> 2. `/api/gm/addcard/:roomId/:playerId/伤魂鸟/1` 添加到手牌 <br> 3. 打出伤魂鸟，验证弹出手牌选择UI <br> 4. 选择0~N张牌超度，验证伤害=选择数×2 |
| **边界测试** | - 手牌为空时直接显示"伤害+0" <br> - AI自动选择低价值牌超度（恶评优先） |
| **pendingChoice** | `shangHunNiaoExile` |
| **响应事件** | `game:shangHunNiaoResponse { selectedIds: string[] }` |
| **轮入道兼容** | ✅ 两次独立选择 + 累计伤害 |
| **验收状态** | ⏳ 待测试 |


