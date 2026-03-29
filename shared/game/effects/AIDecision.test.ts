/**
 * 纯函数 AI 决策（aiDecide_*）回归，与 EffectEngine 集成分离，便于服务端/共享层共用策略单测。
 */
import { describe, it, expect } from 'vitest';
import {
  aiDecide_唐纸伞妖,
  aiDecide_轮入道,
  aiSelect_轮入道,
} from './YokaiEffects';
import type { CardInstance } from '../../types/cards';

function card(overrides: Partial<CardInstance>): CardInstance {
  return {
    instanceId: 'i1',
    cardId: 'c1',
    cardType: 'yokai',
    name: 'Test',
    hp: 3,
    maxHp: 3,
    ...overrides,
  };
}

describe('AIDecision aiDecide_*', () => {
  describe('aiDecide_唐纸伞妖', () => {
    it('🟢 招福达摩或 penalty 倾向超度', () => {
      expect(aiDecide_唐纸伞妖(card({ name: '招福达摩' }))).toBe(1);
      expect(aiDecide_唐纸伞妖(card({ cardType: 'penalty', name: '罚单' }))).toBe(1);
    });

    it('🟢 普通御魂保留牌库顶', () => {
      expect(aiDecide_唐纸伞妖(card({ name: '心眼' }))).toBe(0);
    });
  });

  describe('aiDecide_轮入道 / aiSelect_轮入道', () => {
    it('🟢 心眼评分高于天邪鬼青，空列表返回 null', () => {
      const a = card({ name: '心眼', instanceId: 'a' });
      const b = card({ name: '天邪鬼青', instanceId: 'b' });
      expect(aiDecide_轮入道(a)).toBeGreaterThan(aiDecide_轮入道(b));
      expect(aiSelect_轮入道([], { ghostFire: 3, handCount: 5 })).toBeNull();
    });

    it('🟢 多候选时选择评分最高者', () => {
      const heart = card({ name: '心眼', instanceId: 'h' });
      const low = card({ name: '网切', instanceId: 'n' });
      const pick = aiSelect_轮入道([low, heart], { ghostFire: 3, handCount: 4 });
      expect(pick).toBe(heart.instanceId);
    });

    it('🟢 鬼火上下文影响狂骨相对分', () => {
      const kgLow = card({ name: '狂骨', instanceId: 'k1' });
      const kgHigh = aiDecide_轮入道(kgLow, { ghostFire: 1, handCount: 5 });
      const kgMid = aiDecide_轮入道(kgLow, { ghostFire: 5, handCount: 5 });
      expect(kgMid).toBeGreaterThan(kgHigh);
    });
  });
});
