/**
 * 御魂传说 - 多人游戏引擎
 * @file server/src/game/MultiplayerGame.ts
 * 
 * 基于 SinglePlayerGame 改造，支持多玩家回合制
 * 游戏状态在服务端维护，客户端发送操作指令，服务端验证后广播状态
 */

import type {
  GameState,
  GameAction,
  GameEvent,
  TurnPhase,
  CardInstance,
  ShikigamiCard,
  BossCard,
  OnmyojiCard,
  PlayerState,
  FieldState,
  GameLogEntry,
  CardType,
} from '../types/index';

// 导入卡牌数据
import * as fs from 'fs';
import * as path from 'path';

// 读取卡牌数据 - 根据执行环境使用不同路径
function loadCardsData() {
  // 尝试多个可能的路径
  const possiblePaths = [
    path.join(__dirname, '../../../shared/data/cards.json'),  // 开发模式 (tsx)
    path.join(__dirname, '../../shared/data/cards.json'),     // 编译后
    path.join(process.cwd(), '../shared/data/cards.json'),    // 从 server 目录运行
    path.join(process.cwd(), 'shared/data/cards.json'),       // 从根目录运行
  ];
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[MultiplayerGame] 加载卡牌数据: ${p}`);
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }
  
  throw new Error('无法找到卡牌数据文件 cards.json');
}

const cardsData = loadCardsData();

// ============ 常量 ============

const GAME_CONSTANTS = {
  MAX_GHOST_FIRE: 5,
  GHOST_FIRE_PER_TURN: 1,
  STARTING_HAND_SIZE: 5,
  STARTING_DECK_SIZE: 9,
  YOKAI_SLOTS: 6,
  MAX_SHIKIGAMI: 3,
  SHIKIGAMI_DRAW: 4,
  SHIKIGAMI_KEEP: 2,
  SHIKIGAMI_SELECT_TIMEOUT: 20000, // 式神选择超时时间（毫秒）
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

/** 玩家信息 */
interface PlayerInfo {
  id: string;
  name: string;
}

/**
 * 多人游戏引擎
 */
export class MultiplayerGame {
  /** 房间ID */
  private readonly roomId: string;
  
  /** 游戏状态 */
  private state: GameState;
  
  /** 玩家信息映射 */
  private playerInfoMap: Map<string, PlayerInfo>;
  
  /** 状态序列号（用于同步） */
  private stateSeq: number = 0;
  
  /** 状态变更回调 */
  private onStateChange?: (state: GameState, event?: GameEvent) => void;
  
  /** 交互请求回调 */
  private onInteractRequest?: (playerId: string, request: any) => Promise<any>;
  
  /** 回合超时定时器 */
  private turnTimer?: NodeJS.Timeout;
  
  /** 式神选择倒计时 */
  private shikigamiSelectTimer?: NodeJS.Timeout;
  
  /** 式神选择开始时间 */
  private shikigamiSelectStartTime?: number;
  
  /** 式神选择状态 */
  private shikigamiSelections: Map<string, string[]> = new Map();
  
  /** 是否已清理 */
  private cleaned: boolean = false;

  constructor(roomId: string, players: PlayerInfo[]) {
    this.roomId = roomId;
    this.playerInfoMap = new Map(players.map(p => [p.id, p]));
    
    // 初始化游戏状态
    this.state = this.createInitialState(players);
    
    // 注意：式神选择倒计时在 setOnStateChange 后由 start() 方法启动
  }
  
  /**
   * 启动游戏（设置回调后调用）
   */
  start(): void {
    // 启动式神选择倒计时
    this.startShikigamiSelectTimer();
  }
  
  /**
   * 启动式神选择倒计时
   */
  private startShikigamiSelectTimer(): void {
    this.shikigamiSelectStartTime = Date.now();
    
    // 广播倒计时开始
    this.notifyStateChange({
      type: 'SHIKIGAMI_SELECT_START',
      timeout: GAME_CONSTANTS.SHIKIGAMI_SELECT_TIMEOUT,
    });
    
    // 设置超时自动随机选择
    this.shikigamiSelectTimer = setTimeout(() => {
      this.handleShikigamiSelectTimeout();
    }, GAME_CONSTANTS.SHIKIGAMI_SELECT_TIMEOUT);
  }
  
  /**
   * 式神选择超时处理
   */
  private handleShikigamiSelectTimeout(): void {
    console.log(`[MultiplayerGame] 式神选择超时，为未选择的玩家随机分配`);
    
    const allOptions = (this.state as any).shikigamiOptions || [];
    
    // 为未确认的玩家随机选择式神
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const selectedList = (player as any).selectedShikigami as ShikigamiCard[] || [];
      
      if (!player.isReady && selectedList.length < 2) {
        // 获取该玩家的4个选项
        const start = i * 4;
        const playerOptions = allOptions.slice(start, start + 4);
        
        if (playerOptions.length > 0) {
          // 过滤掉已选的，从剩余中随机选择
          const remaining = playerOptions.filter(
            (s: ShikigamiCard) => !selectedList.some(sel => sel.id === s.id)
          );
          const needed = 2 - selectedList.length;
          const shuffled = shuffle(remaining);
          const randomPicked = shuffled.slice(0, needed);
          
          // 合并已选和随机选的
          const finalSelection = [...selectedList, ...randomPicked] as ShikigamiCard[];
          player.shikigami = finalSelection;
          player.isReady = true;
          this.addLog(`⏰ ${player.name} 超时，自动分配式神：${finalSelection.map((s: ShikigamiCard) => s.name).join('、')}`);
        }
      }
    }
    
    // 进入游戏阶段
    this.startPlayingPhase();
  }

  // ============ 初始化 ============

  /** 所有式神（洗牌后） */
  private allShikigami: ShikigamiCard[] = [];
  
  /** 每个玩家的式神选项（playerId -> 4个式神） */
  private playerShikigamiOptions: Map<string, ShikigamiCard[]> = new Map();
  
  /** 未被选择的式神（游戏开始时放入式神牌库） */
  private unselectedShikigami: ShikigamiCard[] = [];

  /**
   * 创建初始游戏状态
   */
  private createInitialState(players: PlayerInfo[]): GameState {
    // 创建玩家状态
    const playerStates: PlayerState[] = players.map((p, index) => 
      this.createPlayerState(p.id, p.name, index)
    );
    
    // 创建战场
    const field = this.createField();
    
    // 洗牌所有式神（24个）
    this.allShikigami = shuffle([...cardsData.shikigami]) as ShikigamiCard[];
    
    // 收集所有玩家的式神选项（用于全局状态广播）
    const allShikigamiOptions: ShikigamiCard[] = [];
    
    // 为每个玩家分配4个式神选项
    for (let i = 0; i < players.length; i++) {
      const start = i * GAME_CONSTANTS.SHIKIGAMI_DRAW;
      const end = start + GAME_CONSTANTS.SHIKIGAMI_DRAW;
      const options = this.allShikigami.slice(start, end);
      
      // 存储到 Map 中
      this.playerShikigamiOptions.set(players[i].id, options);
      
      // 添加到全局选项数组（顺序：玩家0的4个、玩家1的4个...）
      allShikigamiOptions.push(...options);
    }
    
    // 记录未分配的式神（超过玩家数*4的部分）
    const usedCount = players.length * GAME_CONSTANTS.SHIKIGAMI_DRAW;
    this.unselectedShikigami = this.allShikigami.slice(usedCount);
    
    return {
      roomId: this.roomId,
      phase: 'shikigamiSelect' as any, // 式神选取阶段
      playerCount: players.length,
      players: playerStates,
      currentPlayerIndex: 0,
      turnNumber: 0,
      turnPhase: 'ghostFire',
      field,
      log: [],
      lastUpdate: Date.now(),
      lastPlayerKilledYokai: true,
      pendingYokaiRefresh: false,
      // 式神选择阶段的全局数据
      shikigamiOptions: allShikigamiOptions,  // 所有式神选项（玩家0的4个 + 玩家1的4个 + ...）
      shikigamiSelectTimeout: GAME_CONSTANTS.SHIKIGAMI_SELECT_TIMEOUT,  // 剩余时间（毫秒）
      shikigamiSelectStartTime: Date.now(),  // 选择开始时间
    } as GameState;
  }

  /**
   * 创建玩家状态
   */
  private createPlayerState(id: string, name: string, index: number): PlayerState {
    // 创建初始牌库
    const deck: CardInstance[] = [];
    
    // 基础术式 6张
    const basicSpells = (cardsData.spell as any[]).filter((s: any) => s.level === 'basic');
    const defaultSpell = basicSpells[0] || cardsData.spell[0];
    for (let i = 0; i < 6; i++) {
      deck.push(this.createCardInstance(defaultSpell, 'spell'));
    }
    
    // 招福达摩 3张
    const daruma = cardsData.token[0];
    for (let i = 0; i < 3; i++) {
      deck.push(this.createCardInstance(daruma, 'token'));
    }

    return {
      id,
      name,
      onmyoji: cardsData.onmyoji[index % cardsData.onmyoji.length] as OnmyojiCard,
      shikigami: [],
      maxShikigami: GAME_CONSTANTS.MAX_SHIKIGAMI,
      ghostFire: 0,
      maxGhostFire: GAME_CONSTANTS.MAX_GHOST_FIRE,
      damage: 0,
      hand: [],
      deck: shuffle(deck),
      discard: [],
      played: [],
      exiled: [],
      totalCharm: 0,
      cardsPlayed: 0,
      isConnected: true,
      isReady: false,  // 式神选择阶段初始为 false，确认后才变 true
      shikigamiState: [],
      tempBuffs: [],
    };
  }

  /**
   * 创建战场
   */
  private createField(): FieldState {
    // 创建鬼王牌库
    const bossCards = [...cardsData.boss] as any[];
    const stage1 = shuffle(bossCards.filter(b => b.stage === 1));
    const stage2 = shuffle(bossCards.filter(b => b.stage === 2));
    const stage3 = shuffle(bossCards.filter(b => b.stage === 3));
    
    // 麒麟必须是第一个鬼王，放在数组开头（shift取出）
    const qilin = stage1.find(b => b.name === '麒麟');
    const otherStage1 = stage1.filter(b => b.name !== '麒麟');
    // 顺序：麒麟 → 其他1阶段 → 2阶段 → 3阶段
    const bossDeck = [qilin, ...otherStage1, ...stage2, ...stage3].filter(Boolean) as BossCard[];
    
    // 创建游荡妖怪牌库
    const yokaiDeck: CardInstance[] = [];
    for (const yokai of cardsData.yokai as any[]) {
      if (yokai.name === '招福达摩') continue;
      const count = yokai.count || 3;
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
    const spellSupply: { basic: CardInstance[]; medium: CardInstance[]; advanced: CardInstance[] } = {
      basic: [],
      medium: [],
      advanced: []
    };
    
    for (const spell of cardsData.spell as any[]) {
      const count = spell.count || 10;
      for (let i = 0; i < count; i++) {
        const instance = this.createCardInstance(spell, 'spell');
        if (spell.name === '基础术式') spellSupply.basic.push(instance);
        else if (spell.name === '中级符咒') spellSupply.medium.push(instance);
        else if (spell.name === '高级符咒') spellSupply.advanced.push(instance);
      }
    }

    return {
      yokaiSlots: [null, null, null, null, null, null],
      currentBoss: null,
      bossCurrentHp: 0,
      bossDeck,
      penaltyPile: shuffle(penaltyPile),
      yokaiDeck: shuffle(yokaiDeck),
      spellSupply: {
        basic: spellSupply.basic[0] || null,
        medium: spellSupply.medium[0] || null,
        advanced: spellSupply.advanced[0] || null,
      },
      spellCounts: {
        basic: spellSupply.basic.length,
        medium: spellSupply.medium.length,
        advanced: spellSupply.advanced.length,
      },
      tokenShop: 10,
      exileZone: [],
      shikigamiSupply: shuffle([...cardsData.shikigami]) as ShikigamiCard[],
    };
  }

  /**
   * 创建卡牌实例
   */
  private createCardInstance(card: any, type: string): CardInstance {
    return {
      instanceId: generateId(),
      cardId: card.id,
      cardType: type as any,
      name: card.name,
      hp: card.hp || card.damage || 1,
      maxHp: card.hp || card.damage || 1,
      charm: card.charm || 0,
      damage: card.damage || 0,
      effect: card.effect,
      image: card.image || '',
    };
  }

  // ============ 事件回调 ============

  /**
   * 设置状态变更回调
   */
  setOnStateChange(callback: (state: GameState, event?: GameEvent) => void): void {
    this.onStateChange = callback;
  }

  /**
   * 设置交互请求回调
   */
  setOnInteractRequest(callback: (playerId: string, request: any) => Promise<any>): void {
    this.onInteractRequest = callback;
  }

  // ============ 游戏流程 ============

  /**
   * 处理玩家式神选择
   */
  handleShikigamiSelection(playerId: string, shikigamiIds: string[]): { success: boolean; error?: string } {
    if (this.state.phase !== 'shikigamiSelect') {
      return { success: false, error: '当前不在式神选取阶段' };
    }
    
    // 验证选择数量
    if (shikigamiIds.length !== GAME_CONSTANTS.SHIKIGAMI_KEEP) {
      return { success: false, error: `请选择${GAME_CONSTANTS.SHIKIGAMI_KEEP}个式神` };
    }
    
    // 验证式神有效性
    const options = (this.state as any).shikigamiOptions as ShikigamiCard[];
    for (const id of shikigamiIds) {
      if (!options.find(s => s.id === id)) {
        return { success: false, error: '无效的式神选择' };
      }
    }
    
    // 记录选择
    this.shikigamiSelections.set(playerId, shikigamiIds);
    
    this.addLog(`🎭 玩家 ${this.playerInfoMap.get(playerId)?.name} 已选择式神`);
    
    // 检查是否所有玩家都已选择
    if (this.shikigamiSelections.size === this.state.players.length) {
      this.finalizeShikigamiSelection();
    }
    
    this.notifyStateChange();
    
    return { success: true };
  }

  /**
   * 完成式神选择，开始游戏
   */
  private finalizeShikigamiSelection(): void {
    const options = (this.state as any).shikigamiOptions as ShikigamiCard[];
    
    // 为每个玩家设置式神
    for (const player of this.state.players) {
      const selectedIds = this.shikigamiSelections.get(player.id) || [];
      player.shikigami = selectedIds
        .map(id => options.find(s => s.id === id))
        .filter(Boolean) as ShikigamiCard[];
      
      player.shikigamiState = player.shikigami.map(s => ({
        cardId: s.id,
        isExhausted: false,
        markers: {},
      }));
      
      this.addLog(`✅ ${player.name} 的式神：${player.shikigami.map(s => s.name).join('、')}`);
    }
    
    // 清理选取状态
    delete (this.state as any).shikigamiOptions;
    this.shikigamiSelections.clear();
    
    // 🎲 随机打乱玩家行动顺序
    this.state.players = shuffle([...this.state.players]);
    this.addLog(`🎲 行动顺序：${this.state.players.map(p => p.name).join(' → ')}`);
    
    // 开始游戏
    this.startGame();
  }

  /**
   * 开始游戏
   */
  private startGame(): void {
    // 为每个玩家抓初始手牌
    for (const player of this.state.players) {
      this.drawCards(player, GAME_CONSTANTS.STARTING_HAND_SIZE);
    }
    
    // 翻出第一个鬼王
    this.revealBoss();
    
    // 填充战场
    this.fillYokaiSlots();
    
    // 更新游戏状态
    this.state.phase = 'playing';
    this.state.turnNumber = 1;
    
    this.addLog('🎮 游戏开始！');
    this.addLog(`📍 第 1 回合，轮到 ${this.getCurrentPlayer().name}`);
    
    // 开始第一个回合
    this.startTurn();
    
    // 发送游戏开始事件
    this.notifyStateChange({
      type: 'GAME_STARTED',
      state: this.state,
    });
  }

  /**
   * 开始回合
   */
  private startTurn(): void {
    const player = this.getCurrentPlayer();
    
    // 重置回合状态
    player.damage = 0;
    player.cardsPlayed = 0;
    player.tempBuffs = [];
    
    // 进入鬼火阶段
    this.enterGhostFirePhase();
  }

  /**
   * 鬼火阶段
   */
  private enterGhostFirePhase(): void {
    const player = this.getCurrentPlayer();
    this.state.turnPhase = 'ghostFire';
    
    // 鬼火+1
    player.ghostFire = Math.min(
      player.ghostFire + GAME_CONSTANTS.GHOST_FIRE_PER_TURN,
      GAME_CONSTANTS.MAX_GHOST_FIRE
    );
    
    this.addLog(`🔥 ${player.name} 鬼火+1（当前:${player.ghostFire}）`);
    
    // 检查妖怪刷新选项
    if (this.state.lastPlayerKilledYokai === false) {
      this.state.pendingYokaiRefresh = true;
      this.addLog(`⚠️ 上一玩家未击败妖怪，${player.name}可选择刷新场上的妖怪`);
      this.notifyStateChange();
      return;
    }
    
    // 直接进入行动阶段
    this.enterActionPhase();
  }

  /**
   * 行动阶段
   */
  private enterActionPhase(): void {
    this.state.turnPhase = 'action';
    this.notifyStateChange({
      type: 'PHASE_CHANGED',
      phase: 'action',
    });
  }

  /**
   * 清理阶段
   */
  private enterCleanupPhase(): void {
    const player = this.getCurrentPlayer();
    this.state.turnPhase = 'cleanup';
    
    // 弃置所有已打出的牌
    player.discard.push(...player.played);
    player.played = [];
    
    // 抓5张牌
    this.drawCards(player, GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // 补充妖怪
    this.fillYokaiSlots();
    
    // 记录是否击杀妖怪
    this.state.lastPlayerKilledYokai = player.damage > 0;
    
    this.addLog(`🔄 ${player.name} 回合结束`);
    
    // 下一个玩家
    this.nextTurn();
  }

  /**
   * 下一回合
   */
  private nextTurn(): void {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    
    // 如果回到第一个玩家，回合数+1
    if (this.state.currentPlayerIndex === 0) {
      this.state.turnNumber++;
    }
    
    const player = this.getCurrentPlayer();
    this.addLog(`📍 第 ${this.state.turnNumber} 回合，轮到 ${player.name}`);
    
    // 开始新回合
    this.startTurn();
    
    this.notifyStateChange({
      type: 'TURN_CHANGED',
      playerId: player.id,
    });
  }

  // ============ 游戏动作 ============

  /**
   * 处理玩家动作
   */
  handleAction(playerId: string, action: GameAction): { success: boolean; error?: string } {
    // 式神选择阶段的动作不需要检查回合（所有玩家同时选择）
    const shikigamiActions = ['selectShikigami', 'deselectShikigami', 'confirmShikigamiSelection'];
    if (shikigamiActions.includes(action.type)) {
      return this.handleShikigamiAction(playerId, action);
    }
    
    // 验证是否轮到该玩家
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      return { success: false, error: '不是你的回合' };
    }
    
    switch (action.type) {
      // === 大写格式（兼容旧代码）===
      case 'PLAY_CARD':
        return this.handlePlayCard(playerId, action.cardInstanceId);
      
      case 'USE_SKILL':
        return this.handleUseSkill(playerId, action.shikigamiId, action.targetId);
      
      case 'ATTACK':
        return this.handleAttack(playerId, action.targetId, action.damage);
      
      case 'DECIDE_YOKAI_REFRESH':
        return this.handleYokaiRefresh(action.refresh);
      
      case 'END_TURN':
        return this.handleEndTurn(playerId);
      
      case 'SELECT_SHIKIGAMI':
        return this.handleShikigamiSelection(playerId, action.selectedIds);
      
      // === 小写格式（客户端使用）===
      case 'playCard':
        return this.handlePlayCard(playerId, action.cardInstanceId);
      
      case 'useShikigamiSkill':
        return this.handleUseSkill(playerId, action.shikigamiId, action.targetId);
      
      case 'attackBoss':
        return this.handleAttackBoss(playerId, action.damage);
      
      case 'allocateDamage':
        return this.handleAllocateDamage(playerId, action.slotIndex);
      
      case 'retireYokai':
        return this.handleRetireYokai(playerId, action.slotIndex);
      
      case 'banishYokai':
        return this.handleBanishYokai(playerId, action.slotIndex);
      
      case 'decideYokaiRefresh':
        return this.handleYokaiRefresh(action.refresh);
      
      case 'endTurn':
        return this.handleEndTurn(playerId);
      
      case 'confirmShikigamiPhase':
        return this.handleConfirmShikigamiPhase(playerId);
      
      default:
        return { success: false, error: `未知的操作类型: ${(action as any).type}` };
    }
  }
  
  /**
   * 处理式神选择阶段的动作
   */
  private handleShikigamiAction(playerId: string, action: GameAction): { success: boolean; error?: string } {
    console.log(`[handleShikigamiAction] playerId=${playerId}, action=${JSON.stringify(action)}`);
    console.log(`[handleShikigamiAction] 所有玩家IDs: ${this.state.players.map(p => p.id).join(', ')}`);
    
    if (this.state.phase !== 'shikigamiSelect') {
      return { success: false, error: '当前不在式神选择阶段' };
    }
    
    const player = this.getPlayer(playerId);
    if (!player) {
      console.log(`[handleShikigamiAction] 找不到玩家: ${playerId}`);
      return { success: false, error: '玩家不存在' };
    }
    console.log(`[handleShikigamiAction] 找到玩家: ${player.name}, 已选式神数: ${player.selectedShikigami?.length || 0}`);
    
    switch (action.type) {
      case 'selectShikigami': {
        // 获取玩家的索引，计算该玩家可选的式神范围
        const playerIndex = this.state.players.findIndex(p => p.id === playerId);
        console.log(`[selectShikigami] playerId=${playerId}, playerIndex=${playerIndex}`);
        if (playerIndex === -1) {
          return { success: false, error: '找不到玩家' };
        }
        
        // 计算该玩家可选的式神范围（每人4个）
        const startIdx = playerIndex * 4;
        const endIdx = startIdx + 4;
        const allOptions = (this.state as any).shikigamiOptions || [];
        const playerShikigamiOptions = allOptions.slice(startIdx, endIdx);
        console.log(`[selectShikigami] allOptions.length=${allOptions.length}, startIdx=${startIdx}, playerOptions.length=${playerShikigamiOptions.length}`);
        
        // 检查式神是否在该玩家的可选范围内
        const shikigami = playerShikigamiOptions.find((s: ShikigamiCard) => s.id === action.shikigamiId);
        if (!shikigami) {
          console.log(`[selectShikigami] 式神不在范围内: ${action.shikigamiId}`);
          console.log(`[selectShikigami] 可选式神IDs: ${playerShikigamiOptions.map((s: ShikigamiCard) => s.id).join(', ')}`);
          return { success: false, error: '该式神不在你的选择范围内' };
        }
        
        // 初始化 selectedShikigami 数组（如果不存在）
        if (!player.selectedShikigami) {
          player.selectedShikigami = [];
        }
        const selectedList = player.selectedShikigami;
        console.log(`[selectShikigami] 当前已选数量: ${selectedList.length}`);
        
        if (selectedList.length >= 2) {
          return { success: false, error: '已选择2个式神' };
        }
        
        // 检查是否已被该玩家选择
        if (selectedList.some(s => s.id === action.shikigamiId)) {
          return { success: false, error: '已选择该式神' };
        }
        
        selectedList.push(shikigami as any);
        this.addLog(`${player.name} 选择了式神 ${shikigami.name}`);
        this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
        return { success: true };
      }
      
      case 'deselectShikigami': {
        // 初始化 selectedShikigami 数组（如果不存在）
        if (!player.selectedShikigami) {
          (player as any).selectedShikigami = [];
        }
        const selectedList = (player as any).selectedShikigami as ShikigamiCard[];
        
        const idx = selectedList.findIndex(s => s.id === action.shikigamiId);
        if (idx === -1) {
          return { success: false, error: '未选择该式神' };
        }
        const removed = selectedList.splice(idx, 1)[0];
        this.addLog(`${player.name} 取消选择式神 ${removed.name}`);
        this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
        return { success: true };
      }
      
      case 'confirmShikigamiSelection': {
        const selectedList = (player as any).selectedShikigami as ShikigamiCard[] || [];
        if (selectedList.length < 2) {
          return { success: false, error: '请选择2个式神' };
        }
        
        // 将 selectedShikigami 复制到 shikigami（正式生效）
        player.shikigami = [...selectedList];
        player.isReady = true;
        this.addLog(`${player.name} 确认了式神选择：${selectedList.map(s => s.name).join('、')}`);
        
        // 检查是否所有玩家都已确认
        const allReady = this.state.players.every(p => p.isReady);
        if (allReady) {
          this.startPlayingPhase();
        } else {
          this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
        }
        return { success: true };
      }
      
      default:
        return { success: false, error: '未知的式神操作' };
    }
  }
  
  /**
   * 开始游戏阶段
   */
  private startPlayingPhase(): void {
    // 清除式神选择倒计时
    if (this.shikigamiSelectTimer) {
      clearTimeout(this.shikigamiSelectTimer);
      this.shikigamiSelectTimer = undefined;
    }
    
    // 收集所有未被选择的式神
    this.collectUnselectedShikigami();
    
    // 将未选择的式神洗牌后放入式神供应区
    this.state.field.shikigamiSupply = shuffle(this.unselectedShikigami) as any;
    this.addLog(`📚 ${this.unselectedShikigami.length} 个式神进入式神牌库`);
    
    // 清除玩家状态中的临时字段（选择阶段已结束）
    for (const player of this.state.players) {
      delete (player as any).shikigamiOptions;
      delete (player as any).selectedShikigami;
      player.isReady = false;
    }
    
    this.state.phase = 'playing' as any;
    this.state.turnPhase = 'ghostFire';
    this.state.turnNumber = 1;
    
    // 为每个玩家抽初始手牌
    for (const player of this.state.players) {
      this.drawCards(player, 5);
    }
    
    // 翻出第一个鬼王
    this.revealBoss();
    
    // 填充妖怪槽位
    this.fillYokaiSlots();
    
    this.addLog('=== 游戏开始 ===');
    this.addLog(`第 ${this.state.turnNumber} 回合开始，${this.getCurrentPlayer().name} 的回合`);
    
    // 广播所有玩家的式神选择结果
    const shikigamiSummary = this.state.players.map(p => ({
      name: p.name,
      shikigami: p.shikigami.map(s => s.name)
    }));
    
    this.notifyStateChange({ 
      type: 'GAME_START', 
      state: this.state,
      shikigamiSummary,
    });
  }
  
  /**
   * 收集所有未被选择的式神
   */
  private collectUnselectedShikigami(): void {
    // 获取所有玩家选择的式神ID
    const selectedIds = new Set<string>();
    for (const player of this.state.players) {
      for (const shikigami of player.shikigami) {
        selectedIds.add(shikigami.id);
      }
    }
    
    // 从每个玩家的选项中收集未被选择的式神
    for (const [playerId, options] of this.playerShikigamiOptions) {
      for (const shikigami of options) {
        if (!selectedIds.has(shikigami.id)) {
          this.unselectedShikigami.push(shikigami);
        }
      }
    }
  }
  
  /**
   * 处理攻击鬼王
   */
  private handleAttackBoss(playerId: string, damage: number): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能攻击' };
    }
    
    if (!this.state.field.currentBoss) {
      return { success: false, error: '没有鬼王可以攻击' };
    }
    
    if (player.damage < damage) {
      return { success: false, error: '伤害不足' };
    }
    
    // 扣除伤害并对鬼王造成伤害
    player.damage -= damage;
    this.state.field.bossCurrentHp -= damage;
    
    this.addLog(`⚔️ ${player.name} 对鬼王造成 ${damage} 点伤害`);
    
    // 检查鬼王是否被击败
    if (this.state.field.bossCurrentHp <= 0) {
      this.handleBossDefeated(playerId);
    }
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理分配伤害到妖怪
   */
  private handleAllocateDamage(playerId: string, slotIndex: number): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能攻击' };
    }
    
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) {
      return { success: false, error: '该位置没有妖怪' };
    }
    
    if (player.damage <= 0) {
      return { success: false, error: '没有伤害可分配' };
    }
    
    // 计算造成的伤害（最多等于妖怪当前HP）
    const currentHp = yokai.hp || 0;
    const damageDealt = Math.min(player.damage, currentHp);
    
    player.damage -= damageDealt;
    yokai.hp = currentHp - damageDealt;
    
    this.addLog(`⚔️ ${player.name} 对 ${yokai.name} 造成 ${damageDealt} 点伤害`);
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理退治妖怪（放入弃牌堆）
   */
  private handleRetireYokai(playerId: string, slotIndex: number): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) {
      return { success: false, error: '该位置没有妖怪' };
    }
    
    if ((yokai.hp || 0) > 0) {
      return { success: false, error: '妖怪还没有被击杀' };
    }
    
    // 移到弃牌堆
    player.discard.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;
    
    // 更新声誉
    if (yokai.charm) {
      player.totalCharm += yokai.charm;
    }
    
    this.addLog(`📥 ${player.name} 退治了 ${yokai.name}（+${yokai.charm || 0} 声誉）`);
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理超度妖怪（移出游戏）
   */
  private handleBanishYokai(playerId: string, slotIndex: number): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const yokai = this.state.field.yokaiSlots[slotIndex];
    if (!yokai) {
      return { success: false, error: '该位置没有妖怪' };
    }
    
    if ((yokai.hp || 0) > 0) {
      return { success: false, error: '妖怪还没有被击杀' };
    }
    
    // 移到超度区
    this.state.field.exileZone.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;
    
    this.addLog(`🌟 ${player.name} 超度了 ${yokai.name}`);
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理确认式神阶段
   */
  private handleConfirmShikigamiPhase(playerId: string): { success: boolean; error?: string } {
    if (this.state.turnPhase !== 'shikigami') {
      return { success: false, error: '当前不在式神阶段' };
    }
    
    // 进入行动阶段
    this.state.turnPhase = 'action';
    this.addLog(`${this.getCurrentPlayer().name} 进入行动阶段`);
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理鬼王被击败
   */
  private handleBossDefeated(playerId: string): void {
    const player = this.getPlayer(playerId);
    const boss = this.state.field.currentBoss;
    if (!player || !boss) return;
    
    // 加声誉
    if (boss.charm) {
      player.totalCharm += boss.charm;
    }
    
    this.addLog(`👑 ${player.name} 击败了鬼王 ${boss.name}（+${boss.charm || 0} 声誉）`);
    
    // 清除当前鬼王
    this.state.field.currentBoss = null;
    
    // 翻出下一个鬼王
    this.revealBoss();
  }
  
  /**
   * 翻出鬼王
   */
  private revealBoss(): void {
    if (this.state.field.bossDeck.length === 0) {
      this.addLog('所有鬼王都已被击败！游戏结束');
      this.state.phase = 'ended' as any;
      return;
    }
    
    const boss = this.state.field.bossDeck.shift()!;
    this.state.field.currentBoss = boss;
    this.state.field.bossCurrentHp = boss.hp;
    
    this.addLog(`👹 鬼王 ${boss.name} 登场！（HP: ${boss.hp}）`);
  }
  
  /**
   * 填充妖怪槽位
   */
  private fillYokaiSlots(): void {
    for (let i = 0; i < this.state.field.yokaiSlots.length; i++) {
      if (!this.state.field.yokaiSlots[i] && this.state.field.yokaiDeck.length > 0) {
        const yokai = this.state.field.yokaiDeck.shift()!;
        this.state.field.yokaiSlots[i] = yokai;
      }
    }
  }
  
  /**
   * 抽牌
   */
  private drawCards(player: PlayerState, count: number): void {
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        // 洗入弃牌堆
        if (player.discard.length === 0) break;
        player.deck = [...player.discard].sort(() => Math.random() - 0.5);
        player.discard = [];
      }
      const card = player.deck.shift();
      if (card) player.hand.push(card);
    }
  }

  /**
   * 处理打牌
   */
  private handlePlayCard(playerId: string, cardInstanceId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能打牌' };
    }
    
    // 查找手牌
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) {
      return { success: false, error: '手牌中没有这张牌' };
    }
    
    const card = player.hand[cardIndex];
    
    // 检查是否是 token（不能打出）
    if (card.cardType === 'token') {
      return { success: false, error: '令牌不能打出' };
    }
    
    // 移到已打出区域
    player.hand.splice(cardIndex, 1);
    player.played.push(card);
    player.cardsPlayed++;
    
    // 累加伤害
    if (card.damage) {
      player.damage += card.damage;
    }
    
    this.addLog(`🃏 ${player.name} 打出 ${card.name}${card.damage ? ` (+${card.damage}伤害)` : ''}`);
    
    this.notifyStateChange({
      type: 'CARD_PLAYED',
      playerId,
      card,
    });
    
    return { success: true };
  }

  /**
   * 处理使用技能
   */
  private handleUseSkill(
    playerId: string, 
    shikigamiId: string, 
    targetId?: string
  ): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能使用技能' };
    }
    
    // 查找式神
    const shikigamiIndex = player.shikigami.findIndex(s => s.id === shikigamiId);
    if (shikigamiIndex === -1) {
      return { success: false, error: '没有这个式神' };
    }
    
    const shikigamiState = player.shikigamiState[shikigamiIndex];
    if (shikigamiState.isExhausted) {
      return { success: false, error: '这个式神本回合已行动' };
    }
    
    const shikigami = player.shikigami[shikigamiIndex];
    
    // 检查鬼火消耗
    const cost = shikigami.skill?.cost || 0;
    if (player.ghostFire < cost) {
      return { success: false, error: `鬼火不足（需要${cost}，当前${player.ghostFire}）` };
    }
    
    // 消耗鬼火
    player.ghostFire -= cost;
    
    // 标记已行动
    shikigamiState.isExhausted = true;
    
    this.addLog(`⚡ ${player.name} 使用 ${shikigami.name} 的技能：${shikigami.skill?.name || '未知'}`);
    
    // TODO: 执行技能效果
    
    this.notifyStateChange();
    
    return { success: true };
  }

  /**
   * 处理攻击
   */
  private handleAttack(
    playerId: string,
    targetId: string,
    damage: number
  ): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能攻击' };
    }
    
    if (player.damage < damage) {
      return { success: false, error: '伤害不足' };
    }
    
    // 查找目标
    if (targetId.startsWith('boss')) {
      // 攻击鬼王
      return this.attackBoss(player, damage);
    } else {
      // 攻击妖怪
      return this.attackYokai(player, targetId, damage);
    }
  }

  /**
   * 攻击鬼王
   */
  private attackBoss(player: PlayerState, damage: number): { success: boolean; error?: string } {
    if (!this.state.field.currentBoss) {
      return { success: false, error: '没有鬼王' };
    }
    
    // 消耗伤害
    player.damage -= damage;
    
    // 造成伤害
    this.state.field.bossCurrentHp -= damage;
    
    this.addLog(`⚔️ ${player.name} 对 ${this.state.field.currentBoss.name} 造成 ${damage} 点伤害`);
    
    // 检查鬼王是否死亡
    if (this.state.field.bossCurrentHp <= 0) {
      this.defeatBoss(player);
    }
    
    this.notifyStateChange();
    
    return { success: true };
  }

  /**
   * 攻击妖怪
   */
  private attackYokai(
    player: PlayerState,
    yokaiInstanceId: string,
    damage: number
  ): { success: boolean; error?: string } {
    // 查找妖怪
    const slotIndex = this.state.field.yokaiSlots.findIndex(
      y => y && y.instanceId === yokaiInstanceId
    );
    
    if (slotIndex === -1) {
      return { success: false, error: '场上没有这个妖怪' };
    }
    
    const yokai = this.state.field.yokaiSlots[slotIndex]!;
    
    // 检查伤害是否足够
    const yokaiHp = yokai.hp || 1;
    if (damage < yokaiHp) {
      return { success: false, error: `伤害不足以击败妖怪（需要${yokaiHp}）` };
    }
    
    // 消耗伤害
    player.damage -= damage;
    
    // 击败妖怪
    this.state.field.yokaiSlots[slotIndex] = null;
    player.discard.push(yokai);
    
    // 增加声誉
    if (yokai.charm) {
      player.totalCharm += yokai.charm;
    }
    
    this.addLog(`💀 ${player.name} 击败 ${yokai.name}，获得 ${yokai.charm || 0} 声誉`);
    
    this.notifyStateChange({
      type: 'YOKAI_DEFEATED',
      card: yokai,
      playerId: player.id,
    });
    
    return { success: true };
  }

  /**
   * 击败鬼王
   */
  private defeatBoss(player: PlayerState): void {
    const boss = this.state.field.currentBoss!;
    
    // 增加声誉
    player.totalCharm += boss.charm || 0;
    
    this.addLog(`👹 ${player.name} 击败鬼王 ${boss.name}！获得 ${boss.charm || 0} 声誉`);
    
    // 检查游戏是否结束
    if (this.state.field.bossDeck.length === 0) {
      this.endGame();
      return;
    }
    
    // 翻出下一个鬼王
    this.revealBoss();
    
    this.notifyStateChange({
      type: 'BOSS_DEFEATED',
      boss,
      playerId: player.id,
    });
  }

  /**
   * 处理妖怪刷新决定
   */
  private handleYokaiRefresh(refresh: boolean): { success: boolean; error?: string } {
    if (!this.state.pendingYokaiRefresh) {
      return { success: false, error: '当前不需要决定妖怪刷新' };
    }
    
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
    this.enterActionPhase();
    
    return { success: true };
  }

  /**
   * 处理结束回合
   */
  private handleEndTurn(playerId: string): { success: boolean; error?: string } {
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能结束回合' };
    }
    
    this.enterCleanupPhase();
    
    return { success: true };
  }

  // ============ 辅助方法 ============

  /**
   * 获取当前玩家
   */
  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentPlayerIndex];
  }

  /**
   * 获取玩家
   */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.state.players.find(p => p.id === playerId);
  }

  /**
   * 添加日志
   */
  private addLog(message: string): void {
    this.state.log.push({
      type: 'game_start',
      message,
      timestamp: Date.now(),
    });
    
    // 保留最近100条日志
    if (this.state.log.length > 100) {
      this.state.log = this.state.log.slice(-100);
    }
  }

  /**
   * 通知状态变更
   */
  private notifyStateChange(event?: GameEvent): void {
    this.state.lastUpdate = Date.now();
    this.stateSeq++;
    
    if (this.onStateChange) {
      this.onStateChange(this.state, event);
    }
  }

  /**
   * 结束游戏
   */
  private endGame(): void {
    this.state.phase = 'ended';
    
    // 计算最终分数
    const scores: Record<string, number> = {};
    for (const player of this.state.players) {
      scores[player.id] = player.totalCharm;
    }
    
    // 找出胜者
    const maxScore = Math.max(...Object.values(scores));
    const winners = this.state.players
      .filter(p => p.totalCharm === maxScore)
      .map(p => p.id);
    
    this.addLog(`🏆 游戏结束！`);
    for (const player of this.state.players) {
      this.addLog(`   ${player.name}: ${player.totalCharm} 声誉`);
    }
    
    this.notifyStateChange({
      type: 'GAME_ENDED',
      winner: winners[0],
      scores,
    });
  }

  // ============ 公共接口 ============

  /**
   * 获取游戏状态
   */
  getState(): GameState {
    return this.state;
  }
  
  /**
   * 获取玩家视角的游戏状态（式神选择阶段使用）
   * 和单人模式一样，使用 state.shikigamiOptions 和 state.selectedShikigami
   */
  getPlayerView(playerId: string): GameState {
    // 复制基础状态
    const viewState = JSON.parse(JSON.stringify(this.state)) as GameState;
    
    // 获取该玩家的式神选项
    const playerOptions = this.playerShikigamiOptions.get(playerId) || [];
    
    // 设置单人模式风格的字段（客户端读取这些字段）
    (viewState as any).shikigamiOptions = playerOptions;
    (viewState as any).selectedShikigami = [];
    
    // 找到当前玩家并获取已选择的式神
    const playerIndex = viewState.players.findIndex(p => p.id === playerId);
    if (playerIndex >= 0) {
      (viewState as any).selectedShikigami = viewState.players[playerIndex].shikigami || [];
    }
    
    // 清除其他玩家的 shikigamiOptions（不泄露给当前玩家）
    for (const player of viewState.players) {
      delete (player as any).shikigamiOptions;
    }
    
    return viewState;
  }

  /**
   * 获取状态序列号
   */
  getStateSeq(): number {
    return this.stateSeq;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
    
    this.onStateChange = undefined;
    this.onInteractRequest = undefined;
  }
}