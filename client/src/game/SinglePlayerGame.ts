/**
 * 御魂传说 - 单人游戏控制器
 * @file client/src/game/SinglePlayerGame.ts
 * @version 2.0 - 基于规则说明书v0.3.0重写
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
  BossCard
} from '../../../shared/types/cards';

// 导入卡牌数据（直接从JSON）
import cardsData from '../../../shared/data/cards.json';

// ============ 常量 ============

const GAME_CONSTANTS = {
  MAX_GHOST_FIRE: 5,
  GHOST_FIRE_PER_TURN: 1,
  STARTING_HAND_SIZE: 5,
  STARTING_DECK_SIZE: 9,   // 6基础术式 + 3招福达摩
  YOKAI_SLOTS: 6,
  MAX_SHIKIGAMI: 3
};

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
  
  // 本回合状态
  private hasAllocatedDamage: boolean = false;  // 本回合是否已分配伤害
  private hasGainedBasicSpell: boolean = false; // 本回合是否已获得基础术式
  private killedYokaiThisTurn: boolean = false; // 本回合是否击杀了妖怪

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
      turnPhase: 'ghostFire',
      field,
      log: [],
      lastUpdate: Date.now(),
      lastPlayerKilledYokai: true,  // 首回合不触发刷新选项
      pendingYokaiRefresh: false
    };
  }

  private createPlayer(id: string, name: string): PlayerState {
    // 创建初始牌库：6张基础术式 + 3张招福达摩 = 9张
    const deck: CardInstance[] = [];
    
    // 基础术式（从spell中筛选基础级别的）
    const basicSpells = (cardsData.spell as any[]).filter((s: any) => s.level === 'basic');
    const defaultSpell = basicSpells[0] || cardsData.spell[0];
    for (let i = 0; i < 6; i++) {
      deck.push(this.createCardInstance(defaultSpell, 'spell'));
    }
    
    // 招福达摩（初始卡，3张）
    const daruma = (cardsData.yokai as any[]).find((y: any) => y.name === '招福达摩') || cardsData.token[0];
    for (let i = 0; i < 3; i++) {
      deck.push(this.createCardInstance(daruma, 'yokai'));
    }

    // 随机选2个式神
    const shuffledShikigami = shuffle([...cardsData.shikigami]);
    const selectedShikigami = shuffledShikigami.slice(0, 2) as ShikigamiCard[];

    return {
      id,
      name,
      onmyoji: cardsData.onmyoji[0] as OnmyojiCard,
      shikigami: selectedShikigami,
      ghostFire: 0,
      maxGhostFire: GAME_CONSTANTS.MAX_GHOST_FIRE,
      damage: 0,  // 本回合累积伤害
      hand: [],
      deck: shuffle(deck),
      discard: [],
      played: [],
      exiled: [],
      totalCharm: 0,
      cardsPlayed: 0,
      isConnected: true,
      isReady: true,
      shikigamiState: selectedShikigami.map(s => ({
        cardId: s.id,
        isExhausted: false,
        markers: {}
      })),
      tempBuffs: []
    };
  }

  private createField(): FieldState {
    // 创建鬼王牌库（每个阶段内部随机洗匀，然后按1→2→3阶段叠起来）
    const bossCards = [...cardsData.boss] as any[];
    
    // 按阶段分组并洗牌
    const stage1 = shuffle(bossCards.filter(b => b.stage === 1));
    const stage2 = shuffle(bossCards.filter(b => b.stage === 2));
    const stage3 = shuffle(bossCards.filter(b => b.stage === 3));
    
    // 麒麟从阶段1中取出，放在最上面
    const qilin = stage1.find(b => b.name === '麒麟');
    const otherStage1 = stage1.filter(b => b.name !== '麒麟');
    
    // 牌库顺序（从底部到顶部）：阶段3 → 阶段2 → 阶段1(除麒麟) → 麒麟
    // 由于用pop()取牌，数组末尾是顶部，所以顺序是：[...stage3, ...stage2, ...otherStage1, qilin]
    const bossDeck = [...stage3, ...stage2, ...otherStage1, qilin].filter(Boolean) as BossCard[];
    
    // 创建游荡妖怪牌库（排除招福达摩）
    const yokaiDeck: CardInstance[] = [];
    for (const yokai of cardsData.yokai as any[]) {
      // 跳过招福达摩（初始卡，不进入游荡妖怪牌库）
      if (yokai.name === '招福达摩') continue;
      
      const count = yokai.count || 3;  // 默认3张
      for (let i = 0; i < count; i++) {
        yokaiDeck.push(this.createCardInstance(yokai, 'yokai'));
      }
    }

    // 创建恶评牌库
    const penaltyPile: CardInstance[] = [];
    for (const penalty of cardsData.penalty as any[]) {
      const count = penalty.count || 10;
      for (let i = 0; i < count; i++) {
        penaltyPile.push(this.createCardInstance(penalty, 'penalty'));
      }
    }

    // 创建阴阳术供应堆
    const spellSupply: { [key: string]: CardInstance[] } = {
      basic: [],
      middle: [],
      advanced: []
    };
    for (const spell of cardsData.spell as any[]) {
      const count = spell.count || 10;
      for (let i = 0; i < count; i++) {
        const instance = this.createCardInstance(spell, 'spell');
        if (spell.level === 'basic') spellSupply.basic.push(instance);
        else if (spell.level === 'middle') spellSupply.middle.push(instance);
        else if (spell.level === 'advanced') spellSupply.advanced.push(instance);
      }
    }

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossHp: 0,
      bossDeck,
      penaltyPile: shuffle(penaltyPile),
      yokaiDeck: shuffle(yokaiDeck),
      spellSupply  // 阴阳术供应堆
    } as FieldState;
  }

  private createCardInstance(card: any, type: string): CardInstance {
    return {
      instanceId: generateId(),
      cardId: card.id,
      cardType: type as any,
      name: card.name,
      hp: card.hp || card.damage || 1,  // hp也可表示伤害值
      maxHp: card.hp || card.damage || 1,
      armor: card.armor || 0,
      charm: card.charm || 0,
      damage: card.damage || 0,  // 阴阳术的伤害值
      effect: card.effect,
      image: card.image
    };
  }

  // ============ 游戏流程 ============

  startGame(): void {
    // 抓5张起始手牌
    this.drawCards(GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // 翻出第一个鬼王（麒麟，无来袭效果）
    this.revealBoss();
    
    // 填充战场（6张游荡妖怪）
    this.fillYokaiSlots();
    
    // 开始游戏
    this.state.phase = 'playing';
    this.state.turnNumber = 1;
    
    this.addLog('🎮 游戏开始！退治妖怪与鬼王，累积声誉成为大阴阳师！');
    this.startTurn();
  }

  private startTurn(): void {
    const player = this.getPlayer();
    
    // 重置回合状态
    this.hasAllocatedDamage = false;
    this.hasGainedBasicSpell = false;
    this.killedYokaiThisTurn = false;
    
    // 清空上回合TempBuff
    player.tempBuffs = [];
    
    // 进入鬼火阶段
    this.enterGhostFirePhase();
  }

  // ============ 阶段1：鬼火阶段 ============
  
  private enterGhostFirePhase(): void {
    const player = this.getPlayer();
    this.state.turnPhase = 'ghostFire';
    
    // 鬼火+1（上限5）
    player.ghostFire = Math.min(
      player.ghostFire + GAME_CONSTANTS.GHOST_FIRE_PER_TURN,
      GAME_CONSTANTS.MAX_GHOST_FIRE
    );
    
    this.addLog(`🔥 回合 ${this.state.turnNumber} - 鬼火+1（当前:${player.ghostFire}）`);
    
    // 检查妖怪刷新选项（上一玩家未击杀妖怪时触发）
    if (this.state.lastPlayerKilledYokai === false) {
      this.state.pendingYokaiRefresh = true;
      this.addLog(`⚠️ 上一回合未击败妖怪，可选择刷新场上妖怪`);
      this.notifyChange();
      return;  // 等待玩家决定
    }
    
    // 直接进入式神阶段
    this.enterShikigamiPhase();
  }

  /** 玩家决定是否刷新妖怪 */
  decideYokaiRefresh(refresh: boolean): void {
    if (!this.state.pendingYokaiRefresh) return;
    
    if (refresh) {
      // 将场上妖怪放入牌库底部
      for (let i = 0; i < GAME_CONSTANTS.YOKAI_SLOTS; i++) {
        const yokai = this.state.field.yokaiSlots[i];
        if (yokai) {
          this.state.field.yokaiDeck.unshift(yokai);
          this.state.field.yokaiSlots[i] = null;
        }
      }
      // 重新填充
      this.fillYokaiSlots();
      this.addLog(`🔄 刷新场上妖怪！`);
    } else {
      this.addLog(`➡️ 保持场上妖怪不变`);
    }
    
    this.state.pendingYokaiRefresh = false;
    this.enterShikigamiPhase();
  }

  // ============ 阶段2：式神调整阶段 ============
  
  private enterShikigamiPhase(): void {
    this.state.turnPhase = 'shikigami';
    
    // 重置式神疲劳状态
    const player = this.getPlayer();
    for (const state of player.shikigamiState) {
      state.isExhausted = false;
    }
    
    this.notifyChange();
    // 玩家可以在此阶段调整式神，然后手动确认进入行动阶段
  }

  /** 确认式神阶段，进入行动阶段 */
  confirmShikigamiPhase(): void {
    if (this.state.turnPhase !== 'shikigami') return;
    this.enterActionPhase();
  }

  // ============ 阶段3：行动阶段 ============
  
  private enterActionPhase(): void {
    this.state.turnPhase = 'action';
    const player = this.getPlayer();
    
    // 重置行动相关状态
    player.damage = 0;
    player.cardsPlayed = 0;
    player.played = [];
    
    this.addLog(`⚔️ 进入行动阶段 - 打牌累积伤害，然后分配伤害退治妖怪`);
    this.notifyChange();
  }

  // ============ 玩家操作 ============

  /** 打出手牌 */
  playCard(cardInstanceId: string): boolean {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;

    const card = player.hand.splice(index, 1)[0]!;
    player.played.push(card);
    player.cardsPlayed++;

    // 根据卡牌类型产生效果
    if (card.cardType === 'spell') {
      // 阴阳术：累积伤害
      const damageValue = card.damage || card.hp || 1;
      player.damage += damageValue;
      this.addLog(`📜 打出【${card.name}】，伤害+${damageValue}（总计:${player.damage}）`);
    } else if (card.cardType === 'yokai') {
      // 妖怪卡（御魂）：触发御魂效果
      if (card.damage) {
        player.damage += card.damage;
        this.addLog(`� 打出御魂【${card.name}】，伤害+${card.damage}（总计:${player.damage}）`);
      } else {
        this.addLog(`� 打出御魂【${card.name}】`);
      }
    }

    this.notifyChange();
    return true;
  }

  /** 使用式神技能 */
  useShikigamiSkill(shikigamiId: string): boolean {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const shikigami = player.shikigami.find(s => s.id === shikigamiId);
    const state = player.shikigamiState.find(s => s.cardId === shikigamiId);
    
    if (!shikigami || !state) return false;
    if (state.isExhausted) {
      this.addLog(`❌ ${shikigami.name} 已疲劳，本回合无法再次使用`);
      this.notifyChange();
      return false;
    }
    
    const cost = shikigami.skill?.cost || 0;
    if (player.ghostFire < cost) {
      this.addLog(`❌ 鬼火不足！需要 ${cost}，当前 ${player.ghostFire}`);
      this.notifyChange();
      return false;
    }
    
    // 消耗鬼火
    player.ghostFire -= cost;
    state.isExhausted = true;
    
    // 简化的技能效果（根据技能名称产生伤害）
    const skillDamage = shikigami.skill?.damage || 2;
    player.damage += skillDamage;
    
    this.addLog(`🦊 ${shikigami.name} 发动【${shikigami.skill?.name}】，伤害+${skillDamage}（总计:${player.damage}）`);
    this.notifyChange();
    return true;
  }

  /** 每回合免费获得1张基础术式 */
  gainBasicSpell(): boolean {
    if (this.state.turnPhase !== 'action') return false;
    if (this.hasGainedBasicSpell) {
      this.addLog(`❌ 本回合已获得过基础术式`);
      this.notifyChange();
      return false;
    }
    
    const spellSupply = (this.state.field as any).spellSupply;
    if (!spellSupply?.basic || spellSupply.basic.length === 0) {
      this.addLog(`❌ 基础术式已耗尽`);
      this.notifyChange();
      return false;
    }
    
    const player = this.getPlayer();
    const spell = spellSupply.basic.pop();
    player.discard.push(spell);
    this.hasGainedBasicSpell = true;
    
    this.addLog(`📜 获得1张【基础术式】（进入弃牌堆）`);
    this.notifyChange();
    return true;
  }

  /** 分配伤害退治妖怪（一次性分配） */
  allocateDamage(targetSlotIndex: number): boolean {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[targetSlotIndex];
    
    if (!yokai) {
      this.addLog(`❌ 该位置没有妖怪`);
      this.notifyChange();
      return false;
    }
    
    const required = yokai.hp + (yokai.armor || 0);
    if (player.damage < required) {
      this.addLog(`❌ 伤害不足！需要 ${required}，当前 ${player.damage}`);
      this.notifyChange();
      return false;
    }
    
    // 扣除伤害，退治妖怪
    player.damage -= required;
    this.killYokai(targetSlotIndex);
    
    this.notifyChange();
    return true;
  }

  /** 攻击鬼王 */
  attackBoss(damage: number): boolean {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const boss = this.state.field.currentBoss;
    
    if (!boss) {
      this.addLog(`❌ 当前没有鬼王`);
      this.notifyChange();
      return false;
    }
    
    if (player.damage < damage) {
      this.addLog(`❌ 伤害不足！`);
      this.notifyChange();
      return false;
    }
    
    // 扣除伤害
    player.damage -= damage;
    this.state.field.bossHp -= damage;
    
    this.addLog(`⚔️ 对鬼王【${boss.name}】造成 ${damage} 点伤害（剩余:${this.state.field.bossHp}）`);
    
    // 检查鬼王是否被击败
    if (this.state.field.bossHp <= 0) {
      this.defeatBoss();
    }
    
    this.notifyChange();
    return true;
  }

  private killYokai(slotIndex: number): void {
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) return;

    // 标记本回合击杀了妖怪
    this.killedYokaiThisTurn = true;

    // 妖怪进入弃牌堆（成为御魂）
    player.discard.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;

    // 更新声誉
    if (yokai.charm) {
      player.totalCharm += yokai.charm;
    }

    this.addLog(`✨ 退治了【${yokai.name}】！声誉+${yokai.charm || 0}`);
  }

  private defeatBoss(): void {
    const player = this.getPlayer();
    const boss = this.state.field.currentBoss;
    if (!boss) return;

    // 鬼王进入弃牌堆
    const bossInstance = this.createCardInstance(boss, 'boss');
    player.discard.push(bossInstance);
    
    player.totalCharm += boss.charm || 0;
    
    this.addLog(`� 击败鬼王【${boss.name}】！声誉+${boss.charm || 0}`);
    
    this.state.field.currentBoss = null;
    this.state.field.bossHp = 0;
  }

  /** 结束回合 */
  endTurn(): void {
    if (this.state.turnPhase !== 'action') return;
    
    const player = this.getPlayer();
    
    // 进入清理阶段
    this.state.turnPhase = 'cleanup';
    
    // 清理阶段：手牌 + 已打出 → 弃牌堆
    player.discard.push(...player.hand, ...player.played);
    player.hand = [];
    player.played = [];
    
    // 伤害清零
    player.damage = 0;
    
    // 抓5张新牌
    this.drawCards(GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // 刷新战场妖怪
    this.fillYokaiSlots();
    
    // 记录本回合是否击杀了妖怪（用于下回合刷新判定）
    this.state.lastPlayerKilledYokai = this.killedYokaiThisTurn;
    
    // 如果击败了鬼王，翻出下一张
    if (!this.state.field.currentBoss && this.state.field.bossDeck.length > 0) {
      this.revealBoss();
    }
    
    this.addLog(`📝 回合结束，弃牌并抓5张`);
    
    // 回合数+1
    this.state.turnNumber++;
    
    // 检查游戏结束
    if (this.checkGameEnd()) {
      this.endGame();
      return;
    }
    
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
    for (let i = 0; i < GAME_CONSTANTS.YOKAI_SLOTS; i++) {
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
      
      // 执行来袭效果（除麒麟外）
      if (boss.name !== '麒麟' && boss.arrivalEffect) {
        this.addLog(`👹 鬼王【${boss.name}】来袭！${boss.arrivalEffect}`);
      } else {
        this.addLog(`👹 鬼王【${boss.name}】登场！生命:${boss.hp}`);
      }
    }
  }

  private checkGameEnd(): boolean {
    // 鬼王耗尽
    if (!this.state.field.currentBoss && this.state.field.bossDeck.length === 0) {
      return true;
    }
    // 妖怪不足6张
    const filledSlots = this.state.field.yokaiSlots.filter(s => s !== null).length;
    if (filledSlots < GAME_CONSTANTS.YOKAI_SLOTS && this.state.field.yokaiDeck.length === 0) {
      return true;
    }
    return false;
  }

  private endGame(): void {
    this.state.phase = 'ended';
    const player = this.getPlayer();
    
    // 计算最终声誉
    const allCards = [...player.deck, ...player.hand, ...player.discard];
    const totalCharm = allCards.reduce((sum, card) => sum + (card.charm || 0), 0);
    const shikigamiCharm = player.shikigami.reduce((sum, s) => sum + (s.charm || 0), 0);
    const finalCharm = totalCharm + shikigamiCharm;
    
    this.addLog(`🎉 游戏结束！`);
    this.addLog(`👑 最终声誉: ${finalCharm}`);
    this.addLog(`📚 牌库张数: ${allCards.length}`);
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
  
  // 暴露给UI的状态查询
  canGainBasicSpell(): boolean {
    return !this.hasGainedBasicSpell && this.state.turnPhase === 'action';
  }
  
  getCurrentDamage(): number {
    return this.getPlayer().damage;
  }
}