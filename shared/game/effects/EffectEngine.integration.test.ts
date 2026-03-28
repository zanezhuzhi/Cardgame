/**
 * 效果引擎集成测试 - 验证式神技能和御魂效果
 * @file shared/game/effects/EffectEngine.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { effectEngine } from './EffectEngine';
import { YOKAI_EFFECT_DEFS } from './YokaiEffects';
import { SHIKIGAMI_EFFECT_DEFS } from './ShikigamiEffects';
import type { EffectContext, CardEffect } from './types';
import type { PlayerState, GameState, FieldState } from '../../types/game';
import type { CardInstance, BossCard } from '../../types/cards';

// ============ 测试工具 ============

function createMockPlayer(): PlayerState {
  return {
    id: 'player_1',
    name: 'Test Player',
    onmyoji: null,
    shikigami: [],
    maxShikigami: 3,
    ghostFire: 3,
    maxGhostFire: 5,
    damage: 0,
    hand: [],
    deck: [],
    discard: [],
    played: [],
    exiled: [],
    totalCharm: 0,
    cardsPlayed: 0,
    isConnected: true,
    isReady: true,
    shikigamiState: [{ cardId: 'test', isExhausted: false, markers: {} }],
    tempBuffs: [],
  };
}

function createMockGameState(player: PlayerState): GameState {
  return {
    roomId: 'test',
    phase: 'playing',
    players: [player],
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnPhase: 'action',
    field: {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossCurrentHp: 0,
      bossDeck: [],
      spellSupply: { basic: null, medium: null, advanced: null },
      spellCounts: { basic: 50, medium: 20, advanced: 10 },
      tokenShop: 18,
      penaltyPile: [],
      yokaiDeck: [],
      exileZone: [],
    } as FieldState,
    log: [],
    lastUpdate: Date.now(),
  };
}

function createMockContext(player: PlayerState, gameState: GameState): EffectContext {
  return {
    player,
    gameState,
    onChoice: async (options) => 0,
    onSelectTarget: async (candidates) => candidates[0]?.instanceId ?? '',
    onSelectCards: async (candidates, count) => candidates.slice(0, count).map(c => c.instanceId),
  };
}

function createCardInstance(id: string, name: string, hp: number, type: 'spell' | 'yokai' = 'yokai'): CardInstance {
  return {
    instanceId: `inst_${id}_${Date.now()}`,
    cardId: id,
    name,
    cardType: type,
    hp,
    maxHp: hp,
    charm: 1,
  };
}

// ============ 测试套件 ============

describe('效果引擎集成测试', () => {

  describe('🎴 御魂效果执行', () => {

    it('天邪鬼绿：直接退治生命≤4的妖怪', async () => {
      const player = createMockPlayer();
      const gameState = createMockGameState(player);
      
      // 在场上放一个生命3的妖怪
      const yokai = createCardInstance('yokai_test', '测试妖怪', 3);
      gameState.field.yokaiSlots[0] = yokai;

      const effectDef = YOKAI_EFFECT_DEFS.find(d => d.cardId === 'yokai_003');
      expect(effectDef).toBeDefined();
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx);
      
      // 妖怪应该被退治（进入弃牌堆）
      expect(gameState.field.yokaiSlots[0]).toBeNull();
      expect(player.discard.length).toBe(1);
      expect(player.discard[0]!.name).toBe('测试妖怪');
    });

    it('鸣屋：弃牌堆空时伤害+4，否则+2', async () => {
      const player = createMockPlayer();
      const gameState = createMockGameState(player);
      
      const effectDef = YOKAI_EFFECT_DEFS.find(d => d.cardId === 'yokai_012');
      expect(effectDef).toBeDefined();
      
      // 弃牌堆为空时
      const ctx1 = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx1);
      expect(player.damage).toBe(4);
      
      // 重置并添加弃牌
      player.damage = 0;
      player.discard.push(createCardInstance('test', '测试卡', 1));
      
      const ctx2 = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx2);
      expect(player.damage).toBe(2);
    });

    it('日女巳时：三选一（鬼火+1/抓牌+2/伤害+2）', async () => {
      const player = createMockPlayer();
      player.deck.push(
        createCardInstance('c1', '卡1', 1),
        createCardInstance('c2', '卡2', 1),
        createCardInstance('c3', '卡3', 1),
      );
      const gameState = createMockGameState(player);
      
      const effectDef = YOKAI_EFFECT_DEFS.find(d => d.cardId === 'yokai_011');
      expect(effectDef).toBeDefined();
      
      // 选择抓牌+2（选项1：鬼火+1/抓牌+2/伤害+2）
      const ctx = createMockContext(player, gameState);
      ctx.onChoice = async () => 1;
      
      await effectEngine.execute(effectDef!.effects, ctx);
      expect(player.hand.length).toBe(2);
    });

    it('镇墓兽：抓牌+1，伤害+2，鬼火+1', async () => {
      const player = createMockPlayer();
      player.deck.push(createCardInstance('c1', '卡1', 1));
      const gameState = createMockGameState(player);
      
      const effectDef = YOKAI_EFFECT_DEFS.find(d => d.cardId === 'yokai_025');
      expect(effectDef).toBeDefined();
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx);
      
      expect(player.hand.length).toBe(1);
      expect(player.damage).toBe(2);
      expect(player.ghostFire).toBe(4); // 原3 + 鬼火+1
    });

  });

  describe('🦊 式神技能效果', () => {

    it('酒吞童子：储酒技能放置酒气指示物', async () => {
      const player = createMockPlayer();
      player.hand.push(createCardInstance('c1', '卡1', 1));
      const gameState = createMockGameState(player);
      
      const effectDef = SHIKIGAMI_EFFECT_DEFS.find(
        d => d.cardId === 'shikigami_003' && d.skillName === '酒葫芦·储酒'
      );
      expect(effectDef).toBeDefined();
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx);
      
      // 手牌超度
      expect(player.hand.length).toBe(0);
      expect(player.exiled.length).toBe(1);
      
      // 酒气指示物增加
      expect(player.shikigamiState[0]!.markers['sake']).toBe(1);
    });

    it('百目鬼：妨害所有玩家弃牌，自己抓牌', async () => {
      const player = createMockPlayer();
      player.deck.push(createCardInstance('c1', '卡1', 1));
      
      const opponent = createMockPlayer();
      opponent.id = 'player_2';
      opponent.hand.push(createCardInstance('c2', '对手卡', 1));
      
      const gameState = createMockGameState(player);
      gameState.players.push(opponent);
      
      const effectDef = SHIKIGAMI_EFFECT_DEFS.find(
        d => d.cardId === 'shikigami_008' && d.skillName === '诅咒之眼'
      );
      expect(effectDef).toBeDefined();
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx);
      
      // 所有玩家弃牌（包括对手）
      // 注：INTERFERE target=ALL_PLAYERS 会对所有人执行
      // 然后玩家自己抓牌+1
      expect(player.hand.length).toBe(1);
    });

    it('食梦貘：抓牌+4并标记跳过清理阶段', async () => {
      const player = createMockPlayer();
      for (let i = 0; i < 4; i++) {
        player.deck.push(createCardInstance(`c${i}`, `卡${i}`, 1));
      }
      const gameState = createMockGameState(player);
      
      const effectDef = SHIKIGAMI_EFFECT_DEFS.find(
        d => d.cardId === 'shikigami_013' && d.skillName === '沉睡·入眠'
      );
      expect(effectDef).toBeDefined();
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effectDef!.effects, ctx);
      
      // 抓4张牌
      expect(player.hand.length).toBe(4);
      
      // 沉睡标记
      expect(player.shikigamiState[0]!.markers['sleep']).toBe(1);
      
      // 跳过清理阶段buff
      expect(player.tempBuffs.some(b => b.type === 'SKIP_CLEANUP')).toBe(true);
    });

  });

  describe('🔥 TempBuff效果', () => {

    it('TEMP_BUFF：添加临时增益', async () => {
      const player = createMockPlayer();
      const gameState = createMockGameState(player);
      
      const effects: CardEffect[] = [
        { type: 'TEMP_BUFF', buffType: 'SPELL_DAMAGE_BONUS', value: 1 }
      ];
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effects, ctx);
      
      expect(player.tempBuffs.length).toBe(1);
      expect(player.tempBuffs[0]!.type).toBe('SPELL_DAMAGE_BONUS');
    });

    it('REDUCE_HP：减少场上妖怪生命', async () => {
      const player = createMockPlayer();
      const gameState = createMockGameState(player);
      
      // 放置妖怪
      gameState.field.yokaiSlots[0] = createCardInstance('y1', '妖怪1', 5);
      gameState.field.yokaiSlots[1] = createCardInstance('y2', '妖怪2', 3);
      
      const effects: CardEffect[] = [
        { type: 'REDUCE_HP', target: 'YOKAI', value: 1 }
      ];
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effects, ctx);
      
      expect(gameState.field.yokaiSlots[0]!.hp).toBe(4);
      expect(gameState.field.yokaiSlots[1]!.hp).toBe(2);
    });

    it('RECOVER_FROM_DISCARD：从弃牌堆回收阴阳术', async () => {
      const player = createMockPlayer();
      player.discard.push(
        createCardInstance('s1', '基础术式', 1, 'spell'),
        createCardInstance('y1', '妖怪', 2, 'yokai'),
        createCardInstance('s2', '中级符咒', 2, 'spell'),
      );
      const gameState = createMockGameState(player);
      
      const effects: CardEffect[] = [
        { type: 'RECOVER_FROM_DISCARD', cardType: 'spell', count: 2 }
      ];
      
      const ctx = createMockContext(player, gameState);
      await effectEngine.execute(effects, ctx);
      
      // 回收2张阴阳术
      expect(player.hand.length).toBe(2);
      expect(player.hand.every(c => c.cardType === 'spell')).toBe(true);
      
      // 弃牌堆只剩妖怪
      expect(player.discard.length).toBe(1);
      expect(player.discard[0]!.cardType).toBe('yokai');
    });

  });

});
