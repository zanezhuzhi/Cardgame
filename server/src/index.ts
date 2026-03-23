/**
 * 御魂传说 - 多人联机服务端入口
 * @file server/src/index.ts
 * 
 * 启动 HTTP 服务器和 Socket.io 服务
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { SocketServer } from './socket/SocketServer';
import { RoomManager } from './room/RoomManager';

// 配置
const PORT = parseInt(process.env.PORT || '3002');
const HOST = process.env.HOST || '0.0.0.0';

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('       御魂传说 - 多人联机服务端 v1.0.0');
  console.log('═══════════════════════════════════════════════════');
  console.log();
  
  // 创建 Express 应用
  const app = express();
  
  // 中间件
  app.use(cors());
  app.use(express.json());
  
  // 健康检查端点
  app.get('/health', (req, res) => {
    const roomManager = RoomManager.getInstance();
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      rooms: roomManager.getRoomCount(),
      players: roomManager.getOnlinePlayerCount(),
    });
  });
  
  // API 端点：获取房间列表
  app.get('/api/rooms', (req, res) => {
    const roomManager = RoomManager.getInstance();
    res.json({
      rooms: roomManager.getPublicRooms(),
    });
  });
  
  // API 端点：获取服务器状态
  app.get('/api/status', (req, res) => {
    const roomManager = RoomManager.getInstance();
    res.json({
      version: '1.0.0',
      uptime: process.uptime(),
      rooms: roomManager.getRoomCount(),
      players: roomManager.getOnlinePlayerCount(),
      memory: process.memoryUsage(),
    });
  });
  
  // API 端点：调试 - 获取房间详细状态
  app.get('/api/debug/room/:roomId', (req, res) => {
    const roomManager = RoomManager.getInstance();
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    // 返回游戏状态摘要（避免太大）
    const game = room.getGame();
    const state = game?.getState();
    if (!state) {
      return res.json({ room: room.getInfo(), game: null });
    }
    
    // 玩家状态摘要
    const playersSummary = state.players.map(p => ({
      id: p.id,
      name: p.name,
      deckCount: p.deck?.length || 0,
      handCount: p.hand?.length || 0,
      discardCount: p.discard?.length || 0,
      playedCount: p.played?.length || 0,
      totalCards: (p.deck?.length || 0) + (p.hand?.length || 0) + (p.discard?.length || 0) + (p.played?.length || 0),
      ghostFire: p.ghostFire,
      damage: p.damage,
      totalCharm: p.totalCharm,
      shikigamiCount: p.shikigami?.length || 0,
    }));
    
    res.json({
      room: room.getInfo(),
      game: {
        phase: state.phase,
        turnPhase: state.turnPhase,
        turnNumber: state.turnNumber,
        currentPlayerIndex: state.currentPlayerIndex,
        currentPlayer: state.players[state.currentPlayerIndex]?.name,
        players: playersSummary,
        field: {
          yokaiSlots: state.field.yokaiSlots?.map(y => y ? { name: y.name, hp: y.hp, maxHp: y.maxHp } : null),
          currentBoss: state.field.currentBoss ? { name: state.field.currentBoss.name, hp: state.field.currentBoss.hp } : null,
          yokaiDeckCount: state.field.yokaiDeck?.length || 0,
          bossDeckCount: state.field.bossDeck?.length || 0,
        },
        lastLogs: state.log?.slice(-10) || [],
      },
    });
  });
  
  // 创建 HTTP 服务器
  const httpServer = createServer(app);
  
  // 创建 Socket.io 服务
  const socketServer = new SocketServer(httpServer);
  
  // 启动服务器
  httpServer.listen(PORT, HOST, () => {
    console.log(`[Server] HTTP 服务已启动`);
    console.log(`[Server] 地址: http://${HOST}:${PORT}`);
    console.log(`[Server] WebSocket 地址: ws://${HOST}:${PORT}`);
    console.log();
    console.log('[Server] 可用端点:');
    console.log(`  - GET  /health     健康检查`);
    console.log(`  - GET  /api/rooms  房间列表`);
    console.log(`  - GET  /api/status 服务器状态`);
    console.log();
    console.log('[Server] 等待客户端连接...');
    console.log('═══════════════════════════════════════════════════');
  });
  
  // 优雅关闭
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] 收到 ${signal} 信号，正在关闭...`);
    
    // 关闭 Socket.io
    await socketServer.close();
    
    // 关闭房间管理器
    RoomManager.getInstance().shutdown();
    
    // 关闭 HTTP 服务器
    httpServer.close(() => {
      console.log('[Server] HTTP 服务已关闭');
      process.exit(0);
    });
    
    // 强制退出超时
    setTimeout(() => {
      console.log('[Server] 强制退出');
      process.exit(1);
    }, 10000);
  };
  
  // 监听退出信号
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // 未捕获异常处理
  process.on('uncaughtException', (error) => {
    console.error('[Server] 未捕获的异常:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] 未处理的 Promise 拒绝:', reason);
  });
}

// 启动
main().catch((error) => {
  console.error('[Server] 启动失败:', error);
  process.exit(1);
});