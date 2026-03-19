
/**
 * 御魂传说 - 牌库系统测试
 * @file shared/game/DeckManager.test.ts
 * 
 * 运行: npx ts-node shared/game/DeckManager.test.ts
 */

import { DeckManager } from './DeckManager';
import { createStartingDeck } from '../data/loader';
import type { CardInstance } from '../types/cards';

// 简单测试框架
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}`);
    console.error(e);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============ 测试用例 ============

console.log('\n🧪 牌库系统测试\n');

test('创建初始牌库 - 10张牌', () => {
  const deck = createStartingDeck();
  assert(deck.length === 10, `期望10张牌，实际${deck.length}张`);
});

test('DeckManager初始化 - 牌库有10张', () => {
  const startingDeck = createStartingDeck();
  const dm = new DeckManager(startingDeck);
  assert(dm.getDeckSize() === 10, `期望牌库10张，实际${dm.getDeckSize()}张`);
  assert(dm.getHandSize() === 0, `期望手牌0张，实际${dm.getHandSize()}张`);
});

test('抓牌 - 抓5张后手牌=5，牌库=5', () => {
  const dm = new DeckManager(createStartingDeck());
  const drawn = dm.draw(5);
  assert(drawn.length === 5, `期望抓到5张，实际${drawn.length}张`);
  assert(dm.getHandSize() === 5, `期望手牌5张，实际${dm.getHandSize()}张`);
  assert(dm.getDeckSize() === 5, `期望牌库5张，实际${dm.getDeckSize()}张`);
});

test('打出手牌 - 手牌减少，已打出区增加', () => {
  const dm = new DeckManager(createStartingDeck());
  dm.draw(5);
  const hand = dm.getHand();
  const cardId = hand[0]!.instanceId;
  
  const played = dm.playFromHand(cardId);
  assert(played !== null, '打出应该成功');
  assert(dm.getHandSize() === 4, `期望手牌4张，实际${dm.getHandSize()}张`);
  assert(dm.getPlayed().length === 1, `期望已打出1张，实际${dm.getPlayed().length}张`);
});

test('弃置手牌 - 手牌减少，弃牌堆增加', () => {
  const dm = new DeckManager(createStartingDeck());
  dm.draw(5);
  const hand = dm.getHand();
  const cardId = hand[0]!.instanceId;
  
  const discarded = dm.discardFromHand(cardId);
  assert(discarded !== null, '弃置应该成功');
  assert(dm.getHandSize() === 4, `期望手牌4张，实际${dm.getHandSize()}张`);
  assert(dm.getDiscardSize() === 1, `期望弃牌堆1张，实际${dm.getDiscardSize()}张`);
});

test('牌库耗尽 - 自动洗入弃牌堆', () => {
  const dm = new DeckManager(createStartingDeck());
  
  // 抓10张牌（全部抓完）
  dm.draw(10);
  assert(dm.getDeckSize() === 0, '牌库应该空了');
  assert(dm.getHandSize() === 10, '手牌应该有10张');
  
  // 弃置所有手牌
  dm.discardAllHand();
  assert(dm.getDiscardSize() === 10, '弃牌堆应该有10张');
  
  // 再抓5张 - 应该自动洗入
  const drawn = dm.draw(5);
  assert(drawn.length === 5, `应该抓到5张，实际${drawn.length}张`);
  assert(dm.getDeckSize() === 5, `牌库应该有5张，实际${dm.getDeckSize()}张`);
  assert(dm.getDiscardSize() === 0, '弃牌堆应该空了');
});

test('超度卡牌 - 移出游戏', () => {
  const dm = new DeckManager(createStartingDeck());
  dm.draw(5);
  const hand = dm.getHand();
  const cardId = hand[0]!.instanceId;
  
  const exiled = dm.exileFromHand(cardId);
  assert(exiled !== null, '超度应该成功');
  assert(dm.getHandSize() === 4, `期望手牌4张`);
  assert(dm.getExiled().length === 1, `期望超度区1张`);
  assert(dm.getTotalCards() === 9, `总牌数应减少为9张`);
});

test('回合清理 - 弃置并抓新牌', () => {
  const dm = new DeckManager(createStartingDeck());
  dm.draw(5);
  
  // 打出2张
  const hand = dm.getHand();
  dm.playFromHand(hand[0]!.instanceId);
  dm.playFromHand(hand[1]!.instanceId);
  
  // 清理回合
  const newHand = dm.cleanupTurn(5);
  
  assert(newHand.length === 5, `新手牌应该5张`);
  assert(dm.getPlayed().length === 0, '已打出区应该清空');
  assert(dm.getHandSize() === 5, '手牌应该5张');
});

test('获得卡牌 - 加入弃牌堆', () => {
  const dm = new DeckManager(createStartingDeck());
  
  const newCard: CardInstance = {
    instanceId: 'test_card_001',
    cardId: 'yokai_001',
    cardType: 'yokai',
    name: '测试妖怪',
    hp: 3,
    maxHp: 3,
    armor: 0,
    image: 'test.png'
  };
  
  dm.gainCard(newCard);
  assert(dm.getDiscardSize() === 1, '弃牌堆应该有1张');
  assert(dm.getTotalCards() === 11, '总牌数应该11张');
});

console.log('\n🎉 所有测试完成！\n');
