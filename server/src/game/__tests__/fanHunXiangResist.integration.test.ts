/**
 * 返魂香妨害 + HarassmentPipeline（青女房/铮/…）— 多人服务端路径
 */
import { describe, it, expect } from 'vitest';
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

function qingCard(instanceId: string): CardInstance {
  return {
    instanceId,
    cardId: 'yokai_037',
    cardType: 'yokai',
    name: '青女房',
    hp: 4,
    maxHp: 4,
    damage: 0,
    charm: 0,
  };
}

describe('返魂香妨害 + 管线抵抗（多人引擎）', () => {
  it('🟢 对手仅有铮时由管线弹出 harassmentPipelineChoice', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.hand = [zhengCard('z_1'), zhengCard('z_2')];
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);

    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(st.pendingChoice?.playerId).toBe(p1.id);
    expect(String(st.pendingChoice?.options?.[0] || '')).toContain('铮');
  });

  it('🟢 弃置铮后免疫并推进队列', async () => {
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

    (game as any).startFanHunXiangHarassment(p0.id, [p1]);
    const r = game.handleHarassmentPipelineChoiceResponse(p1.id, 0);
    expect(r.success).toBe(true);

    for (let i = 0; i < 20; i++) {
      await new Promise<void>((res) => queueMicrotask(res));
      const st = (game as any).state;
      if (!st.pendingChoice && !(st as any).fanHunXiangQueue) break;
    }

    const st = (game as any).state;
    expect(st.pendingChoice).toBeUndefined();
    expect((st as any).fanHunXiangQueue).toBeUndefined();
    expect(p1.hand.some(c => c.name === '铮')).toBe(false);
    expect(p1.discard.some(c => c.name === '铮')).toBe(true);
    expect(p1.hand.length).toBeGreaterThanOrEqual(2);
  });

  it('🟢 持有青女房时优先询问青女房', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.hand = [qingCard('q1'), zhengCard('z1')];
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);

    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(String(st.pendingChoice?.options?.[0] || '')).toContain('青女房');
  });

  it('🟢 拒绝青女房后若有铮则再问铮', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.hand = [qingCard('q1'), zhengCard('z1')];
    (game as any).startFanHunXiangHarassment(p0.id, [p1]);

    const r1 = game.handleHarassmentPipelineChoiceResponse(p1.id, 1);
    expect(r1.success).toBe(true);

    let st = (game as any).state;
    for (let i = 0; i < 50; i++) {
      await new Promise<void>((r) => queueMicrotask(r));
      st = (game as any).state;
      if (
        st.pendingChoice?.type === 'harassmentPipelineChoice' &&
        String(st.pendingChoice?.options?.[0] || '').includes('铮')
      ) {
        break;
      }
    }

    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(String(st.pendingChoice?.options?.[0] || '')).toContain('铮');
  });
});
