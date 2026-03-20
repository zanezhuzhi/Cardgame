
/**
 * 御魂传说 - 游戏管理器测试
 * @file shared/game/GameManager.test.ts
 * 
 * TDD Red/Green 测试
 * 🔴 RED = 测试先写，功能未实现（应该失败）
 * 🟢 GREEN = 功能已实现（应该通过）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from './GameManager';

describe('GameManager 游戏管理器', () => {
  let game: GameManager;

  beforeEach(() => {
    game = new GameManager('test_room', 4);
  });

  // ============ 🟢 GREEN - 已实现的功能 ============

  describe('🟢 游戏初始化', () => {
    it('创建游戏后状态为waiting', () => {
      expect(game.getState().phase).toBe('waiting');
    });

    it('创建游戏后玩家列表为空', () => {
      expect(game.getState().players.length).toBe(0);
    });
  });

  describe('🟢 玩家管理', () => {
    it('添加玩家后玩家数量增加', () => {
      game.addPlayer('p1', '玩家1');
      expect(game.getState().players.length).toBe(1);
    });

    it('玩家初始鬼火为0', () => {
      game.addPlayer('p1', '玩家1');
      const player = game.getState().players[0]!;
      expect(player.ghostFire).toBe(0);
    });

    it('玩家鬼火上限为5', () => {
      game.addPlayer('p1', '玩家1');
      const player = game.getState().players[0]!;
      expect(player.maxGhostFire).toBe(5);
    });
  });

  // ============ 🟢 GREEN - 回合系统 ============

  describe('🟢 回合流程 - 4阶段系统', () => {
    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
    });

    it('回合开始进入ghostFire阶段', () => {
      // 模拟游戏开始
      game.getState().phase = 'playing';
      game.startTurn();
      
      // 鬼火阶段自动进入式神阶段
      expect(game.getState().turnPhase).toBe('shikigami');
    });

    it('鬼火阶段玩家获得1点鬼火', () => {
      game.getState().phase = 'playing';
      const player = game.getCurrentPlayer();
      const oldGhostFire = player.ghostFire;
      
      game.startTurn();
      
      expect(player.ghostFire).toBe(oldGhostFire + 1);
    });

    it('鬼火不超过上限5', () => {
      game.getState().phase = 'playing';
      const player = game.getCurrentPlayer();
      player.ghostFire = 5; // 已满
      
      game.startTurn();
      
      expect(player.ghostFire).toBe(5); // 仍然是5
    });

    it('确认式神阶段后进入行动阶段', () => {
      game.getState().phase = 'playing';
      game.startTurn();
      
      game.confirmShikigamiPhase();
      
      expect(game.getState().turnPhase).toBe('action');
    });
  });

  // ============ 🔴 RED - 待实现的功能 ============

  describe('🔴 伤害分配系统', () => {
    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
      game.getState().phase = 'playing';
      game.startTurn();
      game.confirmShikigamiPhase();
    });

    it.todo('打出阴阳术后伤害值累加');

    it.todo('伤害分配只能进行一次');

    it.todo('分配伤害后剩余伤害清零');

    it.todo('目标生命降至0前不能指定新目标');

    it.todo('回合结束时所有伤害清零');
  });

  describe('🔴 退治妖怪', () => {
    it.todo('伤害>=生命时退治成功');

    it.todo('退治后妖怪进入弃牌堆');

    it.todo('退治后获得妖怪声誉');

    it.todo('回合中妖怪不刷新');
  });

  describe('🔴 超度系统', () => {
    it.todo('超度基础术式+生命>=2妖怪 获得中级符咒');

    it.todo('超度中级符咒+生命>=4妖怪 获得高级符咒');

    it.todo('超度的卡牌移出游戏');
  });

  describe('🔴 式神技能', () => {
    it.todo('消耗鬼火使用式神技能');

    it.todo('鬼火不足时无法使用技能');

    it.todo('疲劳的式神无法再次使用技能');
  });

  describe('🔴 鬼王系统', () => {
    it.todo('鬼王被击败后翻出下一个');

    it.todo('所有鬼王被击败时游戏结束');

    it.todo('鬼王来袭效果触发');
  });

  describe('🔴 游戏结束', () => {
    it.todo('妖怪牌库耗尽时游戏结束');

    it.todo('所有鬼王被击败时游戏结束');

    it.todo('声誉最高者获胜');

    it.todo('声誉相同比较牌数');
  });
});
