# 百鬼夜行 - Cardgame

[![Unit Tests](https://github.com/zanezhuzhi/Cardgame/actions/workflows/test.yml/badge.svg)](https://github.com/zanezhuzhi/Cardgame/actions/workflows/test.yml)

> 项目核心索引（开发上下文入口）

---

## 当前进度（快照 · 2026-03-28）

| 领域 | 状态 | 说明 |
|------|:----:|------|
| 共享逻辑与数据 | 稳定 | `shared/data/cards.json`（400 张）+ `EffectEngine` / 式神·妖怪·鬼王效果框架；**Vitest 1038** 条（`cd shared && npm test`） |
| 服务端多人 | 迭代中 | `SocketServer`、`MultiplayerGame`、房间、聊天/GM、回合超时与托管；**Vitest 86** 条（`cd server && npm test`），含 `gameFlow.integration`、`yokaiEffects.integration` 等 |
| 客户端 | 迭代中 | Vue3 大厅与对局、`SocketClient`、开发面板 `?devPanel=1`；**已打出区 / 已击杀标记 / 动效音效**等仍以策划与 `PROGRESS.md`、`策划文档/备忘录.md` 为待办跟踪 |
| CI | 已接 | GitHub Actions [test.yml](.github/workflows/test.yml)（文首徽章） |
| 本地验收工具 | 可用 | `tools/test-gui`（Electron 一键跑测）、`tools/run-tests.bat`（Shared + Server 批跑）；索引见 [tools/README.md](tools/README.md) |

**文档分工**：本 README 做**对外总览与命令入口**；模块勾选与历史记录见 `PROGRESS.md`；**规则权威**在 `策划文档/`。若进度表与代码或测试不一致，**以仓库实现与自动化测试为准**。

---

## 项目结构（核心）

```text
Cardgame/
├── client/                        # 前端 Vue3
│   └── src/
│       ├── App.vue                # 游戏主界面（日志/聊天/交互）
│       ├── views/Lobby.vue        # 大厅
│       ├── network/SocketClient.ts# Socket 客户端
│       ├── game/                  # 单人逻辑与适配器
│       └── router/index.ts
├── server/                        # 后端 Node + Socket.io
│   └── src/
│       ├── socket/SocketServer.ts # 事件入口（含聊天+GM指令）
│       ├── game/MultiplayerGame.ts# 多人游戏逻辑
│       ├── room/                  # 房间系统
│       └── types/index.ts
├── shared/                        # 共享类型/数据/效果引擎
│   ├── types/                     # game/cards/network 类型
│   ├── data/cards.json            # 卡牌数据源
│   └── game/effects/              # EffectEngine + 各类效果
├── docs/                          # 技术文档
│   ├── design/testset.md          # 测试条件与GM测试入口
│   ├── testing/                   # 测试规范与增强计划
│   ├── MULTIPLAYER_ARCHITECTURE.md
│   ├── MULTIPLAYER_SCENARIOS.md
│   └── CLIENT_VISUAL_FX_TECH_PLAN.md  # 客户端视觉/动效与 Pixi 分层方案
├── .github/workflows/             # CI（unit test 等）
├── tools/                         # 开发工具（与主界面解耦）
│   ├── README.md                  # 工具索引
│   ├── run-tests.bat              # 命令行批跑 Shared + Server 测试
│   ├── test-gui/                  # Electron 可视化测试面板
│   └── multiplayer-timer-gm.md    # 多人计时与托管 GM 手测
├── 策划文档/                       # 规则权威来源
│   ├── 游戏规则说明书.md
│   ├── AI匹配机制设计.md          # 快速匹配、AI 补位、大厅改造与策略分级
│   ├── 卡牌数据/
│   │   └── 卡牌开发.md            # 卡牌核心逻辑：实现准则与流程（开发必读）
│   ├── 交互设计.md
│   ├── 美术规范.md
│   ├── 备忘录.md
│   └── 界面ass/信息交互.md
└── PROGRESS.md                    # 进度跟踪
```

---

## 文档索引

### 规则（先看）
- **[卡牌开发.md](策划文档/卡牌数据/卡牌开发.md)**：卡牌核心逻辑开发准则（实现顺序、与数据/测试/文档的约束，**写效果与改牌前必读**）
- `策划文档/游戏规则说明书.md`：完整规则与胜负判定
- `策划文档/交互设计.md`：UI/UX 与交互约束
- **[AI匹配机制设计.md](策划文档/AI匹配机制设计.md)**：快速匹配、空位由 AI 填充、大厅改造与 AI 策略分级（**做大厅/匹配/补位前必读**）
- `策划文档/界面ass/信息交互.md`：日志、聊天、GM输入设计
- `策划文档/美术规范.md`：美术尺寸、命名与风格
- `策划文档/备忘录.md`：开发中零散需求与待办（随时追加，正式规格请写入对应专题文档）

### 技术（再看）

**卡牌效果技术框架**

| 框架 | 文档 | 说明 |
|------|------|------|
| 式神引擎 | [shikigami-framework.md](docs/design/shikigami-framework.md) | ShikigamiSkillEngine 架构、技能类型、事件钩子、妨害抵抗管线 |
| 妖怪效果 | [yokai-framework.md](docs/design/yokai-framework.md) | YokaiEffects 注册模式、EffectContext 上下文、38个妖怪索引 |
| 鬼王效果 | [boss-framework.md](docs/design/boss-framework.md) | Boss阶段系统、来袭/御魂效果、10个鬼王索引 |

**测试体系**

| 文档 | 说明 |
|------|------|
| [测试规范文档](docs/testing/test-specification.md) | 测试体系概览、命名规范、编写模板、CI配置 |
| [测试增强方案](docs/testing/test-enhancement-plan.md) | 薄弱模块分析、分阶段实施计划 |
| [testset.md](docs/design/testset.md) | 测试开关、GM测试流程、Bug记录 |

**其他技术文档**

- `tools/README.md`：根目录工具索引（手测清单等，与主界面解耦）
- `docs/MULTIPLAYER_ARCHITECTURE.md`：多人架构
- [AI匹配机制设计.md](策划文档/AI匹配机制设计.md)：匹配与 AI 补位的产品与交互规格（工程实现对照 `docs/MULTIPLAYER_ARCHITECTURE.md`）
- `docs/CLIENT_VISUAL_FX_TECH_PLAN.md`：逻辑稳定后的美化阶段——Vue 与 Pixi 分层、粒子与资源策略
- `PROGRESS.md`：模块级进度与历史（若与 README 快照冲突，以代码/测试为准）

### 关键代码
- `client/src/App.vue`
- `client/src/network/SocketClient.ts`
- `client/src/game/SinglePlayerGame.ts`
- `server/src/socket/SocketServer.ts`
- `server/src/game/MultiplayerGame.ts`
- `shared/types/game.ts`
- `shared/game/effects/EffectEngine.ts`

---

## 快速启动

```bash
# 安装依赖
cd shared && npm install
cd ../server && npm install
cd ../client && npm install

# 启动
cd ../server && npm run dev
cd ../client && npm run dev
```

---

## 测试体系

### 技术栈

| 组件 | 技术 | 配置位置 |
|------|------|----------|
| 测试框架 | Vitest | `shared/vitest.config.ts`, `server/vitest.config.ts` |
| 断言库 | Vitest 内置 | - |
| 覆盖率 | c8 / istanbul | `npm run test:coverage` |

### 当前覆盖情况（约 2026-03）

| 模块 | 状态 | 测试文件 / 说明 |
|------|:----:|-----------------|
| 妖怪效果 (YokaiEffects) | 良好 | `shared/game/effects/YokaiEffects.test.ts` 等 |
| 式神技能 (ShikigamiSkills) | 良好 | `shared/game/effects/ShikigamiSkills.test.ts` 等 |
| 数据一致性 | 良好 | `shared/data/cards.consistency.test.ts` 等 |
| HP / 伤害管线 | 良好 | `shared/game/effects/EffectiveHP.test.ts`、`HarassmentPipeline` 相关等 |
| 牌库与游戏状态 | 良好 | `DeckManager`、`GameManager`、`EffectEngine` 等（shared 合计 **1038** 条） |
| 服务端 `MultiplayerGame` | 推进中 | `MultiplayerGame.test.ts`、`SpellAcquire.test.ts`、`__tests__/gameFlow.integration.test.ts`、`yokaiEffects.integration.test.ts`、`turnTimeoutHosting.test.ts` 等（server 合计 **86** 条） |
| Socket 层单测 | 少 | 行为多由集成测与手测覆盖；专项用例仍待补充（见 [测试增强方案](docs/testing/test-enhancement-plan.md)） |

### 测试命令速查

```bash
# ===== shared 测试 =====
cd shared && npm test              # 运行所有测试
cd shared && npm test -- "狂骨"     # 按名称过滤
cd shared && npm run test:watch    # 监听模式
cd shared && npm run test:coverage # 覆盖率报告

# ===== server 测试 =====
cd server && npm test              # 运行服务端测试
cd server && npm run test:watch    # 监听模式
```

### 详细文档

| 文档 | 说明 |
|------|------|
| [测试规范](docs/testing/test-specification.md) | 命名规范、编写模板、分层策略 |
| [增强方案](docs/testing/test-enhancement-plan.md) | 薄弱模块分析、分阶段计划 |
| [testset](docs/design/testset.md) | GM测试流程、Bug记录 |

---

## 开发流程（固定）

文档先行 -> 代码实现 -> 测试验证 -> 更新进度

- 规则变更：先改策划文档，再改代码
- 新需求实现：先产出技术方案并经需求方确认，再进入编码
- 功能完成：补测试（自动化 + GM手测）
- 提交前：至少跑相关模块测试
- 所有卡牌的bug，以及我用bug：XXXX，标注的问题，修复完了都要在 docs/design/testset.md 里简要记录原因
 
## 开发执行（6步TDD流程）

| 步骤 | 名称 | 内容 |
|:----:|------|------|
| **1** | **文档确认** | 先更新策划/技术文档并与需求方确认范围与验收标准 |
| **2** | **编写代码** | 实现功能逻辑（类型定义、核心方法、UI渲染） |
| **3** | **建立 Red/Green TDD 用例** | 编写测试用例，先失败(Red)后通过(Green) |
| **4** | **自动化测试** | 运行 `npm test` 直至全部通过 |
| **5** | **创建 GM 指令** | 添加调试指令协助手工测试 |
| **6** | **提交并重启** | 重启服务端/客户端，人工跟进测试 |

### 流程补充建议（与 Superpowers 对齐）

与上表是同一套纪律；若使用 Cursor **Superpowers** 插件，可用 **`writing-plans`**（大卡开工前列步骤）、**`verification-before-completion`**（宣称完成前先跑测）、**`systematic-debugging`**（先复现再改）等强化执行，**并非替代**策划与测试文档。

**按任务体量**

- **跨模块、多文件、新机制**（如匹配、效果管线、`pendingChoice` 长链）：开工前写清可验收范围与步骤（一页计划即可），大改动合入前做评审并交代上下文与测试清单。
- **小改动**（文案、明确单行修复等）：可直接实现，不必强行套全套会议式流程。

**验证习惯**

- 完工前至少执行：**`cd shared && npm test`** 与 **`cd server && npm test`**（协议/房间/大厅相关再补一条最小手测闭环）。
- 复杂 Bug：先在 **test-gui**、**GM**、**`?devPanel=1`** 等环境下稳定复现，再改代码，避免盲改 `MultiplayerGame` 或长分支交互。

**规格与工程文档分工**

- **策划文档**说明「做什么」（例如匹配见 [AI匹配机制设计.md](策划文档/AI匹配机制设计.md)）；**`docs/`** 说明「工程上怎么挂」（例如 `docs/MULTIPLAYER_ARCHITECTURE.md`）。避免只改前端或只改协议的一半。

**提交 / PR 说明（推荐固定写清三项）**

1. **关联文档**：策划或 `docs/` 路径（若适用）  
2. **自动化**：已执行的命令与结果（shared / server）  
3. **手测与记录**：是否手测；修牌/效果类问题是否更新 [testset.md](docs/design/testset.md)

---

## 多人计时 / 托管手测

详见 **`tools/multiplayer-timer-gm.md`**。开发环境下还可加 **`?devPanel=1`** 打开右下角测试面板（仪表盘 + GM 快捷按钮，见 `client/src/dev/DevTestPanel.vue`）。
