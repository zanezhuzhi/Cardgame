import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  getHarnessState,
  actionPlayCard,
  actionEndTurn,
  createSpellInstance,
} from './multiplayerTestHarness';

describe('multiplayerTestHarness 烟测', () => {
  it('🟢 行动阶段经 handleAction 打出阴阳术应增加伤害', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p = getHarnessPlayer(game, 0);
    const spell = createSpellInstance('基础术式', 1, 'spell_smoke_1');
    p.hand = [spell];
    p.damage = 0;

    const r = actionPlayCard(game, p.id, spell.instanceId);
    expect(r.success).toBe(true);
    expect(p.damage).toBe(1);
    expect(p.hand).toHaveLength(0);
  });

  it('🟢 非当前玩家调用 playCard 应拒绝', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    const spell = createSpellInstance('基础术式', 1, 'spell_smoke_2');
    p1.hand = [spell];

    const r = actionPlayCard(game, p1.id, spell.instanceId);
    expect(r.success).toBe(false);
    expect(r.error).toContain('回合');
  });

  it('🟢 恶评（penalty / 名称「恶评」）不得打出，与客户端一致', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p = getHarnessPlayer(game, 0);
    const farmer = {
      instanceId: 'pen_farm_1',
      cardId: 'penalty_001',
      cardType: 'penalty' as const,
      name: '农夫',
      hp: 0,
      maxHp: 0,
      charm: -1,
    };
    p.hand = [farmer as any];
    const r1 = actionPlayCard(game, p.id, farmer.instanceId);
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('恶评');

    const generic = {
      instanceId: 'pen_named_1',
      cardId: 'penalty_001',
      cardType: 'penalty' as const,
      name: '恶评',
      hp: 0,
      maxHp: 0,
      charm: -1,
    };
    p.hand = [generic as any];
    const r2 = actionPlayCard(game, p.id, generic.instanceId);
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('恶评');
  });

  it('🟢 行动阶段结束回合应进入清理并切换到下一玩家', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    p0.hand = [];
    p0.deck = Array.from({ length: 20 }).map((_, i) =>
      createSpellInstance('基础术式', 1, `deck_${i}`)
    );

    const r = actionEndTurn(game, p0.id);
    expect(r.success).toBe(true);

    const state = getHarnessState(game);
    expect(state.currentPlayerIndex).toBe(1);
    expect(p0.hand.length).toBeGreaterThan(0);
  });
});
