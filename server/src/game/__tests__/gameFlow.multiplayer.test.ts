/**
 * 经 MultiplayerGame 实例的游戏流程回归（与 gameFlow.integration.test 的手写 GameState 相区别）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  getHarnessState,
  actionEndTurn,
  createSpellInstance,
  createYokaiTestCard,
} from './multiplayerTestHarness';

describe('gameFlow.multiplayer（MultiplayerGame 真实例）', () => {
  beforeEach(() => {
    // 依赖构造器完整 field / boss；仅改阶段与玩家区
  });

  it('🟢 回合末规则弃置手牌时三味不触发【触】（牌库仅少补牌 5 张）', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p = getHarnessPlayer(game, 0);
    p.hand = [
      createYokaiTestCard('三味', 5, {
        instanceId: 'sanmi_1',
        cardId: 'yokai_sanmi',
      }),
    ];
    const deckSize = 20;
    p.deck = Array.from({ length: deckSize }, (_, i) =>
      createSpellInstance('基础术式', 1, `flow_deck_${i}`)
    );
    p.discard = [];

    await (game as any).enterCleanupPhase();

    const sanmiInDiscard = p.discard.some(c => c.name === '三味');
    expect(sanmiInDiscard).toBe(true);
    expect(p.deck.length).toBe(deckSize - 5);
  });

  it('🟢 当前玩家 endTurn 后轮到下一玩家且手牌补足', () => {
    const game = createMultiplayerGameForTest({ playerCount: 3 });
    const p0 = getHarnessPlayer(game, 0);
    p0.hand = [];
    p0.deck = Array.from({ length: 30 }, (_, i) =>
      createSpellInstance('基础术式', 1, `multi_flow_${i}`)
    );

    const beforeNext = getHarnessState(game).currentPlayerIndex;
    const r = actionEndTurn(game, p0.id);
    expect(r.success).toBe(true);
    expect(getHarnessState(game).currentPlayerIndex).toBe((beforeNext + 1) % 3);
    expect(p0.hand.length).toBeGreaterThan(0);
  });
});
