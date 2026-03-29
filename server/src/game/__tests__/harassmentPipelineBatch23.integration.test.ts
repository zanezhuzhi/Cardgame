/**
 * 雪幽魂 / 魍魉之匣 / 赤舌 — 多人走 HarassmentPipeline（批次 2～3）
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

describe('妨害管线批次2～3（雪幽魂 / 魍魉 / 赤舌）', () => {
  it('🟢 雪幽魂：对手有铮时 pending 为 harassmentPipelineChoice', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.hand = [zhengCard('z_1')];
    (game as any).startXueYouHunHarassment(p0.id, [p1]);
    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('harassmentPipelineChoice');
    expect(st.pendingChoice?.playerId).toBe(p1.id);
    expect(String(st.pendingChoice?.options?.[0] || '')).toContain('铮');
  });

  it('🟢 魍魉之匣：一次性 wangliangChoice 横排全员牌库顶', () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p0.deck = [
      {
        instanceId: 'top0',
        cardId: 'spell_x',
        cardType: 'spell',
        name: '基础术式',
        hp: 1,
        maxHp: 1,
        damage: 1,
        charm: 0,
      },
    ];
    p1.deck = [
      {
        instanceId: 'top1',
        cardId: 'spell_y',
        cardType: 'spell',
        name: '中级符咒',
        hp: 2,
        maxHp: 2,
        damage: 2,
        charm: 0,
      },
    ];
    (game as any).startWangliangHarassment(p0);
    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('wangliangChoice');
    expect(st.pendingChoice?.playerId).toBe(p0.id);
    const targets = st.pendingChoice?.allTargets as Array<{ playerId: string; card: { name: string } | null }>;
    expect(targets?.length).toBe(2);
    expect(targets[0]?.playerId).toBe(p0.id);
    expect(targets[0]?.card?.name).toBe('基础术式');
    expect(targets[1]?.playerId).toBe(p1.id);
    expect(targets[1]?.card?.name).toBe('中级符咒');
  });

  it('🟢 赤舌：仅单候选时异步结算完成且不抛错', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.discard = [
      {
        instanceId: 'sp_only',
        cardId: 'spell_1',
        cardType: 'spell',
        name: '基础术式',
        hp: 1,
        maxHp: 1,
        damage: 1,
        charm: 0,
      },
    ];
    (game as any).startAkajitaHarassment(p0);
    await new Promise<void>((r) => setTimeout(r, 80));
    const st = (game as any).state;
    expect(st.pendingChoice).toBeUndefined();
    expect(p1.deck[0]?.name).toBe('基础术式');
  });

  it('🟢 赤舌：双候选时进入 akajitaBatch（全员 targets + 统一 deadline）', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    p1.discard = [
      {
        instanceId: 'sp1',
        cardId: 'spell_1',
        cardType: 'spell',
        name: '基础术式',
        hp: 1,
        maxHp: 1,
        damage: 1,
        charm: 0,
      },
      {
        instanceId: 'dm1',
        cardId: 'daruma_1',
        cardType: 'yokai',
        name: '招福达摩',
        hp: 1,
        maxHp: 1,
        damage: 0,
        charm: 0,
      },
    ];
    (game as any).startAkajitaHarassment(p0);
    await new Promise<void>((r) => setTimeout(r, 80));
    const st = (game as any).state;
    expect(st.pendingChoice?.type).toBe('akajitaBatch');
    expect(typeof (st.pendingChoice as any).deadline).toBe('number');
    expect((st.pendingChoice as any).targets?.length).toBe(1);
    expect((st.pendingChoice as any).targets[0]?.playerId).toBe(p1.id);
    const names = ((st.pendingChoice as any).targets[0].candidates as Array<{ name: string }>).map((c) => c.name);
    expect(names).toEqual(['基础术式', '招福达摩']);
    expect((st.pendingChoice as any).responses).toEqual({});
  });

  it('🟢 赤舌：两名对手同时双候选时 targets 为 2；AI 立即默认并结束 pending', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 3 });
    const p0 = getHarnessPlayer(game, 0);
    const p1 = getHarnessPlayer(game, 1);
    const p2 = getHarnessPlayer(game, 2);
    (p1 as any).isAI = true;
    (p2 as any).isAI = true;
    const dup = (pid: string) =>
      [
        {
          instanceId: `${pid}_sp`,
          cardId: 'spell_1',
          cardType: 'spell' as const,
          name: '基础术式',
          hp: 1,
          maxHp: 1,
          damage: 1,
          charm: 0,
        },
        {
          instanceId: `${pid}_dm`,
          cardId: 'daruma_1',
          cardType: 'yokai' as const,
          name: '招福达摩',
          hp: 1,
          maxHp: 1,
          damage: 0,
          charm: 0,
        },
      ] as CardInstance[];
    p1.discard = dup('p1');
    p2.discard = dup('p2');
    (game as any).startAkajitaHarassment(p0);
    await new Promise<void>((r) => setTimeout(r, 80));
    const st = (game as any).state;
    expect(st.pendingChoice).toBeUndefined();
    expect(p1.deck[0]?.name).toBe('基础术式');
    expect(p2.deck[0]?.name).toBe('基础术式');
  });
});
