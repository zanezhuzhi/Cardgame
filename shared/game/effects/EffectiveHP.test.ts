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
  createNetCutterModifiers,
  applyNetCutterEffect,
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
    
    it('🟢 创建网切修改器（新版，返回两个修改器）', () => {
      const modifiers = createNetCutterModifiers('player1');
      
      expect(modifiers).toHaveLength(2);
      
      // 妖怪HP-1修改器
      const yokaiMod = modifiers[0];
      expect(yokaiMod.sourceCardId).toBe('yokai_020');
      expect(yokaiMod.sourceCardName).toBe('网切');
      expect(yokaiMod.type).toBe('flat');
      expect(yokaiMod.value).toBe(-1);
      expect(yokaiMod.scope.target).toBe('yokai');
      expect(yokaiMod.duration).toBe('turnEnd');
      
      // 鬼王HP-2修改器
      const bossMod = modifiers[1];
      expect(bossMod.sourceCardId).toBe('yokai_020');
      expect(bossMod.sourceCardName).toBe('网切');
      expect(bossMod.type).toBe('flat');
      expect(bossMod.value).toBe(-2);
      expect(bossMod.scope.target).toBe('boss');
      expect(bossMod.duration).toBe('turnEnd');
    });
    
    it('🟢 applyNetCutterEffect: 完整添加网切效果', () => {
      applyNetCutterEffect(manager, 'player1');
      
      expect(manager.modifiers).toHaveLength(2);
      expect(isNetCutterActive(manager)).toBe(true);
      expect(getNetCutterBonus(manager, 'yokai')).toBe(-1);
      expect(getNetCutterBonus(manager, 'boss')).toBe(-2);
    });
    
    it('🟢 网切: 妖怪HP-1', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const hp2Yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 2 };
      const hp5Yokai: CardHPInfo = { instanceId: 'inst_002', cardType: 'yokai', baseHp: 5 };
      const hp8Yokai: CardHPInfo = { instanceId: 'inst_003', cardType: 'yokai', baseHp: 8 };
      
      expect(calculateEffectiveHP(manager, hp2Yokai)).toBe(1);  // 2-1 = 1
      expect(calculateEffectiveHP(manager, hp5Yokai)).toBe(4);  // 5-1 = 4
      expect(calculateEffectiveHP(manager, hp8Yokai)).toBe(7);  // 8-1 = 7
    });
    
    it('🟢 网切: 鬼王HP-2', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const hp8Boss: CardHPInfo = { instanceId: 'boss_001', cardType: 'boss', baseHp: 8 };
      const hp3Boss: CardHPInfo = { instanceId: 'boss_002', cardType: 'boss', baseHp: 3 };
      
      expect(calculateEffectiveHP(manager, hp8Boss)).toBe(6);  // 8-2 = 6
      expect(calculateEffectiveHP(manager, hp3Boss)).toBe(1);  // 3-2 = 1
    });
    
    it('🟢 网切: HP最低值保护（妖怪HP=1不变）', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const hp1Yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 1 };
      expect(calculateEffectiveHP(manager, hp1Yokai)).toBe(1);  // 1-1=0 → 保护为1
    });
    
    it('🟢 网切: HP最低值保护（鬼王HP=2变为1）', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const hp2Boss: CardHPInfo = { instanceId: 'boss_001', cardType: 'boss', baseHp: 2 };
      const hp1Boss: CardHPInfo = { instanceId: 'boss_002', cardType: 'boss', baseHp: 1 };
      
      expect(calculateEffectiveHP(manager, hp2Boss)).toBe(1);  // 2-2=0 → 保护为1
      expect(calculateEffectiveHP(manager, hp1Boss)).toBe(1);  // 1-2=-1 → 保护为1
    });
    
    it('🟢 网切: 不影响非妖怪/鬼王卡牌', () => {
      applyNetCutterEffect(manager, 'player1');
      
      // yokai scope只对yokai生效，boss scope只对boss生效
      // spell等类型的卡不进入HP计算系统
      const yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      const boss: CardHPInfo = { instanceId: 'boss_001', cardType: 'boss', baseHp: 8 };
      
      expect(calculateEffectiveHP(manager, yokai)).toBe(4);  // 5-1
      expect(calculateEffectiveHP(manager, boss)).toBe(6);   // 8-2
    });
    
    it('🟢 网切: 覆盖不叠加（多次使用）', () => {
      // 第一次使用
      applyNetCutterEffect(manager, 'player1');
      expect(manager.modifiers).toHaveLength(2);
      
      // 第二次使用（应覆盖而非叠加）
      applyNetCutterEffect(manager, 'player1');
      expect(manager.modifiers).toHaveLength(2);  // 仍然只有2个修改器
      
      const yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      const boss: CardHPInfo = { instanceId: 'boss_001', cardType: 'boss', baseHp: 8 };
      
      expect(calculateEffectiveHP(manager, yokai)).toBe(4);  // 5-1（不是5-2）
      expect(calculateEffectiveHP(manager, boss)).toBe(6);   // 8-2（不是8-4）
    });
    
    it('🟢 网切: 回合结束后状态清除', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const yokai: CardHPInfo = { instanceId: 'inst_001', cardType: 'yokai', baseHp: 5 };
      const boss: CardHPInfo = { instanceId: 'boss_001', cardType: 'boss', baseHp: 8 };
      
      // 清除前
      expect(calculateEffectiveHP(manager, yokai)).toBe(4);
      expect(calculateEffectiveHP(manager, boss)).toBe(6);
      
      // 回合结束清理
      const removed = cleanupTurnEndModifiers(manager);
      expect(removed).toBe(2);  // 移除2个修改器（妖怪+鬼王）
      expect(isNetCutterActive(manager)).toBe(false);
      
      // 清除后恢复原值
      expect(calculateEffectiveHP(manager, yokai)).toBe(5);
      expect(calculateEffectiveHP(manager, boss)).toBe(8);
    });
    
    it('🟢 网切: 向后兼容旧函数 createNetCutterModifier', () => {
      const modifier = createNetCutterModifier('player1');
      
      expect(modifier.sourceCardId).toBe('yokai_020');
      expect(modifier.sourceCardName).toBe('网切');
      expect(modifier.type).toBe('flat');
      expect(modifier.value).toBe(-1);  // 妖怪HP-1
      expect(modifier.scope.target).toBe('yokai');
      expect(modifier.duration).toBe('turnEnd');
    });
    
  });
  
  describe('批量计算', () => {
    
    it('🟢 批量计算多张卡牌HP（含网切效果）', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const cards: CardHPInfo[] = [
        { instanceId: 'inst_001', cardType: 'yokai', baseHp: 2 },
        { instanceId: 'inst_002', cardType: 'yokai', baseHp: 5 },
        { instanceId: 'inst_003', cardType: 'boss', baseHp: 8 },
      ];
      
      const result = calculateAllEffectiveHP(manager, cards);
      
      expect(result.get('inst_001')).toBe(1);  // 2-1 = 1
      expect(result.get('inst_002')).toBe(4);  // 5-1 = 4
      expect(result.get('inst_003')).toBe(6);  // 8-2 = 6（鬼王）
    });
    
  });
  
  describe('修改器摘要', () => {
    
    it('🟢 获取活跃修改器摘要（网切）', () => {
      applyNetCutterEffect(manager, 'player1');
      
      const summary = getActiveModifiersSummary(manager);
      expect(summary).toHaveLength(2);
      // 妖怪修改器摘要
      expect(summary[0]).toContain('网切');
      expect(summary[0]).toContain('妖怪');
      expect(summary[0]).toContain('-1');
      // 鬼王修改器摘要
      expect(summary[1]).toContain('网切');
      expect(summary[1]).toContain('鬼王');
      expect(summary[1]).toContain('-2');
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
