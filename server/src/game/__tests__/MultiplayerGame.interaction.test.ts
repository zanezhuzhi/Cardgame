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
});
