/**
 * 多人：行动阶段回合计时在「回合外反馈」时暂停；真人 5s 反馈超时走默认项
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMultiplayerGameForTest, getHarnessPlayer } from './multiplayerTestHarness';
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

describe('回合外反馈与行动阶段计时暂停', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('对手 pending harassmentPipelineChoice 时暂停行动倒计时并记录剩余时间', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    (game as any).startTurnTimer();
    const st0 = (game as any).state;
    expect(st0.turnTimeoutMs).toBe(30000);
    expect(st0.turnStartAt).toBeDefined();
    expect(st0.turnTimerPaused).toBeFalsy();

    p1.hand = [zhengCard('z_1'), zhengCard('z_2')];
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);

    expect(game.getState().pendingChoice?.timerMode).toBe('offTurnResponse');

    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(st.pendingChoice?.playerId).toBe(p1.id);
    expect(st.turnTimerPaused).toBe(true);
    expect(st.turnPausedRemainMs).toBeDefined();
    expect(st.turnPausedRemainMs!).toBeGreaterThan(0);
    expect(st.turnPausedRemainMs!).toBeLessThanOrEqual(30000);
    expect(st.outOfTurnFeedbackDeadlineAt).toBeDefined();
  });

  it('对手提交选择后不再处于暂停（队列结束时）', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    const z = zhengCard('z_only');
    p1.hand = [z];
    p1.deck = Array.from({ length: 10 }, (_, i) => ({
      instanceId: `d_${i}`,
      cardId: 'spell_x',
      cardType: 'spell',
      name: '基础术式',
      hp: 1,
      maxHp: 1,
      damage: 1,
      charm: 0,
    }));

    (game as any).startTurnTimer();
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);
    expect((game as any).state.turnTimerPaused).toBe(true);

    const r = game.handleHarassmentPipelineChoiceResponse(p1.id, 0);
    expect(r.success).toBe(true);

    for (let i = 0; i < 30; i++) {
      await new Promise<void>((res) => queueMicrotask(res));
      const st = (game as any).state;
      if (!st.pendingChoice && !(st as any).fanHunXiangQueue) break;
    }

    const end = (game as any).state;
    expect(end.pendingChoice).toBeUndefined();
    expect(end.turnTimerPaused).toBeFalsy();
    expect(end.turnStartAt).toBeDefined();
  });

  it('真人回合外反馈 5 秒超时触发默认选择', async () => {
    vi.useFakeTimers();
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    (game as any).startTurnTimer();
    p1.hand = [zhengCard('z_1'), zhengCard('z_2')];
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);

    expect((game as any).state.pendingChoice?.playerId).toBe(p1.id);

    await vi.advanceTimersByTimeAsync(5000);

    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      const st = (game as any).state;
      if (!st.pendingChoice && !(st as any).fanHunXiangQueue) break;
    }

    const fin = (game as any).state;
    expect(fin.pendingChoice).toBeUndefined();
    vi.useRealTimers();
  });

  it('getState：当前回合玩家 pending 时 timerMode 为 turnTotal（只读补充，不污染内部 state）', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
    const p0 = getHarnessPlayer(game, 0);
    // 与 shared `YokaiTargetChoice` 对齐的最小对象（不在此文件 `import type` shared，避免 Vitest 加载 shared ESM 链）
    const minimalYokaiTarget = {
      type: 'yokaiTarget' as const,
      playerId: p0.id,
      options: [] as string[],
    };
    (game as any).state.pendingChoice = minimalYokaiTarget;

    const view = game.getState();
    expect(view.pendingChoice?.timerMode).toBe('turnTotal');
    expect((game as any).state.pendingChoice.timerMode).toBeUndefined();
  });
});
