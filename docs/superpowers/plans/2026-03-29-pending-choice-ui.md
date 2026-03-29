# Pending Choice 统一外壳与结算中部提示 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在电子客户端实现《游戏规则说明书》§5.5 与 spec `docs/superpowers/specs/2026-03-29-pending-choice-ui-design.md`：所有 `pendingChoice` 共用统一外壳（左来源、右上短说明+可展开全文、右下计时），并在关键结算步骤向指定玩家展示与日志同源的中部淡化提示。

**Architecture:** 在 `shared/types` 扩展 `PendingChoice` 公共元数据（`timerMode`、`sourceCard`/`sourceContext`、`stepSummary`）及可选的 `GameState.settlementToast`（或带 `toastRecipients` 的日志条目），由 `MultiplayerGame`（及必要时的单人路径）在写入 `pendingChoice` / 追加日志时填入权威信息。客户端新增 `PendingChoiceShell` 包装现有各 modal，`timerMode === 'turnTotal'` 时绑定现有 `turnCountdown`/`turnCountdownMax` 逻辑，`offTurnResponse` 时用 `outOfTurnFeedbackDeadlineAt`（已有）驱动 5 秒条。中部提示组件消费与右侧信息区相同的 `log` 流或专用 `settlementToast` 字段，按 `recipientPlayerIds` 过滤本地玩家。

**Tech Stack:** TypeScript、Vue 3（`client/src/App.vue` 与 `client/src/components/`）、共享包 `shared/`、服务端 Vitest（`server/npm run test`）。

**必读：** `docs/superpowers/specs/2026-03-29-pending-choice-ui-design.md`；`策划文档/游戏规则说明书.md` §5.4–5.5。

---

## 文件结构（将创建 / 修改）

| 路径 | 职责 |
|------|------|
| `shared/types/pendingChoice.ts` | `BasePendingChoice` 增加可选 `timerMode`、`stepSummary`、`sourceCard`、`sourceLabel?`（无卡时占位） |
| `shared/types/game.ts` | 可选 `settlementToast?: { message: string; recipientPlayerIds: string[]; timestamp: number }`（或等价命名）；若采用「日志带 toast 标记」则扩 `GameLogEntry` |
| `shared/types/game.d.ts` | 与 `game.ts` 同步 |
| `server/src/game/MultiplayerGame.ts` | 集中或分散地在设置 `pendingChoice` 时填充元数据；在效果链关键步推送 toast 与日志同源文案 |
| `shared/game/effects/*.ts`（按需） | 仅当 pending 在效果引擎内创建且服务端取不到上下文时，向上透传 `sourceCard`（优先在 MultiplayerGame 单点填充） |
| `client/src/components/PendingChoiceShell.vue`（新建） | 布局槽位：左 / 右上（含展开） / 右下计时 / 默认插槽主体 |
| `client/src/components/SettlementToast.vue`（新建） | 队列或单条、淡入淡出、不阻塞点击 |
| `client/src/App.vue` | 用 Shell 包裹现有 choice modals；挂载 Toast；从 `state` 监听 `settlementToast` 或带标记的 `log` |
| `server/src/game/__tests__/offTurnTimerAndFeedback.integration.test.ts`（或新文件） | 断言 `pendingChoice.timerMode` 与回合内外一致 |

---

### Task 1: 共享类型 — PendingChoice 元数据

**Files:**
- Modify: `shared/types/pendingChoice.ts`
- Modify: `shared/types/game.d.ts`（若工具链从声明生成需同步）
- Test: `server` 内需能通过类型检查（`npm run build --prefix server` 或现有引用）

- [ ] **Step 1: 在 `BasePendingChoice` 上增加可选字段**

```ts
/** 与 §5.5 对齐：本弹窗右下计时绑定方式 */
timerMode?: 'turnTotal' | 'offTurnResponse';
/** 右上默认短说明；缺省时客户端可回退到 `prompt` */
stepSummary?: string;
/** 左侧「来源」牌；无则客户端用 sourceLabel */
sourceCard?: import('./cards').CardInstance;
/** 无单卡来源时的占位标题，如「妨害响应」 */
sourceLabel?: string;
```

- [ ] **Step 2: 全仓库编译检查**

Run: `npm run build --prefix server`  
Expected: 无 TS 报错（若有引用需小修）

- [ ] **Step 3: Commit**

```bash
git add shared/types/pendingChoice.ts shared/types/game.d.ts
git commit -m "types: PendingChoice UI 元数据 timerMode/stepSummary/source"
```

---

### Task 2: GameState — 结算中部提示载体

**Files:**
- Modify: `shared/types/game.ts`
- Modify: `shared/types/game.d.ts`

- [ ] **Step 1: 增加 `settlementToast`**

```ts
/** 与信息栏同源文案；仅 recipientPlayerIds 含本机时显示中部提示 */
export interface SettlementToast {
  message: string;
  recipientPlayerIds: string[];
  /** 可选：与 GameLogEntry.logSeq 对齐便于对账 */
  logSeq?: number;
  timestamp: number;
}
// GameState 内：
settlementToast?: SettlementToast;
```

服务端在推送日志的**同一时刻**设置/替换该字段；下一状态快照可清空（或客户端读后即清，择一 documented）。

- [ ] **Step 2: Commit**

```bash
git add shared/types/game.ts shared/types/game.d.ts
git commit -m "types: GameState.settlementToast for mid-screen hint"
```

---

### Task 3: 服务端 — 填充 timerMode 与 source（TDD）

**Files:**
- Modify: `server/src/game/MultiplayerGame.ts`
- Modify/Test: `server/src/game/__tests__/offTurnTimerAndFeedback.integration.test.ts`

- [ ] **Step 1: 写失败测试**

在现有「对手 pending harassment」用例中追加：

```ts
expect(st.pendingChoice && 'timerMode' in st.pendingChoice ? st.pendingChoice.timerMode : undefined).toBe('offTurnResponse');
expect(st.pendingChoice?.playerId).toBe(p1.id);
```

另增一条：**本回合玩家**自己的 `yokaiTarget`（或任意仅当前回合玩家的 pending）期望 `timerMode === 'turnTotal'`（需用 harness 打牌推到该状态，可复用 `gameFlow.multiplayer.test.ts` 模式）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test --prefix server -- server/src/game/__tests__/offTurnTimerAndFeedback.integration.test.ts`  
Expected: `timerMode` 断言失败或 `undefined`

- [ ] **Step 3: 实现**

在 `MultiplayerGame` 内新增小函数，例如 `applyPendingChoiceUiMeta(choice: PendingChoice): PendingChoice`：

- 若 `choice.playerId === state.players[currentPlayerIndex].id` → `timerMode = 'turnTotal'`
- 否则 → `timerMode = 'offTurnResponse'`
- `sourceCard`：从当前效果上下文传入（需梳理 `setPendingChoice` 调用点）；首批可只填妨害/御魂打牌路径，其余填 `stepSummary: choice.prompt` 与已有 `card` 字段复用

所有赋值 `this.state.pendingChoice = ...` 的路径应经过该包装（或单一 setter）。

- [ ] **Step 4: 测试通过**

Run: `npm run test --prefix server`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/game/MultiplayerGame.ts server/src/game/__tests__/*.ts
git commit -m "feat(multiplayer): pendingChoice timerMode 与来源元数据"
```

---

### Task 4: 服务端 — settlementToast 与日志同源

**Files:**
- Modify: `server/src/game/MultiplayerGame.ts`（或当前 `pushLog` / 效果结算辅助函数）

- [ ] **Step 1: 在「多效果第二步 pending 之前」写测试**

例如：两效果御魂第一张结算完成、第二张弹窗前，状态中 `settlementToast.recipientPlayerIds` 含行动玩家，`message` 与非 private 日志一致（可 snapshot `message` 子串）。

- [ ] **Step 2: 实现**

扩展已有 `addLog`/`appendLog` 调用：在需中部提示时设 `state.settlementToast = { message, recipientPlayerIds, logSeq, timestamp: Date.now() }`；`recipientPlayerIds` 规则对齐 spec：**本人打牌**仅 `[currentActor]`；**回合外强制**为 `[pendingChoice.playerId]`。

- [ ] **Step 3: `npm run test --prefix server`**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(multiplayer): settlementToast 与日志同步"
```

---

### Task 5: 客户端 — PendingChoiceShell

**Files:**
- Create: `client/src/components/PendingChoiceShell.vue`
- Modify: `client/src/App.vue`（渐进：先包裹一个 modal 验证）

- [ ] **Step 1: 实现 Shell props**

`timerMode`, `turnCountdown`, `turnCountdownMax`, `offTurnDeadlineAt`（ms）, `stepSummary`, `fullRulesText`（展开用）, `sourceCard`, `sourceLabel`, `show`（或插槽外层由父级 v-if）

右下条逻辑：

- `turnTotal` 且 `turnCountdownMax > 0`：进度 = `turnCountdown / turnCountdownMax`；若无限时长（`max<=0`）显示文案「无限制」或隐藏条（与现有 `turn-countdown-bar` 一致）
- `offTurnResponse`：`progress = (deadline - now) / 5000` 用 `requestAnimationFrame` 或 `setInterval` 1s 更新

- [ ] **Step 2: 将一个简单 modal（如 `choiceModal` / yokaiChoice）包进 Shell**

确认布局不破原有按钮。

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PendingChoiceShell.vue client/src/App.vue
git commit -m "feat(client): PendingChoiceShell 首屏接入"
```

---

### Task 6: 客户端 — 其余 pending 全部接入 Shell

**Files:**
- Modify: `client/src/App.vue`（所有 `v-if` modal 与 `pendingChoice` 分支）

- [ ] **Step 1: 列出 App.vue 内所有 pending 相关 modal**（搜索 `pendingChoice?.type`、`*Modal.show`）

- [ ] **Step 2: 每个入口传入对应 `sourceCard`**（从 `newState.pendingChoice`）；`fullRulesText` 从 `shared/data` 或既有卡牌描述加载器获取（沿用卡牌悬停/详情的数据源）

- [ ] **Step 3: 手动联调 2 人房间**

验：妨害、本回合选目标、`stepSummary`/展开全文

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(client): 全部 pending modal 使用 Shell"
```

---

### Task 7: 客户端 — SettlementToast

**Files:**
- Create: `client/src/components/SettlementToast.vue`
- Modify: `client/src/App.vue`

- [ ] **Step 1: watch `state.settlementToast`**

若 `recipientPlayerIds.includes(myPlayerId)` 则入队播放 2–3s 动画；可与 `log` 最新一条去重（比较 `logSeq`）避免重复。

- [ ] **Step 2: 样式**

半透明面板、居中、`pointer-events: none`，与线框 `brainstorm-pending-choice-shell-v1.html` 一致方向即可。

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SettlementToast.vue client/src/App.vue
git commit -m "feat(client): settlementToast 中部提示"
```

---

### Task 8: 单人模式与其它入口

**Files:**
- Modify: `client/src/game/SinglePlayerGame.ts`（若本地状态含 pendingChoice，需同样带元数据或由客户端默认 `timerMode: 'turnTotal'`）

- [ ] **Step 1: 确认单机无 `outOfTurnFeedbackDeadlineAt` 时 Shell 不崩溃**

- [ ] **Step 2: Commit**（若需改）

```bash
git commit -m "fix(singleplayer): pending Shell 元数据默认"
```

---

### Task 9: 文档与收尾

**Files:**
- Modify: `策划文档/交互设计.md` §三、选择弹窗 — 增加一段指向 §5.5 + spec

- [ ] **Step 1: 简短补充交互设计文档**

- [ ] **Step 2: 最终验证**

Run: `npm run test:all`（根目录）  
Expected: shared + server 全通过

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: 交互设计补充 pending 外壳引用"
```

---

### Task 10: 御魂卡全量回归审阅（建议在 UI 改造合并前完成）

**目的：** 御魂已全部开发完成；pending 外壳与 `settlementToast` 改动后，确认每条御魂的 **打出 / 多段选择 / 妨害联动** 仍与《卡牌开发》§4.2 及单卡文档一致。

**建议步骤（可分配给测试或策划走查）：**

- [ ] 对照 `策划文档/卡牌数据/妖怪卡.md` 与 `卡牌具体文档/`：列出全部可打出御魂及对局内 **依赖 pending** 的卡种清单。
- [ ] **单人试玩**（`client` 本地）：对清单逐张验证 — 能否打出、无目标时是否灰置、每段弹窗是否正常关闭、日志是否合理。
- [ ] **多人 2 人房**（`?mode=multi`）：重点抽测 **多效果**（唐纸伞妖、天邪鬼赤/黄、树妖、河童、雪女、座敷等）、**妨害**（返魂香管线、赤舌对手弹窗）、**日女 / 轮入道 / 骰子鬼** 等；确认 **外壳计时**（本回合 vs 回合外 5s）与 **中部提示** 仅命中规则要求的玩家。
- [ ] 记录异常到 Issue/看板；修复后再合并发布分支。

**自动化（可选增强）：** 在 `server` 已有集成测上，按卡 ID 增补「打出后 `pendingChoice.type` + 一次响应」烟测（非本 Task 必须）。

---

## 计划审阅说明

本仓库未包含 `plan-document-reviewer` 子代理脚本；请在合并实现分支前由人工或 CR 对照 spec §2–§6 检查任务 3–4 是否覆盖全部 `setPendingChoice` 路径。

---

## 执行方式（请选择）

Plan 已保存至 `docs/superpowers/plans/2026-03-29-pending-choice-ui.md`。实现时可二选一：

1. **Subagent-Driven（推荐）** — 每个 Task 单独子代理 + 任务间审阅；技能：`superpowers:subagent-driven-development`  
2. **Inline Execution** — 本会话按 Task 顺序执行；技能：`superpowers:executing-plans`

你回复 **1**、**2** 或 **先只做 Task 1–3** 即可开始动代码。
