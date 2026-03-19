
/**
 * 御魂传说 - 牌库管理器
 * @file shared/game/DeckManager.ts
 */

import type { CardInstance } from '../types/cards';
import { shuffle } from '../data/loader';

/**
 * 牌库管理器 - 管理单个玩家的牌库操作
 */
export class DeckManager {
  private deck: CardInstance[] = [];
  private hand: CardInstance[] = [];
  private discard: CardInstance[] = [];
  private played: CardInstance[] = [];
  private exiled: CardInstance[] = [];

  constructor(initialDeck: CardInstance[] = []) {
    this.deck = shuffle([...initialDeck]);
  }

  // ============ 状态访问 ============

  getDeck(): CardInstance[] {
    return [...this.deck];
  }

  getHand(): CardInstance[] {
    return [...this.hand];
  }

  getDiscard(): CardInstance[] {
    return [...this.discard];
  }

  getPlayed(): CardInstance[] {
    return [...this.played];
  }

  getExiled(): CardInstance[] {
    return [...this.exiled];
  }

  getDeckSize(): number {
    return this.deck.length;
  }

  getHandSize(): number {
    return this.hand.length;
  }

  getDiscardSize(): number {
    return this.discard.length;
  }

  getTotalCards(): number {
    return this.deck.length + this.hand.length + this.discard.length + this.played.length;
  }

  // ============ 牌库操作 ============

  /**
   * 抓牌
   * @param count 抓牌数量
   * @returns 实际抓到的牌
   */
  draw(count: number): CardInstance[] {
    const drawn: CardInstance[] = [];

    for (let i = 0; i < count; i++) {
      // 牌库空了，洗入弃牌堆
      if (this.deck.length === 0) {
        if (this.discard.length === 0) {
          break; // 没有牌可抓
        }
        this.reshuffleDiscard();
      }

      const card = this.deck.pop();
      if (card) {
        this.hand.push(card);
        drawn.push(card);
      }
    }

    return drawn;
  }

  /**
   * 将弃牌堆洗入牌库
   */
  reshuffleDiscard(): void {
    this.deck = shuffle([...this.discard]);
    this.discard = [];
  }

  /**
   * 打出手牌
   * @param cardInstanceId 卡牌实例ID
   * @returns 打出的牌，失败返回null
   */
  playFromHand(cardInstanceId: string): CardInstance | null {
    const index = this.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return null;

    const card = this.hand.splice(index, 1)[0]!;
    this.played.push(card);
    return card;
  }

  /**
   * 弃置手牌
   * @param cardInstanceId 卡牌实例ID
   * @returns 是否成功
   */
  discardFromHand(cardInstanceId: string): CardInstance | null {
    const index = this.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return null;

    const card = this.hand.splice(index, 1)[0]!;
    this.discard.push(card);
    return card;
  }

  /**
   * 弃置所有手牌
   */
  discardAllHand(): CardInstance[] {
    const cards = [...this.hand];
    this.discard.push(...this.hand);
    this.hand = [];
    return cards;
  }

  /**
   * 将已打出的牌移入弃牌堆（回合结束时）
   */
  discardPlayed(): CardInstance[] {
    const cards = [...this.played];
    this.discard.push(...this.played);
    this.played = [];
    return cards;
  }

  /**
   * 超度卡牌（从手牌）
   * @param cardInstanceId 卡牌实例ID
   * @returns 超度的牌，失败返回null
   */
  exileFromHand(cardInstanceId: string): CardInstance | null {
    const index = this.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return null;

    const card = this.hand.splice(index, 1)[0]!;
    this.exiled.push(card);
    return card;
  }

  /**
   * 超度卡牌（从已打出区）
   */
  exileFromPlayed(cardInstanceId: string): CardInstance | null {
    const index = this.played.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return null;

    const card = this.played.splice(index, 1)[0]!;
    this.exiled.push(card);
    return card;
  }

  /**
   * 获得一张牌（加入弃牌堆）
   */
  gainCard(card: CardInstance): void {
    this.discard.push(card);
  }

  /**
   * 获得一张牌到手牌
   */
  gainToHand(card: CardInstance): void {
    this.hand.push(card);
  }

  /**
   * 将牌放到牌库顶
   */
  putOnTop(card: CardInstance): void {
    this.deck.push(card);
  }

  /**
   * 将牌放到牌库底
   */
  putOnBottom(card: CardInstance): void {
    this.deck.unshift(card);
  }

  /**
   * 查看牌库顶N张牌（不移除）
   */
  peekTop(count: number): CardInstance[] {
    return this.deck.slice(-count).reverse();
  }

  /**
   * 从牌库顶展示并移除
   */
  revealTop(count: number): CardInstance[] {
    const revealed: CardInstance[] = [];
    for (let i = 0; i < count && this.deck.length > 0; i++) {
      const card = this.deck.pop();
      if (card) revealed.push(card);
    }
    return revealed;
  }

  /**
   * 洗牌（当前牌库）
   */
  shuffleDeck(): void {
    this.deck = shuffle(this.deck);
  }

  /**
   * 清理回合（弃置手牌和已打出的牌，抓新手牌）
   */
  cleanupTurn(handSize: number): CardInstance[] {
    this.discardAllHand();
    this.discardPlayed();
    return this.draw(handSize);
  }

  // ============ 查找 ============

  /**
   * 在手牌中查找
   */
  findInHand(predicate: (card: CardInstance) => boolean): CardInstance | undefined {
    return this.hand.find(predicate);
  }

  /**
   * 在手牌中过滤
   */
  filterHand(predicate: (card: CardInstance) => boolean): CardInstance[] {
    return this.hand.filter(predicate);
  }

  /**
   * 按ID查找手牌
   */
  getHandCardById(instanceId: string): CardInstance | undefined {
    return this.hand.find(c => c.instanceId === instanceId);
  }

  // ============ 统计 ============

  /**
   * 计算所有卡的符咒总值
   */
  calculateTotalCharm(): number {
    const allCards = [...this.deck, ...this.hand, ...this.discard, ...this.played];
    return allCards.reduce((sum, card) => sum + (card.charm || 0), 0);
  }

  /**
   * 计算手牌总生命值（咒力）
   */
  calculateHandPower(): number {
    return this.hand.reduce((sum, card) => sum + card.hp, 0);
  }

  // ============ 状态导出/导入 ============

  /**
   * 导出状态
   */
  exportState() {
    return {
      deck: [...this.deck],
      hand: [...this.hand],
      discard: [...this.discard],
      played: [...this.played],
      exiled: [...this.exiled]
    };
  }

  /**
   * 导入状态
   */
  importState(state: {
    deck: CardInstance[];
    hand: CardInstance[];
    discard: CardInstance[];
    played: CardInstance[];
    exiled: CardInstance[];
  }): void {
    this.deck = [...state.deck];
    this.hand = [...state.hand];
    this.discard = [...state.discard];
    this.played = [...state.played];
    this.exiled = [...state.exiled];
  }
}
