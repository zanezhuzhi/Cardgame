# 卡牌关键词贯通与三味结算 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `cards.json` 的 `subtype`（`御魂/鬼火`）解析为 `CardInstance.keywords`，按 spec 定义「鬼火」牌，并修正服务端（及单机）**三味**统计与同路径实例化。

**Architecture:** 在 `shared` 增加**无状态**工具 `parseSubtypeToKeywords` + `cardHasKeyword`；`createYokaiInstance` 与 **服务端/客户端** `createCardInstance(yokai)` 统一写入 `keywords`；`MultiplayerGame` 三味分支改为使用 `cardHasKeyword(c,'鬼火')` 与 `spell`，删除对 `tags`/`subtype` 字符串的零散判断。

**Tech Stack:** TypeScript、Vitest、`shared` ↔ `server` ↔ `client` 现有路径；权威 spec：`docs/superpowers/specs/2026-03-29-card-keywords-design.md`。

---

## 文件结构（将创建 / 修改）

| 路径 | 职责 |
|------|------|
| `shared/game/cardKeywords.ts` | `parseSubtypeToKeywords(subtype?: string): string[]`、`cardHasKeyword(card: Pick<CardInstance,'cardType'|'keywords'>, kw: string): boolean`；可选 `keywordsFromYokaiSource(card: { subtype?: string; keywords?: string[] }): string[]`（若 JSON 同时存在 `keywords` 数组则合并或优先，spec 建议：**显式数组优先，否则解析 subtype**） |
| `shared/game/cardKeywords.test.ts`（或 `shared/game/__tests__/cardKeywords.test.ts`） | 解析边界、鬼火判定 |
| `shared/data/loader.ts` | `createYokaiInstance` 设置 `keywords: keywordsFromYokaiSource(card)` |
| `server/src/game/MultiplayerGame.ts` | `createCardInstance` 在 `yokai` 分支填充 `keywords`；`case '三味'` 统计循环改用 `cardHasKeyword` + `spell` |
| `client/src/game/SinglePlayerGame.ts` | `createCardInstance` 对 `yokai` 填充 `keywords`（与 shared 同一函数，避免复制粘贴） |
| `shared/types/cards.ts` | 若 `YokaiCard` 与 `cards.json` 不一致：`YokaiCard` 增加可选 `subtype?: string`（JSON 已有），与 `keywords` 并存时文档注释说明优先级 |
| `策划文档/游戏规则说明书.md` | 新增「关键词与类型标签」玩家可读小节（§2.1–§2.2 级内容） |
| `策划文档/卡牌数据/妖怪卡.md` 或 `卡牌开发.md` | 一句：关键词列 ⟷ `subtype`；运行时以 `keywords` 为准 |
| `shared/data/cards.json` | 抽样核对；若某张卡文案引用「鬼火」牌但缺 `鬼火` 于 subtype，按策划补齐（**全表扫描**，不仅薙魂） |
| `server/src/game/__tests__/` 或 `shared/game/effects/__tests__` | 三味 + 薙魂（或带鬼火 subtype 的牌）集成/单元用例 |

---

### Task 1: `cardKeywords` 纯函数 + 单元测试

**Files:**
- Create: `shared/game/cardKeywords.ts`
- Create: `shared/game/cardKeywords.test.ts`（路径与现有 shared 测试惯例一致即可）
- Modify: `shared/types/cards.ts`（若需为 `YokaiCard` 增加 `subtype?: string`）

- [ ] **Step 1: 写失败测试** — `parseSubtypeToKeywords('御魂/鬼火')` → `['御魂','鬼火']`；空串/undefined → `[]`；`cardHasKeyword({ cardType:'yokai', keywords:['鬼火'] }, '鬼火')` → true；spell/无 keywords → false。

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd shared && npx vitest run shared/game/cardKeywords.test.ts`（或项目内对等路径）  
Expected: FAIL（函数未导出或未实现）

- [ ] **Step 3: 最小实现** — 实现解析（split `/`、trim、filter 空串）；`cardHasKeyword` 仅对 yokai 检查 `keywords?.includes(kw)`（spec：鬼火牌仅 yokai）。

- [ ] **Step 4: 运行测试 GREEN**

Run: 同上 vitest  
Expected: PASS

- [ ] **Step 5: Commit** — `git add shared/game/cardKeywords.ts shared/game/cardKeywords.test.ts shared/types/cards.ts` → `test: card keywords parse and hasKeyword`

---

### Task 2: `createYokaiInstance` 写入 `keywords`

**Files:**
- Modify: `shared/data/loader.ts`（`createYokaiInstance`）

- [ ] **Step 1: 在 `createYokaiInstance` 中** `import { keywordsFromYokaiSource }` 或内联调用 `parseSubtypeToKeywords(card.subtype)`；若 TS 报错 `YokaiCard` 无 `subtype`，先在 `YokaiCard` 上增加 `subtype?: string`（与 JSON 一致）。

- [ ] **Step 2: 回归** — `cd shared && npx vitest run`（或至少 `loader`/GameManager 相关测试若存在）

Expected: PASS

- [ ] **Step 3: Commit** — `feat(shared): propagate yokai keywords on instance creation`

---

### Task 3: 服务端 `MultiplayerGame.createCardInstance`（yokai）

**Files:**
- Modify: `server/src/game/MultiplayerGame.ts`（约 713–741 行）

- [ ] **Step 1: 从 `@shared/game/cardKeywords` 或相对路径 import**（与项目别名一致）；当 `type === 'yokai'` 时对 `card.subtype` 调用 `parseSubtypeToKeywords`，赋值 `keywords`。

- [ ] **Step 2: 跑 server 测试** — `cd server && npx vitest run src/game/MultiplayerGame.test.ts src/game/__tests__`

Expected: PASS

- [ ] **Step 3: Commit** — `fix(server): copy yokai keywords from subtype in createCardInstance`

---

### Task 4: 客户端 `SinglePlayerGame.createCardInstance`（yokai）

**Files:**
- Modify: `client/src/game/SinglePlayerGame.ts`（约 236 行附近）

- [ ] **Step 1: 与同 Task 3 一致**，为 yokai 填充 `keywords`（import 来自 `shared`，注意 client 对 shared 的引用方式与现有一致）。

- [ ] **Step 2: Lint / 构建**（若项目有 `npm run build -w client`）

- [ ] **Step 3: Commit** — `fix(client): yokai instances include keywords from subtype`

---

### Task 5: 三味逻辑（`MultiplayerGame.executeYokaiEffect`）

**Files:**
- Modify: `server/src/game/MultiplayerGame.ts`（`case '三味':` 块，约 5068+）

- [ ] **Step 1: 写失败测试** — 例如：构造玩家 `played` 含 **薙魂实例**（`keywords` 含鬼火）与 **兵主部**（仅御魂无鬼火），打出 **三味** 后期望伤害差为 **仅鬼火牌数×2 + 阴阳术数×2**（具体用例数字在测试内写死）。

  - 文件建议：`server/src/game/__tests__/sanmiKeywords.integration.test.ts` 或扩展现有 Yokai 集成测试。
  - 注意：**必须用带 `keywords` 的实例**（通过 `game.createCardInstance` 私有方法不可用则通过 **公开路径** 打牌或使用 harness 反射，与同文件其它测试一致）。

- [ ] **Step 2: RED** — 运行该测试，确认用旧逻辑时失败或断言暴露漏计薙魂。

- [ ] **Step 3: 实现** — 遍历 `player.played`：`spell` 计 1；`yokai && cardHasKeyword(card,'鬼火')` 计 1；**移除** `tags` 与 `subtype.includes` 的临时写法。

- [ ] **Step 4: GREEN** — 全量相关 vitest 通过。

- [ ] **Step 5: Commit** — `fix(server): 三味 counts 鬼火 yokai by keywords`

---

### Task 6: 幽谷响等处的 `keywords` 引用（轻量）

**Files:**
- Modify: `server/src/game/MultiplayerGame.ts`（幽谷响 AI 评分处若有 `c.keywords`，确认实例现已有 `keywords`；若曾用 `kw.includes('鬼火')` 而 `keywords` 曾为空，无需改逻辑仅验证）

- [ ] **Step 1: Grep** `tags`、`.subtype`、鬼火.*御魂 于 `MultiplayerGame.ts` 与 `shared/game/effects`，**能统一则改用 `cardHasKeyword`**

- [ ] **Step 2: 测试**

- [ ] **Step 3: Commit**（若有实质改动）

---

### Task 7: 策划文档 + `cards.json` 核对

**Files:**
- Modify: `策划文档/游戏规则说明书.md`
- Modify: `策划文档/卡牌数据/妖怪卡.md` 或 `卡牌开发.md`
- Modify: `shared/data/cards.json`（仅当表与 JSON 不一致时）

- [ ] **Step 1: 规则书** — 新增「关键词与『鬼火』牌」短节（玩家可读）。

- [ ] **Step 2: 卡牌表** — 声明关键词列与 `subtype` 对齐。

- [ ] **Step 3: 全表 scan** — `yokai` 每条 `subtype` 与 `妖怪卡.md` 关键词列一致；修正遗漏。

- [ ] **Step 4: Commit** — `docs: 关键词规则与 cards 表对齐`

---

## 验收清单（人工）

- [ ] 对局打出 **薙魂** → **三味**：伤害 +2（若本回合仅多 1 张鬼火牌 + 三味自身前的计数正确按 spec）。
- [ ] **灯笼鬼**（若 subtype 含鬼火）计入；**兵主部**（无鬼火）不计入。
- [ ] `GameManager` / `createYokaiInstance` 路径牌堆生成的实例含 `keywords`。

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-29-card-keywords.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每任务派生子代理，任务间 review；REQUIRED：`superpowers:subagent-driven-development`
2. **Inline Execution** — 本会话按 Task 顺序执行；REQUIRED：`superpowers:executing-plans`

**Which approach?**（可在下一条消息回复 `1` 或 `2`，或直接说「按任务实现」默认 inline。）
