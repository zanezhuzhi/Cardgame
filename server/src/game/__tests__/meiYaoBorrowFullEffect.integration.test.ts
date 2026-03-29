/**
 * 魅妖：借用对手牌库顶牌时应走完整御魂效果（executeYokaiEffect，与轮入道一致）。
 */
import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  getHarnessState,
  actionPlayCard,
  createYokaiTestCard,
} from './multiplayerTestHarness';
import type { CardInstance } from '../../types';

function zhengCard(instanceId: string): CardInstance {
  return {
    instanceId,
    cardId: 'yokai_021',
    cardType: 'yokai',
    name: '铮',
    hp: 4,
    maxHp: 4,
    damage: 0,
    charm: 0,
  };
}

async function drainMicrotasksUntil(
  cond: () => boolean,
  max = 80,
): Promise<void> {
  for (let i = 0; i < max && !cond(); i++) {
    await new Promise<void>(r => queueMicrotask(r));
  }
}

describe('魅妖借用御魂：完整效果', () => {
  it('选中对手天邪鬼绿且场上有多个≤4HP妖怪时，应保留 yokaiTarget 待选', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    const green = createYokaiTestCard('天邪鬼绿', 3, { instanceId: 'opp_deck_green_1' });
    p1.deck = [
      green,
      ...Array.from({ length: 4 }, (_, i) =>
        createYokaiTestCard('灯笼鬼', 3, { instanceId: `opp_deck_fill_${i}` }),
      ),
    ];
    const mei = createYokaiTestCard('魅妖', 5, { instanceId: 'hand_mei_1' });
    p0.hand = [mei];

    const st0 = getHarnessState(game);
    st0.field.yokaiSlots = [
      createYokaiTestCard('妖怪甲', 3, { instanceId: 'slot_a' }),
      createYokaiTestCard('妖怪乙', 4, { instanceId: 'slot_b' }),
      null,
      null,
      null,
      null,
    ];

    const play = actionPlayCard(game, p0.id, mei.instanceId);
    expect(play.success).toBe(true);
    await drainMicrotasksUntil(() => game.getState().pendingChoice?.type === 'yokaiTarget');
    const st = game.getState();
    expect(st.pendingChoice?.type).toBe('yokaiTarget');
    const opts = (st.pendingChoice as { options?: string[] }).options;
    expect(opts?.length).toBeGreaterThanOrEqual(2);
  });

  it('仅 1 名对手且仅 1 张可用牌时仍先走妨害管线：对手有铮时弹出 harassmentPipelineChoice', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    const green = createYokaiTestCard('天邪鬼绿', 3, { instanceId: 'opp_deck_green_1' });
    p1.deck = [
      green,
      ...Array.from({ length: 4 }, (_, i) =>
        createYokaiTestCard('灯笼鬼', 3, { instanceId: `opp_deck_fill_${i}` }),
      ),
    ];
    p1.hand = [zhengCard('z_mei_single')];
    const mei = createYokaiTestCard('魅妖', 5, { instanceId: 'hand_mei_2' });
    p0.hand = [mei];

    const play = actionPlayCard(game, p0.id, mei.instanceId);
    expect(play.success).toBe(true);
    await drainMicrotasksUntil(
      () => game.getState().pendingChoice?.type === 'harassmentPipelineChoice',
    );
    const st = game.getState();
    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(st.pendingChoice?.playerId).toBe(p1.id);
    expect(String((st.pendingChoice as { options?: string[] }).options?.[0] || '')).toContain(
      '铮',
    );
  });
});
