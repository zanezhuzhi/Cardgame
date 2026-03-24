# 百鬼夜行 - Cardgame

> 项目核心索引（开发上下文入口）

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
│   ├── MULTIPLAYER_ARCHITECTURE.md
│   └── MULTIPLAYER_SCENARIOS.md
├── 策划文档/                       # 规则权威来源
│   ├── 游戏规则说明书.md
│   ├── 交互设计.md
│   └── 界面ass/信息交互.md
└── PROGRESS.md                    # 进度跟踪
```

---

## 文档索引

### 规则（先看）
- `策划文档/游戏规则说明书.md`：完整规则与胜负判定
- `策划文档/交互设计.md`：UI/UX 与交互约束
- `策划文档/界面ass/信息交互.md`：日志、聊天、GM输入设计

### 技术（再看）
- `docs/design/testset.md`：测试开关、测试流程、GM测试
- `docs/MULTIPLAYER_ARCHITECTURE.md`：多人架构
- `PROGRESS.md`：当前开发进度

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

## 开发流程（固定）

文档先行 -> 代码实现 -> 测试验证 -> 更新进度

- 规则变更：先改策划文档，再改代码
- 功能完成：补测试（自动化 + GM手测）
- 提交前：至少跑相关模块测试

## 开发执行（6步TDD流程）

| 步骤 | 名称 | 内容 |
|:----:|------|------|
| **1** | **编写代码** | 实现功能逻辑（类型定义、核心方法、UI渲染） |
| **2** | **创建核心验证内容** | 定义验证点（边界条件、预期行为、错误处理） |
| **3** | **建立 Red/Green TDD 用例** | 编写测试用例，先失败(Red)后通过(Green) |
| **4** | **自动化测试** | 运行 `npm test` 直至全部通过 |
| **5** | **创建 GM 指令** | 添加调试指令协助手工测试 |
| **6** | **提交并重启** | 重启服务端/客户端，人工跟进测试 |
