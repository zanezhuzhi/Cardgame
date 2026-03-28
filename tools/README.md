# 开发工具（tools）

本目录存放**与主界面解耦**的脚本、清单与操作说明，便于本地调试与验收，不接入 `client` 正式 UI。

---

## 🖥️ 可视化测试工具 (推荐)

### 快速使用

```
双击 test-gui/start.bat
```

首次运行会自动安装 Electron 依赖（约 200MB）。

### 功能按钮

| 按钮 | 说明 |
|------|------|
| 👻 测试全部妖怪 | 运行 YokaiEffects.test.ts（38个妖怪效果） |
| 👹 测试全部鬼王 | 运行 BossEffects.test.ts |
| � 测试全部式神 | 运行 ShikigamiSkills.test.ts（100+用例） |
| 🔄 回合流程测试 | 运行 gameFlow.integration.test.ts |
| 📊 数据一致性测试 | 运行 cards.consistency.test.ts |
| 📦 Shared 全部测试 | 运行 shared 目录所有测试 |
| 🖥️ Server 全部测试 | 运行 server 目录所有测试 |
| 🚀 运行全部测试 | 依次运行 Shared + Server 全部测试 |

### 界面预览

```
┌─────────────────────────────────────────────────────────┐
│  �🧪 御魂传说 - 自动化测试工具                            │
├──────────────┬──────────────────────────────────────────┤
│  🎴 卡牌效果  │                                          │
│ ┌──────────┐ │  📋 测试输出                              │
│ │👻 妖怪    │ │  ───────────────────────────────────     │
│ │👹 鬼王    │ │  ✓ 狂骨: 鬼火3时伤害+3                   │
│ │🦊 式神    │ │  ✓ 河童: 抓1牌                          │
│ └──────────┘ │  ✓ 天邪鬼青: 弃1牌                       │
│  ⚙️ 系统测试  │  ...                                     │
│ ┌──────────┐ │                                          │
│ │🔄 回合    │ │  🎉 全部测试通过！                       │
│ │📊 数据    │ │                                          │
│ └──────────┘ │                              ⏱️ 12.3s     │
└──────────────┴──────────────────────────────────────────┘
```

---

## 🧪 命令行测试 (备选)

### 快速使用

```
双击 run-tests.bat
```

运行后将自动执行：
1. **Shared 测试** - 效果引擎、式神技能、数据一致性
2. **Server 测试** - 游戏流程、操作处理、日志可见性

### 输出说明

| 状态 | 含义 |
|:----:|------|
| ✅ | 测试通过 |
| ❌ | 存在失败用例 |

测试日志保存至 `test-reports/` 目录：
- `shared-test.log` - Shared 模块测试详情
- `server-test.log` - Server 模块测试详情

### 命令行方式

```bash
# 运行全部测试（等价于双击 run-tests.bat）
cd shared && npm test && cd ../server && npm test

# 仅运行 Shared 测试
cd shared && npm test

# 运行指定测试文件
cd shared && npm test -- "YokaiEffects"

# 按卡牌名称过滤
cd shared && npm test -- "狂骨"

# 监听模式（开发时推荐）
cd shared && npm run test:watch

# 生成覆盖率报告
cd shared && npm run test:coverage
```

### 测试覆盖范围

| 模块 | 测试文件 | 验证内容 |
|------|----------|----------|
| 妖怪效果 | `YokaiEffects.test.ts` | 38个妖怪效果正确性 |
| 式神技能 | `ShikigamiSkills.test.ts` | 式神技能触发与执行 |
| 数据一致性 | `cards.consistency.test.ts` | cards.json 与文档匹配 |
| 游戏流程 | `gameFlow.integration.test.ts` | 回合流转、出牌、状态一致性 |
| 日志可见性 | `logVisibility.test.ts` | 私有/公开消息过滤 |

---

## 内容索引

| 文件 | 说明 |
|------|------|
| [test-gui/start.bat](./test-gui/start.bat) | 🖥️ **可视化测试工具**（推荐） |
| [run-tests.bat](./run-tests.bat) | 🧪 命令行一键测试 |
| [多人计时与托管 GM 手测](./multiplayer-timer-gm.md) | 回合超时、AFK、掉线托管聊天的 `/` 指令清单 |

## 约定

- 新增长脚本的自动化/一次性工具：**优先放在本目录**，避免污染 `server/src`、`client/src`。
- 已在服务端实现的 GM 聊天指令（如 `/timeout`）仍以 `server/src/socket/SocketServer.ts` 为准；本目录仅作**使用说明**与**手测流程**归档。

## 前端开发测试面板（不面向玩家）

- 使用 **开发构建**（`npm run dev`）并在地址栏增加 **`devPanel=1`**，例如：`?mode=multi&devPanel=1`
- 右下角出现可收起的 **DEV** 面板：暴露与查验相关的 **GameState / Room / 连接 / 各座席计时与托管字段**、`pendingChoice` 全文 JSON，以及「复制完整诊断 JSON」；含与 GM 等效的快捷按钮（实现：`client/src/dev/DevTestPanel.vue`）
- 生产构建（`npm run build`）中 `import.meta.env.DEV` 为 `false`，面板逻辑不会挂载
