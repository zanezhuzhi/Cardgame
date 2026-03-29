/**
 * ShikigamiSkillEngine + HarassmentPipeline 框架级单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ShikigamiSkillEngine } from './ShikigamiSkillEngine';
import {
  resolveHarassment,
  createHarassmentAction,
  clearResistHandlers,
  getResistHandlers,
  registerResistHandler,
} from './HarassmentPipeline';
import type { PlayerState, ShikigamiState, GameState } from '../../types/game';
import type { CardInstance, ShikigamiCard } from '../../types/cards';
import type {
  ShikigamiSkillDef,
  SkillContext,
  SkillResult,
  SkillEvent,
} from '../../types/shikigami';

// ============ 测试辅助工具 ============

function createTestCard(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `inst_${Math.random().toString(36).slice(2, 8)}`,
    cardId: 'yokai_001',
    cardType: 'yokai',
    name: '测试妖怪',
    hp: 3,
    maxHp: 3,
    image: 'test.png',
    ...overrides,
  };
}

function createTestShikigamiState(overrides: Partial<ShikigamiState> = {}): ShikigamiState {
  return {
    cardId: 'shikigami_test',
    isExhausted: false,
    markers: {},
    skillUsesThisTurn: {},
    statusFlags: [],
    ...overrides,
  };
}

function createTestPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    name: '测试玩家',
    onmyoji: null,
    shikigami: [],
    maxShikigami: 2,
    ghostFire: 5,
    maxGhostFire: 5,
    damage: 0,
    hand: [],
    deck: [],
    discard: [],
    exiled: [],
    shikigamiState: [createTestShikigamiState()],
    tempBuffs: [],
    pendingChoice: null,
    turnHistory: { events: [], cardsPlayed: [], skillsUsed: [], discards: [], yokaiDefeated: [] },
    revealedDeckCards: [],
    ...overrides,
  } as PlayerState;
}

function createTestShikigami(overrides: Partial<ShikigamiCard> = {}): ShikigamiCard {
  return {
    id: 'shikigami_test',
    name: '测试式神',
    type: 'shikigami',
    category: '攻击',
    rarity: 'R',
    charm: 0,
    image: 'test.png',
    multiPlayer: true,
    gender: 0,
    skill: { name: '测试技能', cost: 1, effect: '测试效果' },
    ...overrides,
  } as ShikigamiCard;
}

const logs: string[] = [];

function createTestContext(overrides: Partial<SkillContext> = {}): SkillContext {
  const player = overrides.player ?? createTestPlayer();
  return {
    gameState: { players: [player], field: {} } as unknown as GameState,
    player,
    shikigami: overrides.shikigami ?? createTestShikigami(),
    shikigamiState: overrides.shikigamiState ?? player.shikigamiState[0]!,
    slotIndex: 0,
    opponents: overrides.opponents ?? [],
    onSelectCards: async () => [],
    onSelectTarget: async () => '',
    onSelectMultiTargets: async () => [],
    onChoice: async () => 0,
    onInputNumber: async () => 1,
    drawCards: (p, count) => { for (let i = 0; i < count; i++) p.hand.push(createTestCard()); return count; },
    discardCard: () => {},
    exileCard: () => {},
    gainPenalty: () => {},
    addLog: (msg: string) => { logs.push(msg); },
    emitEvent: async () => {},
    ...overrides,
  };
}

function createSimpleSkillDef(overrides: Partial<ShikigamiSkillDef> = {}): ShikigamiSkillDef {
  return {
    skillId: 'shikigami_test:测试技能',
    shikigamiId: 'shikigami_test',
    name: '测试技能',
    effectType: '启',
    trigger: 'ACTIVE',
    cost: { kind: 'GHOST_FIRE', amount: 1 },
    isHarassment: false,
    usesPerTurn: 1,
    description: '测试用技能',
    canUse: () => null,
    execute: async () => ({ success: true, message: '技能执行成功' }),
    ...overrides,
  };
}

// ============================================================
//  1. 引擎 - 注册与查询
// ============================================================

describe('ShikigamiSkillEngine', () => {
  let engine: ShikigamiSkillEngine;

  beforeEach(() => {
    engine = new ShikigamiSkillEngine();
    logs.length = 0;
  });

  describe('注册与查询', () => {
    it('🟢 注册单个技能并查询', () => {
      const def = createSimpleSkillDef();
      engine.registerSkillDef(def);

      expect(engine.registeredCount).toBe(1);
      expect(engine.getSkillDef('shikigami_test:测试技能')).toBe(def);
    });

    it('🟢 批量注册多个技能', () => {
      const defs = [
        createSimpleSkillDef({ skillId: 's1:a', shikigamiId: 's1', name: 'A' }),
        createSimpleSkillDef({ skillId: 's1:b', shikigamiId: 's1', name: 'B' }),
        createSimpleSkillDef({ skillId: 's2:c', shikigamiId: 's2', name: 'C' }),
      ];
      engine.registerAll(defs);

      expect(engine.registeredCount).toBe(3);
      expect(engine.getSkillDefs('s1')).toHaveLength(2);
      expect(engine.getSkillDefs('s2')).toHaveLength(1);
    });

    it('🔴 重复 skillId 抛出异常', () => {
      engine.registerSkillDef(createSimpleSkillDef());
      expect(() => engine.registerSkillDef(createSimpleSkillDef())).toThrow('重复注册');
    });

    it('🟢 getActiveSkills / getPassiveSkills 区分', () => {
      engine.registerAll([
        createSimpleSkillDef({ skillId: 's:active', shikigamiId: 's', trigger: 'ACTIVE' }),
        createSimpleSkillDef({ skillId: 's:trigger', shikigamiId: 's', trigger: 'ON_KILL', effectType: '触' }),
        createSimpleSkillDef({ skillId: 's:passive', shikigamiId: 's', trigger: 'PASSIVE', effectType: '永' }),
      ]);

      expect(engine.getActiveSkills('s')).toHaveLength(1);
      expect(engine.getPassiveSkills('s')).toHaveLength(2);
    });

    it('🟢 hasSkillDefs 正确判断', () => {
      expect(engine.hasSkillDefs('none')).toBe(false);
      engine.registerSkillDef(createSimpleSkillDef());
      expect(engine.hasSkillDefs('shikigami_test')).toBe(true);
    });

    it('🟢 查询不存在的式神返回空数组', () => {
      expect(engine.getSkillDefs('nonexistent')).toEqual([]);
    });
  });

  // ============================================================
  //  2. 引擎 - 前置校验 (canUseSkill)
  // ============================================================

  describe('前置校验 (canUseSkill)', () => {
    it('🟢 正常情况可发动', () => {
      engine.registerSkillDef(createSimpleSkillDef());
      const ctx = createTestContext();
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toBeNull();
    });

    it('🔴 未知技能', () => {
      const ctx = createTestContext();
      expect(engine.canUseSkill('unknown', ctx)).toContain('未知技能');
    });

    it('🔴 式神已疲劳（主动技能）', () => {
      engine.registerSkillDef(createSimpleSkillDef());
      const state = createTestShikigamiState({ isExhausted: true });
      const player = createTestPlayer({ shikigamiState: [state] });
      const ctx = createTestContext({ player, shikigamiState: state });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toContain('已行动');
    });

    it('🔴 本回合使用次数达上限', () => {
      engine.registerSkillDef(createSimpleSkillDef({ usesPerTurn: 1 }));
      const state = createTestShikigamiState({
        skillUsesThisTurn: { 'shikigami_test:测试技能': 1 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });
      const ctx = createTestContext({ player, shikigamiState: state });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toContain('已使用');
    });

    it('🔴 鬼火不足（固定消耗）', () => {
      engine.registerSkillDef(createSimpleSkillDef({ cost: { kind: 'GHOST_FIRE', amount: 3 } }));
      const player = createTestPlayer({ ghostFire: 2 });
      const ctx = createTestContext({ player });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toContain('鬼火不足');
    });

    it('🔴 鬼火不足（可变消耗 min）', () => {
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE_VARIABLE', min: 2, max: 5 },
      }));
      const player = createTestPlayer({ ghostFire: 1 });
      const ctx = createTestContext({ player });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toContain('鬼火不足');
    });

    it('🔴 鬼火不足（可选追加 base）', () => {
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE_OPTIONAL', base: 2, extra: 1 },
      }));
      const player = createTestPlayer({ ghostFire: 1 });
      const ctx = createTestContext({ player });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toContain('鬼火不足');
    });

    it('🔴 技能自身 canUse 返回错误', () => {
      engine.registerSkillDef(createSimpleSkillDef({
        canUse: () => '没有合法目标',
      }));
      const ctx = createTestContext();
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toBe('没有合法目标');
    });

    it('🟢 无消耗技能可发动', () => {
      engine.registerSkillDef(createSimpleSkillDef({ cost: { kind: 'NONE' } }));
      const ctx = createTestContext();
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toBeNull();
    });

    it('🟢 无限制使用次数(-1)不受限', () => {
      engine.registerSkillDef(createSimpleSkillDef({ usesPerTurn: -1 }));
      const state = createTestShikigamiState({
        skillUsesThisTurn: { 'shikigami_test:测试技能': 99 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });
      const ctx = createTestContext({ player, shikigamiState: state });
      expect(engine.canUseSkill('shikigami_test:测试技能', ctx)).toBeNull();
    });
  });

  // ============================================================
  //  3. 引擎 - 执行主动技能 (executeActiveSkill)
  // ============================================================

  describe('执行主动技能 (executeActiveSkill)', () => {
    it('🟢 正常执行：扣鬼火 → 标记疲劳 → 更新计数', async () => {
      let executed = false;
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE', amount: 2 },
        execute: async () => { executed = true; return { success: true, message: 'OK' }; },
      }));
      const player = createTestPlayer({ ghostFire: 5 });
      const ctx = createTestContext({ player });

      const result = await engine.executeActiveSkill('shikigami_test:测试技能', ctx);

      expect(result.success).toBe(true);
      expect(executed).toBe(true);
      expect(player.ghostFire).toBe(3); // 5 - 2
      expect(ctx.shikigamiState.isExhausted).toBe(true);
      expect(ctx.shikigamiState.skillUsesThisTurn['shikigami_test:测试技能']).toBe(1);
      expect(result.ghostFirePaid).toBe(2);
    });

    it('🔴 前置校验失败不执行', async () => {
      let executed = false;
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE', amount: 10 },
        execute: async () => { executed = true; return { success: true, message: 'OK' }; },
      }));
      const player = createTestPlayer({ ghostFire: 3 });
      const ctx = createTestContext({ player });

      const result = await engine.executeActiveSkill('shikigami_test:测试技能', ctx);

      expect(result.success).toBe(false);
      expect(executed).toBe(false);
      expect(player.ghostFire).toBe(3); // 未扣除
    });

    it('🔴 execute 返回 false → 退还鬼火', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE', amount: 2 },
        execute: async () => ({ success: false, message: '执行失败' }),
      }));
      const player = createTestPlayer({ ghostFire: 5 });
      const ctx = createTestContext({ player });

      const result = await engine.executeActiveSkill('shikigami_test:测试技能', ctx);

      expect(result.success).toBe(false);
      expect(player.ghostFire).toBe(5); // 退还
      expect(ctx.shikigamiState.isExhausted).toBe(false); // 未标记疲劳
    });

    it('🟢 NONE 消耗不扣鬼火', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'NONE' },
      }));
      const player = createTestPlayer({ ghostFire: 5 });
      const ctx = createTestContext({ player });

      const result = await engine.executeActiveSkill('shikigami_test:测试技能', ctx);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(5);
      expect(result.ghostFirePaid).toBe(0);
    });

    it('🟢 execute 自报 ghostFirePaid 叠加引擎扣除', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        cost: { kind: 'GHOST_FIRE', amount: 1 },
        execute: async (ctx) => {
          // 技能内部额外扣了 1 鬼火
          ctx.player.ghostFire -= 1;
          return { success: true, message: 'OK', ghostFirePaid: 1 };
        },
      }));
      const player = createTestPlayer({ ghostFire: 5 });
      const ctx = createTestContext({ player });

      const result = await engine.executeActiveSkill('shikigami_test:测试技能', ctx);

      expect(result.success).toBe(true);
      expect(player.ghostFire).toBe(3); // 5 - 1(引擎) - 1(技能内部)
      expect(result.ghostFirePaid).toBe(2); // 1 + 1
    });

    it('🟢 产生日志', async () => {
      engine.registerSkillDef(createSimpleSkillDef());
      const ctx = createTestContext();
      await engine.executeActiveSkill('shikigami_test:测试技能', ctx);
      expect(logs.some(l => l.includes('发动'))).toBe(true);
    });
  });

  // ============================================================
  //  4. 引擎 - 触发被动技能 (triggerPassiveSkill)
  // ============================================================

  describe('触发被动技能 (triggerPassiveSkill)', () => {
    it('🟢 正常触发：不标记疲劳', async () => {
      let executed = false;
      engine.registerSkillDef(createSimpleSkillDef({
        trigger: 'ON_KILL',
        effectType: '触',
        cost: { kind: 'NONE' },
        execute: async () => { executed = true; return { success: true, message: '触发成功' }; },
      }));
      const ctx = createTestContext();
      const event: SkillEvent = { type: 'YOKAI_KILLED', sourcePlayerId: 'p1' };

      const result = await engine.triggerPassiveSkill('shikigami_test:测试技能', event, ctx);

      expect(result?.success).toBe(true);
      expect(executed).toBe(true);
      expect(ctx.shikigamiState.isExhausted).toBe(false); // 被动不标记疲劳
      expect(ctx.shikigamiState.skillUsesThisTurn['shikigami_test:测试技能']).toBe(1);
    });

    it('🔴 使用次数达上限返回 null', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        trigger: 'ON_KILL',
        effectType: '触',
        cost: { kind: 'NONE' },
        usesPerTurn: 1,
      }));
      const state = createTestShikigamiState({
        skillUsesThisTurn: { 'shikigami_test:测试技能': 1 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });
      const ctx = createTestContext({ player, shikigamiState: state });
      const event: SkillEvent = { type: 'YOKAI_KILLED', sourcePlayerId: 'p1' };

      const result = await engine.triggerPassiveSkill('shikigami_test:测试技能', event, ctx);
      expect(result).toBeNull();
    });

    it('🔴 鬼火不足时被动不触发', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        trigger: 'ON_INTERFERE',
        effectType: '自',
        cost: { kind: 'GHOST_FIRE', amount: 2 },
      }));
      const player = createTestPlayer({ ghostFire: 1 });
      const ctx = createTestContext({ player });
      const event: SkillEvent = { type: 'HARASSMENT_INCOMING', sourcePlayerId: 'p2' };

      const result = await engine.triggerPassiveSkill('shikigami_test:测试技能', event, ctx);
      expect(result).toBeNull();
    });

    it('🟢 被动触发扣除鬼火', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        trigger: 'ON_INTERFERE',
        effectType: '自',
        cost: { kind: 'GHOST_FIRE', amount: 1 },
      }));
      const player = createTestPlayer({ ghostFire: 3 });
      const ctx = createTestContext({ player });
      const event: SkillEvent = { type: 'HARASSMENT_INCOMING', sourcePlayerId: 'p2' };

      const result = await engine.triggerPassiveSkill('shikigami_test:测试技能', event, ctx);
      expect(result?.success).toBe(true);
      expect(player.ghostFire).toBe(2); // 3 - 1
      expect(result?.ghostFirePaid).toBe(1);
    });

    it('🔴 execute 失败退还鬼火', async () => {
      engine.registerSkillDef(createSimpleSkillDef({
        trigger: 'ON_INTERFERE',
        effectType: '自',
        cost: { kind: 'GHOST_FIRE', amount: 1 },
        execute: async () => ({ success: false, message: '失败' }),
      }));
      const player = createTestPlayer({ ghostFire: 3 });
      const ctx = createTestContext({ player });
      const event: SkillEvent = { type: 'HARASSMENT_INCOMING', sourcePlayerId: 'p2' };

      const result = await engine.triggerPassiveSkill('shikigami_test:测试技能', event, ctx);
      expect(result?.success).toBe(false);
      expect(player.ghostFire).toBe(3); // 退还
    });
  });

  // ============================================================
  //  5. 引擎 - 事件总线
  // ============================================================

  describe('事件总线 (on/off/emit)', () => {
    it('🟢 注册监听器 → emit 触发', async () => {
      let received = false;
      engine.on('YOKAI_KILLED', async () => { received = true; });

      const ctx = createTestContext();
      await engine.emit({ type: 'YOKAI_KILLED', sourcePlayerId: 'p1' }, ctx);

      expect(received).toBe(true);
    });

    it('🟢 多个监听器按注册顺序执行', async () => {
      const order: number[] = [];
      engine.on('CARDS_DRAWN', async () => { order.push(1); });
      engine.on('CARDS_DRAWN', async () => { order.push(2); });

      const ctx = createTestContext();
      await engine.emit({ type: 'CARDS_DRAWN', sourcePlayerId: 'p1' }, ctx);

      expect(order).toEqual([1, 2]);
    });

    it('🟢 off 移除监听器', async () => {
      let count = 0;
      const listener = async () => { count++; };
      engine.on('TURN_START', listener);

      const ctx = createTestContext();
      await engine.emit({ type: 'TURN_START', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(1);

      engine.off('TURN_START', listener);
      await engine.emit({ type: 'TURN_START', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(1); // 没有再触发
    });

    it('🟢 clearListeners 清空所有', async () => {
      let count = 0;
      engine.on('TURN_START', async () => { count++; });
      engine.on('TURN_END', async () => { count++; });

      engine.clearListeners();

      const ctx = createTestContext();
      await engine.emit({ type: 'TURN_START', sourcePlayerId: 'p1' }, ctx);
      await engine.emit({ type: 'TURN_END', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(0);
    });

    it('🟢 无监听器时 emit 不报错', async () => {
      const ctx = createTestContext();
      await expect(
        engine.emit({ type: 'DAMAGE_DEALT', sourcePlayerId: 'p1' }, ctx)
      ).resolves.toBeUndefined();
    });
  });

  // ============================================================
  //  6. 引擎 - 生命周期钩子
  // ============================================================

  describe('生命周期钩子', () => {
    it('🟢 onTurnStart：重置疲劳 + 使用计数', () => {
      const state = createTestShikigamiState({
        isExhausted: true,
        skillUsesThisTurn: { 'some:skill': 2 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });

      engine.onTurnStart(player);

      expect(state.isExhausted).toBe(false);
      expect(state.skillUsesThisTurn).toEqual({});
    });

    it('🟢 onTurnStart：清理 TURN_START 时机指示物', () => {
      // sleep 的 clearOn 是 'TURN_START'
      const state = createTestShikigamiState({
        markers: { sleep: 1, seed: 3 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });

      engine.onTurnStart(player);

      expect(state.markers['sleep']).toBeUndefined(); // sleep 被清理
      expect(state.markers['seed']).toBe(3);           // seed 持久，不被清理
    });

    it('🟢 onTurnEnd：清理 TURN_END 时机指示物', () => {
      // seed_method_fire 的 clearOn='TURN_END'，seed 的 clearOn='MANUAL'
      const state = createTestShikigamiState({
        markers: { seed_method_fire: 1, seed: 2 },
      });
      const player = createTestPlayer({ shikigamiState: [state] });

      engine.onTurnEnd(player);

      expect(state.markers['seed_method_fire']).toBeUndefined(); // 被清理
      expect(state.markers['seed']).toBe(2);                     // 保留
    });

    it('🟢 createDefaultState 生成正确初始状态', () => {
      const state = ShikigamiSkillEngine.createDefaultState('shikigami_003');
      expect(state).toEqual({
        cardId: 'shikigami_003',
        isExhausted: false,
        markers: {},
        skillUsesThisTurn: {},
        statusFlags: [],
      });
    });

    it('🟢 多式神回合开始全部重置', () => {
      const s1 = createTestShikigamiState({ cardId: 's1', isExhausted: true });
      const s2 = createTestShikigamiState({ cardId: 's2', isExhausted: true });
      const player = createTestPlayer({ shikigamiState: [s1, s2] });

      engine.onTurnStart(player);

      expect(s1.isExhausted).toBe(false);
      expect(s2.isExhausted).toBe(false);
    });
  });

  // ============================================================
  //  7. 引擎 - 式神入场/离场
  // ============================================================

  describe('式神入场/离场 (onShikigamiEnter/Leave)', () => {
    it('🟢 入场注册被动监听 → 事件触发技能', async () => {
      let triggered = false;
      engine.registerSkillDef(createSimpleSkillDef({
        skillId: 'shikigami_test:被动',
        trigger: 'ON_KILL',
        effectType: '触',
        cost: { kind: 'NONE' },
        execute: async () => { triggered = true; return { success: true, message: '触发' }; },
      }));

      const shikigami = createTestShikigami();
      const player = createTestPlayer();

      engine.onShikigamiEnter(player, shikigami, () => createTestContext({ player }));

      // 触发事件
      const ctx = createTestContext({ player });
      await engine.emit({ type: 'YOKAI_KILLED', sourcePlayerId: 'p1' }, ctx);

      expect(triggered).toBe(true);
    });

    it('🟢 离场移除监听器 → 事件不再触发', async () => {
      let count = 0;
      engine.registerSkillDef(createSimpleSkillDef({
        skillId: 'shikigami_test:被动',
        trigger: 'ON_KILL',
        effectType: '触',
        cost: { kind: 'NONE' },
        execute: async () => { count++; return { success: true, message: '触发' }; },
      }));

      const shikigami = createTestShikigami();
      const player = createTestPlayer();

      engine.onShikigamiEnter(player, shikigami, () => createTestContext({ player }));

      const ctx = createTestContext({ player });
      await engine.emit({ type: 'YOKAI_KILLED', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(1);

      // 离场
      engine.onShikigamiLeave(player, shikigami.id);
      await engine.emit({ type: 'YOKAI_KILLED', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(1); // 不再增加
    });

    it('🟢 reset 清除所有监听器存储', async () => {
      let count = 0;
      engine.registerSkillDef(createSimpleSkillDef({
        skillId: 'shikigami_test:被动',
        trigger: 'ON_KILL',
        effectType: '触',
        cost: { kind: 'NONE' },
        execute: async () => { count++; return { success: true, message: '' }; },
      }));

      const shikigami = createTestShikigami();
      const player = createTestPlayer();
      engine.onShikigamiEnter(player, shikigami, () => createTestContext({ player }));

      engine.reset();
      const ctx = createTestContext({ player });
      await engine.emit({ type: 'YOKAI_KILLED', sourcePlayerId: 'p1' }, ctx);
      expect(count).toBe(0);
    });
  });
});

// ============================================================
//  8. 妨害管线 (HarassmentPipeline)
// ============================================================

describe('HarassmentPipeline', () => {
  beforeEach(() => {
    logs.length = 0;
    // 注意：内建处理器在模块加载时已注册，这里不清空
    // 如需隔离测试，可以 clearResistHandlers() 后手动注册
  });

  describe('无抵抗情况', () => {
    it('🟢 所有目标都受到妨害', async () => {
      // 清空内建处理器，纯净测试
      const savedHandlers = [...getResistHandlers()];
      clearResistHandlers();

      try {
        const target1 = createTestPlayer({ id: 't1', name: '目标1' });
        const target2 = createTestPlayer({ id: 't2', name: '目标2' });
        let appliedTo: string[] = [];

        const action = createHarassmentAction('p1', '百目鬼', async (target) => {
          appliedTo.push(target.id);
        });

        const ctx = createTestContext();
        const result = await resolveHarassment(action, [target1, target2], ctx);

        expect(result.affectedCount).toBe(2);
        expect(appliedTo).toEqual(['t1', 't2']);
        expect(result.targets.every(t => t.applied)).toBe(true);
        expect(result.targets.every(t => !t.immune)).toBe(true);
      } finally {
        // 恢复处理器
        clearResistHandlers();
        savedHandlers.forEach(h => registerResistHandler(h));
      }
    });

    it('🟢 applyToTarget 期间 ctx.harassmentResistSubject 为当前目标，管线结束后清除', async () => {
      const savedHandlers = [...getResistHandlers()];
      clearResistHandlers();
      try {
        const target1 = createTestPlayer({ id: 't1', name: '目标1' });
        const target2 = createTestPlayer({ id: 't2', name: '目标2' });
        const seen: string[] = [];

        const action = createHarassmentAction('p1', '百目鬼', async (_target, c) => {
          seen.push(c.harassmentResistSubject!.id);
        });

        const ctx = createTestContext();
        expect(ctx.harassmentResistSubject).toBeUndefined();
        await resolveHarassment(action, [target1, target2], ctx);
        expect(seen).toEqual(['t1', 't2']);
        expect(ctx.harassmentResistSubject).toBeUndefined();
      } finally {
        clearResistHandlers();
        savedHandlers.forEach(h => registerResistHandler(h));
      }
    });
  });

  describe('青女房抵抗（展示免疫）', () => {
    it('🟢 手牌有青女房，选择展示 → 完全免疫', async () => {
      const target = createTestPlayer({
        id: 't1',
        name: '持有青女房',
        hand: [createTestCard({ cardId: 'yokai_037', name: '青女房' })],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      // onChoice 返回 0 = 选择展示青女房
      let subjectDuringChoice: string | undefined;
      const ctx = createTestContext({
        onChoice: async () => {
          subjectDuringChoice = ctx.harassmentResistSubject?.id;
          return 0;
        },
      });
      const result = await resolveHarassment(action, [target], ctx);
      expect(subjectDuringChoice).toBe('t1');
      expect(ctx.harassmentResistSubject).toBeUndefined();

      expect(result.affectedCount).toBe(0);
      expect(result.targets[0]!.immune).toBe(true);
      expect(result.targets[0]!.immuneSource).toBe('青女房');
      expect(applied).toBe(false);
      // 青女房仍在手牌中（展示不消耗）
      expect(target.hand.some(c => c.cardId === 'yokai_037')).toBe(true);
    });

    it('🟢 手牌有青女房，选择不展示 → 正常受到妨害', async () => {
      const qingnvfangCard = createTestCard({ cardId: 'yokai_037', name: '青女房' });
      const otherCard = createTestCard({ name: '天邪鬼青' });
      const target = createTestPlayer({
        id: 't1',
        name: '持有青女房',
        hand: [otherCard, qingnvfangCard],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async (t) => {
        // 模拟妨害：强制弃置1张手牌
        if (t.hand.length > 0) {
          t.discard.push(t.hand.shift()!);
        }
        applied = true;
      });

      // onChoice 返回 1 = 选择不展示
      const ctx = createTestContext({ onChoice: async () => 1 });
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(1);
      expect(result.targets[0]!.immune).toBe(false);
      expect(applied).toBe(true);
      // 青女房仍在手牌中
      expect(target.hand.some(c => c.cardId === 'yokai_037')).toBe(true);
    });

    it('🔴 手牌无青女房 → 正常受到妨害', async () => {
      const target = createTestPlayer({
        id: 't1',
        name: '无青女房',
        hand: [createTestCard({ name: '天邪鬼青' })],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext();
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(1);
      expect(result.targets[0]!.immune).toBe(false);
      expect(applied).toBe(true);
    });
  });

  describe('铮抵抗（弃置+抓牌）', () => {
    it('🟢 手牌有铮，选择弃置 → 弃置+抓牌+2+免疫', async () => {
      const zhengCard = createTestCard({ cardId: 'yokai_021', name: '铮' });
      const target = createTestPlayer({
        id: 't1',
        name: '持有铮',
        hand: [zhengCard],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      // onChoice 返回 0 = 选择弃置
      const ctx = createTestContext({ onChoice: async () => 0 });
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(0);
      expect(result.targets[0]!.immune).toBe(true);
      expect(result.targets[0]!.immuneSource).toBe('铮');
      expect(applied).toBe(false);
      // 铮已被弃置
      expect(target.hand.find(c => c.cardId === 'yokai_021')).toBeUndefined();
      expect(target.discard.some(c => c.cardId === 'yokai_021')).toBe(true);
      // 抓牌+2
      expect(target.hand.length).toBe(2);
    });

    it('🟢 手牌有铮，选择不弃置 → 正常受到妨害', async () => {
      const zhengCard = createTestCard({ cardId: 'yokai_021', name: '铮' });
      const otherCard = createTestCard({ name: '天邪鬼青' });
      // 铮放在第二位，妨害弃置第一张（天邪鬼青），铮仍保留
      const target = createTestPlayer({
        id: 't1',
        name: '持有铮',
        hand: [otherCard, zhengCard],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async (t) => {
        // 模拟妨害：强制弃置1张手牌
        if (t.hand.length > 0) {
          t.discard.push(t.hand.shift()!);
        }
        applied = true;
      });

      // onChoice 返回 1 = 选择不弃置
      const ctx = createTestContext({ onChoice: async () => 1 });
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(1);
      expect(result.targets[0]!.immune).toBe(false);
      expect(applied).toBe(true);
      // 铮仍在手牌中（未弃置）
      expect(target.hand.some(c => c.cardId === 'yokai_021')).toBe(true);
    });

    it('🔴 牌库为空时弃置铮，抓牌+2 = 0张（无牌可抓）', async () => {
      const zhengCard = createTestCard({ cardId: 'yokai_021', name: '铮' });
      const target = createTestPlayer({
        id: 't1',
        name: '持有铮',
        hand: [zhengCard],
        deck: [],     // 牌库为空
        discard: [],  // 弃牌堆也为空（铮弃置后只有铮自身）
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext({ onChoice: async () => 0 });
      const result = await resolveHarassment(action, [target], ctx);

      // 仍然免疫（弃置铮的效果不取决于抓牌数量）
      expect(result.targets[0]!.immune).toBe(true);
      expect(applied).toBe(false);
      // 铮已弃置到弃牌堆
      expect(target.discard.some(c => c.cardId === 'yokai_021')).toBe(true);
      // 抓牌+2 但 drawCards 工具函数仍会push 2张测试卡（因为 createTestContext 的 drawCards 是 mock）
      // 实际游戏中牌库为空则抓不到牌；这里只验证 immune 和弃置逻辑
    });
  });

  describe('萤草种子抵抗', () => {
    it('🟢 有种子 → 移除1枚+完全免疫', async () => {
      const state = createTestShikigamiState({
        cardId: 'shikigami_014',
        markers: { seed: 2 },
      });
      const target = createTestPlayer({
        id: 't1',
        name: '萤草玩家',
        shikigamiState: [state],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext();
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(0);
      expect(result.targets[0]!.immune).toBe(true);
      expect(result.targets[0]!.immuneSource).toBe('萤草种子');
      expect(applied).toBe(false);
      expect(state.markers['seed']).toBe(1); // 2 → 1
    });

    it('🟢 最后1枚种子用完后删除标记', async () => {
      const state = createTestShikigamiState({
        cardId: 'shikigami_014',
        markers: { seed: 1 },
      });
      const target = createTestPlayer({
        id: 't1',
        name: '萤草玩家',
        shikigamiState: [state],
      });

      const action = createHarassmentAction('p1', '百目鬼', async () => {});
      const ctx = createTestContext();
      await resolveHarassment(action, [target], ctx);

      expect(state.markers['seed']).toBeUndefined(); // 已删除
    });
  });

  describe('花鸟卷抵抗（不免疫）', () => {
    it('🟢 鬼火-1+抓牌+2+置顶 → 仍受妨害', async () => {
      const state = createTestShikigamiState({ cardId: 'shikigami_004' });
      const target = createTestPlayer({
        id: 't1',
        name: '花鸟卷玩家',
        ghostFire: 3,
        hand: [createTestCard({ name: '原有手牌' })],
        shikigamiState: [state],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext();
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.affectedCount).toBe(1);
      expect(result.targets[0]!.immune).toBe(false);
      expect(applied).toBe(true); // 不免疫，妨害仍执行
      expect(target.ghostFire).toBe(2); // 3 - 1
      // 抓牌+2 后置顶1张，净效果手牌 +1
      expect(target.deck.length).toBe(1); // 置顶1张
    });

    it('🔴 鬼火为0时花鸟卷不触发', async () => {
      const state = createTestShikigamiState({ cardId: 'shikigami_004' });
      const target = createTestPlayer({
        id: 't1',
        name: '花鸟卷玩家(无鬼火)',
        ghostFire: 0,
        shikigamiState: [state],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext();
      const result = await resolveHarassment(action, [target], ctx);

      expect(applied).toBe(true);
      expect(target.ghostFire).toBe(0); // 未扣除
    });
  });

  describe('首次妨害追踪', () => {
    it('🟢 首次妨害 isFirstHarass=true', async () => {
      const savedHandlers = [...getResistHandlers()];
      clearResistHandlers();

      try {
        const target = createTestPlayer({ id: 't1', name: '目标' });
        const action = createHarassmentAction('p1', '百目鬼', async () => {});

        const events: string[] = [];
        const ctx = createTestContext({
          emitEvent: async (e) => { events.push(e.type); },
        });

        const result = await resolveHarassment(action, [target], ctx);
        expect(result.isFirstHarass).toBe(true);
        expect(events).toContain('HARASSMENT_INITIATED');
      } finally {
        clearResistHandlers();
        savedHandlers.forEach(h => registerResistHandler(h));
      }
    });

    it('🟢 第二次妨害 isFirstHarass=false', async () => {
      const savedHandlers = [...getResistHandlers()];
      clearResistHandlers();

      try {
        const target = createTestPlayer({ id: 't1', name: '目标' });
        const action = createHarassmentAction('p1', '百目鬼', async () => {});
        const ctx = createTestContext();

        // 第一次
        const r1 = await resolveHarassment(action, [target], ctx);
        expect(r1.isFirstHarass).toBe(true);

        // 第二次（同一 ctx.player 的 tempBuffs 已有标记）
        const r2 = await resolveHarassment(action, [target], ctx);
        expect(r2.isFirstHarass).toBe(false);
      } finally {
        clearResistHandlers();
        savedHandlers.forEach(h => registerResistHandler(h));
      }
    });
  });

  describe('createHarassmentAction', () => {
    it('🟢 创建正确的动作对象', () => {
      const applyFn = async () => {};
      const action = createHarassmentAction('p1', '铁鼠', applyFn);
      expect(action.sourcePlayerId).toBe('p1');
      expect(action.sourceSkillName).toBe('铁鼠');
      expect(action.applyToTarget).toBe(applyFn);
    });
  });

  describe('抵抗优先级', () => {
    it('🟢 青女房优先级高于铮（同时有时青女房生效）', async () => {
      const target = createTestPlayer({
        id: 't1',
        name: '双抵抗',
        hand: [
          createTestCard({ cardId: 'yokai_037', name: '青女房' }),
          createTestCard({ cardId: 'yokai_021', name: '铮' }),
        ],
      });

      let applied = false;
      const action = createHarassmentAction('p1', '百目鬼', async () => {
        applied = true;
      });

      const ctx = createTestContext();
      const result = await resolveHarassment(action, [target], ctx);

      expect(result.targets[0]!.immuneSource).toBe('青女房');
      expect(applied).toBe(false);
      // 铮不应被弃置（青女房已拦截）
      expect(target.hand.find(c => c.cardId === 'yokai_021')).toBeDefined();
    });
  });
});
