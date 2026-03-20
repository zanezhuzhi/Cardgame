/**
 * 服务端配置
 * @file server/src/config.ts
 */

export const config = {
  // 服务端口
  port: parseInt(process.env.PORT || '3000', 10),
  
  // CORS 配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
  
  // 房间配置
  room: {
    maxRooms: 1000,
    maxPlayersPerRoom: 6,
    minPlayersToStart: 2,
    roomIdleTimeout: 30 * 60 * 1000,  // 30分钟无活动销毁
    cleanupInterval: 60 * 1000,        // 每分钟清理一次
  },
  
  // 游戏配置
  game: {
    turnTimeout: 120 * 1000,           // 回合超时 120秒
    interactTimeout: 30 * 1000,        // 交互超时 30秒
    reconnectTimeout: 60 * 1000,       // 重连超时 60秒
  },
  
  // 心跳配置
  heartbeat: {
    interval: 25 * 1000,               // 25秒发一次
    timeout: 60 * 1000,                // 60秒无响应断开
  },
};
