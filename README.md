# Cardgame 项目

## 项目简介

这是一个基于H5的桌面游戏方案，注重逻辑与策略。并能通过网页支持多人联机体验。

## 技术架构

- **前端**: Vue 3 + Vite + TypeScript + PixiJS
- **后端**: Node.js + Socket.io
- **跨平台**: Web → Electron (Steam) / 小游戏适配层

## 目录结构

```
D:\Cardgame
├── client/                 # 前端项目
│   └── src/
│       ├── game/          # PixiJS 游戏渲染
│       ├── views/         # Vue 页面
│       ├── components/    # Vue 组件
│       └── assets/        # 静态资源
├── server/                 # 后端服务
│   └── src/
├── shared/                 # 前后端共享代码
│   ├── types/             # TypeScript 类型定义
│   └── game-logic/        # 平台无关的游戏核心逻辑
├── .codemaker/            # CodeMaker 配置
├── sandbox/               # 沙盒测试
└── 策划文档/              # 游戏设计文档
```

## 开发指南

### 安装依赖

```bash
# 客户端
cd client && npm install

# 服务端
cd server && npm install
```

### 启动开发服务器

```bash
# 客户端 (默认 http://localhost:5173)
cd client && npm run dev

# 服务端 (默认 ws://localhost:3000)
cd server && npm run dev
```

## 部署目标

| 平台 | 方案 |
|------|------|
| Web 测试 | Vite 直接部署 + 内网穿透 |
| Steam | Electron 打包 |
| 微信小游戏 | 小游戏适配层 |

## 开始使用

请参考 `plan-dreamgame.prom` 文件了解项目规划。