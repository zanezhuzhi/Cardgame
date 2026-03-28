# 📊 御魂传说 - 项目进度表

> **最后更新**: 2026-03-28  
> **数据版本**: v0.3.0+（以 `shared/data/cards.json` 为准）  
> **测试状态**: ✅ **shared 1038** + **server 86** 通过（`cd shared && npm test`、`cd server && npm test`）；CI：`.github/workflows/test.yml`  

**与总览不一致时**：以本仓库代码与上述自动化测试为准；对外摘要见根目录 **[README.md](README.md)**。

---

## 🎯 核心进度

| 模块 | 进度 | 说明 |
|------|:----:|------|
| 📦 数据层 | **100%** | 400 张卡牌与策划数据同步；一致性/加载器测试在 shared |
| 🎮 游戏引擎（共享） | **~90%** | 回合三阶段、`GameManager`、`EffectEngine`、伤害分配、式神获取/置换；式神 24、鬼王 10、妖怪 38 效果主逻辑已落地并有单测 |
| 🖥️ 前端 UI | **~60%** | 主界面、大厅、Socket、弹窗与基础交互具备；【已打出区】【已击杀标记】动效/音效仍缺 |
| 🌐 多人网络 | **~55%** | `SocketServer`、`MultiplayerGame`、房间、聊天/GM、回合超时与托管；集成/回归测在 server；客户端联调与边界仍迭代 |

---

## ✅ 已完成（摘要）

### 数据层
- [x] 卡牌数据库 `cards.json`（400 张）
- [x] 数据加载器与导出（`shared/data`）
- [x] 卡牌/式神一致性等数据向测试（含于 shared Vitest 套件）

### 游戏引擎（shared）
- [x] 回合流程（鬼火 → 式神调整 → 行动，具体命名以 `GameState` / 策划为准）
- [x] `DeckManager`、`GameManager`、`EffectEngine`、`TempBuff`
- [x] 伤害分配（含来源类型等类型定义；细项见 `DamageSource` 与备忘录）
- [x] 式神获取与置换（含服务端按钮与流程测试）
- [x] `ShikigamiSkills` — 式神技能 **24/24**
- [x] `BossEffects` — 鬼王相关 **10/10**
- [x] `YokaiEffects` — 妖怪御魂 **38/38**（含地藏像、轮入道等特殊链）
- [x] 阴阳术基础/中/高级获取与超度区逻辑（见 `SpellAcquire.test.ts` 与多人侧实现）

### 服务端（多人）
- [x] 房间与 Socket 事件入口；多人游戏状态机与大量 `handle*` 流程
- [x] 妖怪/回合流集成测：`yokaiEffects.integration.test.ts`、`gameFlow.integration.test.ts`
- [x] 计时、托管、掉线保护等：`turnTimeoutHosting.test.ts`

### 前端
- [x] 游戏主界面、Lobby、`SocketClient`、单人适配与基础战场交互
- [x] 开发调试：`?devPanel=1`（`DevTestPanel.vue`）

### 工程化
- [x] GitHub Actions 单元测试工作流
- [x] `tools/test-gui`（Electron）、`tools/run-tests.bat`（批跑 shared + server）

### 文档
- [x] 策划侧：规则说明书、交互、美术规范、卡牌专题文档等
- [x] 技术侧：`docs/design/*`、多人架构、**`docs/testing/test-specification.md`**、**`docs/testing/test-enhancement-plan.md`**、`docs/design/testset.md`

---

## 🔜 待实现 / 待加强

### P0 — 规则与引擎细项（备忘录与高优先级）

| # | 项 | 状态 | 备注 |
|:-:|----|:----:|------|
| A | 伤害来源贯通 | 🟡 | `DamageSourceType` 已有；镜姬等需「阴阳术伤害 vs 其他」全链路一致（见 `策划文档/备忘录.md`） |
| B | 妨害/效果标签 | 🟡 | 青女房、铮等展示/抵抗需 `EffectTag` 类体系（备忘录） |
| C | 回合打出历史 | 🟡 | 三味/破势/薙魂等依赖「本回合已打出牌」统计时，`TurnHistory` 等与状态机对齐（备忘录） |
| D | 有效生命 / 临时 HP | 🟡 | 网切等与 `getEffectiveHp()` 统一（备忘录） |

### P1 — 产品与 UI

| # | 项 | 状态 | 备注 |
|:-:|----|:----:|------|
| 1 | **已打出区**单独展示 | 🔴 | 与规则说明书一致；备忘录 2026-03-25 |
| 2 | **已击杀**标记与退治/超度选择 UI | 🔴 | 大号标记与分支交互 |
| 3 | 地藏像等 **确认流/AI** | 🟡 | 引擎侧有注册；客户端确认/dialog 与联机一致性需持续验收 |
| 4 | 胜利结算与断线表现 | 🟡 | `GameManager` 有结束与声誉排序；多人断线、重连与展示需手测与补测 |

### P2 — 体验与测试债

| # | 项 | 状态 | 备注 |
|:-:|----|:----:|------|
| 5 | 动画 / 音效 | 🔴 | 见 `docs/CLIENT_VISUAL_FX_TECH_PLAN.md` |
| 6 | Socket 层专项单测 | 🟡 | 见 `docs/testing/test-enhancement-plan.md` |
| 7 | AI 决策单测 | 🟡 | 同上 |

---

## 📈 测试覆盖（概况）

Vitest：**shared** 与 **server** 分仓配置；**不要**使用根目录已废弃的「单次 `npx vitest run` 跑全仓」假设。

| 范围 | 用例数（约） | 命令 | 说明 |
|------|-------------:|------|------|
| **shared** | **1038** | `cd shared && npm test` | 妖怪/式神/鬼王/引擎/数据一致性/Hp 等 |
| **server** | **86** | `cd server && npm test` | `MultiplayerGame`、阴阳术获取、集成测、日志与托管等 |

图形化批跑：**[tools/README.md](tools/README.md)**（`test-gui`、`run-tests.bat`）。

---

## 📦 数据库概览

| 类型 | 数量 | 多人专属 |
|------|:----:|:--------:|
| 阴阳师 | 6 | - |
| 式神 | 24 | 6 |
| 阴阳术 | 80 | - |
| 招福达摩 | 18 | - |
| 恶评 | 30 | - |
| 鬼王 | 10 | 3 |
| 妖怪 | 38 | 若干 |
| **总计** | **400** | |

---

## 🔧 快速命令

```bash
# Shared 测试
cd shared && npm test

# Server 测试
cd server && npm test

# 本地开发（两终端）
cd server && npm run dev
cd client && npm run dev
```

---

## 📝 最近更新记录

### 2026-03-28
- 与仓库现状对齐：核心效果（式神/鬼王/妖怪）标为已完成；多人网络标为迭代中。
- 更新测试数量为 shared **1038**、server **86**；补充 CI、`tools/test-gui`、测试文档索引。
- 待办改为「备忘录细项 + UI + 测试债」，避免与已实现的 P0 表冲突。

### 历史（2024-03-20 及更早）
- 回合与伤害分配规则、式神获取/置换、妖怪数据同步等（保留作档案；细节以当前代码为准）。

---

*模块表由开发维护；**权威规则**始终在 `策划文档/`。*
