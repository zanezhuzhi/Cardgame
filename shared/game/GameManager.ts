
/**
 * 御魂传说 - 游戏管理器
 * @file shared/game/GameManager.ts
 * @version 0.3 - 4阶段回合系统
 */

import type {
  GameState,
  GamePhase,
  TurnPhase,
  PlayerState,
  FieldState,
  GameConfig,
  GameLogEntry,
  GameAction,
  ShikigamiState
} from '../types/game';

import type {
  CardInstance,
  OnmyojiCard,
  ShikigamiCard,
  BossCard
} from '../types/cards';

import {
  getCardDatabase,
  getGameConfig,
  createStartingDeck,
  createYokaiInstance,
  createSpellInstance,
  createTokenInstance,
  createPenaltyInstance,
  shuffle,
  getAllBosses,
  getAllSpells,
  getYokaiForPlayerCount,
  getAllTokens,
  getAllPenalties,
  GAME_CONSTANTS
} from '../data/loader';

// ============ 游戏管理器 ============

export class GameManager {
  private state: GameState;
  private config: GameConfig;

  constructor(roomId: string, playerCount: number) {
    this.config = getGameConfig(playerCount);
    this.state = this.createInitialState(roomId);
  }

  // ============ 状态访问 ============

  getState(): GameState {
    return this.state;
  }

  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentPlayerIndex]!;
  }

  // ============ 游戏初始化 ============

  private createInitialState(roomId: string): GameState {
    return {
      roomId,
      phase: 'waiting',
      players: [],
      currentPlayerIndex: 0,
      turnNumber: 0,
      turnPhase: 'ghostFire', // 新的4阶段系统
      field: this.createInitialField(),
      log: [],
      lastUpdate: Date.now()
    };
  }

  private createInitialField(): FieldState {
    // 创建鬼王牌库（洗牌）
    const bossDeck = shuffle([...getAllBosses()]);

    // 创建游荡妖怪牌库
    const yokaiDeck = this.createYokaiDeck();

    // 创建恶评堆
    const penaltyPile = this.createPenaltyPile();

    // 创建阴阳术供应区模板卡
    const spells = getAllSpells();
    const basicSpell  = spells.find(s => s.name === '基础术式');
    const mediumSpell = spells.find(s => s.name === '中级符咒');
    const advSpell    = spells.find(s => s.name === '高级符咒');

    const makeSupplyCard = (spell: typeof basicSpell): CardInstance | null => {
      if (!spell) return null;
      return {
        instanceId: `supply_${spell.id}`,
        cardId: spell.id,
        cardType: 'spell',
        name: spell.name,
        hp: spell.hp,
        maxHp: spell.hp,
        damage: spell.damage,
        charm: spell.charm ?? 0,
        image: spell.image,
      };
    };

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossCurrentHp: 0,
      bossDeck,
      spellSupply: {
        basic:    makeSupplyCard(basicSpell),
        medium:   makeSupplyCard(mediumSpell),
        advanced: makeSupplyCard(advSpell),
      },
      spellCounts: {
        basic:    basicSpell?.count  ?? 50,
        medium:   mediumSpell?.count ?? 20,
        advanced: advSpell?.count    ?? 10,
      },
      tokenShop: this.config.tokenCounts?.fortuneDaruma ?? 18,
      penaltyPile,
      yokaiDeck,
      exileZone: [],
    };
  }

  private createYokaiDeck(): CardInstance[] {
    // 根据玩家数过滤（移除纸人标记卡）
    const yokaiForGame = getYokaiForPlayerCount(this.config.playerCount);
    const deck: CardInstance[] = [];
    
    // 每种妖怪根据人数配置添加
    for (const yokai of yokaiForGame) {
      for (let i = 0; i < this.config.yokaiPerType; i++) {
        deck.push(createYokaiInstance(yokai));
      }
    }
    
    return shuffle(deck);
  }

  private createPenaltyPile(): CardInstance[] {
    const penalties = getAllPenalties();
    const pile: CardInstance[] = [];
    
    // 农夫
    const farmer = penalties.find(p => p.name === '农夫');
    if (farmer) {
      for (let i = 0; i < this.config.penaltyCounts.penalty1; i++) {
        pile.push(createPenaltyInstance(farmer));
      }
    }
    
    // 武士
    const warrior = penalties.find(p => p.name === '武士');
    if (warrior && this.config.penaltyCounts.penalty2 > 0) {
      for (let i = 0; i < this.config.penaltyCounts.penalty2; i++) {
        pile.push(createPenaltyInstance(warrior));
      }
    }
    
    return pile;
  }

  // ============ 玩家管理 ============

  addPlayer(id: string, name: string): PlayerState {
    const player: PlayerState = {
      id,
      name,
      onmyoji: null,
      shikigami: [],
      maxShikigami: GAME_CONSTANTS.maxShikigami,  // 式神上限3
      ghostFire: 0,
      maxGhostFire: GAME_CONSTANTS.maxGhostFire,  // 鬼火上限5
      damage: 0, // 本回合累积伤害（回合结束清零）
      hand: [],
      deck: [],
      discard: [],
      played: [],
      exiled: [],
      totalCharm: 0,
      cardsPlayed: 0,
      isConnected: true,
      isReady: false,
      shikigamiState: []
    };
    
    this.state.players.push(player);
    this.updateState();
    return player;
  }

  removePlayer(id: string): void {
    const index = this.state.players.findIndex(p => p.id === id);
    if (index !== -1) {
      this.state.players.splice(index, 1);
      this.updateState();
    }
  }

  setPlayerReady(id: string, ready: boolean): void {
    const player = this.state.players.find(p => p.id === id);
    if (player) {
      player.isReady = ready;
      this.updateState();
    }
  }

  // ============ 游戏开始 ============

  startGame(): void {
    if (this.state.phase !== 'waiting') return;
    
    // 初始化每个玩家
    for (const player of this.state.players) {
      // 创建初始牌库并洗牌
      player.deck = shuffle(createStartingDeck());
      
      // 抓5张起始手牌
      this.drawCards(player, this.config.startingHandSize);
    }
    
    // 翻出第一个鬼王
    this.revealNextBoss();
    
    // 填充战场妖怪
    this.fillYokaiSlots();
    
    // 设置游戏状态
    this.state.phase = 'playing';
    this.state.turnNumber = 1;
    this.state.currentPlayerIndex = 0;
    this.state.turnPhase = 'start';
    
    // 记录日志
    this.addLog('game_start', '游戏开始！');
    
    // 开始第一个回合
    this.startTurn();
    
    this.updateState();
  }

  // ============ 回合管理（4阶段系统） ============
  // 阶段1: ghostFire   - 鬼火阶段（固定+1）
  // 阶段2: shikigami   - 式神调整（可选换/召唤）
  // 阶段3: action      - 行动阶段（主要游戏区）
  // 阶段4: cleanup     - 清理阶段（重置并抓5张）

  startTurn(): void {
    const player = this.getCurrentPlayer();
    
    this.addLog('turn_start', `${player.name} 的回合开始`, player.id);
    
    // 重置回合统计
    player.damage = 0;
    player.cardsPlayed = 0;
    player.played = [];
    
    // 重置式神状态
    for (const state of player.shikigamiState) {
      state.isExhausted = false;
    }
    
    // 进入鬼火阶段
    this.enterGhostFirePhase();
  }

  /** 阶段1: 鬼火阶段 - 鬼火+1 */
  private enterGhostFirePhase(): void {
    const player = this.getCurrentPlayer();
    this.state.turnPhase = 'ghostFire';
    
    // 鬼火固定+1，不超过上限
    player.ghostFire = Math.min(
      player.ghostFire + GAME_CONSTANTS.ghostFirePerTurn, 
      player.maxGhostFire
    );
    
    this.addLog('ghost_fire', `${player.name} 获得1点鬼火（当前:${player.ghostFire}）`, player.id);
    this.updateState();
    
    // 自动进入下一阶段
    this.enterShikigamiPhase();
  }

  /** 阶段2: 式神调整阶段 */
  private enterShikigamiPhase(): void {
    this.state.turnPhase = 'shikigami';
    this.updateState();
    // 等待玩家操作（调整/跳过）
  }

  /** 确认式神调整完成，进入行动阶段 */
  confirmShikigamiPhase(): void {
    this.enterActionPhase();
  }

  /** 阶段3: 行动阶段 */
  private enterActionPhase(): void {
    this.state.turnPhase = 'action';
    this.updateState();
    // 等待玩家操作（打牌、使用技能、分配伤害等）
  }

  /** 阶段4: 清理阶段 - 结束回合 */
  endTurn(): void {
    const player = this.getCurrentPlayer();
    
    // 进入清理阶段
    this.state.turnPhase = 'cleanup';
    
    // 伤害归零（回合结束清零）
    player.damage = 0;

    // 清理阶段：手牌 + 本回合已打出（played）→ 弃牌堆
    // played 仅本回合有效，清理后清空
    player.discard.push(...player.hand, ...player.played);
    player.hand = [];
    player.played = [];
    
    // 抓5张新牌
    this.drawCards(player, this.config.startingHandSize);
    
    // 刷新战场妖怪
    this.fillYokaiSlots();
    
    this.addLog('turn_end', `${player.name} 的回合结束`, player.id);
    
    // 切换到下一个玩家
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    
    // 如果回到第一个玩家，回合数+1
    if (this.state.currentPlayerIndex === 0) {
      this.state.turnNumber++;
    }
    
    // 检查游戏结束条件
    if (this.checkGameEnd()) {
      this.endGame();
      return;
    }
    
    // 开始新回合
    this.startTurn();
  }

  // ============ 牌库操作 ============

  drawCards(player: PlayerState, count: number): CardInstance[] {
    const drawn: CardInstance[] = [];
    
    for (let i = 0; i < count; i++) {
      // 如果牌库空了，洗入弃牌堆
      if (player.deck.length === 0) {
        if (player.discard.length === 0) {
          break; // 没有牌可抓了
        }
        player.deck = shuffle(player.discard);
        player.discard = [];
      }
      
      const card = player.deck.pop();
      if (card) {
        player.hand.push(card);
        drawn.push(card);
      }
    }
    
    if (drawn.length > 0) {
      this.addLog('draw', `${player.name} 抓了 ${drawn.length} 张牌`, player.id);
    }
    
    return drawn;
  }

  discardCard(player: PlayerState, cardInstanceId: string): boolean {
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;
    
    const card = player.hand.splice(index, 1)[0]!;
    player.discard.push(card);
    
    this.addLog('discard', `${player.name} 弃置了 ${card.name}`, player.id);
    return true;
  }

  exileCard(player: PlayerState, cardInstanceId: string): boolean {
    // 从手牌超度
    let index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index !== -1) {
      const card = player.hand.splice(index, 1)[0]!;
      player.exiled.push(card);
      this.addLog('exile', `${player.name} 超度了 ${card.name}`, player.id);
      return true;
    }
    
    // 从已打出区超度
    index = player.played.findIndex(c => c.instanceId === cardInstanceId);
    if (index !== -1) {
      const card = player.played.splice(index, 1)[0]!;
      player.exiled.push(card);
      this.addLog('exile', `${player.name} 超度了 ${card.name}`, player.id);
      return true;
    }
    
    return false;
  }

  // ============ 卡牌打出 ============

  playCard(player: PlayerState, cardInstanceId: string): boolean {
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;

    const card = player.hand.splice(index, 1)[0]!;

    // 打出的牌暂存于 played 区（本回合效果检索用）
    // 清理阶段统一移入 discard
    // 例：山童【怪力】需要检索「本回合前2张阴阳术」
    player.played.push(card);
    player.cardsPlayed++;

    // 累加伤害
    if (card.damage) {
      player.damage += card.damage;
    }

    this.addLog('play_card', `${player.name} 打出了 ${card.name}（伤害+${card.damage || 0}）`, player.id);
    this.updateState();

    return true;
  }

  // ============ 战场操作 ============

  private fillYokaiSlots(): void {
    for (let i = 0; i < 6; i++) {
      if (this.state.field.yokaiSlots[i] === null && this.state.field.yokaiDeck.length > 0) {
        this.state.field.yokaiSlots[i] = this.state.field.yokaiDeck.pop()!;
      }
    }
  }

  private revealNextBoss(): void {
    if (this.state.field.bossDeck.length === 0) {
      // 无鬼王，游戏即将结束（由 checkGameEnd 处理）
      return;
    }

    const boss = this.state.field.bossDeck.pop()!;
    this.state.field.currentBoss = boss;
    this.state.field.bossCurrentHp = boss.hp;

    this.addLog('boss_arrival', `【鬼王来袭】${boss.name}（阶段${boss.stage}，HP:${boss.hp}）来袭！`);

    // 触发来袭效果（记录日志，具体效果由 EffectEngine 处理）
    if (boss.arrivalEffect && boss.arrivalEffect !== '无') {
      this.addLog('boss_arrival', `来袭效果：${boss.arrivalEffect}`);
    }
  }

  // ============ 退治/购买 ============

  attackTarget(player: PlayerState, targetId: string, damage: number): boolean {
    // 检查分配伤害不超过累积值
    if (damage > player.damage) return false;

    // 检查是否是战场妖怪
    for (let i = 0; i < 6; i++) {
      const yokai = this.state.field.yokaiSlots[i];
      if (yokai && yokai.instanceId === targetId) {
        // 从累积伤害中扣除
        player.damage -= damage;
        yokai.hp -= damage;
        
        this.addLog('attack', `${player.name} 对 ${yokai.name} 造成 ${damage} 点伤害（剩余伤害:${player.damage}）`, player.id);
        
        // 检查是否击杀
        if (yokai.hp <= 0) {
          this.killYokai(player, i);
        }
        
        this.updateState();
        return true;
      }
    }
    
    // 检查是否是鬼王
    if (this.state.field.currentBoss && targetId === 'boss') {
      // 从累积伤害中扣除
      player.damage -= damage;
      this.state.field.bossCurrentHp -= damage;

      this.addLog('attack',
        `${player.name} 对鬼王 ${this.state.field.currentBoss.name} 造成 ${damage} 点伤害（剩余HP:${this.state.field.bossCurrentHp}）`,
        player.id
      );

      if (this.state.field.bossCurrentHp <= 0) {
        this.killBoss(player);
      }

      this.updateState();
      return true;
    }
    
    return false;
  }

  private killYokai(player: PlayerState, slotIndex: number): void {
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) return;

    // 妖怪进入玩家弃牌堆（结算时统一计算声誉）
    player.discard.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;

    // 实时更新 totalCharm 用于过程展示（牌库=deck+hand+discard+played）
    player.totalCharm = [
      ...player.deck, ...player.hand, ...player.discard, ...player.played,
    ].reduce((sum, c) => sum + (c.charm || 0), 0);
    
    this.addLog('kill', `${player.name} 退治了 ${yokai.name}！`, player.id);
  }

  private killBoss(player: PlayerState): void {
    const boss = this.state.field.currentBoss;
    if (!boss) return;

    // 鬼王卡进入玩家弃牌堆（与妖怪一致，结算时统一计算声誉）
    const bossCard: CardInstance = {
      instanceId: `boss_${boss.id}_${Date.now()}`,
      cardId: boss.id,
      cardType: 'boss',
      name: boss.name,
      hp: boss.hp,
      maxHp: boss.hp,
      charm: boss.charm,
      image: boss.image,
    };
    player.discard.push(bossCard);

    // 实时更新 totalCharm 用于过程展示
    player.totalCharm = [
      ...player.deck, ...player.hand,
      ...player.discard, ...player.played,
    ].reduce((sum, c) => sum + (c.charm || 0), 0);

    this.addLog('defeat_boss', `${player.name} 击败了鬼王 ${boss.name}！`, player.id);

    // 清除当前鬼王
    this.state.field.currentBoss = null;
    this.state.field.bossCurrentHp = 0;

    // 翻出下一个鬼王（若有）
    this.revealNextBoss();

    // 击败最后一个鬼王时立即结束游戏
    if (this.checkGameEnd()) {
      this.endGame();
    }
  }

  /**
   * 超度升级阴阳术
   * 将手牌/弃牌堆中的卡牌超度，换取供应区的更高级阴阳术
   * 
   * 规则：超度卡牌HP总和 >= 目标阴阳术HP值
   */
  buySpell(player: PlayerState, spellId: string, exileCardIds: string[]): boolean {
    // 1. 从供应区找目标阴阳术（按cardId匹配）
    const supply = this.state.field.spellSupply;
    let targetCard: CardInstance | null = null;
    let supplyKey: 'basic' | 'medium' | 'advanced' | null = null;

    for (const key of ['basic', 'medium', 'advanced'] as const) {
      if (supply[key] && supply[key]!.cardId === spellId) {
        targetCard = supply[key];
        supplyKey = key;
        break;
      }
    }
    if (!targetCard || !supplyKey) return false;

    const requiredHp = targetCard.hp;

    // 2. 收集要超度的卡牌（手牌 + 弃牌堆 + 已打出区）
    let totalHp = 0;
    const cardsToExile: CardInstance[] = [];

    for (const cardId of exileCardIds) {
      const card = player.hand.find(c => c.instanceId === cardId)
                || player.discard.find(c => c.instanceId === cardId)
                || player.played.find(c => c.instanceId === cardId);
      if (card) {
        totalHp += card.hp;
        cardsToExile.push(card);
      }
    }

    // 3. 检查HP总和是否足够
    if (totalHp < requiredHp) return false;

    // 4. 执行超度：从各区域移除，加入超度区
    for (const card of cardsToExile) {
      for (const zone of [player.hand, player.discard, player.played]) {
        const idx = zone.findIndex(c => c.instanceId === card.instanceId);
        if (idx !== -1) {
          zone.splice(idx, 1);
          break;
        }
      }
      player.exiled.push(card);
    }

    // 5. 创建新阴阳术实例放入弃牌堆（从供应区模板克隆）
    const newSpell: CardInstance = {
      instanceId: `spell_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      cardId: targetCard.cardId,
      cardType: 'spell',
      name: targetCard.name,
      hp: targetCard.hp,
      maxHp: targetCard.maxHp,
      damage: targetCard.damage,
      charm: targetCard.charm ?? 0,
      image: targetCard.image,
    };
    player.discard.push(newSpell);

    this.addLog('exile', `${player.name} 超度获得了 ${targetCard.name}（超度${cardsToExile.length}张）`, player.id);
    this.updateState();
    return true;
  }

  // ============ 式神技能 ============

  useShikigamiSkill(player: PlayerState, shikigamiId: string, targetId?: string): boolean {
    // 按 id 查找式神及其状态
    const shikigami = player.shikigami.find(s => s.id === shikigamiId);
    const shikigamiState = player.shikigamiState.find(s => s.cardId === shikigamiId);

    if (!shikigami || !shikigamiState) return false;

    // 【永】被动技不需要主动触发
    if (!shikigami.skill || shikigami.skill.effectType === '永') return false;

    // 疲劳检查（【触】触发技由系统自动处理，玩家不能手动触发）
    if (shikigamiState.isExhausted) return false;

    // 【启】主动技：检查鬼火
    if (shikigami.skill.effectType === '启') {
      const cost = shikigami.skill.cost ?? 0;
      if (player.ghostFire < cost) return false;

      // 扣除鬼火
      player.ghostFire -= cost;
    }

    // 标记疲劳
    shikigamiState.isExhausted = true;

    // 执行技能效果
    this.resolveSkillEffect(player, shikigami, shikigamiState, targetId);

    this.addLog('use_skill',
      `${player.name} 的 ${shikigami.name} 使用了【${shikigami.skill.effectType}】${shikigami.skill.name}`,
      player.id
    );

    this.updateState();
    return true;
  }

  /**
   * 解析并执行式神技能效果
   * 目前实现核心效果，后续按需扩展
   */
  private resolveSkillEffect(
    player: PlayerState,
    shikigami: any,
    shikigamiState: ShikigamiState,
    targetId?: string
  ): void {
    const effect = shikigami.skill?.effect;
    if (!effect) return;

    switch (effect) {
      // 山童【怪力】：前2张阴阳术额外伤害+1
      case 'bonus_spell_damage_2':
        shikigamiState.markers['bonusSpellDamage'] = 2;
        break;

      // 白狼【冥想】：弃置N张手牌，伤害+N（由玩家打牌决定，标记激活状态）
      case 'discard_for_damage':
        shikigamiState.markers['discardForDamage'] = 1;
        break;

      // 书翁【万象之书】：鬼火-N伤害+N+1（cost已扣，补算effect部分）
      case 'variable_damage':
        if (shikigami.skill.usedCost !== undefined) {
          player.damage += shikigami.skill.usedCost + 1;
        }
        break;

      // 默认：无额外效果（框架已处理鬼火扣除和疲劳）
      default:
        break;
    }
  }

  // ============ 游戏结束 ============

  private checkGameEnd(): boolean {
    // 条件1：鬼王耗尽
    if (this.state.field.currentBoss === null && this.state.field.bossDeck.length === 0) {
      return true;
    }
    
    // 条件2：游荡妖怪不足6张且牌库空
    const filledSlots = this.state.field.yokaiSlots.filter(s => s !== null).length;
    if (filledSlots < 6 && this.state.field.yokaiDeck.length === 0) {
      return true;
    }
    
    return false;
  }

  private endGame(): void {
    this.state.phase = 'ended';
    
    // 计算最终得分
    interface PlayerScore {
      id: string;
      name: string;
      charm: number;
      cardCount: number;
    }
    
    const playerScores: PlayerScore[] = [];
    
    for (const player of this.state.players) {
      // 结算声誉：玩家牌库 + 式神区，超度区不计入
      // 牌库 = deck（待抓取）+ hand（手牌）+ discard（弃牌堆）+ played（本回合暂存）
      // 注：游戏可能在行动阶段中途结束，played 尚未移入 discard，需要一并计算
      const allCards = [
        ...player.deck,
        ...player.hand,
        ...player.discard,
        ...player.played,
      ];
      const deckCharm = allCards.reduce((sum, card) => sum + (card.charm || 0), 0);
      // 式神在式神区，不在牌库中，需要单独计算
      const shikigamiCharm = player.shikigami.reduce((sum, s) => sum + (s.charm || 0), 0);
      const totalCharm = deckCharm + shikigamiCharm;

      // 同步实时追踪值
      player.totalCharm = totalCharm;
      
      playerScores.push({
        id: player.id,
        name: player.name,
        charm: totalCharm,
        cardCount: allCards.length
      });
    }
    
    // 排序：优先声誉，相同则比较牌数
    playerScores.sort((a, b) => {
      if (b.charm !== a.charm) {
        return b.charm - a.charm; // 声誉高者优先
      }
      return b.cardCount - a.cardCount; // 牌数多者优先
    });
    
    const winner = playerScores[0];
    const runnerUp = playerScores[1];
    
    // 检查是否平局
    if (winner && runnerUp && 
        winner.charm === runnerUp.charm && 
        winner.cardCount === runnerUp.cardCount) {
      this.addLog('game_end', `游戏结束！${winner.name} 和 ${runnerUp.name} 平局！`);
    } else if (winner) {
      this.addLog('game_end', `游戏结束！${winner.name} 获胜！（声誉:${winner.charm}，牌数:${winner.cardCount}）`);
    }
    
    this.updateState();
  }

  // ============ 工具方法 ============

  private addLog(type: GameLogEntry['type'], message: string, playerId?: string): void {
    const player = playerId ? this.state.players.find(p => p.id === playerId) : undefined;
    
    const entry: GameLogEntry = {
      type,
      message,
      timestamp: Date.now()
    };
    
    if (playerId) {
      entry.playerId = playerId;
    }
    if (player?.name) {
      entry.playerName = player.name;
    }
    
    this.state.log.push(entry);
  }

  private updateState(): void {
    this.state.lastUpdate = Date.now();
  }

  // ============ 动作处理 ============

  handleAction(playerId: string, action: GameAction): boolean {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // 检查是否是当前玩家的回合
    if (this.getCurrentPlayer().id !== playerId) return false;
    
    switch (action.type) {
      case 'PLAY_CARD':
        if (this.state.turnPhase !== 'action') return false;
        return this.playCard(player, action.cardInstanceId);
        
      case 'USE_SKILL':
        if (this.state.turnPhase !== 'action') return false;
        return this.useShikigamiSkill(player, action.shikigamiId, action.targetId);
        
      case 'ATTACK':
        if (this.state.turnPhase !== 'action') return false;
        return this.attackTarget(player, action.targetId, action.damage);
        
      case 'BUY_SPELL':
        if (this.state.turnPhase !== 'action') return false;
        return this.buySpell(player, action.spellId, action.exileCardIds);
        
      case 'CONFIRM_SHIKIGAMI':
        if (this.state.turnPhase !== 'shikigami') return false;
        this.confirmShikigamiPhase();
        return true;
        
      case 'END_TURN':
        if (this.state.turnPhase !== 'action') return false;
        this.endTurn();
        return true;
        
      default:
        return false;
    }
  }
}

// 导出单例工厂
const gameInstances = new Map<string, GameManager>();

export function createGame(roomId: string, playerCount: number): GameManager {
  const game = new GameManager(roomId, playerCount);
  gameInstances.set(roomId, game);
  return game;
}

export function getGame(roomId: string): GameManager | undefined {
  return gameInstances.get(roomId);
}

export function removeGame(roomId: string): void {
  gameInstances.delete(roomId);
}
