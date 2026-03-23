/**
 * 日志可见性测试
 * @file server/src/game/__tests__/logVisibility.test.ts
 * 
 * 验证点：
 * 1. 私有消息（visibility='private'）只发送给对应玩家
 * 2. 公开消息（visibility='public'或undefined）发送给所有玩家
 * 3. 鬼火变化消息是私有的
 * 4. 消息refs引用对象正确解析
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogEntry, LogVisibility } from '../../../../shared/types/game';

describe('日志可见性规则', () => {
  
  // 模拟日志过滤函数（与SocketServer中的逻辑一致）
  function filterLogsForPlayer(logs: GameLogEntry[], playerId: string): GameLogEntry[] {
    return logs.filter(entry => {
      // 没有visibility字段的默认为public（兼容旧消息）
      if (!entry.visibility || entry.visibility === 'public') {
        return true;
      }
      // 私有消息只发给对应玩家
      return entry.playerId === playerId;
    });
  }

  describe('消息过滤', () => {
    it('公开消息应该对所有玩家可见', () => {
      const logs: GameLogEntry[] = [
        { type: 'game_start', message: '游戏开始', timestamp: Date.now(), visibility: 'public' },
        { type: 'play_card', message: '玩家1打出了【狰】', timestamp: Date.now(), visibility: 'public' },
      ];
      
      const player1Logs = filterLogsForPlayer(logs, 'player1');
      const player2Logs = filterLogsForPlayer(logs, 'player2');
      
      expect(player1Logs.length).toBe(2);
      expect(player2Logs.length).toBe(2);
    });

    it('私有消息只对归属玩家可见', () => {
      const logs: GameLogEntry[] = [
        { type: 'game_start', message: '🔥 鬼火+1（当前:2）', timestamp: Date.now(), visibility: 'private', playerId: 'player1' },
        { type: 'game_start', message: '🔥 鬼火+1（当前:3）', timestamp: Date.now(), visibility: 'private', playerId: 'player2' },
      ];
      
      const player1Logs = filterLogsForPlayer(logs, 'player1');
      const player2Logs = filterLogsForPlayer(logs, 'player2');
      
      expect(player1Logs.length).toBe(1);
      expect(player1Logs[0].message).toContain('当前:2');
      
      expect(player2Logs.length).toBe(1);
      expect(player2Logs[0].message).toContain('当前:3');
    });

    it('没有visibility字段的消息默认为公开', () => {
      const logs: GameLogEntry[] = [
        { type: 'game_start', message: '旧格式消息', timestamp: Date.now() }, // 没有visibility
      ];
      
      const player1Logs = filterLogsForPlayer(logs, 'player1');
      const player2Logs = filterLogsForPlayer(logs, 'player2');
      
      expect(player1Logs.length).toBe(1);
      expect(player2Logs.length).toBe(1);
    });

    it('混合消息正确过滤', () => {
      const logs: GameLogEntry[] = [
        { type: 'game_start', message: '游戏开始', timestamp: Date.now(), visibility: 'public' },
        { type: 'game_start', message: '🔥 鬼火+1', timestamp: Date.now(), visibility: 'private', playerId: 'player1' },
        { type: 'play_card', message: '打出卡牌', timestamp: Date.now(), visibility: 'public' },
        { type: 'game_start', message: '❌ 伤害不足', timestamp: Date.now(), visibility: 'private', playerId: 'player2' },
      ];
      
      const player1Logs = filterLogsForPlayer(logs, 'player1');
      const player2Logs = filterLogsForPlayer(logs, 'player2');
      
      // player1 应该看到: 游戏开始, 鬼火+1(自己的), 打出卡牌
      expect(player1Logs.length).toBe(3);
      expect(player1Logs.some(l => l.message.includes('鬼火'))).toBe(true);
      expect(player1Logs.some(l => l.message.includes('伤害不足'))).toBe(false);
      
      // player2 应该看到: 游戏开始, 打出卡牌, 伤害不足(自己的)
      expect(player2Logs.length).toBe(3);
      expect(player2Logs.some(l => l.message.includes('伤害不足'))).toBe(true);
      expect(player2Logs.some(l => l.message.includes('鬼火'))).toBe(false);
    });
  });

  describe('消息引用对象', () => {
    it('refs字段应该正确存储引用信息', () => {
      const log: GameLogEntry = {
        type: 'play_card',
        message: '📜 打出【{card:狰}】，伤害+4',
        timestamp: Date.now(),
        visibility: 'public',
        refs: {
          'card:狰': {
            type: 'card',
            id: 'yokai_001',
            name: '狰',
            data: { cardType: 'yokai', hp: 4, damage: 4 }
          }
        }
      };
      
      expect(log.refs).toBeDefined();
      expect(log.refs!['card:狰']).toBeDefined();
      expect(log.refs!['card:狰'].type).toBe('card');
      expect(log.refs!['card:狰'].name).toBe('狰');
      expect(log.refs!['card:狰'].data?.hp).toBe(4);
    });

    it('多个引用对象应该都能正确存储', () => {
      const log: GameLogEntry = {
        type: 'defeat_yokai',
        message: '💀 {player:玩家1} 退治了【{card:灯笼鬼}】',
        timestamp: Date.now(),
        visibility: 'public',
        refs: {
          'player:玩家1': { type: 'player', id: 'p1', name: '玩家1' },
          'card:灯笼鬼': { type: 'card', id: 'yokai_002', name: '灯笼鬼', data: { hp: 3 } }
        }
      };
      
      expect(Object.keys(log.refs!).length).toBe(2);
      expect(log.refs!['player:玩家1'].type).toBe('player');
      expect(log.refs!['card:灯笼鬼'].type).toBe('card');
    });
  });
});

describe('私有消息类型判定', () => {
  // 验证哪些消息应该是私有的
  const privateMessagePatterns = [
    /^🔥.*鬼火/,      // 鬼火变化
    /^❌/,            // 错误提示
    /^⚠️/,           // 警告提示（部分）
  ];

  function shouldBePrivate(message: string): boolean {
    return privateMessagePatterns.some(pattern => pattern.test(message));
  }

  it('鬼火变化消息应该是私有的', () => {
    expect(shouldBePrivate('🔥 鬼火+1（当前:3）')).toBe(true);
    expect(shouldBePrivate('🔥 回合 5 - 鬼火+1（当前:4）')).toBe(true);
  });

  it('错误提示应该是私有的', () => {
    expect(shouldBePrivate('❌ 伤害不足！')).toBe(true);
    expect(shouldBePrivate('❌ 鬼火不足！')).toBe(true);
  });

  it('公开消息不应该被标记为私有', () => {
    expect(shouldBePrivate('📜 打出【狰】，伤害+4')).toBe(false);
    expect(shouldBePrivate('💀 【灯笼鬼】已被击杀！')).toBe(false);
    expect(shouldBePrivate('🎮 游戏开始')).toBe(false);
  });
});
