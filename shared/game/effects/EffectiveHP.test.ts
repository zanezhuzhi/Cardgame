/**
 * 御魂传说 - 动态HP计算系统测试
 * @file shared/game/effects/EffectiveHP.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHPModifierManager,
  addHPModifier,
  removeHPModifier,
  removeModifiersBySource,
  cleanupTurnEndModifiers,
  calculateEffectiveHP,
  getApplicableModifiers,
  createNetCutterModifier,
  isNetCutterActive,
  getNetCutterBonus,
  calculateAllEffectiveHP,
  getActiveModifiersSummary,
  HPModifierManager,
  CardHPInfo,
} from '../EffectiveHP';

describe('动态HP计算系统', () => {
  let manager: HPModifierManager;
  
  beforeEach(() => {
    manager = createHPModifierManager();
  });
  
  describe('HP修改器管理', () => {
    
    it('🟢 创建空的修改器管理器', () => {
      expect(manager.modifiers).toHaveLength(0);
    });
    
    it('🟢 添加HP修改器', () => {
      const id = addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      
      expect(id).toBeTruthy();
      expect(manager.modifiers).toHaveLength(1);
      expect(manager.modifiers[0].sourceCardName).toBe('网切');
    });
    
    it('🟢 移除指定HP修改器', () => {
      const id = addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      
      expect(removeHPModifier(manager, id)).toBe(true);
      expect(manager.modifiers).toHaveLength(0);
    });
    
    it('🟢 按来源移除修改器', () => {
      addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      addHPModifier(manager, {
        sourceCardId: 'yokai_020',
        sourceCardName: '其他',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 1,
        priority: 5,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      
      const removed = removeModifiersBySource(manager, 'yokai_019');
      expect(removed).toBe(1);
      expect(manager.modifiers).toHaveLength(1);
      expect(manager.modifiers[0].sourceCardName).toBe('其他');
    });
    
    it('🟢 清理回合结束修改器', () => {
      addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      addHPModifier(manager, {
        sourceCardId: 'yokai_xxx',
        sourceCardName: '永久效果',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 1,
        priority: 5,
        scope: { target: 'all' },
        duration: 'permanent',
      });
      
      const removed = cleanupTurnEndModifiers(manager);
      expect(removed).toBe(1);
      expect(manager.modifiers).toHaveLength(1);
      expect(manager.modifiers[0].sourceCardName).toBe('永久效果');
    });
    
  });
  
  describe('有效HP计算', () => {
    
    it('🟢 无修改器时返回基础HP', () => {
      const card: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      expect(calculateEffectiveHP(manager, card)).toBe(5);
    });
    
    it('🟢 应用固定值加成', () => {
      addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      
      const card: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      expect(calculateEffectiveHP(manager, card)).toBe(8);  // 5 + 3
    });
    
    it('🟢 HP最低为1', () => {
      addHPModifier(manager, {
        sourceCardId: 'effect_debuff',
        sourceCardName: '减HP效果',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: -10,
        priority: 10,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      
      const card: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 3 };
      expect(calculateEffectiveHP(manager, card)).toBe(1);  // 最低1
    });
    
    it('🟢 多个修改器叠加', () => {
      addHPModifier(manager, {
        sourceCardId: 'effect_1',
        sourceCardName: '效果1',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 2,
        priority: 10,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      addHPModifier(manager, {
        sourceCardId: 'effect_2',
        sourceCardName: '效果2',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 1,
        priority: 5,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      
      const card: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 3 };
      expect(calculateEffectiveHP(manager, card)).toBe(6);  // 3 + 2 + 1
    });
    
  });
  
  describe('作用范围筛选', () => {
    
    it('🟢 仅作用于妖怪', () => {
      addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { target: 'yokai' },
        duration: 'turnEnd',
      });
      
      const yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      const boss: CardHPInfo = { instanceId: 'inst_002', cardType: 'boss', baseHp: 10 };
      
      expect(calculateEffectiveHP(manager, yokai)).toBe(8);  // 5 + 3
      expect(calculateEffectiveHP(manager, boss)).toBe(10);  // 不受影响
    });
    
    it('🟢 HP条件筛选（网切: HP<6）', () => {
      addHPModifier(manager, {
        sourceCardId: 'yokai_019',
        sourceCardName: '网切',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 3,
        priority: 10,
        scope: { 
          target: 'yokai',
          hpCondition: { operator: '<', value: 6 },
        },
        duration: 'turnEnd',
      });
      
      const lowHp: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      const highHp: CardHPInfo = { instanceId: 'inst_002', cardType: 'yokai', baseHp: 7 };
      
      expect(calculateEffectiveHP(manager, lowHp)).toBe(8);   // 5 + 3（受影响）
      expect(calculateEffectiveHP(manager, highHp)).toBe(7);  // 不受影响
    });
    
    it('🟢 指定特定卡牌', () => {
      addHPModifier(manager, {
        sourceCardId: 'effect_target',
        sourceCardName: '指定效果',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 5,
        priority: 10,
        scope: { 
          target: 'specific',
          cardInstanceIds: ['inst_001'],
        },
        duration: 'turnEnd',
      });
      
      const target: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 3 };
      const other: CardHPInfo = { instanceId: 'inst_002', cardType: 'yokai', baseHp: 3 };
      
      expect(calculateEffectiveHP(manager, target)).toBe(8);  // 3 + 5
      expect(calculateEffectiveHP(manager, other)).toBe(3);   // 不受影响
    });
    
  });
  
  describe('网切效果', () => {
    
    it('🟢 创建网切修改器', () => {
      const modifier = createNetCutterModifier('player1');
      
      expect(modifier.sourceCardId).toBe('yokai_019');
      expect(modifier.sourceCardName).toBe('网切');
      expect(modifier.type).toBe('flat');
      expect(modifier.value).toBe(3);
      expect(modifier.scope.target).toBe('yokai');
      expect(modifier.scope.hpCondition?.operator).toBe('<');
      expect(modifier.scope.hpCondition?.value).toBe(6);
      expect(modifier.duration).toBe('turnEnd');
    });
    
    it('🟢 网切效果完整模拟', () => {
      // 添加网切效果
      addHPModifier(manager, createNetCutterModifier('player1'));
      
      // 验证效果激活
      expect(isNetCutterActive(manager)).toBe(true);
      expect(getNetCutterBonus(manager)).toBe(3);
      
      // 验证HP计算
      const hp2Yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 2 };
      const hp5Yokai: CardHPInfo = { instanceId: 'inst_002', cardType: 'yokai', baseHp: 5 };
      const hp6Yokai: CardHPInfo = { instanceId: 'inst_003', cardType: 'yokai', baseHp: 6 };
      const hp8Yokai: CardHPInfo = { instanceId: 'inst_004', cardType: 'yokai', baseHp: 8 };
      
      expect(calculateEffectiveHP(manager, hp2Yokai)).toBe(5);  // 2 + 3
      expect(calculateEffectiveHP(manager, hp5Yokai)).toBe(8);  // 5 + 3
      expect(calculateEffectiveHP(manager, hp6Yokai)).toBe(6);  // 不受影响（HP=6不满足<6）
      expect(calculateEffectiveHP(manager, hp8Yokai)).toBe(8);  // 不受影响
      
      // 回合结束清理
      cleanupTurnEndModifiers(manager);
      expect(isNetCutterActive(manager)).toBe(false);
      expect(calculateEffectiveHP(manager, hp5Yokai)).toBe(5);  // 恢复原值
    });
    
    it('🟢 自定义网切加成值', () => {
      const modifier = createNetCutterModifier('player1', 5);  // +5而不是+3
      expect(modifier.value).toBe(5);
    });
    
  });
  
  describe('批量计算', () => {
    
    it('🟢 批量计算多张卡牌HP', () => {
      addHPModifier(manager, createNetCutterModifier('player1'));
      
      const cards: CardHPInfo[] = [
        { instanceId: 'inst_001', cardType: 'yokai', baseHp: 2 },
        { instanceId: 'inst_002', cardType: 'yokai', baseHp: 5 },
        { instanceId: 'inst_003', cardType: 'yokai', baseHp: 7 },
      ];
      
      const result = calculateAllEffectiveHP(manager, cards);
      
      expect(result.get('inst_001')).toBe(5);  // 2 + 3
      expect(result.get('inst_002')).toBe(8);  // 5 + 3
      expect(result.get('inst_003')).toBe(7);  // 不受影响
    });
    
  });
  
  describe('修改器摘要', () => {
    
    it('🟢 获取活跃修改器摘要', () => {
      addHPModifier(manager, createNetCutterModifier('player1'));
      
      const summary = getActiveModifiersSummary(manager);
      expect(summary).toHaveLength(1);
      expect(summary[0]).toContain('网切');
      expect(summary[0]).toContain('妖怪');
      expect(summary[0]).toContain('+3');
    });
    
  });
  
  describe('复杂修改器组合', () => {
    
    it('🟢 set + flat 组合', () => {
      // 先设置HP为5
      addHPModifier(manager, {
        sourceCardId: 'effect_set',
        sourceCardName: '设置效果',
        sourcePlayerId: 'player1',
        type: 'set',
        value: 5,
        priority: 20,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      // 再加2
      addHPModifier(manager, {
        sourceCardId: 'effect_flat',
        sourceCardName: '加成效果',
        sourcePlayerId: 'player1',
        type: 'flat',
        value: 2,
        priority: 10,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      
      const card: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 10 };
      expect(calculateEffectiveHP(manager, card)).toBe(7);  // set(5) + 2
    });
    
    it('🟢 min/max 限制', () => {
      // 设置最小HP为3
      addHPModifier(manager, {
        sourceCardId: 'effect_min',
        sourceCardName: '最小值效果',
        sourcePlayerId: 'player1',
        type: 'min',
        value: 3,
        priority: 10,
        scope: { target: 'all' },
        duration: 'turnEnd',
      });
      
      const lowCard: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 1 };
      const highCard: CardHPInfo = { instanceId: 'inst_002', cardType: 'yokai', baseHp: 5 };
      
      expect(calculateEffectiveHP(manager, lowCard)).toBe(3);   // 限制为最小3
      expect(calculateEffectiveHP(manager, highCard)).toBe(5);  // 不受影响
    });
    
  });
  
});
