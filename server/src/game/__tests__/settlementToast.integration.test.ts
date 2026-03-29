/**
 * §5.5 settlementToast：多段御魂结算步骤提示与日志同源
 */
import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  actionPlayCard,
} from './multiplayerTestHarness';

describe('settlementToast', () => {
  it('天邪鬼黄：抓牌+2 后并发 selectCardPutTop，toast 仅给出牌玩家且与日志同源', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const yellow: typeof p0.hand[number] = {
      instanceId: 'hand_yellow_1',
      cardId: 'yokai_yellow_test',
      cardType: 'yokai',
      name: '天邪鬼黄',
      hp: 3,
      maxHp: 3,
      damage: 0,
      charm: 0,
    };
    p0.hand = [yellow];
    p0.deck = Array.from({ length: 6 }, (_, i) => ({
      instanceId: `deck_${i}`,
      cardId: 'spell_basic',
      cardType: 'spell' as const,
      name: '基础术式',
      hp: 1,
      maxHp: 1,
      damage: 1,
      charm: 0,
    }));

    const r = actionPlayCard(game, p0.id, yellow.instanceId);
    expect(r.success).toBe(true);

    const st = game.getState();
    expect(st.pendingChoice?.type).toBe('selectCardPutTop');
    expect(st.settlementToast?.recipientPlayerIds).toEqual([p0.id]);
    expect(st.settlementToast?.message).toMatch(/抓牌\+2|抓牌/);
    expect(st.settlementToast?.logSeq).toBeDefined();

    const withToast = st.log.filter((e) => (e as { settlementToastRecipients?: string[] }).settlementToastRecipients?.length);
    expect(withToast.length).toBeGreaterThan(0);
    const toastEntry = withToast[withToast.length - 1] as typeof withToast[number] & {
      settlementToastRecipients?: string[];
      settlementToastText?: string;
    };
    expect(toastEntry.settlementToastRecipients).toEqual([p0.id]);
    expect(toastEntry.settlementToastText).toMatch(/抓牌\+2|抓牌/);
  });
});
