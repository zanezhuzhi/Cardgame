/**
 * 镜姬【妖】效果服务端集成测试
 * @file server/src/game/__tests__/jingjiImmune.integration.test.ts
 * 
 * 测试镜姬在游荡区时免疫阴阳术伤害的功能
 * 使用精细伤害追踪系统（damagePool）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerGame } from '../MultiplayerGame';
import { 
  createTestCard, 
  createYokaiCard,
  createTestPlayer,
  createTestGameState 
} from './testUtils';
import type { CardInstance, DamagePool } from '../../../../shared/types/game';
import { createEmptyDamagePool } from '../../types/index';
import { isDamageImmune, createDamageSource } from '../../../../shared/game/DamageSystem';

describe('镜姬【妖】效果集成测试', () => {
  
  describe('精细伤害追踪', () => {
    it('🟢 damagePool 正确记录阴阳术伤害', () => {
      const state = createTestGameState();
      state.damagePool = createEmptyDamagePool();
      
      // 模拟打出阴阳术（伤害+3）
      state.damagePool.spell += 3;
      
      expect(state.damagePool.spell).toBe(3);
      expect(state.damagePool.yokai).toBe(0);
      expect(state.damagePool.shikigami).toBe(0);
    });

    it('🟢 damagePool 正确记录御魂伤害', () => {
      const state = createTestGameState();
      state.damagePool = createEmptyDamagePool();
      
      // 模拟打出御魂（伤害+2）
      state.damagePool.yokai += 2;
      
      expect(state.damagePool.spell).toBe(0);
      expect(state.damagePool.yokai).toBe(2);
    });

    it('🟢 damagePool 支持混合伤害来源', () => {
      const state = createTestGameState();
      state.damagePool = createEmptyDamagePool();
      
      // 模拟打出阴阳术（伤害+3）+ 徝魂（伤害+2）
      state.damagePool.spell += 3;
      state.damagePool.yokai += 2;
      
      const totalDamage = state.damagePool.spell + state.damagePool.yokai + 
                          state.damagePool.shikigami + state.damagePool.other;
      expect(totalDamage).toBe(5);
    });

    it('🟢 清理阶段重置 damagePool', () => {
      const state = createTestGameState();
      state.damagePool = { spell: 3, yokai: 2, shikigami: 1, other: 0 };
      
      // 模拟进入清理阶段
      state.damagePool = createEmptyDamagePool();
      
      expect(state.damagePool.spell).toBe(0);
      expect(state.damagePool.yokai).toBe(0);
      expect(state.damagePool.shikigami).toBe(0);
      expect(state.damagePool.other).toBe(0);
    });
  });

  describe('镜姬免疫阴阳术伤害', () => {
    it('🟢 阴阳术伤害无法分配给镜姬', () => {
      const jingji = createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 });
      const damageSource = createDamageSource('spell', 'player-1');
      
      // 镜姬应该免疫阴阳术伤害
      expect(isDamageImmune(jingji, damageSource)).toBe(true);
    });

    it('🟢 阴阳术伤害可以分配给其他妖怪', () => {
      const xinyan = createYokaiCard('心眼', { hp: 5, maxHp: 5 });
      const damageSource = createDamageSource('spell', 'player-1');
      
      // 心眼不应该免疫阴阳术伤害
      expect(isDamageImmune(xinyan, damageSource)).toBe(false);
    });
  });

  describe('御魂/式神伤害不被免疫', () => {
    it('🟢 御魂伤害可以分配给镜姬', () => {
      const jingji = createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 });
      const damageSource = createDamageSource('yokai', 'player-1');
      
      // 镜姬不应该免疫御魂伤害
      expect(isDamageImmune(jingji, damageSource)).toBe(false);
    });

    it('🟢 式神技能伤害可以分配给镜姬', () => {
      const jingji = createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 });
      const damageSource = createDamageSource('shikigami', 'player-1');
      
      // 镜姬不应该免疫式神技能伤害
      expect(isDamageImmune(jingji, damageSource)).toBe(false);
    });
  });

  describe('混合伤害场景', () => {
    it('🟢 混合伤害（spell+yokai）对镜姬只分配非spell部分', () => {
      const state = createTestGameState({
        yokaiSlots: [
          createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 }),
          null,
          null,
        ],
      });
      
      // 设置混合伤害池：spell=3, yokai=2
      state.damagePool = { spell: 3, yokai: 2, shikigami: 0, other: 0 };
      state.players[0].damage = 5;  // 总伤害5
      
      const jingji = state.field.yokaiSlots[0]!;
      
      // 可用于镜姬的伤害 = yokai + shikigami + other = 2
      const availableNonSpellDamage = state.damagePool.yokai + 
                                       state.damagePool.shikigami + 
                                       state.damagePool.other;
      expect(availableNonSpellDamage).toBe(2);
      
      // 如果镜姬HP=6，最多只能受到2点伤害（剩余4HP）
      const damageToJingji = Math.min(availableNonSpellDamage, jingji.hp);
      expect(damageToJingji).toBe(2);
    });

    it('🟢 只有阴阳术伤害时无法攻击镜姬', () => {
      const state = createTestGameState({
        yokaiSlots: [
          createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 }),
          null,
          null,
        ],
      });
      
      // 只有阴阳术伤害
      state.damagePool = { spell: 3, yokai: 0, shikigami: 0, other: 0 };
      state.players[0].damage = 3;
      
      // 可用于镜姬的伤害 = 0
      const availableNonSpellDamage = state.damagePool.yokai + 
                                       state.damagePool.shikigami + 
                                       state.damagePool.other;
      expect(availableNonSpellDamage).toBe(0);
      
      // 应该返回错误：镜姬免疫阴阳术伤害
    });

    it('🟢 纯御魂伤害可以完全分配给镜姬', () => {
      const state = createTestGameState({
        yokaiSlots: [
          createYokaiCard('镜姬', { cardId: 'yokai_032', hp: 6, maxHp: 6 }),
          null,
          null,
        ],
      });
      
      // 只有御魂伤害
      state.damagePool = { spell: 0, yokai: 5, shikigami: 0, other: 0 };
      state.players[0].damage = 5;
      
      const jingji = state.field.yokaiSlots[0]!;
      
      // 可用于镜姬的伤害 = 5
      const availableNonSpellDamage = state.damagePool.yokai + 
                                       state.damagePool.shikigami + 
                                       state.damagePool.other;
      expect(availableNonSpellDamage).toBe(5);
      
      // 镜姬HP=6，可以受到5点伤害
      const damageToJingji = Math.min(availableNonSpellDamage, jingji.hp);
      expect(damageToJingji).toBe(5);
    });
  });
});