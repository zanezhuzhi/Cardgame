/**
 * 御魂传说 - 牌库系统测试
 * @file shared/game/DeckManager.test.ts
 * 
 * 运行: npm test
 * 监听: npm run test:watch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeckManager } from './DeckManager';
import { createStartingDeck } from '../data/loader';
import type { CardInstance } from '../types/cards';

describe('DeckManager 牌库管理器', () => {
  
  describe('初始化', () => {
    it('创建初始牌库应有10张牌（6基础+4达摩）', () => {
      const deck = createStartingDeck();
      expect(deck.length).toBe(10);
    });

    it('DeckManager初始化后牌库有10张，手牌0张', () => {
      const dm = new DeckManager(createStartingDeck());
      expect(dm.getDeckSize()).toBe(10);
      expect(dm.getHandSize()).toBe(0);
    });
  });

  describe('抓牌', () => {
    it('抓5张后手牌=5，牌库=5', () => {
      const dm = new DeckManager(createStartingDeck());
      const drawn = dm.draw(5);
      
      expect(drawn.length).toBe(5);
      expect(dm.getHandSize()).toBe(5);
      expect(dm.getDeckSize()).toBe(5);
    });

    it('牌库不足时自动洗入弃牌堆', () => {
      const dm = new DeckManager(createStartingDeck());
      
      // 抓10张牌（全部抓完）
      dm.draw(10);
      expect(dm.getDeckSize()).toBe(0);
      expect(dm.getHandSize()).toBe(10);
      
      // 弃置所有手牌
      dm.discardAllHand();
      expect(dm.getDiscardSize()).toBe(10);
      
      // 再抓5张 - 应该自动洗入
      const drawn = dm.draw(5);
      expect(drawn.length).toBe(5);
      expect(dm.getDeckSize()).toBe(5);
      expect(dm.getDiscardSize()).toBe(0);
    });
  });

  describe('打牌', () => {
    it('打出手牌后手牌减少，已打出区增加', () => {
      const dm = new DeckManager(createStartingDeck());
      dm.draw(5);
      const hand = dm.getHand();
      const cardId = hand[0]!.instanceId;
      
      const played = dm.playFromHand(cardId);
      
      expect(played).not.toBeNull();
      expect(dm.getHandSize()).toBe(4);
      expect(dm.getPlayed().length).toBe(1);
    });
  });

  describe('弃牌', () => {
    it('弃置手牌后手牌减少，弃牌堆增加', () => {
      const dm = new DeckManager(createStartingDeck());
      dm.draw(5);
      const hand = dm.getHand();
      const cardId = hand[0]!.instanceId;
      
      const discarded = dm.discardFromHand(cardId);
      
      expect(discarded).not.toBeNull();
      expect(dm.getHandSize()).toBe(4);
      expect(dm.getDiscardSize()).toBe(1);
    });
  });

  describe('超度', () => {
    it('超度卡牌后移出游戏，总牌数减少', () => {
      const dm = new DeckManager(createStartingDeck());
      dm.draw(5);
      const hand = dm.getHand();
      const cardId = hand[0]!.instanceId;
      
      const exiled = dm.exileFromHand(cardId);
      
      expect(exiled).not.toBeNull();
      expect(dm.getHandSize()).toBe(4);
      expect(dm.getExiled().length).toBe(1);
      expect(dm.getTotalCards()).toBe(9);
    });
  });

  describe('🟢 牌库循环机制', () => {
    it('【要点1】本回合退治的牌进入discard，deck耗尽时可被抓到', () => {
      // 模拟 deck 已空，discard 里只有退治的妖怪
      const dm = new DeckManager([]);
      const yokaiCard: CardInstance = {
        instanceId: 'yokai_01', cardId: 'yokai_001', cardType: 'yokai',
        name: '退治的妖怪', hp: 2, maxHp: 2, charm: 1, image: ''
      };
      // 妖怪退治后进入弃牌堆
      dm.gainCard(yokaiCard);
      expect(dm.getDiscardSize()).toBe(1);
      expect(dm.getDeckSize()).toBe(0);

      // 触发抓牌 → deck 空 → 自动洗入 discard → 抓到
      const drawn = dm.draw(1);
      expect(drawn.length).toBe(1);
      expect(drawn[0]!.instanceId).toBe('yokai_01');
    });

    it('【要点2】本回合已打出的牌不参与洗牌循环', () => {
      const dm = new DeckManager(createStartingDeck());
      dm.draw(5);

      // 打出第一张牌（进入 played 区）
      const hand = dm.getHand();
      const playedCard = dm.playFromHand(hand[0]!.instanceId);
      expect(playedCard).not.toBeNull();
      expect(dm.getPlayed().length).toBe(1);

      // 把剩余 deck 全部抓完，触发洗牌（只洗 discard，不含 played）
      dm.draw(10); // 抓超量，耗尽 deck

      // played 里的牌不应该出现在手牌中
      const handIds = dm.getHand().map(c => c.instanceId);
      expect(handIds).not.toContain(playedCard!.instanceId);
    });
  });

  describe('🟢 回合清理', () => {
    it('清理回合后弃置已打出和手牌，抓5张新牌', () => {
      const dm = new DeckManager(createStartingDeck());
      dm.draw(5);
      
      // 打出2张
      const hand = dm.getHand();
      dm.playFromHand(hand[0]!.instanceId);
      dm.playFromHand(hand[1]!.instanceId);
      
      // 清理回合
      const newHand = dm.cleanupTurn(5);
      
      expect(newHand.length).toBe(5);
      expect(dm.getPlayed().length).toBe(0);
      expect(dm.getHandSize()).toBe(5);
    });
  });

  describe('获得卡牌', () => {
    it('获得卡牌后加入弃牌堆', () => {
      const dm = new DeckManager(createStartingDeck());
      
      const newCard: CardInstance = {
        instanceId: 'test_card_001',
        cardId: 'yokai_001',
        cardType: 'yokai',
        name: '测试妖怪',
        hp: 3,
        maxHp: 3,
        image: 'test.png'
      };
      
      dm.gainCard(newCard);
      
      expect(dm.getDiscardSize()).toBe(1);
      expect(dm.getTotalCards()).toBe(11);
    });
  });
});

console.log('\n🎉 所有测试完成！\n');