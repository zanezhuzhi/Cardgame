/**
 * MultiplayerGame pendingChoice 响应链集成测试（按类型分 describe，经真实实例）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerGame } from '../MultiplayerGame';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  getHarnessState,
  createSpellInstance,
  createYokaiTestCard,
} from './multiplayerTestHarness';

describe('MultiplayerGame 交互：pendingChoice 收口', () => {
  describe('salvageChoice + handleSalvageResponse', () => {
    let game: MultiplayerGame;
    let player: ReturnType<typeof getHarnessPlayer>;

    beforeEach(() => {
      game = createMultiplayerGameForTest({ playerCount: 2 });
      player = getHarnessPlayer(game, 0);
      player.hand = [];
      player.deck = [
        {
          instanceId: 'deck_top_1',
          cardId: 'spell_test',
          cardType: 'spell',
          name: '基础术式',
          damage: 1,
          hp: 1,
          maxHp: 1,
        },
      ];
      player.exiled = [];
    });

    it('🟢 唐纸伞妖效果后超度：牌库顶进入超度区并清除 pending', () => {
      const umbrella = createYokaiTestCard('唐纸伞妖', 3);
      (game as any).executeYokaiEffect(player, umbrella);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('salvageChoice');

      const res = game.handleSalvageResponse(player.id, true);
      expect(res.success).toBe(true);
      expect(state.pendingChoice).toBeUndefined();
      expect(player.exiled.some(c => c.name === '基础术式')).toBe(true);
      expect(player.deck).toHaveLength(0);
    });

    it('🟢 选择不超度：pending 清除，牌库顶仍在', () => {
      const umbrella = createYokaiTestCard('唐纸伞妖', 3);
      (game as any).executeYokaiEffect(player, umbrella);

      const res = game.handleSalvageResponse(player.id, false);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
      expect(player.deck).toHaveLength(1);
      expect(player.exiled).toHaveLength(0);
    });
  });

  describe('tufoSelect + handleTufoSelectResponse', () => {
    let game: MultiplayerGame;
    let player: ReturnType<typeof getHarnessPlayer>;

    beforeEach(() => {
      game = createMultiplayerGameForTest({ playerCount: 2 });
      player = getHarnessPlayer(game, 0);
      player.hand = [];
      player.discard = [];
    });

    it('🟢 涂佛 effect 触发 tufoSelect，选人响应后牌入手', () => {
      const spell = createSpellInstance('高级符咒', 3, 'tufo_spell_1');
      player.discard = [spell];
      const tufo = createYokaiTestCard('涂佛', 5);
      (game as any).executeYokaiEffect(player, tufo);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('tufoSelect');

      const pick = game.handleTufoSelectResponse(player.id, [spell.instanceId]);
      expect(pick.success).toBe(true);
      expect(state.pendingChoice).toBeUndefined();
      expect(player.hand.some(c => c.instanceId === spell.instanceId)).toBe(true);
      expect(player.discard).toHaveLength(0);
    });
  });

  describe('wheelMonkDiscard + handleWheelMonkDiscardResponse', () => {
    let game: MultiplayerGame;
    let player: ReturnType<typeof getHarnessPlayer>;

    beforeEach(() => {
      game = createMultiplayerGameForTest({ playerCount: 2 });
      player = getHarnessPlayer(game, 0);
      player.damage = 0;
    });

    it('🟢 多张候选御魂时 pending wheelMonkDiscard，选对后执行双重效果', () => {
      const wheel = createYokaiTestCard('轮入道', 5);
      const heart = createYokaiTestCard('心眼', 3, { instanceId: 'heart_1' });
      const soldier = createYokaiTestCard('兵主部', 4, { instanceId: 'soldier_1' });
      player.hand = [wheel, heart, soldier];

      (game as any).executeYokaiEffect(player, wheel);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('wheelMonkDiscard');

      const res = game.handleWheelMonkDiscardResponse(player.id, heart.instanceId);
      expect(res.success).toBe(true);
      expect(state.pendingChoice).toBeUndefined();
      expect(player.damage).toBeGreaterThan(0);
    });
  });

  describe('youguXiangSelect + handleYouguXiangSelectResponse', () => {
    it('🟢 幽谷响：展示对手牌库顶后可空选收口', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
      const p0 = getHarnessPlayer(game, 0);
      const p1 = getHarnessPlayer(game, 1);
      const top = createYokaiTestCard('灯笼鬼', 3, { instanceId: 'yg_top_1' });
      p1.deck = [top, ...p1.deck.slice(1)];
      const yougu = createYokaiTestCard('幽谷响', 7);
      (game as any).executeYokaiEffect(p0, yougu);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('youguXiangSelect');
      expect((state.pendingChoice as any).playerId).toBe(p0.id);

      const res = game.handleYouguXiangSelectResponse(p0.id, []);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
    });
  });

  describe('shangHunNiaoExile + handleShangHunNiaoResponse', () => {
    it('🟢 伤魂鸟：选 1 张超度后伤害 +2', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2 });
      const player = getHarnessPlayer(game, 0);
      const h1 = createSpellInstance('基础术式', 1, 'sh_1');
      const h2 = createSpellInstance('基础术式', 1, 'sh_2');
      player.hand = [h1, h2];
      player.damage = 0;
      const bird = createYokaiTestCard('伤魂鸟', 6);
      (game as any).executeYokaiEffect(player, bird);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('shangHunNiaoExile');

      const beforeDmg = player.damage;
      const res = game.handleShangHunNiaoResponse(player.id, [h1.instanceId]);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
      expect(player.damage).toBe(beforeDmg + 2);
      expect(player.exiled.some(c => c.instanceId === h1.instanceId)).toBe(true);
    });
  });

  describe('yinmoluoSelect + handleYinmoluoSelectResponse（轮入道 executeYokaiEffectByName）', () => {
    it('🟢 阴摩罗：从弃牌区选 2 张 HP<6 的牌后 pending 清除', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2 });
      const player = getHarnessPlayer(game, 0);
      const a = createSpellInstance('基础术式', 1, 'ym_1');
      const b = createSpellInstance('基础术式', 1, 'ym_2');
      player.discard = [a, b];
      const src = createYokaiTestCard('阴摩罗', 7);
      (game as any).executeYokaiEffectByName(player, '阴摩罗', src);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('yinmoluoSelect');
      const pc = state.pendingChoice as any;
      expect(pc.selectCount).toBe(2);

      const res = game.handleYinmoluoSelectResponse(player.id, [a.instanceId, b.instanceId]);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
    });
  });

  describe('zhenMuShouTarget + handleZhenMuShouTargetResponse', () => {
    it('🟢 镇墓兽：左手边玩家选目标后被限制玩家写入 prohibitedTargets', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
      const p0 = getHarnessPlayer(game, 0);
      const p1 = getHarnessPlayer(game, 1);
      const y = createYokaiTestCard('天邪鬼绿', 3, { instanceId: 'zms_y_1' });
      const st = getHarnessState(game);
      st.field.yokaiSlots[0] = y;
      st.field.currentBoss = null;

      const zms = createYokaiTestCard('镇墓兽', 5);
      (game as any).executeYokaiEffect(p0, zms);

      expect(st.pendingChoice?.type).toBe('zhenMuShouTarget');
      const pc = st.pendingChoice as any;
      expect(pc.playerId).toBe(p1.id);
      expect(pc.restrictedPlayerId).toBe(p0.id);

      const res = game.handleZhenMuShouTargetResponse(p1.id, y.instanceId);
      expect(res.success).toBe(true);
      expect(st.pendingChoice).toBeUndefined();
      expect((p0 as any).prohibitedTargets).toContain(y.instanceId);
    });
  });
});
