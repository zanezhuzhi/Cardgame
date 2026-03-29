/**
 * MultiplayerGame pendingChoice 响应链集成测试（按类型分 describe，经真实实例）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MultiplayerGame } from '../MultiplayerGame';
import type { CardInstance } from '../../types';
import {
  createMultiplayerGameForTest,
  getHarnessPlayer,
  getHarnessState,
  createSpellInstance,
  createYokaiTestCard,
  actionPlayCard,
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

  describe('御魂组（轮入道 / 魅妖 / 幽谷响 / 阴摩罗）：链式效果与 pending 展示', () => {
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

    describe('meiYaoSelect + handleMeiYaoSelectResponse', () => {
      it('🟢 魅妖：唯 1 可用槽时直接借用，yokaiTarget 的 sourceCard 为被执行牌', () => {
        const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
        const p0 = getHarnessPlayer(game, 0);
        const p1 = getHarnessPlayer(game, 1);
        const top = createYokaiTestCard('天邪鬼绿', 2, { instanceId: 'mei_y_top' });
        p1.deck = [
          top,
          ...Array.from({ length: 4 }, (_, i) =>
            createYokaiTestCard('灯笼鬼', 3, { instanceId: `mei_fill_${i}` }),
          ),
        ];
        const st = getHarnessState(game);
        st.field.yokaiSlots[0] = createYokaiTestCard('唐纸伞妖', 2, { instanceId: 'mei_f1' });
        st.field.yokaiSlots[1] = createYokaiTestCard('蝠翼', 3, { instanceId: 'mei_f2' });
        st.field.currentBoss = null;
        const mei = createYokaiTestCard('魅妖', 3, { instanceId: 'hand_mei_grp' });
        p0.hand = [mei];
        expect(actionPlayCard(game, p0.id, mei.instanceId).success).toBe(true);
        const after = getHarnessState(game);
        expect(after.pendingChoice?.type).toBe('yokaiTarget');
        expect((after.pendingChoice as any).sourceCard?.name).toBe('天邪鬼绿');
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
      const pc = state.pendingChoice as any;
      expect(Array.isArray(pc.displayCandidates)).toBe(true);
      expect(pc.displayCandidates.length).toBe(1);
      expect(pc.displayCandidates[0].ownerId).toBe(p1.id);
      expect(pc.displayCandidates[0].isEmptyDeck).not.toBe(true);

      const res = game.handleYouguXiangSelectResponse(p0.id, []);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
    });

    it('🟢 幽谷响：按行动顺序含空库槽位（displayCandidates 与可选 id 分离）', () => {
      const game = createMultiplayerGameForTest({ playerCount: 3, currentPlayerIndex: 0 });
      const p0 = getHarnessPlayer(game, 0);
      const p1 = getHarnessPlayer(game, 1);
      const p2 = getHarnessPlayer(game, 2);
      p1.deck = [];
      const top = createYokaiTestCard('灯笼鬼', 3, { instanceId: 'yg_top_2' });
      p2.deck = [top, ...p2.deck.slice(1)];
      const yougu = createYokaiTestCard('幽谷响', 7);
      (game as any).executeYokaiEffect(p0, yougu);

      const state = getHarnessState(game);
      const pc = state.pendingChoice as any;
      expect(pc?.type).toBe('youguXiangSelect');
      expect(pc.displayCandidates.length).toBe(2);
      const emptySlot = pc.displayCandidates.find((s: any) => s.isEmptyDeck);
      const cardSlot = pc.displayCandidates.find((s: any) => !s.isEmptyDeck);
      expect(emptySlot?.ownerId).toBe(p1.id);
      expect(cardSlot?.instanceId).toBe(top.instanceId);
      expect(pc.selectableCandidates).toEqual([top.instanceId]);

      expect(game.handleYouguXiangSelectResponse(p0.id, [top.instanceId]).success).toBe(true);
    });

    it('🟢 幽谷响：执行他局御魂后天邪鬼绿 pending 的 sourceCard 为被执行牌', async () => {
      const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
      const p0 = getHarnessPlayer(game, 0);
      const p1 = getHarnessPlayer(game, 1);
      const top = createYokaiTestCard('天邪鬼绿', 2, { instanceId: 'yg_txjl' });
      p1.deck = [top, ...p1.deck.slice(1)];
      const st = getHarnessState(game);
      st.field.yokaiSlots[0] = createYokaiTestCard('唐纸伞妖', 2, { instanceId: 'yg_f1' });
      st.field.yokaiSlots[1] = createYokaiTestCard('蝠翼', 3, { instanceId: 'yg_f2' });
      st.field.currentBoss = null;
      const yougu = createYokaiTestCard('幽谷响', 7);
      (game as any).executeYokaiEffect(p0, yougu);
      game.handleYouguXiangSelectResponse(p0.id, [top.instanceId]);
      await new Promise<void>(resolve => setImmediate(resolve));
      const after = getHarnessState(game);
      expect(after.pendingChoice?.type).toBe('yokaiTarget');
      expect((after.pendingChoice as any).sourceCard?.name).toBe('天邪鬼绿');
    });
    });

    describe('yinmoluoSelect + handleYinmoluoSelectResponse（阴摩罗 executeYokaiEffect）', () => {
    it('🟢 阴摩罗：从弃牌区选 2 张 HP<6 的牌后 pending 清除', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2 });
      const player = getHarnessPlayer(game, 0);
      const a = createSpellInstance('基础术式', 1, 'ym_1');
      const b = createSpellInstance('基础术式', 1, 'ym_2');
      player.discard = [a, b];
      const src = createYokaiTestCard('阴摩罗', 7);
      (game as any).executeYokaiEffect(player, src);

      const state = getHarnessState(game);
      expect(state.pendingChoice?.type).toBe('yinmoluoSelect');
      const pc = state.pendingChoice as any;
      expect(pc.selectCount).toBe(2);

      const res = game.handleYinmoluoSelectResponse(player.id, [a.instanceId, b.instanceId]);
      expect(res.success).toBe(true);
      expect(getHarnessState(game).pendingChoice).toBeUndefined();
    });

    it('🟢 阴摩罗：候选不含令牌（招福达摩）', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2 });
      const player = getHarnessPlayer(game, 0);
      const daruma: CardInstance = {
        instanceId: 'dar_1',
        cardId: 'token_daruma',
        cardType: 'token',
        name: '招福达摩',
        hp: 1,
        maxHp: 1,
      };
      const spell = createSpellInstance('基础术式', 1, 'ym_onlyspell');
      player.discard = [daruma, spell];
      const src = createYokaiTestCard('阴摩罗', 7);
      (game as any).executeYokaiEffect(player, src);
      const pc = getHarnessState(game).pendingChoice as any;
      expect(pc.type).toBe('yinmoluoSelect');
      expect(pc.candidates.some((c: any) => c.instanceId === daruma.instanceId)).toBe(false);
      expect(pc.selectCount).toBe(1);
    });
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

    it('🟢 镇墓兽：被限制玩家不能对指定游荡妖怪分配伤害', () => {
      const game = createMultiplayerGameForTest({ playerCount: 2, currentPlayerIndex: 0 });
      const p0 = getHarnessPlayer(game, 0);
      const p1 = getHarnessPlayer(game, 1);
      const y = createYokaiTestCard('天邪鬼绿', 3, { instanceId: 'zms_y_alloc' });
      const st = getHarnessState(game);
      st.field.yokaiSlots[0] = y;
      st.field.currentBoss = null;
      st.turnPhase = 'action';

      const zms = createYokaiTestCard('镇墓兽', 5);
      (game as any).executeYokaiEffect(p0, zms);
      expect(game.handleZhenMuShouTargetResponse(p1.id, y.instanceId).success).toBe(true);

      p0.damage = 5;
      const alloc = (game as any).handleAllocateDamage(p0.id, 0);
      expect(alloc.success).toBe(false);
      expect(alloc.error).toMatch(/镇墓兽/);
    });
  });
});
