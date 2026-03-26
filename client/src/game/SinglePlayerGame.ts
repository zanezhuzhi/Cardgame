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
  BossCard,
  CardType
} from '../../../shared/types/cards';

// 导入卡牌数据（直接从JSON）
import cardsData from '../../../shared/data/cards.json';

// 导入御魂效果执行器及弃置触发辅助函数
import { executeYokaiEffect as executeYokaiEffectHandler, onTreeDemonDiscard, onSanmiDiscard } from '../../../shared/game/effects/YokaiEffects';

// 导入式神技能执行器
import { executeSkill as executeShikigamiSkill } from '../../../shared/game/effects/ShikigamiSkills';

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
  private hasGainedMediumSpell: boolean = false; // 本回合是否已获得中级符咒
  private hasGainedAdvancedSpell: boolean = false; // 本回合是否已获得高级符咒
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
    // 立即通知初始状态，让 Vue 进入式神选取阶段
    this.notifyChange();
  }

  // ============ 初始化 ============

  private createInitialState(playerName: string): GameState {
    const player = this.createPlayer('player_1', playerName);
    const field = this.createField();

    // 随机抽取4个式神供选择
    const shuffledShikigami = shuffle([...cardsData.shikigami]) as ShikigamiCard[];
    const shikigamiOptions = shuffledShikigami.slice(0, 4);

    return {
      roomId: 'single_player',
      phase: 'shikigamiSelect',  // 先进入式神选取阶段
      players: [player],
      currentPlayerIndex: 0,
      turnNumber: 0,
      turnPhase: 'ghostFire',
      field,
      log: [],
      lastUpdate: Date.now(),
      lastPlayerKilledYokai: true,  // 首回合不触发刷新选项
      pendingYokaiRefresh: false,
      // 式神选取相关
      shikigamiOptions,      // 可选的4个式神
      selectedShikigami: []  // 已选的式神
    } as GameState;
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
    
    // 招福达摩（初始卡，3张）- token类型，不能打出
    const daruma = cardsData.token[0];  // 直接从token数组获取
    for (let i = 0; i < 3; i++) {
      deck.push(this.createCardInstance(daruma, 'token'));
    }

    // 式神在选取阶段确定，初始为空
    return {
      id,
      name,
      onmyoji: cardsData.onmyoji[0] as OnmyojiCard,
      shikigami: [],  // 初始为空，在选取阶段填充
      maxShikigami: GAME_CONSTANTS.MAX_SHIKIGAMI,
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
      shikigamiState: [],  // 在选取阶段填充
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
      medium: [],
      advanced: []
    };
    for (const spell of cardsData.spell as any[]) {
      const count = spell.count || 10;
      for (let i = 0; i < count; i++) {
        const instance = this.createCardInstance(spell, 'spell');
        // 根据名称判断阴阳术等级
        if (spell.name === '基础术式') spellSupply.basic.push(instance);
        else if (spell.name === '中级符咒') spellSupply.medium.push(instance);
        else if (spell.name === '高级符咒') spellSupply.advanced.push(instance);
      }
    }

    // 创建式神供应堆（洗混后，移除已发给玩家的式神）
    const allShikigami = shuffle([...cardsData.shikigami]) as ShikigamiCard[];

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossCurrentHp: 0,
      bossDeck,
      penaltyPile: shuffle(penaltyPile),
      yokaiDeck: shuffle(yokaiDeck),
      spellSupply: {
        basic: spellSupply.basic,
        medium: spellSupply.medium,
        advanced: spellSupply.advanced
      },
      spellCounts: {
        basic: spellSupply.basic.length,
        medium: spellSupply.medium.length,
        advanced: spellSupply.advanced.length
      },
      tokenShop: 10,  // 招福达摩
      exileZone: [],
      shikigamiSupply: allShikigami  // 式神供应堆（商店）
    } as FieldState;
  }

  private createCardInstance(card: any, type: string): CardInstance {
    return {
      instanceId: generateId(),
      cardId: card.id,
      cardType: type as CardType,
      name: card.name,
      hp: card.hp || card.damage || 1,  // hp也可表示伤害值
      maxHp: card.hp || card.damage || 1,
      charm: card.charm || 0,
      damage: card.damage || 0,  // 阴阳术的伤害值
      effect: card.effect,
      image: card.image || ''
    };
  }

  // ============ 游戏流程 ============

  // ============ 式神选取阶段 ============

  /** 选择式神（在选取阶段调用） */
  selectShikigami(shikigamiId: string): void {
    const state = this.state as any;
    
    // 检查是否在选取阶段
    if (this.state.phase !== 'shikigamiSelect') {
      this.addLog('⚠️ 当前不在式神选取阶段');
      return;
    }
    
    // 检查是否已选满2个
    if ((state.selectedShikigami?.length || 0) >= 2) {
      this.addLog('⚠️ 已选择2个式神');
      return;
    }
    
    // 检查是否在可选列表中
    const options = state.shikigamiOptions as ShikigamiCard[];
    const selected = options.find(s => s.id === shikigamiId);
    if (!selected) {
      this.addLog('⚠️ 无效的式神选择');
      return;
    }
    
    // 检查是否已选择过
    if (state.selectedShikigami?.some((s: ShikigamiCard) => s.id === shikigamiId)) {
      this.addLog('⚠️ 该式神已被选择');
      return;
    }
    
    // 添加到已选列表
    if (!state.selectedShikigami) state.selectedShikigami = [];
    state.selectedShikigami.push(selected);
    this.addLog(`✅ 选择式神：${selected.name}（${state.selectedShikigami.length}/2）`);
    
    // 不再自动开始，等待玩家点击确认按钮
    this.notifyChange();
  }

  /** 取消选择式神 */
  deselectShikigami(shikigamiId: string): void {
    const state = this.state as any;
    
    if (this.state.phase !== 'shikigamiSelect') return;
    
    const idx = state.selectedShikigami?.findIndex((s: ShikigamiCard) => s.id === shikigamiId);
    if (idx !== undefined && idx >= 0) {
      const removed = state.selectedShikigami.splice(idx, 1)[0];
      this.addLog(`❌ 取消选择：${removed.name}`);
      this.notifyChange();
    }
  }

  /** 确认式神选择，开始游戏 */
  confirmShikigamiSelection(): void {
    const state = this.state as any;
    
    if (this.state.phase !== 'shikigamiSelect') {
      this.addLog('⚠️ 当前不在式神选取阶段');
      return;
    }
    
    if ((state.selectedShikigami?.length || 0) < 2) {
      this.addLog('⚠️ 请先选择2个式神');
      return;
    }
    
    // 将选择的式神设置给玩家
    const player = this.getPlayer();
    player.shikigami = state.selectedShikigami;
    player.shikigamiState = player.shikigami.map(s => ({
      cardId: s.id,
      isExhausted: false,
      markers: {}
    }));
    
    this.addLog(`🎭 式神阵容确定：${player.shikigami.map(s => s.name).join('、')}`);
    
    // 清理选取状态
    delete state.shikigamiOptions;
    delete state.selectedShikigami;
    
    // 正式开始游戏
    this.startGame();
  }

  startGame(): void {
    // 抓5张起始手牌
    this.drawCards(GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // TEST1: 初始手牌增加1/2/3阶阴阳术（测试获得式神）
    // 关闭方式：将 TEST1_ENABLED 改为 false
    const TEST1_ENABLED = false;
    if (TEST1_ENABLED) {
      const player = this.getPlayer();
      const testSpells: CardInstance[] = [
        { instanceId: generateId(), cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, damage: 1, charm: 0 },
        { instanceId: generateId(), cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, damage: 2, charm: 0 },
        { instanceId: generateId(), cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, damage: 3, charm: 1 },
      ];
      player.hand.push(...testSpells);
      this.addLog('🧪 [TEST1] 添加测试阴阳术：1+2+3=6点伤害');
    }
    // END TEST1
    
    // TEST2: 初始手牌增加1/2/3/3阶阴阳术（测试置换式神）
    // 关闭方式：将 TEST2_ENABLED 改为 false
    const TEST2_ENABLED = false;
    if (TEST2_ENABLED) {
      const player = this.getPlayer();
      const testSpells: CardInstance[] = [
        { instanceId: generateId(), cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, damage: 1, charm: 0 },
        { instanceId: generateId(), cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, damage: 2, charm: 0 },
        { instanceId: generateId(), cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, damage: 3, charm: 1 },
        { instanceId: generateId(), cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, damage: 3, charm: 1 },
      ];
      player.hand.push(...testSpells);
      this.addLog('🧪 [TEST2] 添加测试阴阳术：1+2+3+3=9点（可测试置换式神）');
    }
    // END TEST2
    
    // TEST3: 测试中级/高级符咒获取条件
    // 关闭方式：将 TEST3_ENABLED 改为 false
    const TEST3_ENABLED = false;
    if (TEST3_ENABLED) {
      const player = this.getPlayer();
      // 手牌增加：基础术式 + 中级符咒
      const testSpells: CardInstance[] = [
        { instanceId: generateId(), cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, damage: 1, charm: 0 },
        { instanceId: generateId(), cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, damage: 2, charm: 0 },
      ];
      player.hand.push(...testSpells);
      // 弃牌堆增加：生命≥2的妖怪 + 生命≥4的妖怪
      const testYokai: CardInstance[] = [
        { instanceId: generateId(), cardId: 'yokai_001', cardType: 'yokai', name: '赤舌', hp: 3, damage: 0, charm: 0 }, // 生命3≥2
        { instanceId: generateId(), cardId: 'yokai_010', cardType: 'yokai', name: '海坊主', hp: 5, damage: 0, charm: 1 }, // 生命5≥4
      ];
      player.discard.push(...testYokai);
      this.addLog('🧪 [TEST3] 添加测试卡牌：手牌(基础+中级)、弃牌堆(妖怪hp3+hp5)');
    }
    // END TEST3

    // TEST4: 手牌添加御魂妖怪（测试赤舌/唐纸伞妖/天邪鬼绿效果）
    // 关闭方式：将 TEST4_ENABLED 改为 false
    const TEST4_ENABLED = true;
    if (TEST4_ENABLED) {
      const player = this.getPlayer();
      const testYokai: CardInstance[] = [
        { instanceId: generateId(), cardId: 'yokai_001', cardType: 'yokai', name: '赤舌', hp: 2, maxHp: 2, damage: 0, charm: 1 },
        { instanceId: generateId(), cardId: 'yokai_002', cardType: 'yokai', name: '唐纸伞妖', hp: 2, maxHp: 2, damage: 0, charm: 0 },
        { instanceId: generateId(), cardId: 'yokai_003', cardType: 'yokai', name: '天邪鬼绿', hp: 2, maxHp: 2, damage: 0, charm: 0 },
      ];
      player.hand.push(...testYokai);
      this.addLog('🧪 [TEST4] 添加测试御魂：赤舌、唐纸伞妖、天邪鬼绿');
    }
    // END TEST4
    
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
    this.hasGainedMediumSpell = false;
    this.hasGainedAdvancedSpell = false;
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

  /** 
   * 检查卡牌是否可以打出
   * @returns { canPlay: boolean, reason?: string }
   */
  canPlayCard(card: CardInstance): { canPlay: boolean; reason?: string } {
    // 令牌（招福达摩）不能打出
    if (card.cardType === 'token') {
      return { canPlay: false, reason: '令牌不能打出' };
    }
    
    // 恶评卡不能打出
    if (card.cardType === 'penalty') {
      return { canPlay: false, reason: '恶评卡不能打出' };
    }
    
    // 式神卡不能从手牌打出（需要通过召唤）
    if (card.cardType === 'shikigami') {
      return { canPlay: false, reason: '式神卡不能直接打出' };
    }
    
    // 御魂卡（妖怪/鬼王）：检查是否有合法目标
    if (card.cardType === 'yokai' || card.cardType === 'boss') {
      const targetCheck = this.checkYokaiEffectTargets(card);
      if (!targetCheck.hasValidTarget) {
        return { canPlay: false, reason: targetCheck.reason };
      }
      return { canPlay: true };
    }
    
    // 阴阳术可以打出
    if (card.cardType === 'spell') {
      return { canPlay: true };
    }
    
    return { canPlay: false, reason: '该卡牌无法打出' };
  }

  /**
   * 检查御魂效果是否有合法目标
   * 规则：
   * - 如果卡牌只有一个效果且需要目标，无目标时不能打出
   * - 如果卡牌有多个效果，只要有一个效果能执行就可以打出
   * - 无法选择目标的效果在执行时自动跳过
   */
  private checkYokaiEffectTargets(card: CardInstance): { hasValidTarget: boolean; reason?: string } {
    const yokaiSlots = this.state.field.yokaiSlots;
    const player = this.getPlayer();
    
    // 辅助函数
    const hasLowHpYokai = (maxHp: number) =>
      yokaiSlots.some(y => {
        if (!y) return false
        const hp = y.currentHp ?? y.hp ?? 0
        return hp > 0 && hp <= maxHp
      });
    const hasAnyYokai = () => yokaiSlots.some(y => y !== null);
    const hasOtherHandCards = () => player.hand.length > 1;
    const hasDiscard = () => player.discard.length > 0;
    const hasDeck = () => player.deck.length > 0;
    
    // 根据卡牌名称检查效果
    // 【单效果卡】：唯一效果需要目标才能打出
    // 【多效果卡】：任一效果可执行即可打出
    
    switch (card.name) {
      // ============ 单效果卡（唯一效果需要目标）============
      
      // 退治生命≤4的游荡妖怪
      case '天邪鬼绿':
        if (!hasLowHpYokai(4)) {
          return { hasValidTarget: false, reason: '没有生命≤4的游荡妖怪' };
        }
        break;
      
      // 需要生命≤6的游荡妖怪
      case '海坊主':
        if (!hasLowHpYokai(6)) {
          return { hasValidTarget: false, reason: '没有生命≤6的游荡妖怪' };
        }
        break;
      
      // 需要有游荡妖怪作为唯一目标
      case '提灯小僧':  // 对1个游荡妖怪造成2点伤害
      case '古笼火':    // 退治1个游荡妖怪
        if (!hasAnyYokai()) {
          return { hasValidTarget: false, reason: '没有游荡妖怪' };
        }
        break;
      
      // 需要弃牌堆有牌（唯一效果）
      case '一目连':    // 从弃牌堆选1张放回手牌
        if (!hasDiscard()) {
          return { hasValidTarget: false, reason: '弃牌堆为空' };
        }
        break;
        
      // ============ 多效果卡（有附带效果可执行）============
      
      // 唐纸伞妖：伤害+1（必定成功）+ 查看牌库顶（可选）
      // → 即使牌库为空，伤害+1仍可执行，所以可以打出
      case '唐纸伞妖':
        // 伤害+1 是必定成功的效果
        break;
      
      // 天邪鬼赤：伤害+1（必定成功）+ 换牌（可选）
      case '天邪鬼赤':
        // 伤害+1 是必定成功的效果
        break;
      
      // 天邪鬼黄：抓牌+2（必定成功）+ 置顶1张（有手牌时）
      case '天邪鬼黄':
        // 抓牌+2 是必定成功的效果（除非牌库为空）
        break;
      
      // 树妖：抓牌+2（必定成功）+ 弃置1张（需要手牌）
      case '树妖':
        // 抓牌+2 是必定成功的效果
        break;
      
      // 河童：伤害+2（必定成功）+ 弃置手牌抓牌（需要手牌）
      case '河童':
        // 伤害+2 是必定成功的效果
        break;
      
      // 雪女：伤害+1（必定成功）+ 弃置抓牌（可选）
      case '雪女':
        // 伤害+1 是必定成功的效果
        break;
      
      // 座敷童子：选择效果（抓牌 或 从弃牌堆取回）
      // 如果弃牌堆为空，则只能选抓牌，仍可打出
      case '座敷童子':
        // 抓牌选项始终可用
        break;
      
      // 独眼小僧：查看牌库顶+判定
      case '独眼小僧':
        if (!hasDeck()) {
          return { hasValidTarget: false, reason: '牌库为空' };
        }
        break;
      
      // ============ 鬼王御魂 ============
      
      // 贪嗔痴：需要超度1张手牌（手牌数>1，因为这张牌本身也在手牌中）
      case '贪嗔痴':
        if (!hasOtherHandCards()) {
          return { hasValidTarget: false, reason: '没有其他手牌可超度' };
        }
        break;
      
      // 其他鬼王御魂都有"必定成功"的效果（伤害+N、抓牌+N、鬼火+N等）
      // 麒麟、石距、土蜘蛛、胧车、蜃气楼、荒骷髅、八岐大蛇：无需检查
      // 鬼灵歌伎、地震鲶：多人模式专用，暂不检查
    }
    
    return { hasValidTarget: true };
  }

  /** 打出手牌 */
  async playCard(cardInstanceId: string): Promise<boolean> {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const index = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (index === -1) return false;

    const card = player.hand[index];
    
    // 检查卡牌是否可以打出
    const { canPlay, reason } = this.canPlayCard(card);
    if (!canPlay) {
      this.addLog(`❌ 无法打出【${card.name}】：${reason}`);
      this.notifyChange();
      return false;
    }

    // 从手牌移除并放入已打出区
    player.hand.splice(index, 1);
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
      
      // 薙魂延迟触发：打出3张御魂时鬼火+2
      if (this.hasTempBuff('NAGINATA_SOUL_PENDING')) {
        const yokaiCount = player.played.filter(c => c.cardType === 'yokai').length;
        if (yokaiCount >= 3) {
          player.ghostFire = Math.min(player.ghostFire + 2, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.consumeTempBuff('NAGINATA_SOUL_PENDING');
          this.addLog(`🔥 薙魂触发：已打出${yokaiCount}张御魂，鬼火+2`);
        }
      }
    }

    this.addLog(`💥 当前伤害:${player.damage}`);
    this.notifyChange();
    return true;
  }

  /** 执行妖怪御魂效果 */
  private async executeYokaiEffect(card: CardInstance): Promise<void> {
    const player = this.getPlayer();
    const yokaiName = card.name;
    
    // 构建效果上下文
    const effectContext = {
      player,
      gameState: this.state,
      card,
      onSelectCards: this.onSelectCardsRequired,
      onChoice: this.onChoiceRequired,
      onSelectTarget: this.onSelectTargetRequired
    };
    
    try {
      // 调用真正的御魂效果处理器
      const result = await executeYokaiEffectHandler(yokaiName, effectContext);
      
      if (result.success) {
        this.addLog(`✨ ${yokaiName}御魂: ${result.message}`);
      } else {
        // 效果未找到或执行失败，使用默认逻辑
        this.addLog(`⚠️ ${result.message}`);
        this.executeDefaultYokaiEffect(card);
      }
    } catch (error) {
      // 发生错误时使用默认逻辑
      console.error(`御魂效果执行错误: ${yokaiName}`, error);
      this.executeDefaultYokaiEffect(card);
    }
    
    this.notifyChange();
  }

  /** 默认御魂效果（用于未定义的卡牌） */
  private executeDefaultYokaiEffect(card: CardInstance): void {
    const player = this.getPlayer();
    
    // 基础伤害
    if (card.damage && card.damage > 0) {
      player.damage += card.damage;
      this.addLog(`⚔️ ${card.name}：伤害+${card.damage}`);
    }
  }

  // createEffectContext 方法暂时移除（效果引擎重构中）

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

  /** 使用式神技能（简化版，效果引擎重构中） */
  async useShikigamiSkill(shikigamiId: string, _skillName?: string): Promise<boolean> {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const shikigami = player.shikigami.find(s => s.id === shikigamiId);
    const shikigamiState = player.shikigamiState.find(s => s.cardId === shikigamiId);
    
    if (!shikigami || !shikigamiState) return false;
    
    // 直接使用旧版兼容逻辑
    return this.useShikigamiSkillLegacy(shikigamiId, shikigamiState);
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

  /** 兑换中级符咒：超度基础术式 + 弃牌堆妖怪(hp≥2) */
  exchangeMediumSpell(yokaiInstanceId: string): boolean {
    console.log('[ENGINE] exchangeMediumSpell called with:', yokaiInstanceId);
    console.log('[ENGINE] turnPhase:', this.state.turnPhase);
    console.log('[ENGINE] hasGainedMediumSpell:', this.hasGainedMediumSpell);
    
    if (this.state.turnPhase !== 'action') {
      console.log('[ENGINE] not in action phase');
      return false;
    }
    if (this.hasGainedMediumSpell) {
      this.addLog(`❌ 本回合已获得过中级符咒`);
      this.notifyChange();
      return false;
    }
    
    const player = this.getPlayer();
    console.log('[ENGINE] hand count:', player.hand.length);
    console.log('[ENGINE] discard count:', player.discard.length);
    
    // 找到手牌中的基础术式
    const spellIndex = player.hand.findIndex(c => c.cardId === 'spell_001' || c.name === '基础术式');
    console.log('[ENGINE] spellIndex:', spellIndex);
    if (spellIndex < 0) {
      this.addLog(`❌ 手牌中没有基础术式`);
      this.notifyChange();
      return false;
    }
    
    // 找到弃牌堆中的目标妖怪
    console.log('[ENGINE] looking for yokai:', yokaiInstanceId);
    console.log('[ENGINE] discard instanceIds:', player.discard.map(c => c.instanceId));
    const yokaiIndex = player.discard.findIndex(c => c.instanceId === yokaiInstanceId);
    console.log('[ENGINE] yokaiIndex:', yokaiIndex);
    const yk = yokaiIndex >= 0 ? player.discard[yokaiIndex] : null;
    const ykLife = yk ? (yk.maxHp ?? yk.hp ?? 0) : 0;
    if (yokaiIndex < 0 || ykLife < 2) {
      this.addLog(`❌ 目标妖怪不符合条件 (index: ${yokaiIndex})`);
      this.notifyChange();
      return false;
    }
    
    // 超度基础术式
    const spell = player.hand.splice(spellIndex, 1)[0];
    player.exiled.push(spell);
    
    // 超度弃牌堆妖怪
    const yokai = player.discard.splice(yokaiIndex, 1)[0];
    player.exiled.push(yokai);
    
    // 获得中级符咒（放入弃牌堆）
    const newSpell: CardInstance = {
      instanceId: generateId(),
      cardId: 'spell_002',
      cardType: 'spell',
      name: '中级符咒',
      damage: 2,
      hp: 2,
      charm: 0
    };
    player.discard.push(newSpell);
    
    this.hasGainedMediumSpell = true;
    this.addLog(`🔄 兑换【中级符咒】：超度基础术式 + ${yokai.name} → 获得中级符咒（置入弃牌堆）`);
    this.notifyChange();
    return true;
  }

  /** 兑换高级符咒：超度中级符咒 + 弃牌堆妖怪(hp≥4) */
  exchangeAdvancedSpell(yokaiInstanceId: string): boolean {
    if (this.state.turnPhase !== 'action') return false;
    if (this.hasGainedAdvancedSpell) {
      this.addLog(`❌ 本回合已获得过高级符咒`);
      this.notifyChange();
      return false;
    }
    
    const player = this.getPlayer();
    
    // 找到手牌中的中级符咒
    const spellIndex = player.hand.findIndex(c => c.cardId === 'spell_002' || c.name === '中级符咒');
    if (spellIndex < 0) {
      this.addLog(`❌ 手牌中没有中级符咒`);
      this.notifyChange();
      return false;
    }
    
    // 找到弃牌堆中的目标妖怪
    const yokaiIndex = player.discard.findIndex(c => c.instanceId === yokaiInstanceId);
    const yk2 = yokaiIndex >= 0 ? player.discard[yokaiIndex] : null;
    const ykLife2 = yk2 ? (yk2.maxHp ?? yk2.hp ?? 0) : 0;
    if (yokaiIndex < 0 || ykLife2 < 4) {
      this.addLog(`❌ 目标妖怪不符合条件`);
      this.notifyChange();
      return false;
    }
    
    // 超度中级符咒
    const spell = player.hand.splice(spellIndex, 1)[0];
    player.exiled.push(spell);
    
    // 超度弃牌堆妖怪
    const yokai = player.discard.splice(yokaiIndex, 1)[0];
    player.exiled.push(yokai);
    
    // 获得高级符咒（放入弃牌堆）
    const newSpell: CardInstance = {
      instanceId: generateId(),
      cardId: 'spell_003',
      cardType: 'spell',
      name: '高级符咒',
      damage: 3,
      hp: 3,
      charm: 1
    };
    player.discard.push(newSpell);
    
    this.hasGainedAdvancedSpell = true;
    this.addLog(`🔄 兑换【高级符咒】：超度中级符咒 + ${yokai.name} → 获得高级符咒（置入弃牌堆）`);
    this.notifyChange();
    return true;
  }

  /** 检查本回合是否可以获得中级符咒 */
  canExchangeMediumSpell(): boolean {
    return !this.hasGainedMediumSpell && this.state.turnPhase === 'action';
  }

  /** 检查本回合是否可以获得高级符咒 */
  canExchangeAdvancedSpell(): boolean {
    return !this.hasGainedAdvancedSpell && this.state.turnPhase === 'action';
  }

  /** 
   * 分配伤害给妖怪（伤势累积模式）
   * 根据规则：伤害实时分配，伤势保留，可多次分配
   */
  async allocateDamage(targetSlotIndex: number): Promise<boolean> {
    if (this.state.turnPhase !== 'action') return false;
    
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[targetSlotIndex];
    
    if (!yokai) {
      this.addLog(`❌ 该位置没有妖怪`);
      this.notifyChange();
      return false;
    }

    // 已击杀的妖怪不能再分配伤害
    if (yokai.currentHp !== undefined && yokai.currentHp <= 0) {
      this.addLog(`⚠️ 【${yokai.name}】已被退治`);
      this.notifyChange();
      return false;
    }
    
    if (player.damage <= 0) {
      this.addLog(`❌ 没有可分配的伤害`);
      this.notifyChange();
      return false;
    }

    // 初始化当前HP（如果还没有）
    if (yokai.currentHp === undefined) {
      yokai.currentHp = yokai.hp;
    }

    // 计算可以造成的伤害（取玩家伤害和妖怪剩余HP的较小值）
    const damageToApply = Math.min(player.damage, yokai.currentHp);
    
    // 扣除伤害
    player.damage -= damageToApply;
    yokai.currentHp -= damageToApply;
    
    this.addLog(`⚔️ 对【${yokai.name}】造成 ${damageToApply} 点伤害（${yokai.currentHp}/${yokai.hp}）`);
    
    // 检查是否击杀 → 直接退治（进入弃牌堆）
    if (yokai.currentHp <= 0) {
      await this.killYokai(targetSlotIndex);
    }
    
    this.notifyChange();
    return true;
  }

  /**
   * 退治已击杀的妖怪（放入弃牌堆）
   */
  async retireYokai(slotIndex: number): Promise<boolean> {
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai || (yokai.currentHp !== undefined && yokai.currentHp > 0)) {
      this.addLog(`❌ 该妖怪尚未被击杀`);
      return false;
    }
    
    await this.killYokai(slotIndex);
    this.notifyChange();
    return true;
  }

  /**
   * 超度已击杀的妖怪（移出游戏）
   */
  banishYokai(slotIndex: number): boolean {
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai || (yokai.currentHp !== undefined && yokai.currentHp > 0)) {
      this.addLog(`❌ 该妖怪尚未被击杀`);
      return false;
    }
    
    // 从战场移除
    this.state.field.yokaiSlots[slotIndex] = null;
    
    // 移入公共超度区（移出游戏）
    this.state.field.exileZone.push(yokai);
    
    this.addLog(`📿 超度了【${yokai.name}】，移出游戏`);
    this.killedYokaiThisTurn = true;
    
    this.notifyChange();
    return true;
  }

  /** 攻击鬼王 */
  async attackBoss(damage: number): Promise<boolean> {
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
    this.state.field.bossCurrentHp -= damage;
    
    this.addLog(`⚔️ 对鬼王【${boss.name}】造成 ${damage} 点伤害（剩余:${this.state.field.bossCurrentHp}）`);
    
    // 检查鬼王是否被击败 → 直接退治（进入弃牌堆）
    if (this.state.field.bossCurrentHp <= 0) {
      this.state.field.bossCurrentHp = 0;
      await this.retireBoss();
      this.notifyChange();
      return true;
    }
    
    this.notifyChange();
    return true;
  }

  private async killYokai(slotIndex: number): Promise<void> {
    const player = this.getPlayer();
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) return;

    // 标记本回合击杀了妖怪
    this.killedYokaiThisTurn = true;
    this.yokaiKilledCount++;

    // 从战场移除妖怪
    this.state.field.yokaiSlots[slotIndex] = null;

    // 检查「魂狩」效果：首次退治生命≤6妖怪可进入手牌
    const firstKillToHandBuff = player.tempBuffs.find(b => b.type === 'FIRST_KILL_TO_HAND');
    if (firstKillToHandBuff && yokai.hp <= (firstKillToHandBuff.value || 6) && this.yokaiKilledCount === 1) {
      // 进入手牌而非弃牌堆
      player.hand.push(yokai);
      this.consumeTempBuff('FIRST_KILL_TO_HAND');
      this.addLog(`👻 魂狩效果：【${yokai.name}】进入手牌！`);
    } else {
      // 检查「鲤鱼精」被动效果：首次退治可放牌库顶
      const hasKoifish = player.shikigami.some(s => s.name === '鲤鱼精');
      const bubbleShieldUsed = player.tempBuffs.some(b => (b as any).source === '泡泡之盾');
      
      let placeOnTop = false;
      if (hasKoifish && !bubbleShieldUsed) {
        // 询问玩家是否要使用泡泡之盾
        const choice = await this.onChoiceRequired([
          `将【${yokai.name}】放到牌库顶（泡泡之盾）`,
          `将【${yokai.name}】放入弃牌堆`
        ]);
        
        if (choice === 0) {
          placeOnTop = true;
          // 标记本回合已使用泡泡之盾
          player.tempBuffs.push({
            type: 'BUBBLE_SHIELD_USED' as any,
            value: 0,
            duration: 1,
            source: '泡泡之盾'
          } as any);
          this.addLog(`🛡️ 泡泡之盾：【${yokai.name}】放入牌库顶`);
        }
      }
      
      if (placeOnTop) {
        // 放到牌库顶
        player.deck.push(yokai);
      } else {
        // 妖怪进入弃牌堆（成为御魂）：与多人模式一致，展示卡面生命而非场上剩余 0
        const printed = yokai.maxHp ?? yokai.hp ?? 0;
        if (printed > 0) {
          yokai.maxHp = printed;
          yokai.hp = printed;
        }
        delete (yokai as any).currentHp;
        player.discard.push(yokai);
      }
    }

    // 检查「迁怒」效果：每退治妖怪+伤害
    const yokaiKillBonus = this.getTempBuffValue('YOKAI_KILL_BONUS');
    if (yokaiKillBonus > 0) {
      player.damage += yokaiKillBonus;
      this.addLog(`👹 迁怒加成：伤害+${yokaiKillBonus}`);
    }

    // 声誉由 updateTotalCharm() 实时计算（卡牌进入弃牌堆后自动计入）
    this.addLog(`✨ 退治了【${yokai.name}】！声誉+${yokai.charm || 0}`);
  }

  /** 鬼王HP归零后，弹出退治/超度选择 */
  private async promptBossDefeat(): Promise<void> {
    const boss = this.state.field.currentBoss;
    if (!boss) return;

    // 部分鬼王有退治特殊效果提示
    const retireLabel = boss.retireEffect
      ? `退治【${boss.name}】（⚠️ ${boss.retireEffect}）`
      : `退治【${boss.name}】（进入弃牌堆，可作为御魂使用）`;
    const transcendLabel = `超度【${boss.name}】（移出游戏，不计入声誉）`;

    const choice = this.onChoiceRequired
      ? await this.onChoiceRequired([retireLabel, transcendLabel])
      : 1; // 无UI时默认超度

    if (choice === 0) {
      await this.retireBoss();
    } else {
      await this.banishBoss();
    }

    // 解锁操作
    this.state.turnPhase = 'action';
    this.notifyChange();
  }

  /** 退治鬼王：进弃牌堆 + 触发特殊退治效果 */
  async retireBoss(): Promise<void> {
    const player = this.getPlayer();
    const boss = this.state.field.currentBoss;
    if (!boss) return;

    const bossInstance = this.createCardInstance(boss, 'boss');

    // 鲤鱼精被动：首次退治可放牌库顶
    const hasKoifish = player.shikigami.some(s => s.name === '鲤鱼精');
    const bubbleUsed = player.tempBuffs.some(b => (b as any).source === '泡泡之盾');
    if (hasKoifish && !bubbleUsed && this.onChoiceRequired) {
      const c = await this.onChoiceRequired([
        `将【${boss.name}】放到牌库顶（泡泡之盾）`,
        `将【${boss.name}】放入弃牌堆`
      ]);
      if (c === 0) {
        player.deck.push(bossInstance);
        player.tempBuffs.push({ type: 'BUBBLE_SHIELD_USED' as any, value: 0, duration: 1, source: '泡泡之盾' } as any);
        this.addLog(`🛡️ 泡泡之盾：【${boss.name}】放到牌库顶`);
      } else {
        player.discard.push(bossInstance);
      }
    } else {
      player.discard.push(bossInstance);
    }

    // 地震鲶特殊退治效果：弃置阴阳师下的牌
    if (boss.name === '地震鲶') {
      const hidden = (player as any).hiddenCards as CardInstance[] | undefined;
      if (hidden && hidden.length > 0) {
        this.addLog(`🌊 地震鲶退治效果：弃置阴阳师下的 ${hidden.length} 张牌`);
        player.discard.push(...hidden);
        (player as any).hiddenCards = [];
      }
    }

    // 声誉由 updateTotalCharm() 实时计算（御魂进入弃牌堆后自动计入）
    this.addLog(`⛩️ 退治鬼王【${boss.name}】！声誉+${boss.charm || 0}，御魂进入弃牌堆`);

    this.state.field.currentBoss = null;
    this.state.field.bossCurrentHp = 0;
    this.revealNextBoss();
  }

  /** 超度鬼王：移出游戏，不获得声誉 */
  async banishBoss(): Promise<void> {
    const player = this.getPlayer();
    const boss = this.state.field.currentBoss;
    if (!boss) return;

    // 超度移出游戏，不计入声誉
    this.addLog(`✨ 超度鬼王【${boss.name}】！移出游戏（不计入声誉）`);

    this.state.field.currentBoss = null;
    this.state.field.bossCurrentHp = 0;
    this.revealNextBoss();
  }

  /** 翻出下一只鬼王（或判断游戏结束） */
  private revealNextBoss(): void {
    if (this.state.field.bossDeck.length > 0) {
      this.revealBoss();
    } else {
      this.addLog(`🎉 所有鬼王已被击败！游戏即将结算...`);
      if (this.checkGameEnd()) {
        this.endGame();
      }
    }
  }

  /** 结束回合 */
  async endTurn(): Promise<void> {
    if (this.state.turnPhase !== 'action') return;
    
    const player = this.getPlayer();
    
    // 进入清理阶段
    this.state.turnPhase = 'cleanup';
    
    // 处理战场上的妖怪：存活的恢复HP（击杀时已直接退治，无需额外处理）
    for (let i = 0; i < this.state.field.yokaiSlots.length; i++) {
      const yokai = this.state.field.yokaiSlots[i];
      if (!yokai) continue;
      // 存活的恢复HP
      yokai.currentHp = yokai.hp;
    }
    
    // 清理阶段：手牌 + 已打出 → 弃牌堆（含弃置触发）
    const cardsToDiscard = [...player.hand, ...player.played];
    for (const card of cardsToDiscard) {
      player.discard.push(card);
      if (card.name === '树妖') {
        onTreeDemonDiscard(player, card);
        this.addLog(`🌳 树妖弃置触发：抓牌+2`);
      }
      if (card.name === '三味') {
        onSanmiDiscard(player, card);
        this.addLog(`🎵 三味弃置触发：抓牌+3`);
      }
    }
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
      this.state.field.bossCurrentHp = boss.hp;
      
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

  private nextLogSeq = 1;

  private addLog(message: string): void {
    this.state.log.push({
      type: 'game_start',
      message,
      timestamp: Date.now(),
      logSeq: this.nextLogSeq++,
    });
  }

  private notifyChange(): void {
    // 实时更新声誉
    this.updateTotalCharm();
    
    this.state.lastUpdate = Date.now();
    // 深拷贝确保 Vue 响应式能检测到嵌套变化
    this.onStateChange(JSON.parse(JSON.stringify(this.state)));
  }
  
  /**
   * 实时计算并更新玩家声誉
   * 声誉来源：牌库+手牌+弃牌堆中卡牌的charm + 式神的charm
   * 不包括：超度区（已移出游戏）
   */
  private updateTotalCharm(): void {
    const player = this.getPlayer();
    const allCards = [...player.deck, ...player.hand, ...player.discard];
    const cardCharm = allCards.reduce((sum, card) => sum + (card.charm || 0), 0);
    const shikigamiCharm = player.shikigami.reduce((sum, s) => sum + (s.charm || 0), 0);
    player.totalCharm = cardCharm + shikigamiCharm;
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

  // 临时存储准备获取的式神候选
  private pendingShikigamiCandidates: ShikigamiCard[] = [];
  private pendingSpellIds: string[] = [];

  /** 准备获取式神：验证并消耗符咒，返回2个候选式神供选择 */
  async prepareAcquireShikigami(spellInstanceIds: string[]): Promise<ShikigamiCard[] | null> {
    if (!this.canAcquireShikigami()) {
      this.addLog(`❌ 无法获取式神`);
      return null;
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
      return null;
    }
    
    // 必须包含高级符咒
    if (!selectedSpells.some(c => this.isAdvancedSpell(c))) {
      this.addLog(`❌ 必须包含至少1张高级符咒`);
      return null;
    }

    // 将选中的卡牌移入超度区
    for (const spell of selectedSpells) {
      const idx = player.hand.findIndex(c => c.instanceId === spell.instanceId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.exiled.push(spell);
      }
    }
    const spellDamage = selectedSpells.reduce((sum, c) => sum + (c.damage || c.hp || 1), 0);
    this.addLog(`📿 超度 ${selectedSpells.map(s => s.name).join('、')}（共${spellDamage}点伤害）`);

    // 从式神供应堆抽取2张
    const supply = this.state.field.shikigamiSupply!;
    const drawnShikigami = supply.splice(0, Math.min(2, supply.length));
    
    if (drawnShikigami.length === 0) {
      this.addLog(`❌ 式神供应堆已空`);
      return null;
    }

    // 存储候选，等待玩家选择
    this.pendingShikigamiCandidates = drawnShikigami;
    this.pendingSpellIds = spellInstanceIds;
    
    this.notifyChange();
    return drawnShikigami;
  }

  /** 确认获取式神：玩家选择了一个候选式神 */
  confirmAcquireShikigami(shikigamiId: string): boolean {
    const player = this.getPlayer();
    const supply = this.state.field.shikigamiSupply!;
    
    // 找到选中的式神
    const selectedShikigami = this.pendingShikigamiCandidates.find(s => s.id === shikigamiId);
    if (!selectedShikigami) {
      this.addLog(`❌ 无效的式神选择`);
      return false;
    }

    const notSelected = this.pendingShikigamiCandidates.filter(s => s.id !== shikigamiId);

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
    
    // 清空临时状态
    this.pendingShikigamiCandidates = [];
    this.pendingSpellIds = [];
    
    this.notifyChange();
    return true;
  }

  /** 获取式神（旧接口，保留兼容） */
  async acquireShikigami(spellInstanceIds: string[]): Promise<boolean> {
    const candidates = await this.prepareAcquireShikigami(spellInstanceIds);
    if (!candidates || candidates.length === 0) return false;
    
    // 如果只有1个候选，直接获取
    if (candidates.length === 1) {
      return this.confirmAcquireShikigami(candidates[0].id);
    }
    
    // 多个候选需要玩家选择（通过UI）
    // 这里返回true表示准备成功，实际获取在confirmAcquireShikigami中完成
    return true;
  }

  /** 准备置换式神：验证符咒，返回2个候选式神供选择 */
  async prepareReplaceShikigami(spellInstanceIds: string[]): Promise<ShikigamiCard[] | null> {
    if (!this.canReplaceShikigami()) {
      this.addLog(`❌ 无法置换式神`);
      return null;
    }

    const player = this.getPlayer();

    // 验证选中的卡牌（必须是1张高级符咒）
    const selectedSpells = spellInstanceIds
      .map(id => player.hand.find(c => c.instanceId === id))
      .filter((c): c is CardInstance => c !== undefined && c.cardType === 'spell');
    
    if (selectedSpells.length !== 1) {
      this.addLog(`❌ 置换需要恰好选择1张高级符咒`);
      return null;
    }
    
    if (!this.isAdvancedSpell(selectedSpells[0]!)) {
      this.addLog(`❌ 置换需要1张高级符咒或专属符咒`);
      return null;
    }

    // 消耗符咒
    for (const spell of selectedSpells) {
      const idx = player.hand.findIndex(c => c.instanceId === spell.instanceId);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.exiled.push(spell);
      }
    }
    this.addLog(`📿 超度 ${selectedSpells[0]!.name}（3点伤害）准备置换式神`);

    // 保存选中的符咒ID（用于确认时）
    this.pendingSpellIds = spellInstanceIds;

    // 从商店随机抽2个式神
    const supply = this.state.field.shikigamiSupply || [];
    if (supply.length === 0) {
      this.addLog(`❌ 式神商店已空`);
      return null;
    }
    
    const shuffled = [...supply].sort(() => Math.random() - 0.5);
    const candidates = shuffled.slice(0, Math.min(2, shuffled.length));
    
    this.pendingShikigamiCandidates = candidates;
    this.addLog(`🎴 可选式神：${candidates.map(s => `${s.name}(${s.rarity})`).join('、')}`);
    
    this.notifyChange();
    return candidates;
  }

  /** 执行置换式神：移除旧式神，添加新式神 */
  async executeReplaceShikigami(oldShikigamiId: string, newShikigamiId: string, candidates: ShikigamiCard[]): Promise<boolean> {
    const player = this.getPlayer();
    const supply = this.state.field.shikigamiSupply!;

    // 验证要替换的旧式神
    const oldShikigamiIndex = player.shikigami.findIndex(s => s.id === oldShikigamiId);
    if (oldShikigamiIndex === -1) {
      this.addLog(`❌ 未找到要替换的式神`);
      return false;
    }
    const oldShikigami = player.shikigami[oldShikigamiIndex]!;

    // 找到选中的新式神
    const selectedShikigami = candidates.find(s => s.id === newShikigamiId);
    if (!selectedShikigami) {
      this.addLog(`❌ 无效的式神选择`);
      return false;
    }
    const notSelected = candidates.filter(s => s.id !== newShikigamiId);

    // 1. 将旧式神放回供应堆底部
    supply.push(oldShikigami);
    
    // 2. 从玩家式神列表中移除旧式神
    player.shikigami.splice(oldShikigamiIndex, 1);
    player.shikigamiState.splice(oldShikigamiIndex, 1);
    
    // 3. 将新式神加入玩家式神区
    player.shikigami.push(selectedShikigami);
    player.shikigamiState.push({
      cardId: selectedShikigami.id,
      isExhausted: false,
      markers: {}
    });

    // 4. 将未选中的式神放回供应堆底部
    supply.push(...notSelected);

    // 5. 从供应堆中移除已选式神（避免重复）
    const selectedIdx = supply.findIndex(s => s.id === newShikigamiId);
    if (selectedIdx !== -1) {
      supply.splice(selectedIdx, 1);
    }

    this.addLog(`🔄 置换式神：${oldShikigami.name} → ${selectedShikigami.name}（${selectedShikigami.rarity}）`);
    this.addLog(`📋 当前式神数量：${player.shikigami.length}/${GAME_CONSTANTS.MAX_SHIKIGAMI}`);
    
    // 清空临时状态
    this.pendingShikigamiCandidates = [];
    this.pendingSpellIds = [];
    
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
