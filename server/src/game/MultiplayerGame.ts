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

// ============ TempBuff 简化管理 ============
// 临时buff类型定义（与shared/game/TempBuff.ts同步）
type TempBuffType = 
  | 'DAMAGE_BONUS' 
  | 'SPELL_DAMAGE_BONUS' 
  | 'EXILE_KILL_DAMAGE'
  | 'NEXT_YOKAI_DOUBLE'
  | 'FIRST_KILL_TO_HAND'
  | 'SKIP_CLEANUP';

interface SimpleTempBuff {
  type: TempBuffType;
  value?: number;
  remainingCount?: number;
  maxHp?: number;
  triggered?: boolean;
}

/** 简化版TempBuff管理器 */
class TempBuffHelper {
  static addBuff(player: PlayerState, buff: SimpleTempBuff): void {
    if (!player.tempBuffs) player.tempBuffs = [];
    player.tempBuffs.push(buff as any);
  }
  
  static hasBuff(player: PlayerState, type: TempBuffType): boolean {
    return (player.tempBuffs || []).some((b: any) => b.type === type);
  }
  
  static consumeSpellDamageBonus(player: PlayerState): number {
    if (!player.tempBuffs) return 0;
    let total = 0;
    for (const buff of player.tempBuffs as any[]) {
      if (buff.type === 'SPELL_DAMAGE_BONUS' && (buff.remainingCount || 0) > 0) {
        total += buff.value || buff.bonusPerSpell || 1;
        buff.remainingCount--;
      }
    }
    // 移除已耗尽的
    player.tempBuffs = (player.tempBuffs as any[]).filter(
      b => b.type !== 'SPELL_DAMAGE_BONUS' || (b.remainingCount || 0) > 0
    ) as any;
    return total;
  }
  
  static consumeNextYokaiDouble(player: PlayerState): boolean {
    if (!player.tempBuffs) return false;
    const idx = (player.tempBuffs as any[]).findIndex(b => b.type === 'NEXT_YOKAI_DOUBLE');
    if (idx >= 0) {
      player.tempBuffs.splice(idx, 1);
      return true;
    }
    return false;
  }
  
  static triggerExileKillBonus(player: PlayerState): number {
    if (!player.tempBuffs) return 0;
    return (player.tempBuffs as any[])
      .filter(b => b.type === 'EXILE_KILL_DAMAGE')
      .reduce((sum, b) => sum + (b.value || b.bonus || 2), 0);
  }
  
  static shouldSkipCleanup(player: PlayerState): boolean {
    return TempBuffHelper.hasBuff(player, 'SKIP_CLEANUP');
  }
  
  static clearBuffs(player: PlayerState): void {
    player.tempBuffs = [];
  }
}

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

  /** 游戏日志条目的全局单调序号（仅内存，同步到客户端供稳定列表 key） */
  private nextLogSeq: number = 1;
  
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
    // 启动式神选择倒计时（会先广播 SHIKIGAMI_SELECT_START）
    this.startShikigamiSelectTimer();
    // AI 立即选满并确认（同步执行，避免未重启的旧 dist 或 setImmediate 顺序导致仍等超时）
    this.runAiShikigamiSelection();
  }

  /** 匹配房 AI 座位（与 generateAIPlayer 生成的 id 一致） */
  private isAiSeat(playerId: string): boolean {
    return playerId.startsWith('ai_');
  }

  /**
   * AI 自动从 4 张候选中选 2 张并立即确认（等价于真人点满后点确认）
   */
  private runAiShikigamiSelection(): void {
    if (this.state.phase !== 'shikigamiSelect') return;

    const allOptions = (this.state as any).shikigamiOptions as ShikigamiCard[] | undefined;
    if (!allOptions?.length) return;

    for (let i = 0; i < this.state.players.length; i++) {
      if (this.state.phase !== 'shikigamiSelect') return;
      const p = this.state.players[i];
      if (!this.isAiSeat(p.id)) continue;
      if (p.isReady) continue;

      const startIdx = i * GAME_CONSTANTS.SHIKIGAMI_DRAW;
      const pool = allOptions.slice(startIdx, startIdx + GAME_CONSTANTS.SHIKIGAMI_DRAW);
      if (pool.length < 2) continue;

      // L1：固定选展示顺序前 2 张（与策划文档 6.1 一致）
      const pick = pool.slice(0, GAME_CONSTANTS.SHIKIGAMI_KEEP);
      for (const card of pick) {
        this.handleShikigamiAction(p.id, { type: 'selectShikigami', shikigamiId: card.id });
      }
      const confirmResult = this.handleShikigamiAction(p.id, { type: 'confirmShikigamiSelection' });
      if (!confirmResult.success) {
        console.warn(`[MultiplayerGame] AI ${p.name} 确认式神失败: ${confirmResult.error}`);
      } else {
        console.log(`[MultiplayerGame] AI ${p.name} 已自动确认式神`);
      }
    }
  }
  
  /**
   * 启动式神选择倒计时
   */
  private startShikigamiSelectTimer(): void {
    this.shikigamiSelectStartTime = Date.now();
    // 同步到状态，供晚到客户端通过 state 自行恢复倒计时
    (this.state as any).shikigamiSelectStartTime = this.shikigamiSelectStartTime;
    (this.state as any).shikigamiSelectTimeout = GAME_CONSTANTS.SHIKIGAMI_SELECT_TIMEOUT;
    
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

    // 为未确认的玩家随机选择式神
    for (const player of this.state.players) {
      const selectedList = (player as any).selectedShikigami as ShikigamiCard[] || [];
      
      if (!player.isReady && selectedList.length < 2) {
        // 优先按 playerId 获取候选，避免依赖玩家数组顺序导致错位
        const playerOptions = this.playerShikigamiOptions.get(player.id) || [];
        const fallbackOptions = ((this.state as any).shikigamiOptions as ShikigamiCard[] || []).filter(
          s => !selectedList.some(sel => sel.id === s.id)
        );
        const source = playerOptions.length > 0 ? playerOptions : fallbackOptions;

        if (source.length === 0) {
          console.warn(`[MultiplayerGame] 玩家 ${player.name}(${player.id}) 超时自动分配失败：无可用候选`);
          continue;
        }

        // 过滤掉已选的，从剩余中随机选择
        const remaining = source.filter(
          (s: ShikigamiCard) => !selectedList.some(sel => sel.id === s.id)
        );
        const needed = Math.max(0, 2 - selectedList.length);
        const randomPicked = shuffle(remaining).slice(0, needed);

        // 合并已选和随机选，并兜底截断为2个
        const finalSelection = [...selectedList, ...randomPicked].slice(0, 2) as ShikigamiCard[];
        player.shikigami = finalSelection;
        player.shikigamiState = finalSelection.map(s => ({
          cardId: s.id,
          isExhausted: false,
          markers: {},
        }));
        player.isReady = true;
        this.addLog(`⏰ ${player.name} 超时，自动分配式神：${finalSelection.map((s: ShikigamiCard) => s.name).join('、')}`);
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
    
    // 判断游戏模式：3-4人为标准模式，5-6人为多人模式
    const isMultiplayerMode = players.length >= 5;
    
    // 创建战场（传递玩家数量用于模式判断）
    const field = this.createField(players.length);
    
    // 根据模式过滤式神
    let availableShikigami = [...cardsData.shikigami] as ShikigamiCard[];
    if (!isMultiplayerMode) {
      // 标准模式：移除带🔷标记的式神（multiPlayer = true）
      availableShikigami = availableShikigami.filter((s: any) => !s.multiPlayer);
      console.log(`[createInitialState] 标准模式：式神数量 ${availableShikigami.length}`);
    } else {
      console.log(`[createInitialState] 多人模式：式神数量 ${availableShikigami.length}`);
    }
    
    // 洗牌式神
    this.allShikigami = shuffle(availableShikigami) as ShikigamiCard[];
    
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
      turnHadKill: false,
      pendingDeathChoices: [],  // 待选择退治/超度的妖怪槽位
      killedBossThisTurn: false,  // 本回合是否击杀了鬼王
      pendingBossDeath: false,  // 待选择退治/超度的鬼王
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

    const isAI = id.startsWith('ai_');
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
      isAI,
      aiStrategy: isAI ? ('L1' as const) : undefined,
    };
  }

  /**
   * 创建战场
   */
  private createField(playerCount: number = 2): FieldState {
    // 判断游戏模式：3-4人为标准模式，5-6人为多人模式
    const isMultiplayerMode = playerCount >= 5;
    
    console.log(`[createField] 玩家数量: ${playerCount}, 多人模式: ${isMultiplayerMode}`);
    
    // 创建鬼王牌库（根据模式过滤）
    let bossCards = [...cardsData.boss] as any[];
    if (!isMultiplayerMode) {
      // 标准模式：移除带🔷标记的鬼王（multiplayerOnly = true）
      bossCards = bossCards.filter(b => !b.multiplayerOnly);
      console.log(`[createField] 标准模式：鬼王数量 ${bossCards.length}`);
    } else {
      console.log(`[createField] 多人模式：鬼王数量 ${bossCards.length}`);
    }
    
    const stage1 = shuffle(bossCards.filter(b => b.stage === 1));
    const stage2 = shuffle(bossCards.filter(b => b.stage === 2));
    const stage3 = shuffle(bossCards.filter(b => b.stage === 3));
    
    // 麒麟必须是第一个鬼王，放在数组开头（shift取出）
    const qilin = stage1.find(b => b.name === '麒麟');
    const otherStage1 = stage1.filter(b => b.name !== '麒麟');
    // 顺序：麒麟 → 其他1阶段 → 2阶段 → 3阶段
    const bossDeck = [qilin, ...otherStage1, ...stage2, ...stage3].filter(Boolean) as BossCard[];
    
    // 创建游荡妖怪牌库（根据模式过滤）
    const yokaiDeck: CardInstance[] = [];
    for (const yokai of cardsData.yokai as any[]) {
      if (yokai.name === '招福达摩') continue;
      
      // 基础数量
      let baseCount = yokai.count || 2;
      // 多人专属数量
      const multiPlayerExtra = yokai.multiPlayer || 0;
      
      // 标准模式：只使用基础数量
      // 多人模式：使用基础数量 + 多人专属数量
      const totalCount = isMultiplayerMode ? baseCount + multiPlayerExtra : baseCount;
      
      for (let i = 0; i < totalCount; i++) {
        yokaiDeck.push(this.createCardInstance(yokai, 'yokai'));
      }
    }
    
    console.log(`[createField] 妖怪牌库数量: ${yokaiDeck.length}`);

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
   * 处理置换式神
   */
  private handleReplaceShikigami(playerId: string, shikigamiId: string, slotIndex: number, spellIds: string[]): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前不在行动阶段' };
    }
    
    if (!player.shikigami || !player.shikigami[slotIndex]) {
      return { success: false, error: '没有可置换的式神' };
    }
    
    // 从保存的候选中找式神
    const candidates = (player as any).pendingShikigamiCandidates || [];
    const newShikigami = candidates.find((s: any) => s.id === shikigamiId);
    if (!newShikigami) {
      return { success: false, error: '式神不存在于候选列表中' };
    }
    
    const oldShikigami = player.shikigami[slotIndex];
    
    // 把旧式神放回牌堆
    this.state.field.shikigamiSupply!.push(oldShikigami);
    
    // 替换式神
    player.shikigami[slotIndex] = newShikigami;
    
    // 未选中的候选放回牌堆
    const unselected = candidates.filter((s: any) => s.id !== shikigamiId);
    for (const s of unselected) {
      this.state.field.shikigamiSupply!.push(s);
    }
    
    // 更新式神状态
    if (player.shikigamiState) {
      player.shikigamiState[slotIndex] = {
        cardId: newShikigami.id,
        isExhausted: false,
        markers: {},
      };
    }
    
    // 清除临时数据
    (player as any).pendingShikigamiCandidates = null;
    (player as any).pendingSpellIds = null;
    (player as any).pendingIsReplace = null;
    
    this.addLog(`🔄 ${player.name} 将【${oldShikigami.name}】置换为【${newShikigami.name}】`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
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

  /**
   * 妖怪/令牌进入弃牌堆时恢复为卡面生命：场上用 hp 表示当前生命，击杀后 hp 常为 0；
   * 若 maxHp 未带上，前端与部分判定会认为生命为 0。统一写回 maxHp 与 hp（印刷生命）。
   */
  private ensureYokaiDiscardFaceStats(card: CardInstance): void {
    if (card.cardType !== 'yokai' && card.cardType !== 'token') return;

    let printed =
      (card.maxHp != null && card.maxHp > 0 ? card.maxHp : 0) ||
      (card.hp != null && card.hp > 0 ? card.hp : 0);

    if (!printed) {
      const pool =
        card.cardType === 'token'
          ? ([...(cardsData.token as any[])] as any[])
          : ([...(cardsData.yokai as any[])] as any[]);
      const proto = pool.find(
        (x: any) =>
          x.id === card.cardId ||
          x.cardId === card.cardId ||
          (card.name && x.name === card.name)
      );
      if (proto) printed = proto.hp || proto.damage || 0;
    }

    if (printed > 0) {
      card.maxHp = printed;
      card.hp = printed;
    }
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
    
    // 开始游戏（会在 startPlayingPhase 中随机打乱玩家顺序）
    this.startGame();
  }

  /**
   * 开始游戏
   */
  private startGame(): void {
    // ============ 测试条件配置 ============
    // TEST2-1: 初始手牌增加1/2/3阶阴阳术（测试获得式神）
    // 关闭方式：将 TEST2_1_ENABLED 改为 false
    const TEST2_1_ENABLED = false;
    
    // TEST2-2: 初始手牌增加1/2/3/3阶阴阳术（测试置换式神）
    // 关闭方式：将 TEST2_2_ENABLED 改为 false
    const TEST2_2_ENABLED = true;
    
    // TEST2-3: 测试中级/高级符咒获取条件
    // 关闭方式：将 TEST2_3_ENABLED 改为 false
    const TEST2_3_ENABLED = false;
    // ============ 测试条件配置结束 ============
    
    // 为每个玩家抓初始手牌
    for (const player of this.state.players) {
      this.drawCards(player, GAME_CONSTANTS.STARTING_HAND_SIZE);
      
      // TEST2-1: 添加1+2+3阴阳术（测试获得式神）
      if (TEST2_1_ENABLED) {
        const testSpells: CardInstance[] = [
          { instanceId: `test_spell_${Date.now()}_1_${player.id}`, cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '/images/cards/spell/basic.webp' },
          { instanceId: `test_spell_${Date.now()}_2_${player.id}`, cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, maxHp: 2, damage: 2, charm: 0, image: '/images/cards/spell/medium.webp' },
          { instanceId: `test_spell_${Date.now()}_3_${player.id}`, cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, maxHp: 3, damage: 3, charm: 1, image: '/images/cards/spell/advanced.webp' },
        ];
        player.hand.push(...testSpells);
      }
      
      // TEST2-2: 添加1+2+3+3阴阳术（测试置换式神）
      if (TEST2_2_ENABLED) {
        const testSpells: CardInstance[] = [
          { instanceId: `test_spell_${Date.now()}_1_${player.id}`, cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '/images/cards/spell/basic.webp' },
          { instanceId: `test_spell_${Date.now()}_2_${player.id}`, cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, maxHp: 2, damage: 2, charm: 0, image: '/images/cards/spell/medium.webp' },
          { instanceId: `test_spell_${Date.now()}_3a_${player.id}`, cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, maxHp: 3, damage: 3, charm: 1, image: '/images/cards/spell/advanced.webp' },
          { instanceId: `test_spell_${Date.now()}_3b_${player.id}`, cardId: 'spell_003', cardType: 'spell', name: '高级符咒', hp: 3, maxHp: 3, damage: 3, charm: 1, image: '/images/cards/spell/advanced.webp' },
        ];
        player.hand.push(...testSpells);
      }
      
      // TEST2-3: 添加测试卡牌（测试符咒升级）
      if (TEST2_3_ENABLED) {
        // 手牌增加：基础术式 + 中级符咒
        const testSpells: CardInstance[] = [
          { instanceId: `test_spell_${Date.now()}_1_${player.id}`, cardId: 'spell_001', cardType: 'spell', name: '基础术式', hp: 1, maxHp: 1, damage: 1, charm: 0, image: '/images/cards/spell/basic.webp' },
          { instanceId: `test_spell_${Date.now()}_2_${player.id}`, cardId: 'spell_002', cardType: 'spell', name: '中级符咒', hp: 2, maxHp: 2, damage: 2, charm: 0, image: '/images/cards/spell/medium.webp' },
        ];
        player.hand.push(...testSpells);
        // 弃牌堆增加：生命≥2的妖怪 + 生命≥4的妖怪
        const testYokai: CardInstance[] = [
          { instanceId: `test_yokai_${Date.now()}_1_${player.id}`, cardId: 'yokai_001', cardType: 'yokai', name: '赤舌', hp: 3, maxHp: 3, damage: 0, charm: 0, image: '/images/cards/yokai/001.webp' },
          { instanceId: `test_yokai_${Date.now()}_2_${player.id}`, cardId: 'yokai_010', cardType: 'yokai', name: '海坊主', hp: 5, maxHp: 5, damage: 0, charm: 1, image: '/images/cards/yokai/010.webp' },
        ];
        player.discard.push(...testYokai);
      }
    }
    
    // 记录测试条件日志
    if (TEST2_1_ENABLED) this.addLog('🧪 [TEST2-1] 所有玩家添加测试阴阳术：1+2+3=6点伤害');
    if (TEST2_2_ENABLED) this.addLog('🧪 [TEST2-2] 所有玩家添加测试阴阳术：1+2+3+3=9点（可测试置换式神）');
    if (TEST2_3_ENABLED) this.addLog('🧪 [TEST2-3] 所有玩家添加测试卡牌：手牌(基础+中级)、弃牌堆(妖怪hp3+hp5)');
    
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
    this.state.turnHadKill = false;
    
    // 进入鬼火阶段
    this.enterGhostFirePhase();
  }

  /**
   * 鬼火阶段
   */
  private enterGhostFirePhase(): void {
    const player = this.getCurrentPlayer();
    this.state.turnPhase = 'ghostFire';
    
    // 重置回合限制标记
    player.hasGainedBasicSpell = false;
    (player as any).hasGainedMediumSpell = false;
    (player as any).hasGainedAdvancedSpell = false;
    
    // 鬼火+1
    player.ghostFire = Math.min(
      player.ghostFire + GAME_CONSTANTS.GHOST_FIRE_PER_TURN,
      GAME_CONSTANTS.MAX_GHOST_FIRE
    );
    
    // 鬼火消息 - 仅自己可见
    this.addLog(`🔥 鬼火+1（当前:${player.ghostFire}）`, {
      visibility: 'private',
      playerId: player.id
    });
    
    // 强者离场：上一玩家回合内无「击杀」时自动处理（策划 v0.3.2）
    console.log(`[enterGhostFirePhase] lastPlayerKilledYokai=${this.state.lastPlayerKilledYokai}`);
    if (this.state.lastPlayerKilledYokai === false) {
      this.state.pendingYokaiRefresh = false;
      this.addLog('由于上一名玩家未击杀任何妖怪，最强的3名妖怪走开了。');
      this.applyStrongestThreeYokaiLeave();
      this.notifyStateChange();
    }

    console.log('[enterGhostFirePhase] 进入行动阶段');
    this.enterActionPhase();
  }

  /** 本回合曾将游荡妖怪或鬼王击杀（生命扣至0），用于强者离场与结算 */
  private markTurnHadKill(): void {
    this.state.turnHadKill = true;
  }

  /**
   * 将展示区 HP 最高的 3 张游荡妖怪（同 HP 取槽位下标更大）移入牌库底并补满 6 张
   */
  private applyStrongestThreeYokaiLeave(): void {
    const slots = this.state.field.yokaiSlots;
    const entries: { index: number; card: CardInstance; hp: number }[] = [];
    for (let i = 0; i < slots.length; i++) {
      const c = slots[i];
      if (c) entries.push({ index: i, card: c, hp: c.hp || 0 });
    }
    if (entries.length === 0) return;

    entries.sort((a, b) => {
      if (b.hp !== a.hp) return b.hp - a.hp;
      return b.index - a.index;
    });
    const take = Math.min(3, entries.length);
    const chosen = entries.slice(0, take);
    for (const { index, card } of chosen) {
      this.state.field.yokaiSlots[index] = null;
      this.state.field.yokaiDeck.push(card);
    }
    this.fillYokaiSlots();
  }

  /**
   * 行动阶段
   */
  private enterActionPhase(): void {
    const player = this.getCurrentPlayer();
    this.state.turnPhase = 'action';
    
    // 重置式神疲劳状态
    if (player.shikigamiState) {
      for (const state of player.shikigamiState) {
        state.isExhausted = false;
      }
    }
    
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
    
    // 重置本回合鬼王击杀标记（ allocate 路径用于 UI 待选）
    (this.state as any).killedBossThisTurn = false;

    const hadKillThisTurn = !!this.state.turnHadKill;
    
    // 检查食梦貘「沉睡」buff - 跳过清理阶段
    if (TempBuffHelper.shouldSkipCleanup(player)) {
      this.addLog(`😴 ${player.name} 跳过清理阶段（沉睡）`);
      // 清空buff
      TempBuffHelper.clearBuffs(player);
      // 补充妖怪
      this.fillYokaiSlots();
      this.state.lastPlayerKilledYokai = hadKillThisTurn;
      this.nextTurn();
      return;
    }
    
    // 1. 所有存活妖怪生命恢复至上限
    for (const yokai of this.state.field.yokaiSlots) {
      if (yokai && yokai.hp > 0 && yokai.maxHp) {
        yokai.hp = yokai.maxHp;
      }
    }
    
    // 2. 鬼王生命恢复至上限
    const boss = this.state.field.currentBoss;
    if (boss && boss.hp > 0 && boss.maxHp) {
      boss.hp = boss.maxHp;
    }
    
    // 3. 未使用伤害清空
    player.damage = 0;
    
    // 4. 弃置所有手牌
    player.discard.push(...player.hand);
    player.hand = [];
    
    // 5. 弃置所有已打出的牌
    player.discard.push(...player.played);
    player.played = [];
    
    // 6. 重置本回合打牌计数
    player.cardsPlayed = 0;
    
    // 7. 清空TempBuff
    TempBuffHelper.clearBuffs(player);
    
    // 8. 抓5张牌
    this.drawCards(player, GAME_CONSTANTS.STARTING_HAND_SIZE);
    
    // 9. 补充妖怪
    this.fillYokaiSlots();
    
    // 10. 记录上一回合是否达成击杀（游荡妖怪/鬼王生命扣至0，强于离场规则）
    this.state.lastPlayerKilledYokai = hadKillThisTurn;
    
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
    
    // GM指令不检查回合
    const gmActions = ['gmAddTestCards', 'gmAddCard', 'gmSetShikigami', 'gmAddDamage', 'gmAddToDiscard'];
    if (gmActions.includes(action.type)) {
      return this.handleGmAction(playerId, action);
    }

    // 式神选择同步阶段：禁止对局内行动（避免 currentPlayerIndex===0 误当成「可出牌回合」）
    if (this.state.phase === 'shikigamiSelect') {
      return { success: false, error: '式神选择阶段不可进行此操作' };
    }
    
    // 式神获取相关action不检查回合（需要实时响应）
    const shikigamiAcquireActions = ['getShikigamiCandidates', 'acquireShikigami', 'replaceShikigami'];
    if (shikigamiAcquireActions.includes(action.type)) {
      switch (action.type) {
        case 'getShikigamiCandidates':
          return this.handleGetShikigamiCandidates(playerId, action.spellIds, action.isReplace);
        case 'acquireShikigami':
          return this.handleAcquireShikigami(playerId, action.shikigamiId, action.spellIds);
        case 'replaceShikigami':
          return this.handleReplaceShikigami(playerId, action.shikigamiId, action.slotIndex || 0, action.spellIds);
      }
    }
    
    // 验证是否轮到该玩家
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      return { success: false, error: '不是你的回合' };
    }

    // 行动阶段交互锁：只要存在 pendingChoice，就禁止任何普通 action
    // 目的：避免在某个玩家等待选择时，其他玩家/AI 继续出牌，覆盖 pendingChoice，
    // 导致客户端弹窗重复出现或状态卡死。
    if ((this.state as any).pendingChoice) {
      return { success: false, error: '请先完成当前选择后再继续操作' };
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
      
      case 'retireBoss':
        return this.handleRetireBoss(playerId);
      
      case 'banishBoss':
        return this.handleBanishBoss(playerId);
      
      
      case 'decideYokaiRefresh':
        return this.handleYokaiRefresh(action.refresh);
      
      case 'endTurn':
        return this.handleEndTurn(playerId);
      
      case 'confirmShikigamiPhase':
        return this.handleConfirmShikigamiPhase(playerId);
      
      case 'gainBasicSpell':
        return this.handleGainBasicSpell(playerId);
      
      case 'exchangeMediumSpell':
        return this.handleExchangeMediumSpell(playerId, action.yokaiId);
      
      case 'exchangeAdvancedSpell':
        return this.handleExchangeAdvancedSpell(playerId, action.yokaiId);
      
      case 'acquireShikigami':
        return this.handleAcquireShikigami(playerId, action.shikigamiId, action.spellIds);
      
      case 'replaceShikigami':
        return this.handleReplaceShikigami(playerId, action.shikigamiId, action.slotIndex || 0, action.spellIds);
      
      case 'getShikigamiCandidates':
        return this.handleGetShikigamiCandidates(playerId, action.spellIds, action.isReplace);
      
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
    this.shikigamiSelectStartTime = undefined;
    delete (this.state as any).shikigamiSelectStartTime;
    delete (this.state as any).shikigamiSelectTimeout;
    
    // 🎲 随机打乱玩家行动顺序
    const originalOrder = this.state.players.map(p => p.name).join(' → ');
    this.state.players = shuffle([...this.state.players]);
    const newOrder = this.state.players.map(p => p.name).join(' → ');
    console.log(`[MultiplayerGame] 原始顺序: ${originalOrder}`);
    console.log(`[MultiplayerGame] 随机顺序: ${newOrder}`);
    this.addLog(`🎲 行动顺序：${newOrder}`);
    
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
    this.state.currentPlayerIndex = 0;  // 确保从第一个玩家开始
    
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
    
    // 执行第一个玩家的鬼火阶段
    this.enterGhostFirePhase();
    
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
      this.markTurnHadKill();
      // 标记本回合击杀了鬼王，等待玩家选择退治/超度
      (this.state as any).killedBossThisTurn = true;
      (this.state as any).pendingBossDeath = true;
      this.addLog(`💀 鬼王 ${this.state.field.currentBoss?.name} 被击杀，请选择【退治】或【超度】`);
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
    
    // 检查妖怪是否被击杀
    if (yokai.hp <= 0) {
      this.markTurnHadKill();
      // 添加到待选择列表
      const pendingList = (this.state as any).pendingDeathChoices || [];
      if (!pendingList.includes(slotIndex)) {
        pendingList.push(slotIndex);
        (this.state as any).pendingDeathChoices = pendingList;
      }
      this.addLog(`💀 ${yokai.name} 被击杀，请选择【退治】或【超度】`);
    }
    
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
    
    // 移到弃牌堆（声誉会在notifyStateChange时自动重新计算）
    this.ensureYokaiDiscardFaceStats(yokai);
    player.discard.push(yokai);
    this.state.field.yokaiSlots[slotIndex] = null;
    
    // 从待选择列表中移除
    const pendingList = (this.state as any).pendingDeathChoices || [];
    const idx = pendingList.indexOf(slotIndex);
    if (idx >= 0) pendingList.splice(idx, 1);
    
    // 检查茨木「迁怒」buff
    const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
    if (exileBonus > 0) {
      player.damage += exileBonus;
      this.addLog(`📥 ${player.name} 退治了 ${yokai.name}（+${yokai.charm || 0} 声誉，迁怒+${exileBonus}伤害）`);
    } else {
      this.addLog(`📥 ${player.name} 退治了 ${yokai.name}（+${yokai.charm || 0} 声誉）`);
    }
    
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
    
    // 从待选择列表中移除
    const pendingList = (this.state as any).pendingDeathChoices || [];
    const idx = pendingList.indexOf(slotIndex);
    if (idx >= 0) pendingList.splice(idx, 1);
    
    // 检查茨木「迁怒」buff
    const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
    if (exileBonus > 0) {
      player.damage += exileBonus;
      this.addLog(`🌟 ${player.name} 超度了 ${yokai.name}（迁怒+${exileBonus}伤害）`);
    } else {
      this.addLog(`🌟 ${player.name} 超度了 ${yokai.name}`);
    }
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理退治鬼王（放入弃牌堆）
   */
  private handleRetireBoss(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const boss = this.state.field.currentBoss;
    if (!boss) {
      return { success: false, error: '没有鬼王可以退治' };
    }
    
    if (this.state.field.bossCurrentHp > 0) {
      return { success: false, error: '鬼王还没有被击杀' };
    }
    
    // 鬼王进入弃牌堆
    player.discard.push(boss as any);
    
    // 检查茨木「迁怒」buff
    const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
    if (exileBonus > 0) {
      player.damage += exileBonus;
      this.addLog(`📥 ${player.name} 退治了鬼王 ${boss.name}（+${boss.charm || 0} 声誉，迁怒+${exileBonus}伤害）`);
    } else {
      this.addLog(`📥 ${player.name} 退治了鬼王 ${boss.name}（+${boss.charm || 0} 声誉）`);
    }
    
    // 清除鬼王死亡标记
    (this.state as any).pendingBossDeath = false;
    
    // 清除当前鬼王并翻出下一个
    this.state.field.currentBoss = null;
    this.revealBoss();
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理超度鬼王（移出游戏）
   */
  private handleBanishBoss(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const boss = this.state.field.currentBoss;
    if (!boss) {
      return { success: false, error: '没有鬼王可以超度' };
    }
    
    if (this.state.field.bossCurrentHp > 0) {
      return { success: false, error: '鬼王还没有被击杀' };
    }
    
    // 鬼王进入超度区
    this.state.field.exileZone.push(boss as any);
    
    // 检查茨木「迁怒」buff
    const exileBonus = TempBuffHelper.triggerExileKillBonus(player);
    if (exileBonus > 0) {
      player.damage += exileBonus;
      this.addLog(`🌟 ${player.name} 超度了鬼王 ${boss.name}（迁怒+${exileBonus}伤害）`);
    } else {
      this.addLog(`🌟 ${player.name} 超度了鬼王 ${boss.name}`);
    }
    
    // 清除鬼王死亡标记
    (this.state as any).pendingBossDeath = false;
    
    // 清除当前鬼王并翻出下一个
    this.state.field.currentBoss = null;
    this.revealBoss();
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：添加卡牌到弃牌堆
   */
  private handleGmAddToDiscard(playerId: string, cardName: string, count: number = 1): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    // 查找妖怪数据
    const yokaiData = (cardsData.yokai as any[]).find(y => y.name === cardName);
    if (!yokaiData) {
      return { success: false, error: `找不到妖怪: ${cardName}` };
    }
    
    for (let i = 0; i < count; i++) {
      const card = this.createCardInstance(yokaiData, 'yokai');
      player.discard.push(card);
    }
    
    this.addLog(`🧪 [GM] ${player.name} 弃牌堆添加 ${count}x ${cardName}`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：添加指定卡牌
   */
  private handleGmAddCard(playerId: string, cardName: string, count: number = 1): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    // 查找卡牌数据
    const allCards = [...(cardsData.yokai || []), ...(cardsData.boss || []), ...(cardsData.spell || [])];
    const cardData = allCards.find((c: any) => c.name === cardName);
    
    if (!cardData) {
      // 尝试创建阴阳术
      const spellMap: Record<string, any> = {
        '基础术式': { cardId: 'spell_001', damage: 1, hp: 1, charm: 0, image: '阴阳术01.png' },
        '中级符咒': { cardId: 'spell_002', damage: 2, hp: 2, charm: 0, image: '阴阳术02.png' },
        '高级符咒': { cardId: 'spell_003', damage: 3, hp: 3, charm: 1, image: '阴阳术03.png' },
      };
      const spell = spellMap[cardName];
      if (spell) {
        for (let i = 0; i < count; i++) {
          player.hand.push({
            instanceId: `gm_${Date.now()}_${i}`,
            cardId: spell.cardId,
            cardType: 'spell',
            name: cardName,
            hp: spell.hp,
            maxHp: spell.hp,
            damage: spell.damage,
            charm: spell.charm,
            image: spell.image,
          });
        }
        this.addLog(`🧪 [GM] ${player.name} 获得 ${count}x ${cardName}`);
        this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
        return { success: true };
      }
      return { success: false, error: `找不到卡牌: ${cardName}` };
    }
    
    // 创建卡牌实例
    for (let i = 0; i < count; i++) {
      const card = this.createCardInstance(cardData, cardData.type || 'yokai');
      player.hand.push(card);
    }
    this.addLog(`🧪 [GM] ${player.name} 获得 ${count}x ${cardName}`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：替换式神
   */
  private handleGmSetShikigami(playerId: string, slotIndex: number, shikigamiName: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    // 查找式神数据
    const shikigamiData = (cardsData.shikigami as any[]).find(s => s.name === shikigamiName);
    if (!shikigamiData) {
      return { success: false, error: `找不到式神: ${shikigamiName}` };
    }
    
    if (slotIndex < 0 || slotIndex >= player.shikigami.length) {
      return { success: false, error: `无效的式神槽位: ${slotIndex}` };
    }
    
    // 替换式神
    const oldName = player.shikigami[slotIndex]?.name || '空';
    player.shikigami[slotIndex] = { ...shikigamiData } as any;
    
    this.addLog(`🧪 [GM] ${player.name} 式神槽${slotIndex}: ${oldName} → ${shikigamiName}`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：添加伤害
   */
  private handleGmAddDamage(playerId: string, damage: number): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    player.damage += damage;
    this.addLog(`🧪 [GM] ${player.name} 获得 ${damage} 点伤害（当前: ${player.damage}）`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：替换妖怪（公共方法，从API调用）
   */
  gmSetYokai(slotIndex: number, yokaiName: string): { success: boolean; error?: string } {
    // 查找妖怪数据
    const yokaiData = (cardsData.yokai as any[]).find(y => y.name === yokaiName);
    if (!yokaiData) {
      return { success: false, error: `找不到妖怪: ${yokaiName}` };
    }
    
    if (slotIndex < 0 || slotIndex >= 6) {
      return { success: false, error: `无效的妖怪槽位: ${slotIndex}` };
    }
    
    // 创建妖怪实例并替换
    const yokai = this.createCardInstance(yokaiData, 'yokai');
    const oldName = this.state.field.yokaiSlots[slotIndex]?.name || '空';
    this.state.field.yokaiSlots[slotIndex] = yokai;
    
    this.addLog(`🧪 [GM] 妖怪槽${slotIndex}: ${oldName} → ${yokaiName}`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * GM指令：替换鬼王（公共方法，从API调用）
   */
  gmSetBoss(bossName: string): { success: boolean; error?: string } {
    // 查找鬼王数据
    const bossData = (cardsData.boss as any[]).find(b => b.name === bossName);
    if (!bossData) {
      return { success: false, error: `找不到鬼王: ${bossName}` };
    }
    
    // 替换当前鬼王
    const oldName = this.state.field.currentBoss?.name || '空';
    this.state.field.currentBoss = { ...bossData };
    this.state.field.bossCurrentHp = bossData.hp || 8;
    
    this.addLog(`🧪 [GM] 鬼王: ${oldName} → ${bossName} (HP: ${this.state.field.bossCurrentHp})`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 统一处理GM指令（不检查回合）
   */
  private handleGmAction(playerId: string, action: any): { success: boolean; error?: string } {
    switch (action.type) {
      case 'gmAddTestCards':
        return this.handleGmAddTestCards(playerId);
      case 'gmAddCard':
        return this.handleGmAddCard(playerId, action.cardName, action.count);
      case 'gmSetShikigami':
        return this.handleGmSetShikigami(playerId, action.slotIndex, action.shikigamiName);
      case 'gmAddDamage':
        return this.handleGmAddDamage(playerId, action.damage);
      case 'gmAddToDiscard':
        return this.handleGmAddToDiscard(playerId, action.cardName, action.count);
      default:
        return { success: false, error: '未知的GM指令' };
    }
  }

  /**
   * GM指令：添加测试卡牌（1+2+3+3阴阳术）
   */
  private handleGmAddTestCards(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const testSpells: CardInstance[] = [
      { 
        instanceId: `gm_spell_${Date.now()}_1`, 
        cardId: 'spell_001', 
        cardType: 'spell', 
        name: '基础术式', 
        hp: 1, 
        maxHp: 1, 
        damage: 1, 
        charm: 0, 
        image: '阴阳术01.png',
        effect: '【触】超度此牌+弃牌堆中生命≥2的妖怪，获得「中级符咒」'
      },
      { 
        instanceId: `gm_spell_${Date.now()}_2`, 
        cardId: 'spell_002', 
        cardType: 'spell', 
        name: '中级符咒', 
        hp: 2, 
        maxHp: 2, 
        damage: 2, 
        charm: 0, 
        image: '阴阳术02.png',
        effect: '【触】超度此牌+弃牌堆中生命≥4的妖怪，获得「高级符咒」'
      },
      { 
        instanceId: `gm_spell_${Date.now()}_3a`, 
        cardId: 'spell_003', 
        cardType: 'spell', 
        name: '高级符咒', 
        hp: 3, 
        maxHp: 3, 
        damage: 3, 
        charm: 1, 
        image: '阴阳术03.png',
        effect: '【触】式神<3时：超度含此牌、伤害合计≥5的牌，获得1个式神'
      },
      { 
        instanceId: `gm_spell_${Date.now()}_3b`, 
        cardId: 'spell_003', 
        cardType: 'spell', 
        name: '高级符咒', 
        hp: 3, 
        maxHp: 3, 
        damage: 3, 
        charm: 1, 
        image: '阴阳术03.png',
        effect: '【触】式神<3时：超度含此牌、伤害合计≥5的牌，获得1个式神'
      },
    ];
    
    player.hand.push(...testSpells);
    this.addLog(`🧪 [GM] ${player.name} 获得测试卡牌：1+2+3+3=9点伤害`);
    
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }
  
  /**
   * 处理获取基础术式
   */
  private handleGainBasicSpell(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前不在行动阶段' };
    }
    
    if (player.hasGainedBasicSpell) {
      return { success: false, error: '本回合已获得过基础术式' };
    }
    
    // 创建基础术式卡牌（使用完整数据）
    const basicSpell: CardInstance = {
      instanceId: `spell_basic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cardId: 'spell_001',
      cardType: 'spell',
      name: '基础术式',
      damage: 1,
      hp: 1,
      charm: 0,
      effect: '【触】超度此牌+弃牌堆中生命≥2的妖怪，获得「中级符咒」',
      image: '阴阳术01.png',
    };
    
    // 加入弃牌堆
    player.discard.push(basicSpell);
    player.hasGainedBasicSpell = true;
    
    this.addLog(`📜 ${player.name} 获得了【基础术式】`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
  }
  
  /**
   * 处理兑换中级符咒
   */
  private handleExchangeMediumSpell(playerId: string, yokaiId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前不在行动阶段' };
    }
    
    if ((player as any).hasGainedMediumSpell) {
      return { success: false, error: '本回合已兑换过中级符咒' };
    }
    
    // 找到手牌中的基础术式
    const basicSpellIdx = player.hand.findIndex(c => 
      c.cardId === 'spell_001' || c.cardId === 'basic_spell' || c.name === '基础术式'
    );
    if (basicSpellIdx === -1) {
      return { success: false, error: '手牌中没有基础术式' };
    }
    
    // 找到弃牌堆中的妖怪
    const yokaiIdx = player.discard.findIndex(c => c.instanceId === yokaiId);
    if (yokaiIdx === -1) {
      return { success: false, error: '弃牌堆中没有该妖怪' };
    }
    
    const yokai = player.discard[yokaiIdx];
    // 弃牌堆妖怪可能为「已击杀」残留 hp=0，判定时用卡面生命（maxHp）
    const yokaiLife = yokai.maxHp ?? yokai.hp ?? 0;
    if (yokaiLife < 2) {
      return { success: false, error: '妖怪生命值不足' };
    }
    
    // 移除基础术式和妖怪（超度到exiled区）
    const spell = player.hand.splice(basicSpellIdx, 1)[0];
    const yokaiCard = player.discard.splice(yokaiIdx, 1)[0];
    if (!player.exiled) player.exiled = [];
    player.exiled.push(spell);
    player.exiled.push(yokaiCard);
    
    // 创建中级符咒（使用完整数据）
    const mediumSpell: CardInstance = {
      instanceId: `spell_medium_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cardId: 'spell_002',
      cardType: 'spell',
      name: '中级符咒',
      damage: 2,
      hp: 2,
      charm: 0,
      effect: '【触】超度此牌+弃牌堆中生命≥4的妖怪，获得「高级符咒」',
      image: '阴阳术02.png',
    };
    
    player.discard.push(mediumSpell);
    (player as any).hasGainedMediumSpell = true;
    
    this.addLog(`📜 ${player.name} 兑换了【中级符咒】（超度了 ${yokai.name}）`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
  }
  
  /**
   * 处理兑换高级符咒
   */
  private handleExchangeAdvancedSpell(playerId: string, yokaiId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前不在行动阶段' };
    }
    
    if ((player as any).hasGainedAdvancedSpell) {
      return { success: false, error: '本回合已兑换过高级符咒' };
    }
    
    // 找到手牌中的中级符咒
    const mediumSpellIdx = player.hand.findIndex(c => 
      c.cardId === 'spell_002' || c.name === '中级符咒'
    );
    if (mediumSpellIdx === -1) {
      return { success: false, error: '手牌中没有中级符咒' };
    }
    
    // 找到弃牌堆中的妖怪
    const yokaiIdx = player.discard.findIndex(c => c.instanceId === yokaiId);
    if (yokaiIdx === -1) {
      return { success: false, error: '弃牌堆中没有该妖怪' };
    }
    
    const yokai = player.discard[yokaiIdx];
    const yokaiLifeAdv = yokai.maxHp ?? yokai.hp ?? 0;
    if (yokaiLifeAdv < 4) {
      return { success: false, error: '妖怪生命值不足' };
    }
    
    // 移除中级符咒和妖怪（超度到exiled区）
    const spell = player.hand.splice(mediumSpellIdx, 1)[0];
    const yokaiCard = player.discard.splice(yokaiIdx, 1)[0];
    if (!player.exiled) player.exiled = [];
    player.exiled.push(spell);
    player.exiled.push(yokaiCard);
    
    // 创建高级符咒（使用完整数据）
    const advancedSpell: CardInstance = {
      instanceId: `spell_advanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cardId: 'spell_003',
      cardType: 'spell',
      name: '高级符咒',
      damage: 3,
      hp: 3,
      charm: 0,
      effect: '超度此牌获得式神，或替换已有的式神',
      image: '阴阳术03.png',
    };
    
    player.discard.push(advancedSpell);
    (player as any).hasGainedAdvancedSpell = true;
    
    this.addLog(`📜 ${player.name} 兑换了【高级符咒】（超度了 ${yokai.name}）`);
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
  }
  
  /**
   * 处理获取式神候选列表
   */
  private handleGetShikigamiCandidates(playerId: string, spellIds: string[], isReplace: boolean): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    // 验证符咒
    const spells = spellIds.map(id => player.hand.find(c => c.instanceId === id)).filter(Boolean);
    if (spells.length === 0) {
      return { success: false, error: '请选择要超度的符咒' };
    }
    
    // 计算符咒总伤害
    const spellDamage = spells.reduce((sum, spell) => sum + (spell?.damage || 1), 0);
    
    // 置换需要高级符咒（伤害>=3）
    if (isReplace) {
      const hasAdvanced = spells.some(s => (s?.damage || 0) >= 3 || s?.name === '高级符咒');
      if (!hasAdvanced) {
        return { success: false, error: '置换式神需要高级符咒' };
      }
      // 置换需要正好1张高级符咒
      if (spells.length !== 1 || spellDamage !== 3) {
        return { success: false, error: '置换式神需要恰好1张高级符咒' };
      }
    } else {
      // 获取式神需要总伤害>=5，且有高级符咒
      if (spellDamage < 5) {
        return { success: false, error: `符咒伤害不足（需要≥5，当前${spellDamage}）` };
      }
      const hasAdvanced = spells.some(s => (s?.damage || 0) >= 3 || s?.name === '高级符咒');
      if (!hasAdvanced) {
        return { success: false, error: '获取式神需要至少1张高级符咒' };
      }
    }
    
    // 消耗符咒（移到超度区）
    for (const spellId of spellIds) {
      const idx = player.hand.findIndex(c => c.instanceId === spellId);
      if (idx !== -1) {
        const spell = player.hand.splice(idx, 1)[0];
        if (!player.exiled) player.exiled = [];
        player.exiled.push(spell);
      }
    }
    
    // 从式神牌堆抽取候选（固定2个，与单人模式一致）
    const candidateCount = 2;
    const candidates: any[] = [];
    
    for (let i = 0; i < candidateCount && (this.state.field.shikigamiSupply?.length || 0) > 0; i++) {
      const shikigami = this.state.field.shikigamiSupply!.pop();
      if (shikigami) {
        candidates.push(shikigami);
      }
    }
    
    // 保存候选和待使用的符咒ID（用于后续确认）
    (player as any).pendingShikigamiCandidates = candidates;
    (player as any).pendingSpellIds = spellIds;
    (player as any).pendingIsReplace = isReplace;
    
    this.addLog(`📿 ${player.name} 超度了 ${spellDamage} 点伤害的符咒，准备${isReplace ? '置换' : '获取'}式神`);
    this.addLog(`🎴 可选式神：${candidates.map(s => s.name).join('、')}`);
    
    // 发送候选列表事件
    console.log(`[handleGetShikigamiCandidates] 发送候选事件:`, candidates.map(c => c.name));
    this.notifyStateChange({
      type: 'shikigamiCandidates',
      candidates,
    } as any);
    
    return { success: true };
  }
  
  /**
   * 处理获取式神
   */
  private handleAcquireShikigami(playerId: string, shikigamiId: string, spellIds: string[]): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前不在行动阶段' };
    }
    
    if ((player.shikigami?.length || 0) >= 3) {
      return { success: false, error: '式神数量已达上限（最多3个）' };
    }
    
    // 从保存的候选中找式神
    const candidates = (player as any).pendingShikigamiCandidates || [];
    const shikigami = candidates.find((s: any) => s.id === shikigamiId);
    if (!shikigami) {
      // 尝试从全局数据找
      const globalShikigami = (cardsData.shikigami as any[]).find(s => s.id === shikigamiId);
      if (!globalShikigami) {
        return { success: false, error: '式神不存在' };
      }
      // 使用全局数据
      if (!player.shikigami) player.shikigami = [];
      player.shikigami.push({ ...globalShikigami });
    } else {
      // 添加式神
      if (!player.shikigami) player.shikigami = [];
      player.shikigami.push(shikigami);
    }
    
    // 未选中的候选放回牌堆
    const unselected = candidates.filter((s: any) => s.id !== shikigamiId);
    for (const s of unselected) {
      this.state.field.shikigamiSupply!.push(s);
    }
    
    // 添加式神状态
    if (!player.shikigamiState) player.shikigamiState = [];
    player.shikigamiState.push({
      cardId: shikigamiId,
      isExhausted: false,
      markers: {},
    });
    
    // 清除临时数据
    (player as any).pendingShikigamiCandidates = null;
    (player as any).pendingSpellIds = null;
    (player as any).pendingIsReplace = null;
    
    this.addLog(`✨ ${player.name} 获得了式神【${shikigami?.name || '未知'}】`);
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
    
    // 鬼王进入弃牌堆（声誉会在notifyStateChange时自动重新计算）
    player.discard.push(boss as any);
    
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
    // 保存maxHp用于回合结束恢复
    if (!boss.maxHp && boss.hp) {
      boss.maxHp = boss.hp;
    }
    this.state.field.currentBoss = boss;
    this.state.field.bossCurrentHp = boss.hp;
    
    this.addLog(`👹 鬼王 ${boss.name} 登场！（HP: ${boss.hp}）`);
    
    // 执行鬼王来袭效果（麒麟除外）
    if (boss.name !== '麒麟') {
      this.executeBossArrivalEffect(boss);
    }
  }
  
  /**
   * 执行鬼王来袭效果
   */
  private executeBossArrivalEffect(boss: BossCard): void {
    const bossName = boss.name;
    
    switch (bossName) {
      case '鬼灵歌伎':
        // 每位玩家恶评+1（简化：给每人加1张农夫卡）
        this.addLog(`   👹 来袭：每位玩家获得1张「恶评：农夫」`);
        for (const player of this.state.players) {
          const penaltyCard: CardInstance = {
            instanceId: `penalty_farmer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cardId: 'penalty_farmer',
            cardType: 'penalty',
            name: '恶评：农夫',
            damage: 0,
            charm: -1,
          };
          player.discard.push(penaltyCard);
        }
        break;
        
      case '鸦天狗':
        // 每位玩家弃置1张手牌
        this.addLog(`   👹 来袭：每位玩家弃置1张手牌`);
        for (const player of this.state.players) {
          if (player.hand.length > 0) {
            // 简化：随机弃置1张
            const randIdx = Math.floor(Math.random() * player.hand.length);
            const card = player.hand.splice(randIdx, 1)[0];
            player.discard.push(card);
          }
        }
        break;
        
      case '胧车':
        // 每位玩家超度1张御魂（简化：自动超度弃牌堆中最低HP的御魂）
        this.addLog(`   👹 来袭：每位玩家超度1张御魂`);
        for (const player of this.state.players) {
          const yokais = player.discard.filter(c => c.cardType === 'yokai');
          if (yokais.length > 0) {
            yokais.sort((a, b) => (a.hp || 0) - (b.hp || 0));
            const toExile = yokais[0];
            const idx = player.discard.indexOf(toExile);
            if (idx >= 0) {
              player.discard.splice(idx, 1);
              if (!player.exiled) player.exiled = [];
              player.exiled.push(toExile);
              this.addLog(`      ${player.name} 超度了 ${toExile.name}`);
            }
          }
        }
        break;
        
      case '荒骷髅':
        // 超度弃牌堆中生命>7的御魂
        this.addLog(`   👹 来袭：超度弃牌堆中生命>7的御魂`);
        for (const player of this.state.players) {
          const toExile = player.discard.filter(c => (c.cardType === 'yokai' || c.cardType === 'boss') && (c.hp || 0) > 7);
          for (const card of toExile) {
            const idx = player.discard.indexOf(card);
            if (idx >= 0) {
              player.discard.splice(idx, 1);
              if (!player.exiled) player.exiled = [];
              player.exiled.push(card);
              this.addLog(`      ${player.name} 的 ${card.name} 被超度`);
            }
          }
        }
        break;
        
      case '地震鲶':
        // 隐藏牌库顶（简化：暂不处理）
        this.addLog(`   👹 来袭：牌库顶1张牌被隐藏`);
        break;
        
      default:
        // 其他鬼王无来袭效果或待实现
        if ((boss as any).arrivalEffect) {
          this.addLog(`   ⚠️ 来袭效果待实现: ${(boss as any).arrivalEffect}`);
        }
        break;
    }
  }
  
  /**
   * 填充妖怪槽位
   */
  private fillYokaiSlots(): void {
    for (let i = 0; i < this.state.field.yokaiSlots.length; i++) {
      if (!this.state.field.yokaiSlots[i] && this.state.field.yokaiDeck.length > 0) {
        const yokai = this.state.field.yokaiDeck.shift()!;
        // 设置maxHp用于显示
        if (!yokai.maxHp && yokai.hp) {
          yokai.maxHp = yokai.hp;
        }
        this.state.field.yokaiSlots[i] = yokai;
      }
    }
    
    // 检查游戏结束条件：妖怪不足6张
    this.checkGameEnd();
  }
  
  /**
   * 检查游戏结束条件
   */
  private checkGameEnd(): boolean {
    // 条件1：鬼王全部被击败
    if (!this.state.field.currentBoss && this.state.field.bossDeck.length === 0) {
      this.endGame();
      return true;
    }
    
    // 条件2：妖怪不足以补满6个槽位
    const filledSlots = this.state.field.yokaiSlots.filter(s => s !== null).length;
    if (filledSlots < GAME_CONSTANTS.YOKAI_SLOTS && this.state.field.yokaiDeck.length === 0) {
      this.addLog('⚠️ 妖怪牌库耗尽，场上妖怪不足6只！');
      this.endGame();
      return true;
    }
    
    return false;
  }
  
  /**
   * 抽牌
   */
  private drawCards(player: PlayerState, count: number): void {
    for (let i = 0; i < count; i++) {
      if (player.deck.length === 0) {
        // 洗入弃牌堆
        if (player.discard.length === 0) break;
        this.addLog(`🔄 ${player.name} 牌库耗尽，洗入弃牌堆`);
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
    
    // 阴阳术：累加伤害 + 检查Buff
    if (card.cardType === 'spell' && card.damage) {
      const bonusDamage = TempBuffHelper.consumeSpellDamageBonus(player);
      const totalDamage = card.damage + bonusDamage;
      player.damage += totalDamage;
      
      if (bonusDamage > 0) {
        this.addLog(`🃏 ${player.name} 打出 ${card.name} (+${card.damage}+${bonusDamage}伤害)`);
      } else {
        this.addLog(`🃏 ${player.name} 打出 ${card.name} (+${card.damage}伤害)`);
      }
    }
    // 御魂卡：执行御魂效果（伤害由效果内部处理）
    else if (card.cardType === 'yokai' || card.cardType === 'boss' || card.name?.includes('伞妖') || (card as any).type === 'yokai') {
      console.log(`[DEBUG] 御魂卡触发: ${card.name}, cardType=${card.cardType}, type=${(card as any).type}`);
      // 检查轮入道双倍效果
      let damageMultiplier = 1;
      if (TempBuffHelper.consumeNextYokaiDouble(player)) {
        damageMultiplier = 2;
        this.addLog(`🔄 轮入道效果：御魂效果×2！`);
      }
      
      // 如果卡牌有基础伤害字段，先累加
      if (card.damage) {
        player.damage += card.damage * damageMultiplier;
        this.addLog(`🎴 ${player.name} 打出御魂 ${card.name} (+${card.damage * damageMultiplier}伤害)`);
      } else {
        this.addLog(`🎴 ${player.name} 打出御魂 ${card.name}`);
      }
      
      // 执行御魂效果（效果内部可能有额外伤害）
      this.executeYokaiEffect(player, card, damageMultiplier);
    }
    // 其他卡牌
    else if (card.damage) {
      player.damage += card.damage;
      this.addLog(`🃏 ${player.name} 打出 ${card.name} (+${card.damage}伤害)`);
    } else {
      this.addLog(`🃏 ${player.name} 打出 ${card.name}`);
    }
    
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
    
    const skillName = shikigami.skill?.name || '未知';
    this.addLog(`⚡ ${player.name} 使用 ${shikigami.name} 的技能：${skillName}`);
    
    // 执行技能效果
    this.executeShikigamiSkill(player, shikigami.id, skillName);
    
    this.notifyStateChange();
    
    return { success: true };
  }
  
  /**
   * 执行式神技能效果
   */
  private executeShikigamiSkill(player: PlayerState, shikigamiId: string, skillName: string): void {
    // 根据式神ID或技能名执行不同效果
    switch (shikigamiId) {
      case 'shikigami_022': // 山童「怪力」
        // 本回合打出的前2张阴阳术+1伤害
        TempBuffHelper.addBuff(player, {
          type: 'SPELL_DAMAGE_BONUS',
          value: 1,
          remainingCount: 2,
        });
        this.addLog(`   💪 怪力：接下来2张阴阳术+1伤害`);
        break;
        
      case 'shikigami_004': // 茨木童子「迁怒」
        // 每次退治/超度妖怪+2伤害
        TempBuffHelper.addBuff(player, {
          type: 'EXILE_KILL_DAMAGE',
          value: 2,
        });
        this.addLog(`   😤 迁怒：退治/超度妖怪时+2伤害`);
        break;
        
      case 'shikigami_009': // 鬼使白「魂狩」
        // 首次退治HP≤6的妖怪进入手牌
        TempBuffHelper.addBuff(player, {
          type: 'FIRST_KILL_TO_HAND',
          maxHp: 6,
          triggered: false,
        });
        this.addLog(`   👻 魂狩：首次退治的妖怪进入手牌`);
        break;
        
      case 'shikigami_007': // 狂骨「杀戮」
        // 伤害+2
        player.damage += 2;
        this.addLog(`   ⚔️ 杀戮：伤害+2`);
        break;
        
      case 'shikigami_003': // 座�的童子「灵之火」
        // 鬼火+1
        if (player.ghostFire < GAME_CONSTANTS.MAX_GHOST_FIRE) {
          player.ghostFire++;
          this.addLog(`   🔥 灵之火：鬼火+1`);
        }
        break;
        
      case 'shikigami_018': // 大天狗「羽刃暴风」
        // 伤害+3（简化版，完整版需要联动目标）
        player.damage += 3;
        this.addLog(`   🌪️ 羽刃暴风：伤害+3`);
        break;
        
      case 'shikigami_020': // 酒吞童子「酒葫芦」
        // 抓1张牌
        this.drawCards(player, 1);
        this.addLog(`   🍶 酒葫芦：抓1张牌`);
        break;
        
      case 'shikigami_021': // 食梦貘「沉睡」
        // 跳过清理阶段
        TempBuffHelper.addBuff(player, { type: 'SKIP_CLEANUP' });
        this.addLog(`   😴 沉睡：本回合跳过清理阶段`);
        break;
        
      default:
        // 默认：技能效果未实现
        this.addLog(`   ⚠️ 技能效果待实现: ${skillName}`);
        break;
    }
  }
  
  /**
   * 执行御魂效果（完整版）
   */
  private executeYokaiEffect(player: PlayerState, card: CardInstance, multiplier: number = 1): void {
    const yokaiName = card.name;
    
    // 根据妖怪名称执行效果
    for (let m = 0; m < multiplier; m++) {
      switch (yokaiName) {
        // ============ 生命2 ============
        case '招福达摩':
          // 无效果
          break;
          
        case '唐纸伞妖':
          // 伤害+1，查看牌库顶牌，可选超度
          player.damage += 1;
          this.addLog(`   ✨ 御魂：伤害+1`);
          
          // 如果牌库有牌，设置等待玩家选择是否超度
          if (player.deck.length > 0) {
            const topCard = player.deck[0];
            this.state.pendingChoice = {
              type: 'salvageChoice',
              playerId: player.id,
              card: topCard,
              prompt: `查看牌库顶牌【${topCard.name}】，是否超度？`
            };
            this.addLog(`   👁️ 查看牌库顶牌：${topCard.name}`, { 
              visibility: 'private', 
              playerId: player.id 
            });
          } else {
            this.addLog(`   ⚠️ 牌库为空，无法查看`, { 
              visibility: 'private', 
              playerId: player.id 
            });
          }
          break;
          
        case '天邪鬼绿':
          // 退治1个生命≤4的游荡妖怪 - 让玩家选择目标
          {
            const validTargets = this.state.field.yokaiSlots
              .filter((y): y is CardInstance => y !== null && (y.hp || 0) <= 4 && (y.hp || 0) > 0);
            
            if (validTargets.length === 0) {
              this.addLog(`   ⚠️ 御魂：场上没有符合条件的妖怪`);
            } else if (validTargets.length === 1) {
              // 只有一个目标时自动选择
              const target = validTargets[0];
              const idx = this.state.field.yokaiSlots.findIndex(y => y?.instanceId === target.instanceId);
              if (idx !== -1) {
                this.state.field.yokaiSlots[idx] = null;
                this.ensureYokaiDiscardFaceStats(target);
                player.discard.push(target);
                this.addLog(`   ✨ 御魂：退治${target.name}`);
              }
            } else {
              // 多个目标时让玩家选择
              this.state.pendingChoice = {
                type: 'yokaiTarget',
                playerId: player.id,
                prompt: '选择要退治的妖怪（生命≤4）',
                options: validTargets.map(y => y.instanceId),
              };
              this.addLog(`   🎯 御魂：选择退治目标...`);
            }
          }
          break;
          
        case '天邪鬼青':
          // 选择：抓牌+1 或 伤害+1（需要玩家二选一）
          this.state.pendingChoice = {
            type: 'yokaiChoice',
            playerId: player.id,
            options: ['抓牌+1', '伤害+1'],
            prompt: '选择一个效果'
          };
          this.addLog(`   🎯 御魂：选择抓牌+1 或 伤害+1`);
          break;
          
        case '天邪鬼赤':
          // 伤害+1
          player.damage += 1;
          this.addLog(`   ✨ 御魂：伤害+1`);
          break;
          
        case '天邪鬼黄':
          // 抓牌+2
          this.drawCards(player, 2);
          this.addLog(`   ✨ 御魂：抓牌+2`);
          break;
          
        case '赤舌':
          // [妨害] 对手弃牌堆顶牌置于牌库顶
          for (const p of this.state.players) {
            if (p.id === player.id) continue;
            if (p.discard.length > 0) {
              p.deck.push(p.discard.pop()!);
            }
          }
          this.addLog(`   ✨ 御魂：[妨害]对手牌库顶添加弃牌`);
          break;
          
        // ============ 生命3 ============
        case '灯笼鬼':
          // 鬼火+1，抓牌+1
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.drawCards(player, 1);
          this.addLog(`   ✨ 御魂：鬼火+1，抓牌+1`);
          break;
          
        case '树妖':
          // 抓牌+2，弃置1张
          this.drawCards(player, 2);
          if (player.hand.length > 0) {
            player.discard.push(player.hand.shift()!);
          }
          this.addLog(`   ✨ 御魂：抓牌+2，弃置1张`);
          break;
          
        case '日女巳时':
          // 选择：鬼火+1 / 抓牌+2 / 伤害+2（默认伤害）
          player.damage += 2;
          this.addLog(`   ✨ 御魂：伤害+2`);
          break;
          
        case '蚌精':
          // 抓牌+2（超度部分简化）
          this.drawCards(player, 2);
          this.addLog(`   ✨ 御魂：抓牌+2`);
          break;
          
        case '鸣屋':
          // 弃牌堆空则伤害+4，否则伤害+2
          {
            const dmg = player.discard.length === 0 ? 4 : 2;
            player.damage += dmg;
            this.addLog(`   ✨ 御魂：伤害+${dmg}`);
          }
          break;
          
        case '蝠翼':
          // 抓牌+1，伤害+1
          this.drawCards(player, 1);
          player.damage += 1;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+1`);
          break;
          
        case '兵主部':
          // 伤害+2
          player.damage += 2;
          this.addLog(`   ✨ 御魂：伤害+2`);
          break;
          
        case '魅妖':
          // [妨害] 简化处理
          this.addLog(`   ✨ 御魂：[妨害]魅惑对手`);
          break;
          
        // ============ 生命4 ============
        case '骰子鬼':
          // 伤害+2（简化）
          player.damage += 2;
          this.addLog(`   ✨ 御魂：伤害+2`);
          break;
          
        case '涅槃之火':
          // 本回合式神技能鬼火消耗-1
          TempBuffHelper.addBuff(player, {
            type: 'SKILL_COST_REDUCTION',
            value: 1,
          });
          this.addLog(`   ✨ 御魂：式神技能费用-1`);
          break;
          
        case '雪幽魂':
          // [妨害] 抓牌+1，对手获得恶评
          this.drawCards(player, 1);
          for (const p of this.state.players) {
            if (p.id === player.id) continue;
            this.givePenaltyCard(p);
          }
          this.addLog(`   ✨ 御魂：抓牌+1，[妨害]对手获得恶评`);
          break;
          
        case '轮入道':
          // 下一张御魂效果×2
          TempBuffHelper.addBuff(player, { type: 'NEXT_YOKAI_DOUBLE' });
          this.addLog(`   ✨ 御魂：下张御魂效果×2`);
          break;
          
        case '网切':
          // 本回合妖怪生命-1
          TempBuffHelper.addBuff(player, { type: 'HP_REDUCTION', value: 1 });
          this.addLog(`   ✨ 御魂：妖怪生命-1`);
          break;
          
        case '铮':
          // 抓牌+1，伤害+2
          this.drawCards(player, 1);
          player.damage += 2;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+2`);
          break;
          
        case '薙魂':
          // 抓牌+1，弃置1张
          this.drawCards(player, 1);
          if (player.hand.length > 0) {
            player.discard.push(player.hand.shift()!);
          }
          this.addLog(`   ✨ 御魂：抓牌+1，弃置1张`);
          break;
          
        case '魍魉之匣':
          // 抓牌+1，伤害+1
          this.drawCards(player, 1);
          player.damage += 1;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+1`);
          break;
          
        // ============ 生命5 ============
        case '狂骨':
          // 抓牌+1，伤害+鬼火数
          this.drawCards(player, 1);
          player.damage += player.ghostFire;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+${player.ghostFire}`);
          break;
          
        case '返魂香':
          // [妨害] 抓牌+1，伤害+1
          this.drawCards(player, 1);
          player.damage += 1;
          this.addLog(`   ✨ 御魂：抓牌+1，伤害+1`);
          break;
          
        case '镇墓兽':
          // 鬼火+1，抓牌+1，伤害+2
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.drawCards(player, 1);
          player.damage += 2;
          this.addLog(`   ✨ 御魂：鬼火+1，抓牌+1，伤害+2`);
          break;
          
        case '针女':
          // 伤害+1，本回合技能伤害+2
          player.damage += 1;
          TempBuffHelper.addBuff(player, { type: 'SKILL_DAMAGE_BONUS', value: 2 });
          this.addLog(`   ✨ 御魂：伤害+1，技能伤害+2`);
          break;
          
        case '心眼':
          // 伤害+3
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '涂佛':
          // 从弃牌区取回阴阳术（简化：取1张）
          {
            const spell = player.discard.find(c => c.cardType === 'spell');
            if (spell) {
              const idx = player.discard.indexOf(spell);
              player.hand.push(player.discard.splice(idx, 1)[0]);
              this.addLog(`   ✨ 御魂：从弃牌区取回${spell.name}`);
            }
          }
          break;
          
        case '地藏像':
          // 超度此牌可获得式神（特殊处理）
          this.addLog(`   ✨ 御魂：可超度获取式神`);
          break;
          
        case '提灯小僧':
          // 鬼火+1
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.addLog(`   ✨ 御魂：鬼火+1`);
          break;
          
        // ============ 生命6 ============
        case '飞缘魔':
          // 使用鬼王效果（简化：伤害+3）
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '破势':
          // 伤害+3（首张+5简化）
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '镜姬':
          // 抓牌+2，伤害+1，鬼火+1
          this.drawCards(player, 2);
          player.damage += 1;
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.addLog(`   ✨ 御魂：抓牌+2，伤害+1，鬼火+1`);
          break;
          
        case '木魅':
          // 展示牌库获取阴阳术（简化：抓2张）
          this.drawCards(player, 2);
          this.addLog(`   ✨ 御魂：抓牌+2`);
          break;
          
        // ============ 生命7 ============
        case '幽谷响':
          // [妨害] 伤害+3
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '伤魂鸟':
          // 伤害+4（简化超度）
          player.damage += 4;
          this.addLog(`   ✨ 御魂：伤害+4`);
          break;
          
        case '阴摩罗':
          // 从弃牌区使用效果（简化：伤害+3）
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '镰鼬':
          // 伤害+4
          player.damage += 4;
          this.addLog(`   ✨ 御魂：伤害+4`);
          break;
          
        // ============ 生命8 ============
        case '青女房':
          // 伤害+5
          player.damage += 5;
          this.addLog(`   ✨ 御魂：伤害+5`);
          break;
          
        case '三味':
          // 本回合鬼火获取额外+1
          this.addLog(`   ✨ 御魂：三味共鸣`);
          break;
          
        // ============ 鬼王御魂 ============
        case '麒麟':
          // 伤害+3
          player.damage += 3;
          this.addLog(`   ✨ 御魂：伤害+3`);
          break;
          
        case '石距':
          // 伤害+4
          player.damage += 4;
          this.addLog(`   ✨ 御魂：伤害+4`);
          break;
          
        case '鬼灵歌伎':
          // 抓牌+3
          this.drawCards(player, 3);
          this.addLog(`   ✨ 御魂：抓牌+3`);
          break;
          
        case '土蜘蛛':
          // 伤害+5
          player.damage += 5;
          this.addLog(`   ✨ 御魂：伤害+5`);
          break;
          
        case '胧车':
          // 伤害+4，鬼火+1
          player.damage += 4;
          player.ghostFire = Math.min(player.ghostFire + 1, GAME_CONSTANTS.MAX_GHOST_FIRE);
          this.addLog(`   ✨ 御魂：伤害+4，鬼火+1`);
          break;
          
        case '蜃气楼':
          // 抓牌+4
          this.drawCards(player, 4);
          this.addLog(`   ✨ 御魂：抓牌+4`);
          break;
          
        case '荒骷髅':
          // 伤害+6
          player.damage += 6;
          this.addLog(`   ✨ 御魂：伤害+6`);
          break;
          
        case '鸦天狗':
          // 伤害+4，抓牌+2
          player.damage += 4;
          this.drawCards(player, 2);
          this.addLog(`   ✨ 御魂：伤害+4，抓牌+2`);
          break;
          
        case '地震鲶':
          // 伤害+7
          player.damage += 7;
          this.addLog(`   ✨ 御魂：伤害+7`);
          break;
          
        case '八岐大蛇':
          // 伤害+8
          player.damage += 8;
          this.addLog(`   ✨ 御魂：伤害+8`);
          break;
          
        case '贪嗔痴':
          // 伤害+9
          player.damage += 9;
          this.addLog(`   ✨ 御魂：伤害+9`);
          break;
          
        default:
          // 未实现的效果
          if (card.effect) {
            this.addLog(`   ⚠️ 御魂效果: ${card.effect}`);
          }
          // 默认给予少量伤害
          player.damage += 1;
          break;
      }
    }
  }
  
  /**
   * 给予玩家恶评卡
   */
  private givePenaltyCard(player: PlayerState): void {
    const penaltyCard: CardInstance = {
      instanceId: `penalty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cardId: 'penalty_farmer',
      cardType: 'penalty',
      name: '农夫',
      charm: -1,
      hp: 1,
      maxHp: 1,
      image: '/images/cards/penalty/farmer.webp',
    };
    player.discard.push(penaltyCard);
    this.addLog(`   😞 ${player.name} 获得恶评「农夫」`);
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
    
    // 击败妖怪（声誉会在notifyStateChange时自动重新计算）
    this.markTurnHadKill();
    this.state.field.yokaiSlots[slotIndex] = null;
    this.ensureYokaiDiscardFaceStats(yokai);
    player.discard.push(yokai);
    
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
    this.markTurnHadKill();

    // 鬼王进入弃牌堆（声誉会在notifyStateChange时自动重新计算）
    player.discard.push(boss as any);
    
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
      return { success: false, error: '妖怪刷新已改为回合开始自动「强者离场」，无需手动选择' };
    }

    this.state.pendingYokaiRefresh = false;
    this.enterActionPhase();
    return { success: true };
  }

  /**
   * 处理超度选择响应（唐纸伞妖等卡牌效果）
   * @param playerId 玩家ID
   * @param doSalvage 是否超度
   */
  public handleSalvageResponse(playerId: string, doSalvage: boolean): { success: boolean; error?: string } {
    // 验证是否有等待的超度选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'salvageChoice') {
      return { success: false, error: '没有待处理的超度选择' };
    }
    
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }
    
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    const topCard = this.state.pendingChoice.card;
    if (!topCard) {
      this.state.pendingChoice = undefined;
      return { success: false, error: '卡牌信息丢失' };
    }
    
    if (doSalvage) {
      // 执行超度：牌库顶 → 超度区
      const card = player.deck.shift();
      if (card) {
        player.exiled.push(card);
        this.addLog(`   ✨ ${player.name} 超度了 ${card.name}`);
      }
    } else {
      this.addLog(`   ↩️ ${player.name} 选择不超度`, { visibility: 'private', playerId });
    }
    
    // 清除等待状态
    this.state.pendingChoice = undefined;
    
    return { success: true };
  }

  /**
   * 处理妖怪目标选择响应（天邪鬼绿等卡牌效果）
   * @param playerId 玩家ID
   * @param targetId 选择的目标妖怪instanceId
   */
  public handleYokaiTargetResponse(playerId: string, targetId: string): { success: boolean; error?: string } {
    console.log('[Server] handleYokaiTargetResponse', {
      playerId,
      targetId,
      pending: this.state.pendingChoice?.type,
      options: (this.state.pendingChoice as any)?.options
    });
    // 验证是否有等待的目标选择
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'yokaiTarget') {
      return { success: false, error: '没有待处理的目标选择' };
    }
    
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }
    
    const player = this.getPlayer(playerId);
    if (!player) {
      // 兜底：同一玩家的选择已完成/被消费，避免 pendingChoice 反复触发导致卡死
      this.state.pendingChoice = undefined;
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: false, error: '玩家不存在' };
    }
    
    // 验证目标是否合法
    const validOptions = this.state.pendingChoice.options || [];
    if (!validOptions.includes(targetId)) {
      // 兜底：非法选择也要清掉 pendingChoice，避免客户端持续弹窗/交互锁导致卡死
      this.addLog(`   ⚠️ 御魂：非法目标选择已跳过`);
      this.state.pendingChoice = undefined;
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: false, error: '非法的目标选择' };
    }
    
    // 找到并退治目标妖怪
    const idx = this.state.field.yokaiSlots.findIndex(y => y?.instanceId === targetId);
    if (idx === -1) {
      console.log('[Server] handleYokaiTargetResponse idx not found', {
        targetId,
        slots: this.state.field.yokaiSlots.map(s => s?.instanceId)
      });
      // 兜底：避免 pendingChoice 残留
      this.state.pendingChoice = undefined;
      this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
      return { success: false, error: '目标妖怪不存在' };
    }
    
    const target = this.state.field.yokaiSlots[idx]!;
    this.state.field.yokaiSlots[idx] = null;
    this.ensureYokaiDiscardFaceStats(target);
    player.discard.push(target);
    this.addLog(`   ✨ 御魂：退治${target.name}`);
    
    // 清除等待状态
    this.state.pendingChoice = undefined;
    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    
    return { success: true };
  }

  /**
   * 处理御魂二选一响应（天邪鬼青等）
   * @param playerId 玩家ID（socket.id）
   * @param choiceIndex 选项下标：0=抓牌+1，1=伤害+1（按 pendingChoice.options 顺序）
   */
  public handleYokaiChoiceResponse(playerId: string, choiceIndex: number): { success: boolean; error?: string } {
    // 验证是否有等待的二选一
    if (!this.state.pendingChoice || this.state.pendingChoice.type !== 'yokaiChoice') {
      return { success: false, error: '没有待处理的御魂选择' };
    }
    // 验证是否是正确的玩家
    if (this.state.pendingChoice.playerId !== playerId) {
      return { success: false, error: '不是你的选择' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };

    // 默认兜底：无效下标按 0（抓牌+1）
    const idx = Number.isFinite(choiceIndex) ? choiceIndex : 0;

    if (idx === 0) {
      const drawn = this.drawCards(player, 1);
      this.addLog(`   ✨ 御魂：抓牌+1（抓到${drawn}张）`);
    } else {
      player.damage += 1;
      this.addLog(`   ✨ 御魂：伤害+1`);
    }

    // 清除等待状态
    this.state.pendingChoice = undefined;

    this.notifyStateChange({ type: 'STATE_UPDATE', state: this.state });
    return { success: true };
  }

  /**
   * 处理结束回合
   */
  private handleEndTurn(playerId: string): { success: boolean; error?: string } {
    if (this.state.turnPhase !== 'action') {
      return { success: false, error: '当前阶段不能结束回合' };
    }
    
    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: '玩家不存在' };
    
    // 自动处理未选择的死亡妖怪（默认退治）
    const pendingList = (this.state as any).pendingDeathChoices || [];
    for (const slotIndex of [...pendingList]) {
      const yokai = this.state.field.yokaiSlots[slotIndex];
      if (yokai && (yokai.hp || 0) <= 0) {
        // 默认选择退治（放入弃牌堆）
        this.ensureYokaiDiscardFaceStats(yokai);
        player.discard.push(yokai);
        this.state.field.yokaiSlots[slotIndex] = null;
        this.addLog(`📥 ${player.name} 自动退治了 ${yokai.name}（+${yokai.charm || 0} 声誉）`);
      }
    }
    // 清空待选择列表
    (this.state as any).pendingDeathChoices = [];
    
    // 自动处理未选择的死亡鬼王（默认退治）
    if ((this.state as any).pendingBossDeath) {
      const boss = this.state.field.currentBoss;
      if (boss && this.state.field.bossCurrentHp <= 0) {
        // 默认选择退治（放入弃牌堆）
        player.discard.push(boss as any);
        this.addLog(`📥 ${player.name} 自动退治了鬼王 ${boss.name}（+${boss.charm || 0} 声誉）`);
        
        // 清除当前鬼王并翻出下一个
        this.state.field.currentBoss = null;
        this.revealBoss();
      }
      (this.state as any).pendingBossDeath = false;
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
   * @param message 消息内容（自动识别卡牌/式神/鬼王名称生成超链接）
   * @param options 可选参数：visibility(可见性), playerId(私有消息所属玩家), refs(手动指定引用对象)
   */
  private addLog(
    message: string, 
    options?: {
      visibility?: 'public' | 'private';
      playerId?: string;
      refs?: Record<string, { type: 'card' | 'shikigami' | 'boss' | 'player'; id: string; name: string; data?: any }>;
    }
  ): void {
    // 自动提取实体引用
    const autoRefs = this.extractEntityRefs(message);
    const finalRefs = { ...autoRefs, ...(options?.refs || {}) };
    
    // 替换消息中的实体名称为占位符格式
    let processedMessage = message;
    for (const [key, ref] of Object.entries(finalRefs)) {
      const name = ref.name;
      // 简单替换：直接将名称替换为占位符
      if (processedMessage.includes(name)) {
        processedMessage = processedMessage.split(name).join(`{${key}}`);
      }
    }
    
    this.state.log.push({
      type: 'game_start',
      message: processedMessage,
      timestamp: Date.now(),
      logSeq: this.nextLogSeq++,
      visibility: options?.visibility || 'public',
      playerId: options?.playerId,
      refs: Object.keys(finalRefs).length > 0 ? finalRefs : undefined,
    });
    
    // 保留最近100条日志
    if (this.state.log.length > 100) {
      this.state.log = this.state.log.slice(-100);
    }
  }

  /**
   * 推入聊天等外部写入的日志（与 addLog 共用 logSeq，避免前端列表 key 重复）
   */
  appendChatLogEntry(entry: GameLogEntry): void {
    const row: GameLogEntry = {
      ...entry,
      logSeq: this.nextLogSeq++,
    };
    this.state.log.push(row);
    if (this.state.log.length > 100) {
      this.state.log = this.state.log.slice(-100);
    }
  }

  /**
   * 从日志消息中提取实体引用
   */
  private extractEntityRefs(message: string): Record<string, { type: 'card' | 'shikigami' | 'boss' | 'player'; id: string; name: string; data?: any }> {
    const refs: Record<string, { type: 'card' | 'shikigami' | 'boss' | 'player'; id: string; name: string; data?: any }> = {};
    let refIndex = 0;
    
    // 从卡牌数据中查找匹配的名称
    const allYokai = cardsData.yokai || [];
    const allBoss = cardsData.boss || [];
    const allShikigami = cardsData.shikigami || [];
    const allSpells = ['基础术式', '中级符咒', '高级符咒'];
    
    // 检查妖怪
    for (const yokai of allYokai) {
      if (message.includes(yokai.name)) {
        const key = `yokai_${refIndex++}`;
        refs[key] = {
          type: 'card',
          id: yokai.id || yokai.cardId,
          name: yokai.name,
          data: { hp: yokai.hp, damage: yokai.damage, charm: yokai.charm, image: yokai.image, effect: yokai.effect }
        };
      }
    }
    
    // 检查鬼王
    for (const boss of allBoss) {
      if (message.includes(boss.name)) {
        const key = `boss_${refIndex++}`;
        refs[key] = {
          type: 'boss',
          id: boss.id || boss.cardId,
          name: boss.name,
          data: { hp: boss.hp, charm: boss.charm, image: boss.image, effect: boss.effect }
        };
      }
    }
    
    // 检查式神
    for (const shikigami of allShikigami) {
      if (message.includes(shikigami.name)) {
        const key = `shikigami_${refIndex++}`;
        refs[key] = {
          type: 'shikigami',
          id: shikigami.id || shikigami.cardId,
          name: shikigami.name,
          data: { hp: shikigami.hp, charm: shikigami.charm, image: shikigami.image, skill: shikigami.skill, skillCost: shikigami.skillCost }
        };
      }
    }
    
    // 检查阴阳术
    for (const spellName of allSpells) {
      if (message.includes(spellName)) {
        const key = `spell_${refIndex++}`;
        const spellData = spellName === '基础术式' 
          ? { damage: 1, hp: 1, charm: 0, image: '阴阳术01.png' }
          : spellName === '中级符咒'
          ? { damage: 2, hp: 2, charm: 0, image: '阴阳术02.png' }
          : { damage: 3, hp: 3, charm: 1, image: '阴阳术03.png' };
        refs[key] = {
          type: 'card',
          id: `spell_${spellName}`,
          name: spellName,
          data: spellData
        };
      }
    }
    
    return refs;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 计算玩家声誉（牌库中所有卡牌的charm值 + 式神区charm值）
   */
  private calculatePlayerCharm(player: PlayerState): number {
    let charm = 0;
    
    // 牌库中所有卡牌（deck + hand + discard + played）
    const allCards = [
      ...(player.deck || []),
      ...(player.hand || []),
      ...(player.discard || []),
      ...(player.played || []),
    ];
    
    for (const card of allCards) {
      charm += card.charm || 0;
    }
    
    // 式神区
    for (const shikigami of (player.shikigami || [])) {
      charm += shikigami.charm || 0;
    }
    
    return charm;
  }
  
  /**
   * 更新所有玩家声誉
   */
  private updateAllPlayersCharm(): void {
    for (const player of this.state.players) {
      player.totalCharm = this.calculatePlayerCharm(player);
    }
  }
  
  /**
   * 通知状态变更
   */
  private notifyStateChange(event?: GameEvent): void {
    // 在发送状态前，重新计算所有玩家的声誉
    this.updateAllPlayersCharm();
    
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