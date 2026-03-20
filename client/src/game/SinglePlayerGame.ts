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

// 导入效果引擎和效果定义
import { effectEngine } from '../../../shared/game/effects/EffectEngine';
import { YOKAI_EFFECT_DEFS, getYokaiEffectDef } from '../../../shared/game/effects/YokaiEffects';
import { SHIKIGAMI_EFFECT_DEFS, getShikigamiEffectDefs } from '../../../shared/game/effects/ShikigamiEffects';
import type { EffectContext, CardEffect, TempBuffType } from '../../../shared/game/effects/types';

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
  private yokaiKilledCount: number = 0;         // 本回合击杀妖怪数量
  private cardsDrawnThisTurn: number = 0;       // 本回合因效果抓牌数
  
  // UI交互回调（由外部设置）
  public onChoiceRequired?: (options: string[]) => Promise<number>;
  public onSelectTargetRequired?: (candidates: CardInstance[]) => Promise<string>;
  public onSelectCardsRequired?: (candidates: CardInstance[], count: number) => Promise<string[]>;

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

    // 创建式神供应堆（洗混后，移除已发给玩家的式神）
    const allShikigami = shuffle([...cardsData.shikigami]) as ShikigamiCard[];

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossHp: 0,
      bossDeck,
      penaltyPile: shuffle(penaltyPile),
      yokaiDeck: shuffle(yokaiDeck),
      spellSupply,  // 阴阳术供应堆
      shikigamiSupply: allShikigami  // 式神供应堆（商店）
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
    
    // 从式神供应堆移除玩家已选的式神
    const player = this.getPlayer();
    const playerShikigamiIds = player.shikigami.map(s => s.id);
    if (this.state.field.shikigamiSupply) {
      this.state.field.shikigamiSupply = this.state.field.shikigamiSupply.filter(
        s => !playerShikigamiIds.includes(s.id)
      );
      this.addLog(`📦 式神商店剩余：${this.state.field.shikigamiSupply.length}张`);
    }
    
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
    this.yokaiKilledCount = 0;
    this.cardsDrawnThisTurn = 0;
    
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

  // ============ 阶段2：行动阶段（含式神调整） ============
  
  private enterShikigamiPhase(): void {
    // 直接进入行动阶段（式神调整合并到行动阶段）
    this.enterActionPhase();
  }

  /** 确认式神阶段，进入行动阶段（保留兼容性） */
  confirmShikigamiPhase(): void {
    if (this.state.turnPhase !== 'shikigami') return;
    this.enterActionPhase();
  }

  // ============ 行动阶段 ============
  
  private enterActionPhase(): void {
    this.state.turnPhase = 'action';
    const player = this.getPlayer();
    
    // 重置式神疲劳状态
    for (const state of player.shikigamiState) {
      state.isExhausted = false;
    }
    
    // 重置行动相关状态
    player.damage = 0;
    player.cardsPlayed = 0;
    player.played = [];
    
    this.addLog(`⚔️ 进入行动阶段 - 打牌、技能、式神调整、分配伤害（可自由组合）`);
    this.notifyChange();
  }

  // ============ 玩家操作 ============

  /** 打出手牌 */
  async playCard(cardInstanceId: string): Promise<boolean> {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;

    const card = player.hand.splice(index, 1)[0]!;
    player.played.push(card);
    player.cardsPlayed++;

    // 检查是否有TempBuff影响伤害
    const spellDamageBonus = this.getTempBuffValue('SPELL_DAMAGE_BONUS');
    const spellBonusRemaining = this.getTempBuffRemaining('SPELL_DAMAGE_BONUS');

    // 根据卡牌类型产生效果
    if (card.cardType === 'spell') {
      // 阴阳术：累积伤害
      let damageValue = card.damage || card.hp || 1;
      
      // 应用阴阳术伤害加成（如山童「怪力」）
      if (spellBonusRemaining > 0) {
        damageValue += spellDamageBonus;
        this.consumeTempBuff('SPELL_DAMAGE_BONUS');
        this.addLog(`📜 打出【${card.name}】，伤害+${card.damage || 1}+${spellDamageBonus}（怪力加成）`);
      } else {
        this.addLog(`📜 打出【${card.name}】，伤害+${damageValue}`);
      }
      
      player.damage += damageValue;
      
    } else if (card.cardType === 'yokai') {
      // 妖怪卡（御魂）：触发御魂效果
      this.addLog(`🎴 打出御魂【${card.name}】`);
      
      // 执行御魂效果
      await this.executeYokaiEffect(card);
      
      // 检查轮入道效果（御魂效果翻倍）
      if (this.hasTempBuff('DOUBLE_YOKAI_EFFECT')) {
        this.addLog(`🔄 轮入道效果：再次执行御魂效果！`);
        await this.executeYokaiEffect(card);
        this.consumeTempBuff('DOUBLE_YOKAI_EFFECT');
      }
    }

    this.addLog(`💥 当前伤害:${player.damage}`);
    this.notifyChange();
    return true;
  }

  /** 执行妖怪御魂效果 */
  private async executeYokaiEffect(card: CardInstance): Promise<void> {
    const player = this.getPlayer();
    
    // 查找效果定义
    const effectDef = YOKAI_EFFECT_DEFS.find(d => d.cardId === card.cardId);
    
    if (effectDef && effectDef.effects.length > 0) {
      // 创建效果上下文
      const ctx = this.createEffectContext(card);
      
      // 执行效果
      await effectEngine.execute(effectDef.effects, ctx);
      
      this.addLog(`✨ 执行【${card.name}】的${effectDef.skillName || '御魂'}效果`);
    } else {
      // 没有定义的效果，使用默认逻辑（基于卡牌数据）
      this.executeDefaultYokaiEffect(card);
    }
  }

  /** 默认御魂效果（用于未定义的卡牌） */
  private executeDefaultYokaiEffect(card: CardInstance): void {
    const player = this.getPlayer();
    
    // 基础伤害
    if (card.damage && card.damage > 0) {
      player.damage += card.damage;
      this.addLog(`⚔️ 伤害+${card.damage}`);
    }
  }

  /** 创建效果执行上下文 */
  private createEffectContext(sourceCard?: CardInstance): EffectContext {
    return {
      gameState: this.state,
      player: this.getPlayer(),
      sourceCard,
      onChoice: this.onChoiceRequired,
      onSelectTarget: this.onSelectTargetRequired,
      onSelectCards: this.onSelectCardsRequired,
    };
  }

  // ============ TempBuff 管理 ============

  private getTempBuffValue(buffType: string): number {
    const player = this.getPlayer();
    const buff = player.tempBuffs.find(b => b.type === buffType) as any;
    // 兼容多种buff结构
    return buff?.value ?? buff?.bonus ?? buff?.bonusPerSpell ?? 0;
  }

  private getTempBuffRemaining(buffType: string): number {
    const player = this.getPlayer();
    const buff = player.tempBuffs.find(b => b.type === buffType) as any;
    return buff?.remainingUses ?? buff?.remainingCount ?? 0;
  }

  private hasTempBuff(buffType: string): boolean {
    const player = this.getPlayer();
    return player.tempBuffs.some(b => {
      if (b.type !== buffType) return false;
      const anyBuff = b as any;
      const remaining = anyBuff.remainingUses ?? anyBuff.remainingCount ?? 1;
      return remaining > 0;
    });
  }

  private consumeTempBuff(buffType: string): void {
    const player = this.getPlayer();
    const buff = player.tempBuffs.find(b => b.type === buffType) as any;
    if (buff) {
      // 支持不同的计数字段
      if (buff.remainingUses !== undefined) {
        buff.remainingUses--;
        if (buff.remainingUses <= 0) {
          const idx = player.tempBuffs.indexOf(buff);
          if (idx !== -1) player.tempBuffs.splice(idx, 1);
        }
      } else if (buff.remainingCount !== undefined) {
        buff.remainingCount--;
        if (buff.remainingCount <= 0) {
          const idx = player.tempBuffs.indexOf(buff);
          if (idx !== -1) player.tempBuffs.splice(idx, 1);
        }
      } else {
        // 一次性buff，直接移除
        const idx = player.tempBuffs.indexOf(buff);
        if (idx !== -1) player.tempBuffs.splice(idx, 1);
      }
    }
  }

  private addTempBuff(buffType: string, value: number, uses: number = 1): void {
    const player = this.getPlayer();
    // 使用简化的buff格式，兼容TempBuff类型
    player.tempBuffs.push({
      type: buffType as any,
      value,
      remainingUses: uses,
    } as any);
  }

  private getTempBuffByType(buffType: string): any {
    const player = this.getPlayer();
    return player.tempBuffs.find(b => b.type === buffType);
  }

  /** 使用式神技能 */
  async useShikigamiSkill(shikigamiId: string, skillName?: string): Promise<boolean> {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const shikigami = player.shikigami.find(s => s.id === shikigamiId);
    const shikigamiState = player.shikigamiState.find(s => s.cardId === shikigamiId);
    
    if (!shikigami || !shikigamiState) return false;
    
    // 获取技能定义
    const effectDefs = SHIKIGAMI_EFFECT_DEFS.filter(d => d.cardId === shikigamiId);
    const skillDef = skillName 
      ? effectDefs.find(d => d.skillName === skillName)
      : effectDefs.find(d => d.effectType === '启');  // 默认使用主动技
    
    if (!skillDef) {
      // 没有效果定义，使用旧逻辑
      return this.useShikigamiSkillLegacy(shikigamiId, shikigamiState);
    }
    
    // 检查疲劳状态
    if (shikigamiState.isExhausted && skillDef.effectType === '启') {
      this.addLog(`❌ ${shikigami.name} 已疲劳，本回合无法再次使用`);
      this.notifyChange();
      return false;
    }
    
    // 检查鬼火消耗
    const cost = skillDef.cost?.ghostFire || 0;
    
    // 检查是否有技能费用减少buff（如涅槃之火）
    const costReduction = this.getTempBuffValue('SKILL_COST_REDUCE');
    const actualCost = Math.max(0, cost - costReduction);
    
    if (player.ghostFire < actualCost) {
      this.addLog(`❌ 鬼火不足！需要 ${actualCost}，当前 ${player.ghostFire}`);
      this.notifyChange();
      return false;
    }
    
    // 消耗鬼火
    player.ghostFire -= actualCost;
    
    // 如果是主动技，标记疲劳
    if (skillDef.effectType === '启') {
      shikigamiState.isExhausted = true;
    }
    
    this.addLog(`🦊 ${shikigami.name} 发动【${skillDef.skillName}】`);
    
    // 创建效果上下文
    const ctx = this.createEffectContext();
    
    // 执行技能效果
    if (skillDef.effects.length > 0) {
      await effectEngine.execute(skillDef.effects, ctx);
    }
    
    // 检查是否有式神技能伤害加成（如针女御魂）
    const skillDamageBonus = this.getTempBuffValue('SKILL_DAMAGE_BONUS');
    if (skillDamageBonus > 0) {
      player.damage += skillDamageBonus;
      this.addLog(`💥 针女加成：伤害+${skillDamageBonus}`);
    }
    
    // 特殊技能处理（需要额外逻辑的）
    await this.handleSpecialShikigamiSkill(shikigamiId, skillDef.skillName || '');
    
    this.addLog(`💥 当前伤害:${player.damage}`);
    this.notifyChange();
    return true;
  }

  /** 旧版式神技能（兼容） */
  private useShikigamiSkillLegacy(shikigamiId: string, state: any): boolean {
    const player = this.getPlayer();
    const shikigami = player.shikigami.find(s => s.id === shikigamiId);
    if (!shikigami) return false;
    
    if (state.isExhausted) {
      this.addLog(`❌ ${shikigami.name} 已疲劳`);
      this.notifyChange();
      return false;
    }
    
    const cost = shikigami.skill?.cost || 0;
    if (player.ghostFire < cost) {
      this.addLog(`❌ 鬼火不足！需要 ${cost}，当前 ${player.ghostFire}`);
      this.notifyChange();
      return false;
    }
    
    player.ghostFire -= cost;
    state.isExhausted = true;
    
    const skillDamage = shikigami.skill?.damage || 2;
    player.damage += skillDamage;
    
    this.addLog(`🦊 ${shikigami.name} 发动【${shikigami.skill?.name}】，伤害+${skillDamage}`);
    this.notifyChange();
    return true;
  }

  /** 处理特殊式神技能逻辑 */
  private async handleSpecialShikigamiSkill(shikigamiId: string, skillName: string): Promise<void> {
    const player = this.getPlayer();
    
    switch (shikigamiId) {
      // 山童「怪力」- 本回合前2张阴阳术+1伤害
      case 'shikigami_022':
        if (skillName === '怪力') {
          this.addTempBuff('SPELL_DAMAGE_BONUS', 1, 2);
          this.addLog(`💪 怪力：接下来2张阴阳术伤害+1`);
        }
        break;
        
      // 茨木童子「迁怒」- 每退治/超度妖怪+2伤害
      case 'shikigami_004':
        if (skillName === '迁怒') {
          this.addTempBuff('YOKAI_KILL_BONUS', 2, 99);
          this.addLog(`👹 迁怒：本回合每退治/超度妖怪+2伤害`);
        }
        break;
        
      // 涅槃之火御魂效果 - 式神技能费用-1
      // 注：这个应该在御魂效果中处理，这里仅作示例
        
      // 轮入道 - 下一张御魂效果翻倍
      case 'yokai_020':
        this.addTempBuff('DOUBLE_YOKAI_EFFECT', 1, 1);
        this.addLog(`🔄 轮入道：下一张御魂效果将执行两次`);
        break;
        
      // 鬼使白「魂狩」- 首次退治生命≤6妖怪可进入手牌
      case 'shikigami_009':
        if (skillName === '魂狩') {
          this.addTempBuff('FIRST_KILL_TO_HAND', 6, 1);
          this.addLog(`👻 魂狩：本回合首次退治生命≤6妖怪可置入手牌`);
        }
        break;
    }
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
    this.yokaiKilledCount++;

    // 检查「魂狩」效果：首次退治生命≤6妖怪可进入手牌
    const firstKillToHandBuff = player.tempBuffs.find(b => b.type === 'FIRST_KILL_TO_HAND');
    if (firstKillToHandBuff && yokai.hp <= (firstKillToHandBuff.value || 6) && this.yokaiKilledCount === 1) {
      // 进入手牌而非弃牌堆
      player.hand.push(yokai);
      this.consumeTempBuff('FIRST_KILL_TO_HAND');
      this.addLog(`👻 魂狩效果：【${yokai.name}】进入手牌！`);
    } else {
      // 妖怪进入弃牌堆（成为御魂）
      player.discard.push(yokai);
    }
    
    this.state.field.yokaiSlots[slotIndex] = null;

    // 检查「迁怒」效果：每退治妖怪+伤害
    const yokaiKillBonus = this.getTempBuffValue('YOKAI_KILL_BONUS');
    if (yokaiKillBonus > 0) {
      player.damage += yokaiKillBonus;
      this.addLog(`👹 迁怒加成：伤害+${yokaiKillBonus}`);
    }

    // 更新声誉
    if (yokai.charm) {
      player.totalCharm += yokai.charm;
    }

    this.addLog(`✨ 退治了【${yokai.name}】！声誉+${yokai.charm || 0}`);
    
    // 检查「鲤鱼精」被动效果：首次退治可放牌库顶
    // 这需要UI确认，暂时跳过
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

  // ============ 式神获取与置换系统 ============

  /** 计算手牌中阴阳术卡的总伤害值 */
  getSpellDamageInHand(): number {
    const player = this.getPlayer();
    return player.hand
      .filter(c => c.cardType === 'spell')
      .reduce((sum, c) => sum + (c.damage || c.hp || 1), 0);
  }

  /** 获取手牌中的阴阳术卡 */
  getSpellCardsInHand(): CardInstance[] {
    const player = this.getPlayer();
    return player.hand.filter(c => c.cardType === 'spell');
  }

  /** 检查卡牌是否为高级符咒（高级符咒或专属符咒，伤害=3） */
  private isAdvancedSpell(card: CardInstance): boolean {
    const name = card.name || '';
    // 高级符咒、专属符咒都算高级
    return name === '高级符咒' || name.includes('专属') || (card.damage === 3 && card.cardType === 'spell');
  }

  /** 检查手牌中是否有高级符咒 */
  hasAdvancedSpellInHand(): boolean {
    const player = this.getPlayer();
    return player.hand.some(c => c.cardType === 'spell' && this.isAdvancedSpell(c));
  }

  /** 检查是否可以获取式神（式神<3，有高级符咒，总伤害≥5点） */
  canAcquireShikigami(): boolean {
    if (this.state.turnPhase !== 'action') return false;
    const player = this.getPlayer();
    if (player.shikigami.length >= GAME_CONSTANTS.MAX_SHIKIGAMI) return false;
    if (!this.state.field.shikigamiSupply || this.state.field.shikigamiSupply.length === 0) return false;
    
    // 必须有高级符咒
    if (!this.hasAdvancedSpellInHand()) return false;
    
    // 总伤害必须≥5点
    if (this.getSpellDamageInHand() < 5) return false;
    
    return true;
  }

  /** 检查是否可以置换式神（式神=3，有1张高级符咒） */
  canReplaceShikigami(): boolean {
    if (this.state.turnPhase !== 'action') return false;
    const player = this.getPlayer();
    if (player.shikigami.length !== GAME_CONSTANTS.MAX_SHIKIGAMI) return false;
    if (!this.state.field.shikigamiSupply || this.state.field.shikigamiSupply.length === 0) return false;
    
    // 必须有高级符咒
    return this.hasAdvancedSpellInHand();
  }

  /** 获取式神（需要恰好5点伤害，含高级符咒） */
  async acquireShikigami(spellInstanceIds: string[]): Promise<boolean> {
    if (!this.canAcquireShikigami()) {
      this.addLog(`❌ 无法获取式神`);
      return false;
    }

    const player = this.getPlayer();
    
    // 验证选中的卡牌
    const selectedSpells = spellInstanceIds
      .map(id => player.hand.find(c => c.instanceId === id))
      .filter((c): c is CardInstance => c !== undefined && c.cardType === 'spell');
    
    const totalDamage = selectedSpells.reduce((sum, c) => sum + (c.damage || c.hp || 1), 0);
    
    // 必须≥5点
    if (totalDamage < 5) {
      this.addLog(`❌ 符咒伤害必须≥5点（当前${totalDamage}点）`);
      return false;
    }
    
    // 必须包含高级符咒
    if (!selectedSpells.some(c => this.isAdvancedSpell(c))) {
      this.addLog(`❌ 必须包含至少1张高级符咒`);
      return false;
    }

    // 将选中的卡牌移入超度区
    for (const spell of selectedSpells) {
      const idx = player.hand.findIndex(c => c.instanceId === spell.instanceId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.exiled.push(spell);
      }
    }
    this.addLog(`📿 超度 ${selectedSpells.map(s => s.name).join('、')}（共${totalDamage}点伤害）`);

    // 从式神供应堆抽取2张
    const supply = this.state.field.shikigamiSupply!;
    const drawnShikigami = supply.splice(0, Math.min(2, supply.length));
    
    if (drawnShikigami.length === 0) {
      this.addLog(`❌ 式神供应堆已空`);
      return false;
    }

    // 让玩家选择1张
    let selectedIndex = 0;
    if (drawnShikigami.length > 1 && this.onChoiceRequired) {
      const options = drawnShikigami.map(s => `${s.name}（${s.rarity}）`);
      selectedIndex = await this.onChoiceRequired(options);
    }

    const selectedShikigami = drawnShikigami[selectedIndex]!;
    const notSelected = drawnShikigami.filter((_, i) => i !== selectedIndex);

    // 将选中的式神加入玩家式神区
    player.shikigami.push(selectedShikigami);
    player.shikigamiState.push({
      cardId: selectedShikigami.id,
      isExhausted: false,
      markers: {}
    });

    // 将未选中的放回供应堆底部
    supply.push(...notSelected);

    this.addLog(`🦊 获得式神【${selectedShikigami.name}】！（${selectedShikigami.rarity}）`);
    this.addLog(`📋 当前式神数量：${player.shikigami.length}/${GAME_CONSTANTS.MAX_SHIKIGAMI}`);
    
    this.notifyChange();
    return true;
  }

  /** 置换式神（需要1张高级符咒=3点） */
  async replaceShikigami(spellInstanceIds: string[], oldShikigamiId: string): Promise<boolean> {
    if (!this.canReplaceShikigami()) {
      this.addLog(`❌ 无法置换式神`);
      return false;
    }

    const player = this.getPlayer();

    // 验证选中的卡牌（必须是1张高级符咒）
    const selectedSpells = spellInstanceIds
      .map(id => player.hand.find(c => c.instanceId === id))
      .filter((c): c is CardInstance => c !== undefined && c.cardType === 'spell');
    
    // 必须恰好选择1张
    if (selectedSpells.length !== 1) {
      this.addLog(`❌ 置换需要恰好选择1张高级符咒`);
      return false;
    }
    
    // 必须是高级符咒
    if (!this.isAdvancedSpell(selectedSpells[0]!)) {
      this.addLog(`❌ 置换需要1张高级符咒或专属符咒`);
      return false;
    }

    // 验证要替换的式神
    const oldShikigamiIndex = player.shikigami.findIndex(s => s.id === oldShikigamiId);
    if (oldShikigamiIndex === -1) {
      this.addLog(`❌ 未找到要替换的式神`);
      return false;
    }
    const oldShikigami = player.shikigami[oldShikigamiIndex]!;

    // 将选中的卡牌移入超度区
    for (const spell of selectedSpells) {
      const idx = player.hand.findIndex(c => c.instanceId === spell.instanceId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.exiled.push(spell);
      }
    }
    this.addLog(`📿 超度 ${selectedSpells.map(s => s.name).join('、')}（共${totalDamage}点伤害）`);

    // 将旧式神放回供应堆底部
    const supply = this.state.field.shikigamiSupply!;
    supply.push(oldShikigami);
    this.addLog(`↩️ ${oldShikigami.name} 返回式神供应堆`);

    // 从供应堆抽取2张
    const drawnShikigami = supply.splice(0, Math.min(2, supply.length));
    
    if (drawnShikigami.length === 0) {
      this.addLog(`❌ 式神供应堆已空`);
      return false;
    }

    // 让玩家选择1张
    let selectedIndex = 0;
    if (drawnShikigami.length > 1 && this.onChoiceRequired) {
      const options = drawnShikigami.map(s => `${s.name}（${s.rarity}）`);
      selectedIndex = await this.onChoiceRequired(options);
    }

    const selectedShikigami = drawnShikigami[selectedIndex]!;
    const notSelected = drawnShikigami.filter((_, i) => i !== selectedIndex);

    // 替换式神
    player.shikigami[oldShikigamiIndex] = selectedShikigami;
    player.shikigamiState[oldShikigamiIndex] = {
      cardId: selectedShikigami.id,
      isExhausted: false,
      markers: {}
    };

    // 将未选中的放回供应堆底部
    supply.push(...notSelected);

    this.addLog(`🔄 置换式神：${oldShikigami.name} → ${selectedShikigami.name}（${selectedShikigami.rarity}）`);
    
    this.notifyChange();
    return true;
  }

  /** 通过地藏像获取式神（免费，不消耗阴阳术） */
  async acquireShikigamiFromJizo(): Promise<boolean> {
    const player = this.getPlayer();
    
    // 检查式神上限
    if (player.shikigami.length >= GAME_CONSTANTS.MAX_SHIKIGAMI) {
      this.addLog(`❌ 已达式神上限（${GAME_CONSTANTS.MAX_SHIKIGAMI}个）`);
      return false;
    }

    const supply = this.state.field.shikigamiSupply;
    if (!supply || supply.length === 0) {
      this.addLog(`❌ 式神供应堆已空`);
      return false;
    }

    // 从式神供应堆抽取2张
    const drawnShikigami = supply.splice(0, Math.min(2, supply.length));

    // 让玩家选择1张
    let selectedIndex = 0;
    if (drawnShikigami.length > 1 && this.onChoiceRequired) {
      const options = drawnShikigami.map(s => `${s.name}（${s.rarity}）`);
      selectedIndex = await this.onChoiceRequired(options);
    }

    const selectedShikigami = drawnShikigami[selectedIndex]!;
    const notSelected = drawnShikigami.filter((_, i) => i !== selectedIndex);

    // 将选中的式神加入玩家式神区
    player.shikigami.push(selectedShikigami);
    player.shikigamiState.push({
      cardId: selectedShikigami.id,
      isExhausted: false,
      markers: {}
    });

    // 将未选中的放回供应堆底部
    supply.push(...notSelected);

    this.addLog(`🗿 地藏像效果：获得式神【${selectedShikigami.name}】！`);
    this.addLog(`📋 当前式神数量：${player.shikigami.length}/${GAME_CONSTANTS.MAX_SHIKIGAMI}`);
    
    this.notifyChange();
    return true;
  }
}
