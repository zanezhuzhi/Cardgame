/**
 * MultiplayerGame 核心操作覆盖（对应 docs/testing/test-enhancement-plan.md 第一阶段 P0）
 */
import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessState,
  getHarnessPlayer,
  actionEndTurn,
  createSpellInstance,
} from './multiplayerTestHarness';

describe('MultiplayerGame.action — 回合与 handleAction', () => {
  it('🔴 非当前玩家不能结束回合', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
    const r = actionEndTurn(game, 'p2');
    expect(r.success).toBe(false);
    expect(r.error).toContain('不是你的回合');
  });

  it('🔴 非行动阶段不能结束回合', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2, turnPhase: 'ghostFire' });
    const r = actionEndTurn(game, 'p1');
    expect(r.success).toBe(false);
    expect(r.error).toContain('当前阶段不能结束回合');
  });

  it('🟢 当前玩家 endTurn 后轮到下一玩家且手牌补足', () => {
    const game = createMultiplayerGameForTest({ playerCount: 3 });
    const p0 = getHarnessPlayer(game, 0);
    p0.hand = [];
    p0.deck = Array.from({ length: 30 }, (_, i) =>
      createSpellInstance('基础术式', 1, `action_flow_${i}`)
    );

    const beforeNext = getHarnessState(game).currentPlayerIndex;
    const r = actionEndTurn(game, p0.id);
    expect(r.success).toBe(true);
    expect(getHarnessState(game).currentPlayerIndex).toBe((beforeNext + 1) % 3);
    expect(p0.hand.length).toBeGreaterThan(0);
  });
});
