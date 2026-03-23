# 御魂传说 - 多人联机服务端

Node.js + Socket.io 多人联机游戏服务端框架。

## 目录结构

```
server/
├── src/
│   ├── index.ts              # 入口文件，启动服务器
│   ├── socket/
│   │   └── SocketServer.ts   # Socket.io服务封装
│   ├── room/
│   │   ├── Room.ts           # 房间类
│   │   └── RoomManager.ts    # 房间管理器
│   ├── game/
│   │   └── MultiplayerGame.ts # 多人游戏引擎
│   └── types/
│       └── index.ts          # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
cd server
npm install
```

## 运行

### 开发模式（热重载）
```bash
npm run dev
```

### 生产模式
```bash
npm run build
npm start
```

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| PORT | 3001 | 服务端口 |
| HOST | 0.0.0.0 | 监听地址 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /health | GET | 健康检查 |
| /api/rooms | GET | 获取公开房间列表 |
| /api/status | GET | 获取服务器状态 |

## Socket.io 事件

### 客户端 → 服务端

| 事件 | 参数 | 说明 |
|------|------|------|
| player:setName | name, callback | 设置玩家名称 |
| room:create | config, callback | 创建房间 |
| room:join | roomId, password?, callback? | 加入房间 |
| room:leave | callback? | 离开房间 |
| room:ready | isReady, callback? | 设置准备状态 |
| room:kick | playerId, callback? | 踢出玩家（房主） |
| room:list | callback | 获取房间列表 |
| game:start | callback? | 开始游戏（房主） |
| game:action | action, seq, callback? | 发送游戏动作 |
| ping | timestamp | 心跳 |

### 服务端 → 客户端

| 事件 | 参数 | 说明 |
|------|------|------|
| connect:success | playerId | 连接成功 |
| room:created | roomInfo | 房间已创建 |
| room:joined | roomInfo, playerId | 加入房间成功 |
| room:updated | roomInfo | 房间信息更新 |
| room:playerJoined | player | 有玩家加入 |
| room:playerLeft | playerId | 有玩家离开 |
| room:playerReady | playerId, isReady | 玩家准备状态变更 |
| room:hostChanged | newHostId | 房主变更 |
| room:left | - | 已离开房间 |
| room:error | code, message | 房间错误 |
| game:started | state | 游戏开始 |
| game:stateSync | state, seq | 状态同步 |
| game:event | event | 游戏事件 |
| game:actionResult | seq, success, error? | 动作结果 |
| game:ended | winners, scores | 游戏结束 |
| player:disconnected | playerId, timeout | 玩家断线 |
| player:reconnected | playerId | 玩家重连 |
| pong | timestamp, serverTime | 心跳响应 |

## 游戏流程

1. **连接服务器**
   - 客户端连接 Socket.io
   - 设置玩家名称

2. **创建/加入房间**
   - 房主创建房间，获得6位房间码
   - 其他玩家使用房间码加入

3. **等待开始**
   - 玩家点击准备
   - 房主在所有人准备后可开始游戏

4. **游戏进行**
   - 进入式神选取阶段
   - 按回合轮流行动
   - 服务端验证所有操作
   - 状态广播给所有玩家

5. **游戏结束**
   - 击败所有鬼王后游戏结束
   - 计算最终分数

## 关键设计

- **房间码**: 6位随机字母数字（排除易混淆字符）
- **玩家数**: 支持3-6人游戏
- **权限控制**: 只有房主可以开始游戏、踢人
- **断线重连**: 支持60秒内重连
- **状态同步**: 服务端权威，客户端展示

## 错误码

| 错误码 | 说明 |
|--------|------|
| ROOM_NOT_FOUND | 房间不存在 |
| ROOM_FULL | 房间已满 |
| ROOM_ALREADY_STARTED | 游戏已开始 |
| ROOM_WRONG_PASSWORD | 密码错误 |
| ROOM_NOT_HOST | 非房主操作 |
| GAME_NOT_YOUR_TURN | 不是你的回合 |
| GAME_INVALID_ACTION | 无效操作 |
