/**
 * 鬼王区状态机集成测试 — 对齐 docs/superpowers/specs/2026-03-30-boss-zone-state-machine.md
 * 不涉及 YokaiEffects / 妖怪御魂实现
 */
import { describe, it, expect } from 'vitest';
import {
  createMultiplayerGameForTest,
  getHarnessState,
  getHarnessPlayer,
  createSpellInstance,
} from './multiplayerTestHarness';

describe('bossZoneStateMachine（鬼王状态机）', () => {
  it('🟢 击杀鬼王 → pendingBossReveal；清理阶段后翻出下一只且标记清除', async () => {
    const game = createMultiplayerGameForTest({ playerCount: 2 });
    const st = getHarnessState(game);
    const first = st.field.bossDeck.shift()!;
    st.field.currentBoss = first;
    st.field.bossCurrentHp = first.hp;

    const p0 = getHarnessPlayer(game, 0);
    p0.damage = first.hp + 5;
    p0.hand = [];
    p0.deck = Array.from({ length: 40 }, (_, i) =>
      createSpellInstance('基础术式', 1, `boss_sm_${i}`)
    );

    const dmg = first.hp;
    const r = game.handleAction(p0.id, { type: 'attackBoss', damage: dmg });
    expect(r.success).toBe(true);
    expect(st.field.currentBoss).toBeNull();
    expect(st.field.bossCurrentHp).toBe(0);
    expect(st.pendingBossReveal).toBe(true);
    expect(st.bossDefeatedByPlayerId).toBe(p0.id);
    expect(p0.discard.some((c: { name?: string }) => c.name === first.name)).toBe(true);

    await (game as any).enterCleanupPhase();

    expect(st.pendingBossReveal).toBe(false);
    expect(st.field.currentBoss).not.toBeNull();
    expect(st.field.currentBoss!.name).not.toBe(first.name);
    expect(st.bossDefeatedByPlayerId).toBeNull();
  });
});
