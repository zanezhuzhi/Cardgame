
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
    let player: ReturnType<GameManager['getCurrentPlayer']>;
    let yokaiCard: any;

    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
      const state = game.getState();
      state.phase = 'playing';
      game.startTurn();
      game.confirmShikigamiPhase();

      player = game.getCurrentPlayer();

      // 在战场放一只3HP的妖怪
      yokaiCard = {
        instanceId: 'yokai_test_01',
        cardId: 'yokai_001',
        cardType: 'yokai',
        name: '测试妖怪',
        hp: 3,
        maxHp: 3,
        charm: 1,
        image: ''
      };
      state.field.yokaiSlots[0] = yokaiCard;

      // 给玩家手牌（阴阳术：伤害2）
      player.hand = [
        { instanceId: 'spell_01', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 2, charm: 0, image: '' },
        { instanceId: 'spell_02', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 2, charm: 0, image: '' },
      ];
    });

    it('打出阴阳术后伤害值累加', () => {
      // 打出第一张（+2伤害）
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_01' });
      expect(player.damage).toBe(2);

      // 打出第二张（再+2伤害）
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_02' });
      expect(player.damage).toBe(4);
    });

    it('分配伤害后妖怪HP减少', () => {
      // 打出两张牌，累积4点伤害
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_01' });
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_02' });

      // 分配3点伤害给妖怪
      const result = game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 3 });

      expect(result).toBe(true);
      expect(yokaiCard.hp).toBe(0);
    });

    it('分配伤害不能超过当前累积伤害', () => {
      // 只打出一张牌，累积2点伤害
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_01' });
      expect(player.damage).toBe(2);

      // 尝试分配5点伤害（超出）→ 应该失败
      const result = game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 5 });
      expect(result).toBe(false);
      expect(player.damage).toBe(2); // 伤害值不变
    });

    it('回合结束时所有伤害清零', () => {
      // 打出牌累积伤害
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_01' });
      expect(player.damage).toBe(2);

      // 结束回合
      game.handleAction('p1', { type: 'END_TURN' });

      // 切换到下一个玩家
      const nextPlayer = game.getCurrentPlayer();
      // 原来的玩家p1在回合结束后伤害应该清零
      const p1 = game.getState().players.find(p => p.id === 'p1')!;
      expect(p1.damage).toBe(0);
    });

    it('分配伤害后从累积伤害中扣除', () => {
      // 累积4点伤害
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_01' });
      game.handleAction('p1', { type: 'PLAY_CARD', cardInstanceId: 'spell_02' });
      expect(player.damage).toBe(4);

      // 分配2点给妖怪（妖怪3HP，仍存活）
      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      // 累积伤害减少2，还剩2
      expect(player.damage).toBe(2);
      expect(yokaiCard.hp).toBe(1);
    });
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
    let game: GameManager;

    beforeEach(() => {
      game = new GameManager('test_room', 4);
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
    });

    it('妖怪牌库耗尽且战场不足6张时游戏结束', () => {
      const state = game.getState();
      state.phase = 'playing';
      
      // 清空妖怪牌库
      state.field.yokaiDeck = [];
      // 战场只有5张（不足6张）
      state.field.yokaiSlots = [null, null, null, null, null, null];
      state.field.yokaiSlots[0] = { instanceId: 'y1', cardId: 'yokai_001', cardType: 'yokai', name: '测试妖怪', hp: 2, maxHp: 2, image: '' };
      
      // 触发检查
      const isEnded = (game as any).checkGameEnd();
      
      expect(isEnded).toBe(true);
    });

    it('所有鬼王被击败时游戏结束', () => {
      const state = game.getState();
      state.phase = 'playing';
      
      // 清空鬼王牌库和当前鬼王
      state.field.bossDeck = [];
      state.field.currentBoss = null;
      
      const isEnded = (game as any).checkGameEnd();
      
      expect(isEnded).toBe(true);
    });

    it('声誉最高者获胜', () => {
      const state = game.getState();
      state.phase = 'playing';
      
      // 给玩家1更多声誉
      const p1 = state.players[0]!;
      const p2 = state.players[1]!;
      
      p1.deck = [
        { instanceId: 'c1', cardId: 'yokai_001', cardType: 'yokai', name: '高声誉妖怪', hp: 5, maxHp: 5, charm: 3, image: '' },
        { instanceId: 'c2', cardId: 'yokai_002', cardType: 'yokai', name: '高声誉妖怪', hp: 5, maxHp: 5, charm: 3, image: '' },
      ];
      p2.deck = [
        { instanceId: 'c3', cardId: 'yokai_003', cardType: 'yokai', name: '低声誉妖怪', hp: 2, maxHp: 2, charm: 1, image: '' },
      ];
      
      // 触发游戏结束
      (game as any).endGame();
      
      expect(state.phase).toBe('ended');
      // 检查日志中包含玩家1获胜
      const lastLog = state.log[state.log.length - 1];
      expect(lastLog?.message).toContain('玩家1');
      expect(lastLog?.message).toContain('获胜');
    });

    it('声誉相同时比较牌数，牌多者胜', () => {
      const state = game.getState();
      state.phase = 'playing';
      
      // 两个玩家相同声誉但不同牌数
      const p1 = state.players[0]!;
      const p2 = state.players[1]!;
      
      // 玩家1: 2张牌，总声誉2
      p1.deck = [
        { instanceId: 'c1', cardId: 'y1', cardType: 'yokai', name: '妖怪A', hp: 2, maxHp: 2, charm: 1, image: '' },
        { instanceId: 'c2', cardId: 'y2', cardType: 'yokai', name: '妖怪B', hp: 2, maxHp: 2, charm: 1, image: '' },
      ];
      p1.hand = [];
      p1.discard = [];
      
      // 玩家2: 1张牌，总声誉2
      p2.deck = [
        { instanceId: 'c3', cardId: 'y3', cardType: 'yokai', name: '妖怪C', hp: 3, maxHp: 3, charm: 2, image: '' },
      ];
      p2.hand = [];
      p2.discard = [];
      
      // 触发游戏结束
      (game as any).endGame();
      
      expect(state.phase).toBe('ended');
      // 玩家1牌多，应该获胜
      const lastLog = state.log[state.log.length - 1];
      expect(lastLog?.message).toContain('玩家1');
    });

    it('声誉和牌数都相同时判为平局', () => {
      const state = game.getState();
      state.phase = 'playing';
      
      const p1 = state.players[0]!;
      const p2 = state.players[1]!;
      
      // 完全相同：各1张牌，声誉都是2
      p1.deck = [
        { instanceId: 'c1', cardId: 'y1', cardType: 'yokai', name: '妖怪A', hp: 2, maxHp: 2, charm: 2, image: '' },
      ];
      p1.hand = [];
      p1.discard = [];
      
      p2.deck = [
        { instanceId: 'c2', cardId: 'y2', cardType: 'yokai', name: '妖怪B', hp: 2, maxHp: 2, charm: 2, image: '' },
      ];
      p2.hand = [];
      p2.discard = [];
      
      (game as any).endGame();
      
      expect(state.phase).toBe('ended');
      const lastLog = state.log[state.log.length - 1];
      expect(lastLog?.message).toContain('平局');
    });
  });
});
