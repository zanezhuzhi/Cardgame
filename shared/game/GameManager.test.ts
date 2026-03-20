
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

      // 战场放一只2HP妖怪（声誉1）
      yokaiCard = {
        instanceId: 'yokai_test_01',
        cardId: 'yokai_001',
        cardType: 'yokai',
        name: '赤舌',
        hp: 2,
        maxHp: 2,
        charm: 1,
        image: ''
      };
      state.field.yokaiSlots[0] = yokaiCard;
      state.field.yokaiSlots[1] = null;

      // 给玩家累积4点伤害
      player.damage = 4;
    });

    it('伤害>=生命时妖怪HP降至0', () => {
      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      expect(yokaiCard.hp).toBe(0);
    });

    it('退治后妖怪槽位清空', () => {
      const state = game.getState();

      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      // 槽位0应该变为null
      expect(state.field.yokaiSlots[0]).toBeNull();
    });

    it('退治后妖怪进入玩家弃牌堆', () => {
      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      const inDiscard = player.discard.some(c => c.instanceId === 'yokai_test_01');
      expect(inDiscard).toBe(true);
    });

    it('退治后玩家获得妖怪声誉', () => {
      const charmBefore = player.totalCharm;

      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      expect(player.totalCharm).toBe(charmBefore + 1);
    });

    it('退治妖怪后totalCharm实时更新', () => {
      expect(player.totalCharm).toBe(0);

      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      // 妖怪进入弃牌堆，声誉应该+1
      expect(player.totalCharm).toBe(1);
    });

    it('回合中战场妖怪不自动刷新', () => {
      const state = game.getState();
      // 退治妖怪后，本回合不应补充新妖怪
      state.field.yokaiDeck = [
        { instanceId: 'yokai_new_01', cardId: 'yokai_002', cardType: 'yokai', name: '新妖怪', hp: 3, maxHp: 3, charm: 0, image: '' }
      ];

      game.handleAction('p1', { type: 'ATTACK', targetId: 'yokai_test_01', damage: 2 });

      // 行动阶段不补充，槽位0仍为null
      expect(state.field.yokaiSlots[0]).toBeNull();
    });
  });

  describe('🔴 超度系统', () => {
    let player: ReturnType<GameManager['getCurrentPlayer']>;

    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
      const state = game.getState();
      state.phase = 'playing';
      game.startTurn();
      game.confirmShikigamiPhase();

      player = game.getCurrentPlayer();

      // 在阴阳术供应区放入中级/高级符咒
      state.field.spellSupply = {
        basic:    { instanceId: 'supply_basic',    cardId: 'spell_basic',    cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
        medium:   { instanceId: 'supply_medium',   cardId: 'spell_medium',   cardType: 'spell', name: '中级符咒', hp: 2, maxHp: 2, damage: 2, charm: 0, image: '' },
        advanced: { instanceId: 'supply_advanced', cardId: 'spell_advanced', cardType: 'spell', name: '高级符咒', hp: 3, maxHp: 3, damage: 3, charm: 1, image: '' },
      };

      // 玩家弃牌堆里有2张基础术式（HP各1）
      player.discard = [
        { instanceId: 'basic_01', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
        { instanceId: 'basic_02', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
      ];
    });

    it('超度2张基础术式(HP总和>=2)可获得中级符咒', () => {
      const result = game.handleAction('p1', {
        type: 'BUY_SPELL',
        spellId: 'spell_medium',
        exileCardIds: ['basic_01', 'basic_02'],
      });

      expect(result).toBe(true);
      // 弃牌堆里应该有中级符咒
      const hasMedium = player.discard.some(c => c.name === '中级符咒');
      expect(hasMedium).toBe(true);
    });

    it('超度HP总和不足时失败', () => {
      // 只超度1张基础术式（HP=1，不足2）
      const result = game.handleAction('p1', {
        type: 'BUY_SPELL',
        spellId: 'spell_medium',
        exileCardIds: ['basic_01'],
      });

      expect(result).toBe(false);
      // 弃牌堆原样不变
      expect(player.discard.length).toBe(2);
    });

    it('超度的卡牌移入超度区（移出游戏）', () => {
      game.handleAction('p1', {
        type: 'BUY_SPELL',
        spellId: 'spell_medium',
        exileCardIds: ['basic_01', 'basic_02'],
      });

      // 弃牌堆中不再有被超度的牌
      const hasBasic01 = player.discard.some(c => c.instanceId === 'basic_01');
      const hasBasic02 = player.discard.some(c => c.instanceId === 'basic_02');
      expect(hasBasic01).toBe(false);
      expect(hasBasic02).toBe(false);

      // 超度区应该有这2张牌
      expect(player.exiled.length).toBe(2);
    });

    it('从手牌和弃牌堆都可以超度', () => {
      // 把一张放在手牌
      player.hand = [
        { instanceId: 'basic_03', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
      ];

      const result = game.handleAction('p1', {
        type: 'BUY_SPELL',
        spellId: 'spell_medium',
        exileCardIds: ['basic_03', 'basic_01'], // 1张手牌 + 1张弃牌
      });

      expect(result).toBe(true);
      expect(player.exiled.length).toBe(2);
    });

    it('超度4张基础术式(HP总和>=4)可获得高级符咒', () => {
      // 再准备2张基础术式
      player.discard.push(
        { instanceId: 'basic_03', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
        { instanceId: 'basic_04', cardId: 'spell_basic', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '' },
      );

      const result = game.handleAction('p1', {
        type: 'BUY_SPELL',
        spellId: 'spell_advanced',
        exileCardIds: ['basic_01', 'basic_02', 'basic_03', 'basic_04'],
      });

      expect(result).toBe(true);
      const hasAdvanced = player.discard.some(c => c.name === '高级符咒');
      expect(hasAdvanced).toBe(true);
      expect(player.exiled.length).toBe(4);
    });
  });

  describe('🔴 式神技能', () => {
    let player: ReturnType<GameManager['getCurrentPlayer']>;

    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
      const state = game.getState();
      state.phase = 'playing';
      game.startTurn();
      game.confirmShikigamiPhase();

      player = game.getCurrentPlayer();

      // 给玩家装备一个式神：山童（【启】鬼火-1：本回合前2张阴阳术额外伤害+1）
      player.shikigami = [{
        id: 'shikigami_shantong',
        name: '山童',
        type: 'shikigami',
        rarity: 'R',
        charm: 1,
        multiPlayer: false,
        skill: {
          name: '怪力',
          effectType: '启',
          cost: 1,        // 消耗1点鬼火
          effect: 'bonus_spell_damage_2', // 前2张阴阳术额外+1伤害
        },
        image: 'shikigami_shantong.png',
        count: 1,
      }];
      player.shikigamiState = [{
        cardId: 'shikigami_shantong',
        isExhausted: false,
        markers: {},
      }];

      // 给玩家3点鬼火
      player.ghostFire = 3;
    });

    it('【启】消耗鬼火使用式神技能', () => {
      const ghostFireBefore = player.ghostFire;

      const result = game.handleAction('p1', {
        type: 'USE_SKILL',
        shikigamiId: 'shikigami_shantong',
      });

      expect(result).toBe(true);
      // 消耗1点鬼火
      expect(player.ghostFire).toBe(ghostFireBefore - 1);
    });

    it('使用技能后式神进入疲劳状态', () => {
      game.handleAction('p1', {
        type: 'USE_SKILL',
        shikigamiId: 'shikigami_shantong',
      });

      const state = player.shikigamiState.find(s => s.cardId === 'shikigami_shantong');
      expect(state?.isExhausted).toBe(true);
    });

    it('鬼火不足时无法使用【启】技能', () => {
      player.ghostFire = 0; // 鬼火清空

      const result = game.handleAction('p1', {
        type: 'USE_SKILL',
        shikigamiId: 'shikigami_shantong',
      });

      expect(result).toBe(false);
      expect(player.ghostFire).toBe(0); // 鬼火不变
    });

    it('疲劳的式神无法再次使用技能', () => {
      // 第一次使用（成功）
      game.handleAction('p1', {
        type: 'USE_SKILL',
        shikigamiId: 'shikigami_shantong',
      });

      // 第二次使用（应该失败）
      const result = game.handleAction('p1', {
        type: 'USE_SKILL',
        shikigamiId: 'shikigami_shantong',
      });

      expect(result).toBe(false);
    });

    it('回合开始时式神疲劳状态重置', () => {
      // 用技能让式神疲劳
      game.handleAction('p1', { type: 'USE_SKILL', shikigamiId: 'shikigami_shantong' });
      const state = player.shikigamiState.find(s => s.cardId === 'shikigami_shantong');
      expect(state?.isExhausted).toBe(true);

      const gameState = game.getState();
      
      // p1 击杀一只妖怪（设置足够伤害，实际击杀）
      player.damage = 10;
      const yokai = gameState.field.yokaiSlots[0];
      if (yokai) {
        game.attackTarget(player, yokai.instanceId, yokai.hp);
      }

      // 结束回合 → 下一玩家
      game.handleAction('p1', { type: 'END_TURN' });
      
      // 检查是否进入妖怪刷新等待状态
      if (gameState.pendingYokaiRefresh) {
        game.decideYokaiRefresh(false); // 不刷新，继续游戏
      }
      
      const p2 = game.getCurrentPlayer();
      game.handleAction('p2', { type: 'CONFIRM_SHIKIGAMI' });
      
      // p2 击杀一只妖怪（设置足够伤害，实际击杀）
      p2.damage = 10;
      const yokai2 = gameState.field.yokaiSlots[0];
      if (yokai2) {
        game.attackTarget(p2, yokai2.instanceId, yokai2.hp);
      }
      
      game.handleAction('p2', { type: 'END_TURN' });

      // 检查是否进入妖怪刷新等待状态
      if (gameState.pendingYokaiRefresh) {
        game.decideYokaiRefresh(false); // 不刷新，继续游戏
      }

      // 回到p1的回合，找到玩家1
      const p1 = gameState.players.find(p => p.id === 'p1')!;
      const refreshedState = p1.shikigamiState.find(s => s.cardId === 'shikigami_shantong');
      expect(refreshedState?.isExhausted).toBe(false);
    });
  });

  describe('🔴 鬼王系统', () => {
    let player: ReturnType<GameManager['getCurrentPlayer']>;

    beforeEach(() => {
      game.addPlayer('p1', '玩家1');
      game.addPlayer('p2', '玩家2');
      const state = game.getState();
      state.phase = 'playing';

      // 手动配置鬼王牌库：当前鬼王(HP=8) + 牌库里还有1个
      state.field.currentBoss = {
        id: 'boss_kirin', name: '麒麟', type: 'boss',
        stage: 'Ⅰ', hp: 8, charm: 3,
        effect: '伤害+3', arrivalEffect: '无',
        keywords: ['御魂'], multiPlayer: false, image: '', count: 1,
      };
      state.field.bossCurrentHp = 8;
      state.field.bossDeck = [{
        id: 'boss_sekigu', name: '石距', type: 'boss',
        stage: 'Ⅰ', hp: 9, charm: 3,
        effect: '鬼火+1，抓牌+1，伤害+2', arrivalEffect: '每位玩家展示手牌，并弃掉所有的阴阳术',
        keywords: ['御魂', '鬼火'], multiPlayer: false, image: '', count: 1,
      }];

      game.startTurn();
      game.confirmShikigamiPhase();
      player = game.getCurrentPlayer();
      player.damage = 20; // 足够击败鬼王
    });

    it('攻击鬼王时HP减少', () => {
      const state = game.getState();

      game.handleAction('p1', { type: 'ATTACK', targetId: 'boss', damage: 3 });

      expect(state.field.bossCurrentHp).toBe(5);
    });

    it('鬼王HP降至0后被击败，翻出下一个', () => {
      const state = game.getState();

      game.handleAction('p1', { type: 'ATTACK', targetId: 'boss', damage: 8 });

      // 当前鬼王应该变成石距
      expect(state.field.currentBoss?.name).toBe('石距');
      expect(state.field.bossCurrentHp).toBe(9);
    });

    it('击败鬼王后鬼王卡进入玩家弃牌堆', () => {
      game.handleAction('p1', { type: 'ATTACK', targetId: 'boss', damage: 8 });

      // 鬼王卡（麒麟）应该在玩家弃牌堆中，以便结算时计入声誉
      const bossInDiscard = player.discard.some(c => c.name === '麒麟');
      expect(bossInDiscard).toBe(true);
    });

    it('击败最后一个鬼王后游戏结束', () => {
      const state = game.getState();
      // 清空鬼王牌库，只剩当前这一个
      state.field.bossDeck = [];

      game.handleAction('p1', { type: 'ATTACK', targetId: 'boss', damage: 8 });

      expect(state.phase).toBe('ended');
    });

    it('新鬼王来袭时记录到游戏日志', () => {
      const state = game.getState();

      game.handleAction('p1', { type: 'ATTACK', targetId: 'boss', damage: 8 });

      // 日志中应该有"石距来袭"相关记录
      const bossLog = state.log.find(l => l.message.includes('石距') && l.message.includes('来袭'));
      expect(bossLog).toBeDefined();
    });
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

    it('式神区的声誉也计入最终结算', () => {
      const state = game.getState();
      state.phase = 'playing';

      const p1 = state.players[0]!;
      p1.deck = [];
      p1.hand = [];
      p1.discard = [];

      // 式神区有一个SSR式神（声誉3）
      p1.shikigami = [{
        id: 'shikigami_妖刀姬',
        name: '妖刀姬',
        type: 'shikigami',
        rarity: 'SSR',
        charm: 3,
        multiPlayer: false,
        skill: { name: '杀戮', effectType: '启', cost: 2, effect: '' },
        image: '',
        count: 1,
      }];

      (game as any).endGame();

      expect(state.phase).toBe('ended');
      // 声誉应该包含式神的3点
      expect(p1.totalCharm).toBe(3);
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
