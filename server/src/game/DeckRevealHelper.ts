/**
 * 牌库展示状态管理器
 * @file server/src/game/DeckRevealHelper.ts
 * @description 独立模块，管理牌库展示状态，解耦于 MultiplayerGame
 */

import type { PlayerState, RevealedCard, CardInstance } from '../types/index';

/**
 * 牌库展示工具类
 * 负责管理 revealedDeckCards 状态的增删改查
 */
export class DeckRevealHelper {
  
  /**
   * 展示牌库顶牌
   * 约定：牌库顶 = 数组头部(索引0)，抽牌用shift()，置顶用unshift()
   * @param targetPlayer 被查看的玩家
   * @param revealedByPlayerId 触发展示的玩家ID
   * @returns 展示的卡牌（如果存在）
   */
  static revealTopCard(
    targetPlayer: PlayerState,
    revealedByPlayerId: string
  ): CardInstance | null {
    if (targetPlayer.deck.length === 0) return null;
    
    const topCard = targetPlayer.deck[0]; // 牌库顶 = 数组头部
    this.addRevealedCard(targetPlayer, topCard.instanceId, 'top', revealedByPlayerId);
    
    return topCard;
  }
  
  /**
   * 展示牌库底牌
   * @param targetPlayer 被查看的玩家
   * @param revealedByPlayerId 触发展示的玩家ID
   * @returns 展示的卡牌（如果存在）
   */
  static revealBottomCard(
    targetPlayer: PlayerState,
    revealedByPlayerId: string
  ): CardInstance | null {
    if (targetPlayer.deck.length === 0) return null;
    
    const bottomCard = targetPlayer.deck[targetPlayer.deck.length - 1];
    this.addRevealedCard(targetPlayer, bottomCard.instanceId, 'bottom', revealedByPlayerId);
    
    return bottomCard;
  }
  
  /**
   * 展示牌库指定位置的牌
   * @param targetPlayer 被查看的玩家
   * @param index 牌库索引（0=顶）
   * @param revealedByPlayerId 触发展示的玩家ID
   * @returns 展示的卡牌（如果存在）
   */
  static revealCardAtIndex(
    targetPlayer: PlayerState,
    index: number,
    revealedByPlayerId: string
  ): CardInstance | null {
    if (index < 0 || index >= targetPlayer.deck.length) return null;
    
    const card = targetPlayer.deck[index];
    const position = index === 0 ? 'top' : (index === targetPlayer.deck.length - 1 ? 'bottom' : index);
    this.addRevealedCard(targetPlayer, card.instanceId, position, revealedByPlayerId);
    
    return card;
  }
  
  /**
   * 添加展示记录
   */
  private static addRevealedCard(
    player: PlayerState,
    instanceId: string,
    position: 'top' | 'bottom' | number,
    revealedBy: string
  ): void {
    if (!player.revealedDeckCards) {
      player.revealedDeckCards = [];
    }
    
    // 避免重复添加相同卡牌
    const existing = player.revealedDeckCards.find(r => r.instanceId === instanceId);
    if (existing) {
      // 更新位置和时间
      existing.position = position;
      existing.revealedAt = Date.now();
      existing.revealedBy = revealedBy;
      return;
    }
    
    player.revealedDeckCards.push({
      instanceId,
      position,
      revealedBy,
      revealedAt: Date.now(),
    });
  }
  
  /**
   * 当卡牌离开牌库时，移除展示状态
   * @param player 玩家
   * @param instanceId 卡牌实例ID
   */
  static removeRevealedCard(player: PlayerState, instanceId: string): void {
    if (!player.revealedDeckCards) return;
    player.revealedDeckCards = player.revealedDeckCards.filter(r => r.instanceId !== instanceId);
  }
  
  /**
   * 清除玩家所有展示状态
   * @param player 玩家
   */
  static clearAllRevealed(player: PlayerState): void {
    player.revealedDeckCards = [];
  }
  
  /**
   * 获取玩家已展示的牌库卡牌
   * @param player 玩家
   * @returns 已展示的卡牌实例数组
   */
  static getRevealedCards(player: PlayerState): CardInstance[] {
    if (!player.revealedDeckCards || player.revealedDeckCards.length === 0) {
      return [];
    }
    
    const revealedIds = new Set(player.revealedDeckCards.map(r => r.instanceId));
    return player.deck.filter(card => revealedIds.has(card.instanceId));
  }
  
  /**
   * 检查某张牌是否已展示
   * @param player 玩家
   * @param instanceId 卡牌实例ID
   * @returns 是否已展示
   */
  static isCardRevealed(player: PlayerState, instanceId: string): boolean {
    if (!player.revealedDeckCards) return false;
    return player.revealedDeckCards.some(r => r.instanceId === instanceId);
  }
  
  /**
   * 获取展示信息
   * @param player 玩家
   * @param instanceId 卡牌实例ID
   * @returns 展示信息（如果存在）
   */
  static getRevealInfo(player: PlayerState, instanceId: string): RevealedCard | undefined {
    if (!player.revealedDeckCards) return undefined;
    return player.revealedDeckCards.find(r => r.instanceId === instanceId);
  }
  
  /**
   * 检查玩家是否可以查看某张已展示的牌
   * 规则：只有触发者和牌库拥有者可以看到
   * @param revealedCard 展示信息
   * @param viewerPlayerId 查看者ID
   * @param ownerPlayerId 牌库拥有者ID
   * @returns 是否可见
   */
  static canViewRevealedCard(
    revealedCard: RevealedCard,
    viewerPlayerId: string,
    ownerPlayerId: string
  ): boolean {
    return viewerPlayerId === revealedCard.revealedBy || viewerPlayerId === ownerPlayerId;
  }
}
