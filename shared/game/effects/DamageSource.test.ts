/**
 * 伤害来源类型系统测试
 * @file shared/game/effects/DamageSource.test.ts
 */

import { describe, it, expect } from 'vitest';
import { isDamageImmune, DamageSource, DamageSourceType } from '../DamageSystem';

describe('伤害来源类型系统', () => {
  // ============ 辅助函数 ============
  
  /**
   * 创建伤害来源
   */
  function createDamageSource(
    type: DamageSourceType,
    cardName?: string
  ): DamageSource {
    return {
      type,
      cardId: cardName ? `test_${cardName}` : undefined,
      cardName,
      playerId: 'player1',
    };
  }

  /**
   * 创建目标卡牌
   */
  function createTarget(name: string) {
    return { name, cardId: `yokai_${name}` };
  }

  // ============ 镜姬【妖】效果测试 ============
  
  describe('镜姬【妖】效果', () => {
    const jingjji = createTarget('镜姬');

    it('🟢 免疫阴阳术伤害', () => {
      const spellDamage = createDamageSource('spell', '基础术式');
      
      expect(isDamageImmune(jingjji, spellDamage)).toBe(true);
    });

    it('🟢 免疫中级符咒伤害', () => {
      const spellDamage = createDamageSource('spell', '中级符咒');
      
      expect(isDamageImmune(jingjji, spellDamage)).toBe(true);
    });

    it('🟢 免疫高级符咒伤害', () => {
      const spellDamage = createDamageSource('spell', '高级符咒');
      
      expect(isDamageImmune(jingjji, spellDamage)).toBe(true);
    });

    it('🔴 不免疫御魂伤害', () => {
      const yokaiDamage = createDamageSource('yokai', '破势');
      
      expect(isDamageImmune(jingjji, yokaiDamage)).toBe(false);
    });

    it('🔴 不免疫式神技能伤害', () => {
      const shikigamiDamage = createDamageSource('shikigami', '妖刀姬');
      
      expect(isDamageImmune(jingjji, shikigamiDamage)).toBe(false);
    });

    it('🔴 不免疫鬼王来袭伤害', () => {
      const bossDamage = createDamageSource('boss', '鬼王');
      
      expect(isDamageImmune(jingjji, bossDamage)).toBe(false);
    });

    it('🔴 不免疫令牌效果伤害', () => {
      const tokenDamage = createDamageSource('token', '招福达摩');
      
      expect(isDamageImmune(jingjji, tokenDamage)).toBe(false);
    });

    it('🔴 不免疫其他来源伤害', () => {
      const otherDamage = createDamageSource('other');
      
      expect(isDamageImmune(jingjji, otherDamage)).toBe(false);
    });
  });

  // ============ 其他妖怪测试 ============
  
  describe('普通妖怪', () => {
    const xinyan = createTarget('心眼');

    it('🔴 不免疫阴阳术伤害', () => {
      const spellDamage = createDamageSource('spell', '基础术式');
      
      expect(isDamageImmune(xinyan, spellDamage)).toBe(false);
    });

    it('🔴 不免疫御魂伤害', () => {
      const yokaiDamage = createDamageSource('yokai', '破势');
      
      expect(isDamageImmune(xinyan, yokaiDamage)).toBe(false);
    });

    it('🔴 不免疫式神技能伤害', () => {
      const shikigamiDamage = createDamageSource('shikigami', '妖刀姬');
      
      expect(isDamageImmune(shikigamiDamage, shikigamiDamage)).toBe(false);
    });
  });

  // ============ 伤害来源类型测试 ============
  
  describe('DamageSource 类型', () => {
    it('🟢 创建阴阳术来源', () => {
      const source: DamageSource = {
        type: 'spell',
        cardId: 'spell_001',
        cardName: '基础术式',
        playerId: 'player1',
      };
      
      expect(source.type).toBe('spell');
      expect(source.cardName).toBe('基础术式');
    });

    it('🟢 创建御魂来源', () => {
      const source: DamageSource = {
        type: 'yokai',
        cardId: 'yokai_031',
        cardName: '破势',
        playerId: 'player1',
      };
      
      expect(source.type).toBe('yokai');
      expect(source.cardName).toBe('破势');
    });

    it('🟢 创建式神技能来源', () => {
      const source: DamageSource = {
        type: 'shikigami',
        cardId: 'shikigami_001',
        cardName: '妖刀姬',
        playerId: 'player1',
      };
      
      expect(source.type).toBe('shikigami');
    });

    it('🟢 支持所有来源类型', () => {
      const types: DamageSourceType[] = [
        'spell', 'yokai', 'shikigami', 'boss', 'token', 'penalty', 'other'
      ];
      
      types.forEach(type => {
        const source: DamageSource = { type, playerId: 'player1' };
        expect(source.type).toBe(type);
      });
    });
  });
});
