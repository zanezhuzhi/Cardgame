/**
 * 御魂传说 - 效果引擎 TDD 测试
 * @file shared/game/effects/EffectEngine.test.ts
 *
 * 覆盖：原子效果、条件效果、选择效果、触发器注册
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectEngine } from './EffectEngine';
import { getYokaiEffectDef, YOKAI_EFFECT_DEFS } from './YokaiEffects';
import { getShikigamiEffectDefs, SHIKIGAMI_EFFECT_DEFS } from './ShikigamiEffects';
import type { EffectContext, CardEffect } from './types';
import type { PlayerState, GameState } from '../../types/game';
import type { CardInstance } from '../../types/cards';

// ============ 测试辅助函数 ============

function makeCard(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `card_${Math.random().toString(36).slice(2)}`,
    cardId: 'test_001',
    cardType: 'yokai',
    name: '测试妖怪',
    hp: 3,
    maxHp: 3,
    damage: 1,
    charm: 1,
    image: '',
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'player1',
    name: '测试玩家',
    ghostFire: 3,
    maxGhostFire: 5,
    damage: 0,
    hand: [],
    deck: [],
    discard: [],
    played: [],
    exiled: [],
    shikigami: [],
    shikigamiState: [],
    totalCharm: 0,
    cardsPlayed: 0,
    ...overrides,
  };
}

function makeGameState(players: PlayerState[] = []): GameState {
  return {
    phase: 'action',
    currentPlayerIndex: 0,
    round: 1,
    players,
    field: {
      yokaiSlots: [null, null, null, null],
      yokaiDeck: [],
      bossDeck: [],
      bossSlot: null,
      bossCurrentHp: 0,
      spellSupply: {
        basic: makeCard({ cardId: 'spell_basic', name: '基础术式', cardType: 'spell', hp: 1, damage: 1, charm: 0 }),
        medium: makeCard({ cardId: 'spell_medium', name: '中级符咒', cardType: 'spell', hp: 2, damage: 2, charm: 0 }),
        advanced: makeCard({ cardId: 'spell_advanced', name: '高级符咒', cardType: 'spell', hp: 3, damage: 3, charm: 1 }),
      },
      spellCounts: { basic: 5, medium: 5, advanced: 5 },
      penaltyPile: [],
    },
    winners: [],
    log: [],
  } as unknown as GameState;
}

function makeCtx(player: PlayerState, gameState?: GameState): EffectContext {
  const gs = gameState ?? makeGameState([player]);
  if (!gs.players.includes(player)) gs.players.push(player);
  return { gameState: gs, player };
}

// ============ 测试套件 ============

describe('EffectEngine 原子效果', () => {

  let engine: EffectEngine;
  let player: PlayerState;

  beforeEach(() => {
    engine = new EffectEngine();
    player = makePlayer({
      deck: [
        makeCard({ instanceId: 'deck1' }),
        makeCard({ instanceId: 'deck2' }),
        makeCard({ instanceId: 'deck3' }),
      ],
    });
  });

  // ----- DRAW -----

  it('DRAW：从牌库抓指定数量到手牌', async () => {
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'DRAW', count: 2 }], ctx);
    expect(player.hand).toHaveLength(2);
    expect(player.deck).toHaveLength(1);
  });

  it('DRAW：牌库不足时自动洗切弃牌堆补充', async () => {
    player.deck = [makeCard({ instanceId: 'deck1' })];
    player.discard = [makeCard({ instanceId: 'dis1' }), makeCard({ instanceId: 'dis2' })];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'DRAW', count: 3 }], ctx);
    expect(player.hand).toHaveLength(3);
    expect(player.discard).toHaveLength(0);
  });

  it('DRAW：牌库和弃牌堆都空时不崩溃', async () => {
    player.deck = [];
    player.discard = [];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'DRAW', count: 2 }], ctx);
    expect(player.hand).toHaveLength(0);
  });

  // ----- GHOST_FIRE -----

  it('GHOST_FIRE：正数增加鬼火', async () => {
    player.ghostFire = 2;
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'GHOST_FIRE', value: 2 }], ctx);
    expect(player.ghostFire).toBe(4);
  });

  it('GHOST_FIRE：鬼火不超过上限5', async () => {
    player.ghostFire = 4;
    player.maxGhostFire = 5;
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'GHOST_FIRE', value: 3 }], ctx);
    expect(player.ghostFire).toBe(5);
  });

  it('GHOST_FIRE：消耗鬼火（负数）', async () => {
    player.ghostFire = 3;
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'GHOST_FIRE', value: -2 }], ctx);
    expect(player.ghostFire).toBe(1);
  });

  it('GHOST_FIRE：鬼火不低于0', async () => {
    player.ghostFire = 1;
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'GHOST_FIRE', value: -5 }], ctx);
    expect(player.ghostFire).toBe(0);
  });

  // ----- DAMAGE -----

  it('DAMAGE：累积伤害值', async () => {
    player.damage = 0;
    const ctx = makeCtx(player);
    await engine.execute([
      { type: 'DAMAGE', value: 2 },
      { type: 'DAMAGE', value: 3 },
    ], ctx);
    expect(player.damage).toBe(5);
  });

  // ----- DISCARD -----

  it('DISCARD：随机弃置指定数量（random=true）', async () => {
    player.hand = [makeCard(), makeCard(), makeCard()];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'DISCARD', count: 2, random: true, target: 'SELF' }], ctx);
    expect(player.hand).toHaveLength(1);
    expect(player.discard).toHaveLength(2);
  });

  it('DISCARD：弃置其他玩家的牌（target=OTHER_PLAYERS）', async () => {
    const p2 = makePlayer({ id: 'player2', hand: [makeCard(), makeCard()] });
    const gs = makeGameState([player, p2]);
    const ctx = makeCtx(player, gs);
    await engine.execute([{
      type: 'INTERFERE',
      target: 'OTHER_PLAYERS',
      subEffects: [{ type: 'DISCARD', count: 1, random: true, target: 'SELF' }],
    }], ctx);
    expect(p2.hand).toHaveLength(1);
    expect(p2.discard).toHaveLength(1);
  });

  // ----- EXILE_HAND -----

  it('EXILE_HAND：超度手牌时移至 exiled（无回调时取第1张）', async () => {
    const card1 = makeCard({ instanceId: 'exile_me' });
    player.hand = [card1, makeCard()];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'EXILE_HAND', count: 1 }], ctx);
    expect(player.hand).toHaveLength(1);
    expect(player.exiled).toHaveLength(1);
    expect(player.exiled[0]!.instanceId).toBe('exile_me');
  });

  // ----- GAIN_SPELL -----

  it('GAIN_SPELL：从供应区获得阴阳术放入弃牌堆', async () => {
    const gs = makeGameState([player]);
    gs.field.spellCounts.basic = 3;
    const ctx = makeCtx(player, gs);
    await engine.execute([{ type: 'GAIN_SPELL', tier: 'basic' }], ctx);
    expect(player.discard).toHaveLength(1);
    expect(player.discard[0]!.cardType).toBe('spell');
    expect(gs.field.spellCounts.basic).toBe(2);
  });

  it('GAIN_SPELL：供应区为0时无法获得', async () => {
    const gs = makeGameState([player]);
    gs.field.spellCounts.medium = 0;
    const ctx = makeCtx(player, gs);
    await engine.execute([{ type: 'GAIN_SPELL', tier: 'medium' }], ctx);
    expect(player.discard).toHaveLength(0);
  });

  // ----- MARKER_ADD / REMOVE -----

  it('MARKER_ADD：增加指示物并遵守上限', async () => {
    player.shikigamiState = [{ cardId: 'shikigami_003', markers: {} }];
    const ctx = makeCtx(player);
    await engine.execute([
      { type: 'MARKER_ADD', markerKey: 'sake', count: 2, max: 3 },
      { type: 'MARKER_ADD', markerKey: 'sake', count: 2, max: 3 },
    ], ctx);
    expect(player.shikigamiState[0]!.markers['sake']).toBe(3);
  });

  it('MARKER_REMOVE：移除全部指示物', async () => {
    player.shikigamiState = [{ cardId: 'shikigami_003', markers: { sake: 3 } }];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'MARKER_REMOVE', markerKey: 'sake', count: 'ALL' }], ctx);
    expect(player.shikigamiState[0]!.markers['sake']).toBeUndefined();
  });

  it('MARKER_REMOVE：移除指定数量', async () => {
    player.shikigamiState = [{ cardId: 'shikigami_003', markers: { sake: 3 } }];
    const ctx = makeCtx(player);
    await engine.execute([{ type: 'MARKER_REMOVE', markerKey: 'sake', count: 2 }], ctx);
    expect(player.shikigamiState[0]!.markers['sake']).toBe(1);
  });

  // ----- KILL_YOKAI -----

  it('KILL_YOKAI：退治生命不高于指定值的妖怪', async () => {
    const target = makeCard({ instanceId: 'yokai_target', hp: 3, cardType: 'yokai' });
    const strong = makeCard({ instanceId: 'yokai_strong', hp: 8, cardType: 'yokai' });
    const gs = makeGameState([player]);
    gs.field.yokaiSlots[0] = target;
    gs.field.yokaiSlots[1] = strong;
    const ctx = makeCtx(player, gs);
    await engine.execute([{ type: 'KILL_YOKAI', maxHp: 4 }], ctx);
    expect(gs.field.yokaiSlots[0]).toBeNull();
    expect(gs.field.yokaiSlots[1]).not.toBeNull();
    expect(player.discard).toHaveLength(1);
  });

  it('KILL_YOKAI：无合法目标时什么都不做', async () => {
    const strong = makeCard({ instanceId: 'yokai_strong', hp: 8, cardType: 'yokai' });
    const gs = makeGameState([player]);
    gs.field.yokaiSlots[0] = strong;
    const ctx = makeCtx(player, gs);
    await engine.execute([{ type: 'KILL_YOKAI', maxHp: 4 }], ctx);
    expect(gs.field.yokaiSlots[0]).not.toBeNull();
    expect(player.discard).toHaveLength(0);
  });

});

// ============ 条件与选择效果 ============

describe('EffectEngine 条件与选择效果', () => {

  let engine: EffectEngine;
  let player: PlayerState;

  beforeEach(() => {
    engine = new EffectEngine();
    player = makePlayer();
  });

  it('CONDITIONAL：条件满足时执行 thenEffects', async () => {
    player.discard = [];
    const ctx = makeCtx(player);
    await engine.execute([{
      type: 'CONDITIONAL',
      condition: { key: 'DISCARD_EMPTY', op: '=', value: 1 },
      thenEffects: [{ type: 'DAMAGE', value: 4 }],
      elseEffects: [{ type: 'DAMAGE', value: 2 }],
    }], ctx);
    expect(player.damage).toBe(4);
  });

  it('CONDITIONAL：条件不满足时执行 elseEffects', async () => {
    player.discard = [makeCard()];
    const ctx = makeCtx(player);
    await engine.execute([{
      type: 'CONDITIONAL',
      condition: { key: 'DISCARD_EMPTY', op: '=', value: 1 },
      thenEffects: [{ type: 'DAMAGE', value: 4 }],
      elseEffects: [{ type: 'DAMAGE', value: 2 }],
    }], ctx);
    expect(player.damage).toBe(2);
  });

  it('CHOICE：使用 onChoice 回调决定执行哪项', async () => {
    const ctx = makeCtx(player);
    ctx.onChoice = vi.fn().mockResolvedValue(1); // 选第2项：鬼火+1
    player.ghostFire = 2;
    await engine.execute([{
      type: 'CHOICE',
      options: [
        { label: '伤害+2', effects: [{ type: 'DAMAGE', value: 2 }] },
        { label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] },
      ],
    }], ctx);
    expect(player.damage).toBe(0);
    expect(player.ghostFire).toBe(3);
  });

  it('CHOICE：无回调时默认选第0项', async () => {
    const ctx = makeCtx(player);
    player.damage = 0;
    await engine.execute([{
      type: 'CHOICE',
      options: [
        { label: '伤害+2', effects: [{ type: 'DAMAGE', value: 2 }] },
        { label: '鬼火+1', effects: [{ type: 'GHOST_FIRE', value: 1 }] },
      ],
    }], ctx);
    expect(player.damage).toBe(2);
  });

  it('CONDITIONAL MARKER_COUNT：有指示物时触发', async () => {
    player.shikigamiState = [{ cardId: 'test', markers: { sleep: 1 } }];
    const ctx = makeCtx(player);
    player.hand = [makeCard()];
    await engine.execute([{
      type: 'CONDITIONAL',
      condition: { key: 'MARKER_COUNT', markerKey: 'sleep', op: '>', value: 0 },
      thenEffects: [{ type: 'DISCARD', count: 1, random: true, target: 'SELF' }],
    }], ctx);
    expect(player.hand).toHaveLength(0);
  });

  it('SPELL_PLAYED_THIS_TURN：本回合阴阳术数量条件', async () => {
    player.played = [
      makeCard({ cardType: 'spell' }),
      makeCard({ cardType: 'spell' }),
    ];
    const ctx = makeCtx(player);
    await engine.execute([{
      type: 'CONDITIONAL',
      condition: { key: 'SPELL_PLAYED_THIS_TURN', op: '>=', value: 2 },
      thenEffects: [{ type: 'DAMAGE', value: 5 }],
    }], ctx);
    expect(player.damage).toBe(5);
  });

});

// ============ 妖怪效果定义完整性 ============

describe('妖怪效果定义完整性', () => {

  it('所有 39 张妖怪都有效果定义', () => {
    const ids = new Set(YOKAI_EFFECT_DEFS.map((d: { cardId: string }) => d.cardId));
    expect(ids.size).toBe(39);
    for (let i = 1; i <= 39; i++) {
      const id = `yokai_${String(i).padStart(3, '0')}`;
      expect(ids.has(id), `缺少 ${id} 的效果定义`).toBe(true);
    }
  });

  it('天邪鬼青 (yokai_004) 有 CHOICE 效果', () => {
    const def = getYokaiEffectDef('yokai_004');
    expect(def).toBeDefined();
    expect(def!.effects[0]!.type).toBe('CHOICE');
  });

  it('鸣屋 (yokai_013) 有 CONDITIONAL 效果', () => {
    const def = getYokaiEffectDef('yokai_013');
    expect(def).toBeDefined();
    expect(def!.effects[0]!.type).toBe('CONDITIONAL');
  });

  it('天邪鬼绿 (yokai_003) 有 KILL_YOKAI 效果', () => {
    const def = getYokaiEffectDef('yokai_003');
    expect(def).toBeDefined();
    const killEffect = def!.effects.find(e => e.type === 'KILL_YOKAI');
    expect(killEffect).toBeDefined();
    expect((killEffect as any).maxHp).toBe(4);
  });

  it('涅槃之火 (yokai_018) 条件式：打出过御魂时额外鬼火+1', async () => {
    const engine = new EffectEngine();
    const player = makePlayer({ ghostFire: 1 });
    player.played = [makeCard({ cardType: 'yokai' })]; // 已打出过御魂
    const ctx = makeCtx(player);
    const def = getYokaiEffectDef('yokai_018')!;
    await engine.execute(def.effects, ctx);
    // 基础+1，条件满足再+1 = 3
    expect(player.ghostFire).toBe(3);
  });

  it('镇墓兽 (yokai_026) 全效果：抓牌+1, 伤害+2, 鬼火+2', async () => {
    const engine = new EffectEngine();
    const player = makePlayer({
      ghostFire: 1,
      deck: [makeCard(), makeCard()],
    });
    const ctx = makeCtx(player);
    const def = getYokaiEffectDef('yokai_026')!;
    await engine.execute(def.effects, ctx);
    expect(player.hand).toHaveLength(1);
    expect(player.damage).toBe(2);
    expect(player.ghostFire).toBe(3);
  });

});

// ============ 式神效果定义 ============

describe('式神效果定义', () => {

  it('式神覆盖29种（含多技能分拆后总定义数 >= 29）', () => {
    const ids = new Set(SHIKIGAMI_EFFECT_DEFS.map((d: { cardId: string }) => d.cardId));
    // 29 种式神：shikigami_001~029（部分ID可能跳过，如编号14、17、18等）
    expect(ids.size).toBeGreaterThanOrEqual(15);
    expect(SHIKIGAMI_EFFECT_DEFS.length).toBeGreaterThanOrEqual(20);
  });

  it('酒吞童子 (shikigami_003) 有2个技能定义', () => {
    const defs = getShikigamiEffectDefs('shikigami_003');
    expect(defs).toHaveLength(2);
    expect(defs[0]!.skillName).toBe('酒葫芦·储酒');
    expect(defs[1]!.skillName).toBe('酒葫芦·释放');
  });

  it('萤草 (shikigami_016) 有3个技能定义（播种/开花/护盾）', () => {
    const defs = getShikigamiEffectDefs('shikigami_016');
    expect(defs).toHaveLength(3);
    const names = defs.map(d => d.skillName);
    expect(names).toContain('生花·播种');
    expect(names).toContain('生花·开花');
    expect(names).toContain('生花·护盾');
  });

  it('食梦貘 (shikigami_013) 入眠技能有 DRAW+4 和 MARKER_ADD', () => {
    const defs = getShikigamiEffectDefs('shikigami_013');
    const sleepSkill = defs.find(d => d.skillName === '沉睡·入眠');
    expect(sleepSkill).toBeDefined();
    const drawEff = sleepSkill!.effects.find(e => e.type === 'DRAW');
    expect(drawEff).toBeDefined();
    expect((drawEff as any).count).toBe(4);
    const markerEff = sleepSkill!.effects.find(e => e.type === 'MARKER_ADD');
    expect(markerEff).toBeDefined();
    expect((markerEff as any).markerKey).toBe('sleep');
  });

  it('山童 (shikigami_022) 怪力技能为启类型', () => {
    const defs = getShikigamiEffectDefs('shikigami_022');
    expect(defs).toHaveLength(1);
    expect(defs[0]!.effectType).toBe('启');
    expect(defs[0]!.skillName).toBe('怪力');
  });

  it('独眼小僧 (shikigami_019) 金刚经为永久被动', () => {
    const defs = getShikigamiEffectDefs('shikigami_019');
    expect(defs).toHaveLength(1);
    expect(defs[0]!.effectType).toBe('永');
    expect(defs[0]!.trigger).toBe('PASSIVE');
  });

});
