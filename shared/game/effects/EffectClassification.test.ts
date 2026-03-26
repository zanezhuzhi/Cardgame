/**
 * 御魂传说 - 效果分类系统测试
 * @file shared/game/effects/EffectClassification.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  isHarassmentEffect,
  isBossRaidEffect,
  getEffectCategory,
  getEffectClassification,
  getAvailableDefenses,
  isDefendableEffect,
  createEffectTriggerContext,
  HARASSMENT_CARDS,
  BOSS_RAID_EFFECTS,
  DEFENSE_CARDS,
} from '../EffectClassification';

describe('效果分类系统', () => {
  
  describe('妨害效果识别', () => {
    
    it('🟢 赤舌是妨害效果', () => {
      expect(isHarassmentEffect('yokai_007')).toBe(true);
      expect(getEffectCategory('yokai_007')).toBe('harassment');
    });
    
    it('🟢 魅妖是妨害效果', () => {
      expect(isHarassmentEffect('yokai_008')).toBe(true);
    });
    
    it('🟢 雪幽魂是妨害效果', () => {
      expect(isHarassmentEffect('yokai_015')).toBe(true);
    });
    
    it('🟢 魍魉之匣是妨害效果', () => {
      expect(isHarassmentEffect('yokai_016')).toBe(true);
    });
    
    it('🟢 返魂香是妨害效果', () => {
      expect(isHarassmentEffect('yokai_024')).toBe(true);
    });
    
    it('🟢 幽谷响是妨害效果', () => {
      expect(isHarassmentEffect('yokai_034')).toBe(true);
    });
    
    it('🔴 唐纸伞妖不是妨害效果（自我效果）', () => {
      expect(isHarassmentEffect('yokai_001')).toBe(false);
      expect(getEffectCategory('yokai_001')).toBe('normal');
    });
    
    it('🔴 青女房不是妨害效果（防御卡）', () => {
      expect(isHarassmentEffect('yokai_037')).toBe(false);
    });
    
  });
  
  describe('鬼王来袭效果识别', () => {
    
    it('🟢 土蜘蛛是来袭效果', () => {
      expect(isBossRaidEffect('boss_001')).toBe(true);
      expect(getEffectCategory('boss_001')).toBe('bossRaid');
    });
    
    it('🟢 八岐大蛇是来袭效果', () => {
      expect(isBossRaidEffect('boss_002')).toBe(true);
    });
    
    it('🔴 普通妖怪不是来袭效果', () => {
      expect(isBossRaidEffect('yokai_010')).toBe(false);
    });
    
  });
  
  describe('效果分类信息获取', () => {
    
    it('🟢 获取赤舌的完整分类信息', () => {
      const info = getEffectClassification('yokai_007');
      expect(info).toBeDefined();
      expect(info?.cardName).toBe('赤舌');
      expect(info?.category).toBe('harassment');
      expect(info?.description).toContain('弃牌堆');
    });
    
    it('🟢 获取土蜘蛛的完整分类信息', () => {
      const info = getEffectClassification('boss_001');
      expect(info).toBeDefined();
      expect(info?.cardName).toBe('土蜘蛛');
      expect(info?.category).toBe('bossRaid');
    });
    
    it('🔴 未注册卡牌返回undefined', () => {
      const info = getEffectClassification('yokai_999');
      expect(info).toBeUndefined();
    });
    
  });
  
  describe('防御卡匹配', () => {
    
    it('🟢 青女房可防御妨害效果', () => {
      const defenses = getAvailableDefenses(['青女房', '其他牌'], 'harassment');
      expect(defenses.length).toBe(1);
      expect(defenses[0].cardName).toBe('青女房');
      expect(defenses[0].defenseType).toBe('reveal');
      expect(defenses[0].consumed).toBe(false);
    });
    
    it('🟢 青女房可防御来袭效果', () => {
      const defenses = getAvailableDefenses(['青女房'], 'bossRaid');
      expect(defenses.length).toBe(1);
      expect(defenses[0].cardName).toBe('青女房');
    });
    
    it('🟢 铮可防御妨害效果（弃置消耗）', () => {
      const defenses = getAvailableDefenses(['铮'], 'harassment');
      expect(defenses.length).toBe(1);
      expect(defenses[0].cardName).toBe('铮');
      expect(defenses[0].defenseType).toBe('discard');
      expect(defenses[0].consumed).toBe(true);
    });
    
    it('🔴 铮不能防御来袭效果', () => {
      const defenses = getAvailableDefenses(['铮'], 'bossRaid');
      expect(defenses.length).toBe(0);
    });
    
    it('🟢 同时有多张防御卡', () => {
      const defenses = getAvailableDefenses(['青女房', '铮', '其他牌'], 'harassment');
      expect(defenses.length).toBe(2);
    });
    
    it('🔴 没有防御卡', () => {
      const defenses = getAvailableDefenses(['唐纸伞妖', '河童'], 'harassment');
      expect(defenses.length).toBe(0);
    });
    
    it('🔴 普通效果无法被防御', () => {
      const defenses = getAvailableDefenses(['青女房'], 'normal');
      expect(defenses.length).toBe(0);
    });
    
  });
  
  describe('效果可防御性检查', () => {
    
    it('🟢 妨害效果可被防御', () => {
      expect(isDefendableEffect('harassment')).toBe(true);
    });
    
    it('🟢 来袭效果可被防御', () => {
      expect(isDefendableEffect('bossRaid')).toBe(true);
    });
    
    it('🔴 普通效果不可防御', () => {
      expect(isDefendableEffect('normal')).toBe(false);
    });
    
  });
  
  describe('效果触发上下文创建', () => {
    
    it('🟢 创建妨害效果上下文', () => {
      const ctx = createEffectTriggerContext('yokai_007', '赤舌', 'player1', '对手选牌');
      expect(ctx.category).toBe('harassment');
      expect(ctx.sourceCardId).toBe('yokai_007');
      expect(ctx.sourceCardName).toBe('赤舌');
      expect(ctx.sourcePlayerId).toBe('player1');
      expect(ctx.description).toBe('对手选牌');
    });
    
    it('🟢 创建来袭效果上下文', () => {
      const ctx = createEffectTriggerContext('boss_001', '土蜘蛛', 'system');
      expect(ctx.category).toBe('bossRaid');
      expect(ctx.sourceCardId).toBe('boss_001');
    });
    
    it('🟢 创建普通效果上下文', () => {
      const ctx = createEffectTriggerContext('yokai_001', '唐纸伞妖', 'player2');
      expect(ctx.category).toBe('normal');
    });
    
  });
  
  describe('数据完整性', () => {
    
    it('🟢 所有妨害卡牌都有正确的分类', () => {
      HARASSMENT_CARDS.forEach(card => {
        expect(card.category).toBe('harassment');
        expect(card.cardId).toBeTruthy();
        expect(card.cardName).toBeTruthy();
      });
    });
    
    it('🟢 所有来袭效果都有正确的分类', () => {
      BOSS_RAID_EFFECTS.forEach(boss => {
        expect(boss.category).toBe('bossRaid');
        expect(boss.cardId).toMatch(/^boss_/);
      });
    });
    
    it('🟢 所有防御卡都有防御类型', () => {
      DEFENSE_CARDS.forEach(defense => {
        expect(defense.defenseCategories.length).toBeGreaterThan(0);
        expect(['reveal', 'discard']).toContain(defense.defenseType);
      });
    });
    
  });
  
});
