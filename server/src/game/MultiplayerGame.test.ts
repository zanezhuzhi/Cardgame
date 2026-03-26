/**
 * 式神获取/置换 - 自动化测试
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
function createSpellCard(damage: number, name: string) {
  return {
    instanceId: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    cardId: `spell_00${damage}`,
    cardType: 'spell' as const,
    name,
    damage,
    hp: damage,
    charm: 0,
    effect: '',
    image: '',
  };
}

function createShikigamiCard(id: string, name: string) {
  return {
    id,
    name,
    skill: '测试技能',
    exhaustCondition: '无',
    exhaustEffect: '无',
    charm: 2,
    image: '',
  };
}

describe('式神获取/置换', () => {
  let game: MultiplayerGame;
  let player1: any;

  beforeEach(() => {
    game = new MultiplayerGame('test-room', mockPlayers as any);
    // 跳过式神选择阶段，直接开始游戏
    (game as any).state.phase = 'playing';
    (game as any).state.turnPhase = 'action';
    (game as any).state.currentPlayerIndex = 0;
    player1 = (game as any).state.players[0];
  });

  describe('按钮状态测试', () => {
    it('1-1: 无式神，符咒伤害<5 → 不能获取式神', () => {
      player1.hand = [];
      player1.shikigami = [];
      player1.hand.push(createSpellCard(1, '初级符咒'));
      player1.hand.push(createSpellCard(1, '初级符咒'));
      
      const result = (game as any).handleGetShikigamiCandidates(
        'player1',
        player1.hand.map((c: any) => c.instanceId),
        false
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('伤害不足');
    });

    it('1-2: 无式神，符咒伤害>=5，无高级符咒 → 不能获取式神', () => {
      player1.hand = [];
      player1.shikigami = [];
      for (let i = 0; i < 5; i++) {
        player1.hand.push(createSpellCard(1, '初级符咒'));
      }
      
      const result = (game as any).handleGetShikigamiCandidates(
        'player1',
        player1.hand.map((c: any) => c.instanceId),
        false
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('高级符咒');
    });

    it('1-3: 无式神，符咒伤害>=5，有高级符咒 → 可以获取式神', () => {
      player1.hand = [];
      player1.shikigami = [];
      player1.hand.push(createSpellCard(3, '高级符咒'));
      player1.hand.push(createSpellCard(2, '中级符咒'));
      player1.hand.push(createSpellCard(2, '中级符咒'));
      
      (game as any).state.field.shikigamiSupply = [
        createShikigamiCard('s1', '测试式神1'),
        createShikigamiCard('s2', '测试式神2'),
        createShikigamiCard('s3', '测试式神3'),
      ];
      
      const result = (game as any).handleGetShikigamiCandidates(
        'player1',
        player1.hand.map((c: any) => c.instanceId),
        false
      );
      
      expect(result.success).toBe(true);
    });

    it('1-4: 3个式神，无高级符咒 → 不能置换式神', () => {
      player1.hand = [];
      player1.shikigami = [
        createShikigamiCard('s1', '式神1'),
        createShikigamiCard('s2', '式神2'),
        createShikigamiCard('s3', '式神3'),
      ];
      player1.hand.push(createSpellCard(1, '初级符咒'));
      
      const result = (game as any).handleGetShikigamiCandidates(
        'player1',
        player1.hand.map((c: any) => c.instanceId),
        true
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('高级符咒');
    });

    it('1-5: 3个式神，有高级符咒 → 可以置换式神', () => {
      player1.hand = [];
      player1.shikigami = [
        createShikigamiCard('s1', '式神1'),
        createShikigamiCard('s2', '式神2'),
        createShikigamiCard('s3', '式神3'),
      ];
      player1.hand.push(createSpellCard(3, '高级符咒'));
      
      (game as any).state.field.shikigamiSupply = [
        createShikigamiCard('s4', '新式神1'),
        createShikigamiCard('s5', '新式神2'),
      ];
      
      const result = (game as any).handleGetShikigamiCandidates(
        'player1',
        player1.hand.map((c: any) => c.instanceId),
        true
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('获得式神流程测试', () => {
    it('2-1: 选择符咒后，符咒移入超度区', () => {
      player1.hand = [];
      player1.exiled = [];
      player1.shikigami = [];
      
      const spell1 = createSpellCard(3, '高级符咒');
      const spell2 = createSpellCard(2, '中级符咒');
      player1.hand.push(spell1);
      player1.hand.push(spell2);
      
      (game as any).state.field.shikigamiSupply = [
        createShikigamiCard('s1', '测试式神1'),
        createShikigamiCard('s2', '测试式神2'),
      ];
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
      
      expect(player1.hand.length).toBe(0);
      expect(player1.exiled.length).toBe(2);
    });

    it('2-2: 候选数量固定为2个', () => {
      player1.hand = [];
      player1.exiled = [];
      player1.shikigami = [];
      
      player1.hand.push(createSpellCard(3, '高级咒术'));
      player1.hand.push(createSpellCard(3, '高级咒术'));
      player1.hand.push(createSpellCard(3, '高级咒术'));
      
      (game as any).state.field.shikigamiSupply = [
        createShikigamiCard('s1', '测试式神1'),
        createShikigamiCard('s2', '测试式神2'),
        createShikigamiCard('s3', '测试式神3'),
        createShikigamiCard('s4', '测试式神4'),
      ];
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
      
      const candidates = (player1 as any).pendingShikigamiCandidates;
      expect(candidates.length).toBe(2);
    });

    it('2-3: 确认获取式神后，式神加入玩家区域', () => {
      player1.hand = [];
      player1.exiled = [];
      player1.shikigami = [];
      player1.shikigamiState = [];
      
      player1.hand.push(createSpellCard(3, '高级咒术'));
      player1.hand.push(createSpellCard(2, '中级咒术'));
      
      const testShikigami1 = createShikigamiCard('acquire_test_1', '获取测试式神1');
      const testShikigami2 = createShikigamiCard('acquire_test_2', '获取测试式神2');
      (game as any).state.field.shikigamiSupply = [testShikigami1, testShikigami2];
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
      
      const result = (game as any).handleAcquireShikigami('player1', 'acquire_test_2', []);
      
      expect(result.success).toBe(true);
      expect(player1.shikigami.length).toBe(1);
      expect(player1.shikigami[0].name).toBe('获取测试式神2');
    });

    it('2-4: 未选中的式神放回牌堆', () => {
      player1.hand = [];
      player1.exiled = [];
      player1.shikigami = [];
      player1.shikigamiState = [];
      
      player1.hand.push(createSpellCard(3, '高级咒术'));
      player1.hand.push(createSpellCard(2, '中级咒术'));
      
      const testShikigami1 = createShikigamiCard('acquire_back_1', '获取测试式神1');
      const testShikigami2 = createShikigamiCard('acquire_back_2', '获取测试式神2');
      (game as any).state.field.shikigamiSupply = [testShikigami1, testShikigami2];
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      (game as any).handleGetShikigamiCandidates('player1', spellIds, false);
      (game as any).handleAcquireShikigami('player1', 'acquire_back_2', []);
      
      const supply = (game as any).state.field.shikigamiSupply;
      const hasUnselected = supply.some((s: any) => s.id === 'acquire_back_1');
      expect(hasUnselected).toBe(true);
    });

    it('2-5: 式神上限为3个', () => {
      player1.shikigami = [
        createShikigamiCard('s1', '式神1'),
        createShikigamiCard('s2', '式神2'),
        createShikigamiCard('s3', '式神3'),
      ];
      
      (player1 as any).pendingShikigamiCandidates = [createShikigamiCard('s4', '新式神')];
      
      const result = (game as any).handleAcquireShikigami('player1', 's4', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('上限');
    });
  });

  describe('置换式神流程测试', () => {
    it('3-1: 置换式神需要恰好1张高级符咒', () => {
      player1.hand = [];
      player1.shikigami = [
        createShikigamiCard('old1', '旧式神1'),
        createShikigamiCard('old2', '旧式神2'),
        createShikigamiCard('old3', '旧式神3'),
      ];
      
      player1.hand.push(createSpellCard(3, '高级符咒'));
      player1.hand.push(createSpellCard(3, '高级符咒'));
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      const result = (game as any).handleGetShikigamiCandidates('player1', spellIds, true);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('恰好1张');
    });

    it('3-2: 置换后旧式神放回牌堆', () => {
      player1.hand = [];
      player1.exiled = [];
      player1.shikigami = [
        createShikigamiCard('replace_old', '被替换的式神'),
      ];
      player1.shikigamiState = [{ cardId: 'replace_old', isExhausted: false, markers: {} }];
      
      player1.hand.push(createSpellCard(3, '高级符咒'));
      
      const newShikigami = createShikigamiCard('replace_new', '新式神');
      (game as any).state.field.shikigamiSupply = [newShikigami, createShikigamiCard('other', '其他')];
      
      const spellIds = player1.hand.map((c: any) => c.instanceId);
      (game as any).handleGetShikigamiCandidates('player1', spellIds, true);
      
      const result = (game as any).handleReplaceShikigami('player1', 'replace_new', 0, []);
      
      expect(result.success).toBe(true);
      expect(player1.shikigami[0].name).toBe('新式神');
      
      const supply = (game as any).state.field.shikigamiSupply;
      const hasOld = supply.some((s: any) => s.id === 'replace_old');
      expect(hasOld).toBe(true);
    });
  });
});