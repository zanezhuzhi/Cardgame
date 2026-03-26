/**
 * 获得阴阳术 - 自动化测试
 * TDD Red/Green 测试 (vitest)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerGame } from './MultiplayerGame';

// 模拟玩家信息
const mockPlayers = [
  { id: 'player1', name: '测试玩家1' },
  { id: 'player2', name: '测试玩家2' },
];

// 创建测试用的卡牌
function createSpellCard(damage: number, name: string, cardId: string) {
  return {
    instanceId: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId,
    cardType: 'spell' as const,
    name,
    damage,
    hp: damage,
    charm: 0,
    effect: '',
    image: '',
  };
}

function createYokaiCard(hp: number, name: string) {
  return {
    instanceId: `yokai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId: `yokai_test_${hp}`,
    cardType: 'yokai' as const,
    name,
    hp,
    maxHp: hp,
    damage: 0,
    charm: 1,
    effect: '',
    image: '',
  };
}

describe('获得阴阳术', () => {
  let game: MultiplayerGame;
  let player1: any;

  beforeEach(() => {
    game = new MultiplayerGame('test-room', mockPlayers as any);
    (game as any).state.phase = 'playing';
    (game as any).state.turnPhase = 'action';
    (game as any).state.currentPlayerIndex = 0;
    player1 = (game as any).state.players[0];
  });

  describe('基础术式测试', () => {
    it('1-1: 行动阶段可以获得基础术式', () => {
      player1.hasGainedBasicSpell = false;
      player1.discard = [];
      
      const result = (game as any).handleGainBasicSpell('player1');
      
      expect(result.success).toBe(true);
      expect(player1.discard.length).toBe(1);
      expect(player1.discard[0].name).toBe('基础术式');
      expect(player1.discard[0].damage).toBe(1);
    });

    it('1-2: 本回合已获得基础术式不能再次获得', () => {
      player1.hasGainedBasicSpell = false;
      player1.discard = [];
      (game as any).handleGainBasicSpell('player1');
      
      const result = (game as any).handleGainBasicSpell('player1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('已获得');
    });

    it('1-3: 非行动阶段不能获得基础术式', () => {
      player1.hasGainedBasicSpell = false;
      (game as any).state.turnPhase = 'draw';
      
      const result = (game as any).handleGainBasicSpell('player1');
      expect(result.success).toBe(false);
    });
  });

  describe('中级符咒测试', () => {
    it('2-1: 手牌无基础术式不能兑换中级符咒', () => {
      player1.hand = [];
      player1.discard = [createYokaiCard(3, '测试妖怪')];
      (player1 as any).hasGainedMediumSpell = false;
      
      const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('基础术式');
    });

    it('2-2: 弃牌堆无符合条件妖怪不能兑换中级符咒', () => {
      player1.hand = [createSpellCard(1, '基础术式', 'spell_001')];
      player1.discard = [createYokaiCard(1, '弱小妖怪')];
      (player1 as any).hasGainedMediumSpell = false;
      
      const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('生命值不足');
    });

    it('2-3: 满足条件可以兑换中级符咒', () => {
      const basicSpell = createSpellCard(1, '基础术式', 'spell_001');
      const yokai = createYokaiCard(3, '符合条件妖怪');
      
      player1.hand = [basicSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedMediumSpell = false;
      
      const result = (game as any).handleExchangeMediumSpell('player1', yokai.instanceId);
      
      expect(result.success).toBe(true);
      expect(player1.hand.length).toBe(0);
      expect(player1.exiled.length).toBe(2);
      expect(player1.discard.length).toBe(1);
      expect(player1.discard[0].name).toBe('中级符咒');
      expect(player1.discard[0].damage).toBe(2);
    });

    it('2-4: 本回合已兑换中级符咒不能再次兑换', () => {
      const basicSpell = createSpellCard(1, '基础术式', 'spell_001');
      const yokai = createYokaiCard(3, '妖怪');
      player1.hand = [basicSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedMediumSpell = false;
      (game as any).handleExchangeMediumSpell('player1', yokai.instanceId);
      
      // 再次尝试
      player1.hand = [createSpellCard(1, '基础术式', 'spell_001')];
      player1.discard = [createYokaiCard(3, '另一个妖怪')];
      const result = (game as any).handleExchangeMediumSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('已兑换');
    });
  });

  describe('高级符咒测试', () => {
    it('3-1: 手牌无中级符咒不能兑换高级符咒', () => {
      player1.hand = [];
      player1.discard = [createYokaiCard(5, '强力妖怪')];
      (player1 as any).hasGainedAdvancedSpell = false;
      
      const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('中级符咒');
    });

    it('3-2: 弃牌堆妖怪生命<4不能兑换高级符咒', () => {
      player1.hand = [createSpellCard(2, '中级符咒', 'spell_002')];
      player1.discard = [createYokaiCard(3, '普通妖怪')];
      (player1 as any).hasGainedAdvancedSpell = false;
      
      const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('生命值不足');
    });

    it('3-3: 满足条件可以兑换高级符咒', () => {
      const mediumSpell = createSpellCard(2, '中级符咒', 'spell_002');
      const yokai = createYokaiCard(5, '高级妖怪');
      
      player1.hand = [mediumSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedAdvancedSpell = false;
      
      const result = (game as any).handleExchangeAdvancedSpell('player1', yokai.instanceId);
      
      expect(result.success).toBe(true);
      expect(player1.hand.length).toBe(0);
      expect(player1.exiled.length).toBe(2);
      expect(player1.discard.length).toBe(1);
      expect(player1.discard[0].name).toBe('高级符咒');
      expect(player1.discard[0].damage).toBe(3);
    });

    it('3-4: 本回合已兑换高级符咒不能再次兑换', () => {
      const mediumSpell = createSpellCard(2, '中级符咒', 'spell_002');
      const yokai = createYokaiCard(5, '妖怪');
      player1.hand = [mediumSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedAdvancedSpell = false;
      (game as any).handleExchangeAdvancedSpell('player1', yokai.instanceId);
      
      // 再次尝试
      player1.hand = [createSpellCard(2, '中级符咒', 'spell_002')];
      player1.discard = [createYokaiCard(5, '另一个高级妖怪')];
      const result = (game as any).handleExchangeAdvancedSpell('player1', player1.discard[0].instanceId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('已兑换');
    });
  });

  describe('回合重置测试', () => {
    it('4-1: 新回合开始时重置获取标记', () => {
      player1.hasGainedBasicSpell = true;
      (player1 as any).hasGainedMediumSpell = true;
      (player1 as any).hasGainedAdvancedSpell = true;
      
      (game as any).state.currentPlayerIndex = 0;
      (game as any).startTurn();
      
      expect(player1.hasGainedBasicSpell).toBe(false);
      expect((player1 as any).hasGainedMediumSpell).toBe(false);
      expect((player1 as any).hasGainedAdvancedSpell).toBe(false);
    });
  });

  describe('超度区验证', () => {
    it('5-1: 兑换中级符咒时基础术式和妖怪都进入超度区', () => {
      const basicSpell = createSpellCard(1, '基础术式', 'spell_001');
      const yokai = createYokaiCard(3, '被超度的妖怪');
      
      player1.hand = [basicSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedMediumSpell = false;
      
      (game as any).handleExchangeMediumSpell('player1', yokai.instanceId);
      
      expect(player1.exiled.length).toBe(2);
      expect(player1.exiled.some((c: any) => c.name === '基础术式')).toBe(true);
      expect(player1.exiled.some((c: any) => c.name === '被超度的妖怪')).toBe(true);
    });

    it('5-2: 兑换高级符咒时中级符咒和妖怪都进入超度区', () => {
      const mediumSpell = createSpellCard(2, '中级符咒', 'spell_002');
      const yokai = createYokaiCard(5, '被超度的大妖怪');
      
      player1.hand = [mediumSpell];
      player1.discard = [yokai];
      player1.exiled = [];
      (player1 as any).hasGainedAdvancedSpell = false;
      
      (game as any).handleExchangeAdvancedSpell('player1', yokai.instanceId);
      
      expect(player1.exiled.length).toBe(2);
      expect(player1.exiled.some((c: any) => c.name === '中级符咒')).toBe(true);
      expect(player1.exiled.some((c: any) => c.name === '被超度的大妖怪')).toBe(true);
    });
  });
});