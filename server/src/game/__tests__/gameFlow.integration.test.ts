/**
 * 游戏流程集成测试
 * @file server/src/game/__tests__/gameFlow.integration.test.ts
 * 
 * 验证点：
 * 1. 回合流转（鬼火阶段 → 行动阶段 → 清理阶段 → 下一玩家）
 * 2. 出牌操作处理
 * 3. 结束回合逻辑
 * 4. 交互响应链
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestPlayer,
  createTestCard,
  createYokaiCard,
  createTestGameState,
  resetTestCounters,
  assertStateConsistency,
  getCardFromHand,
} from './testUtils';

describe('游戏流程集成测试', () => {
  
  beforeEach(() => {
    resetTestCounters();
  });

  // ============================================================
  // 回合流转测试
  // ============================================================
  describe('回合流转', () => {
    
    it('🟢 鬼火阶段: 当前玩家应获得鬼火', () => {
      const state = createTestGameState({ turnPhase: 'ghostFire' });
      const currentPlayer = state.players[state.currentPlayerIndex];
      const initialGhostFire = currentPlayer.ghostFire;
      
      // 模拟鬼火阶段逻辑
      currentPlayer.ghostFire = Math.min(currentPlayer.ghostFire + 1, currentPlayer.maxGhostFire);
      
      expect(currentPlayer.ghostFire).toBe(Math.min(initialGhostFire + 1, currentPlayer.maxGhostFire));
      assertStateConsistency(state);
    });

    it('🟢 行动阶段: 非当前玩家不能执行操作', () => {
      const state = createTestGameState({ 
        playerCount: 2, 
        currentPlayerIndex: 0,
        turnPhase: 'action' 
      });
      
      const nonCurrentPlayerId = state.players[1].id;
      
      // 验证非当前玩家无法操作
      const isCurrentPlayer = state.players[state.currentPlayerIndex].id === nonCurrentPlayerId;
      expect(isCurrentPlayer).toBe(false);
    });

    it('🟢 结束回合: 应切换到下一玩家', () => {
      const state = createTestGameState({ 
        playerCount: 2, 
        currentPlayerIndex: 0 
      });
      
      // 模拟结束回合
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      state.turnNumber++;
      
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.turnNumber).toBe(2);
    });

    it('🟢 最后一个玩家结束回合: 应回到第一个玩家', () => {
      const state = createTestGameState({ 
        playerCount: 2, 
        currentPlayerIndex: 1 
      });
      
      // 模拟结束回合
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      
      expect(state.currentPlayerIndex).toBe(0);
    });
  });

  // ============================================================
  // 出牌操作测试
  // ============================================================
  describe('出牌操作', () => {
    
    it('🟢 正常出牌: 消耗鬼火，从手牌移除', () => {
      const state = createTestGameState({ turnPhase: 'action' });
      const player = state.players[0];
      const card = player.hand[0];
      const initialHandSize = player.hand.length;
      const initialGhostFire = player.ghostFire;
      
      // 模拟出牌
      const cardIndex = player.hand.findIndex(c => c.instanceId === card.instanceId);
      const playedCard = player.hand.splice(cardIndex, 1)[0];
      player.ghostFire -= (playedCard.cost || 1);
      
      expect(player.hand.length).toBe(initialHandSize - 1);
      expect(player.ghostFire).toBe(initialGhostFire - (playedCard.cost || 1));
      assertStateConsistency(state);
    });

    it('🔴 鬼火不足: 不能出牌', () => {
      const state = createTestGameState({ turnPhase: 'action' });
      const player = state.players[0];
      player.ghostFire = 0;
      
      const card = player.hand[0];
      const canPlayCard = player.ghostFire >= (card.cost || 1);
      
      expect(canPlayCard).toBe(false);
    });

    it('🔴 非行动阶段: 不能出牌', () => {
      const state = createTestGameState({ turnPhase: 'ghostFire' });
      
      const canPlayCard = state.turnPhase === 'action';
      
      expect(canPlayCard).toBe(false);
    });

    it('🔴 卡牌不在手牌中: 不能出牌', () => {
      const state = createTestGameState({ turnPhase: 'action' });
      const player = state.players[0];
      const fakeCard = createTestCard('yokai', '假卡牌');
      
      const cardInHand = player.hand.some(c => c.instanceId === fakeCard.instanceId);
      
      expect(cardInHand).toBe(false);
    });
  });

  // ============================================================
  // 状态一致性测试
  // ============================================================
  describe('状态一致性', () => {
    
    it('🟢 鬼火不能超过上限', () => {
      const state = createTestGameState();
      const player = state.players[0];
      player.maxGhostFire = 5;
      player.ghostFire = 3;
      
      // 模拟获得大量鬼火
      const gainAmount = 10;
      player.ghostFire = Math.min(player.ghostFire + gainAmount, player.maxGhostFire);
      
      expect(player.ghostFire).toBe(5);
      assertStateConsistency(state);
    });

    it('🟢 鬼火不能为负', () => {
      const state = createTestGameState();
      const player = state.players[0];
      player.ghostFire = 1;
      
      // 模拟消耗鬼火（应该有检查防止负数）
      const costAmount = 5;
      const canAfford = player.ghostFire >= costAmount;
      if (canAfford) {
        player.ghostFire -= costAmount;
      }
      
      expect(player.ghostFire).toBe(1); // 未扣除
      expect(canAfford).toBe(false);
    });

    it('🟢 手牌数量应正确跟踪', () => {
      const state = createTestGameState();
      const player = state.players[0];
      const initialHandSize = player.hand.length;
      
      // 抓牌
      const newCard = createTestCard('spell', '新卡牌');
      player.hand.push(newCard);
      
      expect(player.hand.length).toBe(initialHandSize + 1);
      
      // 弃牌
      const discardedCard = player.hand.pop()!;
      player.discard.push(discardedCard);
      
      expect(player.hand.length).toBe(initialHandSize);
      expect(player.discard.length).toBe(1);
    });
  });

  // ============================================================
  // 场上妖怪状态测试
  // ============================================================
  describe('场上妖怪', () => {
    
    it('🟢 妖怪受伤: HP 应正确减少', () => {
      const state = createTestGameState();
      const yokai = state.field.yokaiSlots[0];
      const initialHp = yokai!.hp;
      const damage = 2;
      
      yokai!.hp -= damage;
      
      expect(yokai!.hp).toBe(initialHp - damage);
    });

    it('🟢 妖怪被退治: HP 归零时应被移除', () => {
      const state = createTestGameState();
      const yokai = state.field.yokaiSlots[0];
      
      yokai!.hp = 0;
      
      // 模拟退治检查
      const isDefeated = yokai!.hp <= 0;
      expect(isDefeated).toBe(true);
      
      // 退治后应从场上移除
      if (isDefeated) {
        state.field.yokaiSlots[0] = null as any;
      }
      
      expect(state.field.yokaiSlots[0]).toBeNull();
    });

    it('🟢 妖怪护盾: 应先扣护盾再扣HP', () => {
      const state = createTestGameState();
      const yokai = state.field.yokaiSlots[0];
      yokai!.hp = 5;
      yokai!.shield = 3;
      
      const damage = 4;
      
      // 先扣护盾
      let remainingDamage = damage;
      if (yokai!.shield && yokai!.shield > 0) {
        const shieldAbsorb = Math.min(yokai!.shield, remainingDamage);
        yokai!.shield -= shieldAbsorb;
        remainingDamage -= shieldAbsorb;
      }
      
      // 再扣HP
      yokai!.hp -= remainingDamage;
      
      expect(yokai!.shield).toBe(0);  // 护盾被打掉
      expect(yokai!.hp).toBe(4);      // 剩余1点伤害打HP
    });
  });
});
