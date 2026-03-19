
/**
 * 御魂传说 - 单人游戏控制器
 * @file client/src/game/SinglePlayerGame.ts
 */

import type {
  GameState,
  PlayerState,
  FieldState,
  TurnPhase
} from '../../../shared/types/game';

import type {
  CardInstance,
  OnmyojiCard,
  ShikigamiCard,
  BossCard,
  YokaiCard,
  GhostFireCard,
  TokenCard
} from '../../../shared/types/cards';

// 导入卡牌数据（直接从JSON）
import cardsData from '../../../shared/data/cards.json';

// ============ 工具函数 ============

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============ 单人游戏控制器 ============

export class SinglePlayerGame {
  private state: GameState;
  private onStateChange: (state: GameState) => void;

  constructor(playerName: string, onStateChange: (state: GameState) => void) {
    this.onStateChange = onStateChange;
    this.state = this.createInitialState(playerName);
  }

  // ============ 初始化 ============

  private createInitialState(playerName: string): GameState {
    const player = this.createPlayer('player_1', playerName);
    const field = this.createField();

    return {
      roomId: 'single_player',
      phase: 'setup',
      players: [player],
      currentPlayerIndex: 0,
      turnNumber: 0,
      turnPhase: 'start',
      field,
      log: [],
      lastUpdate: Date.now()
    };
  }

  private createPlayer(id: string, name: string): PlayerState {
    // 创建初始牌库：7张灯笼鬼 + 3张招福达摩
    const deck: CardInstance[] = [];
    
    // 灯笼鬼
    const ghostFire = cardsData.ghostFire[0];
    for (let i = 0; i < 7; i++) {
      deck.push(this.createCardInstance(ghostFire, 'ghostFire'));
    }
    
    // 招福达摩
    const token = cardsData.token[0];
    for (let i = 0; i < 3; i++) {
      deck.push(this.createCardInstance(token, 'token'));
    }

    return {
      id,
      name,
      onmyoji: cardsData.onmyoji[0] as OnmyojiCard,  // 晴明
      shikigami: [cardsData.shikigami[0] as ShikigamiCard, cardsData.shikigami[1] as ShikigamiCard],  // 妖刀姬、大天狗
      ghostFire: 0,
      maxGhostFire: 5,
      spellPower: 0,
      hand: [],
      deck: shuffle(deck),
      discard: [],
      played: [],
      exiled: [],
      totalCharm: 0,
      cardsPlayed: 0,
      isConnected: true,
      isReady: true,
      shikigamiState: [
        { cardId: 'shikigami_001', isExhausted: false, markers: {} },
        { cardId: 'shikigami_002', isExhausted: false, markers: {} }
      ]
    };
  }

  private createField(): FieldState {
    // 创建鬼王牌库
    const bossDeck = shuffle([...cardsData.boss]) as BossCard[];
    
    // 创建游荡妖怪牌库（每种4张，用于单人测试）
    const yokaiDeck: CardInstance[] = [];
    for (const yokai of cardsData.yokai) {
      for (let i = 0; i < 4; i++) {
        yokaiDeck.push(this.createCardInstance(yokai, 'yokai'));
      }
    }

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossHp: 0,
      bossDeck,
      tokenShop: {
        token1: 8,
        token3: 8,
        token6: 8
      },
      penaltyPile: [],
      yokaiDeck: shuffle(yokaiDeck)
    };
  }

  private createCardInstance(card: any, type: string): CardInstance {
    return {
      instanceId: generateId(),
      cardId: card.id,
      cardType: type as any,
      name: card.name,
      hp: card.hp || 1,
      maxHp: card.hp || 1,
      armor: card.armor || 0,
      ghostFire: card.ghostFire,
      charm: card.charm,
      cost: card.cost,
      effect: card.effect,
      image: card.image
    };
  }

  // ============ 游戏流程 ============

  startGame(): void {
    // 抓5张起始手牌
    this.drawCards(5);
    
    // 翻出第一个鬼王
    this.revealBoss();
    
    // 填充战场
    this.fillYokaiSlots();
    
    // 开始游戏
    this.state.phase = 'playing';
    this.state.turnNumber = 1;
    
    this.addLog('🎮 游戏开始！');
    this.startTurn();
  }

  private startTurn(): void {
    const player = this.getPlayer();
    
    // 回合开始：鬼火+1
    player.ghostFire = Math.min(player.ghostFire + 1, player.maxGhostFire);
    
    // 重置状态
    player.spellPower = 0;
    player.cardsPlayed = 0;
    player.played = [];
    
    // 重置式神
    for (const state of player.shikigamiState) {
      state.isExhausted = false;
    }
    
    this.state.turnPhase = 'action';
    this.addLog(`🔄 回合 ${this.state.turnNumber} 开始，鬼火+1`);
    this.notifyChange();
  }

  // ============ 玩家操作 ============

  /** 打出手牌 */
  playCard(cardInstanceId: string): boolean {
    const player = this.getPlayer();
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;

    const card = player.hand.splice(index, 1)[0]!;
    player.played.push(card);
    player.cardsPlayed++;

    // 累加咒力（基于生命值）
    player.spellPower += card.hp;

    // 累加鬼火（如果是鬼火卡）
    if (card.ghostFire) {
      player.ghostFire = Math.min(player.ghostFire + card.ghostFire, player.maxGhostFire);
      this.addLog(`🔥 打出 ${card.name}，鬼火+${card.ghostFire}`);
    } else {
      this.addLog(`📜 打出 ${card.name}，咒力+${card.hp}`);
    }

    this.notifyChange();
    return true;
  }

  /** 攻击目标 */
  attackTarget(slotIndex: number): boolean {
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[slotIndex];
    
    if (!yokai) return false;
    
    // 计算伤害（基本攻击 = 1）
    const damage = 1;
    yokai.hp -= damage;
    
    this.addLog(`⚔️ 攻击 ${yokai.name}，造成 ${damage} 点伤害`);
    
    // 检查击杀
    if (yokai.hp <= 0) {
      this.killYokai(slotIndex);
    }
    
    this.notifyChange();
    return true;
  }

  /** 使用咒力退治妖怪 */
  killWithSpellPower(slotIndex: number): boolean {
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[slotIndex];
    
    if (!yokai) return false;
    
    // 检查咒力是否足够
    const required = yokai.hp + (yokai.armor || 0);
    if (player.spellPower < required) {
      this.addLog(`❌ 咒力不足！需要 ${required}，当前 ${player.spellPower}`);
      this.notifyChange();
      return false;
    }
    
    // 扣除咒力
    player.spellPower -= required;
    this.addLog(`⚔️ 消耗 ${required} 咒力退治 ${yokai.name}`);
    
    this.killYokai(slotIndex);
    this.notifyChange();
    return true;
  }

  private killYokai(slotIndex: number): void {
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) return;

    // 妖怪进入弃牌堆
    player.discard.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;

    // 计算符咒
    if (yokai.charm) {
      player.totalCharm += yokai.charm;
    }

    this.addLog(`✨ 退治了 ${yokai.name}！`);
  }

  /** 购买令牌 */
  buyToken(tokenType: 'token1' | 'token3' | 'token6'): boolean {
    const player = this.getPlayer();
    const costs = { token1: 1, token3: 3, token6: 6 };
    const cost = costs[tokenType];
    
    if (player.spellPower < cost) {
      this.addLog(`❌ 咒力不足！需要 ${cost}`);
      this.notifyChange();
      return false;
    }
    
    if (this.state.field.tokenShop[tokenType] <= 0) {
      this.addLog(`❌ 库存不足！`);
      this.notifyChange();
      return false;
    }
    
    // 扣除咒力
    player.spellPower -= cost;
    this.state.field.tokenShop[tokenType]--;
    
    // 获得令牌
    const tokenIndex = tokenType === 'token1' ? 0 : tokenType === 'token3' ? 1 : 2;
    const token = cardsData.token[tokenIndex];
    const cardInstance = this.createCardInstance(token, 'token');
    player.discard.push(cardInstance);
    player.totalCharm += token.charm;
    
    this.addLog(`💰 购买了 ${token.name}，符咒+${token.charm}`);
    this.notifyChange();
    return true;
  }

  /** 结束回合 */
  endTurn(): void {
    const player = this.getPlayer();
    
    // 清理阶段：弃置所有手牌和已打出的牌
    player.discard.push(...player.hand, ...player.played);
    player.hand = [];
    player.played = [];
    
    // 抓5张新牌
    this.drawCards(5);
    
    // 刷新战场
    this.fillYokaiSlots();
    
    // 回合数+1
    this.state.turnNumber++;
    
    // 检查游戏结束
    if (this.checkGameEnd()) {
      this.endGame();
      return;
    }
    
    this.addLog(`📝 回合结束，弃牌并抓5张`);
    
    // 开始新回合
    this.startTurn();
  }

  // ============ 辅助方法 ============

  private drawCards(count: number): void {
    const player = this.getPlayer();
    
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        if (player.discard.length === 0) break;
        player.deck = shuffle(player.discard);
        player.discard = [];
        this.addLog(`🔄 牌库耗尽，洗入弃牌堆`);
      }
      
      const card = player.deck.pop();
      if (card) {
        player.hand.push(card);
      }
    }
  }

  private fillYokaiSlots(): void {
    for (let i = 0; i < 6; i++) {
      if (this.state.field.yokaiSlots[i] === null && this.state.field.yokaiDeck.length > 0) {
        this.state.field.yokaiSlots[i] = this.state.field.yokaiDeck.pop()!;
      }
    }
  }

  private revealBoss(): void {
    if (this.state.field.bossDeck.length > 0) {
      const boss = this.state.field.bossDeck.pop()!;
      this.state.field.currentBoss = boss;
      this.state.field.bossHp = boss.hp;
      this.addLog(`👹 鬼王 ${boss.name} 来袭！生命值: ${boss.hp}`);
    }
  }

  private checkGameEnd(): boolean {
    // 鬼王耗尽
    if (!this.state.field.currentBoss && this.state.field.bossDeck.length === 0) {
      return true;
    }
    // 妖怪耗尽
    const filledSlots = this.state.field.yokaiSlots.filter(s => s !== null).length;
    if (filledSlots === 0 && this.state.field.yokaiDeck.length === 0) {
      return true;
    }
    return false;
  }

  private endGame(): void {
    this.state.phase = 'ended';
    const player = this.getPlayer();
    
    // 计算最终得分
    const allCards = [...player.deck, ...player.hand, ...player.discard];
    const totalCharm = allCards.reduce((sum, card) => sum + (card.charm || 0), 0);
    
    this.addLog(`🎉 游戏结束！最终符咒: ${totalCharm}`);
    this.notifyChange();
  }

  private getPlayer(): PlayerState {
    return this.state.players[0]!;
  }

  private addLog(message: string): void {
    this.state.log.push({
      type: 'game_start',
      message,
      timestamp: Date.now()
    });
  }

  private notifyChange(): void {
    this.state.lastUpdate = Date.now();
    this.onStateChange({ ...this.state });
  }

  // ============ 状态访问 ============

  getState(): GameState {
    return this.state;
  }
}
