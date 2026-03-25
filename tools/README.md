# 开发工具（tools）

本目录存放**与主界面解耦**的脚本、清单与操作说明，便于本地调试与验收，不接入 `client` 正式 UI。

## 内容索引

| 文件 | 说明 |
|------|------|
| [多人计时与托管 GM 手测](./multiplayer-timer-gm.md) | 回合超时、AFK、掉线托管聊天的 `/` 指令清单与最短验收步骤 |

## 约定

- 新增长脚本的自动化/一次性工具：**优先放在本目录**，避免污染 `server/src`、`client/src`。
- 已在服务端实现的 GM 聊天指令（如 `/timeout`）仍以 `server/src/socket/SocketServer.ts` 为准；本目录仅作**使用说明**与**手测流程**归档。

## 前端开发测试面板（不面向玩家）

- 使用 **开发构建**（`npm run dev`）并在地址栏增加 **`devPanel=1`**，例如：`?mode=multi&devPanel=1`
- 右下角出现可收起的 **DEV** 面板：暴露与查验相关的 **GameState / Room / 连接 / 各座席计时与托管字段**、`pendingChoice` 全文 JSON，以及「复制完整诊断 JSON」；含与 GM 等效的快捷按钮（实现：`client/src/dev/DevTestPanel.vue`）
- 生产构建（`npm run build`）中 `import.meta.env.DEV` 为 `false`，面板逻辑不会挂载
